// src/features/user/components/common/OauthUserProfileForm/index.tsx

"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { TextInput } from "@/components/Form/Controlled";
import { Flex } from "@/components/Layout/Flex";
import { err } from "@/lib/errors";
import { useUpdateUser } from "@/features/user/hooks/useUpdateUser";
import type { User } from "@/features/user/entities";

import { MutableUserProfileFields } from "../MutableUserProfileFields";
import { FormSchema, type FormValues, createDefaultValues } from "./formEntities";

type Props = {
  user: User;
  redirectPath?: string;
};

export function OauthUserProfileForm({ user, redirectPath = "/mypage" }: Props) {
  const methods = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: createDefaultValues(user),
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
      <MutableUserProfileFields />
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
