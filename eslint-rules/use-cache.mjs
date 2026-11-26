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
//
// 共有の読みのキャッシュの標準の形(D52・D53 K1、区切り cc-cache-standard)を守る 3 つ(全 Tier error、必須の規則の表):
// - remote-only-generated: 指令 "use cache: remote" は pnpm generate cache の生成物(頭の行の印)と src/lib/cacheTags
//   (defineSharedRead: ドメインの宣言でない仕組みの共有の読み、例 analytics の withAnalyticsCache)だけ。共有の読みは
//   ドメインの宣言 cache → 生成物 cachedReads.ts(scripts/structure/cache/README.md)
// - no-data-read-in-cache: 共有の cache の範囲("use cache" と remote)の中で、DB を読む物(services/server・@/lib/drizzle・
//   entities/drizzle・@/lib/crud/server)から import した値の直の呼び出し(fn() と obj.method() の頭の名前)を止める。
//   データの読みの手での包みは宣言の外の消えないキャッシュになる。普通の "use cache" は殻に焼く UI と静的な値だけ。生成物は除く
// - no-manual-revalidate: next/cache の unstable_cache・revalidateTag・updateTag の import を src/lib/cacheTags の外で止める。
//   消すのは書き込みが積んだキャッシュタグを入口が要求の終わりに消す形(src/lib/cacheTags)だけ
// 限界は上と同じ(直の呼び出しだけ)。

import { SESSION_API_NAMES } from "./page-authz.mjs";
import { isUnder, repoRelative, resolveImport } from "./resolve-import.mjs";

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

/** pnpm generate cache の生成物の頭の行(scripts/structure/cache/lib.mjs の GENERATED_MARK と同じ) */
export const CACHE_GENERATED_MARK = "// 生成物・編集不可: pnpm generate cache が ";
const isCacheGenerated = (context) => (context.sourceCode ?? context.getSourceCode()).text.startsWith(CACHE_GENERATED_MARK);

/** 関数(宣言・式・アロー)の本体の頭の指令と、ファイルの頭の指令を順に渡す */
function forEachDirective(visit) {
  const onFunction = (node) => {
    if (node.body?.type !== "BlockStatement") return;
    const directive = directiveOf(node.body.body);
    if (directive) visit(directive, node.body.body[0]);
  };
  return {
    Program(node) {
      const directive = directiveOf(node.body);
      if (directive) visit(directive, node.body[0]);
    },
    FunctionDeclaration: onFunction,
    FunctionExpression: onFunction,
    ArrowFunctionExpression: onFunction,
  };
}

const remoteOnlyGenerated = {
  meta: {
    type: "problem",
    docs: { description: "\"use cache: remote\" は pnpm generate cache の生成物と src/lib/cacheTags だけ" },
    messages: {
      remote:
        "\"use cache: remote\" を手で書かない。共有の読みはドメインの宣言 cache(domain.json の \"cache\" / cache.json)に書き、pnpm generate cache の cachedReads.ts を読む。ドメインの宣言でない仕組みの読みは @/lib/cacheTags/server の defineSharedRead(手で包んだ読みは書き込みで消えない。詳細: scripts/structure/cache/README.md、src/lib/cacheTags/README.md)",
    },
    schema: [],
  },
  create(context) {
    if (isCacheGenerated(context)) return {};
    if (isUnder(repoRelative(context.filename, repoRootOf(context)), "src/lib/cacheTags")) return {};
    return forEachDirective((directive, node) => {
      if (directive === "use cache: remote") context.report({ node, messageId: "remote" });
    });
  },
};

/** 呼び出しの頭の名前(fn() → fn、a.b.c() → a、a.b().c() → a) */
function rootName(callee) {
  let node = callee;
  while (node) {
    if (node.type === "Identifier") return node.name;
    if (node.type === "MemberExpression") node = node.object;
    else if (node.type === "CallExpression") node = node.callee;
    else if (node.type === "AwaitExpression") node = node.argument;
    else return null;
  }
  return null;
}

