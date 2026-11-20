// Receipt Tip — github.com/veraetogrex-portfolio · zero dependencies
// A restaurant bill you pull longer to tip. Drag the tab on the total down to a stop (10, 15 or 20% of the subtotal):
// a tip tape comes out between subtotal and total, one tick per percent, and the total rides down with it.
// Every number follows the bill's length, so the tape, the stop and the total always agree. Push it back to take the tip off.

const root  = document.querySelector('#bill');
const foot  = root.querySelector('.rb-foot');
const tape  = root.querySelector('.rb-tape');
const ticks = root.querySelector('.rb-ticks');
const read  = root.querySelector('.rb-read');
const readP = root.querySelector('.rb-read-p');
const readOf = root.querySelector('.rb-read-of');
const readV = root.querySelector('.rb-read-v');
const total = root.querySelector('.rb-total');
const tab   = root.querySelector('.rb-tab');
const pay   = root.querySelector('.rb-pay');
const stops = [...root.querySelectorAll('.rb-stop')];

const STOPS = stops.map(s => +s.dataset.rate);           // 0, 10, 15, 20
const PX = 14, TAPE = 320, SEAM = 160, TAB = 48;          // 1% of tip = 14px of bill; tape length; seam and tab centre, px from the top
const len = r => r * PX;                                  // how much longer the bill is at a stop
const cents = c => '$' + (c / 100).toFixed(2);
const SUB = [...root.querySelectorAll('.rb-dish')].reduce((s, d) => s + Math.round(d.dataset.price * 100), 0);
const tipOf = r => Math.round(SUB * r / 100);             // tips count from the subtotal

let h = 0, shown = -1, rate = 0, anim = 0;               // h: how far the bill is pulled out; shown: the stop it has reached

// print the tape: a tick per percent, a long one every five; and the stops beside the bill
ticks.innerHTML = Array.from({ length: 21 }, (_, k) => `<i class="${k % 5 ? '' : 'is-five'}" style="top:${TAPE - len(k)}px"></i>`).join('');
stops.forEach((s, i) => { s.style.top = `${SEAM + len(STOPS[i]) + TAB}px`; if (STOPS[i]) s.querySelector('small').textContent = cents(tipOf(STOPS[i])); });
root.querySelector('.rb-scale').style.cssText = `--from:${SEAM + TAB}px;--len:${len(20)}px`;
root.querySelector('.rb-sub-v').textContent = cents(SUB);

// a number whose digits are columns 0–9: a new value moves only the columns that change
function odometer(el, text, instant = false) {
  if (el.dataset.v === undefined || el.dataset.v.length !== text.length) {
    el.innerHTML = [...text].map(ch => /\d/.test(ch)
      ? `<span class="rb-dg"><span class="rb-col">${[...'0123456789'].map(d => `<span>${d}</span>`).join('')}</span></span>`
      : `<span>${ch}</span>`).join('');
    instant = true;
  }
  el.dataset.v = text;
  [...el.children].forEach((cell, i) => {
    const col = cell.firstElementChild; if (!col) return;
    if (instant) col.style.transition = 'none';
    col.style.transform = `translateY(${-text[i]}em)`;
    if (instant) { col.offsetWidth; col.style.transition = ''; }
  });
}

// one frame: the foot and the tape move by h, and the numbers follow the bill's length.
// Growing, the tape reads the last stop it has passed; pushed back by hand, the next stop up (the total drops only once the tape is in).
// Going back to a stop on its own (closing), the print stays and slides under the subtotal while the total counts down with the length.
function draw(next, { instant = false, closing = false } = {}) {
  const from = h; h = Math.max(0, next);
  foot.style.transform = `translateY(${h}px)`;
  tape.style.transform = `translateY(${h - TAPE}px)`;
  if (closing) {
    const tip = Math.min(tipOf(Math.max(0, shown)), Math.ceil(SUB * h / PX / 100 / 100) * 100);   // whole dollars still out, $0 only when the tape is in; never above the tip shown
    odometer(total, cents(SUB + tip));
    return;
  }
  const at = h < from - .01 ? (STOPS.find(r => len(r) >= h - .5) ?? STOPS[STOPS.length - 1]) : STOPS.filter(r => len(r) <= h + .5).pop();
  if (at === shown && !instant) return;
  shown = at;
  stops.forEach((s, i) => s.classList.toggle('is-on', STOPS[i] === at));
  read.classList.toggle('is-off', !at);
  if (at) { readP.textContent = `${at}%`; readOf.textContent = `of ${cents(SUB)}`; odometer(readV, cents(tipOf(at)), true); }   // the tape is printed: it never rolls
  odometer(total, cents(SUB + tipOf(at)), instant);
  total.setAttribute('aria-label', `Total ${cents(SUB + tipOf(at))}${at ? `, tip ${cents(tipOf(at))}` : ''}`);
}

