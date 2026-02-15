import generateHookFile from "./utils/generateHookFile.mjs";

// use__Domain__List.ts（一覧取得フック）を生成する
export default function generate(tokens) {
  generateHookFile("use__Domain__List.ts", tokens);
}
