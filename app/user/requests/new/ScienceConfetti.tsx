"use client";

import { useEffect, useRef } from "react";

export const SCIENCE_CONFETTI_SHAPES = ["dna", "flask", "pipette", "cell", "microscope", "molecule", "petri", "bubble", "spark"] as const;
export const SCIENCE_CONFETTI_COLORS = ["#FFCB7C", "#AEDBFF", "#FF6F61", "#B9F45D", "#A987FF", "#32D8E6", "#FEF4E5"] as const;

type ScienceShape = typeof SCIENCE_CONFETTI_SHAPES[number];

export type ScienceConfettiParticle = {
  shape: ScienceShape;
  color: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  gravity: number;
  rotation: number;
  spin: number;
  size: number;
};

export function createScienceConfettiParticles(
  width: number,
  height: number,
  count: number,
  random: () => number = Math.random,
): ScienceConfettiParticle[] {
  return Array.from({ length: count }, (_, index) => {
    const left = index % 2 === 0;
    const edgePosition = 0.025 + random() * 0.15;
    return {
      shape: SCIENCE_CONFETTI_SHAPES[index % SCIENCE_CONFETTI_SHAPES.length],
      color: SCIENCE_CONFETTI_COLORS[index % SCIENCE_CONFETTI_COLORS.length],
      x: width * (left ? edgePosition : 1 - edgePosition),
      y: height * (0.12 + random() * 0.58),
      velocityX: (left ? 1 : -1) * (28 + random() * 78),
      velocityY: -(65 + random() * 175),
      gravity: 72 + random() * 42,
      rotation: random() * Math.PI * 2,
      spin: (random() - 0.5) * 2.8,
      size: 13 + random() * 13,
    };
  });
}

function drawDna(context: CanvasRenderingContext2D, size: number) {
  context.beginPath();
  for (let step = -5; step <= 5; step += 1) {
    const y = step * size / 10;
    const x = Math.sin(step * 0.95) * size * 0.24;
    if (step === -5) context.moveTo(x, y); else context.lineTo(x, y);
  }
  for (let step = -5; step <= 5; step += 1) {
    const y = step * size / 10;
    const x = -Math.sin(step * 0.95) * size * 0.24;
    if (step === -5) context.moveTo(x, y); else context.lineTo(x, y);
  }
  for (let step = -4; step <= 4; step += 2) {
    const y = step * size / 10;
    const x = Math.sin(step * 0.95) * size * 0.24;
    context.moveTo(x, y);
    context.lineTo(-x, y);
  }
  context.stroke();
}

function drawFlask(context: CanvasRenderingContext2D, size: number) {
  context.beginPath();
  context.moveTo(-size * 0.14, -size * 0.5);
  context.lineTo(size * 0.14, -size * 0.5);
  context.moveTo(-size * 0.09, -size * 0.5);
  context.lineTo(-size * 0.09, -size * 0.12);
  context.lineTo(-size * 0.4, size * 0.42);
  context.quadraticCurveTo(0, size * 0.58, size * 0.4, size * 0.42);
  context.lineTo(size * 0.09, -size * 0.12);
  context.lineTo(size * 0.09, -size * 0.5);
  context.moveTo(-size * 0.29, size * 0.23);
  context.quadraticCurveTo(0, size * 0.1, size * 0.29, size * 0.23);
  context.stroke();
}

function drawPipette(context: CanvasRenderingContext2D, size: number) {
  context.beginPath();
  context.roundRect(-size * 0.16, -size * 0.52, size * 0.32, size * 0.62, size * 0.08);
  context.moveTo(-size * 0.08, size * 0.1);
  context.lineTo(-size * 0.035, size * 0.48);
  context.lineTo(size * 0.035, size * 0.48);
  context.lineTo(size * 0.08, size * 0.1);
  context.moveTo(-size * 0.09, -size * 0.35);
  context.lineTo(size * 0.09, -size * 0.35);
  context.stroke();
}

function drawCell(context: CanvasRenderingContext2D, size: number) {
  context.beginPath();
  context.arc(0, 0, size * 0.47, 0, Math.PI * 2);
  context.moveTo(size * 0.16, 0);
  context.arc(0, 0, size * 0.16, 0, Math.PI * 2);
  context.moveTo(-size * 0.27, -size * 0.13);
  context.arc(-size * 0.29, -size * 0.13, size * 0.025, 0, Math.PI * 2);
  context.moveTo(size * 0.31, size * 0.2);
  context.arc(size * 0.28, size * 0.2, size * 0.03, 0, Math.PI * 2);
  context.stroke();
}

function drawMicroscope(context: CanvasRenderingContext2D, size: number) {
  context.beginPath();
  context.moveTo(-size * 0.24, -size * 0.46);
  context.lineTo(size * 0.04, -size * 0.28);
  context.lineTo(-size * 0.08, -size * 0.1);
  context.lineTo(-size * 0.35, -size * 0.29);
  context.closePath();
  context.moveTo(size * 0.04, -size * 0.28);
  context.quadraticCurveTo(size * 0.48, size * 0.05, size * 0.18, size * 0.36);
  context.moveTo(-size * 0.24, size * 0.12);
  context.lineTo(size * 0.22, size * 0.12);
  context.moveTo(-size * 0.36, size * 0.44);
  context.lineTo(size * 0.39, size * 0.44);
  context.moveTo(-size * 0.05, size * 0.12);
  context.lineTo(-size * 0.16, size * 0.44);
  context.stroke();
}

