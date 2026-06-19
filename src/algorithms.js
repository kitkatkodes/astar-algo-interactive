/**
 * MinHeap — O(log n) push/pop priority queue.
 * Items: { priority: number, id: number }
 */
class MinHeap {
  constructor() { this.h = []; }

  get size() { return this.h.length; }

  push(item) {
    this.h.push(item);
    this._up(this.h.length - 1);
  }

  pop() {
    const top = this.h[0];
    const last = this.h.pop();
    if (this.h.length > 0) { this.h[0] = last; this._down(0); }
    return top;
  }

  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.h[p].priority <= this.h[i].priority) break;
      [this.h[p], this.h[i]] = [this.h[i], this.h[p]];
      i = p;
    }
  }

  _down(i) {
    const n = this.h.length;
    while (true) {
      let s = i, l = 2 * i + 1, r = l + 1;
      if (l < n && this.h[l].priority < this.h[s].priority) s = l;
      if (r < n && this.h[r].priority < this.h[s].priority) s = r;
      if (s === i) break;
      [this.h[s], this.h[i]] = [this.h[i], this.h[s]];
      i = s;
    }
  }
}

/**
 * Reconstruct path by following prev[] pointers from end → start.
 * Returns [] if no path exists.
 */
function reconstruct(prev, startId, endId) {
  const path = [];
  let cur = endId;
  while (cur !== -1) { path.unshift(cur); cur = prev[cur]; }
  return path[0] === startId ? path : [];
}

/* ─────────────────────────────── Dijkstra ─────────────────────────────── */

/**
 * @returns {{ path: number[], visitedOrder: number[], distance: number }}
 */
export function dijkstra(graph, startId, endId) {
  const n = graph.nodes.length;
  const dist = new Array(n).fill(Infinity);
  const prev = new Array(n).fill(-1);
  const settled = new Set();
  const visitedOrder = [];

  dist[startId] = 0;
  const pq = new MinHeap();
  pq.push({ priority: 0, id: startId });

  while (pq.size > 0) {
    const { id } = pq.pop();
    if (settled.has(id)) continue;
    settled.add(id);
    visitedOrder.push(id);
    if (id === endId) break;

    for (const { neighbor, weight } of graph.adjacency[id]) {
      const d = dist[id] + weight;
      if (d < dist[neighbor]) {
        dist[neighbor] = d;
        prev[neighbor] = id;
        pq.push({ priority: d, id: neighbor });
      }
    }
  }

  return {
    path: reconstruct(prev, startId, endId),
    visitedOrder,
    distance: dist[endId],
  };
}

/* ──────────────────────────────── A* ──────────────────────────────────── */

/**
 * @returns {{ path: number[], visitedOrder: number[], distance: number }}
 */
export function astar(graph, startId, endId) {
  const n = graph.nodes.length;
  const gScore = new Array(n).fill(Infinity);
  const prev = new Array(n).fill(-1);
  const settled = new Set();
  const visitedOrder = [];

  const end = graph.nodes[endId];
  const h = (id) => {
    const nd = graph.nodes[id];
    return Math.sqrt((nd.x - end.x) ** 2 + (nd.y - end.y) ** 2 + (nd.z - end.z) ** 2);
  };

  gScore[startId] = 0;
  const pq = new MinHeap();
  pq.push({ priority: h(startId), id: startId });

  while (pq.size > 0) {
    const { id } = pq.pop();
    if (settled.has(id)) continue;
    settled.add(id);
    visitedOrder.push(id);
    if (id === endId) break;

    for (const { neighbor, weight } of graph.adjacency[id]) {
      const g = gScore[id] + weight;
      if (g < gScore[neighbor]) {
        gScore[neighbor] = g;
        prev[neighbor] = id;
        pq.push({ priority: g + h(neighbor), id: neighbor });
      }
    }
  }

  return {
    path: reconstruct(prev, startId, endId),
    visitedOrder,
    distance: gScore[endId],
  };
}
