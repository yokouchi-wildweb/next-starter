// 登録された入力部品の名前（src/wiring/formInputs/inputs/ の項目の name）。
// 生成の検査が使う。生成一覧は forge の後段で作るので項目を直接読む（構文木で字面を読み、実行しない）

import ts from "typescript";

/** 項目のソースから name のリテラルを読む。読めなければ null（項目の形は pnpm check extensions が見る） */
export function formInputNameOf(text) {
  const source = ts.createSourceFile("item.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText() !== "formInput" || !declaration.initializer) continue;
      let node = declaration.initializer;
      while (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) node = node.expression;
      if (!ts.isObjectLiteralExpression(node)) return null;
      for (const property of node.properties) {
        if (ts.isPropertyAssignment(property) && property.name.getText() === "name" && ts.isStringLiteralLike(property.initializer)) return property.initializer.text;
      }
    }
  }
  return null;
}

/**
 * @param {import("./workspace.mjs").Workspace} workspace
 * @returns {Set<string>} 登録名
 */
export function readRegisteredFormInputs(workspace) {
  const dir = workspace.formInputsDir;
  const names = new Set();
  for (const entry of workspace.listDir(dir)) {
    const candidates = /\.tsx?$/.test(entry) ? [`${dir}/${entry}`] : [`${dir}/${entry}/index.ts`, `${dir}/${entry}/index.tsx`];
    const file = candidates.find((candidate) => workspace.exists(candidate));
    if (!file) continue;
    const name = formInputNameOf(workspace.readText(file));
    if (name) names.add(name);
  }
  return names;
}
