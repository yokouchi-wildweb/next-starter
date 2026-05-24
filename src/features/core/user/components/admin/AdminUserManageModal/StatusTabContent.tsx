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
import { SelectInput, Input } from "@/components/Form/Input/Manual";
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

  // security_locked は連続ログイン失敗で自動遷移するシステム専用ステータス。
  // 管理者の手動操作からは選択不可とし、誤操作を防ぐ。
  // (security_locked からの解除はユーザーを active 等の別ステータスに変更すれば、
  //  changeStatus wrapper が failed_login_count / locked_until も同時にリセットする)
  const statusOptions = USER_STATUS_OPTIONS.filter(
    (opt) => opt.value !== user.status && opt.value !== "security_locked",
  );

  const lockoutSummary = buildLockoutSummary(user);

  return (
    <>
      <Stack space={4} padding="md">
        <UserInfoHeader user={user} />

        {lockoutSummary ? (
          <Block className="mt-3 rounded-md border border-border bg-muted/40 p-3">
            <Para size="xs" tone="muted" className="mb-1">
              ロック状況
            </Para>
            <Para size="sm" className="font-medium">
              {lockoutSummary}
            </Para>
          </Block>
        ) : null}

        <Stack space={6} className="mt-4">
          <div>
            <Para size="sm" className="mb-2 font-medium">
              変更先ステータス
            </Para>
            <SelectInput
              value={selectedStatus}
              onChange={(value) => setSelectedStatus(String(value ?? ""))}
              options={statusOptions}
              placeholder="ステータスを選択"
              contentClassName="surface-ui-layer"
            />
            <Para size="xs" tone="muted" className="mt-1">
              「セキュリティロック」は連続ログイン失敗で自動的にセットされるため、手動では選択できません。
            </Para>
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

/**
 * 表示用にロック状態の要約を組み立てる。
 * - 永続ロック中 / 短期ロック中 / カウントのみ進行中 / なし(null) の 4 状態
 */
function buildLockoutSummary(user: User): string | null {
  const now = Date.now();
  const isShortLocked = user.lockedUntil && user.lockedUntil.getTime() > now;

  if (user.status === "security_locked") {
    return `永続ロック中 (連続失敗 ${user.failedLoginCount} 回)`;
  }
  if (isShortLocked && user.lockedUntil) {
    const until = user.lockedUntil.toLocaleString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `一時ロック中 (${until} まで, 失敗 ${user.failedLoginCount} 回)`;
  }
  if (user.failedLoginCount > 0) {
    const last = user.lastFailedLoginAt
      ? `, 直近: ${user.lastFailedLoginAt.toLocaleString("ja-JP")}`
      : "";
    return `ロックなし (失敗 ${user.failedLoginCount} 回${last})`;
  }
  return null;
}
