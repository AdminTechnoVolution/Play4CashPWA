# Play4Cash Android — Referencia Completa de la Aplicación

> Skill de conocimiento total. Úsalo como fuente de verdad antes de tocar cualquier parte de la app.

---

## 1. STACK TECNOLÓGICO

| Capa | Tecnología |
|------|-----------|
| Lenguaje | Kotlin 2.0.21 |
| UI | Jetpack Compose + Material 3 (BOM 2025.07.00) |
| Navegación | Jetpack Navigation Compose 2.8.4 |
| Networking HTTP | Ktor 3.4.0 |
| Networking Realtime | Socket.IO 2.1.0 |
| Auth | Google Sign-In (Credentials API 1.5.0, GoogleID 1.1.0) |
| Persistencia | Android DataStore Preferences 1.1.1 |
| Serialización | Kotlinx Serialization 1.7.3 |
| Min SDK | 24 (Android 7.0) |
| Target/Compile SDK | 36 |
| Namespace | `com.play4cash.play` |
| Versión | 3.0.1 (versionCode: 7) |

**Permisos:** `INTERNET`, `VIBRATE`

---

## 2. BUILD VARIANTS

| Flavor | BASE_URL |
|--------|----------|
| `dev` | `https://p4c-api.techno-volution.com` |
| `prod` | `https://p4c-agazhsdng5fuexaq.mexicocentral-01.azurewebsites.net` |

`buildConfigField("String", "BASE_URL", ...)` inyecta la URL en `BuildConfig`.

---

## 3. ARQUITECTURA

```
MVVM + Clean Architecture (manual DI)
├── domain/          → interfaces + use cases + domain models
├── data/            → implementaciones de repositories + network + persistencia
├── presentation/    → ViewModels + Screens (Compose)
└── ui/              → tema, componentes reutilizables, feedback (haptic/sound/motion)
```

**DI:** Inyección manual en `MainActivity`. No hay framework (sin Hilt/Dagger).

---

## 4. NAVEGACIÓN

`MainActivity` aloja un único `NavHost`. Todas las transiciones usan slide+fade custom (320ms slide, 280ms fade).

### Rutas

| Route | Screen | Argumentos |
|-------|--------|-----------|
| `login` | `LoginScreen` | — |
| `dashboard` | `DashboardScreen` | — |
| `settings` | `SettingsScreen` | — |
| `history` | `TransactionHistoryScreen` | — |
| `add_funds` | `AddFundsScreen` | — |
| `withdrawal/{userBalance}` | `WithdrawalScreen` | `userBalance: Double` |
| `withdrawal_verify` | `WithdrawalVerifyScreen` | — |
| `rooms/{gameId}/{gameName}/{minBet}/{userBalance}/{gameSocketCode}` | `RoomsScreen` | gameId, gameName, minBet, userBalance, gameSocketCode |
| `play/{gameSocketCode}/{roomId}/{betAmount}/{roomName}/{opponentName}/{hasOpponent}/{isSpectator}` | `PlayScreen` | todos los parámetros del juego |

`PlayScreen` despacha a `BattleshipScreen`, `ChessScreen`, `DominoScreen` o `HalmaScreen` según `gameSocketCode`.

---

## 5. AUTENTICACIÓN

### Flujo
1. `LoginScreen` → botón Google Sign-In
2. `AuthRepositoryImpl` usa `Credentials API` para obtener `GoogleIdTokenCredential`
3. `SignInWithGoogleUseCase` llama a `LoginRepository.loginWithGoogle(idToken)`
4. Backend devuelve `{ token, refreshToken }` → se guarda en `AuthSessionStore` (DataStore)
5. Si hay sesión válida al abrir la app → navega directo a `dashboard`

### Validación de sesión
- `ApiClient.hasValidSession()` decodifica el claim `exp` del JWT
- Leeway de 60 segundos antes de considerar expirado
- Token refresh automático en respuestas 401
- **Single-flight refresh**: solo una operación de refresh a la vez; las demás solicitudes concurrentes esperan al mismo `Deferred`

