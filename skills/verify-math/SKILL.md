---
name: verify-math
description: Procedure for Sanity's Checker. The model proposes a check; SymPy or Lean decides. A verdict exists only if an executed script printed it. Use when checking, verifying, or re-deriving an equation from a paper.
---

# verify-math

**The LLM proposes, the CAS decides.** You did not write the derivation you are
checking. A verdict exists only if an executed script printed it. "Looks right"
is not a verdict.

You are a separate Checker context. Write only inside `agents/checker/verify/`.
Never edit the paper, the site, the Reader, or the Judge. Report the fix instead.

## Verdicts

| Verdict | Meaning | Evidence |
|---|---|---|
| `Lean-PROVED` | Lean accepted the claim. Strongest. | This process ran Lean on the statement and it succeeded. |
| `VERIFIED` | Holds symbolically. | `simplify(lhs - rhs) == 0`, assumptions stated in the script. |
| `VERIFIED-NUMERICALLY` | Holds where simplification stalls. | At least 200 random points in the stated ranges, max error reported. Fixed seed. |
| `FAILED` | Does not hold. | A concrete counterexample: values, or dimensions, of both sides. |
| `UNCHECKED` | Could not be checked. | The reason, in the same line. |

SymPy screens every equation. Lean is only for a flagged step. There is no
second computer-algebra system in this checker.

## One script, one equation

```
agents/checker/verify/
  checks/NN_<equation>_<type>.py
  runs/<YYYY-MM-DD>-<scope>/PLAN.md
  RESULTS.md          generated
```

Each script is deterministic and prints exactly one line:

```
VERDICT: <verdict> <check-id> | <one-line detail>
```

Start from `agents/checker/check_template.py`. No paper prose in the script:
equation, label, and one line of claim.

## Procedure

1. If `checks/` already has scripts, run them before planning anything new.
2. Write `runs/<run-id>/PLAN.md`: one row per check (id, equation, type, engine).
   Stop until a person approves it.
3. After approval, add or change scripts only in `checks/`.
4. Run `python3 agents/checker/verify_run.py`. Read every line that is not
   `VERIFIED` or `Lean-PROVED`. A `FAILED` script might be a bad transcription;
   re-read the equation before calling it a paper error.
5. Leave the paper untouched. The report is the script output and `RESULTS.md`.

`verify_run.py` exits 1 when any check fails, errors, or prints no verdict.
