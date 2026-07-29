# User Socket API 文件

本文件說明 **User（玩家）** 端所有 Socket.IO event 的連線方式、請求／回應 payload、前置條件、遊戲流程與錯誤處理。

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

User **不要**帶 `system=Manager`。未指定或非 Manager 時一律以 User 處理。

```text
io(url, {
  transports: ['websocket']
  // 可不帶 query.system，或 system 不是 "Manager"
})
```

範例 URL：

```text
ws://localhost:3000
```

### 1.2 事件註冊時機

| 階段 | 可用 event |
|------|------------|
| 連線成功後（尚未 Login） | 僅 `User:Login` |
| `User:Login` 成功後 | `UserGame:JoinRoom`、`UserGame:LeaveRoom`、`UserGame:SubmitAnswer` |

> Login 成功後才會註冊 UserGame 相關 listener。若尚未 Login 就 emit UserGame event，伺服器不會處理（無 listener）。

### 1.3 同一 userId 重複登入

若另一個連線以相同 `userId` 登入成功，**舊連線會被強制 disconnect**。

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
  event: string;   // 例如 "UserGame:SubmitAnswer"
  message: string;
  code?: string;   // 見「錯誤碼一覽」
}
```

### 2.3 Event 鎖（LOCKED）

同一個 socket 對**同一個 event** 在前一次尚未完成前再次觸發，會收到 `LOCKED`。

### 2.4 房間識別

| 欄位 | 說明 |
|------|------|
| `roomName` | 加入房間時使用；需與 Manager 建立的名稱一致 |
| `roomId` | 伺服器 UUID；Join 成功後回傳，後續廣播也會帶 |

一個 User 同時只能待在**一個**房間。要換房必須先 `LeaveRoom`。

### 2.5 列舉值

**RoomState**

| 值 | 說明 |
|----|------|
| `Prepare` | 尚未開始，可加入 |
| `InGame` | 遊戲進行中（不可再加入） |
| `Finished` | 遊戲已結束（不可再加入） |

**GameState**

| 值 | 說明 |
|----|------|
| `Prepare` | 準備中 |
| `StartGame` | 已開始，等待第一題（約 3 秒） |
| `Voting` | 作答中（約 12 秒）— **唯一可 SubmitAnswer 的階段** |
| `Settle` | 結算中（約 3 秒） |
| `ShowAnswer` | 公布答案 |
| `ShowRanking` | 排行榜階段（User 收個人結果） |
| `Finished` | 遊戲結束 |

### 2.6 計時常數（伺服器端）

| 階段 | 秒數 | 說明 |
|------|------|------|
| Prepare（開局到第一題） | `3` | 收到 `GameStarted` 後約 3 秒出題 |
| Voting（作答） | `12` | 時間到自動結算；答題耗時會被記錄 |
| Settle（結算） | `3` | 時間到自動公布答案 |

### 2.7 計分規則（供前端顯示參考）

- 每題答對：`correctCount + 1`
- 答題耗時：從出題當下到提交的毫秒數，上限為 `votingTime * 1000`
- 未作答：該題計入完整投票時間
- 排名：先比答對數（高者勝），相同再比總耗時（短者勝）；完全相同則同名次

---

## 3. 狀態機總覽

```text
（房間 Prepare）User 可 JoinRoom
        │
        ▼
Manager StartGame → GameStarted →（3 秒）→ Question(Voting)
                                              │
                                    User SubmitAnswer（可選）
                                              │
                                         （12 秒到）
                                              ▼
                                           Settle
                                              │
                                         （3 秒到）
                                              ▼
                                        AnswerReveal
                                              │
                              Manager NextQuestion
                     ┌──────────────┴──────────────┐
                     ▼                             ▼
              NextQuestion + Question         ShowRanking
              （下一輪 Voting）          PersonalResult（每人一份）
                                               │
                                      Manager FinishGame
                                               ▼
                                            Finished
```

User 在流程中的主動操作點：

| 時機 | 操作 |
|------|------|
| 房間仍在 `Prepare` | `UserGame:JoinRoom` |
| `Voting` 階段 | `UserGame:SubmitAnswer` |
| 任意已入房狀態 | `UserGame:LeaveRoom` |

其餘階段以**監聽**伺服器推播為主。

---

## 4. 建議流程

```text
連線（一般 User）
  → User:Login
  → UserGame:JoinRoom
  → 監聽 QuizGame:GameStarted
  → 監聽 QuizGame:Question
  →（Voting 期間）UserGame:SubmitAnswer
  → 監聽 QuizGame:Settle / AnswerReveal / NextQuestion
  →（重複作答直到排行榜）
  → 監聽 QuizGame:PersonalResult
  → 監聽 QuizGame:Finished
  →（可選）UserGame:LeaveRoom
