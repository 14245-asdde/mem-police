import { useRef } from "react";

export type Difficulty = "easy" | "medium" | "hard" | "nightmare";

interface DifficultySelectorProps {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
}

const difficulties: { id: Difficulty; label: string; icon: string }[] = [
  { id: "easy",      label: "Легко",   icon: "😄" },
  { id: "medium",    label: "Средне",  icon: "🤔" },
  { id: "hard",      label: "Сложно",  icon: "😤" },
  { id: "nightmare", label: "Кошмар",  icon: "💀" },
];

export default function DifficultySelector({ value, onChange }: DifficultySelectorProps) {
  const groupRef = useRef<HTMLDivElement>(null);

  // ripple on label click
  const handleClick = (e: React.MouseEvent<HTMLLabelElement>, id: Difficulty) => {
    const el = e.currentTarget;
    const ripple = document.createElement("span");
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.cssText = `
      position:absolute;
      border-radius:50%;
      background:rgba(255,255,255,0.25);
      width:${size}px;height:${size}px;
      left:${e.clientX - rect.left - size / 2}px;
      top:${e.clientY - rect.top - size / 2}px;
      transform:scale(0);
      animation:ripple-grow 0.5s ease-out forwards;
      pointer-events:none;
      z-index:10;
    `;
    el.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
    onChange(id);
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-white/50 text-xs font-semibold uppercase tracking-[0.2em]">
        Выбери режим сложности
      </p>

      <div className="glass-radio-group" ref={groupRef}>
        {difficulties.map((d) => (
          <span key={d.id} style={{ display: "contents" }}>
            <input
              type="radio"
              name="difficulty"
              id={`diff-${d.id}`}
              checked={value === d.id}
              onChange={() => onChange(d.id)}
            />
            <label
              htmlFor={`diff-${d.id}`}
              onClick={(e) => handleClick(e, d.id)}
              style={{ position: "relative", overflow: "hidden" }}
            >
              <span>{d.icon}</span>
              <span>{d.label}</span>
            </label>
          </span>
        ))}
        <div className="glass-glider" />
      </div>

      {/* Description badge */}
      <DifficultyBadge difficulty={value} />
    </div>
  );
}

const badgeConfig: Record<
  Difficulty,
  { text: string; color: string; glow: string; emoji: string }
> = {
  easy: {
    text: "Самые популярные слова — Котик, Дожик, Среди Нас, Краш...",
    color: "from-green-500/20 to-green-400/10 border-green-400/30 text-green-300",
    glow:  "shadow-[0_0_20px_rgba(74,222,128,0.25)]",
    emoji: "🌿",
  },
  medium: {
    text: "Менее известные слова — для знатоков интернет-культуры",
    color: "from-yellow-500/20 to-yellow-400/10 border-yellow-400/30 text-yellow-300",
    glow:  "shadow-[0_0_20px_rgba(251,191,36,0.25)]",
    emoji: "🔥",
  },
  hard: {
    text: "Редкие слова и выражения — только для избранных",
    color: "from-red-500/20 to-red-400/10 border-red-400/30 text-red-300",
    glow:  "shadow-[0_0_20px_rgba(248,113,113,0.25)]",
    emoji: "⚡",
  },
  nightmare: {
    text: "Архивный интернет — добро пожаловать в бездну...",
    color: "from-purple-500/20 to-purple-400/10 border-purple-400/30 text-purple-300",
    glow:  "shadow-[0_0_24px_rgba(167,139,250,0.4)]",
    emoji: "👁️",
  },
};

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const cfg = badgeConfig[difficulty];

  return (
    <div
      key={difficulty}
      className={`
        animate-badge-pop
        bg-gradient-to-r ${cfg.color} ${cfg.glow}
        border rounded-xl px-5 py-2.5 flex items-center gap-2.5
        text-sm font-medium backdrop-blur-sm
      `}
    >
      <span className="text-lg">{cfg.emoji}</span>
      <span>{cfg.text}</span>
    </div>
  );
}
