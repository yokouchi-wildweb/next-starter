import generateHookFile from "./utils/generateHookFile.mjs";

// useHardDelete__Domain__.ts（物理削除フック）を生成する
export default function generate(tokens) {
  generateHookFile("useHardDelete__Domain__.ts", tokens);
}
