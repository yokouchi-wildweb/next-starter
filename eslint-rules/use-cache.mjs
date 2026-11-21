// eslint-rules/use-cache.mjs
//
// 共有の "use cache"(と "use cache: remote")の中で、利用者・権限を引数の外から読む呼び出しを止める(cacheComponents の
// 解禁と同時に、D12)。強さ: 全 Tier error(eslint.config.mjs、必須の規則の表 required-rules.mjs)。
//
// 共有の cache の範囲: ファイルの頭の指令 "use cache" / "use cache: remote"、または関数(宣言・式・アロー)の本体の最初の指令。
//   範囲の中の入れ子の関数は範囲を引き継ぐ。"use cache: private" の指令はその関数の中を範囲の外にする。
// 止める呼び出し(範囲の中、import した名前で判じる。別名も捕まえる):
//   - セッション・ガードの API(page-authz の SESSION_API_NAMES: getSessionUser・getTokenOnlySession・requireCurrentPrincipal …、どのパスからでも)
//   - next/headers の cookies・headers・draftMode(Next も実行時に止めるが、書いた時に止める)
//   - @/lib/audit の getAuditContext(監査の文脈の主体。AsyncLocalStorage なので Next は止めない)
// 理由: 共有の cache の値は引数(と閉じ込めた値)を鍵に全利用者で共有される。利用者・権限が鍵に無いと、ある人の値が別の人に出る
//   = 認可の弱まり。利用者・権限は引数に含める(呼ぶ側で解いて渡す)か "use cache: private"。
// 限界: 範囲の中の直接の呼び出しだけを見る。範囲の中から呼んだ別の関数の中での読みは追わない。

import { SESSION_API_NAMES } from "./page-authz.mjs";
import { isUnder, resolveImport } from "./resolve-import.mjs";

const SHARED = new Set(["use cache", "use cache: remote"]);
const PRIVATE = "use cache: private";
const REQUEST_APIS = new Set(["cookies", "headers", "draftMode"]);

const repoRootOf = (context) => context.cwd ?? context.getCwd?.() ?? process.cwd();

/** 文の並びの頭の指令("use …")を返す */
function directiveOf(body) {
  for (const statement of body ?? []) {
    if (statement.type !== "ExpressionStatement" || typeof statement.directive !== "string") break;
    if (SHARED.has(statement.directive) || statement.directive === PRIVATE) return statement.directive;
  }
  return null;
}

const noPrincipalOutsideArgs = {
  meta: {
    type: "problem",
    docs: { description: "共有の use cache の中で利用者・権限を引数の外から読まない" },
    messages: {
      principal:
        "共有の \"{{directive}}\" の中で {{name}}() を呼ばない。利用者・権限は引数に含める(呼ぶ側で解いて渡す)か \"use cache: private\" にする(共有の cache は引数を鍵に全利用者で共有される。詳細: eslint-rules/use-cache.mjs)",
    },
    schema: [],
  },
  create(context) {
    const repoRoot = repoRootOf(context);
    /** local 名 → 止める理由のある import か */
    const watched = new Set();
    /** 範囲のスタック(関数ごとに指令があれば積む)。値 = 指令 */
    const scopes = [];
    const pushed = new WeakSet();
    /** 範囲の中の呼び出し(import は巻き上げられるので、ファイルを読み終えてから判じる) */
    const pending = [];
    const current = () => {
      for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i]) return scopes[i];
      return null;
    };
    const enterFunction = (node) => {
      const directive = node.body?.type === "BlockStatement" ? directiveOf(node.body.body) : null;
      if (directive) {
        scopes.push(directive);
        pushed.add(node);
      }
    };
    const exitFunction = (node) => {
      if (pushed.has(node)) scopes.pop();
    };
    return {
      Program(node) {
        const directive = directiveOf(node.body);
        if (directive) scopes.push(directive);
      },
      ImportDeclaration(node) {
        if (node.importKind === "type" || typeof node.source.value !== "string") return;
        const source = node.source.value;
        const fromHeaders = source === "next/headers";
        const fromAudit = isUnder(resolveImport(source, context.filename, repoRoot), "src/lib/audit");
        for (const spec of node.specifiers) {
          if (spec.type !== "ImportSpecifier" || spec.importKind === "type") continue;
          const imported = spec.imported.type === "Identifier" ? spec.imported.name : String(spec.imported.value);
          if (
            SESSION_API_NAMES.has(imported) ||
            (fromHeaders && REQUEST_APIS.has(imported)) ||
            (fromAudit && imported === "getAuditContext")
          ) {
            watched.add(spec.local.name);
          }
        }
      },
      FunctionDeclaration: enterFunction,
      FunctionExpression: enterFunction,
      ArrowFunctionExpression: enterFunction,
      "FunctionDeclaration:exit": exitFunction,
      "FunctionExpression:exit": exitFunction,
      "ArrowFunctionExpression:exit": exitFunction,
      CallExpression(node) {
        const directive = current();
        if (!directive || directive === PRIVATE) return;
        if (node.callee.type === "Identifier") pending.push({ node, directive, name: node.callee.name });
      },
      "Program:exit"() {
        for (const { node, directive, name } of pending) {
          if (watched.has(name)) context.report({ node, messageId: "principal", data: { directive, name } });
        }
      },
    };
  },
};

const plugin = {
  meta: { name: "eslint-plugin-local-use-cache", version: "1.0.0" },
  rules: { "no-principal-outside-args": noPrincipalOutsideArgs },
};

export default plugin;
