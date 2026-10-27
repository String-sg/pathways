// check_hover.mjs: every button, link and label, one at a time, in its :hover and :active look.
//   PSE_TMP=<folder> node app/src/ui/_fixtures/check_hover.mjs <absolute path to a built page> [label]
// It caught the black-on-black joined bars.
// every interactive element, one at a time, in its :hover and :active look (the rules copied onto [data-fx]); the words in it
// must keep 4.5:1 (3:1 for large type) against what is really behind them, light and dark, phone and laptop
import { launch, page } from './cdp.mjs';
const [file, label] = process.argv.slice(2);
const b = await launch(9381); const out = {};
const LIB = `
window.__parse = c => { const m = c.match(/[\\d.]+/g); if (!m) return null; const v = m.slice(0, 4).map(Number); return /^color\\(srgb/.test(c) ? [v[0]*255, v[1]*255, v[2]*255, v[3]] : v; };
window.__lum = ([r,g,b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }; return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b); };
window.__ratio = (a, b) => { const x = __lum(a), y = __lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
window.__bg = el => { const st = []; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); let c = __parse(cs.backgroundColor);
    const img = cs.backgroundImage; if (img && img.startsWith('linear-gradient')) { const g = __parse(img.replace(/^linear-gradient\\(/, '')); if (g) st.push(g); }
    if (c && (c[3] === undefined || c[3] > 0)) { st.push(c); if (c[3] === undefined || c[3] >= 1) break; } }
  let base = [255,255,255]; for (let i = st.length - 1; i >= 0; i--) { const c = st[i], a = c[3] === undefined ? 1 : c[3]; base = [0,1,2].map(k => c[k]*a + base[k]*(1-a)); } return base; };
window.__check = root => { const bad = []; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) { const n = w.currentNode; if (!n.textContent.trim()) continue; const el = n.parentElement; const r = el.getBoundingClientRect(); if (!r.width) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden') continue; const fg = __parse(cs.color), bg = __bg(el), a = fg[3] === undefined ? 1 : fg[3];
    const f = [0,1,2].map(k => fg[k]*a + bg[k]*(1-a)); const size = parseFloat(cs.fontSize), need = (size >= 24 || (size >= 18.66 && +cs.fontWeight >= 700)) ? 3 : 4.5;
    const rr = __ratio(f, bg); if (rr < need) bad.push(n.textContent.trim().slice(0, 24) + ' ' + rr.toFixed(2)); }
  return bad; };
window.__fx = pseudo => { const st = document.createElement('style'); let css = '';
  for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch (e) { continue; }
    const walk = rules => { for (const r of rules) { if (r.selectorText && r.selectorText.includes(':' + pseudo)) css += r.selectorText.split(':' + pseudo).join('[data-fx]') + '{' + r.style.cssText + '}\\n'; if (r.cssRules) walk(r.cssRules); } }; walk(rs); }
  st.textContent = css; document.head.appendChild(st); return st; };
window.__scan = () => { const res = {}; for (const pseudo of ['hover', 'active']) { const st = __fx(pseudo); const bad = [];
    for (const el of document.querySelectorAll('button, a, summary, [role=button], label')) { const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      el.setAttribute('data-fx', ''); const x = __check(el); el.removeAttribute('data-fx'); if (x.length) bad.push((el.className && el.className.baseVal === undefined ? el.className : el.tagName) + ': ' + x.join(' | ')); }
    st.remove(); res[pseudo] = [...new Set(bad)].slice(0, 12); } return res; };`;
try {
  for (const [w, h] of [[375, 812], [1440, 900]]) for (const dark of [false, true]) {
    const p = await page(b, 'file://' + file + '#demo-SEC2027JP', { width: w, height: h, dark, calm: true });
    await new Promise(r => setTimeout(r, 1200)); await p.eval(LIB + ';1');
    const tag = w + (dark ? ' dark' : ' light');
    out[tag] = await p.eval(`(async () => { const W = ms => new Promise(r => setTimeout(r, ms)); const res = {};
      res.results = __scan();
      const ed = document.querySelector('.subj-open'); if (ed) { ed.click(); await W(400); }
      [...document.querySelectorAll('.srow-open')].slice(0, 2).forEach(b => b.click()); await W(300);
      res.subjects = __scan();
      location.hash = 'courses'; await W(700); res.courses = __scan();
      const f = document.querySelector('[data-do="sheet-filter"]'); if (f) { f.click(); await W(300); res.filter = __scan(); const x = document.querySelector('#sheet [data-do="sheet-close"]'); x && x.click(); await W(200); }
      const c = document.querySelector('#s-list .cc-main'); if (c) { c.click(); await W(600); res.details = __scan(); }
      location.hash = 'starred'; await W(500); res.starred = __scan();
      location.hash = 'dates'; await W(500); res.dates = __scan();
      document.querySelector('#about-i').click(); await W(300); res.about = __scan();
      return res; })()`);
    await p.close();
  }
} finally { b.close(); }
const bad = []; for (const [k, v] of Object.entries(out)) for (const [s, r] of Object.entries(v)) for (const [ps, list] of Object.entries(r)) if (list.length) bad.push(`${label} ${k} ${s} :${ps} → ${list.join(' ;; ')}`);
console.log(bad.length ? bad.join('\n') : `${label}: no hover or tap state under 4.5:1 (${Object.keys(out).length} views × 9 screens)`);
