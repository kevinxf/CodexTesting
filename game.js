const canvas = document.querySelector("#game");
const statusText = document.querySelector("#status");
const ctx = canvas.getContext("2d");

const keys = new Set();
window.addEventListener("keydown", (e) => keys.add(e.code));
window.addEventListener("keyup", (e) => keys.delete(e.code));

const camera = {
  yaw: 0.35,
  pitch: -0.35,
  distance: 15,
  height: 7,
  fov: 700,
};

let dragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
canvas.addEventListener("mousedown", (e) => {
  dragging = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});
window.addEventListener("mouseup", () => (dragging = false));
window.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastMouseX;
  const dy = e.clientY - lastMouseY;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;

  camera.yaw -= dx * 0.004;
  camera.pitch = Math.max(-1.15, Math.min(-0.08, camera.pitch - dy * 0.003));
});

const platforms = [
  { x: 0, y: -0.5, z: 0, w: 12, h: 1, d: 12, color: "#4f9af5" },
  { x: 8, y: 0.5, z: -1, w: 4, h: 1, d: 4, color: "#426296" },
  { x: 13.5, y: 2.5, z: 2, w: 3.5, h: 1, d: 3.5, color: "#426296" },
  { x: 19.5, y: 5, z: -1, w: 3.2, h: 1, d: 3.2, color: "#426296" },
  { x: 25.5, y: 7.8, z: 2.5, w: 2.8, h: 1, d: 2.8, color: "#426296" },
  { x: 32, y: 10.8, z: -1.5, w: 3.2, h: 1, d: 3.2, color: "#426296" },
  { x: 38.5, y: 13.3, z: 2, w: 4.8, h: 0.6, d: 4.8, color: "#89ff9d", finish: true },
];

const player = {
  x: 0,
  y: 1.6,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  radius: 0.55,
  onGround: false,
};

let won = false;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

function worldToCamera(p, target) {
  const yaw = camera.yaw;
  const pitch = camera.pitch;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);

  const camX = target.x + Math.sin(yaw) * camera.distance;
  const camY = target.y + camera.height;
  const camZ = target.z + Math.cos(yaw) * camera.distance;

  let x = p.x - camX;
  let y = p.y - camY;
  let z = p.z - camZ;

  const cosy = Math.cos(-yaw);
  const siny = Math.sin(-yaw);
  const rx = x * cosy - z * siny;
  const rz = x * siny + z * cosy;
  x = rx;
  z = rz;

  const ry = y * cp - z * sp;
  const rz2 = y * sp + z * cp;

  return { x, y: ry, z: rz2 };
}

function project(p) {
  if (p.z >= -0.1) return null;
  const scale = camera.fov / -p.z;
  return {
    x: canvas.width * 0.5 + p.x * scale,
    y: canvas.height * 0.5 - p.y * scale,
    scale,
  };
}

