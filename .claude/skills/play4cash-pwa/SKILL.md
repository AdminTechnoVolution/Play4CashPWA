# Play4Cash PWA — Referencia Completa de la Aplicación Web

> **Fuente de verdad** para la PWA en React/TypeScript. Consulta este skill antes de cualquier cambio para evitar romper funcionalidades existentes.

---

## 1. STACK TECNOLÓGICO

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | React | 18.3.1 |
| Lenguaje | TypeScript | 5.6.3 |
| Build | Vite | 6.0.3 |
| UI Components | Ionic React | 8.3.0 |
| Iconografía | Ionicons | 7.4.0 |
| Estado global | Zustand | 5.0.2 |
| HTTP | Axios | 1.7.9 |
| WebSocket | Socket.IO client | 4.8.3 |
| Routing | React Router DOM | 6.28.0 |
| Auth | @react-oauth/google | 0.12.1 |
| PWA | vite-plugin-pwa + Workbox | 0.21.1 |
| i18n | JSON files + t() custom | — |
| QR | qrcode.react | 4.2.0 |
| JWT | jwt-decode | 4.0.0 |

---

## 2. CONFIGURACIÓN Y ENTORNO

**Variables de entorno (.env):**
```
VITE_API_URL=https://api.play4cash.net
VITE_GOOGLE_CLIENT_ID=181290647568-...
```

**api.config.ts — Constantes críticas:**
```typescript
BASE_URL = import.meta.env.VITE_API_URL || 'https://api.play4cash.net'
SOCKET_TIMEOUT_MS = 20_000
REQUEST_TIMEOUT_MS = 180_000
TOKEN_LEEWAY_S = 60
MAX_RETRIES = 2
```

**vite.config.ts — PWA:**
- `registerType: 'autoUpdate'`
- `theme_color: '#0a1628'`, `display: 'standalone'`
- Cache API con `NetworkFirst`, TTL 300s
- Puerto dev: 3000

**index.html — Meta tags mobile:**
```html
<meta name="theme-color" content="#0a1628" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

---

## 3. ARQUITECTURA

```
src/
├── config/          → api.config.ts (URLs, timeouts, constantes)
├── data/
│   ├── auth/        → AuthSessionStore.ts (JWT, tokens, localStorage)
│   ├── models/      → ApiModels.ts (interfaces TypeScript de la API)
│   └── network/     → ApiClient, ApiService, ApiRepository + Socket Managers
├── hooks/           → useNetworkConnection.ts
├── i18n/            → JSON por idioma + languageStore (Zustand) + t()
├── pages/           → Una carpeta por pantalla
├── store/           → Zustand stores por dominio
├── ui/
│   ├── components/  → Componentes reutilizables globales
│   ├── game/        → GameSound, GameVibration, TurnTimeoutAlarm
│   └── theme/       → variables.css (CSS custom properties del sistema Sovereign)
├── util/            → helpers, formatCurrency, routingStorage, etc.
├── App.tsx          → Raíz: BrowserRouter + Routes + GoogleOAuthProvider
└── main.tsx         → Entry point
```

**Capas de datos:**
1. `ApiClient.ts` — Axios con interceptores (auth header + refresh automático)
2. `ApiService.ts` — Métodos HTTP específicos de cada endpoint
3. `ApiRepository.ts` — Caché de 30s sobre `ApiService` (ej. `getCachedUserAccount()`)
4. Socket Managers — Socket.IO por juego, ciclo de vida gestionado desde stores

---

## 4. SISTEMA DE RUTAS (React Router v6)

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/login` | `LoginPage` | OAuth Google |
| `/dashboard` | `DashboardPage` | Pantalla principal |
| `/rooms/:gameSocketCode` | `RoomsPage` | Lobby de salas |
| `/play/:gameSocketCode` | `PlayPage` → dispatch | Contenedor de juego |
| `/add-funds` | `AddFundsPage` | Depósito de cripto |
| `/withdrawal` | `WithdrawalPage` | Retiro |
| `/withdrawal-verify` | `WithdrawalVerifyPage` | 2FA del retiro |
| `/history` | `TransactionHistoryPage` | Historial |
| `/settings` | `SettingsPage` | Configuración |
| `/terms` | `TermsPage` | Términos |
| `/privacy` | `PrivacyPage` | Privacidad |
| `/data-treatment` | `DataTreatmentPage` | Tratamiento de datos |
| `/` y `*` | `<Navigate>` | Redirige a dashboard o login |

