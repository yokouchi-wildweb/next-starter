// フィールドの質問のうち「主の集まり（mediaCollection）」の問い。ファイルの条件は聞かない（従属ドメインのメディア項目に書く）。
// 従属の名前（既定を提案）→ 必須 → 最大件数 → 並べ替え → （必須でなければ）複製で写すか

import inquirer from "inquirer";
import {
  DEFAULT_COLLECTION_MAX_ITEMS,
  buildCollectionField,
  defaultChildName,
  isSnakeCaseName,
} from "../../spec/collectionField.mjs";

const prompt = inquirer.createPromptModule();

/** 型で mediaUploaderMulti を選んだときの案内（選択は止めない） */
export const MULTI_GUIDANCE =
  "新しく複数のメディアを持たせるなら mediaCollection（集まり: 1 枚ずつ従属のドメインの行に保存）を選んでください。mediaUploaderMulti（1 列の配列）は既存の項目のために残しています。";

function validatePositiveInteger(input) {
  const value = Number(String(input ?? "").trim());
  return Number.isInteger(value) && value >= 1 ? true : "1以上の整数で入力してください。";
}

/**
 * @param {object} config 書いている domain.json（singular を使う）
 * @param {string} name フィールド名（snake_case）
 * @param {string} label 表示名
 */
export async function askCollectionField(config, name, label) {
  const suggested = defaultChildName(config.singular, name).singular;
  const { childSingular } = await prompt({
    type: "input",
    name: "childSingular",
    message: "従属のドメイン名（snake_case。1 枚ずつの行を持つドメイン）:",
    default: suggested,
    validate: (input) => {
      const trimmed = String(input ?? "").trim();
      return !trimmed || isSnakeCaseName(trimmed) ? true : "snake_case（英小文字・数字・_）で入力してください。";
    },
  });

  const { required } = await prompt({
    type: "confirm",
    name: "required",
    message: "このフィールドを必須（1 枚以上）にしますか?",
    default: false,
  });

  const { maxItems } = await prompt({
    type: "input",
    name: "maxItems",
    message: `最大件数（既定: ${DEFAULT_COLLECTION_MAX_ITEMS}）:`,
    default: String(DEFAULT_COLLECTION_MAX_ITEMS),
    validate: validatePositiveInteger,
  });

  const { reorderable } = await prompt({
    type: "confirm",
    name: "reorderable",
    message: "ドラッグで並び替えできるようにしますか？",
    default: true,
  });

  // 必須なら複製は常に写す（写さないと複製した主が必ず下限を割る）
  const { duplicate } = required
    ? { duplicate: true }
    : await prompt({ type: "confirm", name: "duplicate", message: "主を複製するとき、この集まりも写しますか？", default: true });

  const field = buildCollectionField({
    name,
    label,
    childSingular: String(childSingular ?? "").trim() || suggested,
    required,
    maxItems: Number(String(maxItems).trim()),
    reorderable,
    duplicate,
  });
  console.log("\nフィールドを追加しました:", field);
  console.log(`  ※ 従属のドメイン（${field.collection.domain}）の domain.json は dc:generate が書き出します\n`);
  return field;
}
