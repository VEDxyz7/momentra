# Momentra

Momentra is a modern Event & Media Management Platform for clubs, societies, college communities, photographers, and student organizers. It works like a focused blend of Google Photos, Instagram, and Drive: events become structured albums, media can be uploaded and discovered quickly, access is role-based, and AI features help users find the photos that matter to them.

The platform is designed for real campus/event workflows such as photoshoots, workshops, fests, trips, competitions, hackathons, conferences, parties, and club activities.

## What Momentra Solves

College clubs and societies usually collect event photos across WhatsApp groups, Google Drive folders, individual phones, camera SD cards, and scattered social posts. Momentra centralizes that workflow into one product:

- Organizers create events and albums.
- Photographers upload photos and videos in bulk.
- Members browse, like, comment, save, share, and download media.
- Viewers can access public albums safely.
- AI tagging and face search help users discover relevant photos.
- Watermarked downloads preserve event and club branding.

## Core Features

### 1. Event Management

Participants can create, manage, and organize events with structured metadata.

- Create and manage events
- Event-wise albums generated automatically
- Event descriptions and metadata
- Event cover/banner support
- Sorting by:
  - Event name
  - Date
  - Category

Stored event metadata includes:

- Event name
- Description
- Date
- Category
- Club name
- Privacy setting
- Cover image

### 2. Media Upload System

Momentra supports a complete media upload workflow for photos and videos.

- Upload photos and videos
- Bulk uploads
- Drag-and-drop upload support
- Media preview before upload
- Upload queue with progress states
- Optimized image derivatives
- Thumbnail generation
- Compression and faster gallery loading
- Metadata storage for uploaded assets

Uploaded media is organized under event albums and becomes available in the gallery after processing.

### 3. Access Control & Authentication

The system supports secure role-based access.

Roles:

- Admin
- Photographer
- Club Member
- Viewer

Access behavior:

- Public media is accessible to everyone.
- Private media is accessible only to authorized users.
- Club-only albums are limited to club members and higher roles.
- Protected routes and backend middleware enforce permissions.
- JWT authentication is used for login/session handling.

### 4. Social Features

Momentra includes social interaction features inspired by Instagram and Discord-style event communities.

- Like media
- Comment on media
- Share albums/media
- Download media
- Add to favourites
- Tag users/friends
- Real-time notifications

Example notifications:

- Someone liked your photo
- Someone tagged you
- Someone commented on your upload
- New media was uploaded to an album

### 5. AI/ML Features

Momentra includes AI-powered discovery features for event media.

Smart Image Tagging:

- Automatically generates tags such as:
  - mountains
  - beach
  - sports
  - crowd
  - stage
  - workshop
  - concert

Advanced Search:

- Search by event name
- Search by tags
- Search by upload date
- Search by user/uploader name

Facial Recognition:

- User uploads a reference selfie
- System detects faces in the reference image
- Stored face embeddings are compared against album media
- Matching photos are displayed in a personalized results section

The local implementation uses `face-api.js` with TensorFlow.js descriptors, with optional AWS Rekognition support for cloud-backed face collections.

### 6. Cloud Integration

Momentra is structured for scalable cloud media delivery.

- AWS S3 support for object storage
- Signed upload/read URL support
- CloudFront/CDN-ready media URLs
- Local storage fallback for development
- Optimized originals, thumbnails, and derivatives

Suggested cloud service:

- AWS S3

### 7. Watermarking System

Momentra supports dynamic watermarking during downloads.

Watermark content can include:

- Club name
- Event name
- User role

This ensures exported media carries proper branding and usage context.

## Tech Stack

Frontend:

- React
- Vite
- React Router
- Framer Motion
- Zustand-style state patterns
- CSS glassmorphism dashboard styling

Backend:

- Node.js
- Express.js
- Multer uploads
- Socket.IO realtime events
- JWT authentication
- Zod validation
- Helmet, CORS, compression, rate limiting

Database and ORM:

- PostgreSQL schema via Prisma
- Local JSON persistence for development/demo mode

Storage:

- AWS S3 optional production adapter
- CloudFront-ready URLs
- Local file storage fallback under `server/uploads`

AI/ML:

- `face-api.js`
- TensorFlow.js
- AWS Rekognition optional provider
- Sharp image processing

Testing and DevOps:

- Node test runner
- Dockerfile
- Docker Compose
- Vite production build

## Database Schema

The Prisma schema is located at:

```text
prisma/schema.prisma
```

Core models:

