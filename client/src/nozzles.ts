export interface NozzleMeta {
  key: string;
  label: string;
  dotSize: number; // purely for the UI icon
  dots: number;
}

export const NOZZLE_LIST: NozzleMeta[] = [
  { key: "fine", label: "Fine Tip", dotSize: 3, dots: 4 },
  { key: "standard", label: "Standard", dotSize: 4, dots: 6 },
  { key: "fat", label: "Fat Cap", dotSize: 6, dots: 8 },
  { key: "splatter", label: "Splatter", dotSize: 7, dots: 5 },
  { key: "mist", label: "Mist", dotSize: 5, dots: 10 },
];

export const COLOR_PALETTE: string[] = [
  "#f4f2ec",
  "#1a1a1a",
  "#e83b3b",
  "#ff8a1e",
  "#ffd23f",
  "#4bd671",
  "#1eb5a6",
  "#2f7ff2",
  "#7b5cff",
  "#e454c4",
  "#ff5fa2",
  "#8a5a3c",
];