### DataStore stores
| Store | Clave | Contenido |
|-------|-------|-----------|
| `AuthSessionStore` (`auth_session`) | `access_token`, `refresh_token` | JWT tokens |
| `UserPreferencesStore` | `user_account`, `wallet_address` | Datos de cuenta cacheados |

### Modelos
```kotlin
data class User(id, email, displayName, photoUrl)                    // domain
data class LoginResponse(token, refreshToken)                        // network
data class UserAccountResponse(
    id, email, username, balance, totalRecharged, totalWithdrawal,
    totalWon, status, walletAddress, wallet,
    limits: { dailyWithdrawal }
)
```

---

## 6. CAPA DE RED (HTTP)

### Clientes Ktor
| Cliente | Auth | Uso |
|---------|------|-----|
| `bareClient` | Sin auth | Login, refresh token |
| `httpClient` | Bearer token automático | Todas las demás llamadas |

**Timeout:** 180 segundos  
**Retry:** Hasta 2 reintentos en errores de servidor con backoff exponencial  
**JSON:** Modo lenient (ignora campos desconocidos, coerce types)

### Plugin de auth
`AuthTokenPlugin` adjunta `Authorization: Bearer <token>` a cada request. Si recibe 401, refresca el token y reintenta (single-flight).

### Endpoints REST

```
POST   /api/login                              Login (email/pass o Google token)
POST   /api/login/refresh                      Refresh JWT
POST   /api/logout                             Cierre de sesión (envía refreshToken)
GET    /api/user/account                       Info de cuenta + límites
GET    /api/games                              Listado de juegos disponibles
GET    /api/greetings                          Frases rápidas para chat en juego
GET    /api/wallets                            Redes de retiro disponibles
GET    /api/rooms/stats                        Estadísticas en vivo (jugadores, partidas, apuesta total)
GET    /api/rooms/game/{gameId}                Salas de un juego
POST   /api/rooms                              Crear sala
POST   /api/rooms/{id}/join                    Unirse como jugador
POST   /api/rooms/{id}/spectate                Unirse como espectador
POST   /api/rooms/{id}/ready                   Marcar listo (tras placement)
PATCH  /api/rooms/{id}/ready                   Igual que POST ready
POST   /api/rooms/{id}/leave                   Salir del lobby
GET    /api/rooms/{id}/status                  Polling del estado de la sala
POST   /api/rooms/{id}/battleship/placement    Enviar posición de barcos
POST   /api/user/register-wallet               Guardar dirección de wallet
POST   /api/transactions/recharge              Depositar (enviar txId)
POST   /api/transactions/withdrawal            Iniciar retiro
POST   /api/transactions/verify-withdrawal     Verificar OTP del retiro
GET    /api/transactions/recharge/history      Historial de depósitos
GET    /api/transactions/withdrawal/history    Historial de retiros
GET    /api/user/history                       Historial de partidas
```

### Wrapper de respuesta
```kotlin
data class ApiResponse<T>(success: Boolean, data: T?, message: String?, messages: List<String>?)
```

### Manejo de errores
| Código | Comportamiento |
|--------|---------------|
| 4xx | Extrae `messages` o `message` del cuerpo y lo muestra al usuario |
| 5xx | Muestra mensaje genérico ("error_try_later_message") |
| Sin conexión | `ConnectException`, `SocketTimeoutException` → "error_connection_failed" |

**Capas:** `ApiService` (llamadas crudas) → `ApiRepository` (caché + lógica de negocio)

---

## 7. SOCKET.IO — COMUNICACIÓN EN TIEMPO REAL

**Autenticación dual:** Token en header `Authorization: Bearer` + query string `?token=`  
**Reconexión automática:** backoff 1-5s, reintentos ilimitados  
**Timeout de conexión:** 20s  
**Token refresh en socket:** Si el socket recibe 401, refresca y reconecta (single-flight)

### Namespaces y managers

