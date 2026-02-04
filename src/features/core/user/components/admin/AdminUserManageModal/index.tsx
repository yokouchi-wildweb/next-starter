// src/features/core/user/components/admin/AdminUserManageModal/index.tsx

"use client";

import TabbedModal from "@/components/Overlays/TabbedModal";
import type { User } from "@/features/core/user/entities";
import { SummaryTabContent } from "./SummaryTabContent";
import { StatusTabContent } from "./StatusTabContent";
import { RoleTabContent } from "./RoleTabContent";
import { DeleteTabContent } from "./DeleteTabContent";
import { HistoryTabContent } from "./HistoryTabContent";

type Props = {
  open: boolean;
  user: User | null;
  onClose: () => void;
};

export default function AdminUserManageModal({ open, user, onClose }: Props) {
  if (!user) {
    return null;
  }

  return (
    <TabbedModal
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
      title="ユーザー管理"
      maxWidth={700}
      height="60vh"
      tabs={[
        {
          value: "summary",
          label: "概要",
          content: <SummaryTabContent user={user} />,
        },
        {
          value: "status",
          label: "ステータス変更",
          content: <StatusTabContent user={user} onClose={onClose} />,
        },
        {
          value: "role",
          label: "ロール変更",
          content: <RoleTabContent user={user} onClose={onClose} />,
        },
        {
          value: "delete",
          label: "削除",
          content: <DeleteTabContent user={user} onClose={onClose} />,
        },
        {
          value: "history",
          label: "操作履歴",
          content: <HistoryTabContent user={user} />,
        },
      ]}
    />
  );
}
