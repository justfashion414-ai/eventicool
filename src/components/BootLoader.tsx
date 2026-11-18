// The loading screen shown wherever React is still waiting for a chunk. It
// mirrors the boot splash in index.html exactly, so the handover from the
// splash to this screen (and from this screen to the app) is invisible and
// the user never sees a blank page while the app finishes loading.
export default function BootLoader() {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        display: 'grid', placeItems: 'center', background: '#0a0917',
      }}
    >
      <div
        style={{
          width: 26, height: 26, borderRadius: '50%',
          border: '2.5px solid rgba(244,241,234,.25)', borderTopColor: '#c9a96a',
          animation: 'bootsplashspin .9s linear infinite',
        }}
      />
      <style>{'@keyframes bootsplashspin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}
