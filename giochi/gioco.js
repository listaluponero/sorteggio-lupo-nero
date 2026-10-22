"use strict";

/* =========================================================
   LUPO RUNNER — VERSIONE COMPLETA CORRETTA
   Compatibile con giochi/index.html e gioco.css
========================================================= */

const LEADERBOARD_API_URL =
  "https://script.google.com/macros/s/AKfycbxJgp0aOu-zdvidw2ktjx2PiT3SLC7CQWycYAzEEfggzl_1bEE1zfdYAPsXuHg1hoYO/exec";

const $ = (id) => document.getElementById(id);

const canvas = $("gameCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;
const loadingScreen = $("loadingScreen");
const gameArea = $("gameArea");
const canvasWrapper = $("canvasWrapper");

const startButton = $("startGame");
const jumpButton = $("jumpGame");
const pauseButton = $("pauseGame");
const fullscreenButton = $("fullscreenBtn");
const refreshBoardButton = $("refreshBoard");
const backToListButton = $("backToList");

const scoreElement = $("score");
const bestElement = $("personalBest");
const leaderboardBody = $("leaderboardBody");
const leaderboardStatus = $("leaderboardStatus");
const gameMessage = $("gameMessage");

const W = 800;
const H = 400;
const groundY = 320;
const MODEL_PATH = "../assets/modelli/modello_gioco_corsa/";

if (canvas) {
  canvas.width = W;
  canvas.height = H;
}

let gameRunning = false;
let gamePaused = false;
let animationFrameId = 0;
let score = 0;
let gameSpeed = 5;
let frameCount = 0;
let nextObstacleFrame = 90;
let obstacles = [];
let projectiles = [];
let lastTime = 0;
let lastSpeedScore = 0;

function readBest() {
  try {
    return Number(localStorage.getItem("lupo_runner_best")) || 0;
  } catch (_) {
    return 0;
  }
}

let personalBest = readBest();

if (bestElement) {
  bestElement.textContent = String(personalBest);
}

/* ================= IMMAGINI ================= */

function loadImage(filename) {
  const img = new Image();

  img.onload = function () {
    if (!gameRunning) renderStatico();
  };

  img.onerror = function () {
    console.warn("Immagine non caricata:", MODEL_PATH + filename);
  };

  img.src = MODEL_PATH + filename;
  return img;
}

const immagini = {
  lupoFrame1: loadImage("lupo_run1.png"),
  lupoFrame2: loadImage("lupo_run2.png"),
  pecora: loadImage("pecora.png"),
  angelo: loadImage("angelo.png")
};

function imageReady(img) {
  return !!(img && img.complete && img.naturalWidth > 0);
}

/* ================= LUPO ================= */

const lupo = {
  x: 65,
  y: groundY - 65,
  width: 92,
  height: 65,
  vy: 0,
  gravity: 0.8,
  jumpPower: -14,
  isJumping: false,

  update() {
    if (!this.isJumping) return;

    this.vy += this.gravity;
    this.y += this.vy;

    const floor = groundY - this.height;

    if (this.y >= floor) {
      this.y = floor;
      this.vy = 0;
      this.isJumping = false;
    }
  },

  jump() {
    if (!gameRunning || gamePaused || this.isJumping) return;

    this.isJumping = true;
    this.vy = this.jumpPower;
  },

  draw() {
    const frame =
      Math.floor(frameCount / 7) % 2 === 0
        ? immagini.lupoFrame1
        : immagini.lupoFrame2;

    if (imageReady(frame)) {
      ctx.drawImage(frame, this.x, this.y, this.width, this.height);
    } else {
      this.drawFallback();
    }
  },

  drawFallback() {
    const x = this.x;
    const y = this.y;

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Ombra
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.beginPath();
    ctx.ellipse(x + 45, groundY - 2, 34, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Coda
    ctx.strokeStyle = "#5A6268";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(x + 24, y + 34);
    ctx.quadraticCurveTo(x + 3, y + 26, x + 5, y + 10);
    ctx.stroke();

    // Corpo
    ctx.fillStyle = "#7F888F";
    ctx.strokeStyle = "#1E2022";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(x + 43, y + 39, 32, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pancia
    ctx.fillStyle = "#B0B7BC";
    ctx.beginPath();
    ctx.ellipse(x + 49, y + 48, 19, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Zampe animate
    const step = Math.floor(frameCount / 5) % 2;

    const legs = step
      ? [[31, 48, 24, 60], [48, 48, 57, 60], [65, 47, 72, 58]]
      : [[31, 48, 37, 60], [48, 48, 42, 60], [65, 47, 60, 58]];

    ctx.strokeStyle = "#5A6268";
    ctx.lineWidth = 8;

    for (const leg of legs) {
      ctx.beginPath();
      ctx.moveTo(x + leg[0], y + leg[1]);
      ctx.lineTo(x + leg[2], y + leg[3]);
      ctx.stroke();
    }

    // Testa
    ctx.fillStyle = "#7F888F";
    ctx.beginPath();
    ctx.ellipse(x + 69, y + 25, 17, 16, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Muso
    ctx.fillStyle = "#B0B7BC";
    ctx.beginPath();
    ctx.moveTo(x + 73, y + 28);
    ctx.lineTo(x + 91, y + 32);
    ctx.lineTo(x + 75, y + 38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Orecchio
    ctx.fillStyle = "#5A6268";
    ctx.beginPath();
    ctx.moveTo(x + 60, y + 18);
    ctx.lineTo(x + 61, y + 1);
    ctx.lineTo(x + 73, y + 15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Occhio
    ctx.fillStyle = "#EAE6DF";
    ctx.beginPath();
    ctx.ellipse(x + 76, y + 23, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#005B66";
    ctx.beginPath();
    ctx.arc(x + 78, y + 23, 2, 0, Math.PI * 2);
    ctx.fill();

    // Naso
    ctx.fillStyle = "#1E2022";
    ctx.beginPath();
    ctx.arc(x + 89, y + 32, 3, 0, Math.PI * 2);
    ctx.fill();

    // Dettaglio felpa
    ctx.strokeStyle = "#007D87";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 31, y + 29);
    ctx.quadraticCurveTo(x + 46, y + 19, x + 58, y + 28);
    ctx.stroke();

    ctx.restore();
  }
};

/* ================= OSTACOLI ================= */

class Obstacle {
  constructor(type) {
    this.type = type;
    this.x = W + 35;
    this.phase = Math.random() * Math.PI * 2;
    this.markedForDeletion = false;

    if (type === "pecora") {
      this.width = 55;
      this.height = 48;
      this.y = groundY - this.height;
      this.willThrow = Math.random() < 1 / 3;
      this.hasThrown = false;
    } else if (type === "angelo") {
      this.width = 76;
      this.height = 48;
      this.y = groundY - 145;
      this.baseY = this.y;
      this.dipsDown = Math.random() < 0.35;
      this.dipStarted = false;
    } else if (type === "serpente") {
      this.width = 62;
      this.height = 29;
      this.y = groundY - this.height;
    } else if (type === "cassa") {
      this.width = 44;
      this.height = 44;
      this.y = groundY - this.height;
    } else {
      this.width = 37;
      this.height = 37;
      this.y = groundY - this.height;
    }
  }

  update() {
    this.x -= gameSpeed;

    if (this.type === "angelo") {
      this.phase += 0.055;

      if (this.dipsDown && !this.dipStarted && this.x < W * 0.72) {
        this.dipStarted = true;
      }

      if (this.dipsDown && this.dipStarted) {
        this.y = Math.min(
          this.y + 1.2,
          groundY - this.height - 8
        );
      } else {
        this.y = this.baseY + Math.sin(this.phase) * 9;
      }
    }

    if (
      this.type === "pecora" &&
      this.willThrow &&
      !this.hasThrown &&
      this.x < W - 230
    ) {
      projectiles.push(
        new Projectile(
          this.x + 8,
          this.y + this.height * 0.55
        )
      );
      this.hasThrown = true;
    }

    if (this.x + this.width < 0) {
      this.markedForDeletion = true;
    }
  }

  draw() {
    if (this.type === "pecora") {
      if (imageReady(immagini.pecora)) {
        ctx.drawImage(
          immagini.pecora,
          this.x,
          this.y,
          this.width,
          this.height
        );
      } else {
        this.drawSheep();
      }
    } else if (this.type === "angelo") {
      if (imageReady(immagini.angelo)) {
        ctx.drawImage(
          immagini.angelo,
          this.x,
          this.y,
          this.width,
          this.height
        );
      } else {
        this.drawAngel();
      }
    } else if (this.type === "serpente") {
      this.drawSnake();
    } else if (this.type === "cassa") {
      this.drawCassa();
    } else {
      this.drawHeart();
    }
  }

  drawSheep() {
    const x = this.x;
    const y = this.y;

    ctx.fillStyle = "#EAE6DF";
    ctx.strokeStyle = "#39353A";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x + 26, y + 25, 23, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#39353A";
    ctx.beginPath();
    ctx.ellipse(x + 45, y + 22, 9, 11, 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#39353A";
    ctx.lineWidth = 4;

    for (const lx of [15, 28, 39]) {
      ctx.beginPath();
      ctx.moveTo(x + lx, y + 35);
      ctx.lineTo(x + lx, y + 45);
      ctx.stroke();
    }

    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(x + 47, y + 19, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  drawAngel() {
    const x = this.x;
    const y = this.y + Math.sin(this.phase) * 2;

    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.fillStyle = "#EAE6DF";
    ctx.strokeStyle = "#AAB5C0";
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(27, 27);
    ctx.quadraticCurveTo(15, 4, 0, 3);
    ctx.quadraticCurveTo(7, 18, 18, 29);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(31, 29);
    ctx.quadraticCurveTo(18, 40, 4, 42);
    ctx.quadraticCurveTo(15, 27, 29, 25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#F6F3EA";
    ctx.beginPath();
    ctx.moveTo(27, 22);
    ctx.lineTo(48, 20);
    ctx.lineTo(62, 27);
    ctx.lineTo(44, 35);
    ctx.lineTo(29, 31);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "#D5A64C";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(37, 23);
    ctx.lineTo(44, 33);
    ctx.stroke();

    ctx.fillStyle = "#F0C6A4";
    ctx.beginPath();
    ctx.arc(51, 17, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#B87940";
    ctx.beginPath();
    ctx.arc(50, 14, 7, Math.PI, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#F0C6A4";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(42, 24);
    ctx.lineTo(57, 19);
    ctx.lineTo(72, 13);
    ctx.stroke();

    ctx.strokeStyle = "#F3CF65";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(51, 6, 7, 3, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  drawSnake() {
    const x = this.x;
    const y = this.y;
    const wave = this.phase + frameCount * 0.12;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const lines = [
      { color: "rgba(0,0,0,.3)", width: 12, offset: 0.62 },
      { color: "#245B3D", width: 12, offset: 0.52 },
      { color: "#59A65A", width: 7, offset: 0.47 }
    ];

    for (const line of lines) {
      ctx.strokeStyle = line.color;
      ctx.lineWidth = line.width;
      ctx.beginPath();

      for (let i = 0; i <= 12; i++) {
        const px = x + (i / 12) * this.width;
        const py =
          y +
          this.height * line.offset +
          Math.sin(i * 0.8 + wave) * 6;

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }

      ctx.stroke();
    }

    const hx = x + this.width - 4;
    const hy =
      y +
      this.height * 0.45 +
      Math.sin(12 * 0.8 + wave) * 6;

    ctx.fillStyle = "#397A45";
    ctx.strokeStyle = "#173C2A";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(hx, hy - 3, 10, 7, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#F3D35C";
    ctx.beginPath();
    ctx.arc(hx + 3, hy - 5, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#D94C65";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx + 8, hy);
    ctx.lineTo(hx + 14, hy + 2);
    ctx.lineTo(hx + 17, hy);
    ctx.moveTo(hx + 14, hy + 2);
    ctx.lineTo(hx + 16, hy + 5);
    ctx.stroke();

    ctx.restore();
  }

  drawCassa() {
    const x = this.x;
    const y = this.y;
    const w = this.width;
    const h = this.height;

    ctx.fillStyle = "#211A32";
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = "#9B5DE5";
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);

    ctx.fillStyle = "#9B5DE5";
    ctx.fillRect(x + 5, y + 5, w - 10, 4);
    ctx.fillRect(x + 5, y + h - 9, w - 10, 4);

    ctx.fillStyle = "#0B0B10";
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#D7B5FF";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#D7B5FF";
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("♪", x + 5, y - 3);
  }

  drawHeart() {
    const x = this.x;
    const y = this.y;
    const w = this.width;
    const h = this.height;

    ctx.save();
    ctx.fillStyle = "#A855F7";
    ctx.strokeStyle = "#E9D5FF";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + h - 3);
    ctx.bezierCurveTo(
      x + w * 0.38, y + h * 0.78,
      x, y + h * 0.48,
      x + w * 0.12, y + h * 0.25
    );
    ctx.bezierCurveTo(
      x + w * 0.22, y - 2,
      x + w * 0.43, y + h * 0.05,
      x + w / 2, y + h * 0.23
    );
    ctx.bezierCurveTo(
      x + w * 0.65, y + h * 0.02,
      x + w * 0.92, y - 2,
      x + w * 0.98, y + h * 0.28
    );
    ctx.bezierCurveTo(
      x + w, y + h * 0.53,
      x + w * 0.63, y + h * 0.83,
      x + w / 2, y + h - 3
    );
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

/* ================= GOMITOLO ================= */

class Projectile {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 12;
    this.speedX = gameSpeed + 3;
    this.rotation = 0;
    this.markedForDeletion = false;
  }

  update() {
    this.x -= this.speedX;
    this.rotation += 0.12;

    if (this.x + this.radius < 0) {
      this.markedForDeletion = true;
    }
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    ctx.fillStyle = "#D6B4FF";
    ctx.strokeStyle = "#8B5AC7";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-8, -3);
    ctx.quadraticCurveTo(0, -11, 8, -2);
    ctx.moveTo(-8, 4);
    ctx.quadraticCurveTo(0, -3, 8, 4);
    ctx.moveTo(-2, -9);
    ctx.quadraticCurveTo(-8, 0, 2, 9);
    ctx.stroke();

    ctx.restore();
  }
}

/* ================= AMBIENTE ================= */

function drawEnvironment() {
  ctx.fillStyle = "#10131A";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#343044";

  for (let i = 0; i < 18; i++) {
    const x = ((i * 97 - frameCount * 0.25) % W + W) % W;
    const y = 35 + (i * 37) % 150;

    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#20232C";
  ctx.fillRect(0, groundY, W, H - groundY);

  ctx.strokeStyle = "#168B87";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(W, groundY);
  ctx.stroke();

  ctx.strokeStyle = "#424654";
  ctx.lineWidth = 2;

  const offset = (frameCount * gameSpeed) % 60;

  for (let x = -offset; x < W; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, groundY + 25);
    ctx.lineTo(x + 24, groundY + 25);
    ctx.stroke();
  }
}

function renderStatico() {
  if (!ctx || gameRunning) return;

  ctx.clearRect(0, 0, W, H);
  drawEnvironment();
  lupo.draw();
}

/* ================= CICLO DI GIOCO ================= */

function handleObstacles() {
  frameCount++;

  if (frameCount >= nextObstacleFrame) {
    const types = ["pecora", "angelo", "serpente", "cassa", "cuore"];
    const type = types[Math.floor(Math.random() * types.length)];

    obstacles.push(new Obstacle(type));

    const reduction = Math.min(gameSpeed * 3, 25);
    const interval = Math.max(
      55,
      75 + Math.floor(Math.random() * 45) - reduction
    );

    nextObstacleFrame = frameCount + interval;
  }

  for (const obs of obstacles) {
    obs.update();
    obs.draw();
  }

  for (const projectile of projectiles) {
    projectile.update();
    projectile.draw();
  }

  obstacles = obstacles.filter((item) => !item.markedForDeletion);
  projectiles = projectiles.filter((item) => !item.markedForDeletion);
}

function checkCollisions() {
  const player = {
    x: lupo.x + 16,
    y: lupo.y + 10,
    w: lupo.width - 28,
    h: lupo.height - 16
  };

  for (const obs of obstacles) {
    const marginX = obs.type === "serpente" ? 8 : 6;
    const marginY = 5;

    const hit =
      player.x < obs.x + obs.width - marginX &&
      player.x + player.w > obs.x + marginX &&
      player.y < obs.y + obs.height - marginY &&
      player.y + player.h > obs.y + marginY;

    if (hit) {
      gameOver();
      return;
    }
  }

  for (const proj of projectiles) {
    const r = proj.radius * 0.75;

    const hit =
      player.x < proj.x + r &&
      player.x + player.w > proj.x - r &&
      player.y < proj.y + r &&
      player.y + player.h > proj.y - r;

    if (hit) {
      gameOver();
      return;
    }
  }
}

function gameLoop(timestamp) {
  if (!gameRunning || gamePaused || !ctx) return;

  const now = Number.isFinite(timestamp) ? timestamp : 0;
  const delta = lastTime ? Math.min(now - lastTime, 40) : 16.67;
  lastTime = now;

  const steps = Math.max(0.5, delta / 16.67);

  ctx.clearRect(0, 0, W, H);
  drawEnvironment();

  lupo.update();
  lupo.draw();
  handleObstacles();

  if (!gameRunning) return;

  checkCollisions();

  if (!gameRunning) return;

  score += steps;

  const displayedScore = Math.floor(score / 5);

  if (scoreElement) {
    scoreElement.textContent = String(displayedScore);
  }

  const speedLevel = Math.floor(score / 500);

  if (speedLevel > lastSpeedScore) {
    lastSpeedScore = speedLevel;
    gameSpeed = Math.min(5 + speedLevel * 0.35, 10);
  }

  animationFrameId = requestAnimationFrame(gameLoop);
}

/* ================= CLASSIFICA ================= */

function setLeaderboardMessage(message) {
  if (leaderboardStatus) {
    leaderboardStatus.textContent = message;
  }
}

function askNickname() {
  const answer = window.prompt(
    "Inserisci il tuo nickname per la classifica:"
  );

  if (answer === null) return "";

  return answer.trim().slice(0, 24);
}

async function fetchLeaderboard() {
  if (!leaderboardBody) return;

  setLeaderboardMessage("Caricamento classifica...");
  leaderboardBody.innerHTML =
    "<tr><td colspan=\"3\">Caricamento...</td></tr>";

  try {
    const response = await fetch(LEADERBOARD_API_URL + "?t=" + Date.now(), {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Risposta server non valida: " + response.status);
    }

    const data = await response.json();

    let rows = [];

    if (Array.isArray(data)) {
      rows = data;
    } else if (data && Array.isArray(data.classifica)) {
      rows = data.classifica;
    } else if (data && Array.isArray(data.leaderboard)) {
      rows = data.leaderboard;
    } else if (data && Array.isArray(data.data)) {
      rows = data.data;
    }

    rows = rows
      .map((entry) => ({
        nome: String(
          entry.nome ?? entry.nickname ?? entry.name ?? "Lupetto"
        ),
        punti: Number(
          entry.punti ?? entry.score ?? entry.punteggio ?? 0
        )
      }))
      .filter((entry) => Number.isFinite(entry.punti))
      .sort((a, b) => b.punti - a.punti)
      .slice(0, 5);

    leaderboardBody.innerHTML = "";

    if (!rows.length) {
      leaderboardBody.innerHTML =
        "<tr><td colspan=\"3\">Nessun punteggio disponibile</td></tr>";
    } else {
      rows.forEach((entry, index) => {
        const tr = document.createElement("tr");

        [String(index + 1), entry.nome, String(entry.punti)].forEach(
          (value) => {
            const td = document.createElement("td");
            td.textContent = value;
            tr.appendChild(td);
          }
        );

        leaderboardBody.appendChild(tr);
      });
    }

    setLeaderboardMessage("Classifica aggiornata.");
  } catch (error) {
    console.error("Errore caricamento classifica:", error);

    leaderboardBody.innerHTML =
      "<tr><td colspan=\"3\">Classifica non disponibile</td></tr>";

    setLeaderboardMessage(
      "Impossibile leggere la classifica. Il gioco resta utilizzabile."
    );
  }
}

async function submitScore(finalScore) {
  const nickname = askNickname();

  if (!nickname) {
    setLeaderboardMessage(
      "Punteggio non inviato: nickname non inserito."
    );
    return;
  }

  try {
    await fetch(LEADERBOARD_API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8"
      },
      body: JSON.stringify({
        nome: nickname,
        nickname: nickname,
        punti: finalScore,
        score: finalScore
      })
    });

    setLeaderboardMessage(
      "Richiesta di invio effettuata. Aggiorna la classifica tra qualche secondo."
    );
  } catch (error) {
    console.error("Errore invio punteggio:", error);
    setLeaderboardMessage("Invio del punteggio non riuscito.");
  }
}

/* ================= AVVIO / GAME OVER ================= */

function startGame() {
  if (gameRunning) return;

  if (!ctx) {
    showFatalError("Il canvas del gioco non è disponibile.");
    return;
  }

  cancelAnimationFrame(animationFrameId);

  gameRunning = true;
  gamePaused = false;
  score = 0;
  gameSpeed = 5;
  frameCount = 0;
  nextObstacleFrame = 90;
  lastTime = 0;
  lastSpeedScore = 0;
  obstacles = [];
  projectiles = [];

  lupo.y = groundY - lupo.height;
  lupo.vy = 0;
  lupo.isJumping = false;

  if (scoreElement) scoreElement.textContent = "0";

  if (startButton) {
    startButton.disabled = true;
    startButton.textContent = "IN CORSO";
  }

  if (jumpButton) jumpButton.disabled = false;

  if (pauseButton) {
    pauseButton.disabled = false;
    pauseButton.textContent = "PAUSA";
  }

  if (gameMessage) {
    gameMessage.textContent =
      "Corri, salta gli ostacoli e schiva i gomitoli!";
  }

  animationFrameId = requestAnimationFrame(gameLoop);
}

function gameOver() {
  if (!gameRunning) return;

  gameRunning = false;
  gamePaused = false;

  cancelAnimationFrame(animationFrameId);

  const finalScore = Math.floor(score / 5);

  if (gameMessage) {
    gameMessage.textContent =
      "GAME OVER! Punti realizzati: " + finalScore;
  }

  if (finalScore > personalBest) {
    personalBest = finalScore;

    try {
      localStorage.setItem("lupo_runner_best", String(personalBest));
    } catch (error) {
      console.warn("Impossibile salvare il record locale.", error);
    }

    if (bestElement) {
      bestElement.textContent = String(personalBest);
    }
  }

  if (startButton) {
    startButton.disabled = false;
    startButton.textContent = "RIGIOCA";
  }

  if (jumpButton) jumpButton.disabled = true;

  if (pauseButton) {
    pauseButton.disabled = true;
    pauseButton.textContent = "PAUSA";
  }

  renderStatico();
  submitScore(finalScore);
}

function togglePause() {
  if (!gameRunning) return;

  gamePaused = !gamePaused;

  if (gamePaused) {
    cancelAnimationFrame(animationFrameId);

    if (pauseButton) pauseButton.textContent = "RIPRENDI";
    if (gameMessage) gameMessage.textContent = "Gioco in pausa";
  } else {
    lastTime = 0;

    if (pauseButton) pauseButton.textContent = "PAUSA";
    if (gameMessage) {
      gameMessage.textContent = "Gioco ripreso!";
    }

    animationFrameId = requestAnimationFrame(gameLoop);
  }
}

/* ================= SCHERMO INTERO ================= */

async function toggleFullscreen() {
  if (!gameArea) return;

  const fallbackActive = gameArea.classList.contains("fullscreen-mode");

  try {
    if (document.fullscreenElement === gameArea) {
      await document.exitFullscreen();
      return;
    }

    if (fallbackActive) {
      gameArea.classList.remove("fullscreen-mode");
      updateFullscreenButton();
      return;
    }

    if (gameArea.requestFullscreen) {
      await gameArea.requestFullscreen();
    } else {
      gameArea.classList.add("fullscreen-mode");
    }

    updateFullscreenButton();
  } catch (error) {
    console.warn("Fullscreen nativo non disponibile:", error);

    gameArea.classList.add("fullscreen-mode");
    updateFullscreenButton();
  }
}

function updateFullscreenButton() {
  if (!fullscreenButton) return;

  const active =
    document.fullscreenElement === gameArea ||
    gameArea.classList.contains("fullscreen-mode");

  fullscreenButton.textContent = active
    ? "ESCI DA SCHERMO INTERO"
    : "ESPANDI GIOCO";
}

document.addEventListener("fullscreenchange", updateFullscreenButton);

/* ================= CONTROLLI ================= */

function handleJump(event) {
  if (event) event.preventDefault();

  if (gameRunning && !gamePaused) {
    lupo.jump();
  }
}

if (startButton) {
  startButton.addEventListener("click", startGame);
}

if (jumpButton) {
  jumpButton.addEventListener("pointerdown", handleJump);
}

if (pauseButton) {
  pauseButton.addEventListener("click", togglePause);
}

if (fullscreenButton) {
  fullscreenButton.addEventListener("click", toggleFullscreen);
}

if (refreshBoardButton) {
  refreshBoardButton.addEventListener("click", fetchLeaderboard);
}

if (backToListButton) {
  backToListButton.addEventListener("click", function () {
    window.location.href = "../../";
  });
}

if (canvasWrapper) {
  canvasWrapper.addEventListener("pointerdown", function (event) {
    if (event.target.closest("button, input, textarea")) return;

    if (gameRunning && !gamePaused) {
      lupo.jump();
    }
  });
}

window.addEventListener("keydown", function (event) {
  if (event.code !== "Space" && event.code !== "ArrowUp") return;

  const tag = document.activeElement
    ? document.activeElement.tagName
    : "";

  if (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "BUTTON"
  ) {
    return;
  }

  event.preventDefault();

  if (!gameRunning && startButton && !startButton.disabled) {
    startGame();
  } else if (gameRunning && !gamePaused) {
    lupo.jump();
  }
});

window.addEventListener("resize", function () {
  if (!gameRunning) renderStatico();
});

document.addEventListener("visibilitychange", function () {
  if (document.hidden && gameRunning && !gamePaused) {
    togglePause();
  }
});

/* ================= ERRORI / INIZIALIZZAZIONE ================= */

function showFatalError(message) {
  if (loadingScreen) loadingScreen.style.display = "none";

  if (gameArea) {
    gameArea.classList.add("visible");
    gameArea.style.display = "block";
  }

  if (gameMessage) {
    gameMessage.textContent = "Errore: " + message;
  }

  console.error("Lupo Runner:", message);
}

function inizializzaGioco() {
  try {
    if (loadingScreen) loadingScreen.style.display = "none";

    if (gameArea) {
      gameArea.classList.add("visible");
      gameArea.style.display = "block";
    }

    if (!canvas || !ctx) {
      showFatalError("Canvas non trovato. Controlla l'HTML del gioco.");
      return;
    }

    renderStatico();

    // La classifica non deve impedire l'avvio del gioco.
    fetchLeaderboard();
  } catch (error) {
    console.error("Errore inizializzazione Lupo Runner:", error);
    showFatalError("Errore durante l'inizializzazione. Controlla la Console.");
  }
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    inizializzaGioco,
    { once: true }
  );
} else {
  inizializzaGioco();
}
