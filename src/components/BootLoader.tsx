// The loading screen shown wherever React is still waiting for a chunk. It
// mirrors the boot splash in index.html exactly, so the handover from the
// splash to this screen (and from this screen to the app) is invisible and
// the user never sees a blank page while the app finishes loading.
export default function BootLoader() {
  // No spinner: a quiet Eventicor banner while the app loads, handed over
  // to the entry banner (or the app itself) the moment it is ready.
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        display: 'grid', placeItems: 'center', background: '#0a0917',
      }}
    >
      <div
        style={{
          fontFamily: '"Playfair Display", Georgia, serif', fontStyle: 'italic',
          fontSize: 32, letterSpacing: '.02em', color: '#f4f1ea',
          animation: 'bootsplashpulse 1.8s ease-in-out infinite',
        }}
      >
        Eventicor
      </div>
      <style>{'@keyframes bootsplashpulse{0%,100%{opacity:.5}50%{opacity:1}}'}</style>
    </div>
  );
}
