```javascript
"use strict";

/* =========================================================
   LUPO RUNNER — LISTA LUPO NERO
   Avvio, salto, pausa, fullscreen, ostacoli, record e classifica.
   FIX: angeli normali attraversabili senza collisioni.
   Gli angeli che scendono rimangono pericolosi.
========================================================= */

const LEADERBOARD_API_URL =
  "https://script.google.com/macros/s/AKfycbxJgp0aOu-zdvidw2ktjx2PiT3SLC7CQWycYAzEEfggzl_1bEE1zfdYAPsXuHg1hoYO/exec";

const $ = (id) => document.getElementById(id);

const canvas = $("gameCanvas");
const ctx = canvas?.getContext("2d");
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
  throw new Error("Lupo Runner: canvas di gioco non trovato.");
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
  image.addEventListener("load", () => {
    if (!running) drawScene();
  });
  return image;
}

const images = {
  wolf1: loadImage(MODEL_PATH + "lupo_run1.png"),
  wolf2: loadImage(MODEL_PATH + "lupo_run2.png"),
  sheep: loadImage(MODEL_PATH + "pecora.png"),
  angel: loadImage(MODEL_PATH + "angelo.png")
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

function drawText(text, x, y, size, color, align = "left") {
  ctx.font = `bold ${size}px Arial`;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
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

    ctx.strokeStyle = "#7f888f";
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + 21, y + 36);
    ctx.quadraticCurveTo(x - 3, y + 17, x + 1, y + 6);
    ctx.stroke();

    ctx.strokeStyle = "#5a6268";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(x + 28, y + 48);
    ctx.lineTo(x + 26 + swing, y + 62);
    ctx.moveTo(x + 61, y + 47);
    ctx.lineTo(x + 64 - swing, y + 62);
    ctx.stroke();

    roundedRect(x + 13, y + 27, 61, 30, 12, "#7f888f");
    roundedRect(x + 30, y + 32, 37, 23, 7, "#005b66");

    ctx.fillStyle = "#7f888f";
    ctx.beginPath();
    ctx.ellipse(x + 68, y + 22, 21, 19, 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x + 51, y + 12);
    ctx.lineTo(x + 52, y - 2);
    ctx.lineTo(x + 64, y + 10);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x + 72, y + 9);
    ctx.lineTo(x + 83, y - 1);
    ctx.lineTo(x + 84, y + 17);
    ctx.fill();

    ctx.fillStyle = "#a6aeb3";
    ctx.beginPath();
    ctx.ellipse(x + 82, y + 29, 15, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#151719";
    ctx.beginPath();
    ctx.arc(x + 75, y + 18, 2.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#3a2a22";
    ctx.beginPath();
    ctx.arc(x + 95, y + 27, 4, 0, Math.PI * 2);
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

    ctx.beginPath();
    ctx.moveTo(px + 39, GROUND);
    ctx.lineTo(px + 76, 210);
    ctx.lineTo(px + 105, GROUND);
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

  ctx.strokeStyle = "#34514d";
  ctx.lineWidth = 2;
  const groundOffset = (worldTime * speed) % 52;
  for (let x = -52; x < W + 52; x += 52) {
    ctx.beginPath();
    ctx.moveTo(x - groundOffset, GROUND + 25);
    ctx.lineTo(x + 17 - groundOffset, GROUND + 25);
    ctx.stroke();
  }

  drawText(stageName(), W - 18, 28, 12, "#65cfc4", "right");
}

/* OSTACOLI */

function makeObstacle(type) {
  const obstacle = {
    type,
    x: W + 20,
    y: GROUND - 43,
    w: 42,
    h: 43,
    phase: random(0, Math.PI * 2),
    fired: false
  };

  if (type === "snake") {
    obstacle.w = 60;
    obstacle.h = 27;
    obstacle.y = GROUND - obstacle.h + 1;
  } else if (type === "angel") {
    obstacle.w = 55;
    obstacle.h = 65;

    // Gli angeli normali volano alti.
    // Quelli che scendono diventano pericolosi.
    obstacle.y = GROUND - 145;

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

/* MOVIMENTO ANGELO */

function getAngelY(o) {
  if (o.dips && o.dipStarted) {
    return o.y + o.dipY;
  }

  // Gli angeli normali restano alti e passabili sotto.
  if (!o.dips) {
    return o.y + Math.sin(worldTime * 0.025 + o.phase) * 3;
  }

  return o.y + Math.sin(worldTime * 0.045 + o.phase) * 7;
}

function updateAngel(o, factor) {
  if (!o.dips) return;

  // Inizia la discesa quando si avvicina al lupo.
  if (!o.dipStarted && o.x < W * 0.72) {
    o.dipStarted = true;
    o.dipY = Math.max(
      0,
      Math.sin(worldTime * 0.045 + o.phase) * 7
    );
  }

  if (o.dipStarted) {
    // Discesa progressiva, senza risalita.
    o.dipY = Math.min(
      70,
      o.dipY + o.dipSpeed * factor
    );
  }
}

function drawSnake(o) {
  const wave = Math.sin(worldTime * 0.16 + o.phase) * 5;

  ctx.save();
  ctx.strokeStyle = "#d5bd4e";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(o.x, o.y + 17);
  ctx.bezierCurveTo(
    o.x + 13, o.y + wave,
    o.x + 28, o.y + 30 - wave,
    o.x + o.w, o.y + 13
  );
  ctx.stroke();

  ctx.fillStyle = "#e0c957";
  ctx.beginPath();
  ctx.arc(o.x + o.w - 2, o.y + 13, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#191919";
  ctx.beginPath();
  ctx.arc(o.x + o.w + 1, o.y + 10, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCrate(o) {
  ctx.save();
  roundedRect(o.x, o.y, o.w, o.h, 5, "#b76c37", "#f2c28b");
  ctx.strokeStyle = "#744324";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(o.x + 7, o.y + 7);
  ctx.lineTo(o.x + o.w - 7, o.y + o.h - 7);
  ctx.moveTo(o.x + o.w - 7, o.y + 7);
  ctx.lineTo(o.x + 7, o.y + o.h - 7);
  ctx.stroke();
  ctx.restore();
}

function drawHeart(o) {
  ctx.save();
  ctx.fillStyle = "#9b4be8";
  ctx.strokeStyle = "#d4a5ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  const x = o.x;
  const y = o.y + 3;
  ctx.moveTo(x + 20, y + 37);
  ctx.bezierCurveTo(x + 8, y + 26, x - 2, y + 17, x + 3, y + 8);
  ctx.bezierCurveTo(x + 7, y - 1, x + 17, y, x + 20, y + 8);
  ctx.bezierCurveTo(x + 26, y - 1, x + 38, y, x + 39, y + 10);
  ctx.bezierCurveTo(x + 40, y + 20, x + 29, y + 30, x + 20, y + 37);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawSheep(o) {
  if (imageReady(images.sheep)) {
    ctx.drawImage(images.sheep, o.x, o.y, o.w, o.h);
    return;
  }

  ctx.save();
  ctx.fillStyle = "#e9e8e4";
  for (const [dx, dy, r] of [
    [12, 19, 12], [25, 12, 13], [37, 19, 12],
    [20, 29, 12], [34, 30, 11]
  ]) {
    ctx.beginPath();
    ctx.arc(o.x + dx, o.y + dy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#5a6268";
  roundedRect(o.x + 11, o.y + 34, 6, 13, 2, "#5a6268");
  roundedRect(o.x + 35, o.y + 34, 6, 13, 2, "#5a6268");

  ctx.fillStyle = "#c5c5c5";
  ctx.beginPath();
  ctx.ellipse(o.x + 44, o.y + 21, 10, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#191919";
  ctx.beginPath();
  ctx.arc(o.x + 47, o.y + 18, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawAngel(o) {
  const y = getAngelY(o);

  if (imageReady(images.angel)) {
    ctx.drawImage(images.angel, o.x, y, o.w, o.h);
    return;
  }

  ctx.save();
  ctx.fillStyle = "#e9e8e0";
  ctx.strokeStyle = "#c5d3d1";
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.ellipse(o.x + 12, y + 27, 15, 8, -0.6, 0, Math.PI * 2);
  ctx.ellipse(o.x + 43, y + 27, 15, 8, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "#e6c96b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(o.x + 28, y + 5, 12, 4, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#f2f0e8";
  ctx.beginPath();
  ctx.ellipse(o.x + 28, y + 32, 11, 19, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(o.x + 28, y + 16, 10, 0, Math.PI * 2);
  ctx.fill();

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
    ctx.strokeStyle = "#bcbeb8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "#c3c6bf";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(-2, 0, 5, -1, 2);
    ctx.arc(3, 1, 4, 0, 2.5);
    ctx.stroke();

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
    // FIX IMPORTANTE:
    // Gli angeli normali NON possono causare collisioni.
    // Si controllano soltanto quelli che hanno la discesa attiva.
    if (o.type === "angel" && !o.dips) {
      continue;
    }

    let box;

    if (o.type === "angel") {
      const y = getAngelY(o);

      // L'angelo che scende diventa pericoloso quando
      // raggiunge realmente la traiettoria del lupo.
      // Hitbox ridotta per evitare collisioni ingiuste.
      box = {
        x: o.x + 17,
        y: y + 15,
        w: o.w - 34,
        h: o.h - 30
      };
    } else if (o.type === "snake") {
      box = {
        x: o.x + 9,
        y: o.y + 10,
        w: o.w - 18,
        h: o.h - 13
      };
    } else if (o.type === "sheep") {
      box = {
        x: o.x + 10,
        y: o.y + 10,
        w: o.w - 20,
        h: o.h - 17
      };
    } else {
      box = {
        x: o.x + 9,
        y: o.y + 9,
        w: o.w - 18,
        h: o.h - 16
      };
    }

    if (intersects(hitbox, box)) {
      endGame();
      return;
    }
  }

  for (const p of projectiles) {
    const box = {
      x: p.x + 6,
      y: p.y + 6,
      w: p.w - 12,
      h: p.h - 12
    };

    if (intersects(hitbox, box)) {
      endGame();
      return;
    }
  }
}

/* MESSAGGI E COMANDI */

function showMessage(title, description, icon = "🐺") {
  if (!gameMessage) return;

  gameMessage.innerHTML = "";

  const content = document.createElement("div");
  content.className = "message-content";

  const wolf = document.createElement("span");
  wolf.className = "message-wolf";
  wolf.textContent = icon;

  const heading = document.createElement("strong");
  heading.textContent = title;

  const paragraph = document.createElement("p");
  paragraph.textContent = description;

  content.append(wolf, heading, paragraph);
  gameMessage.append(content);
  gameMessage.classList.remove("hidden");
}

function hideMessage() {
  gameMessage?.classList.add("hidden");
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
  updateScore();
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

  if (scoreElement) scoreElement.textContent = String(score);

  drawScene();
  showMessage("SEI CADUTO!", `Hai totalizzato ${score} punti. Premi RIGIOCA per ripartire.`);
  updateButtons();
  submitScore(score);
}

function updateScore() {
  if (scoreElement) scoreElement.textContent = String(Math.floor(score));
  if (bestElement) bestElement.textContent = String(personalBest);
}

/* CICLO DI GIOCO */

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

    const difficulty = Math.min(1, score / 2200);
    nextSpawn = random(102 - difficulty * 20, 145 - difficulty * 22);
  }

  for (const o of obstacles) {
    o.x -= speed * factor;

    if (o.type === "angel") {
      updateAngel(o, factor);
    }

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
  updateScore();
}

function drawScene() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  drawObstacles();
  drawProjectiles();
  player.draw();

  if (!running && dead) {
    ctx.fillStyle = "#0005";
    ctx.fillRect(0, 0, W, H);
    drawText("FINE CORSA", W / 2, 170, 30, "#ffffff", "center");
    drawText(`PUNTEGGIO: ${Math.floor(score)}`, W / 2, 205, 18, "#35d6cc", "center");
  }
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

/* FULLSCREEN */

function isFullscreen() {
  return document.fullscreenElement === fullscreenGame ||
    fallbackFullscreen;
}

function updateFullscreenButton() {
  const active = isFullscreen();

  if (fullscreenButton) {
    fullscreenButton.textContent = active ? "RIDUCI SCHERMO" : "ESPANDI GIOCO";
    fullscreenButton.setAttribute("aria-pressed", String(active));
  }

  document.body.classList.toggle("fullscreen-active", active);
}

async function toggleFullscreen() {
  if (isFullscreen()) {
    if (document.fullscreenElement === fullscreenGame) {
      try {
        await document.exitFullscreen();
      } catch (_) {
        enableFallbackFullscreen(false);
      }
    } else {
      enableFallbackFullscreen(false);
    }
    return;
  }

  try {
    if (fullscreenGame.requestFullscreen) {
      await fullscreenGame.requestFullscreen();
    } else {
      throw new Error("Fullscreen non disponibile");
    }
  } catch (_) {
    enableFallbackFullscreen(true);
  }

  updateFullscreenButton();
}

function enableFallbackFullscreen(enable) {
  fallbackFullscreen = enable;

  if (fullscreenGame) {
    fullscreenGame.classList.toggle("fullscreen-fallback", enable);
  }

  if (enable) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = previousBodyOverflow;
  }

  updateFullscreenButton();
}

document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement !== fullscreenGame && fallbackFullscreen) {
    fallbackFullscreen = false;
    fullscreenGame?.classList.remove("fullscreen-fallback");
    document.body.style.overflow = previousBodyOverflow;
  }

  updateFullscreenButton();
});

/* CONTROLLI: mouse, touchscreen e tastiera */

startButton?.addEventListener("click", startGame);
jumpButton?.addEventListener("click", () => player.jump());
pauseButton?.addEventListener("click", togglePause);
fullscreenButton?.addEventListener("click", toggleFullscreen);

canvas?.addEventListener("pointerdown", (event) => {
  if (event.button !== undefined && event.button !== 0) return;
  if (!running || paused || dead) return;

  event.preventDefault();
  player.jump();
});

document.addEventListener("keydown", (event) => {
  const tag = event.target?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();

    if (!running || dead) {
      startGame();
    } else {
      player.jump();
    }
  }

  if (event.code === "Escape" && fallbackFullscreen) {
    enableFallbackFullscreen(false);
  }

  if (event.code === "KeyP" || event.code === "Escape") {
    if (running && !dead) togglePause();
  }
});

/* CLASSIFICA LOCALE E GOOGLE APPS SCRIPT */

function readLocalBoard() {
  try {
    const data = JSON.parse(localStorage.getItem(LOCAL_BOARD_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

function saveLocalScore(nickname, points) {
  const board = readLocalBoard();

  board.push({
    nickname,
    score: points,
    date: new Date().toISOString()
  });

  board.sort((a, b) => Number(b.score) - Number(a.score));

  try {
    localStorage.setItem(LOCAL_BOARD_KEY, JSON.stringify(board.slice(0, 20)));
  } catch (_) {}
}

function normaliseBoard(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];

  const candidates = [
    data.classifica,
    data.leaderboard,
    data.data,
    data.risultati,
    data.scores
  ];

  return candidates.find(Array.isArray) || [];
}

function getNickname() {
  let nickname = "";

  try {
    nickname = localStorage.getItem("lupoRunnerNickname") || "";
  } catch (_) {}

  nickname = window.prompt(
    "Inserisci il tuo nome da lupetto per la classifica:",
    nickname
  );

  if (nickname === null) return "";

  nickname = nickname.trim().replace(/\s+/g, " ").slice(0, 18);

  if (!nickname) {
    window.alert("Inserisci un nome valido per registrare il punteggio.");
    return "";
  }

  try {
    localStorage.setItem("lupoRunnerNickname", nickname);
  } catch (_) {}

  return nickname;
}

async function submitScore(points) {
  if (submittingScore || points <= 0) return;

  const nickname = getNickname();

  if (!nickname) {
    setBoardStatus("Punteggio non inviato: non hai inserito un nome.");
    return;
  }

  submittingScore = true;
  saveLocalScore(nickname, points);
  setBoardStatus("Invio del punteggio alla classifica...");

  try {
    await fetch(LEADERBOARD_API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        nickname,
        nome: nickname,
        score: points,
        punteggio: points
      })
    });

    setBoardStatus(
      "Richiesta inviata. Aggiorno la classifica; se il punteggio non compare, controlla lo script."
    );
  } catch (_) {
    setBoardStatus(
      "Non riesco a raggiungere il servizio. Il punteggio è conservato su questo dispositivo."
    );
  } finally {
    submittingScore = false;
    refreshBoard();
  }
}

function setBoardStatus(message) {
  if (leaderboardStatus) leaderboardStatus.textContent = message;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function renderBoard(entries, sourceMessage) {
  if (!leaderboardBody) return;

  const sorted = entries
    .map((entry) => ({
      nickname: String(
        entry.nickname ?? entry.nome ?? entry.name ?? entry.player ?? "Lupetto"
      ),
      score: Number(entry.score ?? entry.punteggio ?? entry.points ?? 0)
    }))
    .filter((entry) => Number.isFinite(entry.score) && entry.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (sorted.length === 0) {
    leaderboardBody.innerHTML =
      '<tr><td colspan="3" class="empty-row">Nessun punteggio disponibile.</td></tr>';

    setBoardStatus(sourceMessage);
    return;
  }

  leaderboardBody.innerHTML = sorted.map((entry, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHTML(entry.nickname)}</td>
      <td>${Math.floor(entry.score)}</td>
    </tr>
  `).join("");

  setBoardStatus(sourceMessage);
}

