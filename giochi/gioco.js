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

const START_SPEED = 4.5;
const MAX_SPEED = 8.5;

// ======================================
// STATO DEL GIOCO E DIFFICOLTÀ
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
  y: groundY - 48,
  w: 48,
  h: 48,
  vy: 0,
  gravity: 0.75,
  jumpPower: -13.5,
  grounded: true
};

function getDifficultyStage() {
  if (score < 200) return 0; // Apprendimento
  if (score < 600) return 1; // Attenzione
  if (score < 1200) return 2; // Sopravvivenza
  if (score < 2000) return 3; // Lupo Nero
  return 4; // Incubo
}

function getStageName() {
  const names = ["APPRENDIMENTO", "ATTENZIONE", "SOPRAVVIVENZA", "LUPO NERO", "INCUBO"];
  return names[getDifficultyStage()];
}

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
// DISEGNO SFONDO E LUPO DI PROFILO
// ======================================

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#090b14");
  sky.addColorStop(0.58, "#201b2b");
  sky.addColorStop(1, "#38232d");

  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Luna
  ctx.fillStyle = "#e9e3d6";
  ctx.beginPath();
  ctx.arc(320, 95, 26, 0, Math.PI * 2);
  ctx.fill();

  // Terreno
  ctx.fillStyle = "#101014";
  ctx.fillRect(0, groundY, W, H - groundY);

  ctx.fillStyle = "#8d354c";
  ctx.fillRect(0, groundY, W, 3);
}

function drawWolf() {
  const x = player.x;
  const y = player.y;

  ctx.save();
  // Ombra a terra
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x + player.w / 2, groundY + 5, player.grounded ? 24 : 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Animazione corsa basata sulla distanza
  const cycle = player.grounded ? Math.floor(distance / 14) % 4 : 1;

  // Corpo del lupo di profilo
  ctx.fillStyle = "#777b85";
  ctx.beginPath();
  ctx.roundRect(x + 4, y + 16, 36, 24, 8);
  ctx.fill();

  // Felpa / Cappuccio Ottanio
  ctx.fillStyle = "#168b87";
  ctx.beginPath();
  ctx.roundRect(x + 22, y + 8, 22, 22, [6, 14, 6, 6]);
  ctx.fill();

  // Testa e Muso
  ctx.fillStyle = "#858993";
  ctx.beginPath();
  ctx.roundRect(x + 32, y + 4, 20, 18, 6);
  ctx.fill();

  // Muso chiaro
  ctx.fillStyle = "#ded9d1";
  ctx.beginPath();
  ctx.roundRect(x + 42, y + 10, 12, 10, 3);
  ctx.fill();

  // Orecchie
  ctx.fillStyle = "#666a75";
  ctx.beginPath();
  ctx.moveTo(x + 36, y + 4);
  ctx.lineTo(x + 40, y - 4);
  ctx.lineTo(x + 44, y + 4);
  ctx.fill();

  // Zampe animate in base al ciclo di corsa
  ctx.strokeStyle = "#252630";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";

  let legOffset1 = 0;
  let legOffset2 = 0;
  if (player.grounded) {
    if (cycle === 0) { legOffset1 = -6; legOffset2 = 6; }
    else if (cycle === 1) { legOffset1 = 0; legOffset2 = 0; }
    else if (cycle === 2) { legOffset1 = 6; legOffset2 = -6; }
    else { legOffset1 = 2; legOffset2 = -2; }
  } else {
    // In salto zampe raccolte
    legOffset1 = -4;
    legOffset2 = -4;
  }

  // Zampe posteriori
  ctx.beginPath();
  ctx.moveTo(x + 12, y + 36);
  ctx.lineTo(x + 10 + legOffset1, y + 46);
  ctx.moveTo(x + 20, y + 36);
  ctx.lineTo(x + 22 + legOffset2, y + 46);
  ctx.stroke();

  // Zampe anteriori
  ctx.beginPath();
  ctx.moveTo(x + 32, y + 36);
  ctx.lineTo(x + 30 - legOffset1, y + 46);
  ctx.moveTo(x + 40, y + 36);
  ctx.lineTo(x + 38 - legOffset2, y + 46);
  ctx.stroke();

  ctx.restore();
}

