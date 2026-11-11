// src/lib/variantOverrides/types.ts
//
// variant オーバーライドマップの型。
// 下流は src/config/ui/variants.config.ts に「足したいクラス」だけを書き、
// 対象コンポーネント(Button / Badge / 入力部品 / TextBlocks)が cva の出力の後ろに結合する(tailwind-merge で後勝ち)。
// キー(button / badge.solid / switchInput.track ...)と軸の値の名前は upstream が維持する公開契約。
// 入力部品・TextBlocks の軸の値の名前はここが持つ(D102)。部品の既定のクラスの表は `satisfies Record<名前, string>` で揃える。

import type { BadgeSize, BadgeVariant } from "@/components/Badge/badge-variants";
import type { ButtonSizeName, ButtonVariantName } from "@/components/Form/Button/button-variants";
import type {
  TabletButtonSizeName,
  TabletButtonVariantName,
} from "@/components/Form/Button/tablet-button-variants";

/**
 * 1 コンポーネント分のオーバーライド。
 * - base: 全 variant / size に共通で足すクラス(例: "rounded-full shadow-none")
 * - variant / size: その名前のときだけ足すクラス
 * 結合順は cva 出力 → base → variant → size → 呼び出し側の className。
 */
export type VariantOverride<V extends string = string, S extends string = string> = {
  base?: string;
  variant?: Partial<Record<V, string>>;
  size?: Partial<Record<S, string>>;
};

/**
 * 任意の軸のオーバーライド(D112)。Axes = 軸の名前 → その軸の値の名前。
 * - base: 全ての値に共通で足すクラス
 * - <軸>: その軸がその値のときだけ足すクラス
 * 結合順は既定のクラス → base → 軸(部品が渡した順)→ 呼び出し側の className。
 */
export type AxisOverride<Axes extends Record<string, string>> = { base?: string } & {
  [K in keyof Axes]?: Partial<Record<Axes[K], string>>;
};

/** チェックボックス・ラジオ・カード型チェック・スイッチの大きさ */
export type CheckControlSize = "sm" | "md" | "lg";
/** SingleCardCheckbox の色(checkedVariant / uncheckedVariant) */
export type SingleCardCheckboxColor = "success" | "primary" | "secondary" | "accent" | "destructive" | "muted" | "outline";
/** StepperInput の大きさ */
export type StepperInputSize = "xs" | "s" | "m" | "l";
/** SwitchInput の色(activeColor / inactiveColor) */
export type SwitchInputColor = "primary" | "secondary" | "accent" | "destructive" | "muted" | "success" | "warning";
/** TextBlocks(PageTitle / Para / SecTitle / Span)の軸の値 */
export type TextTone =
  | "inherit"
  | "default"
  | "muted"
  | "accent"
  | "primary"
  | "secondary"
  | "destructive"
  | "success"
  | "info"
  | "warning";
export type TextSize =
  | "inherit"
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "xxl"
  | "xxxl"
  | "fluidXs"
  | "fluidSm"
  | "fluidMd"
  | "fluidLg"
  | "fluidXl"
  | "fluidXxl"
  | "fluidXxxl";
export type TextWeight =
  | "inherit"
  | "thin"
  | "extraLight"
  | "light"
  | "normal"
  | "medium"
  | "semiBold"
  | "bold"
  | "extraBold"
  | "black";
export type TextAlign = "inherit" | "left" | "center" | "right" | "justify" | "centerToStartSm";

/** 入力部品・TextBlocks のキーごとの形 */
export type CheckControlOverride = AxisOverride<{ size: CheckControlSize }>;
export type SingleCardCheckboxOverride = AxisOverride<{ size: CheckControlSize; color: SingleCardCheckboxColor }>;
export type StepperInputOverride = AxisOverride<{ size: StepperInputSize }>;
/** activeColor はオンの間だけ、inactiveColor はオフの間だけ足す(部品の既定の色と同じ効き方) */
export type SwitchInputTrackOverride = AxisOverride<{
  size: CheckControlSize;
  activeColor: SwitchInputColor;
  inactiveColor: SwitchInputColor;
}>;
export type SwitchInputIndicatorOverride = AxisOverride<{ size: CheckControlSize }>;
/** srOnly は上書きできない(見えるかどうかは呼び手の約束) */
export type TextBlockOverride = AxisOverride<{ tone: TextTone; size: TextSize; weight: TextWeight; align: TextAlign }>;

/** Badge は 3 種(solid / soft / bookmarkTag)が size 定義を共有するため、size は badge 直下に 1 つ */
export type BadgeKindOverride = {
  base?: string;
  variant?: Partial<Record<BadgeVariant, string>>;
};

/** 下流が書く差分(全て任意) */
export type VariantOverridesInput = {
  button?: VariantOverride<ButtonVariantName, ButtonSizeName>;
  tabletButton?: VariantOverride<TabletButtonVariantName, TabletButtonSizeName>;
  badge?: {
    size?: Partial<Record<BadgeSize, string>>;
    solid?: BadgeKindOverride;
    soft?: BadgeKindOverride;
    bookmarkTag?: BadgeKindOverride;
  };
  booleanCheckbox?: CheckControlOverride;
  booleanRadioGroup?: CheckControlOverride;
  singleCardCheckbox?: SingleCardCheckboxOverride;
  stepperInput?: StepperInputOverride;
  switchInput?: { track?: SwitchInputTrackOverride; indicator?: SwitchInputIndicatorOverride };
  pageTitle?: TextBlockOverride;
  para?: TextBlockOverride;
  secTitle?: TextBlockOverride;
  span?: TextBlockOverride;
};

/** defineVariantOverrides() が返す完全形(未指定は空オブジェクト) */
export type VariantOverrides = {
  button: VariantOverride<ButtonVariantName, ButtonSizeName>;
  tabletButton: VariantOverride<TabletButtonVariantName, TabletButtonSizeName>;
  badge: {
    size: Partial<Record<BadgeSize, string>>;
    solid: BadgeKindOverride;
    soft: BadgeKindOverride;
    bookmarkTag: BadgeKindOverride;
  };
  booleanCheckbox: CheckControlOverride;
  booleanRadioGroup: CheckControlOverride;
  singleCardCheckbox: SingleCardCheckboxOverride;
  stepperInput: StepperInputOverride;
  switchInput: { track: SwitchInputTrackOverride; indicator: SwitchInputIndicatorOverride };
  pageTitle: TextBlockOverride;
  para: TextBlockOverride;
  secTitle: TextBlockOverride;
  span: TextBlockOverride;
};
