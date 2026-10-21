"use strict";

/* =========================================================
   LUPO RUNNER — VERSIONE COMPLETA CORRETTA
   - Collisioni ridotte
   - Pecora innocua dopo il lancio della lana
   - Gomitolo più prevedibile e schivabile
   - Distanza minima tra gli ostacoli
   - Angelo che scende e rimane in basso
   - Fullscreen, rigioca e ritorno alla lista
========================================================= */

const LEADERBOARD_API_URL =
    "https://script.google.com/macros/s/AKfycbxJgp0aOu-zdvidw2ktjx2PiT3SLC7CQWycYAzEEfggzl_1bEE1zfdYAPsXuHg1hoYO/exec";

/* =========================================================
   ELEMENTI HTML
========================================================= */

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

/* =========================================================
   CANVAS
========================================================= */

const W = 800;
const H = 400;

canvas.width = W;
canvas.height = H;

const groundY = H - 80;

/* =========================================================
   DIFFICOLT
