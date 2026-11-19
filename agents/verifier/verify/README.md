# Verifier workspace

Checks for a paper do not live in this folder. With the Telegram setup, the
Verifier keeps each run in its own scratch folder (its Hermes working
directory), one folder per attempt:

```
<scratch>/<slug>/<attempt>/
  equations.v<n>.json, equations.json
  conversation.jsonl
  verify/PLAN.md, verify/checks/, verify/RESULTS.md, verify/verdicts.json
  <slug>-<attempt>.zip
```

`intake.py` creates it, `verify_run.py` writes RESULTS.md and verdicts.json,
`bundle.py` packs the evidence, and `handoff.py` sends it to the Writer as one captioned message. The worked example in
this repo is `runs/example-oscillator/`. The role and message protocol are in
`../AGENT.md`; how to check the mathematics is in `skills/verify-math/SKILL.md`.
