"use client";

import React from "react";
import { Input } from "@/components/Form/Input/Manual";
import type { BaseEditorProps } from "../types";

type DateTimeEditorProps<T> = BaseEditorProps<T> & {
  type: "date" | "time" | "datetime";
};

export function DateTimeEditor<T>({
  type,
  value,
  placeholder,
  error,
  className,
  inputRef,
  onCommit,
  onCancel,
  onDraftChange,
}: DateTimeEditorProps<T>) {
  const inputType = type === "datetime" ? "datetime-local" : type;
  const shouldShowPicker = type === "date" || type === "datetime";

  return (
    <Input
      type={inputType}
      className={className}
      value={value}
      placeholder={placeholder}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => onDraftChange(event.target.value)}
      onBlur={() => onCommit()}
      onFocus={
        shouldShowPicker
          ? (event) => {
              if (typeof (event.target as HTMLInputElement).showPicker === "function") {
                (event.target as HTMLInputElement).showPicker();
              }
            }
          : undefined
      }
      onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onCommit();
          inputRef.current?.blur();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      ref={(node: HTMLInputElement | null) => {
        if (inputRef && "current" in inputRef) {
          (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
        }
      }}
      aria-invalid={error ? true : undefined}
    />
  );
}
