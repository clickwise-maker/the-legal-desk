"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/constants";

type Message = {
  role: "user" | "copilot";
  content: string;
  actions?: { label: string; href: string }[];
};

type AgentMode = "research" | "compliance" | "summary" | "book" | "fill";

const AGENTS: Array<{ id: AgentMode; label: string; desc: string; prompt: string }> = [
  { id: "research", label: "Research", desc: "Legal answers & rights", prompt: "Can you research my legal question in plain language?" },
  { id: "compliance", label: "Compliance", desc: "India filings & rules", prompt: "What compliance do I need to be aware of for my situation?" },
  { id: "summary", label: "Summary", desc: "Your account at a glance", prompt: "Give me a summary of my dashboard, forms and bookings." },
  { id: "book", label: "Book Lawyer", desc: "Match with verified advocates", prompt: "Help me book a verified lawyer." },
  { id: "fill", label: "Fill Form", desc: "Auto-fill from your profile", prompt: "Help me fill a form from my profile." },
];

export function CopilotWorkspace({ authed }: { authed: boolean }) {
  const [mode, setMode] = useState<AgentMode | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

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

  function runAgent(agent: AgentMode) {
    setMode(agent);
    const a = AGENTS.find((x) => x.id === agent);
    if (a) send(a.prompt);
  }

  return (
    <div className="container-legal py-10">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <span className="badge bg-gold-50 text-gold-500 ring-1 ring-gold-100">LegalFlow Copilot</span>
          <h1 className="mt-4 font-heading text-3xl font-bold text-primary-800 sm:text-4xl">
            Your legal desk, in one conversation
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-legal-muted">
            Pick an agent or just ask. The Copilot routes to the right specialist —
            research, compliance, booking or form-filling — and hands you to a
            human lawyer when needed.
          </p>
          {!authed && (
            <p className="mx-auto mt-3 max-w-md rounded-lg bg-primary-50 px-4 py-2 text-sm text-primary-700">
              You&apos;re browsing as a guest.{" "}
              <Link href="/login" className="font-semibold text-gold-500 hover:text-gold-400">
                Sign in
              </Link>{" "}
              for personalised summaries and booking.
            </p>
          )}
        </div>

        {/* Agent selector */}
        <div className="mt-8 grid gap-3 sm:grid-cols-5">
          {AGENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => runAgent(a.id)}
              className={cn(
                "rounded-xl border px-3 py-4 text-left transition",
                mode === a.id
                  ? "border-gold-400 bg-gold-50 ring-2 ring-gold-200"
                  : "border-primary-200 bg-white hover:border-gold-300"
              )}
            >
              <span className="block font-heading text-sm font-bold text-primary-800">{a.label}</span>
              <span className="mt-1 block text-xs text-legal-muted">{a.desc}</span>
            </button>
          ))}
        </div>

        {/* Chat thread */}
        <div className="card mt-8 flex h-[32rem] flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-primary-50/40 p-5">
            {messages.length === 0 && (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-md text-center">
                  <p className="text-legal-muted">
                    Ask me anything — for example: “What are my tenant rights under the BNS?”, “Book me a family
                    lawyer in Pune”, or “Summarise my account”.
                  </p>
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] whitespace-pre-line rounded-2xl rounded-br-sm bg-gold-500 px-4 py-2.5 text-sm text-primary-900">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[90%] space-y-2">
                    <div className="whitespace-pre-line rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-sm text-legal-700 shadow-sm">
                      {m.content}
                    </div>
                    {m.actions && (
                      <div className="flex flex-wrap gap-2 pl-1">
                        {m.actions.map((a) => (
                          <Link
                            key={a.href + a.label}
                            href={a.href}
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
            className="border-t border-primary-100 bg-white p-4"
          >
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the Copilot anything…"
                className="input h-12 flex-1"
                aria-label="Message the Copilot"
              />
              <button
                type="submit"
                disabled={!input.trim() || typing}
                className="btn-gold h-12 px-5 disabled:opacity-40"
              >
                Send
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-legal-muted">
              Copilot guidance is not a substitute for a lawyer&apos;s advice. Sensitive details are never stored from chat.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
