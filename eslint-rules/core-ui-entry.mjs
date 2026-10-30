// eslint-rules/core-ui-entry.mjs
//
// core の部品は全部公開で、読むのは入口だけ(CLAUDE.md COMPONENTS core_ui)。
// 入口 = components/<Name>/index・components/<Name>.tsx・common/<Part>/index・common/<Part>.tsx
// 部品のフォルダの中のファイルを、そのフォルダの外から値 import すると error。中の組み立ては入口の裏に隠れる。
// 型だけの import は実行時に中身を読まないので対象外(型の置き場は部品の持ち主が決める)。
// 別名(@/features/<core>/*)・相対・baseUrl は実パスに解いて比べる(resolve-import.mjs)。
// 全 Tier で error(fork 分岐なし)。行の例外は置かない: 足りない入口は持ち主が足す。

import { moduleVisitors, repoRelative, resolveImport } from "./resolve-import.mjs";

const CORE_UI_PART = /^(src\/features\/core\/[^/]+\/components\/(?:common\/)?[^/]+)\/(.+)$/;
const GENERATED_LIST = /\/extensions\/[^/]+$/;
const ENTRY = /^index(\.(ts|tsx|mts|mjs|js))?$/;

/**
 * 解いたパスが部品の中身を指すなら、その部品のフォルダを返す。入口や部品の外なら null
 * @param {string | null} resolved repo 相対の実パス
 */
export function corePartFolderOf(resolved) {
  if (!resolved) return null;
  const match = CORE_UI_PART.exec(resolved);
  if (!match) return null;
  // components/common/<Part>.tsx は入口(CORE_UI_PART は common を任意にするので、common そのものの直下を除く)
  if (match[1].endsWith("/components/common")) return null;
  return ENTRY.test(match[2]) ? null : match[1];
}

/** import 元がその部品のフォルダの外か */
export const isOutside = (importer, folder) => !importer.startsWith(`${folder}/`);

const rule = {
  meta: {
    type: "problem",
    docs: { description: "core の部品の中身を外から読まない(入口だけを import する)" },
    messages: {
      inner: '"{{source}}" は部品 {{part}} の中のファイルです。入口({{part}} の index か、{{part}}.tsx)から読んでください(CLAUDE.md core_ui)',
    },
    schema: [],
  },
  create(context) {
    const repoRoot = context.cwd ?? process.cwd();
    const importer = repoRelative(context.filename, repoRoot);
    // 生成された一覧は受け口の項目を読むのが仕事(milestone/components/renderers など)
    if (GENERATED_LIST.test(importer)) return {};
    return moduleVisitors(({ node, source, typeOnly }) => {
      if (typeOnly) return;
      const folder = corePartFolderOf(resolveImport(source, context.filename, repoRoot));
      if (!folder || !isOutside(importer, folder)) return;
      context.report({ node, messageId: "inner", data: { source, part: folder.replace(/^src\/features\/core\//, "") } });
    });
  },
};

const plugin = {
  meta: { name: "eslint-plugin-local-core-ui-entry", version: "1.0.0" },
  rules: { "no-inner-import": rule },
};

export default plugin;
