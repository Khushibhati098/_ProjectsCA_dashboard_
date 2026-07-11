from django.urls import path
from . import views

urlpatterns = [
    path("health", views.health),

    path("auth/register", views.register),
    path("auth/login", views.login_view),

    path("users", views.user_list),
    path("users/me/update", views.update_me),
    path("users/<str:username>", views.user_detail),

    path("posts", views.post_list_create),
    path("posts/<int:post_id>", views.post_detail),
    path("posts/<int:post_id>/like", views.toggle_like),

    path("comments/post/<int:post_id>", views.comments_for_post),
    path("comments/<int:comment_id>", views.delete_comment),

    path("follow/<str:username>", views.follow_toggle),
]
