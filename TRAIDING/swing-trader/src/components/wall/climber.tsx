"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, RoundedBox, Text } from "@react-three/drei";
import * as THREE from "three";
import { yFor, tickerHue, tickerPhase, type Range } from "./wall-math";

/* ── shared geometry — one copy per module, reused by every climber ── */
const PITON_GEO = new THREE.BoxGeometry(0.2, 0.12, 0.16);
const ROPE_GEO = new THREE.CylinderGeometry(0.016, 0.016, 1, 6);
const PUFF_GEO = new THREE.IcosahedronGeometry(0.28, 0);
const HIT_GEO = new THREE.CapsuleGeometry(0.28, 0.7, 3, 8);

const HEAD_GEO = new THREE.SphereGeometry(0.12, 12, 10);
const HELMET_GEO = new THREE.SphereGeometry(0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62);
const TORSO_GEO = new THREE.CapsuleGeometry(0.13, 0.32, 4, 10);
const HIP_GEO = new THREE.CapsuleGeometry(0.12, 0.1, 4, 8);
const LIMB_GEO = new THREE.CapsuleGeometry(0.052, 0.3, 3, 7);
const HAND_GEO = new THREE.SphereGeometry(0.055, 8, 6);

const FIGURE_Z = 0.45;

export type ClimberData = {
  id: string;
  ticker: string;
  pct: number;
  stopPct: number | null;
  rMultiple: number | null;
  currentPrice: number | null;
  buyPrice: number;
  stopPrice: number | null;
  unrealizedPnl: number | null;
  earningsDate: string | null;
  buyDate: string;
  falling: boolean;
  crossed: { pct?: number; r?: number } | null;
};

type Props = ClimberData & {
  range: Range;
  x: number;
  focused: boolean;
  dimmed: boolean;
  onSelect: (id: string) => void;
};

/** one bent capsule limb: pivot at `pos`, rotated `rot`, capsule hangs downward from pivot */
function Limb({
  pos,
  rot,
  len = 1,
  mat,
  groupRef,
}: {
  pos: [number, number, number];
  rot: [number, number, number];
  len?: number;
  mat: THREE.Material;
  groupRef?: React.Ref<THREE.Group>;
}) {
  return (
    <group ref={groupRef} position={pos} rotation={rot}>
      <mesh geometry={LIMB_GEO} material={mat} position={[0, -0.2 * len, 0]} scale={[1, len, 1]} />
      <mesh geometry={HAND_GEO} material={mat} position={[0, -0.4 * len, 0]} />
    </group>
  );
}

