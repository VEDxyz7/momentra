# Architecture Diagram

Momentra is designed as a SaaS-style event media platform combining Google Photos-style media management, Instagram-like social interactions, Drive-style storage, and AI-powered search.

## High-Level System Architecture

```mermaid
flowchart TB
  subgraph Client["Client Layer"]
    Web["React / Next.js Web App"]
    PWA["PWA Offline Cache"]
    UI["Dashboard, Albums, Uploads, AI Search, Access, Storage"]
  end

  subgraph Edge["Edge And Delivery"]
    CDN["CloudFront / CDN"]
    SignedUrls["Signed Upload + Download URLs"]
  end

  subgraph API["Backend API Layer"]
    Gateway["Node.js + Express API"]
    Auth["JWT Auth + Refresh Sessions"]
    RBAC["Role-Based Access Control"]
    Realtime["Socket.IO Realtime Gateway"]
    Validation["Validation, Rate Limiting, Logging"]
  end

  subgraph Data["Data Layer"]
    Postgres["PostgreSQL + Prisma"]
    Redis["Redis Queue / Cache"]
    ObjectStore["AWS S3 Media Storage"]
  end

  subgraph Workers["Async Worker Layer"]
    Processor["Media Processing Worker"]
    Thumb["Thumbnail + Compression"]
    Watermark["Dynamic Watermarking"]
    AI["AI/ML Pipeline"]
  end

  subgraph AIModules["AI Modules"]
    Tags["Smart Image Tagging"]
    Faces["Face Recognition / Find My Photos"]
    Captions["AI Captions"]
    Duplicates["Duplicate Detection"]
    Moderation["AI Moderation"]
    Embeddings["Semantic Search Embeddings"]
  end

  Web --> UI
  Web --> Gateway
  PWA --> Web
  Web --> SignedUrls
  SignedUrls --> ObjectStore
  CDN --> Web
  ObjectStore --> CDN

  Gateway --> Auth
  Gateway --> RBAC
  Gateway --> Validation
  Gateway --> Postgres
  Gateway --> Redis
  Gateway --> Realtime

  ObjectStore --> Processor
  Processor --> Thumb
  Processor --> Watermark
  Processor --> AI
  AI --> Tags
  AI --> Faces
  AI --> Captions
  AI --> Duplicates
  AI --> Moderation
  AI --> Embeddings

  Processor --> ObjectStore
  Processor --> Postgres
  Processor --> Realtime
  Realtime --> Web
```

## Upload And AI Processing Flow

```mermaid
sequenceDiagram
  participant User
  participant Web as Web App
  participant API as Express API
  participant S3 as AWS S3
  participant Queue as Redis Queue
  participant Worker as Media Worker
  participant AI as AI Services
  participant DB as PostgreSQL
  participant Socket as Socket.IO

  User->>Web: Drag and drop photos/videos
  Web->>API: Request signed upload URL
  API->>API: Validate JWT + role
  API->>S3: Create signed upload policy
  API-->>Web: Signed URL + storage key
  Web->>S3: Upload media directly
  Web->>API: Confirm uploaded media metadata
  API->>DB: Save media record as PROCESSING
  API->>Queue: Enqueue processing job
  API->>Socket: Emit upload started
  Queue->>Worker: Process media job
  Worker->>S3: Read original media
  Worker->>Worker: Compress + generate thumbnail
  Worker->>AI: Tag, moderate, detect faces, captions
  AI-->>Worker: Tags, faces, captions, embeddings
  Worker->>S3: Store optimized derivatives
  Worker->>DB: Update media metadata and AI results
  Worker->>Socket: Emit upload complete
  Socket-->>Web: Realtime progress update
```

## Request Flow

```mermaid
flowchart LR
  User["User"] --> Browser["Browser / PWA"]
  Browser --> API["Express API"]
  API --> Auth["JWT Validation"]
  Auth --> RBAC["Permission Middleware"]
  RBAC --> Service["Domain Service"]
  Service --> DB["PostgreSQL"]
  Service --> S3["S3 / CDN"]
  Service --> Socket["Socket.IO Events"]
  Socket --> Browser
```

## Role-Based Access

| Role | Capabilities |
| --- | --- |
| Admin | Create/edit events, manage albums, change roles, moderate content, manage private albums, download originals. |
| Photographer | Upload media, tag users, view assigned private albums, manage own uploads. |
| Club Member | View club albums, like, comment, save favourites, use Find My Photos. |
| Viewer | View public albums, share public links, download watermarked media. |

## Deployment Architecture

```mermaid
flowchart TB
  Dev["GitHub Repository"] --> CI["GitHub Actions CI"]
  CI --> Build["Build + Audit + Tests"]
  Build --> Vercel["Vercel Frontend"]
  Build --> AWS["AWS Backend"]

  AWS --> ECS["ECS / Lambda API"]
  AWS --> RDS["RDS PostgreSQL"]
  AWS --> S3["S3 Buckets"]
  AWS --> CF["CloudFront CDN"]
  AWS --> Redis["ElastiCache Redis"]
  AWS --> Rekog["AWS Rekognition"]

  Vercel --> CF
  ECS --> RDS
  ECS --> Redis
  ECS --> S3
  S3 --> CF
  ECS --> Rekog
```

## Main Technology Choices

- **Frontend:** React / Next.js-ready architecture, responsive dashboard UI, PWA cache.
- **Backend:** Node.js + Express, REST APIs, JWT authentication, RBAC middleware.
- **Database:** PostgreSQL with Prisma schema.
- **Realtime:** Socket.IO for notifications, likes, comments, tags, uploads, and album updates.
- **Storage:** AWS S3 with signed URLs and CloudFront CDN.
- **Queues:** Redis-backed jobs for upload processing and AI indexing.
- **AI:** AWS Rekognition, face-api.js/OpenCV/TensorFlow-ready worker layer.
- **Deployment:** Vercel frontend, AWS backend, Docker Compose for local services.

Implementation docs: [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md). API docs: [`docs/API.md`](./API.md).
