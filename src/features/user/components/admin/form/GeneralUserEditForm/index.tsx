// src/features/user/components/admin/form/GeneralUserEditForm/index.tsx

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { TextInput } from "@/components/Form/Controlled";
import { SelectInput } from "@/components/Form/Manual";
import { err } from "@/lib/errors";
import { useUpdateUser } from "@/features/user/hooks/useUpdateUser";
import type { User } from "@/features/user/entities";
import { USER_STATUS_OPTIONS } from "@/features/user/constants/status";

import { FormSchema, type FormValues, createDefaultValues } from "./formEntities";

type Props = {
  user: User;
  redirectPath?: string;
};

export default function GeneralUserEditForm({ user, redirectPath = "/" }: Props) {
  const methods = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: createDefaultValues(user),
  });

  const router = useRouter();
  const { trigger, isMutating } = useUpdateUser();

  const submit = async (values: FormValues) => {
    try {
      await trigger({
        id: user.id,
        data: {
          displayName: values.displayName,
          email: values.email,
          role: values.role,
          status: values.status,
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
      <FormFieldItem
        control={control}
        name="displayName"
        label="表示名"
        renderInput={(field) => <TextInput field={field} />}
      />
      <FormFieldItem
        control={control}
        name="email"
        label="メールアドレス"
        renderInput={(field) => <TextInput type="email" field={field} />}
      />
      <FormFieldItem
        control={control}
        name="status"
        label="ステータス"
        renderInput={(field) => (
          <SelectInput field={field} options={USER_STATUS_OPTIONS} placeholder="ステータスを選択" />
        )}
      />
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
