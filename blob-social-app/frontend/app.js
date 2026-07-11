// app.js — all the frontend logic for Blob 🫧
// Talks to the Express backend over the /api routes.

const API_BASE = "/api"; // frontend is served by the same Express server

// ---------- tiny state ----------
let state = {
  token: localStorage.getItem("blob_token") || null,
  user: JSON.parse(localStorage.getItem("blob_user") || "null"),
  currentFeed: "all",
  viewingProfile: null, // username currently shown in profile view
};

const EMOJI_CHOICES = ["🐸", "🦊", "🐼", "🐙", "🦄", "🐝", "🐨", "🦋", "🐢", "🐣", "🌈", "🍄"];
const COLOR_CHOICES = ["#FFB3C7", "#FFD93D", "#8CE7C1", "#B8A6FF", "#FF9F6B", "#7FDBFF"];

// ---------- helpers ----------
function $(sel) { return document.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function timeAgo(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString + "Z").getTime()) / 1000);
  if (seconds < 0 || isNaN(seconds)) return "just now";
  if (seconds < 60) return "just now";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

function showToast(msg) {
  const toast = $("#toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add("hidden"), 2200);
}

async function api(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (state.token) headers["Authorization"] = `Bearer ${state.token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong, sorry! 🫤");
  }
  return data;
}

function saveSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem("blob_token", token);
  localStorage.setItem("blob_user", JSON.stringify(user));
}

function clearSession() {
  state.token = null;
  state.user = null;
  localStorage.removeItem("blob_token");
  localStorage.removeItem("blob_user");
}

// ---------- view switching ----------
function showView(name) {
  $all(".view").forEach((v) => v.classList.add("hidden"));
  $(`#${name}View`).classList.remove("hidden");
}

function refreshNav() {
  $("#authedNav").style.display = state.user ? "flex" : "none";
  $("#chatFab").classList.toggle("hidden", !state.user);
  $("#chatPanel").classList.add("hidden");
}

// ---------- avatar rendering ----------
function avatarHtml(user, sizeClass) {
  return `<div class="${sizeClass}" style="background:${user.avatar_color}">${user.avatar_emoji}</div>`;
}

// ================= AUTH =================
function initAuth() {
  $all(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $all(".auth-tab").forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      const which = tab.dataset.tab;
      $("#loginForm").classList.toggle("hidden", which !== "login");
      $("#registerForm").classList.toggle("hidden", which !== "register");
    });
  });

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    $("#loginError").textContent = "";
    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: { username: form.get("username"), password: form.get("password") },
      });
      saveSession(data.token, data.user);
      onLoggedIn();
    } catch (err) {
      $("#loginError").textContent = err.message;
    }
  });

  $("#registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    $("#registerError").textContent = "";
    try {
      const data = await api("/auth/register", {
        method: "POST",
        body: {
          username: form.get("username"),
          email: form.get("email"),
          password: form.get("password"),
        },
      });
      saveSession(data.token, data.user);
      onLoggedIn();
    } catch (err) {
      $("#registerError").textContent = err.message;
    }
  });

  $("#logoutBtn").addEventListener("click", () => {
    clearSession();
    refreshNav();
    delete $("#chatPanel").dataset.loaded;
    $("#chatBody").innerHTML = "";
    showView("auth");
    showToast("See you soon! 👋");
  });
}

function onLoggedIn() {
  refreshNav();
  showView("feed");
  loadEverything();
  showToast(`Welcome back, ${state.user.username}! 🎉`);
}

// ================= NAV =================
function initNav() {
  $all('[data-nav="feed"]').forEach((el) =>
    el.addEventListener("click", () => {
      if (!state.user) return;
      showView("feed");
      loadFeed();
    })
  );
  $("#myProfileNavBtn").addEventListener("click", () => openProfile(state.user.username));
}

