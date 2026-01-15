// src/app/admin/insane/truncate/TruncateDomainForm.tsx

"use client";

import { useState, type ChangeEvent } from "react";
import { AlertTriangleIcon, TrashIcon, LockIcon } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { Flex } from "@/components/Layout";
import { Checkbox } from "@/components/_shadcn/checkbox";
import { Dialog } from "@/components/Overlays/Dialog";
import { Input } from "@/components/Form/Manual/Input";

// TODO: APIから取得するように変更
const DUMMY_DOMAINS = [
  { key: "user", label: "ユーザー", isCore: true },
  { key: "setting", label: "設定", isCore: true },
  { key: "wallet", label: "ウォレット", isCore: true },
  { key: "walletHistory", label: "ウォレット履歴", isCore: true },
  { key: "purchaseRequest", label: "購入リクエスト", isCore: true },
  { key: "sample", label: "サンプル", isCore: false },
  { key: "sampleCategory", label: "サンプルカテゴリ", isCore: false },
  { key: "sampleTag", label: "サンプルタグ", isCore: false },
];

export function TruncateDomainForm() {
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleToggle = (domainKey: string) => {
    setSelectedDomains((prev) =>
      prev.includes(domainKey)
        ? prev.filter((k) => k !== domainKey)
        : [...prev, domainKey]
    );
  };

  const handleSelectAll = () => {
    if (selectedDomains.length === DUMMY_DOMAINS.length) {
      setSelectedDomains([]);
    } else {
      setSelectedDomains(DUMMY_DOMAINS.map((d) => d.key));
    }
  };

  const handleTruncate = async () => {
    if (!password) {
      setPasswordError("パスワードを入力してください");
      return;
    }

    setIsProcessing(true);
    setPasswordError("");

    try {
      // TODO: パスワード検証APIを呼び出し
      // const isValid = await verifyPasswordApi(password);
      // if (!isValid) {
      //   setPasswordError("パスワードが正しくありません");
      //   setIsProcessing(false);
      //   return;
      // }

      // ダミー検証（password === "admin" で通過）
      if (password !== "admin") {
        setPasswordError("パスワードが正しくありません");
        setIsProcessing(false);
        return;
      }

      // TODO: 実際のtruncate API呼び出し
      console.log("Truncating domains:", selectedDomains);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // ダミー遅延
      alert(`${selectedDomains.length}件のドメインを削除しました（ダミー）`);
      setSelectedDomains([]);
      setIsConfirmOpen(false);
      setPassword("");
    } catch (error) {
      console.error("Truncate failed:", error);
      alert("削除に失敗しました");
    } finally {
      setIsProcessing(false);
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
    DUMMY_DOMAINS.find((d) => d.key === key)?.isCore
  );

  return (
    <div className="space-y-6">
      {/* 選択ヘッダー */}
      <Flex justify="between" align="center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSelectAll}
        >
          {selectedDomains.length === DUMMY_DOMAINS.length
            ? "全解除"
            : "全選択"}
        </Button>
        <span className="text-sm text-muted-foreground">
          {selectedDomains.length} / {DUMMY_DOMAINS.length} 選択中
        </span>
      </Flex>

      {/* ドメイン一覧 */}
      <div className="grid gap-2">
        {DUMMY_DOMAINS.map((domain) => (
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
              const domain = DUMMY_DOMAINS.find((d) => d.key === key);
              return (
                <li key={key}>
                  {domain?.label} ({key})
                  {domain?.isCore && (
                    <span className="text-destructive ml-1">※コア</span>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="pt-2 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <LockIcon className="size-4 text-muted-foreground" />
              <span>確認のためパスワードを入力してください</span>
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
