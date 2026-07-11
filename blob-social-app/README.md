# Blob 🫧 — mini social app

A small social media app: user profiles, posts & comments, and a like/follow
system. Same frontend, **two interchangeable backends** — pick whichever you
want to run.

```
blob-social-app/
├── frontend/           HTML + CSS + vanilla JS UI (works with either backend)
├── backend-express/    Node.js / Express + JWT + JSON file storage
└── backend-django/     Django + Django REST Framework + JWT + SQLite
```

Both backends expose the same `/api/...` routes, so `frontend/` doesn't
change no matter which one you run.

## Features

- **User profiles** — username, bio, emoji avatar + color, follower/following counts
- **Posts & comments** — create, delete, threaded comments per post
- **Likes & follows** — like/unlike posts, follow/unfollow users, a "Following" feed
- Search for people, an "everyone" + "following" feed toggle, and a little
  chatbot widget (Blobby) for fun

## Option A — run the Express backend

```bash
cd backend-express
npm install
npm start
```

Open **http://localhost:4000** — data is stored in
`backend-express/social.json` (created automatically on first run).

## Option B — run the Django backend

```bash
cd backend-django
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000
```

Open **http://localhost:8000** — data is stored in `backend-django/db.sqlite3`.
See `backend-django/README.md` for more detail (including the Django admin).

## What was fixed / added

- Verified and tested the full Express + frontend flow end-to-end
  (register → post → like → comment → follow → profile) — no bugs found in
  the existing logic, it was already solid.
- Built a complete **Django + DRF backend from scratch** that mirrors the
  Express API 1:1, with a custom user model, JWT auth, and the same
  posts/comments/likes/follows feature set, tested the same way.
- Kept the existing color palette and visual style in `frontend/` exactly as
  it was — it was already a clean, modern "design system v2" (soft violet/
  coral/sunny palette, Sora + Inter type, restrained shadows).
