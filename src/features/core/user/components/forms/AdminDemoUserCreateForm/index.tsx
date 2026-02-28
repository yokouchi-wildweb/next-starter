// src/features/user/components/admin/form/DemoUserCreateForm/index.tsx

"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/toast";
import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { ControlledField } from "@/components/Form";
import { PasswordInput, SelectInput, TextInput } from "@/components/Form/Input/Controlled";
import { err } from "@/lib/errors";
import { useCreateDemoUser } from "@/features/user/hooks/useCreateDemoUser";
import { getAllRoleOptions } from "@/features/user/constants";
import {
  RoleProfileFields,
  getProfilesByCategory,
} from "@/features/core/userProfile/components/common";

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
  const { showToast } = useToast();
  const { trigger, isMutating } = useCreateDemoUser();

  // ロール選択を監視してプロフィールフィールドを動的に更新
  const selectedRole = useWatch({ control: methods.control, name: "role" });

  const submit = async (values: FormValues) => {
    try {
      await trigger(values);
      showToast("デモユーザーを作成しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showToast(err(error, "デモユーザーの作成に失敗しました"), "error");
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
        name="role"
        label="権限"
        renderInput={(field) => (
          <SelectInput
            field={field}
            options={getAllRoleOptions().map((r) => ({
              value: r.id,
              label: r.name,
            }))}
            placeholder="権限を選択"
          />
        )}
      />
      <ControlledField
        control={control}
        name="name"
        label="表示名"
        renderInput={(field) => <TextInput field={field} />}
      />
      <ControlledField
        control={control}
        name="email"
        label="メールアドレス"
        renderInput={(field) => <TextInput type="email" field={field} />}
      />
      <ControlledField
        control={control}
        name="localPassword"
        label="パスワード"
        renderInput={(field) => <PasswordInput field={field} />}
      />
      <RoleProfileFields
        methods={methods}
        role={selectedRole}
        profiles={{ ...getProfilesByCategory("admin"), ...getProfilesByCategory("user") }}
      />
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
