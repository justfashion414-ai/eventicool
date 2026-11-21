p = 'src/couple/AnniversaryPortal.tsx'
s = open(p, encoding='utf-8').read()

# ---- 4. Reels fix: demo reels carry real mp4 URLs; render the video ----
# The isSample branch (ids starting demo-seed-) drew a static gradient and a
# play icon instead of the actual reel, which is what the user saw.
o_reels = """      {isSample ? (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: sampleArt(reel.eventName) }}>
          <div className="w-16 h-16 rounded-full bg-white/80 flex items-center justify-center">
            <Play className="w-7 h-7 text-[#21122B] fill-current ml-0.5" />
          </div>
        </div>
      ) : (
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-cover cursor-pointer"
        loop
        playsInline
        muted={muted}
        onClick={togglePlay}
      />
      )}"""
n_reels = """      {/* Demo and real reels alike carry a real video URL, so play it. The
          gradient placeholder only fills in for a reel with no media. */}
      {videoUrl ? (
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-cover cursor-pointer"
        loop
        playsInline
        muted={muted}
        onClick={togglePlay}
      />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: sampleArt(reel.eventName) }}>
          <div className="w-16 h-16 rounded-full bg-white/80 flex items-center justify-center">
            <Play className="w-7 h-7 text-[#21122B] fill-current ml-0.5" />
          </div>
        </div>
      )}"""
assert s.count(o_reels) == 1, f'reels {s.count(o_reels)}'
s = s.replace(o_reels, n_reels)

# ---- 5. Administrators card: drop the inline permission buttons ----
o_perms = """                            {(!adm.role || ['owner', 'couple', 'admin', 'bride', 'groom'].includes(adm.role)) && [
                              { id: 'canDeletePosts', label: 'Delete Posts' },
                              { id: 'canUploadImages', label: 'Upload Images' },
                              { id: 'canSetAccessCode', label: 'Access Code' }
                            ].map((p: any) => (
                              <button
                                key={p.id}
                                onClick={() => togglePermission(adm.email, p.id, adm.permissions?.[p.id])}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${adm.permissions?.[p.id] ? 'bg-[var(--ann-accent)] border-[var(--ann-accent)] text-white shadow-md' : 'opacity-40 border-current'}`}
                              >
                                {p.label}
                              </button>
                            ))}
"""
assert s.count(o_perms) == 1, f'perms {s.count(o_perms)}'
s = s.replace(o_perms, '')

open(p, 'w', encoding='utf-8').write(s)
print('part3 ok')
