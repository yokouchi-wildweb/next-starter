// src/features/core/user/components/admin/AdminUserManageModal/StatusTabContent.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Dialog from "@/components/Overlays/Dialog";
import { useToast } from "@/lib/toast";
import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Button } from "@/components/Form/Button/Button";
import { SelectInput, Input } from "@/components/Form/Manual";
import { err } from "@/lib/errors";
import type { User } from "@/features/core/user/entities";
import type { UserStatus } from "@/features/core/user/types";
import { USER_STATUS_OPTIONS, formatUserStatusLabel } from "@/features/core/user/constants/status";
import { useChangeUserStatus } from "@/features/core/user/hooks/useChangeUserStatus";
import { UserInfoHeader } from "./UserInfoHeader";

type Props = {
  user: User;
  onClose: () => void;
};

const FALLBACK = "(未設定)";

export function StatusTabContent({ user, onClose }: Props) {
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [reason, setReason] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger: triggerStatusChange, isMutating } = useChangeUserStatus();

  const handleReset = () => {
    setSelectedStatus("");
    setReason("");
    setShowConfirm(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleChangeClick = () => {
    if (!selectedStatus) return;
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (!selectedStatus) return;
    setShowConfirm(false);

    try {
      await triggerStatusChange({
        userId: user.id,
        data: {
          status: selectedStatus as UserStatus,
          reason: reason.trim() || undefined,
        },
      });
      showToast("ステータスを変更しました", "success");
      handleClose();
      router.refresh();
    } catch (error) {
      showToast(err(error, "ステータスの変更に失敗しました"), "error");
    }
  };

  const confirmContent = (
    <Flex direction="column" gap="md" className="mt-2">
      <Block className="rounded-md border border-border bg-muted/50 p-4">
        <Flex justify="between" align="center" gap="lg">
          <div className="flex-1">
            <Para size="xs" tone="muted" className="mb-1">変更前</Para>
            <Para size="sm" className="font-medium">
              {formatUserStatusLabel(user.status, FALLBACK)}
            </Para>
          </div>
          <div className="text-muted-foreground">→</div>
          <div className="flex-1 text-right">
            <Para size="xs" tone="muted" className="mb-1">変更後</Para>
            <Para size="sm" className="font-medium text-primary">
              {formatUserStatusLabel(selectedStatus as UserStatus, FALLBACK)}
            </Para>
          </div>
        </Flex>
      </Block>
      {reason.trim() && (
        <div>
          <Para size="xs" tone="muted" className="mb-1">変更理由</Para>
          <Para size="sm">{reason.trim()}</Para>
        </div>
      )}
    </Flex>
  );

  return (
    <>
      <Stack space={4} padding="md">
        <UserInfoHeader user={user} />
        <Stack space={6} className="mt-4">
          <div>
            <Para size="sm" className="mb-2 font-medium">
              変更先ステータス
            </Para>
            <SelectInput
              value={selectedStatus}
              onChange={(value) => setSelectedStatus(String(value ?? ""))}
              options={USER_STATUS_OPTIONS.filter((opt) => opt.value !== user.status)}
              placeholder="ステータスを選択"
              contentClassName="surface-ui-layer"
            />
          </div>
          <div>
            <Para size="sm" className="mb-2 font-medium">
              変更理由（任意）
            </Para>
            <Input
              value={reason}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReason(e.target.value)}
              placeholder="例: 規約違反のため"
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
              onClick={handleChangeClick}
              disabled={!selectedStatus || isMutating}
            >
              {isMutating ? "変更中..." : "ステータスを変更"}
            </Button>
          </Flex>
        </Stack>
      </Stack>
      <Dialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="ステータス変更の確認"
        confirmLabel="変更する"
        cancelLabel="キャンセル"
        onConfirm={handleConfirm}
        confirmDisabled={isMutating}
        layer="alert"
        overlayLayer="alert"
      >
        {confirmContent}
      </Dialog>
    </>
  );
}
