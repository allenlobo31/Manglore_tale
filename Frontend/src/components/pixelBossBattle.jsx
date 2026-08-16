import { useEffect, useRef, useState } from "react";

const BASE_W = 320;
const BASE_H = 180;
const PLAYER_MAX_HP = 100;
const BOSS_MAX_HP = 220;
const BOSS_NAME = "Malgrath, Ash Warden";

const PLAYER_X = 70;
const PLAYER_FEET_Y = 148;
const BOSS_X = 250;
const BOSS_FEET_Y = 142;

function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }

export default function PixelBossBattle() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(performance.now());

  const playerHpRef = useRef(PLAYER_MAX_HP);
  const bossHpRef = useRef(BOSS_MAX_HP);
  const mpRef = useRef(100);
  const shieldActiveRef = useRef(false);
  const turnCountRef = useRef(0);

  const animPlayerRef = useRef({ type: "idle", start: 0, duration: 0 });
  const animBossRef = useRef({ type: "idle", start: 0, duration: 0 });
  const particlesRef = useRef([]);
  const damageNumbersRef = useRef([]);
  const shakeRef = useRef({ time: 0, intensity: 0 });
  const flashRef = useRef({ alpha: 0, color: "255,255,255" });
  const emberTimerRef = useRef(0);
  const magicTrailThrottleRef = useRef(0);

  const [phase, setPhase] = useState("menu"); // menu | playerTurn | playerAction | bossAction | victory | defeat
  const [mp, setMp] = useState(100);
  const [log, setLog] = useState([]);
  const logEndRef = useRef(null);

  function addLog(msg) {
    setLog((prev) => [...prev.slice(-30), msg]);
  }

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [log]);

  // ---------- particle / fx helpers ----------
  function spawnParticles(x, y, count, opts = {}) {
    const spread = opts.spread ?? 2;
    const life = opts.life ?? 500;
    const color = opts.color ?? "255,255,255";
    const gravity = opts.gravity ?? 0.002;
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x: x + rand(-spread, spread),
        y: y + rand(-spread, spread),
        vx: opts.vx !== undefined ? opts.vx + rand(-0.3, 0.3) : rand(-0.6, 0.6),
        vy: opts.vy !== undefined ? opts.vy + rand(-0.3, 0.3) : rand(-1.2, -0.2),
        life,
        maxLife: life,
        size: opts.size ?? rand(1.5, 3),
        color,
        gravity,
      });
    }
  }

  function spawnDamageNumber(x, y, text, color) {
    damageNumbersRef.current.push({ x, y, text, color, life: 900, maxLife: 900 });
  }

  function triggerShake(intensity, time) {
    shakeRef.current = { time, intensity };
  }
  function triggerFlash(color, alpha) {
    flashRef.current = { alpha, color };
  }

  // ---------- game logic ----------
  function startGame() {
    playerHpRef.current = PLAYER_MAX_HP;
    bossHpRef.current = BOSS_MAX_HP;
    mpRef.current = 100;
    setMp(100);
    shieldActiveRef.current = false;
    turnCountRef.current = 0;
    particlesRef.current = [];
    damageNumbersRef.current = [];
    animPlayerRef.current = { type: "idle", start: performance.now(), duration: 0 };
    animBossRef.current = { type: "idle", start: performance.now(), duration: 0 };
    setLog([`${BOSS_NAME} blocks the way. Only steel and spellcraft will clear it.`]);
    setPhase("playerTurn");
  }

  function playerAction(type) {
    if (phase !== "playerTurn") return;
    if (type === "magic" && mpRef.current < 30) return;

    const duration = type === "magic" ? 1500 : type === "shield" ? 650 : 620;
    animPlayerRef.current = { type, start: performance.now(), duration };
    setPhase("playerAction");

    if (type === "shield") shieldActiveRef.current = true;

    window.setTimeout(() => resolvePlayerAction(type), duration);
  }

  function resolvePlayerAction(type) {
    if (type === "shield") {
      addLog("You brace behind your shield.");
    } else if (type === "sword") {
      const dmg = randInt(12, 20);
      bossHpRef.current = clamp(bossHpRef.current - dmg, 0, BOSS_MAX_HP);
      addLog(`You slash ${BOSS_NAME} for ${dmg} damage.`);
      spawnDamageNumber(BOSS_X, BOSS_FEET_Y - 62, `-${dmg}`, "255,255,255");
      spawnParticles(BOSS_X - 14, BOSS_FEET_Y - 50, 10, { color: "255,255,255", life: 300, spread: 6, vy: -0.6 });
      triggerShake(4, 180);
    } else if (type === "magic") {
      const dmg = randInt(30, 46);
      mpRef.current = clamp(mpRef.current - 30, 0, 100);
      setMp(mpRef.current);
      bossHpRef.current = clamp(bossHpRef.current - dmg, 0, BOSS_MAX_HP);
      addLog(`Arcane bolt sears ${BOSS_NAME} for ${dmg} damage!`);
      spawnDamageNumber(BOSS_X, BOSS_FEET_Y - 62, `-${dmg}`, "197,125,255");
      spawnParticles(BOSS_X - 14, BOSS_FEET_Y - 50, 24, { color: "197,125,255", life: 500, spread: 12, vy: -0.8 });
      triggerShake(7, 260);
      triggerFlash("176,120,255", 0.35);
    }

    if (bossHpRef.current <= 0) {
      addLog(`${BOSS_NAME} collapses. Victory is yours!`);
      setPhase("victory");
      return;
    }

    animBossRef.current = { type: "flinch", start: performance.now(), duration: 300 };
    setPhase("bossAction");

    window.setTimeout(() => {
      turnCountRef.current += 1;
      const heavy = turnCountRef.current % 3 === 0;
      const duration = heavy ? 1700 : 950;
      animBossRef.current = { type: heavy ? "heavy" : "claw", start: performance.now(), duration };
      if (heavy) addLog(`${BOSS_NAME} rears back, gathering a crushing blow...`);
      window.setTimeout(() => resolveBossAction(heavy), duration);
    }, 350);
  }

  function resolveBossAction(heavy) {
    let dmg = heavy ? randInt(20, 32) : randInt(9, 17);
    if (shieldActiveRef.current) {
      dmg = Math.round(dmg * 0.3);
      addLog(`Your shield absorbs the blow! (-${dmg})`);
      spawnParticles(PLAYER_X + 10, PLAYER_FEET_Y - 30, 10, { color: "255,210,90", life: 300, spread: 4, vy: -0.4 });
      animPlayerRef.current = { type: "block", start: performance.now(), duration: 350 };
    } else {
      addLog(`${BOSS_NAME} hits you for ${dmg} damage.`);
      animPlayerRef.current = { type: "hit", start: performance.now(), duration: 400 };
      triggerFlash("230,60,70", 0.25);
    }
    shieldActiveRef.current = false;
    playerHpRef.current = clamp(playerHpRef.current - dmg, 0, PLAYER_MAX_HP);
    spawnDamageNumber(PLAYER_X, PLAYER_FEET_Y - 58, `-${dmg}`, "230,60,70");
    triggerShake(heavy ? 9 : 5, 200);

    if (playerHpRef.current <= 0) {
      addLog("You collapse before the boss...");
      setPhase("defeat");
      return;
    }

    mpRef.current = clamp(mpRef.current + 12, 0, 100);
    setMp(mpRef.current);
    setPhase("playerTurn");
  }

  useEffect(() => {
    function onKey(e) {
      if (phase !== "playerTurn") return;
      if (e.key === "1") playerAction("sword");
      if (e.key === "2") playerAction("shield");
      if (e.key === "3") playerAction("magic");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, mp]);

  // ---------- drawing ----------
  function drawTorch(ctx, x, y, now) {
    ctx.fillStyle = "#5b4636";
    ctx.fillRect(x - 2, y, 4, 28);
    ctx.fillStyle = "#2c2c2c";
    ctx.fillRect(x - 4, y - 3, 8, 5);
    const flicker = Math.sin(now / 90 + x) * 2;
    const grad = ctx.createRadialGradient(x, y - 8, 1, x, y - 8, 12);
    grad.addColorStop(0, "rgba(255,200,90,0.9)");
    grad.addColorStop(1, "rgba(255,140,40,0)");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x, y - 8, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffcf6b";
    ctx.beginPath();
    ctx.moveTo(x, y - 16 - flicker);
    ctx.quadraticCurveTo(x + 5, y - 8, x, y - 2);
    ctx.quadraticCurveTo(x - 5, y - 8, x, y - 16 - flicker);
    ctx.fill();
    ctx.fillStyle = "#ff7d3d";
    ctx.beginPath();
    ctx.moveTo(x, y - 10 - flicker * 0.6);
    ctx.quadraticCurveTo(x + 3, y - 6, x, y - 3);
    ctx.quadraticCurveTo(x - 3, y - 6, x, y - 10 - flicker * 0.6);
    ctx.fill();
  }

  function drawBackground(ctx, now) {
    const grad = ctx.createLinearGradient(0, 0, 0, BASE_H);
    grad.addColorStop(0, "#150f2b");
    grad.addColorStop(0.6, "#1d1533");
    grad.addColorStop(1, "#231a3a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, BASE_W, BASE_H);

    ctx.fillStyle = "#f4ead8";
    ctx.beginPath(); ctx.arc(40, 26, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#231a3a";
    ctx.beginPath(); ctx.arc(44, 23, 9, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#120c22";
    ctx.beginPath();
    ctx.moveTo(0, 120);
    ctx.lineTo(30, 90); ctx.lineTo(60, 115); ctx.lineTo(95, 80); ctx.lineTo(140, 118);
    ctx.lineTo(180, 88); ctx.lineTo(230, 116); ctx.lineTo(270, 92); ctx.lineTo(320, 120);
    ctx.lineTo(320, 140); ctx.lineTo(0, 140); ctx.closePath(); ctx.fill();

    ctx.fillStyle = "#241a33";
    ctx.fillRect(0, 140, BASE_W, 40);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    for (let x = -10; x < BASE_W + 20; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 140); ctx.lineTo(x - 8, 180); ctx.stroke();
    }
    for (let y = 148; y < 180; y += 10) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(BASE_W, y); ctx.stroke();
    }

    drawTorch(ctx, 18, 112, now);
    drawTorch(ctx, 300, 112, now);
  }

  function drawPlayer(ctx, now) {
    const ap = animPlayerRef.current;
    const t = ap.duration ? clamp((now - ap.start) / ap.duration, 0, 1) : 1;

    let bob = Math.sin(now / 260) * 1.4;
    let swordAngle = -25;
    let bodyOffsetX = 0;
    let shieldPush = 0;
    let tint = null;
    let glow = 0;

    if (ap.type === "sword") {
      const s = Math.sin(t * Math.PI);
      swordAngle = -25 + s * -95;
      bodyOffsetX = s * 6;
    } else if (ap.type === "magic") {
      if (t < 0.55) {
        glow = t / 0.55;
        bob += Math.sin(now / 60) * 0.6;
      } else {
        glow = 1 - (t - 0.55) / 0.45;
        bodyOffsetX = 3;
      }
    } else if (ap.type === "shield") {
      shieldPush = Math.sin(t * Math.PI) * 4;
    } else if (ap.type === "block") {
      shieldPush = 5;
      bodyOffsetX = -2 + Math.sin(t * Math.PI) * 2;
    } else if (ap.type === "hit") {
      tint = "230,60,70";
      bodyOffsetX = (1 - t) * -4;
    }

    ctx.save();
    ctx.translate(PLAYER_X + bodyOffsetX, PLAYER_FEET_Y + bob);

    if (glow > 0) {
      const r = 14 + glow * 6;
      const g = ctx.createRadialGradient(0, -26, 1, 0, -26, r);
      g.addColorStop(0, `rgba(197,125,255,${0.5 * glow})`);
      g.addColorStop(1, "rgba(197,125,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, -26, r, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = "#3a3450";
    ctx.fillRect(-7, -20, 5, 20);
    ctx.fillRect(2, -20, 5, 20);

    ctx.fillStyle = "#5b2340";
    ctx.fillRect(-9, -40, 4, 22);

    ctx.fillStyle = tint ? `rgb(${tint})` : "#5b7fae";
    ctx.fillRect(-8, -42, 18, 24);
    ctx.fillStyle = "#3d5a82";
    ctx.fillRect(-8, -42, 18, 4);

    ctx.fillStyle = tint ? `rgb(${tint})` : "#e0b088";
    ctx.fillRect(-4, -54, 12, 12);
    ctx.fillStyle = "#8a8a9a";
    ctx.fillRect(-5, -58, 14, 6);
    ctx.fillStyle = "#ffcf6b";
    ctx.fillRect(-1, -58, 3, 2);

    ctx.save();
    ctx.translate(11 + shieldPush, -30);
    ctx.fillStyle = "#9a9aab";
    ctx.fillRect(-3, -9, 8, 18);
    ctx.fillStyle = "#ffb84d";
    ctx.fillRect(-1, -3, 4, 4);
    ctx.restore();

    ctx.save();
    ctx.translate(-9, -34);
    ctx.rotate((swordAngle * Math.PI) / 180);
    ctx.fillStyle = "#cfd3e0";
    ctx.fillRect(-2, -20, 3, 20);
    ctx.fillStyle = "#ffb84d";
    ctx.fillRect(-3, 0, 5, 3);
    ctx.restore();

    ctx.restore();
  }

  function drawBoss(ctx, now) {
    const ab = animBossRef.current;
    const t = ab.duration ? clamp((now - ab.start) / ab.duration, 0, 1) : 1;

    let bob = Math.sin(now / 340) * 1.6;
    let lungeX = 0;
    let mouth = 0;
    let flinch = 0;
    let chargeGlow = 0;

    if (ab.type === "claw") {
      lungeX = -Math.sin(t * Math.PI) * 30;
      mouth = Math.sin(t * Math.PI);
    } else if (ab.type === "heavy") {
      if (t < 0.4) {
        chargeGlow = t / 0.4;
      } else {
        const pt = (t - 0.4) / 0.6;
        lungeX = -Math.sin(pt * Math.PI) * 46;
        mouth = Math.sin(pt * Math.PI);
      }
    } else if (ab.type === "flinch") {
      flinch = Math.sin(t * Math.PI) * 4;
    }

    ctx.save();
    ctx.translate(BOSS_X + lungeX + flinch, BOSS_FEET_Y + bob);

    if (chargeGlow > 0) {
      const r = 20 + chargeGlow * 10;
      const g = ctx.createRadialGradient(0, -40, 1, 0, -40, r);
      g.addColorStop(0, `rgba(255,70,70,${0.45 * chargeGlow})`);
      g.addColorStop(1, "rgba(255,70,70,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, -40, r, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = "#3d1420";
    ctx.fillRect(24, -20, 14, 5);

    ctx.fillStyle = "#2c0f18";
    ctx.fillRect(-14, -22, 9, 22);
    ctx.fillRect(4, -22, 9, 22);

    ctx.fillStyle = "#7a1f2b";
    ctx.fillRect(-20, -66, 40, 46);
    ctx.fillStyle = "#5c1720";
    ctx.fillRect(-20, -66, 40, 8);
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath(); ctx.moveTo(-6, -60); ctx.lineTo(-2, -40); ctx.lineTo(-10, -28); ctx.stroke();

    ctx.fillStyle = "#4a1219";
    ctx.fillRect(-14, -88, 28, 22);
    ctx.fillStyle = "#c9c2b8";
    ctx.beginPath(); ctx.moveTo(-14, -86); ctx.lineTo(-22, -100); ctx.lineTo(-10, -84); ctx.fill();
    ctx.beginPath(); ctx.moveTo(14, -86); ctx.lineTo(22, -100); ctx.lineTo(10, -84); ctx.fill();

    const eyePulse = 1 + Math.sin(now / 200) * 0.15;
    ctx.fillStyle = chargeGlow > 0 ? "rgba(255,60,60,1)" : "rgba(255,210,60,1)";
    ctx.beginPath(); ctx.arc(-6, -78, 1.6 * eyePulse, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -78, 1.6 * eyePulse, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#1a0507";
    ctx.fillRect(-8, -70, 16, 4 + mouth * 6);

    ctx.save();
    ctx.translate(-20, -50);
    ctx.rotate(((-20 + mouth * 40) * Math.PI) / 180);
    ctx.fillStyle = "#5c1720";
    ctx.fillRect(-4, -4, -20, 8);
    ctx.fillStyle = "#c9c2b8";
    ctx.beginPath(); ctx.moveTo(-24, -4); ctx.lineTo(-30, -8); ctx.lineTo(-24, 0); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-24, 2); ctx.lineTo(-30, 4); ctx.lineTo(-24, 6); ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  function drawParticles(ctx) {
    for (const p of particlesRef.current) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = `rgba(${p.color},${a})`;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }

  function drawDamageNumbers(ctx) {
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    for (const d of damageNumbersRef.current) {
      const a = clamp(d.life / d.maxLife, 0, 1);
      ctx.fillStyle = `rgba(${d.color},${a})`;
      ctx.fillText(d.text, d.x, d.y);
    }
  }

  function drawBar(ctx, x, y, w, h, pct, color, bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.max(0, w * clamp(pct, 0, 1)), h);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function drawHUD(ctx) {
    drawBar(ctx, 6, 6, 100, 6, playerHpRef.current / PLAYER_MAX_HP, "#e63946", "#3a0d12");
    drawBar(ctx, 6, 14, 70, 4, mpRef.current / 100, "#4ea8de", "#122a38");
    ctx.font = "6px monospace";
    ctx.fillStyle = "#f4ead8";
    ctx.textAlign = "left";
    ctx.fillText("HERO", 6, 5);

    const w = 140;
    drawBar(ctx, BASE_W - w - 6, 6, w, 7, bossHpRef.current / BOSS_MAX_HP, "#c9c2b8", "#241a1e");
    ctx.textAlign = "right";
    ctx.fillText(BOSS_NAME.toUpperCase(), BASE_W - 6, 5);
  }

  function update(dt, now) {
    particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
    for (const p of particlesRef.current) {
      p.x += p.vx * dt * 0.1;
      p.y += p.vy * dt * 0.1;
      p.vy += p.gravity * dt;
      p.life -= dt;
    }
    damageNumbersRef.current = damageNumbersRef.current.filter((d) => d.life > 0);
    for (const d of damageNumbersRef.current) {
      d.y -= 0.02 * dt;
      d.life -= dt;
    }
    if (shakeRef.current.time > 0) shakeRef.current.time -= dt;
    if (flashRef.current.alpha > 0) flashRef.current.alpha *= 0.92;

    emberTimerRef.current -= dt;
    if (emberTimerRef.current <= 0) {
      emberTimerRef.current = rand(200, 500);
      spawnParticles(rand(20, BASE_W - 20), BASE_H - 5, 1, {
        color: "255,180,90", life: 2200, spread: 0,
        vx: rand(-0.1, 0.1), vy: rand(-0.6, -0.2), gravity: -0.0006, size: rand(1, 1.6),
      });
    }

    const ap = animPlayerRef.current;
    if (ap.type === "magic") {
      const t = clamp((now - ap.start) / ap.duration, 0, 1);
      magicTrailThrottleRef.current -= dt;
      if (t < 0.55) {
        if (magicTrailThrottleRef.current <= 0) {
          magicTrailThrottleRef.current = 30;
          const ang = rand(0, Math.PI * 2);
          const r = 18;
          spawnParticles(PLAYER_X + Math.cos(ang) * r, PLAYER_FEET_Y - 30 + Math.sin(ang) * r, 1, {
            color: "197,125,255", life: 350, spread: 0,
            vx: -Math.cos(ang) * 1.2, vy: -Math.sin(ang) * 1.2, gravity: 0,
          });
        }
      } else if (t < 0.9) {
        const pt = (t - 0.55) / 0.35;
        const px = lerp(PLAYER_X + 14, BOSS_X - 14, pt);
        const py = lerp(PLAYER_FEET_Y - 34, BOSS_FEET_Y - 50, pt);
        if (magicTrailThrottleRef.current <= 0) {
          magicTrailThrottleRef.current = 16;
          spawnParticles(px, py, 2, { color: "197,125,255", life: 260, spread: 2, vx: 0, vy: 0, gravity: 0 });
        }
      }
    }
  }

  function render(ctx, now) {
    ctx.save();
    ctx.clearRect(0, 0, BASE_W, BASE_H);

    let shakeX = 0, shakeY = 0;
    if (shakeRef.current.time > 0) {
      shakeX = rand(-1, 1) * shakeRef.current.intensity;
      shakeY = rand(-1, 1) * shakeRef.current.intensity;
    }
    ctx.translate(shakeX, shakeY);

    drawBackground(ctx, now);
    drawBoss(ctx, now);
    drawPlayer(ctx, now);
    drawParticles(ctx);
    drawDamageNumbers(ctx);
    drawHUD(ctx);

    ctx.restore();

    if (flashRef.current.alpha > 0.01) {
      ctx.fillStyle = `rgba(${flashRef.current.color},${flashRef.current.alpha})`;
      ctx.fillRect(0, 0, BASE_W, BASE_H);
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    function frame(now) {
      const dt = Math.min(now - lastTimeRef.current, 48);
      lastTimeRef.current = now;
      update(dt, now);
      render(ctx, now);
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="pbb-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
        .pbb-root{ min-height:100%; width:100%; background:#0b0a14; color:#f4ead8; font-family:'VT323', monospace; display:flex; flex-direction:column; align-items:center; padding:20px 12px; box-sizing:border-box; }
        .pbb-title{ font-family:'Press Start 2P', monospace; font-size:14px; color:#ffb84d; text-shadow:2px 2px 0 #000; letter-spacing:1px; margin-bottom:10px; text-align:center; }
        .pbb-stage{ position:relative; width:100%; max-width:820px; border:4px solid #372a55; box-shadow:0 0 0 4px #0b0a14, 0 10px 30px rgba(0,0,0,0.6); background:#000; }
        .pbb-canvas{ display:block; width:100%; height:auto; image-rendering:pixelated; aspect-ratio:${BASE_W} / ${BASE_H}; }
        .pbb-overlay{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; background:rgba(11,10,20,0.86); text-align:center; padding:20px; }
        .pbb-overlay h2{ font-family:'Press Start 2P'; font-size: clamp(14px,3vw,22px); margin:0; text-shadow:2px 2px 0 #000; }
        .pbb-btn{ font-family:'Press Start 2P'; font-size:10px; background:#ffb84d; color:#1a1226; border:none; padding:12px 18px; cursor:pointer; box-shadow:0 4px 0 #a86a1e; }
        .pbb-btn:active{ transform:translateY(3px); box-shadow:0 1px 0 #a86a1e; }
        .pbb-controls{ width:100%; max-width:820px; margin-top:14px; display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px; }
        .pbb-action{ font-family:'Press Start 2P'; font-size:9px; line-height:1.6; background:#171226; border:2px solid #372a55; color:#f4ead8; padding:10px 6px; cursor:pointer; text-align:center; box-shadow:0 4px 0 #05040a; }
        .pbb-action:hover:not(:disabled){ border-color:#ffb84d; }
        .pbb-action:active:not(:disabled){ transform:translateY(3px); box-shadow:0 1px 0 #05040a; }
        .pbb-action:disabled{ opacity:0.35; cursor:not-allowed; }
        .pbb-action small{ display:block; font-family:'VT323'; font-size:13px; color:#b8aee0; margin-top:5px; }
        .pbb-log{ width:100%; max-width:820px; margin-top:14px; background:#0f0c1c; border:2px solid #372a55; padding:10px 12px; height:110px; overflow-y:auto; font-size:16px; line-height:1.35; }
        .pbb-log div{ color:#c8bfe0; }
        .pbb-log div:last-child{ color:#ffe9c2; }
        .pbb-hint{ margin-top:8px; font-size:14px; color:#7c72a0; text-align:center; }
      `}</style>

      <div className="pbb-title">PIXEL BOSS BATTLE</div>

      <div className="pbb-stage">
        <canvas ref={canvasRef} width={BASE_W} height={BASE_H} className="pbb-canvas" />

        {phase === "menu" && (
          <div className="pbb-overlay">
            <h2>{BOSS_NAME}<br />GUARDS THE GATE</h2>
            <p style={{ fontSize: 16, color: "#c8bfe0", maxWidth: 420 }}>
              Wield sword, shield and arcane magic. Time your defense, manage your mana, and bring the warden down.
            </p>
            <button className="pbb-btn" onClick={startGame}>PRESS START</button>
          </div>
        )}

        {phase === "victory" && (
          <div className="pbb-overlay">
            <h2 style={{ color: "#ffb84d" }}>VICTORY!</h2>
            <p style={{ fontSize: 16, color: "#c8bfe0" }}>{BOSS_NAME} has fallen.</p>
            <button className="pbb-btn" onClick={() => setPhase("menu")}>PLAY AGAIN</button>
          </div>
        )}

        {phase === "defeat" && (
          <div className="pbb-overlay">
            <h2 style={{ color: "#e63946" }}>YOU DIED</h2>
            <p style={{ fontSize: 16, color: "#c8bfe0" }}>The warden proved too strong. Try again?</p>
            <button className="pbb-btn" onClick={() => setPhase("menu")}>RETRY</button>
          </div>
        )}
      </div>

      <div className="pbb-controls">
        <button className="pbb-action" disabled={phase !== "playerTurn"} onClick={() => playerAction("sword")}>
          ⚔ SWORD
          <small>12–20 dmg · key 1</small>
        </button>
        <button className="pbb-action" disabled={phase !== "playerTurn"} onClick={() => playerAction("shield")}>
          🛡 SHIELD
          <small>block ~70% · key 2</small>
        </button>
        <button className="pbb-action" disabled={phase !== "playerTurn" || mp < 30} onClick={() => playerAction("magic")}>
          ✦ MAGIC
          <small>30 MP · 30–46 dmg · key 3</small>
        </button>
      </div>

      <div className="pbb-log">
        {log.length === 0 && <div>The battle log will appear here...</div>}
        {log.map((l, i) => <div key={i}>{l}</div>)}
        <div ref={logEndRef} />
      </div>
      <div className="pbb-hint">MP regenerates each turn · Shield mitigates the boss's next strike · Magic hits hardest but costs mana</div>
    </div>
  );
}