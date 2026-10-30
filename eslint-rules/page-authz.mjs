// eslint-rules/page-authz.mjs
//
// ページ層(src/app)の認可まわりの置き場所の検査。ルート作成の必須検査 M3・M4 のうち、import で判定できる部分。
// 対象範囲は eslint.config.mjs 側で決める(このファイルは「対象ファイルで何を import したか」だけを見る)。
// 強さ: 両規則とも upstream・下流の全 Tier で error。セキュリティの検査は所有で強さを変えない(前例 hidden-columns)。
//
// ── layout-no-server-data(M4: layout はサーバー側でデータを取らない) ──
// 対象: src/app/**/layout.tsx と src/app/**/_layout/**(layout の組み立て)。_layout/guard.ts は対象外(方針の定義場所)。
// 禁止する import:
//   - `services/server` を含むパス(絶対・相対。共有 admin loader の features/core/admin/services/server/loaders も含む)
//     例外: @/features/core/auth/services/server/authorization(authGuard・hasAdminUser 等の認可の関数)だけは許可
//   - DB: @/lib/drizzle・drizzle-orm・@/lib/firebase/server・firebase-admin(それぞれ配下も)
//   - loader: 末尾が /loader のパス(./_screen/loader 等)
//   (session/getSessionUser 等の直読みも services/server なので止まる。layout のセッション参照は authGuard 経由だけ)
// 通すもの: 型だけの import / client 部品(hooks → API で取るのは対象外)
// 理由: layout はページ・loader と並列に描かれ、ガードを置いた layout の内側の layout もそのガードで守られない。
//   layout で取ったデータは「ガードを通った後のデータ」にならないので、取得は loader(と将来の guard.ts)に寄せる。
// 名前付き例外: root layout の AuthSessionProvider(認証基盤。Cookie からセッションを解決して client に渡す)。
//   components のパスなのでこの規則には掛からない(import を許す特例の実装は無い)。
//
// ── session-api-callsite(M3: セッション・ガード API を呼べる場所を役割で限る) ──
// 対象: src/app(src/app/api/** の route と補助ファイルを含む)と UI 側(src/components・src/features/**/components・
//   src/features/**/hooks・src/hooks)。
// 許可(eslint.config.mjs の ignores): layout・_layout/(組み立てと guard.ts)・loader.ts(_screen/・_components/ とも)。
//   API には許可の場所が無い: 主体は API の Factory(@/wiring/apiRoute)が 1 回だけ DB 同期で解いて ctx.user で渡す(D8 K4)。
//   token だけのセッション・lib/jwt の Cookie の解析もここで止まる。
//   共有 admin loader(features/core/admin/services/server/loaders)・proxy・services/server・lib/routeFactory は
//   対象範囲の外(それぞれの契約で扱う)。AuthSessionProvider は名前付き例外として ignores に入れる。
// 禁止する import:
//   - SESSION_API_NAMES の名前の値 import(どのパスからでも。barrel・re-export 経由も名前で捕まえる)
//   - セッション API の定義モジュール(SESSION_MODULE)の namespace / default / 副作用 / dynamic import
// 通すもの: 型だけの import(SessionUser 型など)
// 理由: page.tsx・Screen・部品がセッションを読むと、認可の判断がページごとに散らばり、ルート地図・方針の参照で検査できない。
//   ガードは layout、ページのデータの認可は loader に集める。
//
// 不採用の案:
//   - 下流(fork)では warn: 一度は採ったが、セキュリティの検査の強さを所有で変えない方針で全 Tier error に上書き
//   - 「認証方針を持つ layout は見た目部品を import しない」で縛る: 枠とガードの同居を禁じる理由が無く、
//     データ取得の禁止(M4)で目的を果たせる
//
// 限界:
//   - 直接の import だけを見る。layout が import した server component の中での取得は捕まえない
//   - import 別名は名前の import 行で捕まえるが、値を変数に入れて別ファイルへ渡す形は追わない
//   - layout での任意のセッション読み取りの範囲・方針の参照(guard.ts)の検査は loader Factory と一緒に入れる

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
const AUTHORIZATION_MODULE = /^@\/features\/core\/auth\/services\/server\/authorization$/;
const DB_MODULE = /^(@\/lib\/drizzle|drizzle-orm|@\/lib\/firebase\/server|firebase-admin)(\/|$)/;
const LOADER_PATH = /(^|\/)loader$/;

/**
 * M4: layout での import 1 件を判定する。違反なら理由("serverService" | "db" | "loader")、問題なければ null
 * @param {string} source import 元
 * @param {boolean} typeOnly 型だけの import か
 */
export function classifyLayoutImport(source, typeOnly = false) {
  if (typeOnly) return null;
  if (AUTHORIZATION_MODULE.test(source)) return null;
  if (DB_MODULE.test(source)) return "db";
  if (SERVER_SERVICE_PATH.test(source)) return "serverService";
  if (LOADER_PATH.test(source)) return "loader";
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
    docs: { description: "layout はサーバー側でデータを取らない(services/server・DB・loader を import しない。authorization の関数は可)" },
    messages: {
      serverService:
        '"{{source}}" はサーバーのサービスです。layout はデータを取りません。取得は loader へ(認可の関数は @/features/core/auth/services/server/authorization から。詳細: src/features/core/auth/README.md)',
      db: '"{{source}}" は DB です。layout はデータを取りません。取得は loader へ(詳細: src/features/core/auth/README.md)',
      loader: '"{{source}}" は loader です。layout は loader を呼びません(loader は Screen が呼ぶ。詳細: src/features/core/auth/README.md)',
    },
    schema: [],
  },
  create(context) {
    return moduleVisitors((sourceNode, _specifiers, typeOnly) => {
      const kind = classifyLayoutImport(sourceNode.value, typeOnly);
      if (kind) context.report({ node: sourceNode, messageId: kind, data: { source: sourceNode.value } });
    });
  },
};

const sessionApiCallsite = {
  meta: {
    type: "problem",
    docs: { description: "セッション・ガード API は layout・_layout・loader だけで呼ぶ" },
    messages: {
      named:
        "{{names}} はセッション・ガード API です。呼べるのは layout・_layout/・loader.ts だけ(page.tsx・Screen・部品・hooks では呼ばない。詳細: src/features/core/auth/README.md)",
      module:
        '"{{source}}" はセッション API のモジュールです。呼べるのは layout・_layout/・loader.ts だけ(詳細: src/features/core/auth/README.md)',
      namedApi:
        "{{names}} はセッション・ガード API です。API(src/app/api/**)では呼ばない。主体は Factory が解いた ctx.user を使い、門は access の宣言で書く(詳細: src/lib/routeFactory/README.md)",
      moduleApi:
        '"{{source}}" はセッション API のモジュールです。API(src/app/api/**)では import しない。主体は ctx.user(詳細: src/lib/routeFactory/README.md)',
    },
    schema: [],
  },
  create(context) {
    const inApi = /(^|[\\/])src[\\/]app[\\/]api[\\/]/.test(context.filename);
    return moduleVisitors((sourceNode, specifiers, typeOnly) => {
      const names = classifySessionImport(sourceNode.value, specifiers, typeOnly);
      if (names.length === 0) return;
      if (names[0] === "*") {
        context.report({ node: sourceNode, messageId: inApi ? "moduleApi" : "module", data: { source: sourceNode.value } });
      } else {
        context.report({ node: sourceNode, messageId: inApi ? "namedApi" : "named", data: { names: names.join(", ") } });
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
