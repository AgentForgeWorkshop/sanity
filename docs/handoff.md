# Handoff

The bots hand work to each other through the Telegram group, with files as
attachments. There is no shared repository for run data, no `runs/<slug>/status.json`
and no git step: each bot keeps its own working files.

The full protocol (message headers, who wakes on what, which files travel with which
message, when to stay silent, how to send, and the Hermes settings every bot needs)
is the shared skill [skills/sanity-protocol/SKILL.md](../skills/sanity-protocol/SKILL.md),
loaded by all three bots.

In short:

```
person   --paper-------------------------------------------------> Reader
Reader   --sanity run=<slug> to=verifier stage=verifier + equations.json --> Verifier
Verifier --sanity run=<slug> status=started ... + PLAN.md -----------> group
Verifier --sanity run=<slug> to=reader question=<q> (optional) ------> Reader
Reader   --sanity run=<slug> to=verifier answer=<q> -----------------> Verifier
Verifier --sanity run=<slug> to=writer stage=writer + equations.json, verdicts.json, bundle --> Writer
Writer   --sanity run=<slug> status=done + REPORT.md ----------------> group
```

`runs/example-oscillator/` in this repo is a worked example used by the tests, not a
handoff location.
