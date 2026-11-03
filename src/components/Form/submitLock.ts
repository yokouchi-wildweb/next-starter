// src/components/Form/submitLock.ts
// AppForm の二重送信ロック（非公開。AppForm の中だけで使う）。
// isSubmitting / pending は state なので次の描画まで効かない。同じフレームの 2 回目の送信は
// このロックで同期に捨てる。ロックは送信（検証 → onSubmit → メディアのコミット）が終わるまで持ち、
// 成功でも失敗でも finally で外す。

type SubmitEventLike = { preventDefault?: () => void } | undefined;

export type SubmitLock = {
  /** 送信中かどうか（同期で読める） */
  isLocked: () => boolean;
  /**
   * 送信処理を包む。ロック中に来た送信はブラウザ本来の送信だけ止めて捨てる（handler は呼ばない）。
   */
  wrap: <TEvent extends SubmitEventLike>(
    handler: (event: TEvent) => Promise<void>,
  ) => (event: TEvent) => Promise<void>;
};

export function createSubmitLock(): SubmitLock {
  let locked = false;

  return {
    isLocked: () => locked,
    wrap: (handler) => async (event) => {
      if (locked) {
        // 捨てる送信でも preventDefault しないと、ネイティブの送信でページが再読み込みされる
        event?.preventDefault?.();
        return;
      }
      locked = true;
      try {
        await handler(event);
      } finally {
        locked = false;
      }
    },
  };
}
