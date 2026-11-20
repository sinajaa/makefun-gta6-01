const $ = (id) => document.getElementById(id);
const pad = (n) => (n < 10 ? '0' : '') + n;

export function createHUD() {
  const el = {
    missionTitle: $('mission-title'), missionDetail: $('mission-detail'),
    objectives: $('objectives'), waypoint: $('waypoint-distance'),
    clock: $('clock'), period: $('time-period'), money: $('money'),
    wanted: $('wanted'), district: $('district'), districtSub: $('district-sub'),
    healthFill: $('health-fill'), armourFill: $('armour-fill'),
    healthValue: $('health-value'), armourValue: $('armour-value'),
    speed: $('speed'), gear: $('gear'), needle: $('needle'),
    radioBand: $('radio-band'), radioName: $('radio-name'), radioTrack: $('radio-track'),
    radioBars: document.querySelector('.radio-bars'),
    slots: document.querySelectorAll('.slot'),
    reticle: $('reticle'), prompt: $('prompt'), notify: $('notify'),
    flash: $('flash'), speedLines: $('speed-lines'), lockHint: $('lock-hint'),
  };
  const stars = [];
  for (let i = 0; i < 5; i++) {
    const star = document.createElement('i');
    star.textContent = '\u2605';
    el.wanted.appendChild(star);
    stars.push(star);
  }
  const cache = {
    mission: '', detail: '', objectives: '', waypoint: '', clock: '', money: '',
    wanted: -1, district: '', health: -1, armour: -1, speed: -1, gear: '',
    radio: '', weapon: -1, prompt: '', notify: '', reticle: null, lines: null,
  };
  let notifyTimer = 0;
  let hitTimer = 0;

  function setMission(title, detail, objectives) {
    if (cache.mission !== title) { el.missionTitle.textContent = title; cache.mission = title; }
    if (cache.detail !== detail) { el.missionDetail.textContent = detail; cache.detail = detail; }
    const key = objectives.map((o) => (o.done ? '1' : '0') + o.text).join('|');
    if (cache.objectives !== key) {
      el.objectives.replaceChildren();
      for (const obj of objectives) {
        const li = document.createElement('li');
        li.textContent = obj.text;
        if (obj.done) li.className = 'done';
        el.objectives.appendChild(li);
      }
      cache.objectives = key;
    }
  }

  function notify(text, seconds = 2.6) {
    if (cache.notify !== text) { el.notify.textContent = text; cache.notify = text; }
    el.notify.classList.add('show');
    notifyTimer = seconds;
  }

  function hit() {
    el.flash.classList.add('hit');
    hitTimer = 0.12;
  }

  function update(s, dt) {
    if (notifyTimer > 0) {
      notifyTimer -= dt;
      if (notifyTimer <= 0) el.notify.classList.remove('show');
    }
    if (hitTimer > 0) {
      hitTimer -= dt;
      if (hitTimer <= 0) el.flash.classList.remove('hit');
    }

    const minutes = Math.floor(s.time) % 1440;
    const clockText = pad(Math.floor(minutes / 60)) + ':' + pad(minutes % 60);
    if (cache.clock !== clockText) { el.clock.textContent = clockText; cache.clock = clockText; }
    if (cache.period !== s.period) { el.period.textContent = s.period; cache.period = s.period; }

    const moneyText = 'Rp ' + Math.floor(s.money).toLocaleString('id-ID');
    if (cache.money !== moneyText) { el.money.textContent = moneyText; cache.money = moneyText; }

    if (cache.wanted !== s.wanted) {
      for (let i = 0; i < 5; i++) stars[i].classList.toggle('on', i < s.wanted);
      el.wanted.classList.toggle('hot', s.wanted >= 4);
      cache.wanted = s.wanted;
    }
    if (cache.district !== s.district) {
      el.district.textContent = s.district;
      el.districtSub.textContent = s.districtSub;
      cache.district = s.district;
    }

    const hp = Math.max(0, Math.round(s.health));
    const ar = Math.max(0, Math.round(s.armour));
    if (cache.health !== hp) {
      el.healthFill.style.width = hp + '%'; el.healthValue.textContent = hp; cache.health = hp;
    }
    if (cache.armour !== ar) {
      el.armourFill.style.width = ar + '%'; el.armourValue.textContent = ar; cache.armour = ar;
    }

    const kmh = Math.round(s.speedKmh);
    if (cache.speed !== kmh) {
      el.speed.textContent = kmh < 100 ? String(kmh) : kmh;
      el.needle.style.transform = 'rotate(' + (-140 + Math.min(kmh, 240) * 1.17) + 'deg)';
      cache.speed = kmh;
    }
    if (cache.gear !== s.gear) { el.gear.textContent = s.gear; cache.gear = s.gear; }

    const radioKey = s.radioName + s.radioTrack;
    if (cache.radio !== radioKey) {
      el.radioBand.textContent = s.radioBand;
      el.radioName.textContent = s.radioName;
      el.radioTrack.textContent = s.radioTrack;
      cache.radio = radioKey;
    }
    el.radioBars.classList.toggle('playing', s.radioPlaying);

    if (cache.weapon !== s.weapon) {
      for (let i = 0; i < el.slots.length; i++) el.slots[i].classList.toggle('active', i === s.weapon);
      cache.weapon = s.weapon;
    }
    if (cache.prompt !== s.prompt) {
      el.prompt.innerHTML = s.prompt ? '<kbd>' + s.prompt[0] + '</kbd>' + s.prompt[1] : '';
      el.prompt.classList.toggle('show', !!s.prompt);
      cache.prompt = s.prompt;
    }
    const wp = s.waypoint < 1000 ? Math.round(s.waypoint) + ' m' : (s.waypoint / 1000).toFixed(1) + ' km';
    if (cache.waypoint !== wp) { el.waypoint.textContent = wp; cache.waypoint = wp; }
    if (cache.reticle !== s.inCar) {
      el.reticle.classList.toggle('onfoot', !s.inCar);
      cache.reticle = s.inCar;
    }
    if (cache.lines !== s.speedLines) {
      el.speedLines.classList.toggle('on', s.speedLines);
      cache.lines = s.speedLines;
    }
  }

  function setLockHint(visible) { el.lockHint.classList.toggle('hidden', !visible); }

  return { setMission, update, notify, hit, setLockHint };
}
