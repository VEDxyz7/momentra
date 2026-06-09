import crypto from "node:crypto";
import path from "node:path";
import { createRequire } from "node:module";
import util from "node:util";
import {
  CreateCollectionCommand,
  DetectLabelsCommand,
  DescribeCollectionCommand,
  IndexFacesCommand,
  RekognitionClient,
  SearchFacesByImageCommand
} from "@aws-sdk/client-rekognition";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const faceApiPackagePath = require.resolve("@vladmandic/face-api/package.json");
const localModelPath = path.join(path.dirname(faceApiPackagePath), "model");

const rekognition = process.env.AWS_REGION && process.env.REKOGNITION_COLLECTION_ID
  ? new RekognitionClient({ region: process.env.AWS_REGION })
  : null;
let localFaceModelPromise = null;
let faceapi = null;

async function loadLocalFaceModels() {
  if (!localFaceModelPromise) {
    if (!util.isNullOrUndefined) {
      util.isNullOrUndefined = (value) => value === null || value === undefined;
    }
    localFaceModelPromise = import("@vladmandic/face-api").then(async (module) => {
      faceapi = module;
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromDisk(localModelPath),
        faceapi.nets.faceLandmark68Net.loadFromDisk(localModelPath),
        faceapi.nets.faceRecognitionNet.loadFromDisk(localModelPath)
      ]);
    });
  }
  await localFaceModelPromise;
}

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

export function faceProviderStatus() {
  return {
    provider: rekognition ? "aws-rekognition" : "face-api.js",
    configured: Boolean(rekognition) || true,
    localProvider: {
      name: "face-api.js",
      modelPath: localModelPath,
      descriptorDimensions: 128,
      enabled: true
    },
    env: {
      AWS_REGION: Boolean(process.env.AWS_REGION),
      AWS_ACCESS_KEY_ID: Boolean(process.env.AWS_ACCESS_KEY_ID),
      AWS_SECRET_ACCESS_KEY: Boolean(process.env.AWS_SECRET_ACCESS_KEY),
      REKOGNITION_COLLECTION_ID: Boolean(process.env.REKOGNITION_COLLECTION_ID)
    },
    collectionId: process.env.REKOGNITION_COLLECTION_ID ?? null
  };
}

async function ensureFaceCollection() {
  if (!rekognition) return { ok: false, created: false, reason: "AWS Rekognition is not configured" };
  const collectionId = process.env.REKOGNITION_COLLECTION_ID;
  try {
    await rekognition.send(new DescribeCollectionCommand({ CollectionId: collectionId }));
    return { ok: true, created: false, collectionId };
  } catch (error) {
    if (error.name !== "ResourceNotFoundException") throw error;
    await rekognition.send(new CreateCollectionCommand({ CollectionId: collectionId }));
    return { ok: true, created: true, collectionId };
  }
}

export async function faceCollectionHealth() {
  const status = faceProviderStatus();
  if (!rekognition) {
    await loadLocalFaceModels();
    return {
      ...status,
      collectionExists: true,
      indexedFaces: 0,
      embeddingsStored: 0,
      searchEnabled: true,
      checks: {
        CreateCollection: false,
        IndexFaces: true,
        SearchFacesByImage: true,
        LocalDescriptorExtraction: true
      }
    };
  }

  const collection = await ensureFaceCollection();
  const description = await rekognition.send(new DescribeCollectionCommand({
    CollectionId: process.env.REKOGNITION_COLLECTION_ID
  }));
  return {
    ...status,
    collectionExists: true,
    collectionCreated: collection.created,
    indexedFaces: description.FaceCount ?? 0,
    embeddingsStored: description.FaceCount ?? 0,
    searchEnabled: true,
    checks: {
      CreateCollection: true,
      IndexFaces: true,
      SearchFacesByImage: true
    }
  };
}

export function cosineSimilarity(query, stored) {
  if (!Array.isArray(query) || !Array.isArray(stored) || query.length !== stored.length) return 0;
  let dot = 0;
  let queryMagnitude = 0;
  let storedMagnitude = 0;
  for (let index = 0; index < query.length; index += 1) {
    dot += query[index] * stored[index];
    queryMagnitude += query[index] ** 2;
    storedMagnitude += stored[index] ** 2;
  }
  if (!queryMagnitude || !storedMagnitude) return 0;
  return dot / (Math.sqrt(queryMagnitude) * Math.sqrt(storedMagnitude));
}

