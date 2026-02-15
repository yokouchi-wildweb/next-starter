import generateHookFile from "./utils/generateHookFile.mjs";

// useUpdate__Domain__.ts（更新フック）を生成する
export default function generate(tokens) {
  generateHookFile("useUpdate__Domain__.ts", tokens);
}
