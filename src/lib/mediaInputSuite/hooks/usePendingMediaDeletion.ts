// src/lib/mediaInputSuite/hooks/usePendingMediaDeletion.ts
//
// 採用済みファイルの「保存時に削除」の予約。新しい storage 基盤では、採用済みのファイルはクライアントから消さない。
// 値の差し替え・削除を業務保存すると、サーバーの CRUD 連動（detach）が台帳を deleted にして実物を消す。
// 呼び出し側の互換のため API（markDelete / commit / revert）は残し、何もしない。

import { useCallback } from "react";

export const usePendingMediaDeletion = () => {
  const markDelete = useCallback((_url: string | null) => {
    // 何もしない（削除は業務保存の detach が担う）
  }, []);

  const commit = useCallback(async () => {
    // 何もしない
  }, []);

  const revert = useCallback(() => {
    // 何もしない
  }, []);

  return { markDelete, commit, revert } as const;
};
