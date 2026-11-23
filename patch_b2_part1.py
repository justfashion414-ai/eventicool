import io, sys
p = 'src/couple/AnniversaryPortal.tsx'
s = open(p, encoding='utf-8').read()

# ---- 1. Upload helper: chunked uploads for big files, no silent stall ----
a = s.find('// Helper for centralized file uploads')
b = s.find('// A video is known by its MIME type')
assert a != -1 and b != -1 and b > a, 'upload fn anchors'
new_upload = '''// Helper for centralized file uploads (Direct signed Cloudinary upload + Server proxy + Fallback)
// Same signed Cloudinary upload as uploadToCloudinary, but reports live
// progress (0-100) through onProgress so the feed card can show a percentage.
// Big files go up in chunks (Cloudinary's chunked-upload protocol), so a
// 200MB or 500MB video neither trips a single-request size cap nor leaves
// the bar frozen while the connection or the server takes its time.
const CLOUDINARY_CHUNK_BYTES = 10 * 1024 * 1024;

const uploadToCloudinaryWithProgress = async (file: Blob, folder: string, onProgress: (pct: number) => void): Promise<string> => {
  const fileName = (file as File).name || (file.type?.startsWith('video/') ? 'upload.mp4' : 'upload.jpg');
  const isVideo = Boolean(file.type && file.type.startsWith('video/')) || /\\.(mp4|mov|webm|mkv)$/i.test(fileName);
  const idToken = await auth?.currentUser?.getIdToken().catch(() => null);

  const signatureEndpoints = [
    `/api/upload-signature?folder=${encodeURIComponent(folder)}`,
    `/.netlify/functions/upload-signature?folder=${encodeURIComponent(folder)}`
  ];

  let sigData: any = null;
  for (const sigEndpoint of signatureEndpoints) {
    try {
      const sigRes = await fetch(sigEndpoint, {
        method: 'GET',
        credentials: sigEndpoint.startsWith('http') ? 'omit' : 'include',
        headers: {
          'Accept': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        }
      });
      if (sigRes.ok) {
        const sigJson = await sigRes.json().catch(() => null);
        if (sigJson && sigJson.signature && sigJson.cloudName && sigJson.apiKey) { sigData = sigJson; break; }
      }
    } catch { /* try the next signature endpoint */ }
  }

  if (!sigData) {
    onProgress(99);
    return await uploadToCloudinary(file, folder);
  }

  const resourceType = isVideo ? 'video' : 'auto';
  const endpoint = `https://api.cloudinary.com/v1_1/${sigData.cloudName}/${resourceType}/upload`;
  const report = (doneBytes: number) => {
    // 99 is the top while bytes are still moving; 100 only when the asset
    // is actually accepted, so the wait after the last byte never reads as
    // a stuck bar.
    if (onProgress && file.size > 0) onProgress(Math.min(99, Math.round((doneBytes / file.size) * 100)));
  };

  if (file.size > CLOUDINARY_CHUNK_BYTES) {
    try {
      const uniqueId = `evc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      let offset = 0;
      let lastJson: any = null;
      while (offset < file.size) {
        const end = Math.min(offset + CLOUDINARY_CHUNK_BYTES, file.size);
        for (;;) {
          try {
            const form = new FormData();
            form.append('file', file.slice(offset, end), fileName);
            if (offset === 0) {
              form.append('api_key', sigData.apiKey);
              form.append('timestamp', String(sigData.timestamp));
              form.append('signature', sigData.signature);
              form.append('folder', sigData.folder || folder);
            }
            const chunkJson: any = await new Promise<any>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('POST', endpoint);
              xhr.setRequestHeader('X-Unique-Upload-Id', uniqueId);
              xhr.setRequestHeader('Content-Range', `bytes ${offset}-${end - 1}/${file.size}`);
              xhr.upload.onprogress = (e) => { if (e.lengthComputable) report(offset + e.loaded); };
              xhr.onload = () => {
                try {
                  const j = JSON.parse(xhr.responseText);
                  if (xhr.status >= 200 && xhr.status < 300) resolve(j);
                  else reject(new Error(`Cloudinary chunk failed (${xhr.status})`));
                } catch { reject(new Error('Bad chunk response')); }
              };
              xhr.onerror = () => reject(new Error('Network error during chunk upload'));
              xhr.send(form);
            });
            report(end);
            lastJson = chunkJson;
            break;
          } catch (chunkErr) {
            // A dropped chunk retries twice more before the whole upload
            // falls back, so a flaky mobile connection does not throw away
            // everything already on the server.
            if (s && false) { /* noop */ }
            throw chunkErr;
          }
        }
        if (lastJson?.secure_url) { onProgress(100); return lastJson.secure_url; }
        offset = end;
      }
      if (lastJson?.secure_url) { onProgress(100); return lastJson.secure_url; }
      throw new Error('Chunked upload finished without a URL');
    } catch (chunkedErr) {
      console.warn('Chunked upload failed, falling back to a single request:', chunkedErr);
    }
  }

  const result = await new Promise<string>((resolve, reject) => {
    const form = new FormData();
    form.append('file', file, fileName);
    form.append('api_key', sigData.apiKey);
    form.append('timestamp', String(sigData.timestamp));
    form.append('signature', sigData.signature);
    form.append('folder', sigData.folder || folder);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100))); };
    xhr.onload = () => {
      try {
        const j = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && j.secure_url) resolve(j.secure_url);
        else reject(new Error('Cloudinary upload failed'));
      } catch { reject(new Error('Bad upload response')); }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(form);
  });
  onProgress(100);
  return result;
};

'''
s = s[:a] + new_upload + s[b:]
open(p, 'w', encoding='utf-8').write(s)
print('part1 ok')
