"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

type Props = { onResult: (text: string) => void; disabled?: boolean };

export default function MicButton({ onResult, disabled }: Props) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    recognitionRef.current = new SR();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = "en-US";
    recognitionRef.current.onresult = (e: any) => {
      const r = e.results?.[e.resultIndex];
      if (!r) return;
      if (r.isFinal) {
        const text = r[0]?.transcript || "";
        if (text) onResult(text);
        setListening(false);
      }
    };
    recognitionRef.current.onerror = () => setListening(false);
  }, [onResult]);

  const start = () => {
    if (disabled) return;
    if (!recognitionRef.current) return;
    try {
      setListening(true);
      recognitionRef.current.start();
    } catch {
      setListening(false);
    }
  };

  const stop = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setListening(false);
  };

  const supported = typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const title = supported ? (listening ? "Stop recording" : "Start voice input") : "Voice input not supported in this browser";
  return (
    <button
      onClick={listening ? stop : start}
      disabled={disabled || !supported}
      aria-disabled={disabled || !supported}
      className={`ml-2 inline-flex items-center gap-2 rounded-md px-3 py-2 text-white ${listening ? 'bg-red-500' : 'bg-gray-900'} disabled:opacity-50`}
      title={title}
    >
      {listening ? (
        <span className="relative inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-200 animate-ping"></span>
          <span className="absolute inline-block h-2 w-2 rounded-full bg-white"></span>
          <Square size={16} />
        </span>
      ) : (
        <Mic size={16} />
      )}
      {listening ? "Stop" : "Speak"}
    </button>
  );
}
