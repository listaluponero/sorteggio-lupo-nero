"use strict";

/* =========================================================
   LUPO RUNNER — LISTA LUPO NERO
   Gioco completo:
   - Lupo animato
   - Ostacoli e proiettili
   - Salto da pulsante, tastiera e tocco
   - Pausa e ripresa
   - Schermo intero con tutti i comandi visibili
   - Record personale
   - Classifica Google Apps Script
========================================================= */

const LEADERBOARD_API_URL =
  "https://script.google.com/macros/s/AKfycbxJgp0aOu-zdvidw2ktjx2PiT3SLC7CQWycYAzEEfggzl_1bEE1zfdYAPsXuHg1hoYO/exec";

const $ = (id) => document.getElementById(id);

const canvas = $("gameCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;

const loadingScreen = $("loadingScreen");
const gameArea = $("gameArea");
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
const groundY = 320;

const MODEL_PATH = "../assets/modelli/modello_gioco_corsa/";

if (canvas) {
  canvas.width = W;
  canvas.height = H;
}

/* =========================================================
   STATO
========================================================= */

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
let elapsedTime = 0;
let worldTime = 0;
let submittingScore = false;

let fullscreenFallback = false;
let previousOverflow = "";

const MAX_DELTA = 34;
const BEST_KEY = "lupo_runner_best";

/* =========================================================
   IMMAGINI
========================================================= */

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

const images = {
  wolf1: loadImage(MODEL_PATH + "lupo_run1.png"),
  wolf2: loadImage(MODEL_PATH + "lupo_run2.png"),
  sheep: loadImage(MODEL_PATH + "pecora.png"),
  angel: loadImage(MODEL_PATH + "angelo.png")
};

function imageReady(img) {
  return Boolean(img && img.complete && img.naturalWidth > 0);
}

Object.values(images).forEach((img) => {
  img.addEventListener("load", () => {
    if (!gameRunning) renderStatico();
  });
});

/* =========================================================
   RECORD PERSONALE
========================================================= */

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
  } catch (_) {
    // Il gioco continua anche se il browser blocca localStorage.
  }
}

let personalBest = readBest();

if (bestElement) {
  bestElement.textContent = String(personalBest);
}

/* =========================================================
   UTILITÀ GRAFICHE
========================================================= */

function roundedRect(x, y, w, h, radius, fill, stroke) {
  if (!ctx) return;

  const r = Math.min(radius, w / 2, h / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();

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
  if (!ctx) return;

  ctx.fillStyle = color;
  ctx.font = `bold ${size}px Arial, sans-serif`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

/* =========================================================
   AMBIENTE
========================================================= */

function drawBackground() {
  if (!ctx) return;

  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, "#111722");
  gradient.addColorStop(1, "#171b23");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  // Stelle sullo sfondo.
  ctx.fillStyle = "rgba(235, 242, 255, 0.55)";

  for (let i = 0; i < 42; i++) {
    const x = (i * 173 + 31) % W;
    const y = (i * 67 + 21) % 230;
    const radius = i % 5 === 0 ? 1.6 : 0.8;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sagome lontane.
  ctx.fillStyle = "#171d26";
  ctx.beginPath();
  ctx.moveTo(0, 250);
  ctx.lineTo(90, 205);
  ctx.lineTo(155, 245);
  ctx.lineTo(245, 190);
  ctx.lineTo(330, 248);
  ctx.lineTo(440, 205);
  ctx.lineTo(540, 246);
  ctx.lineTo(655, 198);
  ctx.lineTo(800, 245);
  ctx.lineTo(800, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  // Terreno.
  ctx.fillStyle = "#20232c";
  ctx.fillRect(0, groundY, W, H - groundY);

  // Linea turchese.
  ctx.fillStyle = "#168b87";
  ctx.fillRect(0, groundY, W, 3);

  // Trattini che scorrono durante la corsa.
  const offset = gameRunning && !gamePaused
    ? (worldTime * gameSpeed * 0.7) % 75
    : 0;

  ctx.fillStyle = "rgba(115, 130, 143, 0.25)";

  for (let x = -75; x < W + 75; x += 75) {
    ctx.fillRect(x - offset, groundY + 28, 35, 2);
  }

  // Piccole pietre.
  ctx.fillStyle = "#353a43";

  for (let i = 0; i < 14; i++) {
    const x = (i * 89 + 25) % W;
    const y = groundY + 50 + (i % 3) * 12;
    ctx.fillRect(x, y, 3 + (i % 3), 2);
  }
}

/* =========================================================
   LUPO GIOCATORE
========================================================= */

const player = {
  x: 65,
  y: groundY - 65,
  w: 92,
  h: 65,
  vy: 0,
  gravity: 0.8,
  jumpPower: -14,
  isJumping: false,
  frame: 0,

  reset() {
    this.x = 65;
    this.y = groundY - this.h;
    this.vy = 0;
    this.isJumping = false;
    this.frame = 0;
  },

  jump() {
    if (!gameRunning || gamePaused || this.isJumping) return;

    this.vy = this.jumpPower;
    this.isJumping = true;
  },

  update(deltaFactor) {
    if (!gameRunning || gamePaused) return;

    this.frame += deltaFactor;

    if (this.isJumping) {
      this.vy += this.gravity * deltaFactor;
      this.y += this.vy * deltaFactor;

      const floorY = groundY - this.h;

      if (this.y >= floorY) {
        this.y = floorY;
        this.vy = 0;
        this.isJumping = false;
      }
    }
  },

  draw() {
    if (!ctx) return;

    const image =
      Math.floor(this.frame / 7) % 2 === 0
        ? images.wolf1
        : images.wolf2;

    if (imageReady(image)) {
      ctx.drawImage(image, this.x, this.y, this.w, this.h);
      return;
    }

    this.drawFallback();
  },

  drawFallback() {
    if (!ctx) return;

    const x = this.x;
    const y = this.y;
    const running = gameRunning && !gamePaused && !this.isJumping;
    const legSwing = running ? Math.sin(this.frame * 0.55) * 5 : 0;

    // Ombra.
    ctx.fillStyle = "rgba(0,0,0,.3)";
    ctx.beginPath();
    ctx.ellipse(x + 48, groundY + 3, 40, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Coda.
    ctx.strokeStyle = "#7f888f";
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + 25, y + 36);
    ctx.quadraticCurveTo(x + 7, y + 27, x + 3, y + 15);
    ctx.stroke();

    // Corpo.
    roundedRect(
      x + 20, y + 22, 52, 30, 12,
      "#7f888f", "#1e2022"
    );

    // Felpa turchese.
    roundedRect(
      x + 28, y + 25, 34, 27, 9,
      "#006875", "#1e2022"
    );

    // Testa.
    ctx.fillStyle = "#7f888f";
    ctx.strokeStyle = "#1e2022";
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.ellipse(x + 70, y + 22, 21, 19, 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Orecchie.
    ctx.beginPath();
    ctx.moveTo(x + 54, y + 13);
    ctx.lineTo(x + 55, y - 2);
    ctx.lineTo(x + 66, y + 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + 70, y + 9);
    ctx.lineTo(x + 83, y - 1);
    ctx.lineTo(x + 82, y + 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Muso.
    ctx.fillStyle = "#a6aeb3";
    ctx.beginPath();
    ctx.ellipse(x + 84, y + 28, 12, 8, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Naso.
    ctx.fillStyle = "#3a2a22";
    ctx.beginPath();
    ctx.arc(x + 94
