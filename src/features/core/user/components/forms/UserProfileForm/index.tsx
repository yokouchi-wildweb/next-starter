// src/features/core/user/components/forms/UserProfileForm/index.tsx

"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { FormFieldItem } from "@/components/Form";
import { TextInput } from "@/components/Form/Controlled";
import { Flex } from "@/components/Layout/Flex";
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

export function UserProfileForm({
  user,
  profileData,
  redirectPath = "/mypage",
}: Props) {
  const methods = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: createDefaultValues(user, profileData),
  });

  const {
    control,
    formState: { isSubmitting },
  } = methods;

  const router = useRouter();
  const { trigger, isMutating } = useUpdateUser();

  const submit = async (values: FormValues) => {
    const displayName = values.displayName?.trim() ?? "";
    const resolvedDisplayName = displayName.length > 0 ? displayName : null;

    try {
      await trigger({
        id: user.id,
        data: {
          displayName: resolvedDisplayName,
          profileData: values.profileData,
        },
      });
      toast.success("プロフィールを更新しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "プロフィールの更新に失敗しました"));
    }
  };

  const loading = isSubmitting || isMutating;

  return (
    <AppForm methods={methods} onSubmit={submit} pending={isMutating} fieldSpace="md">
      <FormFieldItem
        control={control}
        name="displayName"
        label="表示名"
        renderInput={(field) => <TextInput field={field} />}
      />
      <RoleProfileFields
        methods={methods}
        role={user.role}
        profiles={getProfilesByCategory("user")}
        tag="selfEdit"
      />
      <Flex justify="center" gap="sm">
        <Button type="submit" disabled={loading}>
          {loading ? "更新中..." : "更新"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(redirectPath)}
          disabled={isMutating}
        >
          キャンセル
        </Button>
      </Flex>
    </AppForm>
  );
}
