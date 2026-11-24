// scripts/operations/mail/test-send.ts
// メールのテスト送信スクリプト(接続確認と、連絡の一覧 messageRegistry のメールの見た目の確認)
//
// 使い方:
//   pnpm ops mail test-send                                          (対話: 送信先と連絡を選ぶ)
//   pnpm ops mail test-send -- --to=<アドレス> --message=<連絡の鍵>     (対話なし。--message=simple は接続確認のメール)
//
// 連絡のメール: 生成の一覧(src/registry/messageRegistry.ts)のうちカテゴリーの送信チャンネルに email がある連絡を、
// 上書き(<名前>.override.ts)を重ね、見本の値を差し込んでレイアウトのメールの描き方(点 messagingLayouts の messagingLayoutEmails、無ければ要約から)で描いて送る。
// 見本の値: 定義の vars・共通の文脈・当たる enrichers の鍵ごとに、URL の欄は https://example.com/sample/<鍵>、他は「<鍵>の見本」。
// 送る口(回・配達の記録)は通さない(見た目の確認だけ)。連絡の書き方: src/lib/messaging/README.md
// 送る実装は選択表(公開の入口 @/lib/mail の mailBackendStatus.selected)。MAIL_PROVIDER は選ばない: 在って食い違えば送る前に止まる(lib/mail の assertMailProviderMatches)

import { render } from "@react-email/render";
import inquirer from "inquirer";
import { createElement } from "react";

import { guardEntry } from "../../runner/guard";

// 共通の守り: 向き先(既定は開発、本番は --env production と確認)・段階の印。メールを実際に送るので書く入口
guardEntry({ write: true, what: "pnpm ops mail test-send" });

// 環境変数の確認
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

// メールの差出人は事業の素性(@/business)から読む。@/business は src/wiring の結びなので道具からは import() で読む(lint scripts-no-static-wiring)

// テンプレート定義
type TemplateConfig = {
  /** 対話なしで選ぶ鍵(--message=<鍵>) */
  key: string;
  name: string;
  description: string;
  render: () => Promise<{ html: string; subject: string }>;
};

type ZodLike = { _def?: { typeName?: string; checks?: { kind: string }[]; innerType?: ZodLike; schema?: ZodLike } };

/** zod の値が URL の検査を持つか(optional などの包みの内側も見る) */
function isUrlSchema(schema: ZodLike | undefined): boolean {
  let current = schema;
  for (let depth = 0; current?._def && depth < 10; depth += 1) {
    if (current._def.checks?.some((check) => check.kind === "url")) return true;
    current = current._def.innerType ?? current._def.schema;
  }
  return false;
}

/** 見本の値(鍵 → 文字列) */
function sampleValues(keys: Iterable<string>, shape: Record<string, ZodLike>): Record<string, string> {
  return Object.fromEntries(
    [...keys].map((key) => [key, isUrlSchema(shape[key]) ? `https://example.com/sample/${key}` : `${key}の見本`]),
  );
}

/** 欄の値の {{鍵}} を差し込む(知らない鍵はそのまま) */
function fillValue(value: unknown, values: Record<string, string>): unknown {
  if (typeof value === "string") return value.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (all, key: string) => values[key] ?? all);
  if (Array.isArray(value)) return value.map((item) => fillValue(item, values));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fillValue(v, values)]));
  return value;
}

/** 生成の一覧の email で送る連絡(鍵の順) */
async function messageTemplates(): Promise<TemplateConfig[]> {
  const { messageRegistry } = await import("@/registry/messageRegistry");
  const { applyMessageOverride, COMMON_CONTEXT_KEYS, enricherTargets, fieldsForChannel } = await import("@/lib/messaging");
  const { MAIL_THEME_COLORS } = await import("@/lib/mail");
  const { enrichers, categories, layouts, layoutEmails } = await import("@/domains/core/messaging/services/server/lists");
  const { SummaryEmailView } = await import("@/domains/core/messaging/plugs/messagingChannels/email/genericView");

  const templates: TemplateConfig[] = [];
  for (const entry of Object.values(messageRegistry).sort((a, b) => a.key.localeCompare(b.key))) {
    const { message } = await entry.definition();
    // 上書きを先に重ねる(所属のカテゴリーは上書きで付け替えられる、D166)
    const override = entry.override ? (await entry.override()).messageOverride : undefined;
    const resolved = applyMessageOverride(message, override);
    const category = categories[resolved.category];
    const layout = layouts[message.layout];
    if (!category?.channels.includes("email") || !layout) continue;
    const renderer = layoutEmails[layout.key];
    templates.push({
      key: entry.key,
      name: entry.key,
      description: `連絡のメール(レイアウト「${layout.label}」${renderer ? "" : "、要約から"})`,
      render: async () => {
        const shape = resolved.vars.shape as Record<string, ZodLike>;
        const enricherShape = Object.assign(
          {},
          ...Object.values(enrichers)
            .filter((enricher) => enricherTargets(enricher.target, { key: entry.key, category: resolved.category, kind: category.kind }))
            .map((enricher) => enricher.provides.shape as Record<string, ZodLike>),
        ) as Record<string, ZodLike>;
        const values = sampleValues(
          new Set([...Object.keys(shape), ...Object.keys(enricherShape), ...COMMON_CONTEXT_KEYS]),
          { ...enricherShape, ...shape },
        );
        const filled = fillValue(resolved.values, values) as Record<string, unknown>;
        // メールが使う欄だけ(送る口の組み立てと同じ)
        const emailValues = Object.fromEntries(Object.keys(fieldsForChannel(layout, "email")).map((key) => [key, filled[key]]));
        const summary = layout.summary(emailValues);
        const element = renderer
          ? createElement(renderer.Component as never, { values: emailValues, summary, theme: MAIL_THEME_COLORS })
          : createElement(SummaryEmailView, { summary, theme: MAIL_THEME_COLORS });
        const html = await render(element);
        return { html, subject: summary.title };
      },
    });
  }
  return templates;
}

