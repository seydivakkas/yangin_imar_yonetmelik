import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CameraPreset, DiagramYonetmelikPipelineOutput, WallHeightMode } from '../types/pipeline';

interface ThreeSceneProps {
  data: DiagramYonetmelikPipelineOutput | null;
  activeFloor: 'all' | number;
  explodedZ: number;
  wallHeightMode: WallHeightMode;
  cameraPreset: CameraPreset;
  simulationTime: number;
  showSmoke: boolean;
  showRAGOverlay: boolean;
  showBottlenecks: boolean;
  showBIMArchitecture?: boolean;
  cadDiffMode: 'before' | 'after' | 'both';
  onSelectElement: (element: { id: string; type: 'room' | 'door' | 'violation'; details: any }) => void;
}

// Semantic room color palette for realistic architectural floor finishes
const ROOM_FINISH_COLORS: Record<string, { floor: number; wall: number; roughness: number }> = {
  salon: { floor: 0x3E4C5E, wall: 0x334155, roughness: 0.65 },
  oda: { floor: 0x475569, wall: 0x334155, roughness: 0.70 },
  mutfak: { floor: 0x526072, wall: 0x334155, roughness: 0.35 },
  banyo: { floor: 0x4C566A, wall: 0x334155, roughness: 0.30 },
  kat_koridoru: { floor: 0x1E293B, wall: 0x475569, roughness: 0.45 },
  yangin_holu: { floor: 0x064E3B, wall: 0x047857, roughness: 0.50 },
  yangin_merdiveni: { floor: 0x0F172A, wall: 0x64748B, roughness: 0.80 },
  asansor: { floor: 0x1E293B, wall: 0x64748B, roughness: 0.60 },
  dikey_cekirdek: { floor: 0x0F172A, wall: 0x64748B, roughness: 0.70 },
  siginak: { floor: 0x451A03, wall: 0x78350F, roughness: 0.75 },
  otopark: { floor: 0x18181B, wall: 0x3F3F46, roughness: 0.85 },
  dis_cikis: { floor: 0x065F46, wall: 0x10B981, roughness: 0.50 },
};

// Texture cache for 3D room floor badges
const BADGE_TEXTURE_CACHE = new Map<string, THREE.CanvasTexture>();

