import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";

// Site-wide default social share card (og:image / twitter:image). Product
// pages override it with their own product photo via openGraph.images.
//
// Text is hardcoded bilingual rather than translated: the share card is one
// asset served to every crawler regardless of the viewer's locale cookie.
export const alt = "صيدلية الشبراوي — Elshabrawy Pharmacy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// satori has no bidi support: it shapes Arabic glyphs correctly (given the
// font below) but lays words out left-to-right, mirroring the word order.
// Rendering each word as a flex child in a row-reversed row restores RTL
// order; shaping is unaffected since joining never crosses a space.
function RtlText({ text, size, style }: { text: string; size: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row-reverse",
        // No explicit gap: satori already over-measures each Arabic word's
        // advance width (~0.5em of phantom trailing space per word), which
        // provides the visual word spacing on its own.
        gap: 0,
        fontSize: size,
        ...style,
      }}
    >
      {text.split(" ").map((word, i) => (
        <div key={i} style={{ display: "flex" }}>
          {word}
        </div>
      ))}
    </div>
  );
}

export default async function OpengraphImage() {
  // satori (the renderer behind ImageResponse) has no Arabic glyphs or
  // shaping in its bundled font — a static (non-variable) Cairo Bold is
  // committed next to this file for it.
  const cairo = await readFile(new URL("./Cairo-Bold.ttf", import.meta.url));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          background: "linear-gradient(135deg, #0F52FF 0%, #2563EB 55%, #0D9488 100%)",
          color: "#ffffff",
          fontFamily: "Cairo",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 120,
            height: 120,
            borderRadius: 32,
            background: "rgba(255,255,255,0.18)",
          }}
        >
          {/* Pharmacy plus mark, drawn with divs so no extra glyphs needed. */}
          <div style={{ display: "flex", position: "absolute", width: 64, height: 18, borderRadius: 9, background: "#ffffff" }} />
          <div style={{ display: "flex", position: "absolute", width: 18, height: 64, borderRadius: 9, background: "#ffffff" }} />
        </div>
        <RtlText text="صيدلية الشبراوي" size={84} style={{ fontWeight: 700 }} />
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700, opacity: 0.92 }}>Elshabrawy Pharmacy</div>
        <RtlText text="مستحضرات تجميل وفيتامينات ومكملات — توصيل سريع" size={30} style={{ opacity: 0.85 }} />
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Cairo", data: cairo, weight: 700, style: "normal" }],
    }
  );
}
