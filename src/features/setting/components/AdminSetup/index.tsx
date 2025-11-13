// src/features/setting/components/AdminSetup/index.tsx

"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { err } from "@/lib/errors";
import ManagerialUserCreateForm from "@/features/user/components/admin/form/ManagerialUserCreateForm";
import type { FormValues } from "@/features/user/components/admin/form/ManagerialUserCreateForm/formEntities";

import { useAdminSetup } from "../../hooks/useAdminSetup";

const REDIRECT_PATH = "/admin";

export default function AdminSetupForm() {
  const router = useRouter();
  const { trigger, isMutating } = useAdminSetup();

  const handleSubmit = async (values: FormValues) => {
    try {
      await trigger(values);
      toast.success("初回セットアップが完了しました");
      router.push(REDIRECT_PATH);
    } catch (error) {
      toast.error(err(error, "初回セットアップに失敗しました"));
    }
  };

  return (
    <ManagerialUserCreateForm
      redirectPath={REDIRECT_PATH}
      customSubmit={{ handler: handleSubmit, isMutating }}
    />
  );
}
