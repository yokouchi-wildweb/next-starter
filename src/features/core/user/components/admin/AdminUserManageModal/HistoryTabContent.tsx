// src/features/core/user/components/admin/AdminUserManageModal/HistoryTabContent.tsx

import { Block } from "@/components/Layout/Block";
import { Para } from "@/components/TextBlocks/Para";
import type { User } from "@/features/core/user/entities";
import { UserInfoHeader } from "./UserInfoHeader";

type Props = {
  user: User;
};

export function HistoryTabContent({ user }: Props) {
  return (
    <Block space="sm" padding="md">
      <UserInfoHeader user={user} />
      <Block className="mt-4 rounded-md border border-border bg-muted/30 p-8 text-center">
        <Para tone="muted">
          操作履歴は本実装時に表示されます
        </Para>
      </Block>
    </Block>
  );
}
