import { useEffect, useMemo, useState } from "react";
import ui from "../styles/primitives.module.scss";
import { TripleAApiClient } from "../api/client";
import type { ChatConversation, ChatMessage } from "../types";
import { Button } from "../components/Button";
import { useAuth } from "../auth/AuthContext";
import { getApiBaseUrl } from "../lib/env";

export function ChatInbox() {
  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: getApiBaseUrl() }),
    [],
  );
  const { user } = useAuth();

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setLoadingThreads(true);
    setError(null);
    api
      .chatListConversations()
      .then((data) => {
        setConversations(data);
        if (!selectedId && data.length > 0) setSelectedId(data[0]!.id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingThreads(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    setError(null);
    api
      .chatListMessages(selectedId)
      .then((data) => setMessages(data))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingMessages(false));
  }, [api, selectedId]);

  async function contactSupport() {
    setError(null);
    try {
      const conv = await api.chatGetOrCreateSupportConversation();
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === conv.id);
        return exists ? prev : [conv, ...prev];
      });
      setSelectedId(conv.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function send() {
    if (!selectedId || !draft.trim()) return;
    const body = draft.trim();
    setDraft("");
    setError(null);
    try {
      const msg = await api.chatSendMessage({
        conversationId: selectedId,
        body,
      });
      setMessages((prev) => [...prev, msg]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDraft(body);
    }
  }

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Button variant="secondary" onClick={contactSupport}>
          Contact support
        </Button>
      </div>

      {error && <p className={ui.error}>{error}</p>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(240px, 340px) 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div className={[ui.card, ui.cardPad].join(" ")}>
          <p style={{ fontWeight: 700, marginBottom: 10 }}>Threads</p>
          {loadingThreads && <p className={ui.help}>Loading…</p>}
          {!loadingThreads && conversations.length === 0 && (
            <p className={ui.help}>No conversations yet.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                style={{
                  textAlign: "left",
                  padding: 10,
                  borderRadius: 12,
                  border:
                    c.id === selectedId
                      ? "1px solid var(--focus)"
                      : "1px solid var(--border)",
                  background:
                    c.id === selectedId
                      ? "color-mix(in srgb, var(--surface) 85%, transparent)"
                      : "transparent",
                  color: "var(--text)",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {c.title ?? "Conversation"}
                </div>
                <div className={ui.help}>
                  {new Date(c.updatedAt).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className={[ui.card, ui.cardPad].join(" ")}>
          <p style={{ fontWeight: 700, marginBottom: 10 }}>
            {selected?.title ?? "Conversation"}
          </p>
          {loadingMessages && <p className={ui.help}>Loading messages…</p>}
          {!loadingMessages && !selectedId && (
            <p className={ui.help}>Select a thread to view messages.</p>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              padding: 10,
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "color-mix(in srgb, var(--surface) 85%, transparent)",
              minHeight: 280,
              maxHeight: 480,
              overflow: "auto",
            }}
          >
            {messages.length === 0 && selectedId && (
              <p className={ui.help}>No messages yet.</p>
            )}
            {messages.map((m) => {
              const mine = user?.id && m.senderId === user.id;
              return (
                <div
                  key={m.id}
                  style={{
                    alignSelf: mine ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: "1px solid var(--border)",
                    background: mine
                      ? "color-mix(in srgb, var(--primary) 22%, var(--surface))"
                      : "var(--surface)",
                  }}
                >
                  <div style={{ fontSize: 13, lineHeight: 1.35 }}>{m.body}</div>
                  <div className={ui.help} style={{ marginTop: 6 }}>
                    {new Date(m.createdAt).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 12,
              display: "flex",
              gap: 10,
              alignItems: "center",
            }}
          >
            <input
              className={ui.input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={selectedId ? "Type a message…" : "Select a thread…"}
              disabled={!selectedId}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <Button
              onClick={() => void send()}
              disabled={!selectedId || !draft.trim()}
            >
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
