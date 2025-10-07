import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Scene, camera, renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(5, 5, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x111111);
document.body.appendChild(renderer.domElement);

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(5, 5, 5);
scene.add(dir);

// Cube colors
const colors = {
  U: 0xffffff,
  D: 0xffff00,
  L: 0xff8000,
  R: 0xff0000,
  F: 0x00ff00,
  B: 0x0000ff,
};

// Build cube
const cubeGroup = new THREE.Group();
for (let x = -1; x <= 1; x++) {
  for (let y = -1; y <= 1; y++) {
    for (let z = -1; z <= 1; z++) {
      const mats = [
        new THREE.MeshLambertMaterial({ color: x === 1 ? colors.R : 0x222222 }),
        new THREE.MeshLambertMaterial({ color: x === -1 ? colors.L : 0x222222 }),
        new THREE.MeshLambertMaterial({ color: y === 1 ? colors.U : 0x222222 }),
        new THREE.MeshLambertMaterial({ color: y === -1 ? colors.D : 0x222222 }),
        new THREE.MeshLambertMaterial({ color: z === 1 ? colors.F : 0x222222 }),
        new THREE.MeshLambertMaterial({ color: z === -1 ? colors.B : 0x222222 }),
      ];
      const cubelet = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95), mats);
      cubelet.position.set(x, y, z);
      cubeGroup.add(cubelet);
    }
  }
}
scene.add(cubeGroup);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.rotateSpeed = 0.9;

// Resize
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Animate
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// === Swipe + Cube Interaction ===

// Raycaster for detecting which cubelet was clicked
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// Track swipe start and end
let swipeStart = null;
let selectedCubelet = null;

// Listen for pointer down (or touch start)
window.addEventListener('pointerdown', (event) => {
  // Convert mouse coords to NDC
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Cast ray
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(cubeGroup.children);

  if (intersects.length > 0) {
    selectedCubelet = intersects[0].object;
    swipeStart = { x: event.clientX, y: event.clientY };
  }
});

window.addEventListener('pointerup', (event) => {
  if (!selectedCubelet || !swipeStart) return;

  const dx = event.clientX - swipeStart.x;
  const dy = event.clientY - swipeStart.y;

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  // Only trigger if swipe is significant
  if (Math.max(absX, absY) < 30) {
    selectedCubelet = null;
    swipeStart = null;
    return;
  }

  // Determine swipe direction (4 directions)
  let direction;
  if (absX > absY) direction = dx > 0 ? 'right' : 'left';
  else direction = dy > 0 ? 'down' : 'up';

  // Figure out which face we swiped on
  const normal = selectedCubelet.getWorldDirection(new THREE.Vector3());
  const face = getDominantAxis(normal);

  // Rotate appropriate layer
  rotateLayer(face, direction);

  selectedCubelet = null;
  swipeStart = null;
});

function getDominantAxis(vector) {
  const abs = {
    x: Math.abs(vector.x),
    y: Math.abs(vector.y),
    z: Math.abs(vector.z),
  };
  if (abs.x > abs.y && abs.x > abs.z) return vector.x > 0 ? 'R' : 'L';
  if (abs.y > abs.x && abs.y > abs.z) return vector.y > 0 ? 'U' : 'D';
  return vector.z > 0 ? 'F' : 'B';
}

// === Simple cube-layer rotation logic ===
function rotateLayer(face, direction) {
  const layerCubes = cubeGroup.children.filter((cubelet) => {
    const pos = cubelet.position.clone().round();
    if (face === 'U') return pos.y === 1;
    if (face === 'D') return pos.y === -1;
    if (face === 'L') return pos.x === -1;
    if (face === 'R') return pos.x === 1;
    if (face === 'F') return pos.z === 1;
    if (face === 'B') return pos.z === -1;
  });

  const layerGroup = new THREE.Group();
  layerCubes.forEach((c) => layerGroup.add(c));
  cubeGroup.add(layerGroup);

  const axis = {
    U: new THREE.Vector3(0, 1, 0),
    D: new THREE.Vector3(0, -1, 0),
    L: new THREE.Vector3(-1, 0, 0),
    R: new THREE.Vector3(1, 0, 0),
    F: new THREE.Vector3(0, 0, 1),
    B: new THREE.Vector3(0, 0, -1),
  }[face];

  // Determine rotation direction (clockwise vs counterclockwise)
  const sign = direction === 'right' || direction === 'up' ? -1 : 1;

  // Animate the rotation
  const duration = 250; // ms
  const start = performance.now();

  const animateRotation = (time) => {
    const t = Math.min(1, (time - start) / duration);
    const angle = sign * (Math.PI / 2) * t;
    layerGroup.rotation.setFromVector3(axis.clone().multiplyScalar(angle));

    if (t < 1) requestAnimationFrame(animateRotation);
    else {
      // finalize
      layerGroup.rotation.set(0, 0, 0);
      layerCubes.forEach((c) => cubeGroup.add(c));
      cubeGroup.remove(layerGroup);
    }
  };
  requestAnimationFrame(animateRotation);
}

animate();
