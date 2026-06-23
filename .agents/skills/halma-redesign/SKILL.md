# Halma — Android Implementation Guide (New Checkers-Style Rules)

## 🚨 IMPORTANT: Rule Changes from Previous Version

The backend Halma game has been updated with checkers-style rules. The Android client MUST be updated to match. The WebSocket event names, payload structure, and turn system remain **unchanged** — only the board rendering, piece placement, and move validation logic need updating.

---

## 1. Board Configuration

### Grid: 8×8

The board is an 8×8 grid. Each cell is identified by `[row, col]` where:
- `row 0` = top of the board
- `row 7` = bottom of the board
- `col 0` = left
- `col 7` = right

### Dark & Light Squares

The board MUST have alternating dark/light squares like a checkerboard:

```
isDarkSquare(row, col) = (row + col) % 2 != 0
```

- **Dark squares** → pieces can exist here (use a darker color, e.g., `#769656` or `#B58863`)
- **Light squares** → always empty, decorative only (e.g., `#EEEED2` or `#F0D9B5`)

### Visual Layout

```
     0    1    2    3    4    5    6    7
  ┌─────────────────────────────────────────┐
0 │  ░░  P1  ░░  P1  ░░  P1  ░░  P1       │  ← Player 1
1 │  P1  ░░  P1  ░░  P1  ░░  P1  ░░       │  ← Player 1
2 │  ░░  P1  ░░  P1  ░░  P1  ░░  P1       │  ← Player 1
3 │  ░░  ░░  ░░  ░░  ░░  ░░  ░░  ░░       │
4 │  ░░  ░░  ░░  ░░  ░░  ░░  ░░  ░░       │
5 │  P2  ░░  P2  ░░  P2  ░░  P2  ░░       │  ← Player 2
6 │  ░░  P2  ░░  P2  ░░  P2  ░░  P2       │  ← Player 2
7 │  P2  ░░  P2  ░░  P2  ░░  P2  ░░       │  ← Player 2
  └─────────────────────────────────────────┘
░░ = light square (always empty)
P1/P2 = pieces on dark squares
```

### Piece Count
- **Player 1**: 12 pieces (rows 0, 1, 2 on dark squares)
- **Player 2**: 12 pieces (rows 5, 6, 7 on dark squares)

### Board Orientation
- **Player 1** sees their pieces at the TOP, moving DOWN
- **Player 2** sees their pieces at the TOP, moving DOWN (rotate board 180°)
- Each player always sees themselves at the top moving toward the bottom

---

## 2. Board Data Format

The backend sends `data.board` as a 2D array `number[8][8]`:

```json
{
  "board": [
    [0,1,0,1,0,1,0,1],
    [1,0,1,0,1,0,1,0],
    [0,1,0,1,0,1,0,1],
    [0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
    [2,0,2,0,2,0,2,0],
    [0,2,0,2,0,2,0,2],
    [2,0,2,0,2,0,2,0]
  ]
}
```

| Value | Meaning |
|-------|---------|
| `0` | Empty cell |
| `1` | Player 1 piece |
| `2` | Player 2 piece |

---

## 3. Movement Rules (Client-Side Validation)

The client SHOULD validate moves locally before sending to avoid unnecessary round-trips. The backend will also validate.

### Rule 1: Diagonal Only
Pieces can ONLY move diagonally:
```
abs(toRow - fromRow) == abs(toCol - fromCol)
```

❌ No horizontal movement
❌ No vertical movement

### Rule 2: Forward Only
- **Player 1** (pieces = `1`): `toRow > fromRow` (moves DOWN)
- **Player 2** (pieces = `2`): `toRow < fromRow` (moves UP)

> [!IMPORTANT]
> When the board is rotated for Player 2's perspective, "forward" visually becomes "down" for them too. Apply the forward check on the RAW board coordinates before rotation.

❌ No backward movement

### Rule 3: Dark Squares Only
Destination must be a dark square:
```
(toRow + toCol) % 2 != 0
```

### Simple Move
- Exactly 1 diagonal step forward
- Destination must be empty and dark

```
abs(toRow - fromRow) == 1
abs(toCol - fromCol) == 1
board[toRow][toCol] == 0
isDarkSquare(toRow, toCol) == true
isForward(fromRow, toRow, playerNum) == true
```

