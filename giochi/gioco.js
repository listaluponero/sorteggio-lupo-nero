
"use strict";

// ======================================
// LUPO GAMES - LUPO RUNNER: MODALITA INCUBO
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
const MIN_COMBO_GAP = 305;

const ANGEL_MIN_HEIGHT = 100;
const ANGEL_MAX_HEIGHT = 150;
const ANGEL_FLOAT_AMPLITUDE = 3;

// ======================================
// LUPO DI PROFILO - SPRITE ANIMATO
// Disegnato direttamente tramite SVG e JavaScript.
// Non richiede immagini esterne.
// ======================================

const wolfImage = new Image();

const wolfFrames = [
  // Frame 1: falcata distesa
  {
    back: "M36 62 L26 72 L17 83 L12 88 L29 90 L43 75 L49 65",
    front: "M54 63 L65 73 L76 79 L87 83 L83 89 L72 87 L59 78",
    arm: "M56 44 L66 51 L77 57"
  },

  // Frame 2: zampe raccolte
  {
    back: "M37 63 L31 74 L36 84 L47 88 L51 84 L43 75 L46 65",
    front: "M55 64 L63 74 L61 83 L70 89 L81 88 L77 82 L67 75",
    arm: "M56 44 L63 53 L70 60"
  },

  // Frame 3: falcata opposta
  {
    back: "M37 63 L28 73 L17 77 L10 84 L14 89 L28 87 L42 75 L48 65",
    front: "M54 63 L64 73 L77 74 L87 81 L84 87 L71 84 L58 77",
    arm: "M56 44 L66 48 L76 53"
  },

  // Frame 4: fase di spinta
  {
    back: "M37 63 L43 73 L50 82 L47 89 L35 87 L28 76 L31 66",
    front: "M55 63 L57 75 L68 84 L80 87 L84 83 L70 76 L65 65",
    arm: "M56 44 L63 51 L73 54"
  }
];

