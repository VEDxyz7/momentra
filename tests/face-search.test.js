import assert from "node:assert/strict";
import test from "node:test";
import { cosineSimilarity, findFaceMatches } from "../server/src/services/aiService.js";

const dhoni = [0.92, 0.14, 0.21, 0.05, 0.31, 0.77, 0.12, 0.44];
const dhoniPose2 = [0.90, 0.16, 0.20, 0.06, 0.33, 0.75, 0.11, 0.46];
const dhoniLighting = [0.89, 0.12, 0.23, 0.04, 0.30, 0.79, 0.13, 0.43];
const dhoniCrop = [0.94, 0.13, 0.19, 0.05, 0.32, 0.76, 0.10, 0.45];
const dhoniAngle = [0.91, 0.15, 0.22, 0.07, 0.29, 0.78, 0.14, 0.42];
const kohli = [0.18, 0.83, 0.66, 0.22, 0.77, 0.11, 0.55, 0.09];
const queryDhoniExternal = [0.93, 0.13, 0.20, 0.06, 0.30, 0.78, 0.12, 0.45];

function face(mediaId, person, embedding) {
  return {
    id: `${mediaId}-${person}`,
    mediaId,
    person,
    embedding,
    confidence: 99,
    box: { left: 0.2, top: 0.1, width: 0.3, height: 0.4 }
  };
}

test("Test 1: another Dhoni photo returns all five Dhoni photos", () => {
  const storedFaces = [
    face("dhoni-1", "dhoni", dhoni),
    face("dhoni-2", "dhoni", dhoniPose2),
    face("dhoni-3", "dhoni", dhoniLighting),
    face("dhoni-4", "dhoni", dhoniCrop),
    face("dhoni-5", "dhoni", dhoniAngle)
  ];
  const matches = findFaceMatches({ queryEmbedding: queryDhoniExternal, storedFaces, threshold: 0.98 });
  assert.deepEqual([...matches.map((match) => match.mediaId)].sort(), ["dhoni-1", "dhoni-2", "dhoni-3", "dhoni-4", "dhoni-5"]);
  assert.ok(matches.every((match) => match.similarity >= 0.98));
  assert.ok(matches.every((match, index) => index === 0 || matches[index - 1].similarity >= match.similarity));
});

test("Test 2: Dhoni query excludes Kohli photos", () => {
  const storedFaces = [
    face("dhoni-1", "dhoni", dhoni),
    face("dhoni-2", "dhoni", dhoniPose2),
    face("dhoni-3", "dhoni", dhoniLighting),
    face("dhoni-4", "dhoni", dhoniCrop),
    face("dhoni-5", "dhoni", dhoniAngle),
    face("kohli-1", "kohli", kohli),
    face("kohli-2", "kohli", [0.16, 0.85, 0.65, 0.20, 0.78, 0.10, 0.57, 0.11]),
    face("kohli-3", "kohli", [0.19, 0.82, 0.68, 0.23, 0.75, 0.12, 0.56, 0.08]),
    face("kohli-4", "kohli", [0.17, 0.84, 0.64, 0.21, 0.79, 0.13, 0.53, 0.10]),
    face("kohli-5", "kohli", [0.20, 0.81, 0.67, 0.24, 0.76, 0.09, 0.54, 0.12])
  ];
  const matches = findFaceMatches({ queryEmbedding: queryDhoniExternal, storedFaces, threshold: 0.98 });
  assert.ok(matches.length >= 5);
  assert.ok(matches.every((match) => match.person === "dhoni"));
});

test("Test 3: group photo containing Dhoni and Kohli returns group photo for Dhoni search", () => {
  const storedFaces = [
    face("group-photo", "dhoni", dhoniPose2),
    face("group-photo", "kohli", kohli)
  ];
  const matches = findFaceMatches({ queryEmbedding: queryDhoniExternal, storedFaces, threshold: 0.98 });
  assert.equal(matches[0].mediaId, "group-photo");
  assert.equal(matches[0].person, "dhoni");
});

test("Test 4: reference image absent from album still matches same identity", () => {
  const storedFaces = [
    face("album-dhoni-1", "dhoni", dhoni),
    face("album-kohli-1", "kohli", kohli)
  ];
  assert.notDeepEqual(queryDhoniExternal, dhoni);
  assert.ok(cosineSimilarity(queryDhoniExternal, dhoni) > 0.98);
  const matches = findFaceMatches({ queryEmbedding: queryDhoniExternal, storedFaces, threshold: 0.98 });
  assert.deepEqual(matches.map((match) => match.mediaId), ["album-dhoni-1"]);
});
