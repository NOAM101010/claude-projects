"use client";

import { useEffect, useMemo } from "react";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { WALL_H, WALL_W, yFor, type Range } from "./wall-math";

const LINE_GEO = new THREE.BoxGeometry(WALL_W + 1.6, 0.015, 0.04);

type RLine = { n: number; pct: number };

/** natural rock face + height marks + R lines */
export default function Cliff({ range, rLines }: { range: Range; rLines: RLine[] }) {
  // displaced rock face — built once per range
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(WALL_W + 2, WALL_H + 3, 24, 60);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const n =
        Math.sin(x * 1.7 + y * 0.9) * 0.18 +
        Math.sin(x * 4.3 - y * 2.1) * 0.07 +
        Math.cos(y * 6.1 + x * 0.5) * 0.04;
      pos.setZ(i, n - 0.35);
    }
    g.computeVertexNormals();
    g.translate(0, WALL_H / 2, 0);
    return g;
  }, []);

  useEffect(() => () => { geo.dispose(); }, [geo]);

  const rockMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#6b6157"),
        roughness: 0.96,
        metalness: 0,
        flatShading: true,
      }),
    []
  );
  useEffect(() => () => { rockMat.dispose(); }, [rockMat]);

  // integer + half-percent marks inside the visible range
  const marks = useMemo(() => {
    const out: { pct: number; whole: boolean }[] = [];
    const start = Math.ceil(range.min / 0.5) * 0.5;
    for (let v = start; v <= range.max + 1e-6; v += 0.5) {
      const r = Math.round(v * 10) / 10;
      out.push({ pct: r, whole: Math.abs(r % 1) < 1e-9 });
    }
    return out;
  }, [range]);

  return (
    <group>
      <mesh geometry={geo} material={rockMat} position={[0, 0, 0]} receiveShadow={false} />

      {marks.map((m) => {
        const y = yFor(m.pct, range);
        const entry = Math.abs(m.pct) < 1e-9;
        const color = entry ? "#e8b341" : m.whole ? "#8a8f99" : "#4a4e57";
        return (
          <group key={`m${m.pct}`} position={[0, y, 0]}>
            <mesh geometry={LINE_GEO}>
              <meshBasicMaterial
                color={color}
                transparent
                opacity={entry ? 0.9 : m.whole ? 0.42 : 0.16}
              />
            </mesh>
            {(m.whole || entry) && (
              <Text
                position={[-(WALL_W / 2) - 0.55, 0, 0.05]}
                fontSize={entry ? 0.24 : 0.19}
                color={entry ? "#e8b341" : "#9aa0aa"}
                anchorX="right"
                anchorY="middle"
              >
                {`${m.pct > 0 ? "+" : ""}${m.pct.toFixed(1)}%`}
              </Text>
            )}
          </group>
        );
      })}

      {rLines.map((r) => {
        const y = yFor(r.pct, range);
        return (
          <group key={`r${r.n}`} position={[0, y, 0.02]}>
            <mesh geometry={LINE_GEO}>
              <meshBasicMaterial color="#10b981" transparent opacity={0.55} />
            </mesh>
            <Text
              position={[WALL_W / 2 + 0.5, 0, 0.05]}
              fontSize={0.2}
              color="#34d399"
              anchorX="left"
              anchorY="middle"
            >
              {`R${r.n}`}
            </Text>
          </group>
        );
      })}
    </group>
  );
}
