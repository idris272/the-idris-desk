// ═══════════════════════════════════════════════════════════════════════════
// src/components/SectionMedia.jsx
// Background-media wrapper. Renders an image or autoplaying muted video
// behind its children with a configurable overlay tint.
// ═══════════════════════════════════════════════════════════════════════════

export default function SectionMedia({
  url,
  type = "image",
  overlay = "rgba(0,0,0,0.45)",
  minHeight = "auto",
  rounded = false,
  children,
  style: extraStyle = {},
}) {
  const wrapperStyle = {
    position: "relative",
    overflow: "hidden",
    minHeight,
    borderRadius: rounded ? "var(--radius-lg, 16px)" : 0,
    isolation: "isolate",
    ...extraStyle,
  };

  const hasMedia = Boolean(url);

  return (
    <div style={wrapperStyle}>
      {hasMedia && type === "video" && (
        <video
          src={url}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover",
            zIndex: 0,
          }}
        />
      )}
      {hasMedia && type !== "video" && (
        <div
          aria-hidden
          style={{
            position: "absolute", inset: 0,
            backgroundImage: `url(${url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            zIndex: 0,
          }}
        />
      )}
      {hasMedia && (
        <div
          aria-hidden
          style={{
            position: "absolute", inset: 0,
            background: overlay,
            zIndex: 1,
          }}
        />
      )}
      <div style={{ position: "relative", zIndex: 2 }}>
        {children}
      </div>
    </div>
  );
}