async function refreshBoard() {
  if (!leaderboardBody) return;

  const now = Date.now();
  if (now - lastBoardRequest < 800) return;
  lastBoardRequest = now;

  leaderboardBody.innerHTML =
    '<tr><td colspan="3" class="empty-row">Caricamento classifica...</td></tr>';

  setBoardStatus("Connessione alla classifica...");

  try {
    const url = `${LEADERBOARD_API_URL}?t=${Date.now()}`;
    const response = await fetch(url, { method: "GET", cache: "no-store" });

    if (!response.ok) throw new Error("Risposta HTTP non valida");

    const data = await response.json();
    const entries = normaliseBoard(data);

    if (entries.length) {
      renderBoard(entries, "Classifica caricata dal servizio online.");
    } else {
      const local = readLocalBoard();

      renderBoard(
        local,
        "Il servizio online non ha restituito punteggi. Mostro quelli salvati su questo dispositivo."
      );
    }
  } catch (_) {
    const local = readLocalBoard();

    renderBoard(
      local,
      "Classifica online non raggiungibile. Mostro i punteggi salvati su questo dispositivo."
    );
  }
}

refreshBoardButton?.addEventListener("click", () => {
  lastBoardRequest = 0;
  refreshBoard();
});

/* AVVIO PAGINA */

function initialise() {
  if (loadingScreen) {
    loadingScreen.classList.add("hidden");
    window.setTimeout(() => loadingScreen.remove(), 400);
  }

  player.reset();
  drawScene();
  updateButtons();
  refreshBoard();
}

initialise();
```