| Manager | Namespace | Eventos enviados | Eventos recibidos |
|---------|-----------|-----------------|------------------|
| `LobbySocketManager` | `/rooms` | — | `roomCreated`, `roomUpdated`, `roomDeleted` |
| `BattleshipSocketManager` | `/naval-battle` | `fire { room_id, row, col }` | `naval-battle` |
| `ChessSocketManager` | `/chess` | `move { room_id, from, to, promotion? }` | `chess` |
| `DominoSocketManager` | `/domino` | `move { tile, side }`, `draw`, `pass` | `domino` |
| `HalmaSocketManager` | `/halma` | `move { room_id, from_row, from_col, to_row, to_col }`, `end_turn` | `halma` |
| `ChatSocketManager` | `/chat` | `greeting { room_id, greeting_id }` | `chat` |

**Ciclo de vida:** Se conectan en `init{}` del ViewModel, se desconectan en `onCleared()`.

---

## 8. JUEGOS

### A. BATTLESHIP (naval-battle)

**Grid:** 10×10  
**Barcos:** Carrier(5), Battleship(4), Cruiser(3), Submarine(3), Destroyer(2)

**Fases:**
1. **Placement:** Jugador coloca barcos vía UI drag → POST `/api/rooms/{id}/battleship/placement`
2. **Battle:** Turnos alternados. Jugador selecciona celda → socket emit `fire { room_id, row, col }`
3. **Game Over:** Todos los barcos del oponente hundidos → `youWon: true/false`

**Feedback visual:**
- Misil cayendo: 820ms
- Explosión: 2s + hold 5s
- Celdas: neutral / hit / miss / sunk

**ViewModel clave:** `BattleshipViewModel`  
**Screen:** `BattleshipScreen` (2 grids: propio + oponente)

---

### B. CHESS (chess)

**Tablero:** 8×8 estándar  
**Características implementadas:**
- Selección de pieza + resaltado de movimientos válidos
- Promoción de peón: queen/rook/bishop/knight (diálogo)
- Enroque (kingside/queenside) con banner de hint cuando está disponible
- Temporizador de turno con alarma de timeout
- Detección de jaque, jaque mate, ahogado, material insuficiente
- El tablero rota según el color del jugador (blancas siempre abajo)
- `requestSync(roomId)` para re-sincronizar estado tras reconexión

**Payload move:**
```json
{ "room_id": "...", "from": {"row": 6, "col": 4}, "to": {"row": 4, "col": 4}, "promotion": "q" }
```

**ViewModel clave:** `ChessViewModel`  
**Screen:** `ChessScreen`

---

### C. DOMINO (domino)

**Jugadores:** 2 o 4 (seleccionable al crear sala)  
**Gameplay:**
- Mano del jugador + tren del tablero (extremos izquierdo/derecho)
- Jugar ficha que coincida con algún extremo
- Si no puede jugar → robar del boneyard (draw)
- Si boneyard vacío y no puede jugar → pasar (pass)
- Fin: mano vacía OR todos los jugadores pasan

**Payloads:**
```json
{ "room_id": "...", "tile": [3, 5], "side": "left" }   // move
{ "room_id": "..." }                                      // draw
{ "room_id": "..." }                                      // pass
```

**ViewModel clave:** `DominoViewModel`  
**Screen:** `DominoScreen`

---

### D. HALMA (halma)

**Tablero:** 8×8, estilo checkers (casillas oscuras/claras alternadas)  
**Movimientos:**
- Deslizamiento diagonal un paso
- Salto diagonal múltiple (cadena de saltos en el mismo turno)
- Puede saltar sobre piezas propias y del oponente en cualquier dirección (incluyendo hacia atrás)
- El turno se termina con `end_turn` o automáticamente si no hay más saltos disponibles

**Payloads:**
```json
// move
{ "room_id": "...", "from_row": 5, "from_col": 2, "to_row": 3, "to_col": 4 }
// end_turn
{ "room_id": "..." }
```

**ViewModel clave:** `HalmaViewModel`  
**Screen:** `HalmaScreen`

---

## 9. PANTALLAS Y FUNCIONES

### LoginScreen
- Botón Google Sign-In
- Links a Términos y Condiciones
- Fondo animado
- Navega a `dashboard` tras auth exitosa

