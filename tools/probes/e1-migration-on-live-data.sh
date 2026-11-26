#!/usr/bin/env bash
# R-E1 probe: the E1 migration on a database that already holds sent and unsent orders.
#
#   tools/probes/e1-migration-on-live-data.sh <template-db> <migration.sql>
#
# <template-db> is a throwaway nimbus_event_* database in this container, migrated and seeded
# with the code at origin/rebuild/main (before E1). The script clones it, writes into the clone
# three states the pre-E1 code can produce, applies the E1 migration SQL with psql, and reports:
#   A. a line added to an order after its first send (pre-E1 allowed it and never ticketed it)
#   B. an order voided while still NEW, with a line (never sent)
#   C. one order line on two kitchen tickets (pre-E1 ticketing was check-then-insert, run by
#      every concurrent send, so two sends fired together could ticket a line twice)
# Expected of a correct migration: A stays unsent (no ticket), B stays unsent, C does not
# abort the deploy. It runs only on localhost through the container's own postgres user.
set -euo pipefail
tpl="${1:?template db}"; sql="${2:?migration sql}"
case "$tpl" in nimbus_event_*) ;; *) echo "refusing: $tpl is not a nimbus_event_* database" >&2; exit 1 ;; esac
[ -f "$sql" ] || { echo "no such file: $sql" >&2; exit 1; }
psql_() { su postgres -c "psql -X -v ON_ERROR_STOP=1 -q -d $1" ; }

run_case() {
  local name="$1" with_dup="$2" db="nimbus_event_mig_$(od -An -N3 -tx1 /dev/urandom | tr -d ' \n')"
  su postgres -c "psql -X -q -c 'CREATE DATABASE $db TEMPLATE $tpl'"
  psql_ "$db" <<SQL
-- A: order sent, then a second line added after the send (pre-E1 code path), no ticket for it
WITH b AS (SELECT id, organization_id FROM branches ORDER BY created_at LIMIT 1),
     u AS (SELECT id FROM users ORDER BY created_at LIMIT 1),
     m AS (SELECT id, price FROM menu_items WHERE station = 'KITCHEN' ORDER BY created_at LIMIT 1),
     o AS (INSERT INTO orders (id, org_id, branch_id, user_id, order_number, status, service_type, subtotal, total, created_at, updated_at)
           SELECT 'probe_order_a', b.organization_id, b.id, u.id, 'PROBE-A', 'SENT', 'TAKEAWAY', m.price*2, m.price*2, now(), now() FROM b, u, m RETURNING id, branch_id, org_id)
INSERT INTO order_items (id, order_id, menu_item_id, quantity, price, subtotal, created_at, updated_at)
SELECT x.id, o.id, m.id, 1, m.price, m.price, now(), now() FROM o, m, (VALUES ('probe_line_a1'), ('probe_line_a2_after_send')) x(id);
INSERT INTO kds_tickets (id, org_id, branch_id, order_id, station, status, created_at, updated_at)
SELECT 'probe_ticket_a', org_id, branch_id, id, 'KITCHEN', 'QUEUED', now(), now() FROM orders WHERE id = 'probe_order_a';
INSERT INTO kds_ticket_items (id, ticket_id, order_item_id) VALUES ('probe_ti_a1', 'probe_ticket_a', 'probe_line_a1');
-- B: order voided while NEW, one line, never sent
INSERT INTO orders (id, org_id, branch_id, user_id, order_number, status, service_type, subtotal, total, created_at, updated_at)
SELECT 'probe_order_b', org_id, branch_id, user_id, 'PROBE-B', 'VOIDED', 'TAKEAWAY', 0, 0, now(), now() FROM orders WHERE id = 'probe_order_a';
INSERT INTO order_items (id, order_id, menu_item_id, quantity, price, subtotal, created_at, updated_at)
SELECT 'probe_line_b1', 'probe_order_b', menu_item_id, 1, price, price, now(), now() FROM order_items WHERE id = 'probe_line_a1';
SQL
  if [ "$with_dup" = 1 ]; then
    psql_ "$db" <<SQL
-- C: the same line on a second ticket, as two concurrent pre-E1 sends could leave it
INSERT INTO kds_tickets (id, org_id, branch_id, order_id, station, status, created_at, updated_at)
SELECT 'probe_ticket_c', org_id, branch_id, order_id, station, status, now(), now() FROM kds_tickets WHERE id = 'probe_ticket_a';
INSERT INTO kds_ticket_items (id, ticket_id, order_item_id) VALUES ('probe_ti_c1', 'probe_ticket_c', 'probe_line_a1');
SQL
  fi
  echo "== case $name: apply the E1 migration"
  if su postgres -c "psql -X -v ON_ERROR_STOP=1 -q -1 -d $db -f $sql" 2>&1 | sed 's/^/   /'; then
    echo "   migration: applied"
    su postgres -c "psql -X -q -A -F' ' -d $db -c \"SELECT id, CASE WHEN sent_at IS NULL THEN 'unsent' ELSE 'SENT' END AS after_backfill, EXISTS (SELECT 1 FROM kds_ticket_items t WHERE t.order_item_id = i.id) AS has_ticket FROM order_items i WHERE id LIKE 'probe_%' ORDER BY id\"" | sed 's/^/   /'
  else
    echo "   migration: ABORTED (the deploy stops here; nothing of E1 is applied)"
  fi
  su postgres -c "psql -X -q -c 'DROP DATABASE $db'"
}

run_case "A+B (no duplicate ticket line)" 0
run_case "A+B+C (a line already on two tickets)" 1
