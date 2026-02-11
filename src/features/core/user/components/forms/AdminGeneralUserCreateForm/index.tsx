// src/features/user/components/admin/form/GeneralUserCreateForm/index.tsx

"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { ControlledField } from "@/components/Form";
import { PasswordInput, TextInput } from "@/components/Form/Input/Controlled";
import { CheckGroupInput } from "@/components/Form/Input/Controlled/CheckGroupInput";
import { err } from "@/lib/errors";
import { useCreateUser } from "@/features/user/hooks/useCreateUser";
import { useUserTagList } from "@/features/core/userTag/hooks/useUserTagList";
import { TAG_COLOR_STYLES } from "@/features/core/userTag/constants/colors";
import { APP_FEATURES } from "@/config/app/app-features.config";
import {
  RoleSelector,
  RoleProfileFields,
  getProfilesByCategory,
} from "@/features/core/userProfile/components/common";

import { DefaultValues, FormSchema, type FormValues } from "./formEntities";

type Props = {
  redirectPath?: string;
};

export default function GeneralUserCreateForm({ redirectPath = "/" }: Props) {
  const methods = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: DefaultValues,
  });

  const router = useRouter();
  const { trigger, isMutating } = useCreateUser();
  const enableUserTag = APP_FEATURES.user.enableUserTag;
  const { data: userTags = [] } = useUserTagList({ isPaused: () => !enableUserTag });
  const tagOptions = userTags.map((tag) => ({ value: tag.id, label: tag.name, color: tag.color ?? undefined }));

  // ロール選択を監視してプロフィールフィールドを動的に更新
  const selectedRole = useWatch({ control: methods.control, name: "role" });

  const submit = async (values: FormValues) => {
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

  const loading = isSubmitting || isMutating;

  return (
    <AppForm
      methods={methods}
      onSubmit={submit}
      pending={isMutating}
      fieldSpace={6}
    >
      {enableUserTag && tagOptions.length > 0 && (
        <ControlledField
          control={control}
          name="user_tag_ids"
          label="ユーザータグ"
          renderInput={(field) => (
            <CheckGroupInput field={field} options={tagOptions} displayType="bookmark" colorMap={TAG_COLOR_STYLES} />
          )}
        />
      )}
      <RoleSelector
        control={control}
        name="role"
        categories={["user"]}
        inputType="select"
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
      <RoleProfileFields methods={methods} role={selectedRole} profiles={getProfilesByCategory("user")} />
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
