import generateHookFile from "./utils/generateHookFile.mjs";

// useBulkDeleteByQuery__Domain__.ts（クエリ指定一括削除フック）を生成する
export default function generate(tokens) {
  generateHookFile("useBulkDeleteByQuery__Domain__.ts", tokens);
}
