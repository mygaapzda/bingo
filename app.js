// app.js — CS2 Bingo main logic
import { db } from './firebase-config.js';
import {
  ref, set, get, update, onValue, push, remove, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ─── CS2 Challenge pool (30+ items for variety) ───────────────────────────
const CS2_CHALLENGES = [
  { icon: '🔪', text: 'Knife Kill' },
  { icon: '🎯', text: 'Headshot Only Round' },
  { icon: '💣', text: 'Bomb Defuse' },
  { icon: '💣', text: 'Bomb Plant' },
  { icon: '🃏', text: '1v1 Clutch' },
  { icon: '🃏', text: '1v2 Clutch' },
  { icon: '🃏', text: '1v3 Clutch' },
  { icon: '💥', text: '5-Kill Round (ACE)' },
  { icon: '🎰', text: 'Deagle Kill' },
  { icon: '🔫', text: 'AWP No-Scope' },
  { icon: '💨', text: 'Smoke Kill' },
  { icon: '🧱', text: 'Wall-bang Kill' },
  { icon: '💣', text: 'Grenade Kill' },
  { icon: '🔥', text: 'Molotov Kill' },
  { icon: '🏃', text: 'Zeus Kill' },
  { icon: '💰', text: 'Force Buy Win' },
  { icon: '🏦', text: 'Eco Round Win' },
  { icon: '🎮', text: 'Pistol Round Win' },
  { icon: '⚡', text: 'First Blood' },
  { icon: '🌀', text: 'Blind Kill (Flash)' },
  { icon: '🎪', text: 'Jumpshot Kill' },
  { icon: '🛡', text: '4 Kills in Round' },
  { icon: '🧠', text: 'MVP of Round' },
  { icon: '🏹', text: 'Through-Smoke AWP' },
  { icon: '🐔', text: 'Survive as Last Man' },
  { icon: '🎭', text: 'Fake Defuse Trick' },
  { icon: '🔄', text: 'Win After Pistol Loss' },
  { icon: '📦', text: 'Scout/SSG Kill' },
  { icon: '🌪', text: 'Rapid 3 Kills (< 3s)' },
  { icon: '💎', text: 'Win Losing Side Pistol' },
  { icon: '🎲', text: 'Survive with 1 HP' },
  { icon: '🕵', text: 'Rotate Bait MVP' },
  { icon: '🛸', text: 'M249 Kill' },
  { icon: '🔩', text: 'P90 Kill' },
  { icon: '🦅', text: 'AK Headshot Kill' },
];

const FREE_SPACE = { icon: '⭐', text: 'FREE', free: true };
const GRID_SIZE = 5;
const FREE_INDEX = 12; // center cell

// ─── Win line definitions (rows, cols, diagonals) ─────────────────────────
const WIN_LINES = (() => {
  const lines = [];
  for (let r = 0; r < 5; r++) {
    lines.push([0,1,2,3,4].map(c => r*5+c)); // rows
  }
  for (let c = 0; c < 5; c++) {
    lines.push([0,1,2,3,4].map(r => r*5+c)); // cols
  }
  lines.push([0,6,12,18,24]); // diagonal ↘
  lines.push([4,8,12,16,20]); // diagonal ↙
  return lines;
})();

// ─── State ────────────────────────────────────────────────────────────────
let roomId = '';
let myPlayerId = '';   // 'p1' | 'p2'
let myName = '';
let isHost = false;    // p1 is host
let roundNum = 1;
let scores = { p1: 0, p2: 0 };
let myMarked = new Array(25).fill(false);
let oppMarked = new Array(25).fill(false);
let myChallenges = [];
let oppChallenges = [];
let gameActive = false;
let countdownTimer = null;

// ─── Firebase refs helper ─────────────────────────────────────────────────
const roomRef  = () => ref(db, `rooms/${roomId}`);
const playerRef = (pid) => ref(db, `rooms/${roomId}/players/${pid}`);
const markedRef = (pid) => ref(db, `rooms/${roomId}/marked/${pid}`);
const gameRef   = () => ref(db, `rooms/${roomId}/game`);

// ─── Seeded shuffle (same seed → same shuffle for both players) ───────────
function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  const rand = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildGrid(seed, playerSlot) {
  // Each player gets same pool but different shuffle offset
  const offset = playerSlot === 'p1' ? 0 : 99999;
  const shuffled = seededShuffle(CS2_CHALLENGES, seed + offset);
  const cells = shuffled.slice(0, 24); // 24 + 1 free = 25
  cells.splice(FREE_INDEX, 0, FREE_SPACE); // insert FREE at center
  return cells;
}

// ─── Check win lines ──────────────────────────────────────────────────────
function checkWin(marked) {
  const wonLines = [];
  for (const line of WIN_LINES) {
    if (line.every(i => marked[i])) wonLines.push(line);
  }
  return wonLines;
}

// ─── DOM helpers ──────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.classList.add('hidden');
  });
  const el = $(`${name}-screen`);
  el.classList.remove('hidden');
  el.classList.add('active');
}