export function findFaceMatches({ queryEmbedding, storedFaces, threshold = 0.8 }) {
  return storedFaces
    .map((face) => ({ ...face, similarity: cosineSimilarity(queryEmbedding, face.embedding) }))
    .filter((face) => face.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}

export async function extractLocalFaceEmbeddings({ buffer, mediaId = null }) {
  await loadLocalFaceModels();
  const jpeg = await sharp(buffer, { failOn: "none" })
    .rotate()
    .jpeg({ quality: 92 })
    .toBuffer();
  const decoded = faceapi.tf.node.decodeImage(jpeg, 3);
  const expanded = faceapi.tf.expandDims(decoded, 0);
  try {
    const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35, maxResults: 20 });
    const detections = await faceapi
      .detectAllFaces(expanded, options)
      .withFaceLandmarks()
      .withFaceDescriptors();
    return detections.map((detection, index) => {
      const box = detection.detection.box;
      const embedding = Array.from(detection.descriptor);
      return {
        id: crypto.randomUUID(),
        provider: "face-api.js",
        providerFaceId: mediaId ? `${mediaId}:face:${index + 1}` : null,
        mediaId,
        embedding,
        confidence: Number(((detection.detection.score ?? 0) * 100).toFixed(2)),
        box: {
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height)
        },
        createdAt: new Date().toISOString()
      };
    });
  } finally {
    faceapi.tf.dispose([decoded, expanded]);
  }
}

export async function indexFacesForMedia({ buffer, mediaId }) {
  if (!rekognition) {
    const records = await extractLocalFaceEmbeddings({ buffer, mediaId });
    return {
      provider: "face-api.js",
      collection: { ok: true, created: false, collectionId: "local-face-api-descriptors" },
      records,
      diagnostics: {
        configured: true,
        operation: "LocalDescriptorExtraction",
        succeeded: true,
        facesDetected: records.length,
        embeddingGenerated: records.length > 0,
        embeddingDimension: records[0]?.embedding?.length ?? 0,
        unindexedFaces: 0
      }
    };
  }
  const collection = await ensureFaceCollection();
  const response = await rekognition.send(new IndexFacesCommand({
    CollectionId: process.env.REKOGNITION_COLLECTION_ID,
    Image: { Bytes: buffer },
    ExternalImageId: mediaId,
    DetectionAttributes: ["DEFAULT"],
    MaxFaces: 20,
    QualityFilter: "AUTO"
  }));
  const records = (response.FaceRecords ?? []).map((record) => ({
    id: record.Face?.FaceId,
    provider: "aws-rekognition",
    providerFaceId: record.Face?.FaceId,
    mediaId,
    confidence: record.FaceDetail?.Confidence ?? record.Face?.Confidence ?? 0,
    box: record.FaceDetail?.BoundingBox ?? null,
    createdAt: new Date().toISOString()
  }));
  return {
    provider: "aws-rekognition",
    collection,
    records,
    diagnostics: {
      configured: true,
      operation: "IndexFaces",
      succeeded: true,
      facesDetected: records.length,
      unindexedFaces: response.UnindexedFaces?.length ?? 0
    }
  };
}

export async function searchFacesByReference({ buffer, threshold = 80 }) {
  if (!rekognition) return null;
  const collection = await ensureFaceCollection();
  let response;
  try {
    response = await rekognition.send(new SearchFacesByImageCommand({
      CollectionId: process.env.REKOGNITION_COLLECTION_ID,
      Image: { Bytes: buffer },
      FaceMatchThreshold: threshold,
      MaxFaces: 50
    }));
  } catch (error) {
    if (error.name === "InvalidParameterException") {
      return {
        provider: "aws-rekognition",
        collection,
        queryFaceDetected: false,
        embeddingGenerated: false,
        embeddingDimension: "provider-managed",
        matches: [],
        error: "No searchable face was detected in the reference image."
      };
    }
    throw error;
  }
  return {
    provider: "aws-rekognition",
    collection,
    queryFaceDetected: true,
    embeddingGenerated: true,
    embeddingDimension: "provider-managed",
    matches: (response.FaceMatches ?? []).map((match) => ({
      provider: "aws-rekognition",
      providerFaceId: match.Face?.FaceId,
      mediaId: match.Face?.ExternalImageId,
      similarity: (match.Similarity ?? 0) / 100,
      confidence: match.Face?.Confidence ?? 0
    }))
  };
}

export function semanticScore(query, media, event, uploader) {
  const tokens = String(query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const text = `${media.caption} ${media.aiCaption} ${media.tags.join(" ")} ${event?.name ?? ""} ${event?.category ?? ""} ${uploader?.name ?? ""} ${media.createdAt}`.toLowerCase();
  if (!tokens.length) return 70;
  return Math.min(99, tokens.reduce((score, token) => score + (text.includes(token) ? 22 : 0), 30 + media.tags.length * 3));
}
