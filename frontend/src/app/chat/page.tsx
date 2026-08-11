"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, Upload, X, FileText, Send,
  Square, Check, Copy, ChevronDown, Settings, SlidersHorizontal, LogOut,
} from "lucide-react";
import OrgSwitcher from "@/components/org-switcher";
import ScopeSwitcher from "@/components/scope-switcher";
import { Logo, LogoMark } from "@/components/Logo";
import { Preloader as BrandPreloader, LoaderRing } from "@/components/Preloader";
import { API, apiFetch, getToken } from "@/lib/api";
import { ToastBar, useToast } from "@/components/Toast";

// ── Types ──────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources?: { text: string; source: string; page: number }[];
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  scope?: string;
}

interface Document {
  name: string;
  size: string;
  size_bytes: number;
  uploaded_at: string;
  department?: string;
}

interface CurrentUser {
  id: string;
  username: string;
  email: string;
  role: string;
  company?: string;
  can_upload?: boolean;
  department_id?: string | null;
  active_org_id?: string;
}

// ── Skeleton ──────────────────────────────────────────────────────────────

function ConvSkeleton() {
  return (
    <div className="space-y-2 px-2 pt-1">
      {[80, 65, 72, 55].map((w, i) => (
        <div key={i} className="py-2.5 px-3 rounded-lg">
          <div className="skeleton h-3 rounded mb-1.5" style={{ width: `${w}%` }} />
          <div className="skeleton h-2.5 rounded" style={{ width: "40%" }} />
        </div>
      ))}
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center gap-1 px-5 py-3.5 bubble-assistant w-fit">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="typing-dot w-1.5 h-1.5 bg-[var(--ink-soft)] rounded-full inline-block"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Message item ──────────────────────────────────────────────────────────

// Turns raw "[1]", "[2]" ... citation markers from the model into small
// clickable badges instead of showing them as bare bracket text. Numbers
// map 1-indexed into message.sources, matching how the backend built the
// numbered context block the model was citing against - out-of-range or
// malformed numbers are left as plain text rather than breaking the render.
function renderWithCitations(
  content: string,
  sources: Message["sources"],
  onCite: (sourceFile: string) => void
) {
  if (!sources || sources.length === 0) return content;

  const parts = content.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (!match) return part;
    const idx = parseInt(match[1], 10) - 1;
    const source = sources[idx];
    if (!source) return part;
    return (
      <button
        key={i}
        onClick={() => onCite(source.source)}
        title={`${source.source}${source.page > 0 ? ` (p. ${source.page})` : ""}`}
        className="citation-badge"
      >
        {idx + 1}
      </button>
    );
  });
}

