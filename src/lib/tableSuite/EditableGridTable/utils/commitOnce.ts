// src/lib/tableSuite/EditableGridTable/utils/commitOnce.ts
// セルの編集 1 回につき確定は 1 回(Enter・Tab・フォーカスが外れる、のどれで閉じても)。
// Enter は確定してから入力欄の blur を呼ぶので、続く onBlur がもう一度確定していた(onCellChange が 2 回)。
// 編集を始めたら開き、編集を閉じる確定(keepEditing でない)が通ったら閉じる。閉じた後の確定は何もしない。
// 入力の検証で止まった確定は閉じない(編集を続け、直して確定できる)

export type CommitOnce = {
  /** 編集を始めた(次の確定を受ける) */
  open(): void;
  /** この確定を通すか。keepEditing(マルチセレクトの途中の確定など)は常に通す */
  accepts(keepEditing: boolean): boolean;
  /** 編集を閉じる確定が通った */
  close(): void;
};

export function createCommitOnce(): CommitOnce {
  let closed = false;
  return {
    open() {
      closed = false;
    },
    accepts(keepEditing) {
      return keepEditing || !closed;
    },
    close() {
      closed = true;
    },
  };
}
