"use strict";

/* =========================================================
   LUPO RUNNER — VERSIONE SICURA MOBILE & DESKTOP
========================================================= */

const LEADERBOARD_API_URL =
    "https://script.google.com/macros/s/AKfycbxJgp0aOu-zdvidw2ktjx2PiT3SLC7CQWycYAzEEfggzl_1bEE1zfdYAPsXuHg1hoYO/exec";

/* =========================================================
   ELEMENTI HTML
========================================================= */

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

/* =========================================================
   CANVAS E COSTANTI DI GIOCO
========================================================= */

const W = 800;
const H = 400;

if (canvas) {
    canvas.width = W;
    canvas.height = H;
}

const groundY = H - 80;

/* =========================================================
   DIFFICOLTÀ E STATO DEL GIOCO
========================================================= */

let gameRunning = false;
let gamePaused = false;
let animationFrameId = null;

let score = 0;
let personalBest = localStorage.getItem("lupo_runner_best") || 0;
if (bestElement) bestElement.textContent = personalBest;

let gameSpeed = 5;
let frameCount = 0;

/* =========================================================
   PERSONAGGIO (LUPO)
========================================================= */

const lupo = {
    x: 80,
    y: groundY - 60,
    width: 50,
    height: 60,
    vy: 0,
    gravity: 0.8,
    jumpPower: -14,
    isJumping: false,

    draw() {
        if (!ctx) return;
        ctx.fillStyle = "#4a5568";
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        ctx.fillStyle = "#2d3748";
        ctx.beginPath();
        ctx.moveTo(this.x + 10, this.y);
        ctx.lineTo(this.x + 20, this.y - 15);
        ctx.lineTo(this.x + 30, this.y);
        ctx.fill();

        ctx.fillStyle = "#ecc94b";
        ctx.fillRect(this.x + 35, this.y + 10, 8, 8);
    },

    update() {
        if (this.isJumping) {
            this.vy += this.gravity;
            this.y += this.vy;

            if (this.y >= groundY - this.height) {
                this.y = groundY - this.height;
                this.isJumping = false;
                this.vy = 0;
            }
        }
    },

    jump() {
        if (!this.isJumping && gameRunning && !gamePaused) {
            this.isJumping = true;
            this.vy = this.jumpPower;
        }
    }
};

/* =========================================================
   OSTACOLI E PROIETTILI
========================================================= */

let obstacles = [];
let projectiles = [];

class Obstacle {
    constructor(type) {
        this.type = type;
        this.x = W + 50;
        this.markedForDeletion = false;

        if (type === "pecora") {
            this.width = 45;
            this.height = 40;
            this.y = groundY - this.height;
            this.hasThrown = false;
        } else if (type === "angelo") {
            this.width = 40;
            this.height = 40;
            this.y = -50;
            this.targetY = groundY - 100;
            this.speedY = 3;
        } else {
            this.width = 30;
            this.height = 50;
            this.y = groundY - this.height;
        }
    }

    update() {
        this.x -= gameSpeed;

        if (this.type === "angelo" && this.y < this.targetY) {
            this.y += this.speedY;
        }

        if (this.type === "pecora" && !this.hasThrown && this.x < W - 250) {
            projectiles.push(new Projectile(this.x, this.y + 10));
            this.hasThrown = true;
        }

        if (this.x + this.width < 0) {
            this.markedForDeletion = true;
        }
    }

