import crypto from "node:crypto";
import { DetectLabelsCommand, RekognitionClient } from "@aws-sdk/client-rekognition";

const rekognition = process.env.AWS_REGION && process.env.REKOGNITION_COLLECTION_ID
  ? new RekognitionClient({ region: process.env.AWS_REGION })
  : null;

export async function tagImage({ fileName, event, metadata, stats }) {
  if (rekognition && metadata?.buffer) {
    const response = await rekognition.send(new DetectLabelsCommand({
      Image: { Bytes: metadata.buffer },
      MaxLabels: 12,
      MinConfidence: 65
    }));
    const tags = (response.Labels ?? []).map((label) => label.Name.toLowerCase());
    return {
      tags: ["upload", ...tags],
      caption: `AI caption: ${tags.slice(0, 4).join(", ")} detected in ${event?.name ?? "event media"}.`,
      moderationStatus: "APPROVED",
      embedding: crypto.createHash("sha256").update(`${fileName}:${tags.join(",")}`).digest("hex"),
      provider: "aws-rekognition"
    };
  }

  const haystack = `${fileName} ${event?.name ?? ""} ${event?.category ?? ""}`.toLowerCase();
  const tags = new Set(["upload"]);
  if (/trek|mountain|himalaya|trail/.test(haystack)) tags.add("mountain");
  if (/beach|sea|shore/.test(haystack)) tags.add("beach");
  if (/sport|competition|robot|match/.test(haystack)) tags.add("sports");
  if (/stage|fest|concert|party|night/.test(haystack)) tags.add("crowd");
  if (/workshop|hack|session|demo/.test(haystack)) tags.add("workshop");
  if (metadata?.width && metadata.width > metadata.height) tags.add("landscape");
  if (stats?.channels?.[0]?.mean && stats.channels[0].mean < 92) tags.add("night");
  if (tags.size < 3) tags.add(event?.category?.toLowerCase() ?? "event");

  const caption = `AI caption: ${[...tags].filter((tag) => tag !== "upload").join(", ")} moment from ${event?.name ?? "the event"}.`;
  return {
    tags: [...tags],
    caption,
    moderationStatus: "APPROVED",
    embedding: crypto.createHash("sha256").update(`${fileName}:${[...tags].join(",")}`).digest("hex"),
    provider: "local-heuristic"
  };
}

export async function faceEmbedding(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function similarity(a, b) {
  if (!a || !b) return 0;
  let same = 0;
  const len = Math.min(a.length, b.length);
  for (let index = 0; index < len; index += 1) if (a[index] === b[index]) same += 1;
  return Math.round((same / len) * 100);
}

export function semanticScore(query, media, event, uploader) {
  const tokens = String(query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const text = `${media.caption} ${media.aiCaption} ${media.tags.join(" ")} ${event?.name ?? ""} ${event?.category ?? ""} ${uploader?.name ?? ""} ${media.createdAt}`.toLowerCase();
  if (!tokens.length) return 70;
  return Math.min(99, tokens.reduce((score, token) => score + (text.includes(token) ? 22 : 0), 30 + media.tags.length * 3));
}
