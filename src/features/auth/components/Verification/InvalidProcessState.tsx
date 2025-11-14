import { Para } from "@/components/TextBlocks";

// 手続きが無効になった際の案内メッセージを表示
export function InvalidProcessState() {
  return <Para>認証手続きが失敗しました。認証メールの再送付をお試しください。</Para>;
}
