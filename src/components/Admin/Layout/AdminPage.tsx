// src/components/Admin/Layout/AdminPage.tsx

import type { PropsWithChildren } from "react";

import { Main } from "@/components/TextBlocks";

export default function AdminPage({ children }: PropsWithChildren) {
  return (
    <Main containerType="plain" padding="lg">
      {children}
    </Main>
  );
}
