/**
 * The Nimbus POS kit (U0, 26 Nov 2026). Every new screen is made from these
 * pieces only; `pnpm check:ui` refuses anything else in `src/screens/**`.
 * Values come from `src/styles/kit-tokens.css` (from design/screens/kit.css).
 */
export { ActionTile, type ActionTileProps } from "./ActionTile";
export { Banner, type BannerProps } from "./Banner";
export { BottomBar, TabBar, type BarProps } from "./BottomBar";
export {
  Button,
  RoundAction,
  SquareAction,
  type ButtonProps,
  type ButtonTone,
  type IconActionTone,
  type RoundActionProps,
  type SquareActionProps,
} from "./Button";
export { Card, type CardProps } from "./Card";
export { Chip, type ChipProps } from "./Chip";
export { Field, type FieldProps } from "./Field";
export { HeaderBand, type HeaderAction, type HeaderBandProps } from "./HeaderBand";
export { ItemTile, type ItemTileProps } from "./ItemTile";
export { Key, type KeyProps } from "./Key";
export { KitIcon, type KitIconProps, type KitIconSize } from "./KitIcon";
export { MeasureRow, type Measure, type MeasureRowProps } from "./MeasureRow";
export { OptionTile, type OptionTileProps } from "./OptionTile";
export { OrderHeader, type OrderHeaderProps } from "./OrderHeader";
export { OrderLine, type OrderLineProps, type OrderLineState } from "./OrderLine";
export { Pill, type PillTone } from "./Pill";
export { Row, RowGroup, type RowProps } from "./Row";
export { Segmented, type SegmentedOption, type SegmentedProps } from "./Segmented";
export { Sheet, type SheetPlacement, type SheetProps } from "./Sheet";
export { Stepper, type StepperProps } from "./Stepper";
export { Switcher, type SwitcherProps } from "./Switcher";
export { NewTabTile, TableTile, type TableState, type TableTileProps } from "./TableTile";
export { Text, type TextProps, type TextTone, type TextVariant } from "./Text";
export { BarSearch, TouchHeader, type SearchSize, type TouchHeaderProps } from "./TouchHeader";
export { phoneSections, terminalSections, type KitSection, type PhoneRole, type TerminalRole } from "./sections";
export type { KitDemo } from "./states";
