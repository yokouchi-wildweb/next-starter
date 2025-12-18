// src/app/(user)/signup/register/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { HideBottomNav } from "@/components/AppFrames/User/controls/BottomNavControl";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Registration } from "@/features/core/auth/components/Registration";

type SignUpRegisterPageProps = {
  searchParams?: Promise<{
    method?: string;
  }>;
};

export default async function SignUpRegisterPage({
  searchParams,
}: SignUpRegisterPageProps) {
  const methodParam = searchParams ? (await searchParams).method : undefined;
  const method =
    methodParam === "thirdParty"
      ? "thirdParty"
      : methodParam === "email"
        ? "email"
        : undefined;

  return (
    <UserPage containerType="narrowStack">
      <HideBottomNav sp />
      <UserPageTitle srOnly>本登録</UserPageTitle>
      <Registration method={method} />
    </UserPage>
  );
}
