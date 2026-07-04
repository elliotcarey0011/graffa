import express from "express";
import { WebSocketServer } from "ws";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { createServer } from "node:http";
import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drawDab, dabBounds, NOZZLES } from "./spray.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, "..", "data");
const WALL_PATH = path.join(DATA_DIR, "wall.png");
const CLIENT_DIST = path.join(__dirname, "..", "..", "client", "dist");
const BACKGROUND_IMAGE_PATH = path.join(__dirname, "..", "..", "client", "assets", "background.jpg");

const WIDTH = 2048;
const HEIGHT = 1024;
const PORT = process.env.PORT || 8787;

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext("2d");

function paintBaseWall() {
  // Subtle concrete-ish gradient so the wall isn't a flat dead color before anyone paints.
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, "#4a4d52");
  grad.addColorStop(1, "#37393d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.globalAlpha = 1;
  let seed = 1234567;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 10000) / 10000;
  };
  for (let i = 0; i < 6000; i++) {
    const x = rand() * WIDTH;
    const y = rand() * HEIGHT;
    const shade = rand() > 0.5 ? 255 : 0;
    ctx.globalAlpha = 0.02 + rand() * 0.03;
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(x, y, 1 + rand() * 2, 1 + rand() * 2);
  }
  ctx.globalAlpha = 1;
}

// Draws `img` scaled and center-cropped to fill (w, h) exactly, like CSS
// `background-size: cover`, so the aspect ratio isn't distorted.
function drawImageCover(img, w, h) {
  const imgRatio = img.width / img.height;
  const targetRatio = w / h;
  let sx, sy, sw, sh;
  if (imgRatio > targetRatio) {
    sh = img.height;
    sw = sh * targetRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / targetRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}

async function loadWall() {
  if (existsSync(WALL_PATH)) {
    try {
      const img = await loadImage(WALL_PATH);
      ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);
      console.log("Loaded existing wall from disk.");
      return;
    } catch (err) {
      console.warn("Failed to load saved wall, starting fresh.", err);
    }
  }
  if (existsSync(BACKGROUND_IMAGE_PATH)) {
    try {
      const img = await loadImage(BACKGROUND_IMAGE_PATH);
      drawImageCover(img, WIDTH, HEIGHT);
      console.log("Loaded background.jpg as the base wall.");
      return;
    } catch (err) {
      console.warn("Failed to load background.jpg, falling back to procedural wall.", err);
    }
  }
  paintBaseWall();
}

await loadWall();

let saveScheduled = false;
function scheduleSave() {
  if (saveScheduled) return;
  saveScheduled = true;
  setTimeout(async () => {
    saveScheduled = false;
    try {
      const buf = canvas.toBuffer("image/png");
      await writeFile(WALL_PATH, buf);
    } catch (err) {
      console.error("Failed to save wall:", err);
    }
  }, 4000);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function sanitizeDab(raw) {
  if (!raw || typeof raw !== "object") return null;
  const x = Number(raw.x);
  const y = Number(raw.y);
  const size = Number(raw.size);
  const flow = Number(raw.flow);
  const seed = Number(raw.seed);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (!Number.isFinite(size) || !Number.isFinite(seed)) return null;
  if (typeof raw.color !== "string" || !HEX_COLOR.test(raw.color)) return null;
  if (typeof raw.nozzle !== "string" || !NOZZLES[raw.nozzle]) return null;
  return {
    x: clamp(x, 0, WIDTH),
    y: clamp(y, 0, HEIGHT),
    color: raw.color,
    nozzle: raw.nozzle,
    size: clamp(size, 0.3, 2.5),
    flow: clamp(Number.isFinite(flow) ? flow : 1, 0.4, 1.4),
    seed: Math.floor(seed) >>> 0,
  };
}

function extractTilePng(x, y, w, h) {
  const tile = createCanvas(w, h);
  const tctx = tile.getContext("2d");
  tctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return tile.toBuffer("image/png");
}

const app = express();
if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get("*", (_req, res) => res.sendFile(path.join(CLIENT_DIST, "index.html")));
}

const server = createServer(app);
const wss = new WebSocketServer({ server });

function broadcast(msg, exclude) {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN && client !== exclude) client.send(data);
  }
}

function broadcastUserCount() {
  broadcast({ type: "users", count: wss.clients.size });
}

wss.on("connection", (ws) => {
  ws.dabTimestamps = [];

  const snapshotPng = canvas.toBuffer("image/png").toString("base64");
  ws.send(JSON.stringify({ type: "snapshot", width: WIDTH, height: HEIGHT, png: snapshotPng }));
  broadcastUserCount();

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type !== "dab") return;

    // Simple per-connection rate limit: max 60 dabs/sec.
    const now = Date.now();
    ws.dabTimestamps = ws.dabTimestamps.filter((t) => now - t < 1000);
    if (ws.dabTimestamps.length >= 60) return;
    ws.dabTimestamps.push(now);

    const dab = sanitizeDab(msg);
    if (!dab) return;

    drawDab(ctx, dab);
    scheduleSave();

    const bounds = dabBounds(dab);
    const x = clamp(bounds.x, 0, WIDTH - 1);
    const y = clamp(bounds.y, 0, HEIGHT - 1);
    const w = clamp(bounds.w, 1, WIDTH - x);
    const h = clamp(bounds.h, 1, HEIGHT - y);
    const png = extractTilePng(x, y, w, h).toString("base64");

    broadcast({ type: "tile", x, y, w, h, png });
  });

  ws.on("close", broadcastUserCount);
});

server.listen(PORT, () => {
  console.log(`Graffa server listening on http://localhost:${PORT}`);
});
