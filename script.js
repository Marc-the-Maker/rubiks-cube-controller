// === Imports from official CDN ===
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';

// === Basic Three.js setup ===
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(5, 5, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setClearColor(0x111111);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// === Lighting ===
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);

const directional = new THREE.DirectionalLight(0xffffff, 0.8);
directional.position.set(5, 5, 5);
scene.add(directional);

// === Cube colors (standard Rubik’s cube scheme) ===
const faceColors = {
  U: 0xffffff, // White
  D: 0xffff00, // Yellow
  L: 0xff8000, // Orange
  R: 0xff0000, // Red
  F: 0x00ff00, // Green
  B: 0x0000ff, // Blue
};

// === Create cubelets ===
const cubeGroup = new THREE.Group();
const cubeSize = 0.95;
const spacing = 1;

for (let x = -1; x <= 1; x++) {
  for (let y = -1; y <= 1; y++) {
    for (let z = -1; z <= 1; z++) {
      const materials = [
        new THREE.MeshLambertMaterial({ color: x === 1 ? faceColors.R : 0x222222 }), // right
        new THREE.MeshLambertMaterial({ color: x === -1 ? faceColors.L : 0x222222 }), // left
        new THREE.MeshLambertMaterial({ color: y === 1 ? faceColors.U : 0x222222 }), // top
        new THREE.MeshLambertMaterial({ color: y === -1 ? faceColors.D : 0x222222 }), // bottom
        new THREE.MeshLambertMaterial({ color: z === 1 ? faceColors.F : 0x222222 }), // front
        new THREE.MeshLambertMaterial({ color: z === -1 ? faceColors.B : 0x222222 }), // back
      ];

      const cubelet = new THREE.Mesh(
        new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize),
        materials
      );
      cubelet.position.set(x * spacing, y * spacing, z * spacing);
      cubeGroup.add(cubelet);
    }
  }
}

scene.add(cubeGroup);

// === Camera controls ===
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.rotateSpeed = 0.9;

// === Window resize handling ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// === Render loop ===
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
