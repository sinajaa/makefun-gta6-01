import * as THREE from 'three';
import { PALETTE, WORLD } from '../config.js';

const clamp = THREE.MathUtils.clamp;

function buildCarMesh(color) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.34, metalness: 0.52 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x172026, roughness: 0.5, metalness: 0.4 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x16323a, roughness: 0.12, metalness: 0.7 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff0c8 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff3d2e });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.72, 4.4), bodyMat);
  body.position.y = 0.78;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const bonnet = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.22, 1.15), bodyMat);
  bonnet.position.set(0, 1.16, 1.35);
  bonnet.castShadow = true;
  group.add(bonnet);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.76, 2.15), glassMat);
  cabin.position.set(0, 1.48, -0.2);
  cabin.castShadow = true;
  group.add(cabin);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.16, 1.85), bodyMat);
  roof.position.set(0, 1.89, -0.25);
  roof.castShadow = true;
  group.add(roof);

  for (const side of [-1, 1]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.22), trimMat);
    mirror.position.set(side * 1.06, 1.45, 0.45);
    group.add(mirror);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.22, 0.12), lampMat);
    head.position.set(side * 0.68, 0.94, 2.24);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.1), tailMat);
    tail.position.set(side * 0.7, 0.92, -2.23);
    group.add(tail);
  }
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.18, 0.18), trimMat);
  bumper.position.set(0, 0.55, 2.26);
  group.add(bumper);

  const wheelGeometry = new THREE.CylinderGeometry(0.46, 0.46, 0.3, 12);
  wheelGeometry.rotateZ(Math.PI / 2);
  const rubber = new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.95 });
  const hub = new THREE.MeshStandardMaterial({ color: 0xaab2b3, roughness: 0.4, metalness: 0.7 });
  const wheels = [];
  const steerers = [];
  for (let i = 0; i < 4; i++) {
    const front = i < 2;
    const side = i % 2 ? 1 : -1;
    const pivot = new THREE.Group();
    pivot.position.set(side * 1.02, 0.47, front ? 1.45 : -1.45);
    const wheel = new THREE.Mesh(wheelGeometry, rubber);
    wheel.castShadow = true;
    pivot.add(wheel);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.32, 10), hub);
    cap.geometry.rotateZ(Math.PI / 2);
    pivot.add(cap);
    group.add(pivot);
    wheels.push(wheel);
    if (front) steerers.push(pivot);
  }
  return { group, wheels, steerers, lampMat, tailMat };
}