**PlayPage dispatch dinámico** (por `gameSocketCode`):
- `chess` → `ChessPage`
- `domino` → `DominoPage`
- `halma` → `HalmaPage`
- default → `BattleshipPage`

**routingStorage.ts:** guarda contexto de sala en `sessionStorage` para no perder datos en navegación.

---

## 5. AUTENTICACIÓN

**Flujo completo:**
1. `LoginPage` → Google OAuth widget (`@react-oauth/google`)
2. `idToken` → `authStore.signInWithGoogle(idToken)`
3. `POST /api/login { token: idToken }` → `{ token: JWT, refreshToken }`
4. Tokens + cuenta guardados en `localStorage`
5. `navigate('/dashboard')`

**localStorage keys:**
```
p4c_access_token    → JWT
p4c_refresh_token   → Refresh token
p4c_user_account    → JSON de UserAccountResponse
p4c_language        → "es" | "en" | "fr" | "de" | "it" | "pt"
```

**Renovación automática:**
- `App.tsx` llama `loadSession()` en mount
- JWT expirado con refresh disponible → renueva silenciosamente
- Si falla refresh → evento DOM `p4c:auth-failure` → logout automático
- Interceptor Axios: 401 → intenta refresh → reintenta request original

**Leeway:** 60s antes de considerar token expirado

---

## 6. ZUSTAND STORES

### authStore (`src/store/authStore.ts`)
```typescript
state: {
  user: UserAccountResponse | null
  isLoading: boolean
  error: string | null
}
actions: signInWithGoogle(idToken), loadSession(), logout(), clearError()
```

### dashboardStore (`src/store/dashboardStore.ts`)
```typescript
state: {
  account: UserAccountResponse | null
  games: GameResponse[]
  roomStats: RoomStatsResponse | null
  isLoading: boolean
  error: string | null
}
actions: loadDashboard(), refreshAccount(), clearError()
```

### roomsStore (`src/store/roomsStore.ts`)
```typescript
state: {
  rooms: RoomResponse[]
  isLoading: boolean
  error: string | null
  showCreateDialog: boolean
  currentGameId: string | null
}
actions: loadRooms(gameId), createRoom(req), joinRoom(id), spectateRoom(id),
         addOrUpdateRoom(room), updateRoom(room), removeRoom(roomId)
```

### battleshipStore (`src/store/battleshipStore.ts`)
```typescript
state: {
  phase: 'placement' | 'waiting' | 'battle' | 'finished'
  playerBoard: BattleshipCell[][]   // 10×10
  opponentBoard: BattleshipCell[][]
  placedShips: PlacedShip[]
  selectedShipType: ShipType | null
  isHorizontal: boolean
  isMyTurn: boolean
  gameOver: GameOverPayload | null
  spectatorsCount: number
  // + 35 campos adicionales de turno, animación, resultado
}
actions: initGame(), selectShipType(), placeShipAt(), submitPlacement(),
         fire(), cleanup()
```

### chessStore (`src/store/chessStore.ts`)
```typescript
state: {
  phase: ChessPhase  // WAITING | PLAY | GAME_OVER
  board: ChessCell[][]   // 8×8
  isPlayerTurn: boolean
  isPlayerWhite: boolean
  validMoves: ChessMove[]
  promotionPending: ChessMove | null
  castlingAvailable: { kingSide: boolean, queenSide: boolean }
  turnTimeLeft: number
}
actions: initGame(), onCellTap(row, col, roomId), playCastling(),
         onPromotionSelected(), cleanup()
```

### dominoStore (`src/store/dominoStore.ts`)
- Mano del jugador, tren del tablero (extremos L/R), boneyard, contrincantes
- Acciones: initGame, playTile(tile, side), drawTile, passTurn, cleanup

### halmaStore (`src/store/halmaStore.ts`)
- Tablero 8×8, movimientos válidos, trail de saltos, estado de turno
- Acciones: initGame, onCellTap, endTurn, cleanup

