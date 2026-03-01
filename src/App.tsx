import { useState, useEffect, useCallback, useRef } from 'react';
import { getWordsForDifficulty } from './data/words';

type Difficulty = 'easy' | 'medium' | 'hard';
type GamePhase = 'setup' | 'lobby' | 'playing' | 'review' | 'scoreboard' | 'gameover';

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
  emoji: string;
}

interface WordResult {
  word: string;
  guessed: boolean | null; // null = not reviewed yet
}

const TEAM_PRESETS: { color: string; name: string; emoji: string }[] = [
  { color: 'from-red-500 to-rose-600', name: 'Красные', emoji: '🔴' },
  { color: 'from-blue-500 to-indigo-600', name: 'Синие', emoji: '🔵' },
  { color: 'from-green-500 to-emerald-600', name: 'Зелёные', emoji: '🟢' },
  { color: 'from-yellow-500 to-amber-600', name: 'Жёлтые', emoji: '🟡' },
  { color: 'from-purple-500 to-violet-600', name: 'Фиолетовые', emoji: '🟣' },
  { color: 'from-orange-500 to-red-500', name: 'Оранжевые', emoji: '🟠' },
];

const TEAM_BG: string[] = [
  'bg-red-500/20 border-red-500',
  'bg-blue-500/20 border-blue-500',
  'bg-green-500/20 border-green-500',
  'bg-yellow-500/20 border-yellow-500',
  'bg-purple-500/20 border-purple-500',
  'bg-orange-500/20 border-orange-500',
];

const TEAM_TEXT: string[] = [
  'text-red-400',
  'text-blue-400',
  'text-green-400',
  'text-yellow-400',
  'text-purple-400',
  'text-orange-400',
];

const TEAM_BTN: string[] = [
  'bg-red-600 hover:bg-red-700',
  'bg-blue-600 hover:bg-blue-700',
  'bg-green-600 hover:bg-green-700',
  'bg-yellow-600 hover:bg-yellow-700',
  'bg-purple-600 hover:bg-purple-700',
  'bg-orange-600 hover:bg-orange-700',
];

