p = 'src/couple/AnniversaryPortal.tsx'
s = open(p, encoding='utf-8').read()

# Fix the chunk retry loop: proper 3-attempt retry, drop the stray line.
old1 = """        for (;;) {
          try {"""
new1 = """        let attempt = 0;
        for (;;) {
          attempt += 1;
          try {"""
assert s.count(old1) == 1, f'anchor1 {s.count(old1)}'
s = s.replace(old1, new1)

old2 = """            if (s && false) { /* noop */ }
            throw chunkErr;"""
new2 = """            if (attempt >= 3) throw chunkErr;
            await new Promise((r) => setTimeout(r, 800 * attempt));"""
assert s.count(old2) == 1, f'anchor2 {s.count(old2)}'
s = s.replace(old2, new2)
open(p, 'w', encoding='utf-8').write(s)
print('part1b ok')
