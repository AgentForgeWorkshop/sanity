"""Received equations are hashed, validated, versioned, and their state is on disk."""

import hashlib
import json
from pathlib import Path

import pytest

from intake import IntakeError, main, receive, status

REPO = Path(__file__).resolve().parents[2]
SPECIMEN = REPO / "runs" / "example-oscillator" / "equations.json"


def write(path, data):
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


def toy(slug="toy", latex="a=b"):
    return {"slug": slug, "source": "toy.tex", "equations": [{"number": "1", "line": 1, "latex": latex}]}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_first_file_starts_attempt_one(tmp_path):
    scratch = tmp_path / "scratch"
    got = receive(scratch, "example-oscillator", SPECIMEN, expected_sha256=sha(SPECIMEN))
    assert (got.attempt, got.version, got.equations, got.duplicate) == (1, 1, 5, False)
    folder = scratch / "example-oscillator" / "1"
    assert (folder / "equations.v1.json").read_bytes() == SPECIMEN.read_bytes()
    assert (folder / "equations.json").read_bytes() == SPECIMEN.read_bytes()
    assert (folder / "verify" / "checks").is_dir()


def test_answer_with_new_file_becomes_next_version(tmp_path):
    first = write(tmp_path / "a.json", toy())
    second = write(tmp_path / "b.json", toy(latex="a=2b"))
    receive(tmp_path / "s", "toy", first)
    got = receive(tmp_path / "s", "toy", second)
    assert (got.attempt, got.version) == (1, 2)
    assert json.loads((tmp_path / "s" / "toy" / "1" / "equations.json").read_text())["equations"][0]["latex"] == "a=2b"


def test_identical_file_is_not_stored_twice(tmp_path):
    first = write(tmp_path / "a.json", toy())
    receive(tmp_path / "s", "toy", first)
    got = receive(tmp_path / "s", "toy", first)
    assert got.duplicate and got.version == 1
    assert len(list((tmp_path / "s" / "toy" / "1").glob("equations.v*.json"))) == 1


def test_finished_attempt_and_rerun_rules(tmp_path):
    scratch = tmp_path / "s"
    first = write(tmp_path / "a.json", toy())
    receive(scratch, "toy", first)
    (scratch / "toy" / "1" / "verify" / "verdicts.json").write_text("{}", encoding="utf-8")

    same = receive(scratch, "toy", first)
    assert same.duplicate and same.attempt == 1 and same.already_verified_in == 1

    changed = receive(scratch, "toy", write(tmp_path / "b.json", toy(latex="a=c")))
    assert (changed.attempt, changed.version, changed.duplicate) == (2, 1, False)

    rerun = receive(scratch, "toy", first, new_attempt=True)
    assert (rerun.attempt, rerun.already_verified_in) == (3, 1)


@pytest.mark.parametrize(
    "kwargs, message",
    [
        ({"expected_sha256": "0" * 64}, "sha256 mismatch"),
        ({"slug": "other"}, "message says 'other'"),
        ({"slug": "Bad_Slug"}, "invalid slug"),
    ],
)
def test_rejections(tmp_path, kwargs, message):
    path = write(tmp_path / "a.json", toy())
    slug = kwargs.pop("slug", "toy")
    with pytest.raises(IntakeError, match=message):
        receive(tmp_path / "s", slug, path, **kwargs)
    assert not (tmp_path / "s" / "toy").exists()


def test_invalid_equations_are_rejected_with_the_reason(tmp_path):
    bad = toy()
    bad["equations"][0]["sympy"] = {"lhs": "a", "rhs": "__import__('os')", "symbols": {"a": []}}
    with pytest.raises(IntakeError, match="disallowed syntax|undeclared name"):
        receive(tmp_path / "s", "toy", write(tmp_path / "a.json", bad))


def test_status_reports_state_from_disk(tmp_path):
    scratch = tmp_path / "s"
    receive(scratch, "toy", write(tmp_path / "a.json", toy()))
    folder = scratch / "toy" / "1"
    (folder / "verify" / "PLAN.md").write_text("plan", encoding="utf-8")
    (folder / "verify" / "checks" / "01_x.py").write_text("", encoding="utf-8")
    (folder / "conversation.jsonl").write_text("{}\n{}\n", encoding="utf-8")
    state = status(scratch, "toy")
    [attempt] = state["attempts"]
    assert attempt["versions"] == [1]
    assert attempt["plan"] and attempt["checks"] == 1
    assert attempt["verdicts"] is False and attempt["bundle"] is None
    assert attempt["conversation_entries"] == 2


