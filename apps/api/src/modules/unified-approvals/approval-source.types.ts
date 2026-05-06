/**
 * BG2 — Unified Approvals Inbox
 *
 * Approval source registry. Each entry maps an opaque "approval type"
 * to the underlying domain entity that already owns the real approval
 * lifecycle. The inbox NEVER duplicates business rules; it merely
 * aggregates pending rows and routes decide() back to the source service.
 */

export type ApprovalSourceType =
    | 'discount'
    | 'refund'
    | 'leave_request'
    | 'shift_swap'
    | 'vendor_bill'
    | 'inter_branch_transfer';

export type ApprovalDomain = 'POS' | 'FINANCE' | 'HR';

export interface ApprovalSourceMapping {
    type: ApprovalSourceType;
    domain: ApprovalDomain;
    /** Prisma model accessor name on PrismaService (e.g. 'discount'). */
    prismaModel:
    | 'discount'
    | 'refund'
    | 'leaveRequest'
    | 'shiftSwapRequest'
    | 'vendorBill'
    | 'interBranchTransfer';
    /** Status values that count as "pending review" for this source. */
    pendingStatuses: readonly string[];
    /** Whether the source is scoped by branch (true) or only by org (false). */
    branchScoped: boolean;
    /** Whether maintenance/training mode would normally affect writes here.
     *  Informational — BG2 does NOT block decisions; M42 owns enforcement. */
    maintenanceSensitive: boolean;
    /** Whether the underlying service supports a real REJECT path. */
    supportsReject: boolean;
    /** Permission required to decide via the inbox. */
    decidePermission: string;
    /** Human label shown in inbox rows. */
    label: string;
    /** Source module short name (for UI grouping). */
    sourceModule: string;
}

/** Compound approval id format used by the inbox: `${type}--${entityId}`. */
export const APPROVAL_ID_SEPARATOR = '--';

export function encodeApprovalId(type: ApprovalSourceType, entityId: string): string {
    return `${type}${APPROVAL_ID_SEPARATOR}${entityId}`;
}

export interface DecodedApprovalId {
    type: ApprovalSourceType;
    entityId: string;
}

export function decodeApprovalId(id: string): DecodedApprovalId | null {
    const idx = id.indexOf(APPROVAL_ID_SEPARATOR);
    if (idx <= 0 || idx >= id.length - APPROVAL_ID_SEPARATOR.length) return null;
    const type = id.substring(0, idx) as ApprovalSourceType;
    const entityId = id.substring(idx + APPROVAL_ID_SEPARATOR.length);
    if (!APPROVAL_SOURCE_REGISTRY.find((s) => s.type === type)) return null;
    if (!entityId) return null;
    return { type, entityId };
}

/**
 * The canonical BG2 source registry. Sources NOT listed here are explicitly
 * out of scope (see BG2_COMPLETION_REPORT.md "Approval Source Mapping").
 *
 * Excluded on purpose:
 *   - order_void / post_close_void: direct state change, no PENDING row
 *   - purchase_order:               no real approval state in code yet
 */
export const APPROVAL_SOURCE_REGISTRY: readonly ApprovalSourceMapping[] = [
    {
        type: 'discount',
        domain: 'POS',
        prismaModel: 'discount',
        pendingStatuses: ['PENDING'],
        branchScoped: true,
        maintenanceSensitive: true,
        supportsReject: true,
        decidePermission: 'pos:discount:approve',
        label: 'Discount approval',
        sourceModule: 'discounts',
    },
    {
        type: 'refund',
        domain: 'POS',
        prismaModel: 'refund',
        pendingStatuses: ['PENDING'],
        branchScoped: true,
        maintenanceSensitive: true,
        // Underlying RefundsService has no native reject method in M14;
        // documented in BG2 completion report. Inbox will return 400 if reject
        // is requested for refund.
        supportsReject: false,
        decidePermission: 'pos:refund:approve',
        label: 'Refund approval',
        sourceModule: 'refunds',
    },
    {
        type: 'leave_request',
        domain: 'HR',
        prismaModel: 'leaveRequest',
        pendingStatuses: ['PENDING'],
        branchScoped: false, // org-scoped on the model side
        maintenanceSensitive: false,
        supportsReject: true,
        decidePermission: 'pos:hr:leave:review',
        label: 'Leave request',
        sourceModule: 'attendance',
    },
    {
        type: 'shift_swap',
        domain: 'HR',
        prismaModel: 'shiftSwapRequest',
        pendingStatuses: ['PENDING'],
        branchScoped: true,
        maintenanceSensitive: false,
        supportsReject: true,
        decidePermission: 'pos:hr:shift-swaps:approve',
        label: 'Shift swap',
        sourceModule: 'attendance',
    },
    {
        type: 'vendor_bill',
        domain: 'FINANCE',
        prismaModel: 'vendorBill',
        // VendorBill uses DRAFT as the pending state (DRAFT -> APPROVED).
        pendingStatuses: ['DRAFT'],
        branchScoped: false,
        maintenanceSensitive: true,
        // AccountsPayableService.approveVendorBill is approve-only in M34.
        supportsReject: false,
        decidePermission: 'accounting:ap:bill:approve',
        label: 'Vendor bill',
        sourceModule: 'accounts-payable',
    },
    {
        type: 'inter_branch_transfer',
        domain: 'FINANCE',
        prismaModel: 'interBranchTransfer',
        pendingStatuses: ['REQUESTED'],
        branchScoped: false,
        maintenanceSensitive: false,
        supportsReject: true,
        decidePermission: 'franchise:transfer:approve',
        label: 'Inter-branch transfer',
        sourceModule: 'franchise',
    },
] as const;

export function findSource(type: ApprovalSourceType): ApprovalSourceMapping | undefined {
    return APPROVAL_SOURCE_REGISTRY.find((s) => s.type === type);
}
