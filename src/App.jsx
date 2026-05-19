import { useState, useEffect, useCallback, useRef } from "react";
import { gsap } from "gsap";

const SUCCULENTS = {
  1: "/pot1.png",
  2: "/pot2.png",
  3: "/pot3.png",
};

const TILE_COLORS = {
  0: { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.15)" },
  1: { bg: "transparent", border: "rgba(255,255,255,0.15)" },
  2: { bg: "transparent", border: "rgba(255,255,255,0.15)" },
  3: { bg: "transparent", border: "rgba(255,255,255,0.15)" },
};

const LEVELS = [
  { maxMoves: 20, pattern: [[0,1,0,1,0],[1,2,0,2,1],[0,0,3,0,0],[1,2,0,2,1],[0,1,0,1,0]] },
  { maxMoves: 20, pattern: [[0,0,2,0,0],[0,2,0,2,0],[2,0,0,0,2],[0,2,0,2,0],[0,0,2,0,0]] },
  { maxMoves: 22, pattern: [[0,0,1,0,0],[0,1,2,1,0],[1,2,0,2,1],[0,1,2,1,0],[0,0,1,0,0]] },
  { maxMoves: 22, pattern: [[0,1,0,1,0],[1,0,2,0,1],[0,2,0,2,0],[1,0,2,0,1],[0,1,0,1,0]] },
  { maxMoves: 22, pattern: [[0,0,3,0,0],[0,3,1,3,0],[3,1,0,1,3],[0,3,1,3,0],[0,0,3,0,0]] },
  { maxMoves: 24, pattern: [[1,0,0,0,1],[0,2,0,2,0],[0,0,3,0,0],[0,2,0,2,0],[1,0,0,0,1]] },
  { maxMoves: 24, pattern: [[0,1,2,1,0],[1,0,3,0,1],[2,3,0,3,2],[1,0,3,0,1],[0,1,2,1,0]] },
  { maxMoves: 25, pattern: [[2,0,1,0,2],[0,2,0,2,0],[1,0,3,0,1],[0,2,0,2,0],[2,0,1,0,2]] },
  { maxMoves: 25, pattern: [[1,2,0,2,1],[2,0,2,0,2],[0,2,3,2,0],[2,0,2,0,2],[1,2,0,2,1]] },
  { maxMoves: 28, pattern: [[0,1,2,1,0],[1,2,3,2,1],[2,3,0,3,2],[1,2,3,2,1],[0,1,2,1,0]] },
];

const MAX_SHOWS = 3;
const FLOWERS = ["🌸","🌺","🌼","💐","🌻","🌷"];

// ── Audio Engine ──────────────────────────────────────────
const audioCtx = { current: null };
function getCtx() {
  if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx.current;
}
function playTone(freq, type = "sine", duration = 0.12, vol = 0.18, delay = 0) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.05);
  } catch(e) {}
}
const sounds = {
  select: () => playTone(520, "sine", 0.08, 0.15),
  move:   () => { playTone(300, "sine", 0.06, 0.1); playTone(420, "sine", 0.08, 0.1, 0.05); },
  undo:   () => playTone(280, "triangle", 0.1, 0.12),
  show:   () => { playTone(660, "sine", 0.1, 0.12); playTone(880, "sine", 0.1, 0.1, 0.1); },
  lose:   () => { playTone(280, "sawtooth", 0.18, 0.15); playTone(220, "sawtooth", 0.18, 0.15, 0.18); playTone(180, "sawtooth", 0.2, 0.15, 0.36); },
  win:    () => {
    [[523,0],[659,0.12],[784,0.24],[1046,0.4]].forEach(([f,d]) => playTone(f,"sine",0.3,0.18,d));
  },
};
// ─────────────────────────────────────────────────────────

