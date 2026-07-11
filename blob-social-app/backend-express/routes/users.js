const express = require("express");
const db = require("../db");
const { requireAuth, optionalAuth } = require("../middleware/auth");

const router = express.Router();

function shapeProfile(u, viewerId) {
  return {
    id: u.id,
    username: u.username,
    bio: u.bio,
    avatar_emoji: u.avatar_emoji,
    avatar_color: u.avatar_color,
    created_at: u.created_at,
    follower_count: db.countFollowers(u.id),
    following_count: db.countFollowing(u.id),
    post_count: db.listPostsByUser(u.id).length,
    is_following: viewerId ? db.isFollowing(viewerId, u.id) : false,
    is_self: viewerId === u.id,
  };
}

// GET /api/users?search=xyz — search / list users (for "people to follow")
router.get("/", optionalAuth, (req, res) => {
  const search = (req.query.search || "").trim();
  const rows = search ? db.findUsers(search) : db.listRecentUsers();
  const viewerId = req.user ? req.user.id : null;
  res.json(rows.map((u) => shapeProfile(u, viewerId)));
});

// GET /api/users/:username — full profile
router.get("/:username", optionalAuth, (req, res) => {
  const u = db.getUserByUsername(req.params.username);
  if (!u) return res.status(404).json({ error: "That user doesn't seem to exist." });
  const viewerId = req.user ? req.user.id : null;
  res.json(shapeProfile(u, viewerId));
});

// PATCH /api/users/me/update — update your own bio / avatar
router.patch("/me/update", requireAuth, (req, res) => {
  const { bio, avatar_emoji, avatar_color } = req.body;
  const current = db.getUserById(req.user.id);
  const updated = db.updateUser(req.user.id, {
    bio: bio !== undefined ? bio : current.bio,
    avatar_emoji: avatar_emoji !== undefined ? avatar_emoji : current.avatar_emoji,
    avatar_color: avatar_color !== undefined ? avatar_color : current.avatar_color,
  });
  res.json(shapeProfile(updated, req.user.id));
});

module.exports = router;