### pwaInstallStore (`src/store/pwaInstallStore.ts`)
```typescript
state: {
  deferredPrompt: BeforeInstallPromptEvent | null
  isInstallable: boolean
  isIOSSafari: boolean
  isInstalled: boolean
}
actions: setDeferredPrompt(e), triggerInstall(), dismiss()
```

### languageStore (`src/i18n/languageStore.ts`)
- `currentLanguage: string` — sincronizado con `localStorage['p4c_language']`

---

## 7. CAPA DE RED (HTTP + WebSockets)

### Endpoints REST
```
POST   /api/login                           Login Google
POST   /api/login/refresh                   Refresh JWT
POST   /api/logout                          Logout
GET    /api/user/account                    Cuenta + balance
GET    /api/games                           Juegos disponibles
GET    /api/greetings                       Frases de chat
GET    /api/rooms/stats                     Estadísticas en vivo
GET    /api/rooms/game/{gameId}             Salas de un juego
POST   /api/rooms                           Crear sala
POST   /api/rooms/{id}/join                 Unirse como jugador
POST   /api/rooms/{id}/spectate             Unirse como espectador
POST   /api/rooms/{id}/leave                Salir del lobby
GET    /api/rooms/{id}/status              Polling de estado de sala
POST   /api/rooms/{id}/battleship/placement Enviar placement de barcos
GET    /api/wallets                         Redes de retiro disponibles
POST   /api/user/register-wallet            Guardar wallet
POST   /api/transactions/recharge           Depósito
POST   /api/transactions/withdrawal         Retiro
POST   /api/transactions/verify-withdrawal  OTP del retiro
GET    /api/transactions/recharge/history   Historial depósitos
GET    /api/transactions/withdrawal/history Historial retiros
GET    /api/user/history                    Historial de partidas
```

### Socket Managers (Socket.IO)
| Manager | Namespace | Eventos emitidos | Uso |
|---------|-----------|-----------------|-----|
| `LobbySocketManager` | `/rooms` | — | `roomCreated/Updated/Deleted` |
| `BattleshipSocketManager` | `/naval-battle` | `fire {room_id, row, col}` | Estado de batalla |
| `ChessSocketManager` | `/chess` | `move {room_id, from, to, promotion?}` | Movimientos |
| `DominoSocketManager` | `/domino` | `move {tile, side}`, `draw`, `pass` | Juego dominó |
| `HalmaSocketManager` | `/halma` | `move {room_id, from_row, from_col, to_row, to_col}`, `end_turn` | Movimientos |
| `ChatSocketManager` | `/chat` | `greeting {room_id, greeting_id}` | Chat rápido |

**Autenticación socket:** Bearer token en header + query string `?token=`
**Reconexión:** backoff 1–5s, reintentos ilimitados

---

## 8. BRANDING Y SISTEMA DE DISEÑO — "SOVEREIGN"

> **Regla crítica:** Los colores y tokens del sistema Sovereign NO se modifican.

### Paleta de colores (CSS Custom Properties en `src/ui/theme/variables.css`)

| Token | Valor | Uso |
|-------|-------|-----|
| `--sovereign-bg` | `#152A3F` | Fondo oscuro principal |
| `--sovereign-surface` | `#1e3650` | Superficies secundarias (cards, items) |
| `--sovereign-surface-high` | `#244161` | Superficies elevadas (modales) |
| `--sovereign-gold` | `#E9C349` | Color primario / acentos / botones |
| `--sovereign-gold-light` | `#e8c96e` | Gold hover states |
| `--sovereign-text` | `#ffffff` | Texto principal |
| `--sovereign-text-muted` | `#8a9bbf` | Texto secundario / placeholders |
| `--sovereign-error` | `#cf6679` | Estados de error |
| `--sovereign-border` | `rgba(201,168,76,0.25)` | Bordes con tinte dorado |

**Ionic overrides (variables.css):**
```css
--ion-color-primary: #E9C349
--ion-text-color: #ffffff
--ion-toolbar-background: #152A3F
--ion-item-background: #1e3650
--ion-card-background: #1e3650
```

**Tema de la app:**
- `theme-color` meta: `#0a1628`
- Fondo desktop: `/bg_app_play4cash.png`
- Fondo mobile: `/bg_app_play4cash_mobile.png`
- Overlay gradiente oscuro (~85% opacidad) sobre fondos