```

同時建議監聽：

- `Room:Closed`（Manager 斷線導致房間關閉）
- `error` / `{event}:error`

---

## 5. Client → Server（emit）

### 5.1 `User:Login`

登入並綁定 `userId`。成功後才會開放 UserGame 相關 event。

| 項目 | 內容 |
|------|------|
| 方向 | Client → Server |
| 前置條件 | 已以 User 身分連線 |
| Request | `{ userId: string }` |

**成功回應 event：** `User:Login`

```ts
{ userId: string }
```

**可能錯誤**

| code | 情況 |
|------|------|
| `VALIDATION` | `userId` 缺失或非字串 |
| `CONFLICT` | 此連線已用**不同** `userId` 登入過 |
| `LOCKED` | 重複觸發尚未完成 |

> 以相同 `userId` 再次 Login（例如重連後）是允許的，會回成功。

---

### 5.2 `UserGame:JoinRoom`

加入指定名稱的房間。

| 項目 | 內容 |
|------|------|
| 方向 | Client → Server |
| 前置條件 | 已 `User:Login`；目前不在任何房間；房間存在且 `roomState === Prepare` |
| Request | `{ roomName: string }` |

**成功回應 event：** `UserGame:JoinRoom`

```ts
{ roomId: string }
```

成功後：

1. User socket `join(roomId)`
2. Manager 會收到 `Room:UserJoined`

**可能錯誤**

| code | 情況 |
|------|------|
| `UNAUTHORIZED` | 尚未 Login |
| `CONFLICT` | 已在其他房間，或已在此房間 |
| `VALIDATION` | `roomName` 缺失／非字串，或 `userId` 無效 |
| `NOT_FOUND` | 房間不存在 |
| `INVALID_STATE` | 房間已在進行中或已結束（不可加入） |
| `LOCKED` | 重複觸發尚未完成 |

---

### 5.3 `UserGame:LeaveRoom`

主動離開目前房間。

| 項目 | 內容 |
|------|------|
| 方向 | Client → Server |
| 前置條件 | 目前已在某房間 |
| Request | 無（可不傳，或傳空物件） |

**成功回應 event：** `UserGame:LeaveRoom`

```ts
{ success: true }
```

成功後：

1. User socket `leave(roomId)`
2. 清除本地入房狀態
3. Manager 會收到 `Room:UserLeft`

**可能錯誤**

| code | 情況 |
|------|------|
| `INVALID_STATE` | 目前不在房間 |
| `NOT_FOUND` | 房間已不存在 |
| `LOCKED` | 重複觸發尚未完成 |

---

### 5.4 `UserGame:SubmitAnswer`

在投票階段提交選項。

| 項目 | 內容 |
|------|------|
| 方向 | Client → Server |
| 前置條件 | 已 Login；已入房；房間有進行中遊戲；`GameState === Voting`；自己在該房間玩家名單中 |
| Request | `{ optionIndex: number }` |

`optionIndex` 為 0-based，必須落在本題 `options` 範圍內。

**成功回應 event：** `UserGame:SubmitAnswer`（僅回給提交者）

```ts
{
  roomId: string;
  questionIndex: number;   // 1-based
  selectedOption: number;  // 等同 optionIndex
}
```

> 同一題可再次 Submit；後寫入會覆蓋先前答案與答題時間。

**可能錯誤**

| code | 情況 |
|------|------|
| `UNAUTHORIZED` | 尚未 Login，或不在該房間玩家名單 |
| `INVALID_STATE` | 未入房、無進行中題目，或非 Voting 階段 |
| `VALIDATION` | `optionIndex` 非數字，或超出選項範圍 |
| `NOT_FOUND` | 房間／遊戲不存在 |
| `LOCKED` | 重複觸發尚未完成 |

---

## 6. Server → Client（push／回應）

以下為 User 端會收到的事件。共用遊戲廣播會完整列出 payload。

### 6.1 `User:Login`

見 [5.1](#51-userlogin)。

---

### 6.2 `UserGame:JoinRoom`

見 [5.2](#52-usergamejoinroom)。

---

### 6.3 `UserGame:LeaveRoom`

見 [5.3](#53-usergameleaveroom)。

---

### 6.4 `UserGame:SubmitAnswer`

見 [5.4](#54-usergamesubmitanswer)。

---

### 6.5 `QuizGame:GameStarted`

遊戲開始廣播（Manager + 所有房間內 User）。

```ts
{
  roomId: string;
  quizCount: number; // 本場總題數
}
```

| 項目 | 內容 |
|------|------|
| 觸發時機 | Manager 成功 `Room:StartGame` 後立即 |
| 之後 | 約 3 秒自動收到 `QuizGame:Question` |
| User 動作 | 進入等待第一題 UI |

---

### 6.6 `QuizGame:Question`

出題（Manager + 所有房間內 User）。

```ts
{
  roomId: string;
  question: string;
  options: string[];
  questionIndex: number;  // 1-based
  totalQuestions: number;
  votingTime: number;     // 秒，目前固定 12
}
```

| 項目 | 內容 |
|------|------|
| 遊戲狀態 | 進入 `Voting` |
| 注意 | **不會**帶正確答案 |
| User 動作 | 在 `votingTime` 內呼叫 `UserGame:SubmitAnswer` |
| 之後 | 時間到自動 `QuizGame:Settle` |

---

### 6.7 `QuizGame:Settle`

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
}
```

