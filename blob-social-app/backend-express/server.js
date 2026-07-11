const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const postRoutes = require("./routes/posts");
const commentRoutes = require("./routes/comments");
const followRoutes = require("./routes/follow");
const highlightRoutes = require("./routes/highlights");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/follow", followRoutes);
app.use("/api/highlights", highlightRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true, message: "Mini Social backend is bouncing! 🎉" }));

// Serve the frontend as static files too, so you can run one server for everything.
const frontendPath = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendPath));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`🎈 Mini Social backend running at http://localhost:${PORT}`);
});
