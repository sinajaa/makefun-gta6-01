import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;

export function createCameraRig(camera) {
  const desired = new THREE.Vector3();
  const focus = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  let mode = 'foot';
  let orbitYaw = 0;
  let orbitPitch = 0;
  let shake = 0;
  let shakeTime = 0;

  function addMouse(dx, dy) {
    orbitYaw = clamp(orbitYaw - dx * 0.0022, -1.35, 1.35);
    orbitPitch = clamp(orbitPitch - dy * 0.0015, -0.5, 0.45);
  }

  function addShake(amount) { shake = Math.min(1.1, shake + amount); }

  function setMode(next) {
    mode = next;
    orbitYaw = 0;
    orbitPitch = 0;
    if (next === 'car') lookTarget.copy(camera.position);
  }

  function update(dt, walker, car) {
    shakeTime += dt;
    let blend;
    let targetFov;

    if (mode === 'car') {
      const heading = car.heading + orbitYaw;
      forward.set(Math.sin(heading), 0, Math.cos(heading));
      right.set(Math.cos(heading), 0, -Math.sin(heading));
      const speed = car.speed;
      const distance = 8.6 + speed * 0.055 + (car.drifting ? 1.3 : 0);
      const height = 3.35 + speed * 0.012 + orbitPitch * 2.2;
      desired.copy(car.position)
        .addScaledVector(forward, -distance)
        .addScaledVector(right, car.drifting ? Math.sin(shakeTime * 4) * 0.7 : 0);
      desired.y = height;
      focus.copy(car.position).addScaledVector(forward, 7 + speed * 0.07);
      focus.y = 1.5 + orbitPitch * 1.5;
      blend = 1 - Math.exp(-dt * 5.4);
      targetFov = 69 + Math.min(speed * 0.33, 19);
    } else {
      const heading = walker.yaw;
      forward.set(Math.sin(heading), 0, Math.cos(heading));
      right.set(Math.cos(heading), 0, -Math.sin(heading));
      const crouch = walker.crouching ? 0.5 : 0;
      const distance = walker.crouching ? 3.3 : 4.5;
      desired.copy(walker.position)
        .addScaledVector(forward, -distance)
        .addScaledVector(right, 0.82)
        .addScaledVector(forward, walker.pitch * 1.6);
      desired.y = walker.position.y + 1.95 - crouch + walker.pitch * 2.4;
      focus.copy(walker.position).addScaledVector(forward, 3.4);
      focus.y = walker.position.y + 1.42 - crouch + walker.pitch * 1.1;
      blend = 1 - Math.exp(-dt * 9);
      targetFov = 68;
    }

    camera.position.lerp(desired, blend);
    lookTarget.lerp(focus, Math.min(1, blend * 1.3));
    camera.lookAt(lookTarget);
    if (camera.fov !== targetFov) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4);
      camera.updateProjectionMatrix();
    }

    if (shake > 0.001) {
      const amplitude = shake * 0.22;
      camera.position.x += Math.sin(shakeTime * 63) * amplitude;
      camera.position.y += Math.sin(shakeTime * 79 + 1.7) * amplitude * 0.7;
      shake *= Math.exp(-dt * 4.5);
    }
  }

  return { update, addMouse, addShake, setMode, get mode() { return mode; } };
}
