// src/features/core/auth/hooks/registration/submitFlow.ts
//
// 本登録（Email / OAuth）の送信の流れ。React に依存しない純関数で、依存は引数で受ける。
// hook（useRegistrationSubmit）が実物の依存を渡して呼び、結果（outcome）を画面の状態へ反映する。
// 内部ファイル: 公開の入口は hooks/useEmailRegistrationForm・hooks/useOAuthRegistrationForm。

import { USER_PROVIDER_TYPES } from "@/features/core/user/constants";
import type { UserProviderType } from "@/features/core/user/types";
import type { RegistrationInput, RegistrationOptions } from "@/features/core/auth/hooks/useRegistration";
import { err, HttpError, isHttpError } from "@/lib/errors";

import { isSilentRateLimit } from "./isSilentRateLimit";

export const REGISTRATION_COMPLETE_PATH = "/signup/complete";
export const REGISTRATION_FAILED_MESSAGE = "本登録の処理に失敗しました";

/** 送信に要る Firebase のログイン中ユーザーの形（auth.currentUser の必要な部分だけ） */
export type RegistrationAuthUser = {
  uid: string;
  email?: string | null;
  providerData?: ReadonlyArray<{ providerId: string } | null> | null;
  getIdToken: () => Promise<string>;
};

/** Email / OAuth の form に共通の項目 */
export type RegistrationFormValuesBase = {
  email: string;
  name: string;
  role: string;
  profileData?: Record<string, unknown>;
  inviteCode?: string;
  /** 宣伝の同意（上流のフォームには無い。チェックを足した fork のフォームだけが持つ。D88） */
  marketingConsent?: boolean;
};

/** 宣伝の同意はフォームに項目がある時だけ送る（無ければ登録の処理は何も書かない） */
function marketingConsentPayload(values: RegistrationFormValuesBase): { marketingConsent?: boolean } {
  return typeof values.marketingConsent === "boolean" ? { marketingConsent: values.marketingConsent } : {};
}

type PayloadFields = Omit<RegistrationInput, "providerType" | "providerUid" | "idToken" | "inviteCode">;

/** 登録手段ごとの差（送信前の検査・providerType・payload の項目） */
export type RegistrationVariant<TValues extends RegistrationFormValuesBase> = {
  /** ログイン中ユーザーがいないときの文言（401） */
  missingUserMessage: string;
  /** 送信前の検査をして providerType を返す。通らなければ HttpError を投げる */
  resolveProviderType: (user: RegistrationAuthUser, values: TValues) => UserProviderType;
  /** v2 再送用の保留 payload の providerType。null = 保留しない */
  resolvePendingProviderType: (user: RegistrationAuthUser) => UserProviderType | null;
  /** form の値 → payload の項目 */
  toPayloadFields: (values: TValues) => PayloadFields;
};

type EmailValues = RegistrationFormValuesBase & { password: string };

export const emailRegistrationVariant: RegistrationVariant<EmailValues> = {
  missingUserMessage: "認証情報が確認できませんでした。再度メール認証からお試しください。",
  resolveProviderType: (user, values) => {
    // フォームの email（localStorage 由来）と Firebase セッションの email が食い違っている場合は
    // 別アカウントの資格情報で本登録しようとしている状態なので送信前に止める。
    // サーバー側 register() でも同じ検証を行うが、ここで止めれば利用者に原因を伝えられる。
    const sessionEmail = user.email?.trim().toLowerCase() ?? null;
    if (!sessionEmail || sessionEmail !== values.email.trim().toLowerCase()) {
      throw new HttpError({
        message: "認証したメールアドレスと登録内容が一致しません。再度メール認証からお試しください。",
        status: 400,
      });
    }
    return "email";
  },
  resolvePendingProviderType: () => "email",
  toPayloadFields: ({ email, name, password, role, profileData }) => ({
    email,
    name,
    password,
    role,
    profileData,
  }),
};

const firstProviderId = (user: RegistrationAuthUser) => user.providerData?.[0]?.providerId ?? null;

export const oauthRegistrationVariant: RegistrationVariant<RegistrationFormValuesBase> = {
  missingUserMessage: "認証情報が確認できませんでした。再度OAuth認証からお試しください。",
  resolveProviderType: (user) => {
    const providerId = firstProviderId(user);
    if (!providerId || !USER_PROVIDER_TYPES.includes(providerId as UserProviderType)) {
      throw new HttpError({
        message: "サードパーティの認証情報が確認できませんでした。再度OAuth認証からお試しください。",
        status: 400,
      });
    }
    return providerId as UserProviderType;
  },
  resolvePendingProviderType: (user) => firstProviderId(user) as UserProviderType | null,
  toPayloadFields: ({ email, name, role, profileData }) => ({ email, name, role, profileData }),
};

