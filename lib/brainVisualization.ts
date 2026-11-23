import {
  brainRegionOrder,
  getBrainRegionColor,
  normalizeRegionActivation,
  type BrainRegionKey,
  type NormalizedActivation
} from "@/lib/brainRegions";
import type { FeatureWindow, RegionActivations } from "@/lib/types";

export type RegionAnchor = {
  id: string;
  region: BrainRegionKey;
  x: number;
  y: number;
  z: number;
  weight: number;
};

export type ActivationPatchPoint = RegionAnchor & {
  rawValue: number;
  normalizedIntensity: number;
  size: number;
  color: string;
  isCore: boolean;
};

export type InterpolatedRegionState = NormalizedActivation & {
  region: BrainRegionKey;
  color: string;
};

const regionAnchors: Record<BrainRegionKey, RegionAnchor[]> = {
  visual_cortex: [
    { id: "visual-left-medial", region: "visual_cortex", x: -16, y: -96, z: 0, weight: 1 },
    { id: "visual-right-medial", region: "visual_cortex", x: 16, y: -96, z: 0, weight: 1 },
    { id: "visual-left-lateral", region: "visual_cortex", x: -30, y: -82, z: 10, weight: 0.82 },
    { id: "visual-right-lateral", region: "visual_cortex", x: 30, y: -82, z: 10, weight: 0.82 }
  ],
  auditory_cortex: [
    { id: "audio-left-stg", region: "auditory_cortex", x: -56, y: -24, z: 8, weight: 1 },
    { id: "audio-right-stg", region: "auditory_cortex", x: 56, y: -24, z: 8, weight: 1 },
    { id: "audio-left-posterior", region: "auditory_cortex", x: -52, y: -36, z: 14, weight: 0.78 },
    { id: "audio-right-posterior", region: "auditory_cortex", x: 52, y: -36, z: 14, weight: 0.78 }
  ],
  heschls_gyrus: [
    { id: "speech-left-core", region: "heschls_gyrus", x: -44, y: -18, z: 10, weight: 1 },
    { id: "speech-right-core", region: "heschls_gyrus", x: 44, y: -18, z: 10, weight: 1 },
    { id: "speech-left-deep", region: "heschls_gyrus", x: -38, y: -12, z: 6, weight: 0.72 },
    { id: "speech-right-deep", region: "heschls_gyrus", x: 38, y: -12, z: 6, weight: 0.72 }
  ],
  brocas_area: [
    { id: "language-left-ifg", region: "brocas_area", x: -50, y: 18, z: 16, weight: 1 },
    { id: "language-right-ifg", region: "brocas_area", x: 50, y: 18, z: 16, weight: 0.62 },
    { id: "language-left-ventral", region: "brocas_area", x: -44, y: 30, z: 2, weight: 0.82 },
    { id: "language-right-ventral", region: "brocas_area", x: 44, y: 30, z: 2, weight: 0.5 }
  ],
  sts: [
    { id: "social-left-sts", region: "sts", x: -52, y: -42, z: 8, weight: 1 },
    { id: "social-right-sts", region: "sts", x: 52, y: -42, z: 8, weight: 1 },
    { id: "social-left-anterior", region: "sts", x: -54, y: -18, z: -2, weight: 0.82 },
    { id: "social-right-anterior", region: "sts", x: 54, y: -18, z: -2, weight: 0.82 }
  ],
  prefrontal: [
    { id: "attention-left-dlpfc", region: "prefrontal", x: -30, y: 50, z: 28, weight: 1 },
    { id: "attention-right-dlpfc", region: "prefrontal", x: 30, y: 50, z: 28, weight: 1 },
    { id: "attention-left-medial", region: "prefrontal", x: -10, y: 58, z: 18, weight: 0.78 },
    { id: "attention-right-medial", region: "prefrontal", x: 10, y: 58, z: 18, weight: 0.78 }
  ],
  motor_cortex: [
    { id: "action-left-hand", region: "motor_cortex", x: -36, y: -22, z: 56, weight: 1 },
    { id: "action-right-hand", region: "motor_cortex", x: 36, y: -22, z: 56, weight: 1 },
    { id: "action-left-dorsal", region: "motor_cortex", x: -18, y: -28, z: 66, weight: 0.8 },
    { id: "action-right-dorsal", region: "motor_cortex", x: 18, y: -28, z: 66, weight: 0.8 }
  ]
};

const haloOffsets = [
  [0, 0, 0],
  [4, 2, 2],
  [-4, 2, 2],
  [2, -4, -1],
  [-2, -4, -1]
] as const;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(value: number) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

export function interpolateFeatureWindow(windows: FeatureWindow[], currentTime: number): FeatureWindow | undefined {
  if (!windows.length) return undefined;

  const activeIndex = windows.findIndex((window) => currentTime >= window.start_time && currentTime < window.end_time);
  const index = activeIndex >= 0 ? activeIndex : currentTime < windows[0].start_time ? 0 : windows.length - 1;
  const current = windows[index];
  const next = windows[Math.min(index + 1, windows.length - 1)];

  if (!current || !next || current === next) return current;

  const span = Math.max(0.001, current.end_time - current.start_time);
  const blend = smoothstep((currentTime - current.start_time) / span);
  const region_activations = brainRegionOrder.reduce<RegionActivations>((acc, region) => {
    const from = Number(current.region_activations[region] ?? 0);
    const to = Number(next.region_activations[region] ?? from);
    acc[region] = lerp(from, to, blend);
    return acc;
  }, {});

  return {
    ...current,
    dominant_region: dominantRegion(region_activations),
    mean_activation: lerp(current.mean_activation, next.mean_activation, blend),
    region_activations
  };
}

