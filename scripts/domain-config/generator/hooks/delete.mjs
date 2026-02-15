import generateHookFile from "./utils/generateHookFile.mjs";

// useDelete__Domain__.ts（削除フック）を生成する
export default function generate(tokens) {
  generateHookFile("useDelete__Domain__.ts", tokens);
}
