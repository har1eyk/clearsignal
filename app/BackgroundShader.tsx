"use client";

import { Warp } from "@paper-design/shaders-react";

export function BackgroundShader() {
  return (
    <Warp
      speed={1}
      scale={2.47}
      softness={1}
      proportion={0.45}
      swirl={0.8}
      swirlIterations={10}
      shape="checks"
      distortion={0}
      shapeScale={0}
      frame={2881.2999999523163}
      colors={["#142939", "#4D3716", "#01508E", "#8D5601", "#AEDBFF", "#FEF4E5"]}
      className="hero-shader"
    />
  );
}
