import unittest

from web.thread_history import thread_turn_messages


class ThreadHistoryTests(unittest.TestCase):
    def test_thread_turn_messages_prefers_final_answer_over_commentary_in_same_turn(self):
        turns = [
            {
                "threadId": "thread-1",
                "turnId": "turn-1",
                "items": [
                    {"type": "userMessage", "content": [{"type": "text", "text": "git status"}]},
                    {
                        "type": "agentMessage",
                        "phase": "commentary",
                        "text": "요청하신 대로 확인하겠습니다.",
                    },
                    {
                        "type": "agentMessage",
                        "phase": "final_answer",
                        "text": "결과입니다.",
                    },
                ],
            }
        ]

        messages = thread_turn_messages(turns)

        self.assertEqual(
            [
                {"role": "user", "text": "git status", "thread_id": "thread-1", "turn_id": "turn-1"},
                {"role": "assistant", "text": "결과입니다.", "thread_id": "thread-1", "turn_id": "turn-1"},
            ],
            messages,
        )

    def test_thread_turn_messages_uses_turn_id_from_id_field(self):
        turns = [
            {
                "id": "turn-42",
                "threadId": "thread-42",
                "items": [
                    {"type": "userMessage", "content": [{"type": "text", "text": "q"}]},
                    {"type": "agentMessage", "phase": "final_answer", "text": "f"},
                ],
            }
        ]

        messages = thread_turn_messages(turns)

        self.assertEqual("turn-42", messages[0]["turn_id"])
        self.assertEqual("turn-42", messages[1]["turn_id"])


if __name__ == "__main__":
    unittest.main()
