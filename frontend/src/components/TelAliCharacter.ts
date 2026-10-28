import * as THREE from 'three';

/**
 * Tel Ali Stylized 3D Low-Poly Character
 * Features:
 * - High-vis safety jacket with reflective stripes
 * - Construction helmet (baret) with safety visor
 * - Limb rotation pivots for realistic running cycle
 * - Overhead dynamic canvas sprite with health bar and status text
 */
export class TelAliCharacter {
  public group: THREE.Group;
  public leftLeg: THREE.Group;
  public rightLeg: THREE.Group;
  public leftArm: THREE.Group;
  public rightArm: THREE.Group;
  public body: THREE.Mesh;
  public head: THREE.Group;
  private badgeCanvas: HTMLCanvasElement;
  private badgeTexture: THREE.CanvasTexture;
  public badgeSprite: THREE.Sprite;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'tel_ali_character';

    // 1. Torso (High-Vis Safety Orange)
    const torsoGeo = new THREE.BoxGeometry(0.50, 0.68, 0.30);
    const torsoMat = new THREE.MeshStandardMaterial({
      color: 0xF59E0B, // High-Vis Orange
      roughness: 0.35,
      metalness: 0.15,
    });
    this.body = new THREE.Mesh(torsoGeo, torsoMat);
    this.body.position.y = 0.78;
    this.body.castShadow = true;
    this.group.add(this.body);

