// src/app/(user)/(protected)/coins/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";

export default function CoinsPage() {
  return (
    <UserPage containerType="contentShell" space="md">
      <UserPageTitle>コイン管理</UserPageTitle>
    </UserPage>
  );
}
