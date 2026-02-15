import generateHookFile from "./utils/generateHookFile.mjs";

// useBulkUpsert__Domain__.ts（一括upsertフック）を生成する
export default function generate(tokens) {
  generateHookFile("useBulkUpsert__Domain__.ts", tokens);
}
