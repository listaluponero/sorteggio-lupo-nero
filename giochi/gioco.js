


"use strict";

// ======================================
// LUPO GAMES - LUPO RUNNER
// Difficolta progressiva e sequenze variabili
// ======================================

const LEADERBOARD_API_URL =
  "https://script.google.com/macros/s/AKfycbw90FPmdyu6G-qnkNq3G47-aryIWio0iC9XLb0fv-dXOgTDJge9YNickWF6cZCu9Tdv/exec";

const BEST_KEY = "lupoRunnerBest";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const startButton = document.getElementById("startGame");
const jumpButton = document.getElementById("jumpGame");
const pauseButton = document.getElementById("pauseGame");
const scoreElement = document.getElementById("score");
const bestElement = document.getElementById("personalBest");
const messageElement = document.getElementById("gameMessage");
const playerNameInput = document.getElementById("playerName");
const submitScoreButton = document.getElementById("submitScore");
const refreshBoardButton = document.getElementById("refreshBoard");
const leaderboardBody = document.getElementById("leaderboardBody");
const leaderboardStatus = document.getElementById("leaderboardStatus");

const W = canvas.width;
const H = canvas.height;
const groundY = H - 80;

const START_SPEED = 4;
const MAX_SPEED = 8;

// Distanza minima tra due ostacoli di una combinazione.
// Serve a dare a Lupetto il tempo di atterrare.
const MIN_COMBO_GAP = 370;

let running = false;
let paused = false;
let gameOver = false;
let animationId = null;
let lastTime = 0;

let distance = 0;
let score = 0;
let finalScore = 0;

let speed = START_SPEED;
let baseSpeed = START_SPEED;
let speedFactor = 1;
let speedChangeTimer = 0;
let nextSpeedChange = 3000;

// Generazione degli ostacoli basata sulla distanza percorsa.
let spawnDistance = 0;
let nextSpawnDistance = 430;

let obstacles = [];
let particles = [];

// Controlli touch.
let pointerStartX = 0;
let pointerStartY = 0;
let pointerMoved = false;
let pointerIsDown = false;

// ======================================
// RECORD PERSONALE
// ======================================

function loadBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Il gioco funziona anche senza memoria locale.
  }
}

let best = loadBest();

const player = {
  x: 75,
  y: groundY - 46,
  w: 42,
  h: 46,
  vy: 0,
  gravity: 0.72,
  jumpPower: -13,
  grounded: true
};

function updateScoreboard() {
  if (scoreElement) scoreElement.textContent = String(score);
  if (bestElement) bestElement.textContent = String(best);
}

function updatePauseButton() {
  if (!pauseButton) return;

  pauseButton.textContent = paused ? "RIPRENDI" : "PAUSA";
  pauseButton.disabled = !running && !paused;
}

// ======================================
// FASI DI DIFFICOLTA
// ======================================

function getDifficultyStage() {
  if (score < 500) return 0;
  if (score < 1500) return 1;
  if (score < 3000) return 2;
  if (score < 5000) return 3;
  return 4;
}

function getStageName() {
  const stage = getDifficultyStage();

  const names = [
    "APPRENDIMENTO",
    "ATTENZIONE",
    "SOPRAVVIVENZA",
    "LUPO NERO",
    "INCUBO"
  ];

  return names[stage];
}

