# ================================================================
# 📂 system_log/consumers.py
# 🛰️ Primey Care - System Log Live Consumer
# ================================================================

from __future__ import annotations

import json

from channels.generic.websocket import AsyncWebsocketConsumer


class SystemLogConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        """
        يدعم مسارين:
        - system stream
        - company stream by company_reference
        """
        self.scope_type = self.scope["url_route"]["kwargs"].get("scope_type", "system")
        self.company_reference = self.scope["url_route"]["kwargs"].get("company_reference", "")

        if self.scope_type == "company" and self.company_reference:
            safe_ref = str(self.company_reference).replace(" ", "_")
            self.room_group_name = f"system_log_company_{safe_ref}"
        else:
            self.room_group_name = "system_log_system"

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name,
        )

        await self.accept()

        await self.send(
            text_data=json.dumps(
                {
                    "type": "connected",
                    "message": "🟢 Connected to System Log Live Stream",
                    "scope_type": self.scope_type,
                    "company_reference": self.company_reference,
                }
            )
        )

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name,
        )

    async def stream_log(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "log",
                    "id": event.get("id"),
                    "module": event.get("module"),
                    "action": event.get("action"),
                    "severity": event.get("severity"),
                    "message": event.get("message"),
                    "created_at": event.get("created_at"),
                    "user": event.get("user"),
                    "company_reference": event.get("company_reference", ""),
                    "company_name": event.get("company_name", ""),
                    "status_code": event.get("status_code"),
                }
            )
        )