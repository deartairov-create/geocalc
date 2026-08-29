"use client";

import React, { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  FileText,
  Loader2,
  Paperclip,
  Send,
  Sparkles,
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
      "Assalomu alaykum! Men GeoAI — universal sun'iy intellekt muhandislik yordamchisiman (BETA versiya, hozircha tekin).\n\n• Istalgan mavzuda savollarga javob beraman\n• Rasm, xarita, sxema va hujjatlarni tahlil qilaman\n• Geodeziya, maydon, azimut, nivelirlash va yer ishlari hisoblari\n• Dasturlash, tarjima, tahlil va rejalashtirish\n\nRasm yoki fayl biriktirish uchun pastdagi 📎 tugmasini bosing.",
      "Здравствуйте! Я GeoAI — ваш универсальный AI-ассистент (BETA-версия, сейчас бесплатно).\n\n• Отвечаю на любые вопросы\n• Анализирую изображения, карты, схемы и документы\n• Геодезия, площади, азимуты, нивелирование и объёмы\n• Программирование, перевод, планирование\n\nДля загрузки изображения или файла нажмите 📎.",
      "Hello! I am GeoAI — your universal AI engineering assistant (BETA, currently free).\n\n• Answer questions on any topic\n• Analyze images, maps, schematics, and documents\n• Geodesy, areas, azimuths, leveling, and earthwork volumes\n• Coding, translations, planning\n\nPress 📎 below to attach an image or file.",
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
           tr(language, "GeoAI xizmati vaqtincha javob bermadi. Iltimos, birozdan so'ng qayta yuboring.", "Сервис GeoAI временно не ответил. Пожалуйста, повторите попытку чуть позже.", "GeoAI did not respond temporarily. Please try again shortly."));
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
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={`flex items-end gap-3 ${msg.role === "user" ? "flex-row-reverse ml-auto" : "mr-auto"} max-w-[90%]`}
            >
              {msg.role === "bot" && (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--blue)] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[var(--accent)]/20 border border-white/40">
                  <Bot className="w-4.5 h-4.5 text-black" />
                </div>
              )}
              <div className={`flex flex-col gap-1.5 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {msg.attachments.map((att, i) => (
                      <div key={i} className="rounded-2xl overflow-hidden border border-white/20 bg-white/10 backdrop-blur-xl shadow-md">
                        {att.previewUrl ? (
                          <img src={att.previewUrl} alt={att.name} className="max-w-[260px] max-h-[190px] object-cover" />
                        ) : (
                          <div className="flex items-center gap-2 px-3.5 py-2 text-xs">
                            <FileText className="w-4 h-4 text-[var(--accent)]" />
                            <span className="text-[var(--text)] font-medium truncate max-w-[170px]">{att.name}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {msg.text && (
                  <div className={`px-4.5 py-3.5 rounded-[24px] text-sm leading-relaxed whitespace-pre-wrap break-words shadow-lg ${
                    msg.role === "user" 
                      ? "liquid-btn-primary rounded-br-[6px] text-black" 
                      : msg.isError 
                        ? "bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)]/40 rounded-bl-[6px] backdrop-blur-xl" 
                        : "liquid-glass rounded-bl-[6px] text-[var(--text)]"
                  }`}>{msg.text}</div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-end gap-3 mr-auto">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--blue)] flex items-center justify-center flex-shrink-0 shadow-lg border border-white/40">
              <Bot className="w-4.5 h-4.5 text-black" />
            </div>
            <div className="liquid-glass px-4.5 py-3 rounded-[24px] rounded-bl-[6px] flex items-center gap-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
              <span className="text-xs text-[var(--muted)] font-medium">
                {tr(language, "GeoAI javob tayyorlamoqda...", "GeoAI готовит ответ...", "GeoAI is thinking...")}
              </span>
            </div>
          </motion.div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Pending Attachments */}
      {pending.length > 0 && (
        <div className="px-4 pb-2 flex gap-2 flex-wrap">
          {pending.map((p, i) => (
            <div key={i} className="relative group rounded-2xl overflow-hidden border border-white/30 bg-white/10 backdrop-blur-xl">
              {p.isImage && p.previewUrl ? (
                <img src={p.previewUrl} alt={p.file.name} className="w-16 h-16 object-cover" />
              ) : (
                <div className="w-16 h-16 flex flex-col items-center justify-center gap-1 p-1">
                  <FileText className="w-5 h-5 text-[var(--accent)]" />
                  <span className="text-[9px] text-[var(--muted)] text-center w-full truncate">{p.file.name.split(".").pop()?.toUpperCase()}</span>
                </div>
              )}
              <button onClick={() => removePending(i)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Bar with Liquid Glass */}
      <div className="p-3 border-t border-[var(--border)]">
        <div className="liquid-pill flex items-end gap-2 p-2 px-3">
          <button onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-full text-[var(--muted)] hover:text-[var(--accent)] hover:bg-white/10 transition-all flex-shrink-0"
            title={tr(language, "Rasm yoki fayl yuklash", "Загрузить фото или файл", "Upload image or file")}>
            <Paperclip className="w-5 h-5" />
          </button>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={tr(language, "GeoAI dan istalgan narsani so'rang... (Shift+Enter yangi qator)", "Спросите GeoAI о чём угодно...", "Ask GeoAI anything...")}
            rows={1} style={{ resize: "none", minHeight: "38px", maxHeight: "120px" }}
            className="flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)] leading-5 pt-2"
          />
          <button onClick={handleSend} disabled={(!input.trim() && pending.length === 0) || isLoading}
            className="p-2.5 rounded-full liquid-btn-primary disabled:opacity-30 flex-shrink-0 shadow-lg active:scale-95 transition-all">
            <Send className="w-4 h-4 text-black" />
          </button>
        </div>
        <input ref={fileInputRef} type="file" multiple accept="image/*,.txt,.csv,.json,.xml,.ts,.js,.py,.md,.html,.dxf,.kml" className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)} />
      </div>
    </div>
  );
}
