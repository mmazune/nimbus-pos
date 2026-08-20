/**
 * NimbusLogomark — the canonical Nimbus POS brand mark (abstracted steering
 * wheel), extracted from the Nimbus POS Brand Identity guide (Aug 2026).
 *
 * Renders with `currentColor` so token classes (e.g. `text-brand-navy-900`,
 * `text-brand-white`) drive its color — never hard-code hex at call sites.
 * This is a brand mark, not an operational icon: it is intentionally NOT part
 * of the `operationalIconNames` registry (see docs/BRAND_IDENTITY.md).
 */
type NimbusLogomarkProps = {
  /** Rendered width in px. Height follows the mark's intrinsic 349.5:232.13 ratio. */
  size?: number;
  className?: string;
  "aria-hidden"?: boolean;
};

const MARK_WIDTH = 349.5;
const MARK_HEIGHT = 232.13;

export function NimbusLogomark({ size = 24, className, "aria-hidden": ariaHidden }: NimbusLogomarkProps) {
  return (
    <svg
      viewBox={`0 0 ${MARK_WIDTH} ${MARK_HEIGHT}`}
      width={size}
      height={(size * MARK_HEIGHT) / MARK_WIDTH}
      className={className}
      role={ariaHidden ? undefined : "img"}
      aria-label={ariaHidden ? undefined : "Nimbus POS"}
      aria-hidden={ariaHidden}
      focusable="false"
    >
      <g fill="currentColor">
        <path d="M 3.531 64.312 L 25.711 21.383 C 27.641 17.645 31.066 14.902 35.137 13.836 L 85.738 0.582 C 87.961 0.000 89.828 2.328 88.773 4.371 L 53.566 72.523 C 52.137 75.285 51.949 78.523 53.047 81.434 L 86.406 169.828 C 87.523 172.785 87.332 176.078 85.883 178.887 L 58.379 232.125 L 21.539 134.516 L 2.402 83.809 C 0.000 77.445 0.410 70.355 3.531 64.312" />
        <path d="M 345.969 64.312 L 323.793 21.383 C 321.859 17.645 318.434 14.902 314.363 13.836 L 263.766 0.582 C 261.539 0.000 259.672 2.328 260.730 4.371 L 295.938 72.523 C 297.363 75.285 297.551 78.523 296.453 81.434 L 263.094 169.828 C 261.977 172.785 262.168 176.078 263.621 178.887 L 291.121 232.125 L 327.961 134.516 L 347.098 83.809 C 349.504 77.445 349.090 70.355 345.969 64.312" />
        <path d="M 248.047 86.512 L 231.047 136.160 C 226.559 149.223 214.281 158.012 200.449 158.012 L 150.840 158.012 C 137.031 158.012 124.734 149.223 120.242 136.160 L 103.246 86.512 C 96.055 65.527 111.648 43.695 133.824 43.695 L 217.465 43.695 C 239.645 43.695 255.238 65.527 248.047 86.512" />
      </g>
    </svg>
  );
}
