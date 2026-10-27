// 検査: Firestore ドメインにメディア列を置けない（Firestore adapter は凍結で storage binding を持たない）

import { collectMediaFields } from "../spec/fieldTypes.mjs";

/**
 * @returns {string | null} 問題があればエラー文、無ければ null
 */
export function checkMediaFieldsEngine(camel, config, dbEngine = config?.dbEngine) {
  const mediaFields = collectMediaFields(config);
  if (dbEngine !== "Firestore" || mediaFields.length === 0) return null;
  return (
    `[${camel}] Firestore ドメインにはメディア列（mediaUploader / mediaUploaderMulti）を置けません: ` +
    `${mediaFields.map((f) => f.name).join(", ")}。ファイルを持つドメインは dbEngine "Neon" にしてください。`
  );
}
