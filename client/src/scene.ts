import * as THREE from "three";
import { WORLD_WALL_WIDTH, WORLD_WALL_HEIGHT } from "./config";
import { MistParticles } from "./particles";

export interface WallHit {
  pixelX: number;
  pixelY: number;
  point: THREE.Vector3;
}

const CAN_STANDOFF = 1.4;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export class GraffaScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly particles = new MistParticles();

  private wallMesh: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private canGroup = new THREE.Group();
  private capMaterial!: THREE.MeshStandardMaterial;
  private clock = new THREE.Clock();
  private idleT = 0;
  private lastDt = 0;
  private aimPlane!: THREE.Plane;
  private canTargetQuat!: THREE.Quaternion;
  private canInitialized = false;

  constructor(container: HTMLElement, wallTexture: THREE.Texture) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.camera.position.set(0, 0.3, 9.5);
    this.camera.lookAt(0, 0, 0);

    this.scene.background = new THREE.Color(0x0d0f12);
    this.scene.fog = new THREE.Fog(0x0d0f12, 8, 22);

    this.wallMesh = this.buildWall(wallTexture);
    this.scene.add(this.wallMesh);
    this.buildEnvironment();
    this.buildLights();
    this.buildCan();
    this.buildAimPlane();
    this.scene.add(this.particles.group);

    this.onResize();
    window.addEventListener("resize", () => this.onResize());
  }

  private buildWall(texture: THREE.Texture): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(WORLD_WALL_WIDTH, WORLD_WALL_HEIGHT);
    const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95, metalness: 0.02 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.position.set(0, 0, 0);
    return mesh;
  }

  private buildEnvironment() {
    const floorGeo = new THREE.PlaneGeometry(40, 30);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 1 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -WORLD_WALL_HEIGHT / 2, 8);
    floor.receiveShadow = true;
    this.scene.add(floor);

    const sideGeo = new THREE.PlaneGeometry(20, WORLD_WALL_HEIGHT + 2);
    const sideMat = new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 1 });

    const left = new THREE.Mesh(sideGeo, sideMat);
    left.rotation.y = Math.PI / 2;
    left.position.set(-WORLD_WALL_WIDTH / 2, 0, 8);
    left.receiveShadow = true;
    this.scene.add(left);

    const right = new THREE.Mesh(sideGeo, sideMat.clone());
    right.rotation.y = -Math.PI / 2;
    right.position.set(WORLD_WALL_WIDTH / 2, 0, 8);
    right.receiveShadow = true;
    this.scene.add(right);
  }

  private buildLights() {
    this.scene.add(new THREE.AmbientLight(0x8899aa, 0.55));

    const dir = new THREE.DirectionalLight(0xcfd8ff, 0.9);
    dir.position.set(4, 8, 10);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.left = -10;
    dir.shadow.camera.right = 10;
    dir.shadow.camera.top = 10;
    dir.shadow.camera.bottom = -10;
    this.scene.add(dir);

    const lampColor = 0xffb877;
    const lamp1 = new THREE.PointLight(lampColor, 12, 15, 2);
    lamp1.position.set(-6, 4, 6);
    this.scene.add(lamp1);

    const lamp2 = new THREE.PointLight(lampColor, 12, 15, 2);
    lamp2.position.set(6, 4, 6);
    this.scene.add(lamp2);
  }

  private buildCan() {
    const bodyGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.5, 20);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xdadada, metalness: 0.6, roughness: 0.35 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = Math.PI / 2;
    body.castShadow = true;

    this.capMaterial = new THREE.MeshStandardMaterial({ color: 0xff3b30, metalness: 0.2, roughness: 0.5 });
    const capGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.12, 20);
    const cap = new THREE.Mesh(capGeo, this.capMaterial);
    cap.rotation.x = Math.PI / 2;
    cap.position.z = 0.31;
    cap.castShadow = true;

    const nozzleGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.1, 12);
    const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.4, roughness: 0.5 });
    const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.z = 0.42;

    this.canGroup.add(body, cap, nozzle);
    this.scene.add(this.canGroup);
  }

  // A plane facing the (fixed) camera, floating CAN_STANDOFF units in front of the
  // wall. Used only to position/orient the cosmetic can model — it always has a
  // valid intersection, unlike raycastWall which is bounded to the wall mesh.
  private buildAimPlane() {
    const normal = new THREE.Vector3().subVectors(this.camera.position, this.wallMesh.position).normalize();
    const point = this.wallMesh.position.clone().addScaledVector(normal, CAN_STANDOFF);
    this.aimPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
    this.canTargetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().negate());
  }

  setCapColor(hex: string) {
    this.capMaterial.color.set(hex);
    this.capMaterial.emissive.set(hex);
    this.capMaterial.emissiveIntensity = 0.4;
  }

  raycastWall(ndcX: number, ndcY: number): WallHit | null {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hits = this.raycaster.intersectObject(this.wallMesh);
    if (!hits.length || !hits[0].uv) return null;
    const uv = hits[0].uv;
    return {
      pixelX: uv.x * 2048,
      pixelY: (1 - uv.y) * 1024,
      point: hits[0].point.clone(),
    };
  }

  // Always resolves to a point (the aim plane spans the whole view for this fixed
  // camera), clamped so the can can't drift absurdly far past the wall's edges.
  raycastAimPlane(ndcX: number, ndcY: number): THREE.Vector3 {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const target = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.aimPlane, target);
    if (!hit) target.copy(this.raycaster.ray.origin).addScaledVector(this.raycaster.ray.direction, CAN_STANDOFF + 8);

    const maxX = WORLD_WALL_WIDTH / 2 + 2;
    const maxY = WORLD_WALL_HEIGHT / 2 + 2;
    target.x = clamp(target.x, -maxX, maxX);
    target.y = clamp(target.y, -maxY, maxY);
    return target;
  }

  updateCan(targetPoint: THREE.Vector3, spraying: boolean, dt: number) {
    if (!this.canInitialized) {
      this.canGroup.position.copy(targetPoint);
      this.canGroup.quaternion.copy(this.canTargetQuat);
      this.canInitialized = true;
    } else {
      const posAlpha = 1 - Math.exp(-10 * dt);
      const rotAlpha = 1 - Math.exp(-8 * dt);
      this.canGroup.position.lerp(targetPoint, posAlpha);
      this.canGroup.quaternion.slerp(this.canTargetQuat, rotAlpha);
    }

    const wobble = spraying ? Math.sin(performance.now() * 0.05) * 0.02 : 0;
    this.canGroup.rotateZ(wobble);
  }

  nozzleWorldPosition(): THREE.Vector3 {
    return this.canGroup.localToWorld(new THREE.Vector3(0, 0, 0.47));
  }

  nozzleWorldDirection(): THREE.Vector3 {
    return this.canGroup.localToWorld(new THREE.Vector3(0, 0, 1)).sub(this.canGroup.position).normalize();
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // Advances the shared per-frame clock. Call once at the top of each animation
  // frame, before updateCan(), so the returned dt can drive its damping.
  beginFrame(): number {
    this.lastDt = Math.min(this.clock.getDelta(), 0.05);
    return this.lastDt;
  }

  tick() {
    this.idleT += this.lastDt;
    this.particles.update(this.lastDt);
    this.renderer.render(this.scene, this.camera);
  }
}
