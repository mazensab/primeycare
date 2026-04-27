# ============================================================
# 📂 notification_center/consumers.py
# 🧠 Primey Care - Notification Consumer
# ------------------------------------------------------------
# ✅ ملف اختياري للمستقبل
# ✅ لا يتم تحميله تلقائيًا من apps.py
# ✅ يمكن استخدامه لاحقًا لو تم تفعيل Channels/WebSocket
# ============================================================

from __future__ import annotations

import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from notification_center.models import Notification


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")

        if not user or user.is_anonymous:
            await self.close()
            return

        self.user = user
        self.group_name = f"user_{user.id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        await self.send_initial_unread()

    async def disconnect(self, close_code):
        if getattr(self, "group_name", None):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data or "{}")
        except Exception:
            data = {}

        if data.get("action") == "mark_read":
            notification_id = data.get("id")
            if notification_id:
                await self.mark_as_read(notification_id)
                await self.send_json({"status": "ok"})

    async def send_initial_unread(self):
        unread = await self.get_latest_unread()
        count = await self.get_unread_count()

        await self.send_json(
            {
                "type": "init",
                "unread_count": count,
                "unread": unread,
            }
        )

    async def send_notification(self, event):
        payload = (event or {}).get("data", {})
        notification = payload.get("notification")

        if not notification:
            return

        unread_count = await self.get_unread_count()

        await self.send_json(
            {
                "type": "new",
                "notification": notification,
                "unread_count": unread_count,
            }
        )

    @database_sync_to_async
    def get_latest_unread(self):
        notes = (
            Notification.objects
            .filter(recipient=self.user, is_read=False)
            .order_by("-created_at")[:5]
        )

        return [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "severity": n.severity,
                "created_at": n.created_at.strftime("%Y-%m-%d %H:%M"),
            }
            for n in notes
        ]

    @database_sync_to_async
    def get_unread_count(self):
        return Notification.objects.filter(
            recipient=self.user,
            is_read=False,
        ).count()

    @database_sync_to_async
    def mark_as_read(self, notification_id):
        Notification.objects.filter(
            id=notification_id,
            recipient=self.user,
        ).update(is_read=True)

    async def send_json(self, data: dict):
        await self.send(text_data=json.dumps(data, ensure_ascii=False))