// src/app/(user)/demo/seamless-video/_components/SeamlessVideoDemo.tsx

"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import {
  getMediaSourceCtor,
  isManagedMediaSource,
  isMseSupported,
  useSeamlessVideo,
  validateFragments,
  type FragmentInfo,
  type ValidationReport,
} from "@/lib/seamlessVideo";
import { SortableList, type ReorderResult } from "@/lib/sortableList";
import { Button } from "@/components/Form/Button";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para, SecTitle } from "@/components/TextBlocks";

type FragmentItem = {
  id: string;
  name: string;
  file: File;
  info: FragmentInfo | null;
  issues: string[];
  warnings: string[];
};

/** フラグメント単位の状態(致命的問題 > 警告 > OK)。 */
function itemStatus(item: FragmentItem): "ok" | "warning" | "ng" {
  if (!item.info || item.issues.length > 0) return "ng";
  if (item.warnings.length > 0) return "warning";
  return "ok";
}

const STATUS_STYLE: Record<"ok" | "warning" | "ng", { label: string; className: string }> = {
  ok: { label: "OK", className: "bg-success/15 text-success" },
  warning: { label: "警告", className: "bg-warning/15 text-warning" },
  ng: { label: "NG", className: "bg-destructive/15 text-destructive" },
};

// 環境サポート状況は不変なので useSyncExternalStore で読む(SSR スナップショットは非対応扱い)。
type EnvSupport = { mse: boolean; managed: boolean };
const SERVER_ENV: EnvSupport = { mse: false, managed: false };
let clientEnvCache: EnvSupport | null = null;
const subscribeEnv = () => () => {};
const getClientEnv = (): EnvSupport => {
  if (!clientEnvCache) {
    clientEnvCache = { mse: isMseSupported(), managed: isManagedMediaSource(getMediaSourceCtor()) };
  }
  return clientEnvCache;
};
const getServerEnv = (): EnvSupport => SERVER_ENV;