### DashboardScreen
- Drawer lateral con menú de navegación
- Balance del usuario
- Lista de juegos disponibles (GameCards)
- Estadísticas en vivo: jugadores online, partidas activas, apuesta total (`/api/rooms/stats`)
- Navega a `rooms/{...}` al tocar un juego

### RoomsScreen
- Lista de salas del juego seleccionado
- Filtros: All / Waiting / Started
- Botón crear sala → diálogo con nombre, apuesta, límite de jugadores
- Botón unirse (como jugador o espectador)
- Actualizaciones en tiempo real vía `LobbySocketManager`
- Navega a `play/{...}` tras unirse

### PlayScreen
- Dispatcher: lee `gameSocketCode` y renderiza el Screen correcto
- Maneja `RoomLeavePrecheck` (diálogo de confirmación al salir)

### BattleshipScreen / ChessScreen / DominoScreen / HalmaScreen
- UI completa del juego
- Chat rápido (`GameGreetingChips`, `ChatGreetingBanner`)
- `GameOverPresentation` al terminar
- Indicador de espectador si `isSpectator == true`

### AddFundsScreen
- Dropdown para seleccionar red de wallet
- Input de monto
- QR con dirección de depósito
- Input de txId tras hacer la transferencia off-app
- POST `/api/transactions/recharge`

### WithdrawalScreen
- Input de monto
- Validación: >= minAmount, <= balance, <= dailyLimit
- Cálculo de fee
- POST `/api/transactions/withdrawal` → navega a `withdrawal_verify`

### WithdrawalVerifyScreen
- Input de 6 dígitos (OTP recibido por email/SMS)
- POST `/api/transactions/verify-withdrawal`

### SettingsScreen
- Input/visualización de dirección de wallet
- Selector de red de retiro
- POST `/api/user/register-wallet`
- Selector de idioma (`LocalizationManager`)

### TransactionHistoryScreen
- Tabs: Depósitos / Retiros / Partidas
- Listas con filtros
- Endpoints: history de recharge, withdrawal, y user/history

---

## 10. MODO ESPECTADOR

- `isSpectator: Boolean` pasado a `PlayScreen` vía nav args
- `POST /api/rooms/{id}/spectate` → sin apuesta
- El espectador ve ambos tableros pero NO puede realizar acciones
- `SpectatorPayload` y `SpectatorWatchBadge` marcan la sesión como solo lectura
- Conteo de espectadores transmitido en `RoomResponse.spectatorsCount`
- Error si intenta acción: "ws.games.spectatorActionDenied"

---

## 11. SISTEMA DE PAGOS (CRYPTO)

### Depósito (Add Funds)
1. GET `/api/wallets` → redes disponibles (coin, address, minAmount, fee)
2. Mostrar QR de la dirección del servidor
3. Usuario envía crypto externamente
4. Usuario ingresa txId en la app
5. POST `/api/transactions/recharge { txId, amount }`
6. Se registra en historial

### Retiro (Withdrawal)
1. GET `/api/user/account` → verificar balance y `limits.dailyWithdrawal`
2. Usuario ingresa monto → validar contra límites
3. POST `/api/transactions/withdrawal` → servidor envía OTP
4. Usuario ingresa OTP en `WithdrawalVerifyScreen`
5. POST `/api/transactions/verify-withdrawal { code }`
6. Balance actualizado

### Apuestas en partida
- Apuesta descontada al crear/unirse a sala
- Premio acreditado al ganar
- Reembolso en caso de abandono o timeout

---

## 12. CHAT EN PARTIDA

- GET `/api/greetings` → lista de frases predefinidas
- UI: chips de saludo (`GameGreetingChips`)
- Al tocar → socket emit en `/chat` namespace: `{ room_id, greeting_id }`
- Servidor traduce la frase según `Accept-Language` del receptor
- `ChatGreetingBanner` muestra saludo recibido/enviado

---

## 13. FIN DE PARTIDA

