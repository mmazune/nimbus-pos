#!/usr/bin/env bash
# The one command: a throwaway local database → migrated → seeded → validated → Tapas Downtown.
#
#   eval "$(tools/test-env.sh)"            # an empty throwaway database on localhost
#   packages/db/demo-venue/run.sh          # this script
#
# Refuses any DATABASE_URL / DIRECT_DATABASE_URL that is not localhost or not nimbus_event_*
# before anything runs. The sign-in table is printed once on stderr; do not redirect it to a file.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
db_dir="$(cd "$here/.." && pwd)"
root="$(cd "$db_dir/../.." && pwd)"

for name in DATABASE_URL DIRECT_DATABASE_URL; do
  value="${!name:-}"
  [ -n "$value" ] || { echo "demo-venue: refusing: $name is not set (eval \"\$(tools/test-env.sh)\" first)" >&2; exit 1; }
  "$root/tools/test-env.sh" --check "$value" >/dev/null 2>&1 || {
    echo "demo-venue: refusing: $name is not a localhost address" >&2; exit 1; }
done
case "$(node -e 'console.log(new URL(process.env.DATABASE_URL).pathname.slice(1))')" in
  nimbus_event_*) ;;
  *) echo "demo-venue: refusing: DATABASE_URL does not name a throwaway nimbus_event_* database" >&2; exit 1 ;;
esac

cd "$db_dir"
pnpm_() { corepack pnpm@8.15.0 "$@"; }
echo "== validate the data files"
pnpm_ exec ts-node --project tsconfig.seed.json demo-venue/validate.ts
echo "== migrate (prisma migrate deploy)"
pnpm_ exec prisma migrate deploy >/dev/null
echo "== seed roles and permissions (db:seed; it also makes its own small demo org)"
pnpm_ db:seed >/dev/null
echo "== load Tapas Downtown"
pnpm_ exec ts-node --project tsconfig.seed.json demo-venue/load.ts
