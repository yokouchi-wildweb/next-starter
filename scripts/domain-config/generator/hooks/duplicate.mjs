import generateHookFile from "./utils/generateHookFile.mjs";

// useDuplicate__Domain__.ts（複製フック）を生成する
export default function generate(tokens) {
  generateHookFile("useDuplicate__Domain__.ts", tokens);
}