### Tipografía
- Fuente del sistema (no custom font importada)
- Títulos y botones: peso 600–700
- Tamaño botones: 15px
- Headings (`h1`–`h6`): color `var(--sovereign-gold)` = `#E9C349`

### Animaciones CSS definidas
- `@keyframes gradientShift` — animación de gradiente
- `@keyframes fadeInUp` — fade in con traslación vertical
- `@keyframes pulse` — pulso de atención
- `@keyframes slideUp` — deslizamiento hacia arriba

---

## 9. COMPONENTES REUTILIZABLES

### `src/ui/components/`

**SovereignButton.tsx**
- `SovereignPrimaryButton` — fondo dorado, texto oscuro
- `SovereignSecondaryButton` — outline dorado, texto dorado
- `SovereignDangerButton` — rojo
- Props: `loading`, `disabled`, `expand`, `onClick`, `style`, `children`
- **Regla:** Siempre usar estos botones en lugar de botones Ionic crudos

**GenericErrorModal.tsx**
- Modal de error reutilizable
- Se alimenta de `apiErrorRawMessage` del store correspondiente
- Botón "Cerrar" y "Reintentar"

**PWAInstallBanner.tsx**
- Detecta iOS Safari vs Android Chrome
- Gestiona `BeforeInstallPromptEvent`
- Muestra instrucciones específicas por plataforma

**ConnectionStrengthIndicator.tsx**
- Indicador visual de estado de conexión
- Monitorea latencia de WebSocket y API

### `src/ui/game/`
- `GameSound.ts` — efectos de audio en juegos
- `GameVibration.ts` — hápticos/vibración
- `turnTimeoutAlarm.ts` — alarma cuando se agota el tiempo del turno

---

## 10. PANTALLAS — FUNCIONES Y COMPORTAMIENTOS

### LoginPage (`/login`)
- Google OAuth widget
- Links a Términos y Privacidad
- Redirige a `/dashboard` post-auth
- Si ya hay sesión válida → redirige automáticamente

### DashboardPage (`/dashboard`)
- Balance del usuario
- Lista de juegos (`GameResponse[]`) con GameCards
- Stats en vivo: jugadores online, partidas activas, total apostado
- Botones: Add Funds, Withdrawal, History, Settings
- Al tocar juego → `/rooms/:gameSocketCode`

### RoomsPage (`/rooms/:gameSocketCode`)
- Lista de salas con LobbySocketManager (tiempo real)
- Filtros: Todas / Esperando / En juego
- Crear sala (nombre, apuesta, límite de jugadores)
- Unirse como jugador (`POST /api/rooms/{id}/join`)
- Espectar (`POST /api/rooms/{id}/spectate`)
- Al unirse → `navigate('/play/:gameSocketCode')`

### PlayPage (`/play/:gameSocketCode`)
- Lee `gameSocketCode` del param URL
- Despacha al componente correcto (Chess, Battleship, Domino, Halma)
- Maneja `roomLeavePrecheck` (diálogo de confirmación al intentar salir)

### BattleshipPage
**Fase PLACEMENT:**
- Grid 10×10 para colocar 5 barcos: Carrier(5), Battleship(4), Cruiser(3), Submarine(3), Destroyer(2)
- Rotación horizontal/vertical
- Validación: sin solapamiento, dentro del grid
- `submitPlacement()` → `POST /api/rooms/{id}/battleship/placement`

**Fase WAITING:**
- Polling cada 10s a `getRoomStatus()`
- Transición a BATTLE cuando ambos jugadores confirmaron

**Fase BATTLE:**
- 2 grids: flota propia (abajo) + grid enemigo (arriba)
- Timer de turno por jugador
- Click en celda enemiga → `fire(row, col)`
- Resultados: hit / miss / sunk con animaciones y toasts
- Turnos alternados

**Fase FINISHED:** GameOverModal con resultado y premio

### ChessPage
- Tablero 8×8, rotado según color del jugador (blancas abajo)
- Selección de pieza → resaltado de movimientos válidos
- Enroque (hint banner cuando disponible)
- Promoción de peón (diálogo de selección)
- Chat rápido de saludos
- Detección: jaque, jaque mate, ahogado

