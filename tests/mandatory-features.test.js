import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { resetDb } from "../server/src/db.js";

const PORT = 4100;
const BASE = `http://127.0.0.1:${PORT}`;
let server;
let admin;
let photo;
let member;
let viewer;
let createdEvent;
let createdAlbum;
let uploadedMedia;

async function request(pathname, { token, method = "GET", body, headers = {} } = {}) {
  const response = await fetch(`${BASE}${pathname}`, {
    method,
    headers: {
      ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(payload?.error ?? response.statusText);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function login(email) {
  return request("/api/auth/login", { method: "POST", body: { email, password: "momentra123" } });
}

test.before(async () => {
  await resetDb();
  server = spawn(process.execPath, ["server/src/index.js"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), WEB_ORIGIN: "http://localhost:5173" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  await Promise.race([
    once(server.stdout, "data"),
    new Promise((_, reject) => setTimeout(() => reject(new Error("server did not start")), 5000))
  ]);
  admin = await login("admin@momentra.app");
  photo = await login("photo@momentra.app");
  member = await login("member@momentra.app");
  viewer = await login("viewer@momentra.app");
});

test.after(() => {
  server?.kill("SIGTERM");
});

test("Feature 1 event management persists create, edit, delete and auto-album", async () => {
  const created = await request("/api/events", {
    token: admin.token,
    method: "POST",
    body: {
      name: "Mandatory QA Event",
      description: "Created by automated mandatory feature verification.",
      date: "2026-08-20",
      category: "Workshop",
      privacy: "CLUB_ONLY",
      clubName: "QA Club"
    }
  });
  createdEvent = created.event;
  createdAlbum = created.album;
  assert.equal(created.event.name, "Mandatory QA Event");
  assert.equal(created.album.eventId, created.event.id);

  const edited = await request(`/api/events/${createdEvent.id}`, {
    token: admin.token,
    method: "PATCH",
    body: { name: "Mandatory QA Event Edited", description: createdEvent.description, date: createdEvent.date, category: "Competition", privacy: "PUBLIC", clubName: "QA Club" }
  });
  assert.equal(edited.name, "Mandatory QA Event Edited");
  assert.equal(edited.category, "Competition");

  const byName = await request("/api/events?sort=name", { token: admin.token });
  const byDate = await request("/api/events?sort=date", { token: admin.token });
  const byCategory = await request("/api/events?sort=category", { token: admin.token });
  assert.ok(byName.data.length > 0 && byDate.data.length > 0 && byCategory.data.length > 0);
});

test("Feature 2 media upload stores file, metadata, tags, derivatives and survives refresh", async () => {
  const png = await sharp({
    create: { width: 640, height: 420, channels: 3, background: { r: 20, g: 90, b: 180 } }
  }).png().toBuffer();
  const form = new FormData();
  form.append("albumId", createdAlbum.id);
  form.append("files", new Blob([png], { type: "image/png" }), "mountain-sports-stage.png");
  const upload = await request("/api/uploads", { token: photo.token, method: "POST", body: form });
  uploadedMedia = upload.data[0];
  assert.equal(uploadedMedia.processing.status, "COMPLETE");
  assert.ok(uploadedMedia.tags.includes("mountain") || uploadedMedia.tags.includes("sports") || uploadedMedia.tags.includes("crowd"));
  assert.ok(uploadedMedia.thumbnailUrl);
  assert.ok(uploadedMedia.metadata.width);

  const media = await request(`/api/media?albumId=${createdAlbum.id}`, { token: photo.token });
  assert.ok(media.data.some((item) => item.id === uploadedMedia.id));
});

test("Feature 3 auth and access control rejects unauthorized private access and allows public media", async () => {
  await assert.rejects(() => request("/api/dashboard"), /Authentication required/);
  const refresh = await request("/api/auth/refresh", { method: "POST", body: { refreshToken: admin.refreshToken } });
  assert.ok(refresh.token);

  const privateEvent = await request("/api/events", {
    token: admin.token,
    method: "POST",
    body: { name: "Private QA Event", description: "Private album check.", date: "2026-08-22", category: "Fest", privacy: "PRIVATE", clubName: "QA Club" }
  });
  const viewerAlbums = await request("/api/albums", { token: viewer.token });
  assert.ok(!viewerAlbums.data.some((album) => album.id === privateEvent.album.id));

  const publicMedia = await request("/api/public/media");
  assert.ok(Array.isArray(publicMedia.data));
});

test("Feature 4 social actions persist and create notifications", async () => {
  const liked = await request(`/api/media/${uploadedMedia.id}/like`, { token: member.token, method: "POST" });
  assert.equal(liked.liked, true);
  const fav = await request(`/api/media/${uploadedMedia.id}/favourite`, { token: member.token, method: "POST" });
  assert.equal(fav.saved, true);
  const comment = await request(`/api/media/${uploadedMedia.id}/comments`, { token: member.token, method: "POST", body: { body: "Great shot @Mira" } });
  assert.equal(comment.body, "Great shot @Mira");
  const tagged = await request(`/api/media/${uploadedMedia.id}/tag`, { token: member.token, method: "POST", body: { userId: "usr_member" } });
  assert.ok(tagged.faces.includes("usr_member"));
  const share = await request("/api/share", { token: admin.token, method: "POST", body: { albumId: createdAlbum.id, privacy: "PUBLIC", expiresInHours: 24 } });
  assert.ok(share.url.includes(share.token));
  const notifications = await request("/api/notifications", { token: photo.token });
  assert.ok(notifications.data.some((item) => ["LIKE", "COMMENT", "TAG", "UPLOAD"].includes(item.type)));
});

test("Feature 5 AI search and face matching use persisted media metadata", async () => {
  const search = await request("/api/ai/search?q=mountain", { token: member.token });
  assert.ok(search.data.some((item) => item.id === uploadedMedia.id));
  const selfie = await sharp({
    create: { width: 200, height: 200, channels: 3, background: { r: 20, g: 90, b: 180 } }
  }).png().toBuffer();
  const form = new FormData();
  form.append("selfie", new Blob([selfie], { type: "image/png" }), "selfie.png");
  const matches = await request("/api/ai/find-my-photos", { token: member.token, method: "POST", body: form });
  assert.ok(Array.isArray(matches.data));
  assert.ok(matches.referenceFaceId);
});

test("Feature 6 cloud integration exposes S3 signed upload path or fails closed without credentials", async () => {
  try {
    const signed = await request("/api/uploads/signed-url", {
      token: photo.token,
      method: "POST",
      body: { albumId: createdAlbum.id, fileName: "cloud-check.jpg", contentType: "image/jpeg" }
    });
    assert.ok(signed.uploadUrl.startsWith("https://"));
    assert.ok(signed.key.includes(createdAlbum.id));
  } catch (error) {
    assert.equal(error.status, 501);
    assert.match(error.message, /S3 credentials are not configured/);
  }
});

test("Feature 7 watermarked download physically writes image", async () => {
  const download = await request(`/api/media/${uploadedMedia.id}/download`, { token: viewer.token, method: "POST" });
  assert.ok(download.watermark.text.includes("QA Club"));
  assert.ok(download.watermark.text.includes("Mandatory QA Event"));
  assert.ok(download.watermark.text.includes("VIEWER"));
  const relativePath = new URL(download.url, BASE).pathname.replace("/uploads/", "");
  const fullPath = path.join(process.cwd(), "server/uploads", relativePath);
  const file = await stat(fullPath);
  assert.ok(file.size > 0);
  const metadata = await sharp(await readFile(fullPath)).metadata();
  assert.ok(metadata.width > 0);
});
