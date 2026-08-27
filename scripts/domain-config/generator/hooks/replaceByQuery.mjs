import generateHookFile from "./utils/generateHookFile.mjs";

// useReplaceByQuery__Domain__.ts（条件指定一括置換フック）を生成する
export default function generate(tokens) {
  generateHookFile("useReplaceByQuery__Domain__.ts", tokens);
}
