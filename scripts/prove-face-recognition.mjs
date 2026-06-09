import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.API_URL ?? "http://127.0.0.1:4000";
const datasetRoot = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve("tests/fixtures/real-faces");
const credentials = {
  email: process.env.FACE_TEST_EMAIL ?? "admin@momentra.app",
  password: process.env.FACE_TEST_PASSWORD ?? "momentra123"
};

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function imageFiles(directory) {
  if (!(await exists(directory))) return [];
  const files = await readdir(directory);
  return files
    .filter((file) => /\.(jpe?g|png|webp)$/i.test(file))
    .map((file) => path.join(directory, file))
    .sort();
}

async function filePart(filePath) {
  const buffer = await readFile(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const type = extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
  return new File([buffer], path.basename(filePath), { type });
}

async function api(pathname, { token, method = "GET", body } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(payload.error ?? response.statusText);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function assert(condition, message, details) {
  if (!condition) {
    console.error(JSON.stringify({ ok: false, message, details }, null, 2));
    process.exit(1);
  }
}

async function uploadSet({ token, albumId, files, label }) {
  const form = new FormData();
  form.append("albumId", albumId);
  for (const file of files) form.append("files", await filePart(file));
  const result = await api("/api/uploads", { token, method: "POST", body: form });
  return result.data.map((item) => ({ ...item, expectedPerson: label }));
}

async function search({ token, albumId, file, threshold = 0.8 }) {
  const form = new FormData();
  form.append("threshold", String(threshold));
  if (albumId) form.append("albumId", albumId);
  form.append("selfie", await filePart(file));
  return api("/api/ai/find-my-photos", { token, method: "POST", body: form });
}

async function main() {
  const dhoniPool = await imageFiles(path.join(datasetRoot, "dhoni-album"));
  const kohliPool = await imageFiles(path.join(datasetRoot, "kohli-album"));
  const dhoniFiles = dhoniPool.slice(0, 5);
  const kohliFiles = kohliPool.slice(0, 5);
  const groupFiles = await imageFiles(path.join(datasetRoot, "group"));
  const dhoniQuery = path.join(datasetRoot, "queries", "dhoni-external.jpg");
  const kohliQuery = path.join(datasetRoot, "queries", "kohli-external.jpg");
  const unknownQuery = path.join(datasetRoot, "queries", "unknown-external.jpg");

  assert(dhoniPool.length >= 5, "Dataset must contain at least 5 Dhoni album photos", { directory: path.join(datasetRoot, "dhoni-album"), found: dhoniPool.length });
  assert(kohliPool.length >= 5, "Dataset must contain at least 5 Kohli album photos", { directory: path.join(datasetRoot, "kohli-album"), found: kohliPool.length });
  assert(groupFiles.length >= 1, "Dataset must contain at least one Dhoni+Kohli group photo", { directory: path.join(datasetRoot, "group") });
  assert(await exists(dhoniQuery), "Missing external Dhoni query image", { file: dhoniQuery });
  assert(await exists(kohliQuery), "Missing external Kohli query image", { file: kohliQuery });
  assert(await exists(unknownQuery), "Missing unknown-person query image", { file: unknownQuery });

  const login = await api("/api/auth/login", { method: "POST", body: credentials });
  const token = login.token;
  const healthBefore = await api("/api/ai/face-health", { token });
  assert(healthBefore.configured, "Face provider is not configured; set AWS Rekognition environment variables before running proof", healthBefore);

  const eventForm = new FormData();
  eventForm.append("name", `Real Face Proof ${Date.now()}`);
  eventForm.append("description", "Dhoni and Kohli identity-recognition acceptance test.");
  eventForm.append("date", new Date().toISOString().slice(0, 10));
  eventForm.append("category", "Face Recognition QA");
  eventForm.append("privacy", "PRIVATE");
  eventForm.append("clubName", "Momentra QA");
  const created = await api("/api/events", { token, method: "POST", body: eventForm });
  const albumId = created.album.id;

  const uploadedDhoni = await uploadSet({ token, albumId, files: dhoniFiles, label: "dhoni" });
  const uploadedKohli = await uploadSet({ token, albumId, files: kohliFiles, label: "kohli" });
  const uploadedGroup = await uploadSet({ token, albumId, files: groupFiles.slice(0, 1), label: "group" });
  const dhoniIds = new Set(uploadedDhoni.map((item) => item.id));
  const kohliIds = new Set(uploadedKohli.map((item) => item.id));
  const groupIds = new Set(uploadedGroup.map((item) => item.id));

  const reindex = await api("/api/ai/reindex-faces", { token, method: "POST", body: { albumId } });
  assert(reindex.totalFaceEmbeddingRecords >= 11, "Reindex did not create enough face records for the acceptance dataset", reindex);

  const dhoniResult = await search({ token, albumId, file: dhoniQuery });
  const kohliResult = await search({ token, albumId, file: kohliQuery });
  const unknownResult = await search({ token, albumId, file: unknownQuery });

  const dhoniReturned = new Set(dhoniResult.data.map((item) => item.id));
  const kohliReturned = new Set(kohliResult.data.map((item) => item.id));
  const unknownReturned = new Set(unknownResult.data.map((item) => item.id));

  const missingDhoni = [...dhoniIds].filter((id) => !dhoniReturned.has(id));
  const falseDhoni = [...kohliIds].filter((id) => dhoniReturned.has(id));
  const missingKohli = [...kohliIds].filter((id) => !kohliReturned.has(id));
  const falseKohli = [...dhoniIds].filter((id) => kohliReturned.has(id));

  assert(missingDhoni.length === 0, "Dhoni query did not return all 5 Dhoni album photos", { missingDhoni, results: dhoniResult.similarityScores });
  assert(falseDhoni.length === 0, "Dhoni query incorrectly returned Kohli photos", { falseDhoni, results: dhoniResult.similarityScores });
  assert(missingKohli.length === 0, "Kohli query did not return all 5 Kohli album photos", { missingKohli, results: kohliResult.similarityScores });
  assert(falseKohli.length === 0, "Kohli query incorrectly returned Dhoni photos", { falseKohli, results: kohliResult.similarityScores });
  assert([...groupIds].some((id) => dhoniReturned.has(id)), "Dhoni query did not return the Dhoni+Kohli group photo", { groupIds: [...groupIds], results: dhoniResult.similarityScores });
  assert([...unknownReturned].every((id) => !dhoniIds.has(id) && !kohliIds.has(id) && !groupIds.has(id)), "Unknown-person query returned acceptance dataset identities", { results: unknownResult.similarityScores });

  const healthAfter = await api("/api/ai/face-health", { token });
  console.log(JSON.stringify({
    ok: true,
    provider: healthAfter.provider,
    indexedFaces: healthAfter.indexedFaces,
    embeddingsStored: healthAfter.embeddingsStored,
    dhoni: {
      matchesFound: dhoniResult.matchesFound,
      returnedMediaIds: dhoniResult.data.map((item) => item.id),
      similarityScores: dhoniResult.similarityScores
    },
    kohli: {
      matchesFound: kohliResult.matchesFound,
      returnedMediaIds: kohliResult.data.map((item) => item.id),
      similarityScores: kohliResult.similarityScores
    },
    unknown: {
      matchesFound: unknownResult.matchesFound,
      returnedMediaIds: unknownResult.data.map((item) => item.id),
      similarityScores: unknownResult.similarityScores
    },
    reindexEvidence: reindex.media.map((item) => ({
      mediaId: item.mediaId,
      fileName: item.fileName,
      facesDetected: item.facesDetected,
      embeddingCreated: item.embeddingCreated,
      embeddingDimension: item.embeddingDimension,
      providerFaceIds: item.providerFaceIds
    }))
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    status: error.status,
    message: error.message,
    payload: error.payload
  }, null, 2));
  process.exit(1);
});
