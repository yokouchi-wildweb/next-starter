// src/features/user/components/admin/form/DemoUserCreateForm/index.tsx

"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { PasswordInput, TextInput } from "@/components/Form/Controlled";
import { SelectInput } from "@/components/Form/Manual";
import { err } from "@/lib/errors";
import { useCreateDemoUser } from "@/features/core/user/hooks/useCreateDemoUser";
import { USER_ROLE_OPTIONS } from "@/features/core/user/constants";

import { DefaultValues, FormSchema, type FormValues } from "./formEntities";

type Props = {
  redirectPath?: string;
};

export default function DemoUserCreateForm({ redirectPath = "/admin/users/demo" }: Props) {
  const methods = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: DefaultValues,
  });

  const router = useRouter();
  const { trigger, isMutating } = useCreateDemoUser();

  const role = useWatch({ control: methods.control, name: "role" });
  const isAdmin = role === "admin";

  const submit = async (values: FormValues) => {
    try {
      await trigger({
        displayName: values.displayName,
        email: values.email,
        role: values.role,
        localPassword: isAdmin ? values.localPassword : undefined,
      });
      toast.success("デモユーザーを作成しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "デモユーザーの作成に失敗しました"));
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
        name="role"
        label="権限"
        description={{ text: "管理者はローカル認証、一般ユーザーはメール認証になります" }}
        renderInput={(field) => (
          <SelectInput
            field={field}
            options={USER_ROLE_OPTIONS.map((o) => ({ value: o.id, label: o.name }))}
            placeholder="権限を選択"
          />
        )}
      />
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
      {isAdmin && (
        <FormFieldItem
          control={control}
          name="localPassword"
          label="パスワード"
          description={{ text: "管理者用のローカル認証パスワード（8文字以上）" }}
          renderInput={(field) => <PasswordInput field={field} />}
        />
      )}
      <div className="flex justify-center gap-3">
        <Button type="submit" disabled={loading} variant="default">
          {loading ? "作成中..." : "作成"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(redirectPath)}>
          キャンセル
        </Button>
      </div>
    </AppForm>
  );
}
