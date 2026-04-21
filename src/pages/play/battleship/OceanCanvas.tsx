import React, { useEffect, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface WhaleSpec  { phaseShift: number; speed: number; yFrac: number; lengthFrac: number; direction: number }
interface SharkSpec  { phaseShift: number; speed: number; yFrac: number; lengthFrac: number; direction: number }
interface BubbleSpec { xFrac: number; speed: number; phase: number; size: number }

// ── Constants ─────────────────────────────────────────────────────────────────
const WHALE_SPECS: WhaleSpec[] = [
  { phaseShift: 0.4, speed: 0.085, yFrac: 0.62, lengthFrac: 0.46, direction: 1 },
  { phaseShift: 2.3, speed: 0.065, yFrac: 0.80, lengthFrac: 0.38, direction: 1 },
  { phaseShift: 4.1, speed: 0.078, yFrac: 0.50, lengthFrac: 0.40, direction: 1 },
];

const SHARK_SPECS: SharkSpec[] = [
  { phaseShift: 1.8, speed: 0.140, yFrac: 0.36, lengthFrac: 0.22, direction: 1 },
  { phaseShift: 5.2, speed: 0.115, yFrac: 0.60, lengthFrac: 0.18, direction: 1 },
];

const BUBBLE_SPECS: BubbleSpec[] = [
  { xFrac: 0.15, speed: 0.018, phase: 0.0,  size: 3 },
  { xFrac: 0.42, speed: 0.022, phase: 0.6,  size: 2 },
  { xFrac: 0.68, speed: 0.016, phase: 1.4,  size: 4 },
  { xFrac: 0.83, speed: 0.020, phase: 2.2,  size: 2 },
  { xFrac: 0.28, speed: 0.025, phase: 3.5,  size: 3 },
  { xFrac: 0.57, speed: 0.019, phase: 4.8,  size: 2 },
];

const CYCLE_MS = 18_000;

// ── Ocean background ──────────────────────────────────────────────────────────
function drawOcean(
  ctx: CanvasRenderingContext2D,
  gw: number,
  gh: number,
  phase: number,
): void {
  // Deep gradient
  const grad = ctx.createLinearGradient(0, 0, 0, gh);
  grad.addColorStop(0,    '#0e2840');
  grad.addColorStop(0.35, '#071828');
  grad.addColorStop(0.75, '#040e1c');
  grad.addColorStop(1,    '#020912');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, gw, gh);

  // Subtle drifting light shafts from the surface
  ctx.save();
  ctx.globalAlpha = 0.028;
  const shaftCount = 5;
  for (let i = 0; i < shaftCount; i++) {
    const drift = Math.sin(phase * 0.18 + i * 1.35) * gw * 0.04;
    const bx    = gw * (0.08 + i * 0.20) + drift;
    const spread = gw * 0.055;
    const sg = ctx.createLinearGradient(bx, 0, bx + spread * 0.4, gh * 0.65);
    sg.addColorStop(0, 'rgba(120, 200, 255, 1)');
    sg.addColorStop(1, 'rgba(120, 200, 255, 0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(bx - spread * 0.15, 0);
    ctx.lineTo(bx + spread * 1.1, gh * 0.65);
    ctx.lineTo(bx + spread * 0.85, gh * 0.65);
    ctx.lineTo(bx + spread * 0.2, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ── Bubbles ───────────────────────────────────────────────────────────────────
function drawBubbles(
  ctx: CanvasRenderingContext2D,
  elapsed: number,
  gw: number,
  gh: number,
): void {
  ctx.save();
  for (const b of BUBBLE_SPECS) {
    const t    = (elapsed * b.speed + b.phase * 200) % (gh * 1.3);
    const y    = gh + b.size - t;
    const x    = b.xFrac * gw + Math.sin(elapsed * 0.001 * 0.9 + b.phase) * 8;
    const alp  = Math.min(1, (gh - y) / (gh * 0.3)) * 0.35;
    if (alp <= 0) continue;
    ctx.globalAlpha = alp;
    ctx.beginPath();
    ctx.arc(x, y, b.size, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(160, 210, 235, 0.8)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // Glint
    ctx.beginPath();
    ctx.arc(x - b.size * 0.3, y - b.size * 0.3, b.size * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(220, 240, 250, 0.6)';
    ctx.fill();
  }
  ctx.restore();
}

// ── Sea floor: sand + pebbles ─────────────────────────────────────────────────
function drawSeaFloor(
  ctx: CanvasRenderingContext2D,
  gw: number,
  gh: number,
): void {
  const fy = gh * 0.82;  // floor Y

  // ── Sand gradient ─────────────────────────────────────────────────────────
  const sg = ctx.createLinearGradient(0, fy, 0, gh);
  sg.addColorStop(0,    'rgba(0,0,0,0)');
  sg.addColorStop(0.18, 'rgba(150, 118, 58, 0.30)');
  sg.addColorStop(0.60, 'rgba(140, 110, 52, 0.56)');
  sg.addColorStop(1,    'rgba(122, 96, 44, 0.70)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, fy, gw, gh - fy);

  // Sand surface undulation
  ctx.beginPath();
  ctx.moveTo(0, fy);
  for (let x = 0; x <= gw; x += 3) {
    ctx.lineTo(x, fy + Math.sin(x * 0.022) * gh * 0.010 + Math.cos(x * 0.057) * gh * 0.005);
  }
  ctx.lineTo(gw, gh);
  ctx.lineTo(0, gh);
  ctx.closePath();
  const sg2 = ctx.createLinearGradient(0, fy, 0, gh);
  sg2.addColorStop(0, 'rgba(172, 140, 72, 0.16)');
  sg2.addColorStop(1, 'rgba(138, 108, 52, 0.28)');
  ctx.fillStyle = sg2;
  ctx.fill();

  // Sand ripple lines
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const ry = fy + (gh - fy) * (0.12 + i * 0.19);
    ctx.beginPath();
    for (let x = 0; x <= gw; x += 4) {
      const y = ry + Math.sin(x * 0.038 + i * 1.15) * gh * 0.005;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(195, 162, 82, 0.13)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }
  ctx.restore();

  // Small rocks / pebbles
  const rocks = [
    { xf: 0.04, yf: 0.946, rx: 1.5, ry2: 0.9 },
    { xf: 0.27, yf: 0.930, rx: 1.2, ry2: 0.7 },
    { xf: 0.48, yf: 0.950, rx: 1.4, ry2: 0.8 },
    { xf: 0.65, yf: 0.935, rx: 1.0, ry2: 0.6 },
    { xf: 0.88, yf: 0.944, rx: 1.3, ry2: 0.75 },
  ];
  rocks.forEach(({ xf, yf, rx, ry2 }) => {
    const rr = gh * 0.014 * rx;
    ctx.beginPath();
    ctx.ellipse(xf * gw, yf * gh, rr, rr * ry2 * 0.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(76, 60, 38, 0.55)';
    ctx.fill();
    // highlight
    ctx.beginPath();
    ctx.ellipse(xf * gw - rr * 0.2, yf * gh - rr * 0.25, rr * 0.5, rr * 0.28, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(115, 92, 58, 0.38)';
    ctx.fill();
  });
}

// ── Whale (humpback-style) ────────────────────────────────────────────────────
function drawWhale(
  ctx: CanvasRenderingContext2D,
  elapsedS: number,
  spec: WhaleSpec,
  gw: number,
  gh: number,
): void {
  const span    = gw * 1.5;
  const travel  = ((elapsedS * spec.speed * gw * 0.35 + spec.phaseShift * span) % span + span) % span;
  const baseX   = travel - gw * 0.25;
  const bobY    = Math.sin(elapsedS * 0.55 + spec.phaseShift * 2) * gh * 0.018;
  const tailWag = Math.sin(elapsedS * 2.4  + spec.phaseShift) * 0.14;
  const cy      = spec.yFrac * gh + bobY;
  const wLen    = spec.lengthFrac * gw;
  const wH      = wLen * 0.22;

  ctx.save();
  ctx.translate(baseX, cy);
  if (spec.direction < 0) ctx.scale(-1, 1);

  // Body gradient
  const bg = ctx.createLinearGradient(0, -wH * 0.6, 0, wH * 0.5);
  bg.addColorStop(0,   'rgba(14, 30, 48, 0.92)');
  bg.addColorStop(0.5, 'rgba(26, 52, 74, 0.88)');
  bg.addColorStop(1,   'rgba(58, 88, 108, 0.72)');

  // Main body — humpback silhouette
  ctx.beginPath();
  ctx.moveTo( wLen * 0.40,  wH * 0.04);             // snout
  ctx.bezierCurveTo( wLen * 0.40, -wH * 0.62,  wLen * 0.08, -wH * 0.70, -wLen * 0.06, -wH * 0.58);
  ctx.bezierCurveTo(-wLen * 0.22, -wH * 0.44, -wLen * 0.36, -wH * 0.28, -wLen * 0.48, -wH * 0.10);
  ctx.lineTo(-wLen * 0.50, 0);
  ctx.bezierCurveTo(-wLen * 0.34,  wH * 0.40,  wLen * 0.05,  wH * 0.44,  wLen * 0.40,  wH * 0.10);
  ctx.closePath();
  ctx.fillStyle = bg;
  ctx.fill();

  // Belly patch (lighter ventral groove area)
  const bellyG = ctx.createRadialGradient(wLen * 0.08, wH * 0.26, 0, wLen * 0.08, wH * 0.26, wLen * 0.26);
  bellyG.addColorStop(0, 'rgba(195, 215, 225, 0.20)');
  bellyG.addColorStop(1, 'rgba(195, 215, 225, 0)');
  ctx.beginPath();
  ctx.ellipse(wLen * 0.08, wH * 0.26, wLen * 0.26, wH * 0.19, 0, 0, Math.PI * 2);
  ctx.fillStyle = bellyG;
  ctx.fill();

  // Dorsal fin (rounded humpback hump)
  ctx.beginPath();
  ctx.moveTo(-wLen * 0.02, -wH * 0.56);
  ctx.lineTo(-wLen * 0.08, -wH * 0.98);
  ctx.bezierCurveTo(-wLen * 0.02, -wH * 0.82,  wLen * 0.08, -wH * 0.72,  wLen * 0.12, -wH * 0.56);
  ctx.closePath();
  ctx.fillStyle = 'rgba(12, 26, 42, 0.90)';
  ctx.fill();

  // Pectoral fin
  ctx.beginPath();
  ctx.moveTo( wLen * 0.22,  wH * 0.14);
  ctx.bezierCurveTo( wLen * 0.24,  wH * 0.58,  wLen * 0.06,  wH * 0.72, -wLen * 0.04,  wH * 0.52);
  ctx.bezierCurveTo( wLen * 0.04,  wH * 0.34,  wLen * 0.14,  wH * 0.22,  wLen * 0.22,  wH * 0.14);
  ctx.fillStyle = 'rgba(18, 40, 58, 0.80)';
  ctx.fill();

  // Tail flukes (animated wag)
  ctx.save();
  ctx.translate(-wLen * 0.50, 0);
  ctx.rotate(tailWag);
  // Upper fluke
  ctx.beginPath();
  ctx.moveTo(0,  0);
  ctx.bezierCurveTo(-wLen * 0.06, -wH * 0.22, -wLen * 0.18, -wH * 0.65, -wLen * 0.16, -wH * 0.84);
  ctx.bezierCurveTo(-wLen * 0.08, -wH * 0.60, -wLen * 0.01, -wH * 0.24,  wLen * 0.02, -wH * 0.04);
  // Lower fluke
  ctx.moveTo(0,  0);
  ctx.bezierCurveTo(-wLen * 0.06,  wH * 0.22, -wLen * 0.18,  wH * 0.65, -wLen * 0.16,  wH * 0.84);
  ctx.bezierCurveTo(-wLen * 0.08,  wH * 0.60, -wLen * 0.01,  wH * 0.24,  wLen * 0.02,  wH * 0.04);
  ctx.fillStyle = 'rgba(18, 38, 56, 0.85)';
  ctx.fill();
  ctx.restore();

  // Eye
  ctx.beginPath();
  ctx.arc(wLen * 0.30, -wH * 0.10, wH * 0.080, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(6, 14, 24, 0.92)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(wLen * 0.308, -wH * 0.117, wH * 0.028, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();

  // Subtle mouth line
  ctx.beginPath();
  ctx.moveTo(wLen * 0.40, wH * 0.04);
  ctx.quadraticCurveTo(wLen * 0.38, wH * 0.14, wLen * 0.28, wH * 0.10);
  ctx.strokeStyle = 'rgba(6, 14, 24, 0.55)';
  ctx.lineWidth = wH * 0.045;
  ctx.stroke();

  ctx.restore();
}

// ── Shark ─────────────────────────────────────────────────────────────────────
function drawShark(
  ctx: CanvasRenderingContext2D,
  elapsedS: number,
  spec: SharkSpec,
  gw: number,
  gh: number,
): void {
  const span    = gw * 1.5;
  const travel  = ((elapsedS * spec.speed * gw * 0.35 + spec.phaseShift * span) % span + span) % span;
  const baseX   = travel - gw * 0.25;
  const tailWag = Math.sin(elapsedS * 3.2  + spec.phaseShift) * 0.16;
  const bobY    = Math.sin(elapsedS * 0.42 + spec.phaseShift * 1.6) * gh * 0.010;
  const cy      = spec.yFrac * gh + bobY;
  const sLen    = spec.lengthFrac * gw;
  const sH      = sLen * 0.18;

  ctx.save();
  ctx.translate(baseX, cy);
  if (spec.direction < 0) ctx.scale(-1, 1);

  // Body gradient (dark dorsal → white ventral)
  const bg = ctx.createLinearGradient(0, -sH * 0.55, 0, sH * 0.55);
  bg.addColorStop(0,    'rgba(38, 52, 62, 0.92)');
  bg.addColorStop(0.55, 'rgba(55, 72, 84, 0.86)');
  bg.addColorStop(1,    'rgba(190, 205, 212, 0.78)');

  // Body
  ctx.beginPath();
  ctx.moveTo( sLen * 0.46, -sH * 0.04);              // snout tip
  ctx.bezierCurveTo( sLen * 0.45, -sH * 0.48,  sLen * 0.12, -sH * 0.54, -sLen * 0.24, -sH * 0.36);
  ctx.bezierCurveTo(-sLen * 0.38, -sH * 0.24, -sLen * 0.45, -sH * 0.12, -sLen * 0.47,  sH * 0.06);
  ctx.bezierCurveTo(-sLen * 0.36,  sH * 0.34,  sLen * 0.04,  sH * 0.40,  sLen * 0.46,  sH * 0.10);
  ctx.closePath();
  ctx.fillStyle = bg;
  ctx.fill();

  // Belly highlight
  ctx.beginPath();
  ctx.ellipse(sLen * 0.08, sH * 0.22, sLen * 0.28, sH * 0.14, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(210, 225, 230, 0.22)';
  ctx.fill();

  // Dorsal fin — tall triangle
  ctx.beginPath();
  ctx.moveTo(-sLen * 0.01, -sH * 0.50);
  ctx.lineTo(-sLen * 0.12, -sH * 1.10);
  ctx.bezierCurveTo(-sLen * 0.04, -sH * 0.85,  sLen * 0.08, -sH * 0.68,  sLen * 0.12, -sH * 0.50);
  ctx.closePath();
  ctx.fillStyle = 'rgba(32, 46, 58, 0.92)';
  ctx.fill();

  // Pectoral fin
  ctx.beginPath();
  ctx.moveTo( sLen * 0.18,  sH * 0.10);
  ctx.bezierCurveTo( sLen * 0.20,  sH * 0.56,  sLen * 0.04,  sH * 0.68, -sLen * 0.04,  sH * 0.48);
  ctx.bezierCurveTo( sLen * 0.02,  sH * 0.28,  sLen * 0.10,  sH * 0.14,  sLen * 0.18,  sH * 0.10);
  ctx.fillStyle = 'rgba(40, 55, 66, 0.82)';
  ctx.fill();

  // Small anal fin
  ctx.beginPath();
  ctx.moveTo(-sLen * 0.24,  sH * 0.40);
  ctx.lineTo(-sLen * 0.30,  sH * 0.72);
  ctx.bezierCurveTo(-sLen * 0.26,  sH * 0.60, -sLen * 0.18,  sH * 0.48, -sLen * 0.16,  sH * 0.40);
  ctx.closePath();
  ctx.fillStyle = 'rgba(40, 55, 66, 0.78)';
  ctx.fill();

  // Tail — heterocercal (upper lobe larger)
  ctx.save();
  ctx.translate(-sLen * 0.47, 0);
  ctx.rotate(tailWag);
  // Upper lobe
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-sLen * 0.05, -sH * 0.20, -sLen * 0.16, -sH * 0.62, -sLen * 0.14, -sH * 0.78);
  ctx.bezierCurveTo(-sLen * 0.06, -sH * 0.56, -sLen * 0.00, -sH * 0.22,  sLen * 0.01, -sH * 0.02);
  // Lower lobe (smaller)
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-sLen * 0.04,  sH * 0.12, -sLen * 0.10,  sH * 0.40, -sLen * 0.08,  sH * 0.50);
  ctx.bezierCurveTo(-sLen * 0.04,  sH * 0.34, -sLen * 0.00,  sH * 0.14,  sLen * 0.01,  sH * 0.02);
  ctx.fillStyle = 'rgba(38, 53, 64, 0.88)';
  ctx.fill();
  ctx.restore();

  // Gill slits
  for (let g = 0; g < 5; g++) {
    const gx = sLen * (0.30 - g * 0.025);
    const gy1 = -sH * (0.30 - g * 0.02);
    const gy2 =  sH * (0.12 + g * 0.015);
    ctx.beginPath();
    ctx.moveTo(gx, gy1);
    ctx.lineTo(gx - sLen * 0.005, gy2);
    ctx.strokeStyle = 'rgba(20, 35, 48, 0.60)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // Eye — black with ring and glint
  ctx.beginPath();
  ctx.arc(sLen * 0.36, -sH * 0.08, sH * 0.095, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(180, 185, 188, 0.55)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sLen * 0.36, -sH * 0.08, sH * 0.065, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(4, 8, 12, 0.97)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sLen * 0.368, -sH * 0.100, sH * 0.022, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fill();

  ctx.restore();
}

// ── Component ─────────────────────────────────────────────────────────────────
interface OceanCanvasProps {
  width:  number;
  height: number;
  style?: React.CSSProperties;
}

const OceanCanvas: React.FC<OceanCanvasProps> = ({ width, height, style }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!width || !height) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let startTime: number | null = null;

    const render = (ts: number) => {
      if (!startTime) startTime = ts;
      const elapsed  = ts - startTime;
      const elapsedS = elapsed / 1000;                       // continuous seconds — never resets
      const cycleT   = (elapsed % CYCLE_MS) / CYCLE_MS;
      const phase    = cycleT * Math.PI * 2;

      // Ocean background drawn by canvas (not CSS)
      drawOcean(ctx, width, height, phase);
      drawSeaFloor(ctx, width, height);
      drawBubbles(ctx, elapsed, width, height);

      // Creatures — position uses elapsedS (no jump on cycle reset)
      WHALE_SPECS.forEach(spec => drawWhale(ctx, elapsedS, spec, width, height));
      SHARK_SPECS.forEach(spec => drawShark(ctx, elapsedS, spec, width, height));

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', ...style }}
    />
  );
};

export default OceanCanvas;
