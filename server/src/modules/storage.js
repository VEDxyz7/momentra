import { randomUUID } from "node:crypto";

export async function createSignedUpload({ albumId, fileName, contentType }) {
  const key = `albums/${albumId}/originals/${randomUUID()}-${fileName}`;

  return {
    key,
    uploadUrl: `https://s3.example.com/${key}?signature=replace-with-aws-sdk-v4`,
    cdnUrl: `https://cdn.momentra.app/${key}`,
    headers: {
      "Content-Type": contentType
    }
  };
}

export function watermarkPolicy({ clubName, eventName, role }) {
  return {
    text: role === "ADMIN" || role === "PHOTOGRAPHER" ? `${clubName} • ${eventName}` : `${clubName} • Momentra`,
    opacity: role === "VIEWER" ? 0.42 : 0.24,
    position: "bottom-right"
  };
}
