# flow-test.html 擴充 Event 指南

本文件說明：當 backend 新增或修改 Socket event 時，要如何描述需求，以便更新 `test/flow-test.html`。

## 快速指令

可直接對 AI 說：

> 請依 `test/FLOW-TEST-EVENT-GUIDE.md` 的規則，把以下 event 加到 `flow-test.html`：…

或懶人版：

> 請把 `Room:SkipQuestion` 加到 flow-test.html（Manager 手動按，payload `{ roomName }`，ShowAnswer 階段可用）

---

## 測試頁現況

- 檔案位置：`test/flow-test.html`
- 使用方式：瀏覽器直接開啟（`file://`），連線到 backend Socket server
- 版面：左側 **Manager**、右側可動態新增 **User**（預設 2 個，可擴充到 5 個以上）
- 連線設定：頂部可改 **Host**、**Port**、**Room Name**、**Manager ID**
- 測試模式：
  - **手動**：各面板獨立按鈕觸發 event
  - **自動流程**：一鍵跑 Login → Create → Join → Start → 自動答題；`AnswerReveal` 後暫停，需手動按 **Next Question**
  - **User 自動答題**：各 User 自行連線 / Login / Join，等 Manager 手動開局後自動作答
  - **延遲答題（自動流程 & User 自動答題）**：
    - 收到 `QuizGame:Question` 後，每個 User **各自**隨機延遲 **1~10 秒（含小數）** 再送 `UserGame:SubmitAnswer`
    - 若延遲期間進入 `AnswerReveal` / `NextQuestion` / 遊戲結束，或手動停止流程，會**取消**尚未送出的答案
    - 手動按 Submit / Submit Random **不套用**延遲

### 連線規則

| 角色 | Socket query | 說明 |
|------|--------------|------|
| Manager | `?system=Manager` | 主持人 |
| User | 預設（不帶 system） | 玩家 |

---

## 描述新 Event 時請提供

### 1. 基本資訊（必填）

```text
角色：Manager / User / 兩者
方向：Client emit / Server push / 兩者
Event 名稱：例如 Room:PauseGame
Payload：{ roomName: string }
成功回應：Room:PauseGame
錯誤回應：Room:PauseGame:error（及全域 error）
```

### 2. 流程位置（建議填）

說明 event 在整體流程的哪一步：

```text
Login → CreateRoom → JoinRoom → StartGame → Question → SubmitAnswer
  → Settle → AnswerReveal → NextQuestion → Finished
```

範例：「在 AnswerReveal 之後、NextQuestion 之前加入 PauseGame」

### 3. 測試頁 UI 需求（選填）

```text
- Manager 面板加「Pause Game」按鈕
- 每個 User 面板加「Ready」按鈕
- 只加 log 監聽，不加按鈕
- 要加進自動流程 / 不要加進自動流程
- 自動流程在某某 event 後暫停，等待手動操作
```

### 4. 前置條件（若有）

```text
- 必須已 Login
- 必須在房間內
- 只有 Manager 可呼叫
- 遊戲狀態必須是 Voting / ShowAnswer 等
```

---

## 描述範本

### 範本 A：Manager 手動 event

```text
請幫我擴充 flow-test.html：

角色：Manager
Event：Room:EndGame
Payload：{ roomName: string }
成功回應：Room:EndGame
Server push：QuizGame:ForceEnded
流程位置：StartGame 之後可用
UI：Manager 加「End Game」按鈕
自動流程：不加
```

### 範本 B：User event + 自動流程

```text
請幫我擴充 flow-test.html：

角色：User
Event：UserGame:Ready
Payload：{}
成功回應：UserGame:Ready
流程位置：JoinRoom 之後、StartGame 之前
UI：每個 User 加 Ready 按鈕
自動流程：Join 後幫每個 User 自動送 Ready
```

### 範本 C：只加監聽

```text
請更新 flow-test.html 監聽：

Event：QuizGame:ScoreUpdated
方向：Server push
UI：Manager 和 User 的 log 都要顯示，不加按鈕
```

---

## 目前 event 清單（參考）

### Client → Server（emit）