export type RegistrationSubmitDeps<TValues extends RegistrationFormValuesBase> = {
  getCurrentUser: () => RegistrationAuthUser | null;
  /** 未適用の招待コードなら false（hook 側でフォームエラーを立てる） */
  assertInviteCodeSubmittable: (inviteCode: string | undefined) => boolean;
  resolveInviteCodePayload: (inviteCode: string | undefined) => RegistrationInput["inviteCode"];
  /** reCAPTCHA v3 トークン（未設定なら undefined） */
  getRecaptchaToken: () => Promise<string | undefined>;
  register: (payload: RegistrationInput, options?: RegistrationOptions) => Promise<unknown>;
  refreshSession: () => Promise<unknown>;
  navigate: (path: string) => void;
  isV2ChallengeRequired: (error: unknown) => boolean;
  /** v2 保留 payload を作るときの form の値（送信時ではなく、その時点の値を取り直す） */
  getFormValues: () => TValues;
};

export type RegistrationOutcome =
  | { kind: "success" }
  /** 招待コード未適用で送信しなかった */
  | { kind: "blocked" }
  /** v2 チャレンジが必要。pendingPayload = v2 トークン取得後に再送する payload（null = 再送しない） */
  | { kind: "v2Required"; error: unknown; pendingPayload: RegistrationInput | null }
  /** 429 silent（サブネット単位）= form の root エラーで見せる */
  | { kind: "rateLimitSilent"; message: string }
  /** 429 = 警告モーダル */
  | { kind: "rateLimitWarning" }
  | { kind: "error"; message: string };

/** register 後の失敗（v2 以外）を outcome に分ける */
export function classifyRegistrationError(error: unknown): RegistrationOutcome {
  if (isHttpError(error) && error.status === 429) {
    return isSilentRateLimit(error)
      ? { kind: "rateLimitSilent", message: error.message }
      : { kind: "rateLimitWarning" };
  }
  return { kind: "error", message: err(error, REGISTRATION_FAILED_MESSAGE) };
}

async function completeRegistration<TValues extends RegistrationFormValuesBase>(
  deps: RegistrationSubmitDeps<TValues>,
) {
  await deps.refreshSession();
  deps.navigate(REGISTRATION_COMPLETE_PATH);
}

/** 送信（reCAPTCHA v3） */
export async function submitRegistration<TValues extends RegistrationFormValuesBase>(
  values: TValues,
  variant: RegistrationVariant<TValues>,
  deps: RegistrationSubmitDeps<TValues>,
): Promise<RegistrationOutcome> {
  try {
    const currentUser = deps.getCurrentUser();
    if (!currentUser) {
      throw new HttpError({ message: variant.missingUserMessage, status: 401 });
    }

    const providerType = variant.resolveProviderType(currentUser, values);

    // 未適用の招待コードを残したまま登録させない（サーバー側でも type=invite 限定で再判定される）
    if (!deps.assertInviteCodeSubmittable(values.inviteCode)) return { kind: "blocked" };

    const idToken = await currentUser.getIdToken();
    const recaptchaToken = await deps.getRecaptchaToken();

    const payload: RegistrationInput = {
      providerType,
      providerUid: currentUser.uid,
      idToken,
      ...variant.toPayloadFields(values),
      inviteCode: deps.resolveInviteCodePayload(values.inviteCode),
      ...marketingConsentPayload(values),
    };

    await deps.register(payload, { recaptchaToken });
    await completeRegistration(deps);
    return { kind: "success" };
  } catch (error) {
    if (deps.isV2ChallengeRequired(error)) {
      return { kind: "v2Required", error, pendingPayload: await buildPendingPayload(variant, deps) };
    }
    return classifyRegistrationError(error);
  }
}

async function buildPendingPayload<TValues extends RegistrationFormValuesBase>(
  variant: RegistrationVariant<TValues>,
  deps: RegistrationSubmitDeps<TValues>,
): Promise<RegistrationInput | null> {
  const currentUser = deps.getCurrentUser();
  if (!currentUser) return null;
  const providerType = variant.resolvePendingProviderType(currentUser);
  if (!providerType) return null;
  const idToken = await currentUser.getIdToken();
  const values = deps.getFormValues();
  return {
    providerType,
    providerUid: currentUser.uid,
    idToken,
    ...variant.toPayloadFields(values),
    inviteCode: deps.resolveInviteCodePayload(values.inviteCode),
    ...marketingConsentPayload(values),
  };
}

/** v2 トークンで保留 payload を再送 */
export async function retryRegistrationWithV2<TValues extends RegistrationFormValuesBase>(
  payload: RegistrationInput,
  v2Token: string | undefined,
  deps: Pick<RegistrationSubmitDeps<TValues>, "register" | "refreshSession" | "navigate">,
): Promise<RegistrationOutcome> {
  try {
    await deps.register(payload, { recaptchaV2Token: v2Token });
    await deps.refreshSession();
    deps.navigate(REGISTRATION_COMPLETE_PATH);
    return { kind: "success" };
  } catch (error) {
    return classifyRegistrationError(error);
  }
}