// ================= SEARCH =================
function initSearch() {
  const input = $("#searchInput");
  const resultsBox = $("#searchResults");
  let debounceTimer;

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (!q) {
      resultsBox.classList.add("hidden");
      return;
    }
    debounceTimer = setTimeout(async () => {
      try {
        const users = await api(`/users?search=${encodeURIComponent(q)}`);
        renderSearchResults(users);
      } catch (err) {
        // silent fail on search
      }
    }, 250);
  });

  document.addEventListener("click", (e) => {
    if (!resultsBox.contains(e.target) && e.target !== input) {
      resultsBox.classList.add("hidden");
    }
  });

  function renderSearchResults(users) {
    if (!users.length) {
      resultsBox.innerHTML = `<div class="search-result-item">no blobs found 🫥</div>`;
    } else {
      resultsBox.innerHTML = users
        .map(
          (u) => `
        <div class="search-result-item" data-username="${escapeHtml(u.username)}">
          ${avatarHtml(u, "comment-avatar")}
          <span>@${escapeHtml(u.username)}</span>
        </div>`
        )
        .join("");
      $all(".search-result-item[data-username]").forEach((el) =>
        el.addEventListener("click", () => {
          resultsBox.classList.add("hidden");
          input.value = "";
          openProfile(el.dataset.username);
        })
      );
    }
    resultsBox.classList.remove("hidden");
  }
}

// ================= FEED =================
function initFeedControls() {
  $all(".feed-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $all(".feed-tab").forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      state.currentFeed = tab.dataset.feed;
      loadFeed();
    });
  });

  $("#postContent").addEventListener("input", (e) => {
    $("#charCount").textContent = e.target.value.length;
  });

  $("#postBtn").addEventListener("click", async () => {
    const textarea = $("#postContent");
    const content = textarea.value.trim();
    if (!content) return showToast("Type something first! ✏️");
    try {
      await api("/posts", { method: "POST", body: { content } });
      textarea.value = "";
      $("#charCount").textContent = "0";
      showToast("Posted! 🎈");
      loadFeed();
    } catch (err) {
      showToast(err.message);
    }
  });
}

async function loadFeed() {
  const url = state.currentFeed === "following" ? "/posts?feed=following" : "/posts";
  try {
    const posts = await api(url);
    renderPosts(posts, "#postsList");
    $("#emptyFeedMsg").classList.toggle("hidden", posts.length > 0);
  } catch (err) {
    showToast(err.message);
  }
}

function renderPosts(posts, containerSelector) {
  const container = $(containerSelector);
  if (!posts.length) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = posts.map(postCardHtml).join("");
  attachPostHandlers(container);
}

function postCardHtml(p) {
  const canDelete = p.is_own;
  return `
  <article class="post-card" data-post-id="${p.id}">
    <div class="post-card__head">
      <div class="post-avatar" style="background:${p.author.avatar_color}" data-username="${escapeHtml(p.author.username)}">${p.author.avatar_emoji}</div>
      <div class="post-meta">
        <div class="post-username" data-username="${escapeHtml(p.author.username)}">@${escapeHtml(p.author.username)}</div>
        <div class="post-time">${timeAgo(p.created_at)}</div>
      </div>
      ${canDelete ? `<button class="post-delete-btn" data-action="delete-post" title="Delete post">🗑️</button>` : ""}
    </div>
    <div class="post-content">${escapeHtml(p.content)}</div>
    <div class="post-actions">
      <button class="action-btn ${p.liked_by_me ? "is-liked" : ""}" data-action="like">
        ${p.liked_by_me ? "💖" : "🤍"} <span class="like-count">${p.like_count}</span>
      </button>
      <button class="action-btn" data-action="toggle-comments">
        💬 <span class="comment-count">${p.comment_count}</span>
      </button>
    </div>
    <div class="comments-block hidden" data-comments-for="${p.id}">
      <div class="comments-list"></div>
      <form class="comment-form" data-post-id="${p.id}">
        <input type="text" maxlength="300" placeholder="add a comment…" required />
        <button type="submit">Send</button>
      </form>
    </div>
  </article>`;
}

