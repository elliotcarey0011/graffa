import * as THREE from "three";
import { WALL_PIXEL_WIDTH, WALL_PIXEL_HEIGHT } from "./config";
import { drawDab } from "./spray.js";

export interface Dab {
  x: number;
  y: number;
  color: string;
  nozzle: string;
  size: number;
  seed: number;
}

export class PaintSurface {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly texture: THREE.CanvasTexture;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = WALL_PIXEL_WIDTH;
    this.canvas.height = WALL_PIXEL_HEIGHT;
    this.ctx = this.canvas.getContext("2d")!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.flipY = true;
  }

  applyDabLocally(dab: Dab) {
    drawDab(this.ctx, dab);
    this.texture.needsUpdate = true;
  }

  applyTilePng(x: number, y: number, base64: string) {
    const img = new Image();
    img.onload = () => {
      this.ctx.drawImage(img, x, y);
      this.texture.needsUpdate = true;
    };
    img.src = `data:image/png;base64,${base64}`;
  }

  loadSnapshot(base64: string) {
    const img = new Image();
    img.onload = () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
      this.texture.needsUpdate = true;
    };
    img.src = `data:image/png;base64,${base64}`;
  }
}
