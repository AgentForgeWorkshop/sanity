# Telegram

Three Hermes agents and three people share one Telegram group. The group is where the humans watch and steer. It is not the bus the agents use to hand work to each other.

## Who is in the group

| | Role |
| --- | --- |
| Reader bot | Posts extracted equations: number, line, source. |
| Checker bot | Posts SymPy flags, then Lean results for those flags. |
| Judge bot | Posts a ruling. Quotes the equation and the line. Says Lean-verified when Lean settled it. |
| Three people | Read the thread. Approve, reject, skip a section, or ask for a step to be run again. |

Each agent is its own bot. Create three bots with [@BotFather](https://t.me/BotFather). One token per bot. Do not reuse a token across agents.

## Privacy mode off

In BotFather, disable privacy mode for each bot (`/setprivacy` → Disable).

With privacy mode on, a bot in a group only sees commands, replies to itself, and mentions. The humans' steering messages would be invisible to the bots. Privacy mode off delivers human messages to every bot.

## Bots cannot see other bots

Turning privacy mode off does not change this. In a group, the Bot API does not deliver one bot's messages to another bot. The Reader's post never arrives at the Checker. The Checker's flag never arrives at the Judge. The group transcript is for the people.

## The server hands work across

A small orchestration server is the only place an agent learns that the previous agent finished.

1. The Reader extracts equations and sends the list to the server. It also posts a short note in the group so the humans can see it.
2. The server gives that list to the Checker. The Checker screens every equation with SymPy. For each flag, it asks an LLM for a Lean 4 + Mathlib statement, runs Lean, and returns the result to the server.
3. The server gives the flags and the Lean results to the Judge. The Judge confirms or rejects each one, quotes the equation and the line, and marks Lean-verified when Lean proved or refuted the claim.
4. Each bot posts its own ruling into the group. People reply in the group. The server reads those human messages (privacy mode is off) and turns them into the next task: drop a flag, re-check a line, stop.

No agent should scrape the group for another agent's text. The server stores the artifact and calls the next agent with it.

## Tokens

Keep the three BotFather tokens out of the repository. One environment variable per bot is enough for a later implementation: `READER_TELEGRAM_TOKEN`, `CHECKER_TELEGRAM_TOKEN`, `JUDGE_TELEGRAM_TOKEN`. This skeleton does not call Telegram.
