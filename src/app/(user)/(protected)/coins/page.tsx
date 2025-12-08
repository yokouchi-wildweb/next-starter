// src/app/(user)/(protected)/coins/page.tsx

import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { PageTitle } from "@/components/TextBlocks";

export default function CoinsPage() {
  return (
    <UserPage containerType="contentShell" space="md">
      <PageTitle>コイン管理</PageTitle>
    </UserPage>
  );
}
