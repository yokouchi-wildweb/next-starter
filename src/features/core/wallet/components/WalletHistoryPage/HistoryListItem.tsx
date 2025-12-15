// src/features/core/wallet/components/WalletHistoryPage/HistoryListItem.tsx

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Span } from "@/components/TextBlocks";
import type { WalletHistoryBatchSummarySerialized } from "@/features/core/walletHistory/types/batch";
import type { WalletType } from "@/features/core/wallet/currencyConfig";
import { CurrencyDisplay } from "../common/CurrencyDisplay";
import { formatDate } from "@/features/core/wallet/utils/formatters";
import { extractReasons } from "@/features/core/wallet/utils/historyDisplay";

type HistoryListItemProps = {
  history: WalletHistoryBatchSummarySerialized;
  walletType: WalletType;
};

/**
 * 操作種別からユーザー向けラベルを取得
 */
function getSourceLabel(sourceTypes: string[]): string {
  if (sourceTypes.includes("user_action")) {
    return "購入・利用";
  }
  if (sourceTypes.includes("admin_action")) {
    return "運営による調整";
  }
  if (sourceTypes.includes("system")) {
    return "システム処理";
  }
  return "その他";
}

export function HistoryListItem({ history, walletType }: HistoryListItemProps) {
  const isIncrease = history.totalDelta > 0;
  const isDecrease = history.totalDelta < 0;
  const isSet = history.changeMethods.includes("SET");

  // 理由を取得（最初の1つのみ表示）
  const reasons = extractReasons(history);
  const reasonText = reasons.length > 0 ? reasons[0] : getSourceLabel(history.sourceTypes);

  return (
    <Block className="border-b border-gray-100 py-4 last:border-b-0">
      <Flex justify="between" align="start" gap="md">
        {/* 左側: 日時と理由 */}
        <Flex direction="column" gap="xs" className="flex-1 min-w-0">
          <Span size="xs" tone="muted">
            {formatDate(history.completedAt)}
          </Span>
          <Span size="sm" className="truncate">
            {reasonText}
          </Span>
        </Flex>

        {/* 右側: 金額変動 */}
        <Flex direction="column" align="end" gap="xs" className="flex-shrink-0">
          {isSet ? (
            <Span size="sm" className="text-blue-600" weight="bold">
              残高設定
            </Span>
          ) : (
            <Flex align="center" gap="xs">
              <Span
                size="lg"
                weight="bold"
                className={isIncrease ? "text-emerald-600" : isDecrease ? "text-red-600" : ""}
              >
                {isIncrease ? "+" : ""}
              </Span>
              <CurrencyDisplay
                walletType={walletType}
                amount={Math.abs(history.totalDelta)}
                size="md"
                showUnit
                bold
              />
            </Flex>
          )}
          <Span size="xs" tone="muted">
            残高: {history.balanceAfter.toLocaleString()}
          </Span>
        </Flex>
      </Flex>
    </Block>
  );
}
