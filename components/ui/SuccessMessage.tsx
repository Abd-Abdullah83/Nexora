export function SuccessMessage({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="rounded-sm border p-3 text-sm"
      style={{
        borderColor: "rgba(110, 231, 183, 0.4)",
        backgroundColor: "rgba(46, 92, 77, 0.25)",
        color: "#A7F3D0",
      }}
    >
      {children}
    </p>
  );
}
