import asyncio
import unittest

from web.runtime import WebEventHub, WebSessionManager


class WebRuntimeTests(unittest.IsolatedAsyncioTestCase):
    async def test_session_manager_create_and_get(self):
        mgr = WebSessionManager()
        session = await mgr.create("admin", ttl_seconds=120)
        fetched = await mgr.get(session.token)
        self.assertIsNotNone(fetched)
        self.assertEqual("admin", fetched.username)

    async def test_event_hub_publish_and_subscribe(self):
        hub = WebEventHub()
        queue = await hub.subscribe(-1)
        try:
            await hub.publish_event(-1, {"type": "turn_delta", "text": "hello"})
            item = await asyncio.wait_for(queue.get(), timeout=0.2)
            self.assertEqual("turn_delta", item["type"])
            self.assertEqual("hello", item["text"])
        finally:
            await hub.unsubscribe(-1, queue)

    async def test_add_approval_replaces_existing_pending_item(self):
        hub = WebEventHub()

        await hub.add_approval(1, 10, {"id": 10, "type": "approval_required"})
        await hub.add_approval(1, 11, {"id": 11, "type": "approval_required"})

        pending = await hub.list_approvals(1)

        self.assertEqual([{"id": 11, "type": "approval_required"}], pending)

    async def test_active_subagent_registry_upsert_and_remove(self):
        hub = WebEventHub()

        changed = await hub.upsert_active_subagent(
            7,
            {
                "thread_id": "thread-sub-1",
                "name": "atlas",
                "role": "explorer",
                "status": "active",
                "source_kind": "subAgentThreadSpawn",
                "parent_thread_id": "thread-parent",
                "turn_id": "turn-1",
                "item_id": "item-1",
            },
        )
        self.assertTrue(changed)

        items = await hub.list_active_subagents(7)
        self.assertEqual(1, len(items))
        self.assertEqual("thread-sub-1", items[0]["thread_id"])
        self.assertEqual("atlas", items[0]["name"])
        self.assertEqual("explorer", items[0]["role"])

        removed = await hub.remove_active_subagent(7, "thread-sub-1")
        self.assertTrue(removed)
        self.assertEqual([], await hub.list_active_subagents(7))

    async def test_active_subagent_registry_clear_by_turn(self):
        hub = WebEventHub()

        await hub.upsert_active_subagent(
            7,
            {
                "thread_id": "thread-sub-1",
                "name": "atlas",
                "role": "explorer",
                "status": "active",
                "source_kind": "subAgentThreadSpawn",
                "parent_thread_id": "thread-parent",
                "turn_id": "turn-1",
                "item_id": "item-1",
            },
        )
        await hub.upsert_active_subagent(
            7,
            {
                "thread_id": "thread-sub-2",
                "name": "nova",
                "role": "review",
                "status": "active",
                "source_kind": "subAgentThreadSpawn",
                "parent_thread_id": "thread-parent",
                "turn_id": "turn-2",
                "item_id": "item-2",
            },
        )

        changed = await hub.clear_active_subagents_by_turn(7, "turn-1")

        self.assertTrue(changed)
        self.assertEqual(
            [{"thread_id": "thread-sub-2", "status": "active", "name": "nova", "role": "review", "source_kind": "subAgentThreadSpawn", "parent_thread_id": "thread-parent", "turn_id": "turn-2", "item_id": "item-2"}],
            await hub.list_active_subagents(7),
        )


if __name__ == "__main__":
    unittest.main()
