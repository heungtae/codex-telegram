import subprocess
import tempfile
import unittest
from pathlib import Path

from utils.approval_policy import build_approval_policy_context, match_approval_policy


class ApprovalPolicyTests(unittest.TestCase):
    def test_build_context_collects_questions_options_and_metadata(self):
        payload = {
            "method": "item/tool/requestUserInput",
            "params": {
                "reason": "Tool requires network access",
                "commandText": "curl https://example.com/data.json",
                "paths": ["service/pom.xml"],
                "questions": [
                    {
                        "question": "Allow network access?",
                        "options": [
                            {"label": "Approve Once", "description": "Allow once."},
                            {"label": "Deny"},
                        ],
                    }
                ],
            },
        }

        context = build_approval_policy_context(payload)

        self.assertEqual("item/tool/requestUserInput", context["method"])
        self.assertEqual("Tool requires network access", context["reason"])
        self.assertEqual("Allow network access?", context["question"])
        self.assertIn("Approve Once", context["options"])
        self.assertEqual("curl https://example.com/data.json", context["command_text"])
        self.assertIn("service/pom.xml", context["touched_paths"])

    def test_command_rule_can_deny_dangerous_command(self):
        payload = {
            "method": "item/tool/requestUserInput",
            "params": {
                "commandText": "rm -rf /tmp/demo",
                "questions": [{"question": "Run destructive cleanup?"}],
            },
        }
        context = build_approval_policy_context(payload)
        rules = [
            {
                "name": "block rm rf",
                "enabled": True,
                "action": "deny",
                "priority": 200,
                "command_any": ["rm -rf"],
            }
        ]

        match = match_approval_policy(context, rules)

        self.assertIsNotNone(match)
        self.assertEqual("deny", match.action)
        self.assertEqual("block rm rf", match.rule_name)

    def test_path_rule_can_require_manual_fallback_for_protected_files(self):
        payload = {
            "method": "item/tool/requestUserInput",
            "params": {
                "paths": ["service/pom.xml", "helm/app/values.yaml"],
            },
        }
        context = build_approval_policy_context(payload)
        rules = [
            {
                "name": "protected build files",
                "enabled": True,
                "action": "manual_fallback",
                "priority": 150,
                "path_any": ["pom.xml"],
            }
        ]

        match = match_approval_policy(context, rules)

        self.assertIsNotNone(match)
        self.assertEqual("manual_fallback", match.action)

    def test_change_scale_rule_uses_workspace_git_status(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            proc = subprocess.run(
                ["git", "init"],
                cwd=tmpdir,
                check=False,
                capture_output=True,
                text=True,
            )
            if proc.returncode != 0:
                self.skipTest("git is not available")

            for idx in range(21):
                Path(tmpdir, f"file-{idx}.txt").write_text("x", encoding="utf-8")

            context = build_approval_policy_context({"method": "item/tool/requestUserInput", "params": {}}, tmpdir)
            rules = [
                {
                    "name": "large change set",
                    "enabled": True,
                    "action": "manual_fallback",
                    "priority": 120,
                    "max_changed_files": 20,
                }
            ]

            match = match_approval_policy(context, rules)

            self.assertEqual(21, context["changed_file_count"])
            self.assertIsNotNone(match)
            self.assertEqual("manual_fallback", match.action)

    def test_quality_rule_can_block_merge_on_lint_failure(self):
        payload = {
            "method": "item/tool/requestUserInput",
            "params": {
                "commandText": "prepare merge candidate",
                "lintFailed": True,
            },
        }
        context = build_approval_policy_context(payload)
        rules = [
            {
                "name": "block merge with lint failure",
                "enabled": True,
                "action": "deny",
                "priority": 130,
                "command_any": ["merge"],
                "require_lint_failed": True,
            }
        ]

        match = match_approval_policy(context, rules)

        self.assertIsNotNone(match)
        self.assertEqual("deny", match.action)

    def test_coverage_rule_can_escalate_when_drop_exceeds_threshold(self):
        payload = {
            "method": "item/tool/requestUserInput",
            "params": {
                "coverageDrop": 3.5,
            },
        }
        context = build_approval_policy_context(payload)
        rules = [
            {
                "name": "coverage drop escalation",
                "enabled": True,
                "action": "manual_fallback",
                "priority": 110,
                "coverage_drop_gt": 2.0,
            }
        ]

        match = match_approval_policy(context, rules)

        self.assertIsNotNone(match)
        self.assertEqual("manual_fallback", match.action)

    def test_legacy_text_rules_still_work(self):
        payload = {
            "method": "item/tool/requestUserInput",
            "params": {
                "questions": [{"question": "Allow network access for git fetch?"}],
            },
        }
        context = build_approval_policy_context(payload)
        rules = [
            {
                "name": "git access",
                "enabled": True,
                "action": "approve",
                "priority": 50,
                "match_question_any": ["git"],
            },
            {
                "name": "network access",
                "enabled": True,
                "action": "deny",
                "priority": 100,
                "match_question_any": ["network"],
            },
        ]

        match = match_approval_policy(context, rules)

        self.assertIsNotNone(match)
        self.assertEqual("network access", match.rule_name)
        self.assertEqual("deny", match.action)

    def test_git_access_command_any_rule_matches_command_execution_reason(self):
        payload = {
            "method": "item/commandExecution/requestApproval",
            "params": {
                "reason": "Do you want me to stage all current changes so I can create the requested git commit?",
            },
        }
        context = build_approval_policy_context(payload)
        rules = [
            {
                "name": "git access",
                "enabled": True,
                "action": "approve",
                "priority": 150,
                "match_method": ["item/tool/*", "item/commandExecution/requestApproval"],
                "command_any": ["git", "repository", "commit", "branch", "push", "pull", "stage all current changes"],
            }
        ]

        match = match_approval_policy(context, rules)

        self.assertIsNotNone(match)
        self.assertEqual("git access", match.rule_name)
        self.assertEqual("approve", match.action)

    def test_workspace_and_network_rules_remain_tool_request_scoped(self):
        payload = {
            "method": "item/commandExecution/requestApproval",
            "params": {
                "reason": "Allow network access for git fetch in workspace?",
            },
        }
        context = build_approval_policy_context(payload)
        rules = [
            {
                "name": "workspace file access",
                "enabled": True,
                "action": "approve",
                "priority": 140,
                "match_method": ["item/tool/*"],
                "match_question_any": ["workspace", "file", "read file", "write file", "edit file"],
            },
            {
                "name": "network access",
                "enabled": True,
                "action": "deny",
                "priority": 240,
                "match_method": ["item/tool/*"],
                "match_question_any": ["network", "internet", "http", "https", "download", "fetch", "browse"],
            },
        ]

        match = match_approval_policy(context, rules)

        self.assertIsNone(match)


if __name__ == "__main__":
    unittest.main()
