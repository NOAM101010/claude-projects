/**
 * CITY EMPIRE — Third-person player controller (MASTER §15, §16).
 *
 * Owns the authoritative player transform (kept in refs, not the store,
 * to avoid per-frame re-renders). Each frame it:
 *   1. reads keyboard/mouse input,
 *   2. moves the body relative to the orbit camera's yaw,
 *   3. applies gravity + jumping over flat ground,
 *   4. drives a follow camera (mouse orbit via pointer lock),
 *   5. resolves the closest interactable and lets E trigger it.
 *
 * Collision in the foundation is flat-ground only; world colliders come
 * with the district phase. Movement is intentionally snappy, not floaty.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import { CAMERA, INTERACTION, PLAYER } from '../core/config';
import { input } from '../core/input';
import { log } from '../core/log';
import { usePlayerStore } from '../state/usePlayerStore';
import { useInteractionStore } from '../interaction/useInteractionStore';
import { PlayerCharacter } from './PlayerCharacter';

export function Player() {
  const bodyRef = useRef<Group>(null);
  const camera = useThree((s) => s.camera);

  // Authoritative transform state (refs → no re-render).
  const pos = useRef(new Vector3(...PLAYER.spawn));
  const velY = useRef(0);
  const grounded = useRef(true);
  const facing = useRef(0); // body yaw (radians)
  const strideRef = useRef(0);

  // Orbit camera angles.
  const camYaw = useRef(Math.PI); // start looking toward -Z (into the scene)
  const camPitch = useRef(0.35);

  const snapshotTimer = useRef(0);

  const setPositionSnapshot = usePlayerStore((s) => s.setPositionSnapshot);
  const resolveFocus = useInteractionStore((s) => s.resolveFocus);
  const triggerFocused = useInteractionStore((s) => s.triggerFocused);

  // Interact on E (single press, no auto-repeat).
  useEffect(() => {
    const off = input.onPress(INTERACTION.key, () => triggerFocused());
    log('Player', 'Player controller online. WASD move, Shift sprint, Space jump, E interact.');
    return off;
  }, [triggerFocused]);

  // Scratch vectors (avoid per-frame allocation).
  const scratch = useMemo(
    () => ({ move: new Vector3(), camTarget: new Vector3(), camDesired: new Vector3() }),
    [],
  );

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05); // clamp long frames (tab switch)
    const body = bodyRef.current;
    if (!body) return;

    // --- Camera orbit from mouse ---
    const m = input.consumeMouseDelta();
    camYaw.current -= m.x * CAMERA.orbitSensitivity;
    camPitch.current = Math.min(
      CAMERA.maxPitch,
      Math.max(CAMERA.minPitch, camPitch.current + m.y * CAMERA.orbitSensitivity),
    );

    // --- Movement input relative to camera yaw ---
    let ix = 0;
    let iz = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) iz += 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) iz -= 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) ix -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) ix += 1;

    const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;

    const move = scratch.move.set(0, 0, 0);
    const sin = Math.sin(camYaw.current);
    const cos = Math.cos(camYaw.current);
    // Forward = direction camera faces (projected to ground).
    if (ix !== 0 || iz !== 0) {
      // forward vector (into screen) and right vector from yaw
      const fwdX = -sin;
      const fwdZ = -cos;
      const rightX = cos;
      const rightZ = -sin;
      move.x = fwdX * iz + rightX * ix;
      move.z = fwdZ * iz + rightZ * ix;
      move.normalize();

      // Face movement direction (smoothed).
      const targetYaw = Math.atan2(move.x, move.z);
      let diff = targetYaw - facing.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      facing.current += diff * PLAYER.rotationLerp;
    }

    const moving = move.lengthSq() > 0;
    pos.current.x += move.x * speed * delta;
    pos.current.z += move.z * speed * delta;

    // --- Jump + gravity over flat ground ---
    if (grounded.current && input.isDown('Space')) {
      velY.current = PLAYER.jumpSpeed;
      grounded.current = false;
    }
    velY.current += PLAYER.gravity * delta;
    pos.current.y += velY.current * delta;
    if (pos.current.y <= 0) {
      pos.current.y = 0;
      velY.current = 0;
      grounded.current = true;
    }

    // Walk-cycle amplitude eases toward how fast we're moving.
    const targetStride = moving ? (sprint ? 1.4 : 1) : 0;
    strideRef.current += (targetStride - strideRef.current) * 0.2;

    // --- Apply transform ---
    body.position.copy(pos.current);
    body.rotation.y = facing.current;

    // --- Follow camera ---
    const target = scratch.camTarget.copy(pos.current);
    target.y += CAMERA.lookHeight;
    const horiz = Math.cos(camPitch.current) * CAMERA.distance;
    const desired = scratch.camDesired.set(
      pos.current.x + Math.sin(camYaw.current) * horiz,
      pos.current.y + CAMERA.height + Math.sin(camPitch.current) * CAMERA.distance,
      pos.current.z + Math.cos(camYaw.current) * horiz,
    );
    camera.position.lerp(desired, CAMERA.followLerp);
    camera.lookAt(target);

    // --- Interaction focus resolution ---
    resolveFocus([pos.current.x, pos.current.y, pos.current.z]);

    // --- Low-frequency position snapshot for HUD/save ---
    snapshotTimer.current += delta;
    if (snapshotTimer.current >= 0.2) {
      snapshotTimer.current = 0;
      setPositionSnapshot([
        +pos.current.x.toFixed(2),
        +pos.current.y.toFixed(2),
        +pos.current.z.toFixed(2),
      ]);
    }
  });

  return (
    <group ref={bodyRef}>
      <PlayerCharacter strideRef={strideRef} />
    </group>
  );
}
