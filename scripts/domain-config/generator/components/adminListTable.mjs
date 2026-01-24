import fs from "fs";
import path from "path";
import { templateDir, replaceTokens } from "./utils/template.mjs";

// 一覧テーブルコンポーネントを生成する

// 複製ボタン関連のプレースホルダーを置換
function replaceDuplicatePlaceholders(content, config, tokens) {
  const useDuplicate = config?.useDuplicateButton ?? false;
  const useDetailModal = config?.useDetailModal ?? false;

  if (useDuplicate) {
    // DuplicateButtonのimport
    const duplicateImport = `import { DuplicateButton } from "@/components/Fanctional";\n`;
    // useDuplicateフックのimport
    const duplicateHookImport = `import { useDuplicate${tokens.pascal} } from "@/features/${tokens.camel}/hooks/useDuplicate${tokens.pascal}";\n`;
    // DuplicateButtonコンポーネント
    const duplicateButton = `<DuplicateButton id={d.id} useDuplicate={useDuplicate${tokens.pascal}} />\n        `;

    return content
      .replace(/__DUPLICATE_IMPORT__/g, duplicateImport)
      .replace(/__DUPLICATE_HOOK_IMPORT__/g, duplicateHookImport)
      .replace(/__DUPLICATE_BUTTON__/g, duplicateButton);
  } else {
    // 複製ボタン不要の場合はプレースホルダーを空文字で置換
    return content
      .replace(/__DUPLICATE_IMPORT__/g, "")
      .replace(/__DUPLICATE_HOOK_IMPORT__/g, "")
      .replace(/__DUPLICATE_BUTTON__/g, "");
  }
}

export default function generate({ config, ...tokens }) {
  const { camel } = tokens;
  const templateFile = config?.useDetailModal
    ? "Table.withDetailModal.tsx"
    : "Table.tsx";
  const rel = path.join("Admin__Domain__List", templateFile);
  const templatePath = path.join(templateDir, rel);
  const outputRel = path.join("Admin__Domain__List", "Table.tsx");
  const outputFile = path.join(
    process.cwd(),
    "src",
    "features",
    camel,
    "components",
    replaceTokens(outputRel, tokens),
  );
  const outputDir = path.dirname(outputFile);

  // テンプレートファイルが無ければエラー終了
  if (!fs.existsSync(templatePath)) {
    console.error(`テンプレートが見つかりません: ${templatePath}`);
    process.exit(1);
  }

  // 出力ディレクトリが無ければ作成
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const template = fs.readFileSync(templatePath, "utf8");
  // まず複製ボタン関連のプレースホルダーを置換
  const withDuplicate = replaceDuplicatePlaceholders(template, config, tokens);
  // 次に標準のトークンを置換
  const content = replaceTokens(withDuplicate, tokens);
  fs.writeFileSync(outputFile, content);
  console.log(`コンポーネントを生成しました: ${outputFile}`);
}
