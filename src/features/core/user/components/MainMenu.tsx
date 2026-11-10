// src/features/core/user/components/MainMenu.tsx
// マイページのメニュー。項目は受け口 mypageMenu(mypageMenu/items/、生成の一覧 ../extensions/mypageMenu)から読む。
// 閉じた機能(招待 = 規則 referral、その他の操作 = 規則 mypageOther)のカードは棚の Link が描かない

"use client";

import { useMemo } from "react";

import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { useLogout } from "@/features/core/auth/hooks/useLogout";

import { RichMenuCard } from "@/features/core/user/components/common/RichMenuCard";
import { mypageMenu } from "@/features/core/user/extensions/mypageMenu";
import { buildMypageMenu } from "@/features/core/user/mypageMenu/buildMypageMenu";

export function MainMenu() {
  const { logout, isLoading: isLoggingOut } = useLogout();

  const { rows } = useMemo(
    () => buildMypageMenu({ items: mypageMenu, actions: { logout: { run: logout, pending: isLoggingOut } } }),
    [logout, isLoggingOut],
  );

  return (
    <Section>
      <Stack space={3}>
        {rows.map((row) =>
          row.kind === "link" ? (
            <RichMenuCard
              key={row.key}
              icon={row.icon}
              title={row.title}
              description={row.description}
              variant={row.variant}
              href={row.href}
              showChevron={row.showChevron}
            />
          ) : (
            <RichMenuCard
              key={row.key}
              icon={row.icon}
              title={row.title}
              description={row.description}
              variant={row.variant}
              onClick={row.onClick}
              disabled={row.disabled}
            />
          ),
        )}
      </Stack>
    </Section>
  );
}
