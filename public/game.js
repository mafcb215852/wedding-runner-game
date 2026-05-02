// 婚禮跑酷大挑戰 - 遊戲引擎
(function() {
  'use strict';

  // ===== Socket.io 連線 =====
  const socket = io();
  let playerName = '';
  let playerBestScore = 0;
  let playerRank = 0;
  let currentScore = 0;

  // ===== DOM 元素 =====
  const nameScreen = document.getElementById('name-screen');
  const gameScreen = document.getElementById('game-screen');
  const resultScreen = document.getElementById('result-screen');
  const nameInput = document.getElementById('name-input');
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const shareBtn = document.getElementById('share-btn');
  const gameCanvas = document.getElementById('game-canvas');
  const hudScore = document.getElementById('hud-score');
  const hudBest = document.getElementById('hud-best');
  const finalScore = document.getElementById('final-score');
  const finalRank = document.getElementById('final-rank');
  const bestScore = document.getElementById('best-score');
  const gameInstructions = document.getElementById('game-instructions');

  // ===== 遊戲狀態 =====
  let canvas, ctx;
  let W, H;
  let gameRunning = false;
  let animationId = null;
  let lastScoreUpdate = 0;

  // 玩家角色
  const player = {
    x: 80,
    y: 0,
    width: 40,
    height: 60,
    vy: 0,
    isJumping: false,
    grounded: false,
    color: '#ff6b6b'
  };

  // 重力與跳躍
  const GRAVITY = 0.8;
  const JUMP_FORCE = -14;
  const GROUND_HEIGHT = 100;

  // 障礙物
  let obstacles = [];
  let obstacleTimer = 0;
  let obstacleInterval = 120;

  // 遊戲速度
  let gameSpeed = 5;
  let maxSpeed = 12;
  let speedIncrement = 0.002;

  // 背景元素
  let bgElements = [];
  let clouds = [];
  let hearts = [];

  // 分數
  let score = 0;
  let distanceScore = 0;

  // 倒數計時
  let timeLimit = 45;
  let timeRemaining = 45;
  let lastTimeUpdate = 0;

  // ===== 初始化 =====
  function init() {
    canvas = gameCanvas;
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 初始化背景元素
    initBackground();

    // 事件監聽
    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', restartGame);
    shareBtn.addEventListener('click', shareScore);
    
    // 觸控/點擊跳躍
    canvas.addEventListener('touchstart', handleJump, { passive: false });
    canvas.addEventListener('mousedown', handleJump);
    
    // 鍵盤跳躍
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleJump();
      }
    });

    // Socket.io 事件
    socket.on('leaderboard:update', updateLeaderboard);
    socket.on('stats:update', updateStats);

    // 自動發送排行榜請求
    socket.emit('leaderboard:request');
  }

  function resizeCanvas() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
    player.y = H - GROUND_HEIGHT - player.height;
  }

  function initBackground() {
    // 初始化雲朵
    for (let i = 0; i < 5; i++) {
      clouds.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.4 + 20,
        size: Math.random() * 40 + 30,
        speed: Math.random() * 0.5 + 0.2
      });
    }
  }

  // ===== 畫面切換 =====
  function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
  }

  // ===== 全螢幕 =====
  function requestFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
      // Safari / iOS
      elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
      // IE11
      elem.msRequestFullscreen();
    }
  }

  // ===== 遊戲開始 =====
  function startGame() {
    playerName = nameInput.value.trim() || `玩家${Math.floor(Math.random() * 9999)}`;
    
    // 註冊到伺服器
    socket.emit('register', { name: playerName });

    // 重置遊戲狀態
    resetGame();
    
    // 切換畫面
    showScreen(gameScreen);
    gameInstructions.style.display = 'block';
    
    // 請求全螢幕
    requestFullscreen();
    
    // 開始遊戲
    gameRunning = true;
    gameLoop();

    // 隱藏提示
    setTimeout(() => {
      gameInstructions.style.display = 'none';
    }, 3000);
  }

  function resetGame() {
    player.y = H - GROUND_HEIGHT - player.height;
    player.vy = 0;
    player.isJumping = false;
    player.grounded = true;
    obstacles = [];
    obstacleTimer = 0;
    gameSpeed = 5;
    score = 0;
    distanceScore = 0;
    lastScoreUpdate = 0;
    hearts = [];

    // 重置倒數計時
    timeRemaining = timeLimit;
    lastTimeUpdate = Date.now();
  }

  // ===== 遊戲主循環 =====
  function gameLoop() {
    if (!gameRunning) return;

    update();
    draw();

    // 每 500ms 發送分數到伺服器
    const now = Date.now();
    if (now - lastScoreUpdate > 500) {
      socket.emit('score:update', { score: score });
      lastScoreUpdate = now;
    }

    // 每 100ms 更新倒數計時 HUD
    if (now - lastTimeUpdate >= 100) {
      updateTimerDisplay();
      lastTimeUpdate = now;
    }

    animationId = requestAnimationFrame(gameLoop);
  }

  // ===== 遊戲更新 =====
  function update() {
    // 增加遊戲速度
    if (gameSpeed < maxSpeed) {
      gameSpeed += speedIncrement;
    }

    // 更新距離分數
    distanceScore += gameSpeed * 0.1;
    score = Math.floor(distanceScore);
    hudScore.textContent = `分數: ${score}`;
    hudBest.textContent = `最高: ${playerBestScore}`;

    // 更新玩家物理
    player.vy += GRAVITY;
    player.y += player.vy;

    // 地面碰撞
    const groundY = H - GROUND_HEIGHT - player.height;
    if (player.y >= groundY) {
      player.y = groundY;
      player.vy = 0;
      player.grounded = true;
      player.isJumping = false;
    } else {
      player.grounded = false;
    }

    // 生成障礙物
    obstacleTimer++;
    if (obstacleTimer > obstacleInterval) {
      spawnObstacle();
      obstacleTimer = 0;
      // 隨機間隔
      obstacleInterval = Math.floor(Math.random() * 60 + 80 - gameSpeed * 2);
      if (obstacleInterval < 40) obstacleInterval = 40;
    }

    // 更新障礙物
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.x -= gameSpeed;

      // 碰撞檢測
      if (checkCollision(player, obs)) {
        gameOver();
        return;
      }

      // 通過障礙物加分
      if (!obs.passed && obs.x + obs.width < player.x) {
        obs.passed = true;
        score += 10;
        distanceScore += 10;

        // 產生愛心特效
        for (let j = 0; j < 3; j++) {
          hearts.push({
            x: player.x + player.width / 2,
            y: player.y,
            vx: (Math.random() - 0.5) * 4,
            vy: -Math.random() * 3 - 1,
            life: 30,
            size: Math.random() * 10 + 8
          });
        }
      }

      // 移除超出畫面的障礙物
      if (obs.x + obs.width < -50) {
        obstacles.splice(i, 1);
      }
    }

    // 更新雲朵
    clouds.forEach(cloud => {
      cloud.x -= cloud.speed;
      if (cloud.x + cloud.size < 0) {
        cloud.x = W + cloud.size;
        cloud.y = Math.random() * H * 0.4 + 20;
      }
    });

    // 更新愛心特效
    for (let i = hearts.length - 1; i >= 0; i--) {
      const heart = hearts[i];
      heart.x += heart.vx;
      heart.y += heart.vy;
      heart.vy += 0.1;
      heart.life--;
      if (heart.life <= 0) {
        hearts.splice(i, 1);
      }
    }

    // 檢查倒數計時
    checkTimer();
  }

  // ===== 繪製 =====
  function draw() {
    // 清除畫布
    ctx.clearRect(0, 0, W, H);

    // 繪製天空漸層
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, '#87CEEB');
    skyGrad.addColorStop(0.6, '#E0F7FA');
    skyGrad.addColorStop(1, '#FFF8E1');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // 繪製雲朵
    drawClouds();

    // 繪製遠景（花拱門輪廓）
    drawBackgroundScenery();

    // 繪製地面
    drawGround();

    // 繪製障礙物
    drawObstacles();

    // 繪製玩家
    drawPlayer();

    // 繪製愛心特效
    drawHearts();
  }

  function drawClouds() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    clouds.forEach(cloud => {
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, cloud.size, 0, Math.PI * 2);
      ctx.arc(cloud.x + cloud.size * 0.6, cloud.y - cloud.size * 0.2, cloud.size * 0.7, 0, Math.PI * 2);
      ctx.arc(cloud.x - cloud.size * 0.6, cloud.y - cloud.size * 0.1, cloud.size * 0.6, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawBackgroundScenery() {
    // 花拱門輪廓（遠景）
    ctx.strokeStyle = 'rgba(255, 183, 197, 0.3)';
    ctx.lineWidth = 3;
    const archX = (Date.now() * 0.02) % (W + 200) - 100;
    
    ctx.beginPath();
    ctx.arc(archX, H - GROUND_HEIGHT - 80, 80, Math.PI, 0);
    ctx.stroke();

    // 花裝飾
    ctx.fillStyle = 'rgba(255, 183, 197, 0.4)';
    for (let i = 0; i < 5; i++) {
      const angle = Math.PI + (i / 4) * Math.PI;
      const fx = archX + Math.cos(angle) * 80;
      const fy = H - GROUND_HEIGHT - 80 + Math.sin(angle) * 80;
      ctx.beginPath();
      ctx.arc(fx, fy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGround() {
    // 地面
    const groundY = H - GROUND_HEIGHT;
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, H);
    groundGrad.addColorStop(0, '#8BC34A');
    groundGrad.addColorStop(0.3, '#689F38');
    groundGrad.addColorStop(1, '#558B2F');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, W, GROUND_HEIGHT);

    // 草地紋理
    ctx.strokeStyle = '#7CB342';
    ctx.lineWidth = 2;
    const offset = (Date.now() * gameSpeed * 0.05) % 30;
    for (let x = -offset; x < W; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x + 5, groundY - 8);
      ctx.lineTo(x + 10, groundY);
      ctx.stroke();
    }

    // 地面線條
    ctx.strokeStyle = '#558B2F';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();
  }

  function drawPlayer() {
    const px = player.x;
    const py = player.y;

    // 身體
    ctx.fillStyle = '#FF6B6B';
    ctx.fillRect(px, py + 20, player.width, player.height - 20);

    // 頭
    ctx.fillStyle = '#FFE0BD';
    ctx.beginPath();
    ctx.arc(px + player.width / 2, py + 15, 15, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(px + player.width / 2 + 5, py + 12, 3, 0, Math.PI * 2);
    ctx.fill();

    // 微笑
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px + player.width / 2 + 3, py + 18, 5, 0, Math.PI);
    ctx.stroke();

    // 帽子（新郎帽）
    ctx.fillStyle = '#333';
    ctx.fillRect(px + 5, py - 5, player.width - 10, 8);
    ctx.fillRect(px + 10, py - 12, player.width - 20, 10);

    // 腿（跑動動畫）
    const legOffset = Math.sin(Date.now() * 0.01) * 5;
    ctx.fillStyle = '#333';
    ctx.fillRect(px + 8, py + player.height, 8, 10 + legOffset);
    ctx.fillRect(px + 24, py + player.height, 8, 10 - legOffset);
  }

  function drawObstacles() {
    obstacles.forEach(obs => {
      if (obs.type === 'flower') {
        drawFlowerObstacle(obs);
      } else if (obs.type === 'cup') {
        drawCupObstacle(obs);
      } else if (obs.type === 'cake') {
        drawCakeObstacle(obs);
      }
    });
  }

  function drawFlowerObstacle(obs) {
    // 花束障礙物
    const x = obs.x;
    const y = obs.y;
    const w = obs.width;
    const h = obs.height;

    // 花莖
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + h);
    ctx.lineTo(x + w / 2, y + h * 0.4);
    ctx.stroke();

    // 花朵
    const colors = ['#FF6B6B', '#FFD700', '#FF69B4', '#FFA500'];
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      const angle = (i / 5) * Math.PI * 2;
      const fx = x + w / 2 + Math.cos(angle) * 10;
      const fy = y + h * 0.3 + Math.sin(angle) * 10;
      ctx.arc(fx, fy, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 花心
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.3, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCupObstacle(obs) {
    const x = obs.x;
    const y = obs.y;
    const w = obs.width;
    const h = obs.height;

    // 香檳杯
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.strokeStyle = '#DDD';
    ctx.lineWidth = 2;

    // 杯身
    ctx.beginPath();
    ctx.moveTo(x + 5, y);
    ctx.lineTo(x + w - 5, y);
    ctx.lineTo(x + w - 10, y + h * 0.7);
    ctx.lineTo(x + 10, y + h * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 杯腳
    ctx.fillStyle = '#DDD';
    ctx.fillRect(x + w / 2 - 2, y + h * 0.7, 4, h * 0.2);

    // 杯底
    ctx.fillStyle = '#CCC';
    ctx.fillRect(x + w / 2 - 10, y + h * 0.9, 20, 4);

    // 香檳液體
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 5);
    ctx.lineTo(x + w - 8, y + 5);
    ctx.lineTo(x + w - 12, y + h * 0.5);
    ctx.lineTo(x + 12, y + h * 0.5);
    ctx.closePath();
    ctx.fill();

    // 氣泡
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for (let i = 0; i < 3; i++) {
      const bx = x + 10 + i * 8;
      const by = y + h * 0.3 + Math.sin(Date.now() * 0.005 + i) * 3;
      ctx.beginPath();
      ctx.arc(bx, by, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCakeObstacle(obs) {
    const x = obs.x;
    const y = obs.y;
    const w = obs.width;
    const h = obs.height;

    // 蛋糕底層
    ctx.fillStyle = '#FFB6C1';
    ctx.fillRect(x, y + h * 0.5, w, h * 0.5);

    // 蛋糕中層
    ctx.fillStyle = '#FFC0CB';
    ctx.fillRect(x + 5, y + h * 0.25, w - 10, h * 0.3);

    // 蛋糕頂層
    ctx.fillStyle = '#FFD1DC';
    ctx.fillRect(x + 10, y, w - 20, h * 0.3);

    // 奶油裝飾
    ctx.fillStyle = '#FFF';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(x + 10 + i * (w - 20) / 3, y + h * 0.5, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 頂部愛心
    ctx.fillStyle = '#FF6B6B';
    ctx.beginPath();
    const cx = x + w / 2;
    const cy = y + 5;
    ctx.moveTo(cx, cy + 5);
    ctx.bezierCurveTo(cx - 8, cy - 5, cx - 15, cy + 2, cx, cy + 12);
    ctx.bezierCurveTo(cx + 15, cy + 2, cx + 8, cy - 5, cx, cy + 5);
    ctx.fill();
  }

  function drawHearts() {
    hearts.forEach(heart => {
      ctx.fillStyle = `rgba(255, 107, 107, ${heart.life / 30})`;
      ctx.font = `${heart.size}px serif`;
      ctx.fillText('❤', heart.x, heart.y);
    });
  }

  // ===== 倒數計時 =====
  function updateTimerDisplay() {
    const elapsed = (Date.now() - lastTimeUpdate) / 1000;
    timeRemaining = Math.max(0, Math.ceil(timeLimit - elapsed));
    const hudTimer = document.getElementById('hud-timer');
    if (hudTimer) {
      const timerText = hudTimer.querySelector('.timer-text');
      if (timerText) {
        timerText.textContent = `⏱ ${timeRemaining}s`;
      }
      const timerBarFill = hudTimer.querySelector('.timer-bar-fill');
      if (timerBarFill) {
        const percent = (timeRemaining / timeLimit * 100);
        timerBarFill.style.width = percent + '%';
        // 最後 5 秒變色
        if (timeRemaining <= 5) {
          timerText.style.color = '#ff4444';
          timerText.style.animation = 'pulse 0.5s ease-in-out infinite';
          timerBarFill.style.background = '#ff4444';
        } else {
          timerText.style.color = '#ffd700';
          timerText.style.animation = 'none';
          timerBarFill.style.background = 'linear-gradient(90deg, #ffd700, #ff6b6b)';
        }
      }
    }
  }

  function checkTimer() {
    const elapsed = (Date.now() - lastTimeUpdate) / 1000;
    const remaining = Math.max(0, Math.ceil(timeLimit - elapsed));
    if (remaining <= 0) {
      timeRemaining = 0;
      gameOver();
      return;
    }
    timeRemaining = remaining;
  }

  // ===== 碰撞檢測 =====
  function checkCollision(player, obstacle) {
    const shrink = 8; // 碰撞縮小，讓遊戲更寬容
    return (
      player.x + shrink < obstacle.x + obstacle.width - shrink &&
      player.x + player.width - shrink > obstacle.x + shrink &&
      player.y + shrink < obstacle.y + obstacle.height - shrink &&
      player.y + player.height - shrink > obstacle.y + shrink
    );
  }

  // ===== 生成障礙物 =====
  function spawnObstacle() {
    const types = ['flower', 'cup', 'cake'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let width, height, y;
    const groundY = H - GROUND_HEIGHT;

    switch (type) {
      case 'flower':
        width = 30;
        height = 50;
        y = groundY - height;
        break;
      case 'cup':
        width = 25;
        height = 55;
        y = groundY - height;
        break;
      case 'cake':
        width = 40;
        height = 45;
        y = groundY - height;
        break;
    }

    obstacles.push({
      type: type,
      x: W + 50,
      y: y,
      width: width,
      height: height,
      passed: false
    });
  }

  // ===== 跳躍 =====
  function handleJump(e) {
    if (e) e.preventDefault();
    if (!gameRunning) return;
    if (!player.grounded) return;

    player.vy = JUMP_FORCE;
    player.isJumping = true;
    player.grounded = false;
  }

  // ===== 遊戲結束 =====
  function gameOver() {
    gameRunning = false;
    if (animationId) cancelAnimationFrame(animationId);

    // 更新最高分
    if (score > playerBestScore) {
      playerBestScore = score;
    }

    // 通知伺服器
    socket.emit('game:end', { score: score });

    // 顯示結果畫面
    finalScore.textContent = score;
    bestScore.textContent = playerBestScore;
    showScreen(resultScreen);

    // 更新排名
    updateRankDisplay();
  }

  // ===== 更新排名顯示 =====
  function updateRankDisplay() {
    // 從排行榜資料中找到玩家排名
    const lb = window._leaderboard || [];
    const found = lb.find(p => p.name === playerName);
    if (found) {
      finalRank.textContent = `排名第 ${found.rank}`;
    } else {
      finalRank.textContent = '排名計算中...';
    }
  }

  // ===== 重新開始 =====
  function restartGame() {
    resetGame();
    showScreen(gameScreen);
    gameInstructions.style.display = 'block';
    
    // 請求全螢幕
    requestFullscreen();
    
    gameRunning = true;
    lastScoreUpdate = 0;
    gameLoop();

    // 通知伺服器重新開始
    socket.emit('game:restart');

    // 隱藏提示
    setTimeout(() => {
      gameInstructions.style.display = 'none';
    }, 3000);
  }

  // ===== 分享成績 =====
  function shareScore() {
    const text = `我在婚禮跑酷大挑戰中取得了 ${score} 分！最高分 ${playerBestScore} 分！來挑戰我吧！🏃💨`;
    
    if (navigator.share) {
      navigator.share({
        title: '婚禮跑酷大挑戰',
        text: text,
        url: window.location.href
      }).catch(() => {});
    } else {
      // 複製到剪貼簿
      navigator.clipboard.writeText(text).then(() => {
        shareBtn.textContent = '已複製！✓';
        setTimeout(() => {
          shareBtn.textContent = '分享成績 📤';
        }, 2000);
      }).catch(() => {
        shareBtn.textContent = '分享失敗';
        setTimeout(() => {
          shareBtn.textContent = '分享成績 📤';
        }, 2000);
      });
    }
  }

  // ===== 更新排行榜 =====
  function updateLeaderboard(lb) {
    window._leaderboard = lb;
    updateRankDisplay();
  }

  // ===== 更新統計 =====
  function updateStats(stats) {
    // 可以在這裡顯示在場玩家數
    console.log(`在場玩家: ${stats.onlinePlayers}`);
  }

  // ===== 啟動 =====
  window.addEventListener('DOMContentLoaded', init);
})();