### DominoPage
- Mano del jugador + tren del tablero
- Jugadores: 2 o 4
- Acciones: jugar ficha, robar del boneyard, pasar
- Validación de movimientos (coincidencia con extremos L/R del tren)

### HalmaPage
- Tablero 8×8 estilo damas
- Movimientos: deslizamiento diagonal o salto múltiple encadenado
- Puede saltar sobre piezas propias y enemigas (incluyendo hacia atrás)
- `end_turn` manual o automático si no hay más saltos disponibles

### AddFundsPage (`/add-funds`)
- Dropdown selección de red/coin
- QR de dirección de depósito del servidor
- Input de monto y txId tras transferir externamente
- `POST /api/transactions/recharge`

### WithdrawalPage (`/withdrawal`)
- Input de monto
- Validación: >= minAmount, <= balance, <= límite diario
- `POST /api/transactions/withdrawal` → navega a `/withdrawal-verify`

### WithdrawalVerifyPage (`/withdrawal-verify`)
- Input 6 dígitos OTP (email/SMS del servidor)
- `POST /api/transactions/verify-withdrawal`

### SettingsPage (`/settings`)
- Dirección de wallet (input + guardar)
- Selector de red de retiro
- `POST /api/user/register-wallet`
- Selector de idioma (6 opciones)

### TransactionHistoryPage (`/history`)
- Tabs: Depósitos / Retiros / Partidas
- Historial de operaciones financieras y juegos

---

## 11. MODO ESPECTADOR

- Entrada: `POST /api/rooms/{id}/spectate`
- Sin apuesta descontada
- UI: ambos tableros visibles, sin controles de acción
- `SpectatorPayload` marca la sesión como read-only
- Badge de espectador visible en pantalla de juego
- `spectatorsCount` mostrado en tiempo real
- Al terminar la partida → redirige automáticamente a `/rooms`

---

## 12. SISTEMA DE PAGOS (CRIPTO)

### Depósito
1. `GET /api/wallets` → coin, address, minAmount, fee, network
2. QR con dirección del servidor
3. Usuario transfiere externamente
4. Usuario ingresa txId
5. `POST /api/transactions/recharge`

### Retiro
1. Validar balance y límite diario desde `UserAccountResponse.limits.dailyWithdrawal`
2. `POST /api/transactions/withdrawal` → servidor envía OTP
3. Usuario ingresa OTP en `/withdrawal-verify`
4. `POST /api/transactions/verify-withdrawal`

### Apuestas
- Descontadas al crear/unirse a sala
- Premio acreditado al ganar
- Reembolso automático si oponente abandona o timeout

---

## 13. CHAT EN PARTIDA

- `GET /api/greetings` → lista de frases predefinidas
- Chips de saludo en UI de juego
- Al tocar → `socket emit 'greeting' { room_id, greeting_id }` en namespace `/chat`
- Servidor traduce según `Accept-Language` del receptor
- Banner temporal en pantalla del receptor

---

## 14. FIN DE PARTIDA

### Condiciones
| Juego | Condición de fin |
|-------|-----------------|
| Battleship | Todos los barcos del oponente hundidos |
| Chess | Jaque mate, ahogado, material insuficiente, timeout |
| Domino | Mano vacía / todos los jugadores pasan |
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

`GameOverModal` muestra resultado + premio. Opciones: volver a Dashboard o ir a Historial.

---

## 15. INTERNACIONALIZACIÓN

- **6 idiomas:** es, en, fr, de, it, pt
- Archivos JSON en `src/i18n/`
- Función `t(key)` desde `src/i18n/translations.ts`
- Header HTTP `Accept-Language` enviado en cada request
- Persistido en `localStorage['p4c_language']`
- `languageStore` (Zustand) para reactividad en UI
- `ApiMessageDisplay.ts` mapea mensajes del API a claves de localización

---

## 16. PWA

- **Service Worker:** Workbox con `autoUpdate`
- **Cache API:** NetworkFirst, TTL 300s
- **Instalación:** Banner `PWAInstallBanner.tsx`
  - Android/Chrome: usa `BeforeInstallPromptEvent`
  - iOS Safari: instrucciones manuales de "Agregar a pantalla de inicio"
- **`pwaInstallStore`** gestiona el estado de instalación
- **Manifest:** `public/manifest.webmanifest` con íconos e iconos Apple

