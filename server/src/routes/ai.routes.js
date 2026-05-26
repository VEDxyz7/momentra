import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/tag-image", requireAuth, (_req, res) => {
  res.json({
    tags: [
      { label: "crowd", score: 0.94 },
      { label: "stage", score: 0.88 },
      { label: "concert", score: 0.81 }
    ],
    caption: "A lively campus event with stage lights and a cheering crowd."
  });
});

router.post("/find-my-photos", requireAuth, (_req, res) => {
  res.json({
    referenceFaceId: "face_demo",
    matches: [
      { mediaId: "m1", confidence: 0.92 },
      { mediaId: "m3", confidence: 0.88 }
    ]
  });
});

export default router;
