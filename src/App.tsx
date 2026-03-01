import { useState, useEffect, useCallback, useRef } from 'react';
import { getWordsForDifficulty } from './data/words';

type Difficulty = 'easy' | 'medium' | 'hard';
type GamePhase = 'setup' | 'nickname' | 'lobby' | 'playing' | 'review' | 'scoreboard' | 'gameover';

interface Player {
  id: string;
  name: string;
  teamId: number | null;
}

interface Team {
  id: number;
  color: string;
  name: string;
  score: number;
}

interface LobbyState {
  lobbyId: string;
  difficulty: Difficulty;
  timeLimit: number;
  players: Player[];
  teams: Team[];
  phase: GamePhase;
}

interface WordResult {
  word: string;
  guessed: boolean | null;
}

const TEAM_PRESETS: { color: string; name: string; accent: string; border: string; bg: string; text: string; btn: string }[] = [
  { color: 'from-red-500 to-rose-600',      name: 'Красные',     accent: '#ef4444', border: 'border-red-500',     bg: 'bg-red-500/10',     text: 'text-red-400',     btn: 'bg-red-600 hover:bg-red-500' },
  { color: 'from-blue-500 to-indigo-600',   name: 'Синие',       accent: '#3b82f6', border: 'border-blue-500',    bg: 'bg-blue-500/10',    text: 'text-blue-400',    btn: 'bg-blue-600 hover:bg-blue-500' },
  { color: 'from-emerald-500 to-green-600', name: 'Зелёные',     accent: '#10b981', border: 'border-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400', btn: 'bg-emerald-600 hover:bg-emerald-500' },
  { color: 'from-amber-400 to-yellow-500',  name: 'Жёлтые',      accent: '#f59e0b', border: 'border-amber-400',   bg: 'bg-amber-400/10',   text: 'text-amber-400',   btn: 'bg-amber-500 hover:bg-amber-400' },
  { color: 'from-purple-500 to-violet-600', name: 'Фиолетовые',  accent: '#8b5cf6', border: 'border-purple-500',  bg: 'bg-purple-500/10',  text: 'text-purple-400',  btn: 'bg-purple-600 hover:bg-purple-500' },
  { color: 'from-orange-500 to-red-500',    name: 'Оранжевые',   accent: '#f97316', border: 'border-orange-500',  bg: 'bg-orange-500/10',  text: 'text-orange-400',  btn: 'bg-orange-600 hover:bg-orange-500' },
];

const STORAGE_KEY = (id: string) => `ugadaika_lobby_${id}`;

function saveLobby(state: LobbyState) {
  localStorage.setItem(STORAGE_KEY(state.lobbyId), JSON.stringify(state));
  // Trigger storage event for other tabs
  localStorage.setItem('ugadaika_last_update', Date.now().toString());
}

function loadLobby(id: string): LobbyState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(id));
    if (!raw) return null;
    return JSON.parse(raw) as LobbyState;
  } catch {
    return null;
  }
}

function getLobbyIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('lobby');
}