def test_cli_prints_json_and_exit_codes(tmp_path, capsys):
    path = write(tmp_path / "a.json", toy())
    assert main(["receive", "--slug", "toy", "--file", str(path), "--scratch", str(tmp_path / "s")]) == 0
    assert json.loads(capsys.readouterr().out)["version"] == 1
    assert main(["receive", "--slug", "toy", "--file", str(path), "--sha256", "f" * 64,
                 "--scratch", str(tmp_path / "s")]) == 1
    assert "sha256 mismatch" in capsys.readouterr().err
    assert main(["status", "--slug", "toy", "--scratch", str(tmp_path / "s")]) == 0
    assert json.loads(capsys.readouterr().out)["attempts"][0]["attempt"] == 1


def test_new_attempt_can_carry_checks_plan_and_conversation(tmp_path):
    scratch = tmp_path / "s"
    first = write(tmp_path / "a.json", toy())
    receive(scratch, "toy", first)
    one = scratch / "toy" / "1"
    (one / "verify" / "checks" / "01_x.py").write_text("print()", encoding="utf-8")
    (one / "verify" / "checks" / "02_y.lean").write_text("-- THEOREM: t", encoding="utf-8")
    (one / "verify" / "PLAN.md").write_text("plan", encoding="utf-8")
    (one / "conversation.jsonl").write_text('{"kind": "question"}\n', encoding="utf-8")
    (one / "verify" / "verdicts.json").write_text("{}", encoding="utf-8")
    got = receive(scratch, "toy", first, new_attempt=True, carry=True)
    two = scratch / "toy" / "2"
    assert got.attempt == 2
    assert sorted(p.name for p in (two / "verify" / "checks").iterdir()) == ["01_x.py", "02_y.lean"]
    assert (two / "verify" / "PLAN.md").read_text() == "plan"
    assert (two / "conversation.jsonl").read_text().startswith('{"kind": "question"}')
    assert not (two / "verify" / "verdicts.json").exists()
    plain = receive(scratch, "toy", first, new_attempt=True)
    assert plain.attempt == 3 and not any((scratch / "toy" / "3" / "verify" / "checks").iterdir())


def example_meta(slug="toy"):
    return {"title": "Toy", "authors": [], "abstract": "", "arxiv_id": None, "version": None,
            "primary_category": None, "doi": None, "journal_ref": None, "fetched_at": None,
            "slug": slug, "subject": "Examples", "example": True}


def reader_zip(path, equations, meta=None, extra=None):
    import zipfile
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("equations.json", json.dumps(equations))
        if meta is not None:
            archive.writestr("meta.json", json.dumps(meta))
        for name, data in (extra or {}).items():
            archive.writestr(name, data)
    return path


def test_reader_zip_brings_meta_json_along(tmp_path):
    scratch = tmp_path / "s"
    eq = toy()
    eq_bytes = json.dumps(eq).encode()
    got = receive(scratch, "toy", reader_zip(tmp_path / "toy.zip", eq, example_meta()),
                  expected_sha256=hashlib.sha256(eq_bytes).hexdigest())
    folder = scratch / "toy" / "1"
    assert got.meta is True and got.version == 1
    assert json.loads((folder / "meta.json").read_text())["slug"] == "toy"
    assert json.loads((folder / "equations.json").read_text()) == eq
    assert status(scratch, "toy")["attempts"][0]["meta"] is True


def test_reader_zip_without_meta_still_works(tmp_path):
    got = receive(tmp_path / "s", "toy", reader_zip(tmp_path / "toy.zip", toy()))
    assert got.meta is False
    assert not (tmp_path / "s" / "toy" / "1" / "meta.json").exists()


@pytest.mark.parametrize("meta, extra, message", [
    ({**example_meta(), "slug": "other"}, None, "meta.json has slug 'other'"),
    ({"title": "x"}, None, "meta.json invalid"),
    (example_meta(), {"../evil": b"x"}, "unsafe path"),
])
def test_reader_zip_rejections(tmp_path, meta, extra, message):
    with pytest.raises(IntakeError, match=message):
        receive(tmp_path / "s", "toy", reader_zip(tmp_path / "toy.zip", toy(), meta, extra))


def test_reader_zip_needs_equations_json(tmp_path):
    import zipfile
    bad = tmp_path / "bad.zip"
    with zipfile.ZipFile(bad, "w") as archive:
        archive.writestr("meta.json", json.dumps(example_meta()))
    with pytest.raises(IntakeError, match="no equations.json"):
        receive(tmp_path / "s", "toy", bad)
