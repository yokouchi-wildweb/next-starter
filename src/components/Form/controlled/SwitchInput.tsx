// src/components/Form/SwitchInput.tsx

"use client";

import { cn } from "@/lib/cn";
import { FieldPath, FieldValues } from "react-hook-form";
import { ControlledInputProps } from "@/types/form";
import { ReactNode } from "react";
import { cva } from "class-variance-authority";

const containerVariants = cva("flex items-center gap-3", {
  variants: {
    interactive: {
      true: "cursor-pointer",
      false: "cursor-not-allowed",
    },
  },
  defaultVariants: {
    interactive: true,
  },
});

const trackVariants = cva(
  "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors duration-200 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
  {
    variants: {
      checked: {
        false: "bg-muted border border-border shadow-sm",
        true: "bg-primary shadow-inner",
      },
      interactive: {
        true: "cursor-pointer",
        false: "cursor-not-allowed",
      },
    },
    defaultVariants: {
      interactive: true,
    },
  },
);

const indicatorVariants = cva(
  "inline-block size-5 rounded-full bg-background transition-transform duration-200",
  {
    variants: {
      checked: {
        false: "translate-x-0 border border-border shadow",
        true: "translate-x-5 border border-transparent shadow",
      },
    },
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
    onChange: onChangeFromProps,
    ...rest
  } = props;

  const { ref, value, onChange, ...fieldRest } = field;
  const checked = Boolean(value);

  return (
    <label
      className={cn(
        containerVariants({ interactive: !disabled }),
        disabled && "opacity-70",
        className,
      )}
    >
      <input
        {...fieldRest}
        {...rest}
        ref={ref}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.checked);
          onChangeFromProps?.(event);
        }}
      />

      <span aria-hidden="true" className={cn(trackVariants({ checked, interactive: !disabled }))}>
        <span className={indicatorVariants({ checked })} />
      </span>

      {(label || description) && (
        <span className="flex flex-col gap-0.5">
          {label ? <span className="text-sm font-medium text-foreground">{label}</span> : null}
          {description ? <span className="text-xs text-muted-foreground">{description}</span> : null}
        </span>
      )}
    </label>
  );
};
