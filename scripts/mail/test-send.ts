// scripts/mail/test-send.ts
// メールテンプレートのテスト送信スクリプト
//
// 使い方:
//   npm run mail:test
//
// テンプレートの追加方法:
//   src/features/core/mail/templates/ に .tsx ファイルを作成し、
//   以下をエクスポートしてください:
//   - default: テンプレートコンポーネント
//   - testProps: テスト用のprops
//   - testSubject: テスト用の件名
//   - testDescription: テンプレートの説明（任意）

import { config } from "dotenv";
import { Resend } from "resend";
import { render } from "@react-email/render";
import inquirer from "inquirer";
import * as fs from "fs";
import * as path from "path";
import { createElement } from "react";

// .env.development を読み込む
config({ path: ".env.development" });

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM_ADDRESS = process.env.MAIL_FROM_ADDRESS;

// テンプレートディレクトリ
const TEMPLATES_DIR = "src/features/core/mail/templates";

// テンプレート定義
type TemplateConfig = {
  name: string;
  description: string;
  render: () => Promise<{ html: string; subject: string }>;
};

/**
 * シンプルテストメール（接続確認用）
 */
async function renderSimpleTestEmail(): Promise<{ html: string; subject: string }> {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #2563eb;">メール送信テスト</h1>
      <p>このメールはResendの設定確認用テストメールです。</p>
      <p>正常に受信できていれば、Resendの設定は完了しています。</p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="color: #6b7280; font-size: 14px;">
        送信日時: ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
      </p>
    </div>
  `;
  return {
    html,
    subject: "【テスト】Resend メール送信テスト",
  };
}

/**
 * テンプレートディレクトリから自動検出してテンプレート一覧を取得
 */
async function getTemplateConfigs(): Promise<TemplateConfig[]> {
  const templates: TemplateConfig[] = [
    {
      name: "シンプルテストメール",
      description: "Resend接続確認用のシンプルなテストメール",
      render: renderSimpleTestEmail,
    },
  ];

  // templates/ ディレクトリからテンプレートを検出
  const templatesPath = path.resolve(process.cwd(), TEMPLATES_DIR);
  if (!fs.existsSync(templatesPath)) {
    return templates;
  }

  const files = fs.readdirSync(templatesPath);
  for (const file of files) {
    // .tsx ファイルのみ対象（index.tsx は除外）
    if (!file.endsWith(".tsx") || file === "index.tsx") {
      continue;
    }

    const templateName = file.replace(".tsx", "");
    const templatePath = path.resolve(templatesPath, file);

    try {
      // テンプレートを動的インポート
      const templateModule = await import(templatePath);

      // 必須エクスポートの確認
      const Component = templateModule.default;
      const testProps = templateModule.testProps;
      const testSubject = templateModule.testSubject;
      const testDescription = templateModule.testDescription;

      if (!Component) {
        console.warn(`警告: ${file} に default export がありません。スキップします。`);
        continue;
      }

      if (!testProps || !testSubject) {
        console.warn(
          `警告: ${file} に testProps または testSubject がありません。スキップします。`
        );
        continue;
      }

      templates.push({
        name: templateName,
        description: testDescription || templateName,
        render: async () => {
          const html = await render(createElement(Component, testProps));
          return { html, subject: testSubject };
        },
      });
    } catch (err) {
      console.warn(`警告: ${file} の読み込みに失敗しました:`, err);
    }
  }

  return templates;
}

async function main() {
  console.log("");
  console.log("📧 メールテンプレート テスト送信");
  console.log("");

  // 環境変数チェック
  if (!RESEND_API_KEY) {
    console.error("エラー: RESEND_API_KEY が設定されていません");
    process.exit(1);
  }

  if (!MAIL_FROM_ADDRESS) {
    console.error("エラー: MAIL_FROM_ADDRESS が設定されていません");
    process.exit(1);
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

  console.log("");
  console.log("=== 送信情報 ===");
  console.log(`送信元: ${MAIL_FROM_ADDRESS}`);
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
  const resend = new Resend(RESEND_API_KEY);

  try {
    const { data, error } = await resend.emails.send({
      from: MAIL_FROM_ADDRESS,
      to: toEmail,
      subject,
      html,
    });

    if (error) {
      console.error("");
      console.error("❌ 送信エラー:", error);
      process.exit(1);
    }

    console.log("");
    console.log("✅ 送信完了!");
    console.log(`メールID: ${data?.id}`);
  } catch (err) {
    console.error("");
    console.error("❌ 予期せぬエラー:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("エラー:", err);
  process.exit(1);
});