export default function Climber({
  id,
  ticker,
  pct,
  stopPct,
  range,
  x,
  falling,
  crossed,
  dimmed,
  focused,
  onSelect,
}: Props) {
  const figureRef = useRef<THREE.Group>(null);
  const leanRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const ropeRef = useRef<THREE.Mesh>(null);
  const puffRef = useRef<THREE.Mesh>(null);
  const armRRef = useRef<THREE.Group>(null);
  const armLRef = useRef<THREE.Group>(null);
  const legRRef = useRef<THREE.Group>(null);
  const legLRef = useRef<THREE.Group>(null);

  const targetYRef = useRef(yFor(pct, range));
  const fallStartRef = useRef<number | null>(null);
  const jumpStartRef = useRef<number | null>(null);
  const jumpRequestedRef = useRef(false);
  const dimRef = useRef(0);
  const phase = useMemo(() => tickerPhase(ticker), [ticker]);

  const pitonY = stopPct != null ? yFor(stopPct, range) : 0;

  const mats = useMemo(() => {
    const hue = tickerHue(ticker) / 360;
    const body = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(hue, 0.5, 0.52),
      roughness: 0.6,
      flatShading: true,
      transparent: true,
      emissive: new THREE.Color("#10b981"),
      emissiveIntensity: 0.14,
    });
    const helmet = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(hue, 0.62, 0.62),
      roughness: 0.35,
      flatShading: true,
      transparent: true,
    });
    const limb = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#20242c"),
      roughness: 0.85,
      flatShading: true,
      transparent: true,
    });
    const skin = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#d9a066"),
      roughness: 0.7,
      flatShading: true,
      transparent: true,
    });
    const rope = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#10b981"),
      roughness: 0.9,
      transparent: true,
      opacity: 0.45,
    });
    const puff = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#e8b341"),
      transparent: true,
      opacity: 0,
      wireframe: true,
    });
    const hit = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    return { body, helmet, limb, skin, rope, puff, hit };
  }, [ticker]);

  useEffect(() => {
    const m = mats;
    return () => {
      m.body.dispose();
      m.helmet.dispose();
      m.limb.dispose();
      m.skin.dispose();
      m.rope.dispose();
      m.puff.dispose();
      m.hit.dispose();
    };
  }, [mats]);

  // keep P&L-driven colours in sync
  useEffect(() => {
    targetYRef.current = yFor(pct, range);
    const up = pct >= 0;
    mats.body.emissive.set(up ? "#10b981" : "#ef4444");
    mats.rope.color.set(up ? "#10b981" : "#ef4444");
  }, [pct, range, mats]);

  useEffect(() => {
    if (!falling) fallStartRef.current = null;
  }, [falling]);

  useEffect(() => {
    if (crossed) jumpRequestedRef.current = true;
  }, [crossed]);

  useFrame(({ clock }, delta) => {
    const g = figureRef.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const d = Math.min(delta, 0.05);

    // ── falling ──────────────────────────────────────────────
    if (falling) {
      if (fallStartRef.current == null) fallStartRef.current = t;
      const dt = t - fallStartRef.current;
      g.position.y -= d * (2.5 + dt * 9);
      g.rotation.z += d * 5;
      const k = Math.max(0, 1 - dt / 1.8);
      g.scale.setScalar(0.35 + 0.65 * k);
      mats.body.opacity = k;
      mats.helmet.opacity = k;
      mats.limb.opacity = k;
      mats.skin.opacity = k;
      mats.rope.opacity = 0;
      if (ropeRef.current) ropeRef.current.visible = false;
      return;
    }

    // ── milestone hop ────────────────────────────────────────
    if (jumpRequestedRef.current) {
      jumpStartRef.current = t;
      jumpRequestedRef.current = false;
    }
    let hop = 0;
    let reach = 0;
    let puffP = 0;
    if (jumpStartRef.current != null) {
      const dt = t - jumpStartRef.current;
      if (dt > 0.75) jumpStartRef.current = null;
      else {
        const p = dt / 0.75;
        hop = Math.sin(p * Math.PI) * 0.42;
        reach = Math.sin(p * Math.PI);
        puffP = p;
      }
    }

    // ── vertical glide toward target ─────────────────────────
    const goal = targetYRef.current + hop;
    g.position.y = THREE.MathUtils.damp(g.position.y, goal, 2.5, d);
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, 0, 6, d);

    // ── continuous climbing gait + idle sway ────────────────
    const cyc = t * 1.6 + phase;
    const swing = Math.sin(cyc);
    if (armRRef.current) armRRef.current.rotation.x = -2.15 + swing * 0.28 - reach * 0.7;
    if (armLRef.current) armLRef.current.rotation.x = -1.15 - swing * 0.28;
    if (legRRef.current) legRRef.current.rotation.x = 0.55 - swing * 0.22;
    if (legLRef.current) legLRef.current.rotation.x = 0.8 + swing * 0.22;
    if (bodyRef.current) {
      bodyRef.current.position.y = Math.abs(swing) * 0.03;
      bodyRef.current.rotation.z = Math.sin(cyc * 0.5) * 0.03;
    }

    // ── dim / focus fade ────────────────────────────────────
    const dimGoal = dimmed ? 1 : 0;
    dimRef.current = THREE.MathUtils.damp(dimRef.current, dimGoal, 6, d);
    const op = 1 - dimRef.current * 0.8;
    const sc = 1 - dimRef.current * 0.12;
    mats.body.opacity = op;
    mats.helmet.opacity = op;
    mats.limb.opacity = op;
    mats.skin.opacity = op;
    mats.rope.opacity = (1 - dimRef.current * 0.7) * (focused ? 0.6 : 0.4);
    g.scale.setScalar(sc);
    mats.body.emissiveIntensity = focused ? 0.3 : 0.14;

    // ── rope: piton (fixed) → figure (moving) ───────────────
    if (ropeRef.current && stopPct != null) {
      const figY = g.position.y;
      const len = Math.abs(figY - pitonY);
      ropeRef.current.visible = true;
      ropeRef.current.position.y = (figY + pitonY) / 2;
      ropeRef.current.scale.y = Math.max(0.001, len);
    }

    // ── puff ────────────────────────────────────────────────
    if (puffRef.current) {
      if (puffP > 0) {
        puffRef.current.visible = true;
        puffRef.current.scale.setScalar(0.4 + puffP * 1.6);
        mats.puff.opacity = (1 - puffP) * 0.7;
      } else if (puffRef.current.visible) {
        puffRef.current.visible = false;
        mats.puff.opacity = 0;
      }
    }
  });

  const up = pct >= 0;
  const pctLabel = `${up ? "+" : ""}${pct.toFixed(1)}%`;
  const pctColor = up ? "#34d399" : "#f87171";

  return (
    <group position={[x, 0, 0]}>
      {stopPct != null && (
        <>
          <mesh geometry={PITON_GEO} position={[0, pitonY, FIGURE_Z]} material={mats.limb} />
          <mesh ref={ropeRef} geometry={ROPE_GEO} material={mats.rope} position={[0, 0, FIGURE_Z + 0.02]} />
        </>
      )}

      <group ref={figureRef} position={[0, targetYRef.current, FIGURE_Z]}>
        <mesh ref={puffRef} geometry={PUFF_GEO} material={mats.puff} position={[0, 0.7, 0]} visible={false} />

        <group ref={bodyRef}>
          {/* lean the torso in toward the rock face */}
          <group
            ref={leanRef}
            rotation={[0.32, 0, 0]}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelect(id);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              document.body.style.cursor = "";
            }}
          >
            {/* torso + hips */}
            <mesh geometry={TORSO_GEO} material={mats.body} position={[0, 0.62, 0]} />
            <mesh geometry={HIP_GEO} material={mats.limb} position={[0, 0.4, 0]} />

            {/* head + helmet */}
            <mesh geometry={HEAD_GEO} material={mats.skin} position={[0, 0.92, 0.03]} />
            <mesh geometry={HELMET_GEO} material={mats.helmet} position={[0, 0.93, 0.03]} />

            {/* arms — reaching up the wall */}
            <Limb groupRef={armRRef} pos={[0.15, 0.8, 0.02]} rot={[-2.15, 0, 0.25]} len={1.05} mat={mats.limb} />
            <Limb groupRef={armLRef} pos={[-0.15, 0.8, 0.02]} rot={[-1.15, 0, -0.3]} len={1} mat={mats.limb} />

            {/* legs — bent, feet on holds */}
            <Limb groupRef={legRRef} pos={[0.08, 0.38, 0]} rot={[0.55, 0, 0.12]} len={1.15} mat={mats.limb} />
            <Limb groupRef={legLRef} pos={[-0.08, 0.38, 0]} rot={[0.8, 0, -0.12]} len={1.1} mat={mats.limb} />

            <mesh geometry={HIT_GEO} material={mats.hit} position={[0, 0.6, 0.1]} />
          </group>
        </group>

        {/* floating label — small dark panel above the head */}
        <Billboard position={[0, 1.55, 0]}>
          <RoundedBox args={[0.92, 0.5, 0.04]} radius={0.09} smoothness={3}>
            <meshBasicMaterial color="#0c0e11" transparent opacity={0.82} />
          </RoundedBox>
          <Text position={[0, 0.11, 0.03]} fontSize={0.19} color="#e8eaed" anchorX="center" anchorY="middle" letterSpacing={0.04}>
            {ticker}
          </Text>
          <Text position={[0, -0.11, 0.03]} fontSize={0.16} color={pctColor} anchorX="center" anchorY="middle">
            {pctLabel}
          </Text>
        </Billboard>
      </group>
    </group>
  );
}
