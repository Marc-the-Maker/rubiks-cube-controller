// === Basic Three.js Setup ===
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// === Lighting ===
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);
const directional = new THREE.DirectionalLight(0xffffff, 0.6);
directional.position.set(5, 5, 5);
scene.add(directional);

// === Cube Colors (standard Rubik’s Cube) ===
// U = White, D = Yellow, L = Orange, R = Red, F = Green, B = Blue
const faceColors = {
  U: 0xffffff,
  D: 0xffff00,
  L: 0xff8000,
  R: 0xff0000,
  F: 0x00ff00,
  B: 0x0000ff,
};

// === Create Mini Cubes ===
const cubeGroup = new THREE.Group();
const cubeSize = 0.95;
const spacing = 1;

for (let x = -1; x <= 1; x++) {
  for (let y = -1; y <= 1; y++) {
    for (let z = -1; z <= 1; z++) {
      const materials = [];

      // Each small cube has 6 faces — we color depending on position
      const faces = [
        { normal: [1, 0, 0], color: x === 1 ? faceColors.R : 0x111111 },
        { normal: [-1, 0, 0], color: x === -1 ? faceColors.L : 0x111111 },
        { normal: [0, 1, 0], color: y === 1 ? faceColors.U : 0x111111 },
        { normal: [0, -1, 0], color: y === -1 ? faceColors.D : 0x111111 },
        { normal: [0, 0, 1], color: z === 1 ? faceColors.F : 0x111111 },
        { normal: [0, 0, -1], color: z === -1 ? faceColors.B : 0x111111 },
      ];

      for (const f of faces) {
        materials.push(new THREE.MeshLambertMaterial({ color: f.color }));
      }

      const cubelet = new THREE.Mesh(new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize), materials);
      cubelet.position.set(x * spacing, y * spacing, z * spacing);
      cubeGroup.add(cubelet);
    }
  }
}

scene.add(cubeGroup);

// === Camera & Controls ===
camera.position.set(4, 4, 6);
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.enablePan = false;
controls.rotateSpeed = 0.8;

// === Resize Handling ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// === Animation Loop ===
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();