// ======================================
// SFONDO
// ======================================

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#090b14");
  sky.addColorStop(0.58, "#201b2b");
  sky.addColorStop(1, "#38232d");

  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#e9e3d6";
  ctx.beginPath();
  ctx.arc(320, 95, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(9,11,20,0.25)";
  ctx.beginPath();
  ctx.arc(311, 88, 23, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#252334";
  ctx.beginPath();
  ctx.moveTo(0, 350);
  ctx.lineTo(80, 245);
  ctx.lineTo(145, 330);
  ctx.lineTo(235, 220);
  ctx.lineTo(330, 335);
  ctx.lineTo(390, 270);
  ctx.lineTo(W, 345);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#171923";
  ctx.beginPath();
  ctx.moveTo(0, 410);
  ctx.lineTo(100, 330);
  ctx.lineTo(185, 405);
  ctx.lineTo(290, 320);
  ctx.lineTo(W, 415);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  const offset = (distance * 0.4) % 100;

  for (let i = -1; i < 7; i++) {
    const x = i * 100 - offset;
    ctx.fillStyle = "#0d1017";

    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x + 28, groundY - 95);
    ctx.lineTo(x + 56, groundY);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x + 8, groundY - 35);
    ctx.lineTo(x + 28, groundY - 120);
    ctx.lineTo(x + 48, groundY - 35);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = "#101014";
  ctx.fillRect(0, groundY, W, H - groundY);

  ctx.fillStyle = "#8d354c";
  ctx.fillRect(0, groundY, W, 3);

  ctx.strokeStyle = "#39303b";
  ctx.lineWidth = 2;

  for (let x = -((distance * 2) % 45); x < W; x += 45) {
    ctx.beginPath();
    ctx.moveTo(x, groundY + 24);
    ctx.lineTo(x + 20, groundY + 24);
    ctx.stroke();
  }
}

// ======================================
// LUPETTO
// ======================================

