// src/lib/mail/createMailTemplate.tsx

import type { ReactElement } from "react";

import { send } from "./index";

/**
 * メール送信オプション
 */
export type MailSendOptions = {
  /** 送信元アドレス（省略時は businessConfig.mail.defaultFrom） */
  from?: string;
  /** 送信者名（省略時は businessConfig.mail.defaultFromName） */
  fromName?: string;
};

/**
 * メールテンプレートの設定
 */
export type MailTemplateConfig<TProps extends object> = {
  /** メールの件名 */
  subject: string;
  /** テンプレートコンポーネント */
  component: React.ComponentType<TProps>;
  /** テスト送信用のprops */
  testProps: TProps;
  /** テンプレートの説明（テスト送信時に表示） */
  testDescription?: string;
  /** デフォルトの送信元アドレス */
  from?: string;
  /** デフォルトの送信者名 */
  fromName?: string;
};

/**
 * メールテンプレートオブジェクト
 */
export type MailTemplate<TProps extends object> = {
  /** メールを送信する */
  send: (to: string, props: TProps, options?: MailSendOptions) => Promise<void>;
  /** 件名 */
  subject: string;
  /** テンプレートコンポーネント */
  component: React.ComponentType<TProps>;
  /** テスト用props */
  testProps: TProps;
  /** テンプレートの説明 */
  testDescription?: string;
};

/**
 * メールテンプレートを作成します。
 *
 * @example
 * ```tsx
 * import { createMailTemplate } from "@/lib/mail";
 * import { businessConfig } from "@/config/business.config";
 *
 * export const SupportEmail = createMailTemplate({
 *   subject: "お問い合わせありがとうございます",
 *   component: SupportEmailComponent,
 *   testProps: { ... },
 *   from: businessConfig.mail.addresses.support,
 *   fromName: "サポートチーム",
 * });
 *
 * // 送信
 * await SupportEmail.send("user@example.com", { ... });
 *
 * // 送信時に上書きも可能
 * await SupportEmail.send("user@example.com", { ... }, {
 *   from: "special@example.com",
 *   fromName: "特別キャンペーン",
 * });
 * ```
 */
export function createMailTemplate<TProps extends object>(
  config: MailTemplateConfig<TProps>,
): MailTemplate<TProps> {
  const {
    subject,
    component: Component,
    testProps,
    testDescription,
    from: defaultFrom,
    fromName: defaultFromName,
  } = config;

  return {
    subject,
    component: Component,
    testProps,
    testDescription,

    async send(
      to: string,
      props: TProps,
      options?: MailSendOptions,
    ): Promise<void> {
      const element = (<Component {...props} />) as ReactElement;
      await send({
        to,
        subject,
        react: element,
        from: options?.from ?? defaultFrom,
        fromName: options?.fromName ?? defaultFromName,
      });
    },
  };
}
