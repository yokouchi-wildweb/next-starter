// eslint-rules/no-server-action.mjs
//
// "use server"(server action)を src/** で禁止する(D26 K2、全 Tier error)。
// サーバーの処理の入口は API ルート(Factory が認可を強制する)と loader だけにする。
// server action は Factory の外に公開の口を作り、access の検査に載らない。
// 需要が出たら上流が server action 用の Factory を作るかを /order で決める。

const rule = {
  meta: {
    type: "problem",
    docs: { description: '"use server" を書かない(入口は API ルートの Factory と loader)' },
    messages: {
      serverAction: '"use server" は使えません。API ルート(@/wiring/apiRoute の Factory)か loader を使います(CLAUDE.md ARCHITECTURE)',
    },
    schema: [],
  },
  create(context) {
    return {
      ExpressionStatement(node) {
        if (node.expression.type === "Literal" && node.expression.value === "use server") {
          context.report({ node, messageId: "serverAction" });
        }
      },
    };
  },
};

const plugin = {
  meta: { name: "eslint-plugin-local-no-server-action", version: "1.0.0" },
  rules: { "no-server-action": rule },
};

export default plugin;
