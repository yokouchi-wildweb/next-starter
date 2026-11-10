// src/lib/mail/frame/frame.test.tsx
//
// lib/mail のメールの枠の部品の検査(render した HTML を読む。外部通信なし)。
// - 部品で組んだメールに文字・href・theme の色・既定の style(上流のテンプレートの値)が出る
// - MailFrame の外で部品を使うと描かない(useMailTheme が投げ、render は誤りの印だけを返す)
// 実行: pnpm test src/lib/mail/frame/frame.test.tsx
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, test } from "node:test";
import assert from "node:assert/strict";

import type { MailTheme } from "./theme";

let render: typeof import("@react-email/render").render;
let frame: typeof import("./index");

before(async () => {
  ({ render } = await import("@react-email/render"));
  frame = await import("./index");
});

const theme: MailTheme = {
  primary: "#101010",
  primaryForeground: "#fafafa",
  secondary: "#1397cc",
  secondaryForeground: "#ffffff",
  muted: "#f5f5f5",
  mutedForeground: "#737373",
  accent: "#2d5e73",
  accentForeground: "#fefefe",
  destructive: "#e7000b",
  background: "#ffffff",
  foreground: "#0a0a0a",
  border: "#e5e5e5",
};

/** style 属性の中に宣言がある(react の書き出しは `a:b;c:d`) */
function hasStyle(html: string, declaration: string) {
  assert.ok(html.includes(declaration), `style ${declaration} が無い`);
}

test("部品で組んだメールに文字・href・色・既定の style が出る", async () => {
  const {
    MailFrame,
    MailHeader,
    MailHeading,
    MailParagraph,
    MailButton,
    MailUrl,
    MailNote,
    MailInfoBox,
    MailDivider,
    MailFooter,
  } = frame;
  const html = await render(
    <MailFrame theme={theme} preview="下見の文">
      <MailHeader logoSrc="https://example.com/logo.png" logoAlt="ロゴ">
        お知らせ
      </MailHeader>
      <MailHeading>メールアドレスの確認</MailHeading>
      <MailParagraph>段落の文</MailParagraph>
      <MailParagraph align="center" preWrap>
        中央の文
      </MailParagraph>
      <MailButton href="https://example.com/verify">確認する</MailButton>
      <MailButton href="https://example.com/top" tone="accent">
        トップへ
      </MailButton>
      <MailUrl href="https://example.com/verify?token=abc" />
      <MailNote>注記の文</MailNote>
      <MailInfoBox rows={[{ label: "発生時刻", value: "2026-11-10 09:00" }]} />
      <MailDivider />
      <MailFooter>心当たりがない場合は無視してください。</MailFooter>
    </MailFrame>,
  );

  // 文字と href
  for (const text of [
    "下見の文",
    "お知らせ",
    "メールアドレスの確認",
    "段落の文",
    "中央の文",
    "確認する",
    "トップへ",
    "https://example.com/verify?token=abc",
    "注記の文",
    "発生時刻",
    "2026-11-10 09:00",
    "心当たりがない場合は無視してください。",
  ]) {
    assert.ok(html.includes(text), `${text} が無い`);
  }
  assert.ok(html.includes('href="https://example.com/verify"'));
  assert.ok(html.includes('src="https://example.com/logo.png"'));
  assert.ok(html.includes('lang="ja"'));

  // 枠(Verification の body / container の値)
  hasStyle(html, `background-color:${theme.muted}`);
  hasStyle(html, "max-width:560px");
  hasStyle(html, "padding:40px 20px");
  // 見出し・段落(auth の値)
  hasStyle(html, "font-size:24px");
  hasStyle(html, "line-height:24px");
  hasStyle(html, "white-space:pre-wrap");
  // ボタン: primary と accent の色
  hasStyle(html, `background-color:${theme.primary}`);
  hasStyle(html, `color:${theme.primaryForeground}`);
  hasStyle(html, `background-color:${theme.accent}`);
  hasStyle(html, `color:${theme.accentForeground}`);
  // URL・注記・区切り線
  hasStyle(html, `color:${theme.secondary}`);
  hasStyle(html, "word-break:break-all");
  hasStyle(html, `color:${theme.mutedForeground}`);
  hasStyle(html, `border-color:${theme.border}`);
});

test("style の上書きは既定の値に重なる(RegistrationComplete のボタンの padding)", async () => {
  const { MailFrame, MailButton } = frame;
  const html = await render(
    <MailFrame theme={theme}>
      <MailButton href="https://example.com" tone="accent" style={{ padding: "14px 28px" }}>
        トップへ
      </MailButton>
    </MailFrame>,
  );
  hasStyle(html, "14px 28px");
  assert.ok(!html.includes("12px 24px"), "既定の padding が残っている");
});

test("preview を省くと下見の文を出さない", async () => {
  const { MailFrame, MailParagraph } = frame;
  const html = await render(
    <MailFrame theme={theme}>
      <MailParagraph>本文</MailParagraph>
    </MailFrame>,
  );
  assert.ok(!html.includes('data-skip-in-text="true"'));
});

test("MailFrame の外で部品を使うと描かない(react-email の render は誤りを投げず、誤りの印だけの HTML を返す)", async () => {
  const { MailParagraph } = frame;
  const html = await render(<MailParagraph>本文</MailParagraph>);
  assert.ok(html.includes("server rendering errored"));
  assert.ok(html.includes("MailFrame"));
  assert.ok(!html.includes(">本文<"), "色の無い部品が描かれている");
});
