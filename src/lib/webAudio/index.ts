// src/lib/webAudio/index.ts
//
// アプリ共通の Web Audio 基盤。
// - 単一の AudioContext を共有する土台(AudioEngine / getSharedAudioEngine / unlockAudio)
// - その上に乗る汎用ワンショット効果音エンジン(playSe / preloadSe)
// - 同じ共有 ctx 上で動く BGM コントローラ(playBgm / duckBgm / crossfadeBgm 等)
// - BGM と同時に鳴らし続ける汎用ループ効果音(playLoopSe → 停止/音量ハンドル)
//
// 音は URL で渡す(音の置き場所はアプリのもの。例: @/utils/assets の sePath)。
//
// 効果音の使い方(呼び出し側):
//   import { preloadSe, playSe, unlockAudio } from "@/lib/webAudio";
//   (sePath は呼び手が読む @/utils/assets の関数)
//   preloadSe([sePath("coin.wav")]);  // 画面表示時に事前デコード
//   unlockAudio();                    // 最初のユーザー操作内で 1 回
//   playSe(sePath("coin.wav"));       // 視覚エフェクトと同時に即時発音
//
// BGM の使い方:
//   preloadBgm(sePath("bgm/main.wav"));  // 画面表示時に事前デコード
//   unlockAudio();                       // 最初のユーザー操作内で 1 回
//   playBgm(sePath("bgm/main.wav"), { volume: 0.6 });  // 開始アニメと同時に立ち上げ
//   duckBgm(0.2, 0.2);                   // 演出中は下げる / duckBgm(1, 0.2) で復帰
//   crossfadeBgm(sePath("bgm/rush.wav"));  // ゾーン突入でトラック切替
//
// ループSE の使い方(BGM と独立・多重可):
//   preloadSe([sePath("カタカタ.mp3")]);         // 画面表示時に事前デコード(playSe と共通)
//   unlockAudio();                               // 最初のユーザー操作内で 1 回
//   const h = playLoopSe(sePath("カタカタ.mp3"), { volume: 0.6, fadeInSec: 0.1 });
//   h.setVolume(0.3);                            // 再生中の音量変更
//   h.stop(0.2);                                 // フェードアウトして停止

export { AudioEngine, getAudioContextCtor } from "./AudioEngine";
export { getSharedAudioEngine, unlockAudio } from "./sharedEngine";
export { decodeAudio, clearDecodeCache } from "./decodeCache";
export { playSe, preloadSe, clearSeCache } from "./playSe";
export { playLoopSe } from "./loopSe";
export type { LoopSeHandle } from "./loopSe";
export {
  preloadBgm,
  playBgm,
  stopBgm,
  setBgmVolume,
  duckBgm,
  crossfadeBgm,
  isBgmPlaying,
  currentBgm,
} from "./bgm";
