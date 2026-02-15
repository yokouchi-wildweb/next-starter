import generateHookFile from "./utils/generateHookFile.mjs";

// useBulkDeleteByIds__Domain__.ts（ID指定一括削除フック）を生成する
export default function generate(tokens) {
  generateHookFile("useBulkDeleteByIds__Domain__.ts", tokens);
}
