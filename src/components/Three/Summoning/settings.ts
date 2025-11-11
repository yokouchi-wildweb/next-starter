// src/components/Three/Summoning/settings.ts

import { getRandomItem } from "@/utils/array";
import { getRandomInRange } from "@/utils/math";

const x = getRandomInRange(0, 2);
const y = getRandomInRange(0, 2);
const z = getRandomInRange(0, 2);

export const settings = {
  stars: {
    // 星の数に掛ける係数。0.1〜3程度で調整する
    density: getRandomInRange(0.1, 2),
    // 星の大きさに掛ける係数。0.1〜5程度で調整する
    sizeFactor: getRandomInRange(0.8, 3),
    start: 0,
    rotationSpeed: getRandomItem<number>([0.001, -0.002], [4, 1]),
    // 星空の回転軸方向
    rotationAxis: [x, 1, z] as [number, number, number],
    // 回転速度が変化する時刻
    speedChangeTime: getRandomItem<number>([0, 4], [10, 1]),
    // 変更後の回転速度
    rotationSpeedAfter: -0.006,
    // 出現時の色
    startColor: "#99ccff",
    // 色変化が始まる時刻
    colorChangeStart: 1,
    // この時刻で色が完全に変化する
    colorChangeEnd: 4,
    // 変化後の色
    endColor: getRandomItem<string>(["#99ccff", "#ff0000"], [9, 1]),
  },
  ring: {
    // リングが出現し始める時刻
    start: 3,
    // 完全に表示されるまでの時間
    appearDuration: 3,
    // 色変化設定
    startColor: "#33e0ff",
    colorChangeStart: 9,
    colorChangeEnd: 11,
    endColor: getRandomItem<string>(
      [ "#33e0ff", "#ff3333", "#bdff02", "#00ff29" ],
      [5, 1, 1, 1]
    ),
  },
  cylinder: {
    // 柱が出現し始める時刻
    start: 6,
    // 伸びきるまでの時間
    growDuration: 3,
    // 基本回転速度
    rotationSpeed: 0.02,
    // カメラ切り替え後の加速係数
    accel: 0.02,
    startColor: "#e0ffff",
    colorChangeStart: getRandomItem<number>([8, 11, 14]),
    colorChangeEnd: 18,
    endColor: getRandomItem<string>([ "#e0ffff",  "#ff6600",  "#7bff8d", "#ed97ff"], [10, 1, 1, 1]),
  },
  lightning: {
    // 落雷エフェクトの開始時刻
    start: 6,
    // 落雷の回数
    count: getRandomItem<number>([3, 4, 5, 6, 7, 8, 9, 10, 12, 20]),
    // 発生間隔
    interval: getRandomItem<number>([0.3, 0.8, 1.0, 1.2, 1.5], ),
    // 光っている時間
    active: 0.25,
  },
  light: {
    // ライトが最大強度になるまでの時間
    start: 6,
    full: 12,
  },
  overlay: {
    startColor: getRandomItem<string>(["#ffffff", "#ffb380", "#ff8e8e"]),
    colorChangeStart: 0,
    colorChangeEnd: 0,
    endColor: "#ffffff",
  },
  camera: {
    // 最初の接近演出の長さ
    preMoveDur: 3,
    // カメラ演出の切り替え時刻
    switch: 13,
    // カメラが真上へ移動するまでの時間
    topDuration: 1,
    // 上から地面まで降りる時間
    downDuration: 9,
    // カメラが到達する最高位置
    topY: 4,
  },
};
