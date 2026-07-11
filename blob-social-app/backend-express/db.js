// db.js — a tiny dependency-free JSON-file "database".
// Not built for scale, but perfect for a mini social app: no native
// modules to compile, works everywhere `node` runs, and persists to disk.
const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "social.json");

const EMPTY = {
  users: [],
  posts: [],
  comments: [],
  likes: [],
  follows: [],
  highlights: [],
  highlight_items: [],
  _seq: { users: 0, posts: 0, comments: 0, likes: 0, follows: 0, highlights: 0, highlight_items: 0 },
};

function load() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(EMPTY, null, 2));
  }
  const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  // Backfill fields for DBs saved before highlights existed.
  if (!parsed.highlights) parsed.highlights = [];
  if (!parsed.highlight_items) parsed.highlight_items = [];
  if (!parsed._seq.highlights) parsed._seq.highlights = 0;
  if (!parsed._seq.highlight_items) parsed._seq.highlight_items = 0;
  return parsed;
}

let state = load();
let saveTimer = null;

function persist() {
  // Debounce writes slightly so rapid-fire requests don't thrash the disk.
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2));
  }, 20);
}

function nextId(table) {
  state._seq[table] = (state._seq[table] || 0) + 1;
  return state._seq[table];
}

const db = {
  // ---- users ----
  insertUser({ username, email, password_hash, avatar_emoji, avatar_color }) {
    const row = {
      id: nextId("users"),
      username,
      email,
      password_hash,
      bio: "",
      avatar_emoji,
      avatar_color,
      created_at: new Date().toISOString(),
    };
    state.users.push(row);
    persist();
    return row;
  },
  getUserById(id) {
    return state.users.find((u) => u.id === Number(id)) || null;
  },
  getUserByUsername(username) {
    return state.users.find((u) => u.username === username) || null;
  },
  getUserByUsernameOrEmail(value) {
    return state.users.find((u) => u.username === value || u.email === value) || null;
  },
  findUsers(search) {
    let rows = state.users;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((u) => u.username.toLowerCase().includes(q));
    }
    return rows.slice().sort((a, b) => a.username.localeCompare(b.username)).slice(0, 20);
  },
  listRecentUsers() {
    return state.users
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 20);
  },
  updateUser(id, fields) {
    const u = db.getUserById(id);
    if (!u) return null;
    Object.assign(u, fields);
    persist();
    return u;
  },

  // ---- posts ----
  insertPost({ user_id, content }) {
    const row = { id: nextId("posts"), user_id, content, created_at: new Date().toISOString() };
    state.posts.push(row);
    persist();
    return row;
  },
  getPostById(id) {
    return state.posts.find((p) => p.id === Number(id)) || null;
  },
  deletePost(id) {
    state.posts = state.posts.filter((p) => p.id !== Number(id));
    state.comments = state.comments.filter((c) => c.post_id !== Number(id));
    state.likes = state.likes.filter((l) => l.post_id !== Number(id));
    persist();
  },
  listAllPosts() {
    return state.posts
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.id - a.id)
      .slice(0, 100);
  },
  listPostsByUser(userId) {
    return state.posts
      .filter((p) => p.user_id === Number(userId))
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.id - a.id);
  },
  listFollowingFeed(viewerId) {
    const followingIds = new Set(
      state.follows.filter((f) => f.follower_id === viewerId).map((f) => f.following_id)
    );
    followingIds.add(viewerId);
    return state.posts
      .filter((p) => followingIds.has(p.user_id))
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.id - a.id);
  },

  // ---- comments ----
  insertComment({ post_id, user_id, content }) {
    const row = {
      id: nextId("comments"),
      post_id: Number(post_id),
      user_id,
      content,
      created_at: new Date().toISOString(),
    };
    state.comments.push(row);
    persist();
    return row;
  },
  getCommentById(id) {
    return state.comments.find((c) => c.id === Number(id)) || null;
  },
  deleteComment(id) {
    state.comments = state.comments.filter((c) => c.id !== Number(id));
    persist();
  },
  listCommentsForPost(postId) {
    return state.comments
      .filter((c) => c.post_id === Number(postId))
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at) || a.id - b.id);
  },
  countCommentsForPost(postId) {
    return state.comments.filter((c) => c.post_id === Number(postId)).length;
  },

  // ---- likes ----
  getLike(postId, userId) {
    return (
      state.likes.find((l) => l.post_id === Number(postId) && l.user_id === userId) || null
    );
  },
  addLike(postId, userId) {
    const row = {
      id: nextId("likes"),
      post_id: Number(postId),
      user_id: userId,
      created_at: new Date().toISOString(),
    };
    state.likes.push(row);
    persist();
    return row;
  },
  removeLike(postId, userId) {
    state.likes = state.likes.filter(
      (l) => !(l.post_id === Number(postId) && l.user_id === userId)
    );
    persist();
  },
  countLikes(postId) {
    return state.likes.filter((l) => l.post_id === Number(postId)).length;
  },

  // ---- follows ----
  isFollowing(followerId, followingId) {
    return state.follows.some(
      (f) => f.follower_id === followerId && f.following_id === followingId
    );
  },
  follow(followerId, followingId) {
    if (db.isFollowing(followerId, followingId)) return;
    state.follows.push({
      id: nextId("follows"),
      follower_id: followerId,
      following_id: followingId,
      created_at: new Date().toISOString(),
    });
    persist();
  },
  unfollow(followerId, followingId) {
    state.follows = state.follows.filter(
      (f) => !(f.follower_id === followerId && f.following_id === followingId)
    );
    persist();
  },
  countFollowers(userId) {
    return state.follows.filter((f) => f.following_id === userId).length;
  },
  countFollowing(userId) {
    return state.follows.filter((f) => f.follower_id === userId).length;
  },

  // ---- highlights (Instagram-style saved collections) ----
  insertHighlight({ user_id, title, emoji }) {
    const row = {
      id: nextId("highlights"),
      user_id,
      title,
      emoji,
      created_at: new Date().toISOString(),
    };
    state.highlights.push(row);
    persist();
    return row;
  },
  getHighlightById(id) {
    return state.highlights.find((h) => h.id === Number(id)) || null;
  },
  listHighlightsByUser(userId) {
    return state.highlights
      .filter((h) => h.user_id === Number(userId))
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at) || a.id - b.id);
  },
  updateHighlight(id, fields) {
    const h = db.getHighlightById(id);
    if (!h) return null;
    Object.assign(h, fields);
    persist();
    return h;
  },
  deleteHighlight(id) {
    state.highlights = state.highlights.filter((h) => h.id !== Number(id));
    state.highlight_items = state.highlight_items.filter((i) => i.highlight_id !== Number(id));
    persist();
  },

  // ---- highlight items (the individual saved "moments" inside a highlight) ----
  insertHighlightItem({ highlight_id, content }) {
    const row = {
      id: nextId("highlight_items"),
      highlight_id: Number(highlight_id),
      content,
      created_at: new Date().toISOString(),
    };
    state.highlight_items.push(row);
    persist();
    return row;
  },
  getHighlightItemById(id) {
    return state.highlight_items.find((i) => i.id === Number(id)) || null;
  },
  listHighlightItems(highlightId) {
    return state.highlight_items
      .filter((i) => i.highlight_id === Number(highlightId))
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at) || a.id - b.id);
  },
  countHighlightItems(highlightId) {
    return state.highlight_items.filter((i) => i.highlight_id === Number(highlightId)).length;
  },
  deleteHighlightItem(id) {
    state.highlight_items = state.highlight_items.filter((i) => i.id !== Number(id));
    persist();
  },
};

module.exports = db;
