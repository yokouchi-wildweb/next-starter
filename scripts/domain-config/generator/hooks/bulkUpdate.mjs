import generateHookFile from "./utils/generateHookFile.mjs";

// useBulkUpdate__Domain__.ts（一括更新フック）を生成する
export default function generate(tokens) {
  generateHookFile("useBulkUpdate__Domain__.ts", tokens);
}
