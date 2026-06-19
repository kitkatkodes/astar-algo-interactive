import * as THREE from 'three';
import { OrbitControls }   from 'three/addons/controls/OrbitControls.js';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/addons/postprocessing/OutputPass.js';
import { Graph }           from './graph.js';
import { dijkstra, astar } from './algorithms.js';

/* ═══════════════════════  PALETTE  ═══════════════════════ */
const C = {
  bg:           0x06060f,
  nodeDefault:  0x2244bb,
  nodeHover:    0x4488ff,
  nodeStart:    0x00ff88,
  nodeEnd:      0xff3355,
  exploredD:    0xff8800,   // Dijkstra explored
  exploredA:    0xaa44ff,   // A* explored
  pathD:        0xffcc00,   // Dijkstra path
  pathA:        0x00eeff,   // A* path
  edgeDefault:  [0.04, 0.08, 0.22],   // RGB 0‒1
  edgePathD:    [1.00, 0.80, 0.00],
  edgePathA:    [0.00, 0.93, 1.00],
};

/* ═══════════════════════  HELPERS  ═══════════════════════ */
function makeMat(hex, emissiveInt = 0.6) {
  return new THREE.MeshStandardMaterial({
    color: hex, emissive: hex,
    emissiveIntensity: emissiveInt,
    metalness: 0.2, roughness: 0.5,
  });
}

/* ═══════════════════════  STATE  ═══════════════════════ */
const graph = new Graph();
let nodeMeshes = [];
let edgeLine   = null;          // single LineSegments for all edges
let edgeColors = null;          // Float32Array backing edge vertex colours

let hoveredId  = -1;
let startId    = -1;
let endId      = -1;

// Per-node materials (re-used objects to avoid GC churn)
const mats = {
  default: makeMat(C.nodeDefault, 0.4),
  hover:   makeMat(C.nodeHover,   1.0),
  start:   makeMat(C.nodeStart,   1.2),
  end:     makeMat(C.nodeEnd,     1.2),
  exploredD: makeMat(C.exploredD, 0.9),
  exploredA: makeMat(C.exploredA, 0.9),
  pathD:   makeMat(C.pathD,       1.5),
  pathA:   makeMat(C.pathA,       1.5),
};

// Animation
let animating  = false;
let animTimer  = 0;
const STEP_MS  = 38;   // ms between explored-node reveals
let exploredDSeq = [], exploredASeq = [];
let pathDNodes   = [], pathANodes   = [];
let pathDEdges   = new Set(), pathAEdges = new Set();
let resultD = null, resultA = null;

// Node state array: 'default' | 'start' | 'end' | 'exploredD' | 'exploredA' | 'pathD' | 'pathA'
let nodeState = [];

/* ═══════════════════════  THREE SETUP  ═══════════════════════ */
const canvas   = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = 1.2;

const scene  = new THREE.Scene();
scene.background = new THREE.Color(C.bg);
scene.fog = new THREE.FogExp2(C.bg, 0.008);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 500);
camera.position.set(0, 0, 60);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping  = true;
controls.dampingFactor  = 0.06;
controls.minDistance    = 15;
controls.maxDistance    = 120;

scene.add(new THREE.AmbientLight(0x112244, 3));
const ptLight = new THREE.PointLight(0x4488ff, 2, 80);
ptLight.position.set(0, 20, 20);
scene.add(ptLight);

/* ─── Post-processing ─── */
const composer    = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass   = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight),
  1.4, 0.9, 0.12
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

/* ─── Resize ─── */
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});
renderer.setSize(innerWidth, innerHeight);

/* ═══════════════════════  GRAPH BUILDING  ═══════════════════════ */
function buildScene() {
  // Remove old objects
  nodeMeshes.forEach(m => scene.remove(m));
  if (edgeLine) scene.remove(edgeLine);
  nodeMeshes = [];
  edgeLine   = null;

  graph.generate();
  const n = graph.nodes.length;
  nodeState = new Array(n).fill('default');

  // ── Edges (one LineSegments, vertex colours) ──────────────────
  const eCount = graph.edges.length;
  const posArr = new Float32Array(eCount * 6);   // 2 verts × 3 floats
  edgeColors   = new Float32Array(eCount * 6);   // same layout

  graph.edges.forEach((e, i) => {
    const a = graph.nodes[e.from], b = graph.nodes[e.to];
    posArr.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    edgeColors.set([...C.edgeDefault, ...C.edgeDefault], i * 6);
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(edgeColors, 3));

  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55 });
  edgeLine = new THREE.LineSegments(geo, mat);
  scene.add(edgeLine);

  // ── Nodes (individual meshes for raycasting) ──────────────────
  const sphereGeo = new THREE.SphereGeometry(0.52, 20, 20);
  graph.nodes.forEach((nd, i) => {
    const mesh = new THREE.Mesh(sphereGeo, mats.default.clone());
    mesh.position.set(nd.x, nd.y, nd.z);
    mesh.userData.nodeId = i;
    scene.add(mesh);
    nodeMeshes.push(mesh);
  });
}

/* ═══════════════════════  VISUAL STATE UPDATES  ═══════════════════════ */

function setNodeVisual(id, state) {
  nodeState[id] = state;
  nodeMeshes[id].material = mats[state].clone();
  // Scale pulse for path nodes
  const scale = (state === 'pathD' || state === 'pathA') ? 1.4
              : (state === 'start' || state === 'end')   ? 1.25 : 1.0;
  nodeMeshes[id].scale.setScalar(scale);
}

function setEdgeColor(edgeIndex, rgb) {
  const base = edgeIndex * 6;
  edgeColors[base]     = edgeColors[base + 3] = rgb[0];
  edgeColors[base + 1] = edgeColors[base + 4] = rgb[1];
  edgeColors[base + 2] = edgeColors[base + 5] = rgb[2];
  edgeLine.geometry.attributes.color.needsUpdate = true;
}

function resetVisuals() {
  graph.nodes.forEach((_, i) => setNodeVisual(i, 'default'));
  graph.edges.forEach((_, i) => setEdgeColor(i, C.edgeDefault));
  if (startId >= 0) setNodeVisual(startId, 'start');
  if (endId   >= 0) setNodeVisual(endId,   'end');
}

/* ═══════════════════════  PATHFINDING + ANIMATION  ═══════════════════════ */

function runAlgorithms() {
  if (startId < 0 || endId < 0) return;

  resultD = dijkstra(graph, startId, endId);
  resultA = astar(graph, startId, endId);

  // Remove start/end from explored sequences (they're drawn separately)
  exploredDSeq = resultD.visitedOrder.filter(id => id !== startId && id !== endId);
  exploredASeq = resultA.visitedOrder.filter(id => id !== startId && id !== endId);
  pathDNodes   = resultD.path;
  pathANodes   = resultA.path;

  // Pre-compute edge sets for each path
  pathDEdges = pathToEdgeSet(resultD.path);
  pathAEdges = pathToEdgeSet(resultA.path);

  updateStats();

  // Kick off animation
  animating    = true;
  animTimer    = 0;
  exploreStep  = 0;   // reset step counter for fresh animation
  resetVisuals();
}

function pathToEdgeSet(path) {
  const s = new Set();
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i], to = path[i + 1];
    const e = graph.adjacency[from].find(x => x.neighbor === to);
    if (e) s.add(e.edgeIndex);
  }
  return s;
}

function updateStats() {
  const fmt = (v) => isFinite(v) ? v.toFixed(2) : '—';
  const pct  = (a, b) => b > 0 ? ((1 - a / b) * 100).toFixed(1) + '% fewer' : '—';
  const dLen = resultD?.path.length ?? 0;
  const aLen = resultA?.path.length ?? 0;
  const dVis = resultD?.visitedOrder.length ?? 0;
  const aVis = resultA?.visitedOrder.length ?? 0;

  document.getElementById('stat-d-nodes').textContent = dVis;
  document.getElementById('stat-a-nodes').textContent = aVis;
  document.getElementById('stat-d-dist').textContent  = fmt(resultD?.distance);
  document.getElementById('stat-a-dist').textContent  = fmt(resultA?.distance);
  document.getElementById('stat-d-path').textContent  = dLen ? dLen - 1 + ' hops' : 'No path';
  document.getElementById('stat-a-path').textContent  = aLen ? aLen - 1 + ' hops' : 'No path';
  document.getElementById('stat-efficiency').textContent =
    dVis > 0 ? pct(aVis, dVis) : '—';
}

/* ═══════════════════════  RAYCASTING  ═══════════════════════ */
const raycaster = new THREE.Raycaster();
raycaster.params.Line.threshold = 0.3;
const mouse = new THREE.Vector2();

