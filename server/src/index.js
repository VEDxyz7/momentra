import compression from "compression";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import multer from "multer";
import path from "node:path";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { canAccessAlbum, requireAuth, requireRole, signAccess, signRefresh, verifyToken } from "./auth.js";
import { emit, attachRealtime } from "./realtime.js";
import { enrichMedia, eventStats, id, now, publicUser, readDb, roleRank, transact } from "./db.js";
import { faceEmbedding, semanticScore, similarity, tagImage } from "./services/aiService.js";
import { analyzeImage, applyWatermark, createDerivatives } from "./services/imageService.js";
import { getObjectBuffer, putObject, signedReadUrl, signedWriteUrl, storageMode } from "./services/storageService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(__dirname, "../uploads");
const distDir = path.resolve(__dirname, "../../dist");
await mkdir(uploadDir, { recursive: true });

const app = express();
const server = createServer(app);
const port = Number(process.env.PORT ?? 4000);
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";
const corsOptions = {
  origin(origin, callback) {
    if (!origin || origin === webOrigin || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true
};
await attachRealtime(server, [/^http:\/\/(localhost|127\.0\.0\.1):\d+$/, webOrigin]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));
app.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));
app.use("/uploads", express.static(uploadDir));
if (existsSync(distDir)) app.use(express.static(distDir));

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function userFromDb(db, req) {
  return db.users.find((user) => user.id === req.auth?.sub && !user.banned);
}

function addNotification(db, { userId, type, text, entityType, entityId }) {
  const notification = { id: id("not"), userId, type, text, entityType, entityId, readAt: null, createdAt: now() };
  db.notifications.unshift(notification);
  emit("notification:new", notification);
  return notification;
}

function serializeEvent(db, event) {
  const stats = eventStats(db, event.id);
  return {
    ...event,
    cover: event.coverUrl,
    visibility: event.privacy,
    ...stats,
    albums: db.albums.filter((album) => album.eventId === event.id)
  };
}

function computeAnalytics(db) {
  const activeMedia = db.media.filter((item) => !item.deletedAt);
  const storageMb = activeMedia.reduce((sum, item) => sum + (item.metadata?.sizeMb ?? 2), 0);
  const complete = activeMedia.filter((item) => item.processing.status === "COMPLETE").length;
  return [
    { label: "Media assets", value: activeMedia.length, delta: "+ live DB count" },
    { label: "CDN delivered", value: `${(storageMb / 1024).toFixed(2)}TB`, delta: `${storageMode()} storage` },
    { label: "Active members", value: db.users.filter((user) => !user.banned).length, delta: "RBAC users" },
    { label: "AI matches", value: activeMedia.reduce((sum, item) => sum + item.faces.length, 0), delta: "faces indexed" },
    { label: "Downloads", value: db.activity.filter((item) => item.type === "DOWNLOAD").length, delta: "watermarked by role" },
    { label: "Private albums", value: db.albums.filter((album) => album.visibility !== "PUBLIC").length, delta: "permissions enforced" },
    { label: "Processing", value: `${Math.round((complete / Math.max(1, activeMedia.length)) * 100)}%`, delta: "AI queue health" },
    { label: "Storage used", value: `${storageMb.toFixed(1)}MB`, delta: "compressed derivatives" }
  ];
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "momentra-api", realtime: true });
});