| 角色 | Event | Payload |
|------|-------|---------|
| Manager | `Manager:Login` | `{ managerId: string }` |
| Manager | `Room:CreateRoom` | `{ roomName: string }` |
| Manager | `Room:StartGame` | `{ roomName: string }` |
| Manager | `Room:NextQuestion` | `{ roomName: string }` |
| User | `User:Login` | `{ userId: string }` |
| User | `UserGame:JoinRoom` | `{ roomName: string }` |
| User | `UserGame:LeaveRoom` | — |
| User | `UserGame:SubmitAnswer` | `{ optionIndex: number }` |

### Server → Client（push / 回應）

| Event | 說明 |
|-------|------|
| `Manager:Login` | Manager 登入成功 |
| `Room:CreateRoom` | 建立房間成功 |
| `Room:StartGame` | 開始遊戲成功 |
| `Room:NextQuestion` | 下一題成功 |
| `Room:UserJoined` | 玩家加入（Manager 收到） |
| `Room:UserLeft` | 玩家離開（Manager 收到） |
| `User:Login` | User 登入成功 |
| `UserGame:JoinRoom` | 加入房間成功 |
| `UserGame:LeaveRoom` | 離開房間成功 |
| `UserGame:SubmitAnswer` | 提交答案成功 |
| `QuizGame:GameStarted` | 遊戲開始廣播 |
| `QuizGame:Question` | 出題 |
| `QuizGame:Settle` | 結算 |
| `QuizGame:AnswerReveal` | 公布答案 |
| `QuizGame:NextQuestion` | 下一題廣播 |
| `QuizGame:Finished` | 遊戲結束 |
| `error` | 全域錯誤 |
| `{event}:error` | 特定 event 錯誤 |

> 新增 event 後，請同步更新本清單。

---

## 擴充時的實作慣例

更新 `flow-test.html` 時，通常會動到以下位置：

1. **`KNOWN_EVENTS`**：加入要監聽的 event 名稱
2. **Manager / User 按鈕區**：加入手動觸發按鈕與 payload 輸入
3. **`handleAutoEvent`**：若需納入自動流程，在此處理收到 event 後的行為
4. **`runAutoFlow`**：若需在自動流程中主動 emit，在此加入步驟
5. **暫停點**：若需等待手動操作（如 Next Question），用 `highlightNextQuestion` 或類似機制標示

### 自動流程慣例

- 預設自動跑：Login → Create → Join → Start → 收到 `QuizGame:Question` 後自動答題
- 自動答題會為每個 User 排程**獨立**隨機延遲（1~10 秒，含小數）再送出答案
- 收到 `QuizGame:AnswerReveal` / `QuizGame:NextQuestion` 時取消尚未送出的延遲答題
- 收到 `QuizGame:AnswerReveal` 後**暫停**，等待手動按 **Next Question**
- 收到 `QuizGame:Finished` 或按停止後，取消未送出答案並停止自動流程

### User 自動答題慣例

- 各 User 各自完成連線 / Login / Join，等待 Manager 手動 `StartGame`
- 收到 `QuizGame:Question` 後同樣以獨立隨機延遲（1~10 秒）送出隨機答案
- `AnswerReveal` / `NextQuestion` / 結束 / 停止時取消尚未送出的答案

新增 event 若會改變此節奏，請在需求中明確說明。

---

## 常用補充指令

| 說法 | 意思 |
|------|------|
| 「照現在測試頁規則，把這次新增的 event 都補上」 | 依現有慣例完整更新 |
| 「只補手動按鈕，不要動自動流程」 | 僅加 UI 與 log |
| 「自動流程也要跟著改」 | 同步更新 `runAutoFlow` / `handleAutoEvent` |
| 「只加 log 監聽」 | 更新 `KNOWN_EVENTS`，不加按鈕 |

---

## 相關程式碼位置（backend）

| 檔案 | 用途 |
|------|------|
| `src/controller/ManagerController.ts` | Manager 登入 |
| `src/controller/RoomController.ts` | 房間與遊戲控制 |
| `src/controller/UserController.ts` | User 登入 |
| `src/controller/UserGameController.ts` | User 遊戲操作 |
| `src/game/QuizGame.ts` | 遊戲廣播 event |
| `src/socket/room/QuizGameRoom.ts` | 房間通知 event |
