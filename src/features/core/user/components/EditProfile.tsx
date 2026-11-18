// src/features/core/user/components/EditProfile.tsx

"use client";

import { useCallback } from "react";
import { useRouter } from "@/lib/unsavedGuard";
import { useToast } from "@/lib/toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { AppForm } from "@/components/Form/AppForm";
import { ControlledField } from "@/components/Form";
import { TextInput } from "@/components/Form/Input/Controlled";
import { Button } from "@/components/Form/Button/Button";
import { Section } from "@/components/Layout/Section";
import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { useUpdateMyProfile } from "@/features/core/user/hooks/useUpdateMyProfile";
import type { User } from "@/features/core/user/entities";
import { UserNameFormSchema } from "@/features/core/user/entities/userName";
import {
  RoleProfileFields,
  getProfilesByCategory,
} from "@/features/core/userProfile/components/common";
import {
  createProfileDataValidator,
  getProfilesByCategory as getProfilesByCategoryUtil,
} from "@/features/core/userProfile/utils";

import { AccountPageHeader } from "@/features/core/user/components/common/AccountPageHeader";
import { z } from "zod";

// --- スキーマ ---

const validateProfileData = createProfileDataValidator(
  getProfilesByCategoryUtil("user"),
  "selfEdit"
);

const FormSchema = z
  .object({
    name: UserNameFormSchema,
    role: z.string(),
    profileData: z.record(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    validateProfileData(value, ctx);
  });

type FormValues = {
  name: string;
  role: string;
  profileData?: Record<string, unknown>;
};

// --- コンポーネント ---

type EditProfileProps = {
  user: User;
  profileData?: Record<string, unknown>;
  /** 見出し(タイトル + 戻るボタン)を出すか。モーダル内や独自の見出しがある画面では false(既定: true) */
  showHeader?: boolean;
  /** 保存後の遷移先(既定: "/mypage/account")。null = 遷移せずその場に留まり、保存完了のトーストを出す(他の設定と同居するページ用) */
  afterSaveHref?: string | null;
  /** 見出しの戻るボタンの遷移先(既定: afterSaveHref、null のときは "/mypage/account") */
  backHref?: string;
};

const DEFAULT_AFTER_SAVE_HREF = "/mypage/account";

export function EditProfile({
  user,
  profileData,
  showHeader = true,
  afterSaveHref = DEFAULT_AFTER_SAVE_HREF,
  backHref = afterSaveHref ?? DEFAULT_AFTER_SAVE_HREF,
}: EditProfileProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const { updateProfile, isLoading, error } = useUpdateMyProfile();

  const methods = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      name: user.name ?? "",
      role: user.role,
      profileData: profileData ?? {},
    },
  });

  const { control, formState: { isSubmitting } } = methods;
  const loading = isLoading || isSubmitting;

  const handleSubmit = useCallback(
    async (values: FormValues) => {
      const trimmedName = values.name?.trim() ?? "";
      const resolvedName = trimmedName.length > 0 ? trimmedName : null;

      const result = await updateProfile({
        name: resolvedName ?? "",
        profileData: values.profileData,
      });
      if (result) {
        if (afterSaveHref === null) {
          showToast("プロフィールを保存しました", "success");
        } else {
          router.push(afterSaveHref);
        }
        router.refresh();
      }
    },
    [updateProfile, router, afterSaveHref, showToast]
  );

  return (
    <Section>
      <Stack gap="md">
        {showHeader && (
          <AccountPageHeader
            title="プロフィール編集"
            backHref={backHref}
            backDisabled={loading}
          />
        )}
        <Block className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <AppForm methods={methods} onSubmit={handleSubmit} pending={loading} fieldSpace="lg">
            <ControlledField
              control={control}
              name="name"
              label="ユーザー名"
              renderInput={(field) => <TextInput field={field} />}
            />
            <RoleProfileFields
              methods={methods}
              role={user.role}
              profiles={getProfilesByCategory("user")}
              tag="selfEdit"
            />
            {error && (
              <Para size="sm" tone="destructive" weight="inherit" align="inherit" className="my-0">{error}</Para>
            )}
            <Button
              type="submit"
              loading={loading}
              loadingLabel="保存中..."
              className="w-full"
            >
              保存
            </Button>
          </AppForm>
        </Block>
      </Stack>
    </Section>
  );
}
