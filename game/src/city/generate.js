import * as THREE from 'three';
import { WORLD, PALETTE, DISTRICTS, districtAt } from '../config.js';

const DEG = Math.PI / 180;
const LINES = [];
const CENTRES = [];
for (let i = 0; i <= WORLD.half * 2 / WORLD.block; i++) LINES.push(-WORLD.half + i * WORLD.block);
for (let i = 0; i < LINES.length - 1; i++) CENTRES.push(LINES[i] + WORLD.block * 0.5);

const dummy = new THREE.Object3D();
const tint = new THREE.Color();

class Batch {
  constructor(geometry, material, name) {
    this.geometry = geometry;
    this.material = material;
    this.name = name;
    this.matrices = [];
    this.colors = [];
  }

  add(x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, color = null) {
    this.matrices.push(x, y, z, rx, ry, rz, sx, sy, sz);
    if (color !== null) this.colors.push(color);
  }

  finish(parent, cast = false, receive = false) {
    const count = this.matrices.length / 9;
    if (!count) return null;
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, count);
    mesh.name = this.name;
    for (let i = 0; i < count; i++) {
      const o = i * 9;
      dummy.position.set(this.matrices[o], this.matrices[o + 1], this.matrices[o + 2]);
      dummy.rotation.set(this.matrices[o + 3], this.matrices[o + 4], this.matrices[o + 5]);
      dummy.scale.set(this.matrices[o + 6], this.matrices[o + 7], this.matrices[o + 8]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (this.colors.length) mesh.setColorAt(i, tint.setHex(this.colors[i]));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    mesh.frustumCulled = false;
    parent.add(mesh);
    return mesh;
  }
}

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function asphaltTexture(random) {
  const texture = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#5d6467';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const v = 60 + Math.floor(random.next() * 90);
      ctx.fillStyle = `rgba(${v},${v + 4},${v + 6},${0.08 + random.next() * 0.22})`;
      ctx.fillRect(random.next() * w, random.next() * h, 1 + random.next() * 3, 1 + random.next() * 9);
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(46, 46);
  return texture;
}

function signTexture(word, color) {
  return canvasTexture(256, 96, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#07131ad9';
    ctx.fillRect(2, 2, w - 4, h - 4);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.strokeRect(7, 7, w - 14, h - 14);
    ctx.font = 'bold 46px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff4dc';
    ctx.fillText(word, w / 2, h / 2 + 2);
  });
}

function makeMaterials(random) {
  const asphalt = asphaltTexture(random);
  return {
    road: new THREE.MeshStandardMaterial({
      color: PALETTE.asphalt, roughness: 0.34, metalness: 0.24,
      roughnessMap: asphalt, bumpMap: asphalt, bumpScale: 0.035,
    }),
    ground: new THREE.MeshStandardMaterial({ color: 0x4e564f, roughness: 1 }),
    sand: new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 0.98 }),
    concrete: new THREE.MeshStandardMaterial({ color: PALETTE.concrete, roughness: 0.9 }),
    blocks: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0.08 }),
    glassBlocks: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.24, metalness: 0.48 }),
    detail: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 }),
    emissive: new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }),
    wood: new THREE.MeshStandardMaterial({ color: 0x8b6442, roughness: 0.9 }),
    leaf: new THREE.MeshStandardMaterial({ color: PALETTE.palmLeaf, roughness: 1, side: THREE.DoubleSide }),
    pool: new THREE.MeshStandardMaterial({ color: 0x2bb6c4, metalness: 0.4, roughness: 0.12 }),
  };
}

function addGround(root, materials) {
  const base = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), materials.ground);
  base.rotation.x = -Math.PI / 2;
  base.scale.set(WORLD.half * 2, WORLD.seaStart + WORLD.half, 1);
  base.position.set(0, -0.04, (WORLD.seaStart - WORLD.half) / 2);
  base.receiveShadow = true;
  root.add(base);

  const sand = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), materials.sand);
  sand.rotation.x = -Math.PI / 2;
  sand.scale.set(WORLD.half * 2, WORLD.seaStart - WORLD.beachStart, 1);
  sand.position.set(0, 0.01, (WORLD.beachStart + WORLD.seaStart) / 2);
  sand.receiveShadow = true;
  root.add(sand);
}

