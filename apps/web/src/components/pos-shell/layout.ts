/**
 * Canonical shell region metrics.
 *
 * Density pass (owner-approved 2026-08-20): every region below is now expressed
 * in the markup as a REM value, so the numbers here are the resolved pixel size
 * at the 16px root-font-size CEILING (>=1080px tall viewports). At shorter
 * viewports the root font size clamps down (see `globals.css`) and every region
 * shrinks proportionally — e.g. the header is 64px at 1920x1080, ~59px at
 * 1440x900 and 54px at 1280x680.
 *
 *   header            h-16          4rem
 *   readiness strip   top-16 / h-9  2.25rem
 *   main top padding  pt-[7.25rem]  7.25rem  (header + readiness + 1rem gap)
 *   bottom nav        h-16          4rem
 *   main bottom pad   5rem + safe-area
 */
export const operationalShellLayout = {
  bottomNavigationHeightPx: 64,
  contentBottomClearancePx: 80,
  contentTopPaddingPx: 116,
  headerHeightPx: 64,
  maxContentWidthPx: 1600,
  readinessHeightPx: 36,
} as const;
