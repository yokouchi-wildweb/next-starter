// src/lib/webAudio/playSe.ts
//
// ドメイン非依存の汎用ワンショット効果音(SE)エンジン。
// 圧縮音声を一度だけ decodeAudioData で AudioBuffer に展開してキャッシュし、再生は
// AudioBufferSourceNode で行う。出音はほぼ即時・サンプル精度・多重再生可能で、
// 視覚エフェクト(framer-motion / CSS)と同フレームで鳴らせる。
//
// AudioContext はアプリ共有の 1 台(getSharedAudioEngine)を使う。最初のユーザー操作内で
// unlockAudio() を 1 回呼んでおけば、以降は await 後(gesture 外)でも鳴る。
//
// 使い方:
//   preloadSe(["coin.wav", "win.wav"]) // 画面表示時などに事前デコード(初回の通信遅延を消す)
//   unlockAudio()                      // 最初のタップ等の同期内で 1 回
//   playSe("coin.wav")                 // 視覚エフェクトと同時に即時発音

import { sePath } from "@/utils/assets";

import { AudioEngine } from "./AudioEngine";
import { getSharedAudioEngine } from "./sharedEngine";

/** デコード済み AudioBuffer のキャッシュ(解決後 URL をキー)。再デコードを避ける。 */
const seCache = new Map<string, AudioBuffer>();
/** デコード中の重複起動を抑える in-flight キャッシュ。 */
const inFlight = new Map<string, Promise<AudioBuffer>>();

/** fileName を再生用 URL に解決する。絶対 URL / 絶対パスはそのまま、それ以外は sePath() で SE 配置へ。 */
function resolveSeUrl(fileName: string): string {
  if (/^https?:\/\//.test(fileName) || fileName.startsWith("/")) return fileName;
  return sePath(fileName);
}

async function decodeSe(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const cached = seCache.get(url);
  if (cached) return cached;
  const existing = inFlight.get(url);
  if (existing) return existing;

  const task = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`効果音の取得に失敗しました: ${url} (HTTP ${res.status})`);
    const ab = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(ab.slice(0));
    seCache.set(url, buf);
    return buf;
  })();

  inFlight.set(url, task);
  try {
    return await task;
  } finally {
    inFlight.delete(url);
  }
}

/**
 * 効果音を 1 回再生する。後方互換シグネチャ: playSe(fileName, volume)。
 * デコード済みなら即時発音。未デコードなら取得→デコードしてから再生(初回のみ)。
 * fire-and-forget で呼べるよう、失敗してもスロー(reject)せず黙って無音にフォールバックする。
 */
export async function playSe(fileName: string, volume = 1.0): Promise<void> {
  if (!AudioEngine.isSupported()) return;
  try {
    const engine = getSharedAudioEngine();
    const ctx = engine.ensure();
    if (ctx.state === "suspended") await ctx.resume();

    const buf = await decodeSe(ctx, resolveSeUrl(fileName));

    const gain = ctx.createGain();
    gain.gain.value = Math.max(0, volume);
    // 共有マスター経由(将来の全体ミュート等に追従)。無ければ destination へ直結。
    gain.connect(engine.masterGain() ?? ctx.destination);

    const node = ctx.createBufferSource();
    node.buffer = buf;
    node.connect(gain);
    node.onended = () => {
      try {
        node.disconnect();
        gain.disconnect();
      } catch {
        /* noop */
      }
    };
    node.start();
  } catch {
    /* 取得失敗・未対応などは無音にフォールバック(演出を止めない) */
  }
}

/**
 * 画面が使う効果音を事前にデコードしてキャッシュする(初回の通信・デコード遅延を解消)。
 * 1 ファイルの失敗は他に波及させない(allSettled)。
 */
export async function preloadSe(fileNames: string[]): Promise<void> {
  if (!AudioEngine.isSupported()) return;
  let ctx: AudioContext;
  try {
    ctx = getSharedAudioEngine().ensure();
  } catch {
    return;
  }
  await Promise.allSettled(fileNames.map((name) => decodeSe(ctx, resolveSeUrl(name))));
}

/** デコードキャッシュを破棄する(メモリ解放)。引数省略で全件。 */
export function clearSeCache(fileNames?: string[]): void {
  if (!fileNames) {
    seCache.clear();
    return;
  }
  for (const name of fileNames) seCache.delete(resolveSeUrl(name));
}
