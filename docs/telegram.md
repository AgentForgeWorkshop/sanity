# Telegram

Three people and three Hermes bots share one Telegram group. One bot per role: Reader, Verifier, Writer. The group is where the humans watch and steer, and it is also the bus the bots use to hand work to each other: messages addressed by role (`sanity run=<slug> to=<role>`), files as attachments. See [docs/handoff.md](handoff.md) and [skills/sanity-protocol/SKILL.md](../skills/sanity-protocol/SKILL.md).

Who holds which bot is in [docs/setup.md](setup.md). That assignment is editable.

## Who is in the group

| | Role |
| --- | --- |
| Reader bot | Extracts the equations and sends `equations.json` to the Verifier. |
| Verifier bot | Checks each claim (SymPy, numerics, Lean) and sends `verdicts.json` and an evidence bundle to the Writer. Posts its plan and a time estimate first. |
| Writer bot | Writes `REPORT.md` and a short summary, posted with `status=done`. Does not change a verdict. |
| Three people | Send a paper to the Reader, answer questions, approve commands a bot asks about, and send `stop`, `rerun` or `status` to a bot. |

Each agent is its own bot. Create three bots with [@BotFather](https://t.me/BotFather). One token per bot. Do not reuse a token across agents.

## Step-by-step guide
### Set up a Telegram account for each bot
1. Go to @BotFather and type /newbot. Follow the procedure and give each a telegram an account name.
2. Record the API Token for each bot.
3. Go to @id_bot and record your own Telegram ID, and IDs of each bot account
4. Go to @BotFather and type /mybot. Set each bot account's GroupMode to On, GroupPrivacyMode to off, and Bot-to-Bot Communication Mode to on.
5. Create a group for yourself and all the bots. Find the ID of the group from @id_bot.

#### Note on Privacy mode 

In BotFather, disable privacy mode for each bot: `/setprivacy`, choose the bot, **Disable**.

Then remove that bot from the group and add it again. Telegram keeps the old privacy setting until the bot is re-added.

With privacy mode on, a bot in a group only sees commands, replies to itself, and mentions, and the client can show that the bot has no access to messages. The humans' steering messages would be invisible. Privacy mode off delivers human messages to every bot. One bot's messages reach another bot only with Bot-to-Bot Communication Mode on (Telegram, since 2026-05).

If a bot still shows "has no access to messages" after the change, privacy is still on. Disable it again and re-add the bot. [docs/setup.md](setup.md) calls this out for the Writer bot, which has been seen in that state.

### Setup for the bots

Go to each bot's Telegram setting (usually through `hermes (-p bot_profile) gateway setup`. Do the following:
1. When prompted to do it Automatically or Manually, choose Manual
2. Paste the Telegram API Token for bot. DO NOT SHARE API Token between bots. Each API Token can only be tied to one bot.
3. In Allow User IDs (which sets `TELEGRAM_ALLOWED_USERS` in `.env`), put all IDs recorded for each bot, put and your own Telegram ID (comma-separated list), and the group chat ID.
  - Alternative, you can put these IDS directly in `TELEGRAM_ALLOWED_USERS` in `.env` of your bot. Remember to restart the gateway to make this valid.
