// eslint-rules/route-authz.mjs
//
// カスタム API ルート（createApiRoute を直接使う route.ts）の認可漏れを検出する
// ローカル ESLint プラグイン。
//
// 背景:
//   汎用ルート（createDomainRoute）は domain.json の apiAccess により fail-closed で
//   守られるが、手書きの createApiRoute は認可を一切書かなくても通る（fail-open）。
//   この非対称が「認可ゼロのルートを無意識に本番へ出す」事故の温床になる。
//   ※ createApiRoute.ts のコメントも「認可が必要なら authGuard 等をハンドラ内で呼べ」
//      と促すだけで、構造的な強制は無い。本ルールはその気づきを静的に与える。
//
// 検出ロジック（best-effort / warn）:
//   ファイル内に createApiRoute(...) の呼び出しがあり、かつ
//   「認可の痕跡」（下記いずれか）が一切無い場合に、その呼び出しへ警告する。
//     - 認可系関数の参照: AUTH_SIGNALS のいずれか
//     - セッション参照: 識別子 `session`（ハンドラ ctx からの分割代入を含む）
//
//   createDomainRoute / createDomainIdRoute は apiAccess で守られるため対象外。
//
// 抑止（意図的に公開するルート）:
//   未認証アクセスが正当なルート（ログイン前処理・webhook・公開一覧等）は、
//   理由付き eslint-disable で「意図的 public」であることを明示する。
//     // eslint-disable-next-line route-authz/require-authz -- 公開: ログイン前のため未認証で叩く
//
// 限界:
//   session を参照していても実際の拒否（if (!session) 等）まではチェックしない。
//   「認可を一切考えていないルート」を炙り出すのが目的で、厳密な認可検証ではない。
//   より強い保証が必要なら createApiRoute の config に access を型必須化する（別提案）。

/**
 * 認可の痕跡とみなす関数・識別子名。
 * フォーク先で独自の認可ヘルパーを追加する場合はここに足す。
 */
const AUTH_SIGNALS = new Set([
  "getSessionUser",
  "getSessionUserOrThrow",
  "authGuard",
  "getRoleCategory",
  "requireAdmin",
  "requireAuthenticated",
  "requireAuth",
  "requireRole",
  "assertAdmin",
  "assertRole",
  "isAdmin",
  // ctx から取り出したセッションを参照しているケース（分割代入 { session } 含む）
  "session",
]);

/** createApiRoute を生む factory 名（これらを直接呼ぶルートが対象） */
const TARGET_FACTORIES = new Set(["createApiRoute"]);

function calleeName(node) {
  if (!node || node.type !== "CallExpression") return null;
  const callee = node.callee;
  if (callee.type === "Identifier") return callee.name;
  return null;
}

/**
 * createApiRoute(config, handler) の config から access の宣言種別を判定する。
 * - "declared": "public" / "authenticated" / { roleCategories|roles } / 変数参照（factory が認可 or 意図的公開）
 * - "custom": access: "custom"（ハンドラが自前で認可する宣言）
 * - "missing": access プロパティが無い
 */
function getAccessKind(node) {
  const arg = node.arguments[0];
  if (!arg || arg.type !== "ObjectExpression") return "missing";
  for (const prop of arg.properties) {
    if (prop.type !== "Property") continue;
    const key =
      prop.key.type === "Identifier"
        ? prop.key.name
        : prop.key.type === "Literal"
          ? prop.key.value
          : null;
    if (key !== "access") continue;
    const v = prop.value;
    if (v.type === "Literal" && v.value === "custom") return "custom";
    return "declared";
  }
  return "missing";
}

const requireAuthzRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "createApiRoute を直接使うカスタムルートに access 宣言が無い、または access:\"custom\" なのに自前ガードが無い場合に警告する",
    },
    schema: [],
    messages: {
      missingAccess:
        "createApiRoute に access の宣言がありません。アクセスポリシーを宣言してください" +
        "（public / authenticated / custom / { roleCategories } など）。" +
        "詳細: docs/how-to/APIルート認可実装ガイド.md",
      customNoGuard:
        "access: \"custom\"（自前認可）と宣言されていますが、ハンドラ内に認可の痕跡" +
        "（getSessionUser / requireAdmin / requireAuthenticated / session 参照 等）が見当たりません。" +
        "自前ガードを追加するか、適切な access（public / authenticated / { roleCategories }）を宣言してください。",
    },
  },
  create(context) {
    /** ファイル内で見つかった createApiRoute 呼び出し: { node, kind } */
    const apiRouteCalls = [];
    /** 認可の痕跡が 1 つでもあったか（custom ルートの自前ガード検出用） */
    let hasAuthSignal = false;

    return {
      CallExpression(node) {
        const name = calleeName(node);
        if (name && TARGET_FACTORIES.has(name)) {
          apiRouteCalls.push({ node, kind: getAccessKind(node) });
        }
        if (name && AUTH_SIGNALS.has(name)) {
          hasAuthSignal = true;
        }
      },

      // `session` 識別子の出現（分割代入・メンバーアクセス・引数参照など）を広く拾う。
      Identifier(node) {
        if (AUTH_SIGNALS.has(node.name)) {
          hasAuthSignal = true;
        }
      },

      "Program:exit"() {
        for (const { node, kind } of apiRouteCalls) {
          if (kind === "declared") continue;
          if (kind === "missing") {
            context.report({ node: node.callee, messageId: "missingAccess" });
          } else if (kind === "custom" && !hasAuthSignal) {
            context.report({ node: node.callee, messageId: "customNoGuard" });
          }
        }
      },
    };
  },
};

/**
 * Flat config 用プラグインオブジェクト。
 * eslint.config.mjs から `plugins: { "route-authz": <this> }` で登録する。
 */
const plugin = {
  meta: {
    name: "eslint-plugin-local-route-authz",
    version: "1.0.0",
  },
  rules: {
    "require-authz": requireAuthzRule,
  },
};

export default plugin;
