"""Send the Verifier's handoff to the Writer: one message, the bundle with the header as its caption.

    python handoff.py --dir ATTEMPT_DIR [--to TARGET] [--dry-run]

Hermes puts a message's text on its file as the caption only if the text is passed
inline (not with --file), the message has exactly one captionable file (.zip), and the
text is at most 1024 characters. Anything else arrives as two messages, and the file
without the header never reaches the Writer. So this tool builds the caption itself
(header, one totals line, what the zip contains and how to unpack it), checks the
limit, and calls `hermes send` with the caption and the MEDIA: line as one argument.

TARGET defaults to $SANITY_GROUP. The per-claim summary for people is a separate
status message (status=verified) sent before this one; it is not part of the caption.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

CAPTION_LIMIT = 1024


class HandoffError(RuntimeError):
    pass


def sha256(path: Path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def build_caption(attempt_dir: Path) -> tuple[str, Path]:
    """(caption, bundle path) for a finished attempt folder."""
    root = Path(attempt_dir).resolve()
    verdicts_path = root / "verify" / "verdicts.json"
    if not verdicts_path.is_file():
        raise HandoffError(f"no verify/verdicts.json in {root}; run verify_run.py first")
    verdicts = json.loads(verdicts_path.read_text(encoding="utf-8"))
    slug = verdicts["paper"]
    attempt = verdicts["inputs"]["attempt"]
    name = f"{slug}-{attempt}.zip" if attempt is not None else f"{slug}.zip"
    bundle = root / name
    if not bundle.is_file():
        raise HandoffError(f"no {name} in {root}; run bundle.py build --dir {root} first")
    equations = root / "equations.json"
    if sha256(equations) != verdicts["inputs"]["equations_sha256"]:
        raise HandoffError("verdicts.json is older than equations.json; run verify_run.py again, then bundle.py")
    claims = verdicts["counts"]["claims"]
    contents = "the summary of claims (equations.json), the verification results (verify/verdicts.json)"
    if (root / "meta.json").is_file():
        contents += ", the paper's metadata (meta.json)"
    contents += " and the check scripts (verify/checks/)"
    lines = [
        f"sanity run={slug} to=writer stage=writer attempt={attempt} "
        f"equations_sha256={sha256(equations)} verdicts_sha256={sha256(verdicts_path)} "
        f"bundle_sha256={sha256(bundle)} code={verdicts['commit'].split()[0]}",
        f"Totals: {claims.get('HOLDS', 0)} HOLDS, {claims.get('FAILS', 0)} FAILS, "
        f"{claims.get('UNCHECKED', 0)} UNCHECKED.",
        f"The attached {name} contains {contents}. "
        f"Unpack it with: python3 -m zipfile -e {name} <empty folder>",
    ]
    caption = "\n".join(lines)
    if len(caption) > CAPTION_LIMIT:
        raise HandoffError(f"caption is {len(caption)} characters, over Telegram's {CAPTION_LIMIT}")
    return caption, bundle


def send(attempt_dir: Path, target: str, dry_run: bool = False) -> dict:
    caption, bundle = build_caption(attempt_dir)
    message = f"{caption}\nMEDIA:{bundle}"
    if not dry_run:
        if not target:
            raise HandoffError("no target: set SANITY_GROUP (source sanity.env) or pass --to")
        done = subprocess.run(["hermes", "send", "--quiet", "--to", target, message],
                              capture_output=True, text=True)
        if done.returncode != 0:
            raise HandoffError(f"hermes send failed (exit {done.returncode}): {(done.stderr or done.stdout).strip()[-300:]}")
    return {"sent": not dry_run, "bundle": str(bundle), "caption_chars": len(caption), "caption": caption}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Send the Verifier's handoff (bundle + caption) to the Writer.")
    parser.add_argument("--dir", required=True, type=Path, help="the attempt folder (<slug>/<attempt>)")
    parser.add_argument("--to", default=os.environ.get("SANITY_GROUP", ""), help="hermes send target (default $SANITY_GROUP)")
    parser.add_argument("--dry-run", action="store_true", help="print the caption, send nothing")
    args = parser.parse_args(argv)
    try:
        result = send(args.dir, args.to, args.dry_run)
    except (HandoffError, KeyError, json.JSONDecodeError) as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
