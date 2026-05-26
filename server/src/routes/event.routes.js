import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, (_req, res) => {
  res.json({ data: [], filters: ["name", "date", "category"] });
});

router.post("/", requireAuth, requireRole("ADMIN"), (req, res) => {
  res.status(201).json({
    ...req.body,
    id: "evt_demo",
    album: { id: "alb_auto", title: `${req.body.name} Album`, visibility: "PRIVATE" }
  });
});

router.patch("/:id", requireAuth, requireRole("ADMIN"), (req, res) => {
  res.json({ id: req.params.id, ...req.body });
});

export default router;
