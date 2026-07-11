from django.contrib.auth import authenticate
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, Post, Comment, Follow
from .serializers import (
    RegisterSerializer, UserProfileSerializer, PostSerializer, CommentSerializer,
)


def issue_token(user):
    # Blob only needs a single long-lived token, so we hand back the access token only
    # (mirrors the simple JWT shape the Express backend uses).
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token)


# ---------- health ----------
@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"ok": True, "message": "Mini Social Django backend is bouncing! 🎉"})


# ---------- auth ----------
@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if not serializer.is_valid():
        first_error = next(iter(serializer.errors.values()))[0]
        return Response({"error": str(first_error)}, status=status.HTTP_400_BAD_REQUEST)
    user = serializer.save()
    token = issue_token(user)
    return Response(
        {"token": token, "user": UserProfileSerializer(user, context={"request": request}).data},
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get("username")
    password = request.data.get("password")
    if not username or not password:
        return Response({"error": "Username and password are required."}, status=400)

    user = User.objects.filter(Q(username__iexact=username) | Q(email__iexact=username)).first()
    if not user or not user.check_password(password):
        return Response({"error": "Incorrect username or password."}, status=401)

    token = issue_token(user)
    return Response({"token": token, "user": UserProfileSerializer(user, context={"request": request}).data})


# ---------- users ----------
@api_view(["GET"])
@permission_classes([AllowAny])
def user_list(request):
    search = (request.query_params.get("search") or "").strip()
    qs = User.objects.all()
    if search:
        qs = qs.filter(username__icontains=search).order_by("username")[:20]
    else:
        qs = qs.order_by("-date_joined")[:20]
    return Response(UserProfileSerializer(qs, many=True, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def user_detail(request, username):
    user = User.objects.filter(username=username).first()
    if not user:
        return Response({"error": "That user doesn't seem to exist."}, status=404)
    return Response(UserProfileSerializer(user, context={"request": request}).data)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_me(request):
    user = request.user
    for field in ("bio", "avatar_emoji", "avatar_color"):
        if field in request.data:
            setattr(user, field, request.data[field])
    user.save()
    return Response(UserProfileSerializer(user, context={"request": request}).data)


# ---------- posts ----------
@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def post_list_create(request):
    if request.method == "POST":
        if not request.user or not request.user.is_authenticated:
            return Response({"error": "You need to log in first! 🔒"}, status=401)
        content = (request.data.get("content") or "").strip()
        if not content:
            return Response({"error": "Your post can't be empty!"}, status=400)
        if len(content) > 500:
            return Response({"error": "Keep it under 500 characters, chatterbox! 😄"}, status=400)
        post = Post.objects.create(author=request.user, content=content)
        return Response(PostSerializer(post, context={"request": request}).data, status=201)

    username = request.query_params.get("username")
    feed = request.query_params.get("feed")
    viewer = request.user if request.user and request.user.is_authenticated else None

    if username:
        author = User.objects.filter(username=username).first()
        if not author:
            return Response({"error": "That user doesn't seem to exist."}, status=404)
        qs = Post.objects.filter(author=author)
    elif feed == "following" and viewer:
        following_ids = list(Follow.objects.filter(follower=viewer).values_list("following_id", flat=True))
        following_ids.append(viewer.id)
        qs = Post.objects.filter(author_id__in=following_ids)
    else:
        qs = Post.objects.all()[:100]

    return Response(PostSerializer(qs, many=True, context={"request": request}).data)


@api_view(["GET", "DELETE"])
@permission_classes([AllowAny])
def post_detail(request, post_id):
    post = Post.objects.filter(id=post_id).first()
    if not post:
        return Response({"error": "That post doesn't exist (maybe it got deleted?)."}, status=404)

    if request.method == "DELETE":
        if not request.user or not request.user.is_authenticated:
            return Response({"error": "You need to log in first! 🔒"}, status=401)
        if post.author_id != request.user.id:
            return Response({"error": "You can only delete your own posts."}, status=403)
        post.delete()
        return Response({"deleted": True})

    return Response(PostSerializer(post, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def toggle_like(request, post_id):
    post = Post.objects.filter(id=post_id).first()
    if not post:
        return Response({"error": "That post doesn't exist."}, status=404)

    existing = post.likes.filter(user=request.user).first()
    if existing:
        existing.delete()
        liked = False
    else:
        post.likes.create(user=request.user)
        liked = True

    return Response({"liked": liked, "like_count": post.likes.count()})


# ---------- comments ----------
@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def comments_for_post(request, post_id):
    post = Post.objects.filter(id=post_id).first()
    if not post:
        return Response({"error": "That post doesn't exist."}, status=404)

    if request.method == "POST":
        if not request.user or not request.user.is_authenticated:
            return Response({"error": "You need to log in first! 🔒"}, status=401)
        content = (request.data.get("content") or "").strip()
        if not content:
            return Response({"error": "Your comment can't be empty!"}, status=400)
        if len(content) > 300:
            return Response({"error": "Keep comments under 300 characters."}, status=400)
        comment = Comment.objects.create(post=post, author=request.user, content=content)
        return Response(CommentSerializer(comment, context={"request": request}).data, status=201)

    return Response(CommentSerializer(post.comments.all(), many=True, context={"request": request}).data)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_comment(request, comment_id):
    comment = Comment.objects.filter(id=comment_id).first()
    if not comment:
        return Response({"error": "That comment doesn't exist."}, status=404)
    if comment.author_id != request.user.id:
        return Response({"error": "You can only delete your own comments."}, status=403)
    comment.delete()
    return Response({"deleted": True})


# ---------- follow ----------
@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
def follow_toggle(request, username):
    target = User.objects.filter(username=username).first()
    if not target:
        return Response({"error": "That user doesn't seem to exist."}, status=404)

    if request.method == "POST":
        if target.id == request.user.id:
            return Response({"error": "You can't follow yourself, silly! 😄"}, status=400)
        Follow.objects.get_or_create(follower=request.user, following=target)
        return Response({"following": True, "follower_count": target.follower_links.count()})

    Follow.objects.filter(follower=request.user, following=target).delete()
    return Response({"following": False, "follower_count": target.follower_links.count()})
