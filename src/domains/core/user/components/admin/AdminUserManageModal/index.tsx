// src/domains/core/user/components/admin/AdminUserManageModal/index.tsx

"use client";

import TabbedModal from "@/components/Overlays/TabbedModal";
import type { User } from "@/domains/core/user/entities";
import { SummaryTabContent } from "./SummaryTabContent";
import { AuthTabContent } from "./AuthTabContent";
import { StatusTabContent } from "./StatusTabContent";
import { RoleTabContent } from "./RoleTabContent";
import { DeleteTabContent } from "./DeleteTabContent";
import { HistoryTabContent } from "./HistoryTabContent";
import { useAdminManageTabs } from "@/domains/core/user/hooks/useAdminManageTabs";

type Props = {
  open: boolean;
  user: User | null;
  onClose: () => void;
};

export default function AdminUserManageModal({ open, user, onClose }: Props) {
  // 点 userAdminManageTabs の項目(上流のタブの後ろに足す)
  const extraTabs = useAdminManageTabs();

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
          value: "auth",
          label: "認証情報",
          content: <AuthTabContent user={user} onClose={onClose} />,
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
        ...extraTabs.map(({ key, label, Content }) => ({
          value: key,
          label,
          content: <Content user={user} onClose={onClose} />,
        })),
      ]}
    />
  );
}
