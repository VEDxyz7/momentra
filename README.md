# Momentra

Momentra is an AI-powered Event & Media Management Platform designed for clubs, societies, student organizations, photographers, and event teams. It provides a centralized system for managing events, organizing media, enabling social interactions, and discovering content through AI-powered search and facial recognition.

## Overview

Organizations frequently generate large volumes of photos and videos during events such as workshops, hackathons, cultural festivals, conferences, competitions, and trips. Media often becomes fragmented across multiple storage systems, making organization and retrieval difficult.

Momentra addresses this problem through:

- Event-based media organization
- Secure access control
- Social engagement features
- AI-powered discovery
- Cloud-based storage architecture
- Personalized photo retrieval

---

## Features

### Event Management

- Create, edit, and delete events
- Event metadata management
- Event categorization
- Event-wise album generation
- Sorting and filtering

### Media Management

- Image and video uploads
- Bulk uploads
- Drag-and-drop support
- Media previews
- Upload progress tracking
- Optimized media storage

### Authentication and Access Control

Role-based access control for:

- Admin
- Photographer
- Club Member
- Viewer

Features include:

- Authentication
- Session management
- Protected routes
- Public and private media access

### Social Features

- Likes
- Comments
- Favorites
- Sharing
- User tagging
- Download functionality
- Real-time notifications

### AI Features

#### Smart Image Tagging

Automatic tag generation for uploaded media.

#### Advanced Search

Search by:

- Event Name
- Tags
- Upload Date
- User Name

#### Facial Recognition

Users can:

1. Upload a reference selfie
2. Detect matching photos
3. View personalized galleries

### Cloud Storage

- AWS S3 integration
- CloudFront CDN delivery
- Secure file access
- Scalable media storage

### Watermarking

Dynamic watermark generation during downloads using:

- Club Name
- Event Name
- User Role

### Analytics

- Event statistics
- Upload metrics
- Storage utilization
- User engagement insights

---

## Technology Stack

### Frontend

- React
- Vite
- React Router

### Backend

- Node.js
- Express.js

### Database

- PostgreSQL
- Prisma ORM

### Authentication

- JWT
- Refresh Tokens

### Cloud Services

- AWS S3
- CloudFront

### Real-Time Communication

- Socket.IO

### AI and Machine Learning

- AWS Rekognition
- OpenCV
- TensorFlow
- Face API

---

## System Architecture

```text
Frontend (React/Vite)
        |
        v
Express API Server
        |
  +-----+-----+
  |     |     |
  v     v     v
PostgreSQL  S3  Redis
        |
        v
AI Processing Services
```

---

## Project Structure

```text
Momentra/
│
├── docs/
│   ├── API.md
│   ├── ARCHITECTURE.md
│   └── PITCH_DECK.md
│
├── prisma/
│   └── schema.prisma
│
├── server/
│   └── src/
│       ├── middleware/
│       ├── services/
│       ├── routes/
│       ├── controllers/
│       └── index.js
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── contexts/
│   ├── services/
│   ├── styles/
│   └── main.jsx
│
├── tests/
│
├── package.json
└── README.md
```

---

## Environment Variables

Create a `.env` file:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/momentra

JWT_SECRET=your_jwt_secret

PORT=5000

AWS_REGION=ap-south-1

AWS_ACCESS_KEY_ID=your_access_key

AWS_SECRET_ACCESS_KEY=your_secret_key

S3_BUCKET_ORIGINALS=momentra-originals

S3_BUCKET_DERIVATIVES=momentra-derivatives

CLOUDFRONT_URL=https://your-cloudfront-url

CLIENT_URL=http://localhost:5173
```

---

## Installation

### Clone Repository

```bash
git clone https://github.com/VEDxyz7/momentra.git
cd momentra
```

### Install Dependencies

Frontend:

```bash
npm install
```

Backend:

```bash
cd server
npm install
```

### Database Setup

```bash
npx prisma generate
npx prisma migrate dev
```

### Start Frontend

```bash
npm run dev
```

### Start Backend

```bash
npm run server:dev
```

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:5000
```

---

## Testing

Run tests:

```bash
npm test
```

or

```bash
npm run test
```

Test coverage includes:

- Authentication
- Events
- Albums
- Uploads
- Search
- Permissions
- Notifications

---

## Security

- JWT-based authentication
- Role-based authorization
- Secure file uploads
- Signed URLs
- Input validation
- Protected APIs
- Session management

---

## Future Enhancements

- Mobile application
- AI-generated event highlights
- OCR-based image search
- Voice-based search
- Multi-club collaboration
- Event recommendation engine
- Video summarization
