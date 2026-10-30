// eslint-rules/page-authz.mjs
//
// ページ層(src/app)の認可まわりの置き場所の検査。ルート作成の必須検査 M3・M4 のうち、import で判定できる部分。
// 対象範囲は eslint.config.mjs 側で決める(このファイルは「対象ファイルで何を import したか」だけを見る)。
// 強さ: 両規則とも upstream・下流の全 Tier で error。セキュリティの検査は所有で強さを変えない(前例 hidden-columns)。
//
// ── layout-no-server-data(M4 を D73 K1 の範囲へ広げた形。名前は互換のため据え置き) ──
// 対象(eslint.config.mjs の files): UI の場所 = src/app の Screen・page.tsx・layout・_layout/**・guard.ts・_components の部品と
//   src/components・src/hooks・src/features/**/components・src/features/**/hooks。
//   loader.ts・route.ts・API(src/app/api/**)は対象外(サーバーのデータを読んでよい場所)。
// 禁止する import(値。型だけは可):
//   - `services/server` を含むパス(絶対・相対。管理画面の取得本体 features/core/admin/services/server/screenData も含む)
//   - DB(L1.20): @/lib/drizzle・drizzle-orm・@/lib/firebase/server・firebase-admin(配下も)・entities/drizzle(表の定義)
//   - layout.tsx・_layout/** だけ loader(末尾が /loader のパス)も不可。Screen は同じルートの loader を呼ぶ(D21)
//   (authorization の関数の例外は撤去した。layout がセッションに触れるのは隣の guard.ts の guard() だけ)
// 理由: UI で取ったデータは範囲の守り(guard.ts)と loader の access を通った後のデータにならない。取得は loader に集める(D73)。
// 名前付き例外: root layout(src/wiring/AppProviders.tsx)が描く AuthSessionProvider(Cookie の解析とセッション解決)。ignores に入れる。
//
// ── session-api-callsite(M3: セッション・ガード API を import しない場所) ──
// 対象: src/app 全体(page・Screen・layout・_layout・loader.ts・guard.ts・_components・API の route と補助ファイル)と UI 側
//   (src/components・src/features/**/components・src/features/**/hooks・src/hooks)。layout・_layout・loader.ts の許可は撤去した(D73 K4・K5)。
//   ページの主体は guard.ts の createLoader が解いて loader の ctx.user で渡し、範囲の守りは guard()。API の主体は Factory の ctx.user(D8 K4)。
//   token だけのセッション・lib/jwt の Cookie の解析もここで止まる。
//   proxy の項目(src/proxies/**、上流・fork)も対象: 主体は proxy.ts が渡す ctx.user()(D10)。解決器を作る src/proxy.ts は対象外。
//   core の services/server も対象(主体を解く基盤の auth と pairedDevice の session は外す)。fork の services/server・lib(pageGuard・routeFactory)は対象範囲の外。AuthSessionProvider は名前付き例外。
// 禁止する import:
//   - SESSION_API_NAMES の名前の値 import(どのパスからでも。barrel・re-export 経由も名前で捕まえる)。削除済みの名前
//     (authGuard・requireCurrentUser 等)も残す(fork に残った呼び出しを見つけるため)
//   - セッション API の定義モジュール(SESSION_MODULE)の namespace / default / 副作用 / dynamic import
// 通すもの: 型だけの import(SessionUser 型など)
//
// 不採用の案:
//   - 下流(fork)では warn: 一度は採ったが、セキュリティの検査の強さを所有で変えない方針で全 Tier error に上書き
//   - 新しい lint 名を作る: M4 の規則を不可の範囲へ広げるだけにした(D73 K4)
//
// 限界:
//   - 直接の import だけを見る。UI が import した別のモジュールの中での取得は捕まえない(その別のモジュールが UI の場所なら同じ規則で止まる)
//   - import 別名は名前の import 行で捕まえるが、値を変数に入れて別ファイルへ渡す形は追わない

/** M3: セッション・ガード API(呼べる場所を限る名前) */
export const SESSION_API_NAMES = new Set([
  // auth: ガードとセッション解決
  "authGuard",
  "getSessionUser",
  "getTokenOnlySession",
  "resolveSessionUser",
  "resolveSessionUserFromTokenOnly",
  "requireAuthenticated",
  "requireAdmin",
  "parseSessionCookie",
  "createProxyUser",
  // user: 自分の DB レコード
  "requireCurrentUser",
  // pairedDevice: 端末・端末の利用者
  "getSessionDevice",
  "deviceGuard",
  "requireCurrentDevice",
  "principalGuard",
  "requireCurrentPrincipal",
]);

