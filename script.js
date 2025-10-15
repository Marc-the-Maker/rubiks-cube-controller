// CDN imports so it works without a bundler
import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.159.0/examples/jsm/controls/OrbitControls.js';

// === Scene, Camera, Renderer ===
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(7.5, 7.5, 9); // a little more zoomed out

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x111111);
document.body.appendChild(renderer.domElement);

// === Lighting ===
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 0.85);
dir.position.set(5, 7, 8);
scene.add(dir);

// === Colors by static world axes ===
const colors = {
  U: 0xffffff, // +Y
  D: 0xffff00, // -Y
  L: 0xff8000, // -X
  R: 0xff0000, // +X
  F: 0x00ff00, // +Z
  B: 0x0000ff, // -Z
};

const STICKER = 0x222222;

// === Build 3x3 Cube ===
const cubeGroup = new THREE.Group();
for (let x = -1; x <= 1; x++) {
  for (let y = -1; y <= 1; y++) {
    for (let z = -1; z <= 1; z++) {
      const mats = [
        new THREE.MeshLambertMaterial({ color: x === 1 ? colors.R : STICKER }), // 0 right  (+X)
        new THREE.MeshLambertMaterial({ color: x === -1 ? colors.L : STICKER }), // 1 left   (-X)
        new THREE.MeshLambertMaterial({ color: y === 1 ? colors.U : STICKER }), // 2 up     (+Y)
        new THREE.MeshLambertMaterial({ color: y === -1 ? colors.D : STICKER }), // 3 down   (-Y)
        new THREE.MeshLambertMaterial({ color: z === 1 ? colors.F : STICKER }), // 4 front  (+Z)
        new THREE.MeshLambertMaterial({ color: z === -1 ? colors.B : STICKER }), // 5 back   (-Z)
      ];
      const cubelet = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95), mats);
      cubelet.position.set(x, y, z);
      cubeGroup.add(cubelet);
    }
  }
}
scene.add(cubeGroup);

// === Controls ===
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.rotateSpeed = 0.9;
controls.enableZoom = true;
controls.minDistance = 6;
controls.maxDistance = 16;
controls.target.set(0, 0, 0);
controls.update();

// === Resize ===
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// === Render loop ===
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// === Gesture logic (swipe the face you touched) ===
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let rotating = false;
let touchStart = null;
let touchedFace = null;
let layerGroup = null;

// face definitions: world normal (n), and face-local axes u (right on that face) and v (up on that face)
const FACE_DEFS = {
  F: { n: new THREE.Vector3(0, 0, 1),  u: new THREE.Vector3(1, 0, 0),  v: new THREE.Vector3(0, 1, 0) },
  B: { n: new THREE.Vector3(0, 0, -1), u: new THREE.Vector3(-1, 0, 0), v: new THREE.Vector3(0, 1, 0) },
  U: { n: new THREE.Vector3(0, 1, 0),  u: new THREE.Vector3(1, 0, 0),  v: new THREE.Vector3(0, 0, -1) },
  D: { n: new THREE.Vector3(0, -1, 0), u: new THREE.Vector3(1, 0, 0),  v: new THREE.Vector3(0, 0, 1) },
  R: { n: new THREE.Vector3(1, 0, 0),  u: new THREE.Vector3(0, 0, -1), v: new THREE.Vector3(0, 1, 0) },
  L: { n: new THREE.Vector3(-1, 0, 0), u: new THREE.Vector3(0, 0, 1),  v: new THREE.Vector3(0, 1, 0) },
};

// map materialIndex of BoxGeometry to our faces
const MAT_TO_FACE = { 0: 'R', 1: 'L', 2: 'U', 3: 'D', 4: 'F', 5: 'B' };

function cubesOnFace(face) {
  return cubeGroup.children.filter(c => {
    const p = c.position.clone().round();
    if (face === 'F') return p.z === 1;
    if (face === 'B') return p.z === -1;
    if (face === 'U') return p.y === 1;
    if (face === 'D') return p.y === -1;
    if (face === 'R') return p.x === 1;
    if (face === 'L') return p.x === -1;
    return false;
  });
}

