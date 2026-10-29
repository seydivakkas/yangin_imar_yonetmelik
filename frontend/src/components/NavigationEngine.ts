import * as THREE from 'three';

/**
 * Tel Ali 3B Tahliye & Mekânsal Navigasyon Motoru (Deterministic Topological & Geometric Router)
 * 
 * Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas)
 * ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR
 */

export type EvacuationState =
  | 'IDLE'
  | 'PLACED'
  | 'ROUTE_READY'
  | 'EVACUATING'
  | 'BLOCKED'
  | 'REROUTING'
  | 'EVACUATED'
  | 'FAILED';

export type EvacuationErrorCode =
  | 'BLOCKED_BY_WALL'
  | 'DOOR_NOT_CONNECTED'
  | 'INVALID_WAYPOINT'
  | 'ROUTE_NOT_FOUND'
  | 'MOVEMENT_STALLED'
  | 'INVALID_COORDINATE_TRANSFORM'
  | null;

export type WaypointType =
  | 'ROOM_CENTROID'
  | 'DOOR_PORTAL'
  | 'STAIR_STEP'
  | 'EXIT_PORTAL'
  | 'MUSTER_POINT';

export interface NavRoomNode {
  id: string;
  name: string;
  room_type: string;
  floor_level: number;
  pos: THREE.Vector3;
  area_m2: number;
  polygon_2d?: [number, number][];
  is_exit?: boolean;
}

export interface NavDoorEdge {
  id: string;
  source: string;
  target: string;
  door_width_cm: number;
  portal_pos: THREE.Vector3;
  is_fire_resistant: boolean;
  usable_in_fire: boolean;
  is_vertical: boolean;
}

export interface EvacuationWaypoint {
  pos: THREE.Vector3;
  wp_type: WaypointType;
  roomId?: string;
  roomName?: string;
  doorId?: string;
  floorLevel: number;
  descriptionTr: string;
}

export interface RouteResult {
  success: boolean;
  state: EvacuationState;
  errorCode: EvacuationErrorCode;
  waypoints: EvacuationWaypoint[];
  pathNodes: string[];
  totalDistanceM: number;
  horizontalDistanceM?: number;
  verticalDistanceM?: number;
  equivalentDistanceM?: number;
  stairFactor?: number;
  estimatedTimeSec: number;
  failureReasonTr: string;
}

/**
 * 2B Nokta Poligon İçi Kontrolü (Ray-Casting Algoritması)
 */
