
"use strict";

/* =========================================================
   LUPO RUNNER — VERSIONE COMPLETA
   - Lupo animato con PNG e fallback disegnato
   - Angelo PNG in volo
   - Serpente disegnato e animato in JavaScript
   - Pecora PNG che può lanciare gomitoli
   - Cassa musicale e cuore viola disegnati
   - Punteggio, record, pausa, fullscreen e classifica
========================================================= */

const LEADERBOARD_API_URL =
    "https://script.google.com/macros/s/AKfycbxJgp0aOu-zdvidw2ktjx2PiT3SLC7CQWycYAzEEfggzl_1bEE1zfdYAPsXuHg1hoYO/exec";

/* ================= ELEMENTI HTML ================= */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;

const loadingScreen = document.getElementById("loadingScreen");
const gameArea = document.getElementById("gameArea");

const startButton = document.getElementById("startGame");
const jumpButton = document.getElementById("jumpGame");
const pauseButton = document.getElementById("pauseGame");
const fullscreenButton = document.getElementById("fullscreenBtn");
const refreshBoardButton = document.getElementById("refreshBoard");
const backToListButton = document.getElementById("backToList");

const scoreElement = document.getElementById("score");
const bestElement = document.getElementById("personalBest");
const leaderboardBody = document.getElementById("leaderboardBody");
const leaderboardStatus = document.getElementById("leaderboardStatus");
const gameMessage = document.getElementById("gameMessage");

/* ================= IMMAGINI ================= */

// Percorso relativo a giochi/gioco.js.
// I nomi corrispondono ESATTAMENTE alla struttura GitHub.
const MODEL_PATH = "../assets/modelli/modello_gioco_corsa/";

function caricaImmagine(nomeFile) {
    const img = new Image();
    img.src = MODEL_PATH + nomeFile;
    img.onload = () => {
        if (!gameRunning && ctx) renderStatico();
    };
    img.onerror = () => {
        console.warn("Immagine non caricata:", img.src);
    };
    return img;
}

const immagini = {
    lupoFrame1: caricaImmagine("lupo_run1.png"),
    lupoFrame2: caricaImmagine("lupo_run2.png"),
    pecora: caricaImmagine("pecora.png"),
    angelo: caricaImmagine("angelo.png")
};

function immagineDisponibile(img) {
    return Boolean(img && img.complete && img.naturalWidth > 0);
}

/* ================= DIMENSIONI ================= */

const W = 800;
const H = 400;
const groundY = H - 80;

if (canvas) {
    canvas.width = W;
    canvas.height = H;
}

let gameRunning = false;
let gamePaused = false;
let animationFrameId = null;

let score = 0;
let personalBest = Number(localStorage.getItem("lupo_runner_best")) || 0;
let gameSpeed = 5;
let frameCount = 0;
let nextObstacleFrame = 90;

let obstacles = [];
let projectiles = [];

