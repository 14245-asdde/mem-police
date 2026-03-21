import { useState, useEffect } from "react";
import { Difficulty } from "./DifficultySelector";
import StarField from "./StarField";
import { wordStats, getWords } from "../data/words";

interface LobbyPageProps {
  lobbyCode: string;
  difficulty: Difficulty;
  onBack: () => void;
}

const difficultyInfo: Record<Difficulty, { label: string; icon: string; color: string; desc: string; count: number }> = {
  easy:      { label: "Легко",   icon: "😄", color: "text-green-400",  desc: "Самые популярные, повседневные слова", count: wordStats.easy },
  medium:    { label: "Средне",  icon: "🤔", color: "text-yellow-400", desc: "Менее частотные, но знакомые слова",   count: wordStats.medium },
  hard:      { label: "Сложно",  icon: "😤", color: "text-red-400",    desc: "Редкие, книжные и специальные слова",  count: wordStats.hard },
  nightmare: { label: "Кошмар",  icon: "💀", color: "text-purple-400", desc: "Архаизмы, профессионализмы, самые редкие слова", count: wordStats.nightmare },
};

const fakePlayers = [
  { name: "Ты (создатель)", isHost: true,  avatar: "🎮" },
  { name: "Ожидание...",    isHost: false, avatar: "⏳" },
  { name: "Ожидание...",    isHost: false, avatar: "⏳" },
];

export default function LobbyPage({ lobbyCode, difficulty, onBack }: LobbyPageProps) {
  const info = difficultyInfo[difficulty];
  const lobbyUrl = `${window.location.origin}?lobby=${lobbyCode}`;
  const previewWords = getWords(difficulty, 6);

  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(lobbyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(lobbyUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="relative min-h-screen bg-animated text-white overflow-hidden flex flex-col">
      <StarField />

      <div
        className="pointer-events-none absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-10 blur-3xl"
        style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full opacity-10 blur-3xl"
        style={{ background: "radial-gradient(circle, #1d4ed8, transparent 70%)" }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-900/40">
            <span className="font-black text-xl text-white leading-none">T</span>
          </div>
          <div>
            <h1 className="font-black text-lg leading-none tracking-tight">МЕМ ПОЛИЦИЯ</h1>
            <p className="text-white/40 text-[11px] font-medium tracking-wider uppercase">Проверяем мемы с 2025</p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition text-white/60 hover:text-white text-sm font-semibold"
        >
          ← Назад
        </button>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12 gap-8">

        {/* Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-white/60 text-xs font-semibold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            Лобби создано
          </div>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight">
            Ждём игроков{dots}
          </h2>
          <p className="text-white/40 text-sm">Отправь ссылку или код друзьям чтобы они присоединились</p>
        </div>

        <div className="w-full max-w-xl flex flex-col gap-5">

          {/* Lobby code card */}
          <div
            className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl px-8 py-7 flex flex-col items-center gap-4"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)" }}
          >
            <p className="text-white/40 text-xs font-semibold uppercase tracking-[0.2em]">Код лобби</p>
            <div className="flex items-center gap-3">
              {lobbyCode.split("").map((char, i) => (
                <div
                  key={i}
                  className="w-11 h-14 rounded-xl bg-white/[0.07] border border-white/10 flex items-center justify-center font-black text-2xl text-white tracking-tight"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  {char}
                </div>
              ))}
            </div>
            <button
              onClick={handleCopyCode}
              className={`
                relative group px-6 py-2 rounded-lg font-bold text-sm transition-all duration-300
                ${copied
                  ? "bg-green-500/20 border border-green-400/40 text-green-300"
                  : "bg-white/[0.06] border border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                }
              `}
            >
              {copied ? "✓ Скопировано!" : "📋 Копировать код"}
            </button>
          </div>

          {/* Link card */}
          <div
            className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl px-6 py-5 flex flex-col gap-3"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)" }}
          >
            <p className="text-white/40 text-xs font-semibold uppercase tracking-[0.2em]">Ссылка на лобби</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-white/[0.05] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white/50 font-mono truncate">
                {lobbyUrl}
              </div>
              <button
                onClick={handleCopyLink}
                className={`
                  shrink-0 px-4 py-2.5 rounded-lg font-bold text-sm transition-all duration-300 whitespace-nowrap
                  ${copiedLink
                    ? "bg-green-500/20 border border-green-400/40 text-green-300"
                    : "bg-white/[0.06] border border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                  }
                `}
              >
                {copiedLink ? "✓" : "🔗 Копировать"}
              </button>
            </div>
          </div>

          {/* Difficulty badge */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 flex items-center gap-4">
            <span className="text-2xl">{info.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white/80 text-sm">Сложность:</span>
                <span className={`font-black text-sm ${info.color}`}>{info.label}</span>
              </div>
              <p className="text-white/30 text-xs mt-0.5">{info.desc} · {info.count} слов в базе</p>
            </div>
          </div>

          {/* Word preview */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 flex flex-col gap-3">
            <p className="text-white/30 text-xs font-semibold uppercase tracking-[0.2em]">Примеры слов</p>
            <div className="flex flex-wrap gap-2">
              {previewWords.map((word) => (
                <span
                  key={word}
                  className={`px-3 py-1 rounded-full text-xs font-bold border bg-white/[0.04] ${info.color} border-current/20`}
                  style={{ borderColor: "currentColor", opacity: 0.7 }}
                >
                  {word}
                </span>
              ))}
              <span className="px-3 py-1 rounded-full text-xs font-bold border border-white/10 text-white/20 bg-white/[0.02]">
                и ещё {info.count - 6}...
              </span>
            </div>
          </div>

          {/* Players */}
          <div
            className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl px-6 py-5 flex flex-col gap-3"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)" }}
          >
            <p className="text-white/40 text-xs font-semibold uppercase tracking-[0.2em]">Игроки (1/8)</p>
            <div className="flex flex-col gap-2">
              {fakePlayers.map((p, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg ${
                    p.isHost
                      ? "bg-purple-500/10 border border-purple-500/20"
                      : "bg-white/[0.02] border border-white/5"
                  }`}
                >
                  <span className="text-xl">{p.avatar}</span>
                  <span className={`font-semibold text-sm ${p.isHost ? "text-white" : "text-white/25"}`}>
                    {p.name}
                  </span>
                  {p.isHost && (
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-purple-400 border border-purple-400/30 px-2 py-0.5 rounded-full">
                      Хост
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Start button */}
          <button
            className="
              relative group w-full px-8 py-4 rounded-xl
              bg-gradient-to-r from-purple-600 to-blue-500
              shadow-[0_4px_24px_rgba(139,92,246,0.45)]
              font-black text-white text-base tracking-wide uppercase
              transition-all duration-300
              hover:scale-[1.02] hover:brightness-110
              active:scale-[0.98]
              overflow-hidden
            "
          >
            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
            <span className="relative flex items-center justify-center gap-2">
              <span>🚀</span>
              <span>Начать игру</span>
            </span>
          </button>

          <p className="text-center text-white/20 text-xs">
            Начать можно в любой момент — минимум 2 игрока для честной игры
          </p>
        </div>
      </main>

      <footer className="relative z-10 text-center py-4 text-white/20 text-xs border-t border-white/5">
        © 2025 Мем Полиция · Лобби #{lobbyCode}
      </footer>
    </div>
  );
}