function attachPostHandlers(container) {
  $all(".post-avatar, .post-username", container).forEach((el) =>
    el.addEventListener("click", () => openProfile(el.dataset.username))
  );

  $all('[data-action="like"]', container).forEach((btn) =>
    btn.addEventListener("click", async () => {
      const card = btn.closest(".post-card");
      const postId = card.dataset.postId;
      try {
        const result = await api(`/posts/${postId}/like`, { method: "POST" });
        btn.classList.toggle("is-liked", result.liked);
        btn.querySelector(".like-count").textContent = result.like_count;
        btn.innerHTML = `${result.liked ? "💖" : "🤍"} <span class="like-count">${result.like_count}</span>`;
        btn.classList.add("pop");
        setTimeout(() => btn.classList.remove("pop"), 350);
      } catch (err) {
        showToast(err.message);
      }
    })
  );

  $all('[data-action="delete-post"]', container).forEach((btn) =>
    btn.addEventListener("click", async () => {
      const card = btn.closest(".post-card");
      if (!confirm("Delete this post for good?")) return;
      try {
        await api(`/posts/${card.dataset.postId}`, { method: "DELETE" });
        card.remove();
        showToast("Post deleted 🗑️");
      } catch (err) {
        showToast(err.message);
      }
    })
  );

  $all('[data-action="toggle-comments"]', container).forEach((btn) =>
    btn.addEventListener("click", async () => {
      const card = btn.closest(".post-card");
      const postId = card.dataset.postId;
      const block = card.querySelector(`[data-comments-for="${postId}"]`);
      const wasHidden = block.classList.contains("hidden");
      block.classList.toggle("hidden");
      if (wasHidden) await loadComments(postId, block.querySelector(".comments-list"));
    })
  );

  $all(".comment-form", container).forEach((form) =>
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = form.querySelector("input");
      const content = input.value.trim();
      if (!content) return;
      const postId = form.dataset.postId;
      try {
        await api(`/comments/post/${postId}`, { method: "POST", body: { content } });
        input.value = "";
        const block = form.closest(".comments-block");
        await loadComments(postId, block.querySelector(".comments-list"));
        const card = form.closest(".post-card");
        const countEl = card.querySelector(".comment-count");
        countEl.textContent = Number(countEl.textContent) + 1;
      } catch (err) {
        showToast(err.message);
      }
    })
  );
}

async function loadComments(postId, listEl) {
  listEl.innerHTML = `<p class="empty-msg" style="padding:6px 0;">loading…</p>`;
  try {
    const comments = await api(`/comments/post/${postId}`);
    if (!comments.length) {
      listEl.innerHTML = `<p style="color:var(--plum-soft); font-size:0.85rem;">no comments yet — say hi! 👋</p>`;
      return;
    }
    listEl.innerHTML = comments
      .map(
        (c) => `
      <div class="comment-item">
        ${avatarHtml(c.author, "comment-avatar")}
        <div class="comment-bubble">
          <span class="comment-author">@${escapeHtml(c.author.username)}</span>${escapeHtml(c.content)}
        </div>
      </div>`
      )
      .join("");
  } catch (err) {
    listEl.innerHTML = `<p style="color:#D8365F;">${escapeHtml(err.message)}</p>`;
  }
}

// ================= SIDEBAR (mini profile + suggestions) =================
async function loadSidebar() {
  const me = await api(`/users/${state.user.username}`);
  $("#miniProfileCard").innerHTML = `
    ${avatarHtml(me, "mini-avatar")}
    <div class="mini-username">@${escapeHtml(me.username)}</div>
    <div class="mini-bio">${escapeHtml(me.bio || "no bio yet — add one on your profile!")}</div>
    <div class="mini-stats">
      <div><b>${me.post_count}</b>posts</div>
      <div><b>${me.follower_count}</b>followers</div>
      <div><b>${me.following_count}</b>following</div>
    </div>`;
  $("#composerAvatar").innerHTML = "";
  $("#composerAvatar").style.background = me.avatar_color;
  $("#composerAvatar").textContent = me.avatar_emoji;

  const suggestions = await api("/users");
  const others = suggestions.filter((u) => u.username !== state.user.username).slice(0, 6);
  $("#suggestionsList").innerHTML = others.length
    ? others.map(suggestionItemHtml).join("")
    : `<p style="font-size:0.85rem;color:var(--plum-soft);">no other blobs yet!</p>`;
  attachFollowHandlers($("#suggestionsList"));
}

