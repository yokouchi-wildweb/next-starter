// src/lib/webAudio/index.ts
//
// アプリ共通の Web Audio 基盤。
// - 単一の AudioContext を共有する土台(AudioEngine / getSharedAudioEngine / unlockAudio)
// - その上に乗る汎用ワンショット効果音エンジン(playSe / preloadSe)
//
// 効果音の使い方(呼び出し側):
//   import { preloadSe, playSe, unlockAudio } from "@/lib/webAudio";
//   preloadSe(["coin.wav"]);  // 画面表示時に事前デコード
//   unlockAudio();            // 最初のユーザー操作内で 1 回
//   playSe("coin.wav");       // 視覚エフェクトと同時に即時発音

export { AudioEngine, getAudioContextCtor } from "./AudioEngine";
export { getSharedAudioEngine, unlockAudio } from "./sharedEngine";
export { playSe, preloadSe, clearSeCache } from "./playSe";
