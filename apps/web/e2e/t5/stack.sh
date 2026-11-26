#!/usr/bin/env bash
# T5 — one browser run on a fresh demo venue, from one shell, with no credential in any file.
#
#   apps/web/e2e/t5/stack.sh <command…>       e.g.  stack.sh npx playwright test e2e/t5 --project=t5-1280
#
# In order, all inside this one process tree:
#   1. tools/test-env.sh makes an empty throwaway nimbus_event_* database on localhost.
#   2. packages/db/demo-venue/run.sh loads Tapas Downtown. Its sign-in table (stderr, shown once) is
#      read into a shell variable here, never written: it reaches the tests only as T5_SIGNIN in the
#      environment of the command below.
#   3. db:seed runs again so the venue's tables join the areas named after their floor plans (the
#      seed's own idempotent sweep, T2 report "For T4").
#   4. The built API (apps/api/dist) starts on :3001 with JWT secrets minted for this boot.
#   5. The command runs with PW_API_URL, PW_BRANCH_ID, T5_SIGNIN and T5_DB set.
#   6. The API this script started is stopped by its PID (rule 19).
# The web app must already be running on PW_BASE_URL (a production build; `next start`).
set -euo pipefail
root="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$root"

for v in DATABASE_URL DIRECT_DATABASE_URL; do unset "$v"; done
eval "$(tools/test-env.sh 2>/dev/null)"
db="$(node -e 'console.log(new URL(process.env.DATABASE_URL).pathname.slice(1))')"
echo "t5-stack: database $db" >&2

# The loader prints the sign-in table on stderr. Keep it in memory only.
exec 3>&1
signin_table="$(packages/db/demo-venue/run.sh 2>&1 1>&3 | cat)"
exec 3>&-
T5_SIGNIN="$(printf '%s\n' "$signin_table" | awk '
  /^  [a-z]+[0-9] / { key=$1; for (i=2;i<=NF;i++) if ($i ~ /@/) break;
                      email=$i; pw=$(i+1); pin=$(i+2); if (pin !~ /^[0-9]+$/) pin="";
                      printf "%s%s=%s|%s|%s", sep, key, email, pw, pin; sep="," }')"
unset signin_table
[ -n "$T5_SIGNIN" ] || { echo "t5-stack: no sign-in table came back from the loader" >&2; exit 1; }

(cd packages/db && corepack pnpm@8.15.0 db:seed >/dev/null)
branch="$(su postgres -c "psql -d $db -tAc \"select id from branches where slug='tapas-downtown'\"" | tr -d '[:space:]')"
no_area="$(su postgres -c "psql -d $db -tAc \"select count(*) from tables where branch_id='$branch' and area_id is null\"" | tr -d '[:space:]')"
[ "$no_area" = "0" ] || { echo "t5-stack: $no_area venue tables have no area" >&2; exit 1; }

export JWT_ACCESS_SECRET="$(openssl rand -hex 32)" JWT_REFRESH_SECRET="$(openssl rand -hex 32)"
export API_PORT=3001 API_CORS_ORIGINS="${PW_BASE_URL:-http://localhost:3100}"
(cd apps/api && exec node dist/main.js) > "${T5_API_LOG:-/dev/null}" 2>&1 &
api_pid=$!
trap 'kill "$api_pid" 2>/dev/null || true; wait "$api_pid" 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do
  curl -sf http://localhost:3001/api/health >/dev/null 2>&1 && break
  sleep 1
done
curl -sf http://localhost:3001/api/health >/dev/null || { echo "t5-stack: the API did not come up" >&2; exit 1; }
unset JWT_ACCESS_SECRET JWT_REFRESH_SECRET DATABASE_URL DIRECT_DATABASE_URL
echo "t5-stack: API pid $api_pid on :3001, branch $branch" >&2

export PW_API_URL=http://localhost:3001 PW_BRANCH_ID="$branch" T5_SIGNIN T5_DB="$db"
cd "$root/apps/web"
"$@"
