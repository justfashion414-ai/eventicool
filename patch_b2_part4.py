p = 'src/couple/AnniversaryPortal.tsx'
s = open(p, encoding='utf-8').read()

# ---- 6. Album viewer: Post to feed button at the bottom corner ----
o_sig = "function AlbumMediaViewer({ items, startIndex, onClose, onDelete, onDownload }: { items: any[]; startIndex: number; onClose: () => void; onDelete?: (item: any) => void; onDownload?: (item: any) => void }) {"
n_sig = "function AlbumMediaViewer({ items, startIndex, onClose, onDelete, onDownload, onPostToFeed }: { items: any[]; startIndex: number; onClose: () => void; onDelete?: (item: any) => void; onDownload?: (item: any) => void; onPostToFeed?: (item: any) => void }) {"
assert s.count(o_sig) == 1, f'sig {s.count(o_sig)}'
s = s.replace(o_sig, n_sig)

o_close = """      )}
    </div>
  );
}

function DeleteConfirmationModal({"""
n_close = """      )}
      {onPostToFeed && (
        <button
          onClick={(e) => { e.stopPropagation(); onPostToFeed(item); }}
          className="absolute left-4 bottom-[92px] z-30 flex items-center gap-2 px-5 py-3 rounded-full bg-white text-[#21122B] font-black text-[0.7rem] uppercase tracking-widest shadow-xl"
          style={{ touchAction: 'manipulation' }}
        >
          <Send className="w-4 h-4" />
          Post to feed
        </button>
      )}
    </div>
  );
}

// A couple posts a photo or video straight from their albums to the feed.
// The event tag is required, the caption is optional, and no access code is
// asked for: this is the couple posting from their own dashboard.
function QuickPostToFeedModal({ media, coupleName, events, isDarkMode, onClose, onPosted }: any) {
  const [quickCaption, setQuickCaption] = useState('');
  const [quickEvent, setQuickEvent] = useState('');
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickOrientation, setQuickOrientation] = useState<'portrait' | 'landscape'>('landscape');

  // Album media carries no stored orientation; a portrait video belongs on
  // the Reels tab, so measure it while the popup is open (fallback landscape).
  useEffect(() => {
    if (!media || media.type !== 'video' || !media.url) return;
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    let settled = false;
    const finish = (o: 'portrait' | 'landscape') => { if (!settled) { settled = true; setQuickOrientation(o); } };
    v.onloadedmetadata = () => finish((v.videoHeight || 0) > (v.videoWidth || 0) ? 'portrait' : 'landscape');
    v.onerror = () => finish('landscape');
    v.src = media.url;
    const t = window.setTimeout(() => finish('landscape'), 4000);
    return () => { window.clearTimeout(t); };
  }, [media?.url]);

  const sendQuickPost = async () => {
    if (!quickEvent || quickBusy) return;
    setQuickBusy(true);
    try {
      const shared: any = {
        authorName: coupleName || 'The couple',
        text: quickCaption.trim(),
        mediaUrls: [media.url],
        mediaTypes: [media.type || 'image'],
        ...(media.type === 'video' && quickOrientation === 'portrait' ? { videoOrientation: 'portrait' } : {}),
        eventId: quickEvent,
        pending: false,
        likeCount: 0,
        loveCount: 0
      };
      if (DEMO) {
        onPosted({
          ...shared,
          id: `demo_${Date.now()}`,
          localDemo: true,
          authorUid: 'demo-self',
          authorPhoto: null,
          commentCount: 0,
          timestamp: new Date()
        });
        return;
      }
      await addDoc(collection(db, scopedPath('posts')), { ...shared, authorUid: 'admin', authorPhoto: null, timestamp: serverTimestamp() });
      onPosted(null);
    } catch (err) {
      console.error('Quick post error:', err);
      onPosted('error');
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/60 z-[820] backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        onClick={(e: any) => e.stopPropagation()}
        className={`fixed inset-x-4 top-1/2 -translate-y-1/2 z-[821] mx-auto max-w-md rounded-[24px] p-5 border shadow-2xl ${isDarkMode ? 'bg-[#0B171C] border-[#22363E] text-white' : 'bg-white border-[#DAD8E3] text-[#1A2B32]'}`}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h3 className="font-black font-display text-lg">Post to your feed</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="rounded-[16px] overflow-hidden bg-black mb-4 max-h-[240px] flex items-center justify-center">
          {media.type === 'video' ? (
            <video src={media.url} className="max-h-[240px] w-full object-contain" muted playsInline autoPlay loop />
          ) : (
            <img src={media.url} className="max-h-[240px] w-full object-contain" alt="" />
          )}
        </div>
        <p className="text-[0.65rem] uppercase tracking-widest font-black opacity-50 mb-2">Tag the part of the celebration</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {(events || []).map((e: any) => (
            <button key={e.id} type="button" onClick={() => setQuickEvent(quickEvent === e.id ? '' : e.id)} className={`px-4 py-2 rounded-full text-[0.8rem] font-bold border transition-all ${quickEvent === e.id ? 'bg-[var(--ann-accent)] text-white border-[var(--ann-accent)]' : (isDarkMode ? 'border-[#22363E] text-[#93A4AB]' : 'border-[#DAD8E3] text-[#5A6970]')}`}>{e.name}</button>
          ))}
        </div>
        <textarea
          value={quickCaption}
          onChange={(e) => setQuickCaption(e.target.value)}
          rows={2}
          placeholder="Add a caption (optional)"
          className={`w-full rounded-[14px] p-3 text-sm outline-none border mb-4 resize-none ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-[#F8F8FA] border-[#DAD8E3]'}`}
        />
        <button
          onClick={sendQuickPost}
          disabled={!quickEvent || quickBusy}
          className={`w-full py-3.5 rounded-full font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${quickEvent && !quickBusy ? 'bg-[var(--ann-accent)] text-white shadow-lg active:scale-[0.98]' : 'bg-[#DAD8E3] dark:bg-[#22363E] text-[#5A6970] opacity-50'}`}
          style={{ touchAction: 'manipulation' }}
        >
          {quickBusy ? <><RefreshCw className="w-4 h-4 animate-spin" /> Posting\u2026</> : <><Send className="w-4 h-4" /> Send to feed</>}
        </button>
      </motion.div>
    </>
  );
}

function DeleteConfirmationModal({"""
assert s.count(o_close) == 1, f'close {s.count(o_close)}'
s = s.replace(o_close, n_close)
open(p, 'w', encoding='utf-8').write(s)
print('part4 ok')
