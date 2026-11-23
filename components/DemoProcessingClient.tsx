"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RadioTower } from "lucide-react";
import { NeuralOrb } from "@/components/NeuralOrb";
import { StatusPill } from "@/components/StatusPill";

type DemoProcessingClientProps = {
  demoId: string;
};

const demoDurationMs = 3000;

const demoSteps = [
  { label: "Upload accepted", detail: "Demo asset staged locally." },
  { label: "Brain encoding", detail: "TRIBE v2 neural map restored." },
  { label: "Extracting features", detail: "Region activation timeline loaded." },
  { label: "Neural diagnosis", detail: "Multimodal findings compiled." },
  { label: "Complete", detail: "Dashboard handoff ready." }
];

export function DemoProcessingClient({ demoId }: DemoProcessingClientProps) {
  const router = useRouter();
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = performance.now();
    let frame = 0;

    function tick(now: number) {
      const nextElapsed = Math.min(demoDurationMs, now - startedAt);
      setElapsedMs(nextElapsed);
      if (nextElapsed < demoDurationMs) {
        frame = window.requestAnimationFrame(tick);
      }
    }

    frame = window.requestAnimationFrame(tick);
    const redirect = window.setTimeout(() => {
      router.push(`/results/${demoId}`);
    }, demoDurationMs);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(redirect);
    };
  }, [demoId, router]);

  const progress = Math.min(100, Math.round((elapsedMs / demoDurationMs) * 100));
  const activeStep = useMemo(() => {
    return Math.min(demoSteps.length - 1, Math.floor((progress / 100) * demoSteps.length));
  }, [progress]);

  return (
    <section className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-5 py-10 md:px-8 lg:grid-cols-[0.92fr_1.08fr]">
      <div className="space-y-6">
        <div className="panel relative overflow-hidden rounded-lg p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <StatusPill>Processing Pipeline</StatusPill>
              <h1 className="mt-4 font-display text-3xl font-bold text-white">
                {demoSteps[activeStep]?.label ?? "Preparing dashboard"}
              </h1>
            </div>
            <RadioTower className="h-8 w-8 text-cyan" />
          </div>
          <p className="mt-4 text-sm leading-6 text-zinc-400">
            Encoding neural activity and preparing the preloaded diagnostic dashboard.
          </p>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-cyan shadow-cyan transition-[width] duration-100" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-3 font-display text-xs uppercase tracking-[0.18em] text-zinc-500">
            Demo job {demoId}
          </div>
        </div>

        <div className="panel relative overflow-hidden rounded-lg p-6">
          <div className="relative pl-6">
            <div className="absolute bottom-0 left-[11px] top-0 w-px bg-gradient-to-b from-cyan via-white/15 to-white/5" />
            <div className="space-y-5">
              {demoSteps.map((step, index) => {
                const state = index < activeStep ? "done" : index === activeStep ? "active" : "waiting";
                return (
                  <div key={step.label} className="relative flex gap-4">
                    <div className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                      state === "done"
                        ? "border-cyan bg-cyan text-black"
                        : state === "active"
                          ? "border-cyan bg-black shadow-cyan"
                          : "border-white/15 bg-black"
                    }`}>
                      {state === "done" ? <Check className="h-3.5 w-3.5" /> : state === "active" ? <span className="h-2 w-2 rounded-full bg-cyan" /> : null}
                    </div>
                    <div className={`rounded border p-3 ${
                      state === "active"
                        ? "border-cyan/45 bg-cyan/10"
                        : "border-white/10 bg-white/[0.03]"
                    }`}>
                      <div className="font-display text-sm font-bold uppercase tracking-[0.14em] text-white">{step.label}</div>
                      <div className="mt-1 text-sm text-zinc-400">{step.detail}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="panel relative flex min-h-[560px] flex-col items-center justify-center overflow-hidden rounded-lg p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,242,255,.16),transparent_45%)]" />
        <div className="sweep-line absolute left-0 right-0 top-0 h-px bg-cyan shadow-cyan" />
        <NeuralOrb />
        <div className="relative z-10 mt-8 text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-cyan" />
          <h2 className="font-display text-2xl font-bold text-white">Neural scan running</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
            Finalizing the demo analysis package before opening the results dashboard.
          </p>
        </div>
        <div className="absolute bottom-4 left-4 flex flex-col gap-1 font-display text-[10px] uppercase tracking-[0.18em] text-cyan/70">
          <span>GPU_TEMP: 68C</span>
          <span>VRAM_ALLOC: 14.2GB</span>
          <span>TENSORS: 1.4B</span>
        </div>
        <div className="absolute right-4 top-4 font-display text-[10px] uppercase tracking-[0.18em] text-cyan/70">
          MODEL: NEUROCORE_V2.1
        </div>
      </div>
    </section>
  );
}
