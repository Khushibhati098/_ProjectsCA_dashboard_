const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// POST /api/follow/:username — follow a user
router.post("/:username", requireAuth, (req, res) => {
  const target = db.getUserByUsername(req.params.username);
  if (!target) return res.status(404).json({ error: "That user doesn't seem to exist." });
  if (target.id === req.user.id) {
    return res.status(400).json({ error: "You can't follow yourself, silly! 😄" });
  }

  db.follow(req.user.id, target.id);
  res.json({ following: true, follower_count: db.countFollowers(target.id) });
});

// DELETE /api/follow/:username — unfollow a user
router.delete("/:username", requireAuth, (req, res) => {
  const target = db.getUserByUsername(req.params.username);
  if (!target) return res.status(404).json({ error: "That user doesn't seem to exist." });

  db.unfollow(req.user.id, target.id);
  res.json({ following: false, follower_count: db.countFollowers(target.id) });
});

module.exports = router;