function suggestionItemHtml(u) {
  return `
  <div class="suggestion-item" data-username="${escapeHtml(u.username)}">
    ${avatarHtml(u, "mini-avatar")}
    <span class="suggestion-name" data-username="${escapeHtml(u.username)}">@${escapeHtml(u.username)}</span>
    <button class="follow-toggle-btn ${u.is_following ? "is-following" : ""}" data-username="${escapeHtml(u.username)}">
      ${u.is_following ? "Following" : "Follow"}
    </button>
  </div>`;
}

function attachFollowHandlers(root) {
  $all(".suggestion-name", root).forEach((el) =>
    el.addEventListener("click", () => openProfile(el.dataset.username))
  );
  $all(".follow-toggle-btn", root).forEach((btn) =>
    btn.addEventListener("click", () => toggleFollow(btn))
  );
}

async function toggleFollow(btn) {
  const username = btn.dataset.username;
  const isFollowing = btn.classList.contains("is-following");
  try {
    const result = await api(`/follow/${username}`, { method: isFollowing ? "DELETE" : "POST" });
    btn.classList.toggle("is-following", result.following);
    btn.textContent = result.following ? "Following" : "Follow";
    showToast(result.following ? `Following @${username}! 💞` : `Unfollowed @${username}`);
  } catch (err) {
    showToast(err.message);
  }
}

// ================= PROFILE VIEW =================
async function openProfile(username) {
  state.viewingProfile = username;
  showView("profile");
  try {
    const profile = await api(`/users/${username}`);
    state.viewingProfileData = profile;
    renderProfileHeader(profile);
    loadHighlights(username, profile.is_self);
    const posts = await api(`/posts?username=${encodeURIComponent(username)}`);
    renderPosts(posts, "#profilePostsList");
    if (!posts.length) {
      $("#profilePostsList").innerHTML = `<p class="empty-msg">no posts yet 🫧</p>`;
    }
  } catch (err) {
    showToast(err.message);
  }
}

function renderProfileHeader(p) {
  const isSelf = p.is_self;
  $("#profileHeader").innerHTML = `
    ${avatarHtml(p, "mini-avatar")}
    <div class="profile-header__info">
      <h2 class="profile-header__name">@${escapeHtml(p.username)}</h2>
      <p class="profile-header__bio">${escapeHtml(p.bio || "no bio yet")}</p>
      <div class="profile-header__stats">
        <div><b>${p.post_count}</b> posts</div>
        <div><b>${p.follower_count}</b> followers</div>
        <div><b>${p.following_count}</b> following</div>
      </div>
      ${
        isSelf
          ? `<button class="pill-btn pill-btn--primary" id="editProfileBtn">Edit profile ✏️</button>`
          : `<button class="follow-toggle-btn pill-btn ${p.is_following ? "is-following" : ""}" data-username="${escapeHtml(p.username)}" style="padding:10px 20px;">
              ${p.is_following ? "Following 💞" : "Follow ➕"}
            </button>`
      }
    </div>`;

  const editCard = $("#profileEditCard");
  editCard.classList.add("hidden");

  if (isSelf) {
    $("#editProfileBtn").addEventListener("click", () => {
      editCard.classList.toggle("hidden");
      populateEditForm(p);
    });
  } else {
    attachFollowHandlers($("#profileHeader"));
    // Re-render header follow count after follow/unfollow so stats stay right.
    $all(".follow-toggle-btn", $("#profileHeader")).forEach((btn) =>
      btn.addEventListener("click", () => setTimeout(() => openProfile(p.username), 250))
    );
  }
}

