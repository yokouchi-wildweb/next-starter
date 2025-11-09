// src/components/Form/SwitchInput.tsx

"use client";

import { cn } from "@/lib/cn";
import { FieldPath, FieldValues } from "react-hook-form";
import { ControlledInputProps } from "@/types/form";
import { ReactNode } from "react";
import { cva } from "class-variance-authority";

const trackVariants = cva(
  "relative inline-flex shrink-0 items-center rounded-full px-0.5 transition-colors duration-200 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
  {
    variants: {
      checked: {
        false: "bg-muted border border-border shadow-sm",
        true: "shadow-inner",
      },
      interactive: {
        true: "cursor-pointer",
        false: "cursor-not-allowed",
      },
      size: {
        sm: "h-5 w-9",
        md: "h-6 w-11",
        lg: "h-7 w-14",
      },
      activeColor: {
        primary: "",
        secondary: "",
        accent: "",
        destructive: "",
        muted: "",
        success: "",
        error: "",
        warning: "",
      },
    },
    defaultVariants: {
      interactive: true,
      size: "md",
      activeColor: "primary",
    },
    compoundVariants: [
      { checked: true, activeColor: "primary", class: "bg-primary" },
      { checked: true, activeColor: "secondary", class: "bg-secondary" },
      { checked: true, activeColor: "accent", class: "bg-accent" },
      { checked: true, activeColor: "destructive", class: "bg-destructive" },
      { checked: true, activeColor: "muted", class: "bg-muted" },
      {
        checked: true,
        activeColor: "success",
        class: "bg-emerald-500 dark:bg-emerald-400",
      },
      {
        checked: true,
        activeColor: "error",
        class: "bg-red-500 dark:bg-red-400",
      },
      {
        checked: true,
        activeColor: "warning",
        class: "bg-orange-500 dark:bg-orange-400",
      },
    ],
  },
);

const indicatorVariants = cva(
  "inline-block rounded-full bg-background transition-transform duration-200",
  {
    variants: {
      checked: {
        false: "translate-x-0 border border-border shadow",
        true: "border border-transparent shadow",
      },
      size: {
        sm: "size-4",
        md: "size-5",
        lg: "size-6",
      },
    },
    defaultVariants: {
      size: "md",
    },
    compoundVariants: [
      { checked: true, size: "sm", class: "translate-x-4" },
      { checked: true, size: "md", class: "translate-x-5" },
      { checked: true, size: "lg", class: "translate-x-7" },
    ],
  },
);

export type SwitchInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = ControlledInputProps<TFieldValues, TName> & {
  /**
   * スイッチの右側に表示するラベル
   */
  label?: ReactNode;
  /**
   * ラベルの下に表示する補足テキスト
   */
  description?: ReactNode;
  /**
   * スイッチ全体の大きさ
   */
  size?: "sm" | "md" | "lg";
  /**
   * スイッチがオンのときの背景色
   */
  activeColor?:
    | "primary"
    | "secondary"
    | "accent"
    | "destructive"
    | "muted"
    | "success"
    | "error"
    | "warning";
};

export const SwitchInput = <
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(props: SwitchInputProps<TFieldValues, TName>) => {
  const {
    field,
    label,
    description,
    className,
    disabled,
    size,
    activeColor,
    onChange: onChangeFromProps,
    id: idFromProps,
    ["aria-labelledby"]: ariaLabelledbyFromProps,
    ["aria-describedby"]: ariaDescribedbyFromProps,
    ...rest
  } = props;

  const { ref, value, onChange, ...fieldRest } = field;
  const checked = Boolean(value);
  const inputId = idFromProps ?? fieldRest.name;
  const labelId = label ? `${inputId}-label` : undefined;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const ariaLabelledby = [ariaLabelledbyFromProps, labelId].filter(Boolean).join(" ") || undefined;
  const ariaDescribedby = [ariaDescribedbyFromProps, descriptionId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex items-center gap-3", disabled && "opacity-70", className)}>
      <input
        {...fieldRest}
        {...rest}
        ref={ref}
        id={inputId}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        aria-labelledby={ariaLabelledby}
        aria-describedby={ariaDescribedby}
        onChange={(event) => {
          onChange(event.target.checked);
          onChangeFromProps?.(event);
        }}
      />

      <label
        htmlFor={inputId}
        className={cn(trackVariants({ checked, interactive: !disabled, size, activeColor }))}
      >
        <span className={indicatorVariants({ checked, size })} />
      </label>

      {(label || description) && (
        <span className="flex flex-col gap-0.5">
          {label ? (
            <span id={labelId} className="text-sm font-medium text-foreground">
              {label}
            </span>
          ) : null}
          {description ? (
            <span id={descriptionId} className="text-xs text-muted-foreground">
              {description}
            </span>
          ) : null}
        </span>
      )}
    </div>
  );
};
