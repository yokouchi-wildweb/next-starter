// eslint-rules/style-tokens.mjs
//
// 共有 UI(src/components, src/lib)と core ドメイン UI で、Tailwind の生パレット色クラス
// (bg-slate-900 / text-red-600 / bg-white / text-[#fff] など)の使用を検出するローカル ESLint プラグイン。
//
// 背景:
//   色の正は src/styles/palette.defaults.css(上流既定)+ custom/palette.css(下流上書き)のトークン。
//   生パレット色はブランド色に追従せず、ダークモードでは dark: 併記が必要になり、下流が core を
//   編集する動機(= merge 衝突)になる。意味色は 塗り(bg-success)/ 塗りの上の文字(text-success-foreground)/
//   素の背景の文字(text-success-text)の 3 トークンで書く。画面を覆う幕は bg-overlay/NN。
//
// 対象: 文字列リテラル・テンプレートリテラルの中の空白区切りトークン。修飾子(dark: / hover: / [&>svg]: 等)付きも検出。
//   - 数値付きパレット: (slate|gray|...|rose)-(50|100..900|950)
//   - white / black
//   - 任意値の色: [#rgb] / [#rrggbb] / [#rrggbbaa] / [rgb(...)] / [rgba(...)] / [hsl(...)] / [oklch(...)] 等
//   いずれも透過率サフィックス(/50、/[0.5])と Tailwind v4 の important 接尾辞(!)付きを含む。
// 対象外: inline style の hex 文字列(クラスではない)、コメント、shadow-[0_1px_rgba(...)] のような色以外で始まる任意値、
//   `bg-${color}-500` のような動的連結(静的には判定できない)。
// 既知の誤検出: data-testid="text-white" のようにクラス名と同じ文字列(理由付き eslint-disable で明示する)。
// 正当な例外(ブランドロゴ色・canvas 系など)は理由付きの eslint-disable-next-line で明示する。

const UTILITIES =
  "(?:bg|text|border|border-[xytblrse]|ring|ring-offset|inset-ring|outline|from|via|to|fill|stroke|divide|placeholder|accent|caret|decoration|shadow|inset-shadow|drop-shadow)";
const PALETTE_NAMES =
  "(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)";
const PALETTE_SHADE = "(?:50|[1-9]00|950)";
const ARBITRARY_COLOR = "\\[(?:#[0-9a-f]{3,8}|(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\\([^\\]]*\\))\\]";
const RAW_COLOR = `(?:${PALETTE_NAMES}-${PALETTE_SHADE}|white|black|${ARBITRARY_COLOR})`;
const OPACITY_SUFFIX = "(?:/\\d{1,3}|/\\[[^\\]]+\\])?";

/** 1 トークン(空白区切り)が生パレット色ユーティリティかどうか。先頭または修飾子 `:` / important 接頭辞 `!` の直後から判定する */
const RAW_PALETTE_TOKEN = new RegExp(`(?:^|[:!])${UTILITIES}-${RAW_COLOR}${OPACITY_SUFFIX}!?$`, "i");

export function findRawPaletteTokens(text) {
  const found = [];
  for (const token of text.split(/\s+/)) {
    if (token && RAW_PALETTE_TOKEN.test(token)) found.push(token);
  }
  return found;
}

const noRawPaletteRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Tailwind の生パレット色クラス(bg-slate-900 / text-white / bg-[#fff] 等)を禁止し、テーマトークンを使わせる",
    },
    messages: {
      rawPalette:
        '生パレット色 "{{token}}" はテーマトークンに置き換えてください(塗り bg-success / 塗りの上の文字 text-success-foreground / 素の背景の文字 text-success-text / 幕 bg-overlay、白黒は bg-background / text-foreground 等)。例外は理由付き eslint-disable で明示する',
    },
    schema: [],
  },
  create(context) {
    const report = (node, text) => {
      for (const token of findRawPaletteTokens(text)) {
        context.report({ node, messageId: "rawPalette", data: { token } });
      }
    };
    return {
      Literal(node) {
        if (typeof node.value !== "string") return;
        // import "..." / import("...") のパス文字列は対象外(パスは正規表現に一致しないが念のため)
        if (node.parent?.type === "ImportDeclaration" || node.parent?.type === "ImportExpression") return;
        report(node, node.value);
      },
      TemplateElement(node) {
        report(node, node.value.cooked ?? node.value.raw);
      },
    };
  },
};

/**
 * Flat config 用プラグインオブジェクト。
 * eslint.config.mjs から `plugins: { "style-tokens": <this> }` で登録する。
 */
const plugin = {
  meta: {
    name: "eslint-plugin-local-style-tokens",
    version: "1.0.0",
  },
  rules: {
    "no-raw-palette": noRawPaletteRule,
  },
};

export default plugin;