function populateEditForm(p) {
  $("#editBio").value = p.bio || "";

  const emojiPicker = $("#emojiPicker");
  emojiPicker.innerHTML = EMOJI_CHOICES.map(
    (e) => `<div class="emoji-choice ${e === p.avatar_emoji ? "selected" : ""}" data-emoji="${e}">${e}</div>`
  ).join("");
  $all(".emoji-choice", emojiPicker).forEach((el) =>
    el.addEventListener("click", () => {
      $all(".emoji-choice", emojiPicker).forEach((e) => e.classList.remove("selected"));
      el.classList.add("selected");
    })
  );

  const colorPicker = $("#colorPicker");
  colorPicker.innerHTML = COLOR_CHOICES.map(
    (c) => `<div class="color-choice ${c === p.avatar_color ? "selected" : ""}" data-color="${c}" style="background:${c}"></div>`
  ).join("");
  $all(".color-choice", colorPicker).forEach((el) =>
    el.addEventListener("click", () => {
      $all(".color-choice", colorPicker).forEach((e) => e.classList.remove("selected"));
      el.classList.add("selected");
    })
  );

  $("#saveProfileBtn").onclick = async () => {
    const chosenEmoji = $(".emoji-choice.selected")?.dataset.emoji || p.avatar_emoji;
    const chosenColor = $(".color-choice.selected")?.dataset.color || p.avatar_color;
    try {
      const updated = await api("/users/me/update", {
        method: "PATCH",
        body: { bio: $("#editBio").value.trim(), avatar_emoji: chosenEmoji, avatar_color: chosenColor },
      });
      state.user = { ...state.user, ...updated };
      localStorage.setItem("blob_user", JSON.stringify(state.user));
      renderProfileHeader(updated);
      $("#profileEditCard").classList.add("hidden");
      loadSidebar();
      showToast("Profile updated! 🌟");
    } catch (err) {
      showToast(err.message);
    }
  };
}

// ================= HIGHLIGHTS (Instagram-style saved reels) =================
// state.currentHighlights holds the covers for whichever profile is open.
// state.storyState holds the open story-viewer's position/timers.
state.currentHighlights = [];
state.storyState = null;

async function loadHighlights(username, isSelf) {
  const row = $("#highlightsRow");
  row.innerHTML = `<p class="highlights-empty-hint">loading highlights…</p>`;
  try {
    const highlights = await api(`/highlights/user/${encodeURIComponent(username)}`);
    state.currentHighlights = highlights;
    row.innerHTML = "";

    highlights.forEach((h) => {
      const bubble = document.createElement("button");
      bubble.className = "highlight-bubble";
      bubble.dataset.highlightId = h.id;
      bubble.innerHTML = `
        <span class="highlight-ring">
          <span class="highlight-ring__inner">
            <span class="highlight-avatar">${h.emoji}</span>
          </span>
        </span>
        <span class="highlight-label">${escapeHtml(h.title)}</span>`;
      bubble.addEventListener("click", () => openStoryViewer(h.id, isSelf));
      row.appendChild(bubble);
    });

    if (isSelf) {
      const addBubble = document.createElement("button");
      addBubble.className = "highlight-bubble";
      addBubble.innerHTML = `
        <span class="highlight-ring highlight-ring--add">
          <span class="highlight-avatar">＋</span>
        </span>
        <span class="highlight-label">New</span>`;
      addBubble.addEventListener("click", () => openHighlightModal());
      row.appendChild(addBubble);
    }

    if (!highlights.length && !isSelf) {
      row.innerHTML = `<p class="highlights-empty-hint">no highlights yet</p>`;
    }
  } catch (err) {
    row.innerHTML = "";
  }
}

// ---------- create-highlight modal ----------
function initHighlightModal() {
  const emojiPicker = $("#highlightEmojiPicker");
  emojiPicker.innerHTML = EMOJI_CHOICES.map(
    (e, i) => `<div class="emoji-choice ${i === 0 ? "selected" : ""}" data-emoji="${e}">${e}</div>`
  ).join("");
  $all(".emoji-choice", emojiPicker).forEach((el) =>
    el.addEventListener("click", () => {
      $all(".emoji-choice", emojiPicker).forEach((e) => e.classList.remove("selected"));
      el.classList.add("selected");
    })
  );

  $("#highlightModalCancel").addEventListener("click", closeHighlightModal);
  $("#highlightModal").addEventListener("click", (e) => {
    if (e.target.id === "highlightModal") closeHighlightModal();
  });
  $("#highlightModalSave").addEventListener("click", saveNewHighlight);
}