export function isPointInPolygon2D(x: number, z: number, poly?: [number, number][]): boolean {
  if (!poly || poly.length < 3) return true;
  let inside = false;
  const n = poly[poly.length - 1][0] === poly[0][0] && poly[poly.length - 1][1] === poly[0][1]
    ? poly.length - 1
    : poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i][0], zi = poly[i][1];
    const xj = poly[j][0], zj = poly[j][1];
    const intersect = ((zi > z) !== (zj > z)) && (x < ((xj - xi) * (z - zi)) / (zj - zi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * İki nokta arasındaki doğru parçasının mahal sınırları içinde kalıp kalmadığını denetler (Duvar Çarpışma Kontrolü)
 */
export function isSegmentInsidePolygon2D(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  poly?: [number, number][],
  samples: number = 5
): boolean {
  if (!poly || poly.length < 3) return true;
  for (let i = 1; i <= samples; i++) {
    const t = i / (samples + 1);
    const sx = p1.x + (p2.x - p1.x) * t;
    const sz = p1.z + (p2.z - p1.z) * t;
    if (!isPointInPolygon2D(sx, sz, poly)) {
      return false;
    }
  }
  return true;
}

/**
 * L / U tipi koridorlarda iç köşe duvarına çarpmayı önleyecek güvenli köşe dönüş ara noktası bulur
 */
export function findCornerBypassWaypoint(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  poly?: [number, number][],
  y: number = 0
): THREE.Vector3 | null {
  if (!poly || poly.length < 4) return null;
  // Eğer doğru parçası zaten serbestse köşe gerekmez
  if (isSegmentInsidePolygon2D(p1, p2, poly, 4)) return null;

  const n = poly[poly.length - 1][0] === poly[0][0] && poly[poly.length - 1][1] === poly[0][1]
    ? poly.length - 1
    : poly.length;

  let cx = 0, cz = 0;
  for (let i = 0; i < n; i++) {
    cx += poly[i][0];
    cz += poly[i][1];
  }
  cx /= n;
  cz /= n;

  let bestCorner: THREE.Vector3 | null = null;
  let minCost = Infinity;

  for (let i = 0; i < n; i++) {
    const vx = poly[i][0];
    const vz = poly[i][1];

    // Köşeden içeri doğru (merkeze doğru) 0.40m güvenli ofset
    const dirX = cx - vx;
    const dirZ = cz - vz;
    const len = Math.hypot(dirX, dirZ);
    if (len < 0.1) continue;

    const safeX = vx + (dirX / len) * 0.40;
    const safeZ = vz + (dirZ / len) * 0.40;
    const candidate = new THREE.Vector3(safeX, y, safeZ);

    if (isPointInPolygon2D(safeX, safeZ, poly)) {
      const seg1Ok = isSegmentInsidePolygon2D(p1, candidate, poly, 3);
      const seg2Ok = isSegmentInsidePolygon2D(candidate, p2, poly, 3);
      if (seg1Ok && seg2Ok) {
        const cost = p1.distanceTo(candidate) + candidate.distanceTo(p2);
        if (cost < minCost) {
          minCost = cost;
          bestCorner = candidate;
        }
      }
    }
  }

  return bestCorner;
}

/**
 * İki komşu mahal poligonunun ortak sınır duvarının orta noktasını hesaplar
 */
export function findSharedBoundaryMidpoint(
  polyA?: [number, number][],
  polyB?: [number, number][]
): THREE.Vector3 | null {
  if (!polyA || !polyB || polyA.length < 3 || polyB.length < 3) return null;

  const nA = polyA[polyA.length - 1][0] === polyA[0][0] ? polyA.length - 1 : polyA.length;
  const nB = polyB[polyB.length - 1][0] === polyB[0][0] ? polyB.length - 1 : polyB.length;

  for (let i = 0; i < nA; i++) {
    const ax1 = polyA[i][0], az1 = polyA[i][1];
    const ax2 = polyA[(i + 1) % polyA.length][0], az2 = polyA[(i + 1) % polyA.length][1];

    for (let j = 0; j < nB; j++) {
      const bx1 = polyB[j][0], bz1 = polyB[j][1];
      const bx2 = polyB[(j + 1) % polyB.length][0], bz2 = polyB[(j + 1) % polyB.length][1];

      const distStart = Math.hypot(ax1 - bx2, az1 - bz2);
      const distEnd = Math.hypot(ax2 - bx1, az2 - bz1);
      const distDirect1 = Math.hypot(ax1 - bx1, az1 - bz1);
      const distDirect2 = Math.hypot(ax2 - bx2, az2 - bz2);

      if ((distStart < 0.40 && distEnd < 0.40) || (distDirect1 < 0.40 && distDirect2 < 0.40)) {
        return new THREE.Vector3((ax1 + ax2 + bx1 + bx2) / 4, 0, (az1 + az2 + bz1 + bz2) / 4);
      }
    }
  }
  return null;
}

/**
 * Dijkstra tabanlı fiziksel kapı geçişli kaçış rotası hesaplayıcı
 */
export function computeDijkstraRoute(
  rooms: NavRoomNode[],
  doors: NavDoorEdge[],
  startRoomId: string,
  blockedDoorIds: Set<string> = new Set(),
  runSpeedMps: number = 3.8
): RouteResult {
  if (rooms.length === 0) {
    return {
      success: false,
      state: 'FAILED',
      errorCode: 'INVALID_WAYPOINT',
      waypoints: [],
      pathNodes: [],
      totalDistanceM: 0,
      estimatedTimeSec: 0,
      failureReasonTr: 'Binada kayıtlı mahal bulunamadı.',
    };
  }

  const roomMap = new Map<string, NavRoomNode>();
  rooms.forEach((r) => roomMap.set(String(r.id), r));

  const startId = String(startRoomId);
  const startRoom = roomMap.get(startId) || rooms[0];

  // Çıkış mahallerini tespit et
  const isExitNode = (r: NavRoomNode) => {
    const n = (r.name || '').toLowerCase();
    const id = String(r.id || '').toLowerCase();
    const rt = (r.room_type || '').toLowerCase();
    return Boolean(
      r.is_exit ||
      rt === 'dis_cikis' ||
      rt === 'exit' ||
      n.includes('çıkış') ||
      n.includes('cikis') ||
      n.includes('exit') ||
      id.includes('cikis') ||
      id.includes('exit')
    );
  };

  let exitNodes = rooms.filter(isExitNode);
  if (exitNodes.length === 0) {
    // Zemin kat yangın merdivenini yedek çıkış olarak kabul et
    exitNodes = rooms.filter(
      (r) => r.floor_level === 0 && (r.room_type === 'yangin_merdiveni' || r.room_type === 'kat_koridoru')
    );
  }

  if (exitNodes.length === 0) {
    return {
      success: false,
      state: 'FAILED',
      errorCode: 'ROUTE_NOT_FOUND',
      waypoints: [],
      pathNodes: [],
      totalDistanceM: 0,
      estimatedTimeSec: 0,
      failureReasonTr: 'Binada tanımlı geçerli bir dış tahliye çıkışı bulunamadı.',
    };
  }

  // Başlangıç odası zaten bir bina çıkışı ise
  if (isExitNode(startRoom)) {
    const musterPos = startRoom.pos.clone().add(new THREE.Vector3(0, 0, -3.2));
    const dist = startRoom.pos.distanceTo(musterPos);
    return {
      success: true,
      state: 'ROUTE_READY',
      errorCode: null,
      waypoints: [
        {
          pos: startRoom.pos.clone(),
          wp_type: 'ROOM_CENTROID',
          roomId: startRoom.id,
          roomName: startRoom.name,
          floorLevel: startRoom.floor_level,
          descriptionTr: `${startRoom.name} Çıkışında Hazır`,
        },
        {
          pos: musterPos,
          wp_type: 'MUSTER_POINT',
          roomId: startRoom.id,
          roomName: startRoom.name,
          floorLevel: startRoom.floor_level,
          descriptionTr: 'Güvenli Dış Toplanma Alanı',
        },
      ],
      pathNodes: [startRoom.id],
      totalDistanceM: dist,
      estimatedTimeSec: dist / runSpeedMps,
      failureReasonTr: '',
    };
  }

  // Komşuluk Grafı Oluştur (Adjacency List)
  interface AdjEdge {
    target: string;
    door: NavDoorEdge;
    weight: number;
  }
  const adj = new Map<string, AdjEdge[]>();
  rooms.forEach((r) => adj.set(String(r.id), []));

  doors.forEach((d) => {
    if (!d.usable_in_fire) return;
    if (blockedDoorIds.has(d.id)) return;

    const s = String(d.source);
    const t = String(d.target);
    if (!roomMap.has(s) || !roomMap.has(t)) return;

    const rSrc = roomMap.get(s)!;
    const rTgt = roomMap.get(t)!;
    const isVert = Boolean(d.is_vertical) || rSrc.floor_level !== rTgt.floor_level;
    const dist = rSrc.pos.distanceTo(rTgt.pos);
    // BYKHY M.39 & SFPE Standartları: Düşey merdiven yürüyüşü 2.2 kat daha fazla direnç ve süre gerektirir
    const weight = isVert
      ? Math.max(1.0, Math.abs(rSrc.pos.y - rTgt.pos.y) * 2.2)
      : Math.max(0.6, dist);

    adj.get(s)?.push({ target: t, door: d, weight });
    adj.get(t)?.push({ target: s, door: d, weight });
  });

  // Katlar arası yangın merdivenlerini otomatik bağla (dikey bağlantı eksikse)
  const stairRooms = rooms.filter((r) => r.room_type === 'yangin_merdiveni');
  const sortedStairFloors = Array.from(new Set(stairRooms.map((r) => r.floor_level))).sort((a, b) => a - b);
  for (let i = 0; i < sortedStairFloors.length - 1; i++) {
    const flA = sortedStairFloors[i];
    const flB = sortedStairFloors[i + 1];
    const sA = stairRooms.filter((r) => r.floor_level === flA);
    const sB = stairRooms.filter((r) => r.floor_level === flB);
    sA.forEach((r1) => {
      sB.forEach((r2) => {
        const id1 = String(r1.id);
        const id2 = String(r2.id);
        const horizDist = Math.hypot(r1.pos.x - r2.pos.x, r1.pos.z - r2.pos.z);
        // Çapraz bina içi atlamalarını engelle (yalnızca aynı şaft kovanı: <= 3.5m)
        if (horizDist > 3.5) return;

        const alreadyConnected = adj.get(id1)?.some((e) => e.target === id2);
        if (!alreadyConnected) {
          const vertDist = Math.abs(r1.pos.y - r2.pos.y);
          const midPortal = new THREE.Vector3(
            (r1.pos.x + r2.pos.x) / 2,
            (r1.pos.y + r2.pos.y) / 2,
            (r1.pos.z + r2.pos.z) / 2
          );
          const vertDoor: NavDoorEdge = {
            id: `stair_vert_${id1}_${id2}`,
            source: id1,
            target: id2,
            door_width_cm: 120,
            portal_pos: midPortal,
            is_fire_resistant: true,
            usable_in_fire: true,
            is_vertical: true,
          };
          // 2.2x SFPE Düşey Kaçış Yürüme Direnci Faktörü
          adj.get(id1)?.push({ target: id2, door: vertDoor, weight: vertDist * 2.2 });
          adj.get(id2)?.push({ target: id1, door: vertDoor, weight: vertDist * 2.2 });
        }
      });
    });
  }

  // Dijkstra Algoritması
  const distances = new Map<string, number>();
  const previous = new Map<string, { prevNode: string; edge: NavDoorEdge } | null>();
  const visited = new Set<string>();

  rooms.forEach((r) => distances.set(String(r.id), Infinity));
  distances.set(String(startRoom.id), 0);

  while (visited.size < roomMap.size) {
    let closestNode: string | null = null;
    let shortestDist = Infinity;

    distances.forEach((d, nodeId) => {
      if (!visited.has(nodeId) && d < shortestDist) {
        shortestDist = d;
        closestNode = nodeId;
      }
    });

    if (closestNode === null || shortestDist === Infinity) break;
    visited.add(closestNode);

    const neighbors = adj.get(closestNode) || [];
    for (const edge of neighbors) {
      if (visited.has(edge.target)) continue;
      const newDist = shortestDist + edge.weight;
      if (newDist < (distances.get(edge.target) || Infinity)) {
        distances.set(edge.target, newDist);
        previous.set(edge.target, { prevNode: closestNode, edge: edge.door });
      }
    }
  }

  // En yakın erişilebilir çıkış düğümünü bul
  let bestExitId: string | null = null;
  let minExitDist = Infinity;

  exitNodes.forEach((ex) => {
    const exId = String(ex.id);
    const d = distances.get(exId) || Infinity;
    if (d < minExitDist) {
      minExitDist = d;
      bestExitId = exId;
    }
  });

  if (!bestExitId || minExitDist === Infinity) {
    return {
      success: false,
      state: 'FAILED',
      errorCode: 'ROUTE_NOT_FOUND',
      waypoints: [],
      pathNodes: [],
      totalDistanceM: 0,
      estimatedTimeSec: 0,
      failureReasonTr: `'${startRoom.name}' odasından çıkış kapısına kesintisiz bir kapı bağlantısı bulunamadı.`,
    };
  }

  // Rotayı geriye doğru oluştur (Reconstruct Path)
  const pathNodes: string[] = [];
  const pathEdges: NavDoorEdge[] = [];
  let curr: string = bestExitId as string;

  while (curr !== String(startRoom.id)) {
    pathNodes.unshift(curr);
    const prevInfo = previous.get(curr);
    if (!prevInfo) break;
    pathEdges.unshift(prevInfo.edge);
    curr = prevInfo.prevNode;
  }
  pathNodes.unshift(String(startRoom.id));

  // Geometrik Waypoint Listesi Oluştur (Oda Merkezi -> Kapı Eşiği -> Sonraki Oda)
  const waypoints: EvacuationWaypoint[] = [];

  // 1. Başlangıç Mahali
  waypoints.push({
    pos: startRoom.pos.clone(),
    wp_type: 'ROOM_CENTROID',
    roomId: startRoom.id,
    roomName: startRoom.name,
    floorLevel: startRoom.floor_level,
    descriptionTr: `${startRoom.name} içinde hazırlandı`,
  });

  for (let i = 0; i < pathNodes.length - 1; i++) {
    const fromId = pathNodes[i];
    const toId = pathNodes[i + 1];
    const edge = pathEdges[i];
    const rFrom = roomMap.get(fromId)!;
    const rTo = roomMap.get(toId)!;

    if (edge.is_vertical) {
      // Kat merdiveni geçişi (ara basamak noktaları ekle)
      const steps = 3;
      for (let s = 1; s <= steps; s++) {
        const t = s / (steps + 1);
        const intermediate = new THREE.Vector3().lerpVectors(rFrom.pos, rTo.pos, t);
        // Merdiven sahanlığı kavis ofseti
        intermediate.x += 0.45 * Math.sin(t * Math.PI);
        intermediate.z += 0.45 * Math.cos(t * Math.PI);
        waypoints.push({
          pos: intermediate,
          wp_type: 'STAIR_STEP',
          roomId: fromId,
          doorId: edge.id,
          floorLevel: t < 0.5 ? rFrom.floor_level : rTo.floor_level,
          descriptionTr: `Yangın Merdiveni (${rFrom.floor_level}. Kattan ${rTo.floor_level}. Kata İniş)`,
        });
      }
    } else {
      // Fiziksel kapı eşiği (portal) noktası
      let doorPortalPos: THREE.Vector3;
      const isOriginDummy = Math.abs(edge.portal_pos.x) < 0.05 && Math.abs(edge.portal_pos.z) < 0.05;
      
      if (!isOriginDummy) {
        doorPortalPos = edge.portal_pos.clone();
      } else if (rFrom.polygon_2d && rTo.polygon_2d) {
        const sharedMid = findSharedBoundaryMidpoint(rFrom.polygon_2d, rTo.polygon_2d);
        doorPortalPos = sharedMid ? sharedMid.clone() : edge.portal_pos.clone();
      } else {
        doorPortalPos = edge.portal_pos.clone();
      }
      doorPortalPos.y = rFrom.pos.y; // Kapı tabanı oda zemin kotuna kilitli

      // Duvar Çarpışma Kontrolü: rFrom içindeki önceki noktadan kapıya giderken iç köşe duvarına çarpıyor mu?
      const prevWp = waypoints[waypoints.length - 1];
      if (prevWp && rFrom.polygon_2d) {
        const cornerBypass = findCornerBypassWaypoint(prevWp.pos, doorPortalPos, rFrom.polygon_2d, rFrom.pos.y);
        if (cornerBypass) {
          waypoints.push({
            pos: cornerBypass,
            wp_type: 'ROOM_CENTROID',
            roomId: fromId,
            roomName: rFrom.name,
            floorLevel: rFrom.floor_level,
            descriptionTr: `${rFrom.name} İçi Güvenli Köşe Dönüşü`,
          });
        }
      }

      // Kapı Eşiği (Portal) Ara Düğümü
      waypoints.push({
        pos: doorPortalPos,
        wp_type: 'DOOR_PORTAL',
        roomId: fromId,
        doorId: edge.id,
        floorLevel: rFrom.floor_level,
        descriptionTr: `${rFrom.name} ➔ ${rTo.name} Kapısından Geçiliyor`,
      });
    }

    // Sonraki mahalin merkezi veya ara koridor yönlendirmesi
    const isDestination = i === pathNodes.length - 2;
    if (isDestination) {
      waypoints.push({
        pos: rTo.pos.clone(),
        wp_type: 'ROOM_CENTROID',
        roomId: toId,
        roomName: rTo.name,
        floorLevel: rTo.floor_level,
        descriptionTr: `${rTo.name} Alanına Ulaşıldı`,
      });
    } else {
      // Ara geçiş mahali (örneğin Daire Antresi veya Kat Koridoru)
      const nextEdge = pathEdges[i + 1];
      let nextDoorPos: THREE.Vector3 | null = null;
      if (nextEdge && !nextEdge.is_vertical && (Math.abs(nextEdge.portal_pos.x) >= 0.05 || Math.abs(nextEdge.portal_pos.z) >= 0.05)) {
        nextDoorPos = nextEdge.portal_pos.clone();
        nextDoorPos.y = rTo.pos.y;
      }

      const lastPortalPos = waypoints[waypoints.length - 1].pos;

      if (rTo.polygon_2d && nextDoorPos) {
        // Kapıdan bir sonraki kapıya gidişte iç köşe engeli var mı?
        const cornerBypass = findCornerBypassWaypoint(lastPortalPos, nextDoorPos, rTo.polygon_2d, rTo.pos.y);
        if (cornerBypass) {
          waypoints.push({
            pos: cornerBypass,
            wp_type: 'ROOM_CENTROID',
            roomId: toId,
            roomName: rTo.name,
            floorLevel: rTo.floor_level,
            descriptionTr: `${rTo.name} Koridor Köşe Dönüşü`,
          });
        } else if (isSegmentInsidePolygon2D(lastPortalPos, rTo.pos, rTo.polygon_2d, 3) &&
                   isSegmentInsidePolygon2D(rTo.pos, nextDoorPos, rTo.polygon_2d, 3)) {
          waypoints.push({
            pos: rTo.pos.clone(),
            wp_type: 'ROOM_CENTROID',
            roomId: toId,
            roomName: rTo.name,
            floorLevel: rTo.floor_level,
            descriptionTr: `${rTo.name} Alanından Geçiliyor`,
          });
        }
      } else {
        waypoints.push({
          pos: rTo.pos.clone(),
          wp_type: 'ROOM_CENTROID',
          roomId: toId,
          roomName: rTo.name,
          floorLevel: rTo.floor_level,
          descriptionTr: `${rTo.name} Alanına Ulaşıldı`,
        });
      }
    }
  }

  // Dış kapıdan 3.2m açık alana uzanan Güvenli Toplanma Noktası (Muster Point)
  const finalRoom = roomMap.get(pathNodes[pathNodes.length - 1])!;
  const prevWpPos = waypoints[waypoints.length - 2]?.pos || finalRoom.pos;
  const outDir = finalRoom.pos.clone().sub(prevWpPos);
  outDir.y = 0;
  if (outDir.lengthSq() > 0.01) {
    outDir.normalize();
  } else {
    outDir.set(0, 0, -1);
  }

  const musterPoint = finalRoom.pos.clone().addScaledVector(outDir, 3.2);
  waypoints.push({
    pos: musterPoint,
    wp_type: 'MUSTER_POINT',
    roomId: finalRoom.id,
    roomName: finalRoom.name,
    floorLevel: finalRoom.floor_level,
    descriptionTr: 'Güvenli Dış Toplanma Alanına Ulaşıldı (Tahliye Başarılı)',
  });

  // Toplam mesafe hesabı (SFPE Düşey 2.2x Efor Ayrımı ile)
  let totalDistanceM = 0;
  let horizontalDistanceM = 0;
  let verticalDistanceM = 0;

  for (let w = 0; w < waypoints.length - 1; w++) {
    const p1 = waypoints[w].pos;
    const p2 = waypoints[w + 1].pos;
    const segDist = p1.distanceTo(p2);
    totalDistanceM += segDist;

    const horizSeg = Math.hypot(p2.x - p1.x, p2.z - p1.z);
    const vertSeg = Math.abs(p2.y - p1.y);
    horizontalDistanceM += horizSeg;
    verticalDistanceM += vertSeg;
  }

  // Eşdeğer kaçış mesafesi (SFPE & BYKHY M.39: Düşey kaçışta merdiven basamakları 2.2x yürüme direnci katsayısına sahiptir)
  const stairFactor = 2.2;
  const equivalentDistanceM = horizontalDistanceM + (verticalDistanceM * stairFactor);
  const estimatedTimeSec = equivalentDistanceM / runSpeedMps;

  return {
    success: true,
    state: 'ROUTE_READY',
    errorCode: null,
    waypoints,
    pathNodes,
    totalDistanceM: Number(totalDistanceM.toFixed(2)),
    horizontalDistanceM: Number(horizontalDistanceM.toFixed(2)),
    verticalDistanceM: Number(verticalDistanceM.toFixed(2)),
    equivalentDistanceM: Number(equivalentDistanceM.toFixed(2)),
    stairFactor,
    estimatedTimeSec: Number(estimatedTimeSec.toFixed(1)),
    failureReasonTr: '',
  };
}

/**
 * Kare Hızından Bağımsız Tahliye İlerleme ve Takılma Kontrolcüsü (Runtime Simulation Engine)
 */
export class EvacuationProgressTracker {
  public state: EvacuationState = 'IDLE';
  public errorCode: EvacuationErrorCode = null;
  public waypoints: EvacuationWaypoint[] = [];
  public currentWpIdx: number = 0;
  public currentPos: THREE.Vector3 = new THREE.Vector3();
  public runSpeed: number;
  public stallTimeoutSec: number;
  public timeSinceProgressSec: number = 0;
  public elapsedTimeSec: number = 0;
  public traveledDistanceM: number = 0;
  public statusTextTr: string = 'Hazır';
  public health: number = 100;

  constructor(runSpeedMps: number = 3.8, stallTimeoutSec: number = 3.5) {
    this.runSpeed = runSpeedMps;
    this.stallTimeoutSec = stallTimeoutSec;
  }

  public setRoute(route: RouteResult) {
    if (!route.success || route.waypoints.length === 0) {
      this.state = 'FAILED';
      this.errorCode = route.errorCode || 'ROUTE_NOT_FOUND';
      this.statusTextTr = route.failureReasonTr || 'Tahliye rotası bulunamadı.';
      this.waypoints = [];
      this.currentWpIdx = 0;
      return;
    }

    this.waypoints = route.waypoints;
    this.currentWpIdx = 0;
    this.currentPos = route.waypoints[0].pos.clone();
    this.state = 'PLACED';
    this.errorCode = null;
    this.elapsedTimeSec = 0;
    this.timeSinceProgressSec = 0;
    this.traveledDistanceM = 0;
    this.health = 100;
    this.statusTextTr = this.waypoints[0].descriptionTr;
  }

  public start() {
    if (this.waypoints.length < 2) {
      this.state = 'FAILED';
      this.errorCode = 'ROUTE_NOT_FOUND';
      this.statusTextTr = 'Geçerli tahliye güzergâhı yok.';
      return;
    }

    this.state = 'EVACUATING';
    this.currentWpIdx = 1;
    this.statusTextTr = this.waypoints[1].descriptionTr;
    this.timeSinceProgressSec = 0;
  }

  public update(
    deltaTime: number,
    fireOrigin?: THREE.Vector3,
    smokeLayerHeight: number = 2.8
  ): EvacuationState {
    if (this.state !== 'EVACUATING') return this.state;

    this.elapsedTimeSec += deltaTime;
    const targetWp = this.waypoints[this.currentWpIdx];
    const targetPos = targetWp.pos;

    const distToTarget = this.currentPos.distanceTo(targetPos);
    const moveStep = this.runSpeed * deltaTime;

    // Takılma (Stall) denetimi
    if (distToTarget <= moveStep || moveStep > 0.02) {
      this.timeSinceProgressSec = 0;
    } else {
      this.timeSinceProgressSec += deltaTime;
    }

    if (this.timeSinceProgressSec > this.stallTimeoutSec) {
      this.state = 'BLOCKED';
      this.errorCode = 'MOVEMENT_STALLED';
      this.statusTextTr = 'İlerleme durdu: Karakter engelle karşılaştı (MOVEMENT_STALLED).';
      return this.state;
    }

    // Hedefe doğru vektörel hareket
    if (distToTarget <= moveStep) {
      this.currentPos.copy(targetPos);
      this.traveledDistanceM += distToTarget;
      this.currentWpIdx += 1;

      if (this.currentWpIdx >= this.waypoints.length) {
        // Kesin Başarı Koşulu: Güvenli Dış Toplanma Alanına (Muster Point) Ulaşıldı
        this.state = 'EVACUATED';
        this.statusTextTr = '✓ Tahliye Başarılı: Güvenli Dış Toplanma Alanına Ulaşıldı!';
        return this.state;
      } else {
        const nextWp = this.waypoints[this.currentWpIdx];
        this.statusTextTr = nextWp.descriptionTr;
      }
    } else {
      const dir = targetPos.clone().sub(this.currentPos).normalize();
      this.currentPos.addScaledVector(dir, moveStep);
      this.traveledDistanceM += moveStep;
    }

    // Duman maruziyeti ve sağlık hesabı (fiziksel maruziyet)
    if (fireOrigin && smokeLayerHeight < 1.8) {
      const distToFire = this.currentPos.distanceTo(fireOrigin);
      if (distToFire < 7.0 && targetWp.wp_type !== 'STAIR_STEP') {
        const dose = (1.8 - smokeLayerHeight) * 1.8 * deltaTime;
        this.health = Math.max(15, this.health - dose);
      }
    }

    return this.state;
  }
}
