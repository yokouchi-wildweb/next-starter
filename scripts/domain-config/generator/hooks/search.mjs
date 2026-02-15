import generateHookFile from "./utils/generateHookFile.mjs";

// useSearch__Domain__.ts（検索フック）を生成する
export default function generate(tokens) {
  generateHookFile("useSearch__Domain__.ts", tokens);
}
