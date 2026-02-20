// @/components/Form/Input/Manual/ColorInput.tsx

import * as React from "react";

import { cn } from "@/lib/cn";
import { Input as ShadcnInput } from "@/components/_shadcn/input";

export type ColorInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange"
> & {
  /** カラー値（#rrggbb 形式） */
  value?: string;
  /** 値変更時のコールバック */
  onChange?: (value: string) => void;
  /** blur時のコールバック */
  onBlur?: () => void;
};

/**
 * カラー入力コンポーネント
 * ネイティブカラーピッカー + hexコードテキスト入力の組み合わせ
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

    return (
      <div className={cn("flex items-center gap-2", className)}>
        <input
          type="color"
          value={value || "#000000"}
          onChange={handleColorChange}
          onBlur={onBlur}
          disabled={disabled || readOnly}
          className={cn(
            "h-10 w-10 shrink-0 cursor-pointer rounded-md border border-muted-foreground/50 p-0.5",
            (readOnly || disabled) && "cursor-not-allowed opacity-50",
          )}
          {...rest}
        />
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
          className={cn("h-auto py-3 border-muted-foreground/50 font-mono", inactiveStyles)}
        />
      </div>
    );
  },
);

ColorInput.displayName = "ColorInput";

export { ColorInput };