// ─── Setup Screen ─────────────────────────────────────────────────────────
function randomRoomId() {
  const words = ['cache','dust','mirage','inferno','nuke','overpass','cobble','train','vertigo','ancient'];
  return words[Math.floor(Math.random()*words.length)] + '-' + Math.floor(Math.random()*9000+1000);
}

$('random-room-btn').onclick = () => {
  $('room-input').value = randomRoomId();
};

// Pre-fill from URL query ?room=xxx&name=yyy
const urlParams = new URLSearchParams(location.search);
if (urlParams.get('room')) $('room-input').value = urlParams.get('room');
if (urlParams.get('name')) $('name-input').value = urlParams.get('name');

$('join-btn').onclick = async () => {
  const room = $('room-input').value.trim().replace(/\s+/g,'-').toLowerCase();
  const name = $('name-input').value.trim();
  if (!room) return showError('Өрөөний нэр оруулна уу!');
  if (!name) return showError('Таны нэрийг оруулна уу!');

  $('join-btn').disabled = true;
  $('join-btn').textContent = 'Холбогдож байна…';

  try {
    await joinRoom(room, name);
  } catch(e) {
    showError('Алдаа: ' + e.message);
    $('join-btn').disabled = false;
    $('join-btn').textContent = 'Нэгдэх / Үүсгэх';
  }
};

