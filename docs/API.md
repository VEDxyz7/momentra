# API Contract

Base URL: `http://localhost:4000/api` locally. The production server also serves the built frontend from `dist`.

## Auth

- `POST /api/auth/signup` creates a user, hashes the password, and returns a JWT.
- `POST /api/auth/login` authenticates and returns a JWT.
- `POST /api/auth/refresh` rotates session tokens.
- `POST /api/auth/password-reset` creates a reset token for an email provider.
- `GET /api/me` returns the authenticated user and permission rank.

## Events

- `GET /api/events?sort=date&q=Fest` returns accessible events.
- `POST /api/events` creates an event and automatically creates the default album.
- `PATCH /api/events/:id` updates event metadata, cover, privacy defaults, and category.

## Albums

- `GET /api/albums?sort=popularity` returns accessible albums with counts and popularity.
- `POST /api/albums` creates an album.
- `PATCH /api/albums/:id` edits album settings.
- `DELETE /api/albums/:id` deletes an album and moves media to trash.

## Media

- `GET /api/media?albumId=alb_id&limit=24` returns paginated media.
- `POST /api/uploads` accepts multipart uploads, stores files, records metadata, and emits AI processing events.
- `POST /api/media/:id/download` returns role-aware watermarked download URL.
- `PATCH /api/media/:id/trash` moves media to trash.
- `POST /api/media/:id/restore` restores deleted media.

## Social

- `POST /api/media/:id/like` toggles like and emits notification.
- `POST /api/media/:id/favourite` toggles save state.
- `POST /api/media/:id/comments` creates comment or nested reply and emits notification.
- `POST /api/media/:id/tag` tags a user/friend and emits notification.
- `POST /api/share` generates expiring share link and QR target.

## AI

- `GET /api/ai/search?q=people%20smiling` runs semantic/tag/event/uploader search.
- `POST /api/ai/find-my-photos` compares a reference selfie against indexed face vectors.

## Admin And Storage

- `GET /api/users` lists users for admins.
- `PATCH /api/users/:id` changes role, ban status, or verification status.
- `DELETE /api/users/:id` removes a user.
- `GET /api/storage` returns storage usage, CDN usage, trends, trash, and media health.
