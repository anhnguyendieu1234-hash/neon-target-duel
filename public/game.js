const socket = io();

let myPlayerId = null;
let currentRoom = null;
let selectedHelmet = "🪖";
let selectedColor = "#00bfff";
let myShots = 0;
let animationId = null;

const setupScreen = document.getElementById("setupScreen");
const waitingScreen = document.getElementById("waitingScreen");
const gameScreen = document.getElementById("gameScreen");
const resultScreen = document.getElementById("resultScreen");

const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");
const errorText = document.getElementById("errorText");

const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

const roomCodeText = document.getElementById("roomCode");
const playersList = document.getElementById("playersList");

const gameArea = document.getElementById("gameArea");
const target = document.getElementById("target");

const levelText = document.getElementById("levelText");
const shotsText = document.getElementById("shotsText");
const gameMessage = document.getElementById("gameMessage");

const player1Name = document.getElementById("player1Name");
const player2Name = document.getElementById("player2Name");
const player1Helmet = document.getElementById("player1Helmet");
const player2Helmet = document.getElementById("player2Helmet");
const player1Score = document.getElementById("player1Score");
const player2Score = document.getElementById("player2Score");

const resultText = document.getElementById("resultText");


// =========================
// CHỌN MŨ
// =========================

document.querySelectorAll("#helmetOptions .option").forEach(button => {
  button.addEventListener("click", () => {
    document
      .querySelectorAll("#helmetOptions .option")
      .forEach(b => b.classList.remove("selected"));

    button.classList.add("selected");
    selectedHelmet = button.dataset.helmet;
  });
});


// =========================
// CHỌN MÀU
// =========================

document.querySelectorAll("#colorOptions .color").forEach(button => {
  button.addEventListener("click", () => {
    document
      .querySelectorAll("#colorOptions .color")
      .forEach(b => b.classList.remove("selected"));

    button.classList.add("selected");
    selectedColor = button.dataset.color;
  });
});


// =========================
// KIỂM TRA TÊN
// =========================

function getName() {
  const name = nameInput.value.trim();

  if (!name) {
    errorText.textContent = "Em chưa nhập tên.";
    return null;
  }

  errorText.textContent = "";
  return name;
}


// =========================
// TẠO PHÒNG
// =========================

createBtn.addEventListener("click", () => {
  const name = getName();

  if (!name) return;

  socket.emit("createRoom", {
    name,
    helmet: selectedHelmet,
    color: selectedColor
  });
});


// =========================
// VÀO PHÒNG
// =========================

joinBtn.addEventListener("click", () => {
  const name = getName();

  if (!name) return;

  const code = roomInput.value.trim();

  if (!code) {
    errorText.textContent = "Em chưa nhập mã phòng.";
    return;
  }

  socket.emit("joinRoom", {
    code,
    name,
    helmet: selectedHelmet,
    color: selectedColor
  });
});


// =========================
// PHÒNG ĐƯỢC TẠO
// =========================

socket.on("roomCreated", data => {
  roomCodeText.textContent = data.code;
});


// =========================
// CẬP NHẬT PHÒNG
// =========================

socket.on("roomState", room => {
  currentRoom = room;

  updatePlayers(room);

  if (!room.started && !room.finished) {
    showScreen(waitingScreen);

    roomCodeText.textContent = room.code;

    startBtn.disabled = room.players.length !== 2;

    if (room.players.length === 1) {
      startBtn.textContent = "Đang chờ người chơi...";
    } else {
      startBtn.textContent = "Bắt đầu";
    }
  }

  if (room.started) {
    showScreen(gameScreen);

    levelText.textContent = room.level;

    const me = room.players.find(p => p.id === myPlayerId);

    if (me) {
      myShots = me.shots;
      shotsText.textContent = `${me.shots}/3`;
    }

    updatePlayers(room);
    startTargetAnimation(room);
  }
});


// =========================
// CẬP NHẬT NGƯỜI CHƠI
// =========================

function updatePlayers(room) {
  playersList.innerHTML = "";

  room.players.forEach((player, index) => {
    const div = document.createElement("div");

    div.className = "playerWaiting";

    div.innerHTML = `
      ${player.helmet}
      <strong>${escapeHtml(player.name)}</strong>
      — ${player.score} điểm
    `;

    playersList.appendChild(div);

    if (index === 0) {
      player1Name.textContent = player.name;
      player1Helmet.textContent = player.helmet;
      player1Score.textContent = player.score;
    }

    if (index === 1) {
      player2Name.textContent = player.name;
      player2Helmet.textContent = player.helmet;
      player2Score.textContent = player.score;
    }
  });

  if (room.players.length < 2) {
    player2Name.textContent = "Đang chờ...";
    player2Helmet.textContent = "❔";
    player2Score.textContent = "0";
  }
}


// =========================
// BẮT ĐẦU GAME
// =========================

