// src/features/core/user/components/admin/AdminUserManageModal/DeleteTabContent.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Dialog from "@/components/Overlays/Dialog";
import { useAppToast } from "@/hooks/useAppToast";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Button } from "@/components/Form/Button/Button";
import { Input } from "@/components/Form/Manual";
import { err } from "@/lib/errors";
import type { User } from "@/features/core/user/entities";
import { useSoftDeleteUser } from "@/features/core/user/hooks/useSoftDeleteUser";
import { UserInfoHeader } from "./UserInfoHeader";

type Props = {
  user: User;
  onClose: () => void;
};

export function DeleteTabContent({ user, onClose }: Props) {
  const [reason, setReason] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const router = useRouter();
  const { showAppToast } = useAppToast();
  const { trigger: triggerDelete, isMutating } = useSoftDeleteUser();

  const handleReset = () => {
    setReason("");
    setShowConfirm(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleDeleteClick = () => {
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setShowConfirm(false);

    try {
      await triggerDelete({
        userId: user.id,
        data: {
          reason: reason.trim() || undefined,
        },
      });
      showAppToast("ユーザーを削除しました", "success");
      handleClose();
      router.refresh();
    } catch (error) {
      showAppToast(err(error, "ユーザーの削除に失敗しました"), "error");
    }
  };

  const confirmContent = (
    <Flex direction="column" gap="md" className="mt-2">
      <Block className="rounded-md border border-destructive/30 bg-destructive/10 p-4">
        <Para size="sm" className="text-destructive">
          <strong>{user.displayName ?? user.email}</strong> を削除します。
        </Para>
        <Para size="xs" tone="muted" className="mt-2">
          削除されたユーザーはログインできなくなります。
        </Para>
      </Block>
      {reason.trim() && (
        <div>
          <Para size="xs" tone="muted" className="mb-1">削除理由</Para>
          <Para size="sm">{reason.trim()}</Para>
        </div>
      )}
    </Flex>
  );

  return (
    <>
      <Block space="sm" padding="md">
        <UserInfoHeader user={user} />
        <Block space="md" className="mt-4">
          <Block className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
            <Para size="sm" className="font-medium text-destructive">
              ユーザーを削除
            </Para>
            <Para size="xs" tone="muted" className="mt-1">
              削除されたユーザーはログインできなくなります。
            </Para>
          </Block>
          <div>
            <Para size="sm" className="mb-2 font-medium">
              削除理由（任意）
            </Para>
            <Input
              value={reason}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReason(e.target.value)}
              placeholder="例: 不正利用のため"
            />
            <Para size="xs" tone="muted" className="mt-1">
              500文字以内
            </Para>
          </div>
          <Flex gap="sm" justify="end" className="mt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isMutating}>
              キャンセル
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteClick}
              disabled={isMutating}
            >
              {isMutating ? "削除中..." : "削除する"}
            </Button>
          </Flex>
        </Block>
      </Block>
      <Dialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="削除の確認"
        confirmLabel="削除する"
        cancelLabel="キャンセル"
        onConfirm={handleConfirm}
        confirmDisabled={isMutating}
        confirmVariant="destructive"
        layer="alert"
        overlayLayer="alert"
      >
        {confirmContent}
      </Dialog>
    </>
  );
}
