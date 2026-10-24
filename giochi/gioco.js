"use strict";

/* =========================================================
    LUPO RUNNER — LISTA LUPO NERO
    Avvio, salto, pausa, fullscreen, ostacoli, record e classifica.
========================================================= */

const LEADERBOARD_API_URL =
  "https://script.google.com/macros/s/AKfycbxJgp0aOu-zdvidw2ktjx2PiT3SLC7CQWycYAzEEfggzl_1bEE1zfdYAPsXuHg1hoYO/exec";

const $ = (id) => document.getElementById(id);

const canvas = $("gameCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;
const loadingScreen = $("loadingScreen");
const fullscreenGame = $("fullscreenGame");
const canvasWrapper = $("canvasWrapper");

const startButton = $("startGame");
const jumpButton = $("jumpGame");
const pauseButton = $("pauseGame");
const fullscreenButton = $("fullscreenBtn");
const refreshBoardButton = $("refreshBoard");

const scoreElement = $("score");
const bestElement = $("personalBest");
const leaderboardBody = $("leaderboardBody");
const leaderboardStatus = $("leaderboardStatus");
const gameMessage = $("gameMessage");

const W = 800;
const H = 400;
const GROUND = 320;
const BEST_KEY = "lupo_runner_best";
const LOCAL_BOARD_KEY = "lupoRunnerLeaderboard";
const MODEL_PATH = "../assets/modelli/modello_gioco_corsa/";
const MAX_DELTA = 34;

if (!canvas || !ctx) {
  if (loadingScreen) loadingScreen.classList.add("hidden");
  throw new Error("Lupo Runner: canvas di gioco non trovato. Controlla l'ID gameCanvas in index.html.");
}

canvas.width = W;
canvas.height = H;

let running = false;
let paused = false;
let dead = false;
let animationId = 0;
let lastTime = 0;
let worldTime = 0;
let score = 0;
let speed = 4.5;
let spawnTimer = 0;
let nextSpawn = 100;
let obstacles = [];
let projectiles = [];
let personalBest = readBest();
let submittingScore = false;
let fallbackFullscreen = false;
let previousBodyOverflow = "";
let lastBoardRequest = 0;
let frame = 0;

if (bestElement) bestElement.textContent = String(personalBest);

function loadImage(src) {
  const image = new Image();
  image.src = src;
  image.addEventListener("load", function () {
    if (!running) drawScene();
  });
  return image;
}

const images = {
  wolf1: loadImage(MODEL_PATH + "lupo_run1.png"),
  wolf2: loadImage(MODEL_PATH + "lupo_run2.png"),
  sheep: loadImage(MODEL_PATH + "pecora.png"),
  angel: loadImage(MODEL_PATH + "angelo.png"),
  snake: loadImage(MODEL_PATH + "serpente.png")
};

function imageReady(image) {
  return Boolean(image && image.complete && image.naturalWidth > 0);
}

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch (_) {
    return 0;
  }
}

function saveBest(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch (_) {}
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function roundedRect(x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);

  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }

  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function drawText(text, x, y, size, color, align) {
  ctx.font = "bold " + size + "px Arial";
  ctx.textAlign = align || "left";
  ctx.fillStyle = color;
  ctx.fillText(String(text), x, y);
}

function stageName() {
  if (score < 300) return "APPRENDIMENTO";
  if (score < 800) return "ATTENZIONE";
  if (score < 1600) return "SOPRAVVIVENZA";
  if (score < 2800) return "LUPO NERO";
  return "INCUBO";
}

/* LUPO */

