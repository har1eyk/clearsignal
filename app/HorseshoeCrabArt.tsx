"use client";

import { useEffect, useRef } from "react";
import { easeCubicInOut, timer } from "d3";

const SIZE = 700;
const FORMATION_MS = 4000;
const SCURRY_MS = 2200;
const MIN_SCURRY_DELAY = 20000;
const MAX_SCURRY_DELAY = 40000;
const BREATH_CYCLE_MS = 7000;
const FRAME_INTERVAL_MS = 1000 / 30;
const CRAB_BOUNDS = { minX: 240, maxX: 370, minY: 180, maxY: 520 } as const;
const COLORS = ["#ADDBFF", "#FFCD82", "#00508F", "#8F5601"];
const SOURCE_CIRCLES = [
  { x: 100, y: 112, r: 126 },
  { x: 342, y: 112, r: 162 },
  { x: 586, y: 128, r: 106 },
  { x: 142, y: 382, r: 146 },
  { x: 430, y: 350, r: 180 },
  { x: 585, y: 564, r: 118 },
  { x: 264, y: 584, r: 108 },
] as const;

type ParticleKind = "shell" | "outline" | "leg";
type Particle = {
  x: number;
  y: number;
  radius: number;
  source: number;
  color: number;
  reveal: number;
  phase: number;
  kind: ParticleKind;
  offsetX: number;
  offsetY: number;
  velocityX: number;
  velocityY: number;
  breathAmplitude: number;
  breathPhase: number;
  breathDirection: number;
  breathMoves: boolean;
};

function mulberry32(seed: number) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function insideCrab(x: number, y: number) {
  const shell = ((x + 70) / 150) ** 2 + (y / 126) ** 2 <= 1 && x < 48;
  const posteriorNotch = x > 17 && x < 52 && Math.abs(y) > 42;
  const abdomen = x >= 18 && x <= 104 && Math.abs(y) <= 76 - (x - 18) * 0.43;
  const tailWidth = 12 - ((x - 86) / 228) * 10;
  const tail = x >= 86 && x <= 314 && Math.abs(y) <= Math.max(1.5, tailWidth);
  return (shell && !posteriorNotch) || abdomen || tail;
}

function makeParticles() {
  const random = mulberry32(2608);
  const particles: Particle[] = [];

  const addParticle = (x: number, y: number, kind: ParticleKind, color?: number) => {
    const source = Math.floor(random() * SOURCE_CIRCLES.length);
    const phaseGroup = Math.abs(Math.floor((x + 220) / 88) + Math.floor((y + 145) / 76) * 3) % 7;
    particles.push({
      x,
      y,
      radius: kind === "outline" ? 1.5 + random() * 3.1 : 0.7 + random() ** 2.2 * 5.3,
      source,
      color: color ?? Math.floor(random() * COLORS.length),
      reveal: random(),
      phase: random() * Math.PI * 2,
      kind,
      offsetX: 0,
      offsetY: 0,
      velocityX: 0,
      velocityY: 0,
      breathAmplitude: 0.05 + random() * 0.05,
      breathPhase: phaseGroup * 0.16 + (random() - 0.5) * 0.12,
      breathDirection: random() * Math.PI * 2,
      breathMoves: random() < 0.6,
    });
  };

  while (particles.length < 880) {
    const x = -220 + random() * 540;
    const y = -145 + random() * 290;
    if (!insideCrab(x, y)) continue;
    addParticle(x, y, "shell");
  }

  // The outer shield, articulated abdomen, and shell seam make the dorsal
  // silhouette recognizable even though every mark remains an independent dot.
  for (let index = 0; index < 240; index++) {
    const angle = (index / 240) * Math.PI * 2;
    addParticle(-70 + Math.cos(angle) * 150, Math.sin(angle) * 126, "outline", index % COLORS.length);
  }
  for (const side of [-1, 1]) {
    for (let index = 0; index < 82; index++) {
      const progress = index / 81;
      const x = 18 + progress * 86;
      const y = side * (76 - progress * 37);
      addParticle(x, y, "outline", (index + (side > 0 ? 1 : 3)) % COLORS.length);
    }
    for (let index = 0; index < 115; index++) {
      const progress = index / 114;
      const x = 88 + progress * 226;
      const y = side * (11 - progress * 9.5);
      addParticle(x, y, "outline", (index + 2) % COLORS.length);
    }
  }
  for (let index = 0; index < 94; index++) {
    const progress = index / 93;
    const y = -72 + progress * 144;
    const x = 19 + (1 - (y / 76) ** 2) * 12;
    addParticle(x, y, "outline", (index + 1) % COLORS.length);
  }

  for (const side of [-1, 1]) {
    for (let leg = 0; leg < 5; leg++) {
      for (let point = 0; point < 12; point++) {
        const progress = point / 11;
        addParticle(
          -12 + leg * 19 + progress * (20 + leg * 4),
          side * (45 + progress * (48 + leg * 3)),
          "leg",
        );
      }
    }
  }
  return particles;
}