function MessageItem({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);

  const copy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // CHANGE 3: format timestamp
  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  // Group excerpts by source file - a chunky document can return several
  // excerpts from the same PDF, which previously rendered as repeated,
  // identical-looking pills that overflowed the row.
  const groupedSources = (message.sources ?? []).reduce<Record<string, { source: string; page: number; text: string }[]>>(
    (acc, s) => {
      (acc[s.source] ??= []).push(s);
      return acc;
    },
    {}
  );
  const sourceFiles = Object.keys(groupedSources);

  return (
    <div className={`px-4 py-2.5 message-enter ${isUser ? "flex justify-end" : ""}`}>
      <div className={`flex flex-col ${isUser ? "items-end max-w-xl" : "items-start max-w-none"}`}>
        <div
          className={`px-5 py-3.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser ? "bubble-user" : "bubble-assistant w-full"
          }`}
        >
          {isUser ? message.content : renderWithCitations(message.content, message.sources, (file) => setExpandedSource(file))}
        </div>

        {/* CHANGE 3: timestamp shown under every message */}
        <span className="text-[10px] text-[var(--ink-soft)] mt-1 px-1">
          {formatTime(message.timestamp)}
        </span>

        {!isUser && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1 px-1 w-full">
            {sourceFiles.length > 0 && (
              <span className="text-xs font-medium text-[var(--ink-soft)] shrink-0">Sources:</span>
            )}
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              {sourceFiles.map((file) => {
                const excerpts = groupedSources[file];
                const isOpen = expandedSource === file;
                return (
                  <button
                    key={file}
                    onClick={() => setExpandedSource(isOpen ? null : file)}
                    className={`chip-source max-w-[220px] ${isOpen ? "chip-source-active" : ""}`}
                    title={file}
                  >
                    <FileText className="w-3 h-3 shrink-0" />
                    <span className="truncate">{file}</span>
                    {excerpts.length > 1 && (
                      <span className="shrink-0 text-[10px] opacity-70">×{excerpts.length}</span>
                    )}
                    <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                );
              })}
            </div>
            <button
              onClick={copy}
              className="flex items-center gap-1 text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors ml-auto shrink-0"
            >
              {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
            </button>
          </div>
        )}

        {expandedSource && groupedSources[expandedSource] && (
          <div className="mt-2 space-y-1.5 w-full">
            {groupedSources[expandedSource].map((s, i) => (
              <div key={i} className="px-3 py-2 card-bordered text-xs text-[var(--ink-soft)]">
                <span className="font-medium text-[var(--ink)]">{s.source}</span>
                {s.page > 0 && <span className="ml-1 text-[var(--ink-soft)]">(p. {s.page})</span>}
                <p className="mt-0.5 line-clamp-2">{s.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Message list ──────────────────────────────────────────────────────────

function MessageList({ messages, isTyping, loadingConvs }: { messages: Message[]; isTyping: boolean; loadingConvs: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  if (loadingConvs) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoaderRing size={28} tone="inline" />
      </div>
    );
  }

  if (messages.length === 0 && !isTyping) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-xs page-enter">
          <div className="inline-flex mb-5 logo-enter">
            <LogoMark size={48} />
          </div>
          <h2 className="font-display text-base font-bold text-[var(--ink)] mb-2">Ask anything</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-relaxed">
            Upload documents and ask questions to get instant answers from your knowledge base.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto py-6">
        {messages.map((msg) => (
          <MessageItem key={msg.id} message={msg} />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={endRef} />
      </div>
    </div>
  );
}


// ── Chat input ────────────────────────────────────────────────────────────

function ChatInput({ onSubmit, disabled, onStop }: { onSubmit: (v: string) => void; disabled: boolean; onStop: () => void }) {
  const [input, setInput] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = Math.min(ref.current.scrollHeight, 140) + "px";
    }
  }, [input]);

  const submit = () => {
    const v = input.trim();
    if (v && !disabled) { onSubmit(v); setInput(""); }
  };

  return (
    <div className="px-4 py-4 border-t border-[var(--line)] bg-[var(--paper)]">
      <div className="max-w-3xl mx-auto">
        {/* CHANGE 1: removed focus-within border highlight, outline-none on wrapper */}
        <div className="flex gap-3 items-end px-4 py-3 input-bordered transition-colors [&:focus-within]:outline-none [&:focus-within]:ring-0 [&:focus-within]:border-transparent [&:focus-within]:shadow-none">
          <textarea
            ref={ref}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="Ask anything…"
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent text-[var(--ink)] placeholder-[var(--ink-faint)] outline-none resize-none text-sm leading-relaxed py-0.5 max-h-32 disabled:opacity-60"
          />
          {disabled ? (
            <button
              onClick={onStop}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded border border-[var(--danger-border)] bg-[var(--danger-bg)] hover:bg-[var(--danger-bg-hover)] text-[var(--danger-text)] transition-colors"
              title="Stop"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!input.trim()}
              className="btn-accent flex-shrink-0 w-8 h-8 flex items-center justify-center disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

const genId = () => Math.random().toString(36).slice(2, 11);

export default function Home() {
  const router = useRouter();
  const { toasts, toast, dismiss } = useToast();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [activeScope, setActiveScope] = useState<string>("general");

  const [loading, setLoading] = useState(false);
  // CHANGE 2: searching removed - preloader no longer shown after prompt
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Departments the current user heads (or belongs to) - needed to know
  // whether they can upload to the active scope. See canUpload below.
  const [headedDepartmentIds, setHeadedDepartmentIds] = useState<string[]>([]);

  const [documents, setDocuments] = useState<Document[]>([]);
  // Defaults open - collapsed-by-default was hiding the document list (and
  // its delete controls) behind an easy-to-miss toggle.
  const [showDocs, setShowDocs] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [backendOnline, setBackendOnline] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Auth check ──────────────────────────────────────────────────────────

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace("/login"); return; }
    const stored = localStorage.getItem("user");
    if (!stored) { router.replace("/login"); return; }
    setCurrentUser(JSON.parse(stored));
    setAuthChecked(true);
  }, [router]);

  // ── Departments this user heads (drives upload permission) ──────────────

  useEffect(() => {
    if (!authChecked || !currentUser) return;
    if (currentUser.role === "admin" || currentUser.role === "manager") return;
    apiFetch("/api/departments")
      .then((res) => (res.ok ? res.json() : { departments: [] }))
      .then((data) => {
        const headed = (data.departments || [])
          .filter((d: { head_user_id?: string | null }) => d.head_user_id === currentUser.id)
          .map((d: { id: string }) => d.id);
        setHeadedDepartmentIds(headed);
      })
      .catch(() => {});
  }, [authChecked, currentUser]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSidebarOpen(true); }
      if (e.key === "Escape") { setSidebarOpen(false); setUserMenuOpen(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Close the user dropdown on any click outside it - the trigger button
  // itself toggles the menu, so it's deliberately excluded from this check.
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [userMenuOpen]);

  // ── Load conversations from API ─────────────────────────────────────────

  // `isRefresh` distinguishes a background re-sync (polling, tab refocus)
  // from the initial load: only the initial load is allowed to auto-select
  // a conversation, otherwise every poll would hijack whatever the user is
  // currently looking at back to the first General conversation.
  const loadConversations = useCallback(async (isRefresh = false) => {
    if (!authChecked) return;
    try {
      const res = await apiFetch("/api/conversations");
      if (!res.ok) { if (res.status === 401) { router.replace("/login"); return; } throw new Error(); }
      const data: Conversation[] = await res.json();

      if (isRefresh) {
        // Keep the actively open conversation from flashing/reverting mid
        // read - a background refresh only needs to bring in what changed
        // elsewhere (new messages, renamed/deleted conversations).
        setConversations(data);
        return;
      }

      setConversations(data);
      // Only auto-select within the default landing scope ("general") - an
      // unscoped data[0] pick could land on a conversation from a department
      // the switcher hasn't even shown yet.
      const generalConvs = data.filter((c) => (c.scope ?? "general") === "general");
      if (generalConvs.length > 0) {
        setCurrentConvId(generalConvs[0].id);
      } else if (data.length === 0) {
        const id = genId();
        await apiFetch("/api/conversations", { method: "POST", body: JSON.stringify({ id, title: "New Conversation", scope: "general" }) });
        setConversations([{ id, title: "New Conversation", messages: [], createdAt: new Date().toISOString(), scope: "general" }]);
        setCurrentConvId(id);
      }
      // else: conversations exist, just none in "general" yet - leave
      // currentConvId unset; "New chat" will create one in the active scope.
    } catch {
      if (isRefresh) return;
      const id = genId();
      setConversations([{ id, title: "New Conversation", messages: [], createdAt: new Date().toISOString(), scope: "general" }]);
      setCurrentConvId(id);
    } finally {
      setLoadingConvs(false);
    }
  }, [authChecked, router]);

  const loadDocuments = useCallback(async () => {
    try {
      // Keep the document panel consistent with whatever scope is active in
      // the chat switcher. "all" (admin/manager only) omits the filter so
      // they see every department at once for management purposes.
      const q = activeScope !== "all" ? `?department=${encodeURIComponent(activeScope)}` : "";
      const res = await apiFetch(`/api/documents${q}`);
      if (res.ok) { const d = await res.json(); setDocuments(d.documents || []); }
    } catch { /* offline */ }
  }, [activeScope]);

  const checkStatus = useCallback(async () => {
    try {
      const res = await apiFetch("/api/status", {}, 5000);
      setBackendOnline(res.ok);
    } catch { setBackendOnline(false); }
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    loadConversations();
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [authChecked, loadConversations, checkStatus]);

  // Separate from the above so switching scope only re-scopes the document
  // list - it must NOT re-trigger loadConversations, which would override
  // the scope-switch's currentConvId reset with an unscoped auto-select.
  useEffect(() => {
    if (!authChecked) return;
    loadDocuments();
  }, [authChecked, loadDocuments]);

  // ── Cross-device sync ────────────────────────────────────────────────────
  // Short-poll conversations/documents in the background so a message sent
  // or a document uploaded from another device (or tab) shows up here
  // without the user having to refresh. Skipped while a response is
  // streaming so it can't clobber the in-progress assistant message.
  useEffect(() => {
    if (!authChecked) return;

    const sync = () => {
      if (loading) return;
      loadConversations(true);
      loadDocuments();
    };

    const interval = setInterval(sync, 6000);
    const onVisible = () => { if (document.visibilityState === "visible") sync(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", sync);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", sync);
    };
  }, [authChecked, loading, loadConversations, loadDocuments]);

  // ── Derived state ───────────────────────────────────────────────────────

  const currentConv = conversations.find((c) => c.id === currentConvId);
  const currentMessages = currentConv?.messages ?? [];

  const isPrivileged = currentUser?.role === "admin" || currentUser?.role === "manager";
  // Admin/manager can upload to any department (or General); a department
  // head can only upload to the specific department(s) they head - never
  // General, per the department scoping design (see backend
  // _can_upload_to). The old flat currentUser.can_upload flag had no
  // department awareness and never reflected headship at all.
  const canUpload = isPrivileged || headedDepartmentIds.includes(activeScope);
  // "all" isn't a real scope tag conversations carry - it's a cross-scope
  // browsing mode, so it shows every conversation instead of filtering.
  const scopedConversations = activeScope === "all"
    ? conversations
    : conversations.filter((c) => (c.scope ?? "general") === activeScope);

  // ── Conversation actions ────────────────────────────────────────────────

  const createConversation = async (scope: string = activeScope) => {
    const id = genId();
    const conv: Conversation = { id, title: "New Conversation", messages: [], createdAt: new Date().toISOString(), scope };
    try {
      await apiFetch("/api/conversations", { method: "POST", body: JSON.stringify({ id, title: "New Conversation", scope }) });
    } catch { /* offline */ }
    setConversations((p) => [conv, ...p]);
    setCurrentConvId(id);
    setSidebarOpen(false);
  };

  const handleScopeSwitch = (scope: string) => {
    setActiveScope(scope);
    if (scope === "all") {
      // Cross-scope browsing mode - land on whatever's most recent across
      // every scope, or create a General conversation if there's nothing yet.
      if (conversations.length > 0) setCurrentConvId(conversations[0].id);
      else createConversation("general");
      return;
    }
    const existing = conversations.find((c) => (c.scope ?? "general") === scope);
    if (existing) {
      setCurrentConvId(existing.id);
    } else {
      createConversation(scope);
    }
  };

  const deleteConversation = async (id: string) => {
    try {
      await apiFetch(`/api/conversations/${id}`, { method: "DELETE" });
    } catch { /* offline */ }
    setConversations((p) => p.filter((c) => c.id !== id));
    if (currentConvId === id) {
      const remaining = conversations.filter((c) => c.id !== id);
      if (remaining.length > 0) setCurrentConvId(remaining[0].id);
      else createConversation();
    }
  };

  const updateTitle = async (id: string, firstMsg: string) => {
    const title = firstMsg.slice(0, 36) + (firstMsg.length > 36 ? "…" : "");
    try {
      await apiFetch(`/api/conversations/${id}/title`, { method: "PUT", body: JSON.stringify({ title }) });
    } catch { /* offline */ }
    setConversations((p) => p.map((c) => c.id === id ? { ...c, title } : c));
  };

  // ── Send message ────────────────────────────────────────────────────────

  const sendMessage = async (content: string) => {
    if (!currentConvId) return;

    const userMsg: Message = { id: genId(), role: "user", content, timestamp: new Date().toISOString() };
    const assistantId = genId();
    const now = new Date().toISOString();

    setConversations((p) =>
      p.map((c) => c.id === currentConvId ? { ...c, messages: [...c.messages, userMsg] } : c)
    );

    if (currentMessages.length === 0) updateTitle(currentConvId, content);

    setLoading(true);
    // CHANGE 2: no setSearching - preloader never shows after prompt
    abortRef.current = new AbortController();

    apiFetch(`/api/conversations/${currentConvId}/messages`, {
      method: "POST", body: JSON.stringify(userMsg)
    }).catch(() => {});

    try {
      const history = currentMessages
        .slice(-4)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch(`${API}/api/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
        body: JSON.stringify({ question: content, history, scope: currentConv?.scope ?? activeScope }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) { toast("Chat request failed", "error"); return; }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      let sources: Message["sources"] = [];

      setConversations((p) =>
        p.map((c) => c.id === currentConvId
          ? { ...c, messages: [...c.messages, { id: assistantId, role: "assistant", content: "", timestamp: now }] }
          : c)
      );

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n").filter(Boolean)) {
          try {
            const ev = JSON.parse(line);
            if (ev.type === "assistant_chunk") {
              assistantText += ev.data;
              setConversations((p) =>
                p.map((c) => c.id === currentConvId
                  ? { ...c, messages: c.messages.map((m) => m.id === assistantId ? { ...m, content: assistantText } : m) }
                  : c)
              );
            } else if (ev.type === "sources") {
              sources = ev.data;
            } else if (ev.type === "end") {
              setConversations((p) =>
                p.map((c) => c.id === currentConvId
                  ? { ...c, messages: c.messages.map((m) => m.id === assistantId ? { ...m, sources } : m) }
                  : c)
              );
              apiFetch(`/api/conversations/${currentConvId}/messages`, {
                method: "POST",
                body: JSON.stringify({ id: assistantId, role: "assistant", content: assistantText, timestamp: now, sources }),
              }).catch(() => {});
            } else if (ev.type === "error") {
              toast(`AI error: ${ev.data}`, "error");
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") toast("Failed to get response", "error");
    } finally {
      setLoading(false);
    }
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  // ── Document upload ─────────────────────────────────────────────────────

  const uploadFile = async (file: File) => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    const SUPPORTED = [
      ".pdf", ".txt", ".md", ".csv", ".docx", ".json", ".rtf", ".pptx",
      ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".webp",
    ];
    if (!SUPPORTED.includes(ext)) {
      toast(`Unsupported file type: ${ext}`, "error");
      return;
    }

    setUploading(true);
    try {
      // Uploads go to whichever scope is currently active in the switcher
      // ("all" isn't a real department to upload into, so it falls back to
      // General - the server independently enforces who may upload where).
      const uploadDept = activeScope === "all" ? "general" : activeScope;
      const form = new FormData();
      form.append("file", file);
      form.append("department", uploadDept);
      const res = await fetch(`${API}/api/upload`, {
        method: "POST",
        headers: { ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      toast(`${file.name} uploaded to ${uploadDept} (${data.chunks} chunks)`, "success");
      await loadDocuments();
    } catch (err) {
      toast((err as Error).message || "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(uploadFile);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    Array.from(e.dataTransfer.files).forEach(uploadFile);
  };

  const deleteDocument = async (name: string, department: string = "general") => {
    if (!window.confirm(`Delete "${name}"? This removes it from search and can't be undone.`)) return;
    try {
      const res = await apiFetch(`/api/documents/${encodeURIComponent(name)}?department=${encodeURIComponent(department)}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
      setDocuments((p) => p.filter((d) => d.name !== name));
      toast(`${name} deleted`, "success");
    } catch (err) {
      toast((err as Error).message || "Delete failed", "error");
    }
  };

  // ── Sign out ────────────────────────────────────────────────────────────

  const signOut = async () => {
    try { await apiFetch("/api/auth/logout", { method: "POST" }); } catch { /* ignore */ }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.replace("/login");
  };

  // ── Render ─────────────────────────────────────────────────────────────

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <BrandPreloader messages={[]} fullscreen={false} />
      </div>
    );
  }

  return (
    <div className="h-dvh flex bg-[var(--paper)] overflow-hidden overscroll-none">
      <ToastBar toasts={toasts} dismiss={dismiss} />
      {/* Not re-adding a full-screen preloader after prompt submit - kept for initial auth check only */}

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside
        className={`fixed md:relative z-30 h-full flex flex-col w-[85vw] max-w-64 bg-[var(--paper)] border-r border-[var(--line)] transition-transform duration-250 ease-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="px-4 pt-4">
          <Logo size={26} />
        </div>

        {/* User card */}
        {currentUser && (
          <div className="px-4 pt-4 pb-4 border-b border-[var(--line)]">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 border border-[var(--line)] bg-[var(--surface-2)] flex items-center justify-center flex-shrink-0 font-display font-bold text-sm text-[var(--ink)]">
                {currentUser.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--ink)] truncate">{currentUser.username}</p>
                <span className="badge-outline mt-0.5 capitalize">{currentUser.role}</span>
              </div>
            </div>

            <button
              onClick={() => createConversation()}
              className="btn-accent w-full flex items-center justify-center gap-2 py-2 px-3 text-xs"
            >
              <Plus className="w-3.5 h-3.5" /> New chat
            </button>
          </div>
        )}

        {/* Upload zone - uploads always go to the currently active scope.
            A department head can't upload to General, so hide it rather
            than let them hit a guaranteed 403. */}
        {canUpload && (isPrivileged || activeScope !== "general") && (
          <div className="px-4 py-3 border-b border-[var(--line)]">
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex items-center gap-3 px-3 py-2.5 rounded border border-dashed cursor-pointer transition-colors text-xs font-medium ${
                isDragging
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--ink-soft)]"
              } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.txt,.md,.csv,.docx,.json,.rtf,.pptx,.png,.jpg,.jpeg,.gif,.bmp,.tiff,.webp"
                onChange={handleFileChange}
              />
              {uploading ? (
                <LoaderRing size={16} tone="inline" />
              ) : (
                <Upload className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{uploading ? "Uploading…" : `Upload to ${activeScope === "all" ? "General" : activeScope}`}</span>
            </div>
          </div>
        )}

        {/* Documents list */}
        <div className="px-4 py-3 border-b border-[var(--line)]">
          <button
            onClick={() => setShowDocs((s) => !s)}
            className="w-full flex items-center justify-between text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider hover:text-[var(--ink)] transition-colors"
          >
            <span>Documents ({documents.length})</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDocs ? "rotate-180" : ""}`} />
          </button>

          {showDocs && (
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {documents.length === 0 ? (
                <p className="text-xs text-[var(--ink-soft)] py-2 text-center">No documents yet</p>
              ) : documents.map((doc) => (
                <div key={`${doc.department}/${doc.name}`} className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--surface-2)] transition-colors">
                  <FileText className="w-3.5 h-3.5 text-[var(--ink-soft)] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--ink)] truncate font-medium">{doc.name}</p>
                    <p className="text-xs text-[var(--ink-soft)]">
                      {doc.size}
                      {activeScope === "all" && doc.department && ` · ${doc.department}`}
                    </p>
                  </div>
                  {(currentUser?.role === "admin" || currentUser?.role === "manager") && (
                    <button
                      onClick={() => deleteDocument(doc.name, doc.department)}
                      title="Delete document"
                      aria-label={`Delete ${doc.name}`}
                      className="opacity-50 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity p-1 -m-1 text-[var(--ink-soft)] hover:text-[var(--danger-text)]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Conversation history */}
        <div className="flex-1 overflow-y-auto py-3">
          <p className="px-4 text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider mb-2">
            History
          </p>
          {loadingConvs ? (
            <ConvSkeleton />
          ) : scopedConversations.length === 0 ? (
            <p className="px-4 text-xs text-[var(--ink-soft)]">No conversations yet</p>
          ) : (
            <div className="px-2 space-y-0.5">
              {scopedConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => { setCurrentConvId(conv.id); setSidebarOpen(false); }}
                  className={`group flex items-center justify-between px-3 py-2 rounded cursor-pointer transition-colors ${
                    currentConvId === conv.id
                      ? "bg-[var(--surface-selected)] text-[var(--ink)]"
                      : "text-[var(--ink-soft)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{conv.title}</p>
                    <p className="text-xs text-[var(--ink-soft)] mt-0.5">{conv.messages.length} messages</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                    className="opacity-50 group-hover:opacity-100 transition-opacity ml-2 p-1 text-[var(--ink-soft)] hover:text-[var(--danger-text)] flex-shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sign out */}
        {currentUser && (
          <div className="px-4 py-3 border-t border-[var(--line)]">
            <button onClick={signOut} className="btn-outline w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-[var(--ink-soft)]">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        )}
      </aside>

      {/* ── Main chat area ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--line)] bg-[var(--paper)] flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setSidebarOpen((s) => !s)}
              aria-label="Toggle menu"
              className="md:hidden -m-2 p-2.5 rounded-lg text-[var(--ink-soft)] hover:bg-[var(--surface-2)] active:bg-[var(--surface-selected)] transition-colors"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>

            <div className="hidden md:flex items-center gap-3">
              <span className="font-display text-sm font-bold text-[var(--ink)]">
                {currentConv?.title ?? "Iboro"}
              </span>
              {currentMessages.length > 0 && (
                <span className="text-xs text-[var(--ink-soft)]">{currentMessages.length} messages</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
            <ScopeSwitcher
              activeScope={activeScope}
              isPrivileged={isPrivileged}
              onSwitch={handleScopeSwitch}
            />
            {/* <OrgSwitcher activeOrgId={currentUser?.active_org_id} /> */}

            {/* Backend status */}
            <div className="flex items-center gap-1.5 text-xs text-[var(--ink-soft)]">
              <span className={`w-1.5 h-1.5 rounded-full ${backendOnline ? "bg-green-600" : "bg-red-400"}`} />
              <span className="hidden sm:inline">{backendOnline ? "Online" : "Offline"}</span>
            </div>

            {/* Admin link */}
            {currentUser?.role === "admin" && (
              <a
                href="/admin"
                className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-[var(--ink-soft)] hover:text-[var(--ink)] px-2.5 py-1.5 rounded border border-[var(--line)] hover:border-[var(--ink-soft)] transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                Admin
              </a>
            )}

            {/* User dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((s) => !s)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-[var(--line)] hover:border-[var(--ink-soft)] transition-colors text-xs font-medium text-[var(--ink)]"
              >
                <div className="w-6 h-6 border border-[var(--line)] bg-[var(--surface-2)] flex items-center justify-center font-display font-bold text-[10px]">
                  {currentUser?.username.slice(0, 2).toUpperCase()}
                </div>
                <span className="hidden sm:block max-w-[100px] truncate">{currentUser?.username}</span>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-44 card-bordered shadow-lg z-50 overflow-hidden org-switcher-enter">
                  <div className="px-4 py-3 border-b border-[var(--line)]">
                    <p className="text-xs text-[var(--ink-soft)]">Signed in as</p>
                    <p className="text-sm font-semibold text-[var(--ink)] truncate">{currentUser?.username}</p>
                    <span className="badge-outline mt-1 capitalize">{currentUser?.role}</span>
                  </div>
                  {currentUser?.role === "admin" && (
                    <a
                      href="/admin"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
                    >
                      <Settings className="w-4 h-4" /> Admin panel
                    </a>
                  )}
                  <a
                    href="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <SlidersHorizontal className="w-4 h-4" /> Settings
                  </a>
                  <button
                    onClick={signOut}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--danger-text)] hover:bg-[var(--danger-bg)] transition-colors border-t border-[var(--line)]"
                  >
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Messages */}
        <MessageList messages={currentMessages} isTyping={loading} loadingConvs={loadingConvs} />

        {/* Input */}
        <ChatInput onSubmit={sendMessage} disabled={loading} onStop={stopGeneration} />
      </div>
    </div>
  );
}