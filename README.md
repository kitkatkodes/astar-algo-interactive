# Pathfinder — A* & Dijkstra Interactive Visualizer

An interactive 3D graph visualizer built with Three.js that animates both A* and Dijkstra's pathfinding algorithms side by side.

![Pathfinder preview](https://raw.githubusercontent.com/kitkatkodes/astar-algo-interactive/master/preview.png)

## Features

- **Randomly generated graphs** — 48 nodes connected by proximity, guaranteed fully connected
- **Two algorithms, one animation** — watch A* (purple) and Dijkstra (orange) explore simultaneously, then see both shortest paths highlighted
- **Live stats panel** — nodes explored, path hops, distance, and A* efficiency gain vs Dijkstra
- **3D scene** — orbit, zoom, and pan with mouse; bloom glow post-processing via `UnrealBloomPass`
- **No build step** — pure ES modules loaded via importmap from CDN

## Demo

🔗 [Live on GitHub Pages](https://kitkatkodes.github.io/astar-algo-interactive/)

## How to Use

1. Click any node → sets the **Start** (green)
2. Click another node → sets the **End** (red) and runs both algorithms
3. Watch the animation — explored nodes light up, then the shortest paths appear
4. **New Graph** generates a fresh random layout
5. **Reset Selection** clears start/end without regenerating

## Color Legend

| Color | Meaning |
|-------|---------|
| 🟢 Green | Start node |
| 🔴 Red | End node |
| 🟠 Orange | Dijkstra explored |
| 🟣 Purple | A* explored |
| 🟡 Yellow | Dijkstra shortest path |
| 🔵 Cyan | A* shortest path |

## Running Locally

Requires a local HTTP server (ES modules don't work over `file://`).

```bash
# Python
python -m http.server 8080

# Node
npx serve . -p 8080
```

Then open `http://localhost:8080`.

## Project Structure

```
├── index.html          # Importmap + UI panels
├── style.css           # Dark glassmorphism theme
├── src/
│   ├── graph.js        # Random graph generation + BFS connectivity
│   ├── algorithms.js   # MinHeap, Dijkstra, A*
│   └── main.js         # Three.js scene, bloom, raycasting, animation
```

## Tech Stack

- [Three.js r160](https://threejs.org/) — 3D rendering + bloom post-processing
- Vanilla ES modules — no bundler needed
- GitHub Pages — zero-config deployment

## Algorithm Notes

**Dijkstra's** explores all nodes by shortest known distance — guaranteed optimal but visits more nodes.

**A\*** adds a Euclidean distance heuristic to prioritize nodes closer to the goal — finds the same optimal path while typically exploring far fewer nodes.
