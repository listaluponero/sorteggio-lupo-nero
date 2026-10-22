
"use strict";

/* =========================================================
   LUPO RUNNER — VERSIONE CON MODELLI PERSONALIZZATI
   PNG: lupo, pecora, angelo, serpente
   Disegni JavaScript: cassa musicale, cuore viola, gomitolo
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

/* ================= CARICAMENTO IMMAGINI ================= */

// ATTENZIONE: percorso relativo a giochi/gioco.js.
const MODEL_PATH = "../assets/modelli/modello_gioco_corsa/";

function caricaImmagine(nomeFile) {
    const img = new Image();
    img.src = MODEL_PATH + nomeFile;
    return img;
}

const immagini = {
    lupoFrame1: caricaImmagine("luporun1.png"),
    lupoFrame2: caricaImmagine("luporun2.png"),
    pecora: caricaImmagine("pecora.png"),
    angelo: caricaImmagine("angelo.png"),
    serpente: caricaImmagine("serpente.png")
};

function immagineDisponibile(img) {
    return Boolean(img && img.complete && img.naturalWidth > 0);
}

/* ================= CANVAS E STATO ================= */

const W = 800;
const H = 400;

if (canvas) {
    canvas.width = W;
    canvas.height = H;
}

const groundY = H - 80;

let gameRunning = false;
let gamePaused = false;
let animationFrameId = null;

let score = 0;
let personalBest = Number(localStorage.getItem("lupo_runner_best")) || 0;

if (bestElement) bestElement.textContent = personalBest;

let gameSpeed = 5;
let frameCount = 0;
let nextObstacleFrame = 90;

let obstacles = [];
let projectiles = [];

/* ================= LUPO ================= */

const lupo = {
    x: 70,
    y: groundY - 60,
    width: 75,
    height: 60,
    vy: 0,
    gravity: 0.8,
    jumpPower: -14,
    isJumping: false,

    draw() {
        if (!ctx) return;

        let img = immagini.lupoFrame1;

        if (gameRunning && !gamePaused && !this.isJumping) {
            img = Math.floor(frameCount / 8) % 2 === 0
                ? immagini.lupoFrame1
                : immagini.lupoFrame2;
        }

        if (immagineDisponibile(img)) {
            ctx.drawImage(img, this.x, this.y, this.width, this.height);
        } else {
            // Fallback visibile se il PNG non è ancora caricato.
            ctx.fillStyle = "#7F888F";
            ctx.fillRect(
                this.x + 8,
                this.y + 12,
                this.width - 16,
                this.height - 12
            );
        }
    },

    update() {
        if (!this.isJumping) return;

        this.vy += this.gravity;
        this.y += this.vy;

        if (this.y >= groundY - this.height) {
            this.y = groundY - this.height;
            this.vy = 0;
            this.isJumping = false;
        }
    },

    jump() {
        if (!gameRunning || gamePaused || this.isJumping) return;

        this.isJumping = true;
        this.vy = this.jumpPower;
    }
};

/* ================= OSTACOLI ================= */

class Obstacle {
    constructor(type) {
        this.type = type;
        this.x = W + 40;
        this.markedForDeletion = false;
        this.phase = Math.random() * Math.PI * 2;

        switch (type) {
            case "pecora":
                this.width = 52;
                this.height = 46;
                this.y = groundY - this.height;
                this.willThrow = Math.random() < (1 / 3);
                this.hasThrown = false;
                break;

            case "angelo":
                this.width = 48;
                this.height = 48;
                this.y = groundY - 145;
                this.baseY = this.y;
                this.speedY = 1.5 + Math.random() * 1.5;
                this.dipsDown = Math.random() < 0.35;
                this.dipStarted = false;
                break;

            case "serpente":
                this.width = 54;
                this.height = 30;
                this.y = groundY - this.height;
                break;

            case "cassa":
                this.width = 43;
                this.height = 43;
                this.y = groundY - this.height;
                break;

            case "cuore":
                this.width = 36;
                this.height = 36;
                this.y = groundY - this.height;
                break;
        }
    }

