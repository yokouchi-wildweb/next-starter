// scripts/test-mail.ts
// Resendのメール送信をテストするスクリプト
//
// 使い方:
//   npx tsx scripts/test-mail.ts your-email@example.com

import { config } from "dotenv";
import { Resend } from "resend";

// .env.development を読み込む
config({ path: ".env.development" });

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM_ADDRESS = process.env.MAIL_FROM_ADDRESS;

async function main() {
  const toEmail = process.argv[2];

  if (!toEmail) {
    console.error("エラー: 宛先メールアドレスを引数で指定してください");
    console.error("使い方: npx tsx scripts/test-mail.ts your-email@example.com");
    process.exit(1);
  }

  if (!RESEND_API_KEY) {
    console.error("エラー: RESEND_API_KEY が設定されていません");
    process.exit(1);
  }

  if (!MAIL_FROM_ADDRESS) {
    console.error("エラー: MAIL_FROM_ADDRESS が設定されていません");
    process.exit(1);
  }

  console.log("=== Resend メール送信テスト ===");
  console.log(`送信元: ${MAIL_FROM_ADDRESS}`);
  console.log(`送信先: ${toEmail}`);
  console.log("");

  const resend = new Resend(RESEND_API_KEY);

  try {
    const { data, error } = await resend.emails.send({
      from: MAIL_FROM_ADDRESS,
      to: toEmail,
      subject: "【テスト】Resend メール送信テスト",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">メール送信テスト</h1>
          <p>このメールはResendの設定確認用テストメールです。</p>
          <p>正常に受信できていれば、Resendの設定は完了しています。</p>
          <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
          <p style="color: #6b7280; font-size: 14px;">
            送信日時: ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("送信エラー:", error);
      process.exit(1);
    }

    console.log("送信成功!");
    console.log("メールID:", data?.id);
  } catch (err) {
    console.error("予期せぬエラー:", err);
    process.exit(1);
  }
}

main();
