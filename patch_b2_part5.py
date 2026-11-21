p = 'src/couple/AnniversaryPortal.tsx'
s = open(p, encoding='utf-8').read()

# Send icon import (skip if already present)
import re
if not re.search(r"\bSend\b", s[:6000]):
    o = ", Banknote, Copy } from 'lucide-react';"
    n = ", Banknote, Copy, Send } from 'lucide-react';"
    assert s.count(o) == 1, f'import {s.count(o)}'
    s = s.replace(o, n)

# ---- 7. Dashboard state + gate ----
o_state = "  const [albumMediaView, setAlbumMediaView] = useState<{ items: any[]; index: number } | null>(null);"
n_state = """  const [albumMediaView, setAlbumMediaView] = useState<{ items: any[]; index: number } | null>(null);
  // Posting an album photo or video straight to the feed from its viewer.
  const [quickPostToFeed, setQuickPostToFeed] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const canPostToFeed = !selfRole || ['owner', 'couple', 'admin', 'bride', 'groom'].includes(selfRole);"""
assert s.count(o_state) == 1, f'state {s.count(o_state)}'
s = s.replace(o_state, n_state)

# ---- 8. Viewer wiring + quick modal render ----
o_use = """                      onDelete={(item: any) => setConfirmAsk({ title: 'Remove from album?', message: 'This one comes out of the album. This cannot be undone.', confirmLabel: 'Remove', action: () => deleteAlbumMedia(albumViewer, item) })}
                    />
                  )}"""
n_use = """                      onDelete={(item: any) => setConfirmAsk({ title: 'Remove from album?', message: 'This one comes out of the album. This cannot be undone.', confirmLabel: 'Remove', action: () => deleteAlbumMedia(albumViewer, item) })}
                      onPostToFeed={canPostToFeed ? (item: any) => { setQuickPostToFeed({ url: item.url, type: item.type || 'image' }); setAlbumMediaView(null); } : undefined}
                    />
                  )}

                  {quickPostToFeed && (
                    <QuickPostToFeedModal
                      media={quickPostToFeed}
                      coupleName={(() => { const b = (weddingDetails as any)?.bride; const g = (weddingDetails as any)?.groom; return b && g ? `${b} & ${g}` : demoHeader(); })()}
                      events={Array.isArray(events) && events.length ? events : (demoEvents() as any[])}
                      isDarkMode={isDarkMode}
                      onClose={() => setQuickPostToFeed(null)}
                      onPosted={(res: any) => {
                        if (res === 'error') { showToast('Could not post to the feed. Try again.', 'error'); setQuickPostToFeed(null); return; }
                        if (res) onAdminDemoPost && onAdminDemoPost(res);
                        showToast('Posted to your feed.');
                        setQuickPostToFeed(null);
                      }}
                    />
                  )}"""
assert s.count(o_use) == 1, f'use {s.count(o_use)}'
s = s.replace(o_use, n_use)

# ---- 9. Prop plumbing ----
o_prop = "  onDeletePost\n}: any) {"
n_prop = "  onDeletePost,\n  onAdminDemoPost\n}: any) {"
assert s.count(o_prop) == 1, f'prop {s.count(o_prop)}'
s = s.replace(o_prop, n_prop)

o_inst = """        onDeletePost={(id: string) => {
          setIsAdminDashboardOpen(false);
          setPostToDelete(id);
        }}"""
n_inst = """        onDeletePost={(id: string) => {
          setIsAdminDashboardOpen(false);
          setPostToDelete(id);
        }}
        onAdminDemoPost={(p: any) => setPosts((prev: any[]) => [p, ...prev])}"""
assert s.count(o_inst) == 1, f'inst {s.count(o_inst)}'
s = s.replace(o_inst, n_inst)

open(p, 'w', encoding='utf-8').write(s)
print('part5 ok')
