import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CameraPreset, DiagramYonetmelikPipelineOutput, WallHeightMode } from '../types/pipeline';
import {
  Compass,
  Box,
  Play,
  Pause,
  RotateCcw,
  User,
  Flame,
  Layers,
  CheckCircle2,
  ShieldAlert,
  Video,
  MapPin,
  X,
  Sparkles,
  Maximize2,
  Move,
  Crosshair,
  Target,
  AlertCircle,
  Check,
  Hand,
} from 'lucide-react';
import {
  TelAliCharacter,
  CelebrationParticleSystem,
  computeEscapePath,
  RoomCentroidInfo,
} from './TelAliCharacter';
import {
  computeDijkstraRoute,
  EvacuationProgressTracker,
  NavRoomNode,
  NavDoorEdge,
  EvacuationState,
  EvacuationErrorCode,
  RouteResult,
  findSharedBoundaryMidpoint,
} from './NavigationEngine';

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
  showDoorArcs?: boolean;
  onToggleDoorArcs?: (show: boolean) => void;
  cadDiffMode: 'before' | 'after' | 'both';
  onSelectElement: (element: { id: string; type: 'room' | 'door' | 'wall' | 'arc' | 'violation'; details: any }) => void;
  onFloorChange?: (floor: 'all' | number) => void;
  onSimulationTimeChange?: (time: number) => void;
  isPlaying?: boolean;
  onTogglePlay?: (playing: boolean) => void;
  onResetCamera?: () => void;
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

