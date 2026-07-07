# Chess Castling Feature — Android Implementation Prompt

## Context

The backend Chess WebSocket now sends a `castlingAvailable` parameter in every game-state payload. The Android client must use this to suggest castling to the player when available, and if accepted, automatically execute the correct move without requiring the user to manually drag pieces.

---

## 1. Backend Payload — How Castling Availability Is Communicated

Every `chess` WebSocket event that contains a board state will now include a new field inside `data`:

```json
{
  "success": true,
  "messages": ["Move accepted."],
  "data": {
    "board": [ ... ],
    "yourTurn": true,
    "turnTimerSeconds": 30,
    "isPlayerOne": true,
    "playingWhite": true,
    "gameStarted": true,
    "lastMove": { "from": { "row": 6, "col": 4 }, "to": { "row": 4, "col": 4 } },
    "castlingAvailable": {
      "kingSide": true,
      "queenSide": false
    }
  }
}
```

### `castlingAvailable` Object

| Field | Type | Description |
|-------|------|-------------|
| `kingSide` | `boolean` | `true` if the player can legally castle king-side (short castling, O-O) right now |
| `queenSide` | `boolean` | `true` if the player can legally castle queen-side (long castling, O-O-O) right now |

> [!IMPORTANT]
> This object is **player-specific**. Each player receives their own castling status — not the opponent's. The backend validates all 7 FIDE castling rules before setting either to `true`:
> 1. King has never moved
> 2. The involved rook has never moved
> 3. No pieces between king and rook
> 4. King is not currently in check
> 5. King does not pass through a square under attack
> 6. King does not land on a square under attack
> 7. The rook is present on its starting square

### When This Field Is Sent

| Event | When | Includes `castlingAvailable`? |
|-------|------|------|
| `join` (rejoin a started game) | Player reconnects mid-game | ✅ Yes |
| Game start | Both players receive initial board | ✅ Yes |
| `move` response | After a move is made (sent to both mover and opponent) | ✅ Yes |
| `end_turn` response | After turn is ended (sent to both players) | ✅ Yes |
| `disconnect` / `game over` | Game has ended | ❌ No (game is over) |

---

## 2. Android UI — Suggesting Castling to the User

### When to Show the Suggestion

Display a castling suggestion **only when ALL of the following are true**:

1. `data.yourTurn === true` — it's the player's turn
2. `data.castlingAvailable.kingSide === true` **OR** `data.castlingAvailable.queenSide === true` — at least one side is available
3. `data.gameEnded !== true` — the game is still in progress
4. The player has **not yet moved a piece** this turn (the suggestion should appear at the start of their turn, before they touch any piece)

### UI Presentation

Display a non-intrusive suggestion banner or floating action near the board. Suggested designs:

#### Option A — Bottom Banner
```
┌──────────────────────────────────────────┐
│  ♜ Castling available!                   │
│  [King-side ➡️]    [Queen-side ⬅️]       │
│                            [Dismiss ✕]   │
└──────────────────────────────────────────┘
```

#### Option B — Subtle Chip/Badge
Show small clickable chips near the king piece on the board:
- **"O-O"** chip on the king-side if `kingSide === true`
- **"O-O-O"** chip on the queen-side if `queenSide === true`

### Visibility Rules

| `kingSide` | `queenSide` | What to show |
|------------|-------------|--------------|
| `true` | `true` | Show both options (king-side and queen-side buttons) |
| `true` | `false` | Show only king-side option |
| `false` | `true` | Show only queen-side option |
| `false` | `false` | Show nothing — hide the suggestion entirely |

### Dismissal
- The suggestion should **auto-dismiss** when the player picks up / touches any piece to move manually.
- The suggestion should **auto-dismiss** when the turn ends (timer expires or `yourTurn` becomes `false`).
- The user can manually dismiss it (tap the ✕ or swipe away) without penalty.

---

## 3. Auto-Executing the Castling Move

When the user taps one of the castling buttons, the Android app must **automatically send the correct `move` event** to the WebSocket — the user does NOT need to drag any pieces.

### Move Payloads to Send

The `move` event payload must contain the **king's starting position** as `from` and the **king's destination** as `to`. The backend will detect the castling pattern and move the rook automatically.

#### If `playingWhite === true` (Player is White)

