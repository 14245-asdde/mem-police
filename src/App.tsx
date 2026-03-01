import { useState, useEffect, useCallback, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { getWordsForDifficulty } from './data/words';

type Difficulty = 'easy' | 'medium' | 'hard';
type GamePhase = 'setup' | 'nickname' | 'waiting' | 'lobby' | 'playing' | 'review' | 'scoreboard';

interface Player {
  id: string;
  name: string;
  teamId: number | null;
}

interface Team {
  id: number;
  color: string;
  name: string;
  accent: string;
  border: string;
  bg: string;
  text: string;
  btn: string;
  score: number;
}

interface WordResult {
  word: string;
  guessed: boolean | null;
}

// Message types sent over PeerJS
type Msg =
  | { type: 'LOBBY_STATE'; state: SharedState }
  | { type: 'JOIN'; player: Player }
  | { type: 'ASSIGN_TEAM'; playerId: string; teamId: number | null }
  | { type: 'ADD_TEAM' }
  | { type: 'REMOVE_TEAM'; teamId: number }
  | { type: 'START_GAME' }
  | { type: 'START_ROUND' }
  | { type: 'NEXT_WORD' }
  | { type: 'SKIP_WORD' }
  | { type: 'MARK_WORD'; index: number; guessed: boolean }
  | { type: 'FINISH_REVIEW' }
  | { type: 'RESET' };

interface SharedState {
  phase: GamePhase;
  difficulty: Difficulty;
  timeLimit: number;
  players: Player[];
  teams: Team[];
  currentTeamIndex: number;
  commanderIndex: Record<number, number>;
  words: string[];
  currentWordIndex: number;
  roundWords: WordResult[];
  skippedInRound: number;
  timeLeft: number;
  isTimerRunning: boolean;
}

const TEAM_PRESETS: Omit<Team, 'id' | 'score'>[] = [
  { color: 'from-red-500 to-rose-600',      name: 'Красные',    accent: '#ef4444', border: 'border-red-500',     bg: 'bg-red-500/10',     text: 'text-red-400',     btn: 'bg-red-600 hover:bg-red-500' },
  { color: 'from-blue-500 to-indigo-600',   name: 'Синие',      accent: '#3b82f6', border: 'border-blue-500',    bg: 'bg-blue-500/10',    text: 'text-blue-400',    btn: 'bg-blue-600 hover:bg-blue-500' },
  { color: 'from-emerald-500 to-green-600', name: 'Зелёные',    accent: '#10b981', border: 'border-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400', btn: 'bg-emerald-600 hover:bg-emerald-500' },
  { color: 'from-amber-400 to-yellow-500',  name: 'Жёлтые',     accent: '#f59e0b', border: 'border-amber-400',   bg: 'bg-amber-400/10',   text: 'text-amber-400',   btn: 'bg-amber-500 hover:bg-amber-400' },
  { color: 'from-purple-500 to-violet-600', name: 'Фиолетовые', accent: '#8b5cf6', border: 'border-purple-500',  bg: 'bg-purple-500/10',  text: 'text-purple-400',  btn: 'bg-purple-600 hover:bg-purple-500' },
  { color: 'from-orange-500 to-red-500',    name: 'Оранжевые',  accent: '#f97316', border: 'border-orange-500',  bg: 'bg-orange-500/10',  text: 'text-orange-400',  btn: 'bg-orange-600 hover:bg-orange-500' },
];

function makeTeam(idx: number, id: number): Team {
  return { id, ...TEAM_PRESETS[idx % TEAM_PRESETS.length], score: 0 };
}

function getLobbyIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('lobby');
}

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
  const urlLobbyId = getLobbyIdFromUrl();
  const isGuest = !!urlLobbyId;

  // ── UI state ──
  const [phase, setPhase] = useState<GamePhase>('setup');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [timeLimit, setTimeLimit] = useState(60);
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [myNickname, setMyNickname] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // ── Shared game state (host is source of truth) ──
  const [sharedState, setSharedState] = useState<SharedState>({
    phase: 'lobby',
    difficulty: 'easy',
    timeLimit: 60,
    players: [],
    teams: [makeTeam(0, 0), makeTeam(1, 1)],
    currentTeamIndex: 0,
    commanderIndex: {},
    words: [],
    currentWordIndex: 0,
    roundWords: [],
    skippedInRound: 0,
    timeLeft: 0,
    isTimerRunning: false,
  });

  // ── PeerJS refs ──
  const peerRef = useRef<Peer | null>(null);
  const hostConnRef = useRef<DataConnection | null>(null); // guest→host connection
  const guestConnsRef = useRef<Map<string, DataConnection>>(new Map()); // host→guests
  const myPlayerIdRef = useRef<string>(`p_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const isHostRef = useRef(false);
  const sharedStateRef = useRef(sharedState);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  sharedStateRef.current = sharedState;

  // ── Helpers ──
  const getLobbyLink = (lobbyId: string) =>
    `${window.location.origin}${window.location.pathname}?lobby=${lobbyId}`;

  const playBeep = useCallback((freq = 800, dur = 200) => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = 'sine'; g.gain.value = 0.3;
      osc.start(); osc.stop(ctx.currentTime + dur / 1000);
    } catch { /* ignore */ }
  }, []);

  // ── Broadcast state to all guests (host only) ──
  const broadcastState = useCallback((state: SharedState) => {
    const msg: Msg = { type: 'LOBBY_STATE', state };
    guestConnsRef.current.forEach(conn => {
      if (conn.open) conn.send(msg);
    });
  }, []);

  // ── Update shared state and broadcast (host only) ──
  const updateState = useCallback((updater: (prev: SharedState) => SharedState) => {
    setSharedState(prev => {
      const next = updater(prev);
      sharedStateRef.current = next;
      if (isHostRef.current) {
        setTimeout(() => broadcastState(next), 0);
      }
      return next;
    });
  }, [broadcastState]);

  // ── Handle incoming message on HOST ──
  const handleHostMessage = useCallback((msg: Msg, senderConn: DataConnection) => {
    if (msg.type === 'JOIN') {
      updateState(prev => {
        const already = prev.players.find(p => p.id === msg.player.id);
        if (already) {
          // Re-send full state to reconnecting player
          setTimeout(() => { if (senderConn.open) senderConn.send({ type: 'LOBBY_STATE', state: prev }); }, 100);
          return prev;
        }
        const next = { ...prev, players: [...prev.players, msg.player] };
        setTimeout(() => {
          guestConnsRef.current.forEach(conn => { if (conn.open) conn.send({ type: 'LOBBY_STATE', state: next }); });
        }, 50);
        return next;
      });
    }
    if (msg.type === 'ASSIGN_TEAM') {
      updateState(prev => ({
        ...prev,
        players: prev.players.map(p => p.id === msg.playerId ? { ...p, teamId: msg.teamId } : p),
      }));
    }
    if (msg.type === 'ADD_TEAM') {
      updateState(prev => {
        if (prev.teams.length >= 6) return prev;
        const idx = prev.teams.length;
        return { ...prev, teams: [...prev.teams, makeTeam(idx, Date.now())] };
      });
    }
    if (msg.type === 'REMOVE_TEAM') {
      updateState(prev => ({
        ...prev,
        teams: prev.teams.filter(t => t.id !== msg.teamId),
        players: prev.players.map(p => p.teamId === msg.teamId ? { ...p, teamId: null } : p),
      }));
    }
    if (msg.type === 'START_GAME') {
      handleStartGame();
    }
    if (msg.type === 'START_ROUND') {
      handleStartRound();
    }
    if (msg.type === 'NEXT_WORD') {
      handleNextWord();
    }
    if (msg.type === 'SKIP_WORD') {
      handleSkipWord();
    }
    if (msg.type === 'MARK_WORD') {
      updateState(prev => ({
        ...prev,
        roundWords: prev.roundWords.map((w, i) => i === msg.index ? { ...w, guessed: msg.guessed } : w),
      }));
    }
    if (msg.type === 'FINISH_REVIEW') {
      handleFinishReview();
    }
    if (msg.type === 'RESET') {
      handleReset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateState]);

  // ── Send message to host (guest) or process locally (host) ──
  const sendToHost = useCallback((msg: Msg) => {
    if (isHostRef.current) {
      // Process locally as host
      handleHostMessage(msg, null as unknown as DataConnection);
    } else {
      if (hostConnRef.current?.open) {
        hostConnRef.current.send(msg);
      }
    }
  }, [handleHostMessage]);

  // ── Setup host peer ──
  const setupHostPeer = useCallback((lobbyId: string, hostPlayer: Player, initialDifficulty: Difficulty, initialTimeLimit: number) => {
    const peer = new Peer(`ugadaika_${lobbyId}`, {
      debug: 0,
    });
    peerRef.current = peer;
    isHostRef.current = true;

    const initialState: SharedState = {
      phase: 'lobby',
      difficulty: initialDifficulty,
      timeLimit: initialTimeLimit,
      players: [hostPlayer],
      teams: [makeTeam(0, 0), makeTeam(1, 1)],
      currentTeamIndex: 0,
      commanderIndex: {},
      words: [],
      currentWordIndex: 0,
      roundWords: [],
      skippedInRound: 0,
      timeLeft: 0,
      isTimerRunning: false,
    };
    setSharedState(initialState);
    sharedStateRef.current = initialState;

    peer.on('open', (id) => {
      console.log('Host peer open:', id);
      setConnectionStatus('connected');
    });

    peer.on('connection', (conn) => {
      guestConnsRef.current.set(conn.peer, conn);

      conn.on('open', () => {
        // Send current state to new guest
        conn.send({ type: 'LOBBY_STATE', state: sharedStateRef.current });
      });

      conn.on('data', (data) => {
        handleHostMessage(data as Msg, conn);
      });

      conn.on('close', () => {
        guestConnsRef.current.delete(conn.peer);
      });
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      if ((err as { type?: string }).type === 'unavailable-id') {
        setErrorMsg('Лобби с таким ID уже существует. Попробуй ещё раз.');
      } else {
        setErrorMsg('Ошибка соединения: ' + err.message);
      }
      setConnectionStatus('error');
    });
  }, [handleHostMessage]);

  // ── Setup guest peer ──
  const setupGuestPeer = useCallback((lobbyId: string, guestPlayer: Player) => {
    setConnectionStatus('connecting');
    const peer = new Peer(undefined as unknown as string, { debug: 0 });
    peerRef.current = peer;
    isHostRef.current = false;

    peer.on('open', () => {
      const conn = peer.connect(`ugadaika_${lobbyId}`, { reliable: true });
      hostConnRef.current = conn;

      conn.on('open', () => {
        setConnectionStatus('connected');
        // Send JOIN message
        conn.send({ type: 'JOIN', player: guestPlayer } as Msg);
      });

      conn.on('data', (data) => {
        const msg = data as Msg;
        if (msg.type === 'LOBBY_STATE') {
          setSharedState(msg.state);
          sharedStateRef.current = msg.state;
          setPhase(msg.state.phase);
        }
      });

      conn.on('close', () => {
        setConnectionStatus('error');
        setErrorMsg('Соединение с хостом потеряно');
      });

      conn.on('error', (err) => {
        setConnectionStatus('error');
        setErrorMsg('Ошибка: ' + err.message);
      });
    });

    peer.on('error', (err) => {
      console.error('Guest peer error:', err);
      if ((err as { type?: string }).type === 'peer-unavailable') {
        setErrorMsg('Лобби не найдено. Попроси у друга актуальную ссылку.');
      } else {
        setErrorMsg('Ошибка соединения: ' + err.message);
      }
      setConnectionStatus('error');
    });
  }, []);

  // ── Sync phase from sharedState for host ──
  useEffect(() => {
    if (isHostRef.current) {
      setPhase(sharedState.phase);
    }
  }, [sharedState.phase]);

  // ── Timer (host only) ──
  useEffect(() => {
    if (!isHostRef.current) return;
    if (sharedState.isTimerRunning && sharedState.timeLeft > 0) {
      timerRef.current = setInterval(() => {
        updateState(prev => {
          if (!prev.isTimerRunning || prev.timeLeft <= 0) return prev;
          const newTime = prev.timeLeft - 1;
          if (newTime <= 0) {
            playBeep(400, 500);
            return { ...prev, timeLeft: 0, isTimerRunning: false, phase: 'review' };
          }
          if (newTime <= 6) playBeep(600, 100);
          return { ...prev, timeLeft: newTime };
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedState.isTimerRunning, sharedState.timeLeft > 0]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      peerRef.current?.destroy();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Game logic (host only, called by handleHostMessage or directly) ──
  const handleStartGame = useCallback(() => {
    const st = sharedStateRef.current;
    const activeTeams = st.teams.filter(t => st.players.filter(p => p.teamId === t.id).length >= 2);
    const cmdIdx: Record<number, number> = {};
    activeTeams.forEach(t => { cmdIdx[t.id] = Math.floor(Math.random() * st.players.filter(p => p.teamId === t.id).length); });
    const wordPool = getWordsForDifficulty(st.difficulty);
    updateState(prev => ({
      ...prev,
      teams: activeTeams.map(t => ({ ...t, score: 0 })),
      commanderIndex: cmdIdx,
      words: wordPool,
      currentWordIndex: 0,
      currentTeamIndex: 0,
      phase: 'scoreboard',
    }));
  }, [updateState]);

  const handleStartRound = useCallback(() => {
    updateState(prev => ({
      ...prev,
      roundWords: [],
      skippedInRound: 0,
      timeLeft: prev.timeLimit,
      isTimerRunning: true,
      phase: 'playing',
    }));
  }, [updateState]);

  const handleNextWord = useCallback(() => {
    updateState(prev => {
      const w = prev.words[prev.currentWordIndex] || '';
      return {
        ...prev,
        roundWords: [...prev.roundWords, { word: w, guessed: null }],
        currentWordIndex: prev.currentWordIndex + 1,
      };
    });
  }, [updateState]);

  const handleSkipWord = useCallback(() => {
    updateState(prev => {
      const w = prev.words[prev.currentWordIndex] || '';
      return {
        ...prev,
        roundWords: [...prev.roundWords, { word: w, guessed: false }],
        currentWordIndex: prev.currentWordIndex + 1,
        skippedInRound: prev.skippedInRound + 1,
      };
    });
  }, [updateState]);

  const handleFinishReview = useCallback(() => {
    updateState(prev => {
      const guessedCount = prev.roundWords.filter(w => w.guessed === true).length;
      const activeTeams = prev.teams.filter(t => prev.players.filter(p => p.teamId === t.id).length >= 2);
      const currentTeam = activeTeams[prev.currentTeamIndex];
      const teamPlayers = prev.players.filter(p => p.teamId === currentTeam?.id);
      const nextCmdIdx = {
        ...prev.commanderIndex,
        [currentTeam?.id]: ((prev.commanderIndex[currentTeam?.id] || 0) + 1) % Math.max(teamPlayers.length, 1),
      };
      const nextTeamIndex = (prev.currentTeamIndex + 1) % activeTeams.length;
      const newWords = prev.currentWordIndex >= prev.words.length - 50
        ? [...prev.words, ...getWordsForDifficulty(prev.difficulty)]
        : prev.words;
      return {
        ...prev,
        teams: prev.teams.map(t => t.id === currentTeam?.id ? { ...t, score: t.score + guessedCount } : t),
        commanderIndex: nextCmdIdx,
        currentTeamIndex: nextTeamIndex,
        words: newWords,
        phase: 'scoreboard',
      };
    });
  }, [updateState]);

  const handleReset = useCallback(() => {
    updateState(() => ({
      phase: 'lobby',
      difficulty: sharedStateRef.current.difficulty,
      timeLimit: sharedStateRef.current.timeLimit,
      players: sharedStateRef.current.players,
      teams: [makeTeam(0, 0), makeTeam(1, 1)],
      currentTeamIndex: 0,
      commanderIndex: {},
      words: [],
      currentWordIndex: 0,
      roundWords: [],
      skippedInRound: 0,
      timeLeft: 0,
      isTimerRunning: false,
    }));
  }, [updateState]);

  // ── Confirm nickname ──
  const confirmNickname = () => {
    const name = nicknameInput.trim();
    if (!name) { setNicknameError('Введи имя'); return; }
    if (name.length < 2) { setNicknameError('Имя слишком короткое'); return; }

    setMyNickname(name);
    const player: Player = { id: myPlayerIdRef.current, name, teamId: null };

    if (isGuest && urlLobbyId) {
      setupGuestPeer(urlLobbyId, player);
      setPhase('lobby');
    } else {
      // Host
      const newId = Math.random().toString(36).slice(2, 8).toUpperCase();
      window.history.replaceState({}, '', `${window.location.pathname}?lobby=${newId}`);
      setupHostPeer(newId, player, difficulty, timeLimit);
      setPhase('lobby');
    }
  };

  // ── Derived values from sharedState ──
  const st = sharedState;
  const getTeamPlayers = (teamId: number) => st.players.filter(p => p.teamId === teamId);
  const getObservers = () => st.players.filter(p => p.teamId === null);
  const canStartGame = () => {
    const active = st.teams.filter(t => getTeamPlayers(t.id).length >= 2);
    return active.length >= 2;
  };
  const activeTeams = st.teams.filter(t => getTeamPlayers(t.id).length >= 2);
  const currentTeam = activeTeams[st.currentTeamIndex] ?? null;
  const commander = (() => {
    if (!currentTeam) return null;
    const pl = getTeamPlayers(currentTeam.id);
    return pl[(st.commanderIndex[currentTeam.id] ?? 0) % Math.max(pl.length, 1)] ?? null;
  })();
  const allReviewed = st.roundWords.every(w => w.guessed !== null);
  const myPlayerId = myPlayerIdRef.current;
  const isMyTurn = commander?.id === myPlayerId;

  // ── Copy link ──
  const copyLink = async () => {
    const lobbyId = new URLSearchParams(window.location.search).get('lobby') || '';
    try {
      await navigator.clipboard.writeText(getLobbyLink(lobbyId));
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch { /* ignore */ }
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
              <p className="text-white/40 mt-2 text-sm tracking-wide">Объясни слово — не называя его</p>
            </div>

            <Card className="p-6 mb-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-white/50 mb-4">Сложность</h2>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: 'easy' as Difficulty, label: 'Лёгкая', desc: 'Частые слова' },
                  { key: 'medium' as Difficulty, label: 'Средняя', desc: 'Посложнее' },
                  { key: 'hard' as Difficulty, label: 'Сложная', desc: 'Для знатоков' },
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
                {isGuest ? 'Тебя пригласили — введи имя и входи' : 'Придумай никнейм — изменить нельзя'}
              </p>
            </div>

            {isGuest && (
              <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-2xl px-5 py-4 text-center">
                <div className="text-green-400 font-bold text-sm mb-1">Приглашение в лобби</div>
                <div className="text-white/50 text-xs">Введи имя — попадёшь к друзьям мгновенно</div>
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
                  nicknameError ? 'border-red-500/60' : 'border-white/10 focus:border-yellow-400/60'
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
                ВОЙТИ В ЛОББИ
              </button>
            </Card>

            {!isGuest && (
              <button onClick={() => setPhase('setup')} className="mt-4 w-full py-3 text-white/40 hover:text-white/70 text-sm transition">
                Назад
              </button>
            )}
          </div>
        </div>
      </PageLayout>
    );
  }

  // ── Error screen ──
  if (connectionStatus === 'error') {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <Card className="max-w-sm w-full p-8 text-center">
            <div className="text-4xl mb-4">!</div>
            <div className="text-red-400 font-black text-xl mb-2">Ошибка подключения</div>
            <div className="text-white/50 text-sm mb-6">{errorMsg}</div>
            <button
              onClick={() => { window.history.replaceState({}, '', window.location.pathname); window.location.reload(); }}
              className="w-full py-3 bg-white/10 hover:bg-white/15 rounded-xl font-bold transition"
            >
              На главную
            </button>
          </Card>
        </div>
      </PageLayout>
    );
  }

  // ═══════════════════════════════════════════
  //  LOBBY
  // ═══════════════════════════════════════════
  if (phase === 'lobby') {
    const lobbyUrlId = new URLSearchParams(window.location.search).get('lobby') || '';

    return (
      <PageLayout>
        <div className="p-4 pb-8">
          <div className="max-w-2xl mx-auto">

            <div className="text-center py-6">
              <h1 className="text-3xl font-black bg-gradient-to-r from-yellow-300 to-pink-400 bg-clip-text text-transparent">
                ЛОББИ
              </h1>
              <div className="flex justify-center gap-4 mt-2 text-xs text-white/40">
                <span>{st.timeLimit}с</span>
                <span>·</span>
                <span>{st.difficulty === 'easy' ? 'Лёгкая' : st.difficulty === 'medium' ? 'Средняя' : 'Сложная'}</span>
                <span>·</span>
                <span className={`${connectionStatus === 'connected' ? 'text-green-400' : 'text-yellow-400 animate-pulse'}`}>
                  {connectionStatus === 'connected' ? 'Онлайн' : 'Подключение...'}
                </span>
              </div>
            </div>

            {/* Invite link */}
            <Card className="p-5 mb-4">
              <div className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Ссылка-приглашение</div>
              <div className="flex gap-2">
                <div
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 font-mono text-sm text-white/70 truncate cursor-pointer"
                  onClick={copyLink}
                >
                  {getLobbyLink(lobbyUrlId)}
                </div>
                <button
                  onClick={copyLink}
                  className={`px-5 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 whitespace-nowrap ${
                    linkCopied ? 'bg-green-500 text-white' : 'bg-white/10 hover:bg-white/15 text-white'
                  }`}
                >
                  {linkCopied ? 'Скопировано!' : 'Копировать'}
                </button>
              </div>
              <p className="text-[11px] text-white/30 mt-2">Отправь ссылку друзьям — они введут имя и сразу попадут сюда</p>
            </Card>

            {/* My badge */}
            <Card className="p-4 mb-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-yellow-400/20 border border-yellow-400/40 flex items-center justify-center text-yellow-400 font-black text-sm shrink-0">
                {myNickname.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-xs text-white/40 uppercase tracking-widest">Ты играешь как</div>
                <div className="font-black text-yellow-400">{myNickname}</div>
              </div>
              <div className="text-xs text-white/30">{st.players.length} в лобби</div>
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
                      <span className={obs.id === myPlayerId ? 'text-yellow-400 font-bold' : 'text-white/80'}>
                        {obs.name}
                      </span>
                      {obs.id === myPlayerId && (
                        <div className="flex gap-1">
                          {st.teams.map(t => (
                            <button
                              key={t.id}
                              onClick={() => sendToHost({ type: 'ASSIGN_TEAM', playerId: myPlayerId, teamId: t.id })}
                              title={`В команду ${t.name}`}
                              className="w-5 h-5 rounded-full border-2 transition-all hover:scale-110 active:scale-95"
                              style={{ background: t.accent, borderColor: t.accent }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Teams */}
            <div className="space-y-3 mb-4">
              {st.teams.map((team) => {
                const tp = getTeamPlayers(team.id);
                const tooFew = tp.length > 0 && tp.length < 2;
                const otherTeams = st.teams.filter(t => t.id !== team.id);

                return (
                  <div key={team.id} className={`rounded-2xl p-5 border-2 transition-all ${team.bg} ${team.border}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className={`font-black text-base flex items-center gap-2 ${team.text}`}>
                        <span className="inline-block w-3 h-3 rounded-full" style={{ background: team.accent }} />
                        {team.name}
                        <span className="text-xs text-white/30 font-normal">{tp.length} игр.</span>
                      </h3>
                      {!isGuest && st.teams.length > 2 && (
                        <button
                          onClick={() => sendToHost({ type: 'REMOVE_TEAM', teamId: team.id })}
                          className="text-white/30 hover:text-red-400 text-xs transition"
                        >
                          Убрать
                        </button>
                      )}
                    </div>

                    {tooFew && (
                      <div className="text-xs text-red-400 mb-3 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                        Нужно минимум 2 игрока
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 mb-3">
                      {tp.map(pl => (
                        <div key={pl.id} className="bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm flex items-center gap-2">
                          <span className={pl.id === myPlayerId ? 'text-yellow-400 font-bold' : 'text-white/90'}>
                            {pl.name}
                          </span>
                          {pl.id === myPlayerId && (
                            <div className="flex gap-1 items-center">
                              {otherTeams.map(ot => (
                                <button
                                  key={ot.id}
                                  onClick={() => sendToHost({ type: 'ASSIGN_TEAM', playerId: myPlayerId, teamId: ot.id })}
                                  title={`В ${ot.name}`}
                                  className="w-4 h-4 rounded-full border-2 transition-all hover:scale-125 active:scale-90 opacity-60 hover:opacity-100"
                                  style={{ background: ot.accent, borderColor: ot.accent }}
                                />
                              ))}
                              <button
                                onClick={() => sendToHost({ type: 'ASSIGN_TEAM', playerId: myPlayerId, teamId: null })}
                                title="В наблюдатели"
                                className="w-4 h-4 rounded-full border-2 border-white/30 bg-white/10 hover:bg-white/25 transition-all hover:scale-125 text-[8px] flex items-center justify-center text-white"
                              >
                                x
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {getObservers().filter(o => o.id === myPlayerId).length > 0 && (
                      <button
                        onClick={() => sendToHost({ type: 'ASSIGN_TEAM', playerId: myPlayerId, teamId: team.id })}
                        className={`text-xs px-3 py-1.5 rounded-lg transition-all active:scale-95 text-white ${team.btn}`}
                      >
                        + Войти
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add team */}
            {!isGuest && st.teams.length < 6 && (
              <button
                onClick={() => sendToHost({ type: 'ADD_TEAM' })}
                className="w-full py-3 border border-dashed border-white/15 rounded-2xl text-white/40 hover:border-white/25 hover:text-white/60 transition-all mb-5 flex items-center justify-center gap-2 text-sm"
              >
                + Добавить команду
              </button>
            )}

            {/* Start */}
            <div className="flex gap-3">
              {!isGuest && (
                <button
                  onClick={() => { peerRef.current?.destroy(); window.history.replaceState({}, '', window.location.pathname); setPhase('setup'); }}
                  className="px-5 py-4 bg-white/8 hover:bg-white/12 rounded-2xl font-bold transition-all text-sm"
                >
                  Назад
                </button>
              )}
              <button
                onClick={() => sendToHost({ type: 'START_GAME' })}
                disabled={!canStartGame()}
                className="flex-1 py-4 bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-300 hover:to-emerald-400 disabled:from-white/10 disabled:to-white/10 disabled:text-white/30 text-black font-black text-base rounded-2xl transition-all hover:scale-[1.01] active:scale-95 shadow-lg shadow-green-500/20 disabled:shadow-none"
              >
                {canStartGame() ? 'НАЧАТЬ ИГРУ' : 'Нужно 2+ команды по 2+ игрока'}
              </button>
            </div>

            <p className="text-center text-xs text-white/20 mt-4">
              Цветные кружки рядом с именем — переход между командами
            </p>
          </div>
        </div>
      </PageLayout>
    );
  }

  // ═══════════════════════════════════════════
  //  SCOREBOARD
  // ═══════════════════════════════════════════
  if (phase === 'scoreboard') {
    const maxScore = Math.max(...activeTeams.map(t => t.score), 1);

    return (
      <PageLayout>
        <div className="flex flex-col min-h-screen p-4">
          <div className="max-w-lg mx-auto w-full flex-1 flex flex-col py-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-black tracking-wide text-white/80 uppercase">Табло</h1>
            </div>

            <div className="space-y-3 mb-8 flex-1">
              {activeTeams.map(team => {
                const isCurrent = currentTeam?.id === team.id;
                const pct = (team.score / maxScore) * 100;
                return (
                  <div
                    key={team.id}
                    className={`rounded-2xl p-4 border-2 transition-all ${
                      isCurrent ? `${team.bg} ${team.border} shadow-lg` : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: team.accent }} />
                        <span className="font-bold">{team.name}</span>
                        {isCurrent && (
                          <span className="text-[11px] bg-yellow-400/20 text-yellow-400 border border-yellow-400/30 px-2 py-0.5 rounded-full animate-pulse">
                            Ходит
                          </span>
                        )}
                      </div>
                      <span className="text-2xl font-black" style={{ color: team.accent }}>{team.score}</span>
                    </div>
                    <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: team.accent }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {currentTeam && commander && (
              <Card className="p-6 mb-6 text-center">
                <div className="text-xs uppercase tracking-widest text-white/40 mb-3">Сейчас ходят</div>
                <div className="text-2xl font-black mb-4" style={{ color: currentTeam.accent }}>
                  {currentTeam.name}
                </div>
                <div className="text-xs text-white/40 mb-1 uppercase tracking-widest">Командир</div>
                <div className="text-xl font-black text-yellow-400">{commander.name}</div>
                {isMyTurn && (
                  <div className="mt-3 text-xs text-yellow-300 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-2">
                    Это ты! Нажми "Начать раунд" и объясняй слова
                  </div>
                )}
              </Card>
            )}

            <button
              onClick={() => sendToHost({ type: 'START_ROUND' })}
              className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-black font-black text-lg rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-orange-500/20"
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
    const currentWord = st.words[st.currentWordIndex] || '...';
    const minutes = Math.floor(st.timeLeft / 60);
    const seconds = st.timeLeft % 60;
    const pct = (st.timeLeft / st.timeLimit) * 100;
    const timerColor = st.timeLeft <= 10 ? '#ef4444' : st.timeLeft <= 20 ? '#f59e0b' : '#22c55e';

    return (
      <PageLayout>
        <div className="flex flex-col min-h-screen p-4">
          <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">

            <div className="pt-4 pb-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm">
                  {currentTeam && <span className="font-bold" style={{ color: currentTeam.accent }}>{currentTeam.name}</span>}
                  <span className="text-white/30">·</span>
                  <span className="text-white/60">{commander?.name}</span>
                  {isMyTurn && <span className="text-yellow-400 text-xs font-bold">(ты)</span>}
                </div>
                <div
                  className={`font-mono font-black text-2xl transition-colors ${st.timeLeft <= 10 ? 'animate-pulse' : ''}`}
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
              Слово #{st.roundWords.length + 1} &nbsp;·&nbsp; Пропущено: {st.skippedInRound}
            </div>

            <div className="flex-1 flex flex-col items-center justify-center">
              <Card className="w-full p-10 text-center border-white/15 mb-6">
                {isMyTurn ? (
                  <>
                    <div className="text-[11px] uppercase tracking-widest text-white/30 mb-6">Объясни это слово</div>
                    <div className="text-5xl sm:text-6xl font-black text-white leading-tight break-words mb-4">
                      {currentWord}
                    </div>
                    <div className="text-[11px] text-white/20">
                      {st.difficulty === 'easy' ? 'Лёгкая' : st.difficulty === 'medium' ? 'Средняя' : 'Сложная'}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[11px] uppercase tracking-widest text-white/30 mb-6">Угадывайте!</div>
                    <div className="text-2xl font-black text-white/40 mb-4">
                      {commander?.name} объясняет слово...
                    </div>
                    <div className="text-sm text-white/20">Слушайте и называйте варианты</div>
                  </>
                )}
              </Card>
            </div>

            {st.roundWords.length > 0 && (
              <div className="mb-4 max-h-28 overflow-y-auto">
                <div className="text-[11px] text-white/30 mb-1.5 uppercase tracking-widest">Прошедшие слова</div>
                <div className="flex flex-wrap gap-1.5">
                  {st.roundWords.map((w, i) => (
                    <span
                      key={i}
                      className={`text-xs px-2.5 py-1 rounded-lg ${
                        w.guessed === false ? 'bg-red-500/15 text-red-400 line-through' : 'bg-white/8 text-white/60'
                      }`}
                    >
                      {w.word}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {isMyTurn ? (
              <div className="grid grid-cols-2 gap-3 pb-4">
                <button
                  onClick={() => sendToHost({ type: 'SKIP_WORD' })}
                  className="py-5 bg-white/8 hover:bg-red-500/20 border border-white/10 hover:border-red-500/40 rounded-2xl font-bold text-base transition-all active:scale-95 text-white/80"
                >
                  Пропустить
                </button>
                <button
                  onClick={() => sendToHost({ type: 'NEXT_WORD' })}
                  className="py-5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 rounded-2xl font-black text-base transition-all active:scale-95 text-white shadow-lg shadow-green-500/20"
                >
                  Следующее слово
                </button>
              </div>
            ) : (
              <div className="pb-4 text-center text-white/20 text-sm py-5">
                Управление только у командира
              </div>
            )}
          </div>
        </div>
      </PageLayout>
    );
  }

  // ═══════════════════════════════════════════
  //  REVIEW
  // ═══════════════════════════════════════════
  if (phase === 'review') {
    const guessedCount = st.roundWords.filter(w => w.guessed === true).length;

    return (
      <PageLayout>
        <div className="flex flex-col min-h-screen p-4">
          <div className="max-w-lg mx-auto w-full flex-1 flex flex-col py-6">

            <div className="text-center mb-6">
              <div className="inline-block bg-red-500/15 border border-red-500/30 rounded-2xl px-6 py-3 mb-4">
                <span className="text-red-400 font-black text-lg tracking-wide">ВРЕМЯ ВЫШЛО</span>
              </div>
              {currentTeam && (
                <div className="font-bold" style={{ color: currentTeam.accent }}>{currentTeam.name} — проверка</div>
              )}
            </div>

            <div className="text-center mb-6">
              <span className="text-4xl font-black text-yellow-400">+{guessedCount}</span>
              <span className="text-white/40 text-sm ml-2">очков</span>
            </div>

            <div className="flex-1 space-y-2 mb-6 overflow-y-auto">
              {st.roundWords.length === 0 && (
                <div className="text-center text-white/30 py-10">Ни одного слова в этом раунде</div>
              )}
              {st.roundWords.map((w, i) => (
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
                      onClick={() => sendToHost({ type: 'MARK_WORD', index: i, guessed: true })}
                      className={`w-10 h-10 rounded-xl font-bold text-sm transition-all active:scale-90 ${
                        w.guessed === true
                          ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                          : 'bg-white/8 hover:bg-green-500/30 text-white/50 hover:text-green-400'
                      }`}
                    >
                      V
                    </button>
                    <button
                      onClick={() => sendToHost({ type: 'MARK_WORD', index: i, guessed: false })}
                      className={`w-10 h-10 rounded-xl font-bold text-sm transition-all active:scale-90 ${
                        w.guessed === false
                          ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                          : 'bg-white/8 hover:bg-red-500/30 text-white/50 hover:text-red-400'
                      }`}
                    >
                      X
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => sendToHost({ type: 'FINISH_REVIEW' })}
              disabled={!allReviewed && st.roundWords.length > 0}
              className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 disabled:from-white/10 disabled:to-white/10 disabled:text-white/30 text-black font-black text-lg rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-orange-500/20 disabled:shadow-none"
            >
              {allReviewed || st.roundWords.length === 0 ? 'ДАЛЕЕ' : 'Отметьте все слова'}
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return null;
}