### Jump Move
- Exactly 2 diagonal steps forward
- The intermediate square must contain ANY piece (own or opponent's)
- Destination must be empty and dark
- **Pieces are NOT captured** (the jumped piece stays)

```
abs(toRow - fromRow) == 2
abs(toCol - fromCol) == 2
midRow = (fromRow + toRow) / 2
midCol = (fromCol + toCol) / 2
board[midRow][midCol] != 0    ← any piece
board[toRow][toCol] == 0      ← empty
isDarkSquare(toRow, toCol)    ← dark
isForward(fromRow, toRow, playerNum) ← forward
```

### Chain Jumps
After a jump, if the piece can jump again from its new position, the backend responds with:

```json
{
  "data": {
    "board": [...],
    "yourTurn": true,
    "continuingJump": true,
    "jumpingPiece": { "row": 4, "col": 3 }
  }
}
```

When `continuingJump: true`:
- The player can ONLY move the piece at `jumpingPiece`
- The player can either jump again OR end their turn
- Lock all other pieces — only `jumpingPiece` is selectable

### End Turn
After any completed move (simple step or final jump), the backend sends:

```json
{
  "data": {
    "board": [...],
    "yourTurn": true,
    "mustEndTurn": true
  }
}
```

When `mustEndTurn: true`:
- Show an "End Turn" button
- The player MUST emit `end_turn` to pass the turn
- The turn does NOT change automatically

---

## 4. UI Interaction Flow

### When it's YOUR turn (`yourTurn: true`)

```
1. Player taps a piece → Highlight it
   ├── Calculate valid destinations:
   │   ├── Check all 2 forward diagonal cells for simple moves
   │   └── Check all 2 forward diagonal cells at distance 2 for jumps
   └── Highlight valid destination cells (e.g., green dots on dark squares)

2. Player taps a valid destination → Send move
   emit('move', { room_id, from: [fromRow, fromCol], to: [toRow, toCol] })

3. Receive response:
   ├── continuingJump: true → Lock to jumpingPiece, allow another jump or end turn
   ├── mustEndTurn: true → Show "End Turn" button
   └── yourTurn: false → Disable board, wait for opponent
```

### When it's OPPONENT's turn (`yourTurn: false`)
- Disable all piece selection
- Show "Waiting for opponent" indicator
- Animate opponent's move when received

### End Turn Button
```
Player taps "End Turn" →
emit('end_turn', { room_id })
```

---

## 5. Valid Move Highlighting

When a player taps their own piece, show valid destinations:

```kotlin
fun getValidMoves(board: Array<IntArray>, row: Int, col: Int, playerNum: Int): List<Pair<Int,Int>> {
    val moves = mutableListOf<Pair<Int,Int>>()
    val forwardDir = if (playerNum == 1) 1 else -1
    
    // Simple moves (1 diagonal step forward)
    for (dc in listOf(-1, 1)) {
        val tr = row + forwardDir
        val tc = col + dc
        if (inBounds(tr, tc) && board[tr][tc] == 0 && isDarkSquare(tr, tc)) {
            moves.add(Pair(tr, tc))
        }
    }
    
    // Jump moves (2 diagonal steps forward)
    for (dc in listOf(-1, 1)) {
        val tr = row + forwardDir * 2
        val tc = col + dc * 2
        val midR = row + forwardDir
        val midC = col + dc
        if (inBounds(tr, tc) && board[tr][tc] == 0 
            && isDarkSquare(tr, tc) && board[midR][midC] != 0) {
            moves.add(Pair(tr, tc))
        }
    }
    
    return moves
}

fun isDarkSquare(row: Int, col: Int): Boolean = (row + col) % 2 != 0
fun inBounds(row: Int, col: Int): Boolean = row in 0..7 && col in 0..7
```

---

## 6. WebSocket Events (Unchanged)

### Events to EMIT

| Event | Payload | When |
|-------|---------|------|
| `join` | `{ room_id: String }` | On entering the game screen |
| `move` | `{ room_id: String, from: [Int,Int], to: [Int,Int] }` | On making a move |
| `end_turn` | `{ room_id: String }` | On tapping "End Turn" |

### Events to LISTEN (`'halma'`)

| Field | Type | Description |
|-------|------|-------------|
| `board` | `Int[8][8]` | Current board state |
| `yourTurn` | `Boolean` | Is it your turn? |
| `turnTimerSeconds` | `Int` | Seconds for the turn timer (30) |
| `isPlayerOne` | `Boolean` | Are you Player 1? |
| `gameStarted` | `Boolean` | Has the game started? |
| `waitingForOpponent` | `Boolean` | Waiting in lobby? |
| `continuingJump` | `Boolean` | Can chain jump? |
| `jumpingPiece` | `{row, col}` | Which piece is jumping |
| `mustEndTurn` | `Boolean` | Must end turn manually? |
| `gameEnded` | `Boolean` | Game finished? |
| `outcome` | `String` | `"win"`, `"lose"`, `"timeout_loss"` |
| `youWon` | `Boolean` | Did you win? |
| `winner` | `String` | Winner's ID |
| `reason` | `String` | `"normal"`, `"timeout"`, `"forfeit"` |
| `prize` | `Number` | Prize amount |

---

## 7. Win Condition

A player wins when ALL dark squares in the opponent's starting rows contain their pieces:

- **Player 1 wins**: All dark squares in rows 5, 6, 7 have piece `1`
- **Player 2 wins**: All dark squares in rows 0, 1, 2 have piece `2`

That's 12 dark squares per goal zone — exactly matching the 12 pieces per player.

The backend handles win detection. The client receives `gameEnded: true` with `outcome`.

---

## 8. Piece Style Suggestions

| Element | Suggestion |
|---------|------------|
| P1 piece | White/cream circle with subtle shadow |
| P2 piece | Black/dark circle with subtle shadow |
| Dark square | `#769656` or `#B58863` |
| Light square | `#EEEED2` or `#F0D9B5` |
| Selected piece | Glowing border or lifted shadow |
| Valid move dot | Semi-transparent green circle on dark square |
| Last move | Subtle highlight on from/to squares |

---

## 9. Key Differences from Previous Version

| Aspect | Before | Now |
|--------|--------|-----|
| Pieces per player | 16 | 12 |
| Starting rows | 2 rows (full) | 3 rows (dark squares only) |
| Movement | Any direction, any adjacent | Diagonal forward only |
| Valid squares | All | Dark squares only |
| Board look | Uniform grid | Checkerboard pattern |
| Backward moves | ✅ Allowed | ❌ Forbidden |
| Horizontal/Vertical | ✅ Allowed | ❌ Forbidden |