/** M3: セッション API の定義モジュール(namespace / default / dynamic import はモジュール単位で止める) */
const SESSION_MODULE = new RegExp(
  [
    String.raw`features/core/auth/services/server/(authorization|requireRole|session(/[^/]+)?)$`,
    String.raw`features/core/user/services/server/resolvers(/[^/]+)?$`,
    String.raw`features/core/pairedDevice/services/server/session(/[^/]+)?$`,
    String.raw`^@/lib/jwt(/parseSessionCookie)?$`,
  ].join("|"),
);

const SERVER_SERVICE_PATH = /(^|\/)services\/server(\/|$)/;
// DB(L1.20): 接続(@/lib/drizzle)・drizzle-orm の値(演算子・sql)・Firebase Admin・表の定義(entities/drizzle)
const DB_MODULE = /^(@\/lib\/drizzle|drizzle-orm|@\/lib\/firebase\/server|firebase-admin)(\/|$)/;
const ENTITY_TABLE_MODULE = /(^|\/)entities\/drizzle$/;
const LOADER_PATH = /(^|\/)loader$/;

/**
 * M4: UI の場所での import 1 件を判定する。違反なら理由("serverService" | "db" | "loader")、問題なければ null
 * @param {string} source import 元
 * @param {boolean} typeOnly 型だけの import か
 * @param {{ layout?: boolean }} [options] layout = layout.tsx・_layout/**(loader も不可。Screen は同じルートの loader を呼ぶので可)
 */
export function classifyLayoutImport(source, typeOnly = false, options = { layout: true }) {
  if (typeOnly) return null;
  if (DB_MODULE.test(source) || ENTITY_TABLE_MODULE.test(source)) return "db";
  if (SERVER_SERVICE_PATH.test(source)) return "serverService";
  if (options.layout && LOADER_PATH.test(source)) return "loader";
  return null;
}

/**
 * M3: import 1 件を判定し、禁止されたセッション API の名前(モジュール単位なら "*")を返す
 * @param {string} source import 元
 * @param {{ name: string, typeOnly: boolean }[] | null} specifiers 取り出す名前(null = 名前を問わない: 副作用 / namespace / default / dynamic import)
 * @param {boolean} declarationTypeOnly `import type ...` 宣言か
 * @returns {string[]} 違反の名前(空 = 問題なし)
 */
export function classifySessionImport(source, specifiers, declarationTypeOnly = false) {
  if (declarationTypeOnly) return [];
  if (specifiers === null) return SESSION_MODULE.test(source) ? ["*"] : [];
  return specifiers.filter((s) => !s.typeOnly && SESSION_API_NAMES.has(s.name)).map((s) => s.name);
}

/** ImportDeclaration / ExportNamedDeclaration の specifiers を { name, typeOnly }[] に(名前を問わない形なら null) */
function readSpecifiers(node, declarationTypeOnly) {
  if (node.type === "ExportAllDeclaration") return null;
  const specs = node.specifiers ?? [];
  if (node.type === "ImportDeclaration") {
    if (specs.length === 0 || specs.some((s) => s.type !== "ImportSpecifier")) return null;
    return specs.map((s) => ({
      name: s.imported.type === "Identifier" ? s.imported.name : String(s.imported.value),
      typeOnly: declarationTypeOnly || s.importKind === "type",
    }));
  }
  return specs.map((s) => ({
    name: s.local.type === "Identifier" ? s.local.name : String(s.local.value),
    typeOnly: declarationTypeOnly || s.exportKind === "type",
  }));
}

/** 型だけの宣言か(`import type` / `export type`、または名前付き import がすべて型) */
function isTypeOnly(node, specifiers) {
  if (node.importKind === "type" || node.exportKind === "type") return true;
  return Array.isArray(specifiers) && specifiers.length > 0 && specifiers.every((s) => s.typeOnly);
}

/** import / export from / dynamic import を走査して visit(sourceNode, specifiers, typeOnly) を呼ぶ */
function moduleVisitors(visit) {
  const onDeclaration = (node) => {
    if (!node.source || typeof node.source.value !== "string") return;
    const declarationTypeOnly = node.importKind === "type" || node.exportKind === "type";
    const specifiers = readSpecifiers(node, declarationTypeOnly);
    visit(node.source, specifiers, isTypeOnly(node, specifiers));
  };
  return {
    ImportDeclaration: onDeclaration,
    ExportNamedDeclaration: onDeclaration,
    ExportAllDeclaration: onDeclaration,
    ImportExpression(node) {
      if (node.source.type !== "Literal" || typeof node.source.value !== "string") return;
      visit(node.source, null, false);
    },
  };
}

