import * as THREE from "three";
import { WORLD_WALL_WIDTH, WORLD_WALL_HEIGHT } from "./config";
import { MistParticles } from "./particles";

export interface WallHit {
  pixelX: number;
  pixelY: number;
  point: THREE.Vector3;
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
    this.canGroup.visible = false;
    this.scene.add(this.canGroup);
  }

  setCapColor(hex: string) {
    this.capMaterial.color.set(hex);
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

  updateCan(hitPoint: THREE.Vector3 | null, spraying: boolean) {
    if (!hitPoint) {
      this.canGroup.visible = false;
      return;
    }
    this.canGroup.visible = true;
    const viewDir = new THREE.Vector3().subVectors(this.camera.position, hitPoint).normalize();
    const standoff = 1.4;
    const canPos = hitPoint.clone().addScaledVector(viewDir, standoff);
    this.canGroup.position.copy(canPos);

    const nozzleDir = viewDir.clone().negate();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nozzleDir);
    this.canGroup.quaternion.slerp(q, 1);

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

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.idleT += dt;
    this.particles.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
