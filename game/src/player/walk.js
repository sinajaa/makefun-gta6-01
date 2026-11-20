import * as THREE from 'three';
import { WORLD, SPAWN } from '../config.js';

const clamp = THREE.MathUtils.clamp;

function limb(material, sx, sy, sz, y) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.y = y;
  mesh.castShadow = true;
  return mesh;
}

function buildCharacter() {
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98f68, roughness: 0.86 });
  const jacket = new THREE.MeshStandardMaterial({ color: 0x1d6c70, roughness: 0.72 });
  const trousers = new THREE.MeshStandardMaterial({ color: 0x24323a, roughness: 0.9 });
  const shoes = new THREE.MeshStandardMaterial({ color: 0x11191e, roughness: 0.85 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x1c1715, roughness: 0.95 });

  const rig = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.95, 0.42), jacket);
  torso.position.y = 1.36;
  torso.castShadow = true;
  rig.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), skin);
  head.position.y = 2.04;
  head.castShadow = true;
  rig.add(head);
  const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.285, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58), hair);
  fringe.position.y = 2.07;
  fringe.castShadow = true;
  rig.add(fringe);
  const ponytail = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.34, 4, 8), hair);
  ponytail.position.set(0, 1.92, -0.26);
  ponytail.rotation.x = -0.4;
  rig.add(ponytail);

  const arms = [];
  const legs = [];
  for (let side = 0; side < 2; side++) {
    const sign = side ? 1 : -1;
    const arm = new THREE.Group();
    arm.position.set(sign * 0.47, 1.78, 0);
    arm.add(limb(jacket, 0.21, 0.68, 0.22, -0.34));
    arm.add(limb(skin, 0.19, 0.28, 0.2, -0.79));
    rig.add(arm);
    arms.push(arm);

    const leg = new THREE.Group();
    leg.position.set(sign * 0.2, 0.9, 0);
    leg.add(limb(trousers, 0.27, 0.78, 0.3, -0.39));
    const foot = limb(shoes, 0.28, 0.16, 0.46, -0.84);
    foot.position.z = 0.07;
    leg.add(foot);
    rig.add(leg);
    legs.push(leg);
  }
  return { rig, arms, legs, torso };
}

export function createWalker(scene, city, input) {
  const parts = buildCharacter();
  scene.add(parts.rig);

  const position = new THREE.Vector3(SPAWN.x, 0, SPAWN.z);
  const velocity = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const desired = new THREE.Vector3();
  let yaw = SPAWN.yaw;
  let pitch = -0.06;
  let verticalSpeed = 0;
  let grounded = true;
  let crouching = false;
  let inCover = false;
  let stride = 0;
  let speed = 0;

  function blocked(x, z) {
    const r = 0.46;
    for (let i = 0; i < city.colliders.length; i++) {
      const c = city.colliders[i];
      if (c.height < 1.2) continue;
      if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return true;
    }
    return false;
  }

  function nearCover() {
    for (let i = 0; i < city.colliders.length; i++) {
      const c = city.colliders[i];
      if (c.height < 2) continue;
      const dx = Math.max(c.minX - position.x, 0, position.x - c.maxX);
      const dz = Math.max(c.minZ - position.z, 0, position.z - c.maxZ);
      if (dx * dx + dz * dz < 5.3) return true;
    }
    return false;
  }

  function update(dt) {
    yaw -= input.mouseX() * 0.00235;
    pitch = clamp(pitch - input.mouseY() * 0.0019, -0.42, 0.34);

    let ix = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    let iz = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    const length = Math.hypot(ix, iz);
    if (length > 0) { ix /= length; iz /= length; }

    crouching = input.down('KeyC') || input.down('ControlLeft');
    inCover = crouching && nearCover();
    forward.set(Math.sin(yaw), 0, Math.cos(yaw));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    const sprinting = input.down('ShiftLeft') && iz > 0.1 && !crouching;
    const target = crouching ? 2.5 : sprinting ? 9.1 : 5.4;
    desired.copy(forward).multiplyScalar(iz).addScaledVector(right, ix).multiplyScalar(target);
    const blend = 1 - Math.exp(-dt * (grounded ? 12 : 3));
    velocity.x += (desired.x - velocity.x) * blend;
    velocity.z += (desired.z - velocity.z) * blend;
    speed = Math.hypot(velocity.x, velocity.z);

    if (input.pressed('Space') && grounded) {
      verticalSpeed = 7.6;
      grounded = false;
    }
    verticalSpeed -= 21 * dt;
    position.y += verticalSpeed * dt;
    const ground = city.groundHeight(position.x, position.z);
    if (position.y <= ground) {
      position.y = ground;
      verticalSpeed = 0;
      grounded = true;
    }

    const nx = position.x + velocity.x * dt;
    if (!blocked(nx, position.z)) position.x = nx;
    else velocity.x = 0;
    const nz = position.z + velocity.z * dt;
    if (!blocked(position.x, nz)) position.z = nz;
    else velocity.z = 0;
    position.x = clamp(position.x, -WORLD.bounds, WORLD.bounds);
    position.z = clamp(position.z, -WORLD.bounds, WORLD.seaStart - 8);

    stride += dt * speed * 1.7;
    const swing = Math.sin(stride) * Math.min(speed / 6, 1) * 0.7;
    parts.legs[0].rotation.x = swing;
    parts.legs[1].rotation.x = -swing;
    parts.arms[0].rotation.x = -swing * 0.75;
    parts.arms[1].rotation.x = swing * 0.75;
    parts.torso.rotation.z = Math.sin(stride) * 0.025;
    parts.arms[0].rotation.z = -0.12;
    parts.arms[1].rotation.z = 0.12;

    const crouchOffset = crouching ? 0.55 : 0;
    parts.rig.position.set(position.x, position.y - crouchOffset, position.z);
    parts.rig.rotation.y = yaw;
    parts.rig.scale.y = crouching ? 0.78 : 1;
  }

  function setVisible(visible) { parts.rig.visible = visible; }

  function teleport(x, z, heading = yaw) {
    position.set(x, 0, z);
    velocity.set(0, 0, 0);
    verticalSpeed = 0;
    yaw = heading;
    parts.rig.position.set(x, 0, z);
    parts.rig.rotation.y = yaw;
  }

  return {
    position, forward, update, setVisible, teleport,
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    get speed() { return speed; },
    get crouching() { return crouching; },
    get inCover() { return inCover; },
    get grounded() { return grounded; },
  };
}