function getRoomBadgeTexture(name: string, areaM2: number, cat: string): THREE.CanvasTexture {
  const key = `${name}_${areaM2}_${cat}`;
  if (BADGE_TEXTURE_CACHE.has(key)) {
    return BADGE_TEXTURE_CACHE.get(key)!;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // Background panel with soft rounded corners
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.beginPath();
  ctx.roundRect(8, 8, 240, 112, 16);
  ctx.fill();

  // Accent border by room type
  ctx.strokeStyle =
    cat === 'yangin_holu'
      ? '#10B981'
      : cat === 'yangin_merdiveni'
      ? '#06B6D4'
      : cat === 'siginak'
      ? '#F59E0B'
      : '#00F0FF';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Room Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cleanName = name.length > 18 ? name.substring(0, 16) + '...' : name;
  ctx.fillText(cleanName.toUpperCase(), 128, 48);

  // Area (m²)
  ctx.fillStyle = '#38BDF8';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(`${areaM2 > 0 ? areaM2.toFixed(1) : '--'} m²`, 128, 88);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  BADGE_TEXTURE_CACHE.set(key, texture);
  return texture;
}

export const ThreeScene: React.FC<ThreeSceneProps> = ({
  data,
  activeFloor,
  explodedZ,
  wallHeightMode,
  cameraPreset,
  simulationTime,
  showSmoke,
  showRAGOverlay,
  showBottlenecks,
  showBIMArchitecture = true,
  cadDiffMode,
  onSelectElement,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const buildingGroupRef = useRef<THREE.Group | null>(null);
  const ragGroupRef = useRef<THREE.Group | null>(null);
  const smokeGroupRef = useRef<THREE.Group | null>(null);
  const mouseRef = useRef(new THREE.Vector2());
  const raycasterRef = useRef(new THREE.Raycaster());

  // Orbit control internal state
  const isDraggingRef = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const cameraTargetRef = useRef(new THREE.Vector3(10, 4, 18));

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070A11);
    scene.fog = new THREE.FogExp2(0x070A11, 0.006);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(42, 38, 46);
    camera.lookAt(cameraTargetRef.current);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    rendererRef.current = renderer;

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    // Realistic PBR Lighting: Directional Sun + Hemisphere Sky + Warm Fill
    const hemiLight = new THREE.HemisphereLight(0x38BDF8, 0x0F172A, 0.85);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xFFFFFF, 1.3);
    sunLight.position.set(45, 65, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 250;
    const d = 45;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0004;
    scene.add(sunLight);

    const warmFill = new THREE.DirectionalLight(0xF59E0B, 0.45);
    warmFill.position.set(-35, 40, -25);
    scene.add(warmFill);

    // Architectural Ground Grid
    const gridHelper = new THREE.GridHelper(100, 100, 0x00F0FF, 0x1E293B);
    gridHelper.position.y = -3.8;
    scene.add(gridHelper);

    // Main Scene Groups
    const buildingGroup = new THREE.Group();
    scene.add(buildingGroup);
    buildingGroupRef.current = buildingGroup;

    const ragGroup = new THREE.Group();
    scene.add(ragGroup);
    ragGroupRef.current = ragGroup;

    const smokeGroup = new THREE.Group();
    scene.add(smokeGroup);
    smokeGroupRef.current = smokeGroup;

    // Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smoke Layer Pulsing & Volumetric Fire Source
      if (smokeGroupRef.current) {
        smokeGroupRef.current.children.forEach((child) => {
          if (child instanceof THREE.Mesh && child.name === 'fire_origin') {
            const scale = 1.0 + Math.sin(elapsedTime * 6) * 0.15;
            child.scale.set(scale, scale, scale);
          }
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    // Mouse Interaction Handlers (Orbit, Pan, Zoom, Object Raycast)
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 || e.button === 2) {
        isDraggingRef.current = true;
        previousMousePosition.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - previousMousePosition.current.x;
      const deltaY = e.clientY - previousMousePosition.current.y;

      if (e.buttons === 1) {
        // Orbit Rotate
        const rotSpeed = 0.005;
        const offset = camera.position.clone().sub(cameraTargetRef.current);
        const radius = offset.length();
        let theta = Math.atan2(offset.x, offset.z);
        let phi = Math.acos(Math.max(0.01, Math.min(0.99, offset.y / radius)));

        theta -= deltaX * rotSpeed;
        phi -= deltaY * rotSpeed;
        phi = Math.max(0.08, Math.min(Math.PI / 2 - 0.02, phi));

        offset.x = radius * Math.sin(phi) * Math.sin(theta);
        offset.y = radius * Math.cos(phi);
        offset.z = radius * Math.sin(phi) * Math.cos(theta);

        camera.position.copy(cameraTargetRef.current).add(offset);
        camera.lookAt(cameraTargetRef.current);
      } else if (e.buttons === 2) {
        // Pan
        const panSpeed = 0.035;
        const right = new THREE.Vector3()
          .crossVectors(camera.up, camera.getWorldDirection(new THREE.Vector3()))
          .normalize();
        camera.position.addScaledVector(right, deltaX * panSpeed);
        cameraTargetRef.current.addScaledVector(right, deltaX * panSpeed);
        camera.position.y += deltaY * panSpeed;
        cameraTargetRef.current.y += deltaY * panSpeed;
        camera.lookAt(cameraTargetRef.current);
      }

      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomSpeed = 0.05;
      const dir = camera.position.clone().sub(cameraTargetRef.current).normalize();
      const dist = camera.position.distanceTo(cameraTargetRef.current);
      const newDist = Math.max(6, Math.min(220, dist + e.deltaY * zoomSpeed));
      camera.position.copy(cameraTargetRef.current).addScaledVector(dir, newDist);
    };

    const handleClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      if (buildingGroupRef.current) {
        const intersects = raycasterRef.current.intersectObjects(
          buildingGroupRef.current.children,
          true
        );
        if (intersects.length > 0) {
          for (const hit of intersects) {
            const obj = hit.object;
            if (obj.userData && obj.userData.id) {
              onSelectElement({
                id: obj.userData.id,
                type: obj.userData.type || 'room',
                details: obj.userData,
              });
              break;
            }
          }
        }
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    domElement.addEventListener('wheel', handleWheel, { passive: false });
    domElement.addEventListener('click', handleClick);

    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      domElement.removeEventListener('wheel', handleWheel);
      domElement.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // Camera Presets
  useEffect(() => {
    if (!cameraRef.current) return;
    const cam = cameraRef.current;
    const target = cameraTargetRef.current;

    if (cameraPreset === 'isometric') {
      cam.position.set(target.x + 32, target.y + 32, target.z + 32);
    } else if (cameraPreset === 'top_down') {
      cam.position.set(target.x, target.y + 75, target.z + 0.01);
    } else if (cameraPreset === 'side_elevation') {
      cam.position.set(target.x + 55, target.y + 8, target.z);
    } else if (cameraPreset === 'first_person') {
      cam.position.set(target.x - 8, target.y + 1.8, target.z - 6);
      target.set(target.x + 4, target.y + 1.8, target.z);
    }
    cam.lookAt(target);
  }, [cameraPreset]);

  // =========================================================================
  // BIM ARCHITECTURAL MODEL BUILDER
  // =========================================================================
  useEffect(() => {
    if (!buildingGroupRef.current || !ragGroupRef.current || !smokeGroupRef.current) return;
    const bGroup = buildingGroupRef.current;
    const rGroup = ragGroupRef.current;
    const sGroup = smokeGroupRef.current;

    // Clear old 3D children
    while (bGroup.children.length > 0) bGroup.remove(bGroup.children[0]);
    while (rGroup.children.length > 0) rGroup.remove(rGroup.children[0]);
    while (sGroup.children.length > 0) sGroup.remove(sGroup.children[0]);

    // Wall Height Modes: Dollhouse 1.20m (Default), Full 2.80m, Slab/Plan 0.15m
    const wallH =
      wallHeightMode === 'full' ? 2.80 : wallHeightMode === 'cut' ? 1.20 : 0.15;
    const storyHeight = 3.20 * explodedZ;

    // Collect Nodes (Rooms) and Edges (Doors)
    interface RoomNode {
      id: string;
      name: string;
      room_type: string;
      area_m2: number;
      floor_level: number;
      polygon_2d: [number, number][];
    }

    interface DoorEdge {
      source: string;
      target: string;
      door_width_cm: number;
      portal_xy: [number, number];
      is_fire_resistant: boolean;
      usable_in_fire: boolean;
    }

    let allRooms: RoomNode[] = [];
    let allDoors: DoorEdge[] = [];

    if (data && data.nodes && data.nodes.length > 0) {
      allRooms = data.nodes.map((n: any) => ({
        id: String(n.id),
        name: n.name_label || `${n.room_type} (${n.floor_level}. Kat)`,
        room_type: n.room_type || 'oda',
        area_m2: Number(n.area_m2 || 0),
        floor_level: Number(n.floor_level || 0),
        polygon_2d: n.polygon_2d && n.polygon_2d.length >= 3 ? n.polygon_2d : [],
      }));

      if (data.edges) {
        allDoors = data.edges.map((e: any) => ({
          source: String(e.source),
          target: String(e.target),
          door_width_cm: Number(e.door_width_cm || 90),
          portal_xy: e.portal_xy || [0, 0],
          is_fire_resistant: Boolean(e.is_fire_resistant),
          usable_in_fire: Boolean(e.usable_in_fire ?? true),
        }));
      }
    } else {
      // High-Fidelity Multi-Floor BIM Template (Floors: -1, 0, 1)
      const baseFloors = [-1, 0, 1];
      baseFloors.forEach((fl) => {
        const prefix = `K${fl}`;
        allRooms.push(
          {
            id: `${prefix}_salon_1`,
            name: `Salon A (Kat ${fl})`,
            room_type: 'salon',
            area_m2: 28.0,
            floor_level: fl,
            polygon_2d: [
              [0, 20],
              [7, 20],
              [7, 26],
              [0, 26],
              [0, 20],
            ],
          },
          {
            id: `${prefix}_oda_1`,
            name: `Yatak Odası (Kat ${fl})`,
            room_type: 'oda',
            area_m2: 14.5,
            floor_level: fl,
            polygon_2d: [
              [0, 26],
              [7, 26],
              [7, 31],
              [0, 31],
              [0, 26],
            ],
          },
          {
            id: `${prefix}_koridor`,
            name: `Kat Koridoru`,
            room_type: 'kat_koridoru',
            area_m2: 18.0,
            floor_level: fl,
            polygon_2d: [
              [7, 20],
              [11, 20],
              [11, 31],
              [7, 31],
              [7, 20],
            ],
          },
          {
            id: `${prefix}_yangin_holu`,
            name: `Yangın Güvenlik Holü`,
            room_type: 'yangin_holu',
            area_m2: 4.8,
            floor_level: fl,
            polygon_2d: [
              [11, 20],
              [15, 20],
              [15, 25],
              [11, 25],
              [11, 20],
            ],
          },
          {
            id: `${prefix}_yangin_merdiveni`,
            name: `Yangın Kaçış Merdiveni`,
            room_type: 'yangin_merdiveni',
            area_m2: 12.0,
            floor_level: fl,
            polygon_2d: [
              [11, 25],
              [15, 25],
              [15, 31],
              [11, 31],
              [11, 25],
            ],
          },
          {
            id: `${prefix}_asansor`,
            name: `Asansör Şaftı`,
            room_type: 'asansor',
            area_m2: 6.0,
            floor_level: fl,
            polygon_2d: [
              [15, 20],
              [18, 20],
              [18, 25],
              [15, 25],
              [15, 20],
            ],
          }
        );

        if (fl === -1) {
          allRooms.push(
            {
              id: `K-1_siginak`,
              name: `Serpinti Sığınağı`,
              room_type: 'siginak',
              area_m2: 54.0,
              floor_level: fl,
              polygon_2d: [
                [0, 31],
                [11, 31],
                [11, 38],
                [0, 38],
                [0, 31],
              ],
            },
            {
              id: `K-1_otopark`,
              name: `Kapalı Otopark`,
              room_type: 'otopark',
              area_m2: 120.0,
              floor_level: fl,
              polygon_2d: [
                [11, 31],
                [20, 31],
                [20, 42],
                [11, 42],
                [11, 31],
              ],
            }
          );
        } else if (fl === 0) {
          allRooms.push({
            id: `K0_dis_cikis`,
            name: `Ana Tahliye Çıkışı`,
            room_type: 'dis_cikis',
            area_m2: 8.5,
            floor_level: fl,
            polygon_2d: [
              [7, 16],
              [11, 16],
              [11, 20],
              [7, 20],
              [7, 16],
            ],
          });
        }

        // Doors for floor
        allDoors.push(
          {
            source: `${prefix}_salon_1`,
            target: `${prefix}_koridor`,
            door_width_cm: 90,
            portal_xy: [7, 23],
            is_fire_resistant: false,
            usable_in_fire: true,
          },
          {
            source: `${prefix}_koridor`,
            target: `${prefix}_yangin_holu`,
            door_width_cm: 90,
            portal_xy: [11, 22.5],
            is_fire_resistant: true,
            usable_in_fire: true,
          },
          {
            source: `${prefix}_yangin_holu`,
            target: `${prefix}_yangin_merdiveni`,
            door_width_cm: 120,
            portal_xy: [13, 25],
            is_fire_resistant: true,
            usable_in_fire: true,
          }
        );
      });
    }

    // -------------------------------------------------------------------------
    // CAD MULTI-SHEET FLOOR ALIGNMENT (Vertical Core Stacking)
    // -------------------------------------------------------------------------
    // In multi-floor 2D CAD drawings, floors are often drafted side-by-side or stacked on sheets (e.g. Y=0, Y=25m, Y=50m...).
    // For realistic 3D BIM rendering, we align floors so their vertical escape cores / footprints stack continuously.
    const rawFloorsMap = new Map<number, RoomNode[]>();
    allRooms.forEach((r) => {
      if (!rawFloorsMap.has(r.floor_level)) rawFloorsMap.set(r.floor_level, []);
      rawFloorsMap.get(r.floor_level)!.push(r);
    });

    const sortedFloorLevels = Array.from(rawFloorsMap.keys()).sort((a, b) => a - b);
    const baseFloorLvl = sortedFloorLevels[0] ?? 0;
    const baseRooms = rawFloorsMap.get(baseFloorLvl) || [];
    let baseMinX = 0, baseMinZ = 0;
    if (baseRooms.length > 0) {
      let bMinX = Infinity, bMinZ = Infinity;
      baseRooms.forEach(r => r.polygon_2d.forEach(([x, z]) => {
        if (x < bMinX) bMinX = x;
        if (z < bMinZ) bMinZ = z;
      }));
      if (bMinX !== Infinity) {
        baseMinX = bMinX;
        baseMinZ = bMinZ;
      }
    }

    const floorOffsets = new Map<number, { dx: number; dz: number }>();
    rawFloorsMap.forEach((roomsOnFloor, fl) => {
      let fMinX = Infinity, fMinZ = Infinity;
      roomsOnFloor.forEach(r => r.polygon_2d.forEach(([x, z]) => {
        if (x < fMinX) fMinX = x;
        if (z < fMinZ) fMinZ = z;
      }));

      if (fMinX !== Infinity && (Math.abs(fMinZ - baseMinZ) > 8 || Math.abs(fMinX - baseMinX) > 8)) {
        const shiftX = fMinX - baseMinX;
        const shiftZ = fMinZ - baseMinZ;
        floorOffsets.set(fl, { dx: shiftX, dz: shiftZ });

        roomsOnFloor.forEach(r => {
          r.polygon_2d = r.polygon_2d.map(([x, z]) => [x - shiftX, z - shiftZ]);
        });
      }
    });

    // Also shift door portal coordinates for affected floors
    const roomFloorMap = new Map<string, number>();
    allRooms.forEach(r => roomFloorMap.set(r.id, r.floor_level));

    allDoors.forEach(d => {
      const fl = roomFloorMap.get(d.source) ?? roomFloorMap.get(d.target);
      if (fl !== undefined && floorOffsets.has(fl)) {
        const { dx, dz } = floorOffsets.get(fl)!;
        d.portal_xy = [d.portal_xy[0] - dx, d.portal_xy[1] - dz];
      }
    });

    // Determine Aligned Building Bounding Box and Center Camera Focus
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    allRooms.forEach((r) => {
      r.polygon_2d.forEach(([x, z]) => {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      });
    });

    const floorsMap = rawFloorsMap;
    const sortedFloors = sortedFloorLevels;
    const minFloor = sortedFloors[0] ?? 0;
    const maxFloor = sortedFloors[sortedFloors.length - 1] ?? 0;
    const totalBuildingH = (maxFloor - minFloor + 1) * storyHeight;

    if (minX !== Infinity) {
      const centerX = (minX + maxX) / 2;
      const centerZ = (minZ + maxZ) / 2;
      const centerY = ((minFloor + maxFloor) * storyHeight) / 2 + 1.2;
      cameraTargetRef.current.set(centerX, centerY, centerZ);

      // Auto-frame camera based on building span and height
      if (cameraRef.current) {
        const cam = cameraRef.current;
        const footprintSpan = Math.max(maxX - minX, maxZ - minZ);
        const overallSpan = Math.max(footprintSpan, totalBuildingH);
        const camDistance = Math.max(36, overallSpan * 1.35);

        if (cameraPreset === 'isometric') {
          cam.position.set(centerX + camDistance * 0.72, centerY + camDistance * 0.65, centerZ + camDistance * 0.72);
        } else if (cameraPreset === 'top_down') {
          cam.position.set(centerX, centerY + camDistance * 1.25, centerZ + 0.01);
        } else if (cameraPreset === 'side_elevation') {
          cam.position.set(centerX + camDistance * 1.15, centerY, centerZ);
        }
        cam.lookAt(centerX, centerY, centerZ);
      }
    }

    // =========================================================================
    // RENDER EACH FLOOR
    // =========================================================================
    sortedFloors.forEach((floorLevel) => {
      const isFloorActive = activeFloor === 'all' || activeFloor === floorLevel;
      const floorY = floorLevel * storyHeight;
      const floorRooms = floorsMap.get(floorLevel) || [];

      // -----------------------------------------------------------------------
      // 1. BETONARME KAT DÖŞEME PLAKASI (0.25m Kalınlık, #1E293B, Edges)
      // -----------------------------------------------------------------------
      let fMinX = Infinity,
        fMaxX = -Infinity,
        fMinZ = Infinity,
        fMaxZ = -Infinity;
      floorRooms.forEach((r) => {
        r.polygon_2d.forEach(([x, z]) => {
          if (x < fMinX) fMinX = x;
          if (x > fMaxX) fMaxX = x;
          if (z < fMinZ) fMinZ = z;
          if (z > fMaxZ) fMaxZ = z;
        });
      });

      const pad = 0.8;
      const slabW = fMaxX - fMinX + pad * 2;
      const slabD = fMaxZ - fMinZ + pad * 2;
      const slabThickness = 0.25;

      const slabGeo = new THREE.BoxGeometry(slabW, slabThickness, slabD);
      const slabMat = new THREE.MeshStandardMaterial({
        color: isFloorActive ? 0x1E293B : 0x0F172A,
        roughness: 0.85,
        metalness: 0.15,
        transparent: !isFloorActive,
        opacity: isFloorActive ? 1.0 : 0.15,
      });

      const slabMesh = new THREE.Mesh(slabGeo, slabMat);
      slabMesh.position.set(
        (fMinX + fMaxX) / 2,
        floorY - slabThickness / 2,
        (fMinZ + fMaxZ) / 2
      );
      slabMesh.receiveShadow = true;
      bGroup.add(slabMesh);

      // Kat Silmesi / Pah Çizgisi
      const slabEdges = new THREE.EdgesGeometry(slabGeo);
      const slabEdgeMat = new THREE.LineBasicMaterial({
        color: isFloorActive ? 0x475569 : 0x1E293B,
        linewidth: 1.5,
      });
      const slabWire = new THREE.LineSegments(slabEdges, slabEdgeMat);
      slabWire.position.copy(slabMesh.position);
      bGroup.add(slabWire);

      // Floor Level Marker
      const floorTagGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.1, 16);
      const floorTagMat = new THREE.MeshStandardMaterial({
        color: isFloorActive ? 0x00F0FF : 0x334155,
        roughness: 0.4,
      });
      const floorTag = new THREE.Mesh(floorTagGeo, floorTagMat);
      floorTag.position.set(fMinX - 1.8, floorY, fMinZ);
      bGroup.add(floorTag);

      // -----------------------------------------------------------------------
      // 2. TAŞIYICI BETONARME KOLONLAR (0.45m x 0.45m, #94A3B8)
      // -----------------------------------------------------------------------
      const cornerPoints: { x: number; z: number }[] = [];
      floorRooms.forEach((r) => {
        r.polygon_2d.forEach(([px, pz]) => {
          const snapX = Math.round(px * 2) / 2;
          const snapZ = Math.round(pz * 2) / 2;
          const exists = cornerPoints.some(
            (pt) => Math.hypot(pt.x - snapX, pt.z - snapZ) < 0.6
          );
          if (!exists) {
            cornerPoints.push({ x: snapX, z: snapZ });
          }
        });
      });

      const colSize = 0.45;
      const colHeight = wallH + slabThickness;
      const colGeo = new THREE.BoxGeometry(colSize, colHeight, colSize);
      const colMat = new THREE.MeshStandardMaterial({
        color: 0x94A3B8,
        roughness: 0.7,
        metalness: 0.2,
        transparent: !isFloorActive,
        opacity: isFloorActive ? 1.0 : 0.2,
      });
      const colEdgesGeo = new THREE.EdgesGeometry(colGeo);
      const colEdgesMat = new THREE.LineBasicMaterial({ color: 0x64748B });

      cornerPoints.forEach((cp) => {
        const colMesh = new THREE.Mesh(colGeo, colMat);
        colMesh.position.set(cp.x, floorY - slabThickness + colHeight / 2, cp.z);
        colMesh.castShadow = isFloorActive;
        colMesh.receiveShadow = isFloorActive;
        bGroup.add(colMesh);

        const colLines = new THREE.LineSegments(colEdgesGeo, colEdgesMat);
        colLines.position.copy(colMesh.position);
        bGroup.add(colLines);
      });

      // -----------------------------------------------------------------------
      // 3. ZEMİN KAPLAMALARI & MAHAL BADGE ETİKETLERİ
      // -----------------------------------------------------------------------
      floorRooms.forEach((rm) => {
        if (rm.polygon_2d.length < 3) return;

        const roomTheme = ROOM_FINISH_COLORS[rm.room_type] || {
          floor: 0x334155,
          wall: 0x475569,
          roughness: 0.6,
        };

        // Create Shape for floor finish
        const shape = new THREE.Shape();
        rm.polygon_2d.forEach(([px, pz], idx) => {
          if (idx === 0) shape.moveTo(px, pz);
          else shape.lineTo(px, pz);
        });

        const floorFinishGeo = new THREE.ShapeGeometry(shape);
        const floorFinishMat = new THREE.MeshStandardMaterial({
          color: roomTheme.floor,
          roughness: roomTheme.roughness,
          metalness: 0.1,
          side: THREE.DoubleSide,
          transparent: !isFloorActive,
          opacity: isFloorActive ? 0.95 : 0.15,
        });

        const floorMesh = new THREE.Mesh(floorFinishGeo, floorFinishMat);
        floorMesh.rotation.x = Math.PI / 2;
        floorMesh.position.set(0, floorY + 0.015, 0);
        floorMesh.receiveShadow = true;
        floorMesh.userData = {
          id: rm.id,
          name: rm.name,
          type: 'room',
          floor: floorLevel,
          category: rm.room_type,
          area_m2: rm.area_m2,
        };
        bGroup.add(floorMesh);

        // Compute Centroid for Badge
        let cx = 0,
          cz = 0;
        const ptsCount = rm.polygon_2d.length - 1;
        for (let i = 0; i < ptsCount; i++) {
          cx += rm.polygon_2d[i][0];
          cz += rm.polygon_2d[i][1];
        }
        cx /= ptsCount;
        cz /= ptsCount;

        // 3D Room Floor Label Badge
        if (isFloorActive) {
          const badgeTex = getRoomBadgeTexture(rm.name, rm.area_m2, rm.room_type);
          const badgeGeo = new THREE.PlaneGeometry(2.4, 1.2);
          const badgeMat = new THREE.MeshBasicMaterial({
            map: badgeTex,
            transparent: true,
            opacity: 0.92,
            side: THREE.DoubleSide,
          });
          const badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
          badgeMesh.rotation.x = -Math.PI / 2;
          badgeMesh.position.set(cx, floorY + 0.035, cz);
          bGroup.add(badgeMesh);
        }

        // 3D RAG Graph Overlay Node (Küre ve Topoloji Çizgileri - Varsayılan Kapalı)
        if (showRAGOverlay && isFloorActive) {
          const nodeGeo = new THREE.SphereGeometry(0.38, 16, 16);
          const nodeMat = new THREE.MeshStandardMaterial({
            color: roomTheme.wall,
            emissive: roomTheme.wall,
            emissiveIntensity: 0.4,
          });
          const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
          nodeMesh.position.set(cx, floorY + 1.25, cz);
          rGroup.add(nodeMesh);

          // Connecting Topology Link to Floor Center
          const linkGeo = new THREE.BufferGeometry().setFromPoints([
            nodeMesh.position,
            new THREE.Vector3((fMinX + fMaxX) / 2, floorY + 1.25, (fMinZ + fMaxZ) / 2),
          ]);
          const linkMat = new THREE.LineDashedMaterial({
            color: 0x00F0FF,
            dashSize: 0.4,
            gapSize: 0.2,
          });
          const linkLine = new THREE.Line(linkGeo, linkMat);
          linkLine.computeLineDistances();
          rGroup.add(linkLine);
        }
      });

      // -----------------------------------------------------------------------
      // 4. ET KALINLIKLI DUVARLAR & BOŞLUKLAR (EXTRUDED WALLS & OPENINGS)
      // -----------------------------------------------------------------------
      if (showBIMArchitecture) {
        interface WallSegment {
          x1: number;
          z1: number;
          x2: number;
          z2: number;
          isShearWall: boolean;
          isExterior: boolean;
          roomType: string;
        }

        const segmentsMap = new Map<string, { seg: WallSegment; count: number }>();

        floorRooms.forEach((rm) => {
          const isShear =
            rm.room_type === 'yangin_merdiveni' ||
            rm.room_type === 'asansor' ||
            rm.room_type === 'dikey_cekirdek';

          for (let i = 0; i < rm.polygon_2d.length - 1; i++) {
            const p1 = rm.polygon_2d[i];
            const p2 = rm.polygon_2d[i + 1];

            // Canonical key based on sorted endpoint coordinates
            const k1 = `${p1[0].toFixed(2)},${p1[1].toFixed(2)}`;
            const k2 = `${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
            const key = k1 < k2 ? `${k1}_${k2}` : `${k2}_${k1}`;

            if (segmentsMap.has(key)) {
              segmentsMap.get(key)!.count += 1;
            } else {
              segmentsMap.set(key, {
                seg: {
                  x1: p1[0],
                  z1: p1[1],
                  x2: p2[0],
                  z2: p2[1],
                  isShearWall: isShear,
                  isExterior: false,
                  roomType: rm.room_type,
                },
                count: 1,
              });
            }
          }
        });

        // Relevant doors for this floor
        const floorDoors = allDoors.filter((d) => {
          const [dx, dz] = d.portal_xy;
          return dx >= fMinX - 1 && dx <= fMaxX + 1 && dz >= fMinZ - 1 && dz <= fMaxZ + 1;
        });

        // Render each Wall Segment
        segmentsMap.forEach(({ seg, count }) => {
          seg.isExterior = count === 1;
          const length = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
          if (length < 0.2) return;

          const angle = Math.atan2(seg.z2 - seg.z1, seg.x2 - seg.x1);
          const wallThickness = seg.isShearWall ? 0.25 : seg.isExterior ? 0.20 : 0.12;
          const wallColor = seg.isShearWall
            ? 0x64748B // Betonarme perde
            : seg.isExterior
            ? 0x334155 // Dış cephe
            : 0x475569; // İç bölme

          // Check if a door opening lies on this segment
          const doorMatch = floorDoors.find((d) => {
            const [dx, dz] = d.portal_xy;
            // Distance from point to line segment
            const vx = seg.x2 - seg.x1;
            const vz = seg.z2 - seg.z1;
            const t = Math.max(
              0,
              Math.min(1, ((dx - seg.x1) * vx + (dz - seg.z1) * vz) / (length * length))
            );
            const projX = seg.x1 + t * vx;
            const projZ = seg.z1 + t * vz;
            return Math.hypot(dx - projX, dz - projZ) < 0.65;
          });

          // Check if an exterior window can be placed
          const canHaveWindow =
            seg.isExterior &&
            !seg.isShearWall &&
            !doorMatch &&
            length >= 2.8 &&
            (seg.roomType === 'salon' || seg.roomType === 'oda' || seg.roomType === 'mutfak');

          if (doorMatch) {
            // WALL WITH DOOR OPENING (Cutout)
            const doorW = (doorMatch.door_width_cm || 90) / 100;
            const vx = (seg.x2 - seg.x1) / length;
            const vz = (seg.z2 - seg.z1) / length;

            // Project door onto segment
            const [dx, dz] = doorMatch.portal_xy;
            const s = Math.max(
              doorW / 2 + 0.1,
              Math.min(
                length - doorW / 2 - 0.1,
                (dx - seg.x1) * vx + (dz - seg.z1) * vz
              )
            );

            // Left Wall Piece
            const leftLen = s - doorW / 2;
            if (leftLen > 0.15) {
              const leftGeo = new THREE.BoxGeometry(leftLen, wallH, wallThickness);
              const leftMat = new THREE.MeshStandardMaterial({
                color: wallColor,
                roughness: 0.75,
                metalness: 0.1,
              });
              const leftMesh = new THREE.Mesh(leftGeo, leftMat);
              const lcx = seg.x1 + vx * (leftLen / 2);
              const lcz = seg.z1 + vz * (leftLen / 2);
              leftMesh.position.set(lcx, floorY + wallH / 2, lcz);
              leftMesh.rotation.y = -angle;
              leftMesh.castShadow = isFloorActive;
              leftMesh.receiveShadow = isFloorActive;
              bGroup.add(leftMesh);
            }

            // Right Wall Piece
            const rightLen = length - (s + doorW / 2);
            if (rightLen > 0.15) {
              const rightGeo = new THREE.BoxGeometry(rightLen, wallH, wallThickness);
              const rightMat = new THREE.MeshStandardMaterial({
                color: wallColor,
                roughness: 0.75,
                metalness: 0.1,
              });
              const rightMesh = new THREE.Mesh(rightGeo, rightMat);
              const rcx = seg.x1 + vx * (s + doorW / 2 + rightLen / 2);
              const rcz = seg.z1 + vz * (s + doorW / 2 + rightLen / 2);
              rightMesh.position.set(rcx, floorY + wallH / 2, rcz);
              rightMesh.rotation.y = -angle;
              rightMesh.castShadow = isFloorActive;
              rightMesh.receiveShadow = isFloorActive;
              bGroup.add(rightMesh);
            }

            // Lintel Beam (Kapı lentosu - only visible in Full 2.80m view)
            if (wallH > 2.10) {
              const lintelH = wallH - 2.10;
              const lintelGeo = new THREE.BoxGeometry(doorW, lintelH, wallThickness);
              const lintelMat = new THREE.MeshStandardMaterial({
                color: wallColor,
                roughness: 0.75,
                metalness: 0.1,
              });
              const lintelMesh = new THREE.Mesh(lintelGeo, lintelMat);
              const doorCenterX = seg.x1 + vx * s;
              const doorCenterZ = seg.z1 + vz * s;
              lintelMesh.position.set(doorCenterX, floorY + 2.10 + lintelH / 2, doorCenterZ);
              lintelMesh.rotation.y = -angle;
              lintelMesh.castShadow = isFloorActive;
              bGroup.add(lintelMesh);
            }
          } else if (canHaveWindow) {
            // EXTERIOR WALL WITH WINDOW (Parapet, Aluminum Frame & Glass)
            const winW = Math.min(2.0, length - 1.0);
            const sideLen = (length - winW) / 2;
            const vx = (seg.x2 - seg.x1) / length;
            const vz = (seg.z2 - seg.z1) / length;

            // Left & Right Solid Wall Piers
            [0, length - sideLen].forEach((offset) => {
              const pierGeo = new THREE.BoxGeometry(sideLen, wallH, wallThickness);
              const pierMat = new THREE.MeshStandardMaterial({
                color: wallColor,
                roughness: 0.75,
                metalness: 0.1,
              });
              const pierMesh = new THREE.Mesh(pierGeo, pierMat);
              pierMesh.position.set(
                seg.x1 + vx * (offset + sideLen / 2),
                floorY + wallH / 2,
                seg.z1 + vz * (offset + sideLen / 2)
              );
              pierMesh.rotation.y = -angle;
              pierMesh.castShadow = isFloorActive;
              pierMesh.receiveShadow = isFloorActive;
              bGroup.add(pierMesh);
            });

            const winCenterX = seg.x1 + vx * (length / 2);
            const winCenterZ = seg.z1 + vz * (length / 2);

            // Parapet Wall (0.90m height)
            const parapetH = Math.min(wallH, 0.90);
            const parapetGeo = new THREE.BoxGeometry(winW, parapetH, wallThickness);
            const parapetMat = new THREE.MeshStandardMaterial({
              color: wallColor,
              roughness: 0.75,
            });
            const parapetMesh = new THREE.Mesh(parapetGeo, parapetMat);
            parapetMesh.position.set(winCenterX, floorY + parapetH / 2, winCenterZ);
            parapetMesh.rotation.y = -angle;
            bGroup.add(parapetMesh);

            // Aluminum Frame + Glass (between 0.90m and 2.30m)
            if (wallH > 0.90) {
              const glassH = Math.min(wallH, 2.30) - 0.90;

              // Dark Anthracite Aluminum Window Frame (#0F172A)
              const frameGeo = new THREE.BoxGeometry(winW, glassH, 0.08);
              const frameMat = new THREE.MeshStandardMaterial({
                color: 0x0F172A,
                roughness: 0.3,
                metalness: 0.8,
              });
              const frameMesh = new THREE.Mesh(frameGeo, frameMat);
              frameMesh.position.set(winCenterX, floorY + 0.90 + glassH / 2, winCenterZ);
              frameMesh.rotation.y = -angle;
              bGroup.add(frameMesh);

              // Translucent Architectural Glass (#38BDF8)
              const glassGeo = new THREE.BoxGeometry(winW - 0.12, glassH - 0.12, 0.03);
              const glassMat = new THREE.MeshStandardMaterial({
                color: 0x38BDF8,
                roughness: 0.1,
                metalness: 0.15,
                transparent: true,
                opacity: 0.38,
              });
              const glassMesh = new THREE.Mesh(glassGeo, glassMat);
              glassMesh.position.set(winCenterX, floorY + 0.90 + glassH / 2, winCenterZ);
              glassMesh.rotation.y = -angle;
              bGroup.add(glassMesh);
            }

            // Upper Window Lintel (above 2.30m)
            if (wallH > 2.30) {
              const topLintelH = wallH - 2.30;
              const topGeo = new THREE.BoxGeometry(winW, topLintelH, wallThickness);
              const topMat = new THREE.MeshStandardMaterial({
                color: wallColor,
                roughness: 0.75,
              });
              const topMesh = new THREE.Mesh(topGeo, topMat);
              topMesh.position.set(winCenterX, floorY + 2.30 + topLintelH / 2, winCenterZ);
              topMesh.rotation.y = -angle;
              bGroup.add(topMesh);
            }
          } else {
            // STANDARD SOLID WALL SEGMENT
            const wallGeo = new THREE.BoxGeometry(length, wallH, wallThickness);
            const wallMat = new THREE.MeshStandardMaterial({
              color: wallColor,
              roughness: 0.75,
              metalness: 0.1,
              transparent: !isFloorActive,
              opacity: isFloorActive ? 1.0 : 0.2,
            });
            const wallMesh = new THREE.Mesh(wallGeo, wallMat);
            wallMesh.position.set(
              (seg.x1 + seg.x2) / 2,
              floorY + wallH / 2,
              (seg.z1 + seg.z2) / 2
            );
            wallMesh.rotation.y = -angle;
            wallMesh.castShadow = isFloorActive;
            wallMesh.receiveShadow = isFloorActive;
            bGroup.add(wallMesh);
          }
        });

        // ---------------------------------------------------------------------
        // 5. 3B GERÇEK KAPI DOĞRAMALARI (LOD: Kasa, 45° Kanat, Yay, Panik Barı)
        // ---------------------------------------------------------------------
        floorDoors.forEach((door, didx) => {
          const [dx, dz] = door.portal_xy;
          const doorW = (door.door_width_cm || 90) / 100;
          const isFire = door.is_fire_resistant;

          // Check if door has deficit/violation or optimization
          const isViolated =
            door.door_width_cm < 90 ||
            (cadDiffMode === 'before' && door.door_width_cm < 110);
          const isOptimized = cadDiffMode === 'after' && isViolated;

          const doorColor = isViolated
            ? 0xEF4444 // Parlayan kırmızı
            : isOptimized
            ? 0x00FF88 // Neon yeşil
            : isFire
            ? 0x10B981 // Zümrüt yeşil yangın kapısı
            : 0x64748B; // Standart oda kapısı

          const doorGroup = new THREE.Group();
          doorGroup.position.set(dx, floorY, dz);

          // Door Frame (Kapı Kasası - #1E293B)
          const frameH = Math.min(wallH, 2.10);
          const jambGeo = new THREE.BoxGeometry(0.08, frameH, 0.12);
          const frameMat = new THREE.MeshStandardMaterial({
            color: 0x1E293B,
            roughness: 0.4,
            metalness: 0.6,
          });

          const leftJamb = new THREE.Mesh(jambGeo, frameMat);
          leftJamb.position.set(-doorW / 2, frameH / 2, 0);
          doorGroup.add(leftJamb);

          const rightJamb = new THREE.Mesh(jambGeo, frameMat);
          rightJamb.position.set(doorW / 2, frameH / 2, 0);
          doorGroup.add(rightJamb);

          // Door Leaf (45° Açıyla Aralık Duran Kanat)
          const leafW = doorW - 0.05;
          const leafH = frameH;
          const leafThickness = 0.05;
          const leafGeo = new THREE.BoxGeometry(leafW, leafH, leafThickness);
          const leafMat = new THREE.MeshStandardMaterial({
            color: doorColor,
            emissive: isViolated ? 0xEF4444 : isOptimized ? 0x00FF88 : 0x000000,
            emissiveIntensity: isViolated || isOptimized ? 0.65 : 0.0,
            roughness: 0.4,
            metalness: isFire ? 0.6 : 0.2,
          });

          const leafMesh = new THREE.Mesh(leafGeo, leafMat);
          leafMesh.position.set(-doorW / 2 + (leafW / 2) * Math.cos(Math.PI / 4), leafH / 2, (leafW / 2) * Math.sin(Math.PI / 4));
          leafMesh.rotation.y = Math.PI / 4;
          leafMesh.castShadow = isFloorActive;
          doorGroup.add(leafMesh);

          // Yangın Kapısı Panik Barı Detayı (#E2E8F0 paslanmaz çelik boru)
          if (isFire && frameH >= 1.0) {
            const barGeo = new THREE.CylinderGeometry(0.02, 0.02, leafW * 0.8, 8);
            const barMat = new THREE.MeshStandardMaterial({
              color: 0xE2E8F0,
              metalness: 0.85,
              roughness: 0.2,
            });
            const barMesh = new THREE.Mesh(barGeo, barMat);
            barMesh.rotation.z = Math.PI / 2;
            barMesh.position.set(0, 0.90 - leafH / 2, 0.04);
            leafMesh.add(barMesh);
          }

          // Zeminde 90° CAD Kapı Süpürme Yayı (Swing Arc)
          const arcCurve = new THREE.EllipseCurve(
            -doorW / 2,
            0,
            doorW,
            doorW,
            0,
            Math.PI / 2,
            false,
            0
          );
          const arcPoints = arcCurve.getPoints(16).map((p) => new THREE.Vector3(p.x, 0.02, p.y));
          const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPoints);
          const arcMat = new THREE.LineBasicMaterial({
            color: isViolated ? 0xEF4444 : isOptimized ? 0x00FF88 : 0x00F0FF,
            transparent: true,
            opacity: 0.65,
          });
          const arcLine = new THREE.Line(arcGeo, arcMat);
          doorGroup.add(arcLine);

          // Bottleneck / İhlal Halo Çemberi
          if (showBottlenecks && isViolated && isFloorActive) {
            const haloGeo = new THREE.RingGeometry(0.7, 1.2, 24);
            const haloMat = new THREE.MeshBasicMaterial({
              color: 0xEF4444,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.45,
            });
            const halo = new THREE.Mesh(haloGeo, haloMat);
            halo.rotation.x = -Math.PI / 2;
            halo.position.y = 0.025;
            doorGroup.add(halo);
          }

          doorGroup.userData = {
            id: `door_${door.source}_${door.target}`,
            name: `Kapı (${door.door_width_cm}cm)`,
            type: 'door',
            floor: floorLevel,
            width_cm: door.door_width_cm,
            isFire: door.is_fire_resistant,
          };
          bGroup.add(doorGroup);
        });

        // ---------------------------------------------------------------------
        // 6. GERÇEK BASAMAKLI U-TİPİ 3B YANGIN MERDİVENİ & KÜPEŞTE
        // ---------------------------------------------------------------------
        const stairRooms = floorRooms.filter(
          (r) => r.room_type === 'yangin_merdiveni'
        );
        stairRooms.forEach((stairRoom) => {
          let sMinX = Infinity,
            sMaxX = -Infinity,
            sMinZ = Infinity,
            sMaxZ = -Infinity;
          stairRoom.polygon_2d.forEach(([px, pz]) => {
            if (px < sMinX) sMinX = px;
            if (px > sMaxX) sMaxX = px;
            if (pz < sMinZ) sMinZ = pz;
            if (pz > sMaxZ) sMaxZ = pz;
          });

          const stairW = sMaxX - sMinX;
          const stairD = sMaxZ - sMinZ;
          const flightW = Math.max(1.10, (stairW - 0.3) / 2);
          const numSteps = 9;
          const riserH = (storyHeight / 2) / numSteps;
          const treadD = Math.max(0.26, (stairD * 0.7) / numSteps);

          const stepMat = new THREE.MeshStandardMaterial({
            color: 0x475569,
            roughness: 0.8,
            metalness: 0.15,
          });

          // 1. Kol (Flight 1: Zeminden ara sahanlığa)
          for (let s = 0; s < numSteps; s++) {
            const stepGeo = new THREE.BoxGeometry(flightW, riserH, treadD);
            const stepMesh = new THREE.Mesh(stepGeo, stepMat);
            stepMesh.position.set(
              sMinX + flightW / 2,
              floorY + s * riserH + riserH / 2,
              sMinZ + s * treadD + treadD / 2
            );
            stepMesh.castShadow = isFloorActive;
            stepMesh.receiveShadow = isFloorActive;
            bGroup.add(stepMesh);
          }

          // Ara Sahanlık (Intermediate Landing Plate)
          const landingH = storyHeight / 2;
          const landingGeo = new THREE.BoxGeometry(stairW, 0.20, Math.max(1.20, stairD * 0.3));
          const landingMat = new THREE.MeshStandardMaterial({
            color: 0x334155,
            roughness: 0.85,
          });
          const landingMesh = new THREE.Mesh(landingGeo, landingMat);
          landingMesh.position.set(
            (sMinX + sMaxX) / 2,
            floorY + landingH - 0.10,
            sMaxZ - Math.max(1.20, stairD * 0.3) / 2
          );
          landingMesh.receiveShadow = true;
          bGroup.add(landingMesh);

          // 2. Kol (Flight 2: Ara sahanlıktan üst kata zıt yönlü tırmanış)
          for (let s = 0; s < numSteps; s++) {
            const stepGeo = new THREE.BoxGeometry(flightW, riserH, treadD);
            const stepMesh = new THREE.Mesh(stepGeo, stepMat);
            stepMesh.position.set(
              sMaxX - flightW / 2,
              floorY + landingH + s * riserH + riserH / 2,
              sMaxZ - Math.max(1.20, stairD * 0.3) - (s * treadD + treadD / 2)
            );
            stepMesh.castShadow = isFloorActive;
            stepMesh.receiveShadow = isFloorActive;
            bGroup.add(stepMesh);
          }

          // Paslanmaz Çelik Korkuluk Küpeştesi (Handrail)
          const railMat = new THREE.MeshStandardMaterial({
            color: 0x00F0FF,
            metalness: 0.8,
            roughness: 0.2,
          });
          const railGeo = new THREE.CylinderGeometry(0.025, 0.025, Math.hypot(numSteps * treadD, landingH), 8);
          const railMesh = new THREE.Mesh(railGeo, railMat);
          railMesh.position.set(sMinX + flightW + 0.05, floorY + landingH / 2 + 0.90, sMinZ + (numSteps * treadD) / 2);
          railMesh.rotation.x = Math.atan2(landingH, numSteps * treadD);
          bGroup.add(railMesh);
        });

        // ---------------------------------------------------------------------
        // 7. ASANSÖR KUYUSU & KABİNİ (Steel Guides & Glass Cabin)
        // ---------------------------------------------------------------------
        const elevatorRooms = floorRooms.filter(
          (r) => r.room_type === 'asansor' || r.room_type === 'dikey_cekirdek'
        );
        elevatorRooms.forEach((elRoom) => {
          let eMinX = Infinity,
            eMaxX = -Infinity,
            eMinZ = Infinity,
            eMaxZ = -Infinity;
          elRoom.polygon_2d.forEach(([px, pz]) => {
            if (px < eMinX) eMinX = px;
            if (px > eMaxX) eMaxX = px;
            if (pz < eMinZ) eMinZ = pz;
            if (pz > eMaxZ) eMaxZ = pz;
          });

          const elW = eMaxX - eMinX;
          const elD = eMaxZ - eMinZ;

          // 4 Corner Vertical Steel Guide Rails
          const railH = wallH + slabThickness;
          const guideGeo = new THREE.BoxGeometry(0.08, railH, 0.08);
          const guideMat = new THREE.MeshStandardMaterial({
            color: 0x475569,
            metalness: 0.9,
            roughness: 0.2,
          });

          [
            [eMinX + 0.1, eMinZ + 0.1],
            [eMaxX - 0.1, eMinZ + 0.1],
            [eMinX + 0.1, eMaxZ - 0.1],
            [eMaxX - 0.1, eMaxZ - 0.1],
          ].forEach(([rx, rz]) => {
            const guideMesh = new THREE.Mesh(guideGeo, guideMat);
            guideMesh.position.set(rx, floorY + railH / 2 - slabThickness, rz);
            bGroup.add(guideMesh);
          });

          // Asansör Kabini (Translucent Steel Frame Cabin)
          const cabinW = Math.max(1.6, elW - 0.4);
          const cabinD = Math.max(1.6, elD - 0.4);
          const cabinH = Math.min(2.20, wallH * 0.9);

          const cabinGeo = new THREE.BoxGeometry(cabinW, cabinH, cabinD);
          const cabinMat = new THREE.MeshStandardMaterial({
            color: 0x38BDF8,
            roughness: 0.2,
            metalness: 0.6,
            transparent: true,
            opacity: 0.35,
          });
          const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
          cabinMesh.position.set(
            (eMinX + eMaxX) / 2,
            floorY + cabinH / 2,
            (eMinZ + eMaxZ) / 2
          );
          bGroup.add(cabinMesh);

          // Cabin Frame Wire
          const cabinEdges = new THREE.EdgesGeometry(cabinGeo);
          const cabinLineMat = new THREE.LineBasicMaterial({ color: 0x00F0FF });
          const cabinWire = new THREE.LineSegments(cabinEdges, cabinLineMat);
          cabinWire.position.copy(cabinMesh.position);
          bGroup.add(cabinWire);
        });
      }
    });

    // =========================================================================
    // 8. İKİ-BÖLGELİ DUMAN MODELİ (ASET DESCENT & VOLUMETRIC SOURCE)
    // =========================================================================
    if (showSmoke) {
      const fireFloor = 0;
      const fireY = fireFloor * storyHeight;

      // Volumetric Fire Origin
      const fireGeo = new THREE.SphereGeometry(1.2, 20, 20);
      const fireMat = new THREE.MeshStandardMaterial({
        color: 0xFF4500,
        emissive: 0xFF2200,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.85,
      });
      const fireMesh = new THREE.Mesh(fireGeo, fireMat);
      fireMesh.name = 'fire_origin';
      fireMesh.position.set((minX + maxX) / 2 - 4, fireY + 1.2, (minZ + maxZ) / 2 - 2);
      sGroup.add(fireMesh);

      // Smoke Layer Descent (at t=0 layer at 2.8m, by t=120s descends to 1.0m)
      const descentFactor = Math.min(1.0, simulationTime / 120.0);
      const currentLayerH = 2.80 - descentFactor * 1.80; // 2.8m down to 1.0m
      const smokeH = 2.80 - currentLayerH;

      const smokeGeo = new THREE.BoxGeometry(
        (maxX - minX) * 0.9,
        Math.max(0.1, smokeH),
        (maxZ - minZ) * 0.9
      );
      const smokeMat = new THREE.MeshStandardMaterial({
        color: simulationTime > 75 ? 0x991B1B : 0x1E293B,
        transparent: true,
        opacity: Math.min(0.85, 0.35 + descentFactor * 0.45),
        roughness: 0.95,
      });
      const smokeLayer = new THREE.Mesh(smokeGeo, smokeMat);
      smokeLayer.position.set(
        (minX + maxX) / 2,
        fireY + 2.80 - smokeH / 2,
        (minZ + maxZ) / 2
      );
      sGroup.add(smokeLayer);
    }
  }, [
    data,
    activeFloor,
    explodedZ,
    wallHeightMode,
    simulationTime,
    showSmoke,
    showRAGOverlay,
    showBottlenecks,
    showBIMArchitecture,
    cadDiffMode,
  ]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-slate-950">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* 3D Viewport HUD Floating Overlays */}
      <div className="absolute top-4 left-4 flex flex-wrap gap-2 pointer-events-auto">
        <div className="glass-panel px-3 py-1.5 flex items-center gap-2 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-gray-200 font-semibold">BIM / Mimari LOD300</span>
          <span className="text-gray-500">|</span>
          <span className="text-cyan-300">
            {wallHeightMode === 'cut'
              ? 'Dollhouse Kesit (1.20m)'
              : wallHeightMode === 'full'
              ? 'Tam Görünüm (2.80m)'
              : 'Plan Kotu (0.15m)'}
          </span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-300">
            {activeFloor === 'all' ? 'Tüm Katlar' : `Kat ${activeFloor}`}
          </span>
        </div>

        {showSmoke && (
          <div
            className={`glass-panel px-3 py-1.5 flex items-center gap-2 text-xs font-mono ${
              simulationTime > 75
                ? 'pulse-violation bg-red-950/50 text-red-400 border-red-500/50'
                : 'text-amber-400'
            }`}
          >
            <span>🔥 Yangın T: {simulationTime.toFixed(1)}s</span>
            <span>|</span>
            <span>
              Duman Kotu: {(2.8 - Math.min(1.0, simulationTime / 120.0) * 1.8).toFixed(2)}m
            </span>
            {simulationTime > 75 && (
              <span className="font-bold text-red-400 animate-bounce">[ASET AŞILDI!]</span>
            )}
          </div>
        )}
      </div>

      {/* Navigation Compass / Hint */}
      <div className="absolute bottom-4 left-4 glass-panel px-3 py-1.5 text-[11px] font-mono text-gray-400 pointer-events-none">
        <span>Sol Tık + Sürükle: Döndür · Sağ Tık: Kaydır · Tekerlek: Yakınlaş</span>
      </div>
    </div>
  );
};

export default ThreeScene;
