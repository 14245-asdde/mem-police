import { useState } from "react";
import StarField from "./StarField";

interface RatingPageProps {
  onBack: () => void;
}

type Filter = "all" | "easy" | "medium" | "hard" | "nightmare";

const allPlayers = [
  { rank: 1,  name: "xX_MemeL0rd_Xx",    score: 9840,  wins: 142, games: 160, badge: "👑", diff: "nightmare" },
  { rank: 2,  name: "pepe_enjoyer",       score: 8720,  wins: 120, games: 138, badge: "🥈", diff: "hard"      },
  { rank: 3,  name: "doge_master3000",    score: 7650,  wins: 98,  games: 115, badge: "🥉", diff: "hard"      },
  { rank: 4,  name: "NyanCat_Fan",        score: 7200,  wins: 91,  games: 110, badge: "🔥", diff: "medium"    },
  { rank: 5,  name: "trollface_pro",      score: 6980,  wins: 87,  games: 104, badge: "🔥", diff: "nightmare" },
  { rank: 6,  name: "ChillGuy_Real",      score: 6540,  wins: 80,  games: 97,  badge: "⚡", diff: "medium"    },
  { rank: 7,  name: "SussyBaka228",       score: 6100,  wins: 74,  games: 90,  badge: "⚡", diff: "easy"      },
  { rank: 8,  name: "МемОфицер_РФ",       score: 5870,  wins: 70,  games: 88,  badge: "⚡", diff: "hard"      },
  { rank: 9,  name: "amogus_detective",   score: 5320,  wins: 61,  games: 79,  badge: "✨", diff: "easy"      },
  { rank: 10, name: "WomboCombo777",      score: 4900,  wins: 55,  games: 72,  badge: "✨", diff: "medium"    },
  { rank: 11, name: "Stonks_Only_Up",     score: 4500,  wins: 50,  games: 68,  badge: "✨", diff: "hard"      },
  { rank: 12, name: "GigaChadPlayer",     score: 4100,  wins: 45,  games: 62,  badge: "✨", diff: "nightmare" },
  { rank: 13, name: "Кот_Педрилло",       score: 3850,  wins: 40,  games: 57,  badge: "✨", diff: "medium"    },
  { rank: 14, name: "PogChamp2025",       score: 3600,  wins: 37,  games: 53,  badge: "✨", diff: "easy"      },
  { rank: 15, name: "BasedMemeConnoiss",  score: 3200,  wins: 32,  games: 48,  badge: "✨", diff: "nightmare" },
];

const filterLabels: Record<Filter, string> = {
  all:       "Все",
  easy:      "😄 Легко",
  medium:    "🤔 Средне",
  hard:      "😤 Сложно",
  nightmare: "💀 Кошмар",
};

const diffColor: Record<string, string> = {
  easy:      "text-green-400",
  medium:    "text-yellow-400",
  hard:      "text-red-400",
  nightmare: "text-purple-400",
};

const diffBg: Record<string, string> = {
  easy:      "bg-green-500/10 border-green-500/20",
  medium:    "bg-yellow-500/10 border-yellow-500/20",
  hard:      "bg-red-500/10 border-red-500/20",
  nightmare: "bg-purple-500/10 border-purple-500/20",
};