if (bestElement) bestElement.textContent = personalBest;

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
        if (!ctx) return;

        const frame = Math.floor(frameCount / 7) % 2 === 0
            ? immagini.lupoFrame1
            : immagini.lupoFrame2;

        if (immagineDisponibile(frame)) {
            ctx.drawImage(frame, this.x, this.y, this.width, this.height);
        } else {
            // Fallback vettoriale: lupo di profilo, non un cubo.
            this.drawWolfFallback();
        }
    },

    drawWolfFallback() {
        const x = this.x;
        const y = this.y;
        const w = this.width;
        const h = this.height;

        ctx.save();
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        // Ombra a terra.
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath();
        ctx.ellipse(x + w * 0.48, groundY - 2, 35, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Coda.
        ctx.strokeStyle = "#5A6268";
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(x + 22, y + 32);
        ctx.quadraticCurveTo(x + 2, y + 24, x + 4, y + 9);
        ctx.quadraticCurveTo(x + 17, y + 18, x + 28, y + 23);
        ctx.stroke();

        // Corpo.
        ctx.fillStyle = "#7F888F";
        ctx.strokeStyle = "#1E2022";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(x + 43, y + 39, 32, 18, -0.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Pancia.
        ctx.fillStyle = "#B0B7BC";
        ctx.beginPath();
        ctx.ellipse(x + 49, y + 48, 20, 8, 0.05, 0, Math.PI * 2);
        ctx.fill();

        // Zampe alternate durante la corsa.
        const step = Math.floor(frameCount / 5) % 2;
        ctx.strokeStyle = "#5A6268";
        ctx.lineWidth = 8;

        const legPairs = step
            ? [[31, 49, 24, 59], [48, 49, 57, 60], [65, 47, 72, 57]]
            : [[31, 49, 37, 60], [48, 49, 42, 59], [65, 47, 60, 59]];

        for (const leg of legPairs) {
            ctx.beginPath();
            ctx.moveTo(x + leg[0], y + leg[1]);
            ctx.lineTo(x + leg[2], y + leg[3]);
            ctx.stroke();
        }

        // Collo e testa.
        ctx.fillStyle = "#7F888F";
        ctx.beginPath();
        ctx.ellipse(x + 69, y + 25, 17, 16, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Muso rivolto a destra.
        ctx.fillStyle = "#B0B7BC";
        ctx.beginPath();
        ctx.moveTo(x + 73, y + 28);
        ctx.lineTo(x + 91, y + 32);
        ctx.lineTo(x + 75, y + 38);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Orecchio.
        ctx.fillStyle = "#5A6268";
        ctx.beginPath();
        ctx.moveTo(x + 60, y + 18);
        ctx.lineTo(x + 61, y + 1);
        ctx.lineTo(x + 73, y + 15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Occhio.
        ctx.fillStyle = "#EAE6DF";
        ctx.beginPath();
        ctx.ellipse(x + 76, y + 23, 4.2, 3.2, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#005B66";
        ctx.beginPath();
        ctx.arc(x + 78, y + 23, 2, 0, Math.PI * 2);
        ctx.fill();

        // Naso.
        ctx.fillStyle = "#1E2022";
        ctx.beginPath();
        ctx.arc(x + 89, y + 32, 3, 0, Math.PI * 2);
        ctx.fill();

        // Dettaglio turchese sulla schiena.
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
        this.markedForDeletion = false;
        this.phase = Math.random() * Math.PI * 2;

        switch (type) {
            case "pecora":
                this.width = 55;
                this.height = 48;
                this.y = groundY - this.height;
                this.willThrow = Math.random() < 1 / 3;
                this.hasThrown = false;
                break;

            case "angelo":
                this.width = 76;
                this.height = 48;
                this.y = groundY - 145;
                this.baseY = this.y;
                this.dipsDown = Math.random() < 0.35;
                this.dipStarted = false;
                this.dipSpeed = 1.2;
                break;

            case "serpente":
                this.width = 62;
                this.height = 29;
                this.y = groundY - this.height;
                break;

            case "cassa":
                this.width = 44;
                this.height = 44;
                this.y = groundY - this.height;
                break;

            case "cuore":
                this.width = 37;
                this.height = 37;
                this.y = groundY - this.height;
                break;
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
                    this.y + this.dipSpeed,
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
                new Projectile(this.x + 8, this.y + this.height * 0.55)
            );
            this.hasThrown = true;
        }

        if (this.x + this.width < 0) {
            this.markedForDeletion = true;
        }
    }

    draw() {
        if (!ctx) return;

        switch (this.type) {
            case "pecora":
                if (immagineDisponibile(immagini.pecora)) {
                    ctx.drawImage(
                        immagini.pecora,
                        this.x, this.y, this.width, this.height
                    );
                } else {
                    this.drawSheepFallback();
                }
                break;

            case "angelo":
                if (immagineDisponibile(immagini.angelo)) {
                    ctx.drawImage(
                        immagini.angelo,
                        this.x, this.y, this.width, this.height
                    );
                } else {
                    this.drawAngelFallback();
                }
                break;

            case "serpente":
                this.drawSnake();
                break;

            case "cassa":
                this.drawCassa();
                break;

            case "cuore":
                this.drawHeart();
                break;
        }
    }

    drawSheepFallback() {
        const x = this.x;
        const y = this.y;

        ctx.fillStyle = "#EAE6DF";
        ctx.strokeStyle = "#3A3A40";
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

        for (const legX of [15, 28, 39]) {
            ctx.beginPath();
            ctx.moveTo(x + legX, y + 35);
            ctx.lineTo(x + legX, y + 45);
            ctx.stroke();
        }

        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(x + 47, y + 19, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    drawAngelFallback() {
        // Angelo stilizzato in volo orizzontale.
        const x = this.x;
        const y = this.y;
        const bob = Math.sin(this.phase) * 2;

        ctx.save();
        ctx.translate(x, y + bob);
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        // Ali distese dietro.
        ctx.fillStyle = "#EAE6DF";
        ctx.strokeStyle = "#AAB5C0";
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(27, 27);
        ctx.quadraticCurveTo(15, 4, 0, 3);
        ctx.quadraticCurveTo(7, 18, 18, 29);
        ctx.quadraticCurveTo(7, 21, 4, 14);
        ctx.quadraticCurveTo(17, 20, 27, 27);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(31, 29);
        ctx.quadraticCurveTo(18, 40, 4, 42);
        ctx.quadraticCurveTo(15, 27, 29, 25);
        ctx.fill();
        ctx.stroke();

        // Corpo e tunica.
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

        // Fascia dorata.
        ctx.strokeStyle = "#D5A64C";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(37, 23);
        ctx.lineTo(44, 33);
        ctx.stroke();

        // Testa.
        ctx.fillStyle = "#F0C6A4";
        ctx.beginPath();
        ctx.arc(51, 17, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Capelli.
        ctx.fillStyle = "#B87940";
        ctx.beginPath();
        ctx.arc(50, 14, 7, Math.PI, Math.PI * 2);
        ctx.fill();

        // Braccio teso in avanti, posa Superman.
        ctx.strokeStyle = "#F0C6A4";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(42, 24);
        ctx.lineTo(57, 19);
        ctx.lineTo(72, 13);
        ctx.stroke();

        // Mano.
        ctx.fillStyle = "#F0C6A4";
        ctx.beginPath();
        ctx.arc(73, 13, 3, 0, Math.PI * 2);
        ctx.fill();

        // Gambe all'indietro.
        ctx.strokeStyle = "#EAE6DF";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(32, 30);
        ctx.lineTo(22, 36);
        ctx.lineTo(13, 34);
        ctx.moveTo(38, 32);
        ctx.lineTo(31, 40);
        ctx.lineTo(23, 40);
        ctx.stroke();

        // Aureola.
        ctx.strokeStyle = "#F3CF65";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(51, 6, 7, 3, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    drawSnake() {
        // Serpente ondulato disegnato direttamente nel canvas.
        const x = this.x;
        const y = this.y;
        const w = this.width;
        const h = this.height;

        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const wave = this.phase + frameCount * 0.12;

        // Ombra.
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 12;
        ctx.beginPath();

        for (let i = 0; i <= 12; i++) {
            const px = x + (i / 12) * w;
            const py = y + h * 0.62 +
                Math.sin(i * 0.8 + wave) * 6;

            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }

        ctx.stroke();

        // Corpo verde scuro.
        ctx.strokeStyle = "#245B3D";
        ctx.lineWidth = 12;
        ctx.beginPath();

        for (let i = 0; i <= 12; i++) {
            const px = x + (i / 12) * w;
            const py = y + h * 0.52 +
                Math.sin(i * 0.8 + wave) * 6;

            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }

        ctx.stroke();

        // Dorso verde.
        ctx.strokeStyle = "#59A65A";
        ctx.lineWidth = 7;
        ctx.beginPath();

        for (let i = 0; i <= 12; i++) {
            const px = x + (i / 12) * w;
            const py = y + h * 0.47 +
                Math.sin(i * 0.8 + wave) * 6;

            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }

        ctx.stroke();

        // Testa rivolta verso il giocatore.
        const headX = x + w - 4;
        const headY = y + h * 0.45 + Math.sin(12 * 0.8 + wave) * 6;

        ctx.fillStyle = "#397A45";
        ctx.strokeStyle = "#173C2A";
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.ellipse(headX, headY - 3, 10, 7, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Occhio giallo.
        ctx.fillStyle = "#F3D35C";
        ctx.beginPath();
        ctx.arc(headX + 3, headY - 5, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#17251A";
        ctx.beginPath();
        ctx.arc(headX + 4, headY - 5, 1, 0, Math.PI * 2);
        ctx.fill();

        // Lingua biforcuta.
        ctx.strokeStyle = "#D94C65";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(headX + 8, headY);
        ctx.lineTo(headX + 14, headY + 2);
        ctx.lineTo(headX + 17, headY);
        ctx.moveTo(headX + 14, headY + 2);
        ctx.lineTo(headX + 16, headY + 5);
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
        this.markedForDeletion = false;
        this.rotation = 0;
    }

    update() {
        this.x -= this.speedX;
        this.rotation += 0.12;

        if (this.x + this.radius < 0) {
            this.markedForDeletion = true;
        }
    }

    draw() {
        if (!ctx) return;

        const r = this.radius;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        ctx.fillStyle = "#D6B4FF";
        ctx.strokeStyle = "#8B5AC7";
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-r * 0.7, -r * 0.2);
        ctx.quadraticCurveTo(0, -r * 0.9, r * 0.65, -r * 0.1);
        ctx.moveTo(-r * 0.65, r * 0.35);
        ctx.quadraticCurveTo(0, -r * 0.2, r * 0.7, r * 0.4);
        ctx.moveTo(-r * 0.2, -r * 0.8);
        ctx.quadraticCurveTo(-r * 0.8, 0, r * 0.15, r * 0.85);
        ctx.stroke();

        ctx.restore();
    }
}

/* ================= GENERAZIONE OSTACOLI ================= */

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

    obstacles.forEach((obs) => {
        obs.update();
        obs.draw();
    });

    projectiles.forEach((proj) => {
        proj.update();
        proj.draw();
    });

    obstacles = obstacles.filter((obs) => !obs.markedForDeletion);
    projectiles = projectiles.filter((proj) => !proj.markedForDeletion);
}

/* ================= COLLISIONI ================= */

function checkCollisions() {
    const pBox = {
        x: lupo.x + 16,
        y: lupo.y + 10,
        w: lupo.width - 28,
        h: lupo.height - 16
    };

    for (const obs of obstacles) {
        // Collisione leggermente tollerante per serpente e angelo.
        const marginX = obs.type === "serpente" ? 8 : 6;
        const marginY = obs.type === "serpente" ? 5 : 5;

        if (
            pBox.x < obs.x + obs.width - marginX &&
            pBox.x + pBox.w > obs.x + marginX &&
            pBox.y < obs.y + obs.height - marginY &&
            pBox.y + pBox.h > obs.y + marginY
        ) {
            gameOver();
            return;
        }
    }

    for (const proj of projectiles) {
        if (
            pBox.x < proj.x + proj.radius * 0.75 &&
            pBox.x + pBox.w > proj.x - proj.radius * 0.75 &&
            pBox.y < proj.y + proj.radius * 0.75 &&
            pBox.y + pBox.h > proj.y - proj.radius * 0.75
        ) {
            gameOver();
            return;
        }
    }
}

/* ================= AMBIENTE ================= */

function drawEnvironment() {
    if (!ctx) return;

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

/* ================= RENDER STATICO ================= */

function renderStatico() {
    if (!ctx || gameRunning) return;

    ctx.clearRect(0, 0, W, H);
    drawEnvironment();
    lupo.draw();
}

/* ================= CICLO DI GIOCO ================= */

function gameLoop() {
    if (!gameRunning || gamePaused || !ctx) return;

    ctx.clearRect(0, 0, W, H);

    drawEnvironment();
    lupo.update();
    lupo.draw();
    handleObstacles();

    if (!gameRunning) return;

    checkCollisions();

    if (!gameRunning) return;

    score++;

    if (scoreElement) {
        scoreElement.textContent = Math.floor(score / 5);
    }

    if (score % 500 === 0) {
        gameSpeed = Math.min(gameSpeed + 0.35, 10);
    }

    animationFrameId = requestAnimationFrame(gameLoop);
}

/* ================= AVVIO ================= */

function startGame() {
    if (gameRunning) return;

    cancelAnimationFrame(animationFrameId);

    gameRunning = true;
    gamePaused = false;
    score = 0;
    gameSpeed = 5;
    frameCount = 0;
    nextObstacleFrame = 90;
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

    gameLoop();
}

/* ================= GAME OVER ================= */

function gameOver() {
    if (!gameRunning) return;

    gameRunning = false;
    gamePaused = false;

    cancelAnimationFrame(animationFrameId);

    const finalScore = Math.floor(score / 5);

    if (gameMessage) {
        gameMessage.textContent =
            `GAME OVER! Punti realizzati: ${finalScore}`;
    }

    if (finalScore > personalBest) {
        personalBest = finalScore;
        localStorage.setItem("lupo_runner_best", String(personalBest));

        if (bestElement) bestElement.textContent = personalBest;
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

    submitScore(finalScore);
}

/* ================= PAUSA ================= */

function togglePause() {
    if (!gameRunning) return;

    gamePaused = !gamePaused;

    if (gamePaused) {
        if (pauseButton) pauseButton.textContent = "RIPRENDI";
        if (gameMessage) gameMessage.textContent = "Gioco in pausa";
        cancelAnimationFrame(animationFrameId);
    } else {
        if (pauseButton) pauseButton.textContent = "PAUSA";
        if (gameMessage) gameMessage.textContent = "Gioco ripreso!";
        gameLoop();
    }
}

/* ================= CONTROLLI ================= */

window.addEventListener("keydown", (e) => {
    if (e.code !== "Space" && e.code !== "ArrowUp") return;

    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    e.preventDefault();

    if (!gameRunning && startButton && !startButton.disabled) {
        startGame();
    } else {
        lupo.jump();
    }
});

function handleJumpTouch(e) {
    if (e) e.preventDefault();
    if (gameRunning && !gamePaused) lupo.jump();
}

if (jumpButton) {
    jumpButton.addEventListener("touchstart", handleJumpTouch, {
        passive: false
    });

    jumpButton.addEventListener("click", handleJumpTouch);
}

const canvasWrapper = document.querySelector(".canvas-wrapper");

if (canvasWrapper) {
    canvasWrapper.addEventListener("pointerdown", (e) => {
        if (
            e.target.closest("button") ||
            e.target.closest("input") ||
            e.target.closest("textarea")
        ) {
            return;
        }

        if (gameRunning && !gamePaused) lupo.jump();
    });
} else if (canvas) {
    canvas.addEventListener("pointerdown", () => {
        if (gameRunning && !gamePaused) lupo.jump();
    });
}

if (startButton) startButton.addEventListener("click", startGame);
if (pauseButton) pauseButton.addEventListener("click", togglePause);

/* ================= FULLSCREEN ================= */

if (fullscreenButton) {
    fullscreenButton.addEventListener("click", async () => {
        const wrapper =
            document.querySelector(".canvas-wrapper") || canvas;

        if (!wrapper) return;

        try {
            if (!document.fullscreenElement) {
                if (wrapper.requestFullscreen) {
                    await wrapper.requestFullscreen();
                } else if (wrapper.webkitRequestFullscreen) {
                    wrapper.webkitRequestFullscreen();
                }
            } else if (document.exitFullscreen) {
                await document.exitFullscreen();
            }
        } catch (err) {
            console.error("Fullscreen non disponibile:", err);
        }
    });
}

/* ================= TORNA ALLA LISTA ================= */

if (backToListButton) {
    backToListButton.addEventListener("click", () => {
        window.location.href = "../index.html";
    });
}

/* ================= CLASSIFICA ONLINE ================= */

if (refreshBoardButton) {
    refreshBoardButton.addEventListener("click", fetchLeaderboard);
}

async function fetchLeaderboard() {
    if (leaderboardStatus) {
        leaderboardStatus.textContent = "Aggiornamento classifica...";
    }

    try {
        const response = await fetch(LEADERBOARD_API_URL);

        if (!response.ok) {
            throw new Error("Risposta del server non valida");
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("Formato classifica non valido");
        }

        if (leaderboardBody) {
            leaderboardBody.innerHTML = "";

            data.slice(0, 5).forEach((item, index) => {
                const tr = document.createElement("tr");
                const tdPosizione = document.createElement("td");
                const tdNome = document.createElement("td");
                const tdPunti = document.createElement("td");

                tdPosizione.textContent = String(index + 1);
                tdNome.textContent = item.nome || "Giocatore";
                tdPunti.textContent = String(item.punti || 0);

                tr.append(tdPosizione, tdNome, tdPunti);
                leaderboardBody.appendChild(tr);
            });

            if (data.length === 0) {
                leaderboardBody.innerHTML =
                    '<tr><td colspan="3">Ancora nessun punteggio</td></tr>';
            }
        }

        if (leaderboardStatus) leaderboardStatus.textContent = "";
    } catch (err) {
        console.error("Errore caricamento classifica:", err);

        if (leaderboardBody) {
            leaderboardBody.innerHTML =
                '<tr><td colspan="3">Impossibile caricare la classifica</td></tr>';
        }

        if (leaderboardStatus) {
            leaderboardStatus.textContent = "Classifica non disponibile";
        }
    }
}

async function submitScore(points) {
    if (points <= 0) return;

    const playerName = (
        prompt("Inserisci il tuo nome per la classifica:") || "Anonimo"
    ).trim().slice(0, 30) || "Anonimo";

    try {
        await fetch(LEADERBOARD_API_URL, {
            method: "POST",
            mode: "no-cors",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                nome: playerName,
                punti: points
            })
        });

        setTimeout(fetchLeaderboard, 1500);
    } catch (err) {
        console.error("Errore invio punteggio:", err);
    }
}

/* ================= INIZIALIZZAZIONE ================= */

function inizializzaGioco() {
    if (loadingScreen) loadingScreen.style.display = "none";
    if (gameArea) gameArea.classList.add("visible");

    if (jumpButton) jumpButton.disabled = true;
    if (pauseButton) pauseButton.disabled = true;

    renderStatico();
    fetchLeaderboard();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inizializzaGioco);
} else {
    inizializzaGioco();
}