function addRoads(root, materials, random, batches) {
  const plane = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < LINES.length; i++) {
    const line = LINES[i];
    const eastWest = new THREE.Mesh(plane, materials.road);
    eastWest.rotation.x = -Math.PI / 2;
    eastWest.scale.set(WORLD.half * 2, WORLD.roadWidth, 1);
    eastWest.position.set(0, 0.015, line);
    eastWest.receiveShadow = true;
    root.add(eastWest);

    const northSouth = new THREE.Mesh(plane, materials.road);
    northSouth.rotation.x = -Math.PI / 2;
    northSouth.scale.set(WORLD.roadWidth, WORLD.half * 2, 1);
    northSouth.position.set(line, 0.016, 0);
    northSouth.receiveShadow = true;
    root.add(northSouth);
  }

  const nearJunction = (v) => {
    for (let j = 0; j < LINES.length; j++) if (Math.abs(v - LINES[j]) < WORLD.roadWidth * 0.8) return true;
    return false;
  };
  for (let i = 0; i < LINES.length; i++) {
    const line = LINES[i];
    for (let t = -WORLD.half + 12; t < WORLD.half - 8; t += 13) {
      if (nearJunction(t)) continue;
      batches.lines.add(t, 0.04, line, 4.2, 0.02, 0.17, 0, 0, 0, PALETTE.line);
      batches.lines.add(line, 0.04, t, 0.17, 0.02, 4.2, 0, 0, 0, PALETTE.line);
    }
  }

  for (let a = 1; a < LINES.length - 1; a++) {
    for (let b = 1; b < LINES.length - 1; b++) {
      const x = LINES[a];
      const z = LINES[b];
      for (let k = 0; k < 6; k++) {
        const offset = (k - 2.5) * 3.05;
        const edge = WORLD.roadWidth * 0.5 + 3.2;
        batches.lines.add(x + offset, 0.045, z - edge, 1.45, 0.02, 5.6, 0, 0, 0, PALETTE.crosswalk);
        batches.lines.add(x + offset, 0.045, z + edge, 1.45, 0.02, 5.6, 0, 0, 0, PALETTE.crosswalk);
        batches.lines.add(x - edge, 0.045, z + offset, 5.6, 0.02, 1.45, 0, 0, 0, PALETTE.crosswalk);
        batches.lines.add(x + edge, 0.045, z + offset, 5.6, 0.02, 1.45, 0, 0, 0, PALETTE.crosswalk);
      }
      if ((a + b) % 2 === 0) {
        batches.lights.add(x + 15, 0.1, z + 15, 0.35, 0.2, 0.35, 0, 0, 0, 0x3f6f65);
        batches.poles.add(x + 15, 3.2, z + 15, 0.22, 6.4, 0.22, 0, 0, 0, PALETTE.steel);
        batches.lamps.add(x + 15, 6.45, z + 15, 0.9, 0.18, 0.4, 0, 0, 0, 0xffd79a);
        if (random.chance(0.45)) {
          batches.poles.add(x - 15, 2.4, z - 15, 0.18, 4.8, 0.18, 0, 0, 0, PALETTE.steel);
          batches.lamps.add(x - 15, 4.9, z - 15, 0.5, 0.2, 0.5, 0, 0, 0, 0xff9c4b);
        }
      }
    }
  }
}

function addPalm(batches, x, z, scale = 1, color = PALETTE.palmLeaf) {
  const h = 7 * scale;
  batches.trunks.add(x, h * 0.5, z, 0.42 * scale, h, 0.42 * scale, 0, 0, 0.06, PALETTE.palmTrunk);
  for (let f = 0; f < 6; f++) {
    const angle = (f / 6) * Math.PI * 2;
    const reach = 3.2 * scale;
    batches.fronds.add(
      x + Math.cos(angle) * reach * 0.5,
      h - 0.2 + Math.sin(f * 1.7) * 0.3,
      z + Math.sin(angle) * reach * 0.5,
      5.6 * scale, 0.11 * scale, 0.85 * scale,
      -0.24, angle, 0.1, color,
    );
  }
}