export default function RatingPage({ onBack }: RatingPageProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = filter === "all"
    ? allPlayers
    : allPlayers.filter((p) => p.diff === filter);

  const topPlayer = filtered[0];

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

      <main className="relative z-10 flex-1 flex flex-col items-center px-6 py-12 gap-8 max-w-2xl mx-auto w-full">

        {/* Title */}
        <div className="text-center space-y-2 w-full">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-white/60 text-xs font-semibold uppercase tracking-widest">
            🏆 Таблица лидеров
          </div>
          <h2 className="text-4xl font-black tracking-tight">Лучшие игроки</h2>
          <p className="text-white/40 text-sm">Только самые крутые знатоки слов</p>
        </div>

        {/* Top 3 podium */}
        {filter === "all" && (
          <div className="w-full grid grid-cols-3 gap-3">
            {/* 2nd */}
            <div className="flex flex-col items-center gap-2 pt-8">
              <div className="text-2xl">🥈</div>
              <div className="w-full py-5 rounded-xl bg-white/[0.04] border border-white/10 flex flex-col items-center gap-1">
                <span className="font-black text-white/90 text-xs text-center px-2 truncate w-full text-center">{allPlayers[1].name}</span>
                <span className="text-yellow-400 font-black text-sm">{allPlayers[1].score.toLocaleString()}</span>
              </div>
            </div>
            {/* 1st */}
            <div className="flex flex-col items-center gap-2">
              <div className="text-3xl animate-bounce">👑</div>
              <div className="w-full py-6 rounded-xl bg-gradient-to-b from-yellow-500/20 to-yellow-400/5 border border-yellow-400/30 flex flex-col items-center gap-1 shadow-[0_0_24px_rgba(251,191,36,0.2)]">
                <span className="font-black text-white text-xs text-center px-2 truncate w-full text-center">{allPlayers[0].name}</span>
                <span className="text-yellow-400 font-black text-base">{allPlayers[0].score.toLocaleString()}</span>
              </div>
            </div>
            {/* 3rd */}
            <div className="flex flex-col items-center gap-2 pt-12">
              <div className="text-2xl">🥉</div>
              <div className="w-full py-4 rounded-xl bg-white/[0.04] border border-white/10 flex flex-col items-center gap-1">
                <span className="font-black text-white/90 text-xs text-center px-2 truncate w-full text-center">{allPlayers[2].name}</span>
                <span className="text-orange-400 font-black text-sm">{allPlayers[2].score.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="w-full flex gap-2 flex-wrap">
          {(Object.keys(filterLabels) as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`
                px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200
                ${filter === f
                  ? "bg-white/15 border border-white/20 text-white"
                  : "bg-white/[0.04] border border-white/5 text-white/40 hover:text-white/70 hover:bg-white/[0.07]"
                }
              `}
            >
              {filterLabels[f]}
            </button>
          ))}
        </div>

        {/* Stats summary */}
        {topPlayer && (
          <div className="w-full grid grid-cols-3 gap-3">
            {[
              { label: "Игроков",    value: filtered.length },
              { label: "Топ счёт",   value: topPlayer.score.toLocaleString() },
              { label: "Лидер",      value: topPlayer.name.slice(0, 10) + (topPlayer.name.length > 10 ? "…" : "") },
            ].map((s) => (
              <div
                key={s.label}
                className="text-center py-3 px-2 rounded-xl bg-white/[0.03] border border-white/5"
              >
                <p className="font-black text-white/90 text-lg">{s.value}</p>
                <p className="text-white/30 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Full leaderboard */}
        <div className="w-full flex flex-col gap-2">
          {filtered.map((p, idx) => (
            <div
              key={p.rank}
              className={`
                flex items-center gap-4 px-5 py-3.5 rounded-xl border transition-all duration-300
                hover:bg-white/[0.06]
                ${idx === 0
                  ? "bg-yellow-500/5 border-yellow-400/20"
                  : idx === 1
                  ? "bg-white/[0.04] border-white/8"
                  : idx === 2
                  ? "bg-orange-500/5 border-orange-400/10"
                  : "bg-white/[0.02] border-white/5"
                }
              `}
            >
              {/* Rank */}
              <div className="w-7 text-center">
                {idx === 0 ? (
                  <span className="text-xl">{p.badge}</span>
                ) : idx === 1 ? (
                  <span className="text-xl">{p.badge}</span>
                ) : idx === 2 ? (
                  <span className="text-xl">{p.badge}</span>
                ) : (
                  <span className="text-white/30 font-bold text-sm">{idx + 1}</span>
                )}
              </div>

              {/* Name */}
              <span className="flex-1 font-bold text-white/85 text-sm truncate">{p.name}</span>

              {/* Difficulty badge */}
              <span className={`hidden sm:inline text-[10px] font-bold uppercase tracking-wider border px-2 py-0.5 rounded-full ${diffBg[p.diff]} ${diffColor[p.diff]}`}>
                {p.diff === "easy" ? "легко" : p.diff === "medium" ? "средне" : p.diff === "hard" ? "сложно" : "кошмар"}
              </span>

              {/* Wins */}
              <span className="text-white/30 text-xs font-medium hidden sm:block">{p.wins}W</span>

              {/* Score */}
              <span className="font-black text-sm text-white/90">{p.score.toLocaleString()} <span className="text-white/30 font-normal">pts</span></span>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-white/25">
            <div className="text-5xl mb-4">🕳️</div>
            <p className="font-bold">Нет игроков в этой категории</p>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={onBack}
          className="
            relative group w-full max-w-xs px-8 py-4 rounded-xl
            bg-gradient-to-r from-purple-600 to-blue-500
            shadow-[0_4px_24px_rgba(139,92,246,0.45)]
            font-black text-white text-base tracking-wide uppercase
            transition-all duration-300
            hover:scale-[1.03] hover:brightness-110
            active:scale-[0.97]
            overflow-hidden mx-auto
          "
        >
          <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
          <span className="relative flex items-center justify-center gap-2">
            <span>🎮</span>
            <span>Играть сейчас</span>
          </span>
        </button>
      </main>

      <footer className="relative z-10 text-center py-4 text-white/20 text-xs border-t border-white/5">
        © 2025 Мем Полиция · Таблица лидеров
      </footer>
    </div>
  );
}
