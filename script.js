import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";

// Scene, camera, renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(5, 5, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x111111);
document.body.appendChild(renderer.domElement);

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const light = new THREE.DirectionalLight(0xffffff, 0.8);
light.position.set(5, 5, 5);
scene.add(light);

// Colors
const colors = {
  U: 0xffffff, D: 0xffff00, L: 0xff8000, R: 0xff0000, F: 0x00ff00, B: 0x0000ff,
};

// Build cube group
const cubeGroup = new THREE.Group();
for (let x = -1; x <= 1; x++) {
  for (let y = -1; y <= 1; y++) {
    for (let z = -1; z <= 1; z++) {
      const materials = [
        new THREE.MeshLambertMaterial({ color: x === 1 ? colors.R : 0x222222 }),
        new THREE.MeshLambertMaterial({ color: x === -1 ? colors.L : 0x222222 }),
        new THREE.MeshLambertMaterial({ color: y === 1 ? colors.U : 0x222222 }),
        new THREE.MeshLambertMaterial({ color: y === -1 ? colors.D : 0x222222 }),
        new THREE.MeshLambertMaterial({ color: z === 1 ? colors.F : 0x222222 }),
        new THREE.MeshLambertMaterial({ color: z === -1 ? colors.B : 0x222222 }),
      ];

      const cubelet = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95), materials);
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

// Resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Render
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
