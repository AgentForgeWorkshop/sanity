#!/usr/bin/env bash
# Set up the Sanity Verifier inside a Hermes Agent Docker container.
#
# Run on the host (the Mac), from anywhere. Everything happens inside the
# container, on its data volume (/opt/data), so nothing uses the host's Python.
#
#   bash scripts/setup_verifier_docker.sh install     clone sanity, Python env with SymPy, scratch folder
#   bash scripts/setup_verifier_docker.sh selftest    run the example through intake, verify_run and bundle
#   bash scripts/setup_verifier_docker.sh configure   persona, skill, working folder, env vars, mention-only,
#                                                     bot loop guard; restarts the container
#   bash scripts/setup_verifier_docker.sh status      show what is installed and configured
#   bash scripts/setup_verifier_docker.sh all         install + selftest + configure
#   bash scripts/setup_verifier_docker.sh update      pull the code again (re-run selftest afterwards)
#
# Settings (environment variables on the host):
#   HERMES_CONTAINER   container name               (default: hermes)
#   SANITY_URL         repo to clone                (default: https://github.com/IlkhamFY/sanity)
#   SANITY_REF         branch or tag to check out   (default: main)
#   DATA               Hermes data dir in container (default: /opt/data)
#   HERMES_USER        user Hermes runs as          (default: owner of $DATA, e.g. hermes)
#
# Ownership: the code clone and the Python env stay root-owned, so the bot can read
# but not change them. The scratch area belongs to HERMES_USER, the only place the
# bot writes. selftest runs as HERMES_USER to catch permission problems.
#
# configure backs up SOUL.md, config.yaml and .env first (*.bak-<time>), and
# never prints secrets. Telegram settings (token, allowed IDs, bot-to-bot mode)
# stay with you: see docs/setup-verifier-docker.md.
set -euo pipefail

CONTAINER="${HERMES_CONTAINER:-hermes}"
SANITY_URL="${SANITY_URL:-https://github.com/IlkhamFY/sanity}"
SANITY_REF="${SANITY_REF:-main}"
DATA="${DATA:-/opt/data}"
REPO="$DATA/sanity"
VENV="$DATA/sanity-venv"
HOME_DIR="$DATA/sanity-verifier"
SCRATCH="$HOME_DIR/scratch"
PY="$VENV/bin/python"

