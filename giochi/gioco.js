"use strict";

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

// ======================================
// SPRITE DEL LUPO DI PROFILO
// ======================================

const wolfImage = new Image();

const wolfFrames = [
  {
    back: "M36 62 L26 72 L17 83 L12 88 L29 90 L43 75 L49 65",
    front: "M54 63 L65 73 L76 79 L87 83 L83 89 L72 87 L59 78",
    arm: "M56 44 L66 51 L77 57"
  },
  {
    back: "M37 63 L31 74 L36 84 L47 88 L51 84 L43 75 L46 65",
    front: "M55 64 L63 74 L61 83 L70 89 L81 88 L77 82 L67 75",
    arm: "M56 44 L63 53 L70 60"
  },
  {
    back: "M37 63 L28 73 L17 77 L10 84 L14 89 L28 87 L42 75 L48 65",
    front: "M54 63 L64 73 L77 74 L87 81 L84 87 L71 84 L58 77",
    arm: "M56 44 L66 48 L76 53"
  },
  {
    back: "M37 63 L43 73 L50 82 L47 89 L35 87 L28 76 L31 66",
    front: "M55 63 L57 75 L68 84 L80 87 L84 83 L70 76 L65 65",
    arm: "M56 44 L63 51 L73 54"
  }
];

function buildWolfSprite() {
  const frames = wolfFrames.map((frame, index) => `
    <g transform="translate(${index * 100},0)">
      <path d="M40 53 Q28 47 20 52 Q10 57 15 65 Q22 70 39 61" fill="#555963" stroke="#252630" stroke-width="3" stroke-linejoin="round" />
      <path d="M17 60 Q24 63 32 59" fill="none" stroke="#a6a7ae" stroke-width="2" stroke-linecap="round" />
      <path d="${frame.back}" fill="#777b85" stroke="#252630" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
      <path d="${frame.front}" fill="#777b85" stroke="#252630" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M11 86 L27 87 L31 92 L10 92 Z" fill="#24252d" stroke="#111218" stroke-width="2" />
      <path d="M43 86 L51 86 L55 91 L40 92 Z" fill="#24252d" stroke="#111218" stroke-width="2" />
      <path d="M67 85 L81 86 L85 91 L66 92 Z" fill="#24252d" stroke="#111218" stroke-width="2" />
      <path d="M36 42 Q44 38 55 42 L64 62 Q58 69 40 65 L33 52 Z" fill="#eee5d7" stroke="#252630" stroke-width="3" stroke-linejoin="round" />
      <path d="M39 50 L44 55 L41 61 M52 48 L56 54" fill="none" stroke="#c9bdad" stroke-width="1.5" stroke-linecap="round" />
      <path d="${frame.arm}" fill="none" stroke="#252630" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
      <path d="${frame.arm}" fill="none" stroke="#eee5d7" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="77" cy="58" r="5" fill="#777b85" stroke="#252630" stroke-width="2" />
      <path d="M35 43 Q27 36 32 29 Q37 23 47 28 L57 41 L49 48 Z" fill="#168b87" stroke="#252630" stroke-width="3" stroke-linejoin="round" />
      <path d="M34 31 Q38 26 44 30 L51 41 L44 43 Z" fill="#0d5556" />
      <path d="M38 35 L32 18 L43 25 Q49 18 58 25 L67 31 L80 35 L88 40 L84 44 L75 46 L66 45 Q58 52 47 45 L39 42 Z" fill="#858993" stroke="#252630" stroke-width="3" stroke-linejoin="round" />
      <path d="M35 26 L32 18 L42 25 L42 30 Z" fill="#666a75" stroke="#252630" stroke-width="2" stroke-linejoin="round" />
      <path d="M36 24 L35 22 L39 26" fill="none" stroke="#d7a5a5" stroke-width="1.5" stroke-linecap="round" />
      <path d="M67 36 L82 37 L88 40 L83 44 L69 44 L64 41 Z" fill="#ded9d1" stroke="#252630" stroke-width="2" stroke-linejoin="round" />
      <path d="M84 37 L90 40 L86 44 L81 41 Z" fill="#17171c" />
      <path d="M58 33 Q63 30 68 33" fill="none" stroke="#17171c" stroke-width="2.5" stroke-linecap="round" />
      <circle cx="65" cy="33" r="1.2" fill="#f5eee6"/>
      <path d="M58 29 L67 30" fill="none" stroke="#353640" stroke-width="2.5" stroke-linecap="round" />
      <path d="M73 42 L80 42" fill="none" stroke="#55545a" stroke-width="1.5" stroke-linecap="round" />
      <path d="M47 45 L46 52 M52 45 L53 51" fill="none" stroke="#168b87" stroke-width="2" stroke-linecap="round" />
    </g>
  `).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100" viewBox="0 0 400 100">${frames}</svg>`;

  wolfImage.onload = () => {
    drawGame(); // Disegna subito il gioco appena l'immagine è pronta
  };
  wolfImage.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

buildWolfSprite();

// ======================================
// STATO DEL GIOCO
// ======================================

let running = false;
let paused = false;
let gameOver = false;
let animationId = null;
let lastTime = 0;

let distance = 0;
let score = 0;
let finalScore = 0;
let speed = START_SPEED;

let obstacles = [];
let spawnDistance = 0;
let nextSpawnDistance = 400;

let best = Number(localStorage.getItem(BEST_KEY)) || 0;

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
// DISEGNO
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

  ctx.fillStyle = "#101014";
  ctx.fillRect(0, groundY, W, H - groundY);

  ctx.fillStyle = "#8d354c";
  ctx.fillRect(0, groundY, W, 3);
}

