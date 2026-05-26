import {
  Bell,
  Cloud,
  Download,
  Heart,
  ImagePlus,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Tags,
  Users
} from "lucide-react";

export const events = [
  {
    id: "esummit",
    name: "E-Summit 2026",
    description: "Speaker sessions, founder booths, pitch battles, and stage highlights.",
    date: "2026-03-18",
    category: "Fest",
    visibility: "Private + public highlights",
    assets: 2840,
    members: 126,
    progress: 78,
    cover: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1600&q=80"
  },
  {
    id: "trek",
    name: "Himalayan Trek",
    description: "Trip album with geo clusters, faces, landscapes, and collaborative uploads.",
    date: "2026-01-11",
    category: "Trip",
    visibility: "Club members",
    assets: 1536,
    members: 48,
    progress: 92,
    cover: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80"
  },
  {
    id: "hacknight",
    name: "HackNight",
    description: "Workshop media, mentor portraits, demo videos, and certificate shots.",
    date: "2026-02-06",
    category: "Workshop",
    visibility: "Private",
    assets: 918,
    members: 74,
    progress: 65,
    cover: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1600&q=80"
  },
  {
    id: "freshers",
    name: "Freshers Night",
    description: "Stories, aftermovie clips, dance floor photos, and tagged portraits.",
    date: "2025-12-01",
    category: "Party",
    visibility: "Public gallery",
    assets: 4205,
    members: 310,
    progress: 84,
    cover: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1600&q=80"
  }
];

export const media = [
  {
    id: "m1",
    eventId: "esummit",
    src: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=900&q=80",
    caption: "Keynote stage",
    tags: ["stage", "crowd", "speaker"],
    likes: 421,
    comments: 38,
    type: "photo"
  },
  {
    id: "m2",
    eventId: "esummit",
    src: "https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=900&q=80",
    caption: "Founder lounge",
    tags: ["workshop", "people"],
    likes: 286,
    comments: 19,
    type: "photo"
  },
  {
    id: "m3",
    eventId: "esummit",
    src: "https://images.unsplash.com/photo-1528605105345-5344ea20e269?auto=format&fit=crop&w=900&q=80",
    caption: "Pitch finalists",
    tags: ["winner", "stage"],
    likes: 612,
    comments: 57,
    type: "video"
  },
  {
    id: "m4",
    eventId: "esummit",
    src: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=900&q=80",
    caption: "Expo hall",
    tags: ["crowd", "booths"],
    likes: 207,
    comments: 12,
    type: "photo"
  },
  {
    id: "m5",
    eventId: "trek",
    src: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=80",
    caption: "Summit ridge",
    tags: ["mountains", "friends"],
    likes: 532,
    comments: 34,
    type: "photo"
  },
  {
    id: "m6",
    eventId: "trek",
    src: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80",
    caption: "Trail golden hour",
    tags: ["mountains", "trip"],
    likes: 301,
    comments: 22,
    type: "photo"
  },
  {
    id: "m7",
    eventId: "hacknight",
    src: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=80",
    caption: "Mentor circle",
    tags: ["workshop", "team"],
    likes: 176,
    comments: 14,
    type: "photo"
  },
  {
    id: "m8",
    eventId: "freshers",
    src: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=900&q=80",
    caption: "Dance floor",
    tags: ["concert", "party"],
    likes: 753,
    comments: 66,
    type: "video"
  }
];

export const users = [
  { name: "Aarav", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80" },
  { name: "Mira", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80" },
  { name: "Kabir", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80" },
  { name: "Ira", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80" }
];

export const notifications = [
  { icon: Heart, text: "Mira liked your photo", time: "now" },
  { icon: Tags, text: "Aarav tagged you in E-Summit", time: "2m ago" },
  { icon: MessageCircle, text: "Kabir commented on your upload", time: "8m ago" },
  { icon: Bell, text: "Freshers Night album is ready", time: "14m ago" }
];

export const analytics = [
  { icon: ImagePlus, label: "Media assets", value: "9.5K", delta: "+28% this month" },
  { icon: Cloud, label: "CDN delivered", value: "1.8TB", delta: "99.9% cache hit" },
  { icon: Users, label: "Active members", value: "612", delta: "42 invited today" },
  { icon: Sparkles, label: "AI matches", value: "3.2K", delta: "187 faces indexed" },
  { icon: Download, label: "Downloads", value: "824", delta: "watermarked by role" },
  { icon: ShieldCheck, label: "Private albums", value: "36", delta: "RBAC enforced" }
];
