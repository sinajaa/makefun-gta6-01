export const SEED = 0x5EA1C0;

export const WORLD = {
  half: 480,
  block: 96,
  roadWidth: 22,
  sidewalk: 8,
  beachStart: 312,
  seaStart: 408,
  wallZ: 406,
  bounds: 470,
};

export const TIME = {
  startMinutes: 1062,
  minutesPerSecond: 1.35,
};

export const PALETTE = {
  asphalt: 0x252c31,
  asphaltWet: 0x1c272c,
  line: 0xe7d6ad,
  crosswalk: 0xf2e7cd,
  kerb: 0x9b978b,
  pavement: 0x6e6d64,
  sand: 0xd6b585,
  sea: 0x0d4a5b,
  concrete: 0x9d9a8e,
  steel: 0x53636a,
  glass: 0x234653,
  windowWarm: 0xffc46b,
  windowCool: 0x8fe6dc,
  palmTrunk: 0x6b4d32,
  palmLeaf: 0x2e6b49,
  wall: 0xb9a383,
  roof: 0x714b3b,
  neon: 0xff5f8f,
  container: [0xc4583c, 0x2f8d8d, 0xdca43c, 0x4b668c, 0x8e5b9c],
  car: [0xd9d5c9, 0xb44034, 0x2f5a76, 0xd9a23e, 0x3c7a6b, 0x8e9096, 0x6b3f6e],
};

export const DISTRICTS = [
  { name: 'PASAR LAMA', sub: 'OLD MARKET', color: '#ffc36b', x: -144, z: -144 },
  { name: 'KOTA TUA', sub: 'COLONIAL QUAY', color: '#e9b48a', x: -240, z: 144 },
  { name: 'DERMAGA LIMA', sub: 'PIER FIVE', color: '#6de8d0', x: -288, z: 336 },
  { name: 'BUKIT SERAI', sub: 'VILLA HEIGHTS', color: '#c7b0ff', x: 240, z: -240 },
  { name: 'GUDANG UTARA', sub: 'CONTAINER YARD', color: '#ff8a5b', x: 336, z: 96 },
  { name: 'PANTAI KACA', sub: 'GLASS BEACH', color: '#7fd9ff', x: 96, z: 336 },
  { name: 'TANJUNG HARAPAN', sub: 'HOPE POINT', color: '#ffd58a', x: 384, z: 360 },
];

export function districtAt(x, z) {
  if (x >= 240 && z >= 240) return DISTRICTS[6];
  if (x >= 240) return DISTRICTS[4];
  if (z >= 240 && x < 0) return DISTRICTS[2];
  if (z >= 240) return DISTRICTS[5];
  if (x >= 96 && z < 0) return DISTRICTS[3];
  if (x < 0 && z >= 0) return DISTRICTS[1];
  return DISTRICTS[0];
}

export const RADIO = [
  { name: 'SORAK', band: '104.7', track: 'Synthwave Pantai' },
  { name: 'RANTAU FM', band: '96.1', track: 'Dangdut Modern' },
  { name: 'API', band: '88.3', track: 'Talk — Serai Ring' },
];

export const WEAPONS = ['FIST', 'PST-L', 'SHT-G', 'SMG', 'RFL'];

export const SPAWN = { x: -100, z: -144, yaw: Math.PI * 0.5 };

export const START_MISSION = {
  title: 'Repossession',
  detail: 'Lio needs his car back. Borrow one from the street.',
  objectives: [
    { text: 'Find a vehicle in Pasar Lama', done: false },
    { text: 'Drive to the Dermaga Lima drop', done: false },
    { text: 'Meet Mira at the pier', done: false },
  ],
};

export const WAYPOINT = { x: -288, z: 336 };
