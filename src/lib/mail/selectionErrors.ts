// src/lib/mail/selectionErrors.ts
// メールの口の選択にまつわる誤り(D38): 選んだ実装の鍵が無い / env MAIL_PROVIDER が選択表と食い違う

import { BackendNotConfiguredError } from "@/lib/errors";

import type { MailProvider } from "./provider";

/** 実装ごとの API キーの env の名前 */
const API_KEY_ENV: Record<MailProvider, string> = {
  resend: "RESEND_API_KEY",
  sendgrid: "SENDGRID_API_KEY",
};

/** 選んだ実装の API キーが置かれていない(最初にクライアントを作る時)。未設定の共通の親の子(port "mail") */
export class MailNotConfiguredError extends BackendNotConfiguredError {
  constructor(provider: MailProvider) {
    const envName = API_KEY_ENV[provider];
    super(`${envName} が設定されていません。環境変数を確認してください。`, {
      port: "mail",
      implementation: provider,
      missing: [envName],
      side: "server",
    });
    this.name = "MailNotConfiguredError";
  }
}

/**
 * env MAIL_PROVIDER が在り、compat で読んだ実装(鍵でない値は compat の既定)が選択表の選んだ実装と違う。送る前に投げる。
 * 文言は 2 つの実装の名前と直し方だけで、env の値は出さない
 */
export class MailProviderMismatchError extends Error {
  /** 選択表が選んだ実装 */
  readonly selected: string;
  /** env の側が指す実装(compat で読んだ名前。env の値そのものは持たない) */
  readonly fromEnv: string;

  constructor(selected: string, fromEnv: string) {
    super(
      `MAIL_PROVIDER が選択表のメールの実装 "${selected}" と食い違う(env の側: "${fromEnv}")。` +
        `選択表を直す(pnpm workflow backend-selection set mail <名前>)か、MAIL_PROVIDER を消す`,
    );
    this.name = "MailProviderMismatchError";
    this.selected = selected;
    this.fromEnv = fromEnv;
  }
}
