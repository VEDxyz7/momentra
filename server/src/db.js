import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");
const dbPath = path.join(dataDir, "db.json");

const covers = [
  "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1600&q=80"
];

const mediaSources = [
  "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1528605105345-5344ea20e269?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=900&q=80"
];

export const roles = ["ADMIN", "PHOTOGRAPHER", "CLUB_MEMBER", "VIEWER"];
export const roleRank = { VIEWER: 1, CLUB_MEMBER: 2, PHOTOGRAPHER: 3, ADMIN: 4 };

export function id(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function now() {
  return new Date().toISOString();
}

async function seedData() {
  const passwordHash = await bcrypt.hash("momentra123", 12);
  const devPasswordHash = await bcrypt.hash("password123", 12);
  const users = [
    { id: "usr_admin", name: "Aarav Admin", email: "admin@momentra.app", role: "ADMIN", passwordHash, avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80", verified: true, banned: false, createdAt: now() },
    { id: "usr_photo", name: "Mira Photographer", email: "photo@momentra.app", role: "PHOTOGRAPHER", passwordHash, avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80", verified: true, banned: false, createdAt: now() },
    { id: "usr_member", name: "Kabir Member", email: "member@momentra.app", role: "CLUB_MEMBER", passwordHash, avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80", verified: true, banned: false, createdAt: now() },
    { id: "usr_viewer", name: "Ira Viewer", email: "viewer@momentra.app", role: "VIEWER", passwordHash, avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80", verified: true, banned: false, createdAt: now() },
    { id: "usr_dev_admin", name: "Local Admin", email: "admin@example.com", role: "ADMIN", passwordHash: devPasswordHash, avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=Admin", verified: true, banned: false, createdAt: now() },
    { id: "usr_dev_photo", name: "Local Photographer", email: "photographer@example.com", role: "PHOTOGRAPHER", passwordHash: devPasswordHash, avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=Photographer", verified: true, banned: false, createdAt: now() },
    { id: "usr_dev_member", name: "Local Member", email: "member@example.com", role: "CLUB_MEMBER", passwordHash: devPasswordHash, avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=Member", verified: true, banned: false, createdAt: now() },
    { id: "usr_dev_viewer", name: "Local Viewer", email: "viewer@example.com", role: "VIEWER", passwordHash: devPasswordHash, avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=Viewer", verified: true, banned: false, createdAt: now() }
  ];

  const events = [
    { id: "evt_esummit", name: "E-Summit 2026", description: "Speaker sessions, founder booths, pitch battles, and stage highlights.", date: "2026-03-18", category: "Fest", coverUrl: covers[0], privacy: "PRIVATE", clubName: "Entrepreneurship Cell", createdById: "usr_admin", createdAt: now(), updatedAt: now() },
    { id: "evt_trek", name: "Himalayan Trek", description: "Trip album with geo clusters, faces, landscapes, and collaborative uploads.", date: "2026-01-11", category: "Trip", coverUrl: covers[1], privacy: "CLUB_ONLY", clubName: "Adventure Club", createdById: "usr_admin", createdAt: now(), updatedAt: now() },
    { id: "evt_hacknight", name: "HackNight", description: "Workshop media, mentor portraits, demo videos, and certificate shots.", date: "2026-02-06", category: "Workshop", coverUrl: covers[2], privacy: "PRIVATE", clubName: "Coding Society", createdById: "usr_photo", createdAt: now(), updatedAt: now() },
    { id: "evt_freshers", name: "Freshers Night", description: "Stories, aftermovie clips, dance floor photos, and tagged portraits.", date: "2025-12-01", category: "Party", coverUrl: covers[3], privacy: "PUBLIC", clubName: "Student Council", createdById: "usr_admin", createdAt: now(), updatedAt: now() }
  ];

  const albums = events.map((event) => ({
    id: event.id.replace("evt", "alb"),
    eventId: event.id,
    title: `${event.name} Album`,
    description: event.description,
    visibility: event.privacy,
    collaborative: event.privacy !== "PRIVATE",
    qrToken: id("qr"),
    createdAt: now(),
    updatedAt: now()
  }));

  const labels = [
    ["stage", "crowd", "speaker"],
    ["workshop", "people", "smiling"],
    ["winner", "stage", "night"],
    ["crowd", "booths", "expo"],
    ["mountains", "friends", "trek"],
    ["mountains", "trip", "golden hour"],
    ["workshop", "team", "mentor"],
    ["concert", "party", "dance"]
  ];
  const captions = ["Keynote stage", "Founder lounge", "Pitch finalists", "Expo hall", "Summit ridge", "Trail golden hour", "Mentor circle", "Dance floor"];
  const eventIds = ["evt_esummit", "evt_esummit", "evt_esummit", "evt_esummit", "evt_trek", "evt_trek", "evt_hacknight", "evt_freshers"];
  const media = mediaSources.map((src, index) => ({
    id: `med_${index + 1}`,
    eventId: eventIds[index],
    albumId: eventIds[index].replace("evt", "alb"),
    uploaderId: index % 2 ? "usr_photo" : "usr_admin",
    type: index === 2 || index === 7 ? "VIDEO" : "PHOTO",
    url: src,
    thumbnailUrl: src,
    fileName: `${captions[index].toLowerCase().replaceAll(" ", "-")}.jpg`,
    caption: captions[index],
    aiCaption: `AI caption for ${captions[index]} with ${labels[index].join(", ")}.`,
    tags: labels[index],
    faces: index % 2 ? ["usr_member", "usr_photo"] : ["usr_admin", "usr_member"],
    duplicateScore: index === 3 ? 0.72 : 0.12,
    moderationStatus: "APPROVED",
    metadata: { width: 1600, height: index % 2 ? 2100 : 1200, camera: "Sony A7 IV", sizeMb: 4.8 + index },
    processing: { status: "COMPLETE", progress: 100, stage: "Indexed" },
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null
  }));

  return {
    users,
    events,
    albums,
    media,
    likes: [{ id: "like_1", mediaId: "med_1", userId: "usr_member", createdAt: now() }],
    favourites: [{ id: "fav_1", mediaId: "med_2", userId: "usr_member", createdAt: now() }],
    comments: [{ id: "com_1", mediaId: "med_1", userId: "usr_photo", parentId: null, body: "This keynote frame is perfect @Aarav", createdAt: now(), replies: [] }],
    notifications: [
      { id: "not_1", userId: "usr_admin", type: "LIKE", text: "Mira liked your photo", entityType: "media", entityId: "med_1", readAt: null, createdAt: now() },
      { id: "not_2", userId: "usr_member", type: "TAG", text: "Aarav tagged you in E-Summit", entityType: "event", entityId: "evt_esummit", readAt: null, createdAt: now() },
      { id: "not_3", userId: "usr_photo", type: "COMMENT", text: "Kabir commented on your upload", entityType: "media", entityId: "med_2", readAt: null, createdAt: now() }
    ],
    shares: [],
    activity: [],
    trash: [],
    sessions: []
  };
}

export async function readDb() {
  await mkdir(dataDir, { recursive: true });
  if (!existsSync(dbPath)) {
    const seeded = await seedData();
    await writeFile(dbPath, JSON.stringify(seeded, null, 2));
  }
  const db = JSON.parse(await readFile(dbPath, "utf-8"));
  if (await ensureDevUsers(db)) await writeDb(db);
  return db;
}

async function ensureDevUsers(db) {
  const devUsers = [
    ["usr_dev_admin", "Local Admin", "admin@example.com", "ADMIN"],
    ["usr_dev_photo", "Local Photographer", "photographer@example.com", "PHOTOGRAPHER"],
    ["usr_dev_member", "Local Member", "member@example.com", "CLUB_MEMBER"],
    ["usr_dev_viewer", "Local Viewer", "viewer@example.com", "VIEWER"]
  ];
  let changed = false;
  for (const [idValue, name, email, role] of devUsers) {
    if (!db.users.some((user) => user.email === email)) {
      db.users.push({
        id: idValue,
        name,
        email,
        role,
        passwordHash: await bcrypt.hash("password123", 12),
        avatarUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}`,
        verified: true,
        banned: false,
        createdAt: now()
      });
      changed = true;
    }
  }
  return changed;
}

export async function writeDb(next) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dbPath, JSON.stringify(next, null, 2));
  return next;
}

export async function transact(mutator) {
  const db = await readDb();
  const result = await mutator(db);
  await writeDb(db);
  return result;
}

export async function resetDb() {
  await writeDb(await seedData());
}

export function publicUser(user) {
  if (!user) return null;
  const { passwordHash, resetToken, verificationToken, ...safe } = user;
  return safe;
}

export function enrichMedia(db, item, viewerId) {
  const uploader = db.users.find((user) => user.id === item.uploaderId);
  const likes = db.likes.filter((like) => like.mediaId === item.id);
  const comments = db.comments.filter((comment) => comment.mediaId === item.id);
  return {
    ...item,
    uploader: publicUser(uploader),
    likes: likes.length,
    liked: likes.some((like) => like.userId === viewerId),
    saved: db.favourites.some((fav) => fav.mediaId === item.id && fav.userId === viewerId),
    comments: comments.map((comment) => ({
      ...comment,
      user: publicUser(db.users.find((user) => user.id === comment.userId)),
      replies: db.comments
        .filter((reply) => reply.parentId === comment.id)
        .map((reply) => ({ ...reply, user: publicUser(db.users.find((user) => user.id === reply.userId)) }))
    })).filter((comment) => !comment.parentId)
  };
}

export function eventStats(db, eventId) {
  const eventMedia = db.media.filter((item) => item.eventId === eventId && !item.deletedAt);
  const albumIds = db.albums.filter((album) => album.eventId === eventId).map((album) => album.id);
  return {
    assets: eventMedia.length,
    members: new Set(eventMedia.map((item) => item.uploaderId)).size + 24,
    progress: Math.min(100, Math.round(eventMedia.reduce((sum, item) => sum + item.processing.progress, 0) / Math.max(1, eventMedia.length)))
  };
}
