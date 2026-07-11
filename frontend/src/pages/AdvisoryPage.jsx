import { useEffect, useRef, useState } from "react";
import { useUI } from "../store";
import { getStrings } from "../i18n";
import { advisoryHealth, advisoryContext, streamAdvisoryChat } from "../api/api";

export default function AdvisoryPage() {
  const lang = useUI((s) => s.lang);
  const t = getStrings(lang);

  const [health, setHealth]     = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [busy, setBusy]         = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [contextData, setContextData] = useState(null);

  const abortRef = useRef(null);
  const scrollRef = useRef(null);

  // Health probe on mount, then every 30s so the banner auto-clears when Ollama starts
  useEffect(() => {
    const probe = () => advisoryHealth().then(setHealth).catch(() => setHealth({ ok: false }));
    probe();
    const id = setInterval(probe, 30_000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  async function loadContext() {
    try {
      const d = await advisoryContext();
      setContextData(d);
      setContextOpen(true);
    } catch { /* noop */ }
  }

  async function handleSend(text) {
    const content = (text ?? input).trim();
    if (!content || busy) return;

    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);

    // Append an empty assistant message we'll fill in as tokens arrive
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    abortRef.current = new AbortController();
    try {
      let acc = "";
      for await (const chunk of streamAdvisoryChat({
        messages: next, lang, signal: abortRef.current.signal,
      })) {
        acc += chunk;
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant") {
            copy[copy.length - 1] = { role: "assistant", content: `[Error] ${err.message}` };
          }
          return copy;
        });
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function handleStop() {
    if (abortRef.current) abortRef.current.abort();
  }

  function clearChat() {
    if (busy) handleStop();
    setMessages([]);
    setContextData(null); // force re-fetch so "View context" always shows current DB state
  }

  const offline = health && !health.ok;
  const modelMissing = health?.ok && !health.model_loaded;

  return (
    <div className="advisory-page">
      {/* Page background — fixed so it doesn't scroll with the chat */}
      <div
        className="advisory-bg"
        aria-hidden="true"
        style={{ backgroundImage: "url(/advisory-bg.jpg)" }}
      />

      <div className="pg-eyebrow" style={{ position: "relative", color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}>
        {t.eyebrow}
      </div>
      <div className="pg-title-row" style={{ position: "relative" }}>
        <div className="pg-title" style={{ marginBottom: 0, color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>
          {t.advisoryLbl}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="chip" onClick={loadContext}>{t.contextDrawer}</button>
          <button className="chip" onClick={clearChat} disabled={messages.length === 0}>
            {t.clearChat}
          </button>
        </div>
      </div>

      {/* Status banner */}
      {offline && (
        <div className="card alert-card-full" style={{ borderLeft: "3px solid #ef4444", marginBottom: 12 }}>
          <span className="badge badge-high"><span className="badge-dot" />Offline</span>
          <div style={{ flex: 1, fontSize: 12.5 }}>
            {t.ollamaOffline}
          </div>
        </div>
      )}
      {modelMissing && (
        <div className="card alert-card-full" style={{ borderLeft: "3px solid #f97316", marginBottom: 12 }}>
          <span className="badge badge-medium"><span className="badge-dot" />Model</span>
          <div style={{ flex: 1, fontSize: 12.5 }}>
            {t.modelNotPulled}
          </div>
        </div>
      )}

      {/* Chat surface — transparent so the paddy painting shows through */}
      <div className="card advisory-chat-card" style={{
        display: "flex", flexDirection: "column",
        height: "calc(100vh - 230px)", minHeight: 480,
        position: "relative",
      }}>
        {/* Header strip */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "14px 18px", borderBottom: "1px solid var(--border)",
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
              {health?.model || "llama3"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
              {t.chatHint}
            </div>
          </div>
          <div className="live-pill">
            <div className="live-dot" style={{ background: health?.ok ? "#4a9a60" : "#ef4444" }} />
            {health?.ok ? "Online" : "Offline"}
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{
          flex: 1, overflowY: "auto", padding: "16px 18px",
        }}>
          {messages.length === 0 && (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 18 }}>
              <div style={{ fontSize: 36, lineHeight: 1 }}>🤖</div>
              <div style={{ textAlign: "center", maxWidth: 460 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 6, textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>
                  {t.advisoryLbl}
                </div>
                <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)", lineHeight: 1.55, textShadow: "0 1px 6px rgba(0,0,0,0.45)" }}>
                  {t.advisorySub}
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 640 }}>
                {t.examplePrompts.map((p, i) => (
                  <button
                    key={i}
                    className="chip"
                    style={{ background: "rgba(255,255,255,0.85)", color: "var(--text)" }}
                    onClick={() => handleSend(p)}
                  >{p}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <ChatBubble key={i} role={m.role} content={m.content} streaming={busy && i === messages.length - 1} />
          ))}
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          style={{
            display: "flex", gap: 8, padding: "12px 14px",
            borderTop: "1px solid var(--border)", background: "rgba(255,255,255,0.6)",
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.askPlaceholder}
            disabled={busy || offline}
            className="date-input"
            style={{
              flex: 1, padding: "10px 14px", fontSize: 13,
              borderRadius: 12,
            }}
          />
          {busy ? (
            <button type="button" className="btn-primary" onClick={handleStop}
                    style={{ background: "#dc2626", borderRadius: 12 }}>
              ■ Stop
            </button>
          ) : (
            <button type="submit" className="btn-primary" disabled={!input.trim() || offline}
                    style={{ borderRadius: 12 }}>
              {t.sendBtn} →
            </button>
          )}
        </form>
      </div>

      {/* Context drawer */}
      {contextOpen && contextData && (
        <ContextDrawer data={contextData} onClose={() => setContextOpen(false)} t={t} />
      )}
    </div>
  );
}

/* ──────────────────────────── Chat bubble ──────────────────────────── */
function ChatBubble({ role, content, streaming }) {
  const isUser = role === "user";
  const isError = !isUser && content.startsWith("[Error]");
  return (
    <div style={{
      display: "flex", gap: 10, marginBottom: 14,
      flexDirection: isUser ? "row-reverse" : "row",
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14,
        background: isUser ? "rgba(132,204,22,0.85)" : "rgba(20,40,24,0.92)",
        color: isUser ? "#1a1a1a" : "#fff",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.30)",
      }}>{isUser ? "👤" : "🌾"}</div>

      <div style={{
        maxWidth: "78%",
        padding: "10px 14px",
        borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
        background: isError ? "rgba(254,242,242,0.92)"
                  : isUser  ? "rgba(132,204,22,0.30)"
                            : "rgba(255,255,255,0.85)",
        border: isError ? "1px solid rgba(252,165,165,0.6)"
              : isUser  ? "1px solid rgba(255,255,255,0.40)"
                        : "1px solid rgba(255,255,255,0.50)",
        backdropFilter: "blur(10px) saturate(140%)",
        WebkitBackdropFilter: "blur(10px) saturate(140%)",
        color: isError ? "#dc2626" : "#1a1a1a",
        fontSize: 13, lineHeight: 1.55,
        whiteSpace: "pre-wrap", wordBreak: "break-word",
        boxShadow: "0 4px 18px rgba(0,0,0,0.18)",
      }}>
        {content || (streaming ? <TypingDots /> : null)}
        {streaming && content && (
          <span className="cursor-blink" style={{ marginLeft: 2 }}>▍</span>
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 4 }}>
      <span className="dot" />
      <span className="dot" style={{ animationDelay: "0.15s" }} />
      <span className="dot" style={{ animationDelay: "0.30s" }} />
    </span>
  );
}

/* ──────────────────────────── Context drawer ──────────────────────────── */
function ContextDrawer({ data, onClose, t }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100,
        display: "flex", justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(640px, 92%)", height: "100%",
          background: "#fff", padding: 24, overflow: "auto",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.18)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div className="sec-label" style={{ marginBottom: 0 }}>System prompt</div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
              This is what the LLM sees on every turn.
            </div>
          </div>
          <button className="chip" onClick={onClose}>✕</button>
        </div>
        <pre style={{
          fontFamily: "JetBrains Mono, monospace", fontSize: 11, lineHeight: 1.55,
          background: "#1a1a1a", color: "#e5e7eb",
          padding: 16, borderRadius: 12, overflow: "auto",
          whiteSpace: "pre-wrap",
        }}>
{data.system_prompt_en}
        </pre>
      </div>
    </div>
  );
}
