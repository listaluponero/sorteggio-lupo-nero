
"use strict";

/* =========================================================
   LUPO RUNNER
========================================================= */

const LEADERBOARD_API_URL =
    "https://script.google.com/macros/s/AKfycbxJgp0aOu-zdvidw2ktjx2PiT3SLC7CQWycYAzEEfggzl_1bEE1zfdYAPsXuHg1hoYO/exec";

/* ELEMENTI HTML */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const loadingScreen = document.getElementById("loadingScreen");
const gameArea = document.getElementById("gameArea");

const startButton = document.getElementById("startGame");
const jumpButton = document.getElementById("jumpGame");
const pauseButton = document.getElementById("pauseGame");
const fullscreenButton = document.getElementById("fullscreenBtn");
const backButton = document.getElementById("backToList");
const refreshBoardButton = document.getElementById("refreshBoard");

const scoreElement = document.getElementById("score");
const bestElement = document.getElementById("personalBest");
const leaderboardBody = document.getElementById("leaderboardBody");
const leaderboardStatus = document.getElementById("leaderboardStatus");
const gameMessage = document.getElementById("gameMessage");

/* CANVAS */

const W = 800;
const H = 400;

canvas.width = W;
canvas.height = H;

const groundY = H - 80;

/* DIFFICOLTÀ */

const START_SPEED = 4.5;
const MAX_SPEED = 8.2;
const SPEED_INCREASE_PER_SCORE = 0.0009;

/* GIOCATORE */

const playerConfig = {
    x: 70,
    w: 90,
    h: 55,
    gravity: 0.8,
    jumpPower: -14
};

/* IMMAGINI */

const imagesToLoad = {
    lupoRun1: "modelli/lupo_run1.png",
    lupoRun2: "modelli/lupo_run2.png"
};

const images = {};
let loadedImagesCount = 0;
const totalImages = Object.keys(imagesToLoad).length;

function preLoadImages(onComplete) {
    if (totalImages === 0) {
        onComplete();
        return;
    }

    for (const [key, src] of Object.entries(imagesToLoad)) {
        const image = new Image();
        images[key] = image;

        image.onload = () => {
            loadedImagesCount++;
            if (loadedImagesCount >= totalImages) {
                onComplete();
            }
        };

        image.onerror = () => {
            console.error("Errore caricamento immagine:", src);
            loadedImagesCount++;

            if (loadedImagesCount >= totalImages) {
                onComplete();
            }
        };

        image.src = src;
    }
}

/* STATO */

let running = false;
let paused = false;
let gameOver = false;

let animationId = null;
let lastTime = 0;

let distance = 0;
let score = 0;
let speed = START_SPEED;

let obstacles = [];
let spawnDistance = 0;
let nextSpawnDistance = 400;

let gameOverSequence = 0;

/* RECORD PERSONALE */

let best = Number(localStorage.getItem("lupoRunnerBest")) || 0;
bestElement.textContent = best;

/* GIOCATORE */

let player = {
    ...playerConfig,
    y: groundY - playerConfig.h,
    vy: 0,
    grounded: true
};

/* CLASSIFICA LOCALE */

function getLocalLeaderboard() {
    try {
        return JSON.parse(
            localStorage.getItem("lupoRunnerLeaderboard")
        ) || [];
    } catch (error) {
        return [];
    }
}

function saveLocalLeaderboard(board) {
    localStorage.setItem(
        "lupoRunnerLeaderboard",
        JSON.stringify(board)
    );
}

