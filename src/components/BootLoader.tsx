// The loading screen shown wherever React is still waiting for a chunk or
// data. It paints the SAME screen as the boot splash in index.html (dark
// background, Eventicor wordmark, gold spinner), so the whole boot reads as
// ONE dark loader: the splash hands over invisibly and the lighter loading
// screen the app used to show after it is gone (user direction Nov 23 2026).
export default function BootLoader() {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        display: 'grid', placeItems: 'center', background: '#0a0917',
      }}
    >
      <div style={{ display: 'grid', placeItems: 'center', gap: 18 }}>
        <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 34, letterSpacing: '.02em', color: '#f4f1ea', fontWeight: 600 }}>Eventicor</div>
        <div style={{ width: 26, height: 26, borderRadius: '50%', border: '2.5px solid rgba(244,241,234,.25)', borderTopColor: '#c9a96a', animation: 'bootsplashspin .9s linear infinite' }} />
      </div>
      <style>{'@keyframes bootsplashspin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}
