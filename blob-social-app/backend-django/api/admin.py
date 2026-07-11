from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User, Post, Comment, Like, Follow


@admin.register(User)
class BlobUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("Blob profile", {"fields": ("bio", "avatar_emoji", "avatar_color")}),
    )
    list_display = ("username", "email", "bio", "avatar_emoji", "is_staff")


admin.site.register(Post)
admin.site.register(Comment)
admin.site.register(Like)
admin.site.register(Follow)