    // Reflective safety stripe on torso
    const stripeGeo = new THREE.BoxGeometry(0.52, 0.12, 0.32);
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xF8FAFC,
      emissive: 0x38BDF8,
      emissiveIntensity: 0.45,
    });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.y = 0.78;
    this.group.add(stripe);

    // 2. Head Group (Skin tone + Eyes + Construction Helmet)
    this.head = new THREE.Group();
    this.head.position.y = 1.30;

    // Head sphere
    const headGeo = new THREE.SphereGeometry(0.22, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xFED7AA, // Skin tone
      roughness: 0.55,
    });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.castShadow = true;
    this.head.add(headMesh);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.038, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0F172A });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.075, 0.04, 0.20);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.075, 0.04, 0.20);
    this.head.add(leftEye, rightEye);

    // Cute Smile Line
    const mouthGeo = new THREE.BoxGeometry(0.08, 0.02, 0.02);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x991B1B });
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.position.set(0, -0.06, 0.21);
    this.head.add(mouth);

    // Glowing Yellow Safety Helmet (Baret)
    const hatGeo = new THREE.CylinderGeometry(0.25, 0.26, 0.14, 16);
    const hatMat = new THREE.MeshStandardMaterial({
      color: 0xFBBF24, // Bright Safety Yellow
      emissive: 0xD97706,
      emissiveIntensity: 0.3,
      roughness: 0.25,
    });
    const hatMesh = new THREE.Mesh(hatGeo, hatMat);
    hatMesh.position.y = 0.17;
    const brimGeo = new THREE.CylinderGeometry(0.30, 0.30, 0.03, 16);
    const brimMesh = new THREE.Mesh(brimGeo, hatMat);
    brimMesh.position.y = 0.11;
    this.head.add(hatMesh, brimMesh);

    this.group.add(this.head);

    // 3. Legs with Hip Pivots
    const legGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.52, 8);
    legGeo.translate(0, -0.26, 0); // Pivot at top (hip)
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1E3A8A, roughness: 0.65 }); // Denim blue
    const bootGeo = new THREE.BoxGeometry(0.14, 0.14, 0.20);
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x18181B, roughness: 0.85 }); // Black work boots

    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.16, 0.48, 0);
    const leftLegMesh = new THREE.Mesh(legGeo, legMat);
    leftLegMesh.castShadow = true;
    const leftBoot = new THREE.Mesh(bootGeo, bootMat);
    leftBoot.position.set(0, -0.50, 0.05);
    this.leftLeg.add(leftLegMesh, leftBoot);
    this.group.add(this.leftLeg);

    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.16, 0.48, 0);
    const rightLegMesh = new THREE.Mesh(legGeo, legMat);
    rightLegMesh.castShadow = true;
    const rightBoot = new THREE.Mesh(bootGeo, bootMat);
    rightBoot.position.set(0, -0.50, 0.05);
    this.rightLeg.add(rightLegMesh, rightBoot);
    this.group.add(this.rightLeg);

    // 4. Arms with Shoulder Pivots
    const armGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.46, 8);
    armGeo.translate(0, -0.23, 0); // Pivot at shoulder
    const armMat = new THREE.MeshStandardMaterial({ color: 0xF59E0B, roughness: 0.45 }); // High-vis orange sleeve

    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.32, 1.05, 0);
    const leftArmMesh = new THREE.Mesh(armGeo, armMat);
    leftArmMesh.castShadow = true;
    this.leftArm.add(leftArmMesh);
    this.group.add(this.leftArm);

    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.32, 1.05, 0);
    const rightArmMesh = new THREE.Mesh(armGeo, armMat);
    rightArmMesh.castShadow = true;
    this.rightArm.add(rightArmMesh);
    this.group.add(this.rightArm);

    // 5. Overhead Dynamic Status Badge (Sprite)
    this.badgeCanvas = document.createElement('canvas');
    this.badgeCanvas.width = 256;
    this.badgeCanvas.height = 128;
    this.badgeTexture = new THREE.CanvasTexture(this.badgeCanvas);
    const badgeMat = new THREE.SpriteMaterial({
      map: this.badgeTexture,
      transparent: true,
      depthTest: true,
    });
    this.badgeSprite = new THREE.Sprite(badgeMat);
    this.badgeSprite.scale.set(1.4, 0.7, 1);
    this.badgeSprite.position.set(0, 2.15, 0);
    this.group.add(this.badgeSprite);

    this.updateBadge(100, 'Güvenli Bölge');
  }

  public setBadgeVisible(visible: boolean) {
    this.badgeSprite.visible = visible;
  }

  public updateBadge(health: number, statusText: string) {
    const ctx = this.badgeCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 128);

    // Background pill with blur glow border
    ctx.fillStyle = 'rgba(10, 15, 30, 0.92)';
    ctx.beginPath();
    ctx.roundRect(10, 10, 236, 108, 16);
    ctx.fill();

    ctx.lineWidth = 3.5;
    ctx.strokeStyle =
      health > 65 ? '#10B981' : health > 30 ? '#F59E0B' : '#EF4444';
    ctx.stroke();

    // Name label
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏃 TEL ALİ', 128, 42);

    // Status Text
    ctx.fillStyle =
      health > 65 ? '#34D399' : health > 30 ? '#FBBF24' : '#F87171';
    ctx.font = 'bold 15px sans-serif';
    const cleanStatus = statusText.length > 22 ? statusText.slice(0, 20) + '...' : statusText;
    ctx.fillText(cleanStatus, 128, 68);

    // Health Bar
    const barW = 190;
    const barH = 12;
    const barX = (256 - barW) / 2;
    const barY = 82;
    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 6);
    ctx.fill();

    const clampedHealth = Math.max(0, Math.min(100, health));
    ctx.fillStyle =
      clampedHealth > 65 ? '#10B981' : clampedHealth > 30 ? '#F59E0B' : '#EF4444';
    ctx.beginPath();
    ctx.roundRect(barX, barY, (barW * clampedHealth) / 100, barH, 6);
    ctx.fill();

    this.badgeTexture.needsUpdate = true;
  }

  public animateRun(time: number, isMoving: boolean) {
    if (isMoving) {
      const swing = Math.sin(time * 15) * 0.85;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing * 0.9;
      this.rightArm.rotation.x = swing * 0.9;
      const bob = Math.abs(Math.sin(time * 15)) * 0.10;
      this.body.position.y = 0.78 + bob;
      this.head.position.y = 1.30 + bob;
    } else {
      // Idle breathing
      const breath = Math.sin(time * 3) * 0.02;
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      this.leftArm.rotation.x = 0;
      this.rightArm.rotation.x = 0;
      this.body.position.y = 0.78 + breath;
      this.head.position.y = 1.30 + breath;
    }
  }
}

/**
 * Confetti & Fireworks 3D Particle System for Successful Escape Celebration
 */
export class CelebrationParticleSystem {
  public group: THREE.Group;
  private particles: {
    mesh: THREE.Mesh;
    vx: number;
    vy: number;
    vz: number;
    vRotX: number;
    vRotY: number;
  }[] = [];
  public active: boolean = false;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'celebration_fireworks';
    const colors = [0x00F0FF, 0x10B981, 0xFBBF24, 0xF43F5E, 0x8B5CF6, 0x38BDF8, 0xFFFFFF];
    const geo = new THREE.BoxGeometry(0.20, 0.20, 0.05);

