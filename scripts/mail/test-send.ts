// scripts/mail/test-send.ts
// メールテンプレートのテスト送信スクリプト
//
// 使い方:
//   npm run mail:test
//
// テンプレートの追加方法:
//   送る側のドメインの mail/ に <名前>Email.tsx を作成し(例 src/features/core/auth/mail/)、
//   createMailTemplate() で作成したオブジェクトをエクスポートしてください。
//
// 例:
//   export const WelcomeMail = createMailTemplate({
//     subject: "ようこそ！",
//     component: WelcomeComponent,
//     testProps: { username: "テスト" },
//     testDescription: "ウェルカムメール",
//   });

import { config } from "dotenv";
import { render } from "@react-email/render";
import inquirer from "inquirer";
import * as fs from "fs";
import * as path from "path";
import { createElement } from "react";

import { businessConfig } from "../../src/config/business.config";

// .env.development を読み込む
config({ path: ".env.development" });

// 環境変数の確認
const MAIL_PROVIDER = process.env.MAIL_PROVIDER || "resend";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

// businessConfig からメール設定を取得
const MAIL_FROM_ADDRESS = businessConfig.mail.defaultFrom;
const MAIL_FROM_NAME = businessConfig.mail.defaultFromName;

// テンプレートの置き場: src/features/**/mail/*Email.tsx
const FEATURES_DIR = "src/features";

/** src/features の下の mail/*Email.tsx を path 順に返す */
function findTemplateFiles(): string[] {
  const entries = fs.readdirSync(path.resolve(process.cwd(), FEATURES_DIR), { recursive: true, encoding: "utf8" });
  return entries
    .map((entry) => entry.split(path.sep).join("/"))
    .filter((entry) => /(^|\/)mail\/[^/]*Email\.tsx$/.test(entry))
    .sort()
    .map((entry) => path.resolve(process.cwd(), FEATURES_DIR, entry));
}

// テンプレート定義
type TemplateConfig = {
  name: string;
  description: string;
  render: () => Promise<{ html: string; subject: string }>;
};

// MailTemplate の型チェック用
type MailTemplateShape = {
  subject: string;
  component: React.ComponentType<unknown>;
  testProps: unknown;
  testDescription?: string;
};

function isMailTemplate(obj: unknown): obj is MailTemplateShape {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "subject" in obj &&
    "component" in obj &&
    "testProps" in obj &&
    typeof (obj as MailTemplateShape).subject === "string" &&
    typeof (obj as MailTemplateShape).component === "function"
  );
}

/**
 * シンプルテストメール（接続確認用）
 */
async function renderSimpleTestEmail(): Promise<{ html: string; subject: string }> {
  const providerName = MAIL_PROVIDER === "sendgrid" ? "SendGrid" : "Resend";
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #2563eb;">メール送信テスト</h1>
      <p>このメールは${providerName}の設定確認用テストメールです。</p>
      <p>正常に受信できていれば、${providerName}の設定は完了しています。</p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="color: #6b7280; font-size: 14px;">
        送信日時: ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
      </p>
    </div>
  `;
  return {
    html,
    subject: `【テスト】${providerName} メール送信テスト`,
  };
}

/**
 * 各ドメインの mail/ から自動検出してテンプレート一覧を取得
 */
async function getTemplateConfigs(): Promise<TemplateConfig[]> {
  const templates: TemplateConfig[] = [
    {
      name: "シンプルテストメール",
      description: `${MAIL_PROVIDER === "sendgrid" ? "SendGrid" : "Resend"}接続確認用のシンプルなテストメール`,
      render: renderSimpleTestEmail,
    },
  ];

  for (const templatePath of findTemplateFiles()) {
    const file = path.basename(templatePath);
    const templateName = file.replace(".tsx", "");

    try {
      // テンプレートを動的インポート
      const templateModule = await import(templatePath);

      // createMailTemplate で作成されたオブジェクトを探す
      for (const [exportName, exportValue] of Object.entries(templateModule)) {
        if (!isMailTemplate(exportValue)) {
          continue;
        }

        const mailTemplate = exportValue;
        const displayName = exportName !== "default" ? exportName : templateName;

        templates.push({
          name: displayName,
          description: mailTemplate.testDescription || displayName,
          render: async () => {
            const html = await render(
              createElement(mailTemplate.component, mailTemplate.testProps as object),
            );
            return { html, subject: mailTemplate.subject };
          },
        });
      }
    } catch (err) {
      console.warn(`警告: ${file} の読み込みに失敗しました:`, err);
    }
  }

  return templates;
}

/**
 * 送信元アドレスをフォーマット
 */
function formatFromAddress(): string {
  if (MAIL_FROM_NAME) {
    return `${MAIL_FROM_NAME} <${MAIL_FROM_ADDRESS}>`;
  }
  return MAIL_FROM_ADDRESS;
}

/**
 * Resendでメール送信
 */
async function sendWithResend(
  to: string,
  subject: string,
  html: string,
  from: string,
): Promise<void> {
  const { Resend } = await import("resend");
  const resend = new Resend(RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend送信エラー: ${JSON.stringify(error)}`);
  }
}

