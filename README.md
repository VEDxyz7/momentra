# Momentra

A modern Event & Media Management Platform for clubs, societies, and college communities. It combines event management, Google Photos-style galleries, Instagram-like social interactions, Drive-grade storage architecture, and AI-powered discovery.

The project is now a functional full-stack local SaaS implementation: React routed frontend, Express API, JWT/RBAC auth, persistent local database, upload storage, Socket.IO realtime updates, share links, comments, likes, favourites, AI search, storage analytics, and deployment artifacts.

## What Is Included

- Premium responsive React frontend with route-backed Dashboard, Albums, Uploads, AI Search, Access, and Storage pages.
- Event creation modal that persists events and automatically creates albums.
- Drag-and-drop upload studio with bulk queue, retry/pause UX, stored metadata, and realtime AI processing completion.
- Masonry gallery with lazy images, lightbox, fullscreen affordance, comments, nested replies-ready data model, likes, saves, share, tags, metadata, and watermarked downloads.
- JWT authentication, refresh-token endpoint, password-reset token endpoint, protected APIs, and RBAC middleware.
- Admin access page for role changes, bans, moderation-ready permissions, and protected user management APIs.
- Smart tagging, AI captions, duplicate scoring, moderation status, semantic search, and Find My Photos face-search endpoint.
- QR sharing with expiration, notification center, Socket.IO realtime sync, dark/light mode, analytics, PWA service worker, and storage health panel.
- Prisma PostgreSQL schema, local persistent JSON database for immediate demo, Docker Compose for PostgreSQL/Redis, CI pipeline, API docs, architecture diagram, and pitch deck structure.

## Run Locally

```bash
npm install
npm run seed
npm run server:dev
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173`. If that port is occupied, Vite will print the next available URL.

Demo login:

- `admin@momentra.app`
- `photo@momentra.app`
- `member@momentra.app`
- `viewer@momentra.app`
- Password for all: `momentra123`

## Folder Structure

```text
.
├── docs/
│   ├── API.md
│   ├── ARCHITECTURE.md
│   └── PITCH_DECK.md
├── prisma/
│   └── schema.prisma
├── server/
│   └── src/
│       ├── auth.js
│       ├── db.js
│       ├── modules/
│       ├── realtime.js
│       └── routes/
├── src/
│   ├── data/
│   ├── styles/
│   └── main.jsx
├── index.html
└── package.json
```

## Functional API Surface

- Auth: `/api/auth/signup`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/password-reset`, `/api/me`
- Events: `/api/events`, create/update events, auto-create albums
- Albums: `/api/albums`, create/edit/delete, visibility, collaboration
- Media: `/api/media`, `/api/uploads`, likes, favourites, comments, tags, trash, restore, downloads
- AI: `/api/ai/search`, `/api/ai/find-my-photos`
- Social/realtime: `/api/notifications`, Socket.IO events for uploads, comments, likes, tags, albums, users
- Admin/storage: `/api/users`, `/api/storage`

## Demo Roles

- **Admin:** create events, publish albums, manage privacy, moderate AI, download originals.
- **Photographer:** upload media, tag people, view assigned private shoots, download own media.
- **Club Member:** like, comment, save favourites, use Find My Photos.
- **Viewer:** view public albums, share public links, download watermarked media.

## Production Backend Plan

- **Auth:** JWT access tokens with HTTP-only refresh token rotation, OAuth via Clerk/Firebase/Auth.js if preferred.
- **Database:** PostgreSQL with Prisma schema in `prisma/schema.prisma`.
- **Storage:** S3 signed uploads, CloudFront CDN, separate original/optimized/thumbnail keys.
- **Processing:** Queue-driven workers for compression, thumbnails, duplicate hashes, watermark derivatives, AI tagging, and face indexing.
- **Realtime:** Socket.IO or Firebase for likes, comments, tags, upload completion, and album-ready notifications.
- **AI:** AWS Rekognition for labels and face collections, face-api.js/OpenCV fallback, perceptual hashing for duplicates, moderation labels for unsafe content.
- **Deployment:** Vercel for frontend, AWS ECS/Lambda for API/workers, RDS PostgreSQL, S3, CloudFront, Redis queue.

## Environment Variables

```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/momentra"
JWT_SECRET="replace-me"
WEB_ORIGIN="http://localhost:5173"
AWS_REGION="ap-south-1"
S3_BUCKET_ORIGINALS="momentra-originals"
S3_BUCKET_DERIVATIVES="momentra-derivatives"
CLOUDFRONT_URL="https://cdn.example.com"
```

## Demo Deployment Setup

```bash
npm run build
npm run preview
```

For Vercel, set the build command to `npm run build` and output directory to `dist`.

Docker stack:

```bash
docker compose up --build
```

The current local runtime uses `server/data/db.json` for persistence so judges can run it instantly without provisioning PostgreSQL. The Prisma schema and Docker Compose services are included for production migration to PostgreSQL and Redis queues.