    for (let i = 0; i < 110; i++) {
      const col = colors[i % colors.length];
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 0.6,
        roughness: 0.3,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.particles.push({
        mesh,
        vx: 0,
        vy: 0,
        vz: 0,
        vRotX: 0.1,
        vRotY: 0.1,
      });
    }
  }

  public burst(origin: THREE.Vector3) {
    this.active = true;
    this.particles.forEach((p) => {
      p.mesh.visible = true;
      p.mesh.position.copy(origin).add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 1.2,
          Math.random() * 0.6,
          (Math.random() - 0.5) * 1.2
        )
      );
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.08 + Math.random() * 0.18;
      p.vx = Math.cos(angle) * speed;
      p.vy = 0.22 + Math.random() * 0.30; // Upward fountain burst
      p.vz = Math.sin(angle) * speed;
      p.vRotX = (Math.random() - 0.5) * 0.3;
      p.vRotY = (Math.random() - 0.5) * 0.3;
    });
  }

  public update() {
    if (!this.active) return;
    let anyVisible = false;
    this.particles.forEach((p) => {
      if (!p.mesh.visible) return;
      anyVisible = true;
      p.mesh.position.x += p.vx;
      p.mesh.position.y += p.vy;
      p.mesh.position.z += p.vz;
      p.vy -= 0.007; // Gravity pull
      p.mesh.rotation.x += p.vRotX;
      p.mesh.rotation.y += p.vRotY;

      // When falling below ground, recycle or hide
      if (p.mesh.position.y < -0.8) {
        p.mesh.visible = false;
      }
    });

    if (!anyVisible) {
      this.active = false;
    }
  }

  public reset() {
    this.active = false;
    this.particles.forEach((p) => {
      p.mesh.visible = false;
    });
  }
}

export interface RoomCentroidInfo {
  id: string;
  name: string;
  room_type: string;
  floor_level: number;
  area_m2: number;
  pos: THREE.Vector3;
  polygon_2d?: [number, number][];
}

/**
 * Dijkstra / Topological RAG Pathfinding Algorithm for Tel Ali
 * Avoids elevators & active fire rooms, navigates corridors -> fire stairwell -> ground exit.
 */
