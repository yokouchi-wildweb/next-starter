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
//   - import: SWR の取得・送信の hook = "swr" の useSWR(default・named)/ "swr/mutation" の useSWRMutation /
//     "swr/infinite" の useSWRInfinite(SWRConfig などの部品は当たらない)
//   - import: client 関数の値 = services/client のパスから / ドメインのまとめ(@/features/<d>)から *Client の名前
//     (この 2 つの判定は client-service-boundary の classifyImport をそのまま使う)/ ドメインのまとめが
//     services/client から再 export する名前(まとめの index.ts を読んで決める。名前の形では決めない)
//   - 呼び出し: <x>.getIdToken()(Firebase の ID トークン)
//   - useAuthSession() から refreshSession を取り出す(分割代入・メンバー参照)
//     セッションの持ち主(AuthSessionClientProvider)が refreshSession を定義するのは対象外(取り出しではないので当たらない)
// 検出しないもの: mount の effect での処理の発火・timer での遷移など、import の形で見分けられない処理(lint では守らない)
//
// 有効なのは upstream(目録の先頭の節)だけ。fork では off(eslint.config.mjs)。demo のページは対象外(lib の使い方の見本)。
// option allow = 今残る部品の許可一覧(repo 相対パス)。縮める一方:
//   部品を hook 化したら、どの legate・どの作業でもその行を消す。一覧の行が当たらなくなると pnpm test eslint-rules/core-ui-guards.test.mjs が落ちる。
//   行を足すのは規則(対象・検出)を広げて既存の部品が当たった時だけ。

import fs from "node:fs";
import path from "node:path";

import { classifyImport } from "./client-service-boundary.mjs";
import { repoRelative, resolveImport } from "./resolve-import.mjs";

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
  // 取得・送信の hook。default import は defaultName の名前で数える
  { match: (source) => source === "swr", names: ["useSWR"], defaultName: "useSWR" },
  { match: (source) => source === "swr/mutation", names: ["useSWRMutation"], defaultName: "useSWRMutation" },
  { match: (source) => source === "swr/infinite", names: ["useSWRInfinite"], defaultName: "useSWRInfinite" },
];

const DOMAIN_BARREL = /^@\/features\/(core\/)?[^/]+$/;
const CLIENT_SERVICE_PATH = /(^|\/)services\/client(\/|$)/;
const REEXPORT = /export\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;

/** まとめのファイル(実パス)→ services/client から再 export する値の名前の集合(読めなければ空) */
const barrelClientNamesCache = new Map();

/**
 * ドメインのまとめ(index.ts)を読み、services/client から再 export している値の名前を返す。
 * `type X` / `export type { … }` は型なので数えない。`a as b` は外向きの名前 b。
 * @param {string} barrelDir repo 相対のまとめのフォルダ(例: src/features/core/bankTransferReview)
 * @param {string} repoRoot
 */
export function barrelClientNames(barrelDir, repoRoot) {
  const key = path.join(repoRoot, barrelDir);
  if (barrelClientNamesCache.has(key)) return barrelClientNamesCache.get(key);
  const names = new Set();
  for (const file of ["index.ts", "index.tsx"]) {
    let text;
    try {
      text = fs.readFileSync(path.join(key, file), "utf8");
    } catch {
      continue;
    }
    for (const match of text.matchAll(REEXPORT)) {
      const [whole, list, from] = match;
      if (!CLIENT_SERVICE_PATH.test(from)) continue;
      if (/export\s+type\s*\{/.test(whole)) continue;
      for (const raw of list.split(",")) {
        const item = raw.replace(/\/\/.*$/gm, "").trim();
        if (!item || item.startsWith("type ")) continue;
        const parts = item.split(/\s+as\s+/);
        names.add((parts[1] ?? parts[0]).trim());
      }
    }
    break;
  }
  barrelClientNamesCache.set(key, names);
  return names;
}

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

    const reportClientImport = (node, source) => {
      const named = node.specifiers.filter((s) => s.type === "ImportSpecifier");
      const hasOther = node.specifiers.some((s) => s.type !== "ImportSpecifier");
      const specifiers =
        hasOther || node.specifiers.length === 0
          ? null
          : named.map((s) => ({ name: propertyName(s.imported) ?? "", typeOnly: s.importKind === "type" }));
      // services/client のパス・まとめの *Client(client-service-boundary と同じ判定)
      if (classifyImport(source, specifiers, false)) {
        report(node.source, `client 関数の import(${source})`);
        return;
      }
      if (!DOMAIN_BARREL.test(source) || !specifiers) return;
      const resolved = resolveImport(source, context.filename, repoRoot);
      if (!resolved) return;
      const clientNames = barrelClientNames(resolved, repoRoot);
      for (const specifier of named) {
        if (specifier.importKind === "type") continue;
        const name = propertyName(specifier.imported);
        if (name && clientNames.has(name)) report(specifier, `client 関数 ${name}(${source} が services/client から再 export)`);
      }
    };

    return {
      ImportDeclaration(node) {
        if (node.importKind === "type") return;
        const source = node.source.value;
        if (typeof source !== "string") return;
        reportClientImport(node, source);
        const entry = GUARDED_IMPORTS.find((e) => e.match(source));
        if (!entry) return;
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportDefaultSpecifier" && entry.defaultName) {
            report(specifier, `${entry.defaultName}(${source} の default)`);
            continue;
          }
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
