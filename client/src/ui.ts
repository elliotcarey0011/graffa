import { COLOR_PALETTE, NOZZLE_LIST } from "./nozzles";

export class ToolbarUI {
  selectedColor = COLOR_PALETTE[3];
  selectedNozzle = "standard";
  size = 1;
  flow = 1;

  onColorChange: (hex: string) => void = () => {};
  onNozzleChange: (key: string) => void = () => {};
  onSizeChange: (size: number) => void = () => {};
  onFlowChange: (flow: number) => void = () => {};
  onFirstInteraction: () => void = () => {};

  private statusDot = document.getElementById("status-dot")!;
  private userCountEl = document.getElementById("user-count")!;
  private introOverlay = document.getElementById("intro-overlay")!;

  constructor() {
    this.buildColorSwatches();
    this.buildNozzleButtons();
    this.wireSizeSlider();
    this.wireFlowSlider();
    this.wireIntro();
  }

  private fireFirstInteraction() {
    this.onFirstInteraction();
  }

  private buildColorSwatches() {
    const group = document.getElementById("color-group")!;
    const swatches: HTMLButtonElement[] = [];

    const select = (hex: string, btn: HTMLElement | null) => {
      this.selectedColor = hex;
      swatches.forEach((s) => s.classList.remove("selected"));
      btn?.classList.add("selected");
      this.onColorChange(hex);
      this.fireFirstInteraction();
    };

    COLOR_PALETTE.forEach((hex, i) => {
      const btn = document.createElement("button");
      btn.className = "swatch";
      btn.style.background = hex;
      btn.setAttribute("aria-label", hex);
      if (hex === this.selectedColor) btn.classList.add("selected");
      btn.addEventListener("click", () => select(hex, btn));
      group.appendChild(btn);
      swatches.push(btn);
    });

    const customWrap = document.createElement("label");
    customWrap.className = "swatch custom";
    const input = document.createElement("input");
    input.type = "color";
    input.value = "#ff2ec4";
    input.addEventListener("input", () => select(input.value, customWrap));
    customWrap.appendChild(input);
    group.appendChild(customWrap);
    swatches.push(customWrap as unknown as HTMLButtonElement);
  }

  private buildNozzleButtons() {
    const group = document.getElementById("nozzle-group")!;
    const buttons: HTMLButtonElement[] = [];

    NOZZLE_LIST.forEach((n) => {
      const btn = document.createElement("button");
      btn.className = "nozzle-btn";
      if (n.key === this.selectedNozzle) btn.classList.add("selected");

      const icon = document.createElement("div");
      icon.className = "nozzle-icon";
      const dot = document.createElement("div");
      dot.className = "dot";
      dot.style.width = `${n.dotSize}px`;
      dot.style.height = `${n.dotSize}px`;
      icon.appendChild(dot);

      const label = document.createElement("span");
      label.textContent = n.label;

      btn.appendChild(icon);
      btn.appendChild(label);
      btn.addEventListener("click", () => {
        this.selectedNozzle = n.key;
        buttons.forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        this.onNozzleChange(n.key);
        this.fireFirstInteraction();
      });

      group.appendChild(btn);
      buttons.push(btn);
    });
  }

  private wireSizeSlider() {
    const slider = document.getElementById("size-slider") as HTMLInputElement;
    slider.addEventListener("input", () => {
      this.size = parseFloat(slider.value);
      this.onSizeChange(this.size);
    });
  }

  private wireFlowSlider() {
    const slider = document.getElementById("flow-slider") as HTMLInputElement;
    slider.addEventListener("input", () => {
      this.flow = parseFloat(slider.value);
      this.onFlowChange(this.flow);
    });
  }

  private wireIntro() {
    const dismiss = document.getElementById("intro-dismiss")!;
    dismiss.addEventListener("click", () => {
      this.introOverlay.classList.add("hidden");
      this.fireFirstInteraction();
    });
  }

  setConnected(connected: boolean) {
    this.statusDot.classList.toggle("online", connected);
    this.statusDot.classList.toggle("offline", !connected);
  }

  setUserCount(count: number) {
    const label = count === 1 ? "1 person painting" : `${count} people painting`;
    this.userCountEl.textContent = label;
  }
}
