// src/components/Overlays/Confirm/useConfirm.tsx

"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { Dialog, type DialogProps } from "@/components/Overlays/Dialog";

/** 確認の文言と見た目の値(Dialog の props のうち確認に要る物だけ) */
export type ConfirmOptions = Pick<
  DialogProps,
  "title" | "description" | "confirmLabel" | "cancelLabel" | "confirmVariant" | "layer" | "overlayLayer"
>;

/** 確認を開き、確定で true・取り消し / ✕ / ESC / 背景で false に解ける */
export type ConfirmFn = (options?: ConfirmOptions) => Promise<boolean>;

export type UseConfirmResult = {
  confirm: ConfirmFn;
  /** 確認の窓。画面のどこかに 1 度置く({confirmDialog}) */
  confirmDialog: ReactNode;
};

const DEFAULT_OPTIONS: ConfirmOptions = {
  title: "確認",
  confirmLabel: "OK",
  cancelLabel: "キャンセル",
};

/**
 * 関数の中で答えを待つ確認(Promise<boolean>)。
 * 画面に置く確認(ボタンから開く等)は Dialog / ConfirmPopover を使う。
 *
 * - 開いている間に次の confirm が来たら、前は false で解けて次が出る
 * - 部品が外れたら、待っている Promise は false で解ける
 */
export function useConfirm(): UseConfirmResult {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(value);
  }, []);

  const confirm = useCallback<ConfirmFn>(
    (next) => {
      settle(false);
      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
        setOptions({ ...DEFAULT_OPTIONS, ...next });
      });
    },
    [settle],
  );

  useEffect(() => () => settle(false), [settle]);

  const confirmDialog = (
    <Dialog
      {...(options ?? DEFAULT_OPTIONS)}
      open={options !== null}
      onOpenChange={(open) => {
        if (open) return;
        setOptions(null);
        settle(false);
      }}
      onConfirm={() => {
        setOptions(null);
        settle(true);
      }}
    />
  );

  return { confirm, confirmDialog };
}
