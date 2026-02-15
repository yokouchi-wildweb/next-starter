import generateHookFile from "./utils/generateHookFile.mjs";

// useUpsert__Domain__.ts（upsertフック）を生成する
export default function generate(tokens) {
  generateHookFile("useUpsert__Domain__.ts", tokens);
}
