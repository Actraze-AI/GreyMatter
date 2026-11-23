"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BrainCircuit, Rotate3D } from "lucide-react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { formatBrainRegion } from "@/lib/brainRegions";
import {
  fillHotspotIntensities,
  getBrainHotspots,
  getInterpolatedRegionStates
} from "@/lib/brainVisualization";
import type { FeatureWindow } from "@/lib/types";

const MODEL_URL = "/models/brain.glb";
const FALLOFF_SIGMA = 22;
const EMISSIVE_BOOST = 0.65;
const BASE_BRAIN_COLOR = 0x8a7a85;
const BRAIN_SCALE = 0.013;

type BrainViewer3DProps = {
  activeWindow?: FeatureWindow;
  windows: FeatureWindow[];
  currentTime: number;
  isPlaying: boolean;
  focusedRegion: string | null;
  onRegionFocus: (region: string | null) => void;
};

type StateRef = {
  windows: FeatureWindow[];
  currentTime: number;
  focusedRegion: string | null;
  isPlaying: boolean;
};

function detectWebGL2(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

export function BrainViewer3D(props: BrainViewer3DProps) {
  const { windows, currentTime, isPlaying, focusedRegion, activeWindow } = props;
  const [supportsWebGL2] = useState<boolean>(() => detectWebGL2());
  const containerRef = useRef<HTMLDivElement>(null);

  const stateRef = useRef<StateRef>({ windows, currentTime, focusedRegion, isPlaying });
  useEffect(() => {
    stateRef.current.windows = windows;
    stateRef.current.currentTime = currentTime;
    stateRef.current.focusedRegion = focusedRegion;
    stateRef.current.isPlaying = isPlaying;
  });

  const topRegions = useMemo(() => {
    return getInterpolatedRegionStates(windows, currentTime)
      .slice()
      .sort((a, b) => b.normalizedIntensity - a.normalizedIntensity)
      .slice(0, 3);
  }, [windows, currentTime]);

  useEffect(() => {
    if (!supportsWebGL2) return;
    const container = containerRef.current;
    if (!container) return;

    const hotspots = getBrainHotspots();
    const intensities = new Float32Array(hotspots.count);

    let width = container.clientWidth || 1;
    let height = container.clientHeight || 1;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    // OutputPass at end of composer handles tonemapping + sRGB conversion.
    renderer.toneMapping = THREE.NoToneMapping;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05060a);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0.4, 4.4);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(3, 4, 6);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xa0c4ff, 0.55);
    rimLight.position.set(-4, -2, -3);
    scene.add(rimLight);
    const fillLight = new THREE.DirectionalLight(0xffd0c0, 0.35);
    fillLight.position.set(0, -3, 4);
    scene.add(fillLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2.4;
    controls.maxDistance = 6.5;
    controls.target.set(0, 0, 0);

    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    composer.setSize(width, height);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.55, 0.6, 0.7);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(BASE_BRAIN_COLOR),
      roughness: 0.55,
      metalness: 0.04,
      emissive: new THREE.Color(0x000000)
    });
    const uniforms = {
      uCenters: { value: hotspots.centers },
      uColors: { value: hotspots.colors },
      uIntensities: { value: intensities },
      uFalloffSigma: { value: FALLOFF_SIGMA },
      uEmissiveBoost: { value: EMISSIVE_BOOST }
    };
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\nvarying vec3 vBrainPos;`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>\nvBrainPos = position;`);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec3 vBrainPos;
uniform vec3 uCenters[${hotspots.count}];
uniform vec3 uColors[${hotspots.count}];
uniform float uIntensities[${hotspots.count}];
uniform float uFalloffSigma;
uniform float uEmissiveBoost;`
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
vec3 _glow = vec3(0.0);
float _sigma2 = uFalloffSigma * uFalloffSigma;
for (int i = 0; i < ${hotspots.count}; i++) {
  vec3 _d = vBrainPos - uCenters[i];
  float _w = exp(-dot(_d, _d) / _sigma2);
  _glow += uColors[i] * uIntensities[i] * _w;
}
totalEmissiveRadiance += _glow * uEmissiveBoost;`
        );
    };

    // Brain GLB is in MNI space (+X right, +Y anterior, +Z superior).
    // Euler XYZ: Ry(π) faces brain to camera, then Rx(π/2) lifts MNI superior to world up.
    const brainGroup = new THREE.Group();
    brainGroup.scale.setScalar(BRAIN_SCALE);
    brainGroup.rotation.set(Math.PI / 2, Math.PI, 0);
    scene.add(brainGroup);

    const loader = new GLTFLoader();
    let disposed = false;
    let loadedScene: THREE.Group | null = null;
    loader.load(
      MODEL_URL,
      (gltf) => {
        if (disposed) return;
        loadedScene = gltf.scene;
        loadedScene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.material = material;
            mesh.castShadow = false;
            mesh.receiveShadow = false;
          }
        });
        brainGroup.add(loadedScene);
      },
      undefined,
      (err) => console.error("[BrainViewer3D] GLB load failed:", err)
    );

    let frameId = 0;
    const tick = () => {
      const state = stateRef.current;
      fillHotspotIntensities(state.windows, state.currentTime, state.focusedRegion, intensities);
      controls.update();
      composer.render();
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);

    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth || 1;
      height = container.clientHeight || 1;
      renderer.setSize(width, height);
      composer.setSize(width, height);
      bloom.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      controls.dispose();
      composer.dispose();
      renderer.dispose();
      material.dispose();
      if (loadedScene) {
        loadedScene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) mesh.geometry.dispose();
        });
      }
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [supportsWebGL2]);

  if (!supportsWebGL2) {
    return (
      <div className="panel relative flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-lg p-6 text-center">
        <BrainCircuit className="h-7 w-7 text-cyan" />
        <p className="font-display text-sm uppercase tracking-[0.18em] text-cyan">3D brain unavailable</p>
        <p className="max-w-xs text-xs text-zinc-500">
          This browser does not expose WebGL2. Open the dashboard in Chrome or Safari Tech Preview.
        </p>
      </div>
    );
  }

  return (
    <div className="panel relative overflow-hidden rounded-lg">
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
        <BrainCircuit className="h-4 w-4 text-cyan" />
        <span className="font-display text-xs uppercase tracking-[0.18em] text-cyan">Cortical activation</span>
      </div>
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2 text-zinc-500">
        <Rotate3D className="h-4 w-4" />
        <span className="font-display text-[10px] uppercase tracking-[0.18em]">drag to rotate</span>
      </div>

      <div ref={containerRef} className="h-[420px] w-full" />

      <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-10 flex flex-wrap items-end justify-between gap-3">
        <div className="rounded border border-cyan/30 bg-black/55 px-3 py-2 backdrop-blur">
          <div className="font-display text-[10px] uppercase tracking-[0.18em] text-zinc-500">Window</div>
          <div className="mt-0.5 font-display text-sm text-white">
            {activeWindow ? `${activeWindow.start_time}–${activeWindow.end_time}s` : "–"}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {topRegions.map((state) => (
            <div
              key={state.region}
              className="rounded border bg-black/55 px-2.5 py-1 font-display text-[10px] uppercase tracking-[0.14em] backdrop-blur"
              style={{ borderColor: `${state.color}55`, color: state.color }}
            >
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: state.color }} />
              {formatBrainRegion(state.region)} · {(state.normalizedIntensity * 100).toFixed(0)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