    draw() {
        if (!ctx) return;
        if (this.type === "pecora") {
            ctx.fillStyle = this.hasThrown ? "#a0aec0" : "#edf2f7";
            ctx.fillRect(this.x, this.y, this.width, this.height);
        } else if (this.type === "angelo") {
            ctx.fillStyle = "#e2e8f0";
            ctx.beginPath();
            ctx.arc(this.x + 20, this.y + 20, 20, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = "#e53e3e";
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}

class Projectile {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 12;
        this.speedX = gameSpeed + 3;
        this.markedForDeletion = false;
    }

    update() {
        this.x -= this.speedX;
        if (this.x + this.radius < 0) {
            this.markedForDeletion = true;
        }
    }

    draw() {
        if (!ctx) return;
        ctx.fillStyle = "#dd6b20";
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

function handleObstacles() {
    frameCount++;

    if (frameCount % 120 === 0) {
        const types = ["pecora", "angelo", "basso"];
        const randomType = types[Math.floor(Math.random() * types.length)];
        obstacles.push(new Obstacle(randomType));
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

function checkCollisions() {
    const pBox = {
        x: lupo.x + 5,
        y: lupo.y + 5,
        w: lupo.width - 10,
        h: lupo.height - 10
    };

    for (let obs of obstacles) {
        if (obs.type === "pecora" && obs.hasThrown) continue;

        if (
            pBox.x < obs.x + obs.width &&
            pBox.x + pBox.w > obs.x &&
            pBox.y < obs.y + obs.height &&
            pBox.y + pBox.h > obs.y
        ) {
            gameOver();
            return;
        }
    }

    for (let proj of projectiles) {
        if (
            pBox.x < proj.x + proj.radius &&
            pBox.x + pBox.w > proj.x - proj.radius &&
            pBox.y < proj.y + proj.radius &&
            pBox.y + pBox.h > proj.y - proj.radius
        ) {
            gameOver();
            return;
        }
    }
}

function drawEnvironment() {
    if (!ctx) return;
    ctx.fillStyle = "#1a202c";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#2d3748";
    ctx.fillRect(0, groundY, W, H - groundY);

    ctx.strokeStyle = "#4a5568";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();
}

function gameLoop() {
    if (!gameRunning || gamePaused || !ctx) return;

    ctx.clearRect(0, 0, W, H);
    drawEnvironment();

    lupo.update();
    lupo.draw();

    handleObstacles();
    checkCollisions();

    score++;
    if (scoreElement) scoreElement.textContent = Math.floor(score / 5);

    if (score % 500 === 0) {
        gameSpeed += 0.5;
    }

    animationFrameId = requestAnimationFrame(gameLoop);
}

function startGame() {
    if (gameRunning) return;

    gameRunning = true;
    gamePaused = false;
    score = 0;
    gameSpeed = 5;
    frameCount = 0;
    obstacles = [];
    projectiles = [];

    lupo.y = groundY - lupo.height;
    lupo.isJumping = false;

    if (startButton) startButton.disabled = true;
    if (jumpButton) jumpButton.disabled = false;
    if (pauseButton) pauseButton.disabled = false;
    if (gameMessage) gameMessage.textContent = "Corri e schiva gli ostacoli!";

    gameLoop();
}

function gameOver() {
    gameRunning = false;
    cancelAnimationFrame(animationFrameId);

    const finalScore = Math.floor(score / 5);
    if (gameMessage) gameMessage.textContent = `GAME OVER! Punti realizzati: ${finalScore}`;

    if (finalScore > personalBest) {
        personalBest = finalScore;
        localStorage.setItem("lupo_runner_best", personalBest);
        if (bestElement) bestElement.textContent = personalBest;
    }

    if (startButton) startButton.disabled = false;
    if (jumpButton) jumpButton.disabled = true;
    if (pauseButton) pauseButton.disabled = true;

    submitScore(finalScore);
}

function togglePause() {
    if (!gameRunning) return;

    gamePaused = !gamePaused;
    if (!gamePaused) {
        if (pauseButton) pauseButton.textContent = "PAUSA";
        if (gameMessage) gameMessage.textContent = "Gioco Ripreso!";
        gameLoop();
    } else {
        if (pauseButton) pauseButton.textContent = "RIPRENDI";
        if (gameMessage) gameMessage.textContent = "Gioco in Pausa";
    }
}

/* =========================================================
   CONTROLLI E EVENTI
========================================================= */

window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        if (!gameRunning && startButton && !startButton.disabled) {
            startGame();
        } else {
            lupo.jump();
        }
    }
});

function handleJumpTouch(e) {
    if (e) e.preventDefault();
    if (gameRunning && !gamePaused) {
        lupo.jump();
    }
}

if (canvas) {
    canvas.addEventListener("touchstart", handleJumpTouch, { passive: false });
    canvas.addEventListener("mousedown", handleJumpTouch);
}

if (jumpButton) {
    jumpButton.addEventListener("touchstart", handleJumpTouch, { passive: false });
    jumpButton.addEventListener("click", handleJumpTouch);
}

if (startButton) startButton.addEventListener("click", startGame);
if (pauseButton) pauseButton.addEventListener("click", togglePause);

if (fullscreenButton) {
    fullscreenButton.addEventListener("click", () => {
        const wrapper = document.querySelector(".canvas-wrapper") || canvas;
        if (!document.fullscreenElement) {
            if (wrapper.requestFullscreen) wrapper.requestFullscreen();
            else if (wrapper.webkitRequestFullscreen) wrapper.webkitRequestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    });
}

if (backToListButton) {
    backToListButton.addEventListener("click", () => {
        window.location.href = "../index.html";
    });
}

if (refreshBoardButton) {
    refreshBoardButton.addEventListener("click", fetchLeaderboard);
}

/* =========================================================
   CLASSIFICA
========================================================= */

async function fetchLeaderboard() {
    if (leaderboardStatus) leaderboardStatus.textContent = "Aggiornamento classifica...";
    try {
        const response = await fetch(LEADERBOARD_API_URL);
        const data = await response.json();
        
        if (leaderboardBody) {
            leaderboardBody.innerHTML = "";
            data.slice(0, 5).forEach((item, index) => {
                const tr = document.createElement("tr");
                tr.innerHTML = `<td>${index + 1}</td><td>${item.nome || 'Giocatore'}</td><td>${item.punti || 0}</td>`;
                leaderboardBody.appendChild(tr);
            });
        }
        if (leaderboardStatus) leaderboardStatus.textContent = "";
    } catch (err) {
        if (leaderboardBody) {
            leaderboardBody.innerHTML = `<tr><td colspan="3">Impossibile caricare la classifica</td></tr>`;
        }
        if (leaderboardStatus) leaderboardStatus.textContent = "";
    }
}

async function submitScore(points) {
    if (points <= 0) return;
    const playerName = prompt("Nuovo Punteggio! Inserisci il tuo nome per la classifica:") || "Anonimo";
    try {
        await fetch(LEADERBOARD_API_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome: playerName, punti: points })
        });
        setTimeout(fetchLeaderboard, 1000);
    } catch (e) {
        console.error("Errore invio punteggio:", e);
    }
}

/* =========================================================
   INIZIALIZZAZIONE SICURA ( RIMUOVE LO SCHERMO NERO )
========================================================= */

window.addEventListener("DOMContentLoaded", () => {
    if (loadingScreen) {
        loadingScreen.style.display = "none";
    }
    if (gameArea) {
        gameArea.classList.add("visible");
    }
    drawEnvironment();
    lupo.draw();
    fetchLeaderboard();
});
