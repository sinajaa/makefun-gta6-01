const TAU = Math.PI * 2;

export function createMinimap(canvas, city) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const centre = size * 0.5;
  const scale = centre / 185;
  let sweep = 0;

  function draw(player, cars, pois, waypoint, dt) {
    sweep = (sweep + dt * 1.4) % TAU;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(centre, centre, centre - 3, 0, TAU);
    ctx.clip();

    ctx.fillStyle = '#08151b';
    ctx.fillRect(0, 0, size, size);

    ctx.translate(centre, centre);
    ctx.rotate(-player.heading);
    ctx.scale(1, -1);
    ctx.translate(-player.x * scale, -player.z * scale);
    ctx.scale(scale, scale);

    ctx.fillStyle = '#0b3241';
    ctx.fillRect(-700, city.seaStart, 1400, 500);
    ctx.fillStyle = '#1b2728';
    ctx.fillRect(-520, -520, 1040, city.seaStart + 520);

    ctx.strokeStyle = '#4b6368';
    ctx.lineWidth = 0.9 / scale;
    for (let i = 0; i < city.roads.length; i++) {
      const line = city.roads[i];
      ctx.beginPath();
      ctx.moveTo(-520, line);
      ctx.lineTo(520, line);
      ctx.moveTo(line, -520);
      ctx.lineTo(line, city.seaStart);
      ctx.stroke();
    }

    ctx.fillStyle = '#ff7a45';
    for (let i = 0; i < pois.length; i++) {
      const poi = pois[i];
      ctx.fillRect(poi.x - 2.4, poi.z - 2.4, 4.8, 4.8);
    }

    ctx.fillStyle = '#ffd27a';
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      ctx.fillRect(car.x - 2, car.z - 2, 4, 4);
    }

    const pulse = 3 + Math.sin(sweep * 2) * 0.8;
    ctx.strokeStyle = '#6de8d0';
    ctx.lineWidth = 1.4 / scale;
    ctx.beginPath();
    ctx.moveTo(waypoint.x - pulse, waypoint.z);
    ctx.lineTo(waypoint.x, waypoint.z + pulse);
    ctx.lineTo(waypoint.x + pulse, waypoint.z);
    ctx.lineTo(waypoint.x, waypoint.z - pulse);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(centre, centre, centre - 3, 0, TAU);
    ctx.clip();
    ctx.strokeStyle = '#6de8d033';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(centre, centre);
    ctx.arc(centre, centre, centre - 3, sweep - 0.5, sweep);
    ctx.closePath();
    ctx.fillStyle = '#6de8d00d';
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#ffd39a';
    ctx.beginPath();
    ctx.moveTo(centre, centre - 9);
    ctx.lineTo(centre - 6, centre + 7);
    ctx.lineTo(centre, centre + 3);
    ctx.lineTo(centre + 6, centre + 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#06131a';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.strokeStyle = '#9bd8cf66';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centre, centre, centre - 2, 0, TAU);
    ctx.stroke();
  }

  return { draw };
}
