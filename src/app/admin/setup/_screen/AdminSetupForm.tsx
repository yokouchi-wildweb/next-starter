// src/app/admin/setup/_screen/AdminSetupForm.tsx
// 初期セットアップの送信・toast・遷移は公開 hook useAdminSetup の submit。ここは初期設定の form(core の部品)へ渡すだけ。

"use client";

import { AdminManagerialUserCreateForm as ManagerialUserCreateForm } from "@/features/user/components/forms";

import { ADMIN_SETUP_REDIRECT_PATH, useAdminSetup } from "@/features/core/setting/hooks/useAdminSetup";

export default function AdminSetupForm() {
  const { submit, isMutating } = useAdminSetup();

  return (
    <ManagerialUserCreateForm
      redirectPath={ADMIN_SETUP_REDIRECT_PATH}
      customSubmit={{ handler: submit, isMutating }}
    />
  );
}
