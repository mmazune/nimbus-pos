import {
  operationalIcons,
  operationalIconSizes,
  operationalIconWeights,
  type OperationalIconName,
} from "@/components/pos-shell/role-icons";

export type KitIconSize = "inButton" | "default" | "bar";

const SIZE: Record<KitIconSize, number> = {
  inButton: operationalIconSizes.kitInButton,
  default: operationalIconSizes.kitDefault,
  bar: operationalIconSizes.kitBar,
};

export type KitIconProps = {
  name: OperationalIconName;
  size?: KitIconSize;
  /** Fill weight for the current place; regular otherwise. */
  current?: boolean;
};

/** Phosphor through the one icon registry: regular when idle, fill when current. */
export function KitIcon({ name, size = "default", current = false }: KitIconProps) {
  const Glyph = operationalIcons[name];
  return (
    <Glyph
      aria-hidden="true"
      focusable="false"
      size={SIZE[size]}
      weight={current ? operationalIconWeights.kitCurrent : operationalIconWeights.kitIdle}
      className="flex-none"
    />
  );
}
