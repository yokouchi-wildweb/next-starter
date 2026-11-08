// eslint-rules/core-ui-guards.mjs
//
// core の部品(src/features/core/**/components/)と既定 Screen の部品(src/app/**/_screen/)は form の状態と
// 守りの処理を直接持たない(CLAUDE.md COMPONENTS core_ui / FORK_EXTENSION / SCREENS)。
// それらは持ち主ドメインの features/<domain>/hooks の公開 hook に置き、部品は hook を呼んで描くだけにする。
// fork が部品の見た目を写しても、守り(reCAPTCHA・ID トークン・セッション更新・遷移の守り・コンバージョン計測)を
// 写さずに済むようにするため。
//
// 検出するもの:
//   - import: react-hook-form の useForm / @/lib/recaptcha の useRecaptcha・getRecaptchaToken・useRecaptchaV2Challenge /
//     @/lib/transitionGuard の useGuardedNavigation・useTransitionGuard / @/lib/googleTag の useGoogleAdsConversion
//     (型だけの import は対象外)
//   - 呼び出し: <x>.getIdToken()(Firebase の ID トークン)
//   - useAuthSession() から refreshSession を取り出す(分割代入・メンバー参照)
//     セッションの持ち主(AuthSessionClientProvider)が refreshSession を定義するのは対象外(取り出しではないので当たらない)
// 検出しないもの: mount の effect での処理の発火・timer での遷移など、import の形で見分けられない処理(lint では守らない)
//
// 有効なのは upstream(目録の先頭の節)だけ。fork では off(eslint.config.mjs)。demo のページは対象外(lib の使い方の見本)。
// option allow = 今残る部品の許可一覧(repo 相対パス)。縮める一方:
//   部品を hook 化したら、どの legate・どの作業でもその行を消す。一覧の行が当たらなくなると pnpm test eslint-rules/core-ui-guards.test.mjs が落ちる。
//   行を足すのは規則(対象・検出)を広げて既存の部品が当たった時だけ。

import { repoRelative } from "./resolve-import.mjs";

/** module の判定 → その module から読むと当たる名前 */
export const GUARDED_IMPORTS = [
  { match: (source) => source === "react-hook-form", names: ["useForm"] },
  {
    match: (source) => source === "@/lib/recaptcha" || source.startsWith("@/lib/recaptcha/"),
    names: ["useRecaptcha", "getRecaptchaToken", "useRecaptchaV2Challenge"],
  },
  {
    match: (source) => source === "@/lib/transitionGuard" || source.startsWith("@/lib/transitionGuard/"),
    names: ["useGuardedNavigation", "useTransitionGuard"],
  },
  {
    match: (source) => source === "@/lib/googleTag" || source.startsWith("@/lib/googleTag/"),
    names: ["useGoogleAdsConversion"],
  },
];

const isUseAuthSessionCall = (node) =>
  node?.type === "CallExpression" && node.callee.type === "Identifier" && node.callee.name === "useAuthSession";

const propertyName = (node) => {
  if (!node) return null;
  if (node.type === "Identifier") return node.name;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  return null;
};

const rule = {
  meta: {
    type: "problem",
    docs: { description: "core の部品・既定 Screen の部品で useForm と守りの処理を直接呼ばない(持ち主ドメインの公開 hook に置く)" },
    messages: {
      guarded:
        '{{what}} は core の部品・既定 Screen の部品(_screen)で直接使えません。持ち主ドメインの features/<domain>/hooks の公開 hook に置き、部品は hook を呼んで描くだけにしてください(CLAUDE.md COMPONENTS core_ui。例: auth の useEmailRegistrationForm)',
    },
    schema: [
      {
        type: "object",
        properties: { allow: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const repoRoot = context.cwd ?? process.cwd();
    const importer = repoRelative(context.filename, repoRoot);
    const allow = new Set(context.options[0]?.allow ?? []);
    if (allow.has(importer)) return {};

    const report = (node, what) => context.report({ node, messageId: "guarded", data: { what } });

    return {
      ImportDeclaration(node) {
        if (node.importKind === "type") return;
        const source = node.source.value;
        if (typeof source !== "string") return;
        const entry = GUARDED_IMPORTS.find((e) => e.match(source));
        if (!entry) return;
        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier" || specifier.importKind === "type") continue;
          const name = propertyName(specifier.imported);
          if (name && entry.names.includes(name)) report(specifier, `${name}(${source})`);
        }
      },
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type === "MemberExpression" && propertyName(callee.property) === "getIdToken") {
          report(node, "getIdToken()");
        }
      },
      VariableDeclarator(node) {
        if (!isUseAuthSessionCall(node.init) || node.id.type !== "ObjectPattern") return;
        for (const property of node.id.properties) {
          if (property.type === "Property" && propertyName(property.key) === "refreshSession") {
            report(property, "useAuthSession() の refreshSession");
          }
        }
      },
      MemberExpression(node) {
        if (isUseAuthSessionCall(node.object) && propertyName(node.property) === "refreshSession") {
          report(node, "useAuthSession() の refreshSession");
        }
      },
    };
  },
};

const plugin = {
  meta: { name: "eslint-plugin-local-core-ui-guards", version: "1.0.0" },
  rules: { "no-guard-in-part": rule },
};

export default plugin;
