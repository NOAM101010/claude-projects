/**
 * CITY EMPIRE — Render root.
 *
 * Sets up the R3F canvas, cinematic lighting (a warm key sun with shadows +
 * soft sky fill), atmospheric fog, a light bloom pass, and mouse-look via
 * pointer lock. Keeps the scene graph itself (world + player) declarative.
 *
 * PERFORMANCE NOTES (read before adding lights/shadows):
 * - Real-time point/spot lights are expensive — every one re-lights every
 *   fragment of every lit object in the scene. We use exactly ONE dynamic
 *   shadow-casting light (the sun). Decorative glows (street lamps) are
 *   emissive materials + bloom, not real lights.
 * - `dpr` is capped at 1.5 — on high-DPI/4K displays, dpr:2 quietly renders
 *   4x the pixels of dpr:1 and was the single biggest cause of stutter.
 * - The shadow camera frustum is sized to just cover the starter district,
 *   not an arbitrary big box — a tighter frustum means a sharper AND cheaper
 *   shadow map at the same resolution.
 */

import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { ACESFilmicToneMapping } from 'three';
import { Player } from './player/Player';
import { StarterDistrict } from './world/StarterDistrict';
import { input } from './core/input';
import { FpsMeter } from './core/FpsMeter';

/** Requests pointer lock on click and feeds mouse deltas to the input service. */
function PointerLook() {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const el = gl.domElement;

    const requestLock = () => {
      if (document.pointerLockElement !== el) el.requestPointerLock?.();
    };
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement === el) input.addMouseDelta(e.movementX, e.movementY);
    };

    el.addEventListener('click', requestLock);
    document.addEventListener('mousemove', onMove);
    return () => {
      el.removeEventListener('click', requestLock);
      document.removeEventListener('mousemove', onMove);
    };
  }, [gl]);

  return null;
}

export function GameCanvas() {
  useEffect(() => {
    input.start();
    return () => input.stop();
  }, []);

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [0, 6, 14], fov: 55, near: 0.1, far: 300 }}
      gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.15;
      }}
    >
      {/* Sky + atmosphere */}
      <Sky sunPosition={[40, 30, -20]} turbidity={4} rayleigh={1} mieCoefficient={0.004} />
      <fog attach="fog" args={['#c3d2df', 40, 130]} />

      {/* Lighting: ONE dynamic shadow-casting sun + a cheap ambient/hemisphere fill. */}
      <hemisphereLight args={['#dfe9f2', '#463f30', 0.6]} />
      <directionalLight
        position={[40, 45, -20]}
        intensity={2.4}
        color="#fff3df"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-32}
        shadow-camera-right={32}
        shadow-camera-top={32}
        shadow-camera-bottom={-32}
        shadow-camera-near={1}
        shadow-camera-far={110}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />

      <PointerLook />
      <StarterDistrict />
      <Player />

      {/* Subtle bloom (sells the emissive lamp glow cheaply) + vignette. */}
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur luminanceThreshold={1} intensity={0.5} radius={0.5} />
        <Vignette eskil={false} offset={0.15} darkness={0.6} />
      </EffectComposer>

      <FpsMeter />
    </Canvas>
  );
}
