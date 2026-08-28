# Manager Socket API 文件

本文件說明 **Manager（主持人）** 端所有 Socket.IO event 的連線方式、請求／回應 payload、前置條件、遊戲流程與錯誤處理。

> 通訊協定：Socket.IO（僅 `websocket` transport）  
> 預設 Port：`SOCKET_PORT`（未設定時為 `3000`）  
> CORS：`CORS_ORIGIN`（未設定時為 `*`）

---

## 目錄

1. [連線與身分](#1-連線與身分)
2. [通用約定](#2-通用約定)
3. [狀態機總覽](#3-狀態機總覽)
4. [建議流程](#4-建議流程)
5. [Client → Server（emit）](#5-client--serveremit)
6. [Server → Client（push／回應）](#6-server--clientpush回應)
7. [錯誤碼一覽](#7-錯誤碼一覽)
8. [斷線行為](#8-斷線行為)

---

## 1. 連線與身分

### 1.1 建立連線

Manager 必須在 handshake query 帶上 `system=Manager`，否則會被當成一般 User。

```text
io(url, {
  transports: ['websocket'],
  query: { system: 'Manager' }
})
```

範例 URL：

```text
ws://localhost:3000?system=Manager
```

### 1.2 事件註冊時機

| 階段 | 可用 event |
|------|------------|
| 連線成功後（尚未 Login） | 僅 `Manager:Login` |
| `Manager:Login` 成功後 | `Room:CreateRoom`、`Room:StartGame`、`Room:NextQuestion`、`Room:FinishGame` |

> Login 成功後才會註冊 Room 相關 listener。若尚未 Login 就 emit Room event，伺服器不會處理（無 listener）。

### 1.3 同一 managerId 重複登入

若另一個連線以相同 `managerId` 登入成功，**舊連線會被強制 disconnect**。

---

## 2. 通用約定

### 2.1 成功回應

- 成功時 server 對**該 socket** emit 同名 event（或廣播 event），payload 為業務資料物件。
- 沒有統一的 `{ success: true }` 包一層；直接就是資料欄位。

### 2.2 錯誤回應

任何 handler／middleware 拋錯時，會**同時** emit：

1. 全域 `error`
2. 特定 `{原 event 名稱}:error`

兩者 payload 相同：

```ts
{
  event: string;   // 發生錯誤的 event 全名，例如 "Room:StartGame"
  message: string; // 錯誤訊息
  code?: string;   // 見「錯誤碼一覽」
}
```

### 2.3 Event 鎖（LOCKED）

同一個 socket 對**同一個 event** 在前一次尚未完成前再次觸發，會收到 `LOCKED`。

### 2.4 房間識別

| 欄位 | 說明 |
|------|------|
| `roomName` | 人類可讀的房間名稱；Client emit 時使用此欄位 |
| `roomId` | 伺服器產生的 UUID；用於內部 socket room、回應與廣播 |

### 2.5 列舉值

**RoomState**

| 值 | 說明 |
|----|------|
| `Prepare` | 尚未開始／尚無進行中遊戲 |
| `InGame` | 遊戲進行中 |
| `Finished` | 遊戲已結束 |

**GameState**

| 值 | 說明 |
|----|------|
| `Prepare` | 準備中 |
| `StartGame` | 已開始，等待第一題（約 3 秒） |
| `Voting` | 作答中（約 12 秒） |
| `Settle` | 結算中（約 3 秒） |
| `ShowAnswer` | 公布答案；等待 Manager 按下一題 |
| `ShowRanking` | 顯示排行榜；等待 Manager 結束遊戲 |
| `Finished` | 遊戲結束 |

### 2.6 計時常數（伺服器端）

| 階段 | 秒數 | 說明 |
|------|------|------|
| Prepare（開局到第一題） | `3` | `StartGame` 後自動出第一題 |
| Voting（作答） | `12` | 時間到自動 `Settle` |
| Settle（結算） | `3` | 時間到自動 `AnswerReveal` |

---

## 3. 狀態機總覽

```text
Prepare
  └─ StartGame ──► StartGame（等待 PREPARE_TIME）
                      └─► Voting ──(投票結束)──► Settle ──► ShowAnswer
                                                              │
                                              ┌───────────────┘
                                              │ NextQuestion
                                              ├─ 尚有下一題 → NextQuestion 廣播 → Voting
                                              └─ 已無下一題 → ShowRanking
                                                                  └─ FinishGame → Finished
```

Manager 在流程中的主動操作點：

| 時機 | 操作 |
|------|------|
| 房間建立後、玩家加入中 | 等待 `Room:UserJoined` |
| 準備開局 | `Room:StartGame` |
| `ShowAnswer` 階段 | `Room:NextQuestion`（可能進入下一題或排行榜） |
| `ShowRanking` 階段 | `Room:FinishGame` |

---

## 4. 建議流程

```text
連線（system=Manager）
  → Manager:Login
  → Room:CreateRoom
  →（監聽 Room:UserJoined / Room:UserLeft / Room:UserDisconnected / Room:UserReconnected）
  → Room:StartGame
  → 監聽 QuizGame:GameStarted
  → 監聽 QuizGame:Question / Settle / AnswerReveal
  →（每題 AnswerReveal 後）Room:NextQuestion
  → 監聽 QuizGame:ShowRanking
  → Room:FinishGame
  → 監聽 QuizGame:Finished
```

---

## 5. Client → Server（emit）

### 5.1 `Manager:Login`

登入並綁定 `managerId`。成功後才會開放 Room 相關 event。

| 項目 | 內容 |
|------|------|
| 方向 | Client → Server |
| 前置條件 | 已以 Manager 身分連線 |
| Request | `{ managerId: string }` |

**成功回應 event：** `Manager:Login`

```ts
{ managerId: string }
```

**可能錯誤**

| code | 情況 |
|------|------|
| `VALIDATION` | `managerId` 缺失或非字串 |
| `CONFLICT` | 此連線已用**不同** `managerId` 登入過 |
| `LOCKED` | 重複觸發尚未完成 |

> 以相同 `managerId` 再次 Login（例如重連後）是允許的，會回成功。

---

### 5.2 `Room:CreateRoom`

建立房間。房間名稱全域唯一。

| 項目 | 內容 |
|------|------|
| 方向 | Client → Server |
| 前置條件 | 已 `Manager:Login` |
| Request | `{ roomName: string }` |

**成功回應 event：** `Room:CreateRoom`

```ts
{ roomId: string }
```

成功後 Manager socket 會 `join(roomId)`。

**可能錯誤**

| code | 情況 |
|------|------|
| `UNAUTHORIZED` | 尚未 Login |
| `VALIDATION` | `roomName` 缺失或非字串 |
| `CONFLICT` | `roomName` 已被使用 |
| `LOCKED` | 重複觸發尚未完成 |

---

### 5.3 `Room:StartGame`

開始遊戲。會廣播 `QuizGame:GameStarted`，約 3 秒後自動出第一題。

| 項目 | 內容 |
|------|------|
| 方向 | Client → Server |
| 前置條件 | 已 Login；擁有該 `roomName` 房間；遊戲狀態為 `Prepare` 或 `Finished` |
| Request | `{ roomName: string }` |

**成功回應 event：** `Room:StartGame`（僅回給操作的 Manager）

```ts
{
  roomId: string;
  roomState: RoomState;   // 通常為 InGame
  gameState: GameState;   // StartGame
}
```

**隨後廣播（Manager + 房間內所有 User）：** `QuizGame:GameStarted`（含 `phaseEndsAt`）  
約 3 秒後再廣播：`QuizGame:Question`

**可能錯誤**

| code | 情況 |
|------|------|
| `UNAUTHORIZED` | 尚未 Login，或不是房間擁有者 |
| `VALIDATION` | `roomName` 無效 |
| `NOT_FOUND` | 房間不存在 |
| `INVALID_STATE` | 遊戲實例未初始化，或目前狀態不可開局 |
| `LOCKED` | 重複觸發尚未完成 |

---

### 5.4 `Room:NextQuestion`

在 `ShowAnswer` 階段進入下一題；若已無下一題則改進入排行榜階段。

| 項目 | 內容 |
|------|------|
| 方向 | Client → Server |
| 前置條件 | 已 Login；擁有該房間；`GameState === ShowAnswer` |
| Request | `{ roomName: string }` |

**成功回應 event：** `Room:NextQuestion`（僅回給操作的 Manager）

```ts
{
  roomId: string;
  roomState: RoomState;
  gameState: GameState | null;
}
```

**分支 A：尚有下一題**

1. 廣播 `QuizGame:NextQuestion`
2. 立即廣播 `QuizGame:Question`（進入 Voting）

**分支 B：已無下一題**

1. 進入 `ShowRanking`
2. **僅 Manager** 收到 `QuizGame:ShowRanking`
3. **各 User** 各自收到 `QuizGame:PersonalResult`（Manager 不會收到個人結果）

**可能錯誤**

| code | 情況 |
|------|------|
| `UNAUTHORIZED` | 尚未 Login，或不是房間擁有者 |
| `VALIDATION` | `roomName` 無效 |
| `NOT_FOUND` | 房間不存在 |
| `INVALID_STATE` | 非 `ShowAnswer`，或遊戲未初始化 |
| `LOCKED` | 重複觸發尚未完成 |

---

### 5.5 `Room:FinishGame`

在排行榜階段結束整場遊戲。

| 項目 | 內容 |
|------|------|
| 方向 | Client → Server |
| 前置條件 | 已 Login；擁有該房間；`GameState === ShowRanking` |
| Request | `{ roomName: string }` |

**成功回應 event：** `Room:FinishGame`（僅回給操作的 Manager）

```ts
{
  roomId: string;
  roomState: RoomState;   // Finished
  gameState: GameState | null; // Finished
}
```

**隨後廣播（Manager + 所有 User）：** `QuizGame:Finished`

**可能錯誤**

| code | 情況 |
|------|------|
| `UNAUTHORIZED` | 尚未 Login，或不是房間擁有者 |
| `VALIDATION` | `roomName` 無效 |
| `NOT_FOUND` | 房間不存在 |
| `INVALID_STATE` | 非 `ShowRanking`，或遊戲未初始化 |
| `LOCKED` | 重複觸發尚未完成 |

---

## 6. Server → Client（push／回應）

以下為 Manager 端會收到的事件。共用遊戲廣播會完整列出 payload。

### 6.1 `Manager:Login`

見 [5.1](#51-managerlogin)。

---

### 6.2 `Room:CreateRoom`

見 [5.2](#52-roomcreateroom)。

---

### 6.3 `Room:StartGame`

見 [5.3](#53-roomstartgame)。

---

### 6.4 `Room:NextQuestion`

見 [5.4](#54-roomnextquestion)。

---

### 6.5 `Room:FinishGame`

見 [5.5](#55-roomfinishgame)。

---

### 6.6 `Room:UserJoined`

玩家成功加入房間時推給 **該房間的 Manager**。

```ts
{
  userId: string;
  userList: string[]; // 目前房間內所有 userId（含離線寬限中）
  userCount: number;
  disconnectedUserIds: string[]; // 目前 connected === false 的人；Joined 時通常為 []
}
```

| 項目 | 內容 |
|------|------|
| 觸發時機 | User **第一次**成功 `UserGame:JoinRoom`（重連不會再推） |
| 接收者 | 僅 Manager |

---

### 6.7 `Room:UserLeft`

玩家離開房間時推給 **該房間的 Manager**。

```ts
{
  userId: string;
  userList: string[]; // 更新後名單（已不含此人）
  userCount: number;
  disconnectedUserIds: string[];
}
```

| 項目 | 內容 |
|------|------|
| 觸發時機 | User 主動 `UserGame:LeaveRoom`，或斷線後 **60 秒**寬限到期 |
| 接收者 | 僅 Manager |

> 短暫斷線**不會**推此事件。若 user 本來就不在房間，Leave 不會再推送。

---

### 6.8 `Room:UserDisconnected`

玩家斷線、進入 60 秒寬限時推給 **該房間的 Manager**。

```ts
{
  userId: string;
  userList: string[];           // 仍在房的全部 userId（含離線中）
  userCount: number;
  disconnectedUserIds: string[];
}
```

| 項目 | 內容 |
|------|------|
| 觸發時機 | 在房 User 斷線、進入寬限 |
| 注意 | **不要**同時當成離房；名單仍包含此人 |

---

### 6.9 `Room:UserReconnected`

寬限內 Login 綁回時推給 **該房間的 Manager**。

Payload 與 `Room:UserDisconnected` 相同。

| 項目 | 內容 |
|------|------|
| 觸發時機 | 離線中的 userId 再次 Login 成功並綁回 |
| 注意 | **不會**再推 `Room:UserJoined`。同一 `userId` 在對方仍在線時嘗試 Login 會被拒絕，不會發生互踢、也不會推此事件 |

---

### 6.10 `QuizGame:GameStarted`

遊戲開始廣播（Manager + 所有房間內 User）。

```ts
{
  roomId: string;
  quizCount: number; // 本場總題數
  phaseEndsAt: number; // Unix ms，第一題開始時間
}
```

| 項目 | 內容 |
|------|------|
| 觸發時機 | `Room:StartGame` 成功後立即 |
| 之後 | 約 3 秒自動出第一題 `QuizGame:Question`（以 `phaseEndsAt` 為準） |

---

### 6.11 `QuizGame:Question`

出題（Manager + 所有房間內 User）。

```ts
{
  roomId: string;
  question: string;
  options: string[];
  questionIndex: number;  // 1-based
  totalQuestions: number;
  votingTime: number;     // 秒，目前固定 12
  phaseEndsAt: number;    // Unix ms，投票截止
}
```

| 項目 | 內容 |
|------|------|
| 遊戲狀態 | 進入 `Voting` |
| 注意 | **不會**帶正確答案 |
| 之後 | 到 `phaseEndsAt` 自動 `QuizGame:Settle` |

---

### 6.12 `QuizGame:Settle`

投票結束結算（Manager + 所有房間內 User）。

```ts
{
  roomId: string;
  questionIndex: number; // 1-based
  correctAnswer: number; // 正確選項 index（0-based）
  answers: Array<{
    userId: string;
    optionIndex: number;
    isCorrect: boolean;
  }>;
  phaseEndsAt: number; // Unix ms，進入 AnswerReveal 的時間
}
```

| 項目 | 內容 |
|------|------|
| 遊戲狀態 | 進入 `Settle` |
| `answers` | 僅包含有提交答案的玩家；未作答者不在陣列中 |
| 之後 | 約 3 秒自動 `QuizGame:AnswerReveal` |

---

### 6.13 `QuizGame:AnswerReveal`

公布答案（Manager + 所有房間內 User）。

```ts
{
  roomId: string;
  questionIndex: number; // 1-based
  correctAnswer: number; // 0-based option index
  totalAnswers: number;  // 本題有提交答案的人數
}
```

| 項目 | 內容 |
|------|------|
| 遊戲狀態 | 進入 `ShowAnswer` |
| Manager 下一步 | 呼叫 `Room:NextQuestion` |

---

### 6.14 `QuizGame:NextQuestion`

即將進入下一題的通知（Manager + 所有房間內 User）。

```ts
{
  roomId: string;
  nextQuestionIndex: number; // 1-based，下一題題號
}
```

| 項目 | 內容 |
|------|------|
| 觸發時機 | Manager `Room:NextQuestion` 且尚有下一題 |
| 之後 | 幾乎立即再收到 `QuizGame:Question` |

---

### 6.15 `QuizGame:ShowRanking`

排行榜（**僅 Manager**）。

```ts
{
  roomId: string;
  rankings: Array<{
    userId: string;
    rank: number;
    correctCount: number;
    totalTime: number; // 總答題秒數，小數點後 2 位
  }>;
}
```

| 項目 | 內容 |
|------|------|
| 觸發時機 | `Room:NextQuestion` 且已無下一題 |
| 遊戲狀態 | 進入 `ShowRanking` |
| 排名規則 | 先比 `correctCount` 高者勝；相同則比 `totalTime`（毫秒加總）短者勝；完全相同則同名次 |
| 過濾 | 排除 `correctCount === 0`；且只回傳 rank ≤ 10 |
| Manager 下一步 | 呼叫 `Room:FinishGame` |

> 同時各 User 會各自收到 `QuizGame:PersonalResult`（含零分玩家），Manager 收不到該事件。

---

### 6.16 `QuizGame:Finished`

遊戲結束廣播（Manager + 所有房間內 User）。

```ts
{
  roomId: string;
  totalQuestions: number;
}
```

| 項目 | 內容 |
|------|------|
| 觸發時機 | `Room:FinishGame` 成功後 |
| 遊戲狀態 | `Finished`；`roomState` 亦為 `Finished` |

---

### 6.17 `error` / `{event}:error`

見 [2.2 錯誤回應](#22-錯誤回應)。

Manager 端常見的 `{event}:error` 範例：

- `Manager:Login:error`
- `Room:CreateRoom:error`
- `Room:StartGame:error`
- `Room:NextQuestion:error`
- `Room:FinishGame:error`

---

## 7. 錯誤碼一覽

| code | 意義 |
|------|------|
| `VALIDATION` | 參數格式／必填欄位錯誤 |
| `UNAUTHORIZED` | 未登入，或無權操作該房間 |
| `NOT_FOUND` | 房間／資源不存在 |
| `CONFLICT` | 狀態衝突（例如房間名重複、已用不同 id 登入） |
| `LOCKED` | 同一 event 處理中被重複觸發 |
| `INVALID_STATE` | 目前遊戲／房間狀態不允許此操作 |

---

## 8. 斷線行為

### 8.1 Manager 斷線

Manager 斷線時，伺服器會：

1. 從 manager 對照表移除該 `managerId`
2. **刪除該 Manager 擁有的所有房間**（取消玩家斷線寬限 timer）
3. 對房間內**在線** User emit `Room:Closed`：

```ts
{
  roomName: string;
  roomId: string;
  reason: 'Manager disconnected';
}
```

4. 清理遊戲計時器與玩家狀態，並讓相關 socket 離開該 `roomId`

> Manager 斷線等於房間強制關閉。這次不做主持人保房／重連。

### 8.2 玩家斷線（Manager 視角）

- 玩家斷線：`Room:UserDisconnected`，名單**仍包含**該人，並以 `disconnectedUserIds` 標示離線
- 60 秒內重連：`Room:UserReconnected`，從 `disconnectedUserIds` 移除
- 60 秒到期或主動 Leave：`Room:UserLeft`，從 `userList` 移除
- 同一 `userId` 在對方仍在線時嘗試 Login：server 拒絕該次 Login，Manager **不會**收到任何事件

---

## Event 速查表

### Client → Server

| Event | Payload |
|-------|---------|
| `Manager:Login` | `{ managerId: string }` |
| `Room:CreateRoom` | `{ roomName: string }` |
| `Room:StartGame` | `{ roomName: string }` |
| `Room:NextQuestion` | `{ roomName: string }` |
| `Room:FinishGame` | `{ roomName: string }` |

### Server → Client

| Event | 對象 | 說明 |
|-------|------|------|
| `Manager:Login` | 自己 | 登入成功 |
| `Room:CreateRoom` | 自己 | 建房成功 |
| `Room:StartGame` | 自己 | 開局成功回應 |
| `Room:NextQuestion` | 自己 | 下一題成功回應 |
| `Room:FinishGame` | 自己 | 結束成功回應 |
| `Room:UserJoined` | Manager | 玩家加入 |
| `Room:UserLeft` | Manager | 玩家真正離房 |
| `Room:UserDisconnected` | Manager | 玩家斷線（寬限中，仍在名單） |
| `Room:UserReconnected` | Manager | 玩家寬限內重連 |
| `QuizGame:GameStarted` | Manager + Users | 遊戲開始（含 `phaseEndsAt`） |
| `QuizGame:Question` | Manager + Users | 出題（含 `phaseEndsAt`） |
| `QuizGame:Settle` | Manager + Users | 結算（含 `phaseEndsAt`） |
| `QuizGame:AnswerReveal` | Manager + Users | 公布答案 |
| `QuizGame:NextQuestion` | Manager + Users | 下一題通知 |
| `QuizGame:ShowRanking` | **僅 Manager** | 排行榜 Top10 |
| `QuizGame:Finished` | Manager + Users | 遊戲結束 |
| `error` | 自己 | 全域錯誤 |
| `{event}:error` | 自己 | 特定 event 錯誤 |
