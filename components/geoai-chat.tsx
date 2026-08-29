"use client";

import React, { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  FileText,
  Loader2,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import type { User as FirebaseUser } from "firebase/auth";
import type { GeoAIAttachment } from "@/lib/geoai";

type AppLanguage = "uz" | "ru" | "en";

function tr(language: AppLanguage, uz: string, ru: string, en: string) {
  return language === "ru" ? ru : language === "en" ? en : uz;
}

type ChatMessage = {
  id: string;
  role: "user" | "bot";
  text: string;
  attachments?: Array<{ name: string; mimeType: string; previewUrl?: string }>;
  isError?: boolean;
};

type Props = {
  language: AppLanguage;
  currentUser: FirebaseUser | null;
};

const MAX_FILE_SIZE = 4_000_000;
const ALLOWED_IMAGE_TYPES = ["image/jpeg","image/png","image/gif","image/webp","image/heic","image/bmp"];
const ALLOWED_TEXT_TYPES = ["text/plain","text/csv","application/json","application/xml","text/xml","text/html"];

function uid() { return Math.random().toString(36).slice(2, 9); }

function isAllowedType(mimeType: string) {
  return ALLOWED_IMAGE_TYPES.includes(mimeType) || ALLOWED_TEXT_TYPES.includes(mimeType) || mimeType.startsWith("text/");
}

type PendingAttachment = { file: File; mimeType: string; previewUrl?: string; isImage: boolean; };

export default function GeoAIChat({ language, currentUser }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: uid(), role: "bot",
    text: tr(language,
      "Assalomu alaykum! Men GeoAI — geodeziya va muhandislik bo'yicha sun'iy intellekt yordamchingizman.\n\n• Har qanday savolga javob beraman\n• Rasmlar, xaritalar, chizmalar va dokumentlarni tahlil qilaman\n• Koordinatalar, maydon, azimut, nivelirlash hisoblari\n• Kod yozish va tushuntirish\n• Tarjima, matn tahlili, rejalashtirish\n\nRasm yoki fayl yuklash uchun 📎 tugmasini bosing.",
      "Здравствуйте! Я GeoAI — ваш AI-ассистент.\n\n• Отвечаю на любые вопросы\n• Анализирую изображения, карты, чертежи и документы\n• Расчёты координат, площадей, азимутов, нивелирования\n• Написание и объяснение кода\n\nДля загрузки нажмите 📎.",
      "Hello! I'm GeoAI — your AI engineering assistant.\n\n• Answer any question\n• Analyze images, maps, drawings, documents\n• Coordinate, area, azimuth, leveling calculations\n• Write and explain code\n\nPress 📎 to upload a file or image.",
    ),
  }]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const newPending: PendingAttachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) continue;
      const mimeType = file.type || "text/plain";
      if (!isAllowedType(mimeType)) continue;
      const isImage = ALLOWED_IMAGE_TYPES.includes(mimeType);
      const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
      newPending.push({ file, mimeType, previewUrl, isImage });
    }
    setPending((prev) => [...prev, ...newPending].slice(0, 4));
  }, []);

  const removePending = useCallback((idx: number) => {
    setPending((prev) => {
      const next = [...prev];
      const item = next[idx];
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      next.splice(idx, 1);
      return next;
    });
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if ((!text && pending.length === 0) || isLoading) return;

    const displayAttachments = pending.map((p) => ({ name: p.file.name, mimeType: p.mimeType, previewUrl: p.previewUrl }));
    const userMsg: ChatMessage = {
      id: uid(), role: "user",
      text: text || tr(language, "[Fayl yuklandi]", "[Файл загружен]", "[File uploaded]"),
      attachments: displayAttachments.length > 0 ? displayAttachments : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput(""); setPending([]); setIsLoading(true); scrollToBottom();

    try {
      const apiAttachments: GeoAIAttachment[] = await Promise.all(pending.map(async (p): Promise<GeoAIAttachment> => {
        if (p.isImage) {
          const buf = await p.file.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let bin = "";
          for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
          return { kind: "image", name: p.file.name, mimeType: p.mimeType, data: btoa(bin) };
        } else {
          return { kind: "text", name: p.file.name, mimeType: p.mimeType, content: await p.file.text() };
        }
      }));

      const history = messages.filter((m) => !m.isError).slice(-10)
        .map((m) => ({ role: m.role === "user" ? "user" as const : "assistant" as const, content: m.text }));

      let token: string | null = null;
      if (currentUser) { try { token = await currentUser.getIdToken(false); } catch {} }

      const res = await fetch("/api/geoai", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message: text, history, attachments: apiAttachments, language }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as Record<string, unknown>;
        const errMsg = (typeof data?.error === "string" ? data.error : null) ||
          (res.status === 401 ? tr(language, "GeoAI dan foydalanish uchun Google orqali kiring.", "Войдите через Google для использования GeoAI.", "Sign in with Google to use GeoAI.") :
           res.status === 503 ? tr(language, "GeoAI server kaliti sozlanmagan. Vercel'da GEMINI_API_KEY qo'shing.", "Ключ GeoAI не настроен. Добавьте GEMINI_API_KEY в Vercel.", "GeoAI not configured. Add GEMINI_API_KEY in Vercel.") :
           tr(language, "Xatolik yuz berdi. Qayta urinib ko'ring.", "Произошла ошибка. Попробуйте ещё раз.", "An error occurred. Please try again."));
        setMessages((prev) => [...prev, { id: uid(), role: "bot", text: errMsg, isError: true }]);
      } else {
        const data = await res.json() as Record<string, unknown>;
        setMessages((prev) => [...prev, { id: uid(), role: "bot",
          text: (typeof data.answer === "string" ? data.answer : null) || tr(language, "Javob bo'sh keldi.", "Ответ пустой.", "Empty response.") }]);
      }
    } catch (err) {
      console.error("GeoAI fetch error", err);
      setMessages((prev) => [...prev, { id: uid(), role: "bot", isError: true,
        text: tr(language, "Tarmoq xatosi. Internet aloqasini tekshiring.", "Ошибка сети. Проверьте интернет-соединение.", "Network error. Check your internet connection.") }]);
    } finally { setIsLoading(false); scrollToBottom(); }
  }, [input, pending, isLoading, messages, language, currentUser, scrollToBottom]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={`flex items-end gap-2.5 ${msg.role === "user" ? "flex-row-reverse ml-auto" : "mr-auto"} max-w-[88%]`}
            >
              {msg.role === "bot" && (
                <div className="w-8 h-8 rounded-[14px] bg-gradient-to-br from-[var(--accent)] to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div className={`flex flex-col gap-1.5 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {msg.attachments.map((att, i) => (
                      <div key={i} className="rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--panel-raised)]">
                        {att.previewUrl ? (
                          <img src={att.previewUrl} alt={att.name} className="max-w-[240px] max-h-[180px] object-cover" />
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-2 text-xs">
                            <FileText className="w-4 h-4 text-[var(--accent)]" />
                            <span className="text-[var(--text)] font-medium truncate max-w-[160px]">{att.name}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {msg.text && (
                  <div className={`px-4 py-3 rounded-[22px] text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    msg.role === "user" ? "bg-[var(--accent)] text-black rounded-br-[6px] font-medium" :
                    msg.isError ? "bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)]/30 rounded-bl-[6px]" :
                    "bg-[var(--panel-raised)] text-[var(--text)] border border-[var(--border)] rounded-bl-[6px]"
                  }`}>{msg.text}</div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-end gap-2.5 mr-auto">
            <div className="w-8 h-8 rounded-[14px] bg-gradient-to-br from-[var(--accent)] to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="px-4 py-3.5 rounded-[22px] rounded-bl-[6px] bg-[var(--panel-raised)] border border-[var(--border)] flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
              <span className="text-xs text-[var(--muted)] font-medium">
                {tr(language, "GeoAI javob tayyorlamoqda...", "GeoAI готовит ответ...", "GeoAI is thinking...")}
              </span>
            </div>
          </motion.div>
        )}
        <div ref={chatEndRef} />
      </div>

      {pending.length > 0 && (
        <div className="px-4 pb-2 flex gap-2 flex-wrap">
          {pending.map((p, i) => (
            <div key={i} className="relative group rounded-2xl overflow-hidden border border-[var(--border-strong)] bg-[var(--panel-raised)]">
              {p.isImage && p.previewUrl ? (
                <img src={p.previewUrl} alt={p.file.name} className="w-16 h-16 object-cover" />
              ) : (
                <div className="w-16 h-16 flex flex-col items-center justify-center gap-1 p-1">
                  <FileText className="w-5 h-5 text-[var(--accent)]" />
                  <span className="text-[9px] text-[var(--muted)] text-center w-full truncate">{p.file.name.split(".").pop()?.toUpperCase()}</span>
                </div>
              )}
              <button onClick={() => removePending(i)} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="p-3 border-t border-[var(--border)]">
        <div className="flex items-end gap-2 p-2 rounded-[24px] bg-[var(--panel-raised)] border border-[var(--border-strong)] shadow-lg">
          <button onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-[14px] text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-all flex-shrink-0">
            <Paperclip className="w-5 h-5" />
          </button>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={tr(language, "GeoAI dan so'rang... (Shift+Enter — yangi qator)", "Спросите GeoAI...", "Ask GeoAI...")}
            rows={1} style={{ resize: "none", minHeight: "36px", maxHeight: "120px" }}
            className="flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)] leading-5 pt-1.5"
          />
          <button onClick={handleSend} disabled={(!input.trim() && pending.length === 0) || isLoading}
            className="p-2.5 rounded-[14px] bg-[var(--accent)] text-black disabled:opacity-30 hover:brightness-110 transition-all flex-shrink-0 shadow-md active:scale-95">
            <Send className="w-4 h-4" />
          </button>
        </div>
        <input ref={fileInputRef} type="file" multiple accept="image/*,.txt,.csv,.json,.xml,.ts,.js,.py,.md,.html" className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)} />
      </div>
    </div>
  );
}
