"""Lean evidence comes only from lean_check.py, and only for a clean, axiom-checked proof.

Most tests use a stand-in `lean` that prints what real Lean prints, so they run
without Lean installed. test_real_lean runs only where Lean is available (the
Verifier's container), against the smoke test's Lean check.
"""

import json
import os
import stat
import sys
from pathlib import Path

import pytest

import lean_check
from lean_check import check, forbidden_in, header, judge
from verify_run import main as verify_main

HERE = Path(__file__).resolve().parent
SMOKE_LEAN = HERE / "smoke" / "05_eq5_lean.lean"

FAKE = r'''#!{python}
import sys, time
if sys.argv[1] == "--version":
    print("Lean (version 4.22.0, aarch64-unknown-linux-gnu, commit abc, Release)")
    sys.exit(0)
source = open(sys.argv[1]).read()
mode = [l.split(":", 1)[1].strip() for l in source.splitlines() if l.startswith("-- FAKE:")][0]
name = [l.split(":", 1)[1].strip() for l in source.splitlines() if l.startswith("-- THEOREM:")][0]
if mode == "ok":
    print(f"'{name}' depends on axioms: [propext]")
elif mode == "noaxioms":
    print(f"'{name}' does not depend on any axioms")
elif mode == "error":
    print("Check.lean:5:2: error: unsolved goals\n⊢ False"); sys.exit(1)
elif mode == "sorry":
    print("Check.lean:5:0: warning: declaration uses 'sorry'"); print(f"'{name}' depends on axioms: [sorryAx]")
elif mode == "extra":
    print(f"'{name}' depends on axioms: [propext, Lean.ofReduceBool]")
elif mode == "slow":
    time.sleep(5)
'''


@pytest.fixture
def fake_lean(tmp_path, monkeypatch):
    path = tmp_path / "bin" / "lean"
    path.parent.mkdir()
    path.write_text(FAKE.replace("{python}", sys.executable), encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IEXEC)
    monkeypatch.setenv("SANITY_LEAN", str(path))
    return path


def lean_file(folder, name="05_eq5_lean.lean", mode="ok", expect="proof", body=None, extra_header=""):
    path = Path(folder) / name
    path.write_text(
        f"-- CHECK_ID: {Path(name).stem}\n-- CLAIM: 5\n-- THEOREM: Sanity.eq5\n-- EXPECT: {expect}\n"
        f"-- FAKE: {mode}\n{extra_header}\n"
        + (body or "theorem Sanity.eq5 (a b : Int) : 3 * (a + b) - 2 * a = a + 3 * b := by omega\n"),
        encoding="utf-8",
    )
    return path


def test_header_is_read_from_the_leading_comments(tmp_path):
    path = lean_file(tmp_path)
    meta = header(path)
    assert (meta["CLAIM"], meta["THEOREM"], meta["EXPECT"]) == ("5", "Sanity.eq5", "proof")


def test_forbidden_constructs_ignore_comments():
    assert forbidden_in("theorem t : True := by sorry") == ["sorry"]
    assert forbidden_in("-- no sorry here\n/- admit -/ theorem t : True := trivial") == []
    assert set(forbidden_in("axiom cheat : False\nexample : True := by native_decide")) == {"axiom", "native_decide"}
    assert forbidden_in("set_option debug.skipKernelTC true") == ["skipKernelTC"]


@pytest.mark.parametrize(
    "code, output, expect, want",
    [
        (0, "'Sanity.eq5' depends on axioms: [propext]", "proof", ("HOLDS", "proof")),
        (0, "'Sanity.eq5' does not depend on any axioms", "refutation", ("FAILS", "refutation")),
        (1, "Check.lean:5:2: error: unsolved goals", "proof", ("UNCHECKED", "none")),
        (0, "x: warning: declaration uses 'sorry'\n'Sanity.eq5' depends on axioms: [sorryAx]", "proof", ("UNCHECKED", "none")),
        (0, "'Sanity.eq5' depends on axioms: [propext, Lean.ofReduceBool]", "proof", ("UNCHECKED", "none")),
        (0, "nothing about axioms", "proof", ("UNCHECKED", "none")),
    ],
)
def test_judge(code, output, expect, want):
    assert judge(code, output, "Sanity.eq5", expect)[:2] == want