    update() {
        this.x -= gameSpeed;

        if (this.type === "angelo") {
            this.phase += 0.045;

            if (this.dipsDown && !this.dipStarted && this.x < W * 0.72) {
                this.dipStarted = true;
            }

            if (this.dipsDown && this.dipStarted) {
                this.y += this.speedY;
                this.y = Math.min(
                    this.y,
                    groundY - this.height - 8
                );
            } else {
                this.y = this.baseY + Math.sin(this.phase) * 8;
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
                    this.x + 10,
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
        if (!ctx) return;

        if (this.type === "pecora") {
            if (immagineDisponibile(immagini.pecora)) {
                ctx.drawImage(
                    immagini.pecora,
                    this.x,
                    this.y,
                    this.width,
                    this.height
                );
            } else {
                ctx.fillStyle = "#EAE6DF";
                ctx.fillRect(this.x, this.y, this.width, this.height);
            }

        } else if (this.type === "angelo") {
            if (immagineDisponibile(immagini.angelo)) {
                ctx.drawImage(
                    immagini.angelo,
                    this.x,
                    this.y,
                    this.width,
                    this.height
                );
            } else {
                this.drawFallbackAngelo();
            }

        } else if (this.type === "serpente") {
            if (immagineDisponibile(immagini.serpente)) {
                ctx.drawImage(
                    immagini.serpente,
                    this.x,
                    this.y,
                    this.width,
                    this.height
                );
            } else {
                this.drawFallbackSerpente();
            }

        } else if (this.type === "cassa") {
            this.drawCassa();

        } else if (this.type === "cuore") {
            this.drawCuoreViola();
        }
    }

    drawFallbackAngelo() {
        ctx.fillStyle = "#EAE6DF";

        ctx.beginPath();
        ctx.ellipse(
            this.x + this.width / 2,
            this.y + this.height / 2,
            this.width / 2,
            this.height / 2,
            0,
            0,
            Math.PI * 2
        );
        ctx.fill();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.x + 5, this.y + 16);
        ctx.lineTo(this.x - 7, this.y + 5);
        ctx.moveTo(this.x + this.width - 5, this.y + 16);
        ctx.lineTo(this.x + this.width + 7, this.y + 5);
        ctx.stroke();
    }

    drawFallbackSerpente() {
        ctx.strokeStyle = "#43A66B";
        ctx.lineWidth = 8;
        ctx.lineCap = "round";
        ctx.beginPath();

        for (let i = 0; i <= 5; i++) {
            const px = this.x + i * (this.width / 5);
            const py = this.y + 15 +
                Math.sin(i * 1.5 + this.phase) * 7;

            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }

        ctx.stroke();
        ctx.lineCap = "butt";
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

    drawCuoreViola() {
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

/* ================= GENERAZIONE ================= */

function handleObstacles() {
    frameCount++;

    if (frameCount >= nextObstacleFrame) {
        const types = [
            "pecora",
            "angelo",
            "serpente",
            "cassa",
            "cuore"
        ];

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
        x: lupo.x + 12,
        y: lupo.y + 8,
        w: lupo.width - 24,
        h: lupo.height - 14
    };

    for (const obs of obstacles) {
        const marginX = obs.type === "serpente" ? 5 : 6;
        const marginY = obs.type === "serpente" ? 3 : 5;

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

    // Luci sullo sfondo.
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

        localStorage.setItem(
            "lupo_runner_best",
            String(personalBest)
        );

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

    if (gameRunning && !gamePaused) {
        lupo.jump();
    }
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

        if (gameRunning && !gamePaused) {
            lupo.jump();
        }
    });
} else if (canvas) {
    canvas.addEventListener("pointerdown", (e) => {
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
        prompt(
            "Nuovo punteggio! Inserisci il tuo nome per la classifica:"
        ) || "Anonimo"
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

        // La modalità no-cors non consente di leggere la risposta.
        setTimeout(fetchLeaderboard, 1500);
    } catch (err) {
        console.error("Errore invio punteggio:", err);
    }
}

/* ================= INIZIALIZZAZIONE ================= */

window.addEventListener("DOMContentLoaded", () => {
    if (loadingScreen) loadingScreen.style.display = "none";
    if (gameArea) gameArea.classList.add("visible");

    if (jumpButton) jumpButton.disabled = true;
    if (pauseButton) pauseButton.disabled = true;

    drawEnvironment();
    lupo.draw();

    fetchLeaderboard();
});

// Ridisegna il lupo quando i PNG sono caricati.
Object.values(immagini).forEach((img) => {
    img.addEventListener("load", () => {
        if (!gameRunning && ctx) {
            drawEnvironment();
            lupo.draw();
        }
    });

    img.addEventListener("error", () => {
        console.warn("Immagine non trovata:", img.src);
    });
});
