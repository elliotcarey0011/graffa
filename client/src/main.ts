import "./style.css";
import { GraffaScene } from "./scene";
import { PaintSurface } from "./paint";
import { Network } from "./network";
import { SprayAudio } from "./audio";
import { ToolbarUI } from "./ui";
import { NOZZLES } from "./spray.js";

const container = document.getElementById("scene-root")!;
const paintSurface = new PaintSurface();
const scene = new GraffaScene(container, paintSurface.texture);
const ui = new ToolbarUI();
const audio = new SprayAudio();

const wsProtocol = location.protocol === "https:" ? "wss" : "ws";
const wsUrl = import.meta.env.DEV ? `${wsProtocol}://${location.hostname}:8787` : `${wsProtocol}://${location.host}`;
const network = new Network(wsUrl);

network.setOnSnapshot((_w, _h, png) => paintSurface.loadSnapshot(png));
network.setOnTile((x, y, _w, _h, png) => paintSurface.applyTilePng(x, y, png));
network.setOnUsers((count) => ui.setUserCount(count));
network.setOnStatus((connected) => ui.setConnected(connected));

scene.setCapColor(ui.selectedColor);

ui.onColorChange = (hex) => {
  scene.setCapColor(hex);
  audio.playShakeSample();
};
ui.onNozzleChange = () => {
  audio.playSnapSample();
  if (isDown) audio.startSpray(ui.selectedNozzle);
};
ui.onFirstInteraction = () => audio.init();

const pointerNDC = { x: 0, y: 0 }; // center of screen, so the can has a sane target before the first move
let isDown = false;
let lastDabTime = 0;
const BASE_DAB_INTERVAL_MS = 26;

function updatePointerNDC(clientX: number, clientY: number) {
  pointerNDC.x = (clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1;
}

const canvasEl = scene.renderer.domElement;
canvasEl.addEventListener("contextmenu", (e: MouseEvent) => e.preventDefault());

canvasEl.addEventListener("pointerdown", (e: PointerEvent) => {
  isDown = true;
  canvasEl.setPointerCapture(e.pointerId);
  updatePointerNDC(e.clientX, e.clientY);
  audio.init();
  audio.startSpray(ui.selectedNozzle);
});

window.addEventListener("pointermove", (e) => {
  updatePointerNDC(e.clientX, e.clientY);
});

function endStroke() {
  if (!isDown) return;
  isDown = false;
  audio.stopSpray();
}
window.addEventListener("pointerup", endStroke);
window.addEventListener("pointercancel", endStroke);
canvasEl.addEventListener("pointerleave", (e: PointerEvent) => {
  if (e.buttons === 0) endStroke();
});

function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}

function frame() {
  const dt = scene.beginFrame();
  const hit = scene.raycastWall(pointerNDC.x, pointerNDC.y);
  const aimPoint = scene.raycastAimPlane(pointerNDC.x, pointerNDC.y);
  scene.updateCan(aimPoint, isDown, dt);

  if (isDown && hit) {
    const now = performance.now();
    const dabInterval = BASE_DAB_INTERVAL_MS / ui.flow;
    if (now - lastDabTime >= dabInterval) {
      lastDabTime = now;
      const nozzle = NOZZLES[ui.selectedNozzle as keyof typeof NOZZLES] || NOZZLES.standard;
      const jitter = nozzle.radius * 0.12 * ui.size;
      const dab = {
        x: hit.pixelX + (Math.random() - 0.5) * jitter,
        y: hit.pixelY + (Math.random() - 0.5) * jitter,
        color: ui.selectedColor,
        nozzle: ui.selectedNozzle,
        size: ui.size,
        flow: ui.flow,
        seed: randomSeed(),
      };
      paintSurface.applyDabLocally(dab);
      network.sendDab(dab);
      scene.particles.spawnBurst(scene.nozzleWorldPosition(), scene.nozzleWorldDirection(), ui.selectedColor, 4);
    }
  }

  scene.tick();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
