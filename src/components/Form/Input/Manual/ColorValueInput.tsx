// @/components/Form/Input/Manual/ColorValueInput.tsx
//
// グラデーション対応カラー値ピッカー。
// default / solid / gradient の3モードを切り替えられる colorInput の拡張版。
//
// レイアウト:
//   - "stack"（既定）: モードボタン行 + （gradient時）スウォッチグリッド。フォームの1フィールド向け。
//   - "inline": 1行のセグメンテッドコントロール + インラインchip / gradientドロップダウン。
//     密なテーブル行のセル内に収める用途向け。
//
// ドメイン非依存に保つため "default" の意味（プレビュー背景・ラベル）は消費側が注入する。

"use client";

import * as React from "react";
import { ChevronDown, Search } from "lucide-react";

import { cn } from "@/lib/cn";
import {
  listGradients,
  normalizeColorValue,
  type ColorMode,
  type ColorValue,
  type GradientToken,
} from "@/lib/gradient";
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
} from "@/components/Overlays/Popover";

import { ColorInput } from "./ColorInput";
import { Input } from "./Input";

const MODE_LABELS: Record<ColorMode, string> = {
  default: "デフォルト",
  solid: "単色",
  gradient: "グラデーション",
};

const ALL_MODES: ColorMode[] = ["default", "solid", "gradient"];

/** ドロップダウンに検索欄を出す閾値（これを超えたら検索可能） */
const DROPDOWN_SEARCH_THRESHOLD = 8;

export type ColorValueLayout = "stack" | "inline";
export type GradientPickerVariant = "grid" | "dropdown";

export type ColorValueInputProps = {
  /** 現在値（ColorValue。後方互換で生CSS文字列も受理し内部で正規化する） */
  value?: ColorValue | string | null;
  /** 値変更時のコールバック */
  onChange?: (value: ColorValue) => void;
  /** blur時のコールバック */
  onBlur?: () => void;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  /** レイアウト（既定: "stack"＝従来挙動） */
  layout?: ColorValueLayout;
  /** gradientモードの選択UI（既定: layoutから導出 stack→grid / inline→dropdown） */
  gradientPickerVariant?: GradientPickerVariant;
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
  current: ColorValue,
  gradients: GradientToken[],
): ColorValue {
  switch (mode) {
    case "default":
      return { mode: "default" };
    case "solid":
      return {
        mode: "solid",
        solid: current.mode === "solid" ? current.solid : FALLBACK_SOLID,
      };
    case "gradient":
      return {
        mode: "gradient",
        gradientKey:
          current.mode === "gradient"
            ? current.gradientKey
            : (gradients[0]?.key ?? ""),
      };
  }
}

