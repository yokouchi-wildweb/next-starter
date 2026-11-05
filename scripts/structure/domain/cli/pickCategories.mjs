// -i（対話）の「生成カテゴリを手動で選ぶ」チェックボックス。選んだ結果は domain.json に保存しない
import { GENERATE_CATEGORIES } from "../spec/categories.mjs";
import { prompt } from "./prompts.mjs";

const LABELS = {
  entities: "エンティティ",
  components: "コンポーネント",
  hooks: "フック",
  clientServices: "クライアントサービス",
  serverServices: "サーバーサービス",
  fieldConstants: "Enum 定数/型",
  adminRoutes: "管理画面ルート",
  registry: "ドメインレジストリに追加",
  presenters: "プレゼンター",
};

/** @returns {Promise<Record<string, boolean>>} カテゴリ → 生成するか */
export async function pickCategories() {
  const { files } = await prompt({
    type: "checkbox",
    name: "files",
    message: "生成するファイルを選択:",
    default: GENERATE_CATEGORIES,
    choices: GENERATE_CATEGORIES.map((value) => ({ name: LABELS[value], value })),
  });
  return Object.fromEntries(GENERATE_CATEGORIES.map((category) => [category, files.includes(category)]));
}
