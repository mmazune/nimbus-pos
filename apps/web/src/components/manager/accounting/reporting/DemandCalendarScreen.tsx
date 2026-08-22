import { useMemo, useState } from "react";

import {
  AccountingCheckboxField,
  AccountingFormError,
  AccountingSelectField,
  AccountingTextField,
  AccountingUnpaginatedNote,
} from "@/components/manager/accounting/shared";
import {
  ManagerContentShell,
  ManagerControlPanel,
  ManagerListTable,
  type ManagerListColumn,
} from "@/components/manager/chrome";
import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { Badge, Button } from "@/components/ui";
import {
  formatAccountingDate,
  isDemandCalendarWindowValid,
  titleCaseAccountingStatus,
} from "@/lib/accounting/model";
import {
  DAYPART_TYPES,
  DEMAND_CALENDAR_TYPES,
  type DemandCalendarEntryRow,
} from "@/lib/accounting/types";
import {
  useCreateDemandCalendarEntry,
  useDemandCalendarList,
  useUpdateDemandCalendarEntry,
} from "@/lib/manager/accounting-configuration-queries";

type DraftEntry = {
  calendarType: string;
  daypart: string;
  title: string;
  dateStart: string;
  dateEnd: string;
  expectedCovers: string;
  notes: string;
  isActive: boolean;
};

const EMPTY_DRAFT: DraftEntry = {
  calendarType: DEMAND_CALENDAR_TYPES[0],
  daypart: "ALL_DAY",
  title: "",
  dateStart: "",
  dateEnd: "",
  expectedCovers: "",
  notes: "",
  isActive: true,
};

function toDraft(entry: DemandCalendarEntryRow): DraftEntry {
  return {
    calendarType: entry.calendarType || DEMAND_CALENDAR_TYPES[0],
    daypart: entry.daypart || "ALL_DAY",
    title: entry.title || "",
    dateStart: (entry.dateStart || "").slice(0, 10),
    dateEnd: (entry.dateEnd || "").slice(0, 10),
    expectedCovers: entry.expectedCovers != null ? String(entry.expectedCovers) : "",
    notes: entry.notes || "",
    isActive: entry.isActive !== false,
  };
}

/**
 * Accounting → Reporting → Demand calendar — Track B5.6 (2026-08-22).
 *
 * `GET /finance/demand-calendar` is a PC-06 bare array. **Write-enabled**
 * (PERMS-2): full create/edit/archive. There is a real hard `DELETE` route,
 * but it is deliberately never called from this screen — a deleted entry can
 * leave a dangling id inside a persisted `ForecastRun.assumptions
 * .calendarEntriesUsed` JSON blob (no FK, so nothing enforces referential
 * integrity there). Archive (`PATCH {isActive:false}`) is the only
 * destructive affordance, confirmed before it runs.
 */
