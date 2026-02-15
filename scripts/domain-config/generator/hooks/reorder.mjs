import generateHookFile from "./utils/generateHookFile.mjs";

// useReorder__Domain__.ts（並び替えフック）を生成する
export default function generate(tokens) {
  generateHookFile("useReorder__Domain__.ts", tokens);
}