/**
 * シンプルテストメール（接続確認用）
 */
async function renderSimpleTestEmail(provider: string): Promise<{ html: string; subject: string }> {
  const providerName = provider === "sendgrid" ? "SendGrid" : "Resend";
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
 * 接続確認のメール + 連絡の一覧のメール
 */
async function getTemplateConfigs(provider: string): Promise<TemplateConfig[]> {
  return [
    {
      key: "simple",
      name: "シンプルテストメール",
      description: `${provider === "sendgrid" ? "SendGrid" : "Resend"}接続確認用のシンプルなテストメール`,
      render: () => renderSimpleTestEmail(provider),
    },
    ...(await messageTemplates()),
  ];
}

/**
 * 送信元アドレスをフォーマット
 */
async function readMailFrom(): Promise<{ address: string; name: string }> {
  const { business } = await import("@/business");
  return { address: business.mail.defaultFrom, name: business.mail.defaultFromName };
}

async function formatFromAddress(): Promise<string> {
  const { address, name } = await readMailFrom();
  return name ? `${name} <${address}>` : address;
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
  provider: string,
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const fromAddress = await formatFromAddress();

  if (provider === "sendgrid") {
    const from = await readMailFrom();
    await sendWithSendGrid(to, subject, html, from.address, from.name);
  } else {
    await sendWithResend(to, subject, html, fromAddress);
  }
}

/** --<名前>=<値> の引数 */
function flag(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

/**
 * 選択表が選んだメールの実装の名前。env MAIL_PROVIDER が食い違えば止まる
 * (守りは lib/mail の assertMailProviderMatches、send() と同じもの。文言に env の値は載らない)
 */
async function selectedProvider(): Promise<string> {
  const { assertMailProviderMatches, mailBackendStatus, MailProviderMismatchError } = await import("@/lib/mail");
  try {
    assertMailProviderMatches();
  } catch (error) {
    if (!(error instanceof MailProviderMismatchError)) throw error;
    console.error(`エラー: ${error.message}`);
    process.exit(1);
  }
  return mailBackendStatus.selected;
}

async function main() {
  console.log("");
  console.log("📧 メール テスト送信");
  console.log("");

  // 送る実装(選択表)と環境変数チェック
  const provider = await selectedProvider();
  const providerName = provider === "sendgrid" ? "SendGrid" : "Resend";
  console.log(`使用プロバイダー: ${providerName}`);

  if (provider === "sendgrid") {
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
  console.log("連絡の一覧を読み込み中...");
  const templates = await getTemplateConfigs(provider);
  console.log(`${templates.length} 件(接続確認 + メールの欄を持つ連絡)`);
  console.log("");

  // 対話なし: --to と --message の両方があれば選ばずに送る
  const flagTo = flag("to");
  const flagMessage = flag("message");
  if (flagTo || flagMessage) {
    if (!flagTo?.includes("@") || !flagMessage) {
      console.error("エラー: 対話なしで送るときは --to=<アドレス> と --message=<連絡の鍵 | simple> の両方を渡してください");
      process.exit(1);
    }
    const chosen = templates.find((t) => t.key === flagMessage);
    if (!chosen) {
      console.error(`エラー: 連絡 ${flagMessage} が見つかりません(メールの欄を持つ連絡: ${templates.map((t) => t.key).join(", ")})`);
      process.exit(1);
    }
    const rendered = await chosen.render();
    await sendEmail(provider, flagTo, rendered.subject, rendered.html);
    console.log(`✅ 送信完了! (${chosen.key} → ${flagTo})`);
    return;
  }

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
  const fromAddress = await formatFromAddress();

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
    await sendEmail(provider, toEmail, subject, html);

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
