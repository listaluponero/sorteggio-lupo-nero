"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Elementi UI
const loadingScreen = document.getElementById("loadingScreen");
const gameArea = document.getElementById("gameArea");
const startButton = document.getElementById("startGame");
const jumpButton = document.getElementById("jumpGame");
const pauseButton = document.getElementById("pauseGame");
const scoreElement = document.getElementById("score");
const bestElement = document.getElementById("personalBest");

// Dimensioni e parametri di gioco
const W = canvas.width;
const H = canvas.height;
const groundY = H - 80;

const START_SPEED = 4.5;
const playerConfig = {
    x: 70,
    w: 90,  // Proporzione ottimale per lo sprite del lupo
    h: 55,
    gravity: 0.8,
    jumpPower: -14
};

// ======================================
// PRE-CARICAMENTO ASSET DALLA CARTELLA "modelli"
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
            if (loadedImagesCount === totalImages) {
                callbacks.onComplete();
            }
        };

        images[key].onerror = () => {
            console.error("Errore nel caricamento del file:", src);
            loadedImagesCount++;
            if (loadedImagesCount === totalImages) {
                callbacks.onComplete();
            }
        };
    }
}

// Avvia il caricamento risorse all'apertura della pagina
window.addEventListener("load", () => {
    preLoadImages({
        onComplete: () => {
            loadingScreen.style.display = "none";
            gameArea.style.display = "block";
            initGame();
            drawGame();
        }
    });
});

// ======================================
// STATO DI GIOCO
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
    // Sfondo notte
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#090b14"); 
    sky.addColorStop(1, "#201b2b");
    ctx.fillStyle = sky; 
    ctx.fillRect(0, 0, W, H);

    // Luna
    ctx.fillStyle = "#e9e3d6"; 
    ctx.beginPath(); 
    ctx.arc(320, 95, 26, 0, Math.PI * 2); 
    ctx.fill();

    // Terreno
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

    // Alternanza dei 2 fotogrammi per la corsa
    let imgToDraw;
    if (!player.grounded) {
        imgToDraw = images.lupoRun1;
    } else {
        const frame = Math.floor(distance / 20) % 2;
        imgToDraw = frame === 0 ? images.lupoRun1 : images.lupoRun2;
    }

    // Disegna lo sprite se caricato, altrimenti un fallback visivo
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
        drawOverlay("LUPO RUNNER", "Premi INIZIA o barra SPAZIO per correre");
    } else if (paused) {
        drawOverlay("PAUSA", "Premi RIPRENDI per continuare");
    } else if (gameOver) {
        drawOverlay("GAME OVER", "Punteggio: " + score + " | Record: " + best);
    }
}

function drawOverlay(title, subtitle) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center"; 
    ctx.fillStyle = "#fff";
    ctx.font = "bold 36px sans-serif"; 
    ctx.fillText(title, W / 2, H / 2 - 10);
    ctx.font = "18px sans-serif"; 
    ctx.fillStyle = "#ccc"; 
    ctx.fillText(subtitle, W / 2, H / 2 + 30);
}

// ======================================
// LOGICA DI GIOCO
// ======================================

function createObstacle() {
    const size = 35;
    obstacles.push({
        x: W + 50,
        y: groundY - size,
        w: size,
        h: size
    });
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

    // Fisica Salto
    player.vy += player.gravity * dt;
    player.y += player.vy * dt;

    if (player.y + player.h >= groundY) {
        player.y = groundY - player.h;
        player.vy = 0;
        player.grounded = true;
    }

    // Ostacoli
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
// EVENTI E CONTROLLI
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
}

startButton.addEventListener("click", startGame);
jumpButton.addEventListener("click", jump);
pauseButton.addEventListener("click", togglePause);

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
