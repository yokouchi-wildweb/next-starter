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
import { RoleProfileFields } from "@/features/core/userProfile/components/common";
import type { ProfileConfig } from "@/features/core/userProfile/profiles";
import adminProfile from "@/features/core/userProfile/profiles/admin.profile.json";
import userProfile from "@/features/core/userProfile/profiles/user.profile.json";
import contributorProfile from "@/features/core/userProfile/profiles/contributor.profile.json";

import { DefaultValues, FormSchema, type FormValues } from "./formEntities";

// 全ロール用プロフィール設定
const ALL_USER_PROFILES: Record<string, ProfileConfig> = {
  admin: adminProfile as ProfileConfig,
  user: userProfile as ProfileConfig,
  contributor: contributorProfile as ProfileConfig,
};

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

  // ロール選択を監視してプロフィールフィールドを動的に更新
  const selectedRole = useWatch({ control: methods.control, name: "role" });

  const submit = async (values: FormValues) => {
    try {
      await trigger(values);
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
      <FormFieldItem
        control={control}
        name="localPassword"
        label="パスワード"
        renderInput={(field) => <PasswordInput field={field} />}
      />
      <RoleProfileFields methods={methods} role={selectedRole} profiles={ALL_USER_PROFILES} />
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
