// eslint-rules/realtime-room-purity.mjs
//
// ルームロジック (src/features/**/room/**) の純度制約を強制するローカル ESLint プラグイン。
//
// 背景:
//   ルーム reducer は servers/room (Cloudflare Workers ランタイム) にバンドルされる。
//   Node/Next/DB 依存を import した瞬間に Worker ビルドが壊れる (最悪、実行時に壊れる) ため、
//   「features に置くがランタイム依存は持てない」という境界を静的に強制する。
//   (workers 側 tsconfig にも Node/DOM 型が無いため型チェックでも落ちるが、
//    アプリ側の開発中に早く気づけるようこちらでも検査する)
//
// 許可する import:
//   - 相対 import (同一 room/ ディレクトリ内の分割)
//   - @/lib/realtimeRoom/protocol (共有プロトコル = 唯一の接点)
//   - import type (型のみ。ランタイムに残らないため任意のパスを許可)

const ALLOWED_PREFIXES = ["@/lib/realtimeRoom/protocol"];

const purityRule = {
  meta: {
    type: "problem",
    docs: {
      description: "ルームロジック (features/**/room/**) の import を純粋な依存に限定する",
    },
    messages: {
      forbiddenImport:
        'room/ 配下は Cloudflare Workers にバンドルされるため "{{source}}" を import できません。許可: 相対 import / @/lib/realtimeRoom/protocol / import type',
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== "string") return;

        // 型のみの import はランタイムに残らないため許可
        if (node.importKind === "type") return;
        if (
          node.specifiers.length > 0 &&
          node.specifiers.every((s) => s.type === "ImportSpecifier" && s.importKind === "type")
        ) {
          return;
        }

        // 相対 import (room/ 内の分割) は許可
        if (source.startsWith(".")) return;

        if (ALLOWED_PREFIXES.some((prefix) => source === prefix || source.startsWith(`${prefix}/`))) {
          return;
        }

        context.report({ node, messageId: "forbiddenImport", data: { source } });
      },
    };
  },
};

/**
 * Flat config 用プラグインオブジェクト。
 * eslint.config.mjs から `plugins: { "realtime-room": <this> }` で登録する。
 */
const plugin = {
  meta: {
    name: "eslint-plugin-local-realtime-room-purity",
    version: "1.0.0",
  },
  rules: {
    purity: purityRule,
  },
};

export default plugin;
