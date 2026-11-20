// src/app/(user)/demo/seamless-av/_screen/SeamlessAvDemo.tsx

"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

import {
  AudioReel,
  buildReelManifest,
  isMseSupported,
  reelManifestClient,
  useSeamlessReel,
  validateReel,
  type ReelFragmentValidation,
  type ReelManifestFragment,
  type ReelValidationReport,
} from "@/lib/seamlessVideo";
import { uploadToStorage } from "@/lib/storage/client";
import { useToast } from "@/lib/toast";
import { Button } from "@/components/Button/Button";
import { FilePickButton } from "@/components/Input/FilePickButton";
import { BooleanCheckboxInput } from "@/components/Input/BooleanCheckboxInput";
import { Label } from "@/components/Input/Label";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { Span } from "@/components/TextBlocks/Span";
import { Link } from "@/components/Navigation/Link";

const MAX_SLOTS = 8;
const INITIAL_SLOTS = 4;

type Slot = {
  id: string;
  videoFile?: File;
  audioFile?: File;
};

/** デモの用途（公開・管理者のみ）。業務行に紐付けないので、上げたファイルは猶予後に掃除で消える */
const UPLOAD_PURPOSE = "demo.media";

/** uploadToStorage(ブラウザ→GCS 直)を Promise でラップし、マニフェストに入れる公開 URL を返す。 */
function uploadFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    uploadToStorage(file, {
      purpose: UPLOAD_PURPOSE,
      onComplete: ({ src }) =>
        src ? resolve(src) : reject(new Error("公開 URL を作れません(NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL が未設定)")),
      onError: reject,
    });
  });
}

const makeSlot = (): Slot => ({ id: crypto.randomUUID() });
const makeSlots = (n: number): Slot[] => Array.from({ length: n }, makeSlot);

// 環境サポート(不変)を useSyncExternalStore で読む
type EnvSupport = { mse: boolean; webAudio: boolean };
const SERVER_ENV: EnvSupport = { mse: false, webAudio: false };
let envCache: EnvSupport | null = null;
const subscribeEnv = () => () => {};
const getClientEnv = (): EnvSupport => {
  if (!envCache) envCache = { mse: isMseSupported(), webAudio: AudioReel.isSupported() };
  return envCache;
};
const getServerEnv = (): EnvSupport => SERVER_ENV;

function slotStatus(v: ReelFragmentValidation | undefined): "none" | "ok" | "warning" | "ng" {
  if (!v) return "none";
  if (v.issues.length > 0) return "ng";
  if (v.warnings.length > 0) return "warning";
  return "ok";
}

const STATUS_STYLE: Record<"none" | "ok" | "warning" | "ng", { label: string; className: string }> = {
  none: { label: "未検証", className: "bg-muted text-muted-foreground" },
  ok: { label: "OK", className: "bg-success/15 text-success-text" },
  warning: { label: "警告", className: "bg-warning/15 text-warning-text" },
  ng: { label: "NG", className: "bg-destructive/15 text-destructive-text" },
};

const fmtSec = (s: number | null | undefined) => (s == null ? "—" : `${s.toFixed(2)}s`);

