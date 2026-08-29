"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/constants";

type Message = {
  role: "user" | "copilot";
  content: string;
  actions?: { label: string; href: string }[];
};

const QUICK_ACTIONS: Message["actions"] = [
  { label: "Book a lawyer", href: "/lawyers" },
  { label: "Fill a form", href: "/forms" },
  { label: "My dashboard", href: "/dashboard" },
  { label: "View pricing", href: "/pricing" },
];

export function Copilot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing, open]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("legalflow:copilot:open", onOpen);
    return () => window.removeEventListener("legalflow:copilot:open", onOpen);
  }, []);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || typing) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setTyping(true);
    try {
      const res = await fetch("/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { role: "copilot", content: data.reply ?? "Sorry, I hit a snag. Please try again.", actions: data.actions },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "copilot", content: "Sorry, I couldn't reach the server. Please try again in a moment." },
      ]);
    } finally {
      setTyping(false);
    }
  }

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg ring-1 transition",
          open
            ? "bg-primary-800 text-white ring-primary-700"
            : "bg-gold-500 text-primary-900 ring-gold-400 hover:bg-gold-400"
        )}
        aria-label={open ? "Close LegalFlow Copilot" : "Open LegalFlow Copilot"}
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13a9 9 0 0118 0 9 9 0 01-9 9H7.5a4.5 4.5 0 01-4.5-4.5V13z"
            />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[70vh] w-[min(92vw,24rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-primary-100">
          {/* Header */}
          <div className="flex items-center gap-3 bg-primary-800 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-500 text-primary-900">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13a9 9 0 0118 0 9 9 0 01-9 9H7.5a4.5 4.5 0 01-4.5-4.5V13z"
                />
              </svg>
            </div>
            <div>
              <p className="font-heading text-sm font-bold text-white">LegalFlow Copilot</p>
              <p className="text-xs text-primary-200">
                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-middle" />
                Online · India legal-tech assistant
              </p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-primary-50/50 p-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm text-legal-700 shadow-sm">
                  Namaste. I&apos;m the LegalFlow Copilot — I can book you a verified lawyer, fill forms from your
                  profile, or pull up your dashboard. How can I help?
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_ACTIONS?.map((a) => (
                    <Link
                      key={a.href + a.label}
                      href={a.href}
                      onClick={() => setOpen(false)}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-primary-700 ring-1 ring-primary-100 transition hover:bg-gold-50 hover:text-gold-600 hover:ring-gold-200"
                    >
                      {a.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-sm bg-gold-500 px-4 py-2.5 text-sm text-primary-900">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[92%] space-y-2">
                    <div className="whitespace-pre-line rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-sm text-legal-700 shadow-sm">
                      {m.content}
                    </div>
                    {m.actions && (
                      <div className="flex flex-wrap gap-2 pl-1">
                        {m.actions.map((a) => (
                          <Link
                            key={a.href + a.label}
                            href={a.href}
                            onClick={() => setOpen(false)}
                            className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-primary-700 ring-1 ring-primary-100 transition hover:bg-gold-50 hover:text-gold-600 hover:ring-gold-200"
                          >
                            {a.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}

            {typing && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-white px-4 py-3 shadow-sm">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-400" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-400 [animation-delay:0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-400 [animation-delay:0.3s]" />
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-primary-100 bg-white p-3"
          >
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about lawyers, forms, fees…"
                className="input h-11 flex-1"
                aria-label="Message the Copilot"
              />
              <button
                type="submit"
                disabled={!input.trim() || typing}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-800 text-white transition hover:bg-primary-700 disabled:opacity-40"
                aria-label="Send message"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-legal-muted">
              Copilot guidance is not a substitute for a lawyer&apos;s advice.
            </p>
          </form>
        </div>
      )}
    </>
  );
}
