import Image from "next/image";
import { NeuralOrb } from "@/components/NeuralOrb";
import { StatusPill } from "@/components/StatusPill";

const previewFrames = [
  {
    src: "/landing-preview-01.jpg",
    alt: "Talking-head sales reel preview"
  },
  {
    src: "/landing-preview-02.jpg",
    alt: "Talking-head finance reel preview"
  },
  {
    src: "/landing-preview-03.jpg",
    alt: "Talking-head business reel preview"
  }
];

export function LandingPreviewCard() {
  return (
    <div className="panel relative overflow-hidden rounded-lg p-4 md:p-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan to-transparent opacity-70" />
      <div className="relative aspect-[4/5] overflow-hidden rounded border border-white/10 bg-black">
        {previewFrames.map((frame, index) => (
          <Image
            key={frame.src}
            src={frame.src}
            alt={frame.alt}
            fill
            sizes="(max-width: 768px) 100vw, 48vw"
            className="landing-preview-frame object-cover opacity-0"
            priority={index === 0}
            style={{ animationDelay: `${index * 3.2}s` }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/5 to-black/78" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,transparent_0%,transparent_38%,rgba(0,0,0,0.52)_100%)]" />
        <div className="absolute left-5 top-5">
          <StatusPill>Demo Ready</StatusPill>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <NeuralOrb />
        </div>
        <div className="absolute bottom-5 left-5 right-5 grid grid-cols-3 gap-3">
          {[
            ["Max Length", "30s"],
            ["GPU Wait", "15-20m"],
            ["Demo Load", "Instant"]
          ].map(([label, value]) => (
            <div key={label} className="rounded border border-white/10 bg-black/55 p-3 backdrop-blur">
              <div className="font-display text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</div>
              <div className="mt-1 font-display text-lg font-bold text-cyan">{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
