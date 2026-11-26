#!/usr/bin/env bash
# T6 — proof that the corrected E1 migration applies to a database built by the pre-E1 code
# with lines already on two kitchen tickets, and stamps the right sent times.
#
#   tools/probes/e1-correction-proof.sh <old-worktree> <new-worktree>
#
# <old-worktree>: a checkout of origin/rebuild/main 0af95f8 (before E1) with node_modules and
# tools/probes/base-double-send.e2e-spec.ts.txt copied to apps/api/test/base-double-send.e2e-spec.ts.
# <new-worktree>: this branch. Everything runs on a fresh throwaway database in this container.
set -euo pipefail
old="${1:?old worktree}"; new="${2:?new worktree}"
eval "$("$new/tools/test-env.sh")"
db="${DATABASE_URL##*/}"; db="${db%%\?*}"
q() { su postgres -c "psql -X -q -A -F' ' -t -d $db -c \"$1\""; }

echo "== 1. build the database with the OLD code (migrate deploy + seed at $(git -C "$old" rev-parse --short HEAD))"
(cd "$old/packages/db" && npx prisma migrate deploy >/dev/null && npx ts-node --project tsconfig.seed.json prisma/seed.ts >/dev/null)
q "select count(*) from _prisma_migrations where migration_name like '%e1_order_truth%'" | sed 's/^/   e1 migration rows before: /'

echo "== 2. the OLD code sends 30 orders twice at once (its own concurrent-send race)"
(cd "$old/apps/api" && npx jest --config ./test/jest-e2e.json base-double-send --forceExit 2>&1 | grep -o 'DUP_RESULT.*' | sed 's/^/   /')

echo "== 3. two more states the old code leaves: a line added after the first send (never ticketed),"
echo "      and a no-station line on a sent order"
# the old seed has no no-station item: mark one item that no probe line uses as NONE
q "UPDATE menu_items SET station='NONE' WHERE id = (SELECT id FROM menu_items WHERE station <> 'NONE' AND id NOT IN (SELECT menu_item_id FROM order_items) ORDER BY created_at LIMIT 1)" >/dev/null
q "WITH o AS (SELECT oi.order_id, o.org_id FROM kds_ticket_items ti JOIN order_items oi ON oi.id=ti.order_item_id JOIN orders o ON o.id=oi.order_id ORDER BY ti.created_at LIMIT 1),
      m AS (SELECT id, price FROM menu_items WHERE station='KITCHEN' AND is_active ORDER BY created_at LIMIT 1),
      n AS (SELECT id, price FROM menu_items WHERE station='NONE' ORDER BY created_at LIMIT 1)
 INSERT INTO order_items (id, order_id, menu_item_id, quantity, price, subtotal, created_at, updated_at)
 SELECT 'proof_after_send', o.order_id, m.id, 1, m.price, m.price, now(), now() FROM o, m
 UNION ALL SELECT 'proof_no_station', o.order_id, n.id, 1, n.price, n.price, now(), now() FROM o, n" >/dev/null
q "select 'lines on two or more tickets: ' || count(*) from (select order_item_id from kds_ticket_items group by 1 having count(*) > 1) d" | sed 's/^/   /'
q "select 'ticket item rows: ' || count(*) from kds_ticket_items" | sed 's/^/   /'
dups_before="$(q "select coalesce(sum(n-1),0) from (select count(*) n from kds_ticket_items group by order_item_id having count(*)>1) d")"

echo "== 4. control: the ORIGINAL E1 migration (git 19e1eee) on a copy of this database"
su postgres -c "psql -X -q -c 'CREATE DATABASE ${db}_orig TEMPLATE $db'"
git -C "$new" show 19e1eee:packages/db/prisma/migrations/20261126000000_e1_order_truth/migration.sql > /tmp/e1_orig_$$.sql
chmod 644 /tmp/e1_orig_$$.sql
if su postgres -c "psql -X -v ON_ERROR_STOP=1 -q -1 -d ${db}_orig -f /tmp/e1_orig_$$.sql" >/tmp/e1_orig_$$.out 2>&1; then
  echo "   original: applied (unexpected)"
else
  echo "   original: ABORTED — $(grep -o 'could not create unique index.*' /tmp/e1_orig_$$.out | head -1)"
fi
rm -f /tmp/e1_orig_$$.sql /tmp/e1_orig_$$.out
su postgres -c "psql -X -q -c 'DROP DATABASE ${db}_orig'"

echo "== 5. the corrected chain: prisma migrate deploy from this branch"
(cd "$new/packages/db" && npx prisma migrate deploy 2>&1 | grep -E 'applied|Applying|Error' | sed 's/^/   /')

echo "== 6. after"
q "select 'lines on two or more tickets: ' || count(*) from (select order_item_id from kds_ticket_items group by 1 having count(*) > 1) d" | sed 's/^/   /'
q "select 'rows set aside: ' || count(*) || ' (expected $dups_before)' from kds_ticket_items_set_aside" | sed 's/^/   /'
q "select 'set-aside rows whose kept twin is still live: ' || count(*) from kds_ticket_items_set_aside sa join kds_ticket_items ti on ti.id = sa.kept_id and ti.order_item_id = sa.order_item_id" | sed 's/^/   /'
q "select 'ticketed lines whose sent_at = their ticket time: ' || count(*) filter (where oi.sent_at = ti.created_at) || ' of ' || count(*) from kds_ticket_items ti join order_items oi on oi.id = ti.order_item_id" | sed 's/^/   /'
q "select 'ticketed lines whose sent_at = the order''s last update (the old, wrong stamp): ' || count(*) filter (where oi.sent_at = o.updated_at and o.updated_at <> ti.created_at) from kds_ticket_items ti join order_items oi on oi.id=ti.order_item_id join orders o on o.id=oi.order_id" | sed 's/^/   /'
q "select id || ': ' || case when sent_at is null then 'unsent' else 'sent' end from order_items where id like 'proof_%' order by id" | sed 's/^/   /'
q "select 'lines of NEW orders stamped sent: ' || count(*) from order_items oi join orders o on o.id=oi.order_id where o.status='NEW' and oi.sent_at is not null" | sed 's/^/   /'
echo "   database: $db (throwaway, localhost)"
