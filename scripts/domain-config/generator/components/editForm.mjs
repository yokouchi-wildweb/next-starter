import fs from "fs";
import path from "path";
import { templateDir, replaceTokens } from "./utils/template.mjs";

// ドメインの編集フォームコンポーネントを生成する
// リレーション先のデータ取得は __Domain__Fields 内の useRelationOptions で自動処理される

export default function generate({ config, ...tokens }) {
  const { camel, pascal } = tokens;
  const rel = path.join("common", "Edit__Domain__Form.tsx");
  const templatePath = path.join(templateDir, rel);
  const outputFile = path.join(process.cwd(), "src", "features", camel, "components", replaceTokens(rel, tokens));
  const outputDir = path.dirname(outputFile);

  // テンプレートが無い場合はエラー
  if (!fs.existsSync(templatePath)) {
    console.error(`テンプレートが見つかりません: ${templatePath}`);
    process.exit(1);
  }

  // 出力ディレクトリが無ければ作成
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const template = fs.readFileSync(templatePath, "utf8");

  // オートセーブ設定の適用（config がない場合や useAutoSave がない場合はデフォルトで false）
  const useAutoSave = config?.useAutoSave ?? false;

  let content = template;

  if (useAutoSave) {
    // オートセーブ用のインポートを追加（replaceTokens 前のテンプレート状態で置換）
    content = content.replace(
      'import { buildFormDefaultValues } from "@/components/Form/FieldRenderer";',
      'import { buildFormDefaultValues } from "@/components/Form/FieldRenderer";\nimport { useAutoSaveConfig } from "@/components/Form/AutoSave";'
    );

    // autoSave フックの呼び出しを追加
    content = content.replace(
      'const { trigger, isMutating } = useUpdate__Domain__();',
      'const { trigger, isMutating } = useUpdate__Domain__();\n  const autoSave = useAutoSaveConfig(trigger, __domain__.id);'
    );

    // onCancel を autoSave に変更
    content = content.replace(
      'onCancel={() => router.push(redirectPath)}',
      'autoSave={autoSave}'
    );
  }

  // 最後に replaceTokens を実行
  content = replaceTokens(content, tokens);

  fs.writeFileSync(outputFile, content);
  console.log(`コンポーネントを生成しました: ${outputFile}`);
}