function openHighlightModal() {
  $("#highlightTitleInput").value = "";
  $("#highlightFirstItem").value = "";
  $all(".emoji-choice", $("#highlightEmojiPicker")).forEach((e, i) => e.classList.toggle("selected", i === 0));
  $("#highlightModal").classList.remove("hidden");
  $("#highlightTitleInput").focus();
}

function closeHighlightModal() {
  $("#highlightModal").classList.add("hidden");
}

async function saveNewHighlight() {
  const title = $("#highlightTitleInput").value.trim();
  const emoji = $(".emoji-choice.selected", $("#highlightEmojiPicker"))?.dataset.emoji || "✨";
  const first_item = $("#highlightFirstItem").value.trim();
  if (!title) return showToast("Give your highlight a title!");

  try {
    await api("/highlights", { method: "POST", body: { title, emoji, first_item } });
    closeHighlightModal();
    showToast("Highlight created! ✨");
    loadHighlights(state.user.username, true);
  } catch (err) {
    showToast(err.message);
  }
}

// ---------- story viewer ----------
function initStoryViewer() {
  $("#storyClose").addEventListener("click", closeStoryViewer);
  $("#storyViewer").addEventListener("click", (e) => {
    if (e.target.id === "storyViewer") closeStoryViewer();
  });
  $("#storyPrev").addEventListener("click", () => advanceStory(-1));
  $("#storyNext").addEventListener("click", () => advanceStory(1));
  $("#storyAddToggle").addEventListener("click", () => {
    $("#storyAddForm").classList.toggle("is-open");
    $("#storyAddInput").focus();
  });
  $("#storyAddSubmit").addEventListener("click", submitNewMoment);
  $("#storyAddInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitNewMoment();
  });
  $("#storyDeleteItem").addEventListener("click", deleteCurrentMoment);
}

const STORY_DURATION = 5000;

async function openStoryViewer(highlightId, isSelf) {
  try {
    const highlight = await api(`/highlights/${highlightId}`);
    state.storyState = { highlight, index: 0, isSelf, timer: null };
    renderStoryChrome();
    $("#storyViewer").classList.remove("hidden");
    playStory();
  } catch (err) {
    showToast(err.message);
  }
}

function renderStoryChrome() {
  const { highlight, isSelf } = state.storyState;
  const owner = state.viewingProfileData || state.user;
  $("#storyAvatar").innerHTML = "";
  $("#storyAvatar").style.background = owner.avatar_color;
  $("#storyAvatar").textContent = highlight.emoji;
  $("#storyTitle").textContent = highlight.title;
  $("#storySub").textContent = `${highlight.items.length} moment${highlight.items.length === 1 ? "" : "s"}`;
  $("#storyFooter").classList.toggle("hidden", !isSelf);
  $("#storyAddForm").classList.remove("is-open");
  $("#storyAddInput").value = "";

  const progressBox = $("#storyProgress");
  progressBox.innerHTML = highlight.items
    .map(() => `<div class="story-viewer__seg"><div class="story-viewer__seg-fill"></div></div>`)
    .join("");
}

function playStory() {
  const s = state.storyState;
  if (!s) return;
  clearTimeout(s.timer);

  if (!s.highlight.items.length) {
    $("#storyText").textContent = "No moments saved here yet.";
    return;
  }

  const item = s.highlight.items[s.index];
  $("#storyText").textContent = item.content;

  $all(".story-viewer__seg", $("#storyProgress")).forEach((seg, i) => {
    seg.classList.toggle("is-done", i < s.index);
    const fill = seg.querySelector(".story-viewer__seg-fill");
    fill.style.transition = "none";
    fill.style.width = i < s.index ? "100%" : "0%";
    if (i === s.index) {
      requestAnimationFrame(() => {
        fill.style.transition = `width ${STORY_DURATION}ms linear`;
        fill.style.width = "100%";
      });
    }
  });

  s.timer = setTimeout(() => advanceStory(1), STORY_DURATION);
}

function advanceStory(direction) {
  const s = state.storyState;
  if (!s || !s.highlight.items.length) return;
  const nextIndex = s.index + direction;
  if (nextIndex < 0) return;
  if (nextIndex >= s.highlight.items.length) {
    closeStoryViewer();
    return;
  }
  s.index = nextIndex;
  playStory();
}