function onMouseMove(e) {
  mouse.x =  (e.clientX / innerWidth)  * 2 - 1;
  mouse.y = -(e.clientY / innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(nodeMeshes);

  const newHover = hits.length ? hits[0].object.userData.nodeId : -1;
  if (newHover === hoveredId) return;

  // Un-hover old
  if (hoveredId >= 0 && nodeState[hoveredId] === 'default') {
    setNodeVisual(hoveredId, 'default');
  }
  hoveredId = newHover;
  // Hover new
  if (hoveredId >= 0 && nodeState[hoveredId] === 'default') {
    nodeMeshes[hoveredId].material = mats.hover.clone();
    nodeMeshes[hoveredId].scale.setScalar(1.1);
  }

  canvas.style.cursor = hoveredId >= 0 ? 'pointer' : 'default';
}

function onClick() {
  if (hoveredId < 0) return;
  const id = hoveredId;

  if (startId < 0 || (startId >= 0 && endId >= 0)) {
    // Fresh pick — reset everything
    startId = id;
    endId   = -1;
    animating = false;
    resetVisuals();
    setNodeVisual(id, 'start');
    setInstruction('Now click any other node to set the <span style="color:#ff3355">End</span>');
  } else if (id !== startId) {
    endId = id;
    setNodeVisual(id, 'end');
    setInstruction('Running algorithms…');
    runAlgorithms();
  }
}

window.addEventListener('mousemove', onMouseMove);
window.addEventListener('click', onClick);

/* ═══════════════════════  UI WIRING  ═══════════════════════ */
function setInstruction(html) {
  document.getElementById('instruction').innerHTML = html;
}

document.getElementById('btn-regenerate').addEventListener('click', () => {
  animating = false;
  startId = endId = hoveredId = -1;
  resultD = resultA = null;
  buildScene();
  setInstruction('Click any node to set the <span style="color:#00ff88">Start</span>');
  ['stat-d-nodes','stat-a-nodes','stat-d-dist','stat-a-dist','stat-d-path','stat-a-path','stat-efficiency']
    .forEach(id => { document.getElementById(id).textContent = '—'; });
});

document.getElementById('btn-reset').addEventListener('click', () => {
  animating = false;
  startId = endId = -1;
  resultD = resultA = null;
  resetVisuals();
  setInstruction('Click any node to set the <span style="color:#00ff88">Start</span>');
});

/* ═══════════════════════  ANIMATION TICK  ═══════════════════════ */
let prevTime  = performance.now();
let exploreStep = 0;

function tickAnimation(delta) {
  animTimer += delta;
  const steps = Math.floor(animTimer / STEP_MS);
  if (steps === 0) return;
  animTimer -= steps * STEP_MS;

  const maxLen = Math.max(exploredDSeq.length, exploredASeq.length);

  for (let s = 0; s < steps; s++) {
    if (exploreStep < maxLen) {
      // Reveal next explored node for each algorithm
      if (exploreStep < exploredDSeq.length) {
        const id = exploredDSeq[exploreStep];
        if (nodeState[id] !== 'start' && nodeState[id] !== 'end')
          setNodeVisual(id, 'exploredD');
      }
      if (exploreStep < exploredASeq.length) {
        const id = exploredASeq[exploreStep];
        if (nodeState[id] !== 'start' && nodeState[id] !== 'end' && nodeState[id] !== 'exploredD')
          setNodeVisual(id, 'exploredA');
        // If already marked exploredD, blend toward A colour (just keep D to avoid flicker)
      }
      exploreStep++;
    } else if (exploreStep === maxLen) {
      // All explored — now draw paths
      drawPaths();
      exploreStep++;
      animating = false;
      setInstruction('Done! Click to pick a new <span style="color:#00ff88">Start</span>, or Regenerate for a new graph.');
    }
  }
}

function drawPaths() {
  // Edge colours first
  pathDEdges.forEach(ei => setEdgeColor(ei, C.edgePathD));
  pathAEdges.forEach(ei => setEdgeColor(ei, C.edgePathA));

  // Node colours
  pathDNodes.forEach(id => {
    if (id !== startId && id !== endId) setNodeVisual(id, 'pathD');
  });
  pathANodes.forEach(id => {
    if (id !== startId && id !== endId) setNodeVisual(id, 'pathA');
  });
}

/* ═══════════════════════  RENDER LOOP  ═══════════════════════ */
function animate() {
  requestAnimationFrame(animate);

  const now   = performance.now();
  const delta = now - prevTime;
  prevTime    = now;

  controls.update();

  // Gentle pulse on start/end nodes
  const t = now * 0.002;
  if (startId >= 0) nodeMeshes[startId].scale.setScalar(1.25 + Math.sin(t * 2) * 0.08);
  if (endId   >= 0) nodeMeshes[endId].scale.setScalar(1.25 + Math.sin(t * 2 + Math.PI) * 0.08);

  if (animating) tickAnimation(delta);

  composer.render();
}

/* ═══════════════════════  BOOT  ═══════════════════════ */
buildScene();
setInstruction('Click any node to set the <span style="color:#00ff88">Start</span>');
animate();
