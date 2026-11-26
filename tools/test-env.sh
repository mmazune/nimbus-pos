#!/usr/bin/env bash
# tools/test-env.sh — a throwaway test database inside this container, and nothing else.
#
#   eval "$(tools/test-env.sh)"            # Postgres only
#   eval "$(tools/test-env.sh --redis)"    # Postgres and Redis (for suites that need a queue)
#   eval "$(tools/test-env.sh --reuse nimbus_event_ab12cd34)"
#                                          # an existing throwaway db: new password, same exports
#   tools/test-env.sh --check "<url>"      # only run the localhost guard on one address
#
# What it does, in order:
#   1. Refuses to go on if DATABASE_URL or DIRECT_DATABASE_URL already in the shell points
#      anywhere but localhost / 127.0.0.1 / ::1. Nothing is started in that case.
#   2. Starts the container's own Postgres (service postgresql) if it is not running, and
#      Redis on 127.0.0.1:6379 if --redis is given and nothing answers there.
#   3. Makes one login role with a password drawn at random for this run, and one empty
#      database named nimbus_event_<random> owned by it.
#   4. Prints the two shell exports on stdout. They are meant for `eval`, never for a file.
#
# It does not migrate, seed, read or write any .env file, or touch any remote host.
# The password exists only in the printed export lines and in Postgres itself.
set -euo pipefail

say() { printf '%s\n' "$*" >&2; }
die() { say "test-env: $*"; exit 1; }

# Accepts only a postgres URL whose host is local. Never echoes the URL (it may hold a secret).
assert_local() {
  local name="$1" url="$2" rest host
  [ -z "$url" ] && return 0
  case "$url" in
    postgres://*|postgresql://*) ;;
    *) die "refusing: $name is not a postgres URL" ;;
  esac
  rest="${url#*://}"
  rest="${rest#*@}"                        # drop user:password@ if present
  case "$rest" in
    \[*) host="${rest#\[}"; host="${host%%]*}" ;;
    *)   host="${rest%%[:/?]*}" ;;
  esac
  case "$host" in
    localhost|127.0.0.1|::1) return 0 ;;
    *) die "refusing: $name points at host \"$host\", which is not localhost" ;;
  esac
}

want_redis=0
reuse_db=""
case "${1:-}" in
  --reuse)
    reuse_db="${2:-}"
    case "$reuse_db" in nimbus_event_*) ;; *) die "--reuse takes a nimbus_event_* database name" ;; esac ;;
  --check)
    assert_local "the given address" "${2:-}"
    [ -z "${2:-}" ] && die "--check needs an address"
    say "test-env: local address, accepted"
    exit 0 ;;
  --redis) want_redis=1 ;;
  "") ;;
  *) die "unknown option ${1}" ;;
esac

assert_local DATABASE_URL "${DATABASE_URL:-}"
assert_local DIRECT_DATABASE_URL "${DIRECT_DATABASE_URL:-}"

command -v psql >/dev/null || die "psql is not installed in this container"

# 2. Postgres (the container's own cluster), then Redis if asked.
if ! su postgres -c "psql -tAc 'select 1'" >/dev/null 2>&1; then
  service postgresql start >/dev/null 2>&1 || die "could not start the container's Postgres"
  for _ in $(seq 1 30); do
    su postgres -c "psql -tAc 'select 1'" >/dev/null 2>&1 && break
    sleep 1
  done
  su postgres -c "psql -tAc 'select 1'" >/dev/null 2>&1 || die "Postgres did not come up"
  say "test-env: started the container's Postgres"
fi
port="$(su postgres -c "psql -tAc 'show port'" | tr -d '[:space:]')"

if [ "$want_redis" = 1 ]; then
  if ! (command -v redis-cli >/dev/null && redis-cli -h 127.0.0.1 -p 6379 ping >/dev/null 2>&1); then
    command -v redis-server >/dev/null || die "redis-server is not installed in this container"
    redis-server --bind 127.0.0.1 --port 6379 --daemonize yes --save '' --appendonly no >/dev/null
    say "test-env: started Redis on 127.0.0.1:6379 (stop it with: redis-cli -p 6379 shutdown nosave)"
  fi
fi

secret="$(od -An -N18 -tx1 /dev/urandom | tr -d ' \n')"
if [ -n "$reuse_db" ]; then
  # An existing throwaway database from an earlier run: give its role a new password and
  # print the exports again, so the password never has to be kept anywhere between shells.
  role="$(su postgres -c "psql -tAc \"select pg_get_userbyid(datdba) from pg_database where datname = '${reuse_db}'\"" | tr -d '[:space:]')"
  [ -n "$role" ] || die "no database named ${reuse_db} in this container"
  case "$role" in nimbus_t_*) ;; *) die "refusing: ${reuse_db} is not owned by a test-env role" ;; esac
  su postgres -c "psql -v ON_ERROR_STOP=1 -q" >/dev/null <<SQL
ALTER ROLE "${role}" PASSWORD '${secret}';
SQL
  db="$reuse_db"
  say "test-env: reusing ${db} on localhost:${port} (role ${role}, new password)"
else
  # 3. A role and an empty database, both named for this run.
  suffix="$(od -An -N4 -tx1 /dev/urandom | tr -d ' \n')"
  role="nimbus_t_${suffix}"
  db="nimbus_event_${suffix}"
  su postgres -c "psql -v ON_ERROR_STOP=1 -q" >/dev/null <<SQL
CREATE ROLE "${role}" LOGIN CREATEDB PASSWORD '${secret}';
CREATE DATABASE "${db}" OWNER "${role}";
SQL
  say "test-env: empty database ${db} on localhost:${port} (role ${role})"
fi

# 4. The only output on stdout: two exports for eval.
url="postgresql://${role}:${secret}@localhost:${port}/${db}?schema=public"
printf 'export DATABASE_URL=%q\n' "$url"
printf 'export DIRECT_DATABASE_URL=%q\n' "$url"