const layoutNoServerData = {
  meta: {
    type: "problem",
    docs: { description: "UI の場所(Screen・page・layout・_layout・guard.ts・_components・components・hooks)はサーバーのデータを取らない(services/server・DB を値で import しない。layout は loader も)" },
    messages: {
      serverService:
        '"{{source}}" はサーバーのサービスです。UI の場所はデータを取りません。取得は同じルートの loader(guard.ts の createLoader)へ(詳細: src/features/core/auth/README.md)',
      db: '"{{source}}" は DB です(接続・drizzle-orm の値・Firebase Admin・entities/drizzle の表)。UI の場所では import しません。取得はドメインのサービス → loader へ(型だけは可)',
      loader: '"{{source}}" は loader です。layout は loader を呼びません(loader は Screen が呼ぶ。詳細: src/features/core/auth/README.md)',
    },
    schema: [],
  },
  create(context) {
    const isLayout = /(^|[\\/])layout\.(ts|tsx)$|[\\/]_layout[\\/]/.test(context.filename);
    return moduleVisitors((sourceNode, _specifiers, typeOnly) => {
      const kind = classifyLayoutImport(sourceNode.value, typeOnly, { layout: isLayout });
      if (kind) context.report({ node: sourceNode, messageId: kind, data: { source: sourceNode.value } });
    });
  },
};

const sessionApiCallsite = {
  meta: {
    type: "problem",
    docs: { description: "ページ層・UI・API・proxy の項目はセッション・ガード API を import しない(主体は guard.ts の createLoader / API の Factory / proxy.ts の ctx が渡す)" },
    messages: {
      named:
        "{{names}} はセッション・ガード API です。ページ層(page・Screen・layout・loader・guard.ts)と部品・hooks では import しない。範囲の守りは隣の guard.ts の guard()、主体は loader の ctx.user(createLoader)。詳細: src/lib/pageGuard/README.md",
      module:
        '"{{source}}" はセッション API のモジュールです。ページ層と部品・hooks では import しない(主体は loader の ctx.user。詳細: src/lib/pageGuard/README.md)',
      namedApi:
        "{{names}} はセッション・ガード API です。API(src/app/api/**)では呼ばない。主体は Factory が解いた ctx.user を使い、門は access の宣言で書く(詳細: src/lib/routeFactory/README.md)",
      moduleApi:
        '"{{source}}" はセッション API のモジュールです。API(src/app/api/**)では import しない。主体は ctx.user(詳細: src/lib/routeFactory/README.md)',
      namedProxy:
        "{{names}} はセッション・ガード API です。proxy の項目(src/proxies/**)では呼ばない。利用者は proxy.ts が渡す ctx.user() を使う(詳細: src/proxies/README.md)",
      moduleProxy:
        '"{{source}}" はセッション API のモジュールです。proxy の項目(src/proxies/**)では import しない。利用者は ctx.user()(詳細: src/proxies/README.md)',
    },
    schema: [],
  },
  create(context) {
    const inApi = /(^|[\\/])src[\\/]app[\\/]api[\\/]/.test(context.filename);
    const inProxy = /(^|[\\/])src[\\/]proxies[\\/]/.test(context.filename);
    const place = inProxy ? "Proxy" : inApi ? "Api" : "";
    return moduleVisitors((sourceNode, specifiers, typeOnly) => {
      const names = classifySessionImport(sourceNode.value, specifiers, typeOnly);
      if (names.length === 0) return;
      if (names[0] === "*") {
        context.report({ node: sourceNode, messageId: `module${place}`, data: { source: sourceNode.value } });
      } else {
        context.report({ node: sourceNode, messageId: `named${place}`, data: { names: names.join(", ") } });
      }
    });
  },
};

/**
 * Flat config 用プラグインオブジェクト。
 * eslint.config.mjs から `plugins: { "page-authz": <this> }` で登録する。
 */
const plugin = {
  meta: {
    name: "eslint-plugin-local-page-authz",
    version: "1.0.0",
  },
  rules: {
    "layout-no-server-data": layoutNoServerData,
    "session-api-callsite": sessionApiCallsite,
  },
};

export default plugin;