// ======================================
// NEMICI E OSTACOLI
// ======================================

const OBSTACLE_SIZES = {
  spike: { w: 34, h: 34 },
  crate: { w: 36, h: 40 },
  ghost: { w: 38, h: 42 },
  snake: { w: 50, h: 26 }
};

function createObstacle() {
  const stage = getDifficultyStage();
  let availableTypes = ["spike", "crate"];
  if (stage >= 1) availableTypes.push("snake");
  if (stage >= 2) availableTypes.push("ghost");

  const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
  const size = OBSTACLE_SIZES[type];
  const yPos = type === "ghost" ? groundY - 85 : groundY - size.h;

  obstacles.push({
    type,
    x: W + 10,
    y: yPos,
    w: size.w,
    h: size.h,
    phase: Math.random() * Math.PI * 2
  });
}

function drawObstacle(o) {
  ctx.save();

  if (o.type === "spike") {
    ctx.fillStyle = "#c5c5d0";
    ctx.beginPath();
    ctx.moveTo(o.x, groundY);
    ctx.lineTo(o.x + o.w / 2, o.y);
    ctx.lineTo(o.x + o.w, groundY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 2;
    ctx.stroke();
  } 
  else if (o.type === "crate") {
    ctx.fillStyle = "#6b4423";
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = "#3e230d";
    ctx.lineWidth = 2;
    ctx.strokeRect(o.x, o.y, o.w, o.h);
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(o.x + o.w, o.y + o.h);
    ctx.moveTo(o.x + o.w, o.y);
    ctx.lineTo(o.x, o.y + o.h);
    ctx.strokeStyle = "#4e3116";
    ctx.stroke();
  } 
  else if (o.type === "snake") {
    const wave = Math.sin(distance * 0.15 + o.phase) * 4;
    ctx.fillStyle = "#3b7a35";
    ctx.beginPath();
    ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2 + wave, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff3333";
    ctx.fillRect(o.x + o.w - 10, o.y + 6 + wave, 3, 3);
  } 
  else if (o.type === "ghost") {
    const floatY = Math.sin(distance * 0.1 + o.phase) * 6;
    ctx.fillStyle = "rgba(120, 200, 255, 0.85)";
    ctx.beginPath();
    ctx.arc(o.x + o.w / 2, o.y + 16 + floatY, 16, Math.PI, 0, false);
    ctx.lineTo(o.x + o.w, o.y + o.h + floatY);
    ctx.lineTo(o.x, o.y + o.h + floatY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#090b14";
    ctx.beginPath();
    ctx.arc(o.x + 12, o.y + 14 + floatY, 3, 0, Math.PI * 2);
    ctx.arc(o.x + 26, o.y + 14 + floatY, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
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
  nextSpawnDistance = 380;

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

if (startButton) startButton.addEventListener("click", startGame);
if (jumpButton) jumpButton.addEventListener("click", jump);
if (pauseButton) pauseButton.addEventListener("click", togglePause);

document.addEventListener("keydown", event => {
  if (!["Space", "ArrowUp", "KeyW"].includes(event.code)) return;
  event.preventDefault();
  if (running && !paused) {
    jump();
  } else if (!running && !paused) {
    startGame();
  }
});

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

  speed = Math.min(MAX_SPEED, START_SPEED + (score / 1500) * (MAX_SPEED - START_SPEED));

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
    createObstacle();
    spawnDistance = 0;
    const stage = getDifficultyStage();
    const minGap = Math.max(220, 360 - stage * 30);
    nextSpawnDistance = minGap + Math.random() * 180;
  }

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
    drawObstacle(o);
  }

  drawWolf();

  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px Arial";
  ctx.fillText("METRI: " + score, 18, 32);

  ctx.fillStyle = "#c5b9c0";
  ctx.font = "11px Arial";
  ctx.fillText("FASE: " + getStageName(), 18, 52);

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

// ======================================
// INIZIALIZZAZIONE IMMEDIATA (ANTI SCHERMO NERO)
// ======================================
drawBackground();
drawWolf();
loadLeaderboard();
