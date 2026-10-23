// src/lib/mediaInputSuite/hooks/pendingUploadTracker.ts
//
// フォームの編集中にアップロードした「まだ業務保存で採用されていない」ファイルの追跡（usePendingMediaUploads の中身）。
// - 追跡するのは storage ref（storage://…）だけ。旧 URL・"/" 始まり・初期値は登録されても無視する
// - cleanup で、最終値として確定（commit）しなかった ref を discard する（本人・未紐付けだけをサーバーが受け付ける）
// - 採用済みの旧物はクライアントから消さない（差し替え・削除は業務保存の detach が担う）
// React に依存しない純粋な処理にして、node のテストで確かめる。

import { parseStorageRef } from "@/lib/storage/ref";

export type PendingUploadTracker = {
  /** このセッションでアップロードした値を登録する（storage ref 以外は無視） */
  register: (value: string | null | undefined) => void;
  /** 最終値に残った値を追跡から外す（discard しない） */
  commit: (value: string | null | undefined) => void;
  /** 追跡中の ref を全部 discard して空にする（失敗はログだけ。残りは掃除 cron が拾う） */
  cleanup: () => Promise<void>;
  /** 追跡中の ref（テスト・デバッグ用） */
  pending: () => string[];
};

export function createPendingUploadTracker(deps: {
  discard: (objectId: string) => Promise<void>;
  onError?: (error: unknown) => void;
}): PendingUploadTracker {
  const refs = new Set<string>();

  return {
    register(value) {
      if (!value || !parseStorageRef(value)) return;
      refs.add(value);
    },
    commit(value) {
      if (!value) return;
      refs.delete(value);
    },
    async cleanup() {
      const targets = Array.from(refs);
      refs.clear();
      await Promise.all(
        targets.map(async (ref) => {
          const parsed = parseStorageRef(ref);
          if (!parsed) return;
          try {
            await deps.discard(parsed.ledgerId);
          } catch (error) {
            (deps.onError ?? console.error)(error);
          }
        }),
      );
    },
    pending: () => Array.from(refs),
  };
}
