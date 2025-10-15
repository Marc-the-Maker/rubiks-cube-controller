/* 
  Rubik’s Cube (3x3) with absolute faces:
  U=+Y, D=-Y, F=+Z, B=-Z, R=+X, L=-X (fixed; not camera-dependent)
  CW/CCW defined by right-hand rule while looking toward the face.
*/

(() => {
  const FACE = Object.freeze({ U:'U', D:'D', L:'L', R:'R', F:'F', B:'B' });

  // Map: per-face world axis + sign relationship for CW (see right-hand notes).
  const FACE_AXIS = {
    U: { axis: new THREE.Vector3(0, 1, 0), cw: -1 },
    D: { axis: new THREE.Vector3(0,-1, 0), cw: +1 },
    F: { axis: new THREE.Vector3(0, 0, 1), cw: -1 },
    B: { axis: new THREE.Vector3(0, 0,-1), cw: +1 },
    R: { axis: new THREE.Vector3(1, 0, 0), cw: -1 },
    L: { axis: new THREE.Vector3(-1,0, 0), cw: +1 },
  };

  // --- Scene / camera / renderer ------------------------------------------------
  const mount = document.getElementById('canvas');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(mount.clientWidth || window.innerWidth, window.innerHeight - 56);
  renderer.setClearColor(0x111111, 1);
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, renderer.domElement.width / renderer.domElement.height, 0.1, 100);
  camera.position.set(6, 5.5, 7.5);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 4.0;
  controls.maxDistance = 18.0;
  controls.target.set(0, 0, 0);

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(5, 7, 9);
  scene.add(dir);

  // --- Cube construction --------------------------------------------------------
  const cubeRoot = new THREE.Group(); // parent for all cubies (state lives here)
  scene.add(cubeRoot);

  const N = 3;               // 3x3x3
  const size = 0.95;         // cubie size
  const gap = 0.05;          // spacing between cubies
  const step = 1.0;          // grid step so positions are -1,0,1
  const half = (N - 1) / 2;  // 1 for 3x3

  // Face colors (classic scheme)
  const COLORS = {
    U: 0xffffff, // white
    D: 0xffff00, // yellow
    L: 0xff8000, // orange
    R: 0xff0000, // red
    F: 0x00ff00, // green
    B: 0x0000ff, // blue
  };

  const allCubies = [];
  const geo = new THREE.BoxGeometry(size, size, size);

  // Create a MeshStandardMaterial per side so “stickers” show correct colors.
  function coloredMaterials(ix, iy, iz) {
    // Determine if a face is on the exterior; color it; else dark body color.
    const m = [
      new THREE.MeshStandardMaterial({ color: iz ===  half ? COLORS.F : 0x101113 }), // +Z (front)
      new THREE.MeshStandardMaterial({ color: iz === -half ? COLORS.B : 0x101113 }), // -Z (back)
      new THREE.MeshStandardMaterial({ color: iy ===  half ? COLORS.U : 0x101113 }), // +Y (up)
      new THREE.MeshStandardMaterial({ color: iy === -half ? COLORS.D : 0x101113 }), // -Y (down)
      new THREE.MeshStandardMaterial({ color: ix ===  half ? COLORS.R : 0x101113 }), // +X (right)
      new THREE.MeshStandardMaterial({ color: ix === -half ? COLORS.L : 0x101113 }), // -X (left)
    ];
    m.forEach(mat => { mat.metalness = 0.1; mat.roughness = 0.6; });
    return m;
  }

  for (let ix = -half; ix <= half; ix++) {
    for (let iy = -half; iy <= half; iy++) {
      for (let iz = -half; iz <= half; iz++) {
        const mats = coloredMaterials(ix, iy, iz);
        const cubie = new THREE.Mesh(geo, mats);
        cubie.position.set(ix * step, iy * step, iz * step);
        cubie.userData.grid = { x: ix, y: iy, z: iz };
        allCubies.push(cubie);
        cubeRoot.add(cubie);
      }
    }
  }

  // --- Helpers ------------------------------------------------------------------
  const quarter = Math.PI / 2;

  function snapToGrid(cubies) {
    // Snap positions to nearest integer grid and rotations to nearest 90°
    cubies.forEach(c => {
      const p = c.position;
      p.set(Math.round(p.x), Math.round(p.y), Math.round(p.z));
      // Snap rotation using quaternion -> Euler in multiples of quarter turns
      const e = new THREE.Euler().setFromQuaternion(c.quaternion, 'XYZ');
      e.x = Math.round(e.x / quarter) * quarter;
      e.y = Math.round(e.y / quarter) * quarter;
      e.z = Math.round(e.z / quarter) * quarter;
      c.setRotationFromEuler(e);
    });
  }

  function layerSelector(face, eps = 0.5) {
    switch (face) {
      case FACE.U: return allCubies.filter(c => c.position.y >  half - eps);
      case FACE.D: return allCubies.filter(c => c.position.y < -half + eps);
      case FACE.F: return allCubies.filter(c => c.position.z >  half - eps);
      case FACE.B: return allCubies.filter(c => c.position.z < -half + eps);
      case FACE.R: return allCubies.filter(c => c.position.x >  half - eps);
      case FACE.L: return allCubies.filter(c => c.position.x < -half + eps);
    }
  }

  // Tween rotation of a Group around a world-space axis by angle (radians).
  function tweenRotation(group, axis, angle, ms = 150) {
    // Axis in world space: convert to group’s local for applying quaternion increment.
    const worldAxis = axis.clone().normalize();
    const start = performance.now();
    const qStart = group.quaternion.clone();

    return new Promise(resolve => {
      const tick = (now) => {
        const t = Math.min(1, (now - start) / ms);
        const q = new THREE.Quaternion();
        q.setFromAxisAngle(worldAxis, angle * t);
        group.quaternion.copy(qStart).multiply(q);
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  }

  let animating = false;

  async function rotateFace(face, dir = 'CW', duration = 150) {
    if (animating) return;
    animating = true;
    const { axis, cw } = FACE_AXIS[face];
    const turns = dir === '2' ? 2 : 1;
    const sign = dir === 'CW' ? cw : -cw;
    const angle = sign * quarter * turns;

    const group = new THREE.Group();
    scene.add(group);
    const layer = layerSelector(face);
    layer.forEach(c => group.attach(c));

    await tweenRotation(group, axis, angle, duration);

    // Detach back and snap
    layer.forEach(c => cubeRoot.attach(c));
    snapToGrid(layer);

    scene.remove(group);
    logMove({ face, dir });
    animating = false;
  }

  // --- Move logger --------------------------------------------------------------
  const logEl = document.getElementById('log');
  const history = [];

  function nowISO() {
    try { return new Date().toISOString(); } catch { return ""; }
  }

  function notation(face, dir) {
    if (dir === '2') return face + '2';
    if (dir === 'CW') return face;
    return face + "'";
    // note: we’re not adding “w”/wide moves here; only face turns.
  }

  function logMove({ face, dir }) {
    const entry = { face, dir, t: nowISO(), n: notation(face, dir) };
    history.push(entry);
    // Render last 200 lines for readability
    const start = Math.max(0, history.length - 200);
    const lines = history.slice(start).map(e => `${e.t}  ${e.n}`);
    logEl.textContent = lines.join('\n');
  }

  // --- UI wiring ----------------------------------------------------------------
  document.getElementById('toolbar').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-face]');
    if (!btn) return;
    const face = btn.getAttribute('data-face');
    const dir = btn.getAttribute('data-dir');
    rotateFace(face, dir);
  });

  // Keyboard: accept tokens like R, R', R2, etc., space-separated
  window.addEventListener('keydown', (e) => {
    if (animating) return;
    if (e.key === ' ') { e.preventDefault(); return; }
  });

  // Simple parser for sequences typed into prompt()
  // Press "S" to prompt a sequence, e.g., "R U R' U'"
  window.addEventListener('keydown', async (e) => {
    if (e.key.toLowerCase() === 's') {
      const seq = prompt("Enter sequence (e.g., R U R' U' F2):");
      if (!seq) return;
      const tokens = seq.trim().split(/\s+/);
      for (const t of tokens) {
        const m = /^([UDLRFB])('?|2)?$/.exec(t);
        if (!m) continue;
        const face = m[1];
        const suf = m[2] || '';
        const dir = suf === "'" ? 'CCW' : (suf === '2' ? '2' : 'CW');
        // eslint-disable-next-line no-await-in-loop
        await rotateFace(face, dir);
      }
    }
  });

  // Scramble + Reset
  document.getElementById('scramble').addEventListener('click', async () => {
    if (animating) return;
    const faces = ['U','D','L','R','F','B'];
    const dirs = ['CW','CCW','2'];
    for (let i = 0; i < 20; i++) {
      const f = faces[Math.floor(Math.random()*faces.length)];
      const d = dirs[Math.floor(Math.random()*dirs.length)];
      // eslint-disable-next-line no-await-in-loop
      await rotateFace(f, d, 120);
    }
  });

  document.getElementById('reset').addEventListener('click', () => {
    if (animating) return;
    // Reset positions/rotations
    allCubies.forEach(c => {
      c.position.copy(new THREE.Vector3(
        c.userData.grid.x,
        c.userData.grid.y,
        c.userData.grid.z
      ));
      c.rotation.set(0,0,0);
      c.updateMatrixWorld();
    });
    history.length = 0;
    logEl.textContent = '';
  });

  // --- Render loop --------------------------------------------------------------
  function onResize() {
    const w = mount.clientWidth || window.innerWidth;
    const h = window.innerHeight - document.getElementById('toolbar').offsetHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);

  (function animate() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  })();

  onResize();
})();
