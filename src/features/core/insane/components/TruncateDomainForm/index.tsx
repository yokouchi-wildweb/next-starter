// src/features/core/insane/components/TruncateDomainForm/index.tsx

"use client";

import { useState, type ChangeEvent } from "react";
import { AlertTriangleIcon, TrashIcon, LockIcon, RefreshCwIcon, CloudIcon } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { Flex } from "@/components/Layout";
import { Checkbox } from "@/components/_shadcn/checkbox";
import { Dialog } from "@/components/Overlays/Dialog";
import { Input } from "@/components/Form/Manual/Input";
import { useToast } from "@/lib/toast";
import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { useFetchDomains } from "@/lib/domain/hooks/useFetchDomains";
import { useTruncateDomains } from "@/lib/domain/hooks/useTruncateDomains";

export function TruncateDomainForm() {
  const { showToast } = useToast();
  const { user } = useAuthSession();

  // ドメイン一覧（フック使用）
  const {
    domains,
    isLoading,
    error: loadError,
    refetch,
  } = useFetchDomains();

  // truncate処理（フック使用）
  const { truncate, isProcessing } = useTruncateDomains();

  // 選択状態
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);

  // ダイアログ状態
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const handleToggle = (domainKey: string) => {
    setSelectedDomains((prev) =>
      prev.includes(domainKey)
        ? prev.filter((k) => k !== domainKey)
        : [...prev, domainKey]
    );
  };

  const handleSelectAll = () => {
    if (selectedDomains.length === domains.length) {
      setSelectedDomains([]);
    } else {
      setSelectedDomains(domains.map((d) => d.key));
    }
  };

  const handleTruncate = async () => {
    if (!password) {
      setPasswordError("パスワードを入力してください");
      return;
    }

    setPasswordError("");

    try {
      const response = await truncate({
        domains: selectedDomains,
        password,
      });

      if (!response) return;

      // 結果を確認
      const failedResults = response.results.filter((r) => !r.success);

      if (failedResults.length === 0) {
        showToast(response.message, "success");
      } else {
        showToast(
          `${response.message} 失敗: ${failedResults.map((r) => r.domain).join(", ")}`,
          "warning"
        );
      }

      setSelectedDomains([]);
      setIsConfirmOpen(false);
      setPassword("");

      // ドメイン一覧を再取得（レコード数更新）
      await refetch();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "削除に失敗しました";

      // パスワードエラーの場合
      if (message.includes("パスワード")) {
        setPasswordError(message);
      } else {
        showToast(message, "error");
      }
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setPassword("");
      setPasswordError("");
    }
    setIsConfirmOpen(open);
  };

  const selectedCoreDomains = selectedDomains.filter((key) =>
    domains.find((d) => d.key === key)?.isCore
  );

  // ローディング中
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCwIcon className="size-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">読み込み中...</span>
      </div>
    );
  }

  // エラー時
  if (loadError) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">{loadError.message}</p>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCwIcon className="size-4 mr-2" />
          再読み込み
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 選択ヘッダー */}
      <Flex justify="between" align="center">
        <Flex gap="sm">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
          >
            {selectedDomains.length === domains.length ? "全解除" : "全選択"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCwIcon className="size-4" />
          </Button>
        </Flex>
        <span className="text-sm text-muted-foreground">
          {selectedDomains.length} / {domains.length} 選択中
        </span>
      </Flex>

      {/* ドメイン一覧 */}
      <div className="grid gap-2">
        {domains.map((domain) => (
          <label
            key={domain.key}
            className={`
              flex items-center gap-3 p-3 rounded-lg border cursor-pointer
              transition-colors hover:bg-muted/50
              ${selectedDomains.includes(domain.key) ? "border-primary bg-primary/5" : "border-border"}
              ${domain.isCore ? "border-l-4 border-l-destructive" : ""}
            `}
          >
            <Checkbox
              checked={selectedDomains.includes(domain.key)}
              onCheckedChange={() => handleToggle(domain.key)}
            />
            <div className="flex-1">
              <span className="font-medium">{domain.label}</span>
              <span className="text-muted-foreground ml-2 text-sm">
                ({domain.key})
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {domain.recordCount.toLocaleString()} 件
            </span>
            {domain.isCore && (
              <span className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangleIcon className="size-3" />
                コア
              </span>
            )}
          </label>
        ))}
      </div>

      {/* 警告メッセージ */}
      {selectedCoreDomains.length > 0 && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <Flex align="start" gap="sm">
            <AlertTriangleIcon className="size-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-destructive">
                コアドメインが選択されています
              </p>
              <p className="text-muted-foreground mt-1">
                {selectedCoreDomains.join(", ")}
                を削除すると、システムの動作に影響が出る可能性があります。
              </p>
            </div>
          </Flex>
        </div>
      )}

      {/* 削除ボタン */}
      <Flex justify="end">
        <Button
          type="button"
          variant="destructive"
          disabled={selectedDomains.length === 0}
          onClick={() => setIsConfirmOpen(true)}
        >
          <TrashIcon className="size-4 mr-2" />
          選択したドメインを削除
        </Button>
      </Flex>

      {/* 確認ダイアログ */}
      <Dialog
        open={isConfirmOpen}
        onOpenChange={handleDialogClose}
        title={
          <span className="flex items-center gap-2">
            <AlertTriangleIcon className="size-5 text-destructive" />
            本当に削除しますか？
          </span>
        }
        confirmLabel={isProcessing ? "削除中..." : "削除実行"}
        cancelLabel="キャンセル"
        onConfirm={handleTruncate}
        confirmDisabled={!password || isProcessing}
        confirmVariant="destructive"
        layer="alert"
      >
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            以下のドメインの全データが物理削除されます：
          </p>
          <ul className="list-disc list-inside text-sm space-y-1 max-h-40 overflow-y-auto">
            {selectedDomains.map((key) => {
              const domain = domains.find((d) => d.key === key);
              return (
                <li key={key}>
                  {domain?.label} ({key}) - {domain?.recordCount.toLocaleString()} 件
                  {domain?.isCore && (
                    <span className="text-destructive ml-1">※コア</span>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="p-3 rounded-md bg-muted/50 border border-border">
            <div className="flex items-start gap-2 text-sm">
              <CloudIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-muted-foreground">
                ストレージ上のファイル（画像等）はこの操作では削除されません。
                必要に応じてストレージコンソールから手動で削除してください。
              </p>
            </div>
          </div>
          <div className="pt-2 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <LockIcon className="size-4 text-muted-foreground" />
              <span>
                確認のため
                <span className="font-medium text-foreground mx-1">
                  {user?.displayName ?? "ユーザー"}
                </span>
                のパスワードを入力してください
              </span>
            </div>
            <Input
              type="password"
              value={password}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setPassword(e.target.value);
                setPasswordError("");
              }}
              placeholder="パスワード"
              className="max-w-xs"
              autoComplete="current-password"
            />
            {passwordError && (
              <p className="text-sm text-destructive">{passwordError}</p>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
