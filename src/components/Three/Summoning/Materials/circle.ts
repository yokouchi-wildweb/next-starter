// src/components/Three/Summoning/Materials/circle.ts
// 地面に描かれる魔法陣のマテリアルです。
// 回転速度やリングの数値を変えると模様をアレンジできます。

import * as THREE from "three";

export function createCircleMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      time: { value: 0 },
      color: { value: new THREE.Color(0xffffff) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = (uv - 0.5) * 1.35;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 color;
      varying vec2 vUv;
      #define PI 3.14159265359
      // rotate や ring の値を変えると模様の形状を変更できます
      vec2 rotate(vec2 p, float a) {
        float s = sin(a), c = cos(a);
        return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
      }
      float ring(vec2 p, float r, float w) {
        return smoothstep(w, w * 0.4, abs(length(p) - r));
      }
      float radial(vec2 p, float lines, float w) {
        float a = atan(p.y, p.x);
        float seg = PI * 2.0 / lines;
        float d = mod(a + seg * 0.5, seg) - seg * 0.5;
        return smoothstep(w, 0.0, abs(d) / length(p));
      }
      float glyph(vec2 p) {
        float a = atan(p.y, p.x);
        float r = length(p);
        float seg = floor((a + PI) / (PI * 2.0 / 12.0));
        float pat = step(0.0, sin(seg * 3.0 + time * 2.0));
        float line = smoothstep(0.015, 0.0, abs(r - 0.32));
        return pat * line;
      }
      float ripple(vec2 p) {
        float r = length(p);
        float d = fract(-time * 0.5 + r * 4.0);
        return smoothstep(0.0, 0.1, d) * smoothstep(0.7, 0.4, r);
      }
      void main() {
        vec2 uv = vUv;
        float alpha = 0.0;
        // ring の半径や太さを変えると模様のサイズが変わる
        // 外周がスクエアジオメトリをはみ出さないよう少しだけ縮小
        alpha += ring(uv, 0.46, 0.04);
        vec2 uv1 = rotate(uv, time * 0.3);
        vec2 uv2 = rotate(uv, -time * 0.45);
        alpha += ring(uv1, 0.4, 0.01);
        alpha += ring(uv2, 0.27, 0.01);
        alpha += ring(uv1, 0.15, 0.01);
        alpha += radial(uv1, 6.0, 0.004);
        alpha += radial(uv2, 8.0, 0.004);
        alpha += glyph(uv2);
        alpha += ripple(uv);
        float pulse = sin(time * 2.0) * 0.25 + 0.75;
        vec3 col = color;
        gl_FragColor = vec4(col * pulse, alpha * pulse);
        if (gl_FragColor.a <= 0.01) discard;
      }
    `,
  });
}
