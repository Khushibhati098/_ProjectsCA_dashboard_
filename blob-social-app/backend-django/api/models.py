import random
from django.contrib.auth.models import AbstractUser
from django.db import models

EMOJI_CHOICES = ["🐸", "🦊", "🐼", "🐙", "🦄", "🐝", "🐨", "🦋", "🐢", "🐣", "🌈", "🍄"]
COLOR_CHOICES = ["#FFB3C7", "#FFD93D", "#8CE7C1", "#B8A6FF", "#FF9F6B", "#7FDBFF"]


def random_emoji():
    return random.choice(EMOJI_CHOICES)


def random_color():
    return random.choice(COLOR_CHOICES)



class User(AbstractUser):
    """Custom user model — adds the bits Blob needs on top of Django's built-in auth."""
    bio = models.CharField(max_length=160, blank=True, default="")
    avatar_emoji = models.CharField(max_length=8, default=random_emoji)
    avatar_color = models.CharField(max_length=8, default=random_color)

    def __str__(self):
        return self.username


class Post(models.Model):
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="posts")
    content = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.author.username}: {self.content[:30]}"


class Comment(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="comments")
    content = models.CharField(max_length=300)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"comment by {self.author.username} on post {self.post_id}"


class Like(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="likes")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("post", "user")


class Follow(models.Model):
    follower = models.ForeignKey(User, on_delete=models.CASCADE, related_name="following_links")
    following = models.ForeignKey(User, on_delete=models.CASCADE, related_name="follower_links")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("follower", "following")
