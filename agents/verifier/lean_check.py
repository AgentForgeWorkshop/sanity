"""Check a claim with Lean 4: the only source of evidence ``proof`` and ``refutation``.

    python lean_check.py CHECK.lean          print the VERDICT line Lean supports
    python lean_check.py CHECK.lean --raw    print Lean's own output (for fixing a proof)

A Lean check is a .lean file in ``verify/checks/``. verify_run runs it through
this module itself, so a Python check script can never claim a Lean result. The
file starts with header comments:

    -- CHECK_ID: 05_eq5_lean
    -- CLAIM: 5                  (or CORRECTS: 5 and CORRECTION: <latex>)
    -- THEOREM: Sanity.eq5       the theorem Lean must accept
    -- EXPECT: proof             proof: THEOREM states the claim
                                 refutation: THEOREM states the claim's negation

The verdict is ``HOLDS proof`` (or ``FAILS refutation``) only if all of these hold:

- Lean compiles the file with no error, within the timeout;
- the source has no ``sorry``, ``admit``, ``axiom``, ``native_decide``,
  ``skipKernelTC``, ``implemented_by``, ``extern`` or ``unsafe``;
- ``#print axioms THEOREM`` lists only propext, Classical.choice and Quot.sound.

Anything else is ``UNCHECKED none`` with the reason: a proof Lean did not accept
says nothing about the claim, so it is never a FAILS. A missing Lean or a
malformed header is ``ERROR`` (a broken check).

Lean is found as $SANITY_LEAN, else ``lean`` on PATH, else ~/.elan/bin/lean.
This first version uses Lean's core library only (Nat, Int, Bool, lists):
statements over the reals need Mathlib, which is not installed yet.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

STANDARD_AXIOMS = {"propext", "Classical.choice", "Quot.sound"}
FORBIDDEN = ("sorry", "admit", "axiom", "native_decide", "skipKernelTC", "implemented_by", "extern", "unsafe")
HEADER = re.compile(r"^--\s*([A-Z_]+)\s*:\s*(.*?)\s*$")
AXIOMS_LINE = re.compile(r"'([^']+)' (?:does not depend on any axioms|depends on axioms: \[([^\]]*)\])")
ERROR_LINE = re.compile(r"^[^\n]*?:\d+:\d+: error: (.*)$", re.M)
EXPECTATIONS = {"proof": "HOLDS", "refutation": "FAILS"}


def header(path: Path) -> dict:
    """``-- KEY: value`` lines from the comment block at the top of the file."""
    found = {}
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if not stripped.startswith("--"):
            break
        match = HEADER.match(stripped)
        if match:
            found[match.group(1)] = match.group(2)
    return found


def strip_comments(source: str) -> str:
    source = re.sub(r"/-.*?-/", " ", source, flags=re.S)
    return re.sub(r"--[^\n]*", " ", source)


def forbidden_in(source: str) -> list[str]:
    code = strip_comments(source)
    return [word for word in FORBIDDEN if re.search(rf"(?<!\w){re.escape(word)}(?!\w)", code)]


def find_lean() -> str | None:
    candidates = [os.environ.get("SANITY_LEAN"), shutil.which("lean"), str(Path.home() / ".elan" / "bin" / "lean")]
    for candidate in candidates:
        if candidate and Path(candidate).is_file() and os.access(candidate, os.X_OK):
            return candidate
    return None


def lean_version(lean: str) -> str:
    try:
        out = subprocess.run([lean, "--version"], capture_output=True, text=True, timeout=30).stdout
    except (OSError, subprocess.TimeoutExpired):
        return "?"
    match = re.search(r"version ([0-9][^,\s]*)", out)
    return match.group(1) if match else "?"


def compile_with_axioms(lean: str, path: Path, theorem: str, timeout: int) -> tuple[int, str]:
    """Run Lean on a copy of the file with ``#print axioms THEOREM`` appended."""
    with tempfile.TemporaryDirectory() as tmp:
        copy = Path(tmp) / "Check.lean"
        copy.write_text(Path(path).read_text(encoding="utf-8").rstrip() + f"\n\n#print axioms {theorem}\n",
                        encoding="utf-8")
        completed = subprocess.run([lean, str(copy)], capture_output=True, text=True, timeout=timeout, cwd=tmp)
        return completed.returncode, completed.stdout + completed.stderr


def judge(code: int, output: str, theorem: str, expect: str) -> tuple[str, str, str]:
    """(verdict, evidence, detail) from Lean's exit code and output."""
    errors = ERROR_LINE.findall(output)
    if code != 0 or errors:
        reason = errors[0] if errors else f"exit {code}"
        return "UNCHECKED", "none", f"Lean did not accept the proof: {reason[:160]}"
    if "declaration uses 'sorry'" in output:
        return "UNCHECKED", "none", "proof uses sorry"
    axioms = None
    for name, listed in AXIOMS_LINE.findall(output):
        if name.split(".")[-1] == theorem.split(".")[-1]:
            axioms = {a.strip() for a in listed.split(",") if a.strip()}
    if axioms is None:
        return "UNCHECKED", "none", f"no axiom report for {theorem} (is the THEOREM name right?)"
    extra = sorted(axioms - STANDARD_AXIOMS)
    if extra:
        return "UNCHECKED", "none", f"non-standard axioms: {', '.join(extra)}"
    shown = ", ".join(sorted(axioms)) or "none"
    return EXPECTATIONS[expect], expect, f"Lean accepted {theorem}; axioms: {shown}"


def check(path: Path, timeout: int = 120) -> tuple[str, str, str, str]:
    """(verdict or ERROR, check_id, evidence, detail) for one .lean check."""
    path = Path(path)
    meta = header(path)
    check_id = meta.get("CHECK_ID") or path.stem
    theorem, expect = meta.get("THEOREM"), meta.get("EXPECT", "proof")
    if not theorem:
        return "ERROR", check_id, "none", "header has no THEOREM line"
    if expect not in EXPECTATIONS:
        return "ERROR", check_id, "none", f"EXPECT must be proof or refutation, not {expect!r}"
    bad = forbidden_in(path.read_text(encoding="utf-8"))
    if bad:
        return "UNCHECKED", check_id, "none", f"forbidden in a Lean check: {', '.join(bad)}"
    lean = find_lean()
    if lean is None:
        return "ERROR", check_id, "none", "Lean not found (set SANITY_LEAN or install elan)"
    try:
        code, output = compile_with_axioms(lean, path, theorem, timeout)
    except subprocess.TimeoutExpired:
        return "UNCHECKED", check_id, "none", f"Lean timed out after {timeout} s"
    verdict, evidence, detail = judge(code, output, theorem, expect)
    if verdict != "UNCHECKED":
        detail = f"Lean {lean_version(lean)}: " + detail.removeprefix("Lean ")
    return verdict, check_id, evidence, detail


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if not args or len(args) > 2 or (len(args) == 2 and args[1] != "--raw"):
        print("usage: lean_check.py CHECK.lean [--raw]", file=sys.stderr)
        return 2
    path = Path(args[0])
    if len(args) == 2:
        lean = find_lean()
        if lean is None:
            print("Lean not found (set SANITY_LEAN or install elan)", file=sys.stderr)
            return 2
        theorem = header(path).get("THEOREM", "")
        code, output = compile_with_axioms(lean, path, theorem, 300) if theorem else (2, "no THEOREM in header\n")
        print(output, end="")
        return code
    verdict, check_id, evidence, detail = check(path)
    print(f"VERDICT: {verdict} {check_id} {evidence} | {detail}")
    return 0 if verdict in {"HOLDS", "FAILS"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