function addBuildings(root, materials, batches, colliders, random, pois) {
  const lot = WORLD.block - WORLD.roadWidth - WORLD.sidewalk * 2;
  const cell = lot * 0.5;
  let towerSign = 0;
  const signWords = ['SERAI', 'SORAK', 'API 88', 'KOTA', 'Raya'];

  for (let i = 0; i < CENTRES.length; i++) {
    for (let j = 0; j < CENTRES.length; j++) {
      const cx = CENTRES[i];
      const cz = CENTRES[j];
      batches.pavement.add(cx, 0.11, cz, WORLD.block - WORLD.roadWidth, 0.22, WORLD.block - WORLD.roadWidth, 0, 0, 0, PALETTE.pavement);
      const edge = (WORLD.block - WORLD.roadWidth) * 0.5;
      batches.kerbs.add(cx - edge, 0.24, cz, 0.55, 0.32, edge * 2, 0, 0, 0, PALETTE.kerb);
      batches.kerbs.add(cx + edge, 0.24, cz, 0.55, 0.32, edge * 2, 0, 0, 0, PALETTE.kerb);
      batches.kerbs.add(cx, 0.24, cz - edge, edge * 2, 0.32, 0.55, 0, 0, 0, PALETTE.kerb);
      batches.kerbs.add(cx, 0.24, cz + edge, edge * 2, 0.32, 0.55, 0, 0, 0, PALETTE.kerb);

      const market = i === 3 && j === 3;
      const yard = i >= 7 && j >= 3 && j <= 5;
      const marina = i >= 7 && j >= 7;
      const beach = j === 8 && !marina;
      const hills = i >= 5 && j <= 2;
      const plaza = !market && !yard && !marina && !beach && random.chance(0.035);

      if (market) {
        addMarket(root, batches, colliders, cx, cz, random);
        pois.push({ x: cx, z: cz, label: 'PASAR LAMA', type: 'market' });
        continue;
      }
      if (yard) {
        addContainerYard(root, batches, colliders, cx, cz, random);
        continue;
      }
      if (marina) {
        addMarina(root, batches, colliders, cx, cz, random);
        continue;
      }
      if (beach) {
        addBeachBlock(batches, colliders, cx, cz, random);
        continue;
      }
      if (hills) {
        addVillaBlock(batches, colliders, cx, cz, random);
        continue;
      }
      if (plaza) {
        batches.plaza.add(cx, 0.24, cz, lot, 0.1, lot, 0, 0, 0, 0x8d8677);
        for (let p = 0; p < 4; p++) addPalm(batches, cx + (p % 2 ? 20 : -20), cz + (p > 1 ? 20 : -20), 0.85);
        continue;
      }

      const district = districtAt(cx, cz);
      for (let a = 0; a < 2; a++) {
        for (let b = 0; b < 2; b++) {
          if (random.chance(0.08)) continue;
          const bx = cx + (a ? 1 : -1) * cell * 0.5;
          const bz = cz + (b ? 1 : -1) * cell * 0.5;
          const w = cell - random.range(3, 6);
          const d = cell - random.range(3, 6);
          let height;
          if (district === DISTRICTS[3]) height = random.range(9, 20);
          else if (district === DISTRICTS[5]) height = random.range(7, 22);
          else if (district === DISTRICTS[6]) height = random.range(10, 30);
          else height = random.range(10, 28);
          if (cx > 0 && cz > -192 && cz < 192 && random.chance(0.42)) height += random.range(18, 58);
          if (random.chance(0.12)) height += random.range(8, 22);
          height = Math.round(height);

          const glassy = height > 34 || random.chance(0.18);
          const baseColor = glassy
            ? [0x2d5b66, 0x3a4f63, 0x4a5e60][random.int(0, 2)]
            : [PALETTE.wall, 0xa08f76, 0x8c8577, 0xbfae91][random.int(0, 3)];
          const batch = glassy ? batches.towers : batches.buildings;
          batch.add(bx, height * 0.5, bz, w, height, d, 0, 0, 0, baseColor);
          batches.roofs.add(bx, height + 0.35, bz, w * 0.96, 0.7, d * 0.96, 0, 0, 0, 0x575a55);
          colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2, height });

          const rows = Math.min(15, Math.floor((height - 2.5) / 3.15));
          const colsW = Math.min(8, Math.max(3, Math.floor((w - 1) / 2.7)));
          const colsD = Math.min(8, Math.max(3, Math.floor((d - 1) / 2.7)));
          for (let r = 0; r < rows; r++) {
            const y = 2.6 + r * 3.15;
            for (let c = 0; c < colsW; c++) {
              if (!random.chance(glassy ? 0.76 : 0.52)) continue;
              const wx = bx - w / 2 + (c + 0.5) * (w / colsW);
              const glow = random.chance(0.78) ? PALETTE.windowWarm : PALETTE.windowCool;
              batches.windows.add(wx, y, bz + d / 2 + 0.03, w / colsW * 0.52, 1.35, 1, 0, 0, 0, glow);
              if (random.chance(0.55)) batches.windows.add(wx, y, bz - d / 2 - 0.03, w / colsW * 0.52, 1.35, 1, 0, Math.PI, 0, glow);
            }
            for (let c = 0; c < colsD; c++) {
              if (!random.chance(glassy ? 0.7 : 0.42)) continue;
              const wz = bz - d / 2 + (c + 0.5) * (d / colsD);
              const glow = random.chance(0.7) ? PALETTE.windowWarm : PALETTE.windowCool;
              batches.windows.add(bx + w / 2 + 0.03, y, wz, d / colsD * 0.52, 1.35, 1, 0, Math.PI / 2, 0, glow);
            }
          }
          if (height > 45 && towerSign < 4 && random.chance(0.22)) {
            addBillboard(root, bx, height + 9, bz, signWords[towerSign++], glassy ? 0x6de8d0 : 0xffa45c);
          }
        }
      }
      if (random.chance(0.55)) addPalm(batches, cx - edge + 4, cz - edge + 4, 0.7);
    }
  }
}

