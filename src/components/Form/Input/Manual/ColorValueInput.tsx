// @/components/Form/Input/Manual/ColorValueInput.tsx
//
// グラデーション対応カラー値ピッカー。
// default / solid / gradient の3モードを切り替えられる colorInput の拡張版。
//
// ドメイン非依存に保つため "default" の意味（プレビュー背景・ラベル）は消費側が注入する。

"use client";

import * as React from "react";

import { cn } from "@/lib/cn";
import {
  listGradients,
  type ColorMode,
  type ColorValue,
  type GradientToken,
} from "@/lib/gradient";

import { ColorInput } from "./ColorInput";

const MODE_LABELS: Record<ColorMode, string> = {
  default: "デフォルト",
  solid: "単色",
  gradient: "グラデーション",
};

const ALL_MODES: ColorMode[] = ["default", "solid", "gradient"];

export type ColorValueInputProps = {
  /** 現在値（ColorValue。後方互換で生CSS文字列は solid 相当として扱う） */
  value?: ColorValue | null;
  /** 値変更時のコールバック */
  onChange?: (value: ColorValue) => void;
  /** blur時のコールバック */
  onBlur?: () => void;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  /** 表示するモードと順序（既定: default, solid, gradient すべて） */
  modes?: ColorMode[];
  /** "default" モードのプレビュー背景に使うCSS（消費側が意味を注入） */
  defaultPreview?: string;
  /** "default" モードのラベル（既定: "デフォルト"） */
  defaultLabel?: string;
  /** グラデーションの選択肢（既定: listGradients() の全件） */
  gradients?: GradientToken[];
};

const FALLBACK_SOLID = "#000000";

/** モード切替時に妥当な ColorValue を組み立てる。 */
function buildValueForMode(
  mode: ColorMode,
  current: ColorValue | null | undefined,
  gradients: GradientToken[],
): ColorValue {
  switch (mode) {
    case "default":
      return { mode: "default" };
    case "solid":
      return {
        mode: "solid",
        solid: current?.mode === "solid" ? current.solid : FALLBACK_SOLID,
      };
    case "gradient":
      return {
        mode: "gradient",
        gradientKey:
          current?.mode === "gradient"
            ? current.gradientKey
            : (gradients[0]?.key ?? ""),
      };
  }
}

/**
 * カラー値ピッカー（default / solid / gradient）。
 * 制御コンポーネント。内部状態は持たず value/onChange で完結する。
 */
const ColorValueInput = React.forwardRef<HTMLDivElement, ColorValueInputProps>(
  (props, ref) => {
    const {
      value,
      onChange,
      onBlur,
      disabled,
      readOnly,
      className,
      modes = ALL_MODES,
      defaultPreview,
      defaultLabel = MODE_LABELS.default,
      gradients,
    } = props;

    const gradientOptions = React.useMemo(
      () => gradients ?? listGradients(),
      [gradients],
    );

    const current: ColorValue = value ?? { mode: "default" };
    const isLocked = disabled || readOnly;

    const emit = (next: ColorValue) => {
      if (isLocked) return;
      onChange?.(next);
    };

    const handleModeChange = (mode: ColorMode) => {
      emit(buildValueForMode(mode, current, gradientOptions));
    };

    return (
      <div ref={ref} className={cn("flex flex-col gap-3", className)}>
        {/* モード切替 */}
        <div className="flex gap-1.5">
          {modes.map((mode) => {
            const active = current.mode === mode;
            return (
              <button
                key={mode}
                type="button"
                disabled={isLocked}
                aria-pressed={active}
                onClick={() => handleModeChange(mode)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-muted-foreground/30 text-muted-foreground hover:bg-muted/50",
                  isLocked && "cursor-not-allowed opacity-50",
                )}
              >
                {mode === "default" ? defaultLabel : MODE_LABELS[mode]}
              </button>
            );
          })}
        </div>

        {/* モード別コントロール */}
        {current.mode === "default" && (
          <div className="flex items-center gap-2">
            <span
              className="h-10 w-10 shrink-0 rounded-md border border-muted-foreground/50"
              style={{ background: defaultPreview ?? "transparent" }}
            />
            <span className="text-sm text-muted-foreground">{defaultLabel}</span>
          </div>
        )}

        {current.mode === "solid" && (
          <ColorInput
            value={current.solid || FALLBACK_SOLID}
            onChange={(solid) => emit({ mode: "solid", solid })}
            onBlur={onBlur}
            disabled={disabled}
            readOnly={readOnly}
          />
        )}

        {current.mode === "gradient" && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {gradientOptions.map((token) => {
              const active = current.gradientKey === token.key;
              return (
                <button
                  key={token.key}
                  type="button"
                  disabled={isLocked}
                  aria-pressed={active}
                  onClick={() =>
                    emit({ mode: "gradient", gradientKey: token.key })
                  }
                  className={cn(
                    "flex flex-col gap-1 rounded-md border p-1.5 text-left transition-all",
                    active
                      ? "border-primary ring-2 ring-primary/40"
                      : "border-muted-foreground/30 hover:border-muted-foreground/60",
                    isLocked && "cursor-not-allowed opacity-50",
                  )}
                >
                  <span
                    className="h-8 w-full rounded"
                    style={{ background: token.cssValue }}
                  />
                  <span className="truncate text-xs text-muted-foreground">
                    {token.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  },
);

ColorValueInput.displayName = "ColorValueInput";

export { ColorValueInput };
