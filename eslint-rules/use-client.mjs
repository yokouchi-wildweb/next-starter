// eslint-rules/use-client.mjs
//
// hook を使うファイルは先頭に "use client" を書く(core/components.md use_client)。
// hook(useState・useEffect・自前の useXxx …)はクライアントでしか動かない。"use client" の無いファイルが入口のファイル越しに
// サーバーのコンポーネントから 1 本でも届くと、本番のビルド(Turbopack)が「useState は Client Component でしか動かない」で落ちる。
// ビルドは /sluice --safe でしか走らないので、普通の出荷の lint で先に止める。
//
// hook の呼び = 名前が use + 大文字で始まる関数の呼び(useState()・React.useState()・useSetting())。
// React の use()(サーバーでも使える)は大文字が続かないので対象外。
// 止めるもの: hook を呼ぶのに、ファイルの先頭の指示(directive)に "use client" が無いファイル(ファイルにつき 1 回、最初の呼びの位置)。
// 対象外(eslint.config.mjs の ignores): テスト(*.test.*)。全 Tier で error(ビルドが落ちるのを止める守り)。

const HOOK_NAME = /^use[A-Z0-9]/;

const calleeName = (callee) => {
  if (callee.type === "Identifier") return callee.name;
  if (callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier") return callee.property.name;
  return null;
};

/** ファイルの先頭の指示に "use client" があるか */
const hasUseClient = (program) => {
  for (const statement of program.body) {
    if (statement.type !== "ExpressionStatement" || typeof statement.directive !== "string") break;
    if (statement.directive === "use client") return true;
  }
  return false;
};

const rule = {
  meta: {
    type: "problem",
    docs: { description: 'hook を使うファイルは先頭に "use client" を書く' },
    messages: {
      missing:
        '{{name}}() を呼ぶファイルは先頭に "use client" を書きます(hook はクライアントでしか動かず、サーバーのコンポーネントから届くと本番のビルドが落ちる)。サーバーでも使う純粋な関数は別のファイルへ分けます。詳細: eslint-rules/use-client.mjs',
    },
    schema: [],
  },
  create(context) {
    let directive = null;
    let reported = false;
    return {
      Program(node) {
        directive = hasUseClient(node);
      },
      CallExpression(node) {
        if (directive || reported) return;
        const name = calleeName(node.callee);
        if (!name || !HOOK_NAME.test(name)) return;
        reported = true;
        context.report({ node, messageId: "missing", data: { name } });
      },
    };
  },
};

export default { rules: { "hooks-need-directive": rule } };
