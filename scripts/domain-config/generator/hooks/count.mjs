import generateHookFile from "./utils/generateHookFile.mjs";

// useCount__Domain__.ts（件数取得フック）を生成する
export default function generate(tokens) {
  generateHookFile("useCount__Domain__.ts", tokens);
}