const player = {
  x: 68,
  y: GROUND - 65,
  w: 92,
  h: 65,
  vy: 0,
  gravity: 0.8,
  jumpPower: -14,
  isJumping: false,
  animation: 0,

  reset() {
    this.x = 68;
    this.y = GROUND - this.h;
    this.vy = 0;
    this.isJumping = false;
    this.animation = 0;
  },

  jump() {
    if (!running || paused || dead || this.isJumping) return;
    this.vy = this.jumpPower;
    this.isJumping = true;
  },

  update(dt) {
    const factor = dt / 16.667;
    this.animation += factor;

    if (this.isJumping) {
      this.y += this.vy * factor;
      this.vy += this.gravity * factor;

      if (this.y >= GROUND - this.h) {
        this.y = GROUND - this.h;
        this.vy = 0;
        this.isJumping = false;
      }
    }
  },

  draw() {
    const image = Math.floor(this.animation / 7) % 2 === 0
      ? images.wolf1
      : images.wolf2;

    if (imageReady(image)) {
      ctx.drawImage(image, this.x, this.y, this.w, this.h);
      return;
    }

    this.drawFallback();
  },

  drawFallback() {
    const x = this.x;
    const y = this.y;
    const swing = !this.isJumping && running && !paused
      ? Math.sin(this.animation * 0.65) * 5
      : 0;

    ctx.save();
    ctx.fillStyle = "#0008";
    ctx.beginPath();
    ctx.ellipse(x + 47, GROUND + 3, 47, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
};

/* AMBIENTE */

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#10191c");
  sky.addColorStop(0.68, "#172725");
  sky.addColorStop(1, "#0b1112");

  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#dce7df";
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(680, 65, 23, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  for (let i = 0; i < 28; i++) {
    const x = (i * 137 + 37) % W;
    const y = (i * 43 + 19) % 150;

    ctx.fillStyle = "#c2d8d3";
    ctx.globalAlpha = 0.3 + ((i % 3) * 0.2);
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.globalAlpha = 1;

  const offset = (worldTime * speed * 0.18) % 110;

  for (let x = -110; x < W + 110; x += 110) {
    const px = x - offset;

    ctx.fillStyle = "#101d1d";
    ctx.beginPath();
    ctx.moveTo(px, GROUND);
    ctx.lineTo(px + 34, 170);
    ctx.lineTo(px + 65, GROUND);
    ctx.fill();
  }

  ctx.fillStyle = "#111a19";
  ctx.fillRect(0, GROUND, W, H - GROUND);

  ctx.strokeStyle = "#168b87";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  ctx.lineTo(W, GROUND);
  ctx.stroke();

  drawText(stageName(), W - 18, 28, 12, "#65cfc4", "right");
}

/* OSTACOLI */

function makeObstacle(type) {
  const obstacle = {
    type: type,
    x: W + 20,
    y: GROUND - 43,
    w: 42,
    h: 43,
    phase: random(0, Math.PI * 2),
    fired: false
  };

  if (type === "snake") {
    obstacle.w = 55;
    obstacle.h = 24;
    obstacle.y = GROUND - obstacle.h;
  } else if (type === "angel") {
    obstacle.w = 55;
    obstacle.h = 65;
    obstacle.y = GROUND - 105;
    obstacle.dips = Math.random() < 0.38;
    obstacle.dipStarted = false;
    obstacle.dipY = 0;
    obstacle.dipSpeed = random(0.45, 0.75);
  } else if (type === "crate") {
    obstacle.w = 43;
    obstacle.h = 46;
    obstacle.y = GROUND - obstacle.h;
  } else if (type === "heart") {
    obstacle.w = 40;
    obstacle.h = 40;
    obstacle.y = GROUND - obstacle.h;
  } else if (type === "sheep") {
    obstacle.w = 54;
    obstacle.h = 48;
    obstacle.y = GROUND - obstacle.h;
    obstacle.fires = Math.random() < 1 / 3;
    obstacle.fireDelay = random(30, 75);
  }

  return obstacle;
}

function spawnObstacle() {
  const pool = ["snake", "crate", "heart", "sheep", "angel"];
  const type = pool[Math.floor(Math.random() * pool.length)];
  obstacles.push(makeObstacle(type));
}

function getAngelY(o) {
  if (o.dips && o.dipStarted) {
    return o.y + o.dipY;
  }
  return o.y + Math.sin(worldTime * 0.045 + o.phase) * 7;
}

function updateAngel(o, factor) {
  if (!o.dips) return;
  if (!o.dipStarted && o.x < W * 0.72) {
    o.dipStarted = true;
    o.dipY = Math.max(0, Math.sin(worldTime * 0.045 + o.phase) * 7);
  }
  if (o.dipStarted) {
    o.dipY = Math.min(43, o.dipY + o.dipSpeed * factor);
  }
}

function drawSnake(o) {
  if (imageReady(images.snake)) {
    ctx.drawImage(images.snake, o.x, o.y, o.w, o.h);
    return;
  }
  // Fallback se l'immagine non carica
  ctx.save();
  ctx.fillStyle = "#e0c957";
  roundedRect(o.x, o.y, o.w, o.h, 8, "#e0c957");
  ctx.restore();
}

function drawCrate(o) {
  ctx.save();
  roundedRect(o.x, o.y, o.w, o.h, 5, "#b76c37", "#f2c28b");
  ctx.restore();
}

function drawHeart(o) {
  ctx.save();
  ctx.fillStyle = "#9b4be8";
  ctx.beginPath();
  ctx.arc(o.x + 20, o.y + 20, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSheep(o) {
  if (imageReady(images.sheep)) {
    ctx.drawImage(images.sheep, o.x, o.y, o.w, o.h);
    return;
  }
  ctx.save();
  ctx.fillStyle = "#e9e8e4";
  roundedRect(o.x, o.y, o.w, o.h, 10, "#e9e8e4");
  ctx.restore();
}

function drawAngel(o) {
  const y = getAngelY(o);
  if (imageReady(images.angel)) {
    ctx.drawImage(images.angel, o.x, y, o.w, o.h);
    return;
  }
  ctx.save();
  ctx.fillStyle = "#f2f0e8";
  roundedRect(o.x, y, o.w, o.h, 10, "#f2f0e8");
  ctx.restore();
}

function drawObstacles() {
  for (const o of obstacles) {
    if (o.type === "snake") drawSnake(o);
    if (o.type === "crate") drawCrate(o);
    if (o.type === "heart") drawHeart(o);
    if (o.type === "sheep") drawSheep(o);
    if (o.type === "angel") drawAngel(o);
  }
}

/* PROIETTILI DI LANA */

function fireWool(o) {
  projectiles.push({
    x: o.x - 2,
    y: GROUND - 33,
    w: 23,
    h: 23,
    vx: speed + 2.1,
    spin: 0
  });
}

function drawProjectiles() {
  for (const p of projectiles) {
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
    ctx.rotate(p.spin);
    ctx.fillStyle = "#f1f0e9";
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* COLLISIONI */

function playerHitbox() {
  return {
    x: player.x + 22,
    y: player.y + 20,
    w: player.w - 42,
    h: player.h - 28
  };
}

function intersects(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function checkCollisions() {
  const hitbox = playerHitbox();

  for (const o of obstacles) {
    let box;
    if (o.type === "angel") {
      const y = getAngelY(o);
      if (!o.dips) continue;
      box = { x: o.x + 15, y: y + 15, w: o.w - 30, h: o.h - 30 };
    } else {
      box = { x: o.x + 6, y: o.y + 6, w: o.w - 12, h: o.h - 12 };
    }

    if (intersects(hitbox, box)) {
      endGame();
      return;
    }
  }

  for (const p of projectiles) {
    const box = { x: p.x + 6, y: p.y + 6, w: p.w - 12, h: p.h - 12 };
    if (intersects(hitbox, box)) {
      endGame();
      return;
    }
  }
}

/* MESSAGGI */

function showMessage(title, description, icon) {
  if (!gameMessage) return;
  gameMessage.innerHTML = "";
  const content = document.createElement("div");
  content.className = "message-content";
  content.innerHTML = `<span class="message-wolf">${icon || "🐺"}</span><strong>${title}</strong><p>${description}</p>`;
  gameMessage.append(content);
  gameMessage.classList.remove("hidden");
}

function hideMessage() {
  if (gameMessage) gameMessage.classList.add("hidden");
}

function updateButtons() {
  if (startButton) {
    startButton.disabled = running && !dead;
    startButton.textContent = dead ? "RIGIOCA" : running ? "IN CORSO" : "INIZIA";
  }
  if (jumpButton) jumpButton.disabled = !running || paused || dead;
  if (pauseButton) {
    pauseButton.disabled = !running || dead;
    pauseButton.textContent = paused ? "RIPRENDI" : "PAUSA";
  }
}

function startGame() {
  if (running && !dead) return;
  cancelAnimationFrame(animationId);

  score = 0;
  speed = 4.5;
  worldTime = 0;
  spawnTimer = 0;
  nextSpawn = 90;
  obstacles = [];
  projectiles = [];
  lastTime = 0;
  frame = 0;
  dead = false;
  paused = false;
  running = true;

  player.reset();
  hideMessage();
  updateButtons();
  drawScene();

  animationId = requestAnimationFrame(gameLoop);
}

function togglePause() {
  if (!running || dead) return;
  paused = !paused;
  if (paused) {
    showMessage("PAUSA", "Il branco ti aspetta. Premi RIPRENDI per continuare.");
    cancelAnimationFrame(animationId);
  } else {
    hideMessage();
    lastTime = 0;
    animationId = requestAnimationFrame(gameLoop);
  }
  updateButtons();
}

function endGame() {
  if (dead) return;
  dead = true;
  running = false;
  paused = false;
  cancelAnimationFrame(animationId);

  score = Math.floor(score);
  if (score > personalBest) {
    personalBest = score;
    saveBest(personalBest);
    if (bestElement) bestElement.textContent = String(personalBest);
  }

  drawScene();
  showMessage("SEI CADUTO!", "Hai totalizzato " + score + " punti. Premi RIGIOCA per ripartire.");
  updateButtons();
}

function updateGame(dt) {
  const factor = dt / 16.667;
  frame++;
  worldTime += factor;
  speed = Math.min(8.2, 4.5 + score * 0.0009);
  score += factor * 0.34;

  player.update(dt);
  spawnTimer += factor;

  if (spawnTimer >= nextSpawn) {
    spawnObstacle();
    spawnTimer = 0;
    nextSpawn = random(80, 130);
  }

  for (const o of obstacles) {
    o.x -= speed * factor;
    if (o.type === "angel") updateAngel(o, factor);
    if (o.type === "sheep" && o.fires && !o.fired) {
      o.fireDelay -= factor;
      if (o.fireDelay <= 0) {
        fireWool(o);
        o.fired = true;
      }
    }
  }

  obstacles = obstacles.filter((o) => o.x + o.w > -20);

  for (const p of projectiles) {
    p.x -= p.vx * factor;
    p.spin += 0.12 * factor;
  }

  projectiles = projectiles.filter((p) => p.x + p.w > -20);

  checkCollisions();
  if (scoreElement) scoreElement.textContent = String(Math.floor(score));
}

function drawScene() {
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  drawObstacles();
  drawProjectiles();
  player.draw();
}

function gameLoop(timestamp) {
  if (!running || paused || dead) return;
  if (!lastTime) lastTime = timestamp;

  const dt = Math.min(timestamp - lastTime, MAX_DELTA);
  lastTime = timestamp;

  updateGame(dt);
  drawScene();

  if (running && !paused && !dead) {
    animationId = requestAnimationFrame(gameLoop);
  }
}

/* EVENTI CONTROLLI */

if (startButton) startButton.addEventListener("click", startGame);
if (jumpButton) jumpButton.addEventListener("click", () => player.jump());
if (pauseButton) pauseButton.addEventListener("click", togglePause);

if (canvas) {
  canvas.addEventListener("pointerdown", (e) => {
    if (!running || paused || dead) return;
    e.preventDefault();
    player.jump();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp") {
    e.preventDefault();
    if (!running || dead) startGame();
    else player.jump();
  }
});

function initialise() {
  if (loadingScreen) {
    loadingScreen.classList.add("hidden");
    setTimeout(() => { if (loadingScreen.isConnected) loadingScreen.remove(); }, 400);
  }
  player.reset();
  drawScene();
  updateButtons();
}

initialise();
