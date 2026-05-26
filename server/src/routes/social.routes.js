import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/media/:id/like", requireAuth, (req, res) => {
  res.json({ mediaId: req.params.id, liked: true, notification: "owner-liked-photo" });
});

router.post("/media/:id/comment", requireAuth, (req, res) => {
  res.status(201).json({ mediaId: req.params.id, body: req.body.body, notification: "owner-commented-photo" });
});

router.post("/media/:id/tag", requireAuth, (req, res) => {
  res.status(201).json({ mediaId: req.params.id, taggedUserId: req.body.userId, notification: "user-tagged" });
});

export default router;
