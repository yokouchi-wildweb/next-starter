// src/features/core/user/components/admin/AdminUserManageModal/index.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import TabbedModal from "@/components/Overlays/TabbedModal";
import { useAppToast } from "@/hooks/useAppToast";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Button } from "@/components/Form/Button/Button";
import { SelectInput, Input } from "@/components/Form/Manual";
import { err } from "@/lib/errors";
import type { User } from "@/features/core/user/entities";
import type { UserStatus } from "@/features/core/user/types";
import { USER_STATUS_OPTIONS, formatUserStatusLabel } from "@/features/core/user/constants/status";
import { useChangeUserStatus } from "@/features/core/user/hooks/useChangeUserStatus";

type Props = {
  open: boolean;
  user: User | null;
  onClose: () => void;
};

const adminFallback = "(未設定)";

export default function AdminUserManageModal({ open, user, onClose }: Props) {
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [statusReason, setStatusReason] = useState("");
  const [deleteReason, setDeleteReason] = useState("");

  const router = useRouter();
  const { showAppToast } = useAppToast();
  const { trigger: triggerStatusChange, isMutating: isStatusChanging } = useChangeUserStatus();

  if (!user) {
    return null;
  }

  const handleRequestClose = () => {
    setSelectedStatus("");
    setStatusReason("");
    setDeleteReason("");
    onClose();
  };

  const handleStatusChange = async () => {
    if (!selectedStatus) return;

    try {
      await triggerStatusChange({
        userId: user.id,
        data: {
          status: selectedStatus as UserStatus,
          reason: statusReason.trim() || undefined,
        },
      });
      showAppToast("ステータスを変更しました", "success");
      handleRequestClose();
      router.refresh();
    } catch (error) {
      showAppToast(err(error, "ステータスの変更に失敗しました"), "error");
    }
  };

  const handleDelete = () => {
    // TODO: 実装予定
    console.log("論理削除:", { userId: user.id, reason: deleteReason });
    handleRequestClose();
  };

  // ユーザー情報ヘッダー
  const userInfoHeader = (
    <Block
      className="rounded-md border border-border bg-card px-4 py-3"
      space="xs"
    >
      <Flex direction="column" gap="xs">
        <Flex justify="between" align="center" gap="lg" wrap="wrap">
          <div>
            <Para size="xs" tone="muted">
              対象ユーザー
            </Para>
            <Para>{user.displayName ?? adminFallback}</Para>
            <Para tone="muted" size="sm">
              {user.email ?? adminFallback}
            </Para>
          </div>
          <div className="text-right">
            <Para size="xs" tone="muted">
              現在のステータス
            </Para>
            <Para size="sm" className="font-medium">
              {formatUserStatusLabel(user.status, adminFallback)}
            </Para>
          </div>
        </Flex>
      </Flex>
    </Block>
  );

  // ステータス変更タブ
  const statusTabContent = (
    <Block space="sm" padding="md">
      {userInfoHeader}
      <Block space="md" className="mt-4">
        <div>
          <Para size="sm" className="mb-2 font-medium">
            変更先ステータス
          </Para>
          <SelectInput
            field={{
              value: selectedStatus,
              onChange: (value) => setSelectedStatus(String(value ?? "")),
            }}
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
            value={statusReason}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStatusReason(e.target.value)}
            placeholder="例: 規約違反のため"
          />
          <Para size="xs" tone="muted" className="mt-1">
            500文字以内
          </Para>
        </div>
        <Flex gap="sm" justify="end" className="mt-4">
          <Button type="button" variant="outline" onClick={handleRequestClose} disabled={isStatusChanging}>
            キャンセル
          </Button>
          <Button
            type="button"
            onClick={handleStatusChange}
            disabled={!selectedStatus || isStatusChanging}
          >
            {isStatusChanging ? "変更中..." : "ステータスを変更"}
          </Button>
        </Flex>
      </Block>
    </Block>
  );

  // 削除タブ
  const deleteTabContent = (
    <Block space="sm" padding="md">
      {userInfoHeader}
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
            value={deleteReason}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeleteReason(e.target.value)}
            placeholder="例: 不正利用のため"
          />
          <Para size="xs" tone="muted" className="mt-1">
            500文字以内
          </Para>
        </div>
        <Flex gap="sm" justify="end" className="mt-4">
          <Button type="button" variant="outline" onClick={handleRequestClose}>
            キャンセル
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
          >
            削除する
          </Button>
        </Flex>
      </Block>
    </Block>
  );

  // 操作履歴タブ
  const historyTabContent = (
    <Block space="sm" padding="md">
      {userInfoHeader}
      <Block className="mt-4 rounded-md border border-border bg-muted/30 p-8 text-center">
        <Para tone="muted">
          操作履歴は本実装時に表示されます
        </Para>
      </Block>
    </Block>
  );

  return (
    <TabbedModal
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          handleRequestClose();
        }
      }}
      title="ユーザー管理"
      maxWidth={700}
      height="60vh"
      tabs={[
        { value: "status", label: "ステータス変更", content: statusTabContent },
        { value: "delete", label: "削除", content: deleteTabContent },
        { value: "history", label: "操作履歴", content: historyTabContent },
      ]}
    />
  );
}