/** モード切替コントロール（stack=ボタン行 / inline=セグメンテッド）。 */
function ModeControl(props: {
  modes: ColorMode[];
  current: ColorValue;
  inline: boolean;
  locked: boolean;
  defaultLabel: string;
  onSelect: (mode: ColorMode) => void;
}) {
  const { modes, current, inline, locked, defaultLabel, onSelect } = props;
  const labelOf = (mode: ColorMode) =>
    mode === "default" ? defaultLabel : MODE_LABELS[mode];

  if (inline) {
    return (
      <div className="inline-flex overflow-hidden rounded-md border border-muted-foreground/30 divide-x divide-muted-foreground/30">
        {modes.map((mode) => {
          const active = current.mode === mode;
          return (
            <button
              key={mode}
              type="button"
              disabled={locked}
              aria-pressed={active}
              onClick={() => onSelect(mode)}
              className={cn(
                "px-2 py-1 text-xs transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted/50",
                locked && "cursor-not-allowed opacity-50",
              )}
            >
              {labelOf(mode)}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      {modes.map((mode) => {
        const active = current.mode === mode;
        return (
          <button
            key={mode}
            type="button"
            disabled={locked}
            aria-pressed={active}
            onClick={() => onSelect(mode)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              active
                ? "border-primary bg-primary/10 text-primary font-medium"
                : "border-muted-foreground/30 text-muted-foreground hover:bg-muted/50",
              locked && "cursor-not-allowed opacity-50",
            )}
          >
            {labelOf(mode)}
          </button>
        );
      })}
    </div>
  );
}

/** gradientモード: スウォッチグリッド（stack向け）。 */
function GradientGrid(props: {
  options: GradientToken[];
  selectedKey: string | undefined;
  locked: boolean;
  onSelect: (key: string) => void;
}) {
  const { options, selectedKey, locked, onSelect } = props;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((token) => {
        const active = selectedKey === token.key;
        return (
          <button
            key={token.key}
            type="button"
            disabled={locked}
            aria-pressed={active}
            onClick={() => onSelect(token.key)}
            className={cn(
              "flex flex-col gap-1 rounded-md border p-1.5 text-left transition-all",
              active
                ? "border-primary ring-2 ring-primary/40"
                : "border-muted-foreground/30 hover:border-muted-foreground/60",
              locked && "cursor-not-allowed opacity-50",
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
  );
}

/** gradientモード: ドロップダウン（inline向け・クリック即適用）。 */
function GradientDropdown(props: {
  options: GradientToken[];
  selectedKey: string | undefined;
  locked: boolean;
  onSelect: (key: string) => void;
}) {
  const { options, selectedKey, locked, onSelect } = props;
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const selected = options.find((t) => t.key === selectedKey);
  const searchable = options.length > DROPDOWN_SEARCH_THRESHOLD;

  const filtered = React.useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (t) => t.label.toLowerCase().includes(q) || t.key.toLowerCase().includes(q),
    );
  }, [options, query]);

  React.useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={locked}
          className={cn(
            "inline-flex h-8 min-w-40 items-center gap-2 rounded-md border border-muted-foreground/40 bg-background px-2 text-sm",
            locked && "cursor-not-allowed opacity-50",
          )}
        >
          {selected ? (
            <>
              <span
                className="h-4 w-6 shrink-0 rounded-sm"
                style={{ background: selected.cssValue }}
              />
              <span className="truncate">{selected.label}</span>
            </>
          ) : (
            <span className="truncate text-muted-foreground">選択...</span>
          )}
          <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent size="sm" className="p-0">
        {searchable && (
          <div className="border-b px-2 py-1.5">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="検索..."
              leftIcon={<Search className="size-4" />}
              className="h-8 text-sm"
            />
          </div>
        )}
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              該当する項目がありません
            </div>
          ) : (
            filtered.map((token) => {
              const active = selectedKey === token.key;
              return (
                <button
                  key={token.key}
                  type="button"
                  onClick={() => {
                    onSelect(token.key);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    active && "bg-accent/60",
                  )}
                >
                  <span
                    className="h-5 w-8 shrink-0 rounded-sm border border-black/5"
                    style={{ background: token.cssValue }}
                  />
                  <span className="truncate">{token.label}</span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
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
      layout = "stack",
      gradientPickerVariant,
      modes = ALL_MODES,
      defaultPreview,
      defaultLabel = MODE_LABELS.default,
      gradients,
    } = props;

    const gradientOptions = React.useMemo(
      () => gradients ?? listGradients(),
      [gradients],
    );

    // 生CSS文字列・null も受理して正規化（ColorValue はそのまま）
    const current = normalizeColorValue(value);
    const isLocked = Boolean(disabled || readOnly);
    const inline = layout === "inline";
    const pickerVariant: GradientPickerVariant =
      gradientPickerVariant ?? (inline ? "dropdown" : "grid");

    const emit = (next: ColorValue) => {
      if (isLocked) return;
      onChange?.(next);
    };

    const handleModeChange = (mode: ColorMode) => {
      emit(buildValueForMode(mode, current, gradientOptions));
    };

    const modeControl = (
      <ModeControl
        modes={modes}
        current={current}
        inline={inline}
        locked={isLocked}
        defaultLabel={defaultLabel}
        onSelect={handleModeChange}
      />
    );

    // モード別コントロール
    const activeControl = (() => {
      if (current.mode === "default") {
        return (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "shrink-0 rounded-md border border-muted-foreground/50",
                inline ? "h-8 w-8" : "h-10 w-10",
              )}
              style={{ background: defaultPreview ?? "transparent" }}
            />
            {!inline && (
              <span className="text-sm text-muted-foreground">{defaultLabel}</span>
            )}
          </div>
        );
      }

      if (current.mode === "solid") {
        return (
          <ColorInput
            value={current.solid || FALLBACK_SOLID}
            onChange={(solid) => emit({ mode: "solid", solid })}
            onBlur={onBlur}
            disabled={disabled}
            readOnly={readOnly}
            compact={inline}
          />
        );
      }

      // gradient
      const selectedKey = current.gradientKey;
      const onSelect = (key: string) => emit({ mode: "gradient", gradientKey: key });
      return pickerVariant === "dropdown" ? (
        <GradientDropdown
          options={gradientOptions}
          selectedKey={selectedKey}
          locked={isLocked}
          onSelect={onSelect}
        />
      ) : (
        <GradientGrid
          options={gradientOptions}
          selectedKey={selectedKey}
          locked={isLocked}
          onSelect={onSelect}
        />
      );
    })();

    if (inline) {
      return (
        <div
          ref={ref}
          className={cn("flex flex-wrap items-center gap-2", className)}
        >
          {modeControl}
          {activeControl}
        </div>
      );
    }

    return (
      <div ref={ref} className={cn("flex flex-col gap-3", className)}>
        {modeControl}
        {activeControl}
      </div>
    );
  },
);

ColorValueInput.displayName = "ColorValueInput";

export { ColorValueInput };
