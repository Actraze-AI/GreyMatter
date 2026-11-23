"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import {
  Activity,
  AlertTriangle,
  Bot,
  BrainCircuit,
  Clock,
  FileText,
  Loader2,
  MessageSquareText,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Radio,
  Send,
  Sparkles,
  Zap
} from "lucide-react";
import {
  Area,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  AreaChart,
  ReferenceLine
} from "recharts";
import { StatusPill } from "@/components/StatusPill";
import {
  brainRegionOrder,
  formatBrainRegion,
  getBrainRegionColor
} from "@/lib/brainRegions";
import type { FeatureWindow, ResultsPayload, TranscriptWord } from "@/lib/types";

type ResultsDashboardProps = {
  id: string;
};

const BrainViewer3D = dynamic(
  () => import("@/components/BrainViewer3D").then((mod) => mod.BrainViewer3D),
  {
    ssr: false,
    loading: () => (
      <div className="panel relative flex min-h-[420px] items-center justify-center rounded-lg p-4">
        <Loader2 className="h-7 w-7 animate-spin text-cyan" />
      </div>
    )
  }
);

type DemoChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
};

const DEMO_CHAT_SEED: DemoChatMessage[] = [
  {
    id: "seed-user-1",
    role: "user",
    content: "What is actually wrong with this reel? Give me the honest version."
  },
  {
    id: "seed-assistant-1",
    role: "assistant",
    content:
      "The reel is not failing because the idea is weak. It is failing because the strongest idea is hidden behind static talking-head segments. The first 0-3s barely gives the brain anything new to track, then the screen demo from 5-18s spikes attention hard because viewers can finally see proof: folders, commands, reports, numbers. The crash at 19s happens the moment the reel returns to face-only explanation."
  },
  {
    id: "seed-user-2",
    role: "user",
    content: "What should I change before showing this in the demo?"
  },
  {
    id: "seed-assistant-2",
    role: "assistant",
    content:
      "Open on the screen recording. Start with the GitHub repo or VS Code command palette already moving, then keep the creator as voiceover only. Preserve the 5-18s proof-of-work section because that is where neural activation stays strongest. At 19s, do not cut back to the face. Show the tool producing the report, then make the CTA visual: someone typing CLAUDE in the comments while the screen still proves the outcome."
  }
];

const DEMO_CHAT_RESPONSES = [
  {
    match: ["hook", "open", "first", "start"],
    content:
      "For the hook, remove the talking-head opener entirely. Lead with 0.5s of fast screen motion, then land on the repo or command palette. The current 0-3s asks viewers to believe a claim before they have visual proof."
  },
  {
    match: ["cta", "comment", "save"],
    content:
      "The CTA should become an action shot. Show the comment box, type CLAUDE on screen, and keep the tool result visible. The current CTA arrives after the 19s attention drop, so the viewer hears the ask after they have already mentally left."
  },
  {
    match: ["best", "peak", "strong", "work"],
    content:
      "The strongest section is 5-18s. The brain data likes the concrete sequence: repo, folder setup, command palette, then performance report. That is the spine of the reel. Build around that and treat face footage as optional garnish, not structure."
  }
];

const DEMO_CHAT_FALLBACK =
  "I would treat this as a screen-demo-first reel. Keep the proof dense, visual, and sequential: show the repo, show the setup, show the output, then make the CTA a visible action. The data is basically telling us that the viewer trusts what they can inspect.";

function activeWord(words: TranscriptWord[], time: number) {
  return words.find((word) => time >= word.start && time <= word.end);
}

function activeFrame(frames: string[], time: number) {
  if (!frames.length) return "";
  const index = Math.min(frames.length - 1, Math.max(0, Math.floor(time)));
  return frames[index] ?? frames[0];
}

