const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e4,
  pingTimeout: 60000,
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 計分儲存 — 使用 Map（130 人完全足夠）
// Key: socketId, Value: { name, score, bestScore, gameStatus, connectedAt }
const players = new Map();

// 服務靜態檔案
app.use(express.static(path.join(__dirname, 'public')));

// API: 獲取排行榜
app.get('/api/leaderboard', (req, res) => {
  const leaderboard = getLeaderboard();
  res.json(leaderboard);
});

// API: 獲取在場玩家數
app.get('/api/stats', (req, res) => {
  res.json({
    onlinePlayers: players.size,
    topScore: Math.max(...[...players.values()].map(p => p.bestScore), 0)
  });
});

// Socket.io 連接處理
io.on('connection', (socket) => {
  console.log(`[+] 玩家連線: ${socket.id}`);

  // 註冊玩家
  socket.on('register', (data) => {
    const name = data.name.trim() || `玩家${Math.floor(Math.random() * 9999)}`;
    players.set(socket.id, {
      name: name,
      score: 0,
      bestScore: 0,
      gameStatus: 'idle',
      connectedAt: Date.now()
    });
    socket.join('leaderboard');
    
    console.log(`[+] 註冊: ${name} (${socket.id})`);
    
    io.emit('leaderboard:update', getLeaderboard());
    io.emit('stats:update', { onlinePlayers: players.size });
  });

  // 遊戲分數更新（每 500ms 或每次通過障礙物）
  socket.on('score:update', (data) => {
    const player = players.get(socket.id);
    if (player) {
      player.score = data.score;
      player.gameStatus = 'playing';
      io.emit('leaderboard:update', getLeaderboard());
    }
  });

  // 遊戲結束
  socket.on('game:end', (data) => {
    const player = players.get(socket.id);
    if (player) {
      player.score = 0;
      player.bestScore = Math.max(player.bestScore, data.score);
      player.gameStatus = 'finished';
      console.log(`[!] 遊戲結束: ${player.name} - ${data.score} 分`);
      io.emit('leaderboard:update', getLeaderboard());
      io.emit('stats:update', { onlinePlayers: players.size });
    }
  });

  // 重新開始
  socket.on('game:restart', () => {
    const player = players.get(socket.id);
    if (player) {
      player.score = 0;
      player.gameStatus = 'playing';
      io.emit('leaderboard:update', getLeaderboard());
    }
  });

  // 獲取排行榜
  socket.on('leaderboard:request', () => {
    socket.emit('leaderboard:update', getLeaderboard());
  });

  // 斷線處理
  socket.on('disconnect', () => {
    console.log(`[-] 玩家斷線: ${socket.id}`);
    players.delete(socket.id);
    io.emit('leaderboard:update', getLeaderboard());
    io.emit('stats:update', { onlinePlayers: players.size });
  });
});

// 取得排行前 20 名
function getLeaderboard() {
  return [...players.values()]
    .filter(p => p.bestScore > 0)
    .sort((a, b) => b.bestScore - a.bestScore)
    .slice(0, 20)
    .map((p, i) => ({
      rank: i + 1,
      name: p.name,
      score: p.bestScore,
      online: p.gameStatus === 'playing'
    }));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`========================================`);
  console.log(`  婚禮跑酷大挑戰 伺服器啟動!`);
  console.log(`  遊戲網址: http://localhost:${PORT}`);
  console.log(`  排行榜網址: http://localhost:${PORT}/leaderboard.html`);
  console.log(`========================================`);
});
