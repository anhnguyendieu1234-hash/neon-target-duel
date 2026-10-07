const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const rooms = new Map();

const TOTAL_LEVELS = 3;
const SHOTS_PER_PLAYER = 3;

function getTarget(level, elapsed) {
  const speed = 0.00045 + level * 0.00012;

  const x = 0.5 + Math.sin(elapsed * speed) * 0.20;
  const y = 0.5 + Math.cos(elapsed * speed * 1.1) * 0.14;

  return { x, y };
}

function getTargetRadius(level) {
  if (level === 1) return 0.20;
  if (level === 2) return 0.18;
  return 0.16;
}

function createRoom(code) {
  return {
    code,
    players: [],
    level: 1,
    started: false,
    levelStartedAt: 0,
    finished: false
  };
}

function publicRoom(room) {
  return {
    code: room.code,
    level: room.level,
    started: room.started,
    finished: room.finished,
    levelStartedAt: room.levelStartedAt,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      helmet: p.helmet,
      color: p.color,
      score: p.score,
      shots: p.shots
    }))
  };
}

function sendRoomState(room) {
  io.to(room.code).emit("roomState", publicRoom(room));
}

function checkLevelComplete(room) {
  if (room.players.length < 2) return;

  const everyoneFinished =
    room.players[0].shots >= SHOTS_PER_PLAYER &&
    room.players[1].shots >= SHOTS_PER_PLAYER;

  if (!everyoneFinished) return;

  if (room.level < TOTAL_LEVELS) {
    room.level++;
    room.players.forEach(p => {
      p.shots = 0;
    });

    room.levelStartedAt = Date.now();
    sendRoomState(room);
  } else {
    room.finished = true;
    room.started = false;

    const winner =
      room.players[0].score === room.players[1].score
        ? "draw"
        : room.players[0].score > room.players[1].score
        ? room.players[0].id
        : room.players[1].id;

    io.to(room.code).emit("gameFinished", {
      winner,
      players: room.players.map(p => ({
        id: p.id,
        name: p.name,
        score: p.score
      }))
    });

    sendRoomState(room);
  }
}

io.on("connection", socket => {
  socket.on("createRoom", ({ name, helmet, color }) => {
    let code;

    do {
      code = Math.random().toString(36).substring(2, 7).toUpperCase();
    } while (rooms.has(code));

    const room = createRoom(code);

    room.players.push({
      id: socket.id,
      name,
      helmet,
      color,
      score: 0,
      shots: 0
    });

    rooms.set(code, room);
    socket.join(code);

    socket.emit("roomCreated", { code });
    sendRoomState(room);
  });

  socket.on("joinRoom", ({ code, name, helmet, color }) => {
    code = String(code || "").trim().toUpperCase();

    const room = rooms.get(code);

    if (!room) {
      socket.emit("errorMessage", "Không tìm thấy phòng.");
      return;
    }

    if (room.players.length >= 2) {
      socket.emit("errorMessage", "Phòng đã đủ 2 người.");
      return;
    }

    room.players.push({
      id: socket.id,
      name,
      helmet,
      color,
      score: 0,
      shots: 0
    });

    socket.join(code);

    sendRoomState(room);
  });

  socket.on("startGame", () => {
    const room = [...rooms.values()].find(r =>
      r.players.some(p => p.id === socket.id)
    );

    if (!room || room.players.length !== 2) return;

    room.started = true;
    room.finished = false;
    room.level = 1;
    room.levelStartedAt = Date.now();

    room.players.forEach(p => {
      p.score = 0;
      p.shots = 0;
    });

    sendRoomState(room);
  });

  socket.on("shoot", ({ x, y }) => {
    const room = [...rooms.values()].find(r =>
      r.players.some(p => p.id === socket.id)
    );

    if (!room || !room.started || room.finished) return;

    const player = room.players.find(p => p.id === socket.id);

    if (!player || player.shots >= SHOTS_PER_PLAYER) return;

    player.shots++;

    const elapsed = Date.now() - room.levelStartedAt;
    const target = getTarget(room.level, elapsed);
    const radius = getTargetRadius(room.level);

    const distance = Math.sqrt(
      Math.pow(x - target.x, 2) +
      Math.pow(y - target.y, 2)
    );

    const hit = distance <= radius;

    let points = 0;

    if (hit) {
      points = room.level === 1 ? 100 : room.level === 2 ? 150 : 200;
      player.score += points;
    }

    io.to(room.code).emit("shotResult", {
      playerId: player.id,
      hit,
      points,
      x,
      y,
      playerShots: player.shots
    });

    sendRoomState(room);
    checkLevelComplete(room);
  });

  socket.on("restartGame", () => {
    const room = [...rooms.values()].find(r =>
      r.players.some(p => p.id === socket.id)
    );

    if (!room || room.players.length !== 2) return;

    room.level = 1;
    room.started = true;
    room.finished = false;
    room.levelStartedAt = Date.now();

    room.players.forEach(p => {
      p.score = 0;
      p.shots = 0;
    });

    sendRoomState(room);
  });

  socket.on("disconnect", () => {
    for (const [code, room] of rooms) {
      const index = room.players.findIndex(p => p.id === socket.id);

      if (index !== -1) {
        room.players.splice(index, 1);

        if (room.players.length === 0) {
          rooms.delete(code);
        } else {
          room.started = false;
          sendRoomState(room);
        }

        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Game server running on port ${PORT}`);
});