function drawMolecule(context: CanvasRenderingContext2D, size: number) {
  const nodes = [[-0.34, 0.2], [0, -0.3], [0.34, 0.18], [0.02, 0.38]];
  context.beginPath();
  context.moveTo(nodes[0][0] * size, nodes[0][1] * size);
  context.lineTo(nodes[1][0] * size, nodes[1][1] * size);
  context.lineTo(nodes[2][0] * size, nodes[2][1] * size);
  context.lineTo(nodes[3][0] * size, nodes[3][1] * size);
  context.lineTo(nodes[0][0] * size, nodes[0][1] * size);
  nodes.forEach(([x, y]) => {
    context.moveTo(x * size + size * 0.09, y * size);
    context.arc(x * size, y * size, size * 0.09, 0, Math.PI * 2);
  });
  context.stroke();
}

function drawPetri(context: CanvasRenderingContext2D, size: number) {
  context.beginPath();
  context.ellipse(0, 0, size * 0.48, size * 0.29, 0, 0, Math.PI * 2);
  context.ellipse(0, size * 0.08, size * 0.39, size * 0.18, 0, 0, Math.PI * 2);
  [[-0.2, 0.03], [0.17, 0.1], [0.05, -0.08]].forEach(([x, y]) => {
    context.moveTo(x * size + size * 0.035, y * size);
    context.arc(x * size, y * size, size * 0.035, 0, Math.PI * 2);
  });
  context.stroke();
}

function drawParticle(context: CanvasRenderingContext2D, particle: ScienceConfettiParticle, alpha = 1) {
  context.save();
  context.translate(particle.x, particle.y);
  context.rotate(particle.rotation);
  context.strokeStyle = particle.color;
  context.fillStyle = particle.color;
  context.lineWidth = Math.max(1.6, particle.size * 0.075);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.globalAlpha = alpha;
  if (particle.shape === "dna") drawDna(context, particle.size);
  if (particle.shape === "flask") drawFlask(context, particle.size);
  if (particle.shape === "pipette") drawPipette(context, particle.size);
  if (particle.shape === "cell") drawCell(context, particle.size);
  if (particle.shape === "microscope") drawMicroscope(context, particle.size);
  if (particle.shape === "molecule") drawMolecule(context, particle.size);
  if (particle.shape === "petri") drawPetri(context, particle.size);
  if (particle.shape === "bubble") {
    context.beginPath();
    context.arc(0, 0, particle.size * 0.24, 0, Math.PI * 2);
    context.stroke();
  }
  if (particle.shape === "spark") {
    context.beginPath();
    context.moveTo(-particle.size * 0.38, 0);
    context.lineTo(particle.size * 0.38, 0);
    context.moveTo(0, -particle.size * 0.38);
    context.lineTo(0, particle.size * 0.38);
    context.moveTo(-particle.size * 0.22, -particle.size * 0.22);
    context.lineTo(particle.size * 0.22, particle.size * 0.22);
    context.stroke();
  }
  context.restore();
}

const ANIMATION_DURATION_MS = 5_000;

export function ScienceConfetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let particles: ScienceConfettiParticle[] = [];
    let animationFrame = 0;
    let clearTimer = 0;
    let startTime = performance.now();
    let lastTime = startTime;
    let hiddenAt: number | null = null;
    let staticVisible = true;
    let completed = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const paint = (alpha = 1) => {
      context.clearRect(0, 0, width, height);
      particles.forEach((particle) => drawParticle(context, particle, alpha));
    };

    const resize = () => {
      const previousWidth = width || window.innerWidth;
      const previousHeight = height || window.innerHeight;
      width = window.innerWidth;
      height = window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      particles.forEach((particle) => {
        particle.x *= width / previousWidth;
        particle.y *= height / previousHeight;
      });
      if (reducedMotion && staticVisible) paint(0.82);
    };

    resize();
    particles = createScienceConfettiParticles(width, height, reducedMotion ? 30 : (width < 700 ? 44 : 76));

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const delta = Math.min((now - lastTime) / 1_000, 0.034);
      lastTime = now;
      particles.forEach((particle) => {
        particle.velocityY += particle.gravity * delta;
        particle.x += particle.velocityX * delta;
        particle.y += particle.velocityY * delta;
        particle.rotation += particle.spin * delta;
      });
      const alpha = elapsed > 4_000 ? Math.max(0, 1 - (elapsed - 4_000) / 1_000) : 1;
      paint(alpha);
      if (elapsed < ANIMATION_DURATION_MS) animationFrame = requestAnimationFrame(animate);
      else {
        completed = true;
        context.clearRect(0, 0, width, height);
        canvas.dataset.confettiState = "complete";
      }
    };

    if (reducedMotion) {
      canvas.dataset.confettiState = "static";
      paint(0.82);
      clearTimer = window.setTimeout(() => {
        staticVisible = false;
        completed = true;
        context.clearRect(0, 0, width, height);
        canvas.dataset.confettiState = "complete";
      }, 2_200);
    } else {
      canvas.dataset.confettiState = "running";
      animationFrame = requestAnimationFrame(animate);
    }

    const handleVisibility = () => {
      if (reducedMotion || completed) return;
      if (document.hidden) {
        hiddenAt = performance.now();
        cancelAnimationFrame(animationFrame);
        canvas.dataset.confettiState = "paused";
      } else if (hiddenAt !== null) {
        const now = performance.now();
        startTime += now - hiddenAt;
        lastTime = now;
        hiddenAt = null;
        canvas.dataset.confettiState = "running";
        animationFrame = requestAnimationFrame(animate);
      }
    };

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      cancelAnimationFrame(animationFrame);
      window.clearTimeout(clearTimer);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="science-confetti" aria-hidden="true" data-testid="science-confetti" />;
}
