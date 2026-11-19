# Setup

About ten minutes for each person. Do this once, then use the group.

The assignment below is **editable**. If a bot moves to someone else, change this table. The roles do not move: Reader, then Verifier, then Writer.

| Person | Role | Bot | Profile to create |
| --- | --- | --- | --- |
| Ilkham | Reader | `@hermesispartnerbot` | `sanity-reader` |
| Konstantin | Verifier | `@koni_master_hermes_bot` (Docker) | `sanity-verifier` |
| Lloyd | Writer | `@sanitywriterbot` | `sanity-writer` |

The handles are for people. Bots never use them: they address each other by role, with `sanity run=<slug> to=<role>` ([skills/sanity-protocol/SKILL.md](../skills/sanity-protocol/SKILL.md)).

## Checklist

Do these in order for your own row.

1. Install [Hermes Agent](https://hermes-agent.nousresearch.com/) and Python 3. Clone this repo, or pull if you already have it.
2. Run the setup script from the repo root. It pulls, creates a virtualenv, installs `agents/verifier/requirements.txt` (SymPy, used by the Verifier's checks), and copies `hermes/<role>/` into the Hermes profile directory.

   macOS or Linux:

   ```bash
   HERMES_PROFILE_DIR="$HOME/.hermes/profiles/sanity-reader" bash scripts/setup_bot.sh reader
   ```

   Windows (PowerShell):

   ```powershell
   $env:HERMES_PROFILE_DIR = "$env:USERPROFILE\.hermes\profiles\sanity-reader"
   .\scripts\setup_bot.ps1 reader
   ```

   Swap `reader` for `verifier` or `writer`, and the profile folder name to match your row. `HERMES_PROFILE_DIR` is a placeholder path: point it at the profile you want Hermes to use.

3. In [@BotFather](https://t.me/BotFather), send `/setprivacy`, choose your bot, and choose **Disable**. Also switch on **Bot-to-Bot Communication Mode** for the bot, so it sees the other bots' messages.
4. Remove the bot from the group and add it again. Privacy mode does not flip for a bot that is already in the group.
5. **Lloyd The Hermes** still shows "has no access to messages". Privacy must be disabled for that bot, then it has to be removed and added again. Check the other two bots for the same line. If the line is still there, privacy is still on.
6. Get each teammate's numeric Telegram user ID (for example from @userinfobot), the IDs of the two other bots, and the group's ID. Put them all in the profile `.env` as `TELEGRAM_ALLOWED_USERS`, comma-separated, and replace the placeholders in the copied `config.yaml`. Without the bot IDs, bot-to-bot messages are blocked. Do not leave the bot open to every account.
7. Put the BotFather token in the profile environment as `TELEGRAM_BOT_TOKEN`. Do not commit it. A handy name on your machine, matching the role, is `READER_TELEGRAM_TOKEN`, `VERIFIER_TELEGRAM_TOKEN`, or `WRITER_TELEGRAM_TOKEN`.
8. Replace `${SANITY_REPO}` in the copied config with the absolute path of this clone. Copy `agents/<role>/AGENT.md` is already done by the script: it is the profile `SOUL.md`.
9. Configure the bot for the message protocol, with the three people's Telegram IDs as approvers:

   ```bash
   APPROVERS=<id>,<id>,<id> bash scripts/configure_bot.sh reader     # or writer, verifier
   ```

   It loads `skills/verify-math` and `skills/sanity-protocol`, sets the `to=<role>` wake word, mention-only, the group target, the loop guard and the approvers, refreshes running sessions, restarts the gateway, and ends with a check (`bash scripts/configure_bot.sh check <role>` runs the check alone). See [docs/handoff.md](handoff.md) and [docs/telegram.md](telegram.md).

The Verifier runs in Docker with SymPy and Lean inside the container: see [docs/setup-verifier-docker.md](setup-verifier-docker.md) (`setup_verifier_docker.sh install`, `lean`, `configure`). Do not build Mathlib in CI. SymPy is enough for the specimen in `runs/example-oscillator/`.

## One shared host (optional)

Use this only if the team wants **one** Lean toolchain. Otherwise each person runs their own bot, and the Telegram group is the shared state. That is the default, and it is enough.

If you do want one machine to run all three Hermes bots, plus Lean and SymPy:

1. Install [Tailscale](https://tailscale.com/download) on that host and on each laptop.
2. On each machine, `tailscale up` and join the same tailnet.
3. Share the host (Tailscale share, or an invite to the tailnet) so Ilkham, Konstantin, and Lloyd can see it.
4. From a laptop, SSH to the host's MagicDNS name (`ssh <user>@<host>.<tailnet>.ts.net`).
5. On the host, run the setup script three times, once per role, with three profile directories. Run three gateways. Lean and SymPy stay on that host.

The laptops do not need elan. The bots still talk only through the Telegram group. Tailscale is only the path to the shared toolchain.
