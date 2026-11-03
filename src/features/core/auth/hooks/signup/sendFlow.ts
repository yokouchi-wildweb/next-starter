// src/features/core/auth/hooks/signup/sendFlow.ts
//
// メール認証の送信・事前登録の送信の流れ。React に依存しない純関数で、依存は引数で受ける。
// hook が実物の依存を渡して呼び、結果（outcome）を form と表示の状態へ反映する。
// 内部ファイル: 公開の入口は hooks/useVerificationEmailSendForm・hooks/useEarlyRegistrationSendForm。

import { err } from "@/lib/errors";

export const EMAIL_ALREADY_REGISTERED_MESSAGE = "このメールアドレスは既に登録されています";
export const EMAIL_SEND_FAILED_MESSAGE = "メール送信に失敗しました";

export type EmailSendOptions = {
  /** reCAPTCHA v3 トークン */
  recaptchaToken?: string;
  /** reCAPTCHA v2 トークン（v2チャレンジ完了後のリトライ時） */
  recaptchaV2Token?: string;
};

export type EmailSendDeps = {
  /** 登録済みのメールアドレスか */
  checkExists: (email: string) => Promise<{ exists: boolean }>;
  /** reCAPTCHA v3 トークン。省略 = reCAPTCHA を使わない送信（事前登録） */
  getRecaptchaToken?: () => Promise<string | undefined>;
  send: (email: string, options?: EmailSendOptions) => Promise<unknown>;
  /** 送ったメールアドレスを保存する（本登録画面が読む） */
  saveEmail: (email: string) => void;
  /** 送信後の遷移 */
  navigate: () => void;
  /** 省略 = v2 チャレンジを扱わない */
  isV2ChallengeRequired?: (error: unknown) => boolean;
  /** v2 再送で保留するメールアドレス（送信時ではなく、その時点の form の値を取り直す） */
  getPendingEmail?: () => string;
};

export type EmailSendOutcome =
  | { kind: "sent" }
  /** v2 チャレンジが必要。pendingEmail = v2 トークン取得後に再送するメールアドレス */
  | { kind: "v2Required"; error: unknown; pendingEmail: string }
  /** form の root エラーで見せる（登録済み・送信失敗） */
  | { kind: "error"; message: string };

/** 送信（登録済み確認 → reCAPTCHA v3 → 保存 → 送信 → 遷移） */
export async function submitEmailSend(email: string, deps: EmailSendDeps): Promise<EmailSendOutcome> {
  try {
    const normalizedEmail = email.trim();
    const { exists } = await deps.checkExists(normalizedEmail);
    if (exists) {
      return { kind: "error", message: EMAIL_ALREADY_REGISTERED_MESSAGE };
    }

    if (deps.getRecaptchaToken) {
      const recaptchaToken = await deps.getRecaptchaToken();
      deps.saveEmail(normalizedEmail);
      await deps.send(normalizedEmail, { recaptchaToken });
    } else {
      deps.saveEmail(normalizedEmail);
      await deps.send(normalizedEmail);
    }
    deps.navigate();
    return { kind: "sent" };
  } catch (error) {
    if (deps.isV2ChallengeRequired?.(error)) {
      return { kind: "v2Required", error, pendingEmail: (deps.getPendingEmail?.() ?? email).trim() };
    }
    return { kind: "error", message: err(error, EMAIL_SEND_FAILED_MESSAGE) };
  }
}

/** v2 トークンで保留中のメールアドレスへ再送 */
export async function retryEmailSendWithV2(
  email: string,
  v2Token: string | undefined,
  deps: Pick<EmailSendDeps, "send" | "navigate">,
): Promise<EmailSendOutcome> {
  try {
    await deps.send(email, { recaptchaV2Token: v2Token });
    deps.navigate();
    return { kind: "sent" };
  } catch (error) {
    return { kind: "error", message: err(error, EMAIL_SEND_FAILED_MESSAGE) };
  }
}
