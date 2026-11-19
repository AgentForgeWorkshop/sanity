"""The shared protocol (skills/sanity-protocol) and the bots' settings agree.

Every header in the protocol's message table wakes exactly the bot it addresses
(`to=<role>`), and status/done messages wake none. All three bots load the skill.
"""

import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
SKILL = REPO / "skills" / "sanity-protocol" / "SKILL.md"
ROLES = ("reader", "verifier", "writer")


def wake_word(role: str) -> re.Pattern:
    text = (REPO / "hermes" / role / "env.example").read_text(encoding="utf-8")
    value = re.search(r"^TELEGRAM_MENTION_PATTERNS=(.+)$", text, re.M).group(1)
    return re.compile(value, re.I)  # Hermes compiles its patterns case-insensitively


def table_headers() -> list[str]:
    section = SKILL.read_text(encoding="utf-8").split("## 3. The messages")[1].split("## 4.")[0]
    headers = []
    for row in section.splitlines():
        if not row.startswith("| ") or row.startswith("| #"):
            continue
        cells = [c.strip() for c in row.strip("|").split("|")]
        headers += [h for h in re.findall(r"`(sanity run=[^`]+)`", cells[2])]
    return headers


def test_skill_has_frontmatter_name():
    assert SKILL.read_text(encoding="utf-8").startswith("---\nname: sanity-protocol\n")


def test_every_table_header_wakes_exactly_its_role():
    headers = table_headers()
    assert len(headers) >= 9
    patterns = {role: wake_word(role) for role in ROLES}
    for header in headers:
        target = re.search(r"\bto=(\w+)", header)
        woken = {role for role, p in patterns.items() if p.search(header)}
        if target:
            assert woken == {target.group(1)}, (header, woken)
        else:
            assert woken == set(), (header, woken)


@pytest.mark.parametrize("text", [
    "please send this to=verifier",           # no sanity header
    "sanity run=x status=done attempt=1",     # done message
    "NO_REPLY",
])
def test_plain_text_and_status_wake_nobody(text):
    assert not any(wake_word(role).search(text) for role in ROLES)


@pytest.mark.parametrize("role", ROLES)
def test_every_bot_loads_the_protocol_and_sets_the_loop_guard(role):
    config = (REPO / "hermes" / role / "config.yaml").read_text(encoding="utf-8")
    assert "- sanity-protocol" in config
    if role != "verifier":  # the Verifier's loop guard is set by scripts/setup_verifier_docker.sh
        assert "bot_replies_expect_reply: true" in config and "max_hops: 8" in config


@pytest.mark.parametrize("role", ROLES)
def test_every_role_prompt_points_to_the_protocol_and_uses_no_reply(role):
    prompt = (REPO / "agents" / role / "AGENT.md").read_text(encoding="utf-8")
    assert "sanity-protocol" in prompt
    assert "NO_REPLY" in prompt
