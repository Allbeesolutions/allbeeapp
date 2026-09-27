import React from "react";
// Reuse the AllBee monogram so the assistant belongs to the same product.
export default function AllbeeAIMark({ size = 24, className = "" }) {
  return <span className={"allbee-ai-mark " + className} style={{ width:size, height:size }} aria-hidden="true"><img src="/allbee-icon.png" alt="" width={size} height={size} /></span>;
}
