from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User, Post, Comment, Like, Follow


class UserPublicSerializer(serializers.ModelSerializer):
    """Compact user info, used when a user is nested inside a post/comment."""
    class Meta:
        model = User
        fields = ["id", "username", "avatar_emoji", "avatar_color"]


class UserProfileSerializer(serializers.ModelSerializer):
    """Full profile shape — matches the Express /api/users/:username response."""
    follower_count = serializers.SerializerMethodField()
    following_count = serializers.SerializerMethodField()
    post_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()
    is_self = serializers.SerializerMethodField()

    created_at = serializers.DateTimeField(source="date_joined", read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "bio", "avatar_emoji", "avatar_color", "created_at",
            "follower_count", "following_count", "post_count", "is_following", "is_self",
        ]

    def _viewer(self):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return user if user and user.is_authenticated else None

    def get_follower_count(self, obj):
        return obj.follower_links.count()

    def get_following_count(self, obj):
        return obj.following_links.count()

    def get_post_count(self, obj):
        return obj.posts.count()

    def get_is_following(self, obj):
        viewer = self._viewer()
        if not viewer:
            return False
        return Follow.objects.filter(follower=viewer, following=obj).exists()

    def get_is_self(self, obj):
        viewer = self._viewer()
        return bool(viewer and viewer.id == obj.id)


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ["username", "email", "password"]

    def validate_username(self, value):
        if len(value) < 3:
            raise serializers.ValidationError("Username needs to be at least 3 characters.")
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("That username or email is already taken.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("That username or email is already taken.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
        )


class PostSerializer(serializers.ModelSerializer):
    author = UserPublicSerializer(read_only=True)
    like_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    liked_by_me = serializers.SerializerMethodField()
    is_own = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = ["id", "content", "created_at", "author", "like_count", "comment_count", "liked_by_me", "is_own"]

    def _viewer(self):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return user if user and user.is_authenticated else None

    def get_like_count(self, obj):
        return obj.likes.count()

    def get_comment_count(self, obj):
        return obj.comments.count()

    def get_liked_by_me(self, obj):
        viewer = self._viewer()
        if not viewer:
            return False
        return obj.likes.filter(user=viewer).exists()

    def get_is_own(self, obj):
        viewer = self._viewer()
        return bool(viewer and viewer.id == obj.author_id)


class CommentSerializer(serializers.ModelSerializer):
    author = UserPublicSerializer(read_only=True)
    post_id = serializers.IntegerField(source="post.id", read_only=True)

    class Meta:
        model = Comment
        fields = ["id", "post_id", "content", "created_at", "author"]
