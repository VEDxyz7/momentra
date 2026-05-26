import {
  Bell,
  Cloud,
  Download,
  Heart,
  ImagePlus,
  ShieldCheck,
  Sparkles,
  Users
} from "lucide-react";

export const statIcons = {
  "Media assets": ImagePlus,
  "CDN delivered": Cloud,
  "Active members": Users,
  "AI matches": Sparkles,
  Downloads: Download,
  "Private albums": ShieldCheck,
  Processing: Bell,
  "Storage used": Heart
};

export const roleLabels = {
  ADMIN: "Admin",
  PHOTOGRAPHER: "Photographer",
  CLUB_MEMBER: "Club Member",
  VIEWER: "Viewer"
};

export const apiRoles = {
  Admin: "ADMIN",
  Photographer: "PHOTOGRAPHER",
  "Club Member": "CLUB_MEMBER",
  Viewer: "VIEWER"
};
