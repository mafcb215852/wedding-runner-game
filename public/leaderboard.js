// 婚禮跑酷大挑戰 - 排行榜
(function() {
  'use strict';

  const socket = io();
  let leaderboardData = [];
  let maxScore = 1; // 避免除以零

  // DOM 元素
  const leaderboardList = document.getElementById('leaderboard-list');
  const onlineCount = document.getElementById('online-count');
  const playingCount = document.getElementById('playing-count');
  const topScore = document.getElementById('top-score');
  const clearBtn = document.getElementById('clear-btn');

  // 初始化
  function init() {
    // 請求排行榜
    socket.emit('leaderboard:request');

    // 監聽事件
    socket.on('leaderboard:update', (data) => {
      console.log('[Leaderboard] 收到更新:', data);
      leaderboardData = data;
      renderLeaderboard();
    });

    socket.on('stats:update', (data) => {
      console.log('[Stats] 收到更新:', data);
      updateStats(data);
    });

    // 每 5 秒重新請求排行榜
    setInterval(() => {
      console.log('[Leaderboard] 定期請求排行榜...');
      socket.emit('leaderboard:request');
    }, 5000);

    // 清空排行榜按鈕
    clearBtn.addEventListener('click', () => {
      const password = prompt('請輸入密碼以清空排行榜：');
      if (password) {
        socket.emit('leaderboard:clear', { password });
      }
    });

    // 監聽清空結果
    socket.on('leaderboard:cleared', () => {
      console.log('[Leaderboard] 排行榜已清空');
      leaderboardData = [];
      renderLeaderboard();
      updateStats({ onlinePlayers: 0 });
      alert('✅ 排行榜已清空！');
    });

    socket.on('leaderboard:clear:error', (message) => {
      console.error('[Leaderboard] 清空失敗:', message);
      alert('❌ ' + message);
    });
  }

  // 更新統計
  function updateStats(stats) {
    onlineCount.textContent = stats.onlinePlayers || 0;
    
    const playing = leaderboardData.filter(p => p.online).length;
    playingCount.textContent = playing;
    
    const top = leaderboardData.length > 0 ? leaderboardData[0].score : 0;
    topScore.textContent = top;
  }
  // 渲染排行榜
  function renderLeaderboard() {
    if (leaderboardData.length === 0) {
      leaderboardList.innerHTML = `
        <div class="empty-state">
          <p class="empty-icon">🎮</p>
          <p class="empty-text">等待玩家加入...</p>
        </div>
      `;
      return;
    }

    // 計算最高分用於進度條
    maxScore = leaderboardData[0].score || 1;

    let html = '';
    leaderboardData.forEach((player, index) => {
      const rankClass = index < 3 ? `rank-${index + 1}` : 'rank-other';
      const topClass = index < 3 ? `top-${index + 1}` : '';
      const onlineClass = player.online ? 'online' : '';
      const statusText = player.online ? '🟢 遊戲中' : '⚪ 已完成';
      const statusClass = player.online ? 'online' : '';
      const scorePercent = (player.score / maxScore * 100).toFixed(1);

      html += `
        <div class="rank-item ${topClass} ${onlineClass}">
          <div class="rank ${rankClass}">${getRankEmoji(index)}</div>
          <div class="player-info">
            <div class="player-name">${escapeHtml(player.name)}</div>
            <div class="player-status ${statusClass}">${statusText}</div>
          </div>
          <div class="score">
            ${player.score}
            <div class="score-bar">
              <div class="score-bar-fill" style="width: ${scorePercent}%"></div>
            </div>
          </div>
        </div>
      `;
    });

    leaderboardList.innerHTML = html;
  }

  // 取得排名圖示
  function getRankEmoji(index) {
    switch(index) {
      case 0: return '🥇';
      case 1: return '🥈';
      case 2: return '🥉';
      default: return index + 1;
    }
  }

  // HTML 跳脫
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 啟動
  window.addEventListener('DOMContentLoaded', init);
})();
