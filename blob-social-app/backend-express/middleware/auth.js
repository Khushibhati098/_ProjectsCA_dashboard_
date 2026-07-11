// middleware/auth.js — checks the Authorization header for a valid JWT
// and attaches the decoded user info to req.user
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "cute-funky-secret-change-me";

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "You need to log in first! 🔒" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, username }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Your session expired, please log in again. ⏰" });
  }
}

// Like requireAuth, but doesn't fail if there's no token — just leaves req.user empty.
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      req.user = null;
    }
  }
  next();
}

module.exports = { requireAuth, optionalAuth, JWT_SECRET };
