// 管理画面 _screen/ テンプレートの、関連選択肢の先読み（SSR → SWR fallback）に関するトークン

import { getStaticRelations } from "../../../../src/lib/domain/relations/relationOptions.mjs";

const ADMIN_LOADERS = "@/features/core/admin/services/server/loaders";

/**
 * 関連ドメイン定義から _screen/ テンプレートのトークン文字列を生成
 *  - imports: SWRConfig / loadAdminRelationOptions / domain.json の import
 *  - async: 追加画面を async にするか（関連の取得があるとき）
 *  - relationFetchNew: 追加画面での関連選択肢の先読み（SWR fallback 用）
 *  - editFetch: 編集画面での対象レコード + 関連選択肢の先読み（loadAdminEditScreen + loadAdminRelationOptions）
 *  - swrStart / swrEnd: SWRConfig の fallback で画面を包む
 * 先読みするのは「選択肢を全件取得する関連」（getStaticRelations: async / custom / 逆側を除く）が 1 つ以上あるときだけ。
 * どの関連を読むかは loader が domain.json から同じ helper で判定し、service は serviceRegistry から解決するので、
 * 生成物は関連先の service を import しない。各トークンは行単位（末尾に改行を含める）
 */
export function buildRelationTokens(relations, { camel, kebabPlural }) {
  const editCall = `loadAdminEditScreen(${camel}Service, props, "/admin/${kebabPlural}")`;

  // 先読みする関連が無い場合は編集レコードの取得だけ
  if (getStaticRelations({ relations }).length === 0) {
    return {
      imports: "",
      async: "",
      relationFetchNew: "",
      editFetch: `  const { record: ${camel}, redirectPath } = await ${editCall};\n`,
      swrStart: "",
      swrEnd: "",
    };
  }

  const imports =
    [
      'import { SWRConfig } from "swr";',
      `import { loadAdminRelationOptions } from "${ADMIN_LOADERS}/adminRelationOptions";`,
      `import domainConfig from "@/features/${camel}/domain.json";`,
    ].join("\n") + "\n";
  const relationCall = "loadAdminRelationOptions(domainConfig)";
  return {
    imports,
    async: "async ",
    relationFetchNew: `  const relationFallback = await ${relationCall};\n`,
    editFetch:
      `  const [{ record: ${camel}, redirectPath }, relationFallback] = await Promise.all([\n` +
      `    ${editCall},\n` +
      `    ${relationCall},\n` +
      `  ]);\n`,
    swrStart: "  <SWRConfig value={{ fallback: relationFallback }}>\n",
    swrEnd: "  </SWRConfig>\n",
  };
}