startBtn.addEventListener("click", () => {
  if (!currentRoom || currentRoom.players.length !== 2) return;

  socket.emit("startGame");
});


// =========================
// ANIMATION MỤC TIÊU
// =========================

function startTargetAnimation(room) {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }

  function animate() {
    if (!currentRoom || !currentRoom.started) return;

    const elapsed =
      Date.now() - currentRoom.levelStartedAt;

    const level = currentRoom.level;

   const speed = 0.00045 + level * 0.00012;

const x =
  0.5 + Math.sin(elapsed * speed) * 0.20;

const y =
  0.5 + Math.cos(elapsed * speed * 1.1) * 0.14;

    target.style.left = `${x * 100}%`;
    target.style.top = `${y * 100}%`;

    animationId = requestAnimationFrame(animate);
  }

  animate();
}


// =========================
// CLICK / CHẠM MỤC TIÊU
// =========================

gameArea.addEventListener("pointerdown", event => {
  if (!currentRoom || !currentRoom.started) return;

  if (myShots >= 3) {
    gameMessage.textContent =
      "Em đã dùng hết 3 lượt. Chờ người chơi còn lại.";
    return;
  }

  const rect = gameArea.getBoundingClientRect();

  const x =
    (event.clientX - rect.left) / rect.width;

  const y =
    (event.clientY - rect.top) / rect.height;

  createEnergyEffect(x, y);

  socket.emit("shoot", {
    x,
    y
  });
});


// =========================
// HIỆU ỨNG NĂNG LƯỢNG
// =========================

function createEnergyEffect(x, y) {
  const energy = document.createElement("div");

  energy.className = "energy";

  energy.style.left = `${x * 100}%`;
  energy.style.top = `${y * 100}%`;
  energy.style.background = selectedColor;
  energy.style.boxShadow =
    `0 0 15px ${selectedColor}, 0 0 35px ${selectedColor}`;

  gameArea.appendChild(energy);

  setTimeout(() => {
    energy.remove();
  }, 500);
}


// =========================
// KẾT QUẢ NÉM
// =========================

socket.on("shotResult", data => {
  if (!currentRoom) return;

  if (data.playerId === myPlayerId) {
    myShots = data.playerShots;
    shotsText.textContent = `${myShots}/3`;
  }

  if (data.hit) {
    showHitEffect(data.x, data.y);

    if (data.playerId === myPlayerId) {
      gameMessage.textContent =
        `🎯 Trúng! +${data.points} điểm!`;
    } else {
      gameMessage.textContent =
        `🎯 ${getPlayerName(data.playerId)} đã trúng!`;
    }
  } else {
    if (data.playerId === myPlayerId) {
      gameMessage.textContent = "❌ Trượt!";
    }
  }
});


// =========================
// HIỆU ỨNG TRÚNG
// =========================

function showHitEffect(x, y) {
  const effect = document.createElement("div");

  effect.className = "hitEffect";
  effect.textContent = "💥✨";

  effect.style.left = `${x * 100}%`;
  effect.style.top = `${y * 100}%`;

  gameArea.appendChild(effect);

  setTimeout(() => {
    effect.remove();
  }, 800);
}



// =========================
// GAME KẾT THÚC
// =========================

socket.on("gameFinished", data => {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  showScreen(resultScreen);

  const players = data.players;

  const p1 = players[0];
  const p2 = players[1];

  let winnerText;

  if (data.winner === "draw") {
    winnerText = "🤝 HAI NGƯỜI HÒA NHAU!";
  } else {
    const winner = players.find(p => p.id === data.winner);
    winnerText = `🏆 ${escapeHtml(winner.name)} THẮNG!`;
  }

  resultText.innerHTML = `
    <h2>${winnerText}</h2>
    <p>${escapeHtml(p1.name)}: <strong>${p1.score}</strong> điểm</p>
    <p>${escapeHtml(p2.name)}: <strong>${p2.score}</strong> điểm</p>
  `;
});


// =========================
// CHƠI LẠI
// =========================

restartBtn.addEventListener("click", () => {
  socket.emit("restartGame");
});


// =========================
// LỖI
// =========================

socket.on("errorMessage", message => {
  errorText.textContent = message;
});


// =========================
// XÁC ĐỊNH ID CỦA MÌNH
// =========================

socket.on("connect", () => {
  myPlayerId = socket.id;
});


// =========================
// CHUYỂN MÀN HÌNH
// =========================

function showScreen(screen) {
  [
    setupScreen,
    waitingScreen,
    gameScreen,
    resultScreen
  ].forEach(s => {
    s.classList.add("hidden");
  });

  screen.classList.remove("hidden");
}


// =========================
// TÌM TÊN NGƯỜI CHƠI
// =========================

function getPlayerName(id) {
  if (!currentRoom) return "Người chơi";

  const player = currentRoom.players.find(
    p => p.id === id
  );

  return player ? player.name : "Người chơi";
}


// =========================
// CHỐNG HTML LẠ
// =========================

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
