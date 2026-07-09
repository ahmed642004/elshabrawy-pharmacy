import { ImageResponse } from "next/og";

// Apple touch icon (home-screen bookmark). Same mark as icon.tsx, larger.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0F52FF",
          borderRadius: 40,
        }}
      >
        <div style={{ display: "flex", position: "absolute", width: 96, height: 28, borderRadius: 14, background: "#ffffff" }} />
        <div style={{ display: "flex", position: "absolute", width: 28, height: 96, borderRadius: 14, background: "#ffffff" }} />
      </div>
    ),
    size
  );
}
