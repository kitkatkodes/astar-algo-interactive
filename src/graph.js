/**
 * Graph — random node placement + proximity-based edges.
 * Guarantees full connectivity via BFS + bridging edges.
 */
export class Graph {
  constructor() {
    this.nodes = [];   // [{ id, x, y, z }]
    this.edges = [];   // [{ from, to, weight }]
    this.adjacency = {}; // { id: [{ neighbor, weight, edgeIndex }] }
  }

  generate(nodeCount = 48, spread = 38) {
    this.nodes = [];
    this.edges = [];
    this.adjacency = {};

    // Random positions — mostly flat (small Z) for clear 2-D-like layout
    for (let i = 0; i < nodeCount; i++) {
      this.nodes.push({
        id: i,
        x: (Math.random() - 0.5) * spread,
        y: (Math.random() - 0.5) * spread,
        z: (Math.random() - 0.5) * 6,
      });
      this.adjacency[i] = [];
    }

    // Connect nodes that fall within a distance threshold
    const maxDist = spread * 0.28;
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const d = this.dist(i, j);
        if (d < maxDist) this._addEdge(i, j, d);
      }
    }

    // Ensure the graph is fully connected
    this._ensureConnectivity();
  }

  dist(i, j) {
    const a = this.nodes[i], b = this.nodes[j];
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
  }

  _addEdge(i, j, weight) {
    // Avoid duplicate edges
    if (this.adjacency[i].some(e => e.neighbor === j)) return;
    const idx = this.edges.length;
    this.edges.push({ from: i, to: j, weight });
    this.adjacency[i].push({ neighbor: j, weight, edgeIndex: idx });
    this.adjacency[j].push({ neighbor: i, weight, edgeIndex: idx });
  }

  _bfsComponent(start, visited) {
    const queue = [start];
    const comp = [];
    visited[start] = true;
    while (queue.length) {
      const cur = queue.shift();
      comp.push(cur);
      for (const { neighbor } of this.adjacency[cur]) {
        if (!visited[neighbor]) {
          visited[neighbor] = true;
          queue.push(neighbor);
        }
      }
    }
    return comp;
  }

  _ensureConnectivity() {
    const n = this.nodes.length;
    const visited = new Array(n).fill(false);
    let main = this._bfsComponent(0, visited);

    for (let i = 1; i < n; i++) {
      if (visited[i]) continue;
      const comp = this._bfsComponent(i, visited);

      // Find closest pair between comp and main component
      let best = Infinity, bi = -1, bj = -1;
      for (const ni of comp) {
        for (const nj of main) {
          const d = this.dist(ni, nj);
          if (d < best) { best = d; bi = ni; bj = nj; }
        }
      }
      this._addEdge(bi, bj, best);
      main = main.concat(comp);
    }
  }
}
