"use client";

import React from "react";
import { Input } from "@/components/Form/Input/Manual";
import type { BaseEditorProps } from "../types";

type TextEditorProps<T> = BaseEditorProps<T> & {
  type?: "text" | "number";
  inputMode?: "text" | "decimal";
};

export function TextEditor<T>({
  type = "text",
  inputMode,
  value,
  placeholder,
  error,
  className,
  inputRef,
  onCommit,
  onCancel,
  onDraftChange,
}: TextEditorProps<T>) {
  return (
    <Input
      type={type}
      inputMode={inputMode}
      className={className}
      value={value}
      placeholder={placeholder}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => onDraftChange(event.target.value)}
      onBlur={() => onCommit()}
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
