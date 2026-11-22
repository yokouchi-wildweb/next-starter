// src/domains/core/user/components/common/UserAdminMemoCell.tsx

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "@/lib/unsavedGuard";

import { PromptPopover } from "@/components/Overlays/Popover";
import { Button } from "@/components/Button/Button";
import { Span } from "@/components/TextBlocks/Span";
import { useUpdateUser } from "@/domains/core/user/hooks/useUpdateUser";
import { useToast } from "@/lib/toast";
import { err } from "@/lib/errors";

type Props = {
  userId: string;
  memo: string | null;
  /** メモ未入力時の表示文言 */
  emptyLabel?: string;
  /** プレビュー部分の最大文字数 (超過分は ... に省略) */
  previewMaxLength?: number;
};

/**
 * 管理画面のユーザー一覧から adminMemo を編集できるセル。
 * - クリックで PromptPopover (textarea) が開き、保存すると useUpdateUser 経由で PATCH される。
 * - 監査ログには drizzleBase.audit.trackedFields の adminMemo として自動記録される。
 * - 機能フラグ userConfig.enableUserMemo の制御は呼び出し側 (列追加可否) で行う。
 */
export function UserAdminMemoCell({
  userId,
  memo,
  emptyLabel = "(メモなし)",
  previewMaxLength = 40,
}: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useUpdateUser();

  // サーバーから渡される memo を初期値にしつつ、保存後の即時反映用にローカル保持する
  // (router.refresh() の完了を待たずに UI を更新する)
  const [currentMemo, setCurrentMemo] = useState<string | null>(memo);

  const handleConfirm = useCallback(
    async (value: string) => {
      const next = value.trim().length === 0 ? null : value;
      // 変更がなければ何もしない (空打ち保存で audit ログを汚さない)
      if (next === currentMemo) return;

      try {
        await trigger({ id: userId, data: { adminMemo: next } });
        setCurrentMemo(next);
        showToast("メモを更新しました", "success");
        router.refresh();
      } catch (error) {
        showToast(err(error, "メモの更新に失敗しました"), "error");
        throw error;
      }
    },
    [currentMemo, trigger, userId, showToast, router],
  );

  const preview = currentMemo
    ? currentMemo.length > previewMaxLength
      ? `${currentMemo.slice(0, previewMaxLength)}…`
      : currentMemo
    : emptyLabel;

  return (
    <PromptPopover
      trigger={
        // Button/Button の既定の font-medium は元の button に無いので font-normal で打ち消す。クリックは元どおり親へ伝える
        <Button
          type="button"
          variant="none"
          size="none"
          propagateClick
          disabled={isMutating}
          title={currentMemo ?? emptyLabel}
          className="block max-w-[16rem] truncate text-left text-sm font-normal hover:underline disabled:opacity-50"
        >
          <Span inline tone={currentMemo ? "default" : "muted"}>
            {preview}
          </Span>
        </Button>
      }
      title="管理者メモ"
      description="このユーザーに紐づく管理者向けの自由記述メモ。空にするとメモが削除されます。"
      multiline
      rows={5}
      defaultValue={currentMemo ?? ""}
      placeholder="メモを入力 (空欄で削除)"
      confirmLabel="保存"
      onConfirm={handleConfirm}
      size="lg"
    />
  );
}

export default UserAdminMemoCell;
