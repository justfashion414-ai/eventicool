p = 'src/couple/AnniversaryPortal.tsx'
s = open(p, encoding='utf-8').read()

# ---- 2. Album batch: three files upload side by side ----
a = s.find('    setAlbumUploading(true);')
b = s.find('    const title = albumAddTarget')
assert a != -1 and b != -1 and b > a, f'album anchors {a} {b}'
new_loop = '''    setAlbumUploading(true);
    setAlbumProgressPct(0);
    const totalFiles = albumPicked.length;
    const results: ({ url: string; type: 'image' | 'video' } | null)[] = new Array(totalFiles).fill(null);
    let failed = 0;
    let completed = 0;
    // Several files upload side by side (three at a time) instead of one
    // after another, so a batch of videos finishes in roughly a third of
    // the wait.
    const queue = albumPicked.map((picked, i) => ({ file: picked.file, i }));
    const worker = async () => {
      while (queue.length) {
        const job = queue.shift()!;
        try {
          let url: string;
          if (DEMO) {
            // The demo console keeps everything in the browser: photos shrink to
            // data URLs, videos play from a session blob URL (a full video can
            // never fit in a demo data URL or the demo store).
            url = isVideoFile(job.file) ? URL.createObjectURL(job.file) : await demoImageDataUrl(job.file);
          } else {
            url = await uploadToCloudinaryWithProgress(job.file, 'albums', (pct) => {
              setAlbumProgressPct(Math.min(99, Math.round(((completed + pct / 100) / totalFiles) * 100)));
            });
          }
          results[job.i] = { url, type: isVideoFile(job.file) ? 'video' : 'image' };
        } catch (err) {
          failed += 1;
          console.error('Album upload error:', err);
        }
        completed += 1;
        setAlbumProgressPct(Math.min(99, Math.round((completed / totalFiles) * 100)));
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    const media: { url: string; type: 'image' | 'video' }[] = results.filter(Boolean) as any;
    setAlbumProgressPct(100);
'''
s = s[:a] + new_loop + s[b:]

# ---- 3. Finishing-up labels: the wait after the last byte is never silent ----
o1 = '<p className="text-[0.7rem] opacity-50">Uploading\u2026 {pct}%</p>'
n1 = '<p className="text-[0.7rem] opacity-50">{pct >= 99 ? \'Finishing up\u2026\' : `Uploading\u2026 ${pct}%`}</p>'
assert s.count(o1) == 1, f'label1 {s.count(o1)}'
s = s.replace(o1, n1)
o2 = '<p className="text-white font-black text-sm">{pct}%</p>'
n2 = '<p className="text-white font-black text-sm">{pct >= 99 ? \'Finishing up\u2026\' : `${pct}%`}</p>'
assert s.count(o2) == 1, f'label2 {s.count(o2)}'
s = s.replace(o2, n2)
o3 = '<p className="text-[0.65rem] opacity-60 text-center mt-1.5">Uploading\u2026 {albumProgressPct}%</p>'
n3 = '<p className="text-[0.65rem] opacity-60 text-center mt-1.5">{albumProgressPct >= 100 ? \'Saving your album\u2026\' : `Uploading\u2026 ${albumProgressPct}%`}</p>'
assert s.count(o3) == 1, f'label3 {s.count(o3)}'
s = s.replace(o3, n3)

open(p, 'w', encoding='utf-8').write(s)
print('part2 ok')
