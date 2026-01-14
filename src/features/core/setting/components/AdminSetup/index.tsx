// src/features/setting/components/AdminSetup/index.tsx

"use client";

import { useRouter } from "next/navigation";

import { useAppToast } from "@/hooks/useAppToast";
import { err } from "@/lib/errors";
import ManagerialUserCreateForm from "@/features/user/components/forms/AdminManagerialUserCreateForm";
import type { FormValues } from "@/features/user/components/forms/AdminManagerialUserCreateForm/formEntities";

import { useAdminSetup } from "@/features/core/setting/hooks/useAdminSetup";

const REDIRECT_PATH = "/admin/login";

export default function AdminSetupForm() {
  const router = useRouter();
  const { showAppToast } = useAppToast();
  const { trigger, isMutating } = useAdminSetup();

  const handleSubmit = async (values: FormValues) => {
    try {
      await trigger(values);
      showAppToast("初回セットアップが完了しました", "success");
      router.push(REDIRECT_PATH);
    } catch (error) {
      showAppToast(err(error, "初回セットアップに失敗しました"), "error");
    }
  };

  return (
    <ManagerialUserCreateForm
      redirectPath={REDIRECT_PATH}
      customSubmit={{ handler: handleSubmit, isMutating }}
    />
  );
}