say() { printf '\n== %s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

# Run a shell script inside the container (as root, or as $1 with in_container_as).
# Values are passed as environment variables, never pasted into the script text.
in_container() { in_container_as root; }

in_container_as() {
  docker exec -i -u "$1" -e RUN_AS="$RUN_AS" \
    -e REPO="$REPO" -e VENV="$VENV" -e HOME_DIR="$HOME_DIR" -e SCRATCH="$SCRATCH" \
    -e PY="$PY" -e DATA="$DATA" -e SANITY_URL="$SANITY_URL" -e SANITY_REF="$SANITY_REF" \
    "$CONTAINER" sh -s
}

hermes_cmd() { docker exec "$CONTAINER" hermes "$@" 2>&1 | grep -v -i 'pnpm' || true; }

check_container() {
  command -v docker >/dev/null || die "docker not found"
  local state
  state="$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || true)"
  [ "$state" = "true" ] || die "container '$CONTAINER' is not running (docker start $CONTAINER)"
  RUN_AS="${HERMES_USER:-$(docker exec "$CONTAINER" stat -c %U "$DATA" 2>/dev/null || echo root)}"
}

install() {
  say "install: code at $REPO ($SANITY_REF), Python at $VENV, scratch at $SCRATCH"
  in_container <<'EOF'
set -eu
command -v git >/dev/null || { echo "git missing in container" >&2; exit 1; }
if [ -d "$REPO/.git" ]; then
  git -C "$REPO" fetch -q origin
else
  git clone -q "$SANITY_URL" "$REPO"
fi
git -C "$REPO" checkout -q --detach "origin/$SANITY_REF" 2>/dev/null || git -C "$REPO" checkout -q --detach "$SANITY_REF"
echo "code: $(git -C "$REPO" rev-parse --short HEAD) ($SANITY_REF)"
[ -x "$PY" ] || python3 -m venv "$VENV"
"$PY" -m pip install -q --disable-pip-version-check -r "$REPO/agents/verifier/requirements.txt"
"$PY" -c 'import sympy, jsonschema; print("python:", __import__("platform").python_version(), "sympy:", sympy.__version__)'
mkdir -p "$SCRATCH"
cat > "$SCRATCH/sanity.env" <<ENV
# Written by scripts/setup_verifier_docker.sh. Source this if SANITY_REPO is unset.
export SANITY_REPO="$REPO"
export SANITY_PYTHON="$PY"
ENV
chown -R "$RUN_AS:" "$HOME_DIR"
echo "scratch: $SCRATCH (sanity.env written, owned by $RUN_AS)"
EOF
}

selftest() {
  say "selftest: example run through intake -> verify_run -> bundle (inside the container, as $RUN_AS)"
  in_container_as "$RUN_AS" <<'EOF'
set -eu
T="$REPO/agents/verifier"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
EX="$REPO/runs/example-oscillator"
"$PY" "$T/intake.py" receive --scratch "$TMP" --slug example-oscillator --file "$EX/equations.json" >/dev/null
RUN="$TMP/example-oscillator/1"
cp "$EX"/verify/checks/*.py "$RUN/verify/checks/"
cp "$EX/verify/PLAN.md" "$RUN/verify/"
"$PY" "$T/conversation.py" add --dir "$RUN" --role verifier --kind note --text "selftest" >/dev/null
set +e
"$PY" "$T/verify_run.py" "$RUN/verify" >/dev/null
code=$?
set -e
[ "$code" = 1 ] || { echo "verify_run exit $code, expected 1 (two planted errors)" >&2; exit 1; }
"$PY" - "$RUN/verify/verdicts.json" <<'PYEOF'
import json, sys
data = json.load(open(sys.argv[1]))
got = {c["claim"]: c["verdict"] for c in data["claims"]}
want = {"1": "UNCHECKED", "2": "UNCHECKED", "3": "FAILS", "4": "FAILS", "5": "UNCHECKED"}
assert got == want, got
assert all(data["claims"][i]["correction"]["verified"] for i in (2, 3))
assert data["commit"] != "?", "code commit unknown"
print("verdicts ok: (3) and (4) FAILS with verified corrections; code", data["commit"])
PYEOF
OUT="$("$PY" "$T/bundle.py" build --dir "$RUN")"
B="$(printf '%s' "$OUT" | "$PY" -c 'import json,sys; d=json.load(sys.stdin); print(d["bundle"])')"
S="$(printf '%s' "$OUT" | "$PY" -c 'import json,sys; d=json.load(sys.stdin); print(d["sha256"])')"
"$PY" "$T/bundle.py" verify --bundle "$B" --sha256 "$S" >/dev/null
echo "bundle ok: $(basename "$B") $(printf '%s' "$S" | cut -c1-16)…"
echo "selftest passed"
EOF
}

configure() {
  say "configure: persona, skill, working folder, env vars (backups first)"
  in_container <<'EOF'
set -eu
[ -f "$REPO/agents/verifier/AGENT.md" ] || { echo "run install first" >&2; exit 1; }
stamp="$(date +%Y%m%d-%H%M%S)"
for f in SOUL.md config.yaml .env; do
  [ -f "$DATA/$f" ] && cp -p "$DATA/$f" "$DATA/$f.bak-$stamp"
done
echo "backups: $DATA/{SOUL.md,config.yaml,.env}.bak-$stamp"
cp "$REPO/agents/verifier/AGENT.md" "$DATA/SOUL.md"
echo "persona: SOUL.md <- agents/verifier/AGENT.md"
touch "$DATA/.env"
tmp="$(mktemp)"
grep -v -E '^(SANITY_REPO|SANITY_PYTHON|TELEGRAM_REQUIRE_MENTION)=' "$DATA/.env" > "$tmp" || true
printf 'SANITY_REPO=%s\nSANITY_PYTHON=%s\nTELEGRAM_REQUIRE_MENTION=true\n' "$REPO" "$PY" >> "$tmp"
cat "$tmp" > "$DATA/.env"
rm -f "$tmp"
echo ".env: SANITY_REPO, SANITY_PYTHON set; TELEGRAM_REQUIRE_MENTION=true (react only to @mentions and replies)"
EOF
  hermes_cmd config set terminal.cwd "$SCRATCH" >/dev/null
  hermes_cmd config set skills.external_dirs "[\"$REPO/skills\"]" >/dev/null
  hermes_cmd config set skills.auto_load '["verify-math"]' >/dev/null
  # Hermes' bot loop guard: by default a bot's reply to our message is not answered,
  # which would drop the Reader's answers to the Verifier's questions.
  hermes_cmd config set gateway.bot_loop_guard.bot_replies_expect_reply true >/dev/null
  hermes_cmd config set gateway.bot_loop_guard.max_hops 8 >/dev/null
  local cwd dirs load
  cwd="$(hermes_cmd config get terminal.cwd | tail -1)"
  dirs="$(hermes_cmd config get skills.external_dirs | tr -d '\n ')"
  load="$(hermes_cmd config get skills.auto_load | tr -d '\n ')"
  echo "config: terminal.cwd=$cwd  skills.external_dirs=$dirs  skills.auto_load=$load"
  [ "$cwd" = "$SCRATCH" ] || die "terminal.cwd was not set (got '$cwd'); edit config.yaml by hand"
  case "$dirs" in *"$REPO/skills"*) ;; *) die "skills.external_dirs was not set; edit config.yaml by hand" ;; esac
  case "$load" in *verify-math*) ;; *) die "skills.auto_load was not set; edit config.yaml by hand" ;; esac
  local expect hops
  expect="$(hermes_cmd config get gateway.bot_loop_guard.bot_replies_expect_reply | tail -1 | tr -d "' \"")"
  hops="$(hermes_cmd config get gateway.bot_loop_guard.max_hops | tail -1 | tr -d "' \"")"
  echo "config: gateway.bot_loop_guard.bot_replies_expect_reply=$expect  max_hops=$hops"
  case "$expect" in true|True) ;; *) die "bot_loop_guard.bot_replies_expect_reply was not set; edit config.yaml by hand" ;; esac
  [ "$hops" = "8" ] || die "bot_loop_guard.max_hops was not set (got '$hops'); edit config.yaml by hand"
  allowed_report
  say "restarting $CONTAINER so the gateway loads the new persona and config"
  docker restart "$CONTAINER" >/dev/null
  sleep 5
  docker ps --filter "name=^${CONTAINER}$" --format '{{.Names}}: {{.Status}}'
}

allowed_report() {
  in_container <<'EOF'
set -eu
n="$(sed -n 's/^TELEGRAM_ALLOWED_USERS=//p' "$DATA/.env" | tail -1 | tr ',' '\n' | grep -c . || true)"
echo "telegram: TELEGRAM_ALLOWED_USERS has $n ID(s)."
if [ "${n:-0}" -lt 6 ]; then
  echo "  It should list Ilkham, Konstantin, Lloyd, the Reader bot, the Writer bot and the group"
  echo "  (docs/telegram.md). Without the bot IDs, bot-to-bot handoffs are blocked."
fi
EOF
}

status() {
  say "status"
  in_container <<'EOF'
set -eu
if [ -d "$REPO/.git" ]; then echo "code: $(git -C "$REPO" rev-parse --short HEAD) $(git -C "$REPO" log -1 --format=%s | cut -c1-60)"; else echo "code: not installed"; fi
if [ -x "$PY" ]; then "$PY" -c 'import sympy; print("python env: sympy", sympy.__version__)'; else echo "python env: not installed"; fi
[ -d "$SCRATCH" ] && echo "scratch: $SCRATCH ($(ls "$SCRATCH" | grep -v sanity.env | wc -l | tr -d ' ') run folder(s), owner $(stat -c %U "$SCRATCH"))" || echo "scratch: missing"
if [ -d "$SCRATCH" ] && su -s /bin/sh "$RUN_AS" -c "test -w '$SCRATCH'" 2>/dev/null; then echo "scratch: writable by $RUN_AS"; else echo "scratch: NOT writable by $RUN_AS (run install again)"; fi
if cmp -s "$DATA/SOUL.md" "$REPO/agents/verifier/AGENT.md" 2>/dev/null; then echo "persona: Verifier (matches AGENT.md)"; else echo "persona: NOT the Verifier's AGENT.md"; fi
grep -q '^SANITY_REPO=' "$DATA/.env" 2>/dev/null && echo ".env: SANITY_REPO set" || echo ".env: SANITY_REPO missing"
EOF
  echo "config: terminal.cwd=$(hermes_cmd config get terminal.cwd | tail -1)"
  echo "config: skills.external_dirs=$(hermes_cmd config get skills.external_dirs | tr -d '\n ')"
  echo "config: skills.auto_load=$(hermes_cmd config get skills.auto_load | tr -d '\n ')"
  echo "config: gateway.bot_loop_guard.bot_replies_expect_reply=$(hermes_cmd config get gateway.bot_loop_guard.bot_replies_expect_reply | tail -1)  max_hops=$(hermes_cmd config get gateway.bot_loop_guard.max_hops | tail -1)"
  in_container <<'EOF2'
grep -q '^TELEGRAM_REQUIRE_MENTION=true' "$DATA/.env" 2>/dev/null && echo ".env: TELEGRAM_REQUIRE_MENTION=true" || echo ".env: TELEGRAM_REQUIRE_MENTION not true (the bot answers every group message)"
EOF2
  allowed_report
}

main() {
  local cmd="${1:-}"
  case "$cmd" in
    install|selftest|configure|status) check_container; "$cmd" ;;
    update) check_container; install ;;
    all) check_container; install; selftest; configure ;;
    *) awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"; exit 2 ;;
  esac
}

main "$@"
