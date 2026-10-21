
"use strict";

/* =========================================================
   LUPO RUNNER — VERSIONE COMPLETA
   Personaggi personalizzati, collisioni ridotte,
   fullscreen, rigioca e ritorno alla lista.
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

/* COLLISIONI RIDOTTE */

const HITBOX = {
    // Margini interni al rettangolo del lupo.
    playerLeft: 25,
    playerRight: 25,
    playerTop: 13,
    playerBottom: 9,

    // Riduzione della hitbox degli ostacoli.
    obstaclePaddingX: 9,
    obstaclePaddingY: 6,

    // Un nemico superato oltre questo punto è innocuo.
    passedPoint: 0.35,

    // Hitbox del gomitolo più piccola della sua grafica.
    woolBallRadius: 0.48
};

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
    lupoRun2: "modelli/lupo_run2.png",

    serpent: "modelli/ostacoli/serpente.png",
    angel: "modelli/ostacoli/angelo.png",
    musicBox: "modelli/ostacoli/cassa-musicale.png",
    purpleHeart: "modelli/ostacoli/cuore-viola.png",
    sheep: "modelli/ostacoli/pecora.png",
    woolBall: "modelli/ostacoli/palla-lana.png"
};

const images = {};
let loadedImagesCount = 0;
const totalImages = Object.keys(imagesToLoad).length;

/* STATO DEL GIOCO */

let running = false;
let paused = false;
let gameOver = false;

let animationId = null;
let lastTime = 0;

let distance = 0;
let score = 0;
let speed = START_SPEED;

let obstacles = [];
let woolBalls = [];

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

/* =========================================================
   PULSANTE TORNA ALLA LISTA
========================================================= */

function createBackButton() {
    let button = document.getElementById("backToListButton");

    if (button) return button;

    button = document.createElement("button");
    button.id = "backToListButton";
    button.type = "button";
    button.textContent = "← TORNA ALLA LISTA";
    button.setAttribute("aria-label", "Torna alla lista principale");

    button.addEventListener("click", async () => {
        try {
            if (
                document.fullscreenElement ||
                document.webkitFullscreenElement
            ) {
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                }
            }
        } catch (error) {
            console.warn("Uscita dal fullscreen:", error);
        }

        gameArea.classList.remove("fullscreen-mode");
        window.location.href = "../index.html";
    });

    gameArea.appendChild(button);

    return button;
}

function installGameStyles() {
    if (document.getElementById("lupoRunnerControlsFix")) return;

    const style = document.createElement("style");
    style.id = "lupoRunnerControlsFix";

    style.textContent = `
        #gameArea {
            position: relative;
        }

        #backToListButton {
            position: absolute !important;
            top: 12px !important;
            left: 12px !important;
            z-index: 99999 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            visibility: visible !important;
            opacity: 1 !important;
            padding: 10px 14px !important;
            border: 1px solid #168b87 !important;
            border-radius: 8px !important;
            background: #101014 !important;
            color: #fff !important;
            font-weight: 700 !important;
            cursor: pointer !important;
        }

        #gameArea:fullscreen,
        #gameArea:-webkit-full-screen,
        #gameArea.fullscreen-mode {
            position: relative !important;
            overflow: auto !important;
            box-sizing: border-box !important;
            background: #090909 !important;
        }

        #gameArea:fullscreen #backToListButton,
        #gameArea:-webkit-full-screen #backToListButton,
        #gameArea.fullscreen-mode #backToListButton {
            position: fixed !important;
        }

        #gameArea:fullscreen #startGame,
        #gameArea:-webkit-full-screen #startGame,
        #gameArea.fullscreen-mode #startGame {
            display: inline-flex !important;
            visibility: visible !important;
            opacity: 1 !important;
            pointer-events: auto !important;
            position: relative !important;
            z-index: 99998 !important;
        }

        #gameArea:fullscreen .game-controls,
        #gameArea:-webkit-full-screen .game-controls,
        #gameArea.fullscreen-mode .game-controls {
            display: flex !important;
            visibility: visible !important;
            opacity: 1 !important;
            flex-wrap: wrap !important;
            justify-content: center !important;
            gap: 10px !important;
            position: relative !important;
            z-index: 99997 !important;
        }

        @media (max-width: 600px) {
            #backToListButton {
                top: 6px !important;
                left: 6px !important;
                padding: 8px 10px !important;
                font-size: 12px !important;
            }
        }
    `;

    document.head.appendChild(style);
}