/**
 * SendGridでメール送信
 */
async function sendWithSendGrid(
  to: string,
  subject: string,
  html: string,
  fromAddress: string,
  fromName?: string,
): Promise<void> {
  const sgMail = (await import("@sendgrid/mail")).default;
  sgMail.setApiKey(SENDGRID_API_KEY!);

  await sgMail.send({
    to,
    from: fromName ? { email: fromAddress, name: fromName } : fromAddress,
    subject,
    html,
  });
}

/**
 * プロバイダーに応じてメール送信
 */
async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const fromAddress = formatFromAddress();

  if (MAIL_PROVIDER === "sendgrid") {
    await sendWithSendGrid(to, subject, html, MAIL_FROM_ADDRESS, MAIL_FROM_NAME);
  } else {
    await sendWithResend(to, subject, html, fromAddress);
  }
}

async function main() {
  console.log("");
  console.log("📧 メールテンプレート テスト送信");
  console.log("");

  // 環境変数チェック
  const providerName = MAIL_PROVIDER === "sendgrid" ? "SendGrid" : "Resend";
  console.log(`使用プロバイダー: ${providerName}`);

  if (MAIL_PROVIDER === "sendgrid") {
    if (!SENDGRID_API_KEY) {
      console.error("エラー: SENDGRID_API_KEY が設定されていません");
      process.exit(1);
    }
  } else {
    if (!RESEND_API_KEY) {
      console.error("エラー: RESEND_API_KEY が設定されていません");
      process.exit(1);
    }
  }

  // テンプレート一覧を取得（自動検出）
  console.log("テンプレートを検出中...");
  const templates = await getTemplateConfigs();
  console.log(`${templates.length} 件のテンプレートが見つかりました`);
  console.log("");

  // 送信先アドレスを入力
  const { toEmail } = await inquirer.prompt<{ toEmail: string }>([
    {
      type: "input",
      name: "toEmail",
      message: "送信先メールアドレス:",
      validate: (input: string) => {
        if (!input) return "メールアドレスを入力してください";
        if (!input.includes("@")) return "有効なメールアドレスを入力してください";
        return true;
      },
    },
  ]);

  // テンプレートを選択
  const { templateIndex } = await inquirer.prompt<{ templateIndex: number }>([
    {
      type: "list",
      name: "templateIndex",
      message: "送信するテンプレートを選択:",
      choices: templates.map((t, i) => ({
        name: `${t.name} - ${t.description}`,
        value: i,
      })),
    },
  ]);

  const selectedTemplate = templates[templateIndex];
  const fromAddress = formatFromAddress();

  console.log("");
  console.log("=== 送信情報 ===");
  console.log(`プロバイダー: ${providerName}`);
  console.log(`送信元: ${fromAddress}`);
  console.log(`送信先: ${toEmail}`);
  console.log(`テンプレート: ${selectedTemplate.name}`);
  console.log("");

  // 確認
  const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
    {
      type: "confirm",
      name: "confirm",
      message: "送信しますか?",
      default: true,
    },
  ]);

  if (!confirm) {
    console.log("キャンセルしました");
    process.exit(0);
  }

  // テンプレートをレンダリング
  console.log("");
  console.log("テンプレートをレンダリング中...");
  const { html, subject } = await selectedTemplate.render();

  // 送信
  console.log("送信中...");

  try {
    await sendEmail(toEmail, subject, html);

    console.log("");
    console.log("✅ 送信完了!");
  } catch (err) {
    console.error("");
    console.error("❌ 送信エラー:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("エラー:", err);
  process.exit(1);
});
