import * as THREE from 'three';
import { SEED, TIME, START_MISSION, WAYPOINT, RADIO, SPAWN } from './config.js';
import { createRandom, hashString } from './random.js';
import { generateCity } from './city/generate.js';
import { createLighting } from './city/lighting.js';
import { createWalker } from './player/walk.js';
import { createCarFleet, nearestCar, exitPosition } from './vehicles/car.js';
import { createCameraRig } from './camera/rig.js';
import { createInput } from './input.js';
import { createHUD } from './hud.js';
import { createMinimap } from './minimap.js';

const STEP = 1 / 60;
const query = new URLSearchParams(location.search);
const seed = Number(query.get('seed')) || SEED;
const shot = query.get('shot') || 'play';
const random = createRandom((seed ^ hashString(shot)) >>> 0);

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.15, 3200);
camera.position.set(SPAWN.x, 3, SPAWN.z + 6);

const input = createInput(canvas);
const city = generateCity(scene, random);
const lighting = createLighting(scene, renderer, city);
const walker = createWalker(scene, city, input);
const cars = createCarFleet(scene, city, random);
const rig = createCameraRig(camera);
const hud = createHUD();
const minimap = createMinimap(document.getElementById('minimap'), city);

const objectives = START_MISSION.objectives.map((o) => ({ text: o.text, done: o.done }));
let mode = 'foot';
let activeCar = null;
let nearbyCar = null;
let clock = TIME.startMinutes;
let elapsed = 0;
let money = 1250;
let wanted = 0;
let health = 100;
let armour = 50;
let weapon = 0;
let radioIndex = 0;
let hudTime = 0;
let hudAccumulator = 0;
let frameCount = 0;

const playerPosition = new THREE.Vector3();
const waypoint = { x: WAYPOINT.x, z: WAYPOINT.z };
const hudState = {
  time: clock, period: 'SORE', money, wanted, district: 'PASAR LAMA', districtSub: 'OLD MARKET',
  health, armour, speedKmh: 0, gear: 'N', radioName: RADIO[0].name, radioBand: RADIO[0].band,
  radioTrack: RADIO[0].track, radioPlaying: true, weapon, prompt: null, waypoint: 0,
  inCar: false, speedLines: false,
};

function periodName(minutes) {
  const hour = Math.floor(minutes / 60);
  if (hour < 5) return 'LARUT';
  if (hour < 11) return 'PAGI';
  if (hour < 15) return 'SIANG';
  if (hour < 18) return 'SORE';
  if (hour < 21) return 'MALAM';
  return 'LARUT';
}

function enterCar(car) {
  car.setControlled(true);
  activeCar = car;
  mode = 'car';
  rig.setMode('car');
  walker.setVisible(false);
  wanted = Math.max(wanted, 1);
  if (!objectives[0].done) {
    objectives[0].done = true;
    hud.setMission(START_MISSION.title, START_MISSION.detail, objectives);
    hud.notify('Mobil diam-bil. Pergi ke Dermaga Lima.');
  } else {
    hud.notify('Masuk mobil — TAPD mencatat plat nomor.');
  }
}

function leaveCar() {
  const spot = exitPosition(activeCar);
  const alternative = {
    x: activeCar.x - Math.cos(activeCar.heading) * 3.1,
    z: activeCar.z + Math.sin(activeCar.heading) * 3.1,
  };
  activeCar.setControlled(false);
  activeCar = null;
  mode = 'foot';
  rig.setMode('foot');
  walker.setVisible(true);
  if (walker.teleport) walker.teleport(spot.x, spot.z, spot.heading);
  hud.notify('Keluar dari kendaraan.');
  void alternative;
}

function interact() {
  if (mode === 'foot') {
    const car = nearestCar(cars, walker.position.x, walker.position.z, 5.4);
    if (car) enterCar(car);
    else hud.notify('Tidak ada kendaraan di dekatmu.');
  } else {
    leaveCar();
  }
}

function applyShot(name) {
  if (name === 'cover') {
    clock = 1058;
    wanted = 4;
    const car = cars.find((item) => Math.abs(item.x - 96) < 80 && Math.abs(item.z - 336) < 80) || cars[9];
    if (car) enterCar(car);
    waypoint.x = 240;
    waypoint.z = 336;
  } else if (name === 'foot') {
    clock = 1290;
    wanted = 3;
    weapon = 2;
    walker.teleport(-144, -120, Math.PI * 0.2);
    waypoint.x = -144;
    waypoint.z = -240;
  } else if (name === 'menu') {
    clock = 1050;
    walker.teleport(240, -240, -1.1);
    rig.addMouse(-160, 40);
  } else if (name === 'play') {
    hud.notify('JOB 01 — Ambil mobil di Pasar Lama.');
  }
}

