// 検査: Firestore ドメインにメディア列・主の集まりを置けない（Firestore adapter は凍結で storage binding も集まりも持たない）

import { collectMediaFields, isCollectionFieldType } from "../spec/fieldTypes.mjs";

/**
 * @returns {string | null} 問題があればエラー文、無ければ null
 */
export function checkMediaFieldsEngine(camel, config, dbEngine = config?.dbEngine) {
  const mediaFields = [
    ...collectMediaFields(config),
    ...(config?.fields ?? []).filter((f) => isCollectionFieldType(f?.fieldType)).map((f) => ({ name: f.name })),
  ];
  if (dbEngine !== "Firestore" || mediaFields.length === 0) return null;
  return (
    `[${camel}] Firestore ドメインにはメディア列（mediaUploader・mediaCollection）を置けません: ` +
    `${mediaFields.map((f) => f.name).join(", ")}。ファイルを持つドメインは dbEngine "Neon" にしてください。`
  );
}
