import fs from "fs";
import path from "path";
import { templateDir, replaceTokens } from "./utils/template.mjs";
// ドメイン共通フォームコンポーネントを生成する

export default function generate(options) {
  const { camel, config, ...tokens } = options;
  const rel = path.join("common", "__Domain__Form.tsx");
  const templatePath = path.join(templateDir, rel);
  const outputFile = path.join(process.cwd(), "src", "features", camel, "components", replaceTokens(rel, tokens));
  const outputDir = path.dirname(outputFile);

  // テンプレートが存在しない場合は終了
  if (!fs.existsSync(templatePath)) {
    console.error(`テンプレートが見つかりません: ${templatePath}`);
    process.exit(1);
  }

  // 出力先が無ければディレクトリを作成
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const template = fs.readFileSync(templatePath, "utf8");

  const hasImageUploader = Boolean(config?.fields?.some((field) => field.formInput === "imageUploader"));

  let content = replaceTokens(template, tokens);

  if (hasImageUploader) {
    content = content
      .replace(
        'import type { FieldValues, UseFormReturn } from "react-hook-form";',
        'import type { FieldValues, UseFormReturn } from "react-hook-form";\nimport { useState } from "react";',
      )
      .replace(
        '  const loading = isSubmitting || isMutating;',
        '  const [imagePending, setImagePending] = useState(false);\n\n  const loading = isSubmitting || isMutating || imagePending;',
      )
      .replace(
        '          control={control}',
        '          control={control}\n          onPendingChange={setImagePending}',
      );
  }

  fs.writeFileSync(outputFile, content);
  console.log(`コンポーネントを生成しました: ${outputFile}`);
}