function drawWolf() {
  const x = player.x;
  const y = player.y;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x + player.w / 2, groundY + 5, player.grounded ? 25 : 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (wolfImage.complete && wolfImage.naturalWidth > 0) {
    const frameWidth = 100;
    const frameHeight = 100;
    const frame = player.grounded ? Math.floor(distance / 12) % wolfFrames.length : 1;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(wolfImage, frame * frameWidth, 0, frameWidth, frameHeight, x - 12, y + player.h - 66 + 4, 66, 66);
  }
  ctx.restore();
}

// ======================================
// OSTACOLI
// ======================================

const OBSTACLE_SIZES = {
  spike: { w: 35, h: 35 },
  crate: { w: 35, h: 38 },
  heart: { w: 36, h: 36 }
};

function createObstacle() {
  const types = ["spike", "crate", "heart"];
  const type = types[Math.floor(Math.random() * types.length)];
  const size = OBSTACLE_SIZES[type];

  obstacles.push({
    type,
    x: W + 10,
    y: groundY - size.h,
    w: size.w,
    h: size.h
  });
}

function collides(a, b) {
  const inset = 6;
  return (
    a.x + inset < b.x + b.w - inset &&
    a.x + a.w - inset > b.x + inset &&
    a.y + inset < b.y + b.h - inset &&
    a.y + a.h - inset > b.y + inset
  );
}

// ======================================
// CONTROLLI E AVVIO
// ======================================

function jump() {
  if (!running || paused || !player.grounded) return;
  player.vy = player.jumpPower;
  player.grounded = false;
}

function startGame() {
  if (running) return;

  running = true;
  paused = false;
  gameOver = false;
  lastTime = 0;

  distance = 0;
  score = 0;
  finalScore = 0;
  speed = START_SPEED;

  obstacles = [];
  spawnDistance = 0;
  nextSpawnDistance = 350;

  player.y = groundY - player.h;
  player.vy = 0;
  player.grounded = true;

  if (messageElement) messageElement.textContent = "Corri, Lupetto!";

  updateScoreboard();
  updatePauseButton();

  if (animationId) cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(gameLoop);
}

function togglePause() {
  if (!running && !paused) return;
  paused = !paused;
  updatePauseButton();

  if (paused) {
    if (animationId) cancelAnimationFrame(animationId);
    drawGame();
  } else {
    lastTime = 0;
    animationId = requestAnimationFrame(gameLoop);
  }
}

// Eventi pulsanti
if (startButton) startButton.addEventListener("click", startGame);
if (jumpButton) jumpButton.addEventListener("click", jump);
if (pauseButton) pauseButton.addEventListener("click", togglePause);