function addBillboard(root, x, y, z, word, color) {
  const texture = signTexture(word, color);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 4.5),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }),
  );
  sign.position.set(x, y, z);
  sign.rotation.y = Math.PI * 0.25;
  root.add(sign);
}

function addMarket(root, batches, colliders, cx, cz, random) {
  batches.plaza.add(cx, 0.23, cz, WORLD.block - WORLD.roadWidth, 0.12, WORLD.block - WORLD.roadWidth, 0, 0, 0, 0x8b6f53);
  const words = ['SATE', 'MIE', 'KOPI', 'WARUNG', 'JAJANAN', 'PASAR', 'ES', 'IKAN'];
  const colors = ['#ff5f8f', '#ffc36b', '#6de8d0', '#8ad4ff'];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 5; col++) {
      const x = cx - 25 + col * 12.5;
      const z = cz + (row ? 15 : -15);
      batches.stalls.add(x, 1.1, z, 8, 2.2, 5, 0, 0, 0, [0x8c5b3f, 0x6e6a55, 0x9d6a4c][random.int(0, 2)]);
      batches.canopies.add(x, 2.7, z, 9.2, 0.35, 6, 0.06, 0, (col % 2 ? 1 : -1) * 0.08, [0xc4483f, 0x2f9c9c, 0xd7a33b, 0x6b4b8c][random.int(0, 3)]);
      for (let p = 0; p < 4; p++) {
        batches.poles.add(x + (p % 2 ? 3.8 : -3.8), 1.6, z + (p > 1 ? 2.4 : -2.4), 0.12, 3.2, 0.12, 0, 0, 0, 0x4b4b43);
      }
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(5.4, 2),
        new THREE.MeshBasicMaterial({ map: signTexture(words[(row * 5 + col) % words.length], colors[random.int(0, 3)]), transparent: true, side: THREE.DoubleSide }),
      );
      sign.position.set(x, 4.1, z + (row ? 3 : -3));
      sign.rotation.y = row ? 0 : Math.PI;
      root.add(sign);
      if (col % 2 === 0) colliders.push({ minX: x - 4, maxX: x + 4, minZ: z - 2.5, maxZ: z + 2.5, height: 2.4 });
    }
  }
  for (let k = 0; k < 28; k++) {
    const x = cx - 33 + (k % 14) * 5;
    const z = cz - 30 + Math.floor(k / 14) * 60;
    batches.lanterns.add(x, 5.4 + Math.sin(k) * 0.4, z, 0.34, 0.34, 0.34, 0, 0, 0, [0xff5f8f, 0xffc36b, 0x6de8d0][k % 3]);
  }
  addPalm(batches, cx - 34, cz - 34, 0.8);
  addPalm(batches, cx + 34, cz + 34, 0.8);
}

