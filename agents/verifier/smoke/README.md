# Verifier smoke test

A four-claim `equations.json` for testing the Verifier bot end to end in the
group, without a paper and without the Reader.

| eq | claim | expected |
|---|---|---|
| (1) | (a+b)² = a² + 2ab + b² | `HOLDS` (symbolic) |
| (2) | sin²x + cos²x = 2 | `FAILS`, planted, with a verified correction `= 1` |
| (3) | √(1+ε) ≃ 1 + ε/2 as ε → 0⁺, error O(ε²) | `HOLDS` (asymptotic) |
| (4) | x/(1+x) ∼ x, no regime stated | the Verifier asks one question; with no answer: `UNCHECKED` |

## Send it

1. Get the hash: `shasum -a 256 agents/verifier/smoke/equations.json`.
2. In the group, send the file as a document, with this caption (your Verifier's username):

   ```
   @koni_master_hermes_bot sanity run=smoke-test stage=verifier equations_sha256=<hash>
   ```

3. Expect, within a few minutes:
   - an optional `sanity run=smoke-test status=started …` line
   - a question about eq (4), as a reply. Answer e.g. "as x → 0", or leave it unanswered to test the timeout
   - a handoff message `sanity run=smoke-test stage=writer attempt=1 …` with `verdicts.json` and
     `smoke-test-1.tar.gz` attached. With no Writer bot in the group yet, that message is only for you.
4. Check the result: `python3 agents/verifier/bundle.py verify --bundle smoke-test-1.tar.gz --sha256 <bundle_sha256>`.

If nothing happens: run `bash scripts/setup_verifier_docker.sh status`, and check
`docker logs hermes --tail 50` for "Blocked unauthorized user".