export default function App() {
  // Setup state
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [timeLimit, setTimeLimit] = useState(60);
  const [winScore, setWinScore] = useState(30);
  
  // Game state
  const [phase, setPhase] = useState<GamePhase>('setup');
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([
    { id: 0, ...TEAM_PRESETS[0], score: 0 },
    { id: 1, ...TEAM_PRESETS[1], score: 0 },
  ]);
  const [newPlayerName, setNewPlayerName] = useState('');
  
  // Playing state
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [commanderIndex, setCommanderIndex] = useState<Record<number, number>>({});
  const [words, setWords] = useState<string[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [roundWords, setRoundWords] = useState<WordResult[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [skippedInRound, setSkippedInRound] = useState(0);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Play beep sound
  const playBeep = useCallback((frequency: number = 800, duration: number = 200) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
      oscillator.start();
      oscillator.stop(ctx.currentTime + duration / 1000);
    } catch {
      // Audio not supported
    }
  }, []);

  // Timer effect
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
          if (prev <= 6) {
            playBeep(600, 100);
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, timeLeft, playBeep]);

  const addTeam = () => {
    if (teams.length >= 6) return;
    const newId = teams.length;
    setTeams([...teams, { id: newId, ...TEAM_PRESETS[newId], score: 0 }]);
  };

  const removeTeam = (id: number) => {
    if (teams.length <= 2) return;
    setTeams(teams.filter(t => t.id !== id));
    setPlayers(players.map(p => p.teamId === id ? { ...p, teamId: null } : p));
  };

  const addPlayer = () => {
    if (!newPlayerName.trim()) return;
    const player: Player = {
      id: Date.now().toString(),
      name: newPlayerName.trim(),
      teamId: null,
    };
    setPlayers([...players, player]);
    setNewPlayerName('');
  };

  const removePlayer = (id: string) => {
    setPlayers(players.filter(p => p.id !== id));
  };

  const assignTeam = (playerId: string, teamId: number | null) => {
    setPlayers(players.map(p => p.id === playerId ? { ...p, teamId } : p));
  };

  const getTeamPlayers = (teamId: number) => players.filter(p => p.teamId === teamId);
  const getObservers = () => players.filter(p => p.teamId === null);

  const canStartGame = () => {
    // Every team with players must have at least 2
    const teamsWithPlayers = teams.filter(t => getTeamPlayers(t.id).length > 0);
    if (teamsWithPlayers.length < 2) return false;
    return teamsWithPlayers.every(t => getTeamPlayers(t.id).length >= 2);
  };

  const startGame = () => {
    // Reset scores
    setTeams(teams.map(t => ({ ...t, score: 0 })));
    // Filter out teams with no players
    const activeTeams = teams.filter(t => getTeamPlayers(t.id).length >= 2);
    setTeams(activeTeams);
    // Move players from small teams to observers
    const smallTeamPlayers = teams
      .filter(t => getTeamPlayers(t.id).length < 2 && getTeamPlayers(t.id).length > 0)
      .flatMap(t => getTeamPlayers(t.id));
    if (smallTeamPlayers.length > 0) {
      setPlayers(players.map(p =>
        smallTeamPlayers.find(sp => sp.id === p.id) ? { ...p, teamId: null } : p
      ));
    }
    // Initialize commander index for each team
    const cmdIdx: Record<number, number> = {};
    activeTeams.forEach(t => { cmdIdx[t.id] = 0; });
    setCommanderIndex(cmdIdx);
    
    // Generate words
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
    
    // Ensure we have enough words
    if (currentWordIndex >= words.length - 50) {
      const newWords = getWordsForDifficulty(difficulty);
      setWords(prev => [...prev, ...newWords]);
    }
  };

  const nextWord = () => {
    const currentWord = words[currentWordIndex];
    setRoundWords(prev => [...prev, { word: currentWord, guessed: null }]);
    setCurrentWordIndex(prev => prev + 1);
  };

  const skipWord = () => {
    setSkippedInRound(prev => prev + 1);
    const currentWord = words[currentWordIndex];
    setRoundWords(prev => [...prev, { word: currentWord, guessed: false }]);
    setCurrentWordIndex(prev => prev + 1);
  };

  const markWord = (index: number, guessed: boolean) => {
    setRoundWords(prev => prev.map((w, i) => i === index ? { ...w, guessed } : w));
  };

  const finishReview = () => {
    const guessedCount = roundWords.filter(w => w.guessed === true).length;
    const activeTeams = teams.filter(t => getTeamPlayers(t.id).length >= 2);
    const currentTeam = activeTeams[currentTeamIndex];
    
    // Update score
    setTeams(prev => prev.map(t =>
      t.id === currentTeam.id ? { ...t, score: t.score + guessedCount } : t
    ));
    
    // Check for winner
    const updatedScore = currentTeam.score + guessedCount;
    if (updatedScore >= winScore) {
      setTeams(prev => prev.map(t =>
        t.id === currentTeam.id ? { ...t, score: updatedScore } : t
      ));
      setPhase('gameover');
      return;
    }
    
    // Advance commander
    const teamPlayers = getTeamPlayers(currentTeam.id);
    setCommanderIndex(prev => ({
      ...prev,
      [currentTeam.id]: ((prev[currentTeam.id] || 0) + 1) % teamPlayers.length
    }));
    
    // Next team
    const nextTeamIdx = (currentTeamIndex + 1) % activeTeams.length;
    setCurrentTeamIndex(nextTeamIdx);
    setPhase('scoreboard');
  };

  const getCurrentCommander = () => {
    const activeTeams = teams.filter(t => getTeamPlayers(t.id).length >= 2);
    if (activeTeams.length === 0) return null;
    const currentTeam = activeTeams[currentTeamIndex];
    if (!currentTeam) return null;
    const teamPlayers = getTeamPlayers(currentTeam.id);
    if (teamPlayers.length === 0) return null;
    const cmdIdx = commanderIndex[currentTeam.id] || 0;
    return teamPlayers[cmdIdx % teamPlayers.length];
  };

  const getCurrentTeam = () => {
    const activeTeams = teams.filter(t => getTeamPlayers(t.id).length >= 2);
    return activeTeams[currentTeamIndex] || null;
  };

  const resetGame = () => {
    setPhase('setup');
    setPlayers([]);
    setTeams([
      { id: 0, ...TEAM_PRESETS[0], score: 0 },
      { id: 1, ...TEAM_PRESETS[1], score: 0 },
    ]);
    setCurrentTeamIndex(0);
    setWords([]);
    setRoundWords([]);
    setIsTimerRunning(false);
  };

  const allReviewed = roundWords.every(w => w.guessed !== null);

  // ============= RENDER =============

  // SETUP SCREEN
  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-lg w-full">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-3">🎭</div>
            <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">
              УГАДАЙКА
            </h1>
            <p className="text-gray-400 mt-2 text-sm">Объясни слово — не называя его!</p>
          </div>

          {/* Difficulty */}
          <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 mb-4 border border-gray-700">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span>🎯</span> Сложность
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'easy' as Difficulty, label: 'Лёгкая', emoji: '😊', desc: 'Простые слова' },
                { key: 'medium' as Difficulty, label: 'Средняя', emoji: '🤔', desc: 'Посложнее' },
                { key: 'hard' as Difficulty, label: 'Сложная', emoji: '🤯', desc: 'Для гигачадов' },
              ]).map(d => (
                <button
                  key={d.key}
                  onClick={() => setDifficulty(d.key)}
                  className={`p-3 rounded-xl border-2 transition-all duration-200 ${
                    difficulty === d.key
                      ? 'border-yellow-400 bg-yellow-400/10 scale-105 shadow-lg shadow-yellow-400/20'
                      : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                  }`}
                >
                  <div className="text-2xl mb-1">{d.emoji}</div>
                  <div className="font-bold text-sm">{d.label}</div>
                  <div className="text-[10px] text-gray-400 mt-1">{d.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Timer */}
          <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 mb-4 border border-gray-700">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span>⏱️</span> Время на раунд
            </h2>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={20}
                max={180}
                step={5}
                value={timeLimit}
                onChange={e => setTimeLimit(Number(e.target.value))}
                className="flex-1 h-2 rounded-lg appearance-none cursor-pointer accent-yellow-400 bg-gray-600"
              />
              <div className="bg-gray-700 rounded-xl px-4 py-2 min-w-[70px] text-center font-mono font-bold text-yellow-400 text-lg">
                {timeLimit}с
              </div>
            </div>
          </div>

          {/* Win score */}
          <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 mb-6 border border-gray-700">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span>🏆</span> Очки для победы
            </h2>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={winScore}
                onChange={e => setWinScore(Number(e.target.value))}
                className="flex-1 h-2 rounded-lg appearance-none cursor-pointer accent-yellow-400 bg-gray-600"
              />
              <div className="bg-gray-700 rounded-xl px-4 py-2 min-w-[70px] text-center font-mono font-bold text-yellow-400 text-lg">
                {winScore}
              </div>
            </div>
          </div>

          <button
            onClick={() => setPhase('lobby')}
            className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-black text-lg rounded-2xl transition-all duration-200 transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-orange-500/30"
          >
            СОЗДАТЬ ЛОББИ 🚀
          </button>
        </div>
      </div>
    );
  }

  // LOBBY SCREEN
  if (phase === 'lobby') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-black bg-gradient-to-r from-yellow-400 to-pink-500 bg-clip-text text-transparent">
              🎭 ЛОББИ
            </h1>
            <div className="flex justify-center gap-3 mt-2 text-xs text-gray-400">
              <span>⏱️ {timeLimit}с</span>
              <span>•</span>
              <span>🎯 {difficulty === 'easy' ? 'Лёгкая' : difficulty === 'medium' ? 'Средняя' : 'Сложная'}</span>
              <span>•</span>
              <span>🏆 {winScore} очков</span>
            </div>
          </div>

          {/* Add player */}
          <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-4 mb-4 border border-gray-700">
            <h2 className="font-bold mb-3 flex items-center gap-2">
              <span>👤</span> Добавить игрока
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPlayerName}
                onChange={e => setNewPlayerName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPlayer()}
                placeholder="Введи имя..."
                className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition"
                maxLength={20}
              />
              <button
                onClick={addPlayer}
                disabled={!newPlayerName.trim()}
                className="px-6 py-3 bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-600 disabled:text-gray-400 text-black font-bold rounded-xl transition-all active:scale-95"
              >
                +
              </button>
            </div>
          </div>

          {/* Observers */}
          {getObservers().length > 0 && (
            <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-4 mb-4 border border-gray-700">
              <h2 className="font-bold mb-3 flex items-center gap-2">
                <span>👀</span> Наблюдатели
                <span className="text-xs text-gray-400 font-normal ml-1">({getObservers().length})</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                {getObservers().map(p => (
                  <div key={p.id} className="bg-gray-700 rounded-xl px-3 py-2 flex items-center gap-2 group">
                    <span className="text-sm">{p.name}</span>
                    <button
                      onClick={() => removePlayer(p.id)}
                      className="text-gray-500 hover:text-red-400 transition opacity-60 group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Teams */}
          <div className="space-y-3 mb-4">
            {teams.map((team, idx) => {
              const teamPlayers = getTeamPlayers(team.id);
              const tooFew = teamPlayers.length > 0 && teamPlayers.length < 2;
              return (
                <div
                  key={team.id}
                  className={`rounded-2xl p-4 border-2 transition-all ${TEAM_BG[idx] || 'bg-gray-700/50 border-gray-600'}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={`font-bold flex items-center gap-2 ${TEAM_TEXT[idx]}`}>
                      <span>{team.emoji}</span>
                      {team.name}
                      <span className="text-xs text-gray-400 font-normal">({teamPlayers.length})</span>
                    </h3>
                    {teams.length > 2 && (
                      <button
                        onClick={() => removeTeam(team.id)}
                        className="text-gray-500 hover:text-red-400 text-sm transition"
                      >
                        Убрать
                      </button>
                    )}
                  </div>
                  
                  {tooFew && (
                    <div className="text-xs text-red-400 mb-2 flex items-center gap-1">
                      ⚠️ Нужно минимум 2 игрока в команде!
                    </div>
                  )}

                  {/* Team players */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {teamPlayers.map(p => (
                      <div key={p.id} className="bg-black/30 rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm">
                        <span>{p.name}</span>
                        <button
                          onClick={() => assignTeam(p.id, null)}
                          className="text-gray-500 hover:text-white transition text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add players to team */}
                  {getObservers().length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {getObservers().map(p => (
                        <button
                          key={p.id}
                          onClick={() => assignTeam(p.id, team.id)}
                          className={`text-xs px-3 py-1.5 rounded-lg transition-all active:scale-95 text-white ${TEAM_BTN[idx] || 'bg-gray-600 hover:bg-gray-500'}`}
                        >
                          + {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add team button */}
          {teams.length < 6 && (
            <button
              onClick={addTeam}
              className="w-full py-3 border-2 border-dashed border-gray-600 rounded-2xl text-gray-400 hover:border-gray-500 hover:text-gray-300 transition-all mb-6 flex items-center justify-center gap-2"
            >
              <span className="text-xl">+</span> Добавить команду
            </button>
          )}

          {/* Start button */}
          <div className="flex gap-3">
            <button
              onClick={() => setPhase('setup')}
              className="px-6 py-4 bg-gray-700 hover:bg-gray-600 rounded-2xl font-bold transition-all"
            >
              ← Назад
            </button>
            <button
              onClick={startGame}
              disabled={!canStartGame()}
              className="flex-1 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 disabled:from-gray-600 disabled:to-gray-600 disabled:text-gray-400 text-black font-black text-lg rounded-2xl transition-all transform hover:scale-[1.01] active:scale-95 shadow-lg shadow-green-500/30 disabled:shadow-none"
            >
              {canStartGame() ? 'НАЧАТЬ ИГРУ 🎮' : 'Нужно минимум 2 команды по 2 игрока'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // SCOREBOARD (between rounds)
  if (phase === 'scoreboard') {
    const currentTeam = getCurrentTeam();
    const commander = getCurrentCommander();
    const activeTeams = teams.filter(t => getTeamPlayers(t.id).length >= 2);

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 flex flex-col">
        <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">
          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-black bg-gradient-to-r from-yellow-400 to-pink-500 bg-clip-text text-transparent">
              📊 ТАБЛО
            </h1>
          </div>

          {/* Scores */}
          <div className="space-y-3 mb-6 flex-1">
            {activeTeams.map((team, idx) => {
              const origIdx = TEAM_PRESETS.findIndex(p => p.name === team.name);
              const colorIdx = origIdx >= 0 ? origIdx : idx;
              const isCurrentTeam = currentTeam?.id === team.id;
              const progressPercent = Math.min((team.score / winScore) * 100, 100);
              return (
                <div
                  key={team.id}
                  className={`rounded-2xl p-4 border-2 transition-all ${
                    isCurrentTeam ? `${TEAM_BG[colorIdx]} scale-[1.02] shadow-lg` : 'bg-gray-800/30 border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{team.emoji}</span>
                      <span className="font-bold">{team.name}</span>
                      {isCurrentTeam && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full animate-pulse">
                          Ходит!
                        </span>
                      )}
                    </div>
                    <div className={`text-2xl font-black ${TEAM_TEXT[colorIdx]}`}>
                      {team.score}
                    </div>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${team.color} transition-all duration-500 rounded-full`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1 text-right">{team.score}/{winScore}</div>
                </div>
              );
            })}
          </div>

          {/* Current turn info */}
          {currentTeam && commander && (
            <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 mb-6 border border-gray-700 text-center">
              <div className="text-sm text-gray-400 mb-2">Сейчас ходят</div>
              <div className="text-2xl font-bold mb-3">
                {currentTeam.emoji} {currentTeam.name}
              </div>
              <div className="text-sm text-gray-400 mb-1">Командир</div>
              <div className="text-xl font-bold text-yellow-400 flex items-center justify-center gap-2">
                👑 {commander.name}
              </div>
              <div className="text-xs text-gray-500 mt-3">
                Командир объясняет слова, остальная команда угадывает!
              </div>
            </div>
          )}

          <button
            onClick={startRound}
            className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-black text-lg rounded-2xl transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-orange-500/30"
          >
            НАЧАТЬ РАУНД ▶️
          </button>
        </div>
      </div>
    );
  }

  // PLAYING
  if (phase === 'playing') {
    const currentTeam = getCurrentTeam();
    const commander = getCurrentCommander();
    const currentWord = words[currentWordIndex] || 'Слова закончились!';
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 flex flex-col">
        <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">
          {/* Timer bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm">
                {currentTeam && (
                  <>
                    <span>{currentTeam.emoji}</span>
                    <span className="font-bold">{currentTeam.name}</span>
                  </>
                )}
                <span className="text-gray-500">•</span>
                <span className="text-yellow-400">👑 {commander?.name}</span>
              </div>
              <div className={`font-mono font-black text-2xl ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-yellow-400'}`}>
                {minutes}:{seconds.toString().padStart(2, '0')}
              </div>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 rounded-full ${
                  timeLeft <= 10 ? 'bg-red-500' : timeLeft <= 20 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${(timeLeft / timeLimit) * 100}%` }}
              />
            </div>
          </div>

          {/* Word count */}
          <div className="text-center text-xs text-gray-500 mb-2">
            Слово #{roundWords.length + 1} • Пропущено: {skippedInRound}
          </div>

          {/* CURRENT WORD - big and centered */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="bg-gray-800/80 backdrop-blur rounded-3xl p-8 border border-gray-600 shadow-2xl w-full text-center mb-6">
              <div className="text-xs text-gray-400 mb-4 uppercase tracking-widest">Объясни это слово</div>
              <div className="text-4xl sm:text-5xl font-black text-white mb-2 break-words">
                {currentWord}
              </div>
              <div className="text-xs text-gray-500 mt-4">
                {difficulty === 'easy' ? '😊 Лёгкая' : difficulty === 'medium' ? '🤔 Средняя' : '🤯 Сложная'}
              </div>
            </div>
          </div>

          {/* Past words in this round */}
          {roundWords.length > 0 && (
            <div className="mb-4 max-h-32 overflow-y-auto">
              <div className="text-xs text-gray-500 mb-1">Прошедшие слова:</div>
              <div className="flex flex-wrap gap-1">
                {roundWords.map((w, i) => (
                  <span key={i} className={`text-xs px-2 py-1 rounded-lg ${
                    w.guessed === false ? 'bg-red-500/20 text-red-400 line-through' : 'bg-gray-700 text-gray-300'
                  }`}>
                    {w.word}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={skipWord}
              className="py-4 bg-red-600/80 hover:bg-red-600 rounded-2xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              ⏭️ Пропустить
            </button>
            <button
              onClick={nextWord}
              className="py-4 bg-green-600/80 hover:bg-green-600 rounded-2xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              ✅ Угадали!
            </button>
          </div>
        </div>
      </div>
    );
  }

  // REVIEW
  if (phase === 'review') {
    const currentTeam = getCurrentTeam();
    const guessedCount = roundWords.filter(w => w.guessed === true).length;

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 flex flex-col">
        <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">⏰</div>
            <h1 className="text-2xl font-black text-red-400">ВРЕМЯ ВЫШЛО!</h1>
            {currentTeam && (
              <p className="text-gray-400 mt-1">
                {currentTeam.emoji} {currentTeam.name} — проверка слов
              </p>
            )}
          </div>

          <div className="text-center mb-4">
            <span className="text-3xl font-black text-yellow-400">+{guessedCount}</span>
            <span className="text-gray-400 text-sm ml-2">очков</span>
          </div>

          {/* Words to review */}
          <div className="flex-1 space-y-2 mb-6 overflow-y-auto">
            {roundWords.length === 0 && (
              <div className="text-center text-gray-500 py-8">Слов не было в этом раунде</div>
            )}
            {roundWords.map((w, i) => (
              <div
                key={i}
                className={`rounded-xl p-3 border-2 flex items-center justify-between transition-all ${
                  w.guessed === true
                    ? 'bg-green-500/10 border-green-500'
                    : w.guessed === false
                    ? 'bg-red-500/10 border-red-500'
                    : 'bg-gray-800/50 border-gray-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {w.guessed === true ? '✅' : w.guessed === false ? '❌' : '❓'}
                  </span>
                  <span className={`font-bold ${w.guessed === false ? 'line-through text-gray-500' : ''}`}>
                    {w.word}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => markWord(i, true)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                      w.guessed === true
                        ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                        : 'bg-gray-700 hover:bg-green-500/50 text-gray-400 hover:text-white'
                    }`}
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => markWord(i, false)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                      w.guessed === false
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                        : 'bg-gray-700 hover:bg-red-500/50 text-gray-400 hover:text-white'
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
            className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 disabled:from-gray-600 disabled:to-gray-600 disabled:text-gray-400 text-black font-black text-lg rounded-2xl transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-orange-500/30 disabled:shadow-none"
          >
            {allReviewed || roundWords.length === 0 ? 'ДАЛЕЕ →' : 'Отметьте все слова ✓ или ✕'}
          </button>
        </div>
      </div>
    );
  }

  // GAME OVER
  if (phase === 'gameover') {
    const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
    const winner = sortedTeams[0];

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 flex flex-col items-center justify-center">
        <div className="max-w-lg w-full text-center">
          <div className="text-6xl mb-4">🏆</div>
          <h1 className="text-3xl font-black mb-2">ПОБЕДА!</h1>
          {winner && (
            <>
              <div className="text-4xl font-black bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent mb-2">
                {winner.emoji} {winner.name}
              </div>
              <div className="text-5xl font-black text-yellow-400 mb-8">
                {winner.score} очков
              </div>
            </>
          )}

          <div className="space-y-3 mb-8">
            {sortedTeams.map((team, i) => (
              <div key={team.id} className="bg-gray-800/50 rounded-xl p-4 flex items-center justify-between border border-gray-700">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-gray-500">#{i + 1}</span>
                  <span className="text-xl">{team.emoji}</span>
                  <span className="font-bold">{team.name}</span>
                </div>
                <span className="text-xl font-black">{team.score}</span>
              </div>
            ))}
          </div>

          <button
            onClick={resetGame}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-black text-lg rounded-2xl transition-all active:scale-95"
          >
            НОВАЯ ИГРА 🔄
          </button>
        </div>
      </div>
    );
  }

  return null;
}
