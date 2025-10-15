import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// === Scene, Camera, Renderer ===
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
// Zoomed out a touch
camera.position.set(7.5, 7.5, 9);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x111111);
document.body.appendChild(renderer.domElement);

// === Lighting ===
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 0.85);
dir.position.set(5, 7, 8);
scene.add(dir);

// === Cube Colors (static world axes) ===
const colors = {
  U: 0xffffff, // +Y
  D: 0xffff00, // -Y
  L: 0xff8000, // -X
  R: 0xff0000, // +X
  F: 0x00ff00, // +Z
  B: 0x0000ff, // -Z
};

// === Build 3x3 Cube ===
const STICKER = 0x222222;
const cubeGroup = new THREE.Group();
for (let x = -1; x <= 1; x++) {
  for (let y = -1; y <= 1; y++) {
    for (let z = -1; z <= 1; z++) {
      const mats = [
        new THREE.MeshLambertMaterial({ color: x === 1 ? colors.R : STICKER }), // right  (+X)
        new THREE.MeshLambertMaterial({ color: x === -1 ? colors.L : STICKER }), // left   (-X)
        new THREE.MeshLambertMaterial({ color: y === 1 ? colors.U : STICKER }), // up     (+Y)
        new THREE.MeshLambertMaterial({ color: y === -1 ? colors.D : STICKER }), // down   (-Y)
        new THREE.MeshLambertMaterial({ color: z === 1 ? colors.F : STICKER }), // front  (+Z)
        new THREE.MeshLambertMaterial({ color: z === -1 ? colors.B : STICKER }), // back   (-Z)
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
controls.enableZoom = true;
controls.minDistance = 6.0;
controls.maxDistance = 16.0;
controls.target.set(0, 0, 0);
controls.update();

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
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let rotating = false;
let touchStart = null;
let touchedFace = null;
let layerGroup = null;

// Static world axes for each face
const FACE_DEFS = {
  F: { n: new THREE.Vector3(0, 0, 1),  u: new THREE.Vector3(1, 0, 0),  v: new THREE.Vector3(0, 1, 0) },
  B: { n: new THREE.Vector3(0, 0, -1), u: new THREE.Vector3(-1, 0, 0), v: new THREE.Vector3(0, 1, 0) },
  U: { n: new THREE.Vector3(0, 1, 0),  u: new THREE.Vector3(1, 0, 0),  v: new THREE.Vector3(0, 0, -1) },
  D: { n: new THREE.Vector3(0, -1, 0), u: new THREE.Vector3(1, 0, 0),  v: new THREE.Vector3(0, 0, 1) },
  R: { n: new THREE.Vector3(1, 0, 0),  u: new THREE.Vector3(0, 0, -1), v: new THREE.Vector3(0, 1, 0) },
  L: { n: new THREE.Vector3(-1, 0, 0), u: new THREE.Vector3(0, 0, 1),  v: new THREE.Vector3(0, 1, 0) },
};

// Determine which face was touched, from world-space normal
function dominantFaceFromNormal(normalWS) {
  const abs = new THREE.Vector3(Math.abs(normalWS.x), Math.abs(normalWS.y), Math.abs(normalWS.z));
  if (abs.x > abs.y && abs.x > abs.z) return normalWS.x > 0 ? 'R' : 'L';
  if (abs.y > abs.x && abs.y > abs.z) return normalWS.y > 0 ? 'U' : 'D';
  return normalWS.z > 0 ? 'F' : 'B';
}

// Collect the 9 cubelets belonging to a static face (world axes)
function cubesOnFace(face) {
  return cubeGroup.children.filter(c => {
    const p = c.position.clone().round(); // cubelets are always on integer grid
    if (face === 'F') return p.z === 1;
    if (face === 'B') return p.z === -1;
    if (face === 'U') return p.y === 1;
    if (face === 'D') return p.y === -1;
    if (face === 'R') return p.x === 1;
    if (face === 'L') return p.x === -1;
    return false;
  });
}

// Convert screen delta (dx,dy) to a world vector using camera right/up
function screenDeltaToWorld(dx, dy) {
  const camQuat = camera.quaternion;
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camQuat);
  const up    = new THREE.Vector3(0, 1, 0).applyQuaternion(camQuat);
  // dy is screen-down; map to -up to keep conventional math up positive
  return right.multiplyScalar(dx).add(up.multiplyScalar(-dy)).normalize();
}

// Decide swipe direction in the face plane and map to CW/CCW
function swipeToRotation(face, dx, dy) {
  const def = FACE_DEFS[face];
  const w = screenDeltaToWorld(dx, dy);

  // Project swipe into the face plane (remove normal component)
  const n = def.n;
  const wProj = w.clone().sub(n.clone().multiplyScalar(w.dot(n))).normalize();

  // Compare against face-local axes u (right on the face) and v (up on the face)
  const uDot = wProj.dot(def.u);
  const vDot = wProj.dot(def.v);

  let dir2D; // '+u' | '-u' | '+v' | '-v'
  if (Math.abs(uDot) >= Math.abs(vDot)) {
    dir2D = uDot >= 0 ? '+u' : '-u';
  } else {
    dir2D = vDot >= 0 ? '+v' : '-v';
  }

  // For each face, define how a swipe maps to CW vs CCW (as seen from outside the face)
  // Using a consistent right-handed convention and intuitive "push" feel:
  const CW = 1, CCW = -1;
  const signMap = {
    F: { '+u': CCW,  '-u': CW, '+v': CCW, '-v': CW  },
    B: { '+u': CW,  '-u': CCW, '+v': CW,  '-v': CCW }, // note v reversed vs F
    U: { '+u': CW,  '-u': CCW, '+v': CW,  '-v': CCW },
    D: { '+u': CCW, '-u': CW,  '+v': CW,  '-v': CCW },
    R: { '+u': CW,  '-u': CCW, '+v': CCW, '-v': CW  },
    L: { '+u': CCW, '-u': CW,  '+v': CCW, '-v': CW  },
  };

  const signCW = signMap[face][dir2D]; // +1 = CW, -1 = CCW
  // Rotation axis is the face normal; right-hand rule: +angle = CCW,
  // so convert CW to negative angle around +n.
  const angle = (signCW === CW ? -1 : 1) * (Math.PI / 2);

  return { angle, cw: signCW === CW, dir2D };
}

// Move logger you can wire up to hardware later
function logMove(face, cw) {
  const notation = cw ? face : `${face}'`;
  console.log({ face, dir: cw ? 'CW' : 'CCW', notation });
  // TODO: send to backend/ESP32 here
}

// === Touch Events ===
window.addEventListener('touchstart', (e) => {
  if (rotating) return;

  // Two fingers = orbit
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

    const normalWS = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    touchedFace = dominantFaceFromNormal(normalWS);
    touchStart = { x, y };
  }
});

window.addEventListener('touchmove', (e) => {
  if (rotating) return;

  if (e.touches.length === 1 && touchStart && touchedFace) {
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const dx = x - touchStart.x;
    const dy = y - touchStart.y;

    // Small deadzone
    if (Math.hypot(dx, dy) < 38) return;

    rotating = true;

    const faceCubes = cubesOnFace(touchedFace);
    layerGroup = new THREE.Group();
    faceCubes.forEach(c => layerGroup.add(c));
    cubeGroup.add(layerGroup);

    const { angle, cw } = swipeToRotation(touchedFace, dx, dy);
    const axis = FACE_DEFS[touchedFace].n.clone(); // world axis

    // Animate the quarter-turn
    const duration = 250;
    const start = performance.now();

    function animateTurn(t) {
      const k = Math.min(1, (t - start) / duration);
      const ease = k * k * (3 - 2 * k);
      layerGroup.setRotationFromAxisAngle(axis, angle * ease);
      if (k < 1) requestAnimationFrame(animateTurn);
      else {
        bakeLayer(faceCubes);
        logMove(touchedFace, cw);
      }
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

// === Bake world transforms back into cubeGroup ===
function bakeLayer(cubes) {
  layerGroup.updateMatrixWorld(true);
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();

  for (const c of cubes) {
    c.updateMatrixWorld(true);
    c.matrixWorld.decompose(pos, quat, scl);
    cubeGroup.worldToLocal(pos);
    c.position.copy(new THREE.Vector3(Math.round(pos.x), Math.round(pos.y), Math.round(pos.z)));
    c.quaternion.copy(quat); // exact quarter-turn at end of animation
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