function drawWolf() {
  const x = player.x;
  const y = player.y;

  const run = running && !paused && player.grounded
    ? Math.sin(distance * 0.2) * 4
    : 0;

  ctx.save();

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(
    x + 23,
    groundY + 5,
    player.grounded ? 25 : 16,
    5,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.strokeStyle = "#242832";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + 10, y + 30);
  ctx.quadraticCurveTo(x - 2, y + 24, x + 3, y + 17);
  ctx.stroke();

  ctx.fillStyle = "#171a21";
  ctx.beginPath();
  ctx.ellipse(x + 22, y + 31, 19, 13, -0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2b3039";
  ctx.beginPath();
  ctx.ellipse(x + 22, y + 25, 17, 10, -0.1, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#08090d";
  ctx.fillRect(x + 10, y + 35, 8, 10 + run);
  ctx.fillRect(x + 28, y + 35, 8, 10 - run);

  ctx.fillStyle = "#252a33";
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 19);
  ctx.lineTo(x + 8, y + 1);
  ctx.lineTo(x + 20, y + 15);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + 24, y + 15);
  ctx.lineTo(x + 38, y + 1);
  ctx.lineTo(x + 41, y + 22);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#711f34";
  ctx.beginPath();
  ctx.moveTo(x + 10, y + 14);
  ctx.lineTo(x + 10, y + 6);
  ctx.lineTo(x + 16, y + 14);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + 29, y + 14);
  ctx.lineTo(x + 36, y + 6);
  ctx.lineTo(x + 36, y + 16);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#343944";
  ctx.beginPath();
  ctx.ellipse(x + 24, y + 22, 19, 17, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#777d88";
  ctx.beginPath();
  ctx.moveTo(x + 29, y + 23);
  ctx.lineTo(x + 46, y + 29);
  ctx.lineTo(x + 31, y + 35);
  ctx.lineTo(x + 23, y + 29);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f0e7d6";
  ctx.beginPath();
  ctx.arc(x + 30, y + 19, 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#d52b48";
  ctx.beginPath();
  ctx.arc(x + 31, y + 19, 1.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#070709";
  ctx.beginPath();
  ctx.arc(x + 44, y + 29, 2.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ======================================
// GENERATORE DI OSTACOLI
// ======================================

const OBSTACLE_SIZES = {
  spike: { w: 35, h: 35 },
  crate: { w: 35, h: 38 },
  heart: { w: 36, h: 36 },
  angel: { w: 40, h: 44 },
  snake: { w: 52, h: 28 }
};

function createObstacle(type, offset = 0) {
  const size = OBSTACLE_SIZES[type];

  obstacles.push({
    type,
    x: W + 10 + offset,
    y: groundY - size.h,
    baseY: groundY - size.h,
    w: size.w,
    h: size.h,
    phase: Math.random() * Math.PI * 2
  });
}

function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Sceglie quali ostacoli inserire nella prossima sequenza.
// Le combinazioni aumentano con il punteggio.
function choosePattern() {
  const stage = getDifficultyStage();

  const groundTypes = ["spike", "crate", "heart", "snake"];
  const allTypes = ["spike", "crate", "heart", "angel", "snake"];

  // Fase 1: ostacoli singoli e leggibili.
  if (stage === 0) {
    return {
      types: [pickRandom(["spike", "crate", "heart"])],
      gap: 0
    };
  }

  // Fase 2: varietà maggiore, prime combinazioni rare.
  if (stage === 1) {
    if (Math.random() < 0.22) {
      return {
        types: [
          pickRandom(groundTypes),
          pickRandom(groundTypes)
        ],
        gap: MIN_COMBO_GAP + Math.random() * 45
      };
    }

    return {
      types: [pickRandom(allTypes)],
      gap: 0
    };
  }

  // Fase 3: combinazioni più frequenti e angelo volante.
  if (stage === 2) {
    if (Math.random() < 0.4) {
      const first = pickRandom(groundTypes);
      let second = pickRandom(groundTypes);

      if (second === first) {
        second = pickRandom(
          groundTypes.filter(type => type !== first)
        );
      }

      return {
        types: [first, second],
        gap: MIN_COMBO_GAP + Math.random() * 65
      };
    }

    return {
      types: [pickRandom(allTypes)],
      gap: 0
    };
  }

  // Fase 4: più coppie, senza triplette ravvicinate.
  if (stage === 3) {
    if (Math.random() < 0.55) {
      return {
        types: [
          pickRandom(groundTypes),
          pickRandom(groundTypes)
        ],
        gap: MIN_COMBO_GAP + Math.random() * 80
      };
    }

    return {
      types: [pickRandom(allTypes)],
      gap: 0
    };
  }

  // Fase 5: modalità avanzata.
  // Le sequenze restano limitate a due ostacoli.
  if (Math.random() < 0.62) {
    return {
      types: [
        pickRandom(groundTypes),
        pickRandom(groundTypes)
      ],
      gap: MIN_COMBO_GAP + Math.random() * 100
    };
  }

  return {
    types: [pickRandom(allTypes)],
    gap: 0
  };
}

// Genera una sequenza e programma la successiva.
// Il tempo tra le sequenze dipende dalla distanza percorsa,
// non soltanto da un timer fisso.
function spawnPattern() {
  const pattern = choosePattern();

  pattern.types.forEach((type, index) => {
    createObstacle(
      type,
      index === 0 ? 0 : pattern.gap
    );
  });

  const stage = getDifficultyStage();

  let minRest;
  let maxRest;

  if (stage === 0) {
    minRest = 640;
    maxRest = 900;
  } else if (stage === 1) {
    minRest = 570;
    maxRest = 820;
  } else if (stage === 2) {
    minRest = 520;
    maxRest = 760;
  } else if (stage === 3) {
    minRest = 490;
    maxRest = 700;
  } else {
    minRest = 470;
    maxRest = 660;
  }

  // La distanza di riposo è calcolata dopo l'ultimo
  // ostacolo della sequenza, non dopo il primo.
  nextSpawnDistance =
    spawnDistance +
    pattern.gap +
    minRest +
    Math.random() * (maxRest - minRest);
}

// ======================================
// DISEGNO OSTACOLI
// ======================================

function drawHeart(o) {
  const x = o.x;
  const y = o.y;

  ctx.save();

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.ellipse(x + 18, y + 33, 17, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#6f0d20";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + 17, y + 12);
  ctx.lineTo(x + 12, y + 3);
  ctx.lineTo(x + 6, y + 1);
  ctx.moveTo(x + 20, y + 12);
  ctx.lineTo(x + 26, y + 3);
  ctx.lineTo(x + 31, y + 5);
  ctx.moveTo(x + 10, y + 22);
  ctx.lineTo(x + 3, y + 27);
  ctx.moveTo(x + 25, y + 22);
  ctx.lineTo(x + 32, y + 28);
  ctx.stroke();

  ctx.fillStyle = "#651020";
  ctx.beginPath();
  ctx.moveTo(x + 18, y + 31);
  ctx.bezierCurveTo(x + 13, y + 25, x + 2, y + 18, x + 5, y + 10);
  ctx.bezierCurveTo(x + 7, y + 3, x + 15, y + 4, x + 18, y + 11);
  ctx.bezierCurveTo(x + 23, y + 2, x + 32, y + 5, x + 32, y + 13);
  ctx.bezierCurveTo(x + 32, y + 20, x + 24, y + 27, x + 18, y + 31);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#b51f36";
  ctx.beginPath();
  ctx.ellipse(x + 14, y + 13, 5, 7, -0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#8c1328";
  ctx.beginPath();
  ctx.ellipse(x + 24, y + 16, 5, 7, 0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#300711";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 19, y + 12);
  ctx.lineTo(x + 18, y + 25);
  ctx.stroke();

  ctx.fillStyle = "#e12c42";
  ctx.beginPath();
  ctx.moveTo(x + 30, y + 27);
  ctx.quadraticCurveTo(x + 35, y + 32, x + 30, y + 35);
  ctx.quadraticCurveTo(x + 26, y + 32, x + 30, y + 27);
  ctx.fill();

  ctx.restore();
}

function drawAngel(o) {
  const x = o.x;
  const y = o.y;

  ctx.save();

  ctx.fillStyle = "#050507";
  ctx.beginPath();
  ctx.moveTo(x + 17, y + 18);
  ctx.quadraticCurveTo(x - 2, y - 1, x - 1, y + 14);
  ctx.quadraticCurveTo(x + 2, y + 28, x + 16, y + 29);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + 23, y + 18);
  ctx.quadraticCurveTo(x + 42, y - 1, x + 41, y + 14);
  ctx.quadraticCurveTo(x + 38, y + 28, x + 24, y + 29);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#08080a";
  ctx.beginPath();
  ctx.moveTo(x + 13, y + 18);
  ctx.lineTo(x + 27, y + 18);
  ctx.lineTo(x + 33, y + 43);
  ctx.lineTo(x + 7, y + 43);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#020203";
  ctx.beginPath();
  ctx.arc(x + 20, y + 12, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#c51e39";
  ctx.fillRect(x + 15, y + 11, 3, 2);
  ctx.fillRect(x + 22, y + 11, 3, 2);

  ctx.restore();
}

function drawSnake(o) {
  const x = o.x;
  const y = o.y;
  const wiggle = Math.sin(distance * 0.12 + o.phase) * 3;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#315d35";
  ctx.lineWidth = 11;

  ctx.beginPath();
  ctx.moveTo(x + 2, y + 19);
  ctx.bezierCurveTo(
    x + 10, y + 1 + wiggle,
    x + 19, y + 29 - wiggle,
    x + 28, y + 15
  );
  ctx.bezierCurveTo(
    x + 36, y + 2 + wiggle,
    x + 42, y + 25,
    x + 49, y + 10
  );
  ctx.stroke();

  ctx.strokeStyle = "#72a94e";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + 3, y + 17);
  ctx.bezierCurveTo(
    x + 11, y + 3 + wiggle,
    x + 19, y + 26 - wiggle,
    x + 28, y + 14
  );
  ctx.bezierCurveTo(
    x + 36, y + 5 + wiggle,
    x + 42, y + 22,
    x + 48, y + 10
  );
  ctx.stroke();

  ctx.fillStyle = "#477d39";
  ctx.beginPath();
  ctx.ellipse(x + 47, y + 9, 7, 5, -0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f2e8bc";
  ctx.beginPath();
  ctx.arc(x + 49, y + 7, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(x + 50, y + 7, 1, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#d72c4d";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 52, y + 11);
  ctx.lineTo(x + 57, y + 13);
  ctx.lineTo(x + 59, y + 11);
  ctx.moveTo(x + 57, y + 13);
  ctx.lineTo(x + 57, y + 15);
  ctx.stroke();

  ctx.restore();
}

function drawObstacle(o) {
  ctx.save();

  if (o.type === "spike") {
    ctx.fillStyle = "#d7d7dc";
    ctx.beginPath();
    ctx.moveTo(o.x, groundY);
    ctx.lineTo(o.x + o.w / 2, o.y);
    ctx.lineTo(o.x + o.w, groundY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#777985";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (o.type === "crate") {
    ctx.fillStyle = "#70472f";
    ctx.fillRect(o.x, o.y, o.w, o.h);

    ctx.strokeStyle = "#bd9062";
    ctx.lineWidth = 3;
    ctx.strokeRect(o.x + 3, o.y + 3, o.w - 6, o.h - 6);

    ctx.beginPath();
    ctx.moveTo(o.x + 5, o.y + 5);
    ctx.lineTo(o.x + o.w - 5, o.y + o.h - 5);
    ctx.moveTo(o.x + o.w - 5, o.y + 5);
    ctx.lineTo(o.x + 5, o.y + o.h - 5);
    ctx.stroke();
  }

  if (o.type === "heart") drawHeart(o);
  if (o.type === "angel") drawAngel(o);
  if (o.type === "snake") drawSnake(o);

  ctx.restore();
}

// ======================================
// COLLISIONI E PARTICELLE
// ======================================

function collides(a, b) {
  const inset = 6;

  return (
    a.x + inset < b.x + b.w - inset &&
    a.x + a.w - inset > b.x + inset &&
    a.y + inset < b.y + b.h - inset &&
    a.y + a.h - inset > b.y + inset
  );
}

function addParticles(x, y) {
  for (let i = 0; i < 12; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 5,
      vy: (Math.random() - 0.8) * 5,
      life: 25 + Math.random() * 15
    });
  }
}

function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 0.15 * dt;
    p.life -= dt;
  }

  particles = particles.filter(p => p.life > 0);
}

function drawParticles() {
  ctx.save();

  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, p.life / 20);
    ctx.fillStyle = "#eee4d1";
    ctx.fillRect(p.x, p.y, 3, 3);
  }

  ctx.restore();
}

// ======================================
// VELOCITA PROGRESSIVA
// ======================================

function updateSpeed(dt) {
  // La velocità cresce fino al limite massimo.
  // Il traguardo di crescita è progressivo e non improvviso.
  const progress = Math.min(score / 6000, 1);

  baseSpeed =
    START_SPEED + progress * (MAX_SPEED - START_SPEED);

  // Piccole variazioni casuali, senza scatti estremi.
  speedChangeTimer += dt * 16.667;

  if (speedChangeTimer >= nextSpeedChange) {
    speedChangeTimer = 0;
    nextSpeedChange = 2500 + Math.random() * 2500;

    const stage = getDifficultyStage();
    const variation = 0.04 + stage * 0.012;

    speedFactor =
      1 + (Math.random() * 2 - 1) * variation;
  }

  // Ritorno graduale verso la velocità di base.
  speedFactor += (1 - speedFactor) * 0.004 * dt;

  speed = Math.max(
    START_SPEED * 0.9,
    Math.min(MAX_SPEED, baseSpeed * speedFactor)
  );
}

// ======================================
// SALTO E PAUSA
// ======================================

function jump() {
  if (!running || paused || !player.grounded) return;

  player.vy = player.jumpPower;
  player.grounded = false;
}

function togglePause() {
  if (running && !paused) {
    paused = true;
    running = false;

    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    messageElement.textContent =
      "Partita in pausa. Premi RIPRENDI per continuare.";

    updatePauseButton();
    drawGame();
    return;
  }

  if (paused) {
    paused = false;
    running = true;
    lastTime = 0;

    messageElement.textContent = "Si riparte, Lupetto!";
    updatePauseButton();
    animationId = requestAnimationFrame(gameLoop);
  }
}

function startGame() {
  if (running || paused) return;

  running = true;
  gameOver = false;
  lastTime = 0;

  distance = 0;
  score = 0;
  finalScore = 0;

  speed = START_SPEED;
  baseSpeed = START_SPEED;
  speedFactor = 1;
  speedChangeTimer = 0;
  nextSpeedChange = 3000;

  spawnDistance = 0;
  nextSpawnDistance = 430;

  obstacles = [];
  particles = [];

  pointerIsDown = false;
  pointerMoved = false;

  player.y = groundY - player.h;
  player.vy = 0;
  player.grounded = true;

  messageElement.textContent =
    "Corri, Lupetto! Premi SPAZIO, ↑, W oppure SALTA.";

  updateScoreboard();
  updatePauseButton();

  animationId = requestAnimationFrame(gameLoop);
}

if (startButton) {
  startButton.addEventListener("click", startGame);
}

if (jumpButton) {
  jumpButton.addEventListener("click", jump);
}

if (pauseButton) {
  pauseButton.addEventListener("click", togglePause);
}

// ======================================
// CONTROLLI TASTIERA
// ======================================

document.addEventListener("keydown", event => {
  if (!["Space", "ArrowUp", "KeyW"].includes(event.code)) return;

  if (
    event.target instanceof HTMLElement &&
    (
      event.target.matches("input, textarea, button") ||
      event.target.isContentEditable
    )
  ) {
    return;
  }

  event.preventDefault();

  if (running && !paused) {
    jump();
  } else if (!running && !paused && !gameOver) {
    startGame();
  }
});

// ======================================
// CONTROLLI TOUCH DEL CANVAS
// Tocco breve = salto.
// Trascinamento = scroll, senza salto.
// ======================================

canvas.addEventListener("pointerdown", event => {
  if (!running || paused) return;

  pointerStartX = event.clientX;
  pointerStartY = event.clientY;
  pointerMoved = false;
  pointerIsDown = true;
});

canvas.addEventListener("pointermove", event => {
  if (!pointerIsDown) return;

  const dx = Math.abs(event.clientX - pointerStartX);
  const dy = Math.abs(event.clientY - pointerStartY);

  if (dx > 10 || dy > 10) {
    pointerMoved = true;
  }
});

canvas.addEventListener("pointerup", event => {
  if (!pointerIsDown) return;

  pointerIsDown = false;

  if (!running || paused || pointerMoved) return;

  const dx = Math.abs(event.clientX - pointerStartX);
  const dy = Math.abs(event.clientY - pointerStartY);

  if (dx <= 10 && dy <= 10) {
    jump();
  }
});

canvas.addEventListener("pointercancel", () => {
  pointerIsDown = false;
  pointerMoved = true;
});

canvas.addEventListener("contextmenu", event => {
  event.preventDefault();
});

// ======================================
// CICLO DI GIOCO
// ======================================

function gameLoop(timestamp) {
  if (!running || paused) return;

  if (!lastTime) lastTime = timestamp;

  const dt = Math.min((timestamp - lastTime) / 16.667, 2);
  lastTime = timestamp;

  updateGame(dt);
  drawGame();

  if (running && !paused) {
    animationId = requestAnimationFrame(gameLoop);
  }
}

function updateGame(dt) {
  updateSpeed(dt);

  distance += speed * dt;
  score = Math.floor(distance / 10);

  updateScoreboard();

  // Movimento e gravità di Lupetto.
  player.vy += player.gravity * dt;
  player.y += player.vy * dt;

  if (player.y + player.h >= groundY) {
    player.y = groundY - player.h;
    player.vy = 0;
    player.grounded = true;
  }

  // Avanza la distanza del generatore.
  spawnDistance += speed * dt;

  if (spawnDistance >= nextSpawnDistance) {
    spawnPattern();
  }

  // Aggiornamento ostacoli e movimento dell'angelo.
  for (const obstacle of obstacles) {
    obstacle.x -= speed * dt;

    if (obstacle.type === "angel") {
      obstacle.y =
        obstacle.baseY +
        Math.sin(distance * 0.035 + obstacle.phase) * 10;
    }

    if (collides(player, obstacle)) {
      endGame();
      return;
    }
  }

  obstacles = obstacles.filter(o => o.x + o.w > -10);

  updateParticles(dt);
}

// ======================================
// DISEGNO E OVERLAY
// ======================================

function drawGame() {
  drawBackground();

  for (const obstacle of obstacles) {
    drawObstacle(obstacle);
  }

  drawWolf();
  drawParticles();

  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "left";
  ctx.fillText("LUPO RUNNER", 18, 32);
  ctx.fillText("Metri: " + score, 18, 58);

  // Indicatore discreto della fase attuale.
  ctx.fillStyle = "#c5b9c0";
  ctx.font = "11px Arial";
  ctx.fillText(getStageName(), 18, 76);

  if (!running && !paused && !gameOver) {
    drawOverlay("LUPO RUNNER", "Premi INIZIA PARTITA");
  }

  if (paused) {
    drawOverlay("PAUSA", "Premi RIPRENDI per continuare");
  }

  if (gameOver) {
    drawOverlay("GAME OVER", "Distanza: " + finalScore + " m");
  }
}

function drawOverlay(title, subtitle) {
  ctx.save();

  ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "bold 32px Arial";
  ctx.fillText(title, W / 2, H / 2 - 15);

  ctx.font = "16px Arial";
  ctx.fillStyle = "#ddd";
  ctx.fillText(subtitle, W / 2, H / 2 + 22);

  ctx.restore();
}

// ======================================
// GAME OVER
// ======================================

function endGame() {
  running = false;
  paused = false;
  gameOver = true;
  finalScore = score;

  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  addParticles(
    player.x + player.w / 2,
    player.y + player.h / 2
  );

  if (finalScore > best) {
    best = finalScore;
    saveBest(best);

    messageElement.textContent =
      "NUOVO RECORD! Hai totalizzato " + finalScore + " metri!";
  } else {
    messageElement.textContent =
      "Partita terminata. Hai totalizzato " +
      finalScore + " metri. Riprova!";
  }

  updateScoreboard();
  updatePauseButton();
  drawGame();
}

// ======================================
// CLASSIFICA ONLINE
// ======================================

async function loadLeaderboard() {
  if (!leaderboardBody || !leaderboardStatus) return;

  leaderboardStatus.textContent = "Caricamento classifica...";
  leaderboardBody.replaceChildren();

  try {
    const response = await fetch(
      LEADERBOARD_API_URL + "?action=top5",
      { method: "GET", cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    const data = await response.json();

    if (data.ok === false) {
      throw new Error(data.message || "Classifica non disponibile");
    }

    const scores = Array.isArray(data.scores) ? data.scores : [];

    if (scores.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");

      cell.colSpan = 3;
      cell.textContent = "Nessun punteggio disponibile.";

      row.appendChild(cell);
      leaderboardBody.appendChild(row);
    } else {
      scores.slice(0, 5).forEach((entry, index) => {
        const row = document.createElement("tr");
        const position = document.createElement("td");
        const name = document.createElement("td");
        const points = document.createElement("td");

        position.textContent = String(index + 1);
        name.textContent = String(
          entry.nickname || entry.nome || "Lupetto"
        );
        points.textContent = String(
          Number(entry.score ?? entry.punteggio ?? 0)
        );

        row.append(position, name, points);
        leaderboardBody.appendChild(row);
      });
    }

    leaderboardStatus.textContent = "Classifica aggiornata.";
  } catch (error) {
    console.error("Errore classifica:", error);

    leaderboardStatus.textContent =
      "Classifica non disponibile. Riprova più tardi.";

    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 3;
    cell.textContent = "Errore nel caricamento della classifica.";

    row.appendChild(cell);
    leaderboardBody.appendChild(row);
  }
}

async function submitScore() {
  if (!playerNameInput || !submitScoreButton) return;

  const nickname = playerNameInput.value.trim();

  if (!nickname) {
    leaderboardStatus.textContent =
      "Inserisci il tuo nickname Instagram.";

    playerNameInput.focus();
    return;
  }

  if (!gameOver) {
    leaderboardStatus.textContent =
      "Completa una partita prima di inviare il punteggio.";
    return;
  }

  if (finalScore <= 0) {
    leaderboardStatus.textContent =
      "Il punteggio deve essere maggiore di zero.";
    return;
  }

  submitScoreButton.disabled = true;
  leaderboardStatus.textContent = "Invio punteggio...";

  try {
    const response = await fetch(LEADERBOARD_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        nickname,
        score: finalScore
      })
    });

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    const result = await response.json();

    if (result.ok === false) {
      throw new Error(result.message || "Invio non riuscito");
    }

    leaderboardStatus.textContent =
      "Punteggio inviato: " + finalScore + " metri.";

    await loadLeaderboard();
  } catch (error) {
    console.error("Errore invio punteggio:", error);

    leaderboardStatus.textContent =
      "Invio non riuscito. Verifica la pubblicazione di Apps Script.";
  } finally {
    submitScoreButton.disabled = false;
  }
}

if (submitScoreButton) {
  submitScoreButton.addEventListener("click", submitScore);
}

if (refreshBoardButton) {
  refreshBoardButton.addEventListener("click", loadLeaderboard);
}

// ======================================
// INIZIALIZZAZIONE
// ======================================

updateScoreboard();
updatePauseButton();
drawGame();
loadLeaderboard();