function drawPlatform(pf) {
  const hw = pf.w * 0.5;
  const hh = pf.h * 0.5;
  const hd = pf.d * 0.5;

  const corners = [
    { x: pf.x - hw, y: pf.y + hh, z: pf.z - hd },
    { x: pf.x + hw, y: pf.y + hh, z: pf.z - hd },
    { x: pf.x + hw, y: pf.y + hh, z: pf.z + hd },
    { x: pf.x - hw, y: pf.y + hh, z: pf.z + hd },
    { x: pf.x - hw, y: pf.y - hh, z: pf.z - hd },
    { x: pf.x + hw, y: pf.y - hh, z: pf.z - hd },
    { x: pf.x + hw, y: pf.y - hh, z: pf.z + hd },
    { x: pf.x - hw, y: pf.y - hh, z: pf.z + hd },
  ];

  const cam = corners.map((c) => worldToCamera(c, player));
  const pts = cam.map((c) => project(c));
  if (pts.some((x) => x == null)) return;

  const faces = [
    { idx: [0, 1, 2, 3], shade: 1 },
    { idx: [3, 2, 6, 7], shade: 0.82 },
    { idx: [1, 2, 6, 5], shade: 0.72 },
  ];

  for (const face of faces) {
    const depth = face.idx.reduce((s, i) => s + cam[i].z, 0) / face.idx.length;
    face.depth = depth;
  }
  faces.sort((a, b) => a.depth - b.depth);

  for (const face of faces) {
    ctx.beginPath();
    face.idx.forEach((i, k) => {
      const pt = pts[i];
      if (k === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();

    const rgb = hexToRgb(pf.color);
    ctx.fillStyle = `rgb(${Math.floor(rgb.r * face.shade)}, ${Math.floor(rgb.g * face.shade)}, ${Math.floor(rgb.b * face.shade)})`;
    ctx.fill();
    ctx.strokeStyle = "rgba(10,18,32,0.55)";
    ctx.stroke();
  }

  if (pf.finish) {
    const glow = project(worldToCamera({ x: pf.x, y: pf.y + 1.9, z: pf.z }, player));
    if (glow) {
      const radius = Math.max(6, 22 * glow.scale * 0.04);
      const grad = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, radius);
      grad.addColorStop(0, "rgba(126, 255, 153, 0.8)");
      grad.addColorStop(1, "rgba(126, 255, 153, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(glow.x, glow.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function resolvePlatformCollision(pf) {
  const minX = pf.x - pf.w * 0.5;
  const maxX = pf.x + pf.w * 0.5;
  const minZ = pf.z - pf.d * 0.5;
  const maxZ = pf.z + pf.d * 0.5;

  if (player.x + player.radius > minX && player.x - player.radius < maxX && player.z + player.radius > minZ && player.z - player.radius < maxZ) {
    const top = pf.y + pf.h * 0.5;
    const feet = player.y - player.radius;
    const nearTop = feet <= top + 0.22 && feet >= top - 2.2;
    if (player.vy <= 0 && nearTop) {
      player.y = top + player.radius;
      player.vy = 0;
      player.onGround = true;
    }
  }
}

function updatePhysics(dt) {
  const moveX = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
  const moveY = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);

  const moveLen = Math.hypot(moveX, moveY) || 1;
  const mx = moveX / moveLen;
  const mz = moveY / moveLen;

  const fwdX = -Math.sin(camera.yaw);
  const fwdZ = -Math.cos(camera.yaw);
  const rightX = Math.cos(camera.yaw);
  const rightZ = -Math.sin(camera.yaw);

  const wishX = rightX * mx + fwdX * mz;
  const wishZ = rightZ * mx + fwdZ * mz;

  const sprint = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const accel = sprint ? 34 : 24;
  const maxSpeed = sprint ? 10.5 : 7.2;
  const friction = player.onGround ? 10 : 2.6;

  player.vx += wishX * accel * dt;
  player.vz += wishZ * accel * dt;

  const speed = Math.hypot(player.vx, player.vz);
  if (speed > maxSpeed) {
    const s = maxSpeed / speed;
    player.vx *= s;
    player.vz *= s;
  }

  player.vx *= Math.exp(-friction * dt);
  player.vz *= Math.exp(-friction * dt);

  if (keys.has("Space") && player.onGround) {
    player.vy = sprint ? 9.8 : 8.9;
    player.onGround = false;
  }

  player.vy -= 24 * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.z += player.vz * dt;

  player.onGround = false;
  for (const pf of platforms) resolvePlatformCollision(pf);

  const finish = platforms[platforms.length - 1];
  const dx = player.x - finish.x;
  const dy = player.y - finish.y;
  const dz = player.z - finish.z;

  if (!won && Math.hypot(dx, dy, dz) < 2.4) {
    won = true;
    statusText.textContent = "🏁 You win! Nice run.";
  }

  if (player.y < -15) {
    player.x = 0;
    player.y = 1.6;
    player.z = 0;
    player.vx = player.vy = player.vz = 0;
    won = false;
    statusText.textContent = "You fell! Back to start.";
  }
}

function drawPlayer() {
  const p = project(worldToCamera({ x: player.x, y: player.y, z: player.z }, player));
  if (!p) return;
  const r = Math.max(5, player.radius * p.scale);
  ctx.fillStyle = "#ffb86c";
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.stroke();
}

let prev = performance.now();
function frame(now) {
  const dt = Math.min((now - prev) / 1000, 0.033);
  prev = now;

  updatePhysics(dt);

  ctx.fillStyle = "#0b1320";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const horizon = canvas.height * (0.44 - camera.pitch * 0.1);
  const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grd.addColorStop(0, "#102238");
  grd.addColorStop(Math.max(0, Math.min(1, horizon / canvas.height)), "#152b46");
  grd.addColorStop(1, "#0b1320");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  platforms
    .slice()
    .sort((a, b) => {
      const da = worldToCamera({ x: a.x, y: a.y, z: a.z }, player).z;
      const db = worldToCamera({ x: b.x, y: b.y, z: b.z }, player).z;
      return da - db;
    })
    .forEach(drawPlatform);

  drawPlayer();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
