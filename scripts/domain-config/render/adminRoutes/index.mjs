// generateFiles.adminRoutes: src/app/admin/(protected)/<domains>/ の一覧・new/・[id]/edit/（sortOrderField で sort/）
//
// 出力の構造（SCREENS: src/lib/screens/README.md §12）:
//   <domains>/page.tsx            1 行スイッチ。初回のみ生成（write-once）、以後上書きしない
//   <domains>/_screen/<Name>.tsx  既定画面。毎回再生成（手で編集しない）
// 既存の page.tsx が旧形式（本体を直接持つ）なら一度だけ 1 行スイッチへ書き換える（移行）。_components/ には触らない（fork 所有）

import path from "node:path";
import { file, writeOnce } from "../output.mjs";
import { replaceDomainTokens } from "../tokens.mjs";
import { buildRelationTokens } from "./relationTokens.mjs";

/** ルートごとに page.tsx（write-once）と _screen/（毎回再生成）のテンプレート対 */
function routesFor(config) {
  const routes = [
    { page: ["__domains__", "page.tsx"], screen: ["__domains__", "_screen", "Admin__Domain__ListScreen.tsx"] },
    { page: ["__domains__", "new", "page.tsx"], screen: ["__domains__", "new", "_screen", "Admin__Domain__CreateScreen.tsx"] },
    { page: ["__domains__", "[id]", "edit", "page.tsx"], screen: ["__domains__", "[id]", "edit", "_screen", "Admin__Domain__EditScreen.tsx"] },
  ];
  if (config?.sortOrderField) {
    routes.push({ page: ["__domains__", "sort", "page.tsx"], screen: ["__domains__", "sort", "_screen", "Admin__Domain__SortScreen.tsx"] });
  }
  return routes;
}

/**
 * 既存の page.tsx が旧形式（本体を直接持つ）か。
 * コメントを除いた本文が `export default` を含み、./_screen/ も ./_components/ も参照していなければ旧形式とみなす。
 * fork が _components/ へ向けた page.tsx（`export { X as default } from "./_components/X"` 等）は保持される
 */
export function isLegacyPage(content) {
  const body = content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return /export\s+default\b/.test(body) && !/from\s+["']\.\/(_screen|_components)\//.test(body);
}

/**
 * @param {import("../../domain/context.mjs").DomainContext} ctx
 * @param {import("../../domain/workspace.mjs").Workspace} workspace
 * @returns {import("../output.mjs").Output[]}
 */
export function renderAdminRoutes(ctx, workspace) {
  const { config, pascal, kebabPlural } = ctx;
  const relTokens = buildRelationTokens(config?.relations, ctx);

  function render(templateSegments) {
    const templatePath = path.join(workspace.adminTemplateDir, ...templateSegments);
    if (!workspace.exists(templatePath)) {
      throw new Error(`テンプレートが見つかりません: ${templatePath}`);
    }
    const content = replaceDomainTokens(workspace.readText(templatePath), ctx);
    // 行単位のトークン（改行込みで置換）は、空のとき行ごと消す（生成物に空行を残さない）。行末の空白は許容
    const rendered = content
      .replace(/__RELATION_IMPORTS__[ \t]*\n/g, relTokens.imports)
      .replace(/__ASYNC__/g, relTokens.async)
      .replace(/__RELATION_FETCH__[ \t]*\n/g, relTokens.relationFetchNew)
      .replace(/__EDIT_FETCH__[ \t]*\n/g, relTokens.editFetch)
      .replace(/__SWR_START__[ \t]*\n/g, relTokens.swrStart)
      .replace(/__SWR_END__[ \t]*\n/g, relTokens.swrEnd)
      .replace(/__SORT_ORDER_FIELD__/g, config?.sortOrderField ?? "sort_order");
    // 置換されなかったトークンを黙って出力しない（テンプレートの崩れを即座に検出する）
    const leftover = rendered.match(/__[A-Z_]+__/);
    if (leftover) {
      throw new Error(`テンプレートのトークンが置換されていません: ${leftover[0]} (${path.join(...templateSegments)})`);
    }
    return rendered;
  }

  // テンプレートの相対パスを出力先へ（ディレクトリは kebab 複数形、ファイル名は PascalCase）
  const outputPath = (segments) =>
    path.join(workspace.adminProtectedDir, ...segments.map((s) => s.replace("__domains__", kebabPlural).replace(/__Domain__/g, pascal)));

  const outputs = [];
  for (const route of routesFor(config)) {
    outputs.push(file(outputPath(route.screen), render(route.screen), { label: "管理画面(_screen)を生成しました" }));
    outputs.push(
      writeOnce(outputPath(route.page), render(route.page), {
        label: "管理画面ルートを生成しました",
        keptLabel: "page.tsx は既存のため保持しました(write-once)",
        migrate: { test: isLegacyPage, label: "旧形式の page.tsx を 1 行スイッチへ移行しました(以後は上書きしません)" },
      }),
    );
  }
  return outputs;
}
