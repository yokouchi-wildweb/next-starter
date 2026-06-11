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

const requireAuthzRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "createApiRoute を直接使うカスタムルートに認可（getSessionUser/authGuard 等）または session 参照の痕跡が無い場合に警告する",
    },
    schema: [],
    messages: {
      missingAuthz:
        "このカスタムルートには認可チェック（getSessionUser / authGuard / getRoleCategory 等）も session 参照も見当たりません。" +
        "認証・認可が必要なら追加してください（管理者限定なら getRoleCategory(session.role) === \"admin\" 等）。" +
        "意図的に未認証で公開する場合は、理由付きで抑止してください: " +
        "`// eslint-disable-next-line route-authz/require-authz -- 公開: <理由>`",
    },
  },
  create(context) {
    /** ファイル内で見つかった createApiRoute 呼び出しノード */
    const apiRouteCalls = [];
    /** 認可の痕跡が 1 つでもあったか */
    let hasAuthSignal = false;

    return {
      CallExpression(node) {
        const name = calleeName(node);
        if (name && TARGET_FACTORIES.has(name)) {
          apiRouteCalls.push(node);
        }
        // 認可系の関数呼び出し
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
        if (hasAuthSignal) return;
        for (const node of apiRouteCalls) {
          context.report({ node: node.callee, messageId: "missingAuthz" });
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
