"use client";

// src/features/core/messaging/hooks/useSendSteps.ts
//
// 送る画面の進行(公開の部品、D191): 書く(edit)→ 確認(confirm)→ 結果(done)と、書きかけの確かめ。
// 自由連絡の送るモーダル・定義連絡の汎用のモーダル・fork の自前の送る画面が同じ物を使う。
// - dirty = 開いていて結果の段でなく、呼び手の書きかけ(editing)がある時。ページを離れる前の確かめ(@/lib/unsavedGuard)を張り、
//   Modal の confirmOnClose に渡す closeConfirm を返す
// - finish(result) で結果の段へ。reset で書く段へ戻し結果を消す(閉じた時に呼び手が呼ぶ)

import { useCallback, useState } from "react";

import { useUnsavedGuard } from "@/lib/unsavedGuard";

export type SendStep = "edit" | "confirm" | "done";

export type UseSendStepsOptions = {
  /** 送る画面が開いているか(閉じていれば書きかけにしない) */
  open: boolean;
  /** 呼び手の書きかけ(手で触った物がある) */
  editing: boolean;
  /** 閉じる前の確かめの文(既定: 送信されていない旨) */
  closeMessage?: string;
};

const CLOSE_MESSAGE = "入力中の内容は送信されていません。閉じてもよろしいですか？";

export function useSendSteps<Result>({ open, editing, closeMessage = CLOSE_MESSAGE }: UseSendStepsOptions) {
  const [step, setStep] = useState<SendStep>("edit");
  const [result, setResult] = useState<Result | null>(null);

  const dirty = open && step !== "done" && editing;
  useUnsavedGuard(dirty);

  /** 確認の段へ(検査は呼び手が先に済ませる) */
  const toConfirm = useCallback(() => setStep("confirm"), []);
  /** 書く段へ戻る */
  const backToEdit = useCallback(() => setStep("edit"), []);
  /** 送った: 結果の段へ */
  const finish = useCallback((next: Result) => {
    setResult(next);
    setStep("done");
  }, []);
  /** 書く段に戻し結果を消す */
  const reset = useCallback(() => {
    setStep("edit");
    setResult(null);
  }, []);

  return {
    step,
    result,
    dirty,
    /** Modal の confirmOnClose に渡す */
    closeConfirm: { enabled: dirty, message: closeMessage },
    toConfirm,
    backToEdit,
    finish,
    reset,
  };
}