export function createCarFleet(scene, city, random) {
  const cars = [];
  for (let i = 0; i < city.carSpawns.length; i++) {
    const spawn = city.carSpawns[i];
    const color = PALETTE.car[i % PALETTE.car.length];
    const parts = buildCarMesh(color);
    parts.group.position.set(spawn.x, 0, spawn.z);
    parts.group.rotation.y = spawn.angle;
    scene.add(parts.group);

    const headlight = new THREE.SpotLight(0xffe4b4, 0, 85, Math.PI / 7, 0.45, 1.2);
    headlight.position.set(0, 1.05, 1.6);
    headlight.target.position.set(0, -0.3, 30);
    parts.group.add(headlight);
    parts.group.add(headlight.target);
    headlight.visible = false;

    cars.push({
      ...parts,
      headlight,
      position: parts.group.position,
      x: spawn.x,
      z: spawn.z,
      heading: spawn.angle,
      velocityX: 0,
      velocityZ: 0,
      steer: 0,
      spin: 0,
      speed: 0,
      headlights: false,
      controlled: false,
      drifting: false,
      blocked: false,

      update(dt, input) {
        if (!this.controlled) return;
        const throttle = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
        const steerInput = (input.down('KeyA') ? 1 : 0) - (input.down('KeyD') ? 1 : 0);
        const handbrake = input.down('Space');
        const brake = input.down('KeyS') && this.speed > 1;

        const fx = Math.sin(this.heading);
        const fz = Math.cos(this.heading);
        const rx = Math.cos(this.heading);
        const rz = -Math.sin(this.heading);
        let forwardSpeed = this.velocityX * fx + this.velocityZ * fz;
        let lateralSpeed = this.velocityX * rx + this.velocityZ * rz;

        const accel = throttle > 0 ? 17.5 : brake ? -24 : throttle < 0 ? -10 : 0;
        forwardSpeed += accel * dt;
        forwardSpeed -= forwardSpeed * (0.36 + Math.abs(forwardSpeed) * 0.013) * dt;
        if (handbrake) forwardSpeed -= forwardSpeed * 1.1 * dt;
        forwardSpeed = clamp(forwardSpeed, -11, 54);

        this.steer += (steerInput - this.steer) * Math.min(1, dt * 9);
        const grip = handbrake ? 0.55 : 7.6;
        lateralSpeed *= Math.exp(-grip * dt);
        const turn = this.steer * clamp(forwardSpeed / 9, -1.1, 1.1) * (handbrake ? 2.1 : 1.5);
        this.heading += turn * dt;
        this.drifting = handbrake && Math.abs(forwardSpeed) > 6 && Math.abs(lateralSpeed) > 1.2;

        const nfx = Math.sin(this.heading);
        const nfz = Math.cos(this.heading);
        const nrx = Math.cos(this.heading);
        const nrz = -Math.sin(this.heading);
        this.velocityX = nfx * forwardSpeed + nrx * lateralSpeed;
        this.velocityZ = nfz * forwardSpeed + nrz * lateralSpeed;

        let nx = this.x + this.velocityX * dt;
        let nz = this.z + this.velocityZ * dt;
        this.blocked = false;
        if (!this.hit(nx, this.z)) this.x = nx;
        else { this.velocityX *= -0.18; this.blocked = true; }
        if (!this.hit(this.x, nz)) this.z = nz;
        else { this.velocityZ *= -0.18; this.blocked = true; }
        if (this.blocked) { forwardSpeed *= 0.72; lateralSpeed *= 0.4; }
        this.x = clamp(this.x, -WORLD.bounds, WORLD.bounds);
        this.z = clamp(this.z, -WORLD.bounds, WORLD.seaStart - 7);
        this.speed = Math.hypot(this.velocityX, this.velocityZ);

        this.spin += forwardSpeed * dt * 2.1;
        for (const wheel of this.wheels) wheel.rotation.x = this.spin;
        for (const steerer of this.steerers) steerer.rotation.y = -this.steer * 0.42;
        this.group.position.set(this.x, 0, this.z);
        this.group.rotation.y = this.heading;
      },

      hit(x, z) {
        const r = 1.45;
        for (let i = 0; i < city.colliders.length; i++) {
          const c = city.colliders[i];
          if (c.height < 0.9) continue;
          if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return true;
        }
        return false;
      },

      setControlled(active) {
        this.controlled = active;
        this.headlight.visible = active && this.headlights;
        if (!active) {
          this.velocityX = 0;
          this.velocityZ = 0;
          this.speed = 0;
        }
      },

      toggleHeadlights() {
        this.headlights = !this.headlights;
        this.headlight.visible = this.controlled && this.headlights;
        return this.headlights;
      },

      placeOutside(x, z, heading) {
        this.x = x;
        this.z = z;
        this.heading = heading;
        this.velocityX = 0;
        this.velocityZ = 0;
        this.speed = 0;
        this.group.position.set(x, 0, z);
        this.group.rotation.y = heading;
      },
    });
  }
  return cars;
}

export function nearestCar(cars, x, z, maxDistance = 5.2) {
  let best = null;
  let bestDistance = maxDistance * maxDistance;
  for (let i = 0; i < cars.length; i++) {
    const car = cars[i];
    const dx = car.x - x;
    const dz = car.z - z;
    const distance = dx * dx + dz * dz;
    if (distance < bestDistance) { bestDistance = distance; best = car; }
  }
  return best;
}

export function exitPosition(car) {
  return { x: car.x + Math.cos(car.heading) * 3.1, z: car.z - Math.sin(car.heading) * 3.1, heading: car.heading };
}