/* CLASSIFICA */

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function renderLeaderboard(board) {
    leaderboardBody.innerHTML = "";

    if (!board || board.length === 0) {
        leaderboardBody.innerHTML = `
            <tr>
                <td colspan="3">Nessun record</td>
            </tr>
        `;
        return;
    }

    board.slice(0, 5).forEach((entry, index) => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>#${index + 1}</td>
            <td>${escapeHtml(entry.name)}</td>
            <td>${Number(entry.score) || 0}</td>
        `;

        leaderboardBody.appendChild(row);
    });
}

function updateLocalLeaderboard() {
    renderLeaderboard(getLocalLeaderboard());
}

/* CLASSIFICA ONLINE */

async function updateLeaderboard() {
    leaderboardStatus.textContent = "Aggiornamento...";

    if (
        !LEADERBOARD_API_URL ||
        LEADERBOARD_API_URL.includes("INCOLLA_QUI")
    ) {
        updateLocalLeaderboard();
        leaderboardStatus.textContent = "Classifica locale";
        return;
    }

    try {
        const url =
            LEADERBOARD_API_URL +
            "?action=leaderboard&limit=5&callback=renderRemoteLeaderboard";

        const oldScript = document.getElementById("leaderboardJsonp");
        if (oldScript) {
            oldScript.remove();
        }

        window.renderRemoteLeaderboard = function(data) {
            try {
                if (data && Array.isArray(data.leaderboard)) {
                    renderLeaderboard(data.leaderboard);
                    leaderboardStatus.textContent = "Classifica online";
                } else {
                    updateLocalLeaderboard();
                    leaderboardStatus.textContent = "Classifica locale";
                }
            } catch (error) {
                console.error(error);
                updateLocalLeaderboard();
                leaderboardStatus.textContent = "Classifica locale";
            }
        };

        const script = document.createElement("script");
        script.id = "leaderboardJsonp";
        script.src = url;

        script.onerror = () => {
            updateLocalLeaderboard();
            leaderboardStatus.textContent =
                "Connessione non riuscita — classifica locale";
        };

        document.body.appendChild(script);

        setTimeout(() => {
            if (leaderboardStatus.textContent === "Aggiornamento...") {
                updateLocalLeaderboard();
                leaderboardStatus.textContent =
                    "Connessione non riuscita — classifica locale";
            }
        }, 7000);
    } catch (error) {
        console.error("Errore classifica:", error);
        updateLocalLeaderboard();
        leaderboardStatus.textContent = "Classifica locale";
    }
}

/* INVIO PUNTEGGIO ONLINE */

async function submitScoreOnline(name, playerScore) {
    const cleanName = String(name || "Lupo")
        .trim()
        .substring(0, 15);

    const cleanScore = Math.max(
        0,
        Math.floor(Number(playerScore) || 0)
    );

    const localBoard = getLocalLeaderboard();

    localBoard.push({
        name: cleanName,
        score: cleanScore
    });

    localBoard.sort((a, b) => b.score - a.score);
    saveLocalLeaderboard(localBoard.slice(0, 5));

    if (
        !LEADERBOARD_API_URL ||
        LEADERBOARD_API_URL.includes("INCOLLA_QUI")
    ) {
        updateLocalLeaderboard();
        return;
    }

    try {
        const params = new URLSearchParams({
            action: "submit",
            name: cleanName,
            score: String(cleanScore)
        });

        await fetch(LEADERBOARD_API_URL, {
            method: "POST",
            mode: "no-cors",
            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded;charset=UTF-8"
            },
            body: params.toString()
        });

        leaderboardStatus.textContent = "Punteggio inviato";

        setTimeout(updateLeaderboard, 900);
    } catch (error) {
        console.error("Errore invio punteggio:", error);
        leaderboardStatus.textContent = "Punteggio salvato localmente";
        updateLocalLeaderboard();
    }
}

/* INIZIALIZZAZIONE */

function initGame() {
    running = false;
    paused = false;
    gameOver = false;

    distance = 0;
    score = 0;
    speed = START_SPEED;

    obstacles = [];
    spawnDistance = 0;
    nextSpawnDistance = 400;
    lastTime = 0;

    player = {
        ...playerConfig,
        y: groundY - playerConfig.h,
        vy: 0,
        grounded: true
    };

    scoreElement.textContent = "0";

    jumpButton.disabled = true;
    pauseButton.disabled = true;
    pauseButton.textContent = "PAUSA";

    startButton.disabled = false;
    startButton.hidden = false;
    startButton.style.display = "inline-flex";
    startButton.textContent = "INIZIA PARTITA";

    gameMessage.textContent =
        "Premi INIZIA PARTITA per cominciare";

    if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    drawGame();
}

/* SFONDO */

function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);

    sky.addColorStop(0, "#090b14");
    sky.addColorStop(1, "#201b2b");

    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#e9e3d6";
    ctx.beginPath();
    ctx.arc(320, 95, 26, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#101014";
    ctx.fillRect(0, groundY, W, H - groundY);

    ctx.fillStyle = "#168b87";
    ctx.fillRect(0, groundY, W, 4);
}

/* LUPO */

function drawWolf() {
    ctx.save();

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();

    ctx.ellipse(
        player.x + player.w / 2,
        groundY + 5,
        player.grounded ? 30 : 18,
        6,
        0,
        0,
        Math.PI * 2
    );

    ctx.fill();

    let imageToDraw;

    if (!player.grounded) {
        imageToDraw = images.lupoRun1;
    } else {
        const frame = Math.floor(distance / 20) % 2;
        imageToDraw = frame === 0
            ? images.lupoRun1
            : images.lupoRun2;
    }

    if (
        imageToDraw &&
        imageToDraw.complete &&
        imageToDraw.naturalWidth > 0
    ) {
        ctx.drawImage(
            imageToDraw,
            player.x,
            player.y,
            player.w,
            player.h
        );
    } else {
        ctx.fillStyle = "#168b87";
        ctx.fillRect(
            player.x,
            player.y,
            player.w,
            player.h
        );
    }

    ctx.restore();
}

/* OSTACOLI */

function drawObstacles() {
    for (const obstacle of obstacles) {
        ctx.fillStyle = "#d72c4d";
        ctx.fillRect(
            obstacle.x,
            obstacle.y,
            obstacle.w,
            obstacle.h
        );

        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillRect(
            obstacle.x + 5,
            obstacle.y + 5,
            obstacle.w - 10,
            4
        );
    }
}

function drawOverlay(title, subtitle) {
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText(title, W / 2, H / 2 - 18);

    ctx.font = "16px sans-serif";
    ctx.fillStyle = "#ccc";
    ctx.fillText(subtitle, W / 2, H / 2 + 25);
}

/* DISEGNO COMPLETO */

function drawGame() {
    ctx.clearRect(0, 0, W, H);

    drawBackground();
    drawObstacles();
    drawWolf();

    if (!running && !gameOver) {
        drawOverlay(
            "LUPO RUNNER",
            "Corri e schiva gli ostacoli!"
        );
    } else if (paused) {
        drawOverlay(
            "PAUSA",
            "Premi RIPRENDI per continuare"
        );
    } else if (gameOver) {
        drawOverlay(
            "GAME OVER",
            "Punteggio: " + score
        );
    }
}

/* CREAZIONE OSTACOLI */

function createObstacle() {
    const size = 35;

    obstacles.push({
        x: W + 50,
        y: groundY - size,
        w: size,
        h: size
    });
}

/* COLLISIONI */

function collides(a, b) {
    const horizontalPadding = 10;
    const verticalPadding = 7;

    return (
        a.x + horizontalPadding < b.x + b.w &&
        a.x + a.w - horizontalPadding > b.x &&
        a.y + verticalPadding < b.y + b.h &&
        a.y + a.h - verticalPadding > b.y
    );
}

/* CALCOLO DIFFICOLTÀ */

function calculateSpeed() {
    const calculated =
        START_SPEED + score * SPEED_INCREASE_PER_SCORE;

    return Math.min(calculated, MAX_SPEED);
}

function calculateNextSpawn() {
    const difficulty = Math.min(score / 1000, 1);

    const minimum = 330 - (difficulty * 55);
    const maximum = 500 - (difficulty * 70);

    return minimum + Math.random() * (maximum - minimum);
}

/* CICLO DI GIOCO */

function gameLoop(timestamp) {
    if (!running || paused) {
        return;
    }

    if (!lastTime) {
        lastTime = timestamp;
    }

    const dt = Math.min(
        (timestamp - lastTime) / 16.667,
        2
    );

    lastTime = timestamp;

    speed = calculateSpeed();
    distance += speed * dt;
    score = Math.floor(distance / 10);

    scoreElement.textContent = score;

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
        nextSpawnDistance = calculateNextSpawn();
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];

        obstacle.x -= speed * dt;

        if (collides(player, obstacle)) {
            endGame();
            return;
        }

        if (obstacle.x + obstacle.w < -50) {
            obstacles.splice(i, 1);
        }
    }

    drawGame();

    animationId = requestAnimationFrame(gameLoop);
}

/* SALTO */

function jump() {
    if (running && !paused && player.grounded) {
        player.vy = player.jumpPower;
        player.grounded = false;
    }
}

/* INIZIO / RIAVVIO */

function startGame() {
    if (running) {
        return;
    }

    if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    initGame();

    running = true;
    paused = false;
    gameOver = false;

    jumpButton.disabled = false;
    pauseButton.disabled = false;

    startButton.disabled = false;
    startButton.hidden = false;
    startButton.style.display = "inline-flex";
    startButton.textContent = "RIAVVIA";

    gameMessage.textContent = "Salta gli ostacoli!";

    lastTime = 0;
    animationId = requestAnimationFrame(gameLoop);
}

/* PAUSA */

function togglePause() {
    if (!running) {
        return;
    }

    paused = !paused;

    if (paused) {
        pauseButton.textContent = "RIPRENDI";
        gameMessage.textContent = "Partita in pausa";
        drawGame();
        return;
    }

    pauseButton.textContent = "PAUSA";
    gameMessage.textContent = "Continua!";

    lastTime = 0;
    animationId = requestAnimationFrame(gameLoop);
}

/* GAME OVER */

function endGame() {
    if (gameOver) {
        return;
    }

    running = false;
    paused = false;
    gameOver = true;

    jumpButton.disabled = true;
    pauseButton.disabled = true;

    if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    if (score > best) {
        best = score;

        localStorage.setItem(
            "lupoRunnerBest",
            String(best)
        );

        bestElement.textContent = best;
    }

    startButton.disabled = false;
    startButton.hidden = false;
    startButton.style.display = "inline-flex";
    startButton.textContent = "GIOCA ANCORA";

    gameMessage.textContent =
        "Game Over — premi GIOCA ANCORA";

    drawGame();

    gameOverSequence++;
    const currentSequence = gameOverSequence;

    setTimeout(() => {
        if (currentSequence !== gameOverSequence) {
            return;
        }

        const playerName = prompt(
            "Game Over!\n\nHai ottenuto " +
            score +
            " punti.\n\nInserisci il tuo nome:",
            "Lupo"
        );

        if (playerName && playerName.trim() !== "") {
            submitScoreOnline(playerName.trim(), score);
        }
    }, 250);
}

/* SCHERMO INTERO */

function isFullscreen() {
    return (
        document.fullscreenElement === gameArea ||
        document.webkitFullscreenElement === gameArea ||
        gameArea.classList.contains("fullscreen-mode")
    );
}

async function enterFullscreen() {
    try {
        if (gameArea.requestFullscreen) {
            await gameArea.requestFullscreen();
            return;
        }

        if (gameArea.webkitRequestFullscreen) {
            gameArea.webkitRequestFullscreen();
            return;
        }
    } catch (error) {
        console.warn("Fullscreen API non disponibile:", error);
    }

    gameArea.classList.add("fullscreen-mode");
    fullscreenButton.textContent = "RIDUCI GIOCO";

    setTimeout(resizeCanvasVisual, 50);
}

async function exitFullscreen() {
    try {
        if (
            document.exitFullscreen &&
            document.fullscreenElement
        ) {
            await document.exitFullscreen();
            return;
        }

        if (
            document.webkitExitFullscreen &&
            document.webkitFullscreenElement
        ) {
            document.webkitExitFullscreen();
            return;
        }
    } catch (error) {
        console.warn("Errore uscita fullscreen:", error);
    }

    gameArea.classList.remove("fullscreen-mode");
    fullscreenButton.textContent = "ESPANDI GIOCO";

    setTimeout(resizeCanvasVisual, 50);
}

async function toggleFullscreenMode() {
    if (isFullscreen()) {
        await exitFullscreen();
    } else {
        await enterFullscreen();
    }
}

/* AGGIORNAMENTO PULSANTE SCHERMO INTERO */

function updateFullscreenButton() {
    const active =
        document.fullscreenElement === gameArea ||
        document.webkitFullscreenElement === gameArea;

    if (active) {
        gameArea.classList.remove("fullscreen-mode");
        fullscreenButton.textContent = "RIDUCI GIOCO";
    } else if (gameArea.classList.contains("fullscreen-mode")) {
        fullscreenButton.textContent = "RIDUCI GIOCO";
    } else {
        fullscreenButton.textContent = "ESPANDI GIOCO";
    }

    setTimeout(resizeCanvasVisual, 50);
}

document.addEventListener(
    "fullscreenchange",
    updateFullscreenButton
);

document.addEventListener(
    "webkitfullscreenchange",
    updateFullscreenButton
);

/* RIDIMENSIONAMENTO */

function resizeCanvasVisual() {
    drawGame();
}

window.addEventListener("resize", resizeCanvasVisual);

window.addEventListener("orientationchange", () => {
    setTimeout(resizeCanvasVisual, 100);
});

/* TORNA ALLA LISTA PRINCIPALE */

async function goBackToList() {
    running = false;
    paused = false;
    gameOverSequence++;

    if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    gameArea.classList.remove("fullscreen-mode");

    try {
        if (document.fullscreenElement && document.exitFullscreen) {
            await document.exitFullscreen();
        } else if (
            document.webkitFullscreenElement &&
            document.webkitExitFullscreen
        ) {
            await document.webkitExitFullscreen();
        }
    } catch (error) {
        console.warn(
            "Errore durante l'uscita dallo schermo intero:",
            error
        );
    }

    window.location.href = "../index.html";
}

/* EVENTI PULSANTI */

startButton.addEventListener("click", startGame);
jumpButton.addEventListener("click", jump);
pauseButton.addEventListener("click", togglePause);
fullscreenButton.addEventListener("click", toggleFullscreenMode);
backButton.addEventListener("click", goBackToList);
refreshBoardButton.addEventListener("click", updateLeaderboard);

/* TASTIERA */

document.addEventListener("keydown", (event) => {
    if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();

        if (!running && !gameOver) {
            startGame();
        } else if (gameOver) {
            startGame();
        } else {
            jump();
        }
    }

    if (event.code === "KeyP") {
        event.preventDefault();
        togglePause();
    }

    if (event.code === "KeyF") {
        event.preventDefault();
        toggleFullscreenMode();
    }
});

/* TOCCO E CLICK SUL CANVAS */

canvas.addEventListener("touchstart", (event) => {
    event.preventDefault();

    if (!running) {
        startGame();
    } else {
        jump();
    }
}, { passive: false });

canvas.addEventListener("mousedown", () => {
    if (!running) {
        startGame();
    } else {
        jump();
    }
});

/* SALTO NELLE ZONE VUOTE DEL GIOCO ESPANSO */

gameArea.addEventListener("pointerdown", (event) => {
    const expanded =
        gameArea.classList.contains("fullscreen-mode") ||
        document.fullscreenElement === gameArea ||
        document.webkitFullscreenElement === gameArea;

    if (!expanded) {
        return;
    }

    if (event.target.closest("button")) {
        return;
    }

    if (event.target === canvas) {
        return;
    }

    if (!running && !gameOver) {
        startGame();
    } else {
        jump();
    }
});

/* AVVIO PAGINA */

window.addEventListener("load", () => {
    preLoadImages(() => {
        loadingScreen.style.display = "none";
        gameArea.classList.add("visible");

        initGame();
        updateLeaderboard();
    });
});
