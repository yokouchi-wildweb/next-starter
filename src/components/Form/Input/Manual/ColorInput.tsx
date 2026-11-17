// @/components/Form/Input/Manual/ColorInput.tsx

import * as React from "react";

import { cn } from "@/lib/cn";
import { Input as ShadcnInput } from "@/components/Primitives/Input";

import { inputVariants, type InputSize } from "./Input";

export type ColorInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "size"
> & {
  /** 高さの段(hex 欄と色の見本の高さ。ボタンの size と同じ名前)@default "md" */
  size?: InputSize;
  /** カラー値（#rrggbb 形式） */
  value?: string;
  /** 値変更時のコールバック */
  onChange?: (value: string) => void;
  /** blur時のコールバック */
  onBlur?: () => void;
  /** コンパクト表示（スウォッチを縮小し、hexテキスト欄を省いたchip表示） */
  compact?: boolean;
};

/** 色の見本(hex 欄の左の正方形)は hex 欄と同じ高さの段 */
const SWATCH_SIZE_CLASSES = {
  xs: "size-(--control-h-xs)",
  sm: "size-(--control-h-sm)",
  md: "size-(--control-h-md)",
  lg: "size-(--control-h-lg)",
  xl: "size-(--control-h-xl)",
} satisfies Record<InputSize, string>;

/**
 * カラー入力コンポーネント
 * ネイティブカラーピッカー + hexコードテキスト入力の組み合わせ
 * compact=true では hexテキスト欄を省いた小さなchip表示になる（密なレイアウト向け）
 */
const ColorInput = React.forwardRef<HTMLInputElement, ColorInputProps>(
  (props, ref) => {
    const {
      className,
      value = "#000000",
      onChange,
      onBlur,
      readOnly,
      disabled,
      compact = false,
      size = "md",
      ...rest
    } = props;

    const inactiveStyles =
      readOnly || disabled
        ? "bg-muted/50 text-muted-foreground cursor-not-allowed focus-visible:ring-0 focus-visible:border-border"
        : "bg-background";

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e.target.value);
    };

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e.target.value);
    };

    const swatch = (
      <input
        ref={compact ? ref : undefined}
        type="color"
        value={value || "#000000"}
        onChange={handleColorChange}
        onBlur={onBlur}
        disabled={disabled || readOnly}
        className={cn(
          "shrink-0 cursor-pointer rounded-md border border-muted-foreground/50 p-0.5",
          compact ? "h-8 w-8" : SWATCH_SIZE_CLASSES[size],
          (readOnly || disabled) && "cursor-not-allowed opacity-50",
        )}
        {...rest}
      />
    );

    if (compact) {
      return <div className={cn("inline-flex items-center", className)}>{swatch}</div>;
    }

    return (
      <div className={cn("flex items-center gap-2", className)}>
        {swatch}
        <ShadcnInput
          ref={ref}
          type="text"
          value={value ?? ""}
          onChange={handleTextChange}
          onBlur={onBlur}
          readOnly={readOnly}
          disabled={disabled}
          placeholder="#000000"
          maxLength={7}
          className={cn(inactiveStyles, inputVariants({ size, className: "font-mono" }))}
        />
      </div>
    );
  },
);

ColorInput.displayName = "ColorInput";

export { ColorInput };
