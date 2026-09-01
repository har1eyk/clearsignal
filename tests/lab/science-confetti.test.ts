import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createScienceConfettiParticles, ScienceConfetti, SCIENCE_CONFETTI_COLORS, SCIENCE_CONFETTI_SHAPES } from "../../app/user/requests/new/ScienceConfetti";

function predictableRandom() {
  let value = 0;
  return () => {
    value = (value + 0.137) % 1;
    return value;
  };
}

test("creates the complete science icon set in colorful particles", () => {
  const particles = createScienceConfettiParticles(1_200, 800, SCIENCE_CONFETTI_SHAPES.length, predictableRandom());
  assert.deepEqual(particles.map((particle) => particle.shape), [...SCIENCE_CONFETTI_SHAPES]);
  assert.equal(new Set(particles.map((particle) => particle.color)).size, SCIENCE_CONFETTI_COLORS.length);
});

test("keeps launch positions at the viewport edges and aims them inward", () => {
  const width = 1_000;
  const particles = createScienceConfettiParticles(width, 700, 30, predictableRandom());
  particles.forEach((particle, index) => {
    if (index % 2 === 0) {
      assert.ok(particle.x >= width * 0.025 && particle.x <= width * 0.175);
      assert.ok(particle.velocityX > 0);
    } else {
      assert.ok(particle.x >= width * 0.825 && particle.x <= width * 0.975);
      assert.ok(particle.velocityX < 0);
    }
    assert.ok(particle.velocityY < 0);
    assert.ok(particle.size >= 13 && particle.size <= 26);
  });
});

test("renders a decorative, noninteractive canvas", () => {
  const markup = renderToStaticMarkup(createElement(ScienceConfetti));
  assert.match(markup, /<canvas/);
  assert.match(markup, /class="science-confetti"/);
  assert.match(markup, /aria-hidden="true"/);
  assert.doesNotMatch(markup, /tabindex=/i);
});
