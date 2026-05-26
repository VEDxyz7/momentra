import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";

const router = Router();

router.post("/signup", async (req, res) => {
  const { name, email, password, role = "VIEWER" } = req.body;
  const passwordHash = await bcrypt.hash(password, 12);

  res.status(201).json({
    user: { id: "usr_demo", name, email, role, passwordHash: passwordHash.slice(0, 14) + "..." },
    token: jwt.sign({ sub: "usr_demo", email, role }, process.env.JWT_SECRET ?? "dev-secret", { expiresIn: "15m" }),
    refreshToken: "http-only-cookie-in-production"
  });
});

router.post("/login", async (req, res) => {
  const { email } = req.body;
  const role = email?.includes("photo") ? "PHOTOGRAPHER" : "ADMIN";

  res.json({
    user: { id: "usr_demo", email, name: "Demo User", role },
    token: jwt.sign({ sub: "usr_demo", email, role }, process.env.JWT_SECRET ?? "dev-secret", { expiresIn: "15m" })
  });
});

router.post("/refresh", (_req, res) => {
  res.json({ token: "rotated-jwt-issued-from-http-only-refresh-cookie" });
});

export default router;