// Eventi tastiera
document.addEventListener("keydown", event => {
  if (!["Space", "ArrowUp", "KeyW"].includes(event.code)) return;
  event.preventDefault();
  if (running && !paused) {
    jump();
  } else if (!running && !paused) {
    startGame();
  }
});

// Eventi touch / click sul canvas (perfetto per cellulare)
canvas.addEventListener("click", () => {
  if (!running && !paused) {
    startGame();
  } else if (running && !paused) {
    jump();
  }
});

// ======================================
// LOOP PRINCIPALE
// ======================================

function gameLoop(timestamp) {
  if (!running || paused) return;

  if (!lastTime) lastTime = timestamp;
  const dt = Math.min((timestamp - lastTime) / 16.667, 2);
  lastTime = timestamp;

  // Aggiornamento logica
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

  // Generazione ostacoli
  spawnDistance += speed * dt;
  if (spawnDistance >= nextSpawnDistance) {
    createObstacle();
    spawnDistance = 0;
    nextSpawnDistance = 300 + Math.random() * 250;
  }

  // Movimento ostacoli e collisioni
  for (const o of obstacles) {
    o.x -= speed * dt;
    if (collides(player, o)) {
      endGame();
      return;
    }
  }
  obstacles = obstacles.filter(o => o.x + o.w > -10);

  drawGame();
  animationId = requestAnimationFrame(gameLoop);
}

function drawGame() {
  drawBackground();

  for (const o of obstacles) {
    ctx.fillStyle = o.type === "heart" ? "#d72c4d" : "#d7d7dc";
    ctx.fillRect(o.x, o.y, o.w, o.h);
  }

  drawWolf();

  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px Arial";
  ctx.fillText("METRI: " + score, 18, 32);

  if (!running && !paused && !gameOver) {
    drawOverlay("LUPO RUNNER", "Tocca o premi INIZIA PARTITA");
  } else if (paused) {
    drawOverlay("PAUSA", "Premi RIPRENDI");
  } else if (gameOver) {
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

function endGame() {
  running = false;
  paused = false;
  gameOver = true;
  finalScore = score;

  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  if (finalScore > best) {
    best = finalScore;
    localStorage.setItem(BEST_KEY, String(best));
  }

  updateScoreboard();
  updatePauseButton();
  drawGame();
}

// Caricamento iniziale classifica
async function loadLeaderboard() {
  if (!leaderboardBody || !leaderboardStatus) return;
  leaderboardStatus.textContent = "Caricamento classifica...";
  try {
    const response = await fetch(LEADERBOARD_API_URL + "?action=top5", { method: "GET", cache: "no-store" });
    const data = await response.json();
    leaderboardBody.replaceChildren();
    
    (data.scores || []).slice(0, 5).forEach((entry, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${index + 1}</td><td>${entry.nickname || "Lupetto"}</td><td>${entry.score || 0}</td>`;
      leaderboardBody.appendChild(row);
    });
    leaderboardStatus.textContent = "Classifica aggiornata.";
  } catch (error) {
    leaderboardStatus.textContent = "Classifica non disponibile.";
  }
}

if (submitScoreButton) {
  submitScoreButton.addEventListener("click", async () => {
    const nickname = playerNameInput.value.trim();
    if (!nickname) {
      leaderboardStatus.textContent = "Inserisci il tuo nickname.";
      return;
    }
    submitScoreButton.disabled = true;
    leaderboardStatus.textContent = "Invio punteggio...";

    try {
      await fetch(LEADERBOARD_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ nickname, score: finalScore })
      });
      leaderboardStatus.textContent = "Punteggio inviato!";
      await loadLeaderboard();
    } catch (error) {
      leaderboardStatus.textContent = "Invio non riuscito.";
    } finally {
      submitScoreButton.disabled = false;
    }
  });
}

if (refreshBoardButton) refreshBoardButton.addEventListener("click", loadLeaderboard);

// Disegno iniziale per mostrare il lupetto fin da subito
drawBackground();
drawWolf();
loadLeaderboard();
