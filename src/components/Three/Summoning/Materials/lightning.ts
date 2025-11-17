// src/components/Three/Summoning/Materials/lightning.ts
// 落雷エフェクトの板ポリゴン用マテリアルです。
// ノイズ関数の係数を調整することで雷の走り方を変更できます。

import * as THREE from "three";

export function createLightningMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float time;
      varying vec2 vUv;
      // rand と noise のアルゴリズムは雷の揺らぎを作る
      float rand(vec2 c) {
        return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453);
      }
      float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        float a = rand(i);
        float b = rand(i + vec2(1.0, 0.0));
        float c = rand(i + vec2(0.0, 1.0));
        float d = rand(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }
      // fbm を調整すると雷の枝の細かさが変わる
      float fbm(vec2 st) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(st);
          st *= 2.0;
          a *= 0.5;
        }
        return v;
      }
      void main() {
        vec2 uv = vUv;
        // fbm の結果で中心の曲がり具合を決定
        float x = 0.5 + (fbm(vec2(uv.y * 3.0, time * 5.0)) - 0.5) * 0.6;
        float mainB = smoothstep(0.06, 0.0, abs(uv.x - x));
        float side1 = smoothstep(0.04, 0.0, abs(uv.x - (x + (uv.y - 0.3) * 0.2)));
        float side2 = smoothstep(0.04, 0.0, abs(uv.x - (x - (uv.y - 0.6) * 0.15)));
        float a = max(mainB, max(side1 * (1.0 - uv.y), side2 * uv.y));
        a *= smoothstep(0.0, 0.05, uv.y);
        a *= smoothstep(1.0, 0.8, uv.y);
        if (a <= 0.0) discard;
        gl_FragColor = vec4(vec3(1.0), a);
      }
    `,
  });
}
