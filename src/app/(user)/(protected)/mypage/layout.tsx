// src/app/(user)/(protected)/mypage/layout.tsx

import type { ReactNode } from "react";

import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { PageTransition } from "@/components/Animation/PageTransition";

export default function MyPageLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <PageTransition>{children}</PageTransition>
      </Stack>
    </UserPage>
  );
}