function closeStoryViewer() {
  const s = state.storyState;
  if (s) clearTimeout(s.timer);
  state.storyState = null;
  $("#storyViewer").classList.add("hidden");
  // Refresh the highlights row in case items/highlights changed.
  if (state.viewingProfile) loadHighlights(state.viewingProfile, state.viewingProfile === state.user.username);
}

async function submitNewMoment() {
  const s = state.storyState;
  if (!s) return;
  const content = $("#storyAddInput").value.trim();
  if (!content) return;
  try {
    const updated = await api(`/highlights/${s.highlight.id}/items`, { method: "POST", body: { content } });
    s.highlight = updated;
    s.index = updated.items.length - 1;
    renderStoryChrome();
    playStory();
    showToast("Moment added! 🎞️");
  } catch (err) {
    showToast(err.message);
  }
}

async function deleteCurrentMoment() {
  const s = state.storyState;
  if (!s || !s.highlight.items.length) return;
  const item = s.highlight.items[s.index];
  if (!confirm("Delete this moment?")) return;
  try {
    const updated = await api(`/highlights/items/${item.id}`, { method: "DELETE" });
    if (!updated.items.length) {
      // Nothing left — remove the whole highlight for a clean profile.
      await api(`/highlights/${s.highlight.id}`, { method: "DELETE" }).catch(() => {});
      showToast("Highlight deleted 🗑️");
      closeStoryViewer();
      return;
    }
    s.highlight = updated;
    s.index = Math.min(s.index, updated.items.length - 1);
    renderStoryChrome();
    playStory();
  } catch (err) {
    showToast(err.message);
  }
}

// ================= CHAT BOT (Blobby) =================
// A lightweight, fully client-side scripted assistant — no API key needed.
// Swap `getBotReply` for a real API call if you want to wire this up to Claude.
const CHAT_SUGGESTIONS = [
  "How do highlights work?",
  "How do I post something?",
  "How do I follow someone?",
  "Tell me a joke",
];

const CHAT_INTENTS = [
  { keywords: ["hi", "hello", "hey", "yo", "sup"], reply: () => `Hey ${state.user ? "@" + state.user.username : "there"}! I'm Blobby 🤖 — ask me how anything in Blob works.` },
  { keywords: ["highlight"], reply: () => "Highlights live on your profile! Tap the '+ New' bubble under your header to start one — give it a title and a cover emoji. Tap any highlight bubble to view it like a story, and while it's open you can add more moments or delete the current one." },
  { keywords: ["post", "share"], reply: () => "Just type into the box at the top of your feed and hit Post — it'll show up for everyone, or only your followers if you check the 'Following' tab later." },
  { keywords: ["follow"], reply: () => "Search for someone with the search bar, or tap a username anywhere, then hit the Follow button on their profile. Their posts will then show up in your 'Following' feed tab." },
  { keywords: ["comment"], reply: () => "Tap the 💬 button under any post to open its comments, type your reply, and hit Send." },
  { keywords: ["like", "heart"], reply: () => "Tap the heart button under a post to like it — tap again to unlike. Simple as that!" },
  { keywords: ["profile", "avatar", "bio", "emoji", "color"], reply: () => "Head to your profile and hit 'Edit profile' — you can change your bio, pick a new emoji, and pick a new color for your avatar." },
  { keywords: ["delete"], reply: () => "You can delete your own posts with the 🗑️ button, your own comments the same way, and your own highlight moments from inside the story viewer." },
  { keywords: ["joke"], reply: () => pick_random(["Why don't scientists trust atoms? Because they make up everything! 🧪", "I told my computer I needed a break, and it said 'no problem, I'll go to sleep.' 💻", "Why did the blob go to therapy? Too many unresolved shapes. 🫧"]) },
  { keywords: ["who are you", "what are you", "your name"], reply: () => "I'm Blobby, the little helper bot built into this app! I run entirely in your browser — no external API needed." },
  { keywords: ["claude", "anthropic"], reply: () => "This app was scaffolded with Claude! I'm just a small rule-based helper baked into the frontend, not Claude itself." },
  { keywords: ["thank", "thanks"], reply: () => "Anytime! 🫧" },
  { keywords: ["bye", "goodbye"], reply: () => "See you around! Come back if you need anything else." },
];

