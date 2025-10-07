// Scene, Camera, Renderer
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

// Lights
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);
const directional = new THREE.DirectionalLight(0xffffff, 0.8);
directional.position.set(5, 5, 5);
scene.add(directional);

// Colors (solved cube)
const colors = {
  U: 0xffffff, // white
  D: 0xffff00, // yellow
  L: 0xff8000, // orange
  R: 0xff0000, // red
  F: 0x00ff00, // green
  B: 0x0000ff, // blue
};

// Build 3x3x3 cubelets
const cubeGroup = new THREE.Group();
const cubeSize = 0.95;
const spacing = 1;

for (let x = -1; x <= 1; x++) {
  for (let y = -1; y <= 1; y++) {
    for (let z = -1; z <= 1; z++) {
      const materials = [
        new THREE.MeshLambertMaterial({
          color: x === 1 ? colors.R : 0x222222,
        }), // right
        new THREE.MeshLambertMaterial({
          color: x === -1 ? colors.L : 0x222222,
        }), // left
        new THREE.MeshLambertMaterial({
          color: y === 1 ? colors.U : 0x222222,
        }), // top
        new THREE.MeshLambertMaterial({
          color: y === -1 ? colors.D : 0x222222,
        }), // bottom
        new THREE.MeshLambertMaterial({
          color: z === 1 ? colors.F : 0x222222,
        }), // front
        new THREE.MeshLambertMaterial({
          color: z === -1 ? colors.B : 0x222222,
        }), // back
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

// Controls
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.rotateSpeed = 0.9;

// Handle window resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Render loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
