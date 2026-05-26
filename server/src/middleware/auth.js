import jwt from "jsonwebtoken";

const roleRank = {
  VIEWER: 1,
  CLUB_MEMBER: 2,
  PHOTOGRAPHER: 3,
  ADMIN: 4
};

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET ?? "dev-secret");
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(minimumRole) {
  return (req, res, next) => {
    if (!req.user || roleRank[req.user.role] < roleRank[minimumRole]) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    return next();
  };
}
