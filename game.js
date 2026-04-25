import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/controls/OrbitControls.js";

const canvas = document.querySelector("#game");
const statusText = document.querySelector("#status");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1320);
scene.fog = new THREE.Fog(0x0b1320, 18, 70);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(-3, 7, 15);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 2, 0);
controls.maxPolarAngle = Math.PI * 0.48;

const hemi = new THREE.HemisphereLight(0x9ec9ff, 0x334455, 0.55);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 0.95);
sun.position.set(6, 12, 4);
sun.castShadow = true;
sun.shadow.camera.left = -25;
sun.shadow.camera.right = 25;
sun.shadow.camera.top = 25;
sun.shadow.camera.bottom = -25;
scene.add(sun);

const platformMat = new THREE.MeshStandardMaterial({ color: 0x426296, roughness: 0.45, metalness: 0.1 });
const safeMat = new THREE.MeshStandardMaterial({ color: 0x4f9af5, roughness: 0.35, metalness: 0.2 });
const finishMat = new THREE.MeshStandardMaterial({ color: 0x89ff9d, emissive: 0x285029, roughness: 0.25 });

function makePlatform(width, height, depth, x, y, z, material = platformMat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

const platforms = [];
platforms.push(makePlatform(12, 1, 12, 0, -0.5, 0, safeMat));
platforms.push(makePlatform(4, 1, 4, 8, 0.5, -1));
platforms.push(makePlatform(3.5, 1, 3.5, 13.5, 2.5, 2));
platforms.push(makePlatform(3.2, 1, 3.2, 19.5, 5, -1));
platforms.push(makePlatform(2.8, 1, 2.8, 25.5, 7.8, 2.5));
platforms.push(makePlatform(3.2, 1, 3.2, 32, 10.8, -1.5));

const finishPad = makePlatform(4.8, 0.6, 4.8, 38.5, 13.3, 2, finishMat);
platforms.push(finishPad);

const railGeom = new THREE.CylinderGeometry(0.12, 0.12, 6.4, 16);
const railMat = new THREE.MeshStandardMaterial({ color: 0x8fa2bf, roughness: 0.2, metalness: 0.8 });
const rail = new THREE.Mesh(railGeom, railMat);
rail.rotation.z = Math.PI * 0.35;
rail.position.set(16.4, 5.4, 6.2);
rail.castShadow = true;
scene.add(rail);

const player = {
  radius: 0.55,
  position: new THREE.Vector3(0, 1.6, 0),
  velocity: new THREE.Vector3(),
  onGround: false,
};

const playerMesh = new THREE.Mesh(
  new THREE.SphereGeometry(player.radius, 26, 20),
  new THREE.MeshStandardMaterial({ color: 0xffb86c, roughness: 0.4, metalness: 0.15 })
);
playerMesh.castShadow = true;
scene.add(playerMesh);

const goalGlow = new THREE.PointLight(0x7eff99, 2.2, 18, 2);
goalGlow.position.copy(finishPad.position).add(new THREE.Vector3(0, 3.8, 0));
scene.add(goalGlow);

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(120, 24, 16),
  new THREE.MeshBasicMaterial({ color: 0x102238, side: THREE.BackSide })
);
scene.add(sky);

const keys = new Set();
window.addEventListener("keydown", (event) => keys.add(event.code));
window.addEventListener("keyup", (event) => keys.delete(event.code));

function getMoveInput() {
  const move = new THREE.Vector2();
  if (keys.has("KeyW") || keys.has("ArrowUp")) move.y += 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) move.y -= 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) move.x -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) move.x += 1;
  if (move.lengthSq() > 1) move.normalize();
  return move;
}

function resolvePlatformCollision(platform) {
  const half = new THREE.Vector3(platform.scale.x, platform.scale.y, platform.scale.z);
  const geom = platform.geometry.parameters;
  half.set(geom.width * 0.5, geom.height * 0.5, geom.depth * 0.5);

  const min = platform.position.clone().sub(half);
  const max = platform.position.clone().add(half);

  if (
    player.position.x + player.radius > min.x &&
    player.position.x - player.radius < max.x &&
    player.position.z + player.radius > min.z &&
    player.position.z - player.radius < max.z
  ) {
    const top = max.y;
    const feet = player.position.y - player.radius;
    const nearTop = feet <= top + 0.25 && feet >= top - 2.4;

    if (player.velocity.y <= 0 && nearTop) {
      player.position.y = top + player.radius;
      player.velocity.y = 0;
      player.onGround = true;
    }
  }
}

const clock = new THREE.Clock();
let won = false;

function update() {
  const dt = Math.min(clock.getDelta(), 0.033);
  const move = getMoveInput();

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

  const sprint = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const accel = sprint ? 34 : 24;
  const maxSpeed = sprint ? 10.5 : 7.2;
  const friction = player.onGround ? 10 : 2.5;

  const desired = new THREE.Vector3();
  desired.addScaledVector(forward, move.y);
  desired.addScaledVector(right, move.x);
  if (desired.lengthSq() > 1) desired.normalize();

  player.velocity.x += desired.x * accel * dt;
  player.velocity.z += desired.z * accel * dt;

  const horizontal = new THREE.Vector2(player.velocity.x, player.velocity.z);
  const speed = horizontal.length();
  if (speed > maxSpeed) {
    horizontal.setLength(maxSpeed);
    player.velocity.x = horizontal.x;
    player.velocity.z = horizontal.y;
  }

  player.velocity.x *= Math.exp(-friction * dt);
  player.velocity.z *= Math.exp(-friction * dt);

  if ((keys.has("Space") || keys.has("KeyJ")) && player.onGround) {
    player.velocity.y = sprint ? 9.8 : 8.9;
    player.onGround = false;
  }

  player.velocity.y -= 24 * dt;
  player.position.addScaledVector(player.velocity, dt);
  player.onGround = false;

  for (const platform of platforms) {
    resolvePlatformCollision(platform);
  }

  if (player.position.y < -15) {
    player.position.set(0, 1.6, 0);
    player.velocity.set(0, 0, 0);
    statusText.textContent = "You fell! Back to start.";
    won = false;
  }

  if (!won && player.position.distanceTo(finishPad.position) < 2.4) {
    won = true;
    statusText.textContent = "🏁 You win! Nice run.";
  }

  playerMesh.position.copy(player.position);

  const chaseOffset = new THREE.Vector3(-8, 6, 10);
  chaseOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(forward.x, forward.z));
  controls.target.lerp(player.position, 1 - Math.exp(-8 * dt));
  camera.position.lerp(player.position.clone().add(chaseOffset), 1 - Math.exp(-2.2 * dt));

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(update);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

update();
