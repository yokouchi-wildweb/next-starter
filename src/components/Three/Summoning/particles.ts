// src/components/Three/Summoning/particles.ts
// 初心者向けコメント: 星の粒子を作成する関数です。シーンに配置するためのジオメトリのみを返します。

import * as THREE from "three";
import { settings } from "./settings";

// 星粒子のジオメトリを生成するヘルパー

// シーンに配置する星の粒子をランダム生成します
export function createParticles() {
  const geom = new THREE.BufferGeometry();
  // 基本粒子数に設定値の係数を掛けた数を生成
  const num = Math.max(Math.floor(200 * settings.stars.density), 1);
  const pos = new Float32Array(num * 3);
  for (let i = 0; i < num; i++) {
    // 立方体の範囲にランダム配置
    pos[i * 3] = (Math.random() - 0.5) * 4;
    pos[i * 3 + 1] = Math.random() * 2;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 4;
  }
  geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return { geometry: geom };
}
