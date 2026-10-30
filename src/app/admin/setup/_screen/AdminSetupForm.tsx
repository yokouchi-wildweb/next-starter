// src/app/admin/setup/_screen/AdminSetupForm.tsx

"use client";

import { useRouter } from "next/navigation";

import { useToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { AdminManagerialUserCreateForm as ManagerialUserCreateForm } from "@/features/user/components/forms";
import type { FormValues } from "@/features/user/components/forms/AdminManagerialUserCreateForm/formEntities";

import { useAdminSetup } from "@/features/core/setting/hooks/useAdminSetup";

const REDIRECT_PATH = "/admin/login";

export default function AdminSetupForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useAdminSetup();

  const handleSubmit = async (values: FormValues) => {
    try {
      await trigger(values);
      showToast("初回セットアップが完了しました", "success");
      router.push(REDIRECT_PATH);
    } catch (error) {
      showToast(err(error, "初回セットアップに失敗しました"), "error");
    }
  };

  return (
    <ManagerialUserCreateForm
      redirectPath={REDIRECT_PATH}
      customSubmit={{ handler: handleSubmit, isMutating }}
    />
  );
}
