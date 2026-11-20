// src/features/user/components/admin/form/GeneralUserCreateForm/index.tsx

"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@/lib/unsavedGuard";
import { useToast } from "@/lib/toast";
import { AppForm } from "@/lib/formSuite";
import { Button } from "@/components/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { ControlledField } from "@/lib/formSuite";
import { ControlledPasswordInput, ControlledTextInput } from "@/lib/formSuite";
import { ControlledCheckGroupInput } from "@/lib/formSuite";
import { err } from "@/lib/errors";
import { useCreateUser } from "@/features/user/hooks/useCreateUser";
import { useUserTagList } from "@/features/core/userTag/hooks/useUserTagList";
import { TAG_COLOR_STYLES } from "@/features/core/userTag/constants/colors";
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
  const { showToast } = useToast();
  const { trigger, isMutating } = useCreateUser();
  // ユーザータグは常時開の基盤(門番の規則を持たない、設定 D64・D115)
  const { data: userTags = [] } = useUserTagList();
  const tagOptions = userTags.map((tag) => ({ value: tag.id, label: tag.name, color: tag.color ?? undefined }));

  // ロール選択を監視してプロフィールフィールドを動的に更新
  const selectedRole = useWatch({ control: methods.control, name: "role" });

  const submit = async (values: FormValues) => {
    try {
      await trigger(values);
      showToast("ユーザー登録が完了しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showToast(err(error, "ユーザー登録に失敗しました"), "error");
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
      fieldSpace="lg"
    >
      {tagOptions.length > 0 && (
        <ControlledField
          control={control}
          name="user_tag_ids"
          label="ユーザータグ"
          renderInput={(field) => (
            <ControlledCheckGroupInput field={field} options={tagOptions} displayType="bookmark" colorMap={TAG_COLOR_STYLES} />
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
        renderInput={(field) => <ControlledTextInput field={field} />}
      />
      <ControlledField
        control={control}
        name="email"
        label="メールアドレス"
        renderInput={(field) => <ControlledTextInput type="email" field={field} />}
      />
      <ControlledField
        control={control}
        name="localPassword"
        label="パスワード"
        renderInput={(field) => <ControlledPasswordInput field={field} autoComplete="new-password" />}
      />
      <RoleProfileFields methods={methods} role={selectedRole} profiles={getProfilesByCategory("user")} />
      <Flex justify="center" className="gap-3">
        <Button type="submit" disabled={loading} variant="default">
          {loading ? "登録中..." : "登録"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(redirectPath)}>
          キャンセル
        </Button>
      </Flex>
    </AppForm>
  );
}