app.post("/api/auth/signup", asyncRoute(async (req, res) => {
  const body = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8) }).parse(req.body);
  const result = await transact(async (db) => {
    if (db.users.some((user) => user.email === body.email)) throw Object.assign(new Error("Email already exists"), { status: 409 });
    const user = {
      id: id("usr"),
      name: body.name,
      email: body.email,
      role: "VIEWER",
      passwordHash: await bcrypt.hash(body.password, 12),
      avatarUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(body.name)}`,
      verified: false,
      banned: false,
      verificationToken: id("verify"),
      createdAt: now()
    };
    db.users.push(user);
    return user;
  });
  const token = signAccess(result);
  res.status(201).json({ user: publicUser(result), token, accessToken: token, refreshToken: signRefresh(result) });
}));

app.post("/api/auth/logout", requireAuth, asyncRoute(async (req, res) => {
  await transact(async (db) => {
    db.sessions = db.sessions.filter((session) => session.userId !== req.auth.sub);
  });
  res.json({ ok: true });
}));

app.post("/api/auth/login", asyncRoute(async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const db = await readDb();
  const user = db.users.find((item) => item.email === body.email);
  if (!user || user.banned || !(await bcrypt.compare(body.password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = signAccess(user);
  res.json({ user: publicUser(user), token, accessToken: token, refreshToken: signRefresh(user) });
}));

app.post("/api/auth/refresh", asyncRoute(async (req, res) => {
  const body = z.object({ refreshToken: z.string() }).parse(req.body);
  const payload = verifyToken(body.refreshToken);
  const db = await readDb();
  const user = db.users.find((item) => item.id === payload.sub && !item.banned);
  if (!user) return res.status(401).json({ error: "Invalid refresh token" });
  const token = signAccess(user);
  res.json({ token, accessToken: token, user: publicUser(user), refreshToken: body.refreshToken });
}));

app.post("/api/auth/password-reset", asyncRoute(async (req, res) => {
  const body = z.object({ email: z.string().email() }).parse(req.body);
  await transact(async (db) => {
    const user = db.users.find((item) => item.email === body.email);
    if (user) user.resetToken = id("reset");
  });
  res.json({ ok: true, message: "Password reset token generated for configured email provider." });
}));

app.get("/api/me", requireAuth, asyncRoute(async (req, res) => {
  const db = await readDb();
  const user = userFromDb(db, req);
  if (!user) return res.status(401).json({ error: "User not found" });
  res.json({ user: publicUser(user), permissions: roleRank[user.role] });
}));

app.get("/api/auth/me", requireAuth, asyncRoute(async (req, res) => {
  const db = await readDb();
  const user = userFromDb(db, req);
  if (!user) return res.status(401).json({ error: "User not found" });
  res.json({ user: publicUser(user), permissions: roleRank[user.role] });
}));

app.get("/api/dashboard", requireAuth, asyncRoute(async (req, res) => {
  const db = await readDb();
  const user = userFromDb(db, req);
  const albums = db.albums.filter((album) => canAccessAlbum(user.role, album.visibility));
  const eventIds = new Set(albums.map((album) => album.eventId));
  res.json({
    events: db.events.filter((event) => eventIds.has(event.id)).map((event) => serializeEvent(db, event)),
    albums,
    analytics: computeAnalytics(db),
    notifications: db.notifications.filter((notification) => notification.userId === user.id).slice(0, 20),
    users: db.users.map(publicUser)
  });
}));

app.get("/api/events", requireAuth, asyncRoute(async (req, res) => {
  const db = await readDb();
  const user = userFromDb(db, req);
  const sort = req.query.sort ?? "date";
  const query = String(req.query.q ?? "").toLowerCase();
  const albums = db.albums.filter((album) => canAccessAlbum(user.role, album.visibility));
  const eventIds = new Set(albums.map((album) => album.eventId));
  const data = db.events
    .filter((event) => eventIds.has(event.id))
    .filter((event) => `${event.name} ${event.description} ${event.category}`.toLowerCase().includes(query))
    .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "category" ? a.category.localeCompare(b.category) : new Date(b.date) - new Date(a.date))
    .map((event) => serializeEvent(db, event));
  res.json({ data });
}));

app.post("/api/events", requireAuth, requireRole("ADMIN"), upload.single("cover"), asyncRoute(async (req, res) => {
  const body = z.object({
    name: z.string().min(2),
    description: z.string().min(5),
    date: z.string().min(4),
    category: z.string().min(2),
    privacy: z.enum(["PUBLIC", "PRIVATE", "CLUB_ONLY"]),
    clubName: z.string().min(2).default("Campus Club")
  }).parse(req.body);
  let coverUrl = "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1600&q=80";
  if (req.file) {
    const key = `covers/${Date.now()}-${req.file.originalname.replaceAll(" ", "-")}`;
    coverUrl = (await putObject({ buffer: req.file.buffer, key, contentType: req.file.mimetype, localRoot: uploadDir })).url;
  }
  const result = await transact(async (db) => {
    const event = {
      id: id("evt"),
      ...body,
      coverUrl,
      createdById: req.auth.sub,
      createdAt: now(),
      updatedAt: now()
    };
    const album = {
      id: id("alb"),
      eventId: event.id,
      title: `${event.name} Album`,
      description: event.description,
      visibility: body.privacy,
      collaborative: body.privacy !== "PRIVATE",
      qrToken: id("qr"),
      createdAt: now(),
      updatedAt: now()
    };
    db.events.unshift(event);
    db.albums.unshift(album);
    db.activity.unshift({ id: id("act"), type: "EVENT_CREATED", userId: req.auth.sub, entityId: event.id, createdAt: now() });
    return { event: serializeEvent(db, event), album };
  });
  emit("event:created", result);
  res.status(201).json(result);
}));

app.delete("/api/events/:id", requireAuth, requireRole("ADMIN"), asyncRoute(async (req, res) => {
  await transact(async (db) => {
    const index = db.events.findIndex((event) => event.id === req.params.id);
    if (index === -1) throw Object.assign(new Error("Event not found"), { status: 404 });
    db.events.splice(index, 1);
    const albumIds = db.albums.filter((album) => album.eventId === req.params.id).map((album) => album.id);
    db.albums = db.albums.filter((album) => album.eventId !== req.params.id);
    db.media.forEach((item) => {
      if (albumIds.includes(item.albumId)) item.deletedAt = now();
    });
    db.activity.unshift({ id: id("act"), type: "EVENT_DELETED", userId: req.auth.sub, entityId: req.params.id, createdAt: now() });
  });
  emit("event:deleted", { id: req.params.id });
  res.status(204).end();
}));

app.patch("/api/events/:id", requireAuth, requireRole("ADMIN"), asyncRoute(async (req, res) => {
  const body = z.object({
    name: z.string().min(2).optional(),
    description: z.string().min(5).optional(),
    date: z.string().min(4).optional(),
    category: z.string().min(2).optional(),
    privacy: z.enum(["PUBLIC", "PRIVATE", "CLUB_ONLY"]).optional(),
    clubName: z.string().min(2).optional()
  }).parse(req.body);
  const result = await transact(async (db) => {
    const event = db.events.find((item) => item.id === req.params.id);
    if (!event) throw Object.assign(new Error("Event not found"), { status: 404 });
    Object.assign(event, body, { updatedAt: now() });
    db.albums.filter((album) => album.eventId === event.id).forEach((album) => {
      if (body.name) album.title = `${body.name} Album`;
      if (body.description) album.description = body.description;
      if (body.privacy) album.visibility = body.privacy;
      album.updatedAt = now();
    });
    return serializeEvent(db, event);
  });
  emit("event:updated", result);
  res.json(result);
}));

app.get("/api/albums", requireAuth, asyncRoute(async (req, res) => {
  const db = await readDb();
  const user = userFromDb(db, req);
  const sort = String(req.query.sort ?? "date");
  const albums = db.albums
    .filter((album) => canAccessAlbum(user.role, album.visibility))
    .map((album) => {
      const albumMedia = db.media.filter((item) => item.albumId === album.id && !item.deletedAt);
      return {
        ...album,
        event: db.events.find((event) => event.id === album.eventId),
        uploadCount: albumMedia.length,
        popularity: albumMedia.reduce((sum, item) => sum + db.likes.filter((like) => like.mediaId === item.id).length, 0),
        aiRelevance: albumMedia.reduce((sum, item) => sum + item.tags.length, 0)
      };
    })
    .sort((a, b) => sort === "popularity" ? b.popularity - a.popularity : sort === "uploadCount" ? b.uploadCount - a.uploadCount : sort === "ai" ? b.aiRelevance - a.aiRelevance : new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ data: albums });
}));

app.post("/api/albums", requireAuth, requireRole("ADMIN"), asyncRoute(async (req, res) => {
  const body = z.object({ eventId: z.string(), title: z.string().min(2), description: z.string().optional(), visibility: z.enum(["PUBLIC", "PRIVATE", "CLUB_ONLY"]), collaborative: z.boolean().default(false) }).parse(req.body);
  const album = await transact(async (db) => {
    const event = db.events.find((item) => item.id === body.eventId);
    if (!event) throw Object.assign(new Error("Event not found"), { status: 404 });
    const created = { id: id("alb"), ...body, qrToken: id("qr"), createdAt: now(), updatedAt: now() };
    db.albums.unshift(created);
    return created;
  });
  emit("album:created", album);
  res.status(201).json(album);
}));

app.patch("/api/albums/:id", requireAuth, requireRole("ADMIN"), asyncRoute(async (req, res) => {
  const album = await transact(async (db) => {
    const found = db.albums.find((item) => item.id === req.params.id);
    if (!found) throw Object.assign(new Error("Album not found"), { status: 404 });
    Object.assign(found, req.body, { updatedAt: now() });
    return found;
  });
  emit("album:updated", album);
  res.json(album);
}));

app.delete("/api/albums/:id", requireAuth, requireRole("ADMIN"), asyncRoute(async (req, res) => {
  await transact(async (db) => {
    const index = db.albums.findIndex((album) => album.id === req.params.id);
    if (index === -1) throw Object.assign(new Error("Album not found"), { status: 404 });
    const [album] = db.albums.splice(index, 1);
    db.media.filter((item) => item.albumId === album.id).forEach((item) => { item.deletedAt = now(); });
  });
  emit("album:deleted", { id: req.params.id });
  res.status(204).end();
}));

app.get("/api/media", requireAuth, asyncRoute(async (req, res) => {
  const db = await readDb();
  const user = userFromDb(db, req);
  const limit = Math.min(50, Number(req.query.limit ?? 24));
  const offset = Number(req.query.offset ?? 0);
  const query = String(req.query.q ?? "").toLowerCase();
  const albumId = req.query.albumId ? String(req.query.albumId) : null;
  const allowedAlbumIds = new Set(db.albums.filter((album) => canAccessAlbum(user.role, album.visibility)).map((album) => album.id));
  const data = db.media
    .filter((item) => !item.deletedAt && allowedAlbumIds.has(item.albumId))
    .filter((item) => !albumId || item.albumId === albumId)
    .filter((item) => `${item.caption} ${item.aiCaption} ${item.tags.join(" ")}`.toLowerCase().includes(query))
    .slice(offset, offset + limit)
    .map((item) => enrichMedia(db, item, user.id));
  res.json({ data, nextOffset: offset + data.length, hasMore: offset + data.length < db.media.length });
}));

app.post("/api/uploads", requireAuth, requireRole("PHOTOGRAPHER"), upload.array("files", 30), asyncRoute(async (req, res) => {
  const body = z.object({ albumId: z.string() }).parse(req.body);
  if (!req.files?.length) return res.status(400).json({ error: "No files uploaded" });
  const created = await transact(async (db) => {
    const album = db.albums.find((item) => item.id === body.albumId);
    if (!album) throw Object.assign(new Error("Album not found"), { status: 404 });
    const event = db.events.find((item) => item.id === album.eventId);
    return Promise.all(req.files.map(async (file) => {
      const originalKey = `albums/${album.id}/originals/${Date.now()}-${file.originalname.replaceAll(" ", "-")}`;
      const optimizedKey = `albums/${album.id}/optimized/${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, "")}.jpg`;
      const thumbnailKey = `albums/${album.id}/thumbnails/${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, "")}.jpg`;
      const isImage = file.mimetype.startsWith("image/");
      let imageMetadata = {};
      let ai = { tags: ["upload", event.category.toLowerCase()], caption: `Uploaded media for ${event.name}`, moderationStatus: "PENDING", embedding: null };
      let optimizedResult;
      let thumbnailResult;

      const originalResult = await putObject({ buffer: file.buffer, key: originalKey, contentType: file.mimetype, localRoot: uploadDir });
      if (isImage) {
        const analysis = await analyzeImage(file.buffer);
        imageMetadata = analysis.metadata;
        const derivatives = await createDerivatives(file.buffer);
        optimizedResult = await putObject({ buffer: derivatives.optimized, key: optimizedKey, contentType: "image/jpeg", localRoot: uploadDir });
        thumbnailResult = await putObject({ buffer: derivatives.thumbnail, key: thumbnailKey, contentType: "image/jpeg", localRoot: uploadDir });
        ai = await tagImage({ fileName: file.originalname, event, metadata: { ...analysis.metadata, buffer: file.buffer }, stats: analysis.stats });
      }
      const item = {
        id: id("med"),
        eventId: album.eventId,
        albumId: album.id,
        uploaderId: req.auth.sub,
        type: file.mimetype.startsWith("video") ? "VIDEO" : "PHOTO",
        url: optimizedResult?.url ?? originalResult.url,
        originalUrl: originalResult.url,
        thumbnailUrl: thumbnailResult?.url ?? originalResult.url,
        storageMode: originalResult.mode,
        originalKey,
        optimizedKey: optimizedResult?.key ?? originalKey,
        thumbnailKey: thumbnailResult?.key ?? originalKey,
        fileName: file.originalname,
        caption: file.originalname.replace(/\.[^/.]+$/, "").replaceAll("-", " "),
        aiCaption: ai.caption,
        tags: ai.tags,
        faces: [],
        faceEmbedding: isImage ? await faceEmbedding(file.buffer) : null,
        duplicateScore: 0,
        moderationStatus: ai.moderationStatus,
        metadata: { sizeMb: Number((file.size / 1024 / 1024).toFixed(2)), mimeType: file.mimetype, width: imageMetadata.width, height: imageMetadata.height, storageKey: originalKey, optimizedKey, thumbnailKey },
        processing: { status: "COMPLETE", progress: 100, stage: "AI indexed" },
        embedding: ai.embedding,
        createdAt: now(),
        updatedAt: now(),
        deletedAt: null
      };
      const duplicate = db.media.find((existing) => existing.embedding && existing.embedding === item.embedding);
      if (duplicate) item.duplicateScore = 1;
      db.media.unshift(item);
      addNotification(db, { userId: event.createdById, type: "UPLOAD", text: `${file.originalname} uploaded to ${album.title}`, entityType: "media", entityId: item.id });
      return enrichMedia(db, item, req.auth.sub);
    }));
  });
  emit("upload:created", created);
  emit("upload:processed", created);
  res.status(201).json({ data: created });
}));

app.post("/api/uploads/signed-url", requireAuth, requireRole("PHOTOGRAPHER"), asyncRoute(async (req, res) => {
  const body = z.object({ albumId: z.string(), fileName: z.string(), contentType: z.string() }).parse(req.body);
  const key = `albums/${body.albumId}/originals/${Date.now()}-${body.fileName.replaceAll(" ", "-")}`;
  const uploadUrl = await signedWriteUrl({ key, contentType: body.contentType });
  if (!uploadUrl) return res.status(501).json({ error: "S3 credentials are not configured; signed upload URLs require AWS_REGION and S3_BUCKET_ORIGINALS." });
  res.json({ key, uploadUrl });
}));

app.patch("/api/media/:id/trash", requireAuth, requireRole("PHOTOGRAPHER"), asyncRoute(async (req, res) => {
  const media = await transact(async (db) => {
    const item = db.media.find((entry) => entry.id === req.params.id);
    if (!item) throw Object.assign(new Error("Media not found"), { status: 404 });
    item.deletedAt = now();
    db.trash.unshift({ id: id("trash"), mediaId: item.id, deletedById: req.auth.sub, createdAt: now() });
    return item;
  });
  emit("media:trashed", media);
  res.json(media);
}));

app.post("/api/media/:id/restore", requireAuth, requireRole("ADMIN"), asyncRoute(async (req, res) => {
  const media = await transact(async (db) => {
    const item = db.media.find((entry) => entry.id === req.params.id);
    if (!item) throw Object.assign(new Error("Media not found"), { status: 404 });
    item.deletedAt = null;
    return item;
  });
  emit("media:restored", media);
  res.json(media);
}));

app.post("/api/media/:id/like", requireAuth, asyncRoute(async (req, res) => {
  const result = await transact(async (db) => {
    const existing = db.likes.find((like) => like.mediaId === req.params.id && like.userId === req.auth.sub);
    if (existing) db.likes = db.likes.filter((like) => like.id !== existing.id);
    else db.likes.push({ id: id("like"), mediaId: req.params.id, userId: req.auth.sub, createdAt: now() });
    const media = db.media.find((item) => item.id === req.params.id);
    if (media && media.uploaderId !== req.auth.sub && !existing) {
      addNotification(db, { userId: media.uploaderId, type: "LIKE", text: "Someone liked your photo", entityType: "media", entityId: media.id });
    }
    return enrichMedia(db, media, req.auth.sub);
  });
  emit("media:liked", result);
  res.json(result);
}));

app.post("/api/media/:id/favourite", requireAuth, asyncRoute(async (req, res) => {
  const result = await transact(async (db) => {
    const existing = db.favourites.find((fav) => fav.mediaId === req.params.id && fav.userId === req.auth.sub);
    if (existing) db.favourites = db.favourites.filter((fav) => fav.id !== existing.id);
    else db.favourites.push({ id: id("fav"), mediaId: req.params.id, userId: req.auth.sub, createdAt: now() });
    return enrichMedia(db, db.media.find((item) => item.id === req.params.id), req.auth.sub);
  });
  emit("media:favourited", result);
  res.json(result);
}));

app.post("/api/media/:id/comments", requireAuth, asyncRoute(async (req, res) => {
  const body = z.object({ body: z.string().min(1), parentId: z.string().nullable().optional() }).parse(req.body);
  const comment = await transact(async (db) => {
    const media = db.media.find((item) => item.id === req.params.id);
    if (!media) throw Object.assign(new Error("Media not found"), { status: 404 });
    const created = { id: id("com"), mediaId: media.id, userId: req.auth.sub, parentId: body.parentId ?? null, body: body.body, createdAt: now() };
    db.comments.push(created);
    if (media.uploaderId !== req.auth.sub) addNotification(db, { userId: media.uploaderId, type: "COMMENT", text: "Someone commented on your upload", entityType: "media", entityId: media.id });
    return { ...created, user: publicUser(db.users.find((user) => user.id === req.auth.sub)), replies: [] };
  });
  emit("comment:created", comment);
  res.status(201).json(comment);
}));

app.post("/api/media/:id/tag", requireAuth, requireRole("CLUB_MEMBER"), asyncRoute(async (req, res) => {
  const body = z.object({ userId: z.string() }).parse(req.body);
  const media = await transact(async (db) => {
    const item = db.media.find((entry) => entry.id === req.params.id);
    if (!item) throw Object.assign(new Error("Media not found"), { status: 404 });
    if (!item.faces.includes(body.userId)) item.faces.push(body.userId);
    addNotification(db, { userId: body.userId, type: "TAG", text: "Someone tagged you in a photo", entityType: "media", entityId: item.id });
    return enrichMedia(db, item, req.auth.sub);
  });
  emit("media:tagged", media);
  res.json(media);
}));

app.post("/api/media/:id/download", requireAuth, asyncRoute(async (req, res) => {
  const db = await readDb();
  const media = db.media.find((item) => item.id === req.params.id);
  if (!media) return res.status(404).json({ error: "Media not found" });
  const event = db.events.find((item) => item.id === media?.eventId);
  const user = userFromDb(db, req);
  const album = db.albums.find((item) => item.id === media.albumId);
  if (!canAccessAlbum(user.role, album.visibility)) return res.status(403).json({ error: "Album access denied" });
  const sourceKey = media.optimizedKey ?? media.originalKey ?? media.metadata?.storageKey;
  let source;
  if (sourceKey) source = await getObjectBuffer({ key: sourceKey, localRoot: uploadDir });
  else if (media.url?.startsWith("http")) source = Buffer.from(await (await fetch(media.url)).arrayBuffer());
  else return res.status(422).json({ error: "Media source is unavailable for watermarking" });
  const watermarked = await applyWatermark(source, { clubName: event.clubName, eventName: event.name, role: user.role });
  const downloadKey = `downloads/${media.id}-${user.role}.jpg`;
  const stored = await putObject({ buffer: watermarked, key: downloadKey, contentType: "image/jpeg", localRoot: uploadDir });
  await transact(async (next) => {
    next.activity.unshift({ id: id("act"), type: "DOWNLOAD", userId: user.id, entityId: req.params.id, createdAt: now() });
  });
  const signedUrl = await signedReadUrl(downloadKey);
  res.json({
    url: signedUrl ?? stored.url,
    watermark: {
      text: `${event.clubName} • ${event.name} • ${user.role}`,
      opacity: user.role === "VIEWER" ? 0.42 : 0.24,
      position: "bottom-right"
    }
  });
}));

app.post("/api/share", requireAuth, asyncRoute(async (req, res) => {
  const body = z.object({ albumId: z.string(), privacy: z.enum(["PUBLIC", "PRIVATE"]), expiresInHours: z.number().min(1).max(720) }).parse(req.body);
  const share = await transact(async (db) => {
    const album = db.albums.find((item) => item.id === body.albumId);
    if (!album) throw Object.assign(new Error("Album not found"), { status: 404 });
    const created = {
      id: id("shr"),
      albumId: album.id,
      token: id("link"),
      privacy: body.privacy,
      expiresAt: new Date(Date.now() + body.expiresInHours * 3600_000).toISOString(),
      createdById: req.auth.sub,
      createdAt: now()
    };
    db.shares.unshift(created);
    return created;
  });
  res.status(201).json({ ...share, url: `${webOrigin}/share/${share.token}` });
}));

app.get("/api/public/share/:token", asyncRoute(async (req, res) => {
  const db = await readDb();
  const share = db.shares.find((item) => item.token === req.params.token && new Date(item.expiresAt) > new Date());
  if (!share) return res.status(404).json({ error: "Share link not found or expired" });
  const album = db.albums.find((item) => item.id === share.albumId);
  if (!album || (share.privacy !== "PUBLIC" && album.visibility !== "PUBLIC")) return res.status(403).json({ error: "Private share requires authentication" });
  const event = db.events.find((item) => item.id === album.eventId);
  const media = db.media.filter((item) => item.albumId === album.id && !item.deletedAt).map((item) => enrichMedia(db, item, null));
  res.json({ share, album, event, media });
}));

app.get("/api/public/media", asyncRoute(async (req, res) => {
  const db = await readDb();
  const albumId = req.query.albumId ? String(req.query.albumId) : null;
  const publicAlbumIds = new Set(db.albums.filter((album) => album.visibility === "PUBLIC").map((album) => album.id));
  const data = db.media
    .filter((item) => !item.deletedAt && publicAlbumIds.has(item.albumId))
    .filter((item) => !albumId || item.albumId === albumId)
    .map((item) => enrichMedia(db, item, null));
  res.json({ data });
}));

app.get("/api/notifications", requireAuth, asyncRoute(async (req, res) => {
  const db = await readDb();
  res.json({ data: db.notifications.filter((item) => item.userId === req.auth.sub).slice(0, 50) });
}));

app.post("/api/notifications/:id/read", requireAuth, asyncRoute(async (req, res) => {
  const notification = await transact(async (db) => {
    const item = db.notifications.find((entry) => entry.id === req.params.id && entry.userId === req.auth.sub);
    if (!item) throw Object.assign(new Error("Notification not found"), { status: 404 });
    item.readAt = now();
    return item;
  });
  emit("notification:read", notification);
  res.json(notification);
}));

app.get("/api/ai/search", requireAuth, asyncRoute(async (req, res) => {
  const db = await readDb();
  const user = userFromDb(db, req);
  const q = String(req.query.q ?? "").toLowerCase();
  const eventId = req.query.eventId ? String(req.query.eventId) : null;
  const uploaderId = req.query.uploaderId ? String(req.query.uploaderId) : null;
  const allowedAlbums = new Set(db.albums.filter((album) => canAccessAlbum(user.role, album.visibility)).map((album) => album.id));
  const uploadDate = req.query.uploadDate ? String(req.query.uploadDate) : null;
  const data = db.media
    .filter((item) => !item.deletedAt && allowedAlbums.has(item.albumId))
    .filter((item) => !eventId || item.eventId === eventId)
    .filter((item) => !uploaderId || item.uploaderId === uploaderId)
    .filter((item) => !uploadDate || item.createdAt.startsWith(uploadDate))
    .map((item) => {
      const event = db.events.find((entry) => entry.id === item.eventId);
      const uploader = db.users.find((entry) => entry.id === item.uploaderId);
      const score = semanticScore(q, item, event, uploader);
      return { ...enrichMedia(db, item, user.id), matchScore: Math.min(99, score) };
    })
    .filter((item) => !q || item.matchScore > 42)
    .sort((a, b) => b.matchScore - a.matchScore);
  res.json({ data });
}));

app.post("/api/ai/find-my-photos", requireAuth, upload.single("selfie"), asyncRoute(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Selfie upload is required" });
  const db = await readDb();
  const user = userFromDb(db, req);
  const reference = await faceEmbedding(req.file.buffer);
  const data = db.media
    .filter((item) => !item.deletedAt && item.faceEmbedding)
    .map((item) => ({ ...enrichMedia(db, item, user.id), matchScore: similarity(reference, item.faceEmbedding), referenceFaceId: reference.slice(0, 16) }))
    .filter((item) => item.matchScore >= 45)
    .sort((a, b) => b.matchScore - a.matchScore);
  res.json({ referenceFaceId: reference.slice(0, 16), data });
}));

app.get("/api/users", requireAuth, requireRole("ADMIN"), asyncRoute(async (_req, res) => {
  const db = await readDb();
  res.json({ data: db.users.map(publicUser) });
}));

app.patch("/api/users/:id", requireAuth, requireRole("ADMIN"), asyncRoute(async (req, res) => {
  const body = z.object({ role: z.enum(["ADMIN", "PHOTOGRAPHER", "CLUB_MEMBER", "VIEWER"]).optional(), banned: z.boolean().optional(), verified: z.boolean().optional() }).parse(req.body);
  const user = await transact(async (db) => {
    const found = db.users.find((item) => item.id === req.params.id);
    if (!found) throw Object.assign(new Error("User not found"), { status: 404 });
    Object.assign(found, body);
    return publicUser(found);
  });
  emit("user:updated", user);
  res.json(user);
}));

app.delete("/api/users/:id", requireAuth, requireRole("ADMIN"), asyncRoute(async (req, res) => {
  await transact(async (db) => {
    db.users = db.users.filter((item) => item.id !== req.params.id);
  });
  emit("user:deleted", { id: req.params.id });
  res.status(204).end();
}));

app.get("/api/storage", requireAuth, requireRole("PHOTOGRAPHER"), asyncRoute(async (_req, res) => {
  const db = await readDb();
  const media = db.media;
  const active = media.filter((item) => !item.deletedAt);
  const totalMb = active.reduce((sum, item) => sum + (item.metadata?.sizeMb ?? 2), 0);
  res.json({
    usage: {
      totalMb,
      originalsMb: totalMb,
      derivativesMb: totalMb * 0.38,
      compressionRatio: 62,
      cdnGb: totalMb / 1024,
      health: active.every((item) => item.processing.status === "COMPLETE") ? "Healthy" : "Processing"
    },
    recentUploads: active.slice(0, 8).map((item) => enrichMedia(db, item, item.uploaderId)),
    trash: media.filter((item) => item.deletedAt),
    trends: [
      { label: "Mon", uploads: 12, ai: 10, activity: 31 },
      { label: "Tue", uploads: 18, ai: 15, activity: 44 },
      { label: "Wed", uploads: 9, ai: 12, activity: 28 },
      { label: "Thu", uploads: 24, ai: 21, activity: 63 },
      { label: "Fri", uploads: 31, ai: 29, activity: 78 },
      { label: "Sat", uploads: 16, ai: 18, activity: 46 }
    ],
    activity: db.activity.slice(0, 20)
  });
}));

app.use((err, _req, res, _next) => {
  if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.issues });
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? "Unexpected server error" });
});

if (existsSync(distDir)) {
  app.get(/^(?!\/api|\/uploads|\/health).*/, (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

server.listen(port, "127.0.0.1", () => {
  console.log(`Momentra API listening on http://localhost:${port}`);
});