| 項目 | 內容 |
|------|------|
| 遊戲狀態 | 進入 `Settle` |
| `answers` | 僅包含有提交答案的玩家；未作答者不在陣列中 |
| User 動作 | 可顯示自己／全場作答結果；此時不可再答題 |
| 之後 | 約 3 秒自動 `QuizGame:AnswerReveal` |

---

### 6.8 `QuizGame:AnswerReveal`

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
| User 動作 | 顯示正確答案；等待 Manager 按下一題 |

---

### 6.9 `QuizGame:NextQuestion`

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

### 6.10 `QuizGame:PersonalResult`

個人成績（**僅該 User**，每人一份）。

```ts
{
  roomId: string;
  rank: number;
  correctCount: number;
  totalTime: number; // 總答題秒數，小數點後 2 位
}
```

| 項目 | 內容 |
|------|------|
| 觸發時機 | Manager `Room:NextQuestion` 且已無下一題、進入 `ShowRanking` |
| 接收者 | 房間內**每一位**玩家各自一份（含答對 0 題） |
| 排名規則 | 先比答對數，再比總耗時；完全相同則同名次 |
| 對照 | Manager 另收 `QuizGame:ShowRanking`（Top10、排除 0 分）；User **不會**收到 `ShowRanking` |

---

### 6.11 `QuizGame:Finished`

遊戲結束廣播（Manager + 所有房間內 User）。

```ts
{
  roomId: string;
  totalQuestions: number;
}
```

| 項目 | 內容 |
|------|------|
| 觸發時機 | Manager 成功 `Room:FinishGame` 後 |
| 遊戲狀態 | `Finished` |
| User 動作 | 顯示結束畫面；之後可視需求 `LeaveRoom` |

---

### 6.12 `Room:Closed`

房間被關閉（**推給房間內 User**）。

```ts
{
  roomName: string;
  roomId: string;
  reason: 'Manager disconnected';
}
```

| 項目 | 內容 |
|------|------|
| 觸發時機 | **Manager 斷線**導致其擁有房間被刪除 |
| User 動作 | 清除入房／遊戲 UI；必要時提示房間已關閉 |

> 伺服器同時會清掉該 User 端的房間狀態並 `leave(roomId)`。

---

### 6.13 `error` / `{event}:error`

見 [2.2 錯誤回應](#22-錯誤回應)。

User 端常見的 `{event}:error` 範例：

- `User:Login:error`
- `UserGame:JoinRoom:error`
- `UserGame:LeaveRoom:error`
- `UserGame:SubmitAnswer:error`

---

## 7. 錯誤碼一覽

| code | 意義 |
|------|------|
| `VALIDATION` | 參數格式／必填欄位錯誤 |
| `UNAUTHORIZED` | 未登入，或不在房間玩家名單 |
| `NOT_FOUND` | 房間／遊戲不存在 |
| `CONFLICT` | 狀態衝突（例如已在房間、重複加入、已用不同 id 登入） |
| `LOCKED` | 同一 event 處理中被重複觸發 |
| `INVALID_STATE` | 目前狀態不允許此操作（未入房、非 Voting、房間已開局等） |

---

## 8. 斷線行為

User 斷線時，伺服器會：

1. 若該 User 仍在房間內 → 自動 `LeaveUser`
2. Manager 會收到 `Room:UserLeft`
3. 從 user 對照表移除該 `userId`
4. 清除該連線上的房間狀態

> 斷線不會自動保留「重連回原房」；重連後需重新 `User:Login` → `UserGame:JoinRoom`（且僅在房間仍為 `Prepare` 時可加入）。

---

## Event 速查表

### Client → Server

| Event | Payload |
|-------|---------|
| `User:Login` | `{ userId: string }` |
| `UserGame:JoinRoom` | `{ roomName: string }` |
| `UserGame:LeaveRoom` | — |
| `UserGame:SubmitAnswer` | `{ optionIndex: number }` |

### Server → Client

| Event | 對象 | 說明 |
|-------|------|------|
| `User:Login` | 自己 | 登入成功 |
| `UserGame:JoinRoom` | 自己 | 入房成功 |
| `UserGame:LeaveRoom` | 自己 | 離房成功 |
| `UserGame:SubmitAnswer` | 自己 | 提交答案成功 |
| `QuizGame:GameStarted` | Manager + Users | 遊戲開始 |
| `QuizGame:Question` | Manager + Users | 出題 |
| `QuizGame:Settle` | Manager + Users | 結算 |
| `QuizGame:AnswerReveal` | Manager + Users | 公布答案 |
| `QuizGame:NextQuestion` | Manager + Users | 下一題通知 |
| `QuizGame:PersonalResult` | **僅該 User** | 個人名次與成績 |
| `QuizGame:Finished` | Manager + Users | 遊戲結束 |
| `Room:Closed` | 房間內 Users | Manager 斷線關房 |
| `error` | 自己 | 全域錯誤 |
| `{event}:error` | 自己 | 特定 event 錯誤 |

> User **不會**收到：`Room:UserJoined`、`Room:UserLeft`、`QuizGame:ShowRanking`（這些是 Manager 專屬）。