function addContainerYard(root, batches, colliders, cx, cz, random) {
  batches.yard.add(cx, 0.19, cz, WORLD.block - WORLD.roadWidth, 0.14, WORLD.block - WORLD.roadWidth, 0, 0, 0, 0x747970);
  for (let x = -2; x <= 2; x++) {
    for (let z = -1; z <= 1; z++) {
      if (random.chance(0.14)) continue;
      const stacks = random.int(1, 3);
      const px = cx + x * 12;
      const pz = cz + z * 16;
      for (let s = 0; s < stacks; s++) {
        batches.containers.add(px, 1.8 + s * 3.3, pz, 11.2, 3.1, 3.4, 0, 0, 0, random.pick(PALETTE.container));
      }
      colliders.push({ minX: px - 5.6, maxX: px + 5.6, minZ: pz - 1.7, maxZ: pz + 1.7, height: stacks * 3.3 });
    }
  }
  const craneX = cx + 26;
  batches.poles.add(craneX - 18, 12, cz - 22, 1.1, 24, 1.1, 0, 0, 0, 0xd7a33b);
  batches.poles.add(craneX + 18, 12, cz - 22, 1.1, 24, 1.1, 0, 0, 0, 0xd7a33b);
  batches.beams.add(craneX, 25, cz - 22, 46, 1.8, 2.2, 0, 0, 0, 0xd7a33b);
  batches.beams.add(craneX, 25, cz + 10, 2, 1.2, 48, 0, 0, 0, 0xe0b04a);
}

function addMarina(root, batches, colliders, cx, cz, random) {
  batches.yard.add(cx, 0.2, cz, WORLD.block - WORLD.roadWidth, 0.14, WORLD.block - WORLD.roadWidth, 0, 0, 0, 0x999184);
  const low = random.chance(0.5);
  if (low) {
    const w = 25;
    const d = 18;
    batches.buildings.add(cx, 5, cz - 12, w, 10, d, 0, 0, 0, 0xd8c6a3);
    batches.roofs.add(cx, 10.3, cz - 12, w, 0.7, d, 0, 0, 0, 0x4b5a5d);
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - 21, maxZ: cz - 3, height: 10 });
    for (let k = 0; k < 6; k++) {
      batches.windows.add(cx - 9 + k * 3.6, 6, cz - 2.8, 1.5, 2, 1, 0, 0, 0, PALETTE.windowWarm);
    }
  }
  const dockZ = Math.min(cz + 24, WORLD.seaStart + 12);
  for (let p = 0; p < 3; p++) {
    const dx = cx - 24 + p * 24;
    batches.beams.add(dx, 0.5, dockZ, 3.2, 0.8, 54, 0, 0, 0, 0x7a5b3d);
    for (let q = 0; q < 5; q++) batches.poles.add(dx, 1.6, dockZ - 20 + q * 10, 0.4, 2.6, 0.4, 0, 0, 0, 0x594634);
    if (p !== 1) {
      batches.boats.add(dx, 0.9, dockZ + 15, 3.6, 1.6, 11, 0, random.range(-0.2, 0.2), 0, [0xe9e3d4, 0x4a7f91, 0xb45841][p]);
      batches.beams.add(dx, 3.1, dockZ + 15, 0.2, 3.2, 0.2, 0, 0, 0, 0xe9e3d4);
    }
  }
  addPalm(batches, cx - 32, cz - 30, 1.05);
  addPalm(batches, cx + 30, cz - 30, 0.95);
}

