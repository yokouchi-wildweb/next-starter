import generateHookFile from "./utils/generateHookFile.mjs";

// use__Domain__.ts（単一取得フック）を生成する
export default function generate(tokens) {
  generateHookFile("use__Domain__.ts", tokens);
}
