// src/lib/mail/frame/frame.test.tsx
//
// lib/mail のメールの枠の部品の検査(render した HTML を読む。外部通信なし)。
// - 部品で組んだメールに文字・href・theme の色・既定の style(上流のテンプレートの値)が出る
// - createMailParts(theme) で束ねた部品も同じ HTML を出す
// - lib/mail は React の context を持たない(サーバーの module から読まれても Next の build が落ちない)
// 実行: pnpm test src/lib/mail/frame/frame.test.tsx
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
  const { MailFrame, MailHeader, MailHeading, MailParagraph, MailButton, MailUrl, MailNote, MailInfoBox, MailDivider, MailFooter } = frame;
  const html = await render(
    <MailFrame theme={theme} preview="下見の文">
      <MailHeader theme={theme} logoSrc="https://example.com/logo.png" logoAlt="ロゴ">
        お知らせ
      </MailHeader>
      <MailHeading theme={theme}>メールアドレスの確認</MailHeading>
      <MailParagraph theme={theme}>段落の文</MailParagraph>
      <MailParagraph theme={theme} align="center" preWrap>
        中央の文
      </MailParagraph>
      <MailButton theme={theme} href="https://example.com/verify">
        確認する
      </MailButton>
      <MailButton theme={theme} href="https://example.com/top" tone="accent">
        トップへ
      </MailButton>
      <MailUrl theme={theme} href="https://example.com/verify?token=abc" />
      <MailNote theme={theme}>注記の文</MailNote>
      <MailInfoBox theme={theme} rows={[{ label: "発生時刻", value: "2026-11-10 09:00" }]} />
      <MailDivider theme={theme} />
      <MailFooter theme={theme}>心当たりがない場合は無視してください。</MailFooter>
    </MailFrame>,
  );

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
      <MailButton theme={theme} href="https://example.com" tone="accent" style={{ padding: "14px 28px" }}>
        トップへ
      </MailButton>
    </MailFrame>,
  );
  hasStyle(html, "14px 28px");
  assert.ok(!html.includes("12px 24px"), "既定の padding が残っている");
});

test("createMailParts(theme) で束ねた部品は theme を渡した部品と同じ HTML を出す", async () => {
  const { MailFrame, MailHeading, MailButton, MailFooter, createMailParts } = frame;
  const m = createMailParts(theme);
  const bound = await render(
    <m.Frame preview="下見">
      <m.Heading>見出し</m.Heading>
      <m.Button href="https://example.com">押す</m.Button>
      <m.Footer>注意</m.Footer>
    </m.Frame>,
  );
  const plain = await render(
    <MailFrame theme={theme} preview="下見">
      <MailHeading theme={theme}>見出し</MailHeading>
      <MailButton theme={theme} href="https://example.com">
        押す
      </MailButton>
      <MailFooter theme={theme}>注意</MailFooter>
    </MailFrame>,
  );
  assert.equal(bound, plain);
  assert.equal(m.theme, theme);
});

test("preview を省くと下見の文を出さない", async () => {
  const { MailFrame, MailParagraph } = frame;
  const html = await render(
    <MailFrame theme={theme}>
      <MailParagraph theme={theme}>本文</MailParagraph>
    </MailFrame>,
  );
  assert.ok(!html.includes('data-skip-in-text="true"'));
});

test("lib/mail は React の context を持たない(サーバーから読まれても build が落ちない)", () => {
  const root = join(__dirname, "..");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) files.push(path);
    }
  };
  walk(root);
  const offenders = files.filter((f) => /\b(createContext|useContext)\s*\(/.test(readFileSync(f, "utf8")));
  assert.deepEqual(offenders, []);
});
