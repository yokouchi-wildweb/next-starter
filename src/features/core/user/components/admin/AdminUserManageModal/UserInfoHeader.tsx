// src/features/core/user/components/admin/AdminUserManageModal/UserInfoHeader.tsx

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import type { User } from "@/features/core/user/entities";
import { formatUserStatusLabel } from "@/features/core/user/constants/status";

type Props = {
  user: User;
  fallback?: string;
};

const DEFAULT_FALLBACK = "(未設定)";

export function UserInfoHeader({ user, fallback = DEFAULT_FALLBACK }: Props) {
  return (
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
            <Para>{user.displayName ?? fallback}</Para>
            <Para tone="muted" size="sm">
              {user.email ?? fallback}
            </Para>
          </div>
          <div className="text-right">
            <Para size="xs" tone="muted">
              現在のステータス
            </Para>
            <Para size="sm" className="font-medium">
              {formatUserStatusLabel(user.status, fallback)}
            </Para>
          </div>
        </Flex>
      </Flex>
    </Block>
  );
}