def test_check_with_stand_in_lean(tmp_path, fake_lean):
    assert check(lean_file(tmp_path, mode="ok"))[:3] == ("HOLDS", "05_eq5_lean", "proof")
    verdict, _, evidence, detail = check(lean_file(tmp_path, mode="noaxioms", expect="refutation"))
    assert (verdict, evidence) == ("FAILS", "refutation") and detail.startswith("Lean 4.22.0: accepted")
    assert check(lean_file(tmp_path, mode="error"))[0] == "UNCHECKED"
    assert "sorry" in check(lean_file(tmp_path, mode="sorry"))[3]
    assert "non-standard axioms: Lean.ofReduceBool" in check(lean_file(tmp_path, mode="extra"))[3]
    assert "timed out" in check(lean_file(tmp_path, mode="slow"), timeout=1)[3]
    cheat = lean_file(tmp_path, body="theorem Sanity.eq5 : False := by sorry\n")
    assert check(cheat)[:3] == ("UNCHECKED", "05_eq5_lean", "none")


def test_broken_lean_checks_are_errors(tmp_path, fake_lean, monkeypatch):
    no_theorem = tmp_path / "x.lean"
    no_theorem.write_text("-- CLAIM: 1\ntheorem t : True := trivial\n", encoding="utf-8")
    assert check(no_theorem)[0] == "ERROR"
    assert check(lean_file(tmp_path, expect="maybe"))[0] == "ERROR"
    monkeypatch.setenv("SANITY_LEAN", str(tmp_path / "nope"))
    monkeypatch.setenv("PATH", "")
    monkeypatch.setattr(lean_check.Path, "home", lambda: tmp_path)
    assert "Lean not found" in check(lean_file(tmp_path))[3]


def test_runner_runs_lean_checks_itself(tmp_path, fake_lean):
    checks = tmp_path / "checks"
    checks.mkdir()
    lean_file(checks, "05_eq5_lean.lean", mode="ok")
    lean_file(checks, "06_eq6_lean.lean", mode="noaxioms", expect="refutation",
              extra_header="-- CLAIM: 6")
    (checks / "06_eq6_lean.lean").write_text(
        (checks / "06_eq6_lean.lean").read_text().replace("-- CLAIM: 5\n", ""), encoding="utf-8")
    (checks / "07_fake.py").write_text(
        'CLAIM = "7"\nprint("VERDICT: HOLDS 07_fake proof | trust me")\n', encoding="utf-8")
    assert verify_main([str(tmp_path)]) == 1
    data = json.loads((tmp_path / "verdicts.json").read_text(encoding="utf-8"))
    claims = {c["claim"]: c for c in data["claims"]}
    assert (claims["5"]["verdict"], claims["5"]["evidence"]["kind"], claims["5"]["evidence"]["engine"]) == (
        "HOLDS", "proof", "lean")
    assert (claims["6"]["verdict"], claims["6"]["evidence"]["kind"]) == ("FAILS", "refutation")
    assert claims["7"]["verdict"] == "UNCHECKED"  # the Python script's "proof" is an ERROR
    rows = {c["check_id"]: c for c in data["checks"]}
    assert rows["07_fake.py"]["verdict"] == "ERROR"
    assert rows["05_eq5_lean"]["script"] == "verify/checks/05_eq5_lean.lean"


def test_smoke_lean_check_is_well_formed():
    meta = header(SMOKE_LEAN)
    assert (meta["CLAIM"], meta["EXPECT"]) == ("5", "proof")
    assert forbidden_in(SMOKE_LEAN.read_text(encoding="utf-8")) == []


@pytest.mark.skipif(os.environ.get("SANITY_LEAN") is None and lean_check.find_lean() is None,
                    reason="Lean not installed here (it runs in the Verifier's container)")
def test_real_lean():
    verdict, _, evidence, detail = check(SMOKE_LEAN)
    assert (verdict, evidence) == ("HOLDS", "proof"), detail