/** DB を読む物か(services/server・@/lib/drizzle・entities/drizzle・@/lib/crud/server) */
function readsData(resolved) {
  if (!resolved) return false;
  const bare = resolved.replace(/\.(ts|tsx|mts|mjs|js)$/, "").replace(/\/index$/, "");
  return (
    /(^|\/)services\/server(\/|$)/.test(bare) ||
    isUnder(bare, "src/lib/drizzle") ||
    /(^|\/)entities\/drizzle$/.test(bare) ||
    bare === "src/lib/crud/server"
  );
}

const noDataReadInCache = {
  meta: {
    type: "problem",
    docs: { description: "共有の use cache の中で DB を読む物を直に呼ばない" },
    messages: {
      dataRead:
        "共有の \"{{directive}}\" の中で {{name}} を呼ばない(DB を読む)。共有の読みはドメインの宣言 cache と pnpm generate cache の cachedReads.ts、普通の \"use cache\" は殻に焼く UI と静的な値だけ(詳細: scripts/structure/cache/README.md)",
    },
    schema: [],
  },
  create(context) {
    if (isCacheGenerated(context)) return {};
    const repoRoot = repoRootOf(context);
    const watched = new Set();
    const scopes = [];
    const pushed = new WeakSet();
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
        if (!readsData(resolveImport(node.source.value, context.filename, repoRoot))) return;
        for (const spec of node.specifiers) {
          if (spec.type === "ImportSpecifier" && spec.importKind === "type") continue;
          watched.add(spec.local.name);
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
        // a.b().c() の内側の a.b() は外側の呼び出しで 1 回だけ出す
        if (node.parent?.type === "MemberExpression" && node.parent.object === node) return;
        const name = rootName(node.callee);
        if (name) pending.push({ node, directive, name });
      },
      "Program:exit"() {
        for (const { node, directive, name } of pending) {
          if (watched.has(name)) context.report({ node, messageId: "dataRead", data: { directive, name } });
        }
      },
    };
  },
};

const MANUAL_CACHE_APIS = new Set(["unstable_cache", "revalidateTag", "updateTag"]);

const noManualRevalidate = {
  meta: {
    type: "problem",
    docs: { description: "next/cache の unstable_cache・revalidateTag・updateTag は src/lib/cacheTags だけ" },
    messages: {
      manual:
        "next/cache の {{name}} を直に使わない。共有の読みはドメインの宣言 cache と pnpm generate cache、消すのは書き込みが積んだキャッシュタグ(createCrudService の option cacheTags・service.markCacheTags・@/lib/cacheTags/server の markCacheTags)を入口が要求の終わりに消す形(詳細: src/lib/cacheTags/README.md)",
    },
    schema: [],
  },
  create(context) {
    const repoRoot = repoRootOf(context);
    if (isUnder(repoRelative(context.filename, repoRoot), "src/lib/cacheTags")) return {};
    return {
      ImportDeclaration(node) {
        if (node.source.value !== "next/cache" || node.importKind === "type") return;
        for (const spec of node.specifiers) {
          if (spec.type !== "ImportSpecifier" || spec.importKind === "type") continue;
          const imported = spec.imported.type === "Identifier" ? spec.imported.name : String(spec.imported.value);
          if (MANUAL_CACHE_APIS.has(imported)) context.report({ node: spec, messageId: "manual", data: { name: imported } });
        }
      },
    };
  },
};

const plugin = {
  meta: { name: "eslint-plugin-local-use-cache", version: "1.0.0" },
  rules: {
    "no-principal-outside-args": noPrincipalOutsideArgs,
    "remote-only-generated": remoteOnlyGenerated,
    "no-data-read-in-cache": noDataReadInCache,
    "no-manual-revalidate": noManualRevalidate,
  },
};

export default plugin;