function addBeachBlock(batches, colliders, cx, cz, random) {
  for (let k = 0; k < 7; k++) {
    const x = cx - 36 + k * 12;
    batches.beams.add(x, 0.3, cz - 24, 10, 0.25, 3.4, 0, 0, 0, 0x9a7550);
    if (k % 2 === 0) addPalm(batches, x + 2, cz + random.range(8, 28), random.range(0.85, 1.2));
  }
  if (random.chance(0.72)) {
    const x = cx + random.range(-14, 14);
    const z = cz - 12;
    batches.stalls.add(x, 2, z, 14, 4, 8, 0, 0, 0, 0xc9b896);
    batches.canopies.add(x, 4.6, z, 15, 0.4, 9, 0.05, 0, 0, 0x2f9c9c);
    colliders.push({ minX: x - 7, maxX: x + 7, minZ: z - 4, maxZ: z + 4, height: 4 });
  }
}

function addVillaBlock(batches, colliders, cx, cz, random) {
  for (let a = 0; a < 2; a++) {
    for (let b = 0; b < 2; b++) {
      if (random.chance(0.2)) continue;
      const x = cx + (a ? 1 : -1) * 22;
      const z = cz + (b ? 1 : -1) * 22;
      const terrace = 2.4 + random.range(0, 3);
      batches.pads.add(x, terrace * 0.5, z, 42, terrace, 42, 0, 0, 0, 0x9c9687);
      batches.villas.add(x, terrace + 2.6, z, 19, 5.2, 15, 0, 0, 0, 0xe8e2d2);
      batches.roofs.add(x, terrace + 5.4, z, 20, 0.6, 16, 0, 0, 0, 0x576a6a);
      batches.pools.add(x + 12, terrace + 0.2, z + 10, 8, 0.2, 5, 0, 0, 0, 0x39b9c7);
      colliders.push({ minX: x - 9.5, maxX: x + 9.5, minZ: z - 7.5, maxZ: z + 7.5, height: terrace + 5.2 });
      addPalm(batches, x - 16, z - 16, 0.9);
      if (random.chance(0.5)) addPalm(batches, x + 15, z - 15, 1);
    }
  }
}

function addCoast(batches, colliders, random, pois) {
  for (let x = -WORLD.half + 8; x <= WORLD.half - 8; x += 16) {
    batches.wall.add(x, 1.4, WORLD.wallZ, 15.5, 2.8, 2.4, 0, 0, 0, 0xa89f8f);
    if (random.chance(0.22)) addPalm(batches, x + random.range(-5, 5), WORLD.beachStart + random.range(18, 70), random.range(0.9, 1.25));
  }
  colliders.push({ minX: -WORLD.half, maxX: WORLD.half, minZ: WORLD.wallZ - 2, maxZ: WORLD.wallZ + 2, height: 2.8 });
  for (let i = 0; i < 18; i++) {
    const x = -WORLD.half + 20 + i * 54;
    batches.lamps.add(x, 3.2, WORLD.beachStart + 4, 0.5, 0.3, 0.5, 0, 0, 0, 0xffbed3);
    batches.poles.add(x, 1.6, WORLD.beachStart + 4, 0.16, 3.2, 0.16, 0, 0, 0, 0x4e4a42);
  }
  pois.push({ x: 96, z: 360, label: 'PANTAI KACA', type: 'beach' });
  pois.push({ x: -288, z: 360, label: 'DERMAGA LIMA', type: 'pier' });
  pois.push({ x: 336, z: 96, label: 'GUDANG UTARA', type: 'yard' });
  pois.push({ x: 240, z: -240, label: 'BUKIT SERAI', type: 'villa' });
}

function makeCarSpawns(random) {
  const spawns = [];
  const push = (x, z, angle) => spawns.push({ x, z, angle });
  push(-48, -144, Math.PI / 2);
  push(-144, -48, 0);
  push(48, -144, Math.PI / 2);
  push(-240, -144, Math.PI / 2);
  push(-288, 144, 0);
  push(-192, 240, Math.PI / 2);
  push(96, -240, 0);
  push(240, -288, Math.PI / 2);
  push(336, 48, Math.PI / 2);
  push(96, 240, 0);
  push(192, 336, 0);
  push(-384, 336, Math.PI / 2);
  push(384, -96, 0);
  push(-48, 144, Math.PI / 2);
  push(288, -48, 0);
  push(-336, -240, Math.PI / 2);
  for (let i = 0; i < spawns.length; i++) {
    spawns[i].angle += random.range(-0.04, 0.04);
  }
  return spawns;
}

