// src/features/core/user/components/admin/AdminUserManageModal/RoleTabContent.tsx

"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

import Dialog from "@/components/Overlays/Dialog";
import { useToast } from "@/lib/toast";
import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Button } from "@/components/Form/Button/Button";
import { SelectInput, Input, SwitchInput } from "@/components/Form/Manual";
import { err } from "@/lib/errors";
import type { User } from "@/features/core/user/entities";
import type { UserRoleType } from "@/features/core/user/constants/role";
import { getAllRoleOptions, formatUserRoleLabel, hasRoleProfile } from "@/features/core/user/utils/roleHelpers";
import { useChangeUserRole } from "@/features/core/user/hooks/useChangeUserRole";
import { UserInfoHeader } from "./UserInfoHeader";

type Props = {
  user: User;
  onClose: () => void;
};

const FALLBACK = "(未設定)";

export function RoleTabContent({ user, onClose }: Props) {
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [reason, setReason] = useState("");
  const [deleteOldProfile, setDeleteOldProfile] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger: triggerRoleChange, isMutating } = useChangeUserRole();

  // 現在のロールがプロフィールを持つか
  const currentRoleHasProfile = user.role ? hasRoleProfile(user.role) : false;

  // 現在のロールを除外したオプションを生成
  const roleOptions = useMemo(() => {
    return getAllRoleOptions()
      .filter((opt) => opt.id !== user.role)
      .map((opt) => ({ value: opt.id, label: opt.name }));
  }, [user.role]);

  const handleReset = () => {
    setSelectedRole("");
    setReason("");
    setDeleteOldProfile(false);
    setShowConfirm(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleChangeClick = () => {
    if (!selectedRole) return;
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (!selectedRole) return;
    setShowConfirm(false);

    try {
      await triggerRoleChange({
        userId: user.id,
        data: {
          role: selectedRole as UserRoleType,
          reason: reason.trim() || undefined,
          deleteOldProfile: currentRoleHasProfile ? deleteOldProfile : undefined,
        },
      });
      showToast("ロールを変更しました", "success");
      handleClose();
      router.refresh();
    } catch (error) {
      showToast(err(error, "ロールの変更に失敗しました"), "error");
    }
  };

  const confirmContent = (
    <Flex direction="column" gap="md" className="mt-2">
      <Block className="rounded-md border border-border bg-muted/50 p-4">
        <Flex justify="between" align="center" gap="lg">
          <div className="flex-1">
            <Para size="xs" tone="muted" className="mb-1">変更前</Para>
            <Para size="sm" className="font-medium">
              {formatUserRoleLabel(user.role, FALLBACK)}
            </Para>
          </div>
          <div className="text-muted-foreground">→</div>
          <div className="flex-1 text-right">
            <Para size="xs" tone="muted" className="mb-1">変更後</Para>
            <Para size="sm" className="font-medium text-primary">
              {formatUserRoleLabel(selectedRole as UserRoleType, FALLBACK)}
            </Para>
          </div>
        </Flex>
      </Block>
      {currentRoleHasProfile && deleteOldProfile && (
        <Block className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <Para size="sm" className="text-destructive">
            現在のロールのプロフィールデータを削除します
          </Para>
        </Block>
      )}
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
        <UserInfoHeader user={user} showRole />
        <Stack space={6} className="mt-4">
          <div>
            <Para size="sm" className="mb-2 font-medium">
              変更先ロール
            </Para>
            <SelectInput
              value={selectedRole}
              onChange={(value) => setSelectedRole(String(value ?? ""))}
              options={roleOptions}
              placeholder="ロールを選択"
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
              placeholder="例: 権限変更のため"
            />
            <Para size="xs" tone="muted" className="mt-1">
              500文字以内
            </Para>
          </div>
          {currentRoleHasProfile && (
            <Block className="rounded-md border border-border bg-muted/30 p-4">
              <SwitchInput
                value={deleteOldProfile}
                name="deleteOldProfile"
                onChange={setDeleteOldProfile}
                label="現在のロールのプロフィールを削除する"
                description="削除すると復元できません"
                activeColor="destructive"
              />
            </Block>
          )}
          <Flex gap="sm" justify="end" className="mt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isMutating}>
              キャンセル
            </Button>
            <Button
              type="button"
              onClick={handleChangeClick}
              disabled={!selectedRole || isMutating}
            >
              {isMutating ? "変更中..." : "ロールを変更"}
            </Button>
          </Flex>
        </Stack>
      </Stack>
      <Dialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="ロール変更の確認"
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
