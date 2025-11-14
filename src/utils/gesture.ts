// src/utils/gesture.ts

/**
 * スワイプやドラッグ操作から取得したベクトル情報を解析して、
 * スワイプの角度（degree）、移動距離（ピクセル）、方向（文字列）を返す関数。
 */
export type SwipeInfo = {
  angle: number; // ベクトルの角度（-180〜180度、右方向を0度とする）
  distance: number; // 原点からの距離（px単位）
  direction:
    | "up"
    | "down"
    | "left"
    | "right"
    | "up-right"
    | "up-left"
    | "down-right"
    | "down-left"; // 8方向
};

/**
 * 与えられたベクトル（x, y）に基づき、スワイプの方向・角度・距離を解析する。
 *
 * @param x - 横方向の移動量（右が正）
 * @param y - 縦方向の移動量（下が正）
 * @returns SwipeInfo（角度、距離、方向）
 */
export function analyzeSwipe(x: number, y: number): SwipeInfo {
  // ラジアン → 度 に変換（Math.atan2 は y, x の順）
  const angle = (Math.atan2(y, x) * 180) / Math.PI;

  // ピタゴラスの定理で距離（直線距離）を求める
  const distance = Math.hypot(x, y);

  // 角度から方向を判定（8方向）
  const direction = getDirectionFromAngle(angle);

  return { angle, distance, direction };
}

/**
 * 角度からおおまかな方向（文字列）を判定する。
 *
 * @param angle - -180〜180度の角度（右方向が0度）
 * @returns 8方向のうちのいずれか（right/up-leftなど）
 */
function getDirectionFromAngle(angle: number): SwipeInfo['direction'] {
  // 各方向は 45度の幅で8分割して判定する

  if (angle >= -22.5 && angle < 22.5) return 'right';
  if (angle >= 22.5 && angle < 67.5) return 'down-right';
  if (angle >= 67.5 && angle < 112.5) return 'down';
  if (angle >= 112.5 && angle < 157.5) return 'down-left';
  if (angle >= 157.5 || angle < -157.5) return 'left';
  if (angle >= -157.5 && angle < -112.5) return 'up-left';
  if (angle >= -112.5 && angle < -67.5) return 'up';
  if (angle >= -67.5 && angle < -22.5) return 'up-right';

  // 万一範囲外だった場合は 'right' をデフォルトとする
  return 'right';
}
