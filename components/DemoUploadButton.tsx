"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";

export function DemoUploadButton() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.click();
    }
  }

  function startDemo() {
    router.push("/processing/demo");
  }

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        className="rounded px-5 py-3 text-center font-display text-xs font-bold uppercase tracking-[0.18em] transition cyber-button"
      >
        View Demo
      </button>
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
        onChange={(event) => {
          if (event.target.files?.[0]) startDemo();
        }}
      />
    </>
  );
}