export function SeamlessAvDemo() {
  const env = useSyncExternalStore(subscribeEnv, getClientEnv, getServerEnv);

  const [slots, setSlots] = useState<Slot[]>(() => makeSlots(INITIAL_SLOTS));
  const [report, setReport] = useState<ReelValidationReport | null>(null);
  const [valBySlot, setValBySlot] = useState<Record<string, ReelFragmentValidation>>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [drift, setDrift] = useState<{ value: number; corrected: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  // 拡張ポイントのデモ用 state
  const [progressive, setProgressive] = useState(true);
  const [loopOn, setLoopOn] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [bgmFile, setBgmFile] = useState<File | null>(null);
  const [bgmVolume, setBgmVolumeState] = useState(0.6);
  const [ended, setEnded] = useState(false);
  const [seFile, setSeFile] = useState<File | null>(null);
  const [evictOn, setEvictOn] = useState(false);
  const [recovery, setRecovery] = useState<"abort" | "skip">("abort");

  const { showToast } = useToast();

  const {
    videoRef,
    load,
    play,
    pause,
    status,
    error,
    progress,
    audioEnabled,
    playable,
    complete,
    loaded,
    bufferedSec,
    currentFragment,
    setVolume,
    fade,
    setBgm,
    setBgmVolume,
    fadeBgm,
    seekToFragment,
    playSe,
  } = useSeamlessReel({
    loop: loopOn,
    bufferBehindSec: evictOn ? 5 : undefined,
    onFragmentError: () => recovery,
    onLog: (m) => setLogs((prev) => [...prev, m]),
    onDrift: (value, corrected) => setDrift({ value, corrected }),
    onPlay: () => setEnded(false),
    onEnded: () => setEnded(true),
  });

  // 検証(順序付き)。古い非同期結果は seq で破棄する。
  const valSeqRef = useState(() => ({ current: 0 }))[0];
  const revalidate = useCallback(
    async (nextSlots: Slot[]) => {
      const withVideo = nextSlots.filter((s) => s.videoFile);
      const seq = ++valSeqRef.current;
      if (withVideo.length === 0) {
        setReport(null);
        setValBySlot({});
        return;
      }
      const rep = await validateReel(
        withVideo.map((s) => ({ name: s.videoFile!.name, video: s.videoFile!, audio: s.audioFile })),
      );
      if (seq !== valSeqRef.current) return;
      const map: Record<string, ReelFragmentValidation> = {};
      withVideo.forEach((s, i) => {
        map[s.id] = rep.fragments[i];
      });
      setValBySlot(map);
      setReport(rep);
    },
    [valSeqRef],
  );

  // slots を更新し、同時に再検証する(検証はユーザー操作起点で実行)
  const applySlots = (next: Slot[]) => {
    setSlots(next);
    void revalidate(next);
  };

  const setVideo = (id: string, file?: File) =>
    applySlots(slots.map((s) => (s.id === id ? { ...s, videoFile: file } : s)));
  const setAudio = (id: string, file?: File) =>
    applySlots(slots.map((s) => (s.id === id ? { ...s, audioFile: file } : s)));
  const removeSlot = (id: string) => applySlots(slots.filter((s) => s.id !== id));
  const addSlot = () => {
    if (slots.length >= MAX_SLOTS) return;
    applySlots([...slots, makeSlot()]);
  };

  // 並べ替え(順不同連結の検証用): 上下移動
  const moveSlot = (id: string, dir: -1 | 1) => {
    const i = slots.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= slots.length) return;
    const next = [...slots];
    [next[i], next[j]] = [next[j], next[i]];
    applySlots(next);
  };

  const fragments = useMemo(
    () => slots.filter((s) => s.videoFile).map((s) => ({ video: s.videoFile!, audio: s.audioFile })),
    [slots],
  );

  const handleLoad = async () => {
    setLogs([]);
    setDrift(null);
    setEnded(false);
    await load(fragments, { progressive });
    setVolume(volume);
    if (bgmFile) await setBgm(bgmFile, { loop: true, volume: bgmVolume });
  };

  const handleVolumeChange = (v: number) => {
    setVolumeState(v);
    setVolume(v);
  };
  const handleBgmVolumeChange = (v: number) => {
    setBgmVolumeState(v);
    setBgmVolume(v);
  };
  const handlePlaySe = (atFragment?: number) => {
    if (!seFile) return;
    void playSe(seFile, atFragment != null ? { atFragment } : undefined);
  };

  const canLoad = env.mse && fragments.length > 0 && status !== "loading";
  const canPlay = playable;
  const loadedFragmentCount = slots.filter((s) => s.videoFile).length;

  // ストレージへ保存して共有 URL を発行(実機テスト用)
  const savableSlots = slots.filter((s) => s.videoFile);
  const canSave = !!report?.ok && savableSlots.length > 0 && !saving;

  const handleSave = async () => {
    if (savableSlots.length === 0) return;
    setSaving(true);
    setShareUrl(null);
    try {
      // アップロード総数(映像 + 存在する音声)
      const total = savableSlots.reduce((n, s) => n + 1 + (s.audioFile ? 1 : 0), 0);
      let done = 0;
      const manifestFragments: ReelManifestFragment[] = [];

      for (const slot of savableSlots) {
        const videoUrl = await uploadFile(slot.videoFile!);
        done += 1;
        setSaveMsg(`アップロード中 ${done}/${total}`);

        let audioUrl: string | undefined;
        if (slot.audioFile) {
          audioUrl = await uploadFile(slot.audioFile);
          done += 1;
          setSaveMsg(`アップロード中 ${done}/${total}`);
        }
        manifestFragments.push({ video: videoUrl, audio: audioUrl });
      }

      setSaveMsg("マニフェストを保存中...");
      await reelManifestClient.saveLatest(buildReelManifest(manifestFragments, new Date().toISOString()));

      setShareUrl(`${window.location.origin}/demo/seamless-av/play`);
      showToast("保存しました。共有 URL を発行しました", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "保存に失敗しました", "error");
    } finally {
      setSaving(false);
      setSaveMsg(null);
    }
  };

  const handleCopyUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast("URL をコピーしました", "success");
    } catch {
      showToast("コピーに失敗しました", "error");
    }
  };

  return (
    <Stack gap="lg">
      {/* 環境サポート */}
      <Block className="rounded-lg border bg-muted/40 p-4">
        <Stack gap="2xs">
          <SecTitle size="sm">この環境のサポート状況</SecTitle>
          <Para size="sm" tone="muted">
            映像(MSE): {env.mse ? "対応" : "非対応"} / 音声(Web Audio): {env.webAudio ? "対応" : "非対応"}
          </Para>
          <Para size="xs" tone="muted">
            対応環境: PC のモダンブラウザ / iPhone Safari は <strong>iOS 17.1+</strong>(ManagedMediaSource + Web Audio)。
            これ未満の iOS では音声付き連結を再生できません。
          </Para>
          {(!env.mse || !env.webAudio) && (
            <Para size="sm" className="text-destructive-text">
              この環境では音声付き連結を再生できません(iPhone Safari は iOS 17.1+ が必要)。
            </Para>
          )}
        </Stack>
      </Block>

      {/* 形式案内 */}
      <Block className="rounded-md border border-dashed bg-muted/30 p-3">
        <Para size="sm" weight="medium">
          各フラグメントに登録する形式
        </Para>
        <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
          <li>映像: 統一プロファイルの fragmented MP4(H.264・無音推奨・先頭IDR・解像度/fps統一)</li>
          <li>音声: wav 推奨(m4a/aac/mp3 も可)。映像と同じ尺に揃える</li>
          <li>音声は別レイヤー(Web Audio)で再生されるため、映像側は常にミュートされます</li>
          <li>アップロード先は用途 demo.media(管理者のみ)。業務データに保存しないため、24 時間ほどでファイルが掃除され、保存したマニフェストは再生できなくなります</li>
        </ul>
      </Block>

      {/* フラグメント登録＋並べ替え */}
      <Block className="rounded-lg border p-4">
        <Stack gap="sm">
          <Flex justify="between" align="center" wrap="wrap" gap="xs">
            <SecTitle size="sm">フラグメント(映像+音声)を登録して並べ替え</SecTitle>
            <Button variant="outline" size="sm" onClick={addSlot} disabled={slots.length >= MAX_SLOTS}>
              枠を追加
            </Button>
          </Flex>

          {slots.length === 0 && (
            <Para size="sm" tone="muted">
              フラグメント枠がありません。「枠を追加」で作成してください。
            </Para>
          )}

          <Stack gap="xs">
            {slots.map((slot, index) => {
              const v = valBySlot[slot.id];
              const st = slotStatus(v);
              const style = STATUS_STYLE[st];
              return (
                <Block key={slot.id} className="rounded-md border p-3">
                  <Stack gap="xs">
                    <Flex gap="xs" align="center" wrap="wrap">
                      <Span size="xs" weight="medium" tone="muted" className="shrink-0">#{index + 1}</Span>
                      <Span size="xs" weight="medium" className={`shrink-0 rounded px-1.5 py-0.5 ${style.className}`}>
                        {style.label}
                      </Span>
                      <Flex gap="xs" align="center" className="ml-auto">
                        <Button variant="ghost" size="xs" onClick={() => moveSlot(slot.id, -1)} disabled={index === 0}>
                          ↑
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => moveSlot(slot.id, 1)}
                          disabled={index === slots.length - 1}
                        >
                          ↓
                        </Button>
                        <Button
                          variant="destructiveGhost"
                          size="xs"
                          onClick={() => removeSlot(slot.id)}
                        >
                          削除
                        </Button>
                      </Flex>
                    </Flex>

                    <Flex gap="xs" align="center" wrap="wrap">
                      <FilePickButton variant="outline" size="xs" accept="video/mp4,.mp4,.m4v" onFiles={([file]) => setVideo(slot.id, file)}>
                        映像を選択
                      </FilePickButton>
                      <Span size="xs" tone="muted" className="max-w-[160px] truncate">
                        {slot.videoFile?.name ?? "映像 未選択"}
                      </Span>
                      <FilePickButton variant="outline" size="xs" accept="audio/*,.wav,.m4a,.aac,.mp3" onFiles={([file]) => setAudio(slot.id, file)}>
                        音声を選択
                      </FilePickButton>
                      <Span size="xs" tone="muted" className="max-w-[160px] truncate">
                        {slot.audioFile?.name ?? "音声 未選択"}
                      </Span>
                    </Flex>

                    {v && (
                      <Span size="xs" tone="muted">
                        映像尺 {fmtSec(v.videoDurationSec)} / 音声尺 {fmtSec(v.audioDurationSec)}
                        {v.videoInfo?.codec ? ` / ${v.videoInfo.codec}` : ""}
                        {v.videoInfo?.width ? ` / ${v.videoInfo.width}×${v.videoInfo.height}` : ""}
                      </Span>
                    )}
                    {v?.issues.map((msg, i) => (
                      <Span key={`i-${i}`} size="xs" tone="destructive">
                        {msg}
                      </Span>
                    ))}
                    {v?.warnings.map((msg, i) => (
                      <Span key={`w-${i}`} size="xs" tone="warning">
                        {msg}
                      </Span>
                    ))}
                  </Stack>
                </Block>
              );
            })}
          </Stack>
        </Stack>
      </Block>

      {/* 検証サマリ */}
      {report && (
        <Block
          className={`rounded-lg border p-4 ${
            report.ok ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"
          }`}
        >
          <Stack gap="xs">
            <SecTitle size="sm">検証結果: {report.ok ? "連結成立の見込みあり" : "問題あり"}</SecTitle>
            <Para size="sm" tone="muted">
              音声連結: {report.hasAudioAll ? "全フラグメントに音声あり(有効)" : "無効(映像のみ)"}
              {report.mimeType ? ` / 映像: ${report.mimeType}` : ""}
            </Para>
            {report.errors.map((e, i) => (
              <Para key={i} size="sm" className="text-destructive-text">
                ・{e}
              </Para>
            ))}
            {report.warnings.map((w, i) => (
              <Para key={i} size="sm" className="text-warning-text">
                ・{w}
              </Para>
            ))}
          </Stack>
        </Block>
      )}

      {/* 再生・拡張ポイントのデモ */}
      <Block className="rounded-lg border p-4">
        <Stack gap="md">
          <SecTitle size="sm">プリロード → 再生（拡張ポイント込み）</SecTitle>

          {/* 読み込みモード */}
          <Flex gap="md" align="center" wrap="wrap">
            <BooleanCheckboxInput value={progressive} onChange={(checked) => setProgressive(Boolean(checked))} label={<Span size="xs" tone="muted">progressive 読み込み（先頭準備で即再生可）</Span>} />
            <BooleanCheckboxInput value={loopOn} onChange={(checked) => setLoopOn(Boolean(checked))} label={<Span size="xs" tone="muted">ループ再生</Span>} />
            <BooleanCheckboxInput value={evictOn} onChange={(checked) => setEvictOn(Boolean(checked))} label={<Span size="xs" tone="muted">退避リング(bufferBehindSec=5・長尺向け)</Span>} />
            <Label className="gap-1.5 text-xs font-normal text-muted-foreground">
              失敗時:
              <select
                value={recovery}
                onChange={(e) => setRecovery(e.target.value === "skip" ? "skip" : "abort")}
                className="rounded border bg-background px-1 py-0.5"
              >
                <option value="abort">中断(abort)</option>
                <option value="skip">スキップ継続(skip)</option>
              </select>
            </Label>
            <Span size="xs" tone="muted">※ トグルは「読み込み」で反映</Span>
          </Flex>

          {/* BGM(別レイヤー) */}
          <Flex gap="xs" align="center" wrap="wrap">
            <FilePickButton variant="outline" size="xs" accept="audio/*,.wav,.m4a,.aac,.mp3" onFiles={([file]) => setBgmFile(file)}>
              BGMを選択
            </FilePickButton>
            <Span size="xs" tone="muted" className="max-w-[180px] truncate">
              {bgmFile?.name ?? "BGM 未選択（フラグメント音声と独立した別レイヤー）"}
            </Span>
          </Flex>

          {/* 操作 */}
          <Flex gap="xs" align="center" wrap="wrap">
            <Button
              variant="outline"
              onClick={() => void handleLoad()}
              disabled={!canLoad}
              loading={status === "loading"}
              loadingLabel="読み込み中..."
            >
              読み込み(プリロード)
            </Button>
            <Button onClick={() => void play()} disabled={!canPlay}>
              再生
            </Button>
            <Button variant="ghost" onClick={pause} disabled={!canPlay}>
              一時停止
            </Button>
          </Flex>

          <Block className="mx-auto w-full max-w-[360px]">
            <video ref={videoRef} className="aspect-[9/16] w-full rounded-md bg-black" controls playsInline />
          </Block>

          {/* 再生中コントロール(音量/フェード/章ジャンプ) */}
          <Stack gap="xs">
            <Flex gap="md" align="center" wrap="wrap">
              <Span size="xs" tone="muted">音量 {volume.toFixed(2)}</Span>
              {/* eslint-disable-next-line raw-elements/no-raw-element -- 棚に Slider の部品が無い (注文 36) */}
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
              />
              <Button variant="ghost" size="xs" onClick={() => fade(0, 1)} disabled={!canPlay}>
                フェードアウト(1s)
              </Button>
              <Button variant="ghost" size="xs" onClick={() => fade(volume, 1)} disabled={!canPlay}>
                フェードイン(1s)
              </Button>
            </Flex>

            {bgmFile && (
              <Flex gap="md" align="center" wrap="wrap">
                <Span size="xs" tone="muted">BGM音量 {bgmVolume.toFixed(2)}</Span>
                {/* eslint-disable-next-line raw-elements/no-raw-element -- 棚に Slider の部品が無い (注文 36) */}
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={bgmVolume}
                  onChange={(e) => handleBgmVolumeChange(Number(e.target.value))}
                />
                <Button variant="ghost" size="xs" onClick={() => fadeBgm(0, 1)} disabled={!canPlay}>
                  BGMフェードアウト
                </Button>
                <Button variant="ghost" size="xs" onClick={() => fadeBgm(bgmVolume, 1)} disabled={!canPlay}>
                  BGMフェードイン
                </Button>
              </Flex>
            )}

            {loadedFragmentCount > 0 && (
              <Flex gap="xs" align="center" wrap="wrap">
                <Span size="xs" tone="muted">章ジャンプ</Span>
                {Array.from({ length: loadedFragmentCount }).map((_, i) => (
                  <Button
                    key={i}
                    variant={currentFragment === i ? "default" : "outline"}
                    size="xs"
                    onClick={() => seekToFragment(i)}
                    disabled={!canPlay}
                  >
                    #{i + 1}
                  </Button>
                ))}
              </Flex>
            )}

            {/* ワンショット SE */}
            <Flex gap="xs" align="center" wrap="wrap">
              <Span size="xs" tone="muted">SE(効果音)</Span>
              <FilePickButton variant="outline" size="xs" accept="audio/*,.wav,.m4a,.aac,.mp3" onFiles={([file]) => setSeFile(file)}>
                SEを選択
              </FilePickButton>
              <Span size="xs" tone="muted" className="max-w-[140px] truncate">{seFile?.name ?? "未選択"}</Span>
              <Button variant="ghost" size="xs" onClick={() => handlePlaySe()} disabled={!canPlay || !seFile}>
                今すぐ再生
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => handlePlaySe(currentFragment >= 0 ? currentFragment + 1 : undefined)}
                disabled={!canPlay || !seFile}
              >
                次の境界で再生
              </Button>
            </Flex>
          </Stack>

          {/* 診断 */}
          <Stack gap="2xs">
            <Para size="sm" tone="muted">
              状態: {status} / playable: {playable ? "○" : "—"} / complete: {complete ? "○" : "—"}
              {progress.total > 0 && ` / 映像append: ${progress.appended}/${progress.total}`}
            </Para>
            <Para size="sm" tone="muted">
              読み込み: 映像 {loaded.video}/{loaded.total}・音声 {loaded.audio}/{loaded.total} / 先読み{" "}
              {bufferedSec.toFixed(1)}s / 再生中#{currentFragment >= 0 ? currentFragment + 1 : "—"}
              {status === "ready" && ` / 音声連結: ${audioEnabled ? "有効" : "無効"}`}
            </Para>
            {drift && (
              <Para size="sm" tone="muted">
                A/Vドリフト: {(drift.value * 1000).toFixed(0)}ms {drift.corrected ? "(補正中)" : "(同期)"}
              </Para>
            )}
            {ended && <Para size="sm" className="text-success-text">演出終了（onEnded 発火）</Para>}
            {error && (
              <Para size="sm" className="text-destructive-text">
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

      {/* 保存して共有(実機テスト用) */}
      <Block className="rounded-lg border p-4">
        <Stack gap="sm">
          <Flex gap="xs" align="center" wrap="wrap" justify="between">
            <SecTitle size="sm">ストレージに保存して共有URLを発行</SecTitle>
            <Button onClick={() => void handleSave()} disabled={!canSave}>
              {saving ? "保存中..." : "保存して共有URLを発行"}
            </Button>
          </Flex>
          <Para size="sm" tone="muted">
            現在の映像・音声をストレージに保存し、固定の共有URLを発行します。各モバイル端末でそのURLを開くと、
            つなげた映像が再生できます（保存するたびに最新の内容に上書きされます）。検証OKの状態で保存してください。
          </Para>

          {saveMsg && (
            <Para size="sm" tone="muted">
              {saveMsg}
            </Para>
          )}

          {shareUrl && (
            <Block className="rounded-md border border-success/40 bg-success/5 p-3">
              <Stack gap="xs">
                <Para size="sm" weight="medium">
                  共有URL
                </Para>
                <Flex gap="xs" align="center" wrap="wrap">
                  <Link href={shareUrl} target="_blank" rel="noreferrer" className="break-all text-sm text-info-text underline">
                    {shareUrl}
                  </Link>
                  <Button variant="outline" size="xs" onClick={() => void handleCopyUrl()}>
                    コピー
                  </Button>
                </Flex>
              </Stack>
            </Block>
          )}
        </Stack>
      </Block>
    </Stack>
  );
}
