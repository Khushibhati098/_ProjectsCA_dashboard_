const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function shapeComment(c) {
  const author = db.getUserById(c.user_id);
  return {
    id: c.id,
    post_id: c.post_id,
    content: c.content,
    created_at: c.created_at,
    author: {
      id: author.id,
      username: author.username,
      avatar_emoji: author.avatar_emoji,
      avatar_color: author.avatar_color,
    },
  };
}

// GET /api/comments/post/:postId — all comments for a post
router.get("/post/:postId", (req, res) => {
  const post = db.getPostById(req.params.postId);
  if (!post) return res.status(404).json({ error: "That post doesn't exist." });
  res.json(db.listCommentsForPost(req.params.postId).map(shapeComment));
});

// POST /api/comments/post/:postId — add a comment
router.post("/post/:postId", requireAuth, (req, res) => {
  const post = db.getPostById(req.params.postId);
  if (!post) return res.status(404).json({ error: "That post doesn't exist." });

  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: "Your comment can't be empty!" });
  }
  if (content.length > 300) {
    return res.status(400).json({ error: "Keep comments under 300 characters." });
  }

  const comment = db.insertComment({ post_id: req.params.postId, user_id: req.user.id, content: content.trim() });
  res.status(201).json(shapeComment(comment));
});

// DELETE /api/comments/:id — delete your own comment
router.delete("/:id", requireAuth, (req, res) => {
  const c = db.getCommentById(req.params.id);
  if (!c) return res.status(404).json({ error: "That comment doesn't exist." });
  if (c.user_id !== req.user.id) {
    return res.status(403).json({ error: "You can only delete your own comments." });
  }
  db.deleteComment(req.params.id);
  res.json({ deleted: true });
});

module.exports = router;
