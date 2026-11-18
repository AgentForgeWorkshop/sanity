# Verifier bot in Docker

How to run the Sanity Verifier as a Hermes Agent bot inside Docker, with the
Telegram-only setup. Everything runs inside the container, on its data volume.
The host's Python is never used.

## Layout inside the container

| Path | What |
|---|---|
| `/opt/data/sanity/` | clone of this repo, checked out at a branch or tag. Read-only for the bot. |
| `/opt/data/sanity-venv/` | Python environment with SymPy and jsonschema, for the checks |
| `/opt/data/sanity-verifier/scratch/` | the bot's working folder (`terminal.cwd`): one run per `<slug>/<attempt>/`, plus `sanity.env` |
| `/opt/data/SOUL.md` | the bot's persona: a copy of `agents/verifier/AGENT.md` |
| `/opt/data/config.yaml` | `terminal.cwd`, `skills.external_dirs: [/opt/data/sanity/skills]`, `skills.auto_load: [verify-math]` |
| `/opt/data/.env` | `SANITY_REPO`, `SANITY_PYTHON`, plus your Telegram and model settings |

All of it is on the `hermes-data` volume, so it survives container restarts and
image updates.

## Before you start (Telegram, by hand)

Follow [docs/telegram.md](telegram.md). For the Verifier specifically:

1. In @BotFather: group privacy **off**, and **Bot-to-Bot Communication Mode on**
   (needed since 2026-05: bots only see other bots' messages with it).
2. `TELEGRAM_ALLOWED_USERS` in the container's `/opt/data/.env` lists Ilkham,
   Konstantin, Lloyd, the Reader bot, the Writer bot and the group. Without the
   bot IDs, the gateway blocks handoffs ("Blocked unauthorized user" in the log).
3. The bot is in the group, and was re-added after changing the privacy setting.

## Setup

From a clone of this repo on the host, with the container running:

```bash
bash scripts/setup_verifier_docker.sh install     # clone, Python env, scratch folder
bash scripts/setup_verifier_docker.sh selftest    # example run inside the container
bash scripts/setup_verifier_docker.sh configure   # persona, skill, cwd, env; backs up and restarts
bash scripts/setup_verifier_docker.sh status
```

`configure` first copies `SOUL.md`, `config.yaml` and `.env` to
`*.bak-<time>`. To undo it, copy the backups back and run
`docker restart hermes`. Settings: `HERMES_CONTAINER` (default `hermes`) and
`SANITY_REF` (default `main`).

## Updating

When the Verifier code or instructions change on `main`:

```bash
bash scripts/setup_verifier_docker.sh update      # pull the code
bash scripts/setup_verifier_docker.sh selftest
bash scripts/setup_verifier_docker.sh configure   # only if AGENT.md changed (re-copies the persona)
```

The skill is read directly from the clone, so it updates with `update`. The
persona is a copy, so it needs `configure`. The bot never updates its own code
or instructions.

## Smoke test

[agents/verifier/smoke/](../agents/verifier/smoke/README.md) has a four-claim
`equations.json`, the message to send with it, and the expected results.

## Notes

- The bot only runs while the host is awake (a laptop Docker setup). Runs wait
  for it otherwise.
- Hermes gives each sender in a group its own session
  (`group_sessions_per_user: true`). The Verifier keeps each run's state in its
  scratch folder (`intake.py status`), not in chat memory, so this is fine.
- Scratch folders may be wiped at any time. The evidence bundle posted in the
  group is the lasting record.
