const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function shapeHighlight(h, includeItems) {
  const base = {
    id: h.id,
    user_id: h.user_id,
    title: h.title,
    emoji: h.emoji,
    created_at: h.created_at,
    item_count: db.countHighlightItems(h.id),
  };
  if (includeItems) {
    base.items = db.listHighlightItems(h.id).map((i) => ({
      id: i.id,
      content: i.content,
      created_at: i.created_at,
    }));
  }
  return base;
}

// GET /api/highlights/user/:username — all highlight reels for a profile (covers only)
router.get("/user/:username", (req, res) => {
  const user = db.getUserByUsername(req.params.username);
  if (!user) return res.status(404).json({ error: "That user doesn't seem to exist." });
  const rows = db.listHighlightsByUser(user.id);
  res.json(rows.map((h) => shapeHighlight(h, false)));
});

// GET /api/highlights/:id — a single highlight with all of its moments
router.get("/:id", (req, res) => {
  const h = db.getHighlightById(req.params.id);
  if (!h) return res.status(404).json({ error: "That highlight doesn't exist (maybe it was deleted)." });
  res.json(shapeHighlight(h, true));
});

// POST /api/highlights — create a new highlight reel, optionally with a first moment
router.post("/", requireAuth, (req, res) => {
  const { title, emoji, first_item } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Give your highlight a title!" });
  }
  if (title.length > 30) {
    return res.status(400).json({ error: "Keep the title under 30 characters." });
  }

  const highlight = db.insertHighlight({
    user_id: req.user.id,
    title: title.trim(),
    emoji: emoji || "✨",
  });

  if (first_item && first_item.trim()) {
    db.insertHighlightItem({ highlight_id: highlight.id, content: first_item.trim().slice(0, 220) });
  }

  res.status(201).json(shapeHighlight(highlight, true));
});

// PATCH /api/highlights/:id — rename / re-cover a highlight you own
router.patch("/:id", requireAuth, (req, res) => {
  const h = db.getHighlightById(req.params.id);
  if (!h) return res.status(404).json({ error: "That highlight doesn't exist." });
  if (h.user_id !== req.user.id) return res.status(403).json({ error: "You can only edit your own highlights." });

  const { title, emoji } = req.body;
  const updated = db.updateHighlight(h.id, {
    title: title !== undefined && title.trim() ? title.trim().slice(0, 30) : h.title,
    emoji: emoji !== undefined ? emoji : h.emoji,
  });
  res.json(shapeHighlight(updated, true));
});

// DELETE /api/highlights/:id — remove a whole highlight reel you own
router.delete("/:id", requireAuth, (req, res) => {
  const h = db.getHighlightById(req.params.id);
  if (!h) return res.status(404).json({ error: "That highlight doesn't exist." });
  if (h.user_id !== req.user.id) return res.status(403).json({ error: "You can only delete your own highlights." });

  db.deleteHighlight(h.id);
  res.json({ deleted: true });
});

// POST /api/highlights/:id/items — add a new moment to a highlight you own
router.post("/:id/items", requireAuth, (req, res) => {
  const h = db.getHighlightById(req.params.id);
  if (!h) return res.status(404).json({ error: "That highlight doesn't exist." });
  if (h.user_id !== req.user.id) return res.status(403).json({ error: "You can only add to your own highlights." });

  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: "A moment needs some words!" });
  }
  if (content.length > 220) {
    return res.status(400).json({ error: "Keep each moment under 220 characters." });
  }

  db.insertHighlightItem({ highlight_id: h.id, content: content.trim() });
  res.status(201).json(shapeHighlight(h, true));
});

// DELETE /api/highlights/items/:itemId — remove a single moment you own
router.delete("/items/:itemId", requireAuth, (req, res) => {
  const item = db.getHighlightItemById(req.params.itemId);
  if (!item) return res.status(404).json({ error: "That moment doesn't exist." });
  const parent = db.getHighlightById(item.highlight_id);
  if (!parent || parent.user_id !== req.user.id) {
    return res.status(403).json({ error: "You can only delete your own moments." });
  }

  db.deleteHighlightItem(item.id);
  res.json(shapeHighlight(parent, true));
});

module.exports = router;
