import jwt from "jsonwebtoken";
import { roleRank } from "./db.js";

const secret = process.env.JWT_SECRET ?? "momentra-local-dev-secret";

export function signAccess(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, secret, { expiresIn: "30m" });
}

export function signRefresh(user) {
  return jwt.sign({ sub: user.id, type: "refresh" }, secret, { expiresIn: "14d" });
}

export function verifyToken(token) {
  return jwt.verify(token, secret);
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    req.auth = verifyToken(token);
    return next();
  } catch {
    return res.status(401).json({ error: "Session expired" });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.auth || roleRank[req.auth.role] < roleRank[role]) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    return next();
  };
}

export function canAccessAlbum(userRole, visibility) {
  if (visibility === "PUBLIC") return true;
  if (visibility === "CLUB_ONLY") return roleRank[userRole] >= roleRank.CLUB_MEMBER;
  return roleRank[userRole] >= roleRank.PHOTOGRAPHER;
}