function getFireBadgeTexture(name: string, floorText: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 120;
  const ctx = canvas.getContext('2d')!;

  // Dark glowing panel
  ctx.fillStyle = 'rgba(25, 10, 10, 0.94)';
  ctx.beginPath();
  ctx.roundRect(8, 8, 240, 104, 16);
  ctx.fill();

  // Vibrant red-orange fire border
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Top flame gradient bar
  const grad = ctx.createLinearGradient(12, 12, 244, 12);
  grad.addColorStop(0, '#EF4444');
  grad.addColorStop(0.5, '#F59E0B');
  grad.addColorStop(1, '#EF4444');
  ctx.fillStyle = grad;
  ctx.fillRect(16, 12, 224, 4);

  // Badge Header
  ctx.fillStyle = '#F87171';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🔥 YANGIN BAŞLANGICI', 128, 44);

  // Floor & Room Name
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 18px sans-serif';
  const label = `${floorText}: ${name}`;
  const cleanLabel = label.length > 20 ? label.substring(0, 18) + '...' : label;
  ctx.fillText(cleanLabel, 128, 80);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

/**
 * 3B Tahliye Rotası ve Geometrik Kapı/Basamak İşaretleyicisi Çizim Fonksiyonu
 */
function renderDebugRoute(
  route: RouteResult | null,
  debugGroup: THREE.Group | null,
  showDebug: boolean
) {
  if (!debugGroup) return;
  while (debugGroup.children.length > 0) {
    const child = debugGroup.children[0];
    debugGroup.remove(child);
    if ((child as any).geometry) (child as any).geometry.dispose();
  }

  if (!showDebug || !route || !route.success || route.waypoints.length === 0) {
    return;
  }

  const wps = route.waypoints;

  // 1. 3D Trajectory Polyline (Z-fighting engellemek için hafif Y offset)
  const linePoints = wps.map((wp) => wp.pos.clone().add(new THREE.Vector3(0, 0.14, 0)));
  const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x00FF88,
    linewidth: 3,
    transparent: true,
    opacity: 0.9,
  });
  const lineMesh = new THREE.Line(lineGeo, lineMat);
  lineMesh.renderOrder = 998;
  debugGroup.add(lineMesh);

  // 2. Waypoint Markers
  wps.forEach((wp, idx) => {
    const p = wp.pos.clone().add(new THREE.Vector3(0, 0.14, 0));

    if (wp.wp_type === 'ROOM_CENTROID') {
      const sphereGeo = new THREE.SphereGeometry(0.22, 12, 12);
      const sphereMat = new THREE.MeshBasicMaterial({
        color: idx === 0 ? 0x38BDF8 : 0x06B6D4,
        transparent: true,
        opacity: 0.85,
      });
      const marker = new THREE.Mesh(sphereGeo, sphereMat);
      marker.position.copy(p);
      marker.renderOrder = 999;
      debugGroup.add(marker);
    } else if (wp.wp_type === 'DOOR_PORTAL') {
      const torusGeo = new THREE.TorusGeometry(0.35, 0.04, 8, 16);
      const torusMat = new THREE.MeshBasicMaterial({
        color: 0x10B981,
        transparent: true,
        opacity: 0.95,
      });
      const marker = new THREE.Mesh(torusGeo, torusMat);
      marker.position.copy(p).add(new THREE.Vector3(0, 0.35, 0));
      marker.renderOrder = 999;
      debugGroup.add(marker);
    } else if (wp.wp_type === 'STAIR_STEP') {
      const boxGeo = new THREE.BoxGeometry(0.25, 0.15, 0.25);
      const boxMat = new THREE.MeshBasicMaterial({
        color: 0xF59E0B,
        transparent: true,
        opacity: 0.9,
      });
      const marker = new THREE.Mesh(boxGeo, boxMat);
      marker.position.copy(p);
      marker.rotation.y = Math.PI / 4;
      marker.renderOrder = 999;
      debugGroup.add(marker);
    } else if (wp.wp_type === 'MUSTER_POINT') {
      const diskGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.04, 24);
      const diskMat = new THREE.MeshBasicMaterial({
        color: 0x00FF88,
        transparent: true,
        opacity: 0.75,
      });
      const disk = new THREE.Mesh(diskGeo, diskMat);
      disk.position.copy(p);
      disk.renderOrder = 999;
      debugGroup.add(disk);

      const beaconGeo = new THREE.CylinderGeometry(0.04, 0.04, 4.0, 8);
      const beaconMat = new THREE.MeshBasicMaterial({
        color: 0x00FF88,
        transparent: true,
        opacity: 0.85,
      });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.copy(p).add(new THREE.Vector3(0, 2.0, 0));
      beacon.renderOrder = 999;
      debugGroup.add(beacon);
    }
  });
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
  showDoorArcs: propShowDoorArcs = false,
  onToggleDoorArcs,
  cadDiffMode,
  onSelectElement,
  onFloorChange,
  onSimulationTimeChange,
  isPlaying = false,
  onTogglePlay,
  onResetCamera,
}) => {
  const [showDoorArcs, setShowDoorArcs] = useState<boolean>(propShowDoorArcs);

  useEffect(() => {
    setShowDoorArcs(propShowDoorArcs);
  }, [propShowDoorArcs]);

  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const buildingGroupRef = useRef<THREE.Group | null>(null);
  const ragGroupRef = useRef<THREE.Group | null>(null);
  const smokeGroupRef = useRef<THREE.Group | null>(null);
  const mouseRef = useRef(new THREE.Vector2());
  const raycasterRef = useRef(new THREE.Raycaster());

  // AutoCAD & BIM 3D Navigation Controls State & Refs
  const isDraggingRef = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const cameraTargetRef = useRef(new THREE.Vector3(10, 4, 18));
  const isCtrlPressedRef = useRef(false);
  const isShiftPressedRef = useRef(false);
  const isSpacePressedRef = useRef(false);

  const [activeCadTool, setActiveCadTool] = useState<'orbit' | 'pan'>('orbit');
  const activeCadToolRef = useRef<'orbit' | 'pan'>('orbit');
  activeCadToolRef.current = activeCadTool;

  const [activeCorner, setActiveCorner] = useState<'CENTER' | 'NW' | 'NE' | 'SW' | 'SE'>('CENTER');
  const buildingBoundsRef = useRef<{
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    minFloor: number;
    maxFloor: number;
    centerX: number;
    centerZ: number;
    centerY: number;
    span: number;
  }>({
    minX: 0,
    maxX: 20,
    minZ: 0,
    maxZ: 25,
    minFloor: -1,
    maxFloor: 1,
    centerX: 10,
    centerZ: 12.5,
    centerY: 0,
    span: 30,
  });

  // Floating Tooltip & HUD States
  const [hoveredRoom, setHoveredRoom] = useState<{
    id: string;
    name: string;
    room_type: string;
    area_m2: number;
    floor_level: number;
    temp_c: number;
    aset_status: string;
    violation: string;
    x: number;
    y: number;
  } | null>(null);

  // Wireframe / Floor Isolation State
  const [isWireframe, setIsWireframe] = useState<boolean>(false);
  const [internalFloor, setInternalFloor] = useState<'all' | number>(activeFloor);

  // Tel Ali Simulation States
  const [availableRooms, setAvailableRooms] = useState<RoomCentroidInfo[]>([]);
  const [selectedTelAliRoomId, setSelectedTelAliRoomId] = useState<string>('');
  const [isTelAliPlaced, setIsTelAliPlaced] = useState<boolean>(false);
  const lastDataRef = useRef<any>(null);
  const lastActiveFloorRef = useRef<'all' | number>(activeFloor);
  const [isEscaping, setIsEscaping] = useState<boolean>(false);
  const [followTelAli, setFollowTelAli] = useState<boolean>(false);
  const [telAliHealth, setTelAliHealth] = useState<number>(100);
  const [telAliStatusText, setTelAliStatusText] = useState<string>('Konumlandırma Bekleniyor');
  const [escapeDuration, setEscapeDuration] = useState<number>(0);
  const [showCelebrationModal, setShowCelebrationModal] = useState<boolean>(false);
  const [isTelAliPanelOpen, setIsTelAliPanelOpen] = useState<boolean>(true);
  const [evacuationState, setEvacuationState] = useState<EvacuationState>('IDLE');
  const [evacuationErrorCode, setEvacuationErrorCode] = useState<EvacuationErrorCode>(null);
  const [showDebugRoute, setShowDebugRoute] = useState<boolean>(true);
  const [routeSummary, setRouteSummary] = useState<{ distanceM: number; estTimeSec: number } | null>(null);

  // Refs for Tel Ali Game Loop & Navigation Engine
  const telAliRef = useRef<TelAliCharacter | null>(null);
  const celebrationRef = useRef<CelebrationParticleSystem | null>(null);
  const escapePathRef = useRef<THREE.Vector3[]>([]);
  const currentWpIndexRef = useRef<number>(0);
  const isEscapingRef = useRef<boolean>(false);
  const followTelAliRef = useRef<boolean>(false);
  const healthRef = useRef<number>(100);
  const escapeTimerRef = useRef<number>(0);
  const roomsListRef = useRef<RoomCentroidInfo[]>([]);
  const doorsListRef = useRef<NavDoorEdge[]>([]);
  const navTrackerRef = useRef<EvacuationProgressTracker>(new EvacuationProgressTracker(3.8, 3.5));
  const debugRouteGroupRef = useRef<THREE.Group | null>(null);
  const smokeMeshRef = useRef<THREE.Mesh | null>(null);
  const fireMeshRef = useRef<THREE.Mesh | null>(null);
  const simulationTimeRef = useRef<number>(simulationTime);
  const lastHudUpdateRef = useRef<number>(0);

  // Fire Origin States & Refs (Oda ve Kat Seçimi / 3B Tıklayarak Ateş Koyma)
  const [activeSimulationTab, setActiveSimulationTab] = useState<'tel_ali' | 'fire'>('tel_ali');
  const [selectedFireRoomId, setSelectedFireRoomId] = useState<string>('');
  const [isPlacingFireMode, setIsPlacingFireMode] = useState<boolean>(false);
  const isPlacingFireModeRef = useRef<boolean>(false);
  const fireOriginPosRef = useRef<THREE.Vector3>(new THREE.Vector3(7, 0, 22));
  const fireGroupRef = useRef<THREE.Group | null>(null);
  const firePointLightRef = useRef<THREE.PointLight | null>(null);
  const fireGroundRingRef = useRef<THREE.Mesh | null>(null);
  const fireBadgeSpriteRef = useRef<THREE.Sprite | null>(null);
  const [fireLocationInfo, setFireLocationInfo] = useState<{
    roomId: string;
    roomName: string;
    floorLevel: number;
    areaM2: number;
    pos: THREE.Vector3;
  } | null>(null);

  useEffect(() => {
    simulationTimeRef.current = simulationTime;
  }, [simulationTime]);

  // Camera Animation Ref (for Click-to-Focus & Reset)
  const cameraAnimRef = useRef<{
    active: boolean;
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endTarget: THREE.Vector3;
    progress: number;
  } | null>(null);

  // AutoCAD & BIM Corner & Extents Focus Helper
  const handleFocusCorner = (corner: 'CENTER' | 'NW' | 'NE' | 'SW' | 'SE') => {
    if (!cameraRef.current) return;
    const cam = cameraRef.current;
    const bounds = buildingBoundsRef.current;
    setActiveCorner(corner);

    let targetLook = new THREE.Vector3(bounds.centerX, bounds.centerY, bounds.centerZ);
    let targetCam = cam.position.clone();

    if (corner === 'NW') {
      // Kuzey-Batı: Min X, Min Z (Yangın merdiveni 1 & Çekirdek)
      targetLook = new THREE.Vector3(bounds.minX + 3.0, bounds.centerY, bounds.minZ + 3.0);
      targetCam = new THREE.Vector3(bounds.minX - 14, bounds.centerY + 16, bounds.minZ - 14);
    } else if (corner === 'NE') {
      // Kuzey-Doğu: Max X, Min Z (2. Şaft & Otopark)
      targetLook = new THREE.Vector3(bounds.maxX - 3.0, bounds.centerY, bounds.minZ + 3.0);
      targetCam = new THREE.Vector3(bounds.maxX + 14, bounds.centerY + 16, bounds.minZ - 14);
    } else if (corner === 'SW') {
      // Güney-Batı: Min X, Max Z (Daire 1 Odaları)
      targetLook = new THREE.Vector3(bounds.minX + 3.0, bounds.centerY, bounds.maxZ - 3.0);
      targetCam = new THREE.Vector3(bounds.minX - 14, bounds.centerY + 16, bounds.maxZ + 14);
    } else if (corner === 'SE') {
      // Güney-Doğu: Max X, Max Z (Daire 2 Odaları)
      targetLook = new THREE.Vector3(bounds.maxX - 3.0, bounds.centerY, bounds.maxZ - 3.0);
      targetCam = new THREE.Vector3(bounds.maxX + 14, bounds.centerY + 16, bounds.maxZ + 14);
    } else {
      // CENTER: Tüm Yapı (Zoom Extents)
      const dist = Math.max(38, bounds.span * 1.35);
      targetLook = new THREE.Vector3(bounds.centerX, bounds.centerY, bounds.centerZ);
      targetCam = new THREE.Vector3(
        bounds.centerX + dist * 0.72,
        bounds.centerY + dist * 0.65,
        bounds.centerZ + dist * 0.72
      );
    }

    cameraAnimRef.current = {
      active: true,
      startPos: cam.position.clone(),
      endPos: targetCam,
      startTarget: cameraTargetRef.current.clone(),
      endTarget: targetLook,
      progress: 0,
    };
  };

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

    // Dedicated Fire Origin 3D Group
    const fireGroup = new THREE.Group();
    scene.add(fireGroup);
    fireGroupRef.current = fireGroup;

    // 3D Debug Evacuation Route Polyline & Waypoint Markers Group
    const debugRouteGroup = new THREE.Group();
    scene.add(debugRouteGroup);
    debugRouteGroupRef.current = debugRouteGroup;

    // Celebration Fireworks Particle System
    const celebrationSystem = new CelebrationParticleSystem();
    scene.add(celebrationSystem.group);
    celebrationRef.current = celebrationSystem;

    // Tel Ali 3D Character
    const telAli = new TelAliCharacter();
    telAli.group.visible = false;
    scene.add(telAli.group);
    telAliRef.current = telAli;

    // Animation Loop
    let animationFrameId: number;
    let lastFrameTime = performance.now();
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const now = performance.now();
      const rawDelta = Math.min(0.1, Math.max(0.001, (now - lastFrameTime) / 1000.0));
      lastFrameTime = now;
      const elapsedTime = clock.getElapsedTime();

      // 1. Camera Focus Lerp Animation (Click-to-Focus or Isometric Reset)
      if (cameraAnimRef.current && cameraAnimRef.current.active) {
        const anim = cameraAnimRef.current;
        anim.progress += 0.045;
        const t = Math.min(1.0, anim.progress);
        const ease = t * t * (3 - 2 * t);
        camera.position.lerpVectors(anim.startPos, anim.endPos, ease);
        cameraTargetRef.current.lerpVectors(anim.startTarget, anim.endTarget, ease);
        camera.lookAt(cameraTargetRef.current);
        if (t >= 1.0) anim.active = false;
      }

      // 1b. Smooth Fire Pulsing, Dynamic Lighting and Smoke Descent without Model Rebuilding
      const curSimTime = simulationTimeRef.current;
      if (fireMeshRef.current) {
        const pulse = 1.0 + 0.12 * Math.sin(elapsedTime * 6);
        fireMeshRef.current.scale.set(pulse, pulse, pulse);
      }
      if (firePointLightRef.current) {
        firePointLightRef.current.intensity = 2.6 + 0.6 * Math.sin(elapsedTime * 10);
      }
      if (fireGroundRingRef.current) {
        const ringPulse = 1.0 + 0.08 * Math.sin(elapsedTime * 4);
        fireGroundRingRef.current.scale.set(ringPulse, ringPulse, ringPulse);
      }
      if (smokeMeshRef.current && showSmoke) {
        const descentFactor = Math.min(1.0, curSimTime / 120.0);
        const currentLayerH = 2.80 - descentFactor * 1.80; // 2.8m down to 1.0m
        const smokeH = 2.80 - currentLayerH;
        smokeMeshRef.current.scale.y = Math.max(0.06, smokeH / 1.80);
        const fireY = fireOriginPosRef.current ? fireOriginPosRef.current.y : 0;
        smokeMeshRef.current.position.y = fireY + 2.80 - smokeH / 2;
        const sMat = smokeMeshRef.current.material as THREE.MeshStandardMaterial;
        if (sMat) {
          sMat.opacity = Math.min(0.24, 0.14 + descentFactor * 0.10);
          if (curSimTime > 75) {
            sMat.color.setHex(0x7F1D1D);
          } else {
            sMat.color.setHex(0x334155);
          }
        }
      }

      // 2. Tel Ali Deterministic Navigation & Movement System (Physics Substepping)
      if (isEscapingRef.current && telAliRef.current && navTrackerRef.current) {
        const tracker = navTrackerRef.current;
        const fireOrigin = fireOriginPosRef.current;
        const descentFactor = Math.min(1.0, curSimTime / 120.0);
        const currentLayerH = 2.80 - descentFactor * 1.80;

        let curState = tracker.state;
        let remainingDt = rawDelta;
        while (remainingDt > 0.0001 && isEscapingRef.current) {
          const stepDt = Math.min(0.04, remainingDt);
          remainingDt -= stepDt;
          curState = tracker.update(stepDt, fireOrigin, currentLayerH);
          if (curState !== 'EVACUATING') break;
        }

        // Update 3D Character World Coordinates
        telAliRef.current.group.position.copy(tracker.currentPos);

        // Facing direction (yaw rotation)
        if (tracker.currentWpIdx < tracker.waypoints.length) {
          const targetWp = tracker.waypoints[tracker.currentWpIdx];
          const dx = targetWp.pos.x - tracker.currentPos.x;
          const dz = targetWp.pos.z - tracker.currentPos.z;
          if (dx * dx + dz * dz > 0.001) {
            const heading = Math.atan2(dx, dz);
            telAliRef.current.group.rotation.y = heading;
          }
        }

        // Animate running cycle (leg/arm swing)
        telAliRef.current.animateRun(elapsedTime, curState === 'EVACUATING');
        telAliRef.current.updateBadge(Math.round(tracker.health), tracker.statusTextTr);

        const now = performance.now();
        if (now - lastHudUpdateRef.current > 100 || curState === 'EVACUATED' || curState === 'BLOCKED' || curState === 'FAILED') {
          lastHudUpdateRef.current = now;
          setTelAliHealth(Math.round(tracker.health));
          setTelAliStatusText(tracker.statusTextTr);
          setEscapeDuration(Number(tracker.elapsedTimeSec.toFixed(1)));
          setEvacuationState(curState);
          setEvacuationErrorCode(tracker.errorCode);
        }

        if (curState === 'EVACUATED') {
          // Reached Safe Exterior Muster Point!
          isEscapingRef.current = false;
          setIsEscaping(false);
          telAliRef.current.animateRun(elapsedTime, false);
          telAliRef.current.updateBadge(100, '🎉 Tahliye Edildi!');
          setShowCelebrationModal(true);
          if (celebrationRef.current) {
            celebrationRef.current.burst(tracker.currentPos);
          }
        } else if (curState === 'BLOCKED' || curState === 'FAILED') {
          isEscapingRef.current = false;
          setIsEscaping(false);
          telAliRef.current.animateRun(elapsedTime, false);
          telAliRef.current.updateBadge(Math.round(tracker.health), `⛔ ${tracker.errorCode || 'BLOKE'}`);
        }
      } else if (telAliRef.current) {
        // Idle breathing when standing
        telAliRef.current.animateRun(elapsedTime, false);
      }

      // 3. Robust 3rd-Person Follow Cam Mode (Always active when followTelAli is on)
      if (followTelAliRef.current && telAliRef.current && telAliRef.current.group.visible) {
        const currPos = telAliRef.current.group.position;
        const heading = telAliRef.current.group.rotation.y;
        const camDistance = 4.8;
        const camHeight = 2.4;

        // Position camera behind Tel Ali relative to his current rotation
        const targetCamPos = new THREE.Vector3(
          currPos.x - Math.sin(heading) * camDistance,
          currPos.y + camHeight,
          currPos.z - Math.cos(heading) * camDistance
        );
        const lookTarget = currPos.clone().add(new THREE.Vector3(0, 1.1, 0));

        // Only lerp if click-to-focus animation isn't actively overriding
        if (!cameraAnimRef.current || !cameraAnimRef.current.active) {
          camera.position.lerp(targetCamPos, 0.08);
          cameraTargetRef.current.lerp(lookTarget, 0.08);
          camera.lookAt(cameraTargetRef.current);
        }
      }

      // 4. Update Celebration Fireworks Particles
      if (celebrationRef.current) {
        celebrationRef.current.update();
      }

      // 4. Smoke Layer Pulsing & Volumetric Fire Source
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

    // =========================================================================
    // AUTOCAD & BIM STANDARD 3D CONTROLS (Middle Drag Pan, Zoom to Cursor, Double-Click Extents, WASD)
    // =========================================================================
    const handleMouseDown = (e: MouseEvent) => {
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
      isDraggingRef.current = true;

      // Prevent default for middle and right mouse clicks to stop autoscroll & context menu
      if (e.button === 1 || e.button === 2) {
        e.preventDefault();
      }

      // If user manually moves camera, gracefully release follow cam
      if (followTelAliRef.current) {
        followTelAliRef.current = false;
        setFollowTelAli(false);
        if (telAliRef.current) telAliRef.current.setBadgeVisible(true);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) {
        // Raycast for Hover Tooltips when mouse moves without dragging
        if (containerRef.current && cameraRef.current && buildingGroupRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          const normY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycasterRef.current.setFromCamera(new THREE.Vector2(normX, normY), cameraRef.current);
          const hits = raycasterRef.current.intersectObjects(
            buildingGroupRef.current.children,
            true
          );
          let found = false;
          for (const hit of hits) {
            const ud = hit.object.userData;
            if (ud && ud.id && ud.type === 'room') {
              const isFireZone =
                ud.id === selectedFireRoomId ||
                (fireOriginPosRef.current && hit.point && hit.point.distanceTo(fireOriginPosRef.current) < 5.0);
              const temp = isFireZone
                ? Math.round(24 + simulationTime * 4.5)
                : ud.category === 'yangin_merdiveni'
                ? 22
                : Math.round(22 + Math.max(0, simulationTime - 25) * 1.6);
              const aset =
                temp > 120
                  ? 'Kritik Duman/Isı (ASET < RSET Aşımı)'
                  : temp > 55
                  ? 'Tahliye Devam Ediyor (RSET Limiti)'
                  : 'Güvenli Bölge (ASET > 180s)';
              const viol =
                ud.category === 'yangin_merdiveni'
                  ? 'BYKHY Madde 34: Yangın merdiveni genişliği 105cm < 120cm'
                  : ud.category === 'siginak'
                  ? 'Sığınak Yönetmeliği Madde 11: Korunmalı ve Sızdırmaz'
                  : '✓ T.C. Mevzuat Standartlarına Uygun';
              setHoveredRoom({
                id: ud.id,
                name: ud.name,
                room_type: ud.category,
                area_m2: ud.area_m2 || 0,
                floor_level: ud.floor,
                temp_c: temp,
                aset_status: aset,
                violation: viol,
                x: e.clientX,
                y: e.clientY,
              });
              found = true;
              break;
            }
          }
          if (!found) setHoveredRoom(null);
        }
        return;
      }

      // Dragging is active
      const deltaX = e.clientX - previousMousePosition.current.x;
      const deltaY = e.clientY - previousMousePosition.current.y;
      if (deltaX === 0 && deltaY === 0) return;

      // Stop camera focus animation on manual user interaction
      if (cameraAnimRef.current) cameraAnimRef.current.active = false;

      // Determine Pan vs Orbit:
      // AutoCAD standard: Middle Mouse Drag (buttons & 4)
      // BIM standard: Right Mouse Drag (buttons & 2)
      // Spacebar + Left Mouse Drag
      // Active CAD tool set to 'pan' and Left Mouse Drag (buttons & 1)
      const isPan =
        (e.buttons & 4) !== 0 ||
        (e.buttons & 2) !== 0 ||
        ((e.buttons & 1) !== 0 && (isSpacePressedRef.current || activeCadToolRef.current === 'pan'));

      if (isPan) {
        // AutoCAD 1:1 Pixel-Accurate Screen-Space Pan
        const rect = containerRef.current?.getBoundingClientRect();
        const canvasW = rect ? rect.width : window.innerWidth;
        const canvasH = rect ? rect.height : window.innerHeight;

        const dist = camera.position.distanceTo(cameraTargetRef.current);
        const vFov = (camera.fov * Math.PI) / 180;
        const visibleHeight = 2 * Math.tan(vFov / 2) * dist;
        const visibleWidth = visibleHeight * (canvasW / canvasH);

        const factorX = (deltaX / canvasW) * visibleWidth;
        const factorY = (deltaY / canvasH) * visibleHeight;

        // Camera basis vectors
        const vRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
        const vUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();

        const panVec = new THREE.Vector3()
          .addScaledVector(vRight, -factorX)
          .addScaledVector(vUp, factorY);

        camera.position.add(panVec);
        cameraTargetRef.current.add(panVec);
        camera.lookAt(cameraTargetRef.current);
      } else if ((e.buttons & 1) !== 0) {
        // Orbit Rotate (Left Click Drag or Shift/Ctrl Orbit)
        const isFreeAngle =
          e.ctrlKey || isCtrlPressedRef.current || e.shiftKey || isShiftPressedRef.current;
        const rotSpeed = isFreeAngle ? 0.007 : 0.005;
        const offset = camera.position.clone().sub(cameraTargetRef.current);
        const radius = offset.length();
        let theta = Math.atan2(offset.x, offset.z);
        let phi = Math.acos(Math.max(-0.999, Math.min(0.999, offset.y / radius)));

        theta -= deltaX * rotSpeed;
        phi -= deltaY * rotSpeed;

        if (isFreeAngle) {
          // Free 3D angle (look from any angle including top/bottom)
          phi = Math.max(0.01, Math.min(Math.PI - 0.01, phi));
        } else {
          // Architectural constraint
          phi = Math.max(0.08, Math.min(Math.PI / 2 - 0.02, phi));
        }

        offset.x = radius * Math.sin(phi) * Math.sin(theta);
        offset.y = radius * Math.cos(phi);
        offset.z = radius * Math.sin(phi) * Math.cos(theta);

        camera.position.copy(cameraTargetRef.current).add(offset);
        camera.lookAt(cameraTargetRef.current);
      }

      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    // AutoCAD Zoom-to-Cursor (İmlecin altındaki 3B koordinata odaklı yakınlaşma)
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!containerRef.current || !cameraRef.current) return;
      if (cameraAnimRef.current) cameraAnimRef.current.active = false;

      const rect = containerRef.current.getBoundingClientRect();
      const mouseNDC = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouseNDC, camera);

      // Project ray onto camera target plane
      const camDir = camera.getWorldDirection(new THREE.Vector3());
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        camDir.clone().negate(),
        cameraTargetRef.current
      );

      const focusPoint = new THREE.Vector3();
      const hit = raycaster.ray.intersectPlane(plane, focusPoint);
      const targetPoint = hit ? focusPoint : cameraTargetRef.current.clone();

      // Zoom ratio
      const zoomFactor = e.deltaY > 0 ? 1.12 : 0.88;
      const currentDist = camera.position.distanceTo(cameraTargetRef.current);
      const newDist = currentDist * zoomFactor;

      if (newDist >= 4 && newDist <= 350) {
        camera.position.lerp(targetPoint, 1 - zoomFactor);
        cameraTargetRef.current.lerp(targetPoint, 1 - zoomFactor);
        camera.lookAt(cameraTargetRef.current);
      }
    };

    // AutoCAD Double Click: Zoom Extents (Tümünü Sığdır)
    const handleDblClick = (e: MouseEvent) => {
      e.preventDefault();
      handleFocusCorner('CENTER');
    };

    // Prevent default context menu on right click to allow fluid right-mouse pan
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleClick = (e: MouseEvent) => {
      const moved = Math.hypot(
        e.clientX - mouseDownPosRef.current.x,
        e.clientY - mouseDownPosRef.current.y
      );
      if (moved > 5) return; // Dragged, not a click

      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      // 3B Tıkla & Ateş Koy Modu (Interactive 3D Fire Placement)
      if (isPlacingFireModeRef.current) {
        if (buildingGroupRef.current) {
          const intersects = raycasterRef.current.intersectObjects(
            buildingGroupRef.current.children,
            true
          );
          if (intersects.length > 0) {
            const hit = intersects[0];
            const hitPos = hit.point.clone();

            let hitRoomId: string | undefined = undefined;
            let curr: THREE.Object3D | null = hit.object;
            while (curr && curr !== buildingGroupRef.current) {
              if (curr.userData && curr.userData.id && curr.userData.type === 'room') {
                hitRoomId = curr.userData.id;
                break;
              }
              curr = curr.parent;
            }

            handlePlaceFire(hitRoomId, hitPos);
            setIsPlacingFireMode(false);
            isPlacingFireModeRef.current = false;
            if (containerRef.current) containerRef.current.style.cursor = 'default';
            return;
          }
        }
      }

      if (buildingGroupRef.current) {
        const intersects = raycasterRef.current.intersectObjects(
          buildingGroupRef.current.children,
          true
        );
        if (intersects.length > 0) {
          for (const hit of intersects) {
            const obj = hit.object;
            if (obj.userData && obj.userData.id) {
              // Click-to-Focus: smooth camera lerp to room center
              const rInfo = roomsListRef.current.find((r) => r.id === obj.userData.id);
              if (rInfo) {
                const targetLook = rInfo.pos.clone().add(new THREE.Vector3(0, 0.8, 0));
                const targetCam = targetLook.clone().add(new THREE.Vector3(14, 12, 14));
                cameraAnimRef.current = {
                  active: true,
                  startPos: camera.position.clone(),
                  endPos: targetCam,
                  startTarget: cameraTargetRef.current.clone(),
                  endTarget: targetLook,
                  progress: 0,
                };
              }

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

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') isCtrlPressedRef.current = true;
      if (e.key === 'Shift') isShiftPressedRef.current = true;
      if (e.code === 'Space') {
        isSpacePressedRef.current = true;
        if (containerRef.current) containerRef.current.style.cursor = 'grab';
      }
      if (e.key === 'Escape') {
        if (isPlacingFireModeRef.current) {
          setIsPlacingFireMode(false);
          isPlacingFireModeRef.current = false;
          if (containerRef.current) containerRef.current.style.cursor = 'default';
        }
      }

      // Keyboard Pan via Arrow Keys or WASD across edges
      const panStep = 1.5;
      if (['ArrowUp', 'KeyW', 'ArrowDown', 'KeyS', 'ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(e.code)) {
        if (cameraAnimRef.current) cameraAnimRef.current.active = false;
        const vRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
        const vUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
        const vPan = new THREE.Vector3();

        if (e.code === 'ArrowUp' || e.code === 'KeyW') vPan.addScaledVector(vUp, panStep);
        if (e.code === 'ArrowDown' || e.code === 'KeyS') vPan.addScaledVector(vUp, -panStep);
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') vPan.addScaledVector(vRight, -panStep);
        if (e.code === 'ArrowRight' || e.code === 'KeyD') vPan.addScaledVector(vRight, panStep);

        camera.position.add(vPan);
        cameraTargetRef.current.add(vPan);
        camera.lookAt(cameraTargetRef.current);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') isCtrlPressedRef.current = false;
      if (e.key === 'Shift') isShiftPressedRef.current = false;
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        if (containerRef.current) {
          containerRef.current.style.cursor = activeCadToolRef.current === 'pan' ? 'grab' : 'crosshair';
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    domElement.addEventListener('wheel', handleWheel, { passive: false });
    domElement.addEventListener('click', handleClick);
    domElement.addEventListener('dblclick', handleDblClick);
    domElement.addEventListener('contextmenu', handleContextMenu);

    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Sağ panel sürüklenirken veya pencere değişirken anlık WebGL güncellemesi
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      domElement.removeEventListener('wheel', handleWheel);
      domElement.removeEventListener('click', handleClick);
      domElement.removeEventListener('dblclick', handleDblClick);
      domElement.removeEventListener('contextmenu', handleContextMenu);
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
    if (fireGroupRef.current) {
      while (fireGroupRef.current.children.length > 0) fireGroupRef.current.remove(fireGroupRef.current.children[0]);
    }

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
      connection_type?: string;
      door_id?: number;
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
          connection_type: e.connection_type || 'door',
          door_id: e.door_id !== undefined ? Number(e.door_id) : (e.connection_type === 'open_passage' ? -1 : 1),
          is_vertical: Boolean(e.is_vertical),
        }));
      }
    } else {
      // High-Fidelity Multi-Floor BIM Template (Floors: -1, 0, 1)
      // Oda - Daire (Antre) - Kat Koridoru - Yangın Çekirdeği - Dış Çıkış Hiyerarşisi
      const baseFloors = [-1, 0, 1];
      baseFloors.forEach((fl) => {
        const prefix = `K${fl}`;

        if (fl >= 0) {
          // Tipik Daire A (Salon, Mutfak, Yatak Odası, Daire İçi Antre)
          allRooms.push(
            {
              id: `${prefix}_salon_a`,
              name: `Salon A (Kat ${fl})`,
              room_type: 'salon',
              area_m2: 21.0,
              floor_level: fl,
              polygon_2d: [
                [0, 20],
                [7, 20],
                [7, 23],
                [0, 23],
                [0, 20],
              ],
            },
            {
              id: `${prefix}_mutfak_a`,
              name: `Mutfak A (Kat ${fl})`,
              room_type: 'mutfak',
              area_m2: 16.0,
              floor_level: fl,
              polygon_2d: [
                [0, 23],
                [4, 23],
                [4, 27],
                [0, 27],
                [0, 23],
              ],
            },
            {
              id: `${prefix}_antre_a`,
              name: `Daire İçi Antre A (Kat ${fl})`,
              room_type: 'kat_koridoru',
              area_m2: 12.0,
              floor_level: fl,
              polygon_2d: [
                [4, 23],
                [7, 23],
                [7, 27],
                [4, 27],
                [4, 23],
              ],
            },
            {
              id: `${prefix}_oda_a`,
              name: `Yatak Odası A (Kat ${fl})`,
              room_type: 'oda',
              area_m2: 28.0,
              floor_level: fl,
              polygon_2d: [
                [0, 27],
                [7, 27],
                [7, 31],
                [0, 31],
                [0, 27],
              ],
            }
          );
        } else {
          // Bodrum Kat Depolama Odaları
          allRooms.push(
            {
              id: `K-1_depo_1`,
              name: `Bodrum Depo A`,
              room_type: 'oda',
              area_m2: 21.0,
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
              id: `K-1_depo_2`,
              name: `Bodrum Depo B`,
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
            }
          );
        }

        // Ortak Kat Alanları (Kat Koridoru, Yangın Holü, Kaçış Merdiveni, Asansör)
        allRooms.push(
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
              area_m2: 49.0,
              floor_level: fl,
              polygon_2d: [
                [0, 31],
                [7, 31],
                [7, 38],
                [0, 38],
                [0, 31],
              ],
            },
            {
              id: `K-1_havakilidi`,
              name: `Sığınak Hava Kilidi`,
              room_type: 'yangin_holu',
              area_m2: 12.0,
              floor_level: fl,
              polygon_2d: [
                [7, 31],
                [11, 31],
                [11, 34],
                [7, 34],
                [7, 31],
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

        // Kapı Topolojisi: Oda -> Daire Antresi -> Daire Giriş Kapısı -> Kat Koridoru -> Yangın Holü -> Merdiven
        if (fl >= 0) {
          allDoors.push(
            // Daire İçi Kapıları (Her oda antreye açılır)
            {
              source: `${prefix}_salon_a`,
              target: `${prefix}_antre_a`,
              door_width_cm: 90,
              portal_xy: [5.5, 23.0],
              is_fire_resistant: false,
              usable_in_fire: true,
            },
            {
              source: `${prefix}_mutfak_a`,
              target: `${prefix}_antre_a`,
              door_width_cm: 90,
              portal_xy: [4.0, 25.0],
              is_fire_resistant: false,
              usable_in_fire: true,
            },
            {
              source: `${prefix}_oda_a`,
              target: `${prefix}_antre_a`,
              door_width_cm: 90,
              portal_xy: [5.5, 27.0],
              is_fire_resistant: false,
              usable_in_fire: true,
            },
            // Daire Giriş Kapısı (Antre -> Kat Koridoru)
            {
              source: `${prefix}_antre_a`,
              target: `${prefix}_koridor`,
              door_width_cm: 100,
              portal_xy: [7.0, 25.0],
              is_fire_resistant: false,
              usable_in_fire: true,
            }
          );
        } else {
          // Bodrum Depo Kapıları
          allDoors.push(
            {
              source: `K-1_depo_1`,
              target: `K-1_koridor`,
              door_width_cm: 90,
              portal_xy: [7.0, 23.0],
              is_fire_resistant: false,
              usable_in_fire: true,
            },
            {
              source: `K-1_depo_2`,
              target: `K-1_koridor`,
              door_width_cm: 90,
              portal_xy: [7.0, 28.5],
              is_fire_resistant: false,
              usable_in_fire: true,
            }
          );
        }

        // Kat Koridoru <-> Yangın Güvenlik Holü (Yangın Kapısı)
        allDoors.push(
          {
            source: `${prefix}_koridor`,
            target: `${prefix}_yangin_holu`,
            door_width_cm: 90,
            portal_xy: [11.0, 22.5],
            is_fire_resistant: true,
            usable_in_fire: true,
          },
          // Yangın Güvenlik Holü <-> Yangın Kaçış Merdiveni (Yangın Kapısı)
          {
            source: `${prefix}_yangin_holu`,
            target: `${prefix}_yangin_merdiveni`,
            door_width_cm: 120,
            portal_xy: [13.0, 25.0],
            is_fire_resistant: true,
            usable_in_fire: true,
          }
        );

        if (fl === -1) {
          allDoors.push(
            {
              source: `K-1_siginak`,
              target: `K-1_havakilidi`,
              door_width_cm: 100,
              portal_xy: [7.0, 32.5],
              is_fire_resistant: true,
              usable_in_fire: true,
            },
            {
              source: `K-1_havakilidi`,
              target: `K-1_koridor`,
              door_width_cm: 100,
              portal_xy: [9.0, 31.0],
              is_fire_resistant: true,
              usable_in_fire: true,
            },
            {
              source: `K-1_otopark`,
              target: `K-1_koridor`,
              door_width_cm: 110,
              portal_xy: [11.0, 32.5],
              is_fire_resistant: true,
              usable_in_fire: true,
            }
          );
        } else if (fl === 0) {
          allDoors.push({
            source: `K0_koridor`,
            target: `K0_dis_cikis`,
            door_width_cm: 140,
            portal_xy: [9.0, 20.0],
            is_fire_resistant: true,
            usable_in_fire: true,
          });
        }
      });

      // Vertical Inter-Floor Stair Connections in Fire Stairwell
      allDoors.push(
        {
          source: 'K-1_yangin_merdiveni',
          target: 'K0_yangin_merdiveni',
          door_width_cm: 120,
          portal_xy: [13, 28],
          is_fire_resistant: true,
          usable_in_fire: true,
          is_vertical: true,
        } as any,
        {
          source: 'K1_yangin_merdiveni',
          target: 'K0_yangin_merdiveni',
          door_width_cm: 120,
          portal_xy: [13, 28],
          is_fire_resistant: true,
          usable_in_fire: true,
          is_vertical: true,
        } as any
      );
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
    const refFloor = rawFloorsMap.has(0) ? 0 : sortedFloorLevels[0] ?? 0;
    const refRooms = rawFloorsMap.get(refFloor) || [];
    const refCore = refRooms.find(r => r.room_type === 'yangin_merdiveni' || r.room_type === 'yangin_holu');

    let refCoreCentroid: [number, number] | null = null;
    if (refCore && refCore.polygon_2d.length >= 3) {
      let rcx = 0, rcz = 0;
      const pts = refCore.polygon_2d.slice(0, -1);
      pts.forEach(([x, z]) => { rcx += x; rcz += z; });
      refCoreCentroid = [rcx / pts.length, rcz / pts.length];
    }

    let baseMinX = 0, baseMinZ = 0;
    if (refRooms.length > 0) {
      let bMinX = Infinity, bMinZ = Infinity;
      refRooms.forEach(r => r.polygon_2d.forEach(([x, z]) => {
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
      if (fl === refFloor) return;
      const floorCore = roomsOnFloor.find(r => r.room_type === 'yangin_merdiveni' || r.room_type === 'yangin_holu');
      if (refCoreCentroid && floorCore && floorCore.polygon_2d.length >= 3) {
        let fcx = 0, fcz = 0;
        const pts = floorCore.polygon_2d.slice(0, -1);
        pts.forEach(([x, z]) => { fcx += x; fcz += z; });
        fcx /= pts.length;
        fcz /= pts.length;
        const shiftX = fcx - refCoreCentroid[0];
        const shiftZ = fcz - refCoreCentroid[1];
        if (Math.hypot(shiftX, shiftZ) > 0.5) {
          floorOffsets.set(fl, { dx: shiftX, dz: shiftZ });
          roomsOnFloor.forEach(r => {
            r.polygon_2d = r.polygon_2d.map(([x, z]) => [x - shiftX, z - shiftZ]);
          });
        }
      } else {
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

      buildingBoundsRef.current = {
        minX,
        maxX,
        minZ,
        maxZ,
        minFloor,
        maxFloor,
        centerX,
        centerZ,
        centerY,
        span: Math.max(maxX - minX, maxZ - minZ, totalBuildingH),
      };

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
    const collectedRooms: RoomCentroidInfo[] = [];
    const exactDoorPortals = new Map<string, THREE.Vector3>();

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

        // Store room centroid for Tel Ali pathfinding and Click-to-Focus
        collectedRooms.push({
          id: rm.id,
          name: rm.name,
          room_type: rm.room_type,
          floor_level: floorLevel,
          area_m2: rm.area_m2 || 0,
          pos: new THREE.Vector3(cx, floorY + 0.15, cz),
          polygon_2d: rm.polygon_2d,
        });

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
      // 4. ET KALINLIKLI DUVARLAR & BOŞLUKLAR (ATOMIC SEGMENTATION & DECOMPOSITION)
      // -----------------------------------------------------------------------
      if (showBIMArchitecture) {
        interface AtomicSegment {
          x1: number;
          z1: number;
          x2: number;
          z2: number;
          isShearWall: boolean;
          isExterior: boolean;
          roomType: string;
        }

        // 4.1 Collect all unique 2D vertices on this floor to resolve T-junctions
        const allFloorVertices: [number, number][] = [];
        floorRooms.forEach((rm) => {
          rm.polygon_2d.forEach(([x, z]) => {
            if (!allFloorVertices.some(([vx, vz]) => Math.hypot(vx - x, vz - z) < 0.05)) {
              allFloorVertices.push([x, z]);
            }
          });
        });

        // 4.2 Decompose all room boundary segments at intermediate vertices (T-junctions)
        const atomicSegments: AtomicSegment[] = [];

        floorRooms.forEach((rm) => {
          const isShear =
            rm.room_type === 'yangin_merdiveni' ||
            rm.room_type === 'asansor' ||
            rm.room_type === 'dikey_cekirdek';

          for (let i = 0; i < rm.polygon_2d.length - 1; i++) {
            const [x1, z1] = rm.polygon_2d[i];
            const [x2, z2] = rm.polygon_2d[i + 1];
            const segLen = Math.hypot(x2 - x1, z2 - z1);
            if (segLen < 0.05 || isNaN(segLen)) {
              console.warn('[BIM Geometry] Degenerate segment skipped (GEO-T16):', [x1, z1], [x2, z2]);
              continue;
            }

            const vx = (x2 - x1) / segLen;
            const vz = (z2 - z1) / segLen;

            // Find all vertices on this floor that lie strictly on the interior of this segment
            const splitTs: number[] = [0, segLen];
            allFloorVertices.forEach(([px, pz]) => {
              const dx = px - x1;
              const dz = pz - z1;
              const t = dx * vx + dz * vz;
              if (t > 0.05 && t < segLen - 0.05) {
                const perpDist = Math.abs(dx * vz - dz * vx);
                if (perpDist < 0.05) {
                  splitTs.push(t);
                }
              }
            });

            splitTs.sort((a, b) => a - b);
            const uniqueTs: number[] = [];
            for (const t of splitTs) {
              if (uniqueTs.length === 0 || t - uniqueTs[uniqueTs.length - 1] > 0.05) {
                uniqueTs.push(t);
              }
            }

            for (let j = 0; j < uniqueTs.length - 1; j++) {
              const tA = uniqueTs[j];
              const tB = uniqueTs[j + 1];
              if (tB - tA < 0.05) continue;
              atomicSegments.push({
                x1: x1 + vx * tA,
                z1: z1 + vz * tA,
                x2: x1 + vx * tB,
                z2: z1 + vz * tB,
                isShearWall: isShear,
                isExterior: false,
                roomType: rm.room_type,
              });
            }
          }
        });

        // 4.3 Deduplicate and categorize exterior vs interior walls
        const segmentsMap = new Map<string, { seg: AtomicSegment; count: number }>();

        atomicSegments.forEach((seg) => {
          const k1 = `${seg.x1.toFixed(2)},${seg.z1.toFixed(2)}`;
          const k2 = `${seg.x2.toFixed(2)},${seg.z2.toFixed(2)}`;
          const key = k1 < k2 ? `${k1}_${k2}` : `${k2}_${k1}`;

          if (segmentsMap.has(key)) {
            const entry = segmentsMap.get(key)!;
            entry.count += 1;
            if (seg.isShearWall) entry.seg.isShearWall = true;
          } else {
            const isForward = k1 < k2;
            segmentsMap.set(key, {
              seg: {
                x1: isForward ? seg.x1 : seg.x2,
                z1: isForward ? seg.z1 : seg.z2,
                x2: isForward ? seg.x2 : seg.x1,
                z2: isForward ? seg.z2 : seg.z1,
                isShearWall: seg.isShearWall,
                isExterior: false,
                roomType: seg.roomType,
              },
              count: 1,
            });
          }
        });

        // 4.4 Filter horizontal floor doors (excluding vertical shaft connections)
        const floorDoors = allDoors.filter((d) => {
          if ((d as any).is_vertical) return false;
          const srcRoom = allRooms.find((r) => r.id === d.source);
          const tgtRoom = allRooms.find((r) => r.id === d.target);
          if (srcRoom && tgtRoom && srcRoom.floor_level !== tgtRoom.floor_level) return false;
          if (srcRoom && srcRoom.floor_level !== floorLevel) return false;
          if (!srcRoom && tgtRoom && tgtRoom.floor_level !== floorLevel) return false;

          const [dx, dz] = d.portal_xy;
          return dx >= fMinX - 1.5 && dx <= fMaxX + 1.5 && dz >= fMinZ - 1.5 && dz <= fMaxZ + 1.5;
        });

        // Track door matching with segments for precise LOD orientation
        const doorSegmentBinding = new Map<any, { seg: AtomicSegment; doorCenterX: number; doorCenterZ: number; angle: number; dist: number }>();

        // 4.5 Render each deduplicated Wall Segment
        segmentsMap.forEach(({ seg, count }) => {
          seg.isExterior = count === 1;
          const length = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
          if (length < 0.10) return;

          const angle = Math.atan2(seg.z2 - seg.z1, seg.x2 - seg.x1);
          const vx = (seg.x2 - seg.x1) / length;
          const vz = (seg.z2 - seg.z1) / length;

          const wallThickness = seg.isShearWall ? 0.25 : seg.isExterior ? 0.20 : 0.12;
          const wallColor = seg.isShearWall
            ? 0x64748B // Betonarme perde
            : seg.isExterior
            ? 0x334155 // Dış cephe
            : 0x475569; // İç bölme

          const attachWallData = (mesh: THREE.Mesh, pieceLen: number) => {
            mesh.userData = {
              id: `wall_${floorLevel}_${seg.x1.toFixed(2)}_${seg.z1.toFixed(2)}_${seg.x2.toFixed(2)}_${seg.z2.toFixed(2)}`,
              name: `Duvar (${seg.isExterior ? 'Dış Cephe' : seg.isShearWall ? 'Perde Duvar' : 'İç Bölme'})`,
              type: 'wall',
              floor: floorLevel,
              length: Number(pieceLen.toFixed(2)),
              segLength: Number(length.toFixed(2)),
              thickness: wallThickness,
              angle_deg: Number(((angle * 180) / Math.PI).toFixed(1)),
              start: [Number(seg.x1.toFixed(2)), Number(seg.z1.toFixed(2))],
              end: [Number(seg.x2.toFixed(2)), Number(seg.z2.toFixed(2))],
              isExterior: seg.isExterior,
              isShearWall: seg.isShearWall,
              roomType: seg.roomType,
              status: 'GEOMETRY_VALID',
            };
          };

          // Find ALL real doors lying on this wall segment (excluding open passages)
          const matchingDoors: { door: any; s: number; w: number }[] = [];
          floorDoors.forEach((d) => {
            if (d.connection_type === 'open_passage' || (d as any).door_id === -1) {
              return;
            }
            const [dx, dz] = d.portal_xy;
            const t = (dx - seg.x1) * vx + (dz - seg.z1) * vz;
            if (t >= -0.2 && t <= length + 0.2) {
              const projX = seg.x1 + vx * t;
              const projZ = seg.z1 + vz * t;
              const dist = Math.hypot(dx - projX, dz - projZ);
              if (dist < 0.65) {
                const doorW = (d.door_width_cm || 90) / 100;
                const clampedS = Math.max(doorW / 2 + 0.05, Math.min(length - doorW / 2 - 0.05, t));
                matchingDoors.push({ door: d, s: clampedS, w: doorW });
                
                const existingBinding = doorSegmentBinding.get(d);
                if (!existingBinding || dist < existingBinding.dist) {
                  const doorCenterX = seg.x1 + vx * clampedS;
                  const doorCenterZ = seg.z1 + vz * clampedS;
                  doorSegmentBinding.set(d, {
                    seg,
                    doorCenterX,
                    doorCenterZ,
                    angle,
                    dist,
                  });
                  // 3B Duvarda açılan fiziksel kapı eşik merkezini navigasyon için kaydet
                  const boundPos = new THREE.Vector3(doorCenterX, floorY, doorCenterZ);
                  exactDoorPortals.set(`${d.source}_${d.target}`, boundPos);
                  exactDoorPortals.set(`${d.target}_${d.source}`, boundPos);
                  d.portal_xy = [Number(doorCenterX.toFixed(2)), Number(doorCenterZ.toFixed(2))];
                }
              }
            }
          });

          // Check if an exterior window can be placed (only on solid walls without doors)
          const canHaveWindow =
            matchingDoors.length === 0 &&
            seg.isExterior &&
            !seg.isShearWall &&
            length >= 2.8 &&
            (seg.roomType === 'salon' || seg.roomType === 'oda' || seg.roomType === 'mutfak');

          if (matchingDoors.length > 0) {
            // WALL WITH ONE OR MORE DOOR OPENINGS (Cutouts)
            matchingDoors.sort((a, b) => a.s - b.s);

            let curS = 0;
            matchingDoors.forEach(({ door, s, w }) => {
              const leftEdge = Math.max(curS, s - w / 2);
              const pieceLen = leftEdge - curS;
              if (pieceLen > 0.12) {
                const pieceGeo = new THREE.BoxGeometry(pieceLen, wallH, wallThickness);
                const pieceMat = new THREE.MeshStandardMaterial({
                  color: wallColor,
                  roughness: 0.75,
                  metalness: 0.1,
                });
                const pieceMesh = new THREE.Mesh(pieceGeo, pieceMat);
                const midS = curS + pieceLen / 2;
                pieceMesh.position.set(seg.x1 + vx * midS, floorY + wallH / 2, seg.z1 + vz * midS);
                pieceMesh.rotation.y = -angle;
                pieceMesh.castShadow = isFloorActive;
                pieceMesh.receiveShadow = isFloorActive;
                attachWallData(pieceMesh, pieceLen);
                bGroup.add(pieceMesh);
              }

              // Lintel Beam (Kapı lentosu - 2.10m ile wallH arası)
              if (wallH > 2.10) {
                const lintelH = wallH - 2.10;
                const lintelGeo = new THREE.BoxGeometry(w, lintelH, wallThickness);
                const lintelMat = new THREE.MeshStandardMaterial({
                  color: wallColor,
                  roughness: 0.75,
                  metalness: 0.1,
                });
                const lintelMesh = new THREE.Mesh(lintelGeo, lintelMat);
                lintelMesh.position.set(seg.x1 + vx * s, floorY + 2.10 + lintelH / 2, seg.z1 + vz * s);
                lintelMesh.rotation.y = -angle;
                lintelMesh.castShadow = isFloorActive;
                attachWallData(lintelMesh, w);
                bGroup.add(lintelMesh);
              }

              curS = s + w / 2;
            });

            // Remaining right piece after the last door
            const rightLen = length - curS;
            if (rightLen > 0.12) {
              const rightGeo = new THREE.BoxGeometry(rightLen, wallH, wallThickness);
              const rightMat = new THREE.MeshStandardMaterial({
                color: wallColor,
                roughness: 0.75,
                metalness: 0.1,
              });
              const rightMesh = new THREE.Mesh(rightGeo, rightMat);
              const midS = curS + rightLen / 2;
              rightMesh.position.set(seg.x1 + vx * midS, floorY + wallH / 2, seg.z1 + vz * midS);
              rightMesh.rotation.y = -angle;
              rightMesh.castShadow = isFloorActive;
              rightMesh.receiveShadow = isFloorActive;
              attachWallData(rightMesh, rightLen);
              bGroup.add(rightMesh);
            }
          } else if (canHaveWindow) {
            // EXTERIOR WALL WITH WINDOW (Parapet, Aluminum Frame & Glass)
            const winW = Math.min(2.0, length - 1.0);
            const sideLen = (length - winW) / 2;

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
              attachWallData(pierMesh, sideLen);
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
            attachWallData(parapetMesh, winW);
            bGroup.add(parapetMesh);

            // Aluminum Frame + Glass (between 0.90m and 2.30m)
            if (wallH > 0.90) {
              const glassH = Math.min(wallH, 2.30) - 0.90;
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
              attachWallData(topMesh, winW);
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
            attachWallData(wallMesh, length);
            bGroup.add(wallMesh);
          }
        });

        // ---------------------------------------------------------------------
        // 5. 3B GERÇEK KAPI DOĞRAMALARI (LOD: Kasa, Hizalı Kanat, Yay, Panik Barı)
        // ---------------------------------------------------------------------
        floorDoors.forEach((door, didx) => {
          // Open passages are wall openings or shared room boundaries, NOT hinged doors with leaves/arcs!
          if (door.connection_type === 'open_passage' || (door as any).door_id === -1) {
            return;
          }

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
            : 0x475569; // Standart oda kapısı doğraması

          // Retrieve precise wall-aligned position and orientation
          const binding = doorSegmentBinding.get(door);
          const [rawDx, rawDz] = door.portal_xy;
          const doorPosX = binding ? binding.doorCenterX : rawDx;
          const doorPosZ = binding ? binding.doorCenterZ : rawDz;
          const wallAngle = binding ? binding.angle : 0;

          const doorGroup = new THREE.Group();
          doorGroup.position.set(doorPosX, floorY, doorPosZ);
          // Crucial: Rotate doorGroup to align exactly with its host wall
          doorGroup.rotation.y = -wallAngle;

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

          // Top Header Frame
          const headerGeo = new THREE.BoxGeometry(doorW + 0.08, 0.08, 0.12);
          const headerMesh = new THREE.Mesh(headerGeo, frameMat);
          headerMesh.position.set(0, frameH - 0.04, 0);
          doorGroup.add(headerMesh);

          // Door Leaf (Kasa içine tam oturan mimari kanat - sıfır yamukluk)
          const leafW = Math.max(0.2, doorW - 0.08);
          const leafH = Math.max(0.5, frameH - 0.08);
          const leafThickness = 0.04;
          const leafGeo = new THREE.BoxGeometry(leafW, leafH, leafThickness);
          const leafMat = new THREE.MeshStandardMaterial({
            color: doorColor,
            emissive: isViolated ? 0xEF4444 : isOptimized ? 0x00FF88 : 0x000000,
            emissiveIntensity: isViolated || isOptimized ? 0.65 : 0.0,
            roughness: 0.5,
            metalness: isFire ? 0.6 : 0.1,
          });

          // Kapı kanadı duvar kasası düzleminde tam oturur (rotasyonsuz, sıfır eğrilik)
          const leafMesh = new THREE.Mesh(leafGeo, leafMat);
          leafMesh.position.set(0, leafH / 2 + 0.02, 0);
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
            barMesh.position.set(0, 0.90, 0.035);
            doorGroup.add(barMesh);
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
          const arcPoints = arcCurve.getPoints(20).map((p) => new THREE.Vector3(p.x, 0.02, p.y));
          const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPoints);
          const arcMat = new THREE.LineBasicMaterial({
            color: isViolated ? 0xEF4444 : isOptimized ? 0x00FF88 : 0x00F0FF,
            transparent: true,
            opacity: 0.70,
          });
          const arcLine = new THREE.Line(arcGeo, arcMat);
          arcLine.visible = showDoorArcs;
          arcLine.userData = {
            id: `arc_${door.source}_${door.target}`,
            name: `Kapı Açılım Yayı (${door.door_width_cm}cm)`,
            type: 'arc',
            floor: floorLevel,
            radius_cm: door.door_width_cm,
            angle_deg: 90,
            layer: 'A-DOOR-SWING',
            wallAngle_deg: Number(((wallAngle * 180) / Math.PI).toFixed(1)),
            status: 'GEOMETRY_VALID',
          };
          doorGroup.add(arcLine);

          // Bottleneck / İhlal Halo Çemberi (Sadece yatay kat kapılarında)
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
            wallAngle_deg: Number(((wallAngle * 180) / Math.PI).toFixed(1)),
            portal_xy: [Number(doorPosX.toFixed(2)), Number(doorPosZ.toFixed(2))],
            status: 'GEOMETRY_VALID',
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

    // Sort collected rooms: Ground (0), Kat 1, 2..., Basement (-1, -2...)
    // Put Salons and living rooms at the top of each floor for convenient selection
    collectedRooms.sort((a, b) => {
      if (a.floor_level === 0 && b.floor_level !== 0) return -1;
      if (b.floor_level === 0 && a.floor_level !== 0) return 1;
      if (a.floor_level !== b.floor_level) return b.floor_level - a.floor_level;

      const isSalonA = a.room_type === 'salon' || a.name.toLowerCase().includes('salon');
      const isSalonB = b.room_type === 'salon' || b.name.toLowerCase().includes('salon');
      if (isSalonA && !isSalonB) return -1;
      if (!isSalonA && isSalonB) return 1;

      return a.name.localeCompare(b.name, 'tr');
    });

    // Convert all architectural doors into NavigationEngine Door Edges with 3D world portals
    const navDoors: NavDoorEdge[] = [];
    allDoors.forEach((d) => {
      const roomFrom = collectedRooms.find((r) => r.id === d.source);
      const roomTo = collectedRooms.find((r) => r.id === d.target);
      if (roomFrom && roomTo) {
        const isVert = Boolean((d as any).is_vertical) || roomFrom.floor_level !== roomTo.floor_level;
        const exactPos = exactDoorPortals.get(`${d.source}_${d.target}`) || exactDoorPortals.get(`${d.target}_${d.source}`);
        let portalPos: THREE.Vector3;

        if (isVert) {
          portalPos = new THREE.Vector3(
            (roomFrom.pos.x + roomTo.pos.x) / 2,
            (roomFrom.pos.y + roomTo.pos.y) / 2,
            (roomFrom.pos.z + roomTo.pos.z) / 2
          );
        } else if (exactPos) {
          portalPos = exactPos.clone();
        } else if (d.portal_xy && (Math.abs(d.portal_xy[0]) >= 0.05 || Math.abs(d.portal_xy[1]) >= 0.05)) {
          portalPos = new THREE.Vector3(d.portal_xy[0], roomFrom.pos.y, d.portal_xy[1]);
        } else if (roomFrom.polygon_2d && roomTo.polygon_2d) {
          const sharedMid = findSharedBoundaryMidpoint(roomFrom.polygon_2d, roomTo.polygon_2d);
          portalPos = sharedMid
            ? new THREE.Vector3(sharedMid.x, roomFrom.pos.y, sharedMid.z)
            : roomFrom.pos.clone().lerp(roomTo.pos, 0.5);
        } else {
          portalPos = roomFrom.pos.clone().lerp(roomTo.pos, 0.5);
        }

        navDoors.push({
          id: `${d.source}_${d.target}`,
          source: d.source,
          target: d.target,
          door_width_cm: d.door_width_cm,
          portal_pos: portalPos,
          is_fire_resistant: d.is_fire_resistant,
          usable_in_fire: d.usable_in_fire,
          is_vertical: isVert,
        });
      }
    });

    // Populate available rooms and doors for Tel Ali Dijkstra Engine & HUD
    setAvailableRooms(collectedRooms);
    roomsListRef.current = collectedRooms;
    doorsListRef.current = navDoors;

    // Filter out exterior exit doorway from spawn candidates
    const isExit = (r: RoomCentroidInfo) => {
      const n = (r.name || '').toLowerCase();
      const id = String(r.id || '').toLowerCase();
      const rt = (r.room_type || '').toLowerCase();
      return (
        rt === 'dis_cikis' ||
        rt === 'exit' ||
        n.includes('çıkış') ||
        n.includes('cikis') ||
        n.includes('exit') ||
        id.includes('cikis') ||
        id.includes('exit')
      );
    };

    const habitableRooms = collectedRooms.filter((r) => !isExit(r));
    const targetFloor = activeFloor !== 'all' ? activeFloor : 0;
    const defaultRoom =
      habitableRooms.find((r) => r.floor_level === targetFloor && (r.room_type === 'salon' || r.name.toLowerCase().includes('salon'))) ||
      habitableRooms.find((r) => r.floor_level === targetFloor && (r.room_type === 'oda' || r.name.toLowerCase().includes('oda'))) ||
      habitableRooms.find((r) => r.floor_level === targetFloor) ||
      habitableRooms.find((r) => r.floor_level === 0 && (r.room_type === 'salon' || r.name.toLowerCase().includes('salon'))) ||
      habitableRooms[0] ||
      collectedRooms[0];

    // Position Tel Ali on data load / update, active floor change, or if current room is invalid
    const isEscapingActive = isEscapingRef.current;
    if (isEscapingActive) {
      lastDataRef.current = data;
    }
    const floorChanged = lastActiveFloorRef.current !== activeFloor && activeFloor !== 'all';
    lastActiveFloorRef.current = activeFloor;

    const needsPlacement =
      !isEscapingActive && (
        !isTelAliPlaced ||
        lastDataRef.current !== data ||
        floorChanged ||
        !collectedRooms.some((r) => r.id === selectedTelAliRoomId)
      );

    if (needsPlacement && defaultRoom && telAliRef.current) {
      lastDataRef.current = data;
      telAliRef.current.group.position.copy(defaultRoom.pos);
      telAliRef.current.group.visible = true;
      setIsTelAliPlaced(true);
      setSelectedTelAliRoomId(defaultRoom.id);

      // Compute initial deterministic escape route
      const initialRoute = computeDijkstraRoute(collectedRooms, navDoors, defaultRoom.id);
      navTrackerRef.current.setRoute(initialRoute);
      setEvacuationState(initialRoute.state);
      setEvacuationErrorCode(initialRoute.errorCode);
      if (initialRoute.success) {
        setRouteSummary({ distanceM: initialRoute.totalDistanceM, estTimeSec: initialRoute.estimatedTimeSec });
        setTelAliStatusText(`${defaultRoom.name} içinde hazır (${initialRoute.totalDistanceM}m tahliye yolu)`);
      } else {
        setRouteSummary(null);
        setTelAliStatusText(`⚠️ ${initialRoute.failureReasonTr} [${initialRoute.errorCode}]`);
      }
      telAliRef.current.updateBadge(100, defaultRoom.name);
      renderDebugRoute(initialRoute, debugRouteGroupRef.current, showDebugRoute);
    }

    // =========================================================================
    // 8. DİNAMİK ATEŞ KAYNAĞI & İKİ-BÖLGELİ DUMAN MODELİ (ASET / RSET)
    // =========================================================================
    let fireRoom = collectedRooms.find((r) => r.id === selectedFireRoomId);
    if (!fireRoom) {
      fireRoom =
        collectedRooms.find((r) => r.floor_level === 0 && (r.room_type === 'salon' || r.name.toLowerCase().includes('salon'))) ||
        collectedRooms.find((r) => r.floor_level === 0 && r.room_type !== 'dis_cikis') ||
        collectedRooms.find((r) => r.room_type !== 'dis_cikis') ||
        collectedRooms[0];
      if (fireRoom) {
        setSelectedFireRoomId(fireRoom.id);
      }
    }

    if (fireRoom && fireGroupRef.current) {
      const fGroup = fireGroupRef.current;
      // If user had already placed fire in a custom point, preserve or update
      const fPos =
        fireOriginPosRef.current && fireOriginPosRef.current.distanceTo(new THREE.Vector3(7, 0, 22)) > 0.1 && selectedFireRoomId
          ? fireOriginPosRef.current.clone()
          : fireRoom.pos.clone().add(new THREE.Vector3(0, 0.2, 0));

      fireOriginPosRef.current.copy(fPos);
      fGroup.position.copy(fPos);

      const floorText =
        fireRoom.floor_level === 0
          ? 'K0 (Zemin)'
          : fireRoom.floor_level < 0
          ? `K${fireRoom.floor_level} (Bodrum)`
          : `K${fireRoom.floor_level}. Kat`;

      setFireLocationInfo({
        roomId: fireRoom.id,
        roomName: fireRoom.name,
        floorLevel: fireRoom.floor_level,
        areaM2: fireRoom.area_m2,
        pos: fPos.clone(),
      });

      // 1. Volumetric Flame Sphere
      const fireGeo = new THREE.SphereGeometry(1.2, 20, 20);
      const fireMat = new THREE.MeshStandardMaterial({
        color: 0xFF4500,
        emissive: 0xFF2200,
        emissiveIntensity: 1.1,
        transparent: true,
        opacity: 0.82,
        roughness: 0.3,
      });
      const fireMesh = new THREE.Mesh(fireGeo, fireMat);
      fireMesh.name = 'fire_origin';
      fireMesh.position.set(0, 1.1, 0);
      fGroup.add(fireMesh);
      fireMeshRef.current = fireMesh;

      // 2. High-heat inner core
      const coreGeo = new THREE.SphereGeometry(0.65, 16, 16);
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0xFFFF55,
        emissive: 0xFFAA00,
        emissiveIntensity: 1.8,
        transparent: true,
        opacity: 0.95,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.position.set(0, 1.1, 0);
      fGroup.add(coreMesh);

      // 3. Dynamic Warm Fire Light (illuminates surrounding walls and floors)
      const fireLight = new THREE.PointLight(0xFF4500, 3.2, 16);
      fireLight.position.set(0, 1.5, 0);
      fGroup.add(fireLight);
      firePointLightRef.current = fireLight;

      // 4. Ground Hazard Decal Ring (pulsing circular hazard zone on floor slab)
      const ringGeo = new THREE.RingGeometry(0.8, 1.6, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xFF3300,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
      });
      const groundRing = new THREE.Mesh(ringGeo, ringMat);
      groundRing.rotation.x = -Math.PI / 2;
      groundRing.position.set(0, 0.05, 0);
      fGroup.add(groundRing);
      fireGroundRingRef.current = groundRing;

      // 5. Floating 3D Badge Sprite
      const badgeTex = getFireBadgeTexture(fireRoom.name, floorText);
      const badgeMat = new THREE.SpriteMaterial({ map: badgeTex, transparent: true, depthTest: false });
      const badgeSprite = new THREE.Sprite(badgeMat);
      badgeSprite.scale.set(4.2, 2.0, 1);
      badgeSprite.position.set(0, 2.7, 0);
      badgeSprite.renderOrder = 999;
      fGroup.add(badgeSprite);
      fireBadgeSpriteRef.current = badgeSprite;
    }

    // Subtle Translucent Smoke Ceiling Layer (Floor-Aware)
    if (showSmoke && fireRoom) {
      const fireFloorY = fireRoom.floor_level * storyHeight;
      const smokeGeo = new THREE.BoxGeometry(
        (maxX - minX) * 0.95,
        1.80,
        (maxZ - minZ) * 0.95
      );
      const smokeMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        transparent: true,
        opacity: 0.18,
        depthWrite: false, // Ensures character, doors and route remain visible underneath
        roughness: 0.95,
      });
      const smokeLayer = new THREE.Mesh(smokeGeo, smokeMat);
      smokeLayer.name = 'smoke_layer';
      smokeLayer.position.set(
        (minX + maxX) / 2,
        fireFloorY + 2.80 - 0.9,
        (minZ + maxZ) / 2
      );
      sGroup.add(smokeLayer);
      smokeMeshRef.current = smokeLayer;
    }
  }, [
    data,
    activeFloor,
    explodedZ,
    wallHeightMode,
    // simulationTime excluded to prevent rebuilding entire 3D building every frame
    showSmoke,
    showRAGOverlay,
    showBottlenecks,
    showBIMArchitecture,
    showDoorArcs,
    cadDiffMode,
  ]);

  // Re-render debug route when showDebugRoute toggles
  useEffect(() => {
    if (navTrackerRef.current && debugRouteGroupRef.current) {
      const route: RouteResult = {
        success: navTrackerRef.current.waypoints.length > 0,
        state: navTrackerRef.current.state,
        errorCode: navTrackerRef.current.errorCode,
        waypoints: navTrackerRef.current.waypoints,
        pathNodes: [],
        totalDistanceM: navTrackerRef.current.traveledDistanceM || 1,
        estimatedTimeSec: 0,
        failureReasonTr: '',
      };
      renderDebugRoute(route, debugRouteGroupRef.current, showDebugRoute);
    }
  }, [showDebugRoute]);

  // Handler functions for UI actions
  const handleResetToIsometric = () => {
    if (!cameraRef.current) return;
    const cam = cameraRef.current;
    const centerX = 10;
    const centerY = 4;
    const centerZ = 18;
    const targetLook = new THREE.Vector3(centerX, centerY, centerZ);
    const targetCam = new THREE.Vector3(centerX + 32, centerY + 32, centerZ + 32);
    cameraAnimRef.current = {
      active: true,
      startPos: cam.position.clone(),
      endPos: targetCam,
      startTarget: cameraTargetRef.current.clone(),
      endTarget: targetLook,
      progress: 0,
    };
    if (onResetCamera) onResetCamera();
  };

  const toggleWireframe = () => {
    const nextState = !isWireframe;
    setIsWireframe(nextState);
    if (buildingGroupRef.current) {
      buildingGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => {
              m.wireframe = nextState;
            });
          } else {
            child.material.wireframe = nextState;
          }
        }
      });
    }
  };

  const handleFloorIsolate = (floor: 'all' | number) => {
    setInternalFloor(floor);
    if (onFloorChange) onFloorChange(floor);
  };

  const handlePlaceTelAli = (roomId?: string) => {
    if (!telAliRef.current || roomsListRef.current.length === 0) return;
    const targetId = roomId || selectedTelAliRoomId || roomsListRef.current[0].id;
    const room =
      roomsListRef.current.find((r) => r.id === targetId) ||
      roomsListRef.current.find((r) => r.room_type !== 'dis_cikis') ||
      roomsListRef.current[0];

    if (room && telAliRef.current) {
      isEscapingRef.current = false;
      setIsEscaping(false);
      escapePathRef.current = [];
      currentWpIndexRef.current = 0;
      healthRef.current = 100;
      setTelAliHealth(100);
      escapeTimerRef.current = 0;
      setEscapeDuration(0);
      setShowCelebrationModal(false);

      telAliRef.current.group.position.copy(room.pos);
      telAliRef.current.group.visible = true;
      setIsTelAliPlaced(true);
      setSelectedTelAliRoomId(room.id);
      telAliRef.current.updateBadge(100, `${room.name}`);

      // Calculate Dijkstra Evacuation Route through doors and corridors
      const route = computeDijkstraRoute(
        roomsListRef.current,
        doorsListRef.current,
        room.id
      );

      navTrackerRef.current.setRoute(route);
      setEvacuationState(route.state);
      setEvacuationErrorCode(route.errorCode);

      if (route.success) {
        setRouteSummary({ distanceM: route.totalDistanceM, estTimeSec: route.estimatedTimeSec });
        setTelAliStatusText(`${room.name} içinde hazır (${route.totalDistanceM}m tahliye yolu)`);
      } else {
        setRouteSummary(null);
        setTelAliStatusText(`⚠️ Rota bulunamadı: ${route.failureReasonTr} [${route.errorCode}]`);
      }

      renderDebugRoute(route, debugRouteGroupRef.current, showDebugRoute);

      // Smoothly focus camera on Tel Ali
      if (cameraRef.current) {
        const cam = cameraRef.current;
        const targetLook = room.pos.clone().add(new THREE.Vector3(0, 1.0, 0));
        const targetCam = targetLook.clone().add(new THREE.Vector3(10, 8, 10));
        cameraAnimRef.current = {
          active: true,
          startPos: cam.position.clone(),
          endPos: targetCam,
          startTarget: cameraTargetRef.current.clone(),
          endTarget: targetLook,
          progress: 0,
        };
      }
    }
  };

  const handlePlaceFire = (roomId?: string, customPoint?: THREE.Vector3) => {
    if (roomsListRef.current.length === 0) return;

    let targetRoom: RoomCentroidInfo | undefined;
    let targetPos: THREE.Vector3;

    if (customPoint) {
      targetPos = customPoint.clone();
      if (roomId) {
        targetRoom = roomsListRef.current.find((r) => r.id === roomId);
      }
      if (!targetRoom) {
        let minDist = Infinity;
        roomsListRef.current.forEach((r) => {
          const d = r.pos.distanceTo(targetPos);
          if (d < minDist) {
            minDist = d;
            targetRoom = r;
          }
        });
      }
    } else {
      const targetId = roomId || selectedFireRoomId || roomsListRef.current[0].id;
      targetRoom =
        roomsListRef.current.find((r) => r.id === targetId) ||
        roomsListRef.current[0];
      targetPos = targetRoom.pos.clone().add(new THREE.Vector3(0, 0.2, 0));
    }

    if (!targetRoom) return;

    fireOriginPosRef.current.copy(targetPos);
    setSelectedFireRoomId(targetRoom.id);

    const floorText =
      targetRoom.floor_level === 0
        ? 'K0 (Zemin)'
        : targetRoom.floor_level < 0
        ? `K${targetRoom.floor_level} (Bodrum)`
        : `K${targetRoom.floor_level}. Kat`;

    setFireLocationInfo({
      roomId: targetRoom.id,
      roomName: targetRoom.name,
      floorLevel: targetRoom.floor_level,
      areaM2: targetRoom.area_m2,
      pos: targetPos.clone(),
    });

    // Update 3D Fire Group position
    if (fireGroupRef.current) {
      fireGroupRef.current.position.copy(targetPos);
      fireGroupRef.current.visible = true;

      if (fireBadgeSpriteRef.current) {
        fireBadgeSpriteRef.current.material.map = getFireBadgeTexture(
          targetRoom.name,
          floorText
        );
        fireBadgeSpriteRef.current.material.needsUpdate = true;
      }
    }

    // Update smoke ceiling layer Y level to match the fire's floor height
    if (smokeMeshRef.current) {
      const storyHeight = 3.20 * explodedZ;
      const fireFloorY = targetRoom.floor_level * storyHeight;
      smokeMeshRef.current.position.y = fireFloorY + 2.80 - 0.9;
    }

    // Smooth camera focus to Fire
    if (cameraRef.current) {
      const cam = cameraRef.current;
      const targetLook = targetPos.clone().add(new THREE.Vector3(0, 1.2, 0));
      const targetCam = targetLook.clone().add(new THREE.Vector3(12, 10, 12));
      cameraAnimRef.current = {
        active: true,
        startPos: cam.position.clone(),
        endPos: targetCam,
        startTarget: cameraTargetRef.current.clone(),
        endTarget: targetLook,
        progress: 0,
      };
    }
  };

  const handleStartEscape = () => {
    if (!telAliRef.current || roomsListRef.current.length === 0) return;
    const tracker = navTrackerRef.current;

    // If tracker doesn't have a valid route yet, calculate it now
    if (tracker.state !== 'PLACED' && tracker.state !== 'ROUTE_READY') {
      const currRoom =
        roomsListRef.current.find((r) => r.id === selectedTelAliRoomId) ||
        roomsListRef.current.find((r) => r.room_type !== 'dis_cikis') ||
        roomsListRef.current[0];
      const route = computeDijkstraRoute(
        roomsListRef.current,
        doorsListRef.current,
        currRoom.id
      );
      tracker.setRoute(route);
      setEvacuationState(route.state);
      setEvacuationErrorCode(route.errorCode);
      renderDebugRoute(route, debugRouteGroupRef.current, showDebugRoute);
      if (!route.success) {
        setTelAliStatusText(`Tahliye Başlatılamadı: ${route.failureReasonTr}`);
        return;
      }
    }

    if (tracker.waypoints.length < 2) {
      setEvacuationState('FAILED');
      setEvacuationErrorCode('ROUTE_NOT_FOUND');
      setTelAliStatusText('Geçerli tahliye güzergâhı bulunamadı (ROUTE_NOT_FOUND).');
      return;
    }

    // Ensure Tel Ali is stationed in starting room
    telAliRef.current.group.position.copy(tracker.waypoints[0].pos);
    telAliRef.current.group.visible = true;

    tracker.start();
    isEscapingRef.current = true;
    setIsEscaping(true);
    healthRef.current = 100;
    setTelAliHealth(100);
    escapeTimerRef.current = 0;
    setEscapeDuration(0);
    setShowCelebrationModal(false);
    setEvacuationState('EVACUATING');
    setEvacuationErrorCode(null);
    setTelAliStatusText(tracker.statusTextTr);
    telAliRef.current.updateBadge(100, '🚨 Tahliye Başladı!');
    if (onTogglePlay) onTogglePlay(true);
  };

  return (
    <div className="relative w-full h-full min-w-0 overflow-hidden select-none bg-slate-950">
      <div
        ref={containerRef}
        className={`w-full h-full ${
          isPlacingFireMode
            ? 'cursor-crosshair'
            : activeCadTool === 'pan'
            ? 'cursor-grab active:cursor-grabbing'
            : 'cursor-crosshair'
        }`}
      />

      {/* 3B Tıkla & Ateş Koy Modu Aktif Bildirim Bandı */}
      {isPlacingFireMode && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 bg-red-950/95 text-red-100 border-2 border-red-500 px-4 py-2 rounded-lg shadow-2xl backdrop-blur-md flex items-center gap-3 animate-pulse">
          <Flame className="w-5 h-5 text-red-400 shrink-0 animate-bounce" />
          <div className="text-xs">
            <span className="font-bold text-white">3B ATEŞ KONUMLANDIRMA:</span> Modelde yangının çıkmasını istediğiniz kata veya odaya tıklayın.
          </div>
          <button
            onClick={() => {
              setIsPlacingFireMode(false);
              isPlacingFireModeRef.current = false;
              if (containerRef.current) containerRef.current.style.cursor = 'default';
            }}
            className="px-2.5 py-1 bg-red-800 hover:bg-red-700 text-white rounded text-[11px] font-medium border border-red-400/40 shadow-sm transition-colors"
          >
            İptal (ESC)
          </button>
        </div>
      )}

      {/* =========================================================================
          TOP HUD WRAPPER: ESNEK GRID/STACK KAPSAYICI (%100 ZOOM VE DAR EKRAN UYUMLU)
      ========================================================================= */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-start justify-between gap-2.5 pointer-events-none">
        {/* SOL STACK: BIM BİLGİ ROZETİ & TEL ALİ / YANGIN TAHLİYE HUD KARTI */}
        <div className="flex flex-col gap-2 pointer-events-auto w-full sm:w-[350px] max-w-[350px]">
          {/* BIM Info Badge & Smoke Alert Bar */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="hud-card px-2.5 py-1 rounded-md flex items-center gap-2 text-[12px] font-mono shadow-md">
              <span className="w-2 h-2 rounded-full bg-[var(--ui-primary)] shrink-0" />
              <span className="text-[var(--ui-text)] font-semibold whitespace-nowrap">BIM LOD300</span>
              <span className="text-[var(--ui-border)]">|</span>
              <span className="text-[var(--ui-text-muted)] whitespace-nowrap">
                {wallHeightMode === 'cut'
                  ? 'Dollhouse (1.2m)'
                  : wallHeightMode === 'full'
                  ? 'Tam (2.8m)'
                  : 'Plan (0.15m)'}
              </span>
              <span className="text-[var(--ui-border)]">|</span>
              <span className="text-[var(--ui-text-muted)] whitespace-nowrap">
                {activeFloor === 'all' ? 'Tüm Katlar' : `Kat ${activeFloor}`}
              </span>
            </div>

            {/* Smoke Simulation Live Alert Badge */}
            {showSmoke && (
              <div
                className={`hud-card px-2 py-1 rounded-md text-[11px] font-mono transition-all flex items-center gap-1.5 whitespace-nowrap shadow-md ${
                  simulationTime > 75
                    ? 'text-[var(--ui-danger)] border-[var(--ui-danger)]/50'
                    : 'text-[var(--ui-warning)]'
                }`}
              >
                <span>🔥 T: {simulationTime.toFixed(1)}s</span>
                <span className="text-[var(--ui-border)]">|</span>
                <span>Duman: {(2.8 - Math.min(1.0, simulationTime / 120.0) * 1.8).toFixed(2)}m</span>
                {fireLocationInfo && (
                  <>
                    <span className="text-[var(--ui-border)]">|</span>
                    <span className="text-red-400 font-sans font-medium">
                      Yangın: {fireLocationInfo.floorLevel === 0 ? 'K0' : fireLocationInfo.floorLevel < 0 ? `K${fireLocationInfo.floorLevel}` : `K${fireLocationInfo.floorLevel}`} · {fireLocationInfo.roomName}
                    </span>
                  </>
                )}
                {simulationTime > 75 && (
                  <span className="badge badge-danger text-[10px] font-bold py-0 px-1">AŞILDI</span>
                )}
              </div>
            )}
          </div>

          {/* Tel Ali & Yangın Simülatörü HUD Kartı */}
          <div className="hud-card p-3 text-[12px] flex flex-col gap-2.5 shadow-xl rounded-lg border border-[var(--ui-border)]/80">
            <div className="flex items-center justify-between border-b border-[var(--ui-border)]/60 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] flex items-center justify-center text-xs shadow-sm shrink-0">
                  {activeSimulationTab === 'fire' ? '🔥' : '🏃'}
                </div>
                <div>
                  <span className="font-semibold text-[var(--ui-text)] text-[13px] flex items-center gap-1.5 whitespace-nowrap">
                    Tahliye & Yangın Simülatörü
                    {isEscaping && (
                      <span className="w-2 h-2 rounded-full bg-[var(--ui-success)] animate-ping" />
                    )}
                  </span>
                  <p className="text-[11px] text-[var(--ui-text-muted)]">
                    {activeSimulationTab === 'fire'
                      ? 'Yangın Başlangıç Konumu & ASET/RSET'
                      : 'Dijkstra / RAG Güvenli Kaçış'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTelAliPanelOpen(!isTelAliPanelOpen)}
                className="text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] transition-colors p-1"
                title="Paneli Aç / Daralt"
              >
                {isTelAliPanelOpen ? <X size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>

            {isTelAliPanelOpen && (
              <>
                {/* Simulation Mode Sub-Tabs: Tel Ali vs Fire Origin */}
                <div className="grid grid-cols-2 gap-1 bg-[var(--ui-surface-raised)] p-0.5 rounded-md border border-[var(--ui-border)]/70">
                  <button
                    onClick={() => setActiveSimulationTab('tel_ali')}
                    className={`py-1 px-2 rounded text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all ${
                      activeSimulationTab === 'tel_ali'
                        ? 'bg-[var(--ui-primary)] text-white shadow-sm font-semibold'
                        : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
                    }`}
                  >
                    <User size={12} />
                    <span>🏃 Tel Ali Konumu</span>
                  </button>
                  <button
                    onClick={() => setActiveSimulationTab('fire')}
                    className={`py-1 px-2 rounded text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all ${
                      activeSimulationTab === 'fire'
                        ? 'bg-[var(--ui-danger)] text-white shadow-sm font-semibold'
                        : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
                    }`}
                  >
                    <Flame size={12} />
                    <span>🔥 Yangın Noktası</span>
                  </button>
                </div>

                {activeSimulationTab === 'tel_ali' ? (
                  /* Tel Ali Placement Controls */
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-[var(--ui-text-muted)] flex items-center gap-1">
                      <MapPin size={12} className="text-[var(--ui-primary)] shrink-0" /> Tel Ali Başlangıç Mahalli:
                    </label>
                    <div className="flex items-center gap-1.5 w-full">
                      <select
                        value={selectedTelAliRoomId}
                        onChange={(e) => {
                          setSelectedTelAliRoomId(e.target.value);
                          handlePlaceTelAli(e.target.value);
                        }}
                        disabled={isEscaping}
                        className="flex-1 min-w-0 bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] rounded px-2 py-1 text-[var(--ui-text)] text-[12px] focus:outline-none focus:border-[var(--ui-primary)] transition-colors disabled:opacity-50 truncate"
                      >
                        {availableRooms.length > 0 ? (
                          availableRooms
                            .filter((rm) => rm.room_type !== 'dis_cikis')
                            .map((rm) => {
                              const floorText =
                                rm.floor_level === 0
                                  ? 'K0 (Zemin)'
                                  : rm.floor_level < 0
                                  ? `K${rm.floor_level} (Bodrum)`
                                  : `K${rm.floor_level}`;
                              return (
                                <option key={rm.id} value={rm.id} className="bg-[var(--ui-surface-raised)] text-[var(--ui-text)]">
                                  {floorText}: {rm.name} ({rm.area_m2.toFixed(1)} m²)
                                </option>
                              );
                            })
                        ) : (
                          <>
                            <option value="K0_salon_1" className="bg-[var(--ui-surface-raised)] text-[var(--ui-text)]">K0 (Zemin): Salon (32m²)</option>
                            <option value="K-1_siginak" className="bg-[var(--ui-surface-raised)] text-[var(--ui-text)]">K-1 (Bodrum): Sığınak (42m²)</option>
                          </>
                        )}
                      </select>
                      <button
                        onClick={() => handlePlaceTelAli()}
                        disabled={isEscaping}
                        className="btn btn-primary btn-sm py-1 px-2.5 text-[11px] shrink-0 whitespace-nowrap flex items-center gap-1"
                        title="Seçilen Odaya Yerleştir"
                      >
                        <User size={12} />
                        <span>Yerleştir</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Fire Origin Placement Controls (Oda ve Kat Seçimi + 3B Tıklayarak Koyma) */
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-medium text-[var(--ui-text-muted)] flex items-center gap-1">
                          <Flame size={12} className="text-[var(--ui-danger)] shrink-0" /> Yangın Çıkış Mahalli (Kat & Oda):
                        </label>
                        {fireLocationInfo && (
                          <span className="text-[10px] text-[var(--ui-danger)] font-mono font-semibold">
                            {fireLocationInfo.floorLevel === 0 ? 'K0' : fireLocationInfo.floorLevel < 0 ? `K${fireLocationInfo.floorLevel}` : `K${fireLocationInfo.floorLevel}`} · {fireLocationInfo.roomName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 w-full">
                        <select
                          value={selectedFireRoomId}
                          onChange={(e) => {
                            setSelectedFireRoomId(e.target.value);
                            handlePlaceFire(e.target.value);
                          }}
                          disabled={isEscaping}
                          className="flex-1 min-w-0 bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] rounded px-2 py-1 text-[var(--ui-text)] text-[12px] focus:outline-none focus:border-[var(--ui-danger)] transition-colors disabled:opacity-50 truncate"
                        >
                          {availableRooms.length > 0 ? (
                            availableRooms
                              .filter((rm) => rm.room_type !== 'dis_cikis')
                              .map((rm) => {
                                const floorText =
                                  rm.floor_level === 0
                                    ? 'K0 (Zemin)'
                                    : rm.floor_level < 0
                                    ? `K${rm.floor_level} (Bodrum)`
                                    : `K${rm.floor_level}`;
                                return (
                                  <option key={`fire_${rm.id}`} value={rm.id} className="bg-[var(--ui-surface-raised)] text-[var(--ui-text)]">
                                    {floorText}: {rm.name} ({rm.area_m2.toFixed(1)} m²)
                                  </option>
                                );
                              })
                          ) : (
                            <option value="K0_salon_1">K0 (Zemin): Salon</option>
                          )}
                        </select>
                        <button
                          onClick={() => handlePlaceFire()}
                          disabled={isEscaping}
                          className="btn btn-sm py-1 px-2.5 text-[11px] shrink-0 whitespace-nowrap flex items-center gap-1 bg-[var(--ui-danger)] hover:brightness-110 text-white border border-[var(--ui-danger)] shadow-sm font-semibold"
                          title="Ateşi Seçilen Odaya Taşı"
                        >
                          <Flame size={12} />
                          <span>Ateşi Koy</span>
                        </button>
                      </div>
                    </div>

                    {/* Interactive 3D Click & Place Button */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          const next = !isPlacingFireMode;
                          setIsPlacingFireMode(next);
                          isPlacingFireModeRef.current = next;
                          if (containerRef.current) {
                            containerRef.current.style.cursor = next ? 'crosshair' : 'default';
                          }
                        }}
                        disabled={isEscaping}
                        className={`w-full py-1.5 px-2 rounded text-[11px] font-medium flex items-center justify-center gap-1.5 border transition-all ${
                          isPlacingFireMode
                            ? 'bg-red-600 text-white border-red-400 animate-pulse ring-2 ring-red-400 shadow-md font-semibold'
                            : 'bg-[var(--ui-surface-raised)] hover:bg-[var(--ui-surface-raised)]/80 text-[var(--ui-text)] border-[var(--ui-border)]'
                        }`}
                        title="3B model üzerinde istediğiniz kata ve odaya tıklayarak ateşi yerleştirin"
                      >
                        <Crosshair size={13} className={isPlacingFireMode ? 'animate-spin' : 'text-red-400'} />
                        <span>
                          {isPlacingFireMode ? '🎯 3B Modelde Bir Noktaya Tıklayın...' : '🎯 3B Tıkla & Ateş Koy'}
                        </span>
                      </button>
                    </div>

                    {/* Fire Coordinates & Status Info Bar */}
                    {fireLocationInfo && (
                      <div className="px-2 py-1.5 rounded bg-red-950/30 border border-red-500/30 text-[10px] text-red-200 flex flex-col gap-0.5 shadow-inner">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-red-300">Konum Koordinatı:</span>
                          <span className="font-mono text-red-100">
                            X:{fireLocationInfo.pos.x.toFixed(1)} Y:{fireLocationInfo.pos.y.toFixed(1)} Z:{fireLocationInfo.pos.z.toFixed(1)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-neutral-400">
                          <span>Mahal Alanı:</span>
                          <span className="font-mono text-neutral-200">{fireLocationInfo.areaM2.toFixed(1)} m²</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons: Yangını Başlat ve Tel Ali'yi Kurtar + Follow Cam */}
                <div className="flex flex-col gap-1.5 pt-0.5">
                  <button
                    onClick={handleStartEscape}
                    disabled={isEscaping}
                    className={`w-full py-1.5 px-2.5 rounded-md font-semibold text-[12px] flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                      isEscaping
                        ? 'bg-[var(--ui-surface-raised)] text-[var(--ui-warning)] border border-[var(--ui-warning)] cursor-not-allowed'
                        : 'bg-[var(--ui-danger)] hover:brightness-110 text-white border border-[var(--ui-danger)]'
                    }`}
                  >
                    <Flame size={14} className={isEscaping ? 'animate-bounce text-[var(--ui-warning)]' : ''} />
                    <span>{isEscaping ? 'Tahliye Sürüyor...' : "Yangını Başlat & Tel Ali'yi Kurtar"}</span>
                  </button>

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        const next = !followTelAli;
                        setFollowTelAli(next);
                        followTelAliRef.current = next;
                        if (telAliRef.current) {
                          telAliRef.current.setBadgeVisible(!next);
                          if (next && cameraRef.current) {
                            const currPos = telAliRef.current.group.position;
                            const heading = telAliRef.current.group.rotation.y;
                            const targetCam = new THREE.Vector3(
                              currPos.x - Math.sin(heading) * 4.8,
                              currPos.y + 2.4,
                              currPos.z - Math.cos(heading) * 4.8
                            );
                            const targetLook = currPos.clone().add(new THREE.Vector3(0, 1.1, 0));
                            cameraAnimRef.current = {
                              active: true,
                              startPos: cameraRef.current.position.clone(),
                              endPos: targetCam,
                              startTarget: cameraTargetRef.current.clone(),
                              endTarget: targetLook,
                              progress: 0,
                            };
                          }
                        }
                      }}
                      className={`flex-1 py-1 px-2 rounded text-[11px] font-medium flex items-center justify-center gap-1 border transition-all whitespace-nowrap ${
                        followTelAli
                          ? 'bg-[var(--ui-primary)] text-white border-[var(--ui-primary)]'
                          : 'btn btn-outline'
                      }`}
                    >
                      <Video size={13} />
                      <span>{followTelAli ? 'Takipte (3. Şahıs)' : "Tel Ali'yi Takip Et"}</span>
                    </button>

                    <button
                      onClick={() => handlePlaceTelAli()}
                      className="btn btn-outline text-[11px] py-1 px-2.5 flex items-center gap-1 shrink-0 whitespace-nowrap"
                      title="Kaçışı Durdur ve Başlangıç Konumuna Dön"
                    >
                      <RotateCcw size={13} /> Sıfırla
                    </button>
                  </div>
                </div>

                {/* State Machine Status & Route Inspection Toggle */}
                <div className="flex flex-col gap-1.5 pt-1.5 border-t border-[var(--ui-border)]/60">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--ui-text-muted)] font-medium">Durum:</span>
                    <span
                      className={`badge font-mono text-[11px] font-semibold py-0.5 px-2 ${
                        evacuationState === 'EVACUATED'
                          ? 'badge-success'
                          : evacuationState === 'EVACUATING'
                          ? 'badge-warning'
                          : evacuationState === 'ROUTE_READY'
                          ? 'badge-primary'
                          : evacuationState === 'PLACED'
                          ? 'badge-neutral'
                          : evacuationState === 'BLOCKED' || evacuationState === 'FAILED'
                          ? 'badge-danger'
                          : 'badge-neutral'
                      }`}
                    >
                      {evacuationState === 'EVACUATED'
                        ? '✓ GÜVENLİ TAHLİYE'
                        : evacuationState === 'EVACUATING'
                        ? '🏃 İLERLİYOR'
                        : evacuationState === 'ROUTE_READY'
                        ? `📍 ROTA HAZIR (${routeSummary?.distanceM ?? 0}m)`
                        : evacuationState === 'PLACED'
                        ? '📌 YERLEŞTİRİLDİ'
                        : evacuationState === 'BLOCKED'
                        ? `⛔ BLOKE (${evacuationErrorCode || 'ENGEL'})`
                        : evacuationState === 'FAILED'
                        ? `❌ BAŞARISIZ (${evacuationErrorCode || 'HATA'})`
                        : '⚪ HAZIR (IDLE)'}
                    </span>
                  </div>

                  {/* 3D Route & Portals Polyline Toggle */}
                  <button
                    onClick={() => setShowDebugRoute(!showDebugRoute)}
                    className="btn btn-outline w-full py-1 px-2 rounded text-[11px] font-mono flex items-center justify-between"
                    title="3B Rota Çizgisi, Kapı Eşikleri ve Merdiven İşaretleyicilerini Göster / Gizle"
                  >
                    <span className="text-[var(--ui-text-muted)]">3B Rota Geometrisi:</span>
                    <span className="font-bold text-[var(--ui-primary)]">{showDebugRoute ? 'GÖRÜNÜR' : 'GİZLİ'}</span>
                  </button>

                  {/* Error Banner when Stalled or Blocked */}
                  {evacuationErrorCode && (
                    <div className="bg-[var(--ui-surface-raised)] border border-[var(--ui-danger)] rounded p-1.5 text-[11px] text-[var(--ui-danger)] font-mono flex items-center gap-1.5">
                      <span className="font-bold">⚠️ HATA:</span>
                      <span className="font-mono bg-[var(--ui-surface)] px-1 py-0.5 rounded font-semibold">{evacuationErrorCode}</span>
                    </div>
                  )}
                </div>

                {/* Health / Safety Bar & Status Indicator */}
                <div className="flex flex-col gap-1 pt-1.5 border-t border-[var(--ui-border)]/60">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--ui-text)] font-medium flex items-center gap-1">
                      <ShieldAlert size={13} className={telAliHealth < 85 ? 'text-[var(--ui-warning)]' : 'text-[var(--ui-success)]'} />
                      Sağlık & Güvenlik
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        telAliHealth >= 85
                          ? 'text-[var(--ui-success)]'
                          : telAliHealth >= 50
                          ? 'text-[var(--ui-warning)]'
                          : 'text-[var(--ui-danger)]'
                      }`}
                    >
                      %{telAliHealth}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-[var(--ui-surface-raised)] rounded-full overflow-hidden border border-[var(--ui-border)]">
                    <div
                      className={`h-full transition-all duration-200 rounded-full ${
                        telAliHealth >= 85
                          ? 'bg-[var(--ui-success)]'
                          : telAliHealth >= 50
                          ? 'bg-[var(--ui-warning)]'
                          : 'bg-[var(--ui-danger)]'
                      }`}
                      style={{ width: `${telAliHealth}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[var(--ui-text-muted)] pt-0.5">
                    <span className="truncate pr-1">{telAliStatusText}</span>
                    {escapeDuration > 0 && (
                      <span className="font-mono text-[var(--ui-primary)] shrink-0 font-semibold whitespace-nowrap">
                        ⏱️ {escapeDuration.toFixed(1)}s
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* SAĞ STACK: ARAÇ ÇUBUKLARI (2 SATIR HALİNDE TEMİZ HİZALANMIŞ) */}
        <div className="flex flex-col items-end gap-1.5 pointer-events-auto ml-auto">
          {/* 1. Üst Toolbar: Açı, X-Ray, CAD Yayları, Kat İzolatörü, Oynatıcı */}
          <div className="hud-card p-1.5 rounded-lg flex flex-wrap items-center justify-end gap-1.5 shadow-lg text-[12px]">
            {/* Reset to Default Isometric View */}
            <button
              onClick={handleResetToIsometric}
              className="btn btn-outline btn-sm py-1 px-2.5 text-[12px] flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0"
              title="Varsayılan İzometrik Açıya Dön"
            >
              <Compass size={13} className="text-[var(--ui-primary)]" />
              <span>İzometrik Açı</span>
            </button>

            {/* X-Ray / Wireframe Mode Toggle */}
            <button
              onClick={toggleWireframe}
              className={`btn btn-sm py-1 px-2.5 text-[12px] flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0 ${
                isWireframe ? 'btn-primary' : 'btn-outline'
              }`}
              title="Duvarları şeffaf tel kafese (Wireframe) çevir"
            >
              <Box size={13} />
              <span>{isWireframe ? 'X-Ray Açık' : 'X-Ray / Tel Kafes'}</span>
            </button>

            {/* 2B/3B CAD Yayları & Kapı Açılımları Katmanı */}
            <button
              onClick={() => {
                const next = !showDoorArcs;
                setShowDoorArcs(next);
                if (onToggleDoorArcs) onToggleDoorArcs(next);
              }}
              className={`btn btn-sm py-1 px-2.5 text-[12px] flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0 ${
                showDoorArcs ? 'btn-primary' : 'btn-outline'
              }`}
              title="Kapı açılım yaylarını ve CAD eğri çizgilerini aç/kapat"
            >
              <RotateCcw size={13} className={showDoorArcs ? 'text-white' : 'text-cyan-400'} />
              <span>{showDoorArcs ? 'Yaylar Açık' : 'CAD Yayları'}</span>
            </button>

            {/* Kat İzolatörü Dropdown */}
            <div className="bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] rounded px-2 py-1 flex items-center gap-1.5 text-[12px] text-[var(--ui-text-muted)] shadow-sm shrink-0">
              <Layers size={13} className="text-[var(--ui-warning)] shrink-0" />
              <select
                value={internalFloor}
                onChange={(e) => {
                  const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                  handleFloorIsolate(val);
                }}
                className="bg-transparent border-none text-[var(--ui-text)] text-[12px] font-medium focus:outline-none cursor-pointer"
                title="Sadece seçilen katı gösterir, diğer katları gizler"
              >
                <option value="all" className="bg-[var(--ui-surface-raised)] text-[var(--ui-text)]">
                  🏢 Tüm Katlar
                </option>
                <option value="1" className="bg-[var(--ui-surface-raised)] text-[var(--ui-text)]">
                  Kat 1 (1. Kat)
                </option>
                <option value="0" className="bg-[var(--ui-surface-raised)] text-[var(--ui-text)]">
                  Kat 0 (Zemin)
                </option>
                <option value="-1" className="bg-[var(--ui-surface-raised)] text-[var(--ui-text)]">
                  Kat -1 (Bodrum)
                </option>
              </select>
            </div>

            {/* Mini Simulation Timeline Controls */}
            <div className="bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] rounded px-2 py-0.5 flex items-center gap-2 text-[12px] shadow-sm shrink-0">
              <button
                onClick={() => onTogglePlay && onTogglePlay(!isPlaying)}
                className="p-1 text-[var(--ui-text)] hover:text-[var(--ui-primary)] transition-colors shrink-0"
                title={isPlaying ? 'Tahliyeyi Durdur' : 'Tahliyeyi Oynat'}
              >
                {isPlaying ? <Pause size={13} /> : <Play size={13} />}
              </button>
              <input
                type="range"
                min={0}
                max={180}
                step={1}
                value={simulationTime}
                onChange={(e) => onSimulationTimeChange && onSimulationTimeChange(Number(e.target.value))}
                className="w-20 h-1.5 bg-[var(--ui-surface)] rounded appearance-none cursor-pointer accent-[var(--ui-primary)]"
                title={`Zaman: ${simulationTime.toFixed(0)}s`}
              />
              <span className="font-mono text-[11px] text-[var(--ui-text)] w-8 text-right font-semibold whitespace-nowrap">
                {simulationTime.toFixed(0)}s
              </span>
            </div>
          </div>

          {/* 2. Alt Toolbar: Orbit/Pan & 4-Corner Quick Navigator */}
          <div className="hud-card p-1 rounded-lg flex flex-wrap items-center justify-end gap-1.5 shadow-lg text-[12px]">
            {/* Active Tool Selector */}
            <div className="flex items-center bg-[var(--ui-surface-raised)] p-0.5 rounded border border-[var(--ui-border)] shrink-0">
              <button
                onClick={() => {
                  setActiveCadTool('orbit');
                  if (containerRef.current) containerRef.current.style.cursor = 'crosshair';
                }}
                className={`px-2 py-0.5 rounded flex items-center gap-1 text-[11px] font-mono transition-all whitespace-nowrap shrink-0 ${
                  activeCadTool === 'orbit'
                    ? 'bg-[var(--ui-primary)] text-white font-semibold shadow-sm'
                    : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
                }`}
                title="3B Döndürme (Orbit): Sol Tık ile çevirin"
              >
                <RotateCcw size={12} />
                <span>Orbit</span>
              </button>
              <button
                onClick={() => {
                  setActiveCadTool('pan');
                  if (containerRef.current) containerRef.current.style.cursor = 'grab';
                }}
                className={`px-2 py-0.5 rounded flex items-center gap-1 text-[11px] font-mono transition-all whitespace-nowrap shrink-0 ${
                  activeCadTool === 'pan'
                    ? 'bg-[var(--ui-primary)] text-white font-semibold shadow-sm'
                    : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
                }`}
                title="AutoCAD Pan (Kaydırma): Orta Tuş veya Sağ Tık"
              >
                <Hand size={12} />
                <span>Pan</span>
              </button>
            </div>

            <div className="h-4 w-[1px] bg-[var(--ui-border)] mx-0.5 hidden sm:block" />

            {/* 4-Corner Quick Navigator */}
            <span className="text-[11px] uppercase font-mono text-[var(--ui-text-muted)] font-medium pl-0.5 hidden md:inline whitespace-nowrap">
              Köşeler:
            </span>
            <button
              onClick={() => handleFocusCorner('NW')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all whitespace-nowrap shrink-0 ${
                activeCorner === 'NW'
                  ? 'bg-[var(--ui-primary)] text-white font-semibold'
                  : 'btn btn-outline py-0.5 px-2'
              }`}
              title="Kuzey-Batı Köşesi: Yangın Merdiveni 1 ve Yangın Kaçış Çekirdeği"
            >
              ↖ KB
            </button>
            <button
              onClick={() => handleFocusCorner('NE')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all whitespace-nowrap shrink-0 ${
                activeCorner === 'NE'
                  ? 'bg-[var(--ui-primary)] text-white font-semibold'
                  : 'btn btn-outline py-0.5 px-2'
              }`}
              title="Kuzey-Doğu Köşesi: 2. Şaft & Otopark"
            >
              ↗ KD
            </button>
            <button
              onClick={() => handleFocusCorner('SW')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all whitespace-nowrap shrink-0 ${
                activeCorner === 'SW'
                  ? 'bg-[var(--ui-primary)] text-white font-semibold'
                  : 'btn btn-outline py-0.5 px-2'
              }`}
              title="Güney-Batı Köşesi: Daire 1"
            >
              ↙ GB
            </button>
            <button
              onClick={() => handleFocusCorner('SE')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all whitespace-nowrap shrink-0 ${
                activeCorner === 'SE'
                  ? 'bg-[var(--ui-primary)] text-white font-semibold'
                  : 'btn btn-outline py-0.5 px-2'
              }`}
              title="Güney-Doğu Köşesi: Daire 2"
            >
              ↘ GD
            </button>
            <button
              onClick={() => handleFocusCorner('CENTER')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all whitespace-nowrap shrink-0 ${
                activeCorner === 'CENTER'
                  ? 'bg-[var(--ui-primary)] text-white font-semibold'
                  : 'btn btn-outline py-0.5 px-2'
              }`}
              title="AutoCAD Zoom Extents: Tüm binayı kadraja tam sığdır"
            >
              🎯 Tüm Yapı
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          HOVER TOOLTIP (HUD BİLGİ KARTI: RAYCASTING)
      ========================================================================= */}
      {hoveredRoom && (
        <div
          className="fixed z-50 pointer-events-none transition-transform duration-75"
          style={{
            left: Math.min(window.innerWidth - 300, hoveredRoom.x + 18),
            top: Math.min(window.innerHeight - 200, hoveredRoom.y + 18),
          }}
        >
          <div className="bg-[var(--ui-surface)] border border-[var(--ui-border)] p-3.5 text-[13px] w-72 shadow-xl rounded-lg flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-[var(--ui-border)] pb-2">
              <span className="font-semibold text-[var(--ui-text)] text-[14px] truncate">
                {hoveredRoom.name}
              </span>
              <span className="badge badge-neutral font-mono text-[12px]">
                Kat {hoveredRoom.floor_level}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[12px] pt-0.5">
              <div>
                <span className="text-[var(--ui-text-muted)] block text-[12px]">Net Alan:</span>
                <span className="font-mono font-semibold text-[var(--ui-text)]">
                  {hoveredRoom.area_m2 > 0 ? `${hoveredRoom.area_m2.toFixed(1)} m²` : 'Bilinmiyor'}
                </span>
              </div>
              <div>
                <span className="text-[var(--ui-text-muted)] block text-[12px]">Anlık Sıcaklık:</span>
                <span
                  className={`font-mono font-semibold ${
                    hoveredRoom.temp_c > 60 ? 'text-[var(--ui-danger)]' : 'text-[var(--ui-success)]'
                  }`}
                >
                  {hoveredRoom.temp_c} °C
                </span>
              </div>
            </div>

            <div className="border-t border-[var(--ui-border)] pt-2 flex flex-col gap-1.5">
              <div>
                <span className="text-[var(--ui-text-muted)] block text-[12px]">ASET / RSET Durumu:</span>
                <span
                  className={`text-[12px] font-medium flex items-center gap-1.5 ${
                    hoveredRoom.temp_c > 100 ? 'text-[var(--ui-danger)]' : 'text-[var(--ui-success)]'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      hoveredRoom.temp_c > 100 ? 'bg-[var(--ui-danger)]' : 'bg-[var(--ui-success)]'
                    }`}
                  />
                  {hoveredRoom.aset_status}
                </span>
              </div>

              <div>
                <span className="text-[var(--ui-text-muted)] block text-[12px]">Yönetmelik / İhlal Notu:</span>
                <span className="text-[12px] text-[var(--ui-text)] leading-snug">
                  {hoveredRoom.violation}
                </span>
              </div>
            </div>

            <div className="text-[12px] text-[var(--ui-text-muted)] pt-1.5 border-t border-[var(--ui-border)] flex items-center justify-between font-mono">
              <span>Sol Tık: Odaya Odaklan</span>
              <span>LOD300</span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CELEBRATION MODAL ("TEBRİKLER TEL ALİ KURTULDU!")
      ========================================================================= */}
      {showCelebrationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="card p-6 max-w-md w-full border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-2xl rounded-xl flex flex-col items-center text-center gap-4 relative">
            {/* Trophy Icon */}
            <div className="w-14 h-14 rounded-xl bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] flex items-center justify-center text-3xl shadow-md">
              🎉
            </div>

            <div>
              <div className="flex items-center justify-center gap-1.5 text-[var(--ui-success)] font-mono text-[13px] font-semibold uppercase tracking-wider">
                <Sparkles size={15} /> Tahliye Simülasyonu Başarılı
              </div>
              <h2 className="text-xl font-bold text-[var(--ui-text)] mt-1.5">
                Tel Ali Güvenli Tahliye Edildi
              </h2>
              <p className="text-[13px] text-[var(--ui-text-muted)] mt-1">
                Zemin Kat Dış Çıkış Kapısına (<span className="font-mono text-[var(--ui-primary)]">K0_dis_cikis</span>) başarıyla ulaşıldı.
              </p>
            </div>

            {/* Performance Stats Cards */}
            <div className="grid grid-cols-2 gap-3 w-full">
              <div className="bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] rounded-lg p-3 text-left">
                <span className="text-[12px] text-[var(--ui-text-muted)] block">Tahliye Süresi:</span>
                <span className="text-xl font-mono font-bold text-[var(--ui-text)]">
                  {escapeDuration} sn
                </span>
                <span className="text-[12px] text-[var(--ui-success)] block font-medium">✓ RSET &lt; ASET (180s)</span>
              </div>

              <div className="bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] rounded-lg p-3 text-left">
                <span className="text-[12px] text-[var(--ui-text-muted)] block">Kalan Can / Sağlık:</span>
                <span className="text-xl font-mono font-bold text-[var(--ui-success)]">
                  %{telAliHealth}
                </span>
                <span className="text-[12px] text-[var(--ui-text-muted)] block">Duman soluma güvenli</span>
              </div>
            </div>

            {/* Path details */}
            <div className="w-full bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] rounded-lg p-3 text-left text-[13px] flex flex-col gap-1.5">
              <span className="text-[12px] font-mono uppercase text-[var(--ui-text-muted)] flex items-center gap-1.5 font-semibold">
                <CheckCircle2 size={14} className="text-[var(--ui-success)]" /> İzlenen Güvenli Rota:
              </span>
              <span className="text-[13px] text-[var(--ui-text)]">
                Oda ➔ Kat Koridoru ➔ Yangın Güvenlik Holü ➔ Duman Basınçlı Yangın Merdiveni ➔ Zemin Dış Çıkış
              </span>
              <span className="text-[12px] text-[var(--ui-primary)] font-mono pt-1">
                ✓ BYKHY Madde 31-34 (Kaçış Yolları) ve Madde 62 Standartlarına Tam Uyumlu
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 w-full pt-1">
              <button
                onClick={() => {
                  setShowCelebrationModal(false);
                  handlePlaceTelAli();
                }}
                className="btn btn-primary flex-1 py-2 px-3 text-[13px]"
              >
                Yeniden Konumlandır
              </button>
              <button
                onClick={() => setShowCelebrationModal(false)}
                className="btn btn-outline py-2 px-4 text-[13px]"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default ThreeScene;