function simulate(dt) {
  elapsed += dt;
  clock = (clock + dt * TIME.minutesPerSecond) % 1440;

  if (input.pressed('KeyF')) interact();
  if (input.pressed('KeyR')) {
    radioIndex = (radioIndex + 1) % RADIO.length;
    hud.notify('RADIO — ' + RADIO[radioIndex].name + ' ' + RADIO[radioIndex].band);
  }
  if (input.pressed('KeyH') && activeCar) {
    const on = activeCar.toggleHeadlights();
    hud.notify('Lampu depan ' + (on ? 'menyala' : 'mati') + '.');
  }
  if (input.pressed('KeyJ') && activeCar) {
    rig.addShake(0.12);
    hud.notify('Klapakson!');
  }
  for (let i = 0; i < 5; i++) {
    if (input.pressed('Digit' + (i + 1))) {
      weapon = i;
      hud.notify('Senjata: ' + ['Tangan kosong', 'Pistol', 'Shotgun', 'SMG', 'Rifle'][i]);
    }
  }

  if (mode === 'foot') {
    walker.update(dt);
    playerPosition.copy(walker.position);
    nearbyCar = nearestCar(cars, walker.position.x, walker.position.z, 5.4);
  } else {
    activeCar.update(dt, input);
    rig.addMouse(input.mouseX(), input.mouseY());
    playerPosition.copy(activeCar.position);
    nearbyCar = null;
    if (activeCar.blocked) rig.addShake(0.18);
    if (activeCar.drifting) rig.addShake(0.035);
  }

  const dx = playerPosition.x - waypoint.x;
  const dz = playerPosition.z - waypoint.z;
  if (!objectives[1].done && dx * dx + dz * dz < 32 * 32) {
    objectives[1].done = true;
    money += 2500;
    hud.setMission(START_MISSION.title, START_MISSION.detail, objectives);
    hud.notify('Drop sampai. +Rp 2.500');
  }
  input.endFrame();
}

function updateHud(dt) {
  const car = activeCar;
  const district = city && playerPosition ? districtFor(playerPosition.x, playerPosition.z) : null;
  hudState.time = clock;
  hudState.period = periodName(clock);
  hudState.money = money;
  hudState.wanted = wanted;
  hudState.district = district.name;
  hudState.districtSub = district.sub;
  hudState.health = health;
  hudState.armour = armour;
  hudState.speedKmh = car ? Math.abs(car.speed) * 3.6 : walker.speed * 2.2;
  hudState.gear = car ? (car.speed < -0.5 ? 'R' : car.speed < 0.5 ? 'N' : String(Math.min(5, 1 + Math.floor(Math.abs(car.speed) / 11)))) : 'JALAN';
  hudState.radioName = RADIO[radioIndex].name;
  hudState.radioBand = RADIO[radioIndex].band;
  hudState.radioTrack = RADIO[radioIndex].track;
  hudState.radioPlaying = true;
  hudState.weapon = weapon;
  hudState.prompt = mode === 'car' ? ['F', 'KELUAR MOBIL'] : nearbyCar ? ['F', 'AMBIL MOBIL'] : null;
  hudState.waypoint = Math.hypot(playerPosition.x - waypoint.x, playerPosition.z - waypoint.z);
  hudState.inCar = mode === 'car';
  hudState.speedLines = !!car && car.speed > 32;
  hud.update(hudState, dt);
}

function districtFor(x, z) {
  // District lookup is kept local to the frame path so config stays a pure data module.
  if (x >= 240 && z >= 240) return { name: 'TANJUNG HARAPAN', sub: 'HOPE POINT' };
  if (x >= 240) return { name: 'GUDANG UTARA', sub: 'CONTAINER YARD' };
  if (z >= 240 && x < 0) return { name: 'DERMAGA LIMA', sub: 'PIER FIVE' };
  if (z >= 240) return { name: 'PANTAI KACA', sub: 'GLASS BEACH' };
  if (x >= 96 && z < 0) return { name: 'BUKIT SERAI', sub: 'VILLA HEIGHTS' };
  if (x < 0 && z >= 0) return { name: 'KOTA TUA', sub: 'COLONIAL QUAY' };
  return { name: 'PASAR LAMA', sub: 'OLD MARKET' };
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});

input.setLockCallback((locked) => hud.setLockHint(!locked));
hud.setMission(START_MISSION.title, START_MISSION.detail, objectives);
applyShot(shot);
playerPosition.copy(mode === 'car' && activeCar ? activeCar.position : walker.position);
hud.setLockHint(!input.locked());

let last = performance.now();
let accumulator = 0;

function loop(now) {
  requestAnimationFrame(loop);
  let delta = (now - last) / 1000;
  last = now;
  if (delta > 0.1) delta = 0.1;
  accumulator += delta;
  let steps = 0;
  while (accumulator >= STEP && steps < 4) {
    simulate(STEP);
    accumulator -= STEP;
    steps++;
  }

  rig.update(delta, walker, activeCar || {
    position: walker.position, heading: walker.yaw, speed: 0, drifting: false,
  });
  lighting.update(clock, playerPosition, camera, elapsed);
  updateHud(delta);
  frameCount++;
  if (frameCount % 2 === 0) {
    minimap.draw({ x: playerPosition.x, z: playerPosition.z, heading: mode === 'car' ? activeCar.heading : walker.yaw }, cars, city.pois, waypoint, delta * 2);
  }
  renderer.render(scene, camera);
  hudAccumulator += delta;
  if (hudAccumulator > 1) hudAccumulator = 0;
  void hudTime;
}
requestAnimationFrame(loop);