function pick_random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getBotReply(text) {
  const lower = text.toLowerCase();
  for (const intent of CHAT_INTENTS) {
    if (intent.keywords.some((k) => lower.includes(k))) return intent.reply();
  }
  return pick_random([
    "Not sure about that one — try asking about posts, follows, comments, likes, or highlights!",
    "Hmm, I don't have an answer for that yet. I'm best at questions about how Blob works.",
    "I might not know that, but I'm happy to explain how to post, follow, or use highlights!",
  ]);
}

function chatStorageKey() {
  return `blob_chat_${state.user ? state.user.username : "guest"}`;
}

function loadChatHistory() {
  try {
    return JSON.parse(localStorage.getItem(chatStorageKey()) || "[]");
  } catch {
    return [];
  }
}

function saveChatHistory(messages) {
  localStorage.setItem(chatStorageKey(), JSON.stringify(messages.slice(-40)));
}

function appendChatMessage(role, text, persist = true) {
  const body = $("#chatBody");
  const el = document.createElement("div");
  el.className = `chat-msg chat-msg--${role}`;
  el.textContent = text;
  body.appendChild(el);
  body.scrollTop = body.scrollHeight;

  if (persist) {
    const history = loadChatHistory();
    history.push({ role, text });
    saveChatHistory(history);
  }
}

function showTypingIndicator() {
  const body = $("#chatBody");
  const el = document.createElement("div");
  el.className = "chat-msg chat-msg--bot chat-msg--typing";
  el.id = "chatTypingIndicator";
  el.innerHTML = `<span class="chat-typing-dot"></span><span class="chat-typing-dot"></span><span class="chat-typing-dot"></span>`;
  body.appendChild(el);
  body.scrollTop = body.scrollHeight;
}

function hideTypingIndicator() {
  $("#chatTypingIndicator")?.remove();
}

function sendChatMessage(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  appendChatMessage("user", trimmed);
  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    appendChatMessage("bot", getBotReply(trimmed));
  }, 500 + Math.random() * 400);
}

function renderChatSuggestions() {
  $("#chatSuggestions").innerHTML = CHAT_SUGGESTIONS.map(
    (s) => `<button type="button" class="chat-suggestion-chip">${escapeHtml(s)}</button>`
  ).join("");
  $all(".chat-suggestion-chip", $("#chatSuggestions")).forEach((chip) =>
    chip.addEventListener("click", () => sendChatMessage(chip.textContent))
  );
}

function initChat() {
  const fab = $("#chatFab");
  const panel = $("#chatPanel");
  const form = $("#chatForm");
  const input = $("#chatInput");

  renderChatSuggestions();

  fab.addEventListener("click", () => {
    const opening = panel.classList.contains("hidden");
    panel.classList.toggle("hidden");
    $("#chatBadge").classList.add("hidden");
    if (opening && !panel.dataset.loaded) {
      panel.dataset.loaded = "1";
      const history = loadChatHistory();
      if (!history.length) {
        appendChatMessage("bot", "Hi! I'm Blobby 🤖 Ask me how to post, follow people, or use highlights.");
      } else {
        history.forEach((m) => appendChatMessage(m.role, m.text, false));
      }
    }
    if (opening) input.focus();
  });

  $("#chatClose").addEventListener("click", () => panel.classList.add("hidden"));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value;
    input.value = "";
    sendChatMessage(text);
  });
}

// ================= INITIAL LOAD =================
function loadEverything() {
  loadSidebar();
  loadFeed();
}

function init() {
  initAuth();
  initNav();
  initSearch();
  initFeedControls();
  initHighlightModal();
  initStoryViewer();
  initChat();
  refreshNav();

  if (state.token && state.user) {
    showView("feed");
    loadEverything();
  } else {
    showView("auth");
  }
}

document.addEventListener("DOMContentLoaded", init);
