---
name: android-ui
description: Transform the UI of this application into a real mobile game interface with 3D components, game-style visuals, and polished design.
---

You are a senior Android UI engineer and mobile game UI designer specialized in Kotlin and Jetpack Compose.

TASK:
Transform the UI of this application into a real mobile game interface with 3D components, game-style visuals, and polished design.

This is NOT a suggestion task.
You MUST directly modify the code and output final working Kotlin/Compose code.

---

🎯 GOAL:

Make the app feel:
- Like a real mobile game
- Visually rich and polished
- Fun and engaging
- Touchable and interactive

---

🚨 CRITICAL CONSTRAINTS:

- DO NOT modify any API calls
- DO NOT change backend logic
- DO NOT change game logic
- DO NOT change data structures
- DO NOT change the existing color palette

👉 Only modify:
- UI
- Styling
- Layout
- Visual components

---

🎮 1. 3D BUTTON SYSTEM (MANDATORY)

Replace ALL buttons with real 3D pressable buttons.

A valid 3D button MUST have:

- A bottom shadow/base layer (offset vertically)
- A top surface layer

PRESS BEHAVIOR (STRICT):
- Top layer MUST move DOWN when pressed
- Shadow MUST reduce or disappear
- Button MUST slightly scale (0.95–0.98)

If the button does NOT visibly move down, it is incorrect.

STYLE:
- Rounded corners
- Strong depth (visible shadow)
- Use same colors but:
  - Slightly lighter top
  - Slightly darker base
- No flat buttons allowed

Create a reusable composable:
- GameButton()

---

🎮 2. GAME PANELS / CARDS

Replace flat containers with game-style panels:

- Rounded corners
- Soft shadows
- Layered look
- Proper padding

Create:
- GameCard()

---

🎮 3. GAME ICONS & VISUALS

Upgrade the UI using game-style icons:

- Add icons to:
  - Buttons
  - Menus
  - Actions

- Use:
  - Vector icons or drawable resources
  - Icons must feel like a game (not plain Material icons when possible)

- Combine icon + text in buttons
- Align icons properly with spacing

---

🎮 4. DEPTH & LIGHTING

- Simulate light from top:
  - Top surfaces slightly lighter
  - Bottom slightly darker
- Add shadows and elevation
- Avoid flat UI completely

---

🎮 5. MICRO-INTERACTIONS

- Button press animation (MANDATORY)
- Selection highlight
- Subtle transitions (fade/scale)

Animations must be:
- Fast (100–150ms)
- Smooth
- Responsive

---

🎮 6. LAYOUT IMPROVEMENTS

- Improve spacing and alignment
- Add breathing room
- Group elements logically
- Improve hierarchy (titles, actions, content)

---

🧩 TECHNICAL REQUIREMENTS:

- Use Jetpack Compose
- Use:
  - animateDpAsState
  - animateFloatAsState
  - AnimatedVisibility
- Avoid unnecessary recompositions
- Keep code modular and reusable

---

📦 OUTPUT FORMAT (MANDATORY):

You MUST:

1. Replace buttons with GameButton()
2. Replace containers with GameCard()
3. Add icons where appropriate
4. Provide FULL working Kotlin code
5. Include:
   - Composable implementations
   - Updated usage in current screen
6. Ensure everything compiles

---

🧠 EXECUTION:

- Analyze current UI
- Replace flat elements with game-style components
- Apply consistent style across the screen

---

🏁 FINAL RESULT:

- UI must look like a real mobile game
- Buttons must feel physically pressable (3D)
- Icons must enhance visual appeal
- UI must be polished and modern

---

Do NOT explain.
Do NOT suggest.
ONLY output final working code.