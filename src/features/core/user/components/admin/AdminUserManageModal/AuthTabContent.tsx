// src/features/core/user/components/admin/AdminUserManageModal/AuthTabContent.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Button } from "@/components/Form/Button/Button";
import { Input, PasswordInput } from "@/components/Form/Input/Manual";
import { useToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import type { User } from "@/features/core/user/entities";
import { useUpdateUser } from "@/features/core/user/hooks/useUpdateUser";
import { formatForDisplay, formatToE164 } from "@/features/core/user/utils/phoneNumber";
import { UserInfoHeader } from "./UserInfoHeader";

// --- 表示制御 ---

type FieldVisibility = {
  email: boolean;
  password: boolean;
  phone: boolean;
};

const PROVIDER_VISIBILITY: Record<string, FieldVisibility> = {
  email: { email: true, password: true, phone: true },
  local: { email: true, password: true, phone: false },
};

const DEFAULT_VISIBILITY: FieldVisibility = {
  email: true,
  password: false,
  phone: true,
};

function getFieldVisibility(providerType: string): FieldVisibility {
  return PROVIDER_VISIBILITY[providerType] ?? DEFAULT_VISIBILITY;
}

// --- 認証方法ラベル ---

const PROVIDER_LABELS: Record<string, string> = {
  email: "Eメール認証",
  local: "ローカル認証",
  "google.com": "Google",
  "yahoo.com": "Yahoo",
  "github": "GitHub",
  "apple": "Apple",
  "microsoft": "Microsoft",
  "facebook.com": "Facebook",
  "twitter.com": "Twitter",
  "line": "LINE",
  "oidc": "OIDC",
  "saml": "SAML",
  "custom": "カスタム",
};

function getProviderLabel(providerType: string): string {
  return PROVIDER_LABELS[providerType] ?? providerType;
}

// --- セクション共通 ---

type SectionProps = {
  user: User;
  onSuccess: () => void;
};

// --- EmailSection ---

function EmailSection({ user, onSuccess }: SectionProps) {
  const [email, setEmail] = useState(user.email ?? "");
  const { trigger, isMutating } = useUpdateUser();
  const { showToast } = useToast();

  const hasChanged = email.trim() !== (user.email ?? "");

  const handleSave = async () => {
    try {
      await trigger({ id: user.id, data: { email: email.trim() } });
      showToast("メールアドレスを更新しました", "success");
      onSuccess();
    } catch (error) {
      showToast(err(error, "メールアドレスの更新に失敗しました"), "error");
    }
  };

  return (
    <div>
      <Para size="sm" className="mb-2 font-medium">メールアドレス</Para>
      <Flex gap="sm" align="center">
        <div className="flex-1">
          <Input
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            type="email"
            placeholder="example@mail.com"
          />
        </div>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={!hasChanged || isMutating}
        >
          {isMutating ? "更新中..." : "保存"}
        </Button>
      </Flex>
    </div>
  );
}

// --- PasswordSection ---

function PasswordSection({ user, onSuccess }: SectionProps) {
  const [password, setPassword] = useState("");
  const { trigger, isMutating } = useUpdateUser();
  const { showToast } = useToast();

  const isValid = password.trim().length >= 8;

  const handleSave = async () => {
    try {
      await trigger({ id: user.id, data: { newPassword: password.trim() } });
      showToast("パスワードを更新しました", "success");
      setPassword("");
      onSuccess();
    } catch (error) {
      showToast(err(error, "パスワードの更新に失敗しました"), "error");
    }
  };

  return (
    <div>
      <Para size="sm" className="mb-2 font-medium">パスワード変更</Para>
      <Flex gap="sm" align="center">
        <div className="flex-1">
          <PasswordInput
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            placeholder="新しいパスワード（8文字以上）"
          />
        </div>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={!isValid || isMutating}
        >
          {isMutating ? "更新中..." : "保存"}
        </Button>
      </Flex>
    </div>
  );
}

// --- PhoneSection ---

function PhoneSection({ user, onSuccess }: SectionProps) {
  // 表示はローカル形式（09012345678）、保存時にE.164変換
  const displayValue = user.phoneNumber ? formatForDisplay(user.phoneNumber).replace(/-/g, "") : "";
  const [phoneNumber, setPhoneNumber] = useState(displayValue);
  const { trigger, isMutating } = useUpdateUser();
  const { showToast } = useToast();

  const trimmed = phoneNumber.trim();
  const e164Value = trimmed ? formatToE164(trimmed) : "";
  const hasChanged = trimmed !== "" ? e164Value !== (user.phoneNumber ?? "") : (user.phoneNumber ?? "") !== "";
  // 空の場合はクリア（null送信）、値がある場合はE.164変換後にバリデーション
  const isValid = hasChanged && (trimmed === "" || /^\+[1-9]\d{1,14}$/.test(e164Value));

  const handleSave = async () => {
    try {
      const value = trimmed === "" ? null : e164Value;
      await trigger({ id: user.id, data: { phoneNumber: value } });
      showToast(
        value ? "電話番号を更新しました" : "電話番号をクリアしました",
        "success",
      );
      onSuccess();
    } catch (error) {
      showToast(err(error, "電話番号の更新に失敗しました"), "error");
    }
  };

  return (
    <div>
      <Para size="sm" className="mb-2 font-medium">電話番号</Para>
      <Flex gap="sm" align="center">
        <div className="flex-1">
          <Input
            value={phoneNumber}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhoneNumber(e.target.value)}
            type="tel"
            placeholder="09012345678"
          />
        </div>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={!isValid || isMutating}
        >
          {isMutating ? "更新中..." : trimmed === "" ? "クリア" : "保存"}
        </Button>
      </Flex>
      {trimmed !== "" && !(/^\+[1-9]\d{1,14}$/.test(e164Value)) && (
        <Para size="xs" tone="danger" className="mt-1">
          有効な電話番号を入力してください（例: 09012345678）
        </Para>
      )}
      {user.phoneVerifiedAt && (
        <Para size="xs" tone="muted" className="mt-1">
          認証済み: {new Date(user.phoneVerifiedAt).toLocaleString("ja-JP")}
        </Para>
      )}
    </div>
  );
}

// --- AuthTabContent ---

type Props = {
  user: User;
  onClose: () => void;
};

export function AuthTabContent({ user, onClose }: Props) {
  const router = useRouter();
  const visibility = getFieldVisibility(user.providerType);

  const handleSuccess = () => {
    onClose();
    router.refresh();
  };

  const hasAnyField = visibility.email || visibility.password || visibility.phone;

  return (
    <Stack space={4} padding="md">
      <UserInfoHeader
        user={user}
        infoLabel="認証方法"
        infoValue={getProviderLabel(user.providerType)}
      />
      {hasAnyField ? (
        <Stack space={6} className="mt-4">
          {visibility.email && <EmailSection user={user} onSuccess={handleSuccess} />}
          {visibility.password && <PasswordSection user={user} onSuccess={handleSuccess} />}
          {visibility.phone && <PhoneSection user={user} onSuccess={handleSuccess} />}
        </Stack>
      ) : (
        <Para tone="muted" size="sm" className="mt-4">
          この認証方法では変更可能な認証情報はありません。
        </Para>
      )}
    </Stack>
  );
}