---

## 17. MODELOS DE DATOS PRINCIPALES (ApiModels.ts)

```typescript
// Autenticación
interface LoginResponse { token: string; refreshToken: string }
interface UserAccountResponse {
  id: string; email: string; username: string; balance: number
  totalRecharged: number; totalWithdrawal: number; totalWon: number
  status: string; walletAddress: string; wallet: string
  limits: { dailyWithdrawal: number }
}

// Juegos y Salas
interface GameResponse { id: string; name: string; minBet: number; socketCode: string; turnTimer: number }
interface RoomResponse { id: string; name: string; players: Player[]; betAmount: number; status: string; spectatorsCount: number; playerLimit: number }
interface RoomStatsResponse { activePlayers: number; activeRooms: number; totalBetAmount: number }
interface RoomStatusResponse { playerCount: number; currentPlayer: string; winner: string | null }

// Transacciones
interface WalletResponse { coin: string; address: string; minAmount: number; fee: number; network: string }
interface RechargeHistoryItem { id: string; amount: number; txId: string; status: string; createdAt: string }
interface WithdrawalHistoryItem { id: string; amount: number; address: string; network: string; status: string; createdAt: string }
interface GameHistoryItem { id: string; opponent: string; result: string; prize: number; finishedAt: string; gameName: string }

// Requests
interface CreateRoomRequest { gameId: string; betAmount: number; playerLimit: number; name?: string }
interface RechargeRequest { txId: string; amount: number; coin: string }
interface WithdrawalRequest { amount: number; walletAddress: string; network: string }
interface VerifyWithdrawalRequest { code: string }
interface BattleshipPlacementRequest { ships: ShipPlacement[] }
```

---

## 18. PATRONES TÉCNICOS CLAVE

| Patrón | Descripción |
|--------|-------------|
| Single-flight token refresh | Solo un refresh a la vez via Axios interceptor |
| Socket token fallback | Si el socket recibe 401, refresca y reconecta |
| Caché de cuenta | `ApiRepository.getCachedUserAccount()`, TTL 30s |
| Spectator-aware UI | Todos los juegos tienen paths separados para espectadores (sin controles) |
| Dispatch dinámico de juegos | `PlayPage` usa `gameSocketCode` param para renderizar el juego correcto |
| Session storage routing | Contexto de sala en `sessionStorage` vía `routingStorage.ts` para no perder datos |
| Message polymorphism | API devuelve prose o keys; `ApiMessageDisplay.ts` los mapea a i18n |
| Optimistic UI en lobby | Sala aparece inmediato; socket confirma |

---

## 19. REGLAS PARA NO ROMPER NADA

1. **Colores:** No cambiar los tokens CSS `--sovereign-*` ni `--ion-color-primary`. Usar siempre variables CSS, nunca valores hardcodeados.
2. **Botones:** Usar `SovereignPrimaryButton`, `SovereignSecondaryButton`, `SovereignDangerButton`. No crear botones nuevos sin alinearlos al sistema.
3. **Stores Zustand:** No mutar estado directamente — usar las acciones del store. El `cleanup()` de cada juego es obligatorio al salir.
4. **Routing:** Las rutas usan `sessionStorage` para contexto. Si se añade una nueva ruta con parámetros, registrarla en `routingStorage.ts`.
5. **i18n:** Nunca texto hardcodeado visible al usuario. Siempre usar `t('clave')`. Agregar la clave en los 6 archivos JSON.
6. **Auth:** No acceder a `localStorage` directamente para tokens — usar `AuthSessionStore`. No modificar los interceptores de Axios sin verificar el flujo de refresh.
7. **Sockets:** Cada socket manager tiene un ciclo de vida claro — conectar en `init`, desconectar en `cleanup`. No compartir instancias entre stores.
8. **PWA:** No modificar el manifest ni el Service Worker sin verificar compatibilidad iOS.
9. **Modelos:** Los campos de `UserAccountResponse` (especialmente `balance` y `limits.dailyWithdrawal`) son usados en múltiples pantallas. Cambiar un campo rompe Withdrawal, Dashboard y Settings.
10. **Spectator mode:** Toda nueva funcionalidad de juego debe verificar `isSpectator` y denegar la acción si aplica.
