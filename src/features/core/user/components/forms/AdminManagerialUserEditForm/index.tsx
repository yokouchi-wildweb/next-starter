// src/features/user/components/admin/form/ManagerialUserEditForm/index.tsx

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/toast";
import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { ControlledField } from "@/components/Form";
import { TextInput } from "@/components/Form/Input/Controlled";
import { err } from "@/lib/errors";
import { useUpdateUser } from "@/features/user/hooks/useUpdateUser";
import type { User } from "@/features/user/entities";
import {
  RoleProfileFields,
  getProfilesByCategory,
} from "@/features/core/userProfile/components/common";

import { FormSchema, type FormValues, createDefaultValues } from "./formEntities";

type Props = {
  user: User;
  profileData?: Record<string, unknown>;
  redirectPath?: string;
};

export default function ManagerialUserEditForm({
  user,
  profileData,
  redirectPath = "/",
}: Props) {
  const methods = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: createDefaultValues(user, profileData),
  });

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useUpdateUser();

  const submit = async (values: FormValues) => {
    try {
      await trigger({
        id: user.id,
        data: {
          name: values.name,
          profileData: values.profileData,
        },
      });
      showToast("ユーザーを更新しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showToast(err(error, "ユーザー更新に失敗しました"), "error");
    }
  };

  const {
    control,
    formState: { isSubmitting },
  } = methods;

  const loading = isSubmitting || isMutating;

  return (
    <AppForm
      methods={methods}
      onSubmit={submit}
      pending={isMutating}
      fieldSpace={6}
    >
      <ControlledField
        control={control}
        name="name"
        label="表示名"
        renderInput={(field) => <TextInput field={field} />}
      />
      <RoleProfileFields methods={methods} role={user.role} profiles={getProfilesByCategory("admin")} />
      <div className="flex justify-center gap-3">
        <Button type="submit" disabled={loading} variant="default">
          {loading ? "更新中..." : "更新"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(redirectPath)}>
          キャンセル
        </Button>
      </div>
    </AppForm>
  );
}
