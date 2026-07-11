# Blob — Django backend

This is a **Django + Django REST Framework** version of the Blob backend. It
implements the exact same `/api/...` routes as the Express backend in
`backend/`, so the existing `frontend/` folder works against either one
unchanged.

Features:
- Custom user model with bio + avatar (emoji & color)
- JWT auth (register / login) via `djangorestframework-simplejwt`
- Posts (create, list, delete, like/unlike)
- Comments (create, list, delete)
- Follow / unfollow + follower & following counts
- Global feed, "following" feed, and per-user feed
- Django admin at `/admin/` for poking at the data directly

## Setup

```bash
cd django_backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

python manage.py migrate
python manage.py createsuperuser   # optional, for /admin/
python manage.py runserver 8000
```

Then open **http://localhost:8000/** — Django serves the `frontend/` folder
directly (same trick the Express server uses), so the whole app runs from
one server and one port.

If you'd rather run the frontend separately (e.g. Live Server on a different
port), CORS is wide open in `config/settings.py` for local dev, so that
works too — just point the frontend's `API_BASE` in `app.js` at
`http://localhost:8000/api`.

## Project layout

```
django_backend/
├── manage.py
├── requirements.txt
├── config/            # project settings, root urls
└── api/                # the actual app
    ├── models.py       # User, Post, Comment, Like, Follow
    ├── serializers.py
    ├── views.py
    ├── urls.py
    └── admin.py
```

## Notes

- Database is SQLite (`db.sqlite3`) by default — zero setup, good for
  learning/demo use. Swap `DATABASES` in `config/settings.py` for Postgres
  when you're ready to deploy for real.
- Password rule is a simple 6-character minimum, matching the Express
  backend. Turn the stricter validators back on in `AUTH_PASSWORD_VALIDATORS`
  if you want them.
- Tokens are JWT access tokens valid for 7 days (see `SIMPLE_JWT` in
  settings). There's no refresh-token flow wired up on the frontend — same
  simple approach as the Express version.
