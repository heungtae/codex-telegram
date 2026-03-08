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


if __name__ == "__main__":
    unittest.main()
