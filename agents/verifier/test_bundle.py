"""Bundles carry every piece of evidence, check out against their manifest, and re-run."""

import io
import json
import shutil
import tarfile
import zipfile
from pathlib import Path

import pytest

from bundle import BundleError, build, evidence_files, extract, main, verify
from conversation import append
from intake import receive
from verify_run import main as verify_main

REPO = Path(__file__).resolve().parents[2]
SPECIMEN = REPO / "runs" / "example-oscillator"


def finished_attempt(tmp_path):
    """The example run, received into a scratch folder and verified there."""
    scratch = tmp_path / "scratch"
    got = receive(scratch, "example-oscillator", SPECIMEN / "equations.json")
    folder = Path(got.path).parent
    shutil.copytree(SPECIMEN / "verify" / "checks", folder / "verify" / "checks", dirs_exist_ok=True)
    shutil.copy(SPECIMEN / "verify" / "PLAN.md", folder / "verify" / "PLAN.md")
    append(folder, "verifier", "note", "started")
    (folder / "verify" / "checks" / "__pycache__").mkdir()
    (folder / "verify" / "checks" / "__pycache__" / "x.pyc").write_bytes(b"junk")
    assert verify_main([str(folder / "verify")]) == 1  # the planted errors
    return folder


def test_build_and_verify_round_trip(tmp_path):
    folder = finished_attempt(tmp_path)
    path, sha = build(folder)
    assert path.name == "example-oscillator-1.zip"
    assert path.read_bytes()[:2] == b"PK"
    assert build(folder)[1] == sha  # deterministic: same content, same hash
    manifest = verify(path, expected_sha256=sha)
    assert (manifest["paper"], manifest["attempt"]) == ("example-oscillator", 1)
    assert manifest["code_commit"] and manifest["python"] and manifest["sympy"]
    files = {entry["path"] for entry in manifest["files"]}
    assert {"equations.json", "equations.v1.json", "conversation.jsonl", "verify/PLAN.md",
            "verify/RESULTS.md", "verify/verdicts.json", "verify/checks/02_eq3_paper_energy_step.py"} <= files
    assert not any("__pycache__" in name or name.endswith((".tar.gz", ".zip")) for name in files)


def test_extracted_bundle_reruns_to_the_same_claims(tmp_path):
    folder = finished_attempt(tmp_path)
    path, sha = build(folder)
    dest = tmp_path / "rerun" / "example-oscillator"
    extract(path, dest, expected_sha256=sha)
    before = json.loads((folder / "verify" / "verdicts.json").read_text(encoding="utf-8"))["claims"]
    assert verify_main([str(dest / "verify")]) == 1
    after = json.loads((dest / "verify" / "verdicts.json").read_text(encoding="utf-8"))["claims"]
    assert [(c["claim"], c["verdict"], c["evidence"]["kind"]) for c in after] == [
        (c["claim"], c["verdict"], c["evidence"]["kind"]) for c in before
    ]


def test_build_refuses_unfinished_or_stale_runs(tmp_path):
    scratch = tmp_path / "s"
    got = receive(scratch, "example-oscillator", SPECIMEN / "equations.json")
    with pytest.raises(BundleError, match="missing"):
        build(Path(got.path).parent)
    folder = finished_attempt(tmp_path / "other")
    (folder / "equations.json").write_text(
        (folder / "equations.json").read_text(encoding="utf-8").replace('"line": 7', '"line": 8'), encoding="utf-8"
    )
    with pytest.raises(BundleError, match="different equations.json"):
        build(folder)


def _tamper(path, name, data):
    with zipfile.ZipFile(path) as archive:
        members = [(info.filename, archive.read(info)) for info in archive.infolist()]
    raw = io.BytesIO()
    with zipfile.ZipFile(raw, "w") as archive:
        for filename, content in members:
            archive.writestr(filename, data if filename == name else content)
    path.write_bytes(raw.getvalue())