function showError(msg) {
  const el = $('setup-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ─── Join / Create Room ───────────────────────────────────────────────────
async function joinRoom(room, name) {
  roomId = room;
  myName = name;

  const snap = await get(roomRef());
  const data = snap.val();

  if (!data) {
    // Create room as p1
    myPlayerId = 'p1';
    isHost = true;
    await set(roomRef(), {
      players: { p1: { name, slot: 'p1', online: true } },
      scores: { p1: 0, p2: 0 },
      round: 1,
      status: 'lobby',
      seed: null,
    });
  } else if (data.players?.p1 && !data.players?.p2) {
    // Join as p2
    myPlayerId = 'p2';
    isHost = false;
    await update(ref(db, `rooms/${roomId}/players`), {
      p2: { name, slot: 'p2', online: true }
    });
  } else if (data.players?.p1?.name === name) {
    // Rejoin as p1
    myPlayerId = 'p1';
    isHost = true;
    await update(ref(db, `rooms/${roomId}/players/p1`), { online: true });
  } else if (data.players?.p2?.name === name) {
    // Rejoin as p2
    myPlayerId = 'p2';
    await update(ref(db, `rooms/${roomId}/players/p2`), { online: true });
  } else {
    throw new Error('Өрөө дүүрсэн байна (2/2)!');
  }

  goToLobby();
}

// ─── Lobby ────────────────────────────────────────────────────────────────
function goToLobby() {
  showScreen('lobby');
  const shareUrl = `${location.origin}${location.pathname}?room=${roomId}`;
  $('lobby-room-id').textContent = roomId;
  $('share-url').textContent = shareUrl;

  $('copy-btn').onclick = () => {
    navigator.clipboard.writeText(shareUrl);
    $('copy-btn').textContent = '✅';
    setTimeout(() => $('copy-btn').textContent = '📋', 2000);
  };

  $('start-btn').onclick = startGame;

  // Listen lobby state
  onValue(roomRef(), snap => {
    const data = snap.val();
    if (!data) return;

    const p1name = data.players?.p1?.name ?? 'Хүлээж байна…';
    const p2name = data.players?.p2?.name ?? 'Хүлээж байна…';
    $('p1-name').textContent = p1name;
    $('p2-name').textContent = p2name;

    const bothReady = data.players?.p1 && data.players?.p2;
    if (bothReady) {
      $('lobby-status').textContent = '✅ Бэлэн! Эхлүүлэх товч дар.';
      if (isHost) $('start-btn').classList.remove('hidden');
    } else {
      $('lobby-status').textContent = '2 тоглогч хүлээж байна…';
      $('start-btn').classList.add('hidden');
    }

    if (data.status === 'playing' || data.status === 'round_start') {
      initGameScreen(data);
    }
  });
}

// ─── Start Game (host only) ───────────────────────────────────────────────
async function startGame() {
  const seed = Date.now();
  await update(roomRef(), {
    status: 'round_start',
    seed,
    round: roundNum,
    winner: null,
  });
  await set(ref(db, `rooms/${roomId}/marked`), { p1: {}, p2: {} });
}

// ─── Game Screen ──────────────────────────────────────────────────────────
function initGameScreen(data) {
  if (gameActive) return;
  gameActive = true;

  const seed = data.seed;
  roundNum = data.round || 1;
  scores = data.scores || { p1: 0, p2: 0 };

  myChallenges = buildGrid(seed, myPlayerId);
  const oppSlot = myPlayerId === 'p1' ? 'p2' : 'p1';
  oppChallenges = buildGrid(seed, oppSlot);

  myMarked = new Array(25).fill(false);
  oppMarked = new Array(25).fill(false);
  // Free space always marked
  myMarked[FREE_INDEX] = true;
  oppMarked[FREE_INDEX] = true;

  showScreen('game');

  const myNameDisplay = data.players?.[myPlayerId]?.name ?? 'Би';
  const oppNameDisplay = data.players?.[oppSlot]?.name ?? 'Найз';

  $('game-room-id').textContent = roomId;
  $('round-num').textContent = roundNum;
  $('my-grid-label').textContent = myNameDisplay;
  $('opp-grid-label').textContent = oppNameDisplay;
  $('score-name-me').textContent = myNameDisplay;
  $('score-name-opp').textContent = oppNameDisplay;
  updateScoreDisplay();

  renderGrid('my-grid', myChallenges, myMarked, true);
  renderGrid('opp-grid', oppChallenges, oppMarked, false);

  $('game-status-bar').textContent = '🎯 Тоглоом эхэллээ! Биелүүлсэн challenge дээрээ дар.';

  // Listen to opponent marks
  onValue(markedRef(oppSlot), snap => {
    const raw = snap.val() || {};
    oppMarked = new Array(25).fill(false);
    oppMarked[FREE_INDEX] = true;
    Object.keys(raw).forEach(k => { if (!isNaN(k)) oppMarked[+k] = true; });
    renderGrid('opp-grid', oppChallenges, oppMarked, false);
    checkWinState();
  });

  // Listen for game events (winner, next round)
  onValue(gameRef(), snap => {
    const gdata = snap.val();
    if (!gdata) return;
    if (gdata.winner) showWinner(gdata.winner, data.players);
  });

  onValue(ref(db, `rooms/${roomId}/round`), snap => {
    const r = snap.val();
    if (r && r > roundNum) {
      roundNum = r;
    }
  });
}

// ─── Render Grid ──────────────────────────────────────────────────────────
function renderGrid(gridId, challenges, marked, interactive) {
  const grid = $(gridId);
  grid.innerHTML = '';

  const wonLines = checkWin(marked);
  const winCells = new Set(wonLines.flat());

  challenges.forEach((ch, i) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    if (ch.free) cell.classList.add('free-space');
    if (marked[i]) cell.classList.add('marked');
    if (winCells.has(i) && marked[i]) cell.classList.add('line-win');

    cell.innerHTML = `<span class="cell-icon">${ch.icon}</span>${ch.text}`;

    if (interactive && !ch.free) {
      cell.onclick = () => toggleCell(i);
    }
    grid.appendChild(cell);
  });

  // Show line count
  const linesEl = $(gridId.replace('-grid', '-lines-display'));
  if (linesEl) {
    const count = wonLines.length;
    linesEl.textContent = count > 0 ? `🏆 ${count} BINGO line!` : '';
  }
}

// ─── Toggle cell ──────────────────────────────────────────────────────────
async function toggleCell(index) {
  if (!gameActive) return;
  if (myChallenges[index]?.free) return;

  myMarked[index] = !myMarked[index];
  renderGrid('my-grid', myChallenges, myMarked, true);

  // Sync to Firebase
  const updates = {};
  myMarked.forEach((v, i) => { if (v && i !== FREE_INDEX) updates[i] = true; });
  await set(markedRef(myPlayerId), updates);

  checkWinState();
}

// ─── Win state check ──────────────────────────────────────────────────────
function checkWinState() {
  const myLines = checkWin(myMarked);
  const oppLines = checkWin(oppMarked);

  if (myLines.length > 0 && !$('win-modal').dataset.showing) {
    declareWinner(myPlayerId);
  }
}

async function declareWinner(winnerId) {
  if (!gameActive) return;
  // Only host writes winner to DB to avoid race
  if (isHost) {
    await update(gameRef(), { winner: winnerId, ts: serverTimestamp() });
  }
}

// ─── Show winner ──────────────────────────────────────────────────────────
function showWinner(winnerId, players) {
  if ($('win-modal').dataset.showing) return;
  $('win-modal').dataset.showing = '1';

  const iWon = winnerId === myPlayerId;
  scores[winnerId] = (scores[winnerId] || 0) + 1;
  updateScoreDisplay();

  // Update scores in DB (host only)
  if (isHost) {
    update(ref(db, `rooms/${roomId}/scores`), scores);
  }

  const winnerName = players?.[winnerId]?.name ?? winnerId;
  $('win-emoji').textContent = iWon ? '🏆' : '😢';
  $('win-title').textContent = iWon ? 'BINGO! Чи хожлоо!' : `${winnerName} хожлоо!`;
  $('win-msg').textContent = iWon
    ? '🎉 Гайхалтай! Дараагийн раундад бэлэн үү?'
    : '😤 Дараагийн удаа илүү хурдан бай!';

  $('win-modal').classList.remove('hidden');
  launchConfetti(iWon);

  // Countdown 5s
  let secs = 5;
  $('countdown-num').textContent = secs;
  $('countdown-fill').style.width = '100%';

  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    secs--;
    $('countdown-num').textContent = secs;
    $('countdown-fill').style.width = `${(secs/5)*100}%`;
    if (secs <= 0) {
      clearInterval(countdownTimer);
      startNextRound();
    }
  }, 1000);

  $('next-round-btn').onclick = () => {
    clearInterval(countdownTimer);
    startNextRound();
  };
}

