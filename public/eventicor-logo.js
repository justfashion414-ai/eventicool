/* Eventicor logo web component. Usage: <eventicor-logo variant="horizontal|stacked|mark" theme="light|dark" size="64" tagline></eventicor-logo>
   Optional font (one line in <head>): <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600&display=swap"> */
(() => {
  if (customElements.get("eventicor-logo")) return;
  const CSS = `
:host{display:inline-block;line-height:0;--ink:#10211A;--green:#14805D;--gold:#F7B733;--coral:#FF6B4A;--s:64px}
:host([theme="dark"]){--ink:#F6F2E9;--green:#5BD6A6}
.wrap{display:inline-flex;align-items:center;gap:calc(var(--s)*.26)}
.wrap.stacked{flex-direction:column;gap:calc(var(--s)*.2);text-align:center}
.mark{width:var(--s);height:var(--s);display:block;overflow:visible;flex:none}
.text{display:flex;flex-direction:column;align-items:inherit;line-height:1}
.word{font-family:"Outfit","Sora","Avenir Next",system-ui,sans-serif;font-weight:600;font-size:calc(var(--s)*.58);letter-spacing:-.02em;color:var(--ink);white-space:nowrap}
.word .t{color:var(--green)}
.word span{display:inline-block}
.tag{font-family:"Outfit","Avenir Next",system-ui,sans-serif;font-weight:500;font-size:calc(var(--s)*.15);letter-spacing:.26em;text-transform:uppercase;color:var(--ink);opacity:.62;margin-top:calc(var(--s)*.1);white-space:nowrap}
.wrap{position:relative}
.wrap.mk{gap:0}
.ch.idot{position:relative}
.ball{position:absolute;left:0;top:0;width:calc(var(--s)*.1083);height:calc(var(--s)*.1083);border-radius:50%;background:var(--gold);pointer-events:none;will-change:transform;z-index:2}
.nob .bc,.nob .rp{display:none}
.rp{opacity:0}.shine{opacity:0}
.tile,.bc,.rp,.ch,.tag,.sp,.r1,.r2,.r3,.shd{transform-box:fill-box}
/* animation */
.go .tile{transform-origin:center;animation:pop .7s cubic-bezier(.2,1.3,.3,1) both}
.go .sp{transform-origin:50% 0;animation:grow-y .55s .35s cubic-bezier(.3,.9,.3,1) both}
.go .r2{animation:slide .6s .8s cubic-bezier(.2,.9,.3,1) both}
.go .r1{animation:slide .6s .95s cubic-bezier(.2,.9,.3,1) both}
.go .r3{animation:slide .6s 1.1s cubic-bezier(.2,.9,.3,1) both}
.go .shd{animation:fadein .5s 1.5s both}
.go .bc{transform-origin:center;animation:drop .8s 1.5s cubic-bezier(.3,.8,.4,1) both}
.go .rp{transform-origin:center;animation:ripple 3.4s 2.5s ease-out infinite}
.go .rp.b{animation-delay:3.6s}
.go .shine{animation:sweep 1.1s 2.6s ease-in-out 1,sweep 1.1s 10s ease-in-out infinite}
.go .ch{opacity:0;animation:rise .55s calc(.9s + var(--i)*.055s) cubic-bezier(.2,.9,.3,1) both}
.go .tag{opacity:0;animation:fade .8s 2s both}
@keyframes pop{from{transform:scale(0)}to{transform:scale(1)}}
@keyframes grow-y{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes slide{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:none}}
@keyframes fadein{from{opacity:0}to{opacity:1}}
@keyframes drop{0%{opacity:0;transform:translate(-8px,-52px) scale(.4)}55%{opacity:1;transform:translate(0,5px) scale(1.2,.85)}75%{transform:translate(0,-3px) scale(.95,1.08)}100%{opacity:1;transform:none}}
@keyframes ripple{0%{opacity:.55;transform:scale(1)}70%,100%{opacity:0;transform:scale(3.6)}}
@keyframes sweep{0%{opacity:.16;transform:translateX(0)}100%{opacity:.16;transform:translateX(190px)}}
@keyframes rise{from{opacity:0;transform:translateY(.45em)}to{opacity:1;transform:none}}
@keyframes fade{to{opacity:.62}}
@media (prefers-reduced-motion:reduce){.go *{animation:none!important;opacity:revert}.go .tag{opacity:.62}}
`;
  const MARK = `<svg class="mark" viewBox="0 0 120 120" role="img" aria-label="Eventicor">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#18905F"/><stop offset="1" stop-color="#07322A"/></linearGradient>
<radialGradient id="h" cx=".2" cy=".1" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".34"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
<linearGradient id="w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".3"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
<clipPath id="c"><rect width="120" height="120" rx="30"/></clipPath>
</defs>
<rect class="tile" width="120" height="120" rx="30" fill="url(#g)"/>
<rect width="120" height="120" rx="30" fill="url(#h)"/>
<rect x=".75" y=".75" width="118.5" height="118.5" rx="29.25" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="1.5"/>
<g clip-path="url(#c)"><rect class="shine" x="-50" y="-20" width="30" height="160" fill="#fff" transform="rotate(20 60 60)"/></g>
<g transform="translate(-3.5 0)">
<rect class="r2" x="40" y="52.5" width="37" height="15" rx="7.5" fill="#9BE5C4"/>
<rect class="sp" x="31" y="29" width="15" height="62" rx="7.5" fill="#FFF3D6"/>
<rect class="shd" x="46" y="52.5" width="8" height="15" fill="url(#w)"/>
<path class="r1" d="M38.5 29H84L78 36.5L84 44H38.5A7.5 7.5 0 0 1 38.5 29Z" fill="#F7B733" stroke="#F7B733" stroke-width="2" stroke-linejoin="round"/>
<path class="r3" d="M38.5 76H84L78 83.5L84 91H38.5A7.5 7.5 0 0 1 38.5 76Z" fill="#FF6B4A" stroke="#FF6B4A" stroke-width="2" stroke-linejoin="round"/>
<rect class="shd" x="31" y="44" width="15" height="7" fill="url(#v)"/>
<circle class="rp" cx="91" cy="60" r="6.5" fill="none" stroke="#F7B733" stroke-width="2"/>
<circle class="rp b" cx="91" cy="60" r="6.5" fill="none" stroke="#F7B733" stroke-width="2"/>
<circle class="bc" cx="91" cy="60" r="6.5" fill="#F7B733"/>
</g>
</svg>`;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  class EventicorLogo extends HTMLElement {
    static get observedAttributes() { return ["variant", "theme", "size", "animate", "tagline"]; }
    constructor() { super(); this.attachShadow({mode: "open"}); this._tok = 0; }
    connectedCallback() { this.render(); }
    disconnectedCallback() { this._tok++; }
    attributeChangedCallback() { if (this.isConnected) this.render(); }
    replay() { this.render(); }
    render() {
      const tok = ++this._tok;
      const v = this.getAttribute("variant") || "horizontal", size = parseFloat(this.getAttribute("size")) || 64;
      const anim = this.getAttribute("animate") !== "false", tag = this.hasAttribute("tagline") && this.getAttribute("tagline") !== "false" && v !== "mark";
      const travel = v !== "mark", still = !anim || matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.style.setProperty("--s", size + "px");
      const word = [..."Event"].map((ch, i) => `<span class="ch" style="--i:${i}">${ch}</span>`).join("") + `<span class="t"><span class="ch idot" style="--i:5">\u0131</span>` + [..."cor"].map((ch, i) => `<span class="ch" style="--i:${i + 6}">${ch}</span>`).join("") + `</span>`;
      const text = v === "mark" ? "" : `<div class="text"><div class="word" aria-hidden="true">${word}</div>${tag ? `<div class="tag">Host. Gather. Remember.</div>` : ""}</div>`;
      this.shadowRoot.innerHTML = `<style>${CSS}</style><div class="wrap ${v === "stacked" ? "stacked" : v === "mark" ? "mk" : ""} ${anim ? "go" : ""} ${travel && still ? "nob" : ""}">${MARK}${text}</div>`;
      if (travel) this._dot(tok, !still).catch(() => {});
    }
    /* The gold dot leaves the E, bounces across E-v-e-n-t and lands as the dot of the i. */
    async _dot(tok, travel) {
      const root = this.shadowRoot, wrap = root.querySelector(".wrap"), word = root.querySelector(".word"), idot = root.querySelector(".idot"), bc = root.querySelector(".bc");
      const letters = [...root.querySelectorAll(".ch")].slice(0, 5);
      const ball = document.createElement("div"); ball.className = "ball"; ball.style.visibility = "hidden"; wrap.appendChild(ball);
      const alive = () => tok === this._tok;
      const measure = () => {
        const cs = getComputedStyle(word), fs = parseFloat(cs.fontSize), ctx = document.createElement("canvas").getContext("2d");
        ctx.font = `${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
        const m = ctx.measureText("x"), wr = word.getBoundingClientRect(), base = wr.top + (wr.height - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
        const top = ch => base - ctx.measureText(ch).actualBoundingBoxAscent;
        const D = ball.getBoundingClientRect().width || parseFloat(getComputedStyle(this).getPropertyValue("--s")) * .1083, Dt = fs * .15;
        const ir = idot.getBoundingClientRect(), dotY = top("\u0131") - fs * .1 - Dt / 2;
        return {fs, D, Dt, top, ir, dotX: ir.left + ir.width / 2, dotY};
      };
      const settle = () => {
        const k = measure();
        ball.getAnimations().forEach(a => a.cancel());
        if (ball.parentNode !== idot) idot.appendChild(ball);
        Object.assign(ball.style, {visibility: "visible", left: "50%", top: ((k.dotY - k.ir.top) / k.fs) + "em", width: (k.Dt / k.fs) + "em", height: (k.Dt / k.fs) + "em", transform: "translate(-50%,-50%)"});
      };
      if (!travel) { settle(); Promise.race([document.fonts.ready, sleep(1500)]).then(() => alive() && settle()); return; }
      await Promise.race([document.fonts.ready, sleep(1500)]);
      await sleep(2600); if (!alive()) return;
      const k = measure(), wr = wrap.getBoundingClientRect(), rel = (x, y) => ({x: x - wr.left, y: y - wr.top});
      const br = bc.getBoundingClientRect(); let from = rel(br.left + br.width / 2, br.top + br.height / 2);
      const S = parseFloat(getComputedStyle(this).getPropertyValue("--s")) || 64;
      ball.style.visibility = "visible"; bc.style.visibility = "hidden"; root.querySelectorAll(".rp").forEach(r => r.style.display = "none");
      const tf = (p, sx, sy) => `translate(${p.x}px,${p.y}px) translate(-50%,-50%) scale(${sx},${sy})`;
      const hop = async (a, b, H, dur, s0 = 1, s1 = 1) => {
        const kf = [], N = 20;
        for (let i = 0; i <= N; i++) { const u = i / N, p = {x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u - 4 * H * u * (1 - u)}, sc = s0 + (s1 - s0) * u; kf.push({transform: tf(p, sc, sc)}); }
        await ball.animate(kf, {duration: dur, easing: "linear", fill: "forwards"}).finished;
      };
      const squash = el => el.animate([{transform: "none"}, {transform: "translateY(.04em) scaleY(.86)"}, {transform: "none"}], {duration: 240, easing: "ease-out"});
      const chars = ["E", "v", "e", "n", "t"];
      for (let i = 0; i < 5; i++) {
        const r = letters[i].getBoundingClientRect(), to = rel(r.left + r.width / 2, k.top(chars[i]) - k.D / 2);
        letters[i].style.transformOrigin = "50% 100%";
        await hop(from, to, S * (i ? .34 : .62), i ? 380 : 560); if (!alive()) return;
        squash(letters[i]); from = to;
      }
      const end = rel(k.dotX, k.dotY), sc = k.Dt / k.D;
      await hop(from, end, S * .5, 560, 1, sc); if (!alive()) return;
      await ball.animate([{transform: tf(end, sc, sc)}, {transform: tf(end, sc * 1.35, sc * .7)}, {transform: tf(end, sc * .92, sc * 1.1)}, {transform: tf(end, sc, sc)}], {duration: 380, easing: "ease-out", fill: "forwards"}).finished;
      if (!alive()) return;
      settle(); document.fonts.ready.then(() => alive() && settle());
    }
  }
  customElements.define("eventicor-logo", EventicorLogo);
})();
