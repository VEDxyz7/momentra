# Database Schema

Momentra uses a relational PostgreSQL schema modeled with Prisma. The schema supports authentication, RBAC, events, albums, media, comments, likes, favourites, AI tags, face matches, notifications, sharing, and refresh-token sessions.

## ER Diagram

```mermaid
erDiagram
  User ||--o{ EventMember : joins
  User ||--o{ MediaAsset : uploads
  User ||--o{ Comment : writes
  User ||--o{ Like : likes
  User ||--o{ Favourite : saves
  User ||--o{ FaceTag : tagged_in
  User ||--o{ Notification : receives
  User ||--o{ RefreshToken : owns
  User ||--o{ ShareLink : creates

  Event ||--o{ Album : contains
  Event ||--o{ EventMember : has
  Album ||--o{ MediaAsset : stores
  Album ||--o{ ShareLink : shared_by

  MediaAsset ||--o{ MediaTag : has
  MediaAsset ||--o{ FaceTag : detects
  MediaAsset ||--o{ AIEmbedding : indexed_as
  MediaAsset ||--o{ Comment : discussed
  MediaAsset ||--o{ Like : liked_by
  MediaAsset ||--o{ Favourite : saved_by

  User {
    string id PK
    string name
    string email UK
    string passwordHash
    string avatarUrl
    Role role
    datetime createdAt
  }

  Event {
    string id PK
    string name
    string slug UK
    string description
    datetime date
    string category
    string coverUrl
    string clubName
    string createdById
    datetime createdAt
    datetime updatedAt
  }

  Album {
    string id PK
    string eventId FK
    string title
    AlbumVisibility visibility
    string qrToken UK
    datetime createdAt
  }

  MediaAsset {
    string id PK
    string albumId FK
    string uploaderId FK
    MediaType type
    string originalKey
    string optimizedKey
    string thumbnailKey
    int width
    int height
    int durationSec
    string perceptualHash
    string aiCaption
    json moderation
    json exif
    datetime uploadedAt
  }

  MediaTag {
    string id PK
    string label
    float score
    string mediaId FK
  }

  FaceTag {
    string id PK
    string mediaId FK
    string userId FK
    string faceVectorId
    float confidence
    json box
  }

  AIEmbedding {
    string id PK
    string mediaId FK
    string provider
    string kind
    string vectorRef
    json metadata
    datetime createdAt
  }

  Comment {
    string id PK
    string body
    string mediaId FK
    string userId FK
    datetime createdAt
  }

  Like {
    string id PK
    string mediaId FK
    string userId FK
    datetime createdAt
  }

  Favourite {
    string id PK
    string mediaId FK
    string userId FK
    datetime createdAt
  }

  EventMember {
    string id PK
    string eventId FK
    string userId FK
    Role role
  }

  Notification {
    string id PK
    string userId FK
    string type
    json payload
    datetime readAt
    datetime createdAt
  }

  ShareLink {
    string id PK
    string albumId FK
    string token UK
    string privacy
    datetime expiresAt
    string createdById FK
    datetime createdAt
  }

  RefreshToken {
    string id PK
    string userId FK
    string tokenHash
    datetime revokedAt
    datetime expiresAt
    datetime createdAt
  }
```

## Core Tables

| Table | Purpose |
| --- | --- |
| `User` | Stores account identity, role, avatar, and authentication fields. |
| `Event` | Stores event metadata such as name, description, date, category, club name, and cover image. |
| `Album` | Event-wise album container with public/private/club-only visibility and QR token. |
| `MediaAsset` | Stores photo/video metadata, storage keys, thumbnails, AI captions, moderation, EXIF, and upload ownership. |
| `MediaTag` | AI-generated tags such as crowd, stage, workshop, mountains, concert, beach. |
| `FaceTag` | Face detection and recognition results for Find My Photos. |
| `AIEmbedding` | Vector index references for semantic search, face embeddings, and AI retrieval. |
| `Comment` | Media comments; production extension supports parent-child nested replies. |
| `Like` | Like relation with unique `mediaId + userId`. |
| `Favourite` | Saved/favourite media relation with unique `mediaId + userId`. |
| `EventMember` | Event membership and event-scoped role mapping. |
| `Notification` | Realtime notification records for likes, comments, tags, uploads, and album updates. |
| `ShareLink` | Expiring public/private share links used for QR sharing. |
| `RefreshToken` | Session persistence with revocation and expiry support. |

## Enums

```prisma
enum Role {
  ADMIN
  PHOTOGRAPHER
  CLUB_MEMBER
  VIEWER
}

enum AlbumVisibility {
  PUBLIC
  PRIVATE
  CLUB_ONLY
}

enum MediaType {
  PHOTO
  VIDEO
}
```

## Important Indexes And Constraints

- `User.email` is unique.
- `Event.slug` is unique.
- `Album.qrToken` is unique.
- `Like` has unique constraint on `mediaId + userId`.
- `Favourite` has unique constraint on `mediaId + userId`.
- `EventMember` has unique constraint on `eventId + userId`.
- `MediaTag.label` is indexed for tag search.
- `AIEmbedding.kind` and `AIEmbedding.provider` are indexed for AI retrieval.
- `ShareLink.expiresAt` is indexed for expiry cleanup.
- Cascade deletes are used from events to albums and from albums to media-related records.

Full Prisma schema: [`prisma/schema.prisma`](../prisma/schema.prisma).