export function generateCity(scene, random) {
  const root = new THREE.Group();
  root.name = 'Teluk Api';
  scene.add(root);
  const materials = makeMaterials(random);
  const colliders = [];
  const pois = [];
  const batches = {
    buildings: new Batch(new THREE.BoxGeometry(1, 1, 1), materials.blocks, 'buildings'),
    towers: new Batch(new THREE.BoxGeometry(1, 1, 1), materials.glassBlocks, 'glass towers'),
    roofs: new Batch(new THREE.BoxGeometry(1, 1, 1), materials.detail, 'roofs'),
    windows: new Batch(new THREE.PlaneGeometry(1, 1), materials.emissive, 'windows'),
    pavement: new Batch(new THREE.BoxGeometry(1, 1, 1), materials.detail, 'pavements'),
    kerbs: new Batch(new THREE.BoxGeometry(1, 1, 1), materials.detail, 'kerbs'),
    lines: new Batch(new THREE.BoxGeometry(1, 1, 1), materials.emissive, 'road paint'),
    lights: new Batch(new THREE.BoxGeometry(1, 1, 1), materials.detail, 'bollards'),
    poles: new Batch(new THREE.CylinderGeometry(0.5, 0.5, 1, 6), materials.detail, 'poles'),
    lamps: new Batch(new THREE.BoxGeometry(1, 1, 1), materials.emissive, 'lamps'),
    trunks: new Batch(new THREE.CylinderGeometry(0.7, 1, 1, 6), materials.detail, 'palm trunks'),
    fronds: new Batch(new THREE.BoxGeometry(1, 1, 1), materials.leaf, 'palm fronds'),
    plaza: new Batch(new THREE.BoxGeometry(1, 1, 1), materials.detail, 'plazas'),
    stalls: new Batch(new THREE.BoxGeometry(1, 1, 1), materials.detail, 'stalls'),
    canopies: new Batch(new THREE.BoxGeometry(1, 1, 1), materials.detail, 'canopies'),
    lanterns: new Batch(new THREE.IcosahedronGeometry(0.5, 0), materials.emissive, 'lanterns'),
    yard: new Batch(new THREE.BoxGeometry(1, 1, 1), materials.concrete, 'yard pads'),
    containers: new Batch(new THREE.BoxGeometry(1, 1, 1), materials.detail, 'containers'),
    beams: new Batch(new THREE.BoxGeometry(1, 1, 1), materials.wood, 'beams'),
    boats: new Batch(new THREE.BoxGeometry(1, 1, 1), materials.detail, 'boats'),
    pads: new Batch(new THREE.BoxGeometry(1, 1, 1), materials.detail, 'villa terraces'),
    villas: new Batch(new THREE.BoxGeometry(1, 1, 1), materials.detail, 'villas'),
    pools: new Batch(new THREE.BoxGeometry(1, 1, 1), materials.pool, 'pools'),
    wall: new Batch(new THREE.BoxGeometry(1, 1, 1), materials.concrete, 'seawall'),
  };

  addGround(root, materials);
  addRoads(root, materials, random, batches);
  addBuildings(root, materials, batches, colliders, random, pois);
  addCoast(batches, colliders, random, pois);

  const shadowCasters = ['buildings', 'towers', 'stalls', 'containers', 'villas', 'wall', 'boats', 'pads'];
  const receivers = ['buildings', 'towers', 'pavement', 'plaza', 'yard', 'containers', 'villas', 'wall', 'pads'];
  for (const key of Object.keys(batches)) {
    batches[key].finish(root, shadowCasters.includes(key), receivers.includes(key));
  }

  return {
    root,
    colliders,
    pois,
    carSpawns: makeCarSpawns(random),
    roads: LINES.slice(),
    seaStart: WORLD.seaStart,
    groundHeight: () => 0,
  };
}