### Condiciones por juego
| Juego | Condiciones de fin |
|-------|-------------------|
| Battleship | Todos los barcos del oponente hundidos |
| Chess | Jaque mate, ahogado, material insuficiente, timeout, rendición |
| Domino | Mano vacía / todos pasan |
| Halma | Piezas en esquina opuesta / timeout |

### Payload de resultado
```json
{
  "outcome": "win|lose|draw",
  "youWon": true,
  "isDraw": false,
  "winner": "username",
  "reason": "checkmate|timeout|forfeit|...",
  "prize": 1.50
}
```

`GameOverPresentation` muestra resultado con mensajes localizados + premio.

---

## 14. ESTADO Y VIEWMODELS

**Patrón:** `MutableStateFlow` → `.asStateFlow()` en todos los ViewModels

| ViewModel | Estado principal |
|-----------|-----------------|
| `LoginViewModel` | isLoading, user, error |
| `DashboardViewModel` | account, games, roomStats, error |
| `RoomsViewModel` | rooms, createDialog, joinError |
| `BattleshipViewModel` | phase, playerBoard, opponentBoard, placement, turnState |
| `ChessViewModel` | board, pieces, validMoves, check/checkmate, castlingHints |
| `DominoViewModel` | hand, boardTiles, validMoves, opponents, boneyardCount |
| `HalmaViewModel` | boardState, validMoves, jumpTrails, captures, turnState |

---

## 15. TEMA Y DISEÑO — SOVEREIGN INTERFACE

**Paleta base:** Navy oscuro + acentos dorados  
**Regla crítica:** Los colores del sistema Sovereign NO se cambian.

| Token | Valor/Uso |
|-------|----------|
| Primary | Gold/Tertiary (`SovereignColors.Tertiary`) |
| Surface | Dark grays (`SurfaceContainerHigh`) |
| Text | Blanco / gris claro |
| Error | Rojo |
| Shapes | xs→4dp, sm→8dp, **md→12dp**, **lg→16dp**, **xl→20dp** |

**Componentes del sistema:**
- `SovereignPrimaryButton`, `SovereignSecondaryButton`
- `SovereignGoldGradientBrush135` (gradiente dorado en acentos)
- `sovereignGhostBorder` (modifier de borde sutil)
- `AppScreenTheme` (fondo + colores de texto para cada pantalla)

---

## 16. LOCALIZACIÓN

**Manager:** `LocalizationManager` → guarda preferencia en DataStore  
**Idiomas:** en, es, fr, de, it, pt  
**Header:** `Accept-Language` enviado en cada request HTTP y socket  
**Fallback:** Keys de `AppStrings` si la traducción no existe  
**Mapeo de mensajes:** Prose en inglés del API → keys de la app (ej. "Game started! Good luck." → "ws.games.startedRoom")

---

## 17. FEEDBACK DE JUEGO

| Tipo | Clase | Uso |
|------|-------|-----|
| Haptics | `GameVibration`, `LocalGameHaptic` | Vibración en acciones (disparo, captura, movimiento) |
| Sonido | `GameSound` | Efectos de sonido opcionales |
| Animaciones | `GameMotion` | Animaciones de piezas (slide, fade, scale), misil/explosión en Battleship, trails en Halma |
| Alarma | `TurnTimeoutAlarm` | Notificación cuando se agota el tiempo del turno |

---

## 18. MODELOS DE RED COMPLETOS

```kotlin
// Requests
data class CreateRoomRequest(gameId, betAmount, playerLimit)
data class BattleshipPlacementRequest(ships: List<ShipPlacement>)
data class WithdrawalRequest(amount, walletAddress, network)
data class VerifyWithdrawalRequest(code)
data class RechargeRequest(txId, amount)

// Responses
data class GameResponse(id, name, minBet, socketCode, turnTimer)
data class RoomResponse(id, name, players, betAmount, status, spectatorsCount, playerLimit)
data class RoomStatusResponse(playerCount, currentPlayer, winner)
data class WalletResponse(coin, address, minAmount, fee, network)
data class GameHistoryItem(id, opponent, result, prize, finishedAt, gameName)
data class RechargeHistoryItem(id, amount, txId, status, createdAt)
data class WithdrawalHistoryItem(id, amount, address, network, status, createdAt)
```

