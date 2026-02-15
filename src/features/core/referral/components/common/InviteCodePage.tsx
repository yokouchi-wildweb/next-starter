// 招待コード取得ページ

"use client";

import { useCallback, useState } from "react";
import { CopyIcon, CheckIcon, UsersIcon } from "lucide-react";

import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Button } from "@/components/Form/Button/Button";
import { Para } from "@/components/TextBlocks";
import { BaseSkeleton } from "@/components/Skeleton/BaseSkeleton";
import { AccountPageHeader } from "@/features/core/user/components/UserMyPage/AccountPageHeader";
import { useMyInviteCode } from "@/features/core/coupon/hooks/useMyInviteCode";
import { useIssueMyInviteCode } from "@/features/core/coupon/hooks/useIssueMyInviteCode";
import { useMyReferrals } from "@/features/core/referral/hooks/useMyReferrals";
import { InviteBenefitsSection } from "./InviteBenefitsSection";

export function InviteCodePage() {
  const { inviteCode, isLoading: isLoadingCode } = useMyInviteCode();
  const { issue, isLoading: isIssuing } = useIssueMyInviteCode();
  const { count, isLoading: isLoadingReferrals } = useMyReferrals();
  const [copied, setCopied] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);

  const handleIssue = useCallback(async () => {
    setIssueError(null);
    try {
      await issue();
    } catch {
      setIssueError("招待コードの発行に失敗しました。");
    }
  }, [issue]);

  const handleCopy = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // クリップボードAPIが使えない場合は何もしない
    }
  }, []);

  return (
    <Section>
      <Stack space={4}>
        <AccountPageHeader title="招待コード" backHref="/mypage" />

        <Block appearance="outlined" className="divide-y divide-border">
          {/* 招待コード表示エリア */}
          <div className="p-4 sm:p-6">
            {isLoadingCode ? (
              <Flex direction="column" align="center" gap="sm">
                <BaseSkeleton className="h-5 w-40" />
                <BaseSkeleton className="h-10 w-60" />
              </Flex>
            ) : inviteCode ? (
              <Flex direction="column" align="center" gap="md">
                <Para size="sm" tone="muted">あなたの招待コード</Para>
                <button
                  type="button"
                  onClick={() => handleCopy(inviteCode.code)}
                  className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-6 py-3 font-mono text-lg font-bold tracking-widest transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {inviteCode.code}
                  {copied ? (
                    <CheckIcon className="h-4 w-4 text-green-600" />
                  ) : (
                    <CopyIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                <Para size="xs" tone="muted">
                  {copied ? "コピーしました" : "タップしてコピー"}
                </Para>
              </Flex>
            ) : (
              <Flex direction="column" align="center" gap="md">
                <Para size="sm" tone="muted">
                  招待コードを発行してお友だちをサービスに招待しましょう。
                </Para>
                <Button onClick={handleIssue} disabled={isIssuing}>
                  {isIssuing ? "発行中..." : "招待コードを発行"}
                </Button>
                {issueError && (
                  <Para size="sm" tone="error">{issueError}</Para>
                )}
              </Flex>
            )}
          </div>

          {/* 招待特典 */}
          <div className="p-4 sm:p-6">
            <InviteBenefitsSection />
          </div>

          {/* 招待実績 */}
          <div className="p-4 sm:p-6">
            <Flex align="center" gap="sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <UsersIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <Para size="sm" tone="muted" className="!mb-0">招待実績</Para>
                {isLoadingReferrals ? (
                  <BaseSkeleton className="h-5 w-24" />
                ) : (
                  <p className="text-sm font-medium text-foreground">
                    {count ?? 0}人を招待しました
                  </p>
                )}
              </div>
            </Flex>
          </div>
        </Block>
      </Stack>
    </Section>
  );
}