// settle on a stop: a short pull with a small click past it
const settle = t => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
const smooth = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;   // closing: one even push back in
function goTo(r) {
  rate = r;
  tab.setAttribute('aria-valuenow', r); tab.setAttribute('aria-valuetext', r ? `${r}%, ${cents(tipOf(r))}` : 'No tip');
  const id = ++anim, from = h, to = len(r), ms = to < from ? 650 : Math.min(700, 300 + Math.abs(to - from) * 1.4), t0 = performance.now();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return draw(to, { instant: true });
  const closing = to < from;
  if (closing) stops.forEach((s, i) => s.classList.toggle('is-on', STOPS[i] === r));   // the chosen stop lights at once
  const step = now => {
    if (id !== anim) return;
    const p = Math.min(1, (now - t0) / ms);
    if (p < 1) { draw(from + (to - from) * (closing ? smooth(p) : settle(p)), { closing }); requestAnimationFrame(step); }
    else draw(to, { instant: true });                          // on the stop: everything reads the stop
  };
  requestAnimationFrame(step);
}
const nearest = x => STOPS.reduce((a, r) => Math.abs(len(r) - x) < Math.abs(len(a) - x) ? r : a, 0);

// drag the tab: the bill follows the pointer, a little stiff past the last stop; on release it clicks into the nearest stop
let drag = null;
const scale = () => root.getBoundingClientRect().width / root.offsetWidth;   // CSS zoom and any outer transform
tab.addEventListener('pointerdown', e => {
  anim++; drag = { y: e.clientY, h, k: scale(), moved: false };
  root.classList.add('is-drag');
  try { tab.setPointerCapture(e.pointerId); } catch (_) {}
  e.preventDefault();
});
addEventListener('pointermove', e => {
  if (!drag) return;
  const raw = drag.h + (e.clientY - drag.y) / drag.k, max = len(20);
  if (Math.abs(e.clientY - drag.y) > 3) drag.moved = true;
  draw(raw > max ? Math.min(max + 30, max + (raw - max) * .3) : raw);
});
const release = () => {
  if (!drag) return;
  const moved = drag.moved; drag = null; root.classList.remove('is-drag');
  if (moved) goTo(nearest(h)); else tab.focus();
};
addEventListener('pointerup', release); addEventListener('pointercancel', release);

// the stops are buttons; the chosen one again takes the tip off
stops.forEach((s, i) => s.addEventListener('click', () => goTo(STOPS[i] === rate ? 0 : STOPS[i])));
tab.addEventListener('keydown', e => {
  const k = STOPS.indexOf(rate), last = STOPS.length - 1;
  const to = { ArrowDown: k + 1, ArrowRight: k + 1, ArrowUp: k - 1, ArrowLeft: k - 1, Home: 0, End: last, Delete: 0, Backspace: 0 }[e.key];
  if (to === undefined) return;
  e.preventDefault(); goTo(STOPS[Math.max(0, Math.min(last, to))]);
});
// paying is the host app's job: the component only reports what would be paid
pay.addEventListener('click', () => root.dispatchEvent(new CustomEvent('bill:pay', { bubbles: true,
  detail: { subtotal: SUB / 100, rate, tip: tipOf(rate) / 100, total: (SUB + tipOf(rate)) / 100 } })));

function reset() {
  anim++; drag = null; rate = 0; shown = -1;
  root.classList.add('is-reset'); root.classList.remove('is-drag');
  tab.setAttribute('aria-valuenow', 0); tab.setAttribute('aria-valuetext', 'No tip');
  draw(0, { instant: true });
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('is-reset')));
}

reset();
root.bill = { reset, goTo, tab, stop: r => stops[STOPS.indexOf(r)], rate: () => rate, length: () => h, at: r => SEAM + len(r) + TAB };   // for scripted demos
