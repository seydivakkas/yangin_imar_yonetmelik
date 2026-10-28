// Simulation test for NavigationEngine in JS
const fs = require('fs');
const http = require('http');

// Simple 3D Vector matching THREE.Vector3
class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  clone() { return new Vector3(this.x, this.y, this.z); }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  distanceTo(v) {
    const dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  normalize() {
    const l = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    if (l > 1e-6) { this.x /= l; this.y /= l; this.z /= l; }
    return this;
  }
  lerp(v, alpha) {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    this.z += (v.z - this.z) * alpha;
    return this;
  }
  lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
}

// Fetch sample data from backend
const req = http.request('http://127.0.0.1:8790/api/audit/sample', { method: 'POST' }, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const data = JSON.parse(body);
    runTest(data);
  });
});
req.end();

function runTest(data) {
  const collectedRooms = [];
  data.nodes.forEach(n => {
    let cx = 0, cz = 0;
    const pts = n.polygon_2d.slice(0, -1);
    pts.forEach(([x, z]) => { cx += x; cz += z; });
    cx /= pts.length;
    cz /= pts.length;
    collectedRooms.push({
      id: String(n.id),
      name: n.name_label,
      room_type: n.room_type,
      floor_level: n.floor_level,
      pos: new Vector3(cx, n.floor_level * 3.2 + 0.15, cz)
    });
  });

  const navDoors = [];
  data.edges.forEach(e => {
    const rFrom = collectedRooms.find(r => r.id === String(e.source));
    const rTo = collectedRooms.find(r => r.id === String(e.target));
    if (rFrom && rTo) {
      const isVert = rFrom.floor_level !== rTo.floor_level;
      const pX = e.portal_xy ? e.portal_xy[0] : 0;
      const pZ = e.portal_xy ? e.portal_xy[1] : 0;
      const cand = new Vector3(pX, rFrom.pos.y, pZ);
      const rDist = rFrom.pos.distanceTo(rTo.pos);
      const isFar = cand.distanceTo(rFrom.pos) > Math.max(8.0, rDist * 1.4);
      const isDummy = (Math.abs(pX) < 0.05 && Math.abs(pZ) < 0.05) || isFar;
      const portal = (isVert || isDummy) ? rFrom.pos.clone().lerp(rTo.pos, 0.5) : cand;

      navDoors.push({
        id: `${e.source}_${e.target}`,
        source: String(e.source),
        target: String(e.target),
        door_width_cm: e.door_width_cm,
        portal_pos: portal,
        usable_in_fire: e.usable_in_fire ?? true,
        is_vertical: isVert
      });
    }
  });

  console.log(`Rooms: ${collectedRooms.length}, Doors: ${navDoors.length}`);

  // Test Salon (Node 6)
  const salon = collectedRooms.find(r => r.id === '6');
  console.log('Start room:', salon.name, salon.pos);

  // Run Dijkstra
  const roomMap = new Map();
  collectedRooms.forEach(r => roomMap.set(r.id, r));

  const adj = new Map();
  collectedRooms.forEach(r => adj.set(r.id, []));
  navDoors.forEach(d => {
    if (!d.usable_in_fire) return;
    const s = d.source, t = d.target;
    if (!roomMap.has(s) || !roomMap.has(t)) return;
    const rSrc = roomMap.get(s), rTgt = roomMap.get(t);
    const dist = rSrc.pos.distanceTo(rTgt.pos);
    const weight = Math.max(0.6, dist);
    adj.get(s).push({ target: t, door: d, weight });
    adj.get(t).push({ target: s, door: d, weight });
  });

  const distances = new Map();
  const previous = new Map();
  const visited = new Set();
  collectedRooms.forEach(r => distances.set(r.id, Infinity));
  distances.set(salon.id, 0);

  while (visited.size < roomMap.size) {
    let closestNode = null;
    let shortestDist = Infinity;
    distances.forEach((d, nodeId) => {
      if (!visited.has(nodeId) && d < shortestDist) {
        shortestDist = d;
        closestNode = nodeId;
      }
    });
    if (!closestNode || shortestDist === Infinity) break;
    visited.add(closestNode);

    const edges = adj.get(closestNode) || [];
    for (const edge of edges) {
      if (visited.has(edge.target)) continue;
      const alt = distances.get(closestNode) + edge.weight;
      if (alt < distances.get(edge.target)) {
        distances.set(edge.target, alt);
        previous.set(edge.target, { prevNode: closestNode, edge: edge.door });
      }
    }
  }

  // Find best exit
  const exitCandidates = collectedRooms.filter(r => r.room_type === 'dis_cikis');
  let bestExitId = null, minExitDist = Infinity;
  for (const ex of exitCandidates) {
    const d = distances.get(ex.id);
    if (d !== undefined && d < minExitDist) {
      minExitDist = d;
      bestExitId = ex.id;
    }
  }

  console.log('Best exit:', bestExitId, 'dist:', minExitDist);

  // Path nodes
  const pathNodes = [];
  const pathEdges = [];
  let curr = bestExitId;
  while (curr !== salon.id) {
    pathNodes.unshift(curr);
    const prevInfo = previous.get(curr);
    if (!prevInfo) break;
    pathEdges.unshift(prevInfo.edge);
    curr = prevInfo.prevNode;
  }
  pathNodes.unshift(salon.id);
  console.log('Path nodes:', pathNodes.join(' -> '));

  // Build Waypoints
  const waypoints = [];
  waypoints.push({ pos: salon.pos.clone(), wp_type: 'ROOM_CENTROID', desc: salon.name });
  for (let i = 0; i < pathNodes.length - 1; i++) {
    const fId = pathNodes[i], tId = pathNodes[i+1];
    const edge = pathEdges[i];
    const rF = roomMap.get(fId), rT = roomMap.get(tId);
    const rDist = rF.pos.distanceTo(rT.pos);
    const isFar = edge.portal_pos.distanceTo(rF.pos) > Math.max(8.0, rDist * 1.4);
    const isDummy = (Math.abs(edge.portal_pos.x) < 0.05 && Math.abs(edge.portal_pos.z) < 0.05) || isFar;
    const doorPos = isDummy ? rF.pos.clone().lerp(rT.pos, 0.5) : edge.portal_pos.clone();
    doorPos.y = rF.pos.y;
    waypoints.push({ pos: doorPos, wp_type: 'DOOR_PORTAL', desc: `${rF.name} -> ${rT.name} Kapısı` });
    waypoints.push({ pos: rT.pos.clone(), wp_type: 'ROOM_CENTROID', desc: rT.name });
  }

  const finalRoom = roomMap.get(pathNodes[pathNodes.length - 1]);
  const prevWp = waypoints[waypoints.length - 2]?.pos || finalRoom.pos;
  const outDir = finalRoom.pos.clone().sub(prevWp);
  outDir.y = 0;
  if (outDir.lengthSq() > 0.01) outDir.normalize();
  else outDir.copy(new Vector3(0, 0, -1));
  const musterPoint = finalRoom.pos.clone().addScaledVector(outDir, 3.2);
  waypoints.push({ pos: musterPoint, wp_type: 'MUSTER_POINT', desc: 'Guvenli Toplanma Noktasi' });

  console.log(`Generated ${waypoints.length} waypoints:`);
  waypoints.forEach((w, idx) => {
    console.log(`  WP ${idx}: ${w.wp_type} at (${w.pos.x.toFixed(2)}, ${w.pos.y.toFixed(2)}, ${w.pos.z.toFixed(2)}) - ${w.desc}`);
  });

  // Now simulate step-by-step at 60 FPS
  console.log('\n--- SIMULATING TRACKER AT 60 FPS (dt=0.016s) ---');
  let currentPos = waypoints[0].pos.clone();
  let currentWpIdx = 1;
  let state = 'EVACUATING';
  let elapsedTime = 0;
  let traveledDist = 0;
  const speed = 3.8;
  const dt = 0.016;

  let steps = 0;
  while (state === 'EVACUATING' && steps < 1000) {
    steps++;
    elapsedTime += dt;
    const targetWp = waypoints[currentWpIdx];
    const targetPos = targetWp.pos;
    const distToTarget = currentPos.distanceTo(targetPos);
    const moveStep = speed * dt;

    if (distToTarget <= moveStep) {
      currentPos.copy(targetPos);
      traveledDist += distToTarget;
      currentWpIdx++;
      console.log(`[t=${elapsedTime.toFixed(2)}s] REACHED WP ${currentWpIdx-1}: ${targetWp.desc}`);
      if (currentWpIdx >= waypoints.length) {
        state = 'EVACUATED';
        console.log(`[t=${elapsedTime.toFixed(2)}s] *** SUCCESS: EVACUATED! ***`);
        break;
      }
    } else {
      const dir = targetPos.clone().sub(currentPos).normalize();
      currentPos.addScaledVector(dir, moveStep);
      traveledDist += moveStep;
    }
  }
}
