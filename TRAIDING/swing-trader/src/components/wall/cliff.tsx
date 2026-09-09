"use client";

import { useEffect, useMemo } from "react";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { WALL_H, WALL_W, yFor, seededRng, type Range } from "./wall-math";

const LINE_GEO = new THREE.BoxGeometry(WALL_W + 1.6, 0.015, 0.04);
const HOLD_GEO = new THREE.IcosahedronGeometry(1, 1);

type RLine = { n: number; pct: number };

/* muted boulder-gym hold colours */
const HOLD_COLORS = ["#c2703d", "#3f6f8c", "#5c7d54", "#a8905a", "#8a5a6d"];

/** natural rock face + climbing holds + height marks + R lines */
export default function Cliff({ range, rLines }: { range: Range; rLines: RLine[] }) {
  // displaced, vertex-coloured rock face — built once
  const geo = useMemo(() => {
    const W = WALL_W + 2.5;
    const H = WALL_H + 4;
    const g = new THREE.PlaneGeometry(W, H, 40, 100);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const base = new THREE.Color("#5b5148");
    const lo = new THREE.Color("#332c26"); // crevice shadow
    const hi = new THREE.Color("#8f8377"); // sun-caught ridge
    const rust = new THREE.Color("#7a4a33");
    const c = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      // low-freq form + mid detail + high-freq grit
      const form = Math.sin(x * 0.55 + y * 0.3) * 0.55 + Math.cos(y * 0.42 - x * 0.2) * 0.4;
      const mid = Math.sin(x * 1.9 - y * 1.3) * 0.18 + Math.cos(y * 2.4 + x * 0.7) * 0.14;
      const grit = Math.sin(x * 6.2 + y * 5.1) * 0.05 + Math.cos(y * 8.7 - x * 3.3) * 0.035;
      const z = form + mid + grit;
      pos.setZ(i, z - 0.9);

      // colour: deep in the hollows, bright on the bumps, rusty streaks
      const depth = THREE.MathUtils.clamp((z + 0.6) / 1.8, 0, 1);
      c.copy(lo).lerp(base, depth).lerp(hi, Math.max(0, depth - 0.55) * 1.6);
      const streak = Math.sin(y * 0.9 + x * 2.1);
      if (streak > 0.75) c.lerp(rust, (streak - 0.75) * 1.6);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    g.translate(0, WALL_H / 2, 0);
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);

  const rockMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        metalness: 0,
        flatShading: true,
      }),
    []
  );
  useEffect(() => () => rockMat.dispose(), [rockMat]);

  const holdMat = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, flatShading: true }),
    []
  );
  useEffect(() => () => holdMat.dispose(), [holdMat]);

  // scattered climbing holds — deterministic
  const holds = useMemo(() => {
    const rnd = seededRng(0x51ce);
    const count = 54;
    const mesh = new THREE.InstancedMesh(HOLD_GEO, holdMat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const px = (rnd() - 0.5) * (WALL_W + 1.2);
      const py = rnd() * (WALL_H + 2) - 0.5;
      const s = 0.09 + rnd() * 0.11;
      e.set(rnd() * 3, rnd() * 3, rnd() * 3);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(px, py, -0.15 + rnd() * 0.1), q, new THREE.Vector3(s, s * 0.7, s));
      mesh.setMatrixAt(i, m);
      col.set(HOLD_COLORS[Math.floor(rnd() * HOLD_COLORS.length)]).multiplyScalar(0.85);
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }, [holdMat]);
  useEffect(() => {
    return () => {
      holds.dispose();
    };
  }, [holds]);

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
      <mesh geometry={geo} material={rockMat} />
      <primitive object={holds} />

      {marks.map((m) => {
        const y = yFor(m.pct, range);
        const entry = Math.abs(m.pct) < 1e-9;
        const color = entry ? "#e8b341" : m.whole ? "#8a8f99" : "#4a4e57";
        return (
          <group key={`m${m.pct}`} position={[0, y, 0.2]}>
            <mesh geometry={LINE_GEO}>
              <meshBasicMaterial color={color} transparent opacity={entry ? 0.9 : m.whole ? 0.4 : 0.15} />
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
          <group key={`r${r.n}`} position={[0, y, 0.22]}>
            <mesh geometry={LINE_GEO}>
              <meshBasicMaterial color="#10b981" transparent opacity={0.5} />
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
