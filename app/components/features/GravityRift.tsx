export function GravityRift({ size = 40 }: { size?: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        flexShrink: 0,
        background: "black",
        borderRadius: "50%",
        width: size,
        height: size,
        border: `${size / 20}px solid white`,
        boxShadow: `0 0 ${size / 5}px ${size / 8}px rgba(255, 255, 255, 0.8)`,
      }}
    />
  );
}
