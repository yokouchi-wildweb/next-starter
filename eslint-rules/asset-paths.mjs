// eslint-rules/asset-paths.mjs
//
// 資産(public/ の画像・動画・音)のパスを文字で直に書かない(当議会 D133)。パスは src/utils/assets.ts の
// assetPath・iconPath・imgPath・videoPath・sePath・logoPath で組む(置き場が変わっても 1 か所で直る)。
//
// 止める文字(文字列リテラル・式を持たないテンプレート): "/assets/…" で始まる物と、"/" で始まり画像・動画・音の拡張子で終わる物
// (例 "/assets/imgs/a.png"・"/og-default.png")。"//" で始まる物(プロトコル相対の URL)・"http(s)://…"・"storage://…" は対象外。
// 対象外(eslint.config.mjs の ignores): 組み立て役の src/utils/assets.ts とテスト。
// 組み立て役を呼べない場所の既定値(lib は utils を読まない)は、理由つきの行ごとの eslint-disable で明示する。
// 強さはリポジトリ単位: 上流リポ(目録の先頭の節)= error、fork = warn。

const ASSET_EXT = /\.(png|jpe?g|gif|svg|webp|avif|ico|mp4|webm|mov|mp3|wav|ogg|m4a)$/i;

/** 資産のパスの直書きに当たる文字か */
export function isLiteralAssetPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return false;
  if (value.startsWith("/assets/")) return true;
  return !/\s/.test(value) && ASSET_EXT.test(value);
}

const rule = {
  meta: {
    type: "problem",
    docs: { description: "資産のパスを文字で直に書かず src/utils/assets.ts の関数で組む" },
    messages: {
      literal:
        '"{{value}}" は資産のパスの直書きです。src/utils/assets.ts の assetPath・iconPath・imgPath・videoPath・sePath・logoPath で組みます(組み立て役を読めない lib の既定値などは理由つきの行ごとの eslint-disable。詳細: eslint-rules/asset-paths.mjs)',
    },
    schema: [],
  },
  create(context) {
    const check = (node, value) => {
      if (isLiteralAssetPath(value)) context.report({ node, messageId: "literal", data: { value } });
    };
    return {
      Literal(node) {
        check(node, node.value);
      },
      TemplateLiteral(node) {
        if (node.expressions.length === 0) check(node, node.quasis[0]?.value.cooked);
      },
    };
  },
};

const plugin = {
  meta: { name: "eslint-plugin-local-asset-paths", version: "1.0.0" },
  rules: { "no-literal-asset-path": rule },
};

export default plugin;