export function computeEscapePath(
  startRoomId: string,
  rooms: RoomCentroidInfo[],
  storyHeight: number = 3.20
): THREE.Vector3[] {
  if (rooms.length === 0) return [];

  const startRoom = rooms.find((r) => r.id === startRoomId) || rooms[0];
  const startPos = startRoom.pos.clone();
  const fl = startRoom.floor_level;
  const waypoints: THREE.Vector3[] = [];

  // 1. Initial Room Centroid
  waypoints.push(startPos.clone());

  // Helper: Detect exterior exit
  const isExitRoom = (r: RoomCentroidInfo) =>
    r.room_type === 'dis_cikis' ||
    r.id.toLowerCase().includes('cikis') ||
    r.name.toLowerCase().includes('çıkış');

  if (isExitRoom(startRoom)) {
    waypoints.push(startPos.clone().add(new THREE.Vector3(0, 0, -2.5)));
    return waypoints;
  }

  // Find the primary building exit
  const primaryExit =
    rooms.find((r) => r.floor_level === 0 && isExitRoom(r)) ||
    rooms.find((r) => isExitRoom(r)) ||
    null;

  const exitFloor = primaryExit ? primaryExit.floor_level : 0;

  // Case A: Start room is on the exit floor (typically Ground Floor 0)
  if (fl === exitFloor) {
    const isCorridor = (r: RoomCentroidInfo) =>
      r.room_type === 'kat_koridoru' || r.name.toLowerCase().includes('koridor');

    if (!isCorridor(startRoom) && startRoom.room_type !== 'yangin_merdiveni') {
      const flCorridor = rooms.find((r) => r.floor_level === fl && isCorridor(r));
      if (flCorridor && flCorridor.id !== startRoom.id) {
        waypoints.push(new THREE.Vector3().lerpVectors(startPos, flCorridor.pos, 0.5));
        waypoints.push(flCorridor.pos.clone());
      }
    }

    if (primaryExit) {
      waypoints.push(primaryExit.pos.clone());
      const refPt = waypoints[waypoints.length - 2] || startPos;
      const outDir = primaryExit.pos.clone().sub(refPt);
      outDir.y = 0;
      if (outDir.lengthSq() > 0.01) outDir.normalize();
      else outDir.set(0, 0, -1);
      waypoints.push(primaryExit.pos.clone().addScaledVector(outDir, 2.5));
    }
    return waypoints;
  }

  // Case B: Start room is on another floor (Basement < 0 or Upper Floor > 0)
  // 1. Current Floor: Room -> Corridor
  const floorCorridor = rooms.find(
    (r) =>
      r.floor_level === fl &&
      (r.room_type === 'kat_koridoru' || r.name.toLowerCase().includes('koridor'))
  );
  if (
    floorCorridor &&
    startRoom.id !== floorCorridor.id &&
    startRoom.room_type !== 'yangin_holu' &&
    startRoom.room_type !== 'yangin_merdiveni'
  ) {
    waypoints.push(new THREE.Vector3().lerpVectors(startPos, floorCorridor.pos, 0.5));
    waypoints.push(floorCorridor.pos.clone());
  }

  // 2. Current Floor: Corridor -> Fire Vestibule (Hol)
  const floorHole = rooms.find(
    (r) =>
      r.floor_level === fl &&
      (r.room_type === 'yangin_holu' || r.name.toLowerCase().includes('hol'))
  );
  if (
    floorHole &&
    startRoom.id !== floorHole.id &&
    startRoom.room_type !== 'yangin_merdiveni'
  ) {
    waypoints.push(floorHole.pos.clone());
  }

  // 3. Current Floor: Fire Stairwell (Merdiven)
  const floorStair = rooms.find(
    (r) =>
      r.floor_level === fl &&
      (r.room_type === 'yangin_merdiveni' || r.name.toLowerCase().includes('merdiven'))
  );
  if (floorStair && startRoom.id !== floorStair.id) {
    waypoints.push(floorStair.pos.clone());
  }

  // 4. Vertical stair traversal to exit floor (exitFloor)
  const exitStair = rooms.find(
    (r) =>
      r.floor_level === exitFloor &&
      (r.room_type === 'yangin_merdiveni' || r.name.toLowerCase().includes('merdiven'))
  );

  const stairX = exitStair ? exitStair.pos.x : floorStair ? floorStair.pos.x : startPos.x;
  const stairZ = exitStair ? exitStair.pos.z : floorStair ? floorStair.pos.z : startPos.z;

  if (fl > exitFloor) {
    // Upper floor descent step by step
    for (let cf = fl - 1; cf >= exitFloor; cf--) {
      const midY = (cf + 0.5) * storyHeight + 0.15;
      const targetY = cf * storyHeight + 0.15;
      waypoints.push(new THREE.Vector3(stairX + 0.6, midY, stairZ + 0.6));
      waypoints.push(new THREE.Vector3(stairX, targetY, stairZ));
    }
  } else if (fl < exitFloor) {
    // Basement ascent step by step
    for (let cf = fl; cf < exitFloor; cf++) {
      const midY = (cf + 0.5) * storyHeight + 0.15;
      const targetY = (cf + 1) * storyHeight + 0.15;
      waypoints.push(new THREE.Vector3(stairX + 0.6, midY, stairZ + 0.6));
      waypoints.push(new THREE.Vector3(stairX, targetY, stairZ));
    }
  }

  // 5. Exit Floor: Stair -> Vestibule -> Corridor -> Exit Door -> Muster Point
  const exitHole = rooms.find(
    (r) =>
      r.floor_level === exitFloor &&
      (r.room_type === 'yangin_holu' || r.name.toLowerCase().includes('hol'))
  );
  if (exitHole) {
    waypoints.push(exitHole.pos.clone());
  }

  const exitCorridor = rooms.find(
    (r) =>
      r.floor_level === exitFloor &&
      (r.room_type === 'kat_koridoru' || r.name.toLowerCase().includes('koridor'))
  );
  if (exitCorridor) {
    waypoints.push(exitCorridor.pos.clone());
  }

  if (primaryExit) {
    waypoints.push(primaryExit.pos.clone());
    const refPt = exitCorridor ? exitCorridor.pos : exitHole ? exitHole.pos : new THREE.Vector3(stairX, exitFloor * storyHeight + 0.15, stairZ);
    const outDir = primaryExit.pos.clone().sub(refPt);
    outDir.y = 0;
    if (outDir.lengthSq() > 0.01) outDir.normalize();
    else outDir.set(0, 0, -1);
    waypoints.push(primaryExit.pos.clone().addScaledVector(outDir, 2.5));
  } else if (exitCorridor) {
    waypoints.push(exitCorridor.pos.clone().add(new THREE.Vector3(0, 0, -4.0)));
  }

  return waypoints;
}