---

## 19. ESTRUCTURA DE DIRECTORIOS

```
app/src/main/java/com/play4cash/play/
├── MainActivity.kt
├── data/
│   ├── auth/
│   │   ├── AuthRepositoryImpl.kt
│   │   ├── AuthSessionStore.kt
│   │   └── UserPreferencesStore.kt
│   └── network/
│       ├── ApiClient.kt
│       ├── ApiService.kt
│       ├── ApiRepository.kt
│       ├── ApiModels.kt
│       ├── LobbySocketManager.kt
│       ├── BattleshipSocketManager.kt
│       ├── ChessSocketManager.kt
│       ├── DominoSocketManager.kt
│       ├── HalmaSocketManager.kt
│       └── ChatSocketManager.kt
├── domain/
│   └── auth/
│       ├── AuthRepository.kt
│       ├── LoginRepository.kt
│       ├── SignInWithGoogleUseCase.kt
│       └── User.kt
├── presentation/
│   ├── login/         → LoginScreen, LoginViewModel
│   ├── dashboard/     → DashboardScreen, DashboardViewModel
│   ├── rooms/         → RoomsScreen, RoomsViewModel
│   ├── play/
│   │   ├── PlayScreen.kt
│   │   ├── BattleshipScreen.kt + BattleshipViewModel.kt
│   │   ├── ChessScreen.kt + ChessViewModel.kt
│   │   ├── DominoScreen.kt + DominoViewModel.kt
│   │   ├── HalmaScreen.kt + HalmaViewModel.kt
│   │   ├── ChatGreetingBanner.kt
│   │   ├── ChatGreetingModels.kt
│   │   ├── GameGreetingChips.kt
│   │   ├── GameOverPresentation.kt
│   │   └── RoomLeavePrecheck.kt
│   ├── addfunds/      → AddFundsScreen
│   ├── withdrawal/    → WithdrawalScreen, WithdrawalVerifyScreen
│   ├── settings/      → SettingsScreen
│   └── transactionhistory/ → TransactionHistoryScreen
├── ui/
│   ├── theme/
│   │   ├── Theme.kt
│   │   ├── Color.kt
│   │   ├── Sovereign.kt
│   │   ├── Type.kt
│   │   └── AppScreenTheme.kt
│   ├── components/
│   │   ├── GameComponents.kt
│   │   ├── SovereignButtons.kt
│   │   ├── SpectatorWatchBadge.kt
│   │   └── GenericErrorDialog.kt
│   └── game/
│       ├── GameHaptic.kt
│       ├── GameSound.kt
│       ├── GameVibration.kt
│       ├── GameMotion.kt
│       └── TurnTimeoutAlarm.kt
└── util/
    ├── AppConstants.kt
    ├── AppStrings.kt
    ├── LocalizationManager.kt
    ├── ApiMessageDisplay.kt
    ├── GameEndReason.kt
    ├── RoomLobbyStatus.kt
    └── SpectatorPayload.kt
```

---

## 20. PATRONES TÉCNICOS CLAVE

| Patrón | Descripción |
|--------|-------------|
| Single-flight token refresh | Solo un refresh a la vez; requests concurrentes esperan el mismo `Deferred` |
| Socket token fallback | Si el token expira durante el juego, el socket refresca y reconecta |
| Optimistic UI en lobby | La sala aparece inmediatamente al crearla; socket confirma |
| Spectator-aware UI | Paths de UI separados para jugadores vs espectadores (sin botones de acción) |
| Message polymorphism | API puede devolver prose en inglés o keys; UI mapea ambos a claves de localización |
| Type-safe routing | Nav args con `NavType` (IntType, StringType, etc.) |

---

## 21. INTEGRACIONES EXTERNAS

| Servicio | Uso |
|---------|-----|
| Google Sign-In (Credentials API) | Autenticación principal |
| Crypto networks | Depósitos off-app vía QR (servidor administra las wallets) |
| Email/SMS OTP | Entregado por el servidor para verificar retiros |
