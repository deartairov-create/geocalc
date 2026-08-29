"use client";

import { motion } from "framer-motion";
import { Globe, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import type { User as FirebaseUser } from "firebase/auth";

type Props = {
  currentUser: FirebaseUser | null;
  isAuthLoading: boolean;
  onSignIn: () => void;
  language: "uz" | "ru" | "en";
};

export default function AuthGate({ currentUser, isAuthLoading, onSignIn, language }: Props) {
  const tr = (uz: string, ru: string, en: string) => language === "ru" ? ru : language === "en" ? en : uz;

  if (isAuthLoading) {
    return (
      <div className="fixed inset-0 bg-[var(--bg)] flex items-center justify-center z-[9999]">
        <div className="liquid-glass p-8 rounded-[36px] flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--blue)] flex items-center justify-center shadow-2xl border border-white/50">
            <Globe className="w-8 h-8 text-black" />
          </div>
          <Loader2 className="w-6 h-6 text-[var(--accent)] animate-spin mt-2" />
          <p className="text-xs font-semibold text-[var(--muted)]">GeoCalc yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  if (currentUser) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9999] bg-[var(--bg)]/90 backdrop-blur-[40px] flex items-center justify-center p-6">
      
      {/* Background aurora lights */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[25%] w-[650px] h-[650px] rounded-full bg-[var(--accent)]/15 blur-[140px]" />
        <div className="absolute bottom-[10%] right-[15%] w-[550px] h-[550px] rounded-full bg-[var(--blue)]/15 blur-[140px]" />
      </div>

      <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0.1 }}
        className="relative w-full max-w-sm">
        
        <div className="liquid-glass p-8 flex flex-col items-center gap-6 text-center">
          
          {/* Glowing Lens Avatar */}
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--accent)] via-[#00e5ff] to-[var(--blue)] flex items-center justify-center shadow-[0_12px_36px_rgba(45,212,191,0.4)] border border-white/60">
              <Globe className="w-10 h-10 text-black" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[var(--blue)] flex items-center justify-center border-2 border-[var(--bg)] shadow-md">
              <ShieldCheck className="w-4 h-4 text-black" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-[var(--text)] tracking-tight">
              GeoCalc<span className="text-[var(--accent)]">.uz</span>
            </h1>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              {tr(
                "Professional geodeziya va GeoAI platformasidan foydalanish uchun",
                "Для использования профессиональной геодезической платформы",
                "To use the professional geodesy and GeoAI platform",
              )}
              <br />
              <strong className="text-[var(--text)] font-bold">
                {tr("Google orqali kiring", "войдите через Google", "sign in with Google")}
              </strong>
            </p>
          </div>

          {/* Liquid Pill Google Button */}
          <button onClick={onSignIn}
            className="w-full py-3.5 px-6 rounded-full bg-white text-[#0f172a] font-bold text-sm flex items-center justify-center gap-3 shadow-[inset_0_1.5px_2px_rgba(255,255,255,1),0_12px_32px_rgba(0,0,0,0.25)] border border-white hover:brightness-105 active:scale-[0.98] transition-all">
            <svg className="w-5 h-5" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
              <path d="M6.306 14.691l6.571 4.819C14.655 15.108 19.000 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
              <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
              <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
            </svg>
            {tr("Google orqali kirish", "Войти через Google", "Sign in with Google")}
          </button>

          <div className="w-full space-y-2 pt-3 border-t border-white/10">
            {[
              tr("🛰️ Sun'iy yo'ldosh xaritasi va GPS", "🛰️ Спутниковая карта и GPS", "🛰️ Satellite map & GPS"),
              tr("🤖 GeoAI — BETA (Hozircha mutlaqo tekin)", "🤖 GeoAI — BETA (Сейчас бесплатно)", "🤖 GeoAI — BETA (Currently free)"),
              tr("📐 Vincenty, Gauss, Nivelirlash va TIN Cut & Fill", "📐 Точные геодезические расчёты", "📐 Precision geodetic computations"),
            ].map((f, i) => (
              <div key={i} className="text-xs text-[var(--muted)] text-left flex items-center gap-1.5">
                <span>{f}</span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-[var(--muted-2)] font-medium">
            Powered by <strong className="text-[var(--accent)]">Toirov Azizbek</strong>
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