function paletteForLoop(loop: number) {
  const palette = [...COLORS];
  const random = mulberry32(811 + loop * 97);
  for (let index = palette.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [palette[index], palette[other]] = [palette[other], palette[index]];
  }
  return palette;
}

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function HorseshoeCrabArt() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const particles = makeParticles();
    const pointer = { x: 0, y: 0, active: false };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const palette = paletteForLoop(0);
    let mode: "forming" | "idle" | "scurrying" = reducedMotion ? "idle" : "forming";
    let formationProgress = reducedMotion ? 1 : 0;
    let scurryProgress = 0;
    let crabX = 320;
    let crabY = 360;
    let scurryStartX = crabX;
    let scurryStartY = crabY;
    let scurryTargetX = crabX;
    let scurryTargetY = crabY;
    let activeTimer: ReturnType<typeof timer> | null = null;
    let movementTimeout: ReturnType<typeof setTimeout> | null = null;
    let timerStartProgress = 0;
    let previousFrameTime = performance.now();
    let destroyed = false;

    const resize = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = SIZE * ratio;
      canvas.height = SIZE * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const updatePointer = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * SIZE;
      pointer.y = ((event.clientY - bounds.top) / bounds.height) * SIZE;
      pointer.active = true;
      if (mode === "idle") startAnimation();
    };

    const clearPointer = () => {
      pointer.active = false;
      if (mode === "idle") startAnimation();
    };

    const draw = (
      formation: number,
      bodyX: number,
      bodyY: number,
      crabAngle: number,
      legActivity: number,
      frameTime: number,
      delta: number,
    ) => {
      const cosine = Math.cos(crabAngle);
      const sine = Math.sin(crabAngle);
      let particlesInMotion = false;
      const breathing = formation >= 1 && !reducedMotion;
      const breathTime = ((frameTime % BREATH_CYCLE_MS) / BREATH_CYCLE_MS) * Math.PI * 2;

      context.clearRect(0, 0, SIZE, SIZE);

      if (!reducedMotion && formation < 1) {
        const macroOpacity = (1 - formation) ** 1.25 * 0.48;
        SOURCE_CIRCLES.forEach((circle, index) => {
          const radius = Math.max(5, circle.r * (1 - formation * 0.94));
          context.beginPath();
          context.arc(circle.x, circle.y, radius, 0, Math.PI * 2);
          context.fillStyle = `${palette[index % palette.length]}${Math.round(macroOpacity * 255).toString(16).padStart(2, "0")}`;
          context.fill();
        });
      }

      for (const particle of particles) {
        const source = SOURCE_CIRCLES[particle.source];
        const legMotion = particle.kind === "leg"
          ? Math.sin(frameTime * 0.012 + particle.phase) * 5 * legActivity
          : 0;
        const localX = particle.x;
        const localY = particle.y + legMotion;
        const targetX = bodyX + localX * cosine - localY * sine;
        const targetY = bodyY + localX * sine + localY * cosine;
        const x = source.x + (targetX - source.x) * formation;
        const y = source.y + (targetY - source.y) * formation;
        const reveal = reducedMotion ? 1 : clamp((formation - particle.reveal * 0.48) * 2.2);
        const breathWave = breathing ? Math.sin(breathTime + particle.breathPhase) : 0;
        const breathDistance = particle.radius * 2 * particle.breathAmplitude * breathWave;
        const breathOffsetX = particle.breathMoves ? Math.cos(particle.breathDirection) * breathDistance : 0;
        const breathOffsetY = particle.breathMoves ? Math.sin(particle.breathDirection) * breathDistance : 0;

        const currentX = x + particle.offsetX + breathOffsetX;
        const currentY = y + particle.offsetY + breathOffsetY;
        const dx = currentX - pointer.x;
        const dy = currentY - pointer.y;
        const distance = Math.hypot(dx, dy);
        const affected = pointer.active && formation > 0.8 && distance < 88 && reveal > 0.25;

        if (affected) {
          const force = (1 - distance / 88) * 1.15 * delta;
          const safeDistance = Math.max(1, distance);
          particle.velocityX += (dx / safeDistance) * force;
          particle.velocityY += (dy / safeDistance) * force;
        }
        particle.velocityX += -particle.offsetX * 0.016 * delta;
        particle.velocityY += -particle.offsetY * 0.016 * delta;
        particle.velocityX *= 0.87 ** delta;
        particle.velocityY *= 0.87 ** delta;
        particle.offsetX += particle.velocityX * delta;
        particle.offsetY += particle.velocityY * delta;
        if (
          affected ||
          Math.abs(particle.offsetX) > 0.08 || Math.abs(particle.offsetY) > 0.08 ||
          Math.abs(particle.velocityX) > 0.02 || Math.abs(particle.velocityY) > 0.02
        ) particlesInMotion = true;

        const radius = particle.radius * (1.75 - formation * 0.75) * (1 + particle.breathAmplitude * breathWave);
        const alpha = reveal * (0.5 + particle.radius / 12);
        const colorIndex = (particle.color + (affected ? 1 : 0)) % palette.length;
        context.fillStyle = `${palette[colorIndex]}${Math.round(clamp(alpha) * 255).toString(16).padStart(2, "0")}`;
        context.beginPath();
        if (affected) {
          context.ellipse(currentX, currentY, radius * 1.7, radius * 0.68, Math.atan2(dy, dx), 0, Math.PI * 2);
        } else {
          context.arc(currentX, currentY, radius, 0, Math.PI * 2);
        }
        context.fill();
      }
      return particlesInMotion;
    };

    const setCanvasState = (state: typeof mode) => {
      canvas.dataset.crabState = state;
      canvas.dataset.crabX = crabX.toFixed(1);
      canvas.dataset.crabY = crabY.toFixed(1);
      canvas.dataset.crabBreathing = (!reducedMotion && !document.hidden && formationProgress >= 1).toString();
    };

    const stopAnimation = () => {
      activeTimer?.stop();
      activeTimer = null;
    };

    const clearMovementTimeout = () => {
      if (movementTimeout !== null) clearTimeout(movementTimeout);
      movementTimeout = null;
      delete canvas.dataset.nextScurryMs;
    };

    const scheduleScurry = () => {
      clearMovementTimeout();
      if (destroyed || reducedMotion || document.hidden || mode !== "idle") return;
      const delay = MIN_SCURRY_DELAY + Math.random() * (MAX_SCURRY_DELAY - MIN_SCURRY_DELAY);
      canvas.dataset.nextScurryMs = Math.round(delay).toString();
      movementTimeout = setTimeout(startScurry, delay);
    };

    const chooseScurryTarget = () => {
      let nextX = clamp(crabX + (Math.random() - 0.5) * 92, CRAB_BOUNDS.minX, CRAB_BOUNDS.maxX);
      let nextY = clamp(crabY + (Math.random() - 0.5) * 58, CRAB_BOUNDS.minY, CRAB_BOUNDS.maxY);
      if (Math.hypot(nextX - crabX, nextY - crabY) < 20) {
        const direction = crabX < (CRAB_BOUNDS.minX + CRAB_BOUNDS.maxX) / 2 ? 1 : -1;
        nextX = clamp(crabX + direction * 28, CRAB_BOUNDS.minX, CRAB_BOUNDS.maxX);
        nextY = clamp(crabY + (Math.random() - 0.5) * 32, CRAB_BOUNDS.minY, CRAB_BOUNDS.maxY);
      }
      return { x: nextX, y: nextY };
    };

    const startScurry = () => {
      movementTimeout = null;
      delete canvas.dataset.nextScurryMs;
      if (destroyed || reducedMotion || document.hidden || mode !== "idle") return;
      const target = chooseScurryTarget();
      scurryStartX = crabX;
      scurryStartY = crabY;
      scurryTargetX = target.x;
      scurryTargetY = target.y;
      scurryProgress = 0;
      stopAnimation();
      mode = "scurrying";
      setCanvasState(mode);
      startAnimation();
    };

    function startAnimation() {
      if (destroyed || document.hidden || activeTimer || reducedMotion) return;
      timerStartProgress = mode === "forming" ? formationProgress : mode === "scurrying" ? scurryProgress : 0;
      previousFrameTime = performance.now();
      activeTimer = timer((elapsed) => {
        const frameTime = performance.now();
        if (frameTime - previousFrameTime < FRAME_INTERVAL_MS) return;
        const delta = clamp((frameTime - previousFrameTime) / 16.67, 0.25, 2);
        previousFrameTime = frameTime;

        if (mode === "forming") {
          const remaining = Math.max(1, FORMATION_MS * (1 - timerStartProgress));
          formationProgress = timerStartProgress + (1 - timerStartProgress) * clamp(elapsed / remaining);
          const formation = easeCubicInOut(formationProgress);
          draw(formation, crabX, crabY, 0, 0, frameTime, delta);
          if (formationProgress >= 1) {
            formationProgress = 1;
            mode = "idle";
            setCanvasState(mode);
            scheduleScurry();
          }
          return;
        }

        if (mode === "scurrying") {
          const remaining = Math.max(1, SCURRY_MS * (1 - timerStartProgress));
          scurryProgress = timerStartProgress + (1 - timerStartProgress) * clamp(elapsed / remaining);
          const movement = easeCubicInOut(scurryProgress);
          crabX = scurryStartX + (scurryTargetX - scurryStartX) * movement;
          crabY = scurryStartY + (scurryTargetY - scurryStartY) * movement;
          const activity = Math.sin(movement * Math.PI);
          draw(1, crabX, crabY, activity * 0.035, activity, frameTime, delta);
          if (scurryProgress >= 1) {
            crabX = scurryTargetX;
            crabY = scurryTargetY;
            scurryProgress = 1;
            mode = "idle";
            setCanvasState(mode);
            draw(1, crabX, crabY, 0, 0, frameTime, delta);
            scheduleScurry();
          }
          return;
        }

        draw(1, crabX, crabY, 0, 0, frameTime, delta);
      });
    }

    const handleVisibility = () => {
      pointer.active = false;
      if (document.hidden) {
        canvas.dataset.crabBreathing = "false";
        clearMovementTimeout();
        stopAnimation();
        return;
      }
      if (mode === "idle") {
        draw(1, crabX, crabY, 0, 0, performance.now(), 1);
        setCanvasState(mode);
        scheduleScurry();
        startAnimation();
      } else {
        startAnimation();
      }
    };

    resize();
    canvas.dataset.breathCycleMs = BREATH_CYCLE_MS.toString();
    canvas.dataset.breathMovingPoints = particles.filter((particle) => particle.breathMoves).length.toString();
    canvas.dataset.breathResizeOnlyPoints = particles.filter((particle) => !particle.breathMoves).length.toString();
    canvas.dataset.renderFpsCap = "30";
    setCanvasState(mode);
    document.addEventListener("visibilitychange", handleVisibility);

    if (reducedMotion) {
      draw(1, crabX, crabY, 0, 0, performance.now(), 1);
      return () => {
        destroyed = true;
        document.removeEventListener("visibilitychange", handleVisibility);
      };
    }

    canvas.addEventListener("pointermove", updatePointer);
    canvas.addEventListener("pointerleave", clearPointer);
    startAnimation();
    return () => {
      destroyed = true;
      clearMovementTimeout();
      stopAnimation();
      canvas.removeEventListener("pointermove", updatePointer);
      canvas.removeEventListener("pointerleave", clearPointer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return (
    <figure className="crab-art" aria-labelledby="crab-art-caption">
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        aria-label="Colored circles gather into a gently breathing horseshoe crab that rests, occasionally scurries, and softly avoids the pointer."
      />
      <figcaption id="crab-art-caption" className="sr-only">
        A gently breathing interactive D3 particle artwork inspired by the horseshoe crab and endotoxin science.
      </figcaption>
    </figure>
  );
}