/* =========================================================
   CARICAMENTO IMMAGINI
========================================================= */

function preLoadImages(onComplete) {
    if (totalImages === 0) {
        onComplete();
        return;
    }

    let completed = 0;
    let finished = false;

    function finishLoading() {
        completed++;

        if (completed >= totalImages && !finished) {
            finished = true;
            onComplete();
        }
    }

    for (const [key, src] of Object.entries(imagesToLoad)) {
        const image = new Image();

        images[key] = image;

        image.onload = finishLoading;

        image.onerror = () => {
            console.warn(
                "Immagine non disponibile; verrà usata la grafica provvisoria:",
                src
            );

            finishLoading();
        };

        image.src = src;
    }
}

/* =========================================================
   CLASSIFICA LOCALE
========================================================= */

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

/* =========================================================
   CLASSIFICA ONLINE
========================================================= */

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

        if (oldScript) oldScript.remove();

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

/* =========================================================
   INVIO PUNTEGGIO ONLINE
========================================================= */

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

/* =========================================================
   INIZIALIZZAZIONE
========================================================= */

function initGame() {
    running = false;
    paused = false;
    gameOver = false;

    distance = 0;
    score = 0;
    speed = START_SPEED;

    obstacles = [];
    woolBalls = [];

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
    startButton.textContent = "INIZIA PARTITA";
    startButton.style.display = "inline-flex";
    startButton.style.visibility = "visible";
    startButton.style.opacity = "1";
    startButton.style.pointerEvents = "auto";

    gameMessage.textContent =
        "Premi INIZIA PARTITA per cominciare";

    if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    drawGame();
}

/* =========================================================
   SFONDO
========================================================= */

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

/* =========================================================
   LUPO
========================================================= */

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

/* =========================================================
   FUNZIONI GRAFICHE CONDIVISE
========================================================= */

function drawImageIfAvailable(imageKey, x, y, w, h) {
    const image = images[imageKey];

    if (
        image &&
        image.complete &&
        image.naturalWidth > 0
    ) {
        ctx.drawImage(image, x, y, w, h);
        return true;
    }

    return false;
}

function drawOutlinedShape(color, stroke, lineWidth = 2) {
    ctx.fillStyle = color;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
}

/* =========================================================
   1. SERPENTE
========================================================= */

