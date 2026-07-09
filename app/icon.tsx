import { ImageResponse } from "next/og";

// PNG favicon (complements the legacy favicon.ico). Plus mark drawn with
// divs so no font loading is needed.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 7,
        }}
      >
        <div style={{ display: "flex", position: "absolute", width: 18, height: 6, borderRadius: 3, background: "#ffffff" }} />
        <div style={{ display: "flex", position: "absolute", width: 6, height: 18, borderRadius: 3, background: "#ffffff" }} />
      </div>
    ),
    size
  );
}
