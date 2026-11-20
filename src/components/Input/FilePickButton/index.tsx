// src/components/Input/FilePickButton/index.tsx

"use client";

import * as React from "react";

import { baseButtonClassName } from "@/components/Primitives/Button";
import { Input } from "@/components/Input/Input";
import { cn } from "@/lib/cn";

import { buttonVariants, type ButtonStyleProps } from "@/components/Form/Button/button-variants";

export type FilePickButtonProps = ButtonStyleProps & {
  /** 選べるファイルの種類(input の accept) */
  accept?: string;
  /** 複数を選べる @default false */
  multiple?: boolean;
  disabled?: boolean;
  /** input の name(form で送るとき) */
  name?: string;
  /** 選んだファイル(空の選び直しでは呼ばない)。呼んだ後に input を空に戻すので、同じファイルを続けて選んでも毎回呼ばれる */
  onFiles: (files: File[]) => void;
  className?: string;
  children: React.ReactNode;
};

const isActivateKey = (key: string) => key === "Enter" || key === " " || key === "Spacebar";

/**
 * ボタンの形をしたファイル選択。label の中に隠した file の Input を持ち、押すとファイルの選択が開く。
 * 見た目は Form/Button と同じ(variant / size / opticalAdjust)。キーボードでは Tab で止まり Enter / Space で開く。
 * ボタンを押して ref で input を開く形(選んだ後に別の処理を挟む等)は Button + Input hidden で組む。
 */
export function FilePickButton({
  accept,
  multiple = false,
  disabled = false,
  name,
  onFiles,
  variant,
  size,
  opticalAdjust,
  className,
  children,
}: FilePickButtonProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLLabelElement>) => {
    if (disabled || !isActivateKey(e.key)) return;
    e.preventDefault();
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onFiles(files);
    e.target.value = "";
  };

  return (
    <label
      data-slot="file-pick-button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      onKeyDown={handleKeyDown}
      className={cn(
        baseButtonClassName,
        buttonVariants({ variant, size, opticalAdjust }),
        disabled && "pointer-events-none cursor-not-allowed opacity-50",
        className,
      )}
    >
      {children}
      <Input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        name={name}
        hidden
        onChange={handleChange}
      />
    </label>
  );
}