export function SeamlessVideoDemo() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<FragmentItem[]>([]);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [duration, setDuration] = useState<number | null>(null);
  // 方式A確認用: muxed(音声入り)ファイルの音をそのまま鳴らすか(既定はミュート=映像のみ)
  const [playMuxedAudio, setPlayMuxedAudio] = useState(false);

  const { videoRef, load, status, error, progress } = useSeamlessVideo({
    mimeType: report?.mimeType ?? undefined,
    onLog: (message) => setLogs((prev) => [...prev, message]),
  });

  // 環境情報(SSR では非対応扱い、クライアントで確定)
  const env = useSyncExternalStore(subscribeEnv, getClientEnv, getServerEnv);

  const handleSelectFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setIsValidating(true);
    setLogs([]);
    setDuration(null);

    const rep = await validateFragments(files.map((f) => ({ name: f.name, data: f })));
    setReport(rep);
    setItems(
      files.map((file, i) => ({
        id: `${file.name}-${i}-${file.size}`,
        name: file.name,
        file,
        info: rep.fragments[i]?.info ?? null,
        issues: rep.fragments[i]?.issues ?? [],
        warnings: rep.fragments[i]?.warnings ?? [],
      })),
    );
    setIsValidating(false);
  };

  const handleReorder = (result: ReorderResult) => {
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(result.oldIndex, 1);
      next.splice(result.newIndex, 0, moved);
      return next;
    });
  };

  const sources = useMemo(() => items.map((it) => it.file), [items]);

  const handlePlay = async () => {
    setLogs([]);
    setDuration(null);
    await load(sources);
  };

  // 連結完了後に duration を反映
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onMeta = () => setDuration(Number.isFinite(video.duration) ? video.duration : null);
    video.addEventListener("durationchange", onMeta);
    return () => video.removeEventListener("durationchange", onMeta);
  }, [videoRef]);

  // muxed 音声トグルを video 要素へ反映(React の muted 属性は不安定なため ref 経由で制御)
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = !playMuxedAudio;
  }, [playMuxedAudio, videoRef, status]);

  return (
    <Stack space={6}>
      {/* 環境サポート */}
      <Block className="rounded-lg border bg-muted/40 p-4">
        <Stack space={2}>
          <SecTitle size="sm">この環境のサポート状況</SecTitle>
          <Para size="sm" tone="muted">
            MSE: {env.mse ? "対応" : "非対応"}
            {" / "}
            実装: {env.managed ? "ManagedMediaSource(iPhone 系)" : env.mse ? "MediaSource" : "なし"}
          </Para>
          <Para size="xs" tone="muted">
            対応環境: PC のモダンブラウザ / iPhone Safari は <strong>iOS 17.1+</strong>(ManagedMediaSource)。
            これ未満の iOS では MSE 非対応のため連結再生できません。
          </Para>
          {!env.mse && (
            <Para size="sm" className="text-destructive">
              この環境は MSE 非対応のため連結再生できません(iPhone Safari は iOS 17.1+ が必要)。
            </Para>
          )}
        </Stack>
      </Block>

      {/* ファイル選択 */}
      <Block className="rounded-lg border p-4">
        <Stack space={3}>
          <SecTitle size="sm">1. fmp4 フラグメントを選択</SecTitle>
          <Para size="sm" tone="muted">
            統一プロファイルへ変換済みの fmp4 を複数選択してください(このデモは変換しません)。選択時に自動で検証します。
          </Para>

          {/* アップロードできる動画形式の端的な案内 */}
          <Block className="rounded-md border border-dashed bg-muted/30 p-3">
            <Para size="sm" weight="medium">
              アップロードできる動画形式
            </Para>
            <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
              <li>fragmented MP4(fmp4) / 映像コーデックは H.264(avc1)</li>
              <li>全ファイルで解像度・fps を統一(例: 1080×1920 / 30fps)</li>
              <li>各ファイルの先頭がキーフレーム(closed GOP / IDR 始まり)</li>
              <li>音声なし(映像のみ)</li>
            </ul>
            <Para size="xs" tone="muted" className="mt-1">
              生成例(ffmpeg)など詳細は src/lib/seamlessVideo/README.md を参照。
            </Para>
          </Block>

          <Flex gap="xs" align="center" wrap="wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,.mp4,.m4v"
              multiple
              hidden
              onChange={(e) => void handleSelectFiles(e.target.files)}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              ファイルを選択
            </Button>
            {isValidating && (
              <Para size="sm" tone="muted">
                検証中...
              </Para>
            )}
            {items.length > 0 && (
              <Para size="sm" tone="muted">
                {items.length} 件選択中
              </Para>
            )}
          </Flex>
        </Stack>
      </Block>

      {/* 検証サマリ */}
      {report && (
        <Block
          className={`rounded-lg border p-4 ${
            report.ok ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"
          }`}
        >
          <Stack space={2}>
            <SecTitle size="sm">検証結果: {report.ok ? "連結成立の見込みあり" : "問題あり"}</SecTitle>
            {report.mimeType && (
              <Para size="sm" tone="muted">
                共通コーデック: <span className="font-mono">{report.mimeType}</span>
                {" / 再生可否: "}
                {report.supported ? "可" : "不可"}
              </Para>
            )}
            {report.errors.map((e, i) => (
              <Para key={i} size="sm" className="text-destructive">
                ・{e}
              </Para>
            ))}
            {report.warnings.map((w, i) => (
              <Para key={i} size="sm" className="text-warning">
                ・{w}
              </Para>
            ))}
          </Stack>
        </Block>
      )}

      {/* 並べ替え */}
      {items.length > 0 && (
        <Block className="rounded-lg border p-4">
          <Stack space={3}>
            <SecTitle size="sm">2. 連結順を並べ替え(順不同連結の検証)</SecTitle>
            <SortableList<FragmentItem>
              items={items}
              onReorder={handleReorder}
              columns={[
                {
                  render: (item) => {
                    const st = itemStatus(item);
                    const style = STATUS_STYLE[st];
                    return (
                      <Stack space={1} className="min-w-0 flex-1">
                        <Flex gap="xs" align="center" className="min-w-0">
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${style.className}`}>
                            {style.label}
                          </span>
                          <span className="truncate font-medium">{item.name}</span>
                        </Flex>
                        {item.info && (
                          <span className="text-xs text-muted-foreground">
                            {item.info.codec ?? "codec不明"} / {item.info.width ?? "?"}×{item.info.height ?? "?"} /{" "}
                            {item.info.isFragmented ? "fmp4" : "非fmp4"} /{" "}
                            {item.info.startsWithKeyframe === true
                              ? "IDR始まり"
                              : item.info.startsWithKeyframe === false
                                ? "非IDR始まり"
                                : "先頭不明"}
                          </span>
                        )}
                        {[...item.issues, ...item.warnings].map((msg, i) => (
                          <span key={i} className="text-xs text-destructive">
                            {msg}
                          </span>
                        ))}
                      </Stack>
                    );
                  },
                },
              ]}
            />
          </Stack>
        </Block>
      )}

      {/* 再生 */}
      {items.length > 0 && (
        <Block className="rounded-lg border p-4">
          <Stack space={4}>
            <Flex gap="xs" align="center" wrap="wrap" justify="between">
              <SecTitle size="sm">3. 継ぎ目なし連結再生</SecTitle>
              <Flex gap="sm" align="center" wrap="wrap">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={playMuxedAudio}
                    onChange={(e) => setPlayMuxedAudio(e.target.checked)}
                  />
                  muxed音声を鳴らす(方式A確認)
                </label>
                <Button onClick={() => void handlePlay()} disabled={status === "loading" || !env.mse}>
                  {status === "loading" ? "読み込み中..." : "連結して再生"}
                </Button>
              </Flex>
            </Flex>

            <Block className="mx-auto w-full max-w-[360px]">
              <video ref={videoRef} className="aspect-[9/16] w-full rounded-md bg-black" controls playsInline />
            </Block>

            {/* 診断 */}
            <Stack space={1}>
              <Para size="sm" tone="muted">
                状態: {status}
                {progress.total > 0 && ` / append: ${progress.appended}/${progress.total}`}
                {duration != null && ` / 連結後尺: ${duration.toFixed(2)}s`}
              </Para>
              {error && (
                <Para size="sm" className="text-destructive">
                  エラー: {error.message}
                </Para>
              )}
            </Stack>

            {logs.length > 0 && (
              <Block className="rounded-md bg-muted/50 p-3">
                <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{logs.join("\n")}</pre>
              </Block>
            )}
          </Stack>
        </Block>
      )}
    </Stack>
  );
}