export function ResultsDashboard({ id }: ResultsDashboardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [data, setData] = useState<ResultsPayload | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [focusedRegion, setFocusedRegion] = useState<string | null>(null);
  const [isDemoChatOpen, setIsDemoChatOpen] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetch(`/api/results/${id}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Could not load results.");
        return payload as ResultsPayload;
      })
      .then((payload) => {
        if (isMounted) {
          setData(payload);
          setError("");
        }
      })
      .catch((err) => {
        if (isMounted) setError(err instanceof Error ? err.message : "Could not load results.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [id]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.features.windows.map((window) => ({
      time: window.start_time,
      mean: Number(window.mean_activation.toFixed(4)),
      ...Object.fromEntries(
        Object.entries(window.region_activations).map(([key, value]) => [key, Number(value.toFixed(4))])
      )
    }));
  }, [data]);

  const activeWindow = useMemo<FeatureWindow | undefined>(() => {
    return data?.features.windows.find((window) => currentTime >= window.start_time && currentTime < window.end_time)
      ?? data?.features.windows.at(-1);
  }, [currentTime, data]);

  const regions = useMemo(() => {
    if (!data?.features.windows.length) return [];
    const available = Object.keys(data.features.windows[0].region_activations);
    return brainRegionOrder.filter((region) => available.includes(region));
  }, [data]);

  const chartRegions = useMemo(() => {
    if (focusedRegion && regions.includes(focusedRegion as typeof regions[number])) return [focusedRegion];
    return regions.slice(0, 4);
  }, [focusedRegion, regions]);

  const currentWord = useMemo(() => data ? activeWord(data.transcript, currentTime) : undefined, [currentTime, data]);
  const currentFrame = useMemo(() => data ? activeFrame(data.frames, currentTime) : "", [currentTime, data]);

  function seek(nextTime: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || nextTime, nextTime));
    setCurrentTime(video.currentTime);
  }

  if (isLoading) {
    return (
      <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-5">
        <div className="panel relative rounded-lg p-8 text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-cyan" />
          <p className="font-display text-sm uppercase tracking-[0.18em] text-cyan">Loading neural dashboard</p>
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-5">
        <div className="panel relative max-w-xl rounded-lg p-8 text-center">
          <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-danger" />
          <h1 className="font-display text-2xl font-bold text-white">Results unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">{error || "This analysis has not completed yet."}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/scan" className="rounded px-4 py-2 font-display text-xs font-bold uppercase tracking-[0.18em] cyber-button">Upload</Link>
            <Link href="/results/DVj0HP6CQOP" className="rounded px-4 py-2 font-display text-xs font-bold uppercase tracking-[0.18em] filled-cyber-button">Demo</Link>
          </div>
        </div>
      </section>
    );
  }

  const topSummaryGridClass = data.demo
    ? "grid grid-cols-1 gap-5 lg:grid-cols-[minmax(280px,380px)_minmax(360px,1fr)] xl:grid-cols-[minmax(280px,360px)_minmax(360px,.86fr)_minmax(420px,1fr)]"
    : "grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,.95fr)] xl:grid-cols-[minmax(0,.95fr)_minmax(360px,.9fr)_minmax(420px,1fr)]";
  const summaryCardsGridClass = data.demo
    ? "grid grid-cols-1 gap-5 lg:grid-cols-[minmax(260px,.35fr)_minmax(0,1fr)]"
    : "grid grid-cols-1 gap-5 lg:grid-cols-[minmax(280px,.36fr)_minmax(0,1fr)]";
  const videoFrameClass = data.demo
    ? "relative mx-auto aspect-[9/16] w-full max-w-[410px] overflow-hidden rounded border border-white/10 bg-black shadow-cyan"
    : "relative aspect-video overflow-hidden rounded border border-white/10 bg-black";
  const videoClass = data.demo
    ? "h-full w-full bg-black object-cover"
    : "h-full w-full bg-black object-contain";

  const videoCard = (
    <div className="panel relative overflow-hidden rounded-lg p-4">
      <div className="mb-3 flex items-center justify-between">
        <StatusPill>{data.demo ? "Preloaded Demo" : "Analysis Complete"}</StatusPill>
        <span className="font-display text-xs uppercase tracking-[0.18em] text-zinc-500">{id}</span>
      </div>
      <div className={videoFrameClass}>
        <video
          ref={videoRef}
          src={data.videoUrl}
          controls
          className={videoClass}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        <div className="pointer-events-none absolute left-4 top-4 rounded border border-cyan/40 bg-black/65 px-3 py-2 font-display text-xs uppercase tracking-[0.18em] text-cyan">
          REC / {currentTime.toFixed(2)}s
        </div>
      </div>
    </div>
  );

  const nowCard = (
    <div className="panel relative overflow-hidden rounded-lg p-4">
      <div className="flex items-center justify-between">
        <StatusPill tone="purple">Now</StatusPill>
        {isPlaying ? <Activity className="h-5 w-5 text-cyan" /> : <Play className="h-5 w-5 text-zinc-500" />}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
        <Metric icon={Zap} label="Dominant" value={formatBrainRegion(activeWindow?.dominant_region ?? "n/a")} />
        <Metric icon={Activity} label="Mean Activation" value={(activeWindow?.mean_activation ?? 0).toFixed(3)} />
        <Metric icon={Clock} label="Window" value={`${activeWindow?.start_time ?? 0}-${activeWindow?.end_time ?? 0}s`} />
      </div>
    </div>
  );

  const creatorBriefCard = (
    <div className="panel relative overflow-hidden rounded-lg p-5">
      <div className="mb-4 flex items-center gap-2">
        <BrainCircuit className="h-5 w-5 text-cyan" />
        <h2 className="font-display text-xl font-bold text-white">Creator brief</h2>
      </div>
      <div className="max-h-[300px] overflow-y-auto pr-2">
        <Markdownish text={data.brief || "Brief not generated yet."} compact />
      </div>
    </div>
  );

  const timelineCard = (
    <div className="panel relative overflow-hidden rounded-lg p-4">
      <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="font-display text-xl font-bold text-white">Brain activation timeline</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Click a brain region, frame, or scrub the video to sync the dashboard.
          </p>
        </div>
        <StatusPill>{data.metadata.durationSec.toFixed(0)} seconds</StatusPill>
      </div>
      <div className="h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 14, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="meanFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#00f2ff" stopOpacity={0.34} />
                <stop offset="100%" stopColor="#00f2ff" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: "#849495", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: "#849495", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
              tickFormatter={(value) => Number(value).toFixed(2)}
            />
            <Tooltip
              contentStyle={{ background: "#080808", border: "1px solid rgba(0,242,255,.3)", borderRadius: 4, color: "#fff" }}
              labelStyle={{ color: "#00f2ff" }}
            />
            <ReferenceLine x={Math.floor(currentTime / 2) * 2} stroke="#00f2ff" strokeDasharray="3 3" />
            <Area type="monotone" dataKey="mean" stroke="#00f2ff" fill="url(#meanFill)" strokeWidth={2} />
            {chartRegions.map((region) => (
              <Area
                key={region}
                type="monotone"
                dataKey={region}
                stroke={getBrainRegionColor(region)}
                fill="transparent"
                strokeWidth={focusedRegion === region ? 2.3 : 1.35}
                dot={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {regions.map((region) => {
          const isFocused = focusedRegion === region;
          return (
            <button
              key={region}
              type="button"
              onClick={() => setFocusedRegion(isFocused ? null : region)}
              className={`rounded border px-2.5 py-1 font-display text-[10px] uppercase tracking-[0.14em] transition ${
                isFocused ? "border-cyan bg-cyan text-black" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-cyan/50"
              }`}
            >
              <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: getBrainRegionColor(region) }} />
              {formatBrainRegion(region)}
            </button>
          );
        })}
      </div>
    </div>
  );

  const topSummaryContent = (
    <div className={topSummaryGridClass}>
      {videoCard}
      <BrainViewer3D
        activeWindow={activeWindow}
        windows={data.features.windows}
        currentTime={currentTime}
        isPlaying={isPlaying}
        focusedRegion={focusedRegion}
        onRegionFocus={setFocusedRegion}
      />
      {timelineCard}
    </div>
  );

  const summaryCardsContent = (
    <div className={summaryCardsGridClass}>
      {nowCard}
      {creatorBriefCard}
    </div>
  );

  const lowerDashboardContent = (
    <div className="min-w-0 space-y-5">
      <div className="space-y-5">
        {summaryCardsContent}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[.9fr_1.1fr]">
          <div className="panel relative overflow-hidden rounded-lg p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-white">Keyframes</h2>
              <StatusPill tone="muted">{data.metadata.frameCount} frames</StatusPill>
            </div>
            <div className="hide-scrollbar flex gap-3 overflow-x-auto pb-2">
              {data.frames.map((frame, index) => (
                <button
                  key={frame}
                  type="button"
                  onClick={() => seek(index)}
                  className={`relative h-28 w-20 shrink-0 overflow-hidden rounded border bg-black transition ${
                    frame === currentFrame ? "border-cyan shadow-cyan" : "border-white/10 opacity-70 hover:opacity-100"
                  }`}
                >
                  <Image src={frame} alt={`Frame ${index + 1}`} fill sizes="80px" className="object-cover" unoptimized />
                  <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 font-display text-[10px] text-cyan">{index}s</span>
                </button>
              ))}
            </div>
          </div>

          <div className="panel relative overflow-hidden rounded-lg p-4">
            <div className="mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-cyan" />
              <h2 className="font-display text-xl font-bold text-white">Transcript</h2>
            </div>
            <div className="max-h-40 overflow-y-auto text-sm leading-7 text-zinc-400">
              {data.transcript.map((word, index) => (
                <button
                  type="button"
                  key={`${word.word}-${word.start}-${index}`}
                  onClick={() => seek(word.start)}
                  className={`mr-1 rounded px-1 transition ${
                    currentWord === word ? "bg-cyan text-black" : "hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {word.word}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="panel relative overflow-hidden rounded-lg p-5 md:p-6">
        <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-purple-300" />
            <h2 className="font-display text-xl font-bold text-white">Neural diagnosis</h2>
          </div>
          <StatusPill tone="purple">Full analysis</StatusPill>
        </div>
        <Markdownish text={data.diagnosis || "Diagnosis not generated yet."} />
      </div>
    </div>
  );

  return (
    <section className="mx-auto max-w-[1900px] px-4 py-5 md:px-6">
      {data.demo ? (
        <div
          className={`grid grid-cols-1 gap-5 xl:items-start ${
            isDemoChatOpen
              ? "xl:grid-cols-[minmax(0,1fr)_380px]"
              : "xl:grid-cols-[minmax(0,1fr)_72px]"
          }`}
        >
          <div className="min-w-0 xl:col-start-1 xl:row-start-1">{topSummaryContent}</div>
          <div className="xl:col-start-2 xl:row-span-2 xl:row-start-1">
            <DemoChatRail id={id} isOpen={isDemoChatOpen} onToggle={() => setIsDemoChatOpen((current) => !current)} />
          </div>
          <div className="min-w-0 xl:col-start-1 xl:row-start-2">{lowerDashboardContent}</div>
        </div>
      ) : (
        <div className="min-w-0 space-y-5">
          {topSummaryContent}
          {lowerDashboardContent}
        </div>
      )}
    </section>
  );
}

function DemoChatRail({ id, isOpen, onToggle }: { id: string; isOpen: boolean; onToggle: () => void }) {
  const storageKey = `tribe-demo-chat:${id}`;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<DemoChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingTarget, setStreamingTarget] = useState("");

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      let cachedMessages: DemoChatMessage[] | null = null;

      try {
        const cached = window.localStorage.getItem(storageKey);
        if (cached) {
          const parsed = JSON.parse(cached) as DemoChatMessage[];
          if (Array.isArray(parsed) && parsed.length) {
            cachedMessages = parsed.map((message) => ({ ...message, streaming: false }));
          }
        }
      } catch {
        // Local storage is a demo convenience; the rail still works without it.
      }

      if (cachedMessages) {
        setMessages(cachedMessages);
        setStreamingMessageId(null);
        setStreamingTarget("");
        return;
      }

      const finalSeed = DEMO_CHAT_SEED.at(-1);
      if (!finalSeed) return;
      setMessages([
        ...DEMO_CHAT_SEED.slice(0, -1),
        { ...finalSeed, content: "", streaming: true }
      ]);
      setStreamingMessageId(finalSeed.id);
      setStreamingTarget(finalSeed.content);
    }, 0);

    return () => window.clearTimeout(initialize);
  }, [storageKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!streamingMessageId || !streamingTarget) return;
    const streamingMessage = messages.find((message) => message.id === streamingMessageId);
    if (!streamingMessage) return;

    const timer = window.setTimeout(() => {
      const nextLength = Math.min(streamingTarget.length, streamingMessage.content.length + 9);
      const isDone = nextLength >= streamingTarget.length;

      setMessages((current) =>
        current.map((message) =>
          message.id === streamingMessageId
            ? { ...message, content: streamingTarget.slice(0, nextLength), streaming: !isDone }
            : message
        )
      );

      if (isDone) {
        setStreamingMessageId(null);
        setStreamingTarget("");
      }
    }, 18);

    return () => window.clearTimeout(timer);
  }, [messages, streamingMessageId, streamingTarget]);

  useEffect(() => {
    if (!messages.length || messages.some((message) => message.streaming)) return;
    try {
      const serializable = messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content
      }));
      window.localStorage.setItem(storageKey, JSON.stringify(serializable));
    } catch {
      // Ignore local storage failures; the scripted chat can reseed on refresh.
    }
  }, [messages, storageKey]);

  const isStreaming = messages.some((message) => message.streaming);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isStreaming) return;

    const now = Date.now();
    const assistantId = `assistant-${now}`;
    const response = demoResponseFor(trimmed);
    setMessages((current) => [
      ...current,
      { id: `user-${now}`, role: "user", content: trimmed },
      { id: assistantId, role: "assistant", content: "", streaming: true }
    ]);
    setDraft("");
    setStreamingMessageId(assistantId);
    setStreamingTarget(response);
  }

  if (!isOpen) {
    return (
      <aside className="panel relative flex min-h-16 items-center justify-between overflow-hidden rounded-lg p-3 xl:sticky xl:top-20 xl:min-h-[calc(100vh-6.25rem)] xl:flex-col xl:justify-start xl:gap-4 xl:p-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label="Open Kimi conversation"
          className="grid h-11 w-11 place-items-center rounded border border-purple-300/35 bg-purple/15 text-purple-200 shadow-purple transition hover:border-cyan/60 hover:text-cyan"
        >
          <Bot className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2 xl:w-full xl:flex-none xl:-rotate-90 xl:justify-center xl:pt-20">
          <span className={`h-2 w-2 shrink-0 rounded-full ${isStreaming ? "animate-pulse bg-cyan" : "bg-emerald-300"}`} />
          <span className="truncate font-display text-xs font-bold uppercase tracking-[0.18em] text-white">Kimi K2.6</span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Expand Kimi sidebar"
          className="grid h-10 w-10 place-items-center rounded border border-white/10 bg-white/[0.03] text-zinc-400 transition hover:border-cyan/50 hover:text-cyan"
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="panel relative flex max-h-[620px] min-h-[520px] flex-col overflow-hidden rounded-lg xl:sticky xl:top-20 xl:max-h-[calc(100vh-6.25rem)] xl:min-h-[calc(100vh-6.25rem)]">
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded border border-purple-300/35 bg-purple/15 shadow-purple">
              <Bot className="h-5 w-5 text-purple-200" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-white">Kimi K2.6</h2>
              <div className="mt-1 flex items-center gap-2 font-display text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                <span className={`h-2 w-2 rounded-full ${isStreaming ? "animate-pulse bg-cyan" : "bg-emerald-300"}`} />
                Streaming demo
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-cyan" />
            <button
              type="button"
              onClick={onToggle}
              aria-label="Collapse Kimi sidebar"
              className="grid h-8 w-8 place-items-center rounded border border-white/10 bg-white/[0.03] text-zinc-400 transition hover:border-cyan/50 hover:text-cyan"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="hide-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message) => (
          <ChatBubble key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-white/10 bg-black/20 p-3">
        <div className="flex items-end gap-2 rounded border border-white/10 bg-white/[0.035] p-2 focus-within:border-cyan/55">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            rows={2}
            placeholder="Ask about hook, CTA, or peak moment"
            className="min-h-10 flex-1 resize-none border-0 bg-transparent px-1 py-1 text-sm leading-5 text-white outline-none placeholder:text-zinc-600"
          />
          <button
            type="submit"
            disabled={!draft.trim() || isStreaming}
            aria-label="Send message"
            className="grid h-10 w-10 shrink-0 place-items-center rounded border border-cyan/50 bg-cyan/15 text-cyan transition hover:bg-cyan hover:text-black disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-zinc-600"
          >
            {isStreaming ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </aside>
  );
}

function ChatBubble({ message }: { message: DemoChatMessage }) {
  const isAssistant = message.role === "assistant";
  const chips = isAssistant ? extractTimeChips(message.content) : [];

  return (
    <div className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[92%] rounded-lg border px-3 py-2.5 text-sm leading-6 ${
          isAssistant
            ? "border-purple-300/20 bg-purple/10 text-zinc-200"
            : "border-cyan/30 bg-cyan/15 text-cyanSoft"
        }`}
      >
        <div className="mb-1 font-display text-[10px] uppercase tracking-[0.16em] text-zinc-500">
          {isAssistant ? "Kimi" : "You"}
        </div>
        <p className="whitespace-pre-wrap">{message.content || " "}</p>
        {message.streaming ? (
          <span className="mt-2 inline-block h-2 w-2 animate-pulse rounded-full bg-cyan" />
        ) : null}
        {chips.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <span
                key={chip}
                className="rounded border border-cyan/30 bg-black/35 px-1.5 py-0.5 font-display text-[10px] uppercase tracking-[0.12em] text-cyan"
              >
                {chip}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function extractTimeChips(text: string) {
  return Array.from(new Set(text.match(/\b\d{1,2}(?:[-–]\d{1,2})?s\b/g) ?? []));
}

function demoResponseFor(prompt: string) {
  const lower = prompt.toLowerCase();
  return DEMO_CHAT_RESPONSES.find((response) =>
    response.match.some((token) => lower.includes(token))
  )?.content ?? DEMO_CHAT_FALLBACK;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-2 font-display text-[10px] uppercase tracking-[0.16em] text-zinc-500">
        <Icon className="h-3.5 w-3.5 text-cyan" />
        {label}
      </div>
      <div className="mt-2 break-words font-display text-lg font-bold text-white">{value}</div>
    </div>
  );
}

type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "rule" };

function parseMarkdownish(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const paragraph: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push({ type: "paragraph", text: paragraph.join(" ").trim() });
    paragraph.length = 0;
  }

  function flushList() {
    if (!listItems.length) return;
    blocks.push({ type: "list", ordered: listOrdered, items: listItems });
    listItems = [];
  }

  text.replace(/\r\n/g, "\n").split("\n").forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    const numberedSection = trimmed.match(/^\d+\.\s+\*\*([A-Z0-9'’\-\s]+)\*\*$/);
    if (numberedSection) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: 3, text: numberedSection[1] });
      return;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      return;
    }

    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushParagraph();
      flushList();
      blocks.push({ type: "rule" });
      return;
    }

    const orderedItem = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedItem) {
      flushParagraph();
      if (listItems.length && !listOrdered) flushList();
      listOrdered = true;
      listItems.push(orderedItem[1]);
      return;
    }

    const bulletItem = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bulletItem) {
      flushParagraph();
      if (listItems.length && listOrdered) flushList();
      listOrdered = false;
      listItems.push(bulletItem[1]);
      return;
    }

    flushList();
    paragraph.push(trimmed);
  });

  flushParagraph();
  flushList();
  return blocks;
}

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${part}-${index}`} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function Markdownish({ text, compact = false }: { text: string; compact?: boolean }) {
  const blocks = parseMarkdownish(text);

  return (
    <div className={`${compact ? "space-y-2.5 text-[13px] leading-5" : "space-y-4 text-sm leading-7"} text-zinc-300`}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const HeadingTag = block.level <= 2 ? "h3" : "h4";
          return (
            <HeadingTag
              key={`${block.text}-${index}`}
              className={`${compact ? "text-sm" : "text-base"} font-display font-bold uppercase tracking-[0.12em] text-white`}
            >
              {renderInline(block.text.replace(/\*\*/g, ""))}
            </HeadingTag>
          );
        }

        if (block.type === "rule") {
          return <hr key={`rule-${index}`} className="border-white/10" />;
        }

        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag
              key={`list-${index}`}
              className={`${block.ordered ? "list-decimal" : "list-disc"} space-y-2 pl-5 marker:text-cyan`}
            >
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{renderInline(item)}</li>
              ))}
            </ListTag>
          );
        }

        return (
          <p key={`${block.text.slice(0, 24)}-${index}`} className="text-zinc-300">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
