"use client";

import { useEffect, useRef } from "react";

type Seg = { x1: number; y1: number; x2: number; y2: number };
type Arc = { cx: number; cy: number; r: number; a1: number; a2: number };
type Circ = { cx: number; cy: number; r: number };
type LabelData = { x: number; y: number; text: string; size: number };

type Item =
  | { kind: "seg"; data: Seg; lw: number; len: number }
  | { kind: "arc"; data: Arc; lw: number; len: number }
  | { kind: "circ"; data: Circ; lw: number; len: number }
  | { kind: "label"; data: LabelData; len: number };

export function AnimatedSphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const PLAN_W = 100;
    const PLAN_H = 60;

    const S = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      lw = 1.4,
    ): Item => ({
      kind: "seg",
      data: { x1, y1, x2, y2 },
      lw,
      len: Math.hypot(x2 - x1, y2 - y1) || 0.001,
    });
    const A = (
      cx: number,
      cy: number,
      r: number,
      a1: number,
      a2: number,
      lw = 0.6,
    ): Item => ({
      kind: "arc",
      data: { cx, cy, r, a1, a2 },
      lw,
      len: Math.abs(a2 - a1) * r || 0.001,
    });
    const C = (cx: number, cy: number, r: number, lw = 0.6): Item => ({
      kind: "circ",
      data: { cx, cy, r },
      lw,
      len: 2 * Math.PI * r,
    });
    const L = (x: number, y: number, text: string, size = 3): Item => ({
      kind: "label",
      data: { x, y, text, size },
      len: text.length * 1.5,
    });

    // ---------------------------------------------------------------
    // Floor plan layout (logical coords, 100 x 60)
    //
    //  +-------------------+----------+--------------------+
    //  |     BEDROOM       |   BATH   |     KITCHEN        |
    //  +--------+----------+----------+----------+---------+
    //  | CLOSET |              HALLWAY                     |
    //  +--------+----------+--------------------+----------+
    //  |       LIVING ROOM            |       DINING       |
    //  +------------------------------+--------------------+
    // ---------------------------------------------------------------

    const walls: Item[] = [
      // outer perimeter (solid)
      S(2, 2, 98, 2, 1.8),
      S(98, 2, 98, 58, 1.8),
      S(98, 58, 2, 58, 1.8),
      S(2, 58, 2, 2, 1.8),

      // bedroom right wall (with door gap at y=22..26)
      S(36, 2, 36, 22),
      // bath right wall
      S(58, 2, 58, 22),
      // bath bottom wall y=22 (door gap x=42..46)
      S(36, 22, 42, 22),
      S(46, 22, 58, 22),

      // top-row to hallway divider y=26 (gap x=36..58 = vestibule + kitchen door x=78..82)
      S(2, 26, 36, 26),
      S(58, 26, 78, 26),
      S(82, 26, 98, 26),

      // closet right wall x=20 (door gap y=34..38)
      S(20, 26, 20, 34),

      // hallway/closet bottom y=38 (living door gap x=30..34)
      S(2, 38, 20, 38),
      S(20, 38, 30, 38),
      S(34, 38, 58, 38),
      S(58, 38, 98, 38),

      // living/dining divider x=58 (open archway y=46..50)
      S(58, 38, 58, 46),
      S(58, 50, 58, 58),
    ];

    // Windows — twin parallel lines on outer walls
    const windowSegs = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
    ): Item[] => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      const ox = (-dy / len) * 0.55;
      const oy = (dx / len) * 0.55;
      return [
        S(x1 + ox, y1 + oy, x2 + ox, y2 + oy, 0.7),
        S(x1 - ox, y1 - oy, x2 - ox, y2 - oy, 0.7),
        S(x1 + ox, y1 + oy, x1 - ox, y1 - oy, 0.6),
        S(x2 + ox, y2 + oy, x2 - ox, y2 - oy, 0.6),
      ];
    };

    const windows: Item[] = [
      ...windowSegs(10, 2, 26, 2),
      ...windowSegs(70, 2, 90, 2),
      ...windowSegs(98, 10, 98, 22),
      ...windowSegs(98, 42, 98, 54),
      ...windowSegs(14, 58, 32, 58),
      ...windowSegs(2, 44, 2, 54),
    ];

    // Door = leaf line + quarter-circle swing arc
    const doorPair = (
      hx: number,
      hy: number,
      r: number,
      leafAngle: number,
      arcStart: number,
      arcEnd: number,
    ): Item[] => {
      const lx = hx + Math.cos(leafAngle) * r;
      const ly = hy + Math.sin(leafAngle) * r;
      return [S(hx, hy, lx, ly, 0.9), A(hx, hy, r, arcStart, arcEnd, 0.5)];
    };

    const doors: Item[] = [
      // bedroom — hinge at (36,22), swings into bedroom
      ...doorPair(36, 22, 4, Math.PI, Math.PI, Math.PI * 1.5),
      // bath — hinge at (42,22), swings up into bath
      ...doorPair(42, 22, 4, -Math.PI / 2, -Math.PI / 2, 0),
      // kitchen — hinge at (82,26), swings up into kitchen
      ...doorPair(82, 26, 4, -Math.PI / 2, Math.PI, Math.PI * 1.5),
      // closet — hinge at (20,34), swings into hallway
      ...doorPair(20, 34, 4, 0, 0, Math.PI / 2),
      // living — hinge at (30,38), swings into living
      ...doorPair(30, 38, 4, Math.PI / 2, Math.PI / 2, Math.PI),
    ];

    // ---- FURNITURE ----
    const bed: Item[] = [
      S(6, 4, 30, 4, 0.9),
      S(30, 4, 30, 18, 0.9),
      S(30, 18, 6, 18, 0.9),
      S(6, 18, 6, 4, 0.9),
      // pillows
      S(8, 5, 17, 5, 0.5),
      S(17, 5, 17, 9, 0.5),
      S(17, 9, 8, 9, 0.5),
      S(8, 9, 8, 5, 0.5),
      S(19, 5, 28, 5, 0.5),
      S(28, 5, 28, 9, 0.5),
      S(28, 9, 19, 9, 0.5),
      S(19, 9, 19, 5, 0.5),
      // duvet fold
      S(6, 11, 30, 11, 0.5),
    ];

    const nightstand: Item[] = [
      S(31, 4, 35, 4, 0.6),
      S(35, 4, 35, 10, 0.6),
      S(35, 10, 31, 10, 0.6),
      S(31, 10, 31, 4, 0.6),
      S(31, 7, 35, 7, 0.4),
    ];

    const dresser: Item[] = [
      S(6, 21, 30, 21, 0.7),
      S(30, 21, 30, 25, 0.7),
      S(30, 25, 6, 25, 0.7),
      S(6, 25, 6, 21, 0.7),
      S(14, 21, 14, 25, 0.4),
      S(22, 21, 22, 25, 0.4),
    ];

    const bathFurn: Item[] = [
      // tub
      S(46, 4, 56, 4, 0.7),
      S(56, 4, 56, 12, 0.7),
      S(56, 12, 46, 12, 0.7),
      S(46, 12, 46, 4, 0.7),
      S(48, 5.5, 54, 5.5, 0.4),
      S(54, 5.5, 54, 10.5, 0.4),
      S(54, 10.5, 48, 10.5, 0.4),
      S(48, 10.5, 48, 5.5, 0.4),
      // toilet
      S(38, 14, 42, 14, 0.5),
      S(42, 14, 42, 18, 0.5),
      S(42, 18, 38, 18, 0.5),
      S(38, 18, 38, 14, 0.5),
      C(40, 16, 1.4, 0.5),
      // sink
      S(50, 16, 56, 16, 0.5),
      S(56, 16, 56, 20, 0.5),
      S(56, 20, 50, 20, 0.5),
      S(50, 20, 50, 16, 0.5),
      C(53, 18, 1.6, 0.5),
    ];

    const kitchenFurn: Item[] = [
      // top counter
      S(60, 4, 96, 4, 0.6),
      S(96, 4, 96, 10, 0.6),
      S(60, 10, 96, 10, 0.6),
      S(60, 4, 60, 10, 0.6),
      // right counter
      S(90, 10, 90, 24, 0.6),
      S(96, 10, 96, 24, 0.6),
      S(90, 24, 96, 24, 0.6),
      // sink basin
      C(67, 7, 1.5, 0.5),
      C(67, 7, 1.0, 0.4),
      // stove
      S(76, 4, 76, 10, 0.5),
      S(84, 4, 84, 10, 0.5),
      C(78, 6, 0.7, 0.4),
      C(82, 6, 0.7, 0.4),
      C(78, 8.5, 0.7, 0.4),
      C(82, 8.5, 0.7, 0.4),
      // fridge
      S(60, 10, 68, 10, 0.5),
      S(68, 10, 68, 18, 0.6),
      S(60, 18, 68, 18, 0.6),
      S(60, 10, 60, 18, 0.6),
      S(64, 10, 64, 18, 0.4),
      // island
      S(70, 14, 84, 14, 0.7),
      S(84, 14, 84, 22, 0.7),
      S(84, 22, 70, 22, 0.7),
      S(70, 22, 70, 14, 0.7),
      S(70, 17, 84, 17, 0.4),
    ];

    const closet: Item[] = [
      S(3, 30, 19, 30, 0.5),
      S(6, 30, 6, 36, 0.3),
      S(10, 30, 10, 36, 0.3),
      S(14, 30, 14, 36, 0.3),
      S(18, 30, 18, 36, 0.3),
    ];

    const living: Item[] = [
      // sofa
      S(8, 50, 36, 50, 0.7),
      S(36, 50, 36, 56, 0.7),
      S(36, 56, 8, 56, 0.7),
      S(8, 56, 8, 50, 0.7),
      S(8, 51, 36, 51, 0.4),
      S(17, 51, 17, 56, 0.4),
      S(26, 51, 26, 56, 0.4),
      // coffee table
      S(14, 44, 30, 44, 0.6),
      S(30, 44, 30, 48, 0.6),
      S(30, 48, 14, 48, 0.6),
      S(14, 48, 14, 44, 0.6),
      // rug
      S(6, 42, 38, 42, 0.3),
      S(38, 42, 38, 56, 0.3),
      // tv console
      S(3, 41, 3, 51, 0.6),
      S(3, 41, 6, 41, 0.6),
      S(3, 51, 6, 51, 0.6),
      S(6, 41, 6, 51, 0.6),
      // armchair
      S(42, 50, 50, 50, 0.6),
      S(50, 50, 50, 56, 0.6),
      S(50, 56, 42, 56, 0.6),
      S(42, 56, 42, 50, 0.6),
      S(43, 51, 49, 51, 0.4),
      // floor lamp
      C(54, 42, 1.2, 0.5),
    ];

    const dining: Item[] = [
      // table
      S(70, 42, 90, 42, 0.7),
      S(90, 42, 90, 54, 0.7),
      S(90, 54, 70, 54, 0.7),
      S(70, 54, 70, 42, 0.7),
      // chairs
      C(74, 40, 1.4, 0.5),
      C(80, 40, 1.4, 0.5),
      C(86, 40, 1.4, 0.5),
      C(74, 56, 1.4, 0.5),
      C(80, 56, 1.4, 0.5),
      C(86, 56, 1.4, 0.5),
      C(68, 45, 1.4, 0.5),
      C(68, 51, 1.4, 0.5),
      C(92, 45, 1.4, 0.5),
      C(92, 51, 1.4, 0.5),
      // hutch
      S(62, 38, 62, 42, 0.4),
      S(62, 42, 66, 42, 0.4),
      S(66, 42, 66, 38, 0.4),
    ];

    const labels: Item[] = [
      L(19, 14, "BEDROOM", 2.4),
      L(47, 8, "BATH", 1.8),
      L(78, 30, "KITCHEN", 2.4),
      L(11, 32, "CLOSET", 1.6),
      L(50, 32, "HALLWAY", 1.8),
      L(22, 46, "LIVING ROOM", 2.4),
      L(80, 48, "DINING", 2.4),
    ];

    type Stage = { items: Item[]; stagger: boolean };
    const stages: Stage[] = [
      { items: walls, stagger: true },
      { items: windows, stagger: false },
      { items: doors, stagger: false },
      {
        items: [
          ...bed,
          ...nightstand,
          ...dresser,
          ...bathFurn,
          ...kitchenFurn,
          ...closet,
          ...living,
          ...dining,
        ],
        stagger: false,
      },
      { items: labels, stagger: true },
    ];

    const stageLens = stages.map((s) =>
      s.items.reduce((a, b) => a + b.len, 0),
    );
    const totalLen = stageLens.reduce((a, b) => a + b, 0) || 1;
    const DRAW_PORTION = 0.82;
    const HOLD_PORTION = 0.13;
    const stageBounds: [number, number][] = [];
    let cursor = 0;
    stageLens.forEach((l) => {
      const span = (l / totalLen) * DRAW_PORTION;
      stageBounds.push([cursor, cursor + span]);
      cursor += span;
    });

    let scale = 1;
    let offX = 0;
    let offY = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      const margin = 18;
      const sx = (rect.width - margin * 2) / PLAN_W;
      const sy = (rect.height - margin * 2) / PLAN_H;
      scale = Math.min(sx, sy);
      offX = (rect.width - PLAN_W * scale) / 2;
      offY = (rect.height - PLAN_H * scale) / 2;
    };

    resize();
    window.addEventListener("resize", resize);

    const px = (x: number) => offX + x * scale;
    const py = (y: number) => offY + y * scale;
    const ps = (v: number) => v * scale;

    const drawSeg = (s: Seg, frac: number, lw: number, alpha: number) => {
      if (frac <= 0) return;
      ctx.strokeStyle = `rgba(20,20,20,${alpha})`;
      ctx.lineWidth = lw;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(px(s.x1), py(s.y1));
      const x = s.x1 + (s.x2 - s.x1) * frac;
      const y = s.y1 + (s.y2 - s.y1) * frac;
      ctx.lineTo(px(x), py(y));
      ctx.stroke();
    };

    const drawArc = (a: Arc, frac: number, lw: number, alpha: number) => {
      if (frac <= 0) return;
      ctx.strokeStyle = `rgba(20,20,20,${alpha})`;
      ctx.lineWidth = lw;
      ctx.lineCap = "round";
      ctx.beginPath();
      const aEnd = a.a1 + (a.a2 - a.a1) * frac;
      ctx.arc(px(a.cx), py(a.cy), ps(a.r), a.a1, aEnd, a.a2 < a.a1);
      ctx.stroke();
    };

    const drawCirc = (c: Circ, frac: number, lw: number, alpha: number) => {
      if (frac <= 0) return;
      ctx.strokeStyle = `rgba(20,20,20,${alpha})`;
      ctx.lineWidth = lw;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(px(c.cx), py(c.cy), ps(c.r), 0, Math.PI * 2 * frac);
      ctx.stroke();
    };

    const drawLabel = (l: LabelData, frac: number, alpha: number) => {
      if (frac <= 0) return;
      const a = Math.min(1, frac) * alpha * 0.85;
      ctx.fillStyle = `rgba(20,20,20,${a})`;
      ctx.font = `${ps(l.size)}px ui-monospace, "SF Mono", Menlo, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const letterSpaced = l.text.split("").join("\u200a\u200a");
      ctx.fillText(letterSpaced, px(l.x), py(l.y));
    };

    const drawItem = (item: Item, frac: number, alpha: number) => {
      if (frac <= 0) return;
      switch (item.kind) {
        case "seg":
          drawSeg(item.data, frac, item.lw, alpha);
          break;
        case "arc":
          drawArc(item.data, frac, item.lw, alpha);
          break;
        case "circ":
          drawCirc(item.data, frac, item.lw, alpha);
          break;
        case "label":
          drawLabel(item.data, frac, alpha);
          break;
      }
    };

    const drawGrid = (alpha: number) => {
      if (alpha <= 0) return;
      ctx.strokeStyle = `rgba(0,0,0,${alpha * 0.07})`;
      ctx.lineWidth = 0.5;
      const step = 4;
      ctx.beginPath();
      for (let x = 0; x <= PLAN_W; x += step) {
        ctx.moveTo(px(x), py(0));
        ctx.lineTo(px(x), py(PLAN_H));
      }
      for (let y = 0; y <= PLAN_H; y += step) {
        ctx.moveTo(px(0), py(y));
        ctx.lineTo(px(PLAN_W), py(y));
      }
      ctx.stroke();
    };

    const drawCornerTicks = (alpha: number) => {
      if (alpha <= 0) return;
      ctx.strokeStyle = `rgba(20,20,20,${alpha * 0.6})`;
      ctx.lineWidth = 0.6;
      const t = 3;
      const corners: [number, number][] = [
        [-2, -2],
        [PLAN_W + 2, -2],
        [-2, PLAN_H + 2],
        [PLAN_W + 2, PLAN_H + 2],
      ];
      ctx.beginPath();
      corners.forEach(([cx, cy]) => {
        ctx.moveTo(px(cx - t), py(cy));
        ctx.lineTo(px(cx + t), py(cy));
        ctx.moveTo(px(cx), py(cy - t));
        ctx.lineTo(px(cx), py(cy + t));
      });
      ctx.stroke();
    };

    const CYCLE_MS = 3000;
    let last = performance.now();
    let elapsed = 0;

    const render = (now: number) => {
      const dt = now - last;
      last = now;
      elapsed += dt;
      if (elapsed > CYCLE_MS) elapsed -= CYCLE_MS;
      const t = elapsed / CYCLE_MS;

      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      // Fade: in over first 4%, out over last 5%
      const fadeStart = DRAW_PORTION + HOLD_PORTION;
      let globalAlpha = 1;
      if (t < 0.04) globalAlpha = t / 0.04;
      else if (t > fadeStart)
        globalAlpha = Math.max(0, 1 - (t - fadeStart) / (1 - fadeStart));

      drawGrid(Math.min(1, t * 8) * globalAlpha);
      drawCornerTicks(Math.min(1, (t - 0.02) * 10) * globalAlpha);

      stages.forEach((stage, idx) => {
        const [s, e] = stageBounds[idx];
        if (t < s) return;
        const stageProg = Math.min(1, (t - s) / Math.max(1e-6, e - s));
        const items = stage.items;
        if (stage.stagger) {
          const lens = items.map((i) => i.len);
          const total = lens.reduce((a, b) => a + b, 0) || 1;
          let acc = 0;
          for (let i = 0; i < items.length; i++) {
            const itemStart = acc / total;
            acc += lens[i];
            const itemEnd = acc / total;
            let frac = 0;
            if (stageProg >= itemEnd) frac = 1;
            else if (stageProg > itemStart)
              frac = (stageProg - itemStart) / (itemEnd - itemStart);
            drawItem(items[i], frac, globalAlpha);
          }
        } else {
          items.forEach((item) => drawItem(item, stageProg, globalAlpha));
        }
      });

      frameRef.current = requestAnimationFrame(render);
    };

    frameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
}
