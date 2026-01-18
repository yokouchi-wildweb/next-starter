// src/features/user/components/admin/form/GeneralUserEditForm/index.tsx

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { FieldItem } from "@/components/Form";
import { TextInput, PasswordInput } from "@/components/Form/Controlled";
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

export default function GeneralUserEditForm({
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
  const { trigger, isMutating } = useUpdateUser();

  const submit = async (values: FormValues) => {
    const trimmedPassword = values.newPassword.trim();
    const resolvedNewPassword = trimmedPassword.length > 0 ? trimmedPassword : undefined;
    try {
      await trigger({
        id: user.id,
        data: {
          displayName: values.displayName,
          email: values.email,
          newPassword: resolvedNewPassword,
          profileData: values.profileData,
        },
      });
      toast.success("ユーザーを更新しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "ユーザー更新に失敗しました"));
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
      fieldSpace="md"
    >
      <FieldItem
        control={control}
        name="displayName"
        label="表示名"
        renderInput={(field) => <TextInput field={field} />}
      />
      <FieldItem
        control={control}
        name="email"
        label="メールアドレス"
        renderInput={(field) => <TextInput type="email" field={field} />}
      />
      <FieldItem
        control={control}
        name="newPassword"
        label="パスワード"
        renderInput={(field) => (
          <PasswordInput field={field} placeholder="新しいパスワード" />
        )}
      />
      <RoleProfileFields methods={methods} role={user.role} profiles={getProfilesByCategory("user")} />
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