def test_verify_detects_tampering_and_bad_hash(tmp_path):
    folder = finished_attempt(tmp_path)
    path, sha = build(folder)
    with pytest.raises(BundleError, match="sha256 mismatch"):
        verify(path, expected_sha256="0" * 64)
    _tamper(path, "verify/verdicts.json", b"{}")
    with pytest.raises(BundleError, match="does not match the manifest"):
        verify(path)


@pytest.mark.parametrize("fmt", ["zip", "tar.gz"])
def test_verify_rejects_unsafe_paths(tmp_path, fmt):
    raw = io.BytesIO()
    if fmt == "zip":
        with zipfile.ZipFile(raw, "w") as archive:
            archive.writestr("../evil.txt", b"x")
    else:
        with tarfile.open(fileobj=raw, mode="w:gz") as tar:
            info = tarfile.TarInfo("../evil.txt")
            info.size = 1
            tar.addfile(info, io.BytesIO(b"x"))
    bad = tmp_path / f"bad.{fmt}"
    bad.write_bytes(raw.getvalue())
    with pytest.raises(BundleError, match="unsafe"):
        verify(bad)


def test_older_tar_gz_bundles_still_verify_and_extract(tmp_path):
    folder = finished_attempt(tmp_path)
    path, _ = build(folder)
    with zipfile.ZipFile(path) as archive:
        members = [(info.filename, archive.read(info)) for info in archive.infolist()]
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode="w:gz") as tar:
        for name, data in members:
            info = tarfile.TarInfo(name)
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))
    old = tmp_path / "example-oscillator-1.tar.gz"
    old.write_bytes(raw.getvalue())
    assert verify(old)["paper"] == "example-oscillator"
    extract(old, tmp_path / "old")
    assert (tmp_path / "old" / "verify" / "verdicts.json").is_file()


def test_extract_needs_an_empty_destination(tmp_path):
    folder = finished_attempt(tmp_path)
    path, _ = build(folder)
    (tmp_path / "full").mkdir()
    (tmp_path / "full" / "x").write_text("x")
    with pytest.raises(BundleError, match="not empty"):
        extract(path, tmp_path / "full")


def test_evidence_files_skips_build_output(tmp_path):
    (tmp_path / "verify" / "lean" / ".lake").mkdir(parents=True)
    (tmp_path / "verify" / "lean" / ".lake" / "big.olean").write_bytes(b"x")
    (tmp_path / "verify" / "lean" / "Claim.lean").write_text("theorem t : True := trivial")
    (tmp_path / "equations.json").write_text("{}")
    assert evidence_files(tmp_path) == ["equations.json", "verify/lean/Claim.lean"]


def test_cli(tmp_path, capsys):
    folder = finished_attempt(tmp_path)
    capsys.readouterr()
    assert main(["build", "--dir", str(folder)]) == 0
    built = json.loads(capsys.readouterr().out)
    assert main(["verify", "--bundle", built["bundle"], "--sha256", built["sha256"]]) == 0
    assert json.loads(capsys.readouterr().out)["ok"] is True
    assert main(["verify", "--bundle", built["bundle"], "--sha256", "1" * 64]) == 1


def test_verify_needs_only_the_standard_library(tmp_path):
    """Anyone can check a bundle with plain python3: no SymPy, no jsonschema."""
    import subprocess
    import sys

    folder = finished_attempt(tmp_path)
    path, sha = build(folder)
    code = (
        "import sys; sys.modules['sympy'] = None; sys.modules['jsonschema'] = None; "
        f"sys.path.insert(0, {str(Path(__file__).parent)!r}); import bundle; "
        f"m = bundle.verify({str(path)!r}, {sha!r}); print(m['paper'])"
    )
    out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True)
    assert out.returncode == 0, out.stderr
    assert out.stdout.strip() == "example-oscillator"


def test_meta_json_travels_in_the_bundle(tmp_path):
    folder = finished_attempt(tmp_path)
    (folder / "meta.json").write_text('{"slug": "example-oscillator"}', encoding="utf-8")
    from verify_run import main as rerun
    rerun([str(folder / "verify")])
    path, sha = build(folder)
    assert "meta.json" in {entry["path"] for entry in verify(path, sha)["files"]}
