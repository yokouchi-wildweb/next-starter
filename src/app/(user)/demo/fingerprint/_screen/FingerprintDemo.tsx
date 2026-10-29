"use client";

// ブラウザフィンガープリント基盤のデモ。
// - デバイス信号の収集 (collectFingerprintPayload)
// - フォーム操作の行動計測 (useBehavioralCapture)
// - サーバー送信の往復 (reportFingerprint / チャレンジ提出は config 有効時のみ)
// 収集・計測はブラウザ内で完結するため、ログインや機能フラグなしで試せる。

import { useCallback, useState } from "react";

import {
  collectFingerprintPayload,
  hashValue,
  useBehavioralCapture,
  type BehaviorPayload,
  type FingerprintPayload,
} from "@/lib/fingerprint";
import { reportFingerprint } from "@/features/core/deviceFingerprint/services/client/fingerprintClient";
import { Button } from "@/components/Form/Button/Button";
import { Manual } from "@/components/Form/Input";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { Para, SecTitle } from "@/components/TextBlocks";

const preClass =
  "max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-muted/40 p-4 text-xs leading-relaxed";

function JsonBlock({ value }: { value: unknown }) {
  return <pre className={preClass}>{JSON.stringify(value, null, 2)}</pre>;
}

/** 成分別ハッシュの一致状況をラベル表示するための整形 */
function summarizeComponents(payload: FingerprintPayload): string {
  const entries = Object.entries(payload.componentHashes);
  const present = entries.filter(([, v]) => v != null).map(([k]) => k);
  const missing = entries.filter(([, v]) => v == null).map(([k]) => k);
  return [
    `取得できた成分: ${present.length ? present.join(", ") : "なし"}`,
    missing.length ? `取得できなかった成分: ${missing.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function FingerprintDemo() {
  return (
    <Stack space={10}>
      <DeviceSignalsSection />
      <BehaviorSection />
    </Stack>
  );
}

// ============================================================
// 1. デバイス信号の収集
// ============================================================
function DeviceSignalsSection() {
  const [payload, setPayload] = useState<FingerprintPayload | null>(null);
  const [compositeHash, setCompositeHash] = useState<string | null>(null);
  const [isCollecting, setIsCollecting] = useState(false);

  // サーバー送信の結果表示 (config 無効時は 404 を素直に表示する)
  const [sendState, setSendState] = useState<
    { status: "idle" } | { status: "sending" } | { status: "ok" } | { status: "error"; message: string }
  >({ status: "idle" });

  const collect = useCallback(async () => {
    setIsCollecting(true);
    setSendState({ status: "idle" });
    try {
      const result = await collectFingerprintPayload();
      // 合成ハッシュはサーバーと同じ式 (sha256(stableStringify(componentHashes))) で
      // クライアント側でも算出できる。表示値はサーバー保存値と一致する。
      const composite = await hashValue(result.componentHashes);
      setPayload(result);
      setCompositeHash(composite);
    } finally {
      setIsCollecting(false);
    }
  }, []);

  const send = useCallback(async () => {
    if (!payload) return;
    setSendState({ status: "sending" });
    try {
      await reportFingerprint(payload);
      setSendState({ status: "ok" });
    } catch (error) {
      setSendState({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [payload]);

  return (
    <Section>
      <Stack space={4}>
        <SecTitle size="lg">1. デバイス信号の収集</SecTitle>
        <Para size="sm" tone="muted">
          Canvas / WebGL / Audio / フォント / 画面 / タイムゾーン / ハードウェアなどの信号を
          収集し、成分別ハッシュと合成ハッシュを算出します。取得できない成分は null になり、
          全体は失敗しません（ブラウザやプライバシー設定により結果は変わります）。
        </Para>

        <Flex className="flex-wrap gap-3">
          <Button type="button" onClick={collect} disabled={isCollecting}>
            {isCollecting ? "収集中…" : "信号を収集する"}
          </Button>
          <Button type="button" variant="outline" onClick={send} disabled={!payload || sendState.status === "sending"}>
            {sendState.status === "sending" ? "送信中…" : "サーバーへ送信する（任意）"}
          </Button>
        </Flex>

        {sendState.status === "ok" && (
          <Para size="sm" className="text-emerald-600">
            送信成功: device_fingerprints に upsert されました（要ログイン + collection.enabled）。
          </Para>
        )}
        {sendState.status === "error" && (
          <Para size="sm" className="text-destructive">
            送信できませんでした（{sendState.message}）。 サーバー送信には認証と
            FINGERPRINT_CONFIG.collection.enabled が必要です。収集・計測自体はこの画面で完結します。
          </Para>
        )}

        {payload && compositeHash && (
          <Stack space={3}>
            <Block padding="sm" className="rounded-md border border-border bg-card">
              <Stack space={1}>
                <Para size="sm" weight="medium">
                  合成ハッシュ（composite_hash）
                </Para>
                <Para size="sm" tone="muted" className="break-all font-mono">
                  {compositeHash}
                </Para>
                <Para size="sm" tone="muted" className="whitespace-pre-wrap">
                  {summarizeComponents(payload)}
                </Para>
                {payload.webglRenderer && (
                  <Para size="sm" tone="muted">
                    WebGL renderer: {payload.webglRenderer}
                  </Para>
                )}
              </Stack>
            </Block>

            <Para size="sm" weight="medium">
              成分別ハッシュ
            </Para>
            <JsonBlock value={payload.componentHashes} />

            <Para size="sm" weight="medium">
              生信号（rawSignals）
            </Para>
            <JsonBlock value={payload.rawSignals} />
          </Stack>
        )}
      </Stack>
    </Section>
  );
}

// ============================================================
// 2. フォーム操作の行動計測
// ============================================================
function BehaviorSection() {
  const behavior = useBehavioralCapture();
  const [snapshot, setSnapshot] = useState<BehaviorPayload | null>(null);

  // デモ用のフォーム状態（値自体は計測対象外 = payload には入らない）
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const showSnapshot = useCallback(() => {
    setSnapshot(behavior.getPayload());
  }, [behavior]);

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSnapshot(behavior.getPayload());
    },
    [behavior],
  );

  const resetAll = useCallback(() => {
    behavior.reset();
    setSnapshot(null);
    setName("");
    setEmail("");
    setMessage("");
  }, [behavior]);

  return (
    <Section>
      <Stack space={4}>
        <SecTitle size="lg">2. フォーム操作の行動計測</SecTitle>
        <Para size="sm" tone="muted">
          下のフォームに実際に入力してみてください。打鍵のリズム、ペースト、フィールド間の
          移動、マウス / タッチの軌跡などを統計値として採取します。
          <strong>キーの内容・入力値・生の座標列は一切記録されません</strong>
          （打鍵間隔や Backspace 回数などの統計のみ）。「現在の計測値を見る」または「送信」で
          その時点のスナップショットを表示します。
        </Para>

        {/* containerProps を spread した要素の配下が計測対象になる */}
        <form onSubmit={onSubmit} {...behavior.containerProps}>
          <Stack space={4}>
            <Stack space={1}>
              <Para size="sm" weight="medium">
                氏名
              </Para>
              <Manual.Input
                name="name"
                data-behavior-field="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="山田 太郎"
              />
            </Stack>
            <Stack space={1}>
              <Para size="sm" weight="medium">
                メールアドレス
              </Para>
              <Manual.Input
                name="email"
                data-behavior-field="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="taro@example.com"
              />
            </Stack>
            <Stack space={1}>
              <Para size="sm" weight="medium">
                メッセージ（ペーストも試してみてください）
              </Para>
              <Manual.Textarea
                name="message"
                data-behavior-field="message"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="ここに何か入力・貼り付けしてみてください"
              />
            </Stack>

            <Flex className="flex-wrap gap-3">
              <Button type="submit">送信（スナップショット取得）</Button>
              <Button type="button" variant="outline" onClick={showSnapshot}>
                現在の計測値を見る
              </Button>
              <Button type="button" variant="ghost" onClick={resetAll}>
                リセット
              </Button>
            </Flex>
          </Stack>
        </form>

        {snapshot && (
          <Stack space={2}>
            <Para size="sm" weight="medium">
              行動計測 payload（BehaviorPayload）
            </Para>
            <JsonBlock value={snapshot} />
          </Stack>
        )}
      </Stack>
    </Section>
  );
}
