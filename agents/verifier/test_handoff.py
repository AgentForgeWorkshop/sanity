"""The handoff is one hermes send: caption inline (no --file), one zip, at most 1024 characters."""

import json
import os
import shutil
import stat
import sys
from pathlib import Path

import pytest

from bundle import build
from handoff import CAPTION_LIMIT, HandoffError, build_caption, main
from intake import receive
from verify_run import main as verify_main

REPO = Path(__file__).resolve().parents[2]
SPECIMEN = REPO / "runs" / "example-oscillator"


def attempt(tmp_path, with_meta=False):
    got = receive(tmp_path / "scratch", "example-oscillator", SPECIMEN / "equations.json")
    folder = Path(got.path).parent
    shutil.copytree(SPECIMEN / "verify" / "checks", folder / "verify" / "checks", dirs_exist_ok=True)
    if with_meta:
        (folder / "meta.json").write_text('{"slug": "example-oscillator"}', encoding="utf-8")
    verify_main([str(folder / "verify")])
    build(folder)
    return folder


def test_caption_has_header_totals_and_unpack_note(tmp_path):
    folder = attempt(tmp_path, with_meta=True)
    caption, bundle = build_caption(folder)
    header, totals, note = caption.split("\n")
    assert header.startswith("sanity run=example-oscillator to=writer stage=writer attempt=1 ")
    for key in ("equations_sha256=", "verdicts_sha256=", "bundle_sha256=", "code="):
        assert key in header
    assert totals.startswith("Totals: ") and "FAILS" in totals
    assert "meta.json" in note and "python3 -m zipfile -e example-oscillator-1.zip" in note
    assert bundle.name == "example-oscillator-1.zip" and len(caption) <= CAPTION_LIMIT


def test_sends_once_inline_with_media_and_no_file_flag(tmp_path, monkeypatch):
    folder = attempt(tmp_path)
    log = tmp_path / "argv.json"
    fake = tmp_path / "bin" / "hermes"
    fake.parent.mkdir()
    fake.write_text(f"#!{sys.executable}\nimport json, sys\njson.dump(sys.argv[1:], open({str(log)!r}, 'w'))\n")
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC)
    monkeypatch.setenv("PATH", f"{fake.parent}{os.pathsep}{os.environ['PATH']}")
    assert main(["--dir", str(folder), "--to", "telegram:-100"]) == 0
    argv = json.loads(log.read_text())
    assert argv[:4] == ["send", "--quiet", "--to", "telegram:-100"] and "--file" not in argv
    assert len(argv) == 5
    message = argv[4]
    caption, media = message.rsplit("\nMEDIA:", 1)
    assert caption.startswith("sanity run=example-oscillator to=writer")
    assert media == str(folder.resolve() / "example-oscillator-1.zip")


def test_refuses_stale_or_unbundled_runs(tmp_path):
    folder = attempt(tmp_path)
    (folder / "example-oscillator-1.zip").unlink()
    with pytest.raises(HandoffError, match="run bundle.py"):
        build_caption(folder)
    build(folder)
    (folder / "equations.json").write_text((folder / "equations.json").read_text().replace('"line": 7', '"line": 8'))
    with pytest.raises(HandoffError, match="older than equations.json"):
        build_caption(folder)


def test_needs_a_target(tmp_path, monkeypatch):
    folder = attempt(tmp_path)
    monkeypatch.delenv("SANITY_GROUP", raising=False)
    assert main(["--dir", str(folder)]) == 1
