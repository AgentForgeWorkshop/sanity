# Hermes profiles

One example profile per role. Nothing here is a live bot. There are no tokens.

| Directory | Role prompt the setup script installs as `SOUL.md` | Skill |
| --- | --- | --- |
| `hermes/reader/` | `agents/reader/AGENT.md` | `skills/verify-math`, `skills/sanity-protocol` |
| `hermes/verifier/` | `agents/verifier/AGENT.md` | `skills/verify-math`, `skills/sanity-protocol` |
| `hermes/writer/` | `agents/writer/AGENT.md` | `skills/verify-math`, `skills/sanity-protocol` |

Set a bot up with one command: `APPROVERS=<id>,<id>,<id> bash scripts/configure_bot.sh <role>`
(the three people's Telegram IDs: any of them may approve the bot's commands, no bot can)
(add `HERMES_CONTAINER=<name>` for Docker, `HERMES_PROFILE=<name>` for a profile).

All three load `sanity-protocol`, the shared message protocol (headers, `to=<role>`
addressing, `NO_REPLY`, attachments). Each bot's `.env` needs its own role wake word
(`TELEGRAM_MENTION_PATTERNS`); see `env.example` and section 6 of the skill.

`config.yaml` points `terminal.cwd` at `${SANITY_REPO}` and loads the skill with `skills.external_dirs` and `skills.auto_load`. `env.example` lists the environment names. Replace the placeholders after copying. See [docs/setup.md](../docs/setup.md).