function drawSnake(obstacle) {
    const { x, y, w, h } = obstacle;

    const wave = Math.sin(distance * 0.12 + obstacle.phase) * 3;

    ctx.save();

    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(Math.sin(distance * 0.07 + obstacle.phase) * 0.04);

    const drawX = -w / 2;
    const drawY = -h / 2 + wave;

    if (drawImageIfAvailable("serpent", drawX, drawY, w, h)) {
        ctx.restore();
        return;
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = "#315d30";
    ctx.lineWidth = 17;

    ctx.beginPath();
    ctx.moveTo(drawX + 5, drawY + h * 0.75);
    ctx.bezierCurveTo(
        drawX + w * 0.25, drawY - wave,
        drawX + w * 0.40, drawY + h,
        drawX + w * 0.55, drawY + h * 0.55
    );
    ctx.bezierCurveTo(
        drawX + w * 0.70, drawY + h * 0.15,
        drawX + w * 0.75, drawY + h,
        drawX + w - 7, drawY + h * 0.35
    );
    ctx.stroke();

    ctx.strokeStyle = "#71a744";
    ctx.lineWidth = 10;

    ctx.beginPath();
    ctx.moveTo(drawX + 5, drawY + h * 0.75);
    ctx.bezierCurveTo(
        drawX + w * 0.25, drawY - wave,
        drawX + w * 0.40, drawY + h,
        drawX + w * 0.55, drawY + h * 0.55
    );
    ctx.bezierCurveTo(
        drawX + w * 0.70, drawY + h * 0.15,
        drawX + w * 0.75, drawY + h,
        drawX + w - 7, drawY + h * 0.35
    );
    ctx.stroke();

    ctx.fillStyle = "#80b94b";
    ctx.beginPath();
    ctx.ellipse(
        drawX + w - 7,
        drawY + h * 0.32,
        11,
        8,
        -0.2,
        0,
        Math.PI * 2
    );
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(drawX + w - 5, drawY + h * 0.25, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(drawX + w - 4, drawY + h * 0.25, 1.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#e94c63";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(drawX + w + 1, drawY + h * 0.40);
    ctx.lineTo(drawX + w + 7, drawY + h * 0.43);
    ctx.lineTo(drawX + w + 10, drawY + h * 0.38);
    ctx.moveTo(drawX + w + 7, drawY + h * 0.43);
    ctx.lineTo(drawX + w + 10, drawY + h * 0.48);
    ctx.stroke();

    ctx.restore();
}

/* =========================================================
   2. ANGELO
========================================================= */

function drawAngel(obstacle) {
    const { x, y, w, h } = obstacle;

    ctx.save();

    if (drawImageIfAvailable("angel", x, y, w, h)) {
        ctx.restore();
        return;
    }

    const centerX = x + w / 2;

    ctx.fillStyle = "#d8d8f4";
    ctx.strokeStyle = "#9999c7";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.ellipse(centerX - 15, y + h / 2 - 2, 15, 8, -0.55, 0, Math.PI * 2);
    ctx.ellipse(centerX + 15, y + h / 2 - 2, 15, 8, 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "#f7d977";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.ellipse(centerX, y + 8, 10, 4, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#f0c9a7";
    ctx.beginPath();
    ctx.arc(centerX, y + 17, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#e6dfc6";
    ctx.beginPath();
    ctx.arc(centerX, y + 13, 9, Math.PI, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f5f1ff";
    ctx.strokeStyle = "#b4b0d4";

    ctx.beginPath();
    ctx.moveTo(centerX - 8, y + 25);
    ctx.lineTo(centerX + 8, y + 25);
    ctx.lineTo(centerX + 14, y + h - 2);
    ctx.lineTo(centerX - 14, y + h - 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "#d6b85d";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(centerX - 8, y + 31);
    ctx.lineTo(centerX + 8, y + 31);
    ctx.stroke();

    ctx.restore();
}

/* =========================================================
   3. CASSA MUSICALE
========================================================= */

function drawMusicBox(obstacle) {
    const { x, y, w, h } = obstacle;

    ctx.save();

    if (drawImageIfAvailable("musicBox", x, y, w, h)) {
        ctx.restore();
        return;
    }

    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(x + 3, y + 4, w, h);

    const wood = ctx.createLinearGradient(x, y, x + w, y + h);
    wood.addColorStop(0, "#d9a05d");
    wood.addColorStop(0.5, "#a65e32");
    wood.addColorStop(1, "#6e361e");

    ctx.fillStyle = wood;
    ctx.strokeStyle = "#512718";
    ctx.lineWidth = 3;

    ctx.fillRect(x + 2, y + h * 0.30, w - 4, h * 0.68);
    ctx.strokeRect(x + 2, y + h * 0.30, w - 4, h * 0.68);

    ctx.fillStyle = "#c47c42";

    ctx.beginPath();
    ctx.moveTo(x + 1, y + h * 0.30);
    ctx.lineTo(x + 9, y + 2);
    ctx.lineTo(x + w - 3, y + 2);
    ctx.lineTo(x + w - 1, y + h * 0.30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "#f2cc77";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(x + 5, y + h * 0.48);
    ctx.lineTo(x + w - 5, y + h * 0.48);
    ctx.stroke();

    ctx.fillStyle = "#ffe6a1";
    ctx.font = "bold 15px serif";
    ctx.textAlign = "center";
    ctx.fillText("♪", x + w / 2, y + h * 0.82);

    ctx.restore();
}

/* =========================================================
   4. CUORE VIOLA
========================================================= */

function drawPurpleHeart(obstacle) {
    const { x, y, w, h } = obstacle;

    ctx.save();

    if (drawImageIfAvailable("purpleHeart", x, y, w, h)) {
        ctx.restore();
        return;
    }

    const centerX = x + w / 2;
    const topY = y + h * 0.30;

    ctx.beginPath();
    ctx.moveTo(centerX, y + h * 0.95);

    ctx.bezierCurveTo(
        x - w * 0.15, y + h * 0.53,
        x - w * 0.03, y + h * 0.05,
        x + w * 0.31, topY
    );

    ctx.bezierCurveTo(
        x + w * 0.43, y - h * 0.02,
        centerX, y + h * 0.16,
        centerX, y + h * 0.30
    );

    ctx.bezierCurveTo(
        centerX, y + h * 0.16,
        x + w * 0.57, y - h * 0.02,
        x + w * 0.70, topY
    );

    ctx.bezierCurveTo(
        x + w * 1.03, y + h * 0.05,
        x + w * 1.15, y + h * 0.53,
        centerX, y + h * 0.95
    );

    const purple = ctx.createLinearGradient(x, y, x + w, y + h);
    purple.addColorStop(0, "#d7a5ff");
    purple.addColorStop(0.45, "#9b4de0");
    purple.addColorStop(1, "#6425a8");

    ctx.fillStyle = purple;
    ctx.strokeStyle = "#481578";
    ctx.lineWidth = 2.5;

    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#f0d7ff";

    ctx.beginPath();
    ctx.ellipse(
        x + w * 0.32,
        y + h * 0.31,
        w * 0.10,
        h * 0.15,
        -0.45,
        0,
        Math.PI * 2
    );
    ctx.fill();

    ctx.restore();
}

/* =========================================================
   5. PECORA
========================================================= */

function drawSheep(obstacle) {
    const { x, y, w, h } = obstacle;

    ctx.save();

    if (drawImageIfAvailable("sheep", x, y, w, h)) {
        ctx.restore();
        return;
    }

    ctx.strokeStyle = "#38313a";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(x + 13, y + h - 10);
    ctx.lineTo(x + 12, y + h);
    ctx.moveTo(x + 26, y + h - 10);
    ctx.lineTo(x + 26, y + h);
    ctx.moveTo(x + 39, y + h - 10);
    ctx.lineTo(x + 40, y + h);
    ctx.stroke();

    ctx.fillStyle = "#f7f3ec";
    ctx.strokeStyle = "#c9c2d0";
    ctx.lineWidth = 1.5;

    const woolBumps = [
        [0.22, 0.48, 11],
        [0.40, 0.35, 12],
        [0.61, 0.39, 12],
        [0.77, 0.51, 10],
        [0.34, 0.64, 11],
        [0.57, 0.63, 12]
    ];

    for (const [px, py, radius] of woolBumps) {
        ctx.beginPath();
        ctx.arc(x + w * px, y + h * py, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    ctx.fillStyle = "#29232d";

    ctx.beginPath();
    ctx.ellipse(x + w * 0.88, y + h * 0.47, 9, 12, 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#c6a2ad";

    ctx.beginPath();
    ctx.ellipse(x + w * 0.77, y + h * 0.36, 5, 3, -0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x + w * 0.91, y + h * 0.43, 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(x + w * 0.92, y + h * 0.43, 1.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

/* =========================================================
   PALLA DI LANA
========================================================= */

function drawWoolBall(ball) {
    const { x, y, r } = ball;

    ctx.save();

    if (drawImageIfAvailable("woolBall", x - r, y - r, r * 2, r * 2)) {
        ctx.restore();
        return;
    }

    ctx.fillStyle = "#f4f0e8";
    ctx.strokeStyle = "#b8b0c0";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "#b6a8c8";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.arc(x - 1, y, r * 0.62, -1.1, 1.4);
    ctx.arc(x + 2, y - 1, r * 0.48, 1.2, 3.9);
    ctx.moveTo(x - r * 0.7, y - r * 0.3);
    ctx.quadraticCurveTo(x, y + r * 0.15, x + r * 0.7, y - r * 0.45);
    ctx.stroke();

    ctx.restore();
}

/* =========================================================
   DISEGNO OSTACOLI
========================================================= */

function drawObstacles() {
    for (const obstacle of obstacles) {
        switch (obstacle.type) {
            case "serpent":
                drawSnake(obstacle);
                break;
            case "angel":
                drawAngel(obstacle);
                break;
            case "musicBox":
                drawMusicBox(obstacle);
                break;
            case "purpleHeart":
                drawPurpleHeart(obstacle);
                break;
            case "sheep":
                drawSheep(obstacle);
                break;
        }
    }

    for (const ball of woolBalls) {
        drawWoolBall(ball);
    }
}

/* =========================================================
   OVERLAY
========================================================= */

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

function drawGame() {
    ctx.clearRect(0, 0, W, H);

    drawBackground();
    drawObstacles();
    drawWolf();

    if (!running && !gameOver) {
        drawOverlay("LUPO RUNNER", "Corri e schiva gli ostacoli!");
    } else if (paused) {
        drawOverlay("PAUSA", "Premi RIPRENDI per continuare");
    } else if (gameOver) {
        drawOverlay("GAME OVER", "Punteggio: " + score);
    }
}

/* =========================================================
   CREAZIONE OSTACOLI
========================================================= */

const OBSTACLE_TYPES = [
    "serpent",
    "angel",
    "musicBox",
    "purpleHeart",
    "sheep"
];

function createObstacle() {
    const type =
        OBSTACLE_TYPES[
            Math.floor(Math.random() * OBSTACLE_TYPES.length)
        ];

    const obstacle = {
        type,
        x: W + 50,
        y: 0,
        w: 40,
        h: 40,
        phase: Math.random() * Math.PI * 2,
        passed: false
    };

    switch (type) {
        case "serpent":
            obstacle.w = 70;
            obstacle.h = 28;
            obstacle.y = groundY - obstacle.h;
            break;

        case "angel":
            obstacle.w = 48;
            obstacle.h = 56;
            obstacle.highY = groundY - 112;
            obstacle.lowY = groundY - obstacle.h;
            obstacle.y = obstacle.highY;
            obstacle.willDive = Math.random() < 0.5;
            obstacle.diveStarted = false;
            obstacle.diveAtX = 260 + Math.random() * 140;
            obstacle.divePhase = "high";
            obstacle.diveTimer = 0;
            break;

        case "musicBox":
            obstacle.w = 42;
            obstacle.h = 43;
            obstacle.y = groundY - obstacle.h;
            break;

        case "purpleHeart":
            obstacle.w = 42;
            obstacle.h = 42;
            obstacle.y = groundY - obstacle.h;
            break;

        case "sheep":
            obstacle.w = 54;
            obstacle.h = 43;
            obstacle.y = groundY - obstacle.h;
            obstacle.willThrow = Math.random() < (1 / 3);
            obstacle.woolThrown = false;
            break;
    }

    obstacles.push(obstacle);
}

/* =========================================================
   MOVIMENTO SPECIALE DELL'ANGELO
========================================================= */

function updateAngel(obstacle, dt) {
    if (obstacle.type !== "angel") return;

    if (
        obstacle.willDive &&
        !obstacle.diveStarted &&
        obstacle.x <= obstacle.diveAtX
    ) {
        obstacle.diveStarted = true;
        obstacle.divePhase = "down";
    }

    if (obstacle.divePhase === "down") {
        obstacle.y += 4.5 * dt;

        if (obstacle.y >= obstacle.lowY) {
            obstacle.y = obstacle.lowY;
            obstacle.divePhase = "low";
            obstacle.diveTimer = 0;
        }
    } else if (obstacle.divePhase === "low") {
        obstacle.diveTimer += dt;

        if (obstacle.diveTimer >= 42) {
            obstacle.divePhase = "up";
        }
    } else if (obstacle.divePhase === "up") {
        obstacle.y -= 4.5 * dt;

        if (obstacle.y <= obstacle.highY) {
            obstacle.y = obstacle.highY;
            obstacle.divePhase = "high";
        }
    }
}

/* =========================================================
   ATTACCO DELLA PECORA
========================================================= */

function throwWoolBall(sheep) {
    if (
        sheep.type !== "sheep" ||
        !sheep.willThrow ||
        sheep.woolThrown
    ) {
        return;
    }

    sheep.woolThrown = true;

    woolBalls.push({
        x: sheep.x + 2,
        y: groundY - sheep.h * 0.70,
        r: 13,
        vx: -(speed + 2.5),
        vy: -1.8,
        gravity: 0.12,
        passed: false
    });
}

/* =========================================================
   HITBOX DEL LUPO E DEGLI OSTACOLI
========================================================= */

function getPlayerHitbox() {
    return {
        x: player.x + HITBOX.playerLeft,
        y: player.y + HITBOX.playerTop,
        w: Math.max(
            1,
            player.w - HITBOX.playerLeft - HITBOX.playerRight
        ),
        h: Math.max(
            1,
            player.h - HITBOX.playerTop - HITBOX.playerBottom
        )
    };
}

function getObstacleHitbox(obstacle) {
    const horizontalPadding = Math.min(
        HITBOX.obstaclePaddingX,
        obstacle.w * 0.30
    );

    const verticalPadding = Math.min(
        HITBOX.obstaclePaddingY,
        obstacle.h * 0.25
    );

    return {
        x: obstacle.x + horizontalPadding,
        y: obstacle.y + verticalPadding,
        w: Math.max(1, obstacle.w - horizontalPadding * 2),
        h: Math.max(1, obstacle.h - verticalPadding * 2)
    };
}

function rectanglesOverlap(a, b) {
    return (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
    );
}

function collides(a, b) {
    // Non considerare più un nemico già superato.
    if (b.passed) return false;

    const playerBox = getPlayerHitbox();
    const obstacleBox = getObstacleHitbox(b);

    return rectanglesOverlap(playerBox, obstacleBox);
}

function collidesWithWoolBall(playerObject, ball) {
    if (ball.passed) return false;

    const playerBox = getPlayerHitbox();
    const radius = ball.r * HITBOX.woolBallRadius;

    const ballBox = {
        x: ball.x - radius,
        y: ball.y - radius,
        w: radius * 2,
        h: radius * 2
    };

    return rectanglesOverlap(playerBox, ballBox);
}

/* =========================================================
   DIFFICOLTÀ
========================================================= */

function calculateSpeed() {
    const calculated =
        START_SPEED + score * SPEED_INCREASE_PER_SCORE;

    return Math.min(calculated, MAX_SPEED);
}

function calculateNextSpawn() {
    const difficulty = Math.min(score / 1000, 1);

    const minimum = 330 - difficulty * 55;
    const maximum = 500 - difficulty * 70;

    return minimum + Math.random() * (maximum - minimum);
}

/* =========================================================
   AGGIORNAMENTO OSTACOLI E COLLISIONI
========================================================= */

function updateObstacles(dt) {
    const playerBox = getPlayerHitbox();

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];

        obstacle.x -= speed * dt;

        updateAngel(obstacle, dt);

        // Appena il nemico supera il punto di sicurezza del lupo,
        // diventa innocuo e non può più causare game over.
        const safePassingPoint =
            player.x + player.w * HITBOX.passedPoint;

        if (obstacle.x + obstacle.w < safePassingPoint) {
            obstacle.passed = true;
        }

        if (
            obstacle.type === "sheep" &&
            obstacle.willThrow &&
            !obstacle.woolThrown &&
            obstacle.x < W * 0.72
        ) {
            throwWoolBall(obstacle);
        }

        // La collisione si controlla solo se il nemico non è passato.
        if (
            !obstacle.passed &&
            collides(playerBox, obstacle)
        ) {
            endGame();
            return false;
        }

        if (obstacle.x + obstacle.w < -80) {
            obstacles.splice(i, 1);
        }
    }

    // Movimento, rimbalzo e collisioni delle palle di lana.
    for (let i = woolBalls.length - 1; i >= 0; i--) {
        const ball = woolBalls[i];

        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.vy += ball.gravity * dt;

        if (ball.y + ball.r > groundY) {
            ball.y = groundY - ball.r;
            ball.vy = -Math.abs(ball.vy) * 0.55;

            if (Math.abs(ball.vy) < 1) {
                ball.vy = 0;
            }
        }

        // Anche il gomitolo diventa innocuo quando oltrepassa il lupo.
        const safePassingPoint =
            player.x + player.w * HITBOX.passedPoint;

        if (ball.x + ball.r < safePassingPoint) {
            ball.passed = true;
        }

        if (
            !ball.passed &&
            collidesWithWoolBall(player, ball)
        ) {
            endGame();
            return false;
        }

        if (ball.x + ball.r < -30) {
            woolBalls.splice(i, 1);
        }
    }

    return true;
}

/* =========================================================
   GAME LOOP
========================================================= */

function gameLoop(timestamp) {
    if (!running || paused) return;

    if (!lastTime) lastTime = timestamp;

    const dt = Math.min(
        (timestamp - lastTime) / 16.667,
        2
    );

    lastTime = timestamp;

    speed = calculateSpeed();

    distance += speed * dt;
    score = Math.floor(distance / 10);

    scoreElement.textContent = score;

    // Fisica del lupo.
    player.vy += player.gravity * dt;
    player.y += player.vy * dt;

    if (player.y + player.h >= groundY) {
        player.y = groundY - player.h;
        player.vy = 0;
        player.grounded = true;
    }

    // Generazione degli ostacoli.
    spawnDistance += speed * dt;

    if (spawnDistance >= nextSpawnDistance) {
        createObstacle();

        spawnDistance = 0;
        nextSpawnDistance = calculateNextSpawn();
    }

    if (!updateObstacles(dt)) {
        return;
    }

    drawGame();

    animationId = requestAnimationFrame(gameLoop);
}

/* =========================================================
   SALTO
========================================================= */

function jump() {
    if (running && !paused && player.grounded) {
        player.vy = player.jumpPower;
        player.grounded = false;
    }
}

/* =========================================================
   START / RIAVVIO
========================================================= */

function startGame() {
    if (running) return;

    if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    // Invalida eventuali prompt appartenenti alla partita precedente.
    gameOverSequence++;

    initGame();

    running = true;
    paused = false;
    gameOver = false;

    jumpButton.disabled = false;
    pauseButton.disabled = false;

    startButton.disabled = false;
    startButton.textContent = "RIAVVIA";
    startButton.style.display = "inline-flex";
    startButton.style.visibility = "visible";
    startButton.style.opacity = "1";
    startButton.style.pointerEvents = "auto";

    gameMessage.textContent = "Salta gli ostacoli!";
    lastTime = 0;

    animationId = requestAnimationFrame(gameLoop);
}

/* =========================================================
   PAUSA
========================================================= */

function togglePause() {
    if (!running) return;

    paused = !paused;

    if (paused) {
        pauseButton.textContent = "RIPRENDI";
        gameMessage.textContent = "Partita in pausa";

        if (animationId !== null) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }

        drawGame();
        return;
    }

    pauseButton.textContent = "PAUSA";
    gameMessage.textContent = "Continua!";

    lastTime = 0;
    animationId = requestAnimationFrame(gameLoop);
}

/* =========================================================
   GAME OVER
========================================================= */

function endGame() {
    if (gameOver) return;

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

        localStorage.setItem("lupoRunnerBest", String(best));
        bestElement.textContent = best;
    }

    // Il pulsante deve rimanere utilizzabile anche in fullscreen.
    startButton.disabled = false;
    startButton.textContent = "GIOCA ANCORA";
    startButton.style.display = "inline-flex";
    startButton.style.visibility = "visible";
    startButton.style.opacity = "1";
    startButton.style.pointerEvents = "auto";

    gameMessage.textContent = "Game Over — premi GIOCA ANCORA";

    drawGame();

    gameOverSequence++;
    const currentSequence = gameOverSequence;
    const finalScore = score;

    setTimeout(() => {
        if (currentSequence !== gameOverSequence || !gameOver) return;

        const playerName = prompt(
            "Game Over!\n\nHai ottenuto " +
            finalScore +
            " punti.\n\nInserisci il tuo nome:",
            "Lupo"
        );

        if (playerName && playerName.trim() !== "") {
            submitScoreOnline(playerName.trim(), finalScore);
        }

        // Dopo la chiusura del prompt, ripristina il pulsante.
        startButton.disabled = false;
        startButton.textContent = "GIOCA ANCORA";
        startButton.style.display = "inline-flex";
        startButton.style.visibility = "visible";
        startButton.style.opacity = "1";
        startButton.style.pointerEvents = "auto";
    }, 250);
}

/* =========================================================
   FULLSCREEN
========================================================= */

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
            await document.webkitExitFullscreen();
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

/* =========================================================
   EVENTI FULLSCREEN
========================================================= */

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

    // In caso di game over, il pulsante per rigiocare resta visibile.
    if (gameOver) {
        startButton.disabled = false;
        startButton.textContent = "GIOCA ANCORA";
        startButton.style.display = "inline-flex";
        startButton.style.visibility = "visible";
        startButton.style.opacity = "1";
        startButton.style.pointerEvents = "auto";
    }

    setTimeout(resizeCanvasVisual, 50);
}

document.addEventListener("fullscreenchange", updateFullscreenButton);
document.addEventListener("webkitfullscreenchange", updateFullscreenButton);

/* =========================================================
   RIDIMENSIONAMENTO
========================================================= */

function resizeCanvasVisual() {
    drawGame();
}

window.addEventListener("resize", resizeCanvasVisual);

window.addEventListener("orientationchange", () => {
    setTimeout(resizeCanvasVisual, 100);
});

/* =========================================================
   EVENTI PULSANTI
========================================================= */

startButton.addEventListener("click", startGame);
jumpButton.addEventListener("click", jump);
pauseButton.addEventListener("click", togglePause);
fullscreenButton.addEventListener("click", toggleFullscreenMode);
refreshBoardButton.addEventListener("click", updateLeaderboard);

/* =========================================================
   TASTIERA
========================================================= */

document.addEventListener("keydown", (event) => {
    if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();

        if (!running && gameOver) {
            startGame();
        } else if (!running && !gameOver) {
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

/* =========================================================
   TOUCH / CLICK SUL CANVAS
========================================================= */

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

/* =========================================================
   SALTO NELLE ZONE VUOTE DEL GIOCO ESPANSO
========================================================= */

gameArea.addEventListener("pointerdown", (event) => {
    const expanded =
        gameArea.classList.contains("fullscreen-mode") ||
        document.fullscreenElement === gameArea ||
        document.webkitFullscreenElement === gameArea;

    if (!expanded) return;

    if (event.target.closest("button")) return;

    if (event.target === canvas || canvas.contains(event.target)) {
        return;
    }

    event.preventDefault();

    if (!running) {
        startGame();
    } else {
        jump();
    }
});

/* =========================================================
   AVVIO PAGINA
========================================================= */

window.addEventListener("load", () => {
    createBackButton();
    installGameStyles();

    preLoadImages(() => {
        loadingScreen.style.display = "none";
        gameArea.classList.add("visible");

        initGame();
        updateLeaderboard();
    });
});