/* ── Shared background layout ── */
function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#0d0d14] text-white overflow-hidden">
      <div className="blob w-[500px] h-[500px] bg-purple-600 top-[-120px] left-[-150px]" />
      <div className="blob w-[400px] h-[400px] bg-blue-600 top-[30%] right-[-100px]" />
      <div className="blob w-[350px] h-[350px] bg-pink-600 bottom-[-80px] left-[20%]" />
      <div className="absolute inset-0 bg-grid" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl ${className}`}>
      {children}
    </div>
  );
}

export default function App() {
  // Check URL for lobby invite
  const urlLobbyId = getLobbyIdFromUrl();
  const isInvited = !!urlLobbyId;

  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [timeLimit, setTimeLimit]   = useState(60);
  const [phase, setPhase]           = useState<GamePhase>(() => {
    if (urlLobbyId) return 'nickname'; // Invited — go straight to nickname
    return 'setup';
  });

  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams]     = useState<Team[]>([
    { id: 0, ...TEAM_PRESETS[0], score: 0 },
    { id: 1, ...TEAM_PRESETS[1], score: 0 },
  ]);

  const [lobbyId, setLobbyId]                   = useState<string>(() => urlLobbyId || '');
  const [myNickname, setMyNickname]             = useState('');
  const [nicknameInput, setNicknameInput]       = useState('');
  const [nicknameError, setNicknameError]       = useState('');
  const [myPlayerId]                            = useState(() => `${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const [linkCopied, setLinkCopied]             = useState(false);

  // Playing state
  const [currentTeamIndex, setCurrentTeamIndex]     = useState(0);
  const [commanderIndex, setCommanderIndex]           = useState<Record<number, number>>({});
  const [words, setWords]                             = useState<string[]>([]);
  const [currentWordIndex, setCurrentWordIndex]       = useState(0);
  const [roundWords, setRoundWords]                   = useState<WordResult[]>([]);
  const [timeLeft, setTimeLeft]                       = useState(0);
  const [isTimerRunning, setIsTimerRunning]           = useState(false);
  const [skippedInRound, setSkippedInRound]           = useState(0);

  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const syncRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  const getLobbyLink = () =>
    `${window.location.origin}${window.location.pathname}?lobby=${lobbyId}`;

  // ── Sync: load lobby from localStorage (for invited players) ──
  const syncFromStorage = useCallback(() => {
    if (!lobbyId) return;
    const saved = loadLobby(lobbyId);
    if (!saved) return;

    // Only sync lobby-level data (players, teams, phase for non-host)
    setPlayers(saved.players);
    setTeams(saved.teams);
    setDifficulty(saved.difficulty);
    setTimeLimit(saved.timeLimit);

    // Sync game phase if started
    if (saved.phase !== 'setup' && saved.phase !== 'nickname') {
      setPhase(saved.phase);
    }
  }, [lobbyId]);

  // Poll localStorage every 500ms for changes
  useEffect(() => {
    if (!lobbyId) return;
    syncRef.current = setInterval(syncFromStorage, 500);
    return () => { if (syncRef.current) clearInterval(syncRef.current); };
  }, [lobbyId, syncFromStorage]);

  // Save lobby state whenever players/teams/phase changes (only if we have a lobbyId)
  useEffect(() => {
    if (!lobbyId) return;
    const state: LobbyState = {
      lobbyId,
      difficulty,
      timeLimit,
      players,
      teams,
      phase,
    };
    saveLobby(state);
  }, [lobbyId, players, teams, phase, difficulty, timeLimit]);

  const playBeep = useCallback((frequency = 800, duration = 200) => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx  = audioCtxRef.current;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = frequency;
      osc.type            = 'sine';
      gain.gain.value     = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + duration / 1000);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (isTimerRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            setPhase('review');
            playBeep(400, 500);
            return 0;
          }
          if (prev <= 6) playBeep(600, 100);
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTimerRunning, playBeep]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(getLobbyLink());
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const addTeam = () => {
    if (teams.length >= 6) return;
    const idx = teams.length;
    setTeams(prev => [...prev, { id: Date.now(), ...TEAM_PRESETS[idx % TEAM_PRESETS.length], score: 0 }]);
  };

  const removeTeam = (id: number) => {
    if (teams.length <= 2) return;
    setTeams(prev => prev.filter(t => t.id !== id));
    setPlayers(prev => prev.map(p => p.teamId === id ? { ...p, teamId: null } : p));
  };

  // ── CONFIRM NICKNAME ──
  const confirmNickname = () => {
    const name = nicknameInput.trim();
    if (!name) { setNicknameError('Введи имя'); return; }
    if (name.length < 2) { setNicknameError('Имя слишком короткое'); return; }

    if (isInvited && urlLobbyId) {
      // Load current lobby state first
      const saved = loadLobby(urlLobbyId);
      if (!saved) {
        setNicknameError('Лобби не найдено. Попроси у друга новую ссылку.');
        return;
      }
      if (saved.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        setNicknameError('Такое имя уже занято');
        return;
      }
      // Join the existing lobby
      setLobbyId(urlLobbyId);
      setDifficulty(saved.difficulty);
      setTimeLimit(saved.timeLimit);
      const newPlayer: Player = { id: myPlayerId, name, teamId: null };
      const updatedPlayers = [...saved.players, newPlayer];
      const updatedState: LobbyState = { ...saved, players: updatedPlayers };
      localStorage.setItem(STORAGE_KEY(urlLobbyId), JSON.stringify(updatedState));
      localStorage.setItem('ugadaika_last_update', Date.now().toString());
      setPlayers(updatedPlayers);
      setTeams(saved.teams);
      setMyNickname(name);
      setPhase('lobby');
    } else {
      // Host: create new lobby
      if (players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        setNicknameError('Такое имя уже занято');
        return;
      }
      const newId = Math.random().toString(36).slice(2, 8).toUpperCase();
      setLobbyId(newId);
      const newPlayer: Player = { id: myPlayerId, name, teamId: null };
      setPlayers([newPlayer]);
      setMyNickname(name);

      // Update browser URL without reload
      const newUrl = `${window.location.pathname}?lobby=${newId}`;
      window.history.replaceState({}, '', newUrl);

      setPhase('lobby');
    }
  };

  const assignTeam = (playerId: string, teamId: number | null) =>
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, teamId } : p));

  const getTeamPlayers = (teamId: number) => players.filter(p => p.teamId === teamId);
  const getObservers   = ()               => players.filter(p => p.teamId === null);

  const canStartGame = () => {
    const active = teams.filter(t => getTeamPlayers(t.id).length > 0);
    if (active.length < 2) return false;
    return active.every(t => getTeamPlayers(t.id).length >= 2);
  };

  const startGame = () => {
    const activeTeams = teams.filter(t => getTeamPlayers(t.id).length >= 2);
    setTeams(activeTeams.map(t => ({ ...t, score: 0 })));
    const cmdIdx: Record<number, number> = {};
    activeTeams.forEach(t => { cmdIdx[t.id] = 0; });
    setCommanderIndex(cmdIdx);
    const wordPool = getWordsForDifficulty(difficulty);
    setWords(wordPool);
    setCurrentWordIndex(0);
    setCurrentTeamIndex(0);
    setPhase('scoreboard');
  };

  const startRound = () => {
    setRoundWords([]);
    setSkippedInRound(0);
    setTimeLeft(timeLimit);
    setIsTimerRunning(true);
    setPhase('playing');
    if (currentWordIndex >= words.length - 50) {
      setWords(prev => [...prev, ...getWordsForDifficulty(difficulty)]);
    }
  };

  const nextWord = () => {
    const w = words[currentWordIndex];
    setRoundWords(prev => [...prev, { word: w, guessed: null }]);
    setCurrentWordIndex(prev => prev + 1);
  };

  const skipWord = () => {
    setSkippedInRound(prev => prev + 1);
    const w = words[currentWordIndex];
    setRoundWords(prev => [...prev, { word: w, guessed: false }]);
    setCurrentWordIndex(prev => prev + 1);
  };

  const markWord = (index: number, guessed: boolean) =>
    setRoundWords(prev => prev.map((w, i) => i === index ? { ...w, guessed } : w));

  const finishReview = () => {
    const guessedCount = roundWords.filter(w => w.guessed === true).length;
    const activeTeams  = teams.filter(t => getTeamPlayers(t.id).length >= 2);
    const currentTeam  = activeTeams[currentTeamIndex];

    setTeams(prev => prev.map(t =>
      t.id === currentTeam.id ? { ...t, score: t.score + guessedCount } : t
    ));

    const teamPlayers = getTeamPlayers(currentTeam.id);
    setCommanderIndex(prev => ({
      ...prev,
      [currentTeam.id]: ((prev[currentTeam.id] || 0) + 1) % teamPlayers.length,
    }));

    setCurrentTeamIndex((currentTeamIndex + 1) % activeTeams.length);
    setPhase('scoreboard');
  };

  const getCurrentTeam      = () => {
    const a = teams.filter(t => getTeamPlayers(t.id).length >= 2);
    return a[currentTeamIndex] ?? null;
  };
  const getCurrentCommander = () => {
    const t = getCurrentTeam();
    if (!t) return null;
    const pl  = getTeamPlayers(t.id);
    const idx = commanderIndex[t.id] ?? 0;
    return pl[idx % pl.length] ?? null;
  };

  const getTeamPreset = (team: Team) => {
    const idx = TEAM_PRESETS.findIndex(p => p.name === team.name);
    return idx >= 0 ? TEAM_PRESETS[idx] : TEAM_PRESETS[0];
  };

  const allReviewed = roundWords.every(w => w.guessed !== null);

  const resetGame = () => {
    if (lobbyId) localStorage.removeItem(STORAGE_KEY(lobbyId));
    window.history.replaceState({}, '', window.location.pathname);
    setPhase('setup');
    setPlayers([]);
    setLobbyId('');
    setMyNickname('');
    setNicknameInput('');
    setTeams([
      { id: 0, ...TEAM_PRESETS[0], score: 0 },
      { id: 1, ...TEAM_PRESETS[1], score: 0 },
    ]);
    setCurrentTeamIndex(0);
    setWords([]);
    setRoundWords([]);
    setIsTimerRunning(false);
  };

  // ═══════════════════════════════════════════
  //  SETUP
  // ═══════════════════════════════════════════
  if (phase === 'setup') {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="max-w-md w-full">
            <div className="text-center mb-10">
              <h1 className="text-5xl font-black tracking-tight bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                УГАДАЙКА
              </h1>
              <p className="text-white/40 mt-2 text-sm tracking-wide">
                Объясни слово — не называя его
              </p>
            </div>

            <Card className="p-6 mb-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-white/50 mb-4">Сложность</h2>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: 'easy'   as Difficulty, label: 'Лёгкая',  desc: 'Частые слова'  },
                  { key: 'medium' as Difficulty, label: 'Средняя', desc: 'Посложнее'     },
                  { key: 'hard'   as Difficulty, label: 'Сложная', desc: 'Для знатоков'  },
                ]).map(d => (
                  <button
                    key={d.key}
                    onClick={() => setDifficulty(d.key)}
                    className={`p-4 rounded-xl border transition-all duration-200 text-left ${
                      difficulty === d.key
                        ? 'border-yellow-400 bg-yellow-400/10 shadow-lg shadow-yellow-400/10'
                        : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                    }`}
                  >
                    <div className="font-bold text-sm mb-1">{d.label}</div>
                    <div className="text-[11px] text-white/40">{d.desc}</div>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-white/50">Время раунда</h2>
                <span className="font-mono font-black text-yellow-400 text-xl">{timeLimit}с</span>
              </div>
              <input
                type="range" min={20} max={180} step={5} value={timeLimit}
                onChange={e => setTimeLimit(Number(e.target.value))}
                className="w-full cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-white/30 mt-2">
                <span>20с</span><span>180с</span>
              </div>
            </Card>

            <button
              onClick={() => setPhase('nickname')}
              className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-black font-black text-lg rounded-2xl transition-all duration-200 transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-orange-500/20"
            >
              СОЗДАТЬ ЛОББИ
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  // ═══════════════════════════════════════════
  //  NICKNAME
  // ═══════════════════════════════════════════
  if (phase === 'nickname') {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="max-w-sm w-full">
            <div className="text-center mb-10">
              <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-400 bg-clip-text text-transparent mb-2">
                КАК ТЕБЯ ЗОВУТ?
              </h1>
              <p className="text-white/40 text-sm">
                {isInvited
                  ? 'Тебя пригласили в лобби — введи своё имя'
                  : 'Придумай никнейм — изменить потом нельзя'}
              </p>
            </div>

            {isInvited && (
              <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-2xl px-5 py-4 text-center">
                <div className="text-green-400 font-bold text-sm mb-1">Приглашение в лобби</div>
                <div className="text-white/50 text-xs">Введи имя и нажми войти — ты попадёшь к друзьям</div>
              </div>
            )}

            <Card className="p-6">
              <div className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Твой никнейм</div>
              <input
                type="text"
                value={nicknameInput}
                onChange={e => { setNicknameInput(e.target.value); setNicknameError(''); }}
                onKeyDown={e => e.key === 'Enter' && confirmNickname()}
                placeholder="Введи имя..."
                autoFocus
                maxLength={20}
                className={`w-full bg-white/5 border rounded-xl px-4 py-4 text-white placeholder-white/30 focus:outline-none transition text-lg font-bold mb-4 ${
                  nicknameError ? 'border-red-500/60 focus:border-red-500' : 'border-white/10 focus:border-yellow-400/60'
                }`}
              />
              {nicknameError && (
                <div className="text-red-400 text-sm mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {nicknameError}
                </div>
              )}
              <button
                onClick={confirmNickname}
                disabled={!nicknameInput.trim()}
                className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 disabled:from-white/10 disabled:to-white/10 disabled:text-white/30 text-black font-black text-lg rounded-2xl transition-all active:scale-95 shadow-lg shadow-orange-500/20 disabled:shadow-none"
              >
                {isInvited ? 'ВОЙТИ В ЛОББИ' : 'ВОЙТИ В ЛОББИ'}
              </button>
            </Card>

            {!isInvited && (
              <button
                onClick={() => setPhase('setup')}
                className="mt-4 w-full py-3 text-white/40 hover:text-white/70 text-sm transition"
              >
                Назад
              </button>
            )}
          </div>
        </div>
      </PageLayout>
    );
  }

  // ═══════════════════════════════════════════
  //  LOBBY
  // ═══════════════════════════════════════════
  if (phase === 'lobby') {
    const myPlayer = players.find(p => p.id === myPlayerId);
    const isHost   = !isInvited || players[0]?.id === myPlayerId;

    return (
      <PageLayout>
        <div className="p-4 pb-8">
          <div className="max-w-2xl mx-auto">

            {/* Header */}
            <div className="text-center py-6">
              <h1 className="text-3xl font-black bg-gradient-to-r from-yellow-300 to-pink-400 bg-clip-text text-transparent">
                ЛОББИ
              </h1>
              <div className="flex justify-center gap-4 mt-2 text-xs text-white/40">
                <span>{timeLimit}с</span>
                <span>·</span>
                <span>{difficulty === 'easy' ? 'Лёгкая' : difficulty === 'medium' ? 'Средняя' : 'Сложная'}</span>
              </div>
            </div>

            {/* Invite link */}
            <Card className="p-5 mb-4">
              <div className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">
                Ссылка-приглашение
              </div>
              <div className="flex gap-2">
                <div
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 font-mono text-sm text-white/70 truncate cursor-pointer select-all"
                  onClick={copyLink}
                  title="Нажми чтобы скопировать"
                >
                  {getLobbyLink()}
                </div>
                <button
                  onClick={copyLink}
                  className={`px-5 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 whitespace-nowrap ${
                    linkCopied
                      ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                      : 'bg-white/10 hover:bg-white/15 text-white'
                  }`}
                >
                  {linkCopied ? 'Скопировано!' : 'Копировать'}
                </button>
              </div>
              <p className="text-[11px] text-white/30 mt-2">
                Скопируй ссылку и отправь друзьям — они введут имя и попадут сюда
              </p>
            </Card>

            {/* Current player badge */}
            <Card className="p-4 mb-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-yellow-400/20 border border-yellow-400/40 flex items-center justify-center text-yellow-400 font-black text-sm shrink-0">
                {myNickname.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-xs text-white/40 uppercase tracking-widest">Ты играешь как</div>
                <div className="font-black text-yellow-400">{myNickname}</div>
              </div>
              <div className="text-xs text-white/30">
                {players.length} в лобби
              </div>
            </Card>

            {/* Observers */}
            {getObservers().length > 0 && (
              <Card className="p-5 mb-4">
                <div className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">
                  Наблюдатели ({getObservers().length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {getObservers().map(obs => (
                    <div key={obs.id} className="bg-white/8 border border-white/10 rounded-xl px-3 py-2 text-sm flex items-center gap-2">
                      <span className={`text-white/80 ${obs.id === myPlayerId ? 'text-yellow-400 font-bold' : ''}`}>
                        {obs.name}
                      </span>
                      <div className="flex gap-1">
                        {teams.map(t => {
                          const tp = getTeamPreset(t);
                          return (
                            <button
                              key={t.id}
                              onClick={() => assignTeam(obs.id, t.id)}
                              title={`В команду ${t.name}`}
                              className="w-5 h-5 rounded-full border-2 transition-all hover:scale-110 active:scale-95"
                              style={{ background: tp.accent, borderColor: tp.accent }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Teams */}
            <div className="space-y-3 mb-4">
              {teams.map((team) => {
                const p         = getTeamPreset(team);
                const tp        = getTeamPlayers(team.id);
                const tooFew    = tp.length > 0 && tp.length < 2;
                const otherTeams = teams.filter(t => t.id !== team.id);

                return (
                  <div key={team.id} className={`rounded-2xl p-5 border-2 transition-all ${p.bg} ${p.border}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className={`font-black text-base flex items-center gap-2 ${p.text}`}>
                        <span className="inline-block w-3 h-3 rounded-full" style={{ background: p.accent }} />
                        {team.name}
                        <span className="text-xs text-white/30 font-normal">{tp.length} игр.</span>
                      </h3>
                      {isHost && teams.length > 2 && (
                        <button
                          onClick={() => removeTeam(team.id)}
                          className="text-white/30 hover:text-red-400 text-xs transition"
                        >
                          Убрать
                        </button>
                      )}
                    </div>

                    {tooFew && (
                      <div className="text-xs text-red-400 mb-3 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                        Нужно минимум 2 игрока в команде
                      </div>
                    )}

                    {/* Team members */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {tp.map(pl => (
                        <div key={pl.id} className="bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm flex items-center gap-2">
                          <span className={`${pl.id === myPlayerId ? 'text-yellow-400 font-bold' : 'text-white/90'}`}>
                            {pl.name}
                          </span>
                          {pl.id === myPlayerId && (
                            <div className="flex gap-1 items-center">
                              {otherTeams.map(ot => {
                                const otp = getTeamPreset(ot);
                                return (
                                  <button
                                    key={ot.id}
                                    onClick={() => assignTeam(pl.id, ot.id)}
                                    title={`Перейти в ${ot.name}`}
                                    className="w-4 h-4 rounded-full border-2 transition-all hover:scale-125 active:scale-90 opacity-60 hover:opacity-100"
                                    style={{ background: otp.accent, borderColor: otp.accent }}
                                  />
                                );
                              })}
                              <button
                                onClick={() => assignTeam(pl.id, null)}
                                title="В наблюдатели"
                                className="w-4 h-4 rounded-full border-2 border-white/30 bg-white/10 hover:bg-white/25 transition-all hover:scale-125 active:scale-90 text-[8px] flex items-center justify-center text-white"
                              >
                                ×
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Add from observers */}
                    {getObservers().length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {getObservers().map(pl => (
                          <button
                            key={pl.id}
                            onClick={() => assignTeam(pl.id, team.id)}
                            className={`text-xs px-3 py-1.5 rounded-lg transition-all active:scale-95 text-white ${p.btn}`}
                          >
                            + {pl.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add team */}
            {isHost && teams.length < 6 && (
              <button
                onClick={addTeam}
                className="w-full py-3 border border-dashed border-white/15 rounded-2xl text-white/40 hover:border-white/25 hover:text-white/60 transition-all mb-5 flex items-center justify-center gap-2 text-sm"
              >
                + Добавить команду
              </button>
            )}

            {/* Start button — visible to all but only host can actually start */}
            <div className="flex gap-3">
              {!isInvited && (
                <button
                  onClick={() => { resetGame(); }}
                  className="px-5 py-4 bg-white/8 hover:bg-white/12 rounded-2xl font-bold transition-all text-sm"
                >
                  Назад
                </button>
              )}
              <button
                onClick={startGame}
                disabled={!canStartGame()}
                className="flex-1 py-4 bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-300 hover:to-emerald-400 disabled:from-white/10 disabled:to-white/10 disabled:text-white/30 text-black font-black text-base rounded-2xl transition-all transform hover:scale-[1.01] active:scale-95 shadow-lg shadow-green-500/20 disabled:shadow-none"
              >
                {canStartGame() ? 'НАЧАТЬ ИГРУ' : 'Нужно минимум 2 команды по 2 игрока'}
              </button>
            </div>

            {myPlayer && (
              <p className="text-center text-xs text-white/20 mt-4">
                Нажми на цветной кружок рядом со своим именем чтобы перейти в команду
              </p>
            )}
          </div>
        </div>
      </PageLayout>
    );
  }

  // ═══════════════════════════════════════════
  //  SCOREBOARD
  // ═══════════════════════════════════════════
  if (phase === 'scoreboard') {
    const currentTeam = getCurrentTeam();
    const commander   = getCurrentCommander();
    const activeTeams = teams.filter(t => getTeamPlayers(t.id).length >= 2);
    const maxScore    = Math.max(...activeTeams.map(t => t.score), 1);

    return (
      <PageLayout>
        <div className="flex flex-col min-h-screen p-4">
          <div className="max-w-lg mx-auto w-full flex-1 flex flex-col py-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-black tracking-wide text-white/80 uppercase">Табло</h1>
            </div>

            <div className="space-y-3 mb-8 flex-1">
              {activeTeams.map(team => {
                const p         = getTeamPreset(team);
                const isCurrent = currentTeam?.id === team.id;
                const pct       = (team.score / maxScore) * 100;
                return (
                  <div
                    key={team.id}
                    className={`rounded-2xl p-4 border-2 transition-all ${
                      isCurrent ? `${p.bg} ${p.border} shadow-lg` : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: p.accent }} />
                        <span className="font-bold">{team.name}</span>
                        {isCurrent && (
                          <span className="text-[11px] bg-yellow-400/20 text-yellow-400 border border-yellow-400/30 px-2 py-0.5 rounded-full animate-pulse">
                            Ходит
                          </span>
                        )}
                      </div>
                      <span className={`text-2xl font-black ${p.text}`}>{team.score}</span>
                    </div>
                    <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${p.color} rounded-full transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {currentTeam && commander && (
              <Card className="p-6 mb-6 text-center">
                <div className="text-xs uppercase tracking-widest text-white/40 mb-3">Сейчас ходят</div>
                <div className="text-2xl font-black mb-4" style={{ color: getTeamPreset(currentTeam).accent }}>
                  {currentTeam.name}
                </div>
                <div className="text-xs text-white/40 mb-1 uppercase tracking-widest">Командир</div>
                <div className="text-xl font-black text-yellow-400">{commander.name}</div>
                <div className="text-xs text-white/30 mt-4 leading-relaxed">
                  Командир объясняет слова голосом.<br/>Остальные — угадывают.
                </div>
              </Card>
            )}

            <button
              onClick={startRound}
              className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-black font-black text-lg rounded-2xl transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-orange-500/20"
            >
              НАЧАТЬ РАУНД
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  // ═══════════════════════════════════════════
  //  PLAYING
  // ═══════════════════════════════════════════
  if (phase === 'playing') {
    const currentTeam = getCurrentTeam();
    const commander   = getCurrentCommander();
    const currentWord = words[currentWordIndex] || 'Слова закончились';
    const minutes     = Math.floor(timeLeft / 60);
    const seconds     = timeLeft % 60;
    const pct         = (timeLeft / timeLimit) * 100;
    const timerColor  = timeLeft <= 10 ? '#ef4444' : timeLeft <= 20 ? '#f59e0b' : '#22c55e';
    const p           = currentTeam ? getTeamPreset(currentTeam) : TEAM_PRESETS[0];

    return (
      <PageLayout>
        <div className="flex flex-col min-h-screen p-4">
          <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">

            <div className="pt-4 pb-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm">
                  {currentTeam && <span className="font-bold" style={{ color: p.accent }}>{currentTeam.name}</span>}
                  <span className="text-white/30">·</span>
                  <span className="text-white/60">{commander?.name}</span>
                </div>
                <div
                  className={`font-mono font-black text-2xl transition-colors ${timeLeft <= 10 ? 'animate-pulse' : ''}`}
                  style={{ color: timerColor }}
                >
                  {minutes}:{seconds.toString().padStart(2, '0')}
                </div>
              </div>
              <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${pct}%`, background: timerColor }}
                />
              </div>
            </div>

            <div className="text-center text-xs text-white/30 mt-2 mb-3">
              Слово #{roundWords.length + 1} &nbsp;·&nbsp; Пропущено: {skippedInRound}
            </div>

            <div className="flex-1 flex flex-col items-center justify-center">
              <Card className="w-full p-10 text-center border-white/15 mb-6">
                <div className="text-[11px] uppercase tracking-widest text-white/30 mb-6">
                  Объясни это слово
                </div>
                <div className="text-5xl sm:text-6xl font-black text-white leading-tight break-words mb-4">
                  {currentWord}
                </div>
                <div className="text-[11px] text-white/20">
                  {difficulty === 'easy' ? 'Лёгкая' : difficulty === 'medium' ? 'Средняя' : 'Сложная'}
                </div>
              </Card>
            </div>

            {roundWords.length > 0 && (
              <div className="mb-4 max-h-28 overflow-y-auto">
                <div className="text-[11px] text-white/30 mb-1.5 uppercase tracking-widest">Прошедшие слова</div>
                <div className="flex flex-wrap gap-1.5">
                  {roundWords.map((w, i) => (
                    <span
                      key={i}
                      className={`text-xs px-2.5 py-1 rounded-lg ${
                        w.guessed === false
                          ? 'bg-red-500/15 text-red-400 line-through'
                          : 'bg-white/8 text-white/60'
                      }`}
                    >
                      {w.word}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pb-4">
              <button
                onClick={skipWord}
                className="py-5 bg-white/8 hover:bg-red-500/20 border border-white/10 hover:border-red-500/40 rounded-2xl font-bold text-base transition-all active:scale-95 text-white/80"
              >
                Пропустить
              </button>
              <button
                onClick={nextWord}
                className="py-5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 rounded-2xl font-black text-base transition-all active:scale-95 text-white shadow-lg shadow-green-500/20"
              >
                Следующее слово
              </button>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  // ═══════════════════════════════════════════
  //  REVIEW
  // ═══════════════════════════════════════════
  if (phase === 'review') {
    const currentTeam  = getCurrentTeam();
    const guessedCount = roundWords.filter(w => w.guessed === true).length;
    const p            = currentTeam ? getTeamPreset(currentTeam) : TEAM_PRESETS[0];

    return (
      <PageLayout>
        <div className="flex flex-col min-h-screen p-4">
          <div className="max-w-lg mx-auto w-full flex-1 flex flex-col py-6">

            <div className="text-center mb-6">
              <div className="inline-block bg-red-500/15 border border-red-500/30 rounded-2xl px-6 py-3 mb-4">
                <span className="text-red-400 font-black text-lg tracking-wide">ВРЕМЯ ВЫШЛО</span>
              </div>
              {currentTeam && (
                <div className="font-bold" style={{ color: p.accent }}>{currentTeam.name} — проверка</div>
              )}
            </div>

            <div className="text-center mb-6">
              <span className="text-4xl font-black text-yellow-400">+{guessedCount}</span>
              <span className="text-white/40 text-sm ml-2">очков</span>
            </div>

            <div className="flex-1 space-y-2 mb-6 overflow-y-auto">
              {roundWords.length === 0 && (
                <div className="text-center text-white/30 py-10">Ни одного слова в этом раунде</div>
              )}
              {roundWords.map((w, i) => (
                <div
                  key={i}
                  className={`rounded-xl p-3.5 border-2 flex items-center justify-between transition-all ${
                    w.guessed === true
                      ? 'bg-green-500/8 border-green-500/50'
                      : w.guessed === false
                      ? 'bg-red-500/8 border-red-500/50'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <span className={`font-bold ${w.guessed === false ? 'line-through text-white/30' : ''}`}>
                    {w.word}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => markWord(i, true)}
                      className={`w-10 h-10 rounded-xl font-bold text-sm transition-all active:scale-90 ${
                        w.guessed === true
                          ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                          : 'bg-white/8 hover:bg-green-500/30 text-white/50 hover:text-green-400'
                      }`}
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => markWord(i, false)}
                      className={`w-10 h-10 rounded-xl font-bold text-sm transition-all active:scale-90 ${
                        w.guessed === false
                          ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                          : 'bg-white/8 hover:bg-red-500/30 text-white/50 hover:text-red-400'
                      }`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={finishReview}
              disabled={!allReviewed && roundWords.length > 0}
              className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 disabled:from-white/10 disabled:to-white/10 disabled:text-white/30 text-black font-black text-lg rounded-2xl transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-orange-500/20 disabled:shadow-none"
            >
              {allReviewed || roundWords.length === 0 ? 'ДАЛЕЕ' : 'Отметьте все слова'}
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  // ═══════════════════════════════════════════
  //  GAME OVER
  // ═══════════════════════════════════════════
  if (phase === 'gameover') {
    const sorted = [...teams].sort((a, b) => b.score - a.score);
    const winner = sorted[0];
    const p      = winner ? getTeamPreset(winner) : TEAM_PRESETS[0];

    return (
      <PageLayout>
        <div className="flex flex-col min-h-screen items-center justify-center p-4">
          <div className="max-w-lg w-full text-center">
            <div className="text-5xl font-black mb-2 tracking-tight bg-gradient-to-r from-yellow-300 to-orange-400 bg-clip-text text-transparent">
              ПОБЕДА!
            </div>
            {winner && (
              <div className="mb-8">
                <div className="text-2xl font-black mb-1" style={{ color: p.accent }}>{winner.name}</div>
                <div className="text-5xl font-black text-yellow-400">{winner.score}</div>
                <div className="text-white/30 text-sm">очков</div>
              </div>
            )}
            <div className="space-y-3 mb-8">
              {sorted.map((team, i) => {
                const tp = getTeamPreset(team);
                return (
                  <Card key={team.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-white/30 font-bold w-6">#{i + 1}</span>
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: tp.accent }} />
                      <span className="font-bold">{team.name}</span>
                    </div>
                    <span className="text-xl font-black">{team.score}</span>
                  </Card>
                );
              })}
            </div>
            <button
              onClick={resetGame}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-black text-lg rounded-2xl transition-all active:scale-95"
            >
              НОВАЯ ИГРА
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return null;
}
