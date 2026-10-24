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
  cadDiffMode: 'before' | 'after' | 'both';
  onSelectElement: (element: { id: string; type: 'room' | 'door' | 'violation'; details: any }) => void;
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
  const particlesGroupRef = useRef<THREE.Group | null>(null);
  const mouseRef = useRef(new THREE.Vector2());
  const raycasterRef = useRef(new THREE.Raycaster());

  // Orbit control internal state
  const isDraggingRef = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const cameraTargetRef = useRef(new THREE.Vector3(10, 2, 7));

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070A11);
    scene.fog = new THREE.FogExp2(0x070A11, 0.008);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(38, 32, 40);
    camera.lookAt(cameraTargetRef.current);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00F0FF, 1.2);
    dirLight.position.set(40, 60, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const warmLight = new THREE.DirectionalLight(0xF59E0B, 0.6);
    warmLight.position.set(-30, 40, -20);
    scene.add(warmLight);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(80, 80, 0x00F0FF, 0x1E293B);
    gridHelper.position.y = -3.5;
    scene.add(gridHelper);

    // Groups
    const buildingGroup = new THREE.Group();
    scene.add(buildingGroup);
    buildingGroupRef.current = buildingGroup;

    const ragGroup = new THREE.Group();
    scene.add(ragGroup);
    ragGroupRef.current = ragGroup;

    const smokeGroup = new THREE.Group();
    scene.add(smokeGroup);
    smokeGroupRef.current = smokeGroup;

    const particlesGroup = new THREE.Group();
    scene.add(particlesGroup);
    particlesGroupRef.current = particlesGroup;

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smoke Layer Pulsing & Particle float
      if (smokeGroupRef.current) {
        smokeGroupRef.current.children.forEach((child) => {
          if (child instanceof THREE.Mesh && child.name === 'fire_origin') {
            const scale = 1.0 + Math.sin(elapsedTime * 6) * 0.15;
            child.scale.set(scale, scale, scale);
          }
        });
      }

      // Egress Particles along escape corridors
      if (particlesGroupRef.current) {
        particlesGroupRef.current.children.forEach((p, idx) => {
          if (p instanceof THREE.Mesh) {
            p.position.x = ((p.position.x + 0.05 + idx * 0.005) % 20);
          }
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    // Mouse Interaction Handlers
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
        // Orbit rotate
        const rotSpeed = 0.005;
        const offset = camera.position.clone().sub(cameraTargetRef.current);
        const radius = offset.length();
        let theta = Math.atan2(offset.x, offset.z);
        let phi = Math.acos(Math.max(0.01, Math.min(0.99, offset.y / radius)));

        theta -= deltaX * rotSpeed;
        phi -= deltaY * rotSpeed;
        phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, phi));

        offset.x = radius * Math.sin(phi) * Math.sin(theta);
        offset.y = radius * Math.cos(phi);
        offset.z = radius * Math.sin(phi) * Math.cos(theta);

        camera.position.copy(cameraTargetRef.current).add(offset);
        camera.lookAt(cameraTargetRef.current);
      } else if (e.buttons === 2) {
        // Pan
        const panSpeed = 0.03;
        const right = new THREE.Vector3().crossVectors(camera.up, camera.getWorldDirection(new THREE.Vector3())).normalize();
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
      const newDist = Math.max(5, Math.min(180, dist + e.deltaY * zoomSpeed));
      camera.position.copy(cameraTargetRef.current).addScaledVector(dir, newDist);
    };

    const handleClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      if (buildingGroupRef.current) {
        const intersects = raycasterRef.current.intersectObjects(buildingGroupRef.current.children, true);
        if (intersects.length > 0) {
          const hit = intersects[0].object;
          if (hit.userData && hit.userData.id) {
            onSelectElement({
              id: hit.userData.id,
              type: hit.userData.type || 'room',
              details: hit.userData,
            });
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

  // Update Camera Preset
  useEffect(() => {
    if (!cameraRef.current) return;
    const cam = cameraRef.current;
    if (cameraPreset === 'isometric') {
      cam.position.set(40, 36, 42);
      cameraTargetRef.current.set(10, 2, 7);
    } else if (cameraPreset === 'top_down') {
      cam.position.set(10, 75, 7.01);
      cameraTargetRef.current.set(10, 0, 7);
    } else if (cameraPreset === 'side_elevation') {
      cam.position.set(55, 6, 7);
      cameraTargetRef.current.set(10, 4, 7);
    } else if (cameraPreset === 'first_person') {
      cam.position.set(3, 1.8, 3);
      cameraTargetRef.current.set(16, 1.8, 7);
    }
    cam.lookAt(cameraTargetRef.current);
  }, [cameraPreset]);

  // Color mappings
  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'dis_cikis': return 0x22C55E; // Emerald
      case 'yangin_holu': return 0x10B981; // Teal
      case 'yangin_merdiveni': return 0x06B6D4; // Cyan
      case 'kat_koridoru': return 0x3B82F6; // Blue
      case 'siginak':
      case 'otopark': return 0x8B5CF6; // Violet
      case 'salon':
      case 'oda':
      case 'mutfak': return 0x475569; // Slate
      default: return 0x334155;
    }
  };

  // Build / Rebuild 3D Model
  useEffect(() => {
    if (!buildingGroupRef.current || !ragGroupRef.current || !smokeGroupRef.current) return;
    const bGroup = buildingGroupRef.current;
    const rGroup = ragGroupRef.current;
    const sGroup = smokeGroupRef.current;
    const pGroup = particlesGroupRef.current;

    // Clear old children
    while (bGroup.children.length > 0) bGroup.remove(bGroup.children[0]);
    while (rGroup.children.length > 0) rGroup.remove(rGroup.children[0]);
    while (sGroup.children.length > 0) sGroup.remove(sGroup.children[0]);
    if (pGroup) while (pGroup.children.length > 0) pGroup.remove(pGroup.children[0]);

    // Floor parameters
    const floorLevels = data?.floors_analyzed && data.floors_analyzed.length > 0 ? data.floors_analyzed : [-1, 0, 1];
    const floorHeight = 3.2 * explodedZ;
    const wallH = wallHeightMode === 'full' ? 2.8 : wallHeightMode === 'cut' ? 1.1 : 0.1;

    // Room Layout Template per floor
    floorLevels.forEach((floor) => {
      const isFloorActive = activeFloor === 'all' || activeFloor === floor;
      const floorY = floor * floorHeight;
      const opacity = isFloorActive ? 1.0 : 0.12;

      // Sample room set for floor
      const floorRooms = [
        { id: `K${floor}_oda_1`, name: `Salon A (Kat ${floor})`, x: 0, z: 0, w: 6, d: 5, cat: 'oda' },
        { id: `K${floor}_oda_2`, name: `Oda B (Kat ${floor})`, x: 0, z: 5, w: 6, d: 4, cat: 'oda' },
        { id: `K${floor}_koridor`, name: `Kat Koridoru`, x: 6, z: 0, w: 4, d: 9, cat: 'kat_koridoru' },
        { id: `K${floor}_yangin_holu`, name: `Yangın Güvenlik Holü`, x: 10, z: 0, w: 4, d: 4, cat: 'yangin_holu' },
        { id: `K${floor}_merdiven`, name: `Yangın Merdiveni`, x: 10, z: 4, w: 4, d: 5, cat: 'yangin_merdiveni' },
        { id: `K${floor}_asansor`, name: `Asansör Şaftı`, x: 14, z: 4, w: 3, d: 5, cat: 'dikey_cekirdek' },
      ];

      if (floor === 0) {
        floorRooms.push({ id: `K0_dis_cikis`, name: `Ana Tahliye Çıkışı`, x: 14, z: 0, w: 4, d: 4, cat: 'dis_cikis' });
      } else if (floor === -1) {
        floorRooms.push(
          { id: `K-1_siginak`, name: `Sığınak Alanı`, x: 14, z: 0, w: 5, d: 4, cat: 'siginak' },
          { id: `K-1_otopark`, name: `Kapalı Otopark`, x: 0, z: 9, w: 19, d: 5, cat: 'otopark' }
        );
      }

      // Render Floor Slab
      const slabGeo = new THREE.BoxGeometry(22, 0.2, 16);
      const slabMat = new THREE.MeshStandardMaterial({
        color: isFloorActive ? 0x0F172A : 0x070A11,
        roughness: 0.8,
        metalness: 0.2,
        transparent: !isFloorActive,
        opacity: opacity * 0.8,
      });
      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.position.set(9.5, floorY - 0.1, 7);
      slab.receiveShadow = true;
      bGroup.add(slab);

      // Render Floor Level Label Indicator
      const floorMarkerGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
      const floorMarkerMat = new THREE.MeshBasicMaterial({ color: isFloorActive ? 0x00F0FF : 0x334155 });
      const floorMarker = new THREE.Mesh(floorMarkerGeo, floorMarkerMat);
      floorMarker.position.set(-2, floorY, 0);
      bGroup.add(floorMarker);

      // Render Rooms
      floorRooms.forEach((rm) => {
        const roomColor = getCategoryColor(rm.cat);
        const roomGeo = new THREE.BoxGeometry(rm.w - 0.2, wallH, rm.d - 0.2);
        const roomMat = new THREE.MeshStandardMaterial({
          color: roomColor,
          roughness: 0.4,
          metalness: 0.3,
          transparent: true,
          opacity: isFloorActive ? 0.75 : 0.08,
          wireframe: !isFloorActive,
        });

        const roomMesh = new THREE.Mesh(roomGeo, roomMat);
        roomMesh.position.set(rm.x + rm.w / 2, floorY + wallH / 2, rm.z + rm.d / 2);
        roomMesh.castShadow = isFloorActive;
        roomMesh.receiveShadow = isFloorActive;
        roomMesh.userData = { id: rm.id, name: rm.name, type: 'room', floor: floor, category: rm.cat };
        bGroup.add(roomMesh);

        // Room wireframe contour edge highlight
        const edges = new THREE.EdgesGeometry(roomGeo);
        const lineMat = new THREE.LineBasicMaterial({
          color: isFloorActive ? (rm.cat === 'yangin_holu' ? 0x10B981 : rm.cat === 'dis_cikis' ? 0x22C55E : 0x00F0FF) : 0x1E293B,
          linewidth: 1.5,
          transparent: true,
          opacity: isFloorActive ? 0.9 : 0.15,
        });
        const wireframe = new THREE.LineSegments(edges, lineMat);
        wireframe.position.copy(roomMesh.position);
        bGroup.add(wireframe);

        // 3D RAG Spatial Overlay Node
        if (showRAGOverlay && isFloorActive) {
          const nodeGeo = new THREE.SphereGeometry(0.35, 16, 16);
          const nodeMat = new THREE.MeshBasicMaterial({ color: roomColor });
          const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
          nodeMesh.position.set(rm.x + rm.w / 2, floorY + 1.2, rm.z + rm.d / 2);
          rGroup.add(nodeMesh);

          // Corridor links to central corridor
          if (rm.cat !== 'kat_koridoru') {
            const linePoints = [
              nodeMesh.position,
              new THREE.Vector3(8, floorY + 1.2, 4.5),
            ];
            const linkGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
            const linkMat = new THREE.LineDashedMaterial({ color: 0x00F0FF, dashSize: 0.4, gapSize: 0.2 });
            const linkLine = new THREE.Line(linkGeo, linkMat);
            linkLine.computeLineDistances();
            rGroup.add(linkLine);
          }
        }
      });

      // Doors and Evacuation Bottlenecks
      const floorDoors = [
        { id: `D_${floor}_1`, name: `Oda-Koridor Kapısı`, x: 6, z: 2.5, w: 0.9, isBottleneck: false },
        { id: `D_${floor}_yangin_holu`, name: `Hol Yangın Kapısı`, x: 10, z: 2, w: 0.9, isBottleneck: true, queue: 14 },
        { id: `D_${floor}_merdiven`, name: `Yangın Merdiveni Kapısı`, x: 12, z: 4, w: 1.0, isBottleneck: true, queue: 8 },
      ];

      floorDoors.forEach((door) => {
        const isViolated = (door.id.includes('merdiven') && floor === -1) || (cadDiffMode === 'before' && door.isBottleneck);
        const isOptimized = cadDiffMode === 'after' && door.isBottleneck;

        const doorColor = isViolated
          ? 0xEF4444 // Red violation
          : isOptimized
          ? 0x00FF88 // Neon green
          : door.isBottleneck && showBottlenecks
          ? 0xF59E0B // Amber
          : 0x10B981; // Green

        const doorGeo = new THREE.BoxGeometry(0.3, wallH * 0.9, 1.2);
        const doorMat = new THREE.MeshStandardMaterial({
          color: doorColor,
          emissive: doorColor,
          emissiveIntensity: (isViolated || isOptimized) ? 0.6 : 0.2,
          transparent: true,
          opacity: isFloorActive ? 0.9 : 0.1,
        });

        const doorMesh = new THREE.Mesh(doorGeo, doorMat);
        doorMesh.position.set(door.x, floorY + (wallH * 0.9) / 2, door.z);
        doorMesh.userData = { id: door.id, name: door.name, type: 'door', floor: floor, queue: door.queue };
        bGroup.add(doorMesh);

        // Bottleneck Queue Halo / Revcloud indicator
        if (showBottlenecks && door.isBottleneck && isFloorActive) {
          const ringGeo = new THREE.RingGeometry(0.8, 1.3, 24);
          const ringMat = new THREE.MeshBasicMaterial({
            color: isViolated ? 0xEF4444 : isOptimized ? 0x00FF88 : 0xF59E0B,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.65,
          });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(door.x, floorY + 0.1, door.z);
          bGroup.add(ring);
        }
      });
    });

    // Vertical Core Connections (Yangın Merdiveni & Asansör Şaftı Kolonları)
    if (showRAGOverlay) {
      const bottomY = Math.min(...floorLevels) * floorHeight;
      const topY = Math.max(...floorLevels) * floorHeight + 2.8;

      const shaftGeo = new THREE.CylinderGeometry(0.4, 0.4, topY - bottomY, 16);
      const shaftMat = new THREE.MeshBasicMaterial({ color: 0x06B6D4, transparent: true, opacity: 0.45, wireframe: true });
      const stairShaft = new THREE.Mesh(shaftGeo, shaftMat);
      stairShaft.position.set(12, (topY + bottomY) / 2, 6.5);
      rGroup.add(stairShaft);
    }

    // Two-Zone Smoke Descent Layer
    if (showSmoke) {
      const activeSmokeFloor = 0; // Fire originating on ground floor
      const fireY = activeSmokeFloor * floorHeight;

      // Volumetric Fire Source Sphere
      const fireGeo = new THREE.SphereGeometry(1.2, 16, 16);
      const fireMat = new THREE.MeshBasicMaterial({ color: 0xFF5722, transparent: true, opacity: 0.85 });
      const fireMesh = new THREE.Mesh(fireGeo, fireMat);
      fireMesh.name = 'fire_origin';
      fireMesh.position.set(3, fireY + 1.2, 3);
      sGroup.add(fireMesh);

      // Smoke Layer Descent: at t=0 layer is at 2.8m, by t=120s down to 1.1m
      const descentFactor = Math.min(1.0, simulationTime / 120.0);
      const currentLayerH = 2.8 - descentFactor * 1.7; // down to 1.1m

      const smokeGeo = new THREE.BoxGeometry(22, 2.8 - currentLayerH, 16);
      const smokeMat = new THREE.MeshStandardMaterial({
        color: simulationTime > 75 ? 0x7F1D1D : 0x1E293B, // Turns dark red if past ASET
        transparent: true,
        opacity: Math.min(0.85, 0.35 + descentFactor * 0.4),
        roughness: 0.9,
      });
      const smokeLayer = new THREE.Mesh(smokeGeo, smokeMat);
      smokeLayer.position.set(9.5, fireY + 2.8 - (2.8 - currentLayerH) / 2, 7);
      sGroup.add(smokeLayer);
    }

  }, [data, activeFloor, explodedZ, wallHeightMode, simulationTime, showSmoke, showRAGOverlay, showBottlenecks, cadDiffMode]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-slate-950">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      
      {/* 3D Viewport HUD Floating Overlays */}
      <div className="absolute top-4 left-4 flex flex-wrap gap-2 pointer-events-auto">
        <div className="glass-panel px-3 py-1.5 flex items-center gap-2 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-gray-300">3B WebGL: Three.js v0.183</span>
          <span className="text-gray-500">|</span>
          <span className="text-cyan-400">Kat: {activeFloor === 'all' ? 'TÜMÜ' : `KAT ${activeFloor}`}</span>
        </div>

        {showSmoke && (
          <div className={`glass-panel px-3 py-1.5 flex items-center gap-2 text-xs font-mono ${simulationTime > 75 ? 'pulse-violation bg-red-950/40 text-red-400' : 'text-amber-400'}`}>
            <span>🔥 Yangın T: {simulationTime.toFixed(1)}s</span>
            <span>|</span>
            <span>Duman Katmanı: {(2.8 - Math.min(1.0, simulationTime / 120.0) * 1.7).toFixed(2)}m</span>
            {simulationTime > 75 && <span className="font-bold text-red-500 animate-bounce">[ASET AŞILDI!]</span>}
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
