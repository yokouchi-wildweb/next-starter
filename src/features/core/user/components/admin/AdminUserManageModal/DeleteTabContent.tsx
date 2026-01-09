// src/features/core/user/components/admin/AdminUserManageModal/DeleteTabContent.tsx

"use client";

import { useState } from "react";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Button } from "@/components/Form/Button/Button";
import { Input } from "@/components/Form/Manual";
import type { User } from "@/features/core/user/entities";
import { UserInfoHeader } from "./UserInfoHeader";

type Props = {
  user: User;
  onClose: () => void;
};

export function DeleteTabContent({ user, onClose }: Props) {
  const [reason, setReason] = useState("");

  const handleReset = () => {
    setReason("");
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleDelete = () => {
    // TODO: 実装予定
    console.log("論理削除:", { userId: user.id, reason });
    handleClose();
  };

  return (
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
          <Button type="button" variant="outline" onClick={handleClose}>
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
}