| Castling Side | `from` | `to` | Description |
|---------------|--------|------|-------------|
| **King-side (O-O)** | `{ "row": 7, "col": 4 }` | `{ "row": 7, "col": 6 }` | King: e1 → g1 (rook h1 → f1 auto) |
| **Queen-side (O-O-O)** | `{ "row": 7, "col": 4 }` | `{ "row": 7, "col": 2 }` | King: e1 → c1 (rook a1 → d1 auto) |

#### If `playingWhite === false` (Player is Black)

| Castling Side | `from` | `to` | Description |
|---------------|--------|------|-------------|
| **King-side (O-O)** | `{ "row": 0, "col": 4 }` | `{ "row": 0, "col": 6 }` | King: e8 → g8 (rook h8 → f8 auto) |
| **Queen-side (O-O-O)** | `{ "row": 0, "col": 4 }` | `{ "row": 0, "col": 2 }` | King: e8 → c8 (rook a8 → d8 auto) |

### Example WebSocket Emit (King-side, White)

```json
{
  "event": "move",
  "data": {
    "room_id": "664f1a2b3c...",
    "from": { "row": 7, "col": 4 },
    "to": { "row": 7, "col": 6 }
  }
}
```

> [!NOTE]
> You do NOT need to send a `castle` flag or move the rook manually. The backend detects the king moving 2 squares and handles rook repositioning automatically. Just send the king's from → to.

---

## 4. Board Animation After Castling

After sending the castling `move` event, the backend will respond with the updated `board` in the next `chess` event. However, for a smooth UX:

1. **Optimistic animation**: As soon as the user taps the castling button, animate both pieces simultaneously:
   - Slide the **king** 2 squares toward the rook
   - Slide the **rook** to the square the king crossed over
2. **Confirm with server response**: When the `chess` response arrives with `success: true`, sync the board state. If `success: false` (edge case — race condition), revert the animation and show the error message.

### Animation Mapping

| Side | King animates | Rook animates |
|------|--------------|---------------|
| King-side (White) | (7,4) → (7,6) | (7,7) → (7,5) |
| Queen-side (White) | (7,4) → (7,2) | (7,0) → (7,3) |
| King-side (Black) | (0,4) → (0,6) | (0,7) → (0,5) |
| Queen-side (Black) | (0,4) → (0,2) | (0,0) → (0,3) |

---

## 5. Complete Flow Summary

```
┌─────────────────────────────────────────────────────┐
│            BACKEND (WebSocket: /chess)               │
│                                                      │
│  On every game-state emit, include:                  │
│  data.castlingAvailable = {                          │
│    kingSide: boolean,                                │
│    queenSide: boolean                                │
│  }                                                   │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│              ANDROID CLIENT                          │
│                                                      │
│  1. Parse `castlingAvailable` from every chess event │
│  2. IF yourTurn && (kingSide || queenSide):          │
│     → Show castling suggestion UI                    │
│  3. IF user taps a castling button:                  │
│     → Emit `move` with king from/to coords           │
│     → Animate king + rook optimistically             │
│  4. On server response:                              │
│     → If success: sync board, update castling state  │
│     → If fail: revert animation, show error          │
│  5. On next event:                                   │
│     → Re-evaluate castlingAvailable for new state    │
└──────────────────────────────────────────────────────┘
```

---

## 6. Edge Cases to Handle

| Scenario | Expected Behavior |
|----------|-------------------|
| Both `kingSide` and `queenSide` are `false` | Do not show any castling UI |
| Player touches a piece before tapping castling | Dismiss the castling suggestion |
| Castling was available but opponent's move puts king in check | Next payload will have both set to `false` — hide suggestion |
| Player disconnects and reconnects mid-game | `join` response includes `castlingAvailable` — re-evaluate |
| Game ends while suggestion is showing | Hide suggestion immediately on `gameEnded: true` |
| Timer expires while suggestion is showing | Hide suggestion on `yourTurn: false` |

---

## 7. Data Model (Kotlin)

```kotlin
data class CastlingAvailable(
    val kingSide: Boolean = false,
    val queenSide: Boolean = false
)

// Parse from the chess event data:
val castling = gson.fromJson(
    data.getJSONObject("castlingAvailable").toString(),
    CastlingAvailable::class.java
)
```
