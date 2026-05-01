# 🏃 婚禮跑酷大挑戰

婚禮賓客跑酷遊戲 —— 賓客掃描 QR Code 即可在手機上遊玩，即時排行榜顯示於大螢幕。

## 功能特色

- 🎮 **手機即玩**：無需下載 App，瀏覽器直接遊玩
- 🏆 **即時排行榜**：WebSocket 即時推送排名
- 💒 **婚禮主題**：花束、香檳杯、蛋糕等婚禮元素障礙物
- 📱 **響應式設計**：自動適應各種手機螢幕
- ❤️ **愛心特效**：通過障礙物產生愛心飄落特效
- 📤 **分享成績**：一鍵分享個人成績到社群媒體

## 系統架構

```
手機 (4G/5G) ──→ 雲端伺服器 (Render/Fly.io)
                        │
                        ├── Socket.io 即時通訊
                        ├── 計分引擎 (記憶體)
                        └── 靜態檔案服務
                        │
                        ▼
              筆電 HDMI → 投影機 (排行榜顯示)
```

## 快速開始

### 1. 本地開發

```bash
# 安裝依賴
npm install

# 啟動伺服器
npm start

# 開啟瀏覽器
# 遊戲: http://localhost:3000
# 排行榜: http://localhost:3000/leaderboard.html
```

### 2. 雲端部署 (Render)

```bash
# 1. 註冊 Render: https://render.com
# 2. 初始化 Git
git init
git add .
git commit -m "Initial commit"

# 3. 建立 Render 服務
#    前往 https://dashboard.render.com
#    點擊 "New +" > "Web Service"
#    連接你的 GitHub 倉庫

# 4. 設定環境變數
#    PORT=10000 (Render 會自動分配)

# 5. 部署完成後取得網址
#    例如: https://wedding-runner-game.onrender.com
```

### 3. 雲端部署 (Fly.io)

```bash
# 1. 安裝 Fly CLI
#    https://fly.io/docs/hands-on/install-flyctl/

# 2. 登入
fly auth login

# 3. 建立應用
fly launch --name wedding-runner-game

# 4. 部署
fly deploy
```

## 現場部署步驟

### 會前準備

1. **確認行動訊號**：到宴會廳各角落測試 4G/5G 訊號
2. **準備筆電**：確保有 HDMI 輸出埠（Type-C/USB-A）
3. **準備適配器**：Type-C to HDMI 或 USB-A to HDMI
4. **測試雲端部署**：提前部署並測試遊戲是否正常

### 現場操作

1. **連接投影機**：筆電接 HDMI 到投影機
2. **開啟排行榜**：瀏覽器開啟下方網址並按 F11 全螢幕
3. **產生 QR Code**：
   - 直接下載：[點擊下載 QR Code](https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=https://wedding-runner-game.onrender.com)
   - 或直接列印下方連結
4. **放置 QR Code**：放在桌卡、入口海報、投影輪播

---

### 🔗 重要網址

| 頁面 | 網址 |
|------|------|
| 🎮 **遊戲頁面** | [https://wedding-runner-game.onrender.com](https://wedding-runner-game.onrender.com) |
| 🏆 **排行榜頁面** | [https://wedding-runner-game.onrender.com/leaderboard.html](https://wedding-runner-game.onrender.com/leaderboard.html) |
| **QD CODE** | [https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=https://wedding-runner-game.onrender.com](https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=https://wedding-runner-game.onrender.com)|

---

### 備用方案

若現場 4G/5G 訊號不佳：

1. 開啟筆電 Wi-Fi 熱點
2. 修改 `leaderboard.html` 中的 WebSocket 地址為 `ws://<筆電IP>:3000`
3. 修改 `game.js` 中的 socket.io 連線地址
4. 賓客連接熱點後遊玩

## 技術細節

### 頻寬估算

| 項目 | 每分鐘 | 130 人合計 |
|------|--------|-----------|
| WebSocket 心跳 | ~1 KB | ~130 KB |
| 分數推送 | ~10 KB | ~1.3 MB |
| **合計** | **~11 KB** | **~1.4 MB** |

結論：行動網路完全足夠（4G 上行 20+ Mbps ≈ 1.5 MB/s）

### 延遲分析

| 網路類型 | 延遲 | 可接受度 |
|----------|------|---------|
| 區域網路 | 1-5 ms | ✅ 極佳 |
| 5G | 10-30 ms | ✅ 可接受 |
| 4G | 30-100 ms | ✅ 可接受 |

## 檔案結構

```
wedding-runner-game/
├── server.js              # 後端伺服器
├── package.json           # 專案設定
├── render.json            # Render 部署設定
├── Procfile               # Fly.io 部署設定
├── .gitignore            # Git 忽略檔案
├── README.md             # 說明文件
└── public/
    ├── index.html         # 遊戲主頁面
    ├── game.js            # 遊戲引擎
    ├── game.css           # 遊戲樣式
    ├── leaderboard.html   # 排行榜頁面
    ├── leaderboard.css    # 排行榜樣式
    ├── leaderboard.js     # 排行榜邏輯
    └── assets/           # 靜態資源
```

## 自訂修改

### 修改遊戲速度

編輯 `public/game.js`：

```javascript
const gameSpeed = 5;      // 初始速度
const maxSpeed = 12;      // 最高速度
const speedIncrement = 0.002; // 加速速率
```

### 修改障礙物類型

編輯 `public/game.js` 的 `spawnObstacle()` 函數，新增或移除障礙物類型。

### 修改婚禮主題

1. 更換背景顏色（`game.css` 中的漸層）
2. 新增障礙物繪製函數（`game.js` 中的 `drawXXXObstacle()`）
3. 更換角色造型（`drawPlayer()` 函數）

## 注意事項

- ⚡ 筆電需插電運行
- 📶 建議確認宴會廳有 4G/5G 訊號
- 🖥️ 建議將筆電放置宴會廳中央
- 🔄 Render 免費層級會休眠，需搭配 UptimeRobot 或付費
- 📱 遊戲支援 Chrome、Safari、Firefox 等現代瀏覽器

## 開發時程

| 階段 | 任務 | 預估時間 |
|------|------|----------|
| 1 | 專案架構與後端 | 2-3 小時 |
| 2 | 遊戲前端 | 3-4 小時 |
| 3 | 排行榜頁面 | 1-2 小時 |
| 4 | 雲端部署 | 1-2 小時 |
| 5 | 測試與調試 | 1-2 小時 |
| **合計** | | **8-13 小時** |

## License

MIT

---

由 Hermes Agent 開發 ❤️