// screen delta -> world vector using camera right/up
function screenDeltaToWorld(dx, dy) {
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up    = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  return right.multiplyScalar(dx).add(up.multiplyScalar(-dy)).normalize();
}

// decide CW/CCW for a given face based on swipe along the face's u/v axes
function swipeToFaceTurn(face, dx, dy) {
  const def = FACE_DEFS[face];
  const w = screenDeltaToWorld(dx, dy);
  // project to face plane
  const wProj = w.clone().sub(def.n.clone().multiplyScalar(w.dot(def.n))).normalize();

  const uDot = wProj.dot(def.u);
  const vDot = wProj.dot(def.v);

  let dir2D;
  if (Math.abs(uDot) >= Math.abs(vDot)) dir2D = uDot >= 0 ? '+u' : '-u';
  else dir2D = vDot >= 0 ? '+v' : '-v';

  // As seen from outside the face
  const CW = 1, CCW = -1;
  const map = {
    F: { '+u': CW,  '-u': CCW, '+v': CCW, '-v': CW  },
    B: { '+u': CW,  '-u': CCW, '+v': CW,  '-v': CCW },
    U: { '+u': CW,  '-u': CCW, '+v': CW,  '-v': CCW },
    D: { '+u': CCW, '-u': CW,  '+v': CW,  '-v': CCW },
    R: { '+u': CW,  '-u': CCW, '+v': CCW, '-v': CW  },
    L: { '+u': CCW, '-u': CW,  '+v': CCW, '-v': CW  },
  };
  const signCW = map[face][dir2D];
  const angle = (signCW === CW ? -1 : 1) * (Math.PI / 2); // right-hand rule
  return { angle, cw: signCW === CW };
}

// move logger
function logMove(face, cw) {
  const notation = cw ? face : `${face}'`;
  console.log({ face, dir: cw ? 'CW' : 'CCW', notation });
}

// === Touch events ===
window.addEventListener('touchstart', (e) => {
  if (rotating) return;

  // two fingers = orbit camera
  if (e.touches.length === 2) {
    controls.enabled = true;
    return;
  }

  if (e.touches.length === 1) {
    controls.enabled = false;

    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;

    pointer.x = (x / innerWidth) * 2 - 1;
    pointer.y = -(y / innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(cubeGroup.children, false)[0];
    if (!hit) return;

    // we now use the actual box materialIndex to select which static face was touched
    const faceFromMat = MAT_TO_FACE[hit.face.materialIndex];
    if (!faceFromMat) return;

    touchedFace = faceFromMat;     // control = the face you touched
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

    // deadzone so small wiggles don't trigger
    if (Math.hypot(dx, dy) < 36) return;

    rotating = true;

    const faceCubes = cubesOnFace(touchedFace);
    layerGroup = new THREE.Group();
    faceCubes.forEach(c => layerGroup.add(c));
    cubeGroup.add(layerGroup);

    const { angle, cw } = swipeToFaceTurn(touchedFace, dx, dy);
    const axis = FACE_DEFS[touchedFace].n.clone();

    const duration = 250;
    const start = performance.now();

    function anim(t) {
      const k = Math.min(1, (t - start) / duration);
      const ease = k * k * (3 - 2 * k);
      layerGroup.setRotationFromAxisAngle(axis, angle * ease);
      if (k < 1) requestAnimationFrame(anim);
      else {
        bakeLayer(faceCubes);
        logMove(touchedFace, cw);
      }
    }
    requestAnimationFrame(anim);
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

// === bake transforms back into cubeGroup ===
function bakeLayer(cubes) {
  layerGroup.updateMatrixWorld(true);
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();

  for (const c of cubes) {
    c.updateMatrixWorld(true);
    c.matrixWorld.decompose(pos, quat, scl);
    cubeGroup.worldToLocal(pos);
    c.position.set(Math.round(pos.x), Math.round(pos.y), Math.round(pos.z));
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

// === go ===
animate();
