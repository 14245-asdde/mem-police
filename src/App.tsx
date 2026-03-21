import { useState } from "react";
import DifficultySelector, { Difficulty } from "./components/DifficultySelector";
import StarField from "./components/StarField";
import LobbyPage from "./components/LobbyPage";
import RatingPage from "./components/RatingPage";
import { wordStats } from "./data/words";

const difficultyMeta: Record<
  Difficulty,
  { accent: string; border: string; btnFrom: string; btnTo: string; btnShadow: string }
> = {
  easy: {
    accent:    "text-green-400",
    border:    "border-green-400/20",
    btnFrom:   "from-green-500",
    btnTo:     "to-emerald-400",
    btnShadow: "shadow-[0_4px_24px_rgba(74,222,128,0.45)]",
  },
  medium: {
    accent:    "text-yellow-400",
    border:    "border-yellow-400/20",
    btnFrom:   "from-yellow-500",
    btnTo:     "to-amber-400",
    btnShadow: "shadow-[0_4px_24px_rgba(251,191,36,0.45)]",
  },
  hard: {
    accent:    "text-red-400",
    border:    "border-red-400/20",
    btnFrom:   "from-red-500",
    btnTo:     "to-rose-400",
    btnShadow: "shadow-[0_4px_24px_rgba(248,113,113,0.45)]",
  },
  nightmare: {
    accent:    "text-purple-400",
    border:    "border-purple-400/20",
    btnFrom:   "from-purple-600",
    btnTo:     "to-violet-400",
    btnShadow: "shadow-[0_4px_24px_rgba(167,139,250,0.6)]",
  },
};

type Page = "home" | "lobby" | "rating";

function generateLobbyCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function App() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [page, setPage] = useState<Page>("home");
  const [lobbyCode, setLobbyCode] = useState("");
  const meta = difficultyMeta[difficulty];

  const handleCreateLobby = () => {
    const code = generateLobbyCode();
    setLobbyCode(code);
    setPage("lobby");
  };

  if (page === "lobby") {
    return (
      <LobbyPage
        lobbyCode={lobbyCode}
        difficulty={difficulty}
        onBack={() => setPage("home")}
      />
    );
  }

  if (page === "rating") {
    return <RatingPage onBack={() => setPage("home")} />;
  }

  return (
    <div className="relative min-h-screen bg-animated text-white overflow-hidden flex flex-col">
      <StarField />

      {/* Ambient blobs */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-10 blur-3xl"
        style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full opacity-10 blur-3xl"
        style={{ background: "radial-gradient(circle, #1d4ed8, transparent 70%)" }}
      />

      {/* ===== HEADER ===== */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          {/* Logo — буква T */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-900/40">
            <span className="font-black text-xl text-white leading-none">T</span>
          </div>
          <div>
            <h1 className="font-black text-lg leading-none tracking-tight">МЕМ ПОЛИЦИЯ</h1>
            <p className="text-white/40 text-[11px] font-medium tracking-wider uppercase">Проверяем мемы с 2025</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm text-white/50 font-medium">
          <button
            onClick={() => setPage("rating")}
            className="hover:text-white transition-colors"
          >
            Рейтинг
          </button>
          <a href="#how" className="hover:text-white transition-colors">Как играть</a>
          <a
            href="https://discord.gg/y8QC3V5J"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors flex items-center gap-1.5"
          >
            <svg width="16" height="12" viewBox="0 0 127.14 96.36" fill="currentColor">
              <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
            </svg>
            Discord
          </a>
          <button className="px-4 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition text-white text-sm font-semibold">
            Войти
          </button>
        </nav>
      </header>

      {/* ===== HERO ===== */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-16 gap-14">

        {/* Hero text */}
        <div className="text-center space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Бета-версия
          </div>
          <h2 className="text-5xl sm:text-6xl font-black tracking-tight leading-tight">
            Ты настоящий{" "}
            <span
              className={`${meta.accent} transition-colors duration-500`}
              style={{ textShadow: "0 0 30px currentColor" }}
            >
              знаток слов?
            </span>
          </h2>
          <p className="text-white/50 text-lg font-medium">
            Угадывай популярные слова, набирай очки, доказывай что ты — Мем Полицейский высшей категории.
            Создавай лобби и играй с друзьями в режиме реального времени!
          </p>
        </div>

        {/* Stats */}
        <div className="flex gap-8 sm:gap-16">
          {[
            { label: "Слов в базе",  value: wordStats.total.toLocaleString("ru-RU") },
            { label: "Игроков",      value: "8 310" },
            { label: "Рекорд",       value: "98%" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className={`text-3xl font-black ${meta.accent} transition-colors duration-500`}>
                {s.value}
              </p>
              <p className="text-white/40 text-xs uppercase tracking-widest mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Difficulty selector card */}
        <div
          className={`
            relative rounded-2xl border ${meta.border}
            bg-white/[0.04] backdrop-blur-xl
            px-10 py-9 flex flex-col items-center gap-8
            shadow-2xl transition-all duration-500
          `}
          style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)" }}
        >
          <div className="absolute top-3 right-3 w-6 h-6 border-t border-r border-white/10 rounded-tr-lg" />
          <div className="absolute bottom-3 left-3 w-6 h-6 border-b border-l border-white/10 rounded-bl-lg" />

          <DifficultySelector value={difficulty} onChange={setDifficulty} />

          {/* Create lobby button */}
          <button
            key={difficulty}
            onClick={handleCreateLobby}
            className={`
              relative group
              w-full max-w-xs
              px-8 py-4 rounded-xl
              bg-gradient-to-r ${meta.btnFrom} ${meta.btnTo}
              ${meta.btnShadow}
              font-black text-white text-base tracking-wide uppercase
              transition-all duration-300
              hover:scale-[1.04] hover:brightness-110
              active:scale-[0.97]
              animate-badge-pop
              overflow-hidden
            `}
          >
            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
            <span className="relative flex items-center justify-center gap-2">
              <span>🎮</span>
              <span>Создать лобби</span>
            </span>
          </button>
        </div>

        {/* How to play */}
        <section id="how" className="w-full max-w-3xl">
          <h3 className="text-center text-white/30 text-xs font-semibold uppercase tracking-[0.2em] mb-6">Как играть</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: "🎮", title: "Создай лобби",    desc: "Нажми «Создать лобби», выбери сложность и отправь ссылку друзьям" },
              { icon: "📝", title: "Угадывай слова",  desc: "Команда объясняет, ты угадываешь популярные слова и выражения" },
              { icon: "🏆", title: "Побеждай",        desc: "Набирай очки, попадай в таблицу лидеров и доказывай кто тут главный" },
            ].map((f) => (
              <div
                key={f.title}
                className="flex flex-col items-center text-center gap-2 p-5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 hover:bg-white/[0.06] transition-all duration-300 cursor-default"
              >
                <span className="text-2xl">{f.icon}</span>
                <p className="font-bold text-sm text-white/90">{f.title}</p>
                <p className="text-white/40 text-xs">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="w-full max-w-3xl">
          <h3 className="text-center text-white/30 text-xs font-semibold uppercase tracking-[0.2em] mb-6">Особенности</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: "⚡", title: "Быстрые раунды",     desc: "30 секунд на каждое слово — думай быстро!" },
              { icon: "🌍", title: "4 уровня сложности", desc: "От \"мем для бабушки\" до «подвал интернета»" },
              { icon: "👥", title: "Мультиплеер",        desc: "До 8 игроков в одном лобби одновременно" },
              { icon: "🔄", title: "База постоянно растёт", desc: "Новые слова добавляются каждую неделю" },
            ].map((f) => (
              <div
                key={f.title}
                className="flex items-start gap-4 p-5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 hover:bg-white/[0.06] transition-all duration-300 cursor-default"
              >
                <span className="text-2xl mt-0.5">{f.icon}</span>
                <div>
                  <p className="font-bold text-sm text-white/90">{f.title}</p>
                  <p className="text-white/40 text-xs mt-1">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Rating preview */}
        <section className="w-full max-w-3xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white/30 text-xs font-semibold uppercase tracking-[0.2em]">Топ игроков</h3>
            <button
              onClick={() => setPage("rating")}
              className="text-xs text-white/40 hover:text-white transition-colors font-medium"
            >
              Смотреть всё →
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {[
              { rank: 1, name: "xX_MemeL0rd_Xx",  score: 9840, badge: "👑" },
              { rank: 2, name: "pepe_enjoyer",     score: 8720, badge: "🥈" },
              { rank: 3, name: "doge_master3000",  score: 7650, badge: "🥉" },
            ].map((p) => (
              <div
                key={p.rank}
                className="flex items-center gap-4 px-5 py-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 hover:bg-white/[0.05] transition-all duration-300"
              >
                <span className="text-xl w-8 text-center">{p.badge}</span>
                <span className="font-bold text-white/80 flex-1">{p.name}</span>
                <span className={`font-black text-sm ${meta.accent} transition-colors duration-500`}>{p.score.toLocaleString()} pts</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="relative z-10 text-center py-5 text-white/20 text-xs border-t border-white/5 flex flex-col items-center gap-2">
        <div className="flex items-center gap-4">
          <span>© 2025 Мем Полиция</span>
          <span>·</span>
          <a
            href="https://discord.gg/y8QC3V5J"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white/50 transition-colors"
          >
            Discord
          </a>
          <span>·</span>
          <button onClick={() => setPage("rating")} className="hover:text-white/50 transition-colors">Рейтинг</button>
        </div>
        <span className="text-white/10">Сделано с ❤️ и мемами</span>
      </footer>

      <style>{`
        @keyframes ripple-grow {
          to { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
