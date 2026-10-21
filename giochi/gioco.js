"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Elementi UI
const loadingScreen = document.getElementById("loadingScreen");
const gameArea = document.getElementById("gameArea");
const startButton = document.getElementById("startGame");
const jumpButton = document.getElementById("jumpGame");
const pauseButton = document.getElementById("pauseGame");
const fullscreenButton = document.getElementById("fullscreenBtn");
const scoreElement = document.getElementById("score");
const bestElement = document.getElementById("personalBest");
const leaderboardBody = document.getElementById("leaderboardBody");

// Dimensioni e parametri
const W = canvas.width;
const H = canvas.height;
const groundY = H - 80;

const START_SPEED = 4.5;
const playerConfig = {
    x: 70,
    w: 90,
    h: 55,
    gravity: 0.8,
    jumpPower: -14
};

// ======================================
// GESTIONE ASSET (CARTELLA modelli)
// ======================================

const imagesToLoad = {
    lupoRun1: "modelli/lupo_run1.png",
    lupoRun2: "modelli/lupo_run2.png"
};

const images = {};
let loadedImagesCount = 0;
const totalImages = Object.keys(imagesToLoad).length;

function preLoadImages(callbacks) {
    if (totalImages === 0) {
        callbacks.onComplete();
        return;
    }

    for (const [key, src] of Object.entries(imagesToLoad)) {
        images[key] = new Image();
        images[key].src = src;
        
        images[key].onload = () => {
            loadedImagesCount++;
            if (loadedImagesCount === totalImages) callbacks.onComplete();
        };

        images[key].onerror = () => {
            console.error("Errore caricamento file:", src);
            loadedImagesCount++;
            if (loadedImagesCount === totalImages) callbacks.onComplete();
        };
    }
}

window.addEventListener("load", () => {
    preLoadImages({
        onComplete: () => {
            loadingScreen.style.display = "none";
            gameArea.style.display = "block";
            initGame();
            updateLeaderboard();
            drawGame();
        }
    });
});

// ======================================
// STATO DI GIOCO E CLASSIFICA
// ======================================

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

let best = Number(localStorage.getItem("lupoRunnerBest")) || 0;
bestElement.textContent = best;

let player = { ...playerConfig, y: groundY - playerConfig.h, vy: 0, grounded: true };

function getLeaderboard() {
    try {
        return JSON.parse(localStorage.getItem("lupoRunnerLeaderboard")) || [];
    } catch {
        return [];
    }
}

function saveLeaderboardData(lb) {
    localStorage.setItem("lupoRunnerLeaderboard", JSON.stringify(lb));
}

function updateLeaderboard() {
    const lb = getLeaderboard();
    leaderboardBody.innerHTML = "";
    if (lb.length === 0) {
        leaderboardBody.innerHTML = `<tr><td colspan="3" style="color:#888;">Nessun record salvato</td></tr>`;
        return;
    }
    lb.forEach((entry, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `<td>#${index + 1}</td><td>${escapeHtml(entry.name)}</td><td>${entry.score}</td>`;
        leaderboardBody.appendChild(row);
    });
}

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function initGame() {
    running = false; paused = false; gameOver = false;
    distance = 0; score = 0; speed = START_SPEED;
    obstacles = []; spawnDistance = 0; nextSpawnDistance = 400;
    player = { ...playerConfig, y: groundY - playerConfig.h, vy: 0, grounded: true };
    
    scoreElement.textContent = "0";
    jumpButton.disabled = true;
    pauseButton.disabled = true;
    pauseButton.textContent = "PAUSA";
}

// ======================================
// RENDERING E ANIMAZIONE
// ======================================

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

function drawWolf() {
    ctx.save();
    
    // Ombra
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(player.x + player.w/2, groundY + 5, player.grounded ? 30 : 18, 6, 0, 0, Math.PI*2);
    ctx.fill();

    let imgToDraw;
    if (!player.grounded) {
        imgToDraw = images.lupoRun1;
    } else {
        const frame = Math.floor(distance / 20) % 2;
        imgToDraw = frame === 0 ? images.lupoRun1 : images.lupoRun2;
    }

    if (imgToDraw && imgToDraw.complete && imgToDraw.naturalWidth !== 0) {
        ctx.drawImage(imgToDraw, player.x, player.y, player.w, player.h);
    } else {
        ctx.fillStyle = "#168b87";
        ctx.fillRect(player.x, player.y, player.w, player.h);
    }

    ctx.restore();
}

