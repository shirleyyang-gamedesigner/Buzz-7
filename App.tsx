
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, Player, AiCommentary } from './types';
import { isSevenCondition, generatePlayers, getCircularPosition } from './utils/gameLogic';
import { generateGameOverCommentary } from './services/geminiService';
import { Button } from './components/Button';
import { Volume2, VolumeX, RotateCcw, Crown, Heart, HeartCrack, Star, Info, LogOut } from 'lucide-react';

const TIMER_DURATION = 2000; // 2 seconds
const ERROR_RATE = 0.2; // 20% AI failure rate
const MAX_LIVES = 3;

const App: React.FC = () => {
  // Settings
  const [playerCount, setPlayerCount] = useState<number>(4);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Game State
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [currentNumber, setCurrentNumber] = useState<number>(0);
  const [players, setPlayers] = useState<Player[]>([]);
  const [activePlayerIndex, setActivePlayerIndex] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(TIMER_DURATION);
  const [shake, setShake] = useState<boolean>(false);
  const [gameOverReason, setGameOverReason] = useState<string>('');
  const [aiComment, setAiComment] = useState<AiCommentary | null>(null);

  // Intro Sequence State
  const [isRouletteActive, setIsRouletteActive] = useState<boolean>(false);
  const [rouletteHighlightIndex, setRouletteHighlightIndex] = useState<number>(0);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);

  // Refs
  const timerRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const timeoutRef = useRef<number | null>(null);

  // --- Sound Effects ---
  const playSound = useCallback((type: 'tick' | 'correct' | 'wrong' | 'pass' | 'eliminate' | 'drum' | 'go') => {
    if (!soundEnabled) return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    switch(type) {
      case 'correct':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now); // A4
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start();
        osc.stop(now + 0.2);
        break;
      case 'pass':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.linearRampToValueAtTime(659.25, now + 0.1); // E5
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start();
        osc.stop(now + 0.2);
        break;
      case 'wrong':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start();
        osc.stop(now + 0.3);
        break;
      case 'eliminate':
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start();
        osc.stop(now + 0.5);
        break;
      case 'drum':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start();
        osc.stop(now + 0.1);
        break;
      case 'go':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start();
        osc.stop(now + 0.5);
        break;
    }
  }, [soundEnabled]);

  // --- Logic ---

  const getNextPlayerIndex = (currentIndex: number, currentPlayers: Player[]): number => {
    let nextIndex = (currentIndex + 1) % currentPlayers.length;
    // Skip eliminated players
    let loops = 0;
    while (currentPlayers[nextIndex].isEliminated) {
      nextIndex = (nextIndex + 1) % currentPlayers.length;
      loops++;
      if (loops > currentPlayers.length) return -1; // Should not happen unless everyone dead
    }
    return nextIndex;
  };

  const handleElimination = useCallback(async (playerIndex: number, reason: string) => {
    playSound('eliminate');
    
    // If it's the human
    if (playerIndex === 0) {
      setShake(true);
      setGameOverReason(reason);
      setGameState(GameState.GAME_OVER);
      const comment = await generateGameOverCommentary(currentNumber, reason);
      setAiComment(comment);
      return;
    }

    // AI Eliminated
    setPlayers(prev => prev.map((p, i) => i === playerIndex ? { ...p, isEliminated: true } : p));
    
    // Check if Human won (only human left)
    const updatedPlayers = players.map((p, i) => i === playerIndex ? { ...p, isEliminated: true } : p);
    const active = updatedPlayers.filter(p => !p.isEliminated);
    
    if (active.length === 1 && active[0].id === 0) {
      setGameOverReason("大吉大利，今晚吃鸡！");
      setGameState(GameState.GAME_OVER);
      const comment = await generateGameOverCommentary(currentNumber, "Won the game");
      setAiComment(comment);
      return;
    }

    // Move to next turn immediately after elimination
    moveToNextTurn();

  }, [players, currentNumber, playSound]);

  const moveToNextTurn = () => {
    setPlayers(currentPlayers => currentPlayers);
    setActivePlayerIndex(prev => getNextPlayerIndex(prev, players));
    setTimeLeft(TIMER_DURATION);
  };

  const handleMistake = (playerIndex: number, specificReason: string) => {
    playSound('wrong');
    const player = players[playerIndex];
    const newLives = player.lives - 1;

    // Increment current number even on mistake (SKIP the number)
    setCurrentNumber(prev => prev + 1);

    // Update lives
    setPlayers(prev => prev.map((p, i) => i === playerIndex ? { ...p, lives: newLives } : p));

    if (newLives <= 0) {
      handleElimination(playerIndex, specificReason);
    } else {
      moveToNextTurn();
    }
  };

  const handleCorrectMove = (moveType: 'number' | 'pass') => {
    playSound(moveType === 'pass' ? 'pass' : 'correct');
    setCurrentNumber(prev => prev + 1);
    moveToNextTurn();
  };

  const checkMove = (action: 'number' | 'pass') => {
    if (gameState !== GameState.PLAYING) return;
    if (isRouletteActive || countdownValue !== null) return; // Block input during intro
    
    const nextNum = currentNumber + 1;
    const shouldPass = isSevenCondition(nextNum);

    // Record Action Bubble
    const actionText = action === 'pass' ? '过!' : nextNum.toString();
    setPlayers(prev => prev.map((p, i) => {
      if (i === activePlayerIndex) {
        return { 
          ...p, 
          lastAction: actionText, 
          lastActionTime: Date.now() 
        };
      }
      return p;
    }));

    if (action === 'pass') {
      if (shouldPass) handleCorrectMove('pass');
      else handleMistake(activePlayerIndex, `数字 ${nextNum} 不需要过 (安全)`);
    } else {
      if (!shouldPass) handleCorrectMove('number');
      else handleMistake(activePlayerIndex, `说了 ${nextNum} (含7或7的倍数)`);
    }
  };

  // --- AI Logic ---
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;
    if (isRouletteActive || countdownValue !== null) return; // Block AI during intro
    
    const activePlayer = players[activePlayerIndex];
    if (!activePlayer || activePlayer.isEliminated) return;

    // If it's human turn, do nothing (wait for input)
    if (!activePlayer.isAi) return;

    // AI Turn
    const delay = Math.max(500, 1500 - (currentNumber * 20)); // Slow down AI slightly for cuter feel
    
    timeoutRef.current = window.setTimeout(() => {
      const nextNum = currentNumber + 1;
      const shouldPass = isSevenCondition(nextNum);
      
      // Determine if AI makes a mistake
      const willMistake = Math.random() < ERROR_RATE;

      if (willMistake) {
        // Do the opposite of what is right
        if (shouldPass) checkMove('number'); // Oops, said 7
        else checkMove('pass'); // Oops, passed on 8
      } else {
        // Do right thing
        checkMove(shouldPass ? 'pass' : 'number');
      }

    }, delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [activePlayerIndex, gameState, players, currentNumber, isRouletteActive, countdownValue]);


  // --- Timer & BGM Oscillation ---
  
  // Background Music Manager
  useEffect(() => {
    if (!soundEnabled) return;
    
    // Simple procedural BGM using low volume oscillators
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
    gainNode.gain.value = 0.03; // Very quiet background

    let isRunning = true;

    const playNote = (freq: number, time: number, duration: number) => {
      if (!isRunning) return;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gainNode);
      osc.start(time);
      osc.stop(time + duration);
    };

    const scheduleMusic = () => {
      const now = ctx.currentTime;
      if (gameState === GameState.MENU) {
        // Playful slow arpeggio C Major
        const sequence = [261.63, 329.63, 392.00, 523.25]; // C E G C
        sequence.forEach((freq, i) => {
           playNote(freq, now + i * 0.5, 0.4);
        });
        setTimeout(scheduleMusic, 2000);
      } else if (gameState === GameState.PLAYING && !isRouletteActive && countdownValue === null) {
        // Tension: fast ticker
        playNote(440, now, 0.1);
        playNote(220, now + 0.25, 0.1);
        setTimeout(scheduleMusic, 500);
      } else {
        // Quiet or stopped
        setTimeout(scheduleMusic, 1000);
      }
    };

    scheduleMusic();

    return () => {
      isRunning = false;
      ctx.close();
    };
  }, [gameState, soundEnabled, isRouletteActive, countdownValue]);


  // Animation Loop for Timer
  useEffect(() => {
    if (gameState !== GameState.PLAYING || isRouletteActive || countdownValue !== null) {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
      return;
    }

    lastTimeRef.current = performance.now();

    const updateTimer = (time: number) => {
      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;

      setTimeLeft(prev => {
        const newTime = prev - delta;
        if (newTime <= 0) {
           return 0;
        }
        return newTime;
      });

      timerRef.current = requestAnimationFrame(updateTimer);
    };

    timerRef.current = requestAnimationFrame(updateTimer);

    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, [gameState, activePlayerIndex, isRouletteActive, countdownValue]);

  // Handle Timeout
  useEffect(() => {
    if (timeLeft <= 0 && gameState === GameState.PLAYING && !isRouletteActive && countdownValue === null) {
      // For timeout, we assume they missed saying the number
      const nextNum = currentNumber + 1;
      setPlayers(prev => prev.map((p, i) => {
        if (i === activePlayerIndex) {
          return { ...p, lastAction: '...', lastActionTime: Date.now() };
        }
        return p;
      }));
      handleMistake(activePlayerIndex, "超时！");
      setTimeLeft(TIMER_DURATION); // Reset immediately
    }
  }, [timeLeft, gameState, isRouletteActive, countdownValue]);


  // --- Intro Sequences ---

  const runRoulette = (playersList: Player[]) => {
    setIsRouletteActive(true);
    setRouletteHighlightIndex(0);
    
    // Pick a random winner
    const winnerIndex = Math.floor(Math.random() * playersList.length);
    
    // Animate
    let currentStep = 0;
    const totalSteps = (playersList.length * 2) + winnerIndex; // Spin 2 times then land
    const intervalTime = 80;

    const spin = () => {
      if (currentStep < totalSteps) {
        setRouletteHighlightIndex(prev => (prev + 1) % playersList.length);
        playSound('drum');
        currentStep++;
        setTimeout(spin, intervalTime + (currentStep * 5)); // Decelerate slightly
      } else {
        setIsRouletteActive(false);
        setActivePlayerIndex(winnerIndex);
        runCountdown();
      }
    };
    spin();
  };

  const runCountdown = () => {
    let count = 3;
    setCountdownValue(count);
    playSound('drum');

    const tick = () => {
      if (count > 1) {
        count--;
        setCountdownValue(count);
        playSound('drum');
        setTimeout(tick, 1000);
      } else {
        setCountdownValue(0); // 0 represents "GO!"
        playSound('go');
        setTimeout(() => {
          setCountdownValue(null);
          setTimeLeft(TIMER_DURATION);
        }, 1000);
      }
    };
    setTimeout(tick, 1000);
  };

  // --- Start Game ---
  const startGame = () => {
    const newPlayers = generatePlayers(playerCount);
    setPlayers(newPlayers);
    setCurrentNumber(0);
    setGameState(GameState.PLAYING);
    setAiComment(null);
    setTimeLeft(TIMER_DURATION);
    setShake(false);

    // Trigger Intro
    runRoulette(newPlayers);
  };

  // --- Rendering ---

  const renderAvatars = () => {
    const radius = window.innerWidth < 640 ? 120 : 200;

    return players.map((player, i) => {
      const { x, y } = getCircularPosition(i, players.length, radius);
      
      // Determine active highlight based on state
      const isActuallyPlaying = !isRouletteActive && countdownValue === null;
      // Active if:
      // 1. Actually playing AND is active player
      // 2. Roulette is spinning AND is highlight index
      // 3. Countdown is active AND is active player (who was selected by roulette)
      const isActive = isActuallyPlaying 
        ? i === activePlayerIndex 
        : (isRouletteActive && i === rouletteHighlightIndex) || (countdownValue !== null && i === activePlayerIndex);

      const isHuman = player.id === 0;
      // Human gets light yellow background, others get white
      const baseBg = isHuman 
          ? (isActive ? 'bg-[#FEF9C3]' : 'bg-[#FEF9C3]/90') // Yellow-100
          : (isActive ? 'bg-white' : 'bg-white/80');

      // Check if we should show speech bubble (last 1.5s)
      const showBubble = player.lastAction && player.lastActionTime && (Date.now() - player.lastActionTime < 1500);

      return (
        <div 
          key={player.id}
          className={`absolute transition-all duration-300 ease-spring
            ${player.isEliminated ? 'opacity-40 grayscale blur-[2px] scale-90' : 'opacity-100'}
            ${isActive ? 'z-30 scale-125' : 'z-10'}
          `}
          style={{
            left: `calc(50% + ${x}px)`,
            top: `calc(50% + ${y}px)`,
            transform: `translate(-50%, -50%) ${isActive ? 'scale(1.2)' : 'scale(1)'}`,
          }}
        >
          <div className="flex flex-col items-center relative">
            
            {/* Speech Bubble */}
            {showBubble && (
              <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 animate-in zoom-in slide-in-from-bottom-2 duration-300 z-50">
                 <div className="bg-white border-2 border-slate-100 px-4 py-2 rounded-2xl shadow-lg relative min-w-[60px] text-center">
                    <span className={`text-2xl font-black ${player.lastAction === '过!' ? 'text-[#FCD34D]' : 'text-slate-700'}`}>
                      {player.lastAction}
                    </span>
                    {/* Triangle pointer */}
                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white border-b-2 border-r-2 border-slate-100 rotate-45"></div>
                 </div>
              </div>
            )}

            {/* Avatar Bubble */}
            <div className={`
              relative w-16 h-16 md:w-20 md:h-20 rounded-[2rem] flex items-center justify-center text-4xl shadow-[0_8px_0_rgba(0,0,0,0.1)] transition-transform duration-300
              ${baseBg}
              ${isActive ? '-translate-y-4 shadow-[0_16px_0_rgba(0,0,0,0.1)] ring-8 ring-[#60A5FA]/30' : ''}
            `}>
              {player.isEliminated ? '👻' : player.avatar}
              
              {/* Active Indicator */}
              {isActive && !player.isEliminated && isActuallyPlaying && (
                <div className="absolute -top-6 text-2xl animate-bounce">
                  👇
                </div>
              )}
              {/* Countdown Active Indicator */}
              {isActive && countdownValue !== null && (
                 <div className="absolute -top-6 text-2xl animate-pulse">
                   🎯
                 </div>
              )}
            </div>

            {/* Lives */}
            {!player.isEliminated && (
              <div className="flex gap-1 mt-2 bg-white/50 px-2 py-1 rounded-full">
                {[...Array(MAX_LIVES)].map((_, idx) => (
                  <div key={idx} className="w-3 h-3 md:w-4 md:h-4">
                     {idx < (MAX_LIVES - player.lives) ? (
                       <HeartCrack className="w-full h-full text-slate-300" strokeWidth={3} />
                     ) : (
                       <Heart className="w-full h-full text-[#F87171] fill-[#F87171]" strokeWidth={0} />
                     )}
                  </div>
                ))}
              </div>
            )}
            
            {/* Name */}
            <span className={`text-xs md:text-sm font-black mt-1 px-2 py-0.5 rounded-xl ${isActive ? 'bg-[#60A5FA] text-white' : 'text-slate-500'}`}>
              {player.name}
            </span>
          </div>
        </div>
      );
    });
  };

  const renderMenu = () => (
    <div className="flex flex-col items-center justify-center w-full max-w-md animate-in zoom-in duration-500">
      
      {/* 3D Title */}
      <div className="relative mb-12 text-center group">
        <h1 className="text-6xl md:text-8xl font-black text-[#F472B6] tracking-tight drop-shadow-[0_4px_0_#DB2777]">
          逢七过
        </h1>
        <div className="absolute -top-6 -right-6 text-4xl animate-bounce delay-75">7️⃣</div>
        <div className="absolute -bottom-4 -left-6 text-4xl animate-bounce delay-150">💥</div>
        <p className="mt-4 text-xl font-bold text-slate-400">大逃杀萌宠版</p>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] w-full shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] space-y-8 border-2 border-white/50">
        {/* Player Count Slider */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <span className="font-bold text-slate-400">人数</span>
            <div className="bg-[#E0F2FE] text-[#0284C7] px-4 py-1 rounded-full font-black text-xl">
              {playerCount} 人
            </div>
          </div>
          
          <div className="relative h-12 flex items-center justify-center">
            <input 
              type="range" 
              min="2" 
              max="10" 
              value={playerCount} 
              onChange={(e) => setPlayerCount(parseInt(e.target.value))}
              className="w-full h-4 bg-slate-100 rounded-full appearance-none cursor-pointer accent-[#F472B6] hover:accent-[#EC4899] transition-all"
            />
          </div>
          
          <div className="flex justify-center gap-2 text-sm font-bold text-slate-400">
             <span>You 🧑‍🚀</span>
             <span>+</span>
             <span>{(playerCount - 1)} AI 🤖</span>
          </div>
        </div>

        {/* Game Rules */}
        <div className="bg-blue-50/50 p-5 rounded-[1.5rem] border border-blue-100 text-slate-600 text-sm space-y-2 text-left">
           <div className="flex items-center gap-2 text-[#60A5FA] mb-1">
              <Info className="w-5 h-5" />
              <h3 className="font-black text-lg">游戏说明</h3>
           </div>
           <ul className="space-y-1.5 font-bold pl-1">
             <li className="flex gap-2">
               <span className="text-[#F472B6]">1.</span> 
               <span>随机指定玩家开始，依次报数</span>
             </li>
             <li className="flex gap-2">
               <span className="text-[#F472B6]">2.</span> 
               <span>遇到 <span className="text-[#F472B6] bg-pink-100 px-1 rounded">7的倍数</span> 或 <span className="text-[#F472B6] bg-pink-100 px-1 rounded">含7</span> 必须点“过”</span>
             </li>
             <li className="flex gap-2">
               <span className="text-[#F472B6]">3.</span> 
               <span>若有人答错，下一人继续报下一个数字</span>
             </li>
             <li className="flex gap-2">
               <span className="text-[#F472B6]">4.</span> 
               <span>每人3次机会，活到最后即胜利！</span>
             </li>
           </ul>
        </div>

        <Button onClick={startGame} size="xl" variant="primary">
          开始游戏 🎮
        </Button>
      </div>
    </div>
  );

  const renderGame = () => {
    const isHumanTurn = activePlayerIndex === 0 && !players[0].isEliminated && !isRouletteActive && countdownValue === null;
    // The number that needs to be said/checked for the current turn
    const targetNumber = currentNumber + 1;

    // Determine visual state for center display
    let centerDisplay = targetNumber.toString();
    if (isRouletteActive) centerDisplay = "🎲";
    if (countdownValue !== null) centerDisplay = countdownValue === 0 ? "GO!" : countdownValue.toString();

    const isCountdown = countdownValue !== null;

    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center">
        
        {/* Arena */}
        <div className="relative w-full max-w-[400px] aspect-square md:max-w-[600px] flex items-center justify-center mb-32 md:mb-0">
          
          {/* Players */}
          {renderAvatars()}

          {/* Center Stage Timer */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-0 flex flex-col items-center pointer-events-none">
             {/* 
                Progress Ring 
                Logic: Complete ring reduces counter-clockwise from top.
                Hide during roulette/countdown.
             */}
            <div className="relative w-40 h-40 md:w-56 md:h-56">
               {/* Background Ring */}
               <svg className="w-full h-full transform -rotate-90 scale-x-[-1]">
                 <circle
                   cx="50%" cy="50%" r="42%"
                   className="stroke-slate-200 fill-white"
                   strokeWidth="20"
                   strokeLinecap="round"
                 />
                 {/* Foreground Ring - Only show when actually playing */}
                 {!isRouletteActive && countdownValue === null && (
                   <circle
                     cx="50%" cy="50%" r="42%"
                     className={`transition-colors duration-200 ${timeLeft < 500 ? 'stroke-[#F87171]' : 'stroke-[#FCD34D]'}`}
                     strokeWidth="20"
                     fill="none"
                     pathLength={100}
                     strokeDasharray="100"
                     strokeDashoffset={100 * (1 - (timeLeft / TIMER_DURATION))} 
                     strokeLinecap="round"
                   />
                 )}
              </svg>
              
              <div className="absolute inset-0 flex items-center justify-center flex-col animate-in zoom-in duration-300" key={centerDisplay}>
                 {/* Countdown Label */}
                 {isCountdown && countdownValue > 0 && (
                   <div className="absolute -top-8 text-xl md:text-2xl font-black text-slate-400 tracking-widest uppercase animate-bounce">
                     倒计时
                   </div>
                 )}

                 <span className={`font-black tracking-tighter drop-shadow-sm transition-all duration-200
                   ${isCountdown && countdownValue > 0 ? 'text-8xl md:text-[10rem] text-[#F59E0B]' : ''}
                   ${isCountdown && countdownValue === 0 ? 'text-7xl md:text-9xl text-[#34D399]' : ''}
                   ${!isCountdown && !isRouletteActive ? 'text-7xl md:text-9xl text-slate-700' : ''}
                   ${isRouletteActive ? 'text-7xl md:text-9xl text-slate-400' : ''}
                 `}>
                   {centerDisplay}
                 </span>
              </div>
            </div>
          </div>
        </div>

        {/* Controls - Moved up from bottom-8 to bottom-32 */}
        <div className={`fixed bottom-32 left-0 w-full px-6 flex justify-center gap-6 transition-all duration-300 transform ${isHumanTurn ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-20 opacity-0 scale-90 pointer-events-none'}`}>
          <Button 
            variant="game-action"
            onClick={() => checkMove('number')}
            className="flex-1 max-w-[160px] h-24 text-3xl font-black rounded-[2rem]"
          >
            {targetNumber}
          </Button>
          <Button 
            variant="secondary"
            onClick={() => checkMove('pass')}
            className="flex-1 max-w-[160px] h-24 text-3xl font-black rounded-[2rem]"
          >
            过 💥
          </Button>
        </div>

        {/* Exit Button */}
        <div className="absolute bottom-2 right-2 z-50">
           <button 
             onClick={() => handleElimination(0, '战术撤退')}
             className="flex items-center gap-2 bg-white/50 hover:bg-white text-slate-500 hover:text-red-500 px-4 py-3 rounded-2xl font-bold shadow-lg backdrop-blur-sm transition-all duration-200 group"
           >
             <LogOut className="w-5 h-5 transform group-hover:-translate-x-0.5 transition-transform" />
             <span className="text-sm">退出</span>
           </button>
        </div>
      </div>
    );
  };

  const renderGameOver = () => {
    const isWin = gameOverReason.includes("大吉大利");
    const eliminatedAiCount = players.filter(p => p.isAi && p.isEliminated).length;

    return (
      <div className="flex flex-col items-center justify-center space-y-6 animate-in zoom-in duration-300 w-full max-w-lg mx-auto">
        
        <div className="text-center relative">
          {isWin ? (
             <Crown className="w-24 h-24 text-[#FCD34D] mx-auto mb-4 animate-bounce drop-shadow-lg" fill="currentColor" />
          ) : (
             <HeartCrack className="w-24 h-24 text-[#F87171] mx-auto mb-4 drop-shadow-lg" fill="currentColor" />
          )}
          <h2 className={`text-5xl font-black ${isWin ? 'text-[#FCD34D]' : 'text-[#F87171]'} drop-shadow-sm`}>
            {isWin ? "冠军!" : "游戏结束"}
          </h2>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] w-full shadow-[0_20px_40px_-10px_rgba(0,0,0,0.05)] border-2 border-white/50 text-center space-y-6">
          <p className="text-xl font-bold text-slate-600">{gameOverReason}</p>
          
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-3xl">
             <div className="flex flex-col">
               <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">最高数字</span>
               <span className="text-3xl font-black text-slate-700">{currentNumber}</span>
             </div>
             <div className="flex flex-col">
               <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">淘汰对手</span>
               <span className="text-3xl font-black text-[#60A5FA]">{eliminatedAiCount}</span>
             </div>
          </div>
          
          {/* AI Commentary */}
          <div className="relative bg-[#FFFBEB] p-6 rounded-3xl border-2 border-[#FEF3C7]">
             <div className="absolute -top-3 left-6 bg-[#FCD34D] text-white px-2 py-0.5 rounded-md text-xs font-bold">AI 辣评</div>
             {!aiComment ? (
               <div className="text-slate-400 animate-pulse text-sm font-bold">思考中...</div>
             ) : (
               <div className="text-slate-600 font-bold text-lg leading-tight">“{aiComment.text}”</div>
             )}
          </div>
        </div>

        <div className="flex gap-4 w-full">
          <Button onClick={() => setGameState(GameState.MENU)} variant="game-action" className="flex-1 rounded-[2rem]">
            退出
          </Button>
          <Button onClick={startGame} variant="primary" className="flex-1 rounded-[2rem]">
            <RotateCcw className="w-5 h-5" /> 再来
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen flex flex-col relative overflow-hidden font-sans ${shake ? 'shake' : ''}`}>
      
      {/* Soft Background Blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-[#FEE2E2] rounded-full blur-[80px] opacity-60" /> {/* Red/Pink */}
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[#E0F2FE] rounded-full blur-[80px] opacity-60" /> {/* Blue */}
        <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] bg-[#FEF3C7] rounded-full blur-[80px] opacity-60" /> {/* Yellow */}
      </div>

      {/* Header */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-50">
         <div className="flex items-center gap-2 bg-white/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/60 shadow-sm">
           <Star className="w-4 h-4 text-[#FCD34D] fill-[#FCD34D]" />
           <span className="font-black text-slate-600 text-sm">Buzz 7</span>
         </div>
         <button 
           onClick={() => setSoundEnabled(!soundEnabled)} 
           className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md text-slate-400 hover:text-[#60A5FA] transition-colors"
         >
           {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
         </button>
      </div>

      {/* Main View */}
      <main className="flex-grow flex items-center justify-center p-4 relative z-10">
        {gameState === GameState.MENU && renderMenu()}
        {gameState === GameState.PLAYING && renderGame()}
        {gameState === GameState.GAME_OVER && renderGameOver()}
      </main>
    </div>
  );
};

export default App;
