const express = require("express");
const db = require("../db");
const { requireAuth, optionalAuth } = require("../middleware/auth");

const router = express.Router();

function shapePost(p, viewerId) {
  const author = db.getUserById(p.user_id);
  return {
    id: p.id,
    content: p.content,
    created_at: p.created_at,
    author: {
      id: author.id,
      username: author.username,
      avatar_emoji: author.avatar_emoji,
      avatar_color: author.avatar_color,
    },
    like_count: db.countLikes(p.id),
    comment_count: db.countCommentsForPost(p.id),
    liked_by_me: viewerId ? !!db.getLike(p.id, viewerId) : false,
    is_own: viewerId === p.user_id,
  };
}

// GET /api/posts?feed=following  → posts from people you follow (+ yourself)
// GET /api/posts                 → global feed (everyone)
// GET /api/posts?username=xyz    → posts by one user
router.get("/", optionalAuth, (req, res) => {
  const viewerId = req.user ? req.user.id : null;
  let rows;

  if (req.query.username) {
    const author = db.getUserByUsername(req.query.username);
    if (!author) return res.status(404).json({ error: "That user doesn't seem to exist." });
    rows = db.listPostsByUser(author.id);
  } else if (req.query.feed === "following" && viewerId) {
    rows = db.listFollowingFeed(viewerId);
  } else {
    rows = db.listAllPosts();
  }

  res.json(rows.map((p) => shapePost(p, viewerId)));
});

// GET /api/posts/:id — single post
router.get("/:id", optionalAuth, (req, res) => {
  const p = db.getPostById(req.params.id);
  if (!p) return res.status(404).json({ error: "That post doesn't exist (maybe it got deleted?)." });
  res.json(shapePost(p, req.user ? req.user.id : null));
});

// POST /api/posts — create a post
router.post("/", requireAuth, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: "Your post can't be empty!" });
  }
  if (content.length > 500) {
    return res.status(400).json({ error: "Keep it under 500 characters, chatterbox! 😄" });
  }

  const post = db.insertPost({ user_id: req.user.id, content: content.trim() });
  res.status(201).json(shapePost(post, req.user.id));
});

// DELETE /api/posts/:id — delete your own post
router.delete("/:id", requireAuth, (req, res) => {
  const p = db.getPostById(req.params.id);
  if (!p) return res.status(404).json({ error: "That post doesn't exist." });
  if (p.user_id !== req.user.id) {
    return res.status(403).json({ error: "You can only delete your own posts." });
  }
  db.deletePost(req.params.id);
  res.json({ deleted: true });
});

// POST /api/posts/:id/like — toggle like
router.post("/:id/like", requireAuth, (req, res) => {
  const p = db.getPostById(req.params.id);
  if (!p) return res.status(404).json({ error: "That post doesn't exist." });

  const existing = db.getLike(p.id, req.user.id);
  if (existing) {
    db.removeLike(p.id, req.user.id);
  } else {
    db.addLike(p.id, req.user.id);
  }

  res.json({ liked: !existing, like_count: db.countLikes(p.id) });
});

module.exports = router;
