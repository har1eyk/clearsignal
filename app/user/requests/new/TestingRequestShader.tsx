"use client";

import { Warp } from "@paper-design/shaders-react";

export function TestingRequestShader() {
  return (
    <Warp
      speed={1}
      scale={2.47}
      softness={1}
      proportion={0.45}
      swirl={0.8}
      swirlIterations={4}
      shape="checks"
      distortion={0}
      shapeScale={0}
      frame={38023.99999996134}
      colors={["#142939", "#4D3716", "#01508E", "#8D5601", "#AEDBFF", "#FEF4E5"]}
      className="request-shader"
    />
  );
}