// ─── Next Round ───────────────────────────────────────────────────────────
async function startNextRound() {
  $('win-modal').classList.add('hidden');
  delete $('win-modal').dataset.showing;
  gameActive = false;
  stopConfetti();

  roundNum++;

  if (isHost) {
    const newSeed = Date.now();
    await set(ref(db, `rooms/${roomId}/marked`), { p1: {}, p2: {} });
    await set(gameRef(), null);
    await update(roomRef(), {
      seed: newSeed,
      round: roundNum,
      status: 'round_start',
      winner: null,
    });
    // Re-init after update
    const snap = await get(roomRef());
    initGameScreen(snap.val());
  }
  // Non-host will reinit via onValue listener on roomRef
}

// Update room listener to handle round changes
onValue; // already listening above

// ─── Score display ────────────────────────────────────────────────────────
function updateScoreDisplay() {
  $('score-val-me').textContent = scores[myPlayerId] ?? 0;
  const opp = myPlayerId === 'p1' ? 'p2' : 'p1';
  $('score-val-opp').textContent = scores[opp] ?? 0;
  $('round-num').textContent = roundNum;
}

// ─── Confetti ─────────────────────────────────────────────────────────────
let confettiFrameId = null;
const canvas = $('confetti-canvas');
const ctx = canvas.getContext('2d');
let particles = [];

function launchConfetti(celebrate) {
  if (!celebrate) return;
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  particles = Array.from({ length: 120 }, () => ({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight - innerHeight,
    r: Math.random() * 6 + 3,
    d: Math.random() * 0.5 + 0.2,
    color: `hsl(${Math.random()*360},80%,60%)`,
    tilt: Math.random() * 10 - 10,
    tiltAngle: 0,
    tiltSpeed: Math.random() * 0.07 + 0.05,
  }));
  animateConfetti();
}

function animateConfetti() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => {
    p.tiltAngle += p.tiltSpeed;
    p.y += (Math.cos(p.d) + 3 + p.r / 2) * 0.4;
    p.x += Math.sin(p.d) * 0.8;
    p.tilt = Math.sin(p.tiltAngle) * 15;
    ctx.beginPath();
    ctx.lineWidth = p.r;
    ctx.strokeStyle = p.color;
    ctx.moveTo(p.x + p.tilt + p.r / 3, p.y);
    ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 5);
    ctx.stroke();
  });
  particles = particles.filter(p => p.y < canvas.height + 20);
  if (particles.length > 0) confettiFrameId = requestAnimationFrame(animateConfetti);
}

function stopConfetti() {
  if (confettiFrameId) cancelAnimationFrame(confettiFrameId);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles = [];
}

window.addEventListener('resize', () => {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
});