- `User`: platform users with role-based access.
- `Event`: event metadata such as name, date, category, cover image, and club name.
- `Album`: event-wise media collections with public/private/club-only visibility.
- `MediaAsset`: uploaded photo/video records with storage keys, thumbnails, metadata, and AI fields.
- `MediaTag`: generated tags for search and filtering.
- `FaceEmbedding`: detected face descriptors/provider face IDs linked to media.
- `FaceTag`: user/person tags on media faces.
- `AIEmbedding`: semantic/AI vector metadata.
- `Comment`: media comments.
- `Like`: media likes.
- `Favourite`: saved media.
- `Notification`: realtime user notifications.
- `ShareLink`: album sharing tokens and expiry metadata.
- `EventMember`: event membership and role mapping.

Main relationships:

```text
User 1---N MediaAsset
User 1---N Comment
User 1---N Notification

Event 1---N Album
Event N---N User through EventMember

Album 1---N MediaAsset
Album 1---N ShareLink

MediaAsset 1---N MediaTag
MediaAsset 1---N FaceEmbedding
MediaAsset 1---N Comment
MediaAsset 1---N Like
MediaAsset 1---N Favourite
```

## Architecture

```mermaid
flowchart TD
  A["React + Vite Client"] --> B["Express API Server"]
  B --> C["Auth + RBAC Middleware"]
  B --> D["Event, Album, Media APIs"]
  B --> E["Upload Pipeline"]
  B --> F["Social APIs"]
  B --> G["AI Search + Face Search"]
  B --> H["Socket.IO Realtime"]

  E --> I["Sharp Optimization"]
  E --> J["S3 or Local Storage"]
  E --> K["Thumbnail + Metadata"]
  E --> L["AI Tagging + Face Embeddings"]

  D --> M["PostgreSQL via Prisma Schema"]
  F --> M
  G --> M
  C --> M

  J --> N["CloudFront/CDN Ready Delivery"]
  H --> A
```

System flow:

1. User logs in through the React app.
2. JWT-protected API routes validate identity and role.
3. Admins create events, which automatically create albums.
4. Photographers upload media to albums.
5. Upload pipeline optimizes images, stores files, creates thumbnails, extracts metadata, generates tags, and indexes faces.
6. Members interact with media through likes, comments, favourites, tags, shares, and downloads.
7. Notifications are emitted through Socket.IO.
8. AI search and face search read persisted metadata and embeddings.

## Project Structure

```text
momentra/
├── docs/
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── ARCHITECTURE_DIAGRAM.md
│   ├── DATABASE_SCHEMA.md
│   └── PITCH_DECK.md
├── prisma/
│   └── schema.prisma
├── scripts/
│   ├── dev.mjs
│   └── prove-face-recognition.mjs
├── server/
│   ├── data/
│   ├── src/
│   │   ├── auth.js
│   │   ├── db.js
│   │   ├── index.js
│   │   ├── realtime.js
│   │   └── services/
│   └── uploads/
├── src/
│   ├── lib/
│   ├── styles/
│   └── main.jsx
├── tests/
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

## Local Setup

Install dependencies:

```bash
npm install
```

Start the full local app:

```bash
npm run dev
```

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:4000
```

Default demo login:

```text
Email: admin@momentra.app
Password: momentra123
```

Additional local test users:

```text
admin@example.com / password123
photographer@example.com / password123
member@example.com / password123
viewer@example.com / password123
```

## Environment Variables

Create a `.env` file for production-style configuration:

```env
PORT=4000
WEB_ORIGIN=http://localhost:5173
JWT_SECRET=replace-with-a-secure-secret
DATABASE_URL=postgresql://user:password@localhost:5432/momentra

AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_ORIGINALS=momentra-originals
CLOUDFRONT_URL=https://your-cloudfront-domain
REKOGNITION_COLLECTION_ID=momentra-faces
```

For local demo mode, the app can run without AWS credentials and will use local storage.

## Useful Commands

Run tests:

```bash
npm test
```

Build frontend:

```bash
npm run build
```

Run backend only:

```bash
npm run server:dev
```

Generate Prisma client:

```bash
npx prisma generate
```

Run Prisma migration:

```bash
npx prisma migrate dev
```

## Documentation

Additional submission documents are available in:

- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/ARCHITECTURE_DIAGRAM.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/PITCH_DECK.md`

## Security Notes

- JWT authentication protects private APIs.
- Role-based middleware enforces Admin, Photographer, Club Member, and Viewer permissions.
- Albums support public, private, and club-only visibility.
- Uploads use validation and size limits.
- Production deployments should use strong `JWT_SECRET`, HTTPS, real PostgreSQL, S3, and managed secrets.

## Demo Focus

Momentra is built to demonstrate:

- A polished event media dashboard
- End-to-end event and album management
- Upload-to-gallery media workflows
- Role-aware access control
- Social media interactions
- AI tagging and face search architecture
- Cloud-ready storage and watermarking
- Startup-quality product presentation
