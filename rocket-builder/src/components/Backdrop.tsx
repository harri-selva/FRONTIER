export function Backdrop() {
  return (
    <>
      <div className="vw-backdrop" aria-hidden="true">
        <div className="vw-stars" />
        <div className="vw-sun" />
        <div className="vw-grid" />
      </div>
      <div className="vw-scanlines" aria-hidden="true" />
    </>
  );
}