export function getInterpolatedRegionStates(
  windows: FeatureWindow[],
  currentTime: number
): InterpolatedRegionState[] {
  const allActivations = windows.map((window) => window.region_activations);
  const window = interpolateFeatureWindow(windows, currentTime);

  return brainRegionOrder.map((region) => ({
    region,
    color: getBrainRegionColor(region),
    ...normalizeRegionActivation(window, region, allActivations)
  }));
}

export function createActivationPatchPoints(
  windows: FeatureWindow[],
  currentTime: number,
  focusedRegion: string | null
): ActivationPatchPoint[] {
  const states = getInterpolatedRegionStates(windows, currentTime);
  const stateByRegion = new Map(states.map((state) => [state.region, state]));
  const hasFocus = Boolean(focusedRegion);

  return brainRegionOrder.flatMap((region) => {
    const state = stateByRegion.get(region);
    if (!state) return [];

    const focusMultiplier = !hasFocus ? 1 : focusedRegion === region ? 1.45 : 0.28;
    const intensity = clamp(state.normalizedIntensity * focusMultiplier);
    const anchors = regionAnchors[region];

    return anchors.flatMap((anchor) =>
      haloOffsets.map(([dx, dy, dz], offsetIndex) => {
        const isCore = offsetIndex === 0;
        const falloff = isCore ? 1 : 0.58;
        const weightedIntensity = clamp(intensity * anchor.weight * falloff);
        return {
          ...anchor,
          id: `${anchor.id}-${offsetIndex}`,
          x: anchor.x + dx,
          y: anchor.y + dy,
          z: anchor.z + dz,
          rawValue: state.rawValue,
          normalizedIntensity: weightedIntensity,
          size: isCore ? 1.2 + weightedIntensity * 4.8 : 0.55 + weightedIntensity * 2.4,
          color: state.color,
          isCore
        };
      })
    );
  });
}

function dominantRegion(activations: RegionActivations) {
  return brainRegionOrder.reduce<BrainRegionKey>((best, region) => (
    Number(activations[region] ?? -Infinity) > Number(activations[best] ?? -Infinity) ? region : best
  ), brainRegionOrder[0]);
}

/**
 * Static per-hotspot geometry consumed by the brain shader. One hotspot
 * per anchor (4 per region * 7 regions = 28). Centers/colors never change
 * at runtime; only intensities are recomputed each frame.
 */
export type BrainHotspots = {
  count: number;
  regions: BrainRegionKey[];
  weights: Float32Array;
  centers: Float32Array;
  colors: Float32Array;
};

function hexToRgb01(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return [r, g, b];
}

let cachedHotspots: BrainHotspots | null = null;

export function getBrainHotspots(): BrainHotspots {
  if (cachedHotspots) return cachedHotspots;

  const flat = brainRegionOrder.flatMap((region) => regionAnchors[region]);
  const count = flat.length;
  const centers = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const weights = new Float32Array(count);
  const regions: BrainRegionKey[] = [];

  flat.forEach((anchor, index) => {
    centers[index * 3 + 0] = anchor.x;
    centers[index * 3 + 1] = anchor.y;
    centers[index * 3 + 2] = anchor.z;
    weights[index] = anchor.weight;
    const [r, g, b] = hexToRgb01(getBrainRegionColor(anchor.region));
    colors[index * 3 + 0] = r;
    colors[index * 3 + 1] = g;
    colors[index * 3 + 2] = b;
    regions.push(anchor.region);
  });

  cachedHotspots = { count, regions, weights, centers, colors };
  return cachedHotspots;
}

/**
 * Per-frame intensity vector: one float per hotspot (in the same order as
 * getBrainHotspots()). Caller may pass a scratch Float32Array to avoid
 * per-frame allocation.
 */
export function fillHotspotIntensities(
  windows: FeatureWindow[],
  currentTime: number,
  focusedRegion: string | null,
  scratch?: Float32Array
): Float32Array {
  const hotspots = getBrainHotspots();
  const out = scratch && scratch.length === hotspots.count ? scratch : new Float32Array(hotspots.count);
  const states = getInterpolatedRegionStates(windows, currentTime);
  const stateByRegion = new Map(states.map((state) => [state.region, state]));
  const hasFocus = Boolean(focusedRegion);

  for (let i = 0; i < hotspots.count; i++) {
    const region = hotspots.regions[i];
    const state = stateByRegion.get(region);
    if (!state) {
      out[i] = 0;
      continue;
    }
    const focusMultiplier = !hasFocus ? 1 : focusedRegion === region ? 1.55 : 0.18;
    out[i] = clamp(state.normalizedIntensity * hotspots.weights[i] * focusMultiplier);
  }
  return out;
}