function drawObstacles() {
    for (const o of obstacles) {
        ctx.fillStyle = "#d72c4d";
        ctx.fillRect(o.x, o.y, o.w, o.h);
    }
}

function drawGame() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawObstacles();
    drawWolf();

    if (!running && !gameOver) {
        drawOverlay("LUPO RUNNER", "Corri lupo e schiva gli ostacoli! Premi SPAZIO o INIZIA");
    } else if (paused) {
        drawOverlay("PAUSA", "Premi RIPRENDI per continuare");
    } else if (gameOver) {
        drawOverlay("GAME OVER", "Punteggio: " + score + " - Inserisci il nome sotto");
    }
}

function drawOverlay(title, subtitle) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center"; 
    ctx.fillStyle = "#fff";
    ctx.font = "bold 34px sans-serif"; 
    ctx.fillText(title, W / 2, H / 2 - 15);
    ctx.font = "17px sans-serif"; 
    ctx.fillStyle = "#ccc"; 
    ctx.fillText(subtitle, W / 2, H / 2 + 25);
}

// ======================================
// LOGICA DI GIOCO
// ======================================

function createObstacle() {
    const size = 35;
    obstacles.push({ x: W + 50, y: groundY - size, w: size, h: size });
}

function collides(a, b) {
    const padding = 8;
    return a.x + padding < b.x + b.w &&
           a.x + a.w - padding > b.x &&
           a.y + padding < b.y + b.h &&
           a.y + a.h - padding > b.y;
}

function gameLoop(timestamp) {
    if (!running || paused) return;

    if (!lastTime) lastTime = timestamp;
    const dt = Math.min((timestamp - lastTime) / 16.667, 2);
    lastTime = timestamp;

    speed = START_SPEED + (score / 2000);
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
        nextSpawnDistance = 280 + Math.random() * 220;
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= speed * dt;
        if (collides(player, obstacles[i])) {
            endGame();
            return;
        }
        if (obstacles[i].x + obstacles[i].w < -50) {
            obstacles.splice(i, 1);
        }
    }

    drawGame();
    animationId = requestAnimationFrame(gameLoop);
}

// ======================================
// GESTIONE EVENTI E CLASSIFICA FINALE
// ======================================

function jump() {
    if (running && !paused && player.grounded) {
        player.vy = player.jumpPower;
        player.grounded = false;
    }
}

function startGame() {
    if (running) return;
    initGame();
    running = true;
    jumpButton.disabled = false;
    pauseButton.disabled = false;
    lastTime = 0;
    animationId = requestAnimationFrame(gameLoop);
}

function togglePause() {
    if (!running && !gameOver) return;
    paused = !paused;
    pauseButton.textContent = paused ? "RIPRENDI" : "PAUSA";
    if (!paused) {
        lastTime = 0;
        animationId = requestAnimationFrame(gameLoop);
    } else {
        drawGame();
    }
}

function endGame() {
    running = false;
    gameOver = true;
    jumpButton.disabled = true;
    pauseButton.disabled = true;

    if (score > best) {
        best = score;
        localStorage.setItem("lupoRunnerBest", best);
        bestElement.textContent = best;
    }

    if (animationId) cancelAnimationFrame(animationId);
    drawGame();

    // Prompt per inserire il nome in classifica
    setTimeout(() => {
        let playerName = prompt("Game Over! Hai totalizzato " + score + " punti.\nInserisci il tuo nome per la classifica:", "Lupo Gamer");
        if (playerName && playerName.trim() !== "") {
            let lb = getLeaderboard();
            lb.push({ name: playerName.trim().substring(0, 15), score: score });
            lb.sort((a, b) => b.score - a.score);
            lb = lb.slice(0, 5); // Mantieni solo i primi 5
            saveLeaderboardData(lb);
            updateLeaderboard();
        }
    }, 200);
}

// Schermo intero
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        gameArea.requestFullscreen().catch(err => {
            alert("Errore schermo intero: " + err.message);
        });
    } else {
        document.exitFullscreen();
    }
}

startButton.addEventListener("click", startGame);
jumpButton.addEventListener("click", jump);
pauseButton.addEventListener("click", togglePause);
fullscreenButton.addEventListener("click", toggleFullScreen);

document.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        if (!running && !gameOver && loadingScreen.style.display === "none") startGame();
        else jump();
    }
    if (e.code === "KeyP") togglePause();
});

canvas.addEventListener("click", () => {
    if (!running && !gameOver && loadingScreen.style.display === "none") startGame();
    else jump();
});
