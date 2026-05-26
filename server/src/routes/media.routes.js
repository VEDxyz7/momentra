import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createSignedUpload, watermarkPolicy } from "../modules/storage.js";

const router = Router();

router.post("/signed-upload", requireAuth, requireRole("PHOTOGRAPHER"), async (req, res) => {
  res.json(await createSignedUpload(req.body));
});

router.post("/:id/download", requireAuth, (req, res) => {
  res.json({
    mediaId: req.params.id,
    downloadUrl: "https://cdn.momentra.app/watermarked/demo.jpg",
    watermark: watermarkPolicy(req.body)
  });
});

router.get("/search", requireAuth, (req, res) => {
  res.json({ query: req.query, results: [], facets: ["event", "tag", "uploader", "date", "face"] });
});

export default router;
