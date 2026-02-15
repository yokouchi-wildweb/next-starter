import generateHookFile from "./utils/generateHookFile.mjs";

// useCreate__Domain__.ts（作成フック）を生成する
export default function generate(tokens) {
  generateHookFile("useCreate__Domain__.ts", tokens);
}