function shuffle(pattern) {
  const colored = [];
  pattern.forEach(row => row.forEach(cell => { if (cell !== 0) colored.push(cell); }));
  const grid = Array.from({ length: 5 }, () => Array(5).fill(0));
  const positions = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) positions.push([r, c]);
  const shuffled = [...positions].sort(() => Math.random() - 0.5).slice(0, colored.length);
  const colorShuffled = [...colored].sort(() => Math.random() - 0.5);
  shuffled.forEach(([r, c], i) => { grid[r][c] = colorShuffled[i]; });
  return grid;
}

function gridMatches(a, b) {
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++)
      if (a[r][c] !== b[r][c]) return false;
  return true;
}

const PHASES = { SHOW: "show", SOLVE: "solve", WIN: "win", LOSE: "lose" };

function Tile({ type, isSelected, isLastMoved, onClick, tileRef }) {
  const t = TILE_COLORS[type];
  const prevMoved = useRef(false);

  useEffect(() => {
    if (isLastMoved && !prevMoved.current && tileRef?.current) {
      gsap.fromTo(tileRef.current,
        { scale: 1.4, rotation: -8, filter: "brightness(1.5)" },
        { scale: 1, rotation: 0, filter: "brightness(1)", duration: 0.4, ease: "elastic.out(1.2, 0.5)" }
      );
    }
    prevMoved.current = isLastMoved;
  }, [isLastMoved]);

  return (
    <div
      ref={tileRef}
      onClick={onClick}
      style={{
        width: "100%",
        aspectRatio: "1",
        borderRadius: "10px",
        background: type === 0 ? "rgba(255,255,255,0.05)" : "transparent",
        border: `1px solid ${isSelected ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.15)"}` ,
        boxShadow: isSelected ? "0 0 0 3px #fff, 0 0 20px rgba(255,255,255,0.3)" : "none",
        cursor: type !== 0 ? "pointer" : "default",
        transform: isSelected ? "scale(1.14)" : "scale(1)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        display: "flex", alignItems: "center", justifyContent: "center",
        willChange: "transform",
      }}
    >
      {type !== 0 && (
        <img src={SUCCULENTS[type]} alt="" style={{
          width: "130%", height: "130%", objectFit: "contain", pointerEvents: "none",
          filter: isSelected ? "brightness(1.2) drop-shadow(0 0 4px rgba(255,255,255,0.5))" : "none",
          transition: "filter 0.15s ease",
        }}/>
      )}
    </div>
  );
}

function FlowerParticle({ x, y, emoji, delay }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current,
      { x, y: y + 60, opacity: 0, scale: 0.3, rotation: Math.random() * 60 - 30 },
      {
        y: y - 120 - Math.random() * 80,
        x: x + (Math.random() - 0.5) * 80,
        opacity: 1, scale: 1 + Math.random() * 0.5,
        rotation: Math.random() * 360,
        duration: 1.2 + Math.random() * 0.6, delay,
        ease: "power2.out",
        onComplete: () => gsap.to(ref.current, { opacity: 0, y: "-=30", duration: 0.4 }),
      }
    );
  }, []);
  return (
    <div ref={ref} style={{ position:"fixed", left:x, top:y, fontSize: 24+Math.random()*16, pointerEvents:"none", zIndex:15 }}>
      {emoji}
    </div>
  );
}

function WinCanvas({ visible, positions }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!visible || positions.length < 2) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      gsap.set(canvas, { opacity: 1 });
      return;
    }
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const lines = [];
    for (let i = 0; i < positions.length - 1; i++) {
      lines.push({ x1: positions[i].x, y1: positions[i].y, x2: positions[i+1].x, y2: positions[i+1].y, color: i % 2 === 0 ? "#ff3fa4" : "#00f5d4" });
    }
    const proxy = { p: 0 };
    const tween = gsap.to(proxy, {
      p: 1, duration: 1.2, ease: "power2.inOut",
      onUpdate: () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const drawn = proxy.p * lines.length;
        lines.forEach((line, i) => {
          if (i >= drawn) return;
          const lp = Math.min(1, drawn - i);
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(line.x1, line.y1);
          ctx.lineTo(line.x1 + (line.x2 - line.x1) * lp, line.y1 + (line.y2 - line.y1) * lp);
          ctx.strokeStyle = line.color;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = line.color;
          ctx.shadowBlur = 18;
          ctx.globalAlpha = 0.88;
          ctx.stroke();
          ctx.restore();
        });
      },
      onComplete: () => gsap.to(canvas, { opacity: 0, duration: 0.7, delay: 0.9 }),
    });
    return () => tween.kill();
  }, [visible, positions]);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 11, width: "100vw", height: "100vh" }} />;
}

