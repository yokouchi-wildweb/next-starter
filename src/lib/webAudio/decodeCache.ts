// src/lib/webAudio/decodeCache.ts
//
// 効果音(SE)・BGM 共通の音声デコードキャッシュ。
// 圧縮音声を一度だけ decodeAudioData で AudioBuffer に展開してキャッシュし、
// 再生(playSe / playBgm)は AudioBufferSourceNode で即時に行えるようにする。
// 同一 URL の重複デコードは in-flight キャッシュで 1 回に集約する。

import { sePath } from "@/utils/assets";

/** デコード済み AudioBuffer のキャッシュ(解決後 URL をキー)。 */
const cache = new Map<string, AudioBuffer>();
/** デコード中の重複起動を抑える in-flight キャッシュ。 */
const inFlight = new Map<string, Promise<AudioBuffer>>();

/** fileName を再生用 URL に解決する。絶対 URL / 絶対パスはそのまま、それ以外は sePath() で SE 配置へ。 */
export function resolveAudioUrl(fileName: string): string {
  if (/^https?:\/\//.test(fileName) || fileName.startsWith("/")) return fileName;
  return sePath(fileName);
}

/** URL の音声を取得→デコードして AudioBuffer を返す(キャッシュ・重複集約あり)。 */
export function decodeAudio(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const cached = cache.get(url);
  if (cached) return Promise.resolve(cached);
  const existing = inFlight.get(url);
  if (existing) return existing;

  const task = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`音声の取得に失敗しました: ${url} (HTTP ${res.status})`);
    const ab = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(ab.slice(0));
    cache.set(url, buf);
    return buf;
  })();

  inFlight.set(url, task);
  return task.finally(() => inFlight.delete(url));
}

/** デコードキャッシュを破棄する(メモリ解放)。引数省略で全件。 */
export function clearDecodeCache(fileNames?: string[]): void {
  if (!fileNames) {
    cache.clear();
    return;
  }
  for (const name of fileNames) cache.delete(resolveAudioUrl(name));
}
