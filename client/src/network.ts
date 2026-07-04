import type { Dab } from "./paint";

type SnapshotHandler = (width: number, height: number, png: string) => void;
type TileHandler = (x: number, y: number, w: number, h: number, png: string) => void;
type UsersHandler = (count: number) => void;
type StatusHandler = (connected: boolean) => void;

export class Network {
  private ws: WebSocket | null = null;
  private queue: Dab[] = [];
  private onSnapshot: SnapshotHandler = () => {};
  private onTile: TileHandler = () => {};
  private onUsers: UsersHandler = () => {};
  private onStatus: StatusHandler = () => {};
  private url: string;

  constructor(url: string) {
    this.url = url;
    this.connect();
  }

  private connect() {
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.onStatus(true);
      while (this.queue.length) {
        ws.send(JSON.stringify({ type: "dab", ...this.queue.shift() }));
      }
    });

    ws.addEventListener("message", (ev) => {
      let msg: any;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === "snapshot") this.onSnapshot(msg.width, msg.height, msg.png);
      else if (msg.type === "tile") this.onTile(msg.x, msg.y, msg.w, msg.h, msg.png);
      else if (msg.type === "users") this.onUsers(msg.count);
    });

    ws.addEventListener("close", () => {
      this.onStatus(false);
      setTimeout(() => this.connect(), 1500);
    });

    ws.addEventListener("error", () => ws.close());
  }

  sendDab(dab: Dab) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "dab", ...dab }));
    } else {
      this.queue.push(dab);
      if (this.queue.length > 200) this.queue.shift();
    }
  }

  setOnSnapshot(cb: SnapshotHandler) {
    this.onSnapshot = cb;
  }
  setOnTile(cb: TileHandler) {
    this.onTile = cb;
  }
  setOnUsers(cb: UsersHandler) {
    this.onUsers = cb;
  }
  setOnStatus(cb: StatusHandler) {
    this.onStatus = cb;
  }
}
