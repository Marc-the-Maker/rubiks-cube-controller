import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// === Scene, Camera, Renderer ===
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(5, 5, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x111111);
document.body.appendChild(renderer.domElement);

// === Lighting ===
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(5, 5, 5);
scene.add(dir);

// === Cube Colors ===
const colors = {
  U: 0xffffff, // white
  D: 0xffff00, // yellow
  L: 0xff8000, // orange
  R: 0xff0000, // red
  F: 0x00ff00, // green
  B: 0x0000ff, // blue
};

// === Build 3x3 Cube ===
const cubeGroup = new THREE.Group();
for (let x = -1; x <= 1; x++) {
  for (let y = -1; y <= 1; y++) {
    for (let z = -1; z <= 1; z++) {
      const mats = [
        new THREE.MeshLambertMaterial({ color: x === 1 ? colors.R : 0x222222 }), // right
        new THREE.MeshLambertMaterial({ color: x === -1 ? colors.L : 0x222222 }), // left
        new THREE.MeshLambertMaterial({ color: y === 1 ? colors.U : 0x222222 }), // top
        new THREE.MeshLambertMaterial({ color: y === -1 ? colors.D : 0x222222 }), // bottom
        new THREE.MeshLambertMaterial({ color: z === 1 ? colors.F : 0x222222 }), // front
        new THREE.MeshLambertMaterial({ color: z === -1 ? colors.B : 0x222222 }), // back
      ];
      const cubelet = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95), mats);
      cubelet.position.set(x, y, z);
      cubeGroup.add(cubelet);
    }
  }
}
scene.add(cubeGroup);

// === Orbit Controls ===
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.rotateSpeed = 0.9;

// === Resize Handler ===
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// === Animate Loop ===
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// === Gesture + Rotation Logic ===

// ---- Helpers ----
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let rotating = false;
let touchStart = null;
let touchedFace = null;
let layerGroup = null;
let startVector = null;

// Face axes in cube-local space
const FACE_AXES = {
  F: new THREE.Vector3(0, 0, 1),
  B: new THREE.Vector3(0, 0, -1),
  U: new THREE.Vector3(0, 1, 0),
  D: new THREE.Vector3(0, -1, 0),
  R: new THREE.Vector3(1, 0, 0),
  L: new THREE.Vector3(-1, 0, 0),
};

// Determine which face was touched
function dominantFaceFromNormal(normal) {
  const abs = normal.clone().set(Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z));
  if (abs.x > abs.y && abs.x > abs.z) return normal.x > 0 ? 'R' : 'L';
  if (abs.y > abs.x && abs.y > abs.z) return normal.y > 0 ? 'U' : 'D';
  return normal.z > 0 ? 'F' : 'B';
}

// Get all cubelets on that face
function cubesOnFace(face) {
  return cubeGroup.children.filter(c => {
    const p = c.position.clone().round();
    if (face === 'F') return p.z === 1;
    if (face === 'B') return p.z === -1;
    if (face === 'U') return p.y === 1;
    if (face === 'D') return p.y === -1;
    if (face === 'R') return p.x === 1;
    if (face === 'L') return p.x === -1;
  });
}

// === Determine clockwise vs counterclockwise ===
function turnSign(face, dx, dy) {
  const horiz = Math.abs(dx) >= Math.abs(dy);

  switch (face) {
    case 'F': return horiz ? (dx > 0 ? 1 : 1) : (dy > 0 ? 1 : -1);
    case 'B': return horiz ? (dx > 0 ? 1 : -1) : (dy > 0 ? -1 : 1);
    case 'U': return horiz ? (dx > 0 ? 1 : -1) : (dy > 0 ? 1 : -1);
    case 'D': return horiz ? (dx > 0 ? -1 : 1) : (dy > 0 ? -1 : 1);
    case 'R': return horiz ? (dx > 0 ? 1 : -1) : (dy > 0 ? -1 : 1);
    case 'L': return horiz ? (dx > 0 ? -1 : 1) : (dy > 0 ? 1 : -1);
    default:  return 1;
  }
}

// === Touch Events ===
window.addEventListener('touchstart', (e) => {
  if (rotating) return;

  // Two fingers = orbit the cube
  if (e.touches.length === 2) {
    controls.enabled = true;
    return;
  }

  // One finger = potential layer rotation
  if (e.touches.length === 1) {
    controls.enabled = false;

    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;

    pointer.x = (x / innerWidth) * 2 - 1;
    pointer.y = -(y / innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(cubeGroup.children, false)[0];
    if (!hit) return;

    touchedFace = dominantFaceFromNormal(
      hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
    );
    touchStart = { x, y };

    const localAxis = FACE_AXES[touchedFace].clone();
    startVector = cubeGroup
      .localToWorld(localAxis)
      .sub(cubeGroup.getWorldPosition(new THREE.Vector3()))
      .normalize();
  }
});

window.addEventListener('touchmove', (e) => {
  if (rotating) return;

  // Handle one-finger swipe to rotate face
  if (e.touches.length === 1 && touchStart && touchedFace) {
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const dx = x - touchStart.x;
    const dy = y - touchStart.y;

    if (Math.hypot(dx, dy) < 40) return;

    rotating = true;
    const faceCubes = cubesOnFace(touchedFace);
    layerGroup = new THREE.Group();
    faceCubes.forEach(c => layerGroup.add(c));
    cubeGroup.add(layerGroup);

    const sign = turnSign(touchedFace, dx, dy);
    const targetAngle = sign * Math.PI / 2;
    const axis = startVector.clone();
    const duration = 250;
    const start = performance.now();

    function animateTurn(t) {
      const k = Math.min(1, (t - start) / duration);
      const ease = k * k * (3 - 2 * k);
      layerGroup.setRotationFromAxisAngle(axis, targetAngle * ease);
      if (k < 1) requestAnimationFrame(animateTurn);
      else bakeLayer(faceCubes);
    }
    requestAnimationFrame(animateTurn);
  }
});

window.addEventListener('touchend', (e) => {
  if (e.touches.length >= 2) {
    controls.enabled = true;
    return;
  }

  if (!rotating) {
    touchStart = null;
    touchedFace = null;
    controls.enabled = true;
  }
});

// === Bake world positions back into cubeGroup ===
function bakeLayer(cubes) {
  layerGroup.updateMatrixWorld(true);
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();

  for (const c of cubes) {
    c.updateMatrixWorld(true);
    c.matrixWorld.decompose(pos, quat, scl);
    cubeGroup.worldToLocal(pos);
    c.position.copy(pos.round());
    c.quaternion.copy(quat);
    cubeGroup.add(c);
  }

  cubeGroup.remove(layerGroup);
  layerGroup = null;
  rotating = false;
  touchStart = null;
  touchedFace = null;
  controls.enabled = true;
}

// === Start Animation ===
animate();
