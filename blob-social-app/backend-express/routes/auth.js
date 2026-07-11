const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

const EMOJIS = ["🐸", "🦊", "🐼", "🐙", "🦄", "🐝", "🐨", "🦋", "🐢", "🐣", "🌈", "🍄"];
const COLORS = ["#FFB3C7", "#FFD93D", "#8CE7C1", "#B8A6FF", "#FF9F6B", "#7FDBFF"];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    bio: u.bio,
    avatar_emoji: u.avatar_emoji,
    avatar_color: u.avatar_color,
    created_at: u.created_at,
  };
}

// POST /api/auth/register
router.post("/register", (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Username, email, and password are all required." });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: "Username needs to be at least 3 characters." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password needs to be at least 6 characters." });
  }

  const existing = db.getUserByUsernameOrEmail(username) || db.getUserByUsernameOrEmail(email);
  if (existing) {
    return res.status(409).json({ error: "That username or email is already taken." });
  }

  const hash = bcrypt.hashSync(password, 10);
  const user = db.insertUser({
    username,
    email,
    password_hash: hash,
    avatar_emoji: pick(EMOJIS),
    avatar_color: pick(COLORS),
  });

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
  res.status(201).json({ token, user: publicUser(user) });
});

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const user = db.getUserByUsernameOrEmail(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: publicUser(user) });
});

module.exports = router;
