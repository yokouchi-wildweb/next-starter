// 管理画面 _screen/ テンプレート(Screen と loader.ts)の、関連選択肢の先読み(SSR → SWR fallback)に関するトークン

import { importRootFor } from "../../domain/context.mjs";
import { getStaticRelations } from "../../../../../src/lib/domain/node.mjs";

/**
 * 関連ドメイン定義から _screen/ テンプレートのトークン文字列を生成
 *  - imports: Screen の SWRConfig の import
 *  - createRenderParams: 追加画面の createScreen の render の引数(関連があれば loader の relationFallback を受ける)
 *  - editRenderParams: 編集画面の render の引数(対象レコード + 関連があれば relationFallback)
 *  - swrStart / swrEnd: SWRConfig の fallback で画面を包む
 *  - loaderImport: loader.ts の登録の entity.json の import
 *  - createRelationsArg / editRelationsArg: loader.ts の共通部品の組に登録の entity.json を渡す引数
 * 先読みするのは「選択肢を全件取得する関連」(getStaticRelations: async / custom / 逆側を除く)が 1 つ以上あるときだけ。
 * どの関連を読むかは取得本体が登録の entity.json から同じ helper で判定し、関連先の access と service は wiring が serviceRegistry から
 * 解決するので、生成物は関連先の service を import しない。行単位のトークンは末尾に改行を含める
 */
export function buildRelationTokens(relations, ctx) {
  const { camel } = ctx;
  // 先読みする関連が無い場合は access の判定(追加)と編集レコードの取得だけ
  if (getStaticRelations({ relations }).length === 0) {
    return {
      imports: "",
      createRenderParams: "",
      editRenderParams: `{ record: ${camel}, redirectPath }`,
      swrStart: "",
      swrEnd: "",
      loaderImport: "",
      createRelationsArg: "",
      editRelationsArg: "",
    };
  }

  return {
    imports: 'import { SWRConfig } from "swr";\n',
    createRenderParams: "{ relationFallback }",
    editRenderParams: `{ record: ${camel}, redirectPath, relationFallback }`,
    swrStart: "  <SWRConfig value={{ fallback: relationFallback }}>\n",
    swrEnd: "  </SWRConfig>\n",
    loaderImport: `import domainConfig from "${importRootFor(ctx)}/entities/${camel}/entity.json";\n`,
    createRelationsArg: ", { relations: domainConfig }",
    editRelationsArg: ", relations: domainConfig",
  };
}

