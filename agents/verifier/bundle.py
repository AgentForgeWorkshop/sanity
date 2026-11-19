"""Pack a finished run into an evidence bundle, and check a received one.

    python bundle.py build  --dir ATTEMPT_DIR [--out PATH]
    python bundle.py verify --bundle PATH [--sha256 HEX] [--extract DIR]

The bundle is the lasting record of a verification: scratch folders are
temporary, and the bundle is what goes to the Writer and stays in the group.
It is a .zip (``<slug>-<attempt>.zip``) of the run folder's evidence plus a
manifest.json. A .zip, because Telegram (via Hermes) can carry a caption only on
a captionable document, and .zip is one: the handoff header rides on the bundle
itself, in one message. ``verify`` and ``extract`` also read older .tar.gz bundles.

    equations.json, equations.v<n>.json   what the Reader sent
    conversation.jsonl                    questions and answers, if any
    verify/PLAN.md, verify/checks/**, verify/lean/**, verify/RESULTS.md, verify/verdicts.json
    manifest.json                         paper, attempt, code commit, versions, sha256 of every file

``build`` refuses to pack a run whose verdicts.json was computed on a
different equations.json than the one in the folder. ``verify`` checks the
bundle's sha256 (if given), rejects unsafe paths, and compares every file with
the manifest. To re-run a bundle: check out the manifest's code commit,
extract, and run ``python agents/verifier/verify_run.py <extracted>/verify``.

``verify`` and ``extract`` use only the Python standard library, so a bundle can
be checked with any python3 (no SymPy needed). ``build`` needs the Verifier's
environment.
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import io
import json
import platform
import sys
import tarfile
import zipfile
from pathlib import Path, PurePosixPath

SKIP_PARTS = {"__pycache__", ".lake", "build", ".pytest_cache"}
SKIP_SUFFIXES = {".olean", ".ilean", ".pyc", ".tar.gz", ".zip"}
ZIP_TIME = (1980, 1, 1, 0, 0, 0)  # fixed timestamp: same content, same bytes
REQUIRED = ("equations.json", "verify/RESULTS.md", "verify/verdicts.json")
MANIFEST = "manifest.json"


class BundleError(ValueError):
    """Raised when a run cannot be packed or a bundle does not check out."""


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def evidence_files(attempt_dir: Path) -> list[str]:
    """Relative POSIX paths of every file that belongs in the bundle, sorted."""
    root = Path(attempt_dir)
    chosen = []
    for name in ["equations.json", "conversation.jsonl"] + sorted(p.name for p in root.glob("equations.v*.json")):
        if (root / name).is_file():
            chosen.append(name)
    verify = root / "verify"
    if verify.is_dir():
        for path in sorted(verify.rglob("*")):
            rel = path.relative_to(root)
            if not path.is_file() or SKIP_PARTS & set(rel.parts):
                continue
            if any(path.name.endswith(suffix) for suffix in SKIP_SUFFIXES):
                continue
            chosen.append(rel.as_posix())
    return sorted(set(chosen))


def _versions() -> dict:
    try:
        import sympy
        sympy_version = sympy.__version__
    except ImportError:  # pragma: no cover - sympy is a requirement
        sympy_version = None
    return {"python": platform.python_version(), "sympy": sympy_version}


def build(attempt_dir: Path, out: Path | None = None) -> tuple[Path, str]:
    """Write the bundle and return (path, sha256)."""
    from verify_run import code_commit, run_identity  # needs the Verifier's environment

    root = Path(attempt_dir)
    missing = [name for name in REQUIRED if not (root / name).is_file()]
    if missing:
        raise BundleError(f"cannot bundle {root}: missing {', '.join(missing)} (run verify_run.py first)")
    verdicts = json.loads((root / "verify" / "verdicts.json").read_text(encoding="utf-8"))
    used = verdicts.get("inputs", {}).get("equations_sha256")
    current = sha256_bytes((root / "equations.json").read_bytes())
    if used != current:
        raise BundleError("verdicts.json was computed on a different equations.json; run verify_run.py again")
    paper, attempt = run_identity(root)
    files = evidence_files(root)
    manifest = {
        "format": 1,
        "paper": paper,
        "attempt": attempt,
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "code_commit": code_commit(),
        **_versions(),
        "files": [
            {"path": rel, "sha256": sha256_bytes((root / rel).read_bytes()), "bytes": (root / rel).stat().st_size}
            for rel in files
        ],
    }
    name = f"{paper}-{attempt}.zip" if attempt is not None else f"{paper}.zip"
    out = Path(out) if out else root / name
    raw = io.BytesIO()
    with zipfile.ZipFile(raw, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        entries = [(MANIFEST, (json.dumps(manifest, indent=2) + "\n").encode())]
        entries += [(rel, (root / rel).read_bytes()) for rel in files]
        for rel, data in entries:
            info = zipfile.ZipInfo(rel, date_time=ZIP_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3  # unix, so the mode below is honoured
            info.external_attr = 0o644 << 16
            archive.writestr(info, data)
    out.write_bytes(raw.getvalue())
    return out, sha256_bytes(raw.getvalue())


def _safe_name(name: str) -> str:
    path = PurePosixPath(name)
    if not name or path.is_absolute() or ".." in path.parts or "\\" in name:
        raise BundleError(f"unsafe or unexpected entry in bundle: {name}")
    return name


def read_entries(data: bytes) -> dict[str, bytes]:
    """Every file in a .zip or (older) .tar.gz bundle, by name, after path checks."""
    contents: dict[str, bytes] = {}
    if data[:2] == b"PK":
        try:
            archive = zipfile.ZipFile(io.BytesIO(data))
        except zipfile.BadZipFile as exc:
            raise BundleError(f"not a readable .zip: {exc}") from None
        with archive:
            for info in archive.infolist():
                if info.is_dir():
                    raise BundleError(f"unsafe or unexpected entry in bundle: {info.filename}")
                if (info.external_attr >> 16) & 0o170000 == 0o120000:
                    raise BundleError(f"unsafe or unexpected entry in bundle (symlink): {info.filename}")
                contents[_safe_name(info.filename)] = archive.read(info)
        return contents
    try:
        tar = tarfile.open(fileobj=io.BytesIO(data), mode="r:gz")
    except (tarfile.TarError, OSError) as exc:
        raise BundleError(f"not a readable .zip or .tar.gz: {exc}") from None
    with tar:
        for member in tar.getmembers():
            if not member.isfile():
                raise BundleError(f"unsafe or unexpected entry in bundle: {member.name}")
            contents[_safe_name(member.name)] = tar.extractfile(member).read()
    return contents


def verify(bundle: Path, expected_sha256: str | None = None) -> dict:
    """Check a bundle. Returns its manifest; raises BundleError on any problem."""
    data = Path(bundle).read_bytes()
    sha = sha256_bytes(data)
    if expected_sha256 and sha != expected_sha256.lower():
        raise BundleError(f"sha256 mismatch: expected {expected_sha256}, bundle is {sha}")
    contents = read_entries(data)
    if MANIFEST not in contents:
        raise BundleError("bundle has no manifest.json")
    manifest = json.loads(contents.pop(MANIFEST))
    listed = {entry["path"]: entry["sha256"] for entry in manifest.get("files", [])}
    if set(listed) != set(contents):
        extra = sorted(set(contents) - set(listed))
        absent = sorted(set(listed) - set(contents))
        raise BundleError(f"files differ from manifest: extra {extra}, missing {absent}")
    for rel, digest in listed.items():
        if sha256_bytes(contents[rel]) != digest:
            raise BundleError(f"{rel}: sha256 does not match the manifest")
    for name in REQUIRED:
        if name not in contents:
            raise BundleError(f"bundle lacks {name}")
    manifest["sha256"] = sha
    return manifest


def extract(bundle: Path, dest: Path, expected_sha256: str | None = None) -> dict:
    """Verify, then unpack into ``dest`` (which must be empty or absent)."""
    manifest = verify(bundle, expected_sha256)
    dest = Path(dest)
    if dest.exists() and any(dest.iterdir()):
        raise BundleError(f"{dest} is not empty")
    dest.mkdir(parents=True, exist_ok=True)
    for name, data in read_entries(Path(bundle).read_bytes()).items():
        target = dest / name  # names are checked: relative, no "..", no symlinks
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    return manifest


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Verifier evidence bundles.")
    sub = parser.add_subparsers(dest="command", required=True)
    b = sub.add_parser("build")
    b.add_argument("--dir", required=True, type=Path)
    b.add_argument("--out", type=Path)
    v = sub.add_parser("verify")
    v.add_argument("--bundle", required=True, type=Path)
    v.add_argument("--sha256")
    v.add_argument("--extract", type=Path)
    args = parser.parse_args(argv)
    try:
        if args.command == "build":
            path, sha = build(args.dir, args.out)
            print(json.dumps({"bundle": str(path), "sha256": sha, "files": evidence_files(args.dir)}, indent=2))
        else:
            if args.extract:
                manifest = extract(args.bundle, args.extract, args.sha256)
            else:
                manifest = verify(args.bundle, args.sha256)
            print(json.dumps({"ok": True, **{k: manifest[k] for k in ("paper", "attempt", "code_commit", "sha256")},
                              "files": len(manifest["files"])}, indent=2))
    except BundleError as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