function FallingParticle({ x, delay, emoji }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current,
      { x, y: -50, opacity: 1, rotation: 0 },
      { y: window.innerHeight + 60, rotation: (Math.random() > 0.5 ? 1 : -1) * 400, duration: 2.5 + Math.random() * 1.5, delay, ease: "power1.in",
        onComplete: () => { if (ref.current) ref.current.style.display = "none"; } }
    );
  }, []);
  return <div ref={ref} style={{ position: "fixed", left: 0, top: 0, fontSize: 18 + Math.random() * 14, pointerEvents: "none", zIndex: 16 }}>{emoji}</div>;
}

function Butterfly({ side, delay }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const startX = side === "left" ? -80 : window.innerWidth + 80;
    const endX = side === "left" ? window.innerWidth * 0.2 + Math.random() * 140 : window.innerWidth * 0.65 - Math.random() * 140;
    const startY = window.innerHeight * 0.2 + Math.random() * window.innerHeight * 0.4;
    gsap.fromTo(ref.current,
      { x: startX, y: startY, opacity: 0, scale: 0.5 },
      { x: endX, opacity: 1, scale: 1, duration: 1.4 + Math.random() * 0.4, delay, ease: "power2.out",
        onComplete: () => {
          gsap.to(ref.current, { y: startY - 28, duration: 0.85, yoyo: true, repeat: 4, ease: "sine.inOut" });
          gsap.to(ref.current, { opacity: 0, duration: 0.5, delay: 3.2 });
        } }
    );
  }, []);
  return <div ref={ref} style={{ position: "fixed", left: 0, top: 0, fontSize: 30, pointerEvents: "none", zIndex: 15 }}>🦋</div>;
}