export function DemandCalendarScreen() {
  const listQuery = useDemandCalendarList({});
  const createMutation = useCreateDemandCalendarEntry();
  const updateMutation = useUpdateDemandCalendarEntry();

  const [formOpen, setFormOpen] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftEntry>({ ...EMPTY_DRAFT });
  const [formError, setFormError] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<DemandCalendarEntryRow | null>(null);

  const rows = useMemo(() => listQuery.data || [], [listQuery.data]);
  const count = Array.isArray(listQuery.data) ? listQuery.data.length : null;

  const windowValid = isDemandCalendarWindowValid(draft.dateStart, draft.dateEnd);
  const formValid = draft.title.trim().length > 0 && windowValid === true;

  function openCreate() {
    setDraft({ ...EMPTY_DRAFT });
    setEditingId(null);
    setFormError(null);
    setFormOpen("create");
  }

  function openEdit(row: DemandCalendarEntryRow) {
    setDraft(toDraft(row));
    setEditingId(row.id);
    setFormError(null);
    setFormOpen("edit");
  }

  async function submit() {
    setFormError(null);
    const payload = {
      calendarType: draft.calendarType,
      daypart: draft.daypart,
      title: draft.title.trim(),
      dateStart: draft.dateStart,
      dateEnd: draft.dateEnd,
      expectedCovers: draft.expectedCovers ? Number(draft.expectedCovers) : undefined,
      notes: draft.notes.trim() || undefined,
    };
    try {
      if (formOpen === "edit" && editingId) {
        await updateMutation.mutateAsync({ id: editingId, payload: { ...payload, isActive: draft.isActive } });
      } else {
        await createMutation.mutateAsync(payload);
      }
      setFormOpen(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "This entry could not be saved. Retry.");
    }
  }

  async function submitArchive() {
    if (!archiveTarget) return;
    try {
      await updateMutation.mutateAsync({ id: archiveTarget.id, payload: { isActive: false } });
      setArchiveTarget(null);
    } catch {
      // Error surfaces via updateMutation.error, rendered inside the dialog below.
    }
  }

  const columns: ManagerListColumn<DemandCalendarEntryRow>[] = useMemo(
    () => [
      { key: "title", header: "Title", render: (row) => row.title },
      { key: "type", header: "Type", render: (row) => titleCaseAccountingStatus(row.calendarType) },
      { key: "daypart", header: "Daypart", optional: true, render: (row) => titleCaseAccountingStatus(row.daypart) },
      {
        key: "window",
        header: "Window",
        render: (row) => `${formatAccountingDate(row.dateStart)} – ${formatAccountingDate(row.dateEnd)}`,
      },
      {
        key: "covers",
        header: "Expected covers",
        numeric: true,
        optional: true,
        render: (row) => (row.expectedCovers != null ? String(row.expectedCovers) : "—"),
      },
      {
        key: "active",
        header: "Status",
        render: (row) => <Badge variant={row.isActive ? "success" : "neutral"}>{row.isActive ? "Active" : "Archived"}</Badge>,
      },
      {
        key: "actions",
        header: "Actions",
        render: (row) => (
          <div className="flex gap-2">
            <Button variant="secondary" size="compact" onClick={() => openEdit(row)}>
              Edit
            </Button>
            <Button
              variant="tertiary"
              size="compact"
              disabled={!row.isActive}
              onClick={() => setArchiveTarget(row)}
            >
              Archive
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Demand calendar"
        badge={<Badge variant="info">Read + write</Badge>}
        primaryAction={
          <Button variant="primary" size="compact" onClick={openCreate}>
            New entry
          </Button>
        }
      />

      <ManagerListTable
        caption="Demand calendar entries"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        onRetry={() => void listQuery.refetch()}
        errorMessage="The demand calendar could not be read for this branch. Retry."
        emptyTitle="No demand calendar entries"
        emptyMessage="No demand event has been recorded for this branch yet."
      />

      <p className="text-xs leading-5 text-text-muted">
        <AccountingUnpaginatedNote label={`Showing all ${count ?? "?"} entries`} /> Archiving sets this
        entry inactive rather than deleting it — a hard delete can leave a dangling reference inside an
        already-generated forecast, so this screen never issues one.
      </p>

      <ActionConfirmDialog
        open={formOpen !== null}
        title={formOpen === "edit" ? "Edit demand calendar entry" : "New demand calendar entry"}
        consequence={
          formOpen === "edit"
            ? "Saves the changes below to this entry."
            : "Creates a new demand calendar entry for this branch."
        }
        size="lg"
        tone="info"
        confirmLabel={formOpen === "edit" ? "Save changes" : "Create entry"}
        pending={createMutation.isPending || updateMutation.isPending}
        confirmDisabled={!formValid}
        error={formError}
        onCancel={() => setFormOpen(null)}
        onConfirm={() => void submit()}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <AccountingTextField
            label="Title"
            required
            value={draft.title}
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          />
          <AccountingSelectField
            label="Calendar type"
            value={draft.calendarType}
            onChange={(event) => setDraft((current) => ({ ...current, calendarType: event.target.value }))}
          >
            {DEMAND_CALENDAR_TYPES.map((type) => (
              <option key={type} value={type}>
                {titleCaseAccountingStatus(type)}
              </option>
            ))}
          </AccountingSelectField>
          <AccountingSelectField
            label="Daypart"
            value={draft.daypart}
            onChange={(event) => setDraft((current) => ({ ...current, daypart: event.target.value }))}
          >
            {DAYPART_TYPES.map((daypart) => (
              <option key={daypart} value={daypart}>
                {titleCaseAccountingStatus(daypart)}
              </option>
            ))}
          </AccountingSelectField>
          <AccountingTextField
            label="Expected covers"
            type="number"
            min="0"
            value={draft.expectedCovers}
            onChange={(event) => setDraft((current) => ({ ...current, expectedCovers: event.target.value }))}
          />
          <AccountingTextField
            label="Date start"
            required
            type="date"
            value={draft.dateStart}
            onChange={(event) => setDraft((current) => ({ ...current, dateStart: event.target.value }))}
          />
          <AccountingTextField
            label="Date end"
            required
            type="date"
            value={draft.dateEnd}
            onChange={(event) => setDraft((current) => ({ ...current, dateEnd: event.target.value }))}
            hint={windowValid === false ? "Date end must be on or after date start." : undefined}
          />
        </div>
        <AccountingTextField
          label="Notes"
          value={draft.notes}
          onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
        />
        {formOpen === "edit" ? (
          <AccountingCheckboxField
            label="Active"
            hint="Uncheck to archive this entry without using the Archive action separately."
            checked={draft.isActive}
            onChange={(checked) => setDraft((current) => ({ ...current, isActive: checked }))}
          />
        ) : null}
        {windowValid === false ? <AccountingFormError message="Date end must be on or after date start." /> : null}
      </ActionConfirmDialog>

      <ActionConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archive this entry?"
        consequence={`"${archiveTarget?.title || "This entry"}" stops appearing in active demand-calendar reads (isActive: false). It is not deleted and can be reactivated by editing it again.`}
        tone="warning"
        confirmLabel="Archive"
        pending={updateMutation.isPending}
        error={updateMutation.error instanceof Error ? updateMutation.error.message : null}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => void submitArchive()}
      />
    </ManagerContentShell>
  );
}
