import generateHookFile from "./utils/generateHookFile.mjs";

// useSearchForSorting__Domain__.ts（ソート用検索フック）を生成する
export default function generate(tokens) {
  generateHookFile("useSearchForSorting__Domain__.ts", tokens);
}
