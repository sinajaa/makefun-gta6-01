import * as THREE from 'three';

const SKY_VERTEX = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAGMENT = `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uSun;
uniform vec3 uSunDir;
varying vec3 vDir;
void main() {
  float h = vDir.y;
  vec3 col = mix(uHorizon, uTop, smoothstep(-0.02, 0.72, h));
  col = mix(uBottom, col, smoothstep(-0.32, -0.01, h));
  float d = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
  col += uSun * (pow(d, 1400.0) * 5.0 + pow(d, 28.0) * 0.42);
  col = mix(col, uHorizon, exp(-abs(h) * 10.0) * 0.28);
  gl_FragColor = vec4(col, 1.0);
}`;

const SEA_VERTEX = `
uniform float uTime;
varying vec3 vWorld;
varying float vWave;
void main() {
  vec3 p = position;
  float w = sin(p.x * 0.055 + uTime * 0.85) * 0.34
          + sin(p.y * 0.083 - uTime * 0.62) * 0.22
          + sin((p.x + p.y) * 0.021 + uTime * 0.31) * 0.4;
  p.z += w;
  vWave = w;
  vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const SEA_FRAGMENT = `
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSun;
uniform vec3 uSunDir;
varying vec3 vWorld;
varying float vWave;
void main() {
  vec3 view = normalize(cameraPosition - vWorld);
  float fresnel = pow(1.0 - max(view.y, 0.0), 3.2);
  vec3 col = mix(uDeep, uShallow, clamp(fresnel * 0.8 + vWave * 0.11 + 0.12, 0.0, 1.0));
  vec3 reflected = reflect(-normalize(uSunDir), vec3(0.0, 1.0, 0.0));
  float glint = pow(max(dot(reflected, view), 0.0), 220.0);
  float shimmer = pow(max(sin(vWorld.x * 0.12 + vWorld.z * 0.07) * 0.5 + 0.5, 0.0), 18.0);
  col += uSun * (glint * 3.5 + shimmer * fresnel * 0.22);
  gl_FragColor = vec4(col, 0.97);
}`;

function flareTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 3, 128, 128, 126);
  gradient.addColorStop(0, 'rgba(255,255,240,1)');
  gradient.addColorStop(0.08, 'rgba(255,222,160,0.95)');
  gradient.addColorStop(0.22, 'rgba(255,150,80,0.38)');
  gradient.addColorStop(0.55, 'rgba(255,108,60,0.10)');
  gradient.addColorStop(1, 'rgba(255,80,40,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createLighting(scene, renderer, city) {
  const skyUniforms = {
    uTop: { value: new THREE.Color(0x2f6f9e) },
    uHorizon: { value: new THREE.Color(0xffb56f) },
    uBottom: { value: new THREE.Color(0x2a3942) },
    uSun: { value: new THREE.Color(0xffd9a0) },
    uSunDir: { value: new THREE.Vector3(-1, 0.1, 0.2) },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(2400, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms, vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT,
      side: THREE.BackSide, depthWrite: false, fog: false,
    }),
  );
  sky.renderOrder = -1000;
  scene.add(sky);

  const seaUniforms = {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color(0x0a3e50) },
    uShallow: { value: new THREE.Color(0x2a8f9c) },
    uSun: { value: new THREE.Color(0xffd39a) },
    uSunDir: { value: skyUniforms.uSunDir.value },
  };
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1, 72, 36),
    new THREE.ShaderMaterial({
      uniforms: seaUniforms, vertexShader: SEA_VERTEX, fragmentShader: SEA_FRAGMENT,
      transparent: true, side: THREE.DoubleSide,
    }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.scale.set(2600, 1400, 1);
  sea.position.set(0, -0.18, city.seaStart + 690);
  sea.renderOrder = -900;
  scene.add(sea);

  const sun = new THREE.DirectionalLight(0xffb56f, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -155;
  sun.shadow.camera.right = 155;
  sun.shadow.camera.top = 155;
  sun.shadow.camera.bottom = -155;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 620;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.045;
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(0xffd7ac, 0x18323d, 1.5);
  scene.add(hemi);
  const fill = new THREE.DirectionalLight(0x79c6dd, 0.5);
  fill.position.set(80, 90, -120);
  scene.add(fill);

  const fog = new THREE.FogExp2(0xc4936f, 0.00175);
  scene.fog = fog;

  const flare = new THREE.Sprite(new THREE.SpriteMaterial({
    map: flareTexture(), blending: THREE.AdditiveBlending, transparent: true,
    depthWrite: false, depthTest: false, fog: false, opacity: 0.75,
  }));
  flare.scale.set(250, 250, 1);
  flare.renderOrder = 1000;
  scene.add(flare);

  const sunDir = skyUniforms.uSunDir.value;
  const topDay = new THREE.Color(0x2f6f9e);
  const topNight = new THREE.Color(0x071224);
  const horizonGold = new THREE.Color(0xffa95f);
  const horizonDay = new THREE.Color(0xc8dedb);
  const horizonNight = new THREE.Color(0x11263a);
  const sunGold = new THREE.Color(0xff9450);
  const sunNoon = new THREE.Color(0xfff1d0);
  const fogGold = new THREE.Color(0xc4936f);
  const fogNight = new THREE.Color(0x0d1e2c);
  const seaDeepDay = new THREE.Color(0x0a3e50);
  const seaDeepNight = new THREE.Color(0x061a29);
  const seaShallowDay = new THREE.Color(0x2a8f9c);
  const seaShallowNight = new THREE.Color(0x16485a);
  const tmp = new THREE.Vector3();

  function update(minutes, playerPosition, camera, elapsed) {
    const t = (minutes % 1440) / 1440;
    const angle = (t - 0.25) * Math.PI * 2;
    const elevation = Math.sin(angle) * 0.95;
    sunDir.set(Math.cos(angle) * 0.96, Math.max(-0.18, elevation), Math.sin(angle) * 0.72).normalize();

    const day = THREE.MathUtils.smoothstep(elevation, -0.12, 0.22);
    const gold = 1 - THREE.MathUtils.smoothstep(elevation, 0.06, 0.52);

    skyUniforms.uTop.value.copy(topNight).lerp(topDay, day);
    skyUniforms.uHorizon.value.copy(horizonNight).lerp(horizonDay, day).lerp(horizonGold, gold * 0.88 * day);
    skyUniforms.uBottom.value.copy(horizonNight).lerp(fogGold, day * 0.35);
    skyUniforms.uSun.value.copy(sunGold).lerp(sunNoon, 1 - gold);

    sun.color.copy(sunGold).lerp(sunNoon, 1 - gold);
    sun.intensity = (0.22 + day * (1.1 + gold * 2.1));
    hemi.intensity = 0.32 + day * 1.25;
    fill.intensity = 0.12 + day * 0.42;
    tmp.copy(playerPosition);
    sun.target.position.copy(tmp);
    sun.target.updateMatrixWorld();
    sun.position.copy(tmp).addScaledVector(sunDir, 190);
    sun.visible = sun.intensity > 0.28;
    sky.position.copy(camera.position);
    sky.updateMatrixWorld();

    fog.color.copy(fogNight).lerp(fogGold, day * (0.55 + gold * 0.45));
    fog.density = 0.00135 + gold * 0.0007;
    renderer.toneMappingExposure = 0.88 + day * 0.3 - gold * 0.05;

    seaUniforms.uTime.value = elapsed;
    seaUniforms.uDeep.value.copy(seaDeepNight).lerp(seaDeepDay, day);
    seaUniforms.uShallow.value.copy(seaShallowNight).lerp(seaShallowDay, day);

    flare.position.copy(camera.position).addScaledVector(sunDir, 1050);
    flare.material.opacity = day * (0.22 + gold * 0.72);
    flare.visible = day > 0.12 && sunDir.y > -0.05;
  }

  return { update, sun, sea, sky, flare };
}