function buildWolfSprite() {
  const frames = wolfFrames.map((frame, index) => `
    <g transform="translate(${index * 100},0)">

      <!-- CODA FOLTA -->
      <path
        d="M40 53 Q28 47 20 52 Q10 57 15 65
           Q22 70 39 61"
        fill="#555963"
        stroke="#252630"
        stroke-width="3"
        stroke-linejoin="round"
      />

      <path
        d="M17 60 Q24 63 32 59"
        fill="none"
        stroke="#a6a7ae"
        stroke-width="2"
        stroke-linecap="round"
      />

      <!-- GAMBE -->
      <path
        d="${frame.back}"
        fill="#777b85"
        stroke="#252630"
        stroke-width="3"
        stroke-linejoin="round"
        stroke-linecap="round"
      />

      <path
        d="${frame.front}"
        fill="#777b85"
        stroke="#252630"
        stroke-width="3"
        stroke-linejoin="round"
        stroke-linecap="round"
      />

      <!-- SCARPE -->
      <path
        d="M11 86 L27 87 L31 92 L10 92 Z"
        fill="#24252d"
        stroke="#111218"
        stroke-width="2"
      />

      <path
        d="M43 86 L51 86 L55 91 L40 92 Z"
        fill="#24252d"
        stroke="#111218"
        stroke-width="2"
      />

      <path
        d="M67 85 L81 86 L85 91 L66 92 Z"
        fill="#24252d"
        stroke="#111218"
        stroke-width="2"
      />

      <!-- CORPO E FELPA PANNA -->
      <path
        d="M36 42
           Q44 38 55 42
           L64 62
           Q58 69 40 65
           L33 52 Z"
        fill="#eee5d7"
        stroke="#252630"
        stroke-width="3"
        stroke-linejoin="round"
      />

      <!-- PIEGHE FELPA -->
      <path
        d="M39 50 L44 55 L41 61
           M52 48 L56 54"
        fill="none"
        stroke="#c9bdad"
        stroke-width="1.5"
        stroke-linecap="round"
      />

      <!-- BRACCIO -->
      <path
        d="${frame.arm}"
        fill="none"
        stroke="#252630"
        stroke-width="12"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <path
        d="${frame.arm}"
        fill="none"
        stroke="#eee5d7"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- MANO -->
      <circle
        cx="77"
        cy="58"
        r="5"
        fill="#777b85"
        stroke="#252630"
        stroke-width="2"
      />

      <!-- CAPPUCCIO OTTANIO -->
      <path
        d="M35 43
           Q27 36 32 29
           Q37 23 47 28
           L57 41
           L49 48 Z"
        fill="#168b87"
        stroke="#252630"
        stroke-width="3"
        stroke-linejoin="round"
      />

      <!-- INTERNO CAPPUCCIO -->
      <path
        d="M34 31
           Q38 26 44 30
           L51 41
           L44 43 Z"
        fill="#0d5556"
      />

      <!-- TESTA DI PROFILO -->
      <path
        d="M38 35
           L32 18
           L43 25
           Q49 18 58 25
           L67 31
           L80 35
           L88 40
           L84 44
           L75 46
           L66 45
           Q58 52 47 45
           L39 42 Z"
        fill="#858993"
        stroke="#252630"
        stroke-width="3"
        stroke-linejoin="round"
      />

      <!-- ORECCHIO -->
      <path
        d="M35 26 L32 18 L42 25 L42 30 Z"
        fill="#666a75"
        stroke="#252630"
        stroke-width="2"
        stroke-linejoin="round"
      />

      <path
        d="M36 24 L35 22 L39 26"
        fill="none"
        stroke="#d7a5a5"
        stroke-width="1.5"
        stroke-linecap="round"
      />

      <!-- MUSETTO -->
      <path
        d="M67 36
           L82 37
           L88 40
           L83 44
           L69 44
           L64 41 Z"
        fill="#ded9d1"
        stroke="#252630"
        stroke-width="2"
        stroke-linejoin="round"
      />

      <!-- NASO -->
      <path
        d="M84 37 L90 40 L86 44 L81 41 Z"
        fill="#17171c"
      />

      <!-- OCCHIO -->
      <path
        d="M58 33 Q63 30 68 33"
        fill="none"
        stroke="#17171c"
        stroke-width="2.5"
        stroke-linecap="round"
      />

      <circle cx="65" cy="33" r="1.2" fill="#f5eee6"/>

      <!-- SOPRACCIGLIO -->
      <path
        d="M58 29 L67 30"
        fill="none"
        stroke="#353640"
        stroke-width="2.5"
        stroke-linecap="round"
      />

      <!-- BOCCA -->
      <path
        d="M73 42 L80 42"
        fill="none"
        stroke="#55545a"
        stroke-width="1.5"
        stroke-linecap="round"
      />

      <!-- LACCI FELPA -->
      <path
        d="M47 45 L46 52 M52 45 L53 51"
        fill="none"
        stroke="#168b87"
        stroke-width="2"
        stroke-linecap="round"
      />

    </g>
  `).join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg"
         width="400"
         height="100"
         viewBox="0 0 400 100">
      ${frames}
    </svg>
  `;

  wolfImage.onload = () => {
    drawGame();
  };

  wolfImage.src =
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(svg);
}

buildWolfSprite();

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
let nextSpeedChange = 2200;

let spawnDistance = 0;
let nextSpawnDistance = 400;

let obstacles = [];
let particles = [];

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
// DIFFICOLTA
// ======================================

function getDifficultyStage() {
  if (score < 300) return 0;
  if (score < 800) return 1;
  if (score < 1600) return 2;
  if (score < 2800) return 3;
  return 4;
}

function getStageName() {
  const names = [
    "APPRENDIMENTO",
    "ATTENZIONE",
    "SOPRAVVIVENZA",
    "LUPO NERO",
    "INCUBO"
  ];

  return names[getDifficultyStage()];
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
// DISEGNO LUPO
// Profilo verso destra, 4 fotogrammi.
// ======================================

function drawWolf() {
  const x = player.x;
  const y = player.y;

  ctx.save();

  // Ombra sotto il personaggio.
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(
    x + player.w / 2,
    groundY + 5,
    player.grounded ? 25 : 16,
    5,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  if (wolfImage.complete && wolfImage.naturalWidth > 0) {
    const frameWidth = 100;
    const frameHeight = 100;

    // Cambia posa durante la corsa.
    // In salto mantiene una posa raccolta.
    const frame = player.grounded
      ? Math.floor(distance / 12) % wolfFrames.length
      : 1;

    const drawW = 66;
    const drawH = 66;

    ctx.imageSmoothingEnabled = true;

    ctx.drawImage(
      wolfImage,
      frame * frameWidth,
      0,
      frameWidth,
      frameHeight,
      x - 12,
      y + player.h - drawH + 4,
      drawW,
      drawH
    );
  }

  ctx.restore();
}

// ======================================
// GENERATORE OSTACOLI
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

  const angelHeight = type === "angel"
    ? ANGEL_MIN_HEIGHT +
      Math.random() * (ANGEL_MAX_HEIGHT - ANGEL_MIN_HEIGHT)
    : 0;

  const baseY = type === "angel"
    ? groundY - angelHeight
    : groundY - size.h;

  obstacles.push({
    type,
    x: W + 10 + offset,
    y: baseY,
    baseY,
    w: size.w,
    h: size.h,
    angelHeight,
    phase: Math.random() * Math.PI * 2
  });
}

function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function choosePattern() {
  const stage = getDifficultyStage();

  const groundTypes = ["spike", "crate", "heart", "snake"];
  const allTypes = ["spike", "crate", "heart", "angel", "snake"];

  if (stage === 0) {
    return {
      types: [pickRandom(["spike", "crate", "heart"])],
      gap: 0
    };
  }

  const comboChance = [0, 0.42, 0.62, 0.76, 0.84][stage];

  if (Math.random() < comboChance) {
    const first = pickRandom(groundTypes);
    let second = pickRandom(groundTypes);

    if (Math.random() < 0.65 && second === first) {
      second = pickRandom(
        groundTypes.filter(type => type !== first)
      );
    }

    const gapVariation = [0, 20, 35, 45, 55][stage];
    const gap = MIN_COMBO_GAP + Math.random() * gapVariation;

    return {
      types: [first, second],
      gap
    };
  }

  return {
    types: [pickRandom(allTypes)],
    gap: 0
  };
}

function spawnPattern() {
  const pattern = choosePattern();

  pattern.types.forEach((type, index) => {
    createObstacle(
      type,
      index === 0 ? 0 : pattern.gap
    );
  });

  const stage = getDifficultyStage();

  const rests = [
    [620, 850],
    [440, 610],
    [380, 530],
    [340, 470],
    [320, 440]
  ];

  const [minRest, maxRest] = rests[stage];

  const lastType = pattern.types[pattern.types.length - 1];

  const patternSpan = pattern.types.length > 1
    ? pattern.gap + OBSTACLE_SIZES[lastType].w
    : OBSTACLE_SIZES[lastType].w;

  nextSpawnDistance =
    spawnDistance +
    patternSpan +
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

  ctx.strokeStyle = "rgba(197, 30, 57, 0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x + 20, y + 5, 12, 3, 0, 0, Math.PI * 2);
  ctx.stroke();

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
// VELOCITA
// ======================================

function updateSpeed(dt) {
  const progress = Math.min(score / 3000, 1);

  baseSpeed =
    START_SPEED + progress * (MAX_SPEED - START_SPEED);

  speedChangeTimer += dt * 16.667;

  if (speedChangeTimer >= nextSpeedChange) {
    speedChangeTimer = 0;
    nextSpeedChange = 1800 + Math.random() * 1600;

    const stage = getDifficultyStage();
    const variation = 0.04 + stage * 0.012;

    speedFactor =
      1 + (Math.random() * 2 - 1) * variation;
  }

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

    if (messageElement) {
      messageElement.textContent =
        "Partita in pausa. Premi RIPRENDI per continuare.";
    }

    updatePauseButton();
    drawGame();
    return;
  }

  if (paused) {
    paused = false;
    running = true;
    lastTime = 0;

    if (messageElement) {
      messageElement.textContent = "Si riparte, Lupetto!";
    }

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
  nextSpeedChange = 2200;

  spawnDistance = 0;
  nextSpawnDistance = 400;

  obstacles = [];
  particles = [];

  pointerIsDown = false;
  pointerMoved = false;

  player.y = groundY - player.h;
  player.vy = 0;
  player.grounded = true;

  if (messageElement) {
    messageElement.textContent =
      "Corri, Lupetto! Premi SPAZIO, ↑, W oppure SALTA.";
  }

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

  player.vy += player.gravity * dt;
  player.y += player.vy * dt;

  if (player.y + player.h >= groundY) {
    player.y = groundY - player.h;
    player.vy = 0;
    player.grounded = true;
  }

  spawnDistance += speed * dt;

  if (spawnDistance >= nextSpawnDistance) {
    spawnPattern();
  }

  for (const obstacle of obstacles) {
    obstacle.x -= speed * dt;

    if (obstacle.type === "angel") {
      const wave =
        Math.sin(distance * 0.018 + obstacle.phase);

      const heightRange = ANGEL_MAX_HEIGHT - ANGEL_MIN_HEIGHT;

      const currentHeight =
        ANGEL_MIN_HEIGHT +
        ((wave + 1) / 2) * heightRange;

      obstacle.y =
        groundY -
        currentHeight +
        Math.sin(distance * 0.035 + obstacle.phase) *
        ANGEL_FLOAT_AMPLITUDE;

      obstacle.y = Math.max(
        groundY - ANGEL_MAX_HEIGHT - ANGEL_FLOAT_AMPLITUDE,
        Math.min(
          groundY - ANGEL_MIN_HEIGHT + ANGEL_FLOAT_AMPLITUDE,
          obstacle.y
        )
      );
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

    if (messageElement) {
      messageElement.textContent =
        "NUOVO RECORD! Hai totalizzato " + finalScore + " metri!";
    }
  } else if (messageElement) {
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