export default function SucculentZen() {
  const [levelIndex, setLevelIndex] = useState(0);
  const [phase, setPhase] = useState(PHASES.SHOW);
  const [grid, setGrid] = useState(null);
  const [selected, setSelected] = useState(null);
  const [movesLeft, setMovesLeft] = useState(20);
  const [showTimer, setShowTimer] = useState(5);
  const [stars, setStars] = useState(0);
  const [lastMoved, setLastMoved] = useState(null);
  const [history, setHistory] = useState([]);
  const [showsLeft, setShowsLeft] = useState(MAX_SHOWS);
  const [isShowingPattern, setIsShowingPattern] = useState(false);
  const [showAdModal, setShowAdModal] = useState(false);
  const [particles, setParticles] = useState([]);
  const [winVisible, setWinVisible] = useState(false);
  const savedGrid = useRef(null);
  const gridRef = useRef(null);
  const tileRefs = useRef({});
  const winPanelRef = useRef(null);
  const [canvasVisible, setCanvasVisible] = useState(false);
  const [canvasPositions, setCanvasPositions] = useState([]);
  const [fallingParticles, setFallingParticles] = useState([]);
  const [butterflies, setButterflies] = useState([]);
  const levelCompleteRef = useRef(null);
  const unlockedRef = useRef(null);
  const winTimerRef = useRef(null);

  const level = LEVELS[Math.min(levelIndex, LEVELS.length - 1)];

  const startLevel = useCallback((idx) => {
    const lvl = LEVELS[Math.min(idx, LEVELS.length - 1)];
    setGrid(lvl.pattern.map(r => [...r]));
    setMovesLeft(lvl.maxMoves);
    setPhase(PHASES.SHOW);
    setSelected(null);
    setShowTimer(5);
    setLastMoved(null);
    setHistory([]);
    setShowsLeft(MAX_SHOWS);
    setIsShowingPattern(false);
    setParticles([]);
    setWinVisible(false);
    setCanvasVisible(false);
    setCanvasPositions([]);
    setFallingParticles([]);
    setButterflies([]);
    if (winTimerRef.current) { clearTimeout(winTimerRef.current); winTimerRef.current = null; }
    Object.values(tileRefs.current).forEach(r => { if (r?.current) { gsap.killTweensOf(r.current); gsap.set(r.current, { clearProps: "all" }); } });
    if (gridRef.current) { gsap.killTweensOf(gridRef.current); gsap.set(gridRef.current, { clearProps: "all" }); }
    savedGrid.current = null;
    tileRefs.current = {};
  }, []);

  useEffect(() => { startLevel(levelIndex); }, [levelIndex]);

  useEffect(() => {
    if (phase !== PHASES.SHOW) return;
    if (showTimer <= 0) {
      setGrid(shuffle(level.pattern));
      setPhase(PHASES.SOLVE);
      return;
    }
    const t = setTimeout(() => setShowTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, showTimer]);

  const triggerWinAnimation = useCallback(() => {
    sounds.win();
    const lvl = LEVELS[Math.min(levelIndex, LEVELS.length - 1)];
    const positions = [];
    lvl.pattern.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell !== 0) {
          const el = tileRefs.current[`${r}-${c}`]?.current;
          if (el) {
            const rect = el.getBoundingClientRect();
            positions.push({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
          }
        }
      });
    });
    setCanvasPositions(positions);
    setCanvasVisible(true);
    if (gridRef.current) {
      gsap.to(gridRef.current, { boxShadow: "0 0 40px rgba(0,245,212,0.6), 0 0 80px rgba(255,63,164,0.3)", duration: 0.4, yoyo: true, repeat: 5, ease: "power2.inOut" });
    }
    setFallingParticles(Array.from({ length: 22 }, (_, i) => ({
      id: i, x: Math.random() * window.innerWidth, delay: i * 0.08,
      emoji: ["🍃","🌿","✨","⭐","🍃","🌿"][Math.floor(Math.random() * 6)],
    })));
    setButterflies([
      { id: 0, side: "left", delay: 0.3 },
      { id: 1, side: "right", delay: 0.55 },
      { id: 2, side: "left", delay: 0.9 },
      { id: 3, side: "right", delay: 1.1 },
    ]);
    const tileEls = Object.values(tileRefs.current).map(r => r?.current).filter(Boolean);
    setTimeout(() => {
      gsap.to(tileEls, {
        rotation: 720, y: 200, scale: 0.3, opacity: 0,
        duration: 0.9, stagger: 0.04, ease: "power2.in",
        onComplete: () => setParticles(Array.from({ length: 18 }, (_, i) => ({
          id: i, x: Math.random() * window.innerWidth, y: window.innerHeight * 0.6,
          emoji: FLOWERS[Math.floor(Math.random() * FLOWERS.length)], delay: i * 0.06,
        }))),
      });
    }, 400);
    winTimerRef.current = setTimeout(() => setWinVisible(true), 1400);
  }, [levelIndex]);

  useEffect(() => {
    if (!winVisible) return;
    if (levelCompleteRef.current) {
      gsap.fromTo(levelCompleteRef.current,
        { y: -120, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "bounce.out" }
      );
    }
    if (unlockedRef.current) {
      gsap.fromTo(unlockedRef.current,
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.5, delay: 0.5 }
      );
    }
    if (winPanelRef.current) {
      gsap.fromTo(winPanelRef.current,
        { y: -60, opacity: 0, scale: 0.8 },
        { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: "elastic.out(1, 0.6)", delay: 0.4 }
      );
    }
  }, [winVisible]);

  const handleShowPattern = () => {
    if (showsLeft <= 0) { setShowAdModal(true); return; }
    if (isShowingPattern) return;
    sounds.show();
    savedGrid.current = grid.map(r => [...r]);
    setIsShowingPattern(true);
    setShowsLeft(s => s - 1);
    setGrid(level.pattern.map(r => [...r]));
    setTimeout(() => {
      setGrid(savedGrid.current);
      setIsShowingPattern(false);
    }, 2000);
  };

  const handleTile = (r, c) => {
    if (phase !== PHASES.SOLVE || isShowingPattern) return;
    if (selected === null) {
      if (grid[r][c] !== 0) {
        sounds.select();
        setSelected([r, c]);
        const key = `${r}-${c}`;
        if (tileRefs.current[key]?.current) {
          gsap.fromTo(tileRefs.current[key].current,
            { scale: 1 },
            { scale: 1.15, duration: 0.15, yoyo: true, repeat: 1, ease: "power2.out" }
          );
        }
      }
    } else {
      const [sr, sc] = selected;
      if (sr === r && sc === c) { setSelected(null); return; }
      if (grid[r][c] !== 0) { sounds.select(); setSelected([r, c]); return; }
      sounds.move();
      setHistory(h => [...h, { grid: grid.map(row => [...row]), movesLeft }]);
      const newGrid = grid.map(row => [...row]);
      newGrid[r][c] = newGrid[sr][sc];
      newGrid[sr][sc] = 0;
      const newMoves = movesLeft - 1;
      setGrid(newGrid);
      setMovesLeft(newMoves);
      setSelected(null);
      setLastMoved(`${r}-${c}`);
      if (gridMatches(newGrid, level.pattern)) {
        const s = newMoves > 10 ? 3 : newMoves > 5 ? 2 : 1;
        setStars(s);
        setPhase(PHASES.WIN);
        setTimeout(triggerWinAnimation, 200);
      } else if (newMoves <= 0) {
        if (gridRef.current) {
          gsap.to(gridRef.current, {
            x: -8, duration: 0.07, yoyo: true, repeat: 7, ease: "none",
            onComplete: () => gsap.set(gridRef.current, { x: 0 })
          });
        }
        sounds.lose();
        setTimeout(() => setPhase(PHASES.LOSE), 600);
      }
    }
  };

  const handleUndo = () => {
    if (history.length === 0 || isShowingPattern) return;
    sounds.undo();
    const prev = history[history.length - 1];
    setGrid(prev.grid);
    setMovesLeft(prev.movesLeft);
    setHistory(h => h.slice(0, -1));
    setSelected(null);
    setLastMoved(null);
  };

  return (
    <div style={{height:"100dvh",background:"linear-gradient(rgba(0,0,0,0.45),rgba(0,0,0,0.45)),url(/bg.png)",backgroundSize:"cover",backgroundPosition:"center",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"space-between",padding:"12px",fontFamily:"sans-serif",color:"#fff",position:"relative",overflow:"hidden"}}>

      {particles.map(p => <FlowerParticle key={p.id} {...p} />)}
      <WinCanvas visible={canvasVisible} positions={canvasPositions} />
      {fallingParticles.map(p => <FallingParticle key={p.id} {...p} />)}
      {butterflies.map(b => <Butterfly key={b.id} {...b} />)}

      <div style={{position:"absolute",width:200,height:200,borderRadius:"50%",background:"radial-gradient(circle,rgba(60,180,150,0.07),transparent)",top:-60,right:-40,pointerEvents:"none"}}/>

      <div style={{width:"100%",maxWidth:360}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{background:"rgba(93,202,165,0.2)",border:"1px solid rgba(93,202,165,0.4)",borderRadius:20,padding:"3px 12px",color:"#7ecfb0",fontSize:11,fontWeight:500}}>
            LEVEL {levelIndex + 1}
          </div>
          <img src="/lotus.png" alt="" style={{width:52,height:52,objectFit:"contain",display:"block"}}/>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>
            {phase === PHASES.SHOW ? `${showTimer}s` : ""}
          </div>
        </div>

        <div style={{textAlign:"center",fontSize:12,color:"rgba(255,255,255,0.6)",marginBottom:12,minHeight:20}}>
          {phase === PHASES.SHOW && `Remember the pattern... (${showTimer})`}
          {phase === PHASES.SOLVE && isShowingPattern && "👁 Showing pattern..."}
          {phase === PHASES.SOLVE && !isShowingPattern && (selected ? "Tap an empty tile to move" : "Tap a succulent to select")}
        </div>

        <div ref={gridRef} style={{background:"rgba(0,0,0,0.35)",border:`1px solid ${isShowingPattern?"rgba(93,202,165,0.5)":"rgba(80,60,30,0.5)"}`,borderRadius:16,padding:8,marginBottom:8,transition:"border 0.3s"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:3}}>
            {grid && grid.map((row, r) => row.map((cell, c) => {
              const key = `${r}-${c}`;
              if (!tileRefs.current[key]) tileRefs.current[key] = { current: null };
              return (
                <Tile
                  key={key}
                  type={cell}
                  isSelected={!!(selected && selected[0]===r && selected[1]===c)}
                  isLastMoved={lastMoved === key}
                  onClick={() => handleTile(r, c)}
                  tileRef={tileRefs.current[key]}
                />
              );
            }))}
          </div>
        </div>
      </div>

      {phase === PHASES.SOLVE && (
        <div style={{display:"flex",gap:16,alignItems:"center",justifyContent:"center",width:"100%",maxWidth:360,paddingBottom:8}}>
          <div onClick={handleUndo}
            style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:history.length===0?"not-allowed":"pointer",opacity:history.length===0?0.3:1,transition:"opacity 0.2s"}}>
            <div style={{width:56,height:56,borderRadius:"50%",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>↩</div>
            <span style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>UNDO</span>
          </div>

          <div onClick={handleShowPattern}
            style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer",opacity:isShowingPattern?0.5:1}}>
            <div style={{width:56,height:56,borderRadius:"50%",background:showsLeft>0?"rgba(93,202,165,0.15)":"rgba(255,255,255,0.05)",border:`1px solid ${showsLeft>0?"rgba(93,202,165,0.4)":"rgba(255,255,255,0.1)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,position:"relative"}}>
              {showsLeft > 0 ? "👁" : "🔒"}
              {showsLeft > 0 && (
                <div style={{position:"absolute",top:-4,right:-4,width:18,height:18,borderRadius:"50%",background:"#5dbfa0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:600,color:"#0d1f1a"}}>
                  {showsLeft}
                </div>
              )}
            </div>
            <span style={{fontSize:10,color:showsLeft>0?"rgba(93,202,165,0.8)":"rgba(255,255,255,0.3)"}}>
              {showsLeft > 0 ? "SHOW" : "LOCKED"}
            </span>
          </div>

          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <div style={{width:64,height:64,borderRadius:"50%",background:"radial-gradient(circle,rgba(200,100,130,0.5),rgba(120,40,70,0.7))",border:"2px solid #c86480",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:600,color:"#fff",boxShadow:"0 0 16px rgba(200,100,130,0.3)"}}>
              {movesLeft}
            </div>
            <span style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>MOVES</span>
          </div>
        </div>
      )}

      {winVisible && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:14}}>
          <div ref={levelCompleteRef} style={{fontSize:34,fontWeight:800,color:"#00f5d4",textShadow:"0 0 20px #00f5d4,0 0 40px #00f5d4",letterSpacing:3,marginBottom:6,opacity:0}}>
            LEVEL COMPLETE!
          </div>
          <div ref={unlockedRef} style={{fontSize:15,color:"#ff3fa4",textShadow:"0 0 10px #ff3fa4",letterSpacing:2,marginBottom:20,opacity:0}}>
            LEVEL {levelIndex + 2} UNLOCKED
          </div>
          <div ref={winPanelRef} style={{background:"#0d1f1a",border:"1px solid rgba(93,202,165,0.3)",borderRadius:20,padding:32,maxWidth:280,width:"90%",textAlign:"center"}}>
            <div style={{fontSize:56,marginBottom:8}}>🌸</div>
            <div style={{fontSize:22,fontWeight:500,color:"#e8d5a0",marginBottom:8}}>WELL DONE!</div>
            <div style={{fontSize:24,color:"#d4a030",letterSpacing:6,marginBottom:20}}>{"★".repeat(stars)}{"☆".repeat(3-stars)}</div>
            <button onClick={()=>setLevelIndex(i=>i+1<LEVELS.length?i+1:0)} style={{width:"100%",padding:"12px",borderRadius:24,background:"linear-gradient(135deg,#5dbfa0,#2d8a6a)",border:"none",color:"#fff",fontSize:14,fontWeight:500,cursor:"pointer",marginBottom:8}}>Next Level →</button>
            <button onClick={()=>startLevel(levelIndex)} style={{width:"100%",padding:"10px",borderRadius:24,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.7)",fontSize:13,cursor:"pointer"}}>Play Again</button>
          </div>
        </div>
      )}

      {phase === PHASES.LOSE && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:10,animation:"fadeIn 0.3s ease"}}>
          <div style={{background:"#0d1f1a",border:"1px solid rgba(200,100,130,0.3)",borderRadius:20,padding:32,maxWidth:280,width:"90%",textAlign:"center",animation:"slideUp 0.35s ease"}}>
            <div style={{fontSize:48,marginBottom:8}}>🥀</div>
            <div style={{fontSize:18,fontWeight:500,color:"#e8d5a0",marginBottom:6}}>Out of moves...</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginBottom:20}}>Watch an ad to continue</div>
            <button onClick={()=>{setMovesLeft(m=>m+5);setPhase(PHASES.SOLVE);}} style={{width:"100%",padding:"12px",borderRadius:24,background:"linear-gradient(135deg,#c8a040,#8a6020)",border:"none",color:"#fff",fontSize:14,fontWeight:500,cursor:"pointer",marginBottom:8}}>Watch Ad · +5 moves 🌿</button>
            <button onClick={()=>startLevel(levelIndex)} style={{width:"100%",padding:"10px",borderRadius:24,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.7)",fontSize:13,cursor:"pointer"}}>Try Again</button>
          </div>
        </div>
      )}

      {showAdModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:20,animation:"fadeIn 0.3s ease"}}>
          <div style={{background:"#0d1f1a",border:"1px solid rgba(93,202,165,0.3)",borderRadius:20,padding:28,maxWidth:280,width:"90%",textAlign:"center",animation:"slideUp 0.35s ease"}}>
            <div style={{fontSize:40,marginBottom:8}}>🔒</div>
            <div style={{fontSize:16,fontWeight:500,color:"#e8d5a0",marginBottom:6}}>Show Pattern Locked</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginBottom:20}}>You used all 3 free reveals.<br/>Watch an ad to get 3 more.</div>
            <button onClick={()=>{setShowsLeft(MAX_SHOWS);setShowAdModal(false);}} style={{width:"100%",padding:"12px",borderRadius:24,background:"linear-gradient(135deg,#c8a040,#8a6020)",border:"none",color:"#fff",fontSize:14,fontWeight:500,cursor:"pointer",marginBottom:8}}>Watch Ad · +3 reveals 👁</button>
            <button onClick={()=>setShowAdModal(false)} style={{width:"100%",padding:"10px",borderRadius:24,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.7)",fontSize:13,cursor:"pointer"}}>Maybe Later</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
      `}</style>
    </div>
  );
}
