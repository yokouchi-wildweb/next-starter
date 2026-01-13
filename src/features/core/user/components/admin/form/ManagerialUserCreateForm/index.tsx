// src/features/user/components/admin/form/ManagerialUserCreateForm/index.tsx

"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { PasswordInput, TextInput } from "@/components/Form/Controlled";
import { err } from "@/lib/errors";
import { useCreateUser } from "@/features/core/user/hooks/useCreateUser";
import { AdminRoleSelector, AdminProfileFields } from "../../common";

import { DefaultValues, FormSchema, type FormValues } from "./formEntities";

type CustomSubmit = {
  handler: (values: FormValues) => Promise<void>;
  isMutating?: boolean;
};

type Props = {
  redirectPath?: string;
  customSubmit?: CustomSubmit;
};

export default function ManagerialUserCreateForm({
  redirectPath = "/",
  customSubmit,
}: Props) {
  const methods = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: DefaultValues,
  });

  const router = useRouter();
  const { trigger, isMutating } = useCreateUser();

  // ロール選択を監視してプロフィールフィールドを動的に更新
  const selectedRole = useWatch({ control: methods.control, name: "role" });

  const submit = async (values: FormValues) => {
    if (customSubmit) {
      await customSubmit.handler(values);
      return;
    }

    try {
      await trigger(values);
      toast.success("ユーザー登録が完了しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "ユーザー登録に失敗しました"));
    }
  };

  const {
    control,
    formState: { isSubmitting },
  } = methods;

  const pending = customSubmit?.isMutating ?? isMutating;
  const loading = isSubmitting || pending;

  return (
    <AppForm
      methods={methods}
      onSubmit={submit}
      pending={pending}
      fieldSpace="md"
    >
      <AdminRoleSelector control={control} name="role" category="admin" />
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
        name="localPassword"
        label="パスワード"
        renderInput={(field) => <PasswordInput field={field} />}
      />
      <AdminProfileFields methods={methods} role={selectedRole} />
      <div className="flex justify-center gap-3">
        <Button type="submit" disabled={loading} variant="default">
          {loading ? "登録中..." : "登録"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(redirectPath)}>
          キャンセル
        </Button>
      </div>
    </AppForm>
  );
}
