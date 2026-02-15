import generateHookFile from "./utils/generateHookFile.mjs";

// useRestore__Domain__.ts（復元フック）を生成する
export default function generate(tokens) {
  generateHookFile("useRestore__Domain__.ts", tokens);
}
