# Verifier smoke test

A five-claim `equations.json` for testing the Verifier bot end to end in the
group, without a paper and without the Reader. You play the Reader.

| eq | claim | expected |
|---|---|---|
| (1) | (a+b)² = a² + 2ab + b² | `HOLDS` (symbolic) |
| (2) | sin²x + cos²x = 2 | `FAILS`, planted, with a verified correction `= 1` |
| (3) | √(1+ε) ≃ 1 + ε/2 as ε → 0⁺, error O(ε²) | `HOLDS` (asymptotic) |
| (4) | x/(1+x) ∼ x, no regime stated | a question to you; `UNCHECKED … awaiting answer` in attempt 1 |
| (5) | 3(a+b) − 2a = a + 3b over the integers | `HOLDS` (proof): Lean, because you ask for it |

`05_eq5_lean.lean` is a reference Lean check for (5). The bot writes its own;
`setup_verifier_docker.sh selftest` and the tests use this one.

## Send it

1. Get the hash: `shasum -a 256 agents/verifier/smoke/equations.json`.
2. In the group, send the file as a document, with this caption (no @ needed: the
   Verifier wakes on `to=verifier`):

   ```
   sanity run=smoke-test to=verifier stage=verifier equations_sha256=<hash>
   Please prove eq (5) in Lean.
   ```

3. Expect, within a few minutes:
   - right away: `sanity run=smoke-test status=started attempt=1 claims=5 estimate_min=…`,
     with the plan and `PLAN.md` attached
   - a question as a reply: `sanity run=smoke-test to=reader question=1 eq=4 …`
   - **without waiting for your answer**, the handoff
     `sanity run=smoke-test to=writer stage=writer attempt=1 …`, with `verdicts.json` and
     `smoke-test-1.tar.gz` attached: (1) HOLDS symbolic, (2) FAILS with a verified
     correction, (3) HOLDS asymptotic, (4) UNCHECKED (awaiting answer), (5) HOLDS proof
4. Answer the question by replying to it:

   ```
   sanity run=smoke-test to=verifier answer=1
   As x → 0.
   ```

   Expect a second handoff, `attempt=2`, with `smoke-test-2.tar.gz`, where (4) is
   now settled (HOLDS asymptotic: x/(1+x) / x → 1 as x → 0).

## Check a bundle

Save the attachment from Telegram, copy `bundle_sha256` from the handoff
message, and run on your Mac (plain `python3` is enough):

```bash
python3 agents/verifier/bundle.py verify --bundle ~/Downloads/smoke-test-1.tar.gz --sha256 <bundle_sha256>
```

To re-run it, inside the container (where SymPy and Lean are):

```bash
docker cp ~/Downloads/smoke-test-1.tar.gz hermes:/tmp/b.tar.gz
docker exec -u hermes hermes sh -c '. /opt/data/sanity-verifier/scratch/sanity.env; rm -rf /tmp/rr;
  $SANITY_PYTHON $SANITY_REPO/agents/verifier/bundle.py verify --bundle /tmp/b.tar.gz --extract /tmp/rr/smoke-test &&
  $SANITY_PYTHON $SANITY_REPO/agents/verifier/verify_run.py /tmp/rr/smoke-test/verify'
```

If nothing happens: run `bash scripts/setup_verifier_docker.sh status`, and
check `docker logs hermes --tail 50` for "Blocked unauthorized user".
