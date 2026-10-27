import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { launch, page as rawPage, sleep } from './cdp.mjs';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..') + '/';

// ------------------------------------------------------------------------------------------------ arguments
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const URL0 = argv.find(a => /^https?:|^file:/.test(a));
if (!URL0) { console.error('usage: node qa_data.mjs <page url> [--port=9472] [--students=200] [--seed=1018] [--only=1,2,3] [--json=file] [--truth=file]'); process.exit(2); }
const PORT = Number(arg('port', '9472'));
const N_STUDENTS = Number(arg('students', '200'));
const SEED = Number(arg('seed', '1018'));
const ONLY = arg('only', '').split(',').filter(Boolean);
const want = k => !ONLY.length || ONLY.includes(String(k));
const TODAY = arg('today', '');  // freeze the page's clock (yyyy-mm-dd); default: the real clock
const JSON_OUT = arg('json', '');
const TRUTH_OUT = arg('truth', '');
const STORE_KEY = 'rosetta-sg-pse-atlas-v0.3';
const TMP_GIVEN = arg('tmp', '');
process.env.PSE_TMP = TMP_GIVEN || fs.mkdtempSync(path.join(os.tmpdir(), 'qa-data-'));
fs.mkdirSync(process.env.PSE_TMP, { recursive: true });
const PROFILES_BEFORE = new Set(fs.readdirSync(process.env.PSE_TMP));  // Chrome's profile folders made by this run are deleted at the end

// ------------------------------------------------------------------------------------------------ the result table
const CHECKS = [];
function check(group, id, name) {
  const c = { group, id, name, items: 0, bad: [], notes: [] };
  CHECKS.push(c);
  return {
    c,
    ok(n = 1) { c.items += n; },
    fail(msg) { c.items += 1; c.bad.push(String(msg)); },
    ass(cond, msg) { if (cond) c.items += 1; else this.fail(msg); },
    eq(a, b, msg) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x === y) c.items += 1; else this.fail(msg + ': page=' + x + ' want=' + y); },
    note(t) { if (c.notes.indexOf(t) < 0) c.notes.push(t); }
  };
}
const INFO = [];  // facts for the report that are not pass/fail
const info = (k, v) => INFO.push({ k, v });
const VERBOSE = argv.includes('--verbose');
const say = m => { if (VERBOSE) process.stderr.write(m + '\n'); };

// ------------------------------------------------------------------------------------------------ sources
function csvParse(text) {
  text = text.replace(/^﻿/, '');
  const out = []; let cur = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { cur.push(f); f = ''; }
    else if (ch === '\n') { cur.push(f); out.push(cur); cur = []; f = ''; }
    else if (ch === '\r') { /* skip */ }
    else f += ch;
  }
  if (f || cur.length) { cur.push(f); out.push(cur); }
  const head = out.shift();
  return out.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const readCsv = rel => csvParse(fs.readFileSync(ROOT + rel, 'utf8'));
const latest = (dir, pre) => { const f = fs.readdirSync(ROOT + dir).filter(x => x.startsWith(pre) && x.endsWith('.csv')).sort().pop(); return dir + '/' + f; };

const DATA = JSON.parse(fs.readFileSync(ROOT + 'app/build/data.json', 'utf8'));
const COLS = DATA.courses.columns;
const ROWS = DATA.courses.rows.map(r => Object.fromEntries(COLS.map((k, i) => [k, r[i]])));
const RECS = DATA.requirements.records;
const ROW_OF_KEY = new Map(RECS.map(r => [r.key, ROWS[r.course]]));
const REC_OF_KEY = new Map(RECS.map(r => [r.key, r]));
const DEFS = new Map(DATA.definitions.definitions.map(d => [d.id, d]));
const PSE = require(ROOT + 'app/src/pse_core.js');
PSE.load({ definitions: DATA.definitions, requirements: DATA.requirements, courses: DATA.courses });
const TAXONOMY_REL = latest('data/taxonomy', 'course_taxonomy_');
const EXERCISES_REL = latest('data/exercises', 'exercises_');
const TAX = readCsv(TAXONOMY_REL);
const FILLS = readCsv('data/calendar/exercise_date_fills.csv');
const TERMS = readCsv('data/calendar/school_terms.csv');
const EXERCISES = readCsv(EXERCISES_REL);
const LEP_CSV = readCsv('data/taxonomy/lep_host_jcs.csv');
const SNAPSHOT = DATA.snapshot_date;

// ------------------------------------------------------------------------------------------------ small helpers
const signed = n => n > 0 ? '+' + n : n < 0 ? '−' + (-n) : '0';  // the page writes the true minus sign
const rangeText = r => r[0] === r[1] ? String(r[0]) : r[0] + '–' + r[1];
const pillClass = n => n >= 2 ? 'g-spare' : n >= -1 ? 'g-close' : 'g-short';  // K1: +2 or more green; -1..+1 amber; -2 or less outline
const letters = id => { const d = DEFS.get(id); return (d && d.letters) || String(id).replace(/[:(].*$/, ''); };
const G3 = ['A1', 'A2', 'B3', 'B4', 'C5', 'C6', 'D7', 'E8', 'F9'];
const roundHalfUp = v => Math.floor(v + 0.5);

const mapG2 = p => p <= 3 ? 1 : p <= 6 ? 2 : p - 4;
const estimateRef = (kind, x) => Math.max(1, kind === 'L1R4' ? Math.min(16, roundHalfUp(x * 5 / 6)) : Math.min(22, roundHalfUp(x * 4 / 5 + mapG2(roundHalfUp(x / 5)))));
const estKindOf = agg => /^L1R4/.test(agg) ? 'L1R4' : /^ELR2B2-[ABCD]/.test(agg) ? 'ELR2B2' : '';
const m5 = p => Math.min(5, mapG2(p));
const fiveSubjectEstimate = x => Math.max(1, (x % 5) * m5(Math.floor(x / 5) + 1) + (5 - (x % 5)) * m5(Math.floor(x / 5)));
const asItIs = (x, cap) => Math.max(1, cap ? Math.min(cap, x) : x);
const ITE3_AGG = /^(R2B2|R1B3-[ABC]|B4)\(2027\)$/;
const FIVE_OLEVEL = ['ELR2B2-C', 'ELR1B3-B', 'ELB4-A'];
const JIEH_OF = new Map(ROWS.filter(r => r.institution_type === 'ITE' && r.admission_route === 'JIEH').map(r => [r.institution + '|' + r.course_name, r]));
// the wording after an estimate
const fromWords = basis => basis === 'olevel' ? '(from 2026 O-Level cut-offs)' : '(from 2026)';
// the 2028 estimate of one course row: { range, from, basis } or null (basis: 'jae' | 'mi' | 'jie' | 'olevel')
function estimateOfRow(row, agg) {
  if (!row) return null;
  const one = (src, f) => Array.isArray(src) ? { range: [f(src[0]), f(src[1])], from: src.slice() } : null;
  if (agg === 'L1R4(2027)') {
    if (row.institution_type === 'JC' && row.aggregate_type === 'L1R5') { const e = one(row.net_range_2026, x => estimateRef('L1R4', x)); return e && Object.assign(e, { basis: 'jae' }); }
    if (row.institution_type === 'MI' && row.aggregate_type === 'L1R4') { const e = one(row.net_range_2026, x => asItIs(x, 20)); return e && Object.assign(e, { basis: 'mi' }); }
    return null;
  }
  if (/^ELR2B2-[ABCD]\(2027\)$/.test(agg)) {
    if (row.institution_type !== 'Polytechnic' || row.aggregate_type !== agg.replace(/\(.*$/, '')) return null;
    const e = one(row.net_range_2026, x => estimateRef('ELR2B2', x)); return e && Object.assign(e, { basis: 'jae' });
  }
  if (ITE3_AGG.test(agg)) {
    if (row.institution_type !== 'ITE' || row.admission_route !== 'JIEN') return null;
    const e = one(row.net_range_2026, x => asItIs(x)); return e && Object.assign(e, { basis: 'jie' });
  }
  if (agg === 'ELMAB3:ITE(2027)') {
    if (row.institution_type !== 'ITE') return null;
    const h = JIEH_OF.get(row.institution + '|' + row.course_name);
    const eh = h && one(h.net_range_2026, x => asItIs(x)); if (eh) return Object.assign(eh, { basis: 'jie' });
    if (row.admission_route === 'JAE' && FIVE_OLEVEL.includes(row.aggregate_type)) { const e = one(row.net_range_2026, fiveSubjectEstimate); return e && Object.assign(e, { basis: 'olevel' }); }
    return null;
  }
  return null;
}

// seeded random numbers
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const RND = rng(SEED);
const pick = a => a[Math.floor(RND() * a.length)];
const chance = p => RND() < p;
const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += RND(); return (u - 3) / Math.sqrt(0.5); };

// ================================================================================================ browser helpers
const browser = await launch(PORT);
const FREEZE = TODAY ? `(function(){var D=Date,off=new D('${TODAY}T12:00:00+08:00').getTime()-D.now();
  function F(a,b,c,d,e,f,g){ if(!arguments.length) return new D(D.now()+off); return new D(a,b,c,d,e,f,g); }
  var P=new Proxy(D,{construct:function(t,args){ return args.length?new (Function.prototype.bind.apply(D,[null].concat(args)))():new D(D.now()+off); },get:function(t,k){ if(k==='now') return function(){return D.now()+off}; return t[k]; }});
  window.Date=P; })();` : '';
async function openPage(hash, opts = {}) {
  const p = await rawPage(browser, 'about:blank', Object.assign({ calm: true }, opts));
  if (FREEZE) await p.send('Page.addScriptToEvaluateOnNewDocument', { source: FREEZE });
  return p;
}
async function loadState(p, st, hash = '#courses') {
  // the page keeps its state in localStorage and nothing writes it back on unload: set it, reload, and the page boots with it
  const here = await p.eval('location.origin + location.pathname');
  const want = new URL(URL0).origin + new URL(URL0).pathname;
  if (here !== want) { await p.goto('about:blank'); await p.goto(URL0 + '#input'); }
  await p.eval(`try { localStorage.setItem(${JSON.stringify(STORE_KEY)}, ${JSON.stringify(JSON.stringify(st))}); } catch (e) {} history.replaceState(null, '', ${JSON.stringify(hash)}); 1`);
  // the route chips are kept for the visit only, in sessionStorage
  await p.eval(`try { sessionStorage.setItem(${JSON.stringify(STORE_KEY + '-where')}, ${JSON.stringify(JSON.stringify(st.where || []))}); } catch (e) {} 1`);
  // the Group control's choice is kept for the visit; every student starts on None
  await p.eval(`try { sessionStorage.removeItem(${JSON.stringify(STORE_KEY + '-group')}); } catch (e) {} 1`);
  await p.reload();
  await sleep(100);
}
let GRP_SEEN = 0;
let rowSeq = 0;
function row(name, level, grade, extra = {}) {
  rowSeq += 1;
  return Object.assign({ id: 'q' + rowSeq, core: '', pick: '', name, level, grade: String(grade), mark: '', skip: false, added: true }, extra);
}
function state(p) {
  return Object.assign({ year: 2026, level: 'O', mode: 'grade', rows: [], cca: 'Good', where: [], school: '', lep: 'None', fields: [], riasec: [],
    insts: [], q: '', sort: '', fold: {}, showNo: {}, showMore: {}, showNoRange: {}, subOpen: {}, reach: false, allow: 0, stars: [], allEx: false,
    calc: true }, p);  // a student whose results are in has tapped "Calculate my aggregates"
}

// the app's card model, for the browser to hand back
const MODEL = `(() => {
  const A = window.PSE_ATLAS; const C = A.cards() || [];
  const res = A.result() || {};
  return { version: A.version, state: A.state(), sent: res.sent ? res.sent.subjects : [], bonus: res.bonus || null, error: !!res.error, problems: (res.problems || []).length,
    cards: C.map(c => ({ key: c.key, id: c.id, kind: c.kind, where: c.where, sec: c.sec, title: c.title, inst: c.inst, insts: c.insts, field: c.field, fields: c.fields || null,
      codes: c.codes, iteCodes: c.iteCodes || [], state: c.state, streams: c.streams || null, special: !!c.special, cluster: c.cluster || '',
      best: c.best ? { label: c.best.label, state: c.best.state } : null,
      diplomas: c.diplomas ? c.diplomas.map(d => ({ name: d.name, state: d.state })) : null,
      arts: c.kind === 'arts' ? { state: c.offers[0].arts.state, value: c.offers[0].arts.value, who: c.offers[0].arts.who } : null,
      offers: c.offers.map(o => ({ label: o.label, state: o.state, mixed: !!o.mixed, gap: o.gap ? { kind: o.gap.kind, n: o.gap.n == null ? null : o.gap.n, range: o.gap.range || null, agg: o.gap.agg, ex: o.gap.ex || '', est: o.gap.est ? { range: o.gap.est.range, from: o.gap.est.from, fromAgg: o.gap.est.fromAgg } : null } : null,
        net: o.net ? { value: o.net.value, base: o.net.base, marks: o.net.marks || '', aff: o.net.aff || 0, lep: o.net.lep || 0 } : null,
        r: o.r ? { exercise: o.r.exercise, stream: o.r.stream, institution: o.r.institution, course_code: o.r.course_code, course_name: o.r.course_name, field_of_study: o.r.field_of_study,
          aggregate_id: o.r.aggregate_id, gross: o.r.gross, net: o.r.net, net_range_2026: o.r.net_range_2026, eligible: o.r.eligible, moe_url: o.r.moe_url, institution_url: o.r.institution_url,
          requirement_key: o.r.requirement_key, ite_course_code: o.r.ite_course_code, jc_stream: o.r.jc_stream, pfp_cluster: o.r.pfp_cluster, route: o.r.route,
          net_range_basis: o.r.net_range_basis, aggregate_display_name: o.r.aggregate_display_name } : null })) })) };
})()`;

// open every group, sub-group and fold of the list, then read the DOM card by card (and the counts beside the folds)
const OPEN = `(async () => {
  const w = ms => new Promise(r => setTimeout(r, ms));
  const sel = (what) => what.map(s => '#s-list ' + s + '[aria-expanded="false"]').join(',');
  for (let i = 0; i < 300; i++) { const b = document.querySelector(sel(['.group-head', '.sub-head', '.not-open'])); if (!b) break; b.click(); await w(6); }
  return 1;
})()`;
const CLOSE_FOLDS = `(async () => {
  const w = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 400; i++) { const b = document.querySelector('#s-list .btn-more[aria-expanded="true"]'); if (!b) break; b.click(); await w(6); }
  return 1;
})()`;
const OPEN_FOLDS = `(async () => {
  const w = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 400; i++) { const b = document.querySelector('#s-list .btn-more[aria-expanded="false"]'); if (!b) break; b.click(); await w(6); }
  return 1;
})()`;
// each group says whether it holds a listed section (a section with a route band: such a route's head carries no number of its own); a section head is its band's name
const COUNTS = `(() => {
  const n = el => { const c = el && el.querySelector(':scope > .count, :scope .count'); return c ? Number(c.textContent) : 0; };
  const groups = [...document.querySelectorAll('#s-list section.group')].map(g => {
    const head = g.querySelector('.group-head, .g-title');
    return { wid: g.id.replace(/^g-/, ''), listed: !!g.querySelector('.rb-band'), n: head ? n(head) : 0, open: !head || !head.classList.contains('group-head') || head.getAttribute('aria-expanded') === 'true',
      text: head ? head.innerText.replace(/\\s+/g, ' ').trim().slice(0, 160) : '', nCards: g.querySelectorAll('article.cc, .jct-r').length, nMore: [...g.querySelectorAll('.btn-more')].map(b => b.textContent.replace(/\\s+/g, ' ').trim()).join(' | '),
      remind: (g.querySelector('.g-remind') || {}).textContent || '', bold: [...g.querySelectorAll('.g-remind b')].map(x => x.textContent.trim()), why: [...g.querySelectorAll('.g-why')].map(x => x.textContent), tools: [...g.querySelectorAll('.g-tools .tchip')].map(x => x.textContent.replace(/\\s+/g, ' ').trim()) };
  });
  const secs = [...document.querySelectorAll('#s-list .sec')].map(s => {
    const h = s.querySelector(':scope > .sec-h'), rb = s.querySelector(':scope > .rb-band .rb-h'), bn = s.querySelector(':scope > .rb-band .rb-n');
    return { id: s.id.replace(/^sec-/, ''), head: h ? h.firstChild.textContent.trim() : rb ? rb.textContent.trim() : null, n: h ? n(h) : null, rb: !!rb, band: bn ? [...bn.querySelectorAll('b')].map(b => Number(b.textContent)) : null, remind: (s.querySelector(':scope > .sec-remind') || {}).textContent || '',
      note: (s.querySelector(':scope > .g-note') || {}).textContent || '', wid: (s.closest('section.group') || {}).id,
      rough: (() => { const k = s.cloneNode(true); k.querySelectorAll('.cc, .jct-r, .cards, .jct').forEach(x => x.remove()); return /rough/i.test(k.textContent); })() };
  });
  // each group head ("Within reach · 22") with the cards drawn under it before any fold is opened, and whether a "Show N more" button follows
  const grps = [...document.querySelectorAll('#s-list .grp')].map(g => { const c = g.nextElementSibling, f = c && c.nextElementSibling; return { sec: (g.closest('.sec') || {}).id ? g.closest('.sec').id.replace(/^sec-/, '') : '', text: g.textContent.replace(/\\s+/g, ' ').trim(), shown: c && c.classList.contains('cards') ? c.querySelectorAll('.cc').length : 0, more: !!(f && f.dataset && f.dataset.do === 'show-long') }; });
  const subs = [...document.querySelectorAll('#s-list .sub-head')].map(h => ({ sec: h.closest('.sec').id.replace(/^sec-/, ''), v: h.dataset.v, name: (h.querySelector('.g-name') || {}).textContent || '', g: h.querySelector('.cnt-g') ? Number(h.querySelector('.cnt-g').textContent) : null, a: h.querySelector('.cnt-a') ? Number(h.querySelector('.cnt-a').textContent) : null }));
  const folds = [...document.querySelectorAll('#s-list .btn-more')].map(b => ({ do: b.dataset.do, v: b.dataset.v, text: b.textContent, n: Number((/(\\d+)/.exec(b.textContent) || [])[1] || 0),
    sec: b.closest('.sec') ? b.closest('.sec').id.replace(/^sec-/, '') : '' }));
  const ov = [...document.querySelectorAll('#s-list .ov-stt')].map(x => x.textContent.replace(/\\s+/g, ' ').trim());
  return { groups, secs, subs, grps, folds, ov, another: !!document.querySelector('#s-list button.another:not(.not-open)'), anotherText: ((document.querySelector('#s-list button.another:not(.not-open)') || {}).textContent || '').replace(/\\s+/g, ' ').trim(),
    notOpen: (() => { const b = document.querySelector('#s-list button.not-open'); return b ? { text: b.textContent.replace(/\\s+/g, ' ').trim(), why: [...document.querySelectorAll('#s-list .not-open-why li')].map(li => ({ who: (li.querySelector('b') || {}).textContent || '', text: li.textContent.replace(/\\s+/g, ' ').trim() })) } : null; })() };
})()`;
// /the reader takes the element it reads in, so one function reads the list (#s-list) and an overview's list (the right pane on a laptop, the section on a phone)
const CARDS_READ = `(ROOT => {
  const pillOf = p => p ? { text: p.firstChild ? p.childNodes[0].textContent : p.textContent, sup: (p.querySelector('sup') || {}).textContent || '', cls: [...p.classList].filter(c => /^g-/.test(c))[0] || '' } : null;
  const badgeOf = g => ({ label: (g.querySelector('.gap-l') || {}).textContent || '', rng: (g.querySelector('.rng') || {}).textContent || '', ind: /indicative/i.test(g.textContent), pill: pillOf(g.querySelector('.pill')) });
  const seg = el => { let blk = el.closest('.cards, .jct'); if (!blk) return 'main';
    // FIX_r3 item 2: IB-only schools sit in a second table (.jct-ib) after the main one, in the same fold: the button is before the main table
    if (blk.classList.contains('jct-ib') && blk.previousElementSibling && blk.previousElementSibling.classList.contains('jct')) blk = blk.previousElementSibling;
    const prev = blk.previousElementSibling; return prev && prev.classList.contains('btn-more') ? prev.dataset.do : 'main'; };
  const out = [];
  ROOT.querySelectorAll('.cc[data-key]').forEach(a => {
    const sec = a.closest('.sec'), grp = a.closest('section.group'), sub = a.closest('.sub');
    // the group heading a card sits under: .grp (Within reach / Borderline), .divider (No published cut-off), the fold button (Out of reach: N more), or a table's caption row
    const grpOf = el => { if (el.classList.contains('jct-r')) { let q = el.previousElementSibling; while (q && !q.classList.contains('jct-gh')) q = q.previousElementSibling; return q ? q.textContent.replace(/\\s+/g, ' ').trim() : ''; }
      const blk = el.closest('.cards'); let q = blk && blk.previousElementSibling; while (q && !(q.classList.contains('grp') || q.classList.contains('divider') || q.classList.contains('btn-more'))) q = q.previousElementSibling; return q ? q.textContent.replace(/\\s+/g, ' ').trim() : ''; };
    const rec = { key: a.dataset.key, table: a.classList.contains('jct-r'), seg: seg(a), grp: grpOf(a), sec: sec ? sec.id.replace(/^sec-/, '') : '', wid: grp ? grp.id.replace(/^g-/, '') : '', sub: sub ? sub.querySelector('.sub-head').dataset.v : '',
      title: (a.querySelector('.cc-title') || {}).textContent || '', inst: (a.querySelector('.cc-inst') || {}).textContent || '', cls: a.className,
      miss: [...a.querySelectorAll('.cc-miss')].map(m => m.textContent.replace(/\\s+/g, ' ').trim()),   // what a Borderline or Out of reach course is missing
      tags: [...a.querySelectorAll('.cc-tags .tag')].map(t => t.textContent.trim()) };
    if (rec.table) {
      rec.cells = [...a.querySelectorAll(':scope > .jct-c')].map(c => ({ n: (c.querySelector('.jct-n') || {}).textContent || '', pill: pillOf(c.querySelector('.pill')), muted: c.classList.contains('muted'), text: c.textContent.trim() }));
      rec.extra = [...a.querySelectorAll('.jct-x')].map(x => ({ label: (x.querySelector('[data-wc="0"]') || {}).textContent || '', text: x.textContent.replace(/\\s+/g, ' ').trim(), pill: pillOf(x.querySelector('.pill')) }));
    } else {
      rec.badges = [...a.querySelectorAll('.cc-badges > *')].map(g => g.classList.contains('gapr') ? Object.assign({ kind: 'gap' }, badgeOf(g)) : { kind: g.className, text: g.textContent.replace(/\\s+/g, ' ').trim() });
    }
    out.push(rec);
  });
  return out;
})`;
const CARDS_DOM = `(${CARDS_READ})(document.getElementById('s-list'))`;
const DETAIL_DOM = `(() => {
  const el = document.querySelector('#s-pane .det'); if (!el) return null;
  const t = s => (s || '').replace(/\\s+/g, ' ').trim();
  const pill = r => r.querySelector('.pill');
  return { title: t((el.querySelector('.det-title') || {}).textContent), nline: t((el.querySelector('.det-offers .nline') || {}).textContent), nlineB: (el.querySelector('.det-offers .nline b') || {}).textContent || '', sup: (el.querySelector('.det-offers .nline sup') || {}).textContent || '',
    rlines: [...el.querySelectorAll('.det-offers .rline')].map(r => ({ text: t(r.textContent), cls: pill(r) ? ([...pill(r).classList].find(c => /^g-/.test(c)) || '') : '' })),
    slots: [...el.querySelectorAll('table.slots tbody tr:not(.tot)')].map(tr => Number(tr.querySelector('td.num').textContent)),
    slotRows: [...el.querySelectorAll('table.slots tbody tr:not(.tot)')].map(tr => ({ slot: tr.querySelector('th').textContent.trim(), text: t(tr.children[1].textContent), pts: Number(tr.querySelector('td.num').textContent) })),
    total: Number((el.querySelector('table.slots tr.tot td.num') || {}).textContent), totalLine: t((el.querySelector('p.total') || {}).textContent) };
})()`;
const SPLIT_SECS = ['poly', 'ppoly', 'ite2', 'pite2', 'jien', 'pite3', 'dpp', 'dppvia'];  // sections whose cards are one per course and institution
const SPLITSET = new Set(SPLIT_SECS);
const ITE_SHORT_SECS = ['ite2', 'pite2', 'jien', 'pite3', 'dpp'];  // brief E: inside a "2-year / 3-year Higher Nitec" section a title drops "Higher Nitec in " and " (2 Years)" / " (3 Years)"
// the sections a tile stands for, by the words of its label (PW_ROW in the page): "JC, MI · L1R4" is the JC and MI sections
const SECS_OF = { JC: ['jc', 'pjc'], MI: ['mi', 'pmi'], Poly: ['poly', 'ppoly'], PFP: ['pfp', 'ppfp'], DPP: ['dpp', 'dppvia'], ITE: ['ite2'], 'ITE 2-year': ['pite2'], 'ITE 3-year': ['jien', 'pite3'], Arts: ['ai', 'pai'], 'NAFA Foundation Programme': ['nfp', 'pnfp'] };
// the pathway names a pop-over line uses (PW_NAME in the page), and the sections each stands for
const PW_SECS = { 'JC': ['jc', 'pjc'], 'MI': ['mi', 'pmi'], 'Polytechnic Year 1': ['poly', 'ppoly'], 'PFP': ['pfp', 'ppfp'], 'DPP': ['dppvia', 'dpp'], 'ITE 2-year': ['ite2', 'pite2'], 'ITE 3-year': ['jien', 'pite3'], 'Arts diplomas': ['ai', 'pai'], 'NAFA Foundation Programme': ['nfp', 'pnfp'] };
const PW_NAME_OF = Object.fromEntries(Object.entries(PW_SECS).flatMap(([n, ids]) => ids.map(i => [i, n])));
const tileWords = tl => tl.label.replace(/ \u00B7.*$/, '').split(', ').map(x => x.trim());
const iteShortTitle = t => String(t).replace(/^Higher Nitec in /, '').replace(/ \([23] Years\)$/, '');
// the top of Courses: the tiles with their pop-over lines, the route chips, the toolbar and the filter chips under it, and whatever took away
const TOP_DOM = `(() => {
  const t = s => (s || '').replace(/\\s+/g, ' ').trim(), q = s => document.querySelector(s);
  const L = document.getElementById('s-list');
  return {
    // the 5th-year tile stands for no course section; it is read on its own and checked against the engine's summary (2.13)
    fifth: (() => { const b = L.querySelector('#aggs-c .tile[data-v="fifth"]'); return b ? { label: t((b.querySelector('.t-k') || {}).textContent), num: t((b.querySelector('.agg-n, .t-r') || {}).textContent),
      word: t((b.querySelector('.t-w') || {}).textContent), lines: [...b.nextElementSibling.querySelectorAll('.tip-l')].map(l => t(l.textContent)) } : null; })(),
    tiles: [...L.querySelectorAll('#aggs-c .tile-w')].filter(w => w.querySelector('.tile').dataset.v !== 'fifth').map(w => { const b = w.querySelector('.tile'), tip = w.querySelector('.ind-tip'); return { label: t((b.querySelector('.t-k') || {}).textContent), num: t((b.querySelector('.agg-n, .t-r') || {}).textContent),
      word: t((b.querySelector('.t-w') || {}).textContent), off: b.classList.contains('off'), chk: b.classList.contains('chk'), key: b.dataset.v, title: b.getAttribute('title'), lines: [...w.querySelectorAll('.tip-l')].map(l => t(l.textContent)), aria: tip ? tip.getAttribute('aria-label') : '' }; }),
    rchips: [...L.querySelectorAll('.rchips .rchip')].map(b => ({ w: b.dataset.v, on: b.classList.contains('on'), x: b.dataset.do === 'route-hide', add: b.dataset.do === 'route-add', label: t((b.querySelector('[data-wc]') || {}).textContent) })),
    rchipsAfterTiles: (() => { const a = L.querySelector('#aggs-c'), r = L.querySelector('.rchips'); return !!a && !!r && a.nextElementSibling === r; })(),
    tbar: (() => { const b = q('#tbar'); if (!b) return null; return { group: [...b.querySelectorAll('[data-do="groupby"]')].map(x => ({ v: x.dataset.v, on: x.getAttribute('aria-pressed') === 'true', t: t(x.textContent) })),
      filter: (() => { const f = b.querySelector('[data-do="sheet-filter"]'); return f ? { text: t(f.textContent), n: Number((f.querySelector('.count') || {}).textContent || 0) } : null; })(), map: !!b.querySelector('a[href="#map"]'),
      sticky: getComputedStyle(b).position }; })(),
    fchips: [...L.querySelectorAll('.fchips .fchip')].map(x => ({ k: x.dataset.k, v: x.dataset.v, t: t(x.textContent) })), showAll: !!L.querySelector('.fchips [data-do="clear-filters"]'),
    gone: { sort: !!q('[data-do="sheet-sort"]'), sheetField: !!q('[data-do="sheet-field"]'), sheetInst: !!q('[data-do="sheet-inst"]'), gTools: !!L.querySelector('.g-tools'), next: !!L.querySelector('.next-line') || /^\\s*Next:/m.test(L.innerText), foot: !!q('.foot'),
      notOpen: !!L.querySelector('.not-open') || /Not open to you/.test(L.innerText), alsoOpen: /Also open to you/.test(L.innerText), remind: !!L.querySelector('.g-remind, .sec-remind'), tileTitle: !!L.querySelector('.tile[title]') }
  };
})()`;
const normDom = (dom, mode) => {
  dom.forEach(d => {
    d.mode = mode;
    const m = /^(.*) · (\d+)$/.exec(d.grp); if (m) { d.grp = m[1]; d.grpN = Number(m[2]); }  // a group head reads "Within reach · 22"
    if (SPLITSET.has(d.sec)) {
      const sp = d.sub ? d.sub.split('|') : [];  // sec | grouping | the group's name
      const lab = d.inst.split(' · ');
      d.cardInst = sp[1] === 'inst' ? sp.slice(2).join('|') : lab[0];
      d.cardField = sp[1] === 'field' ? sp.slice(2).join('|') : sp[1] === 'inst' ? d.inst : (lab[1] || '');
      d.baseKey = d.key; d.key = d.baseKey + '@' + d.cardInst;
    }
  });
  return dom;
};
// reads Courses in each grouping asked for (the first is None): everything opened, the cards read. Returns { counts, dom } of the first, and reads = [{ mode, counts, dom }] for all
async function expandAndRead(p, modes = ['none']) {
  const reads = [];
  for (const mode of modes) {
    if (mode !== 'none' || modes.length > 1) { await p.eval(`(document.querySelector('[data-do="groupby"][data-v="${mode}"]') || { click() {} }).click(); 1`); await sleep(60); }
    await p.eval(CLOSE_FOLDS);  // folds as the page draws them ("Out of reach: N more"), whatever an earlier read left open
    await p.eval(OPEN);
    const counts = await p.eval(COUNTS);
    await p.eval(OPEN_FOLDS);
    counts.top = await p.eval(TOP_DOM);
    reads.push({ mode, counts, dom: normDom(await p.eval(CARDS_DOM), mode) });
  }
  if (modes.length > 1 || modes[0] !== 'none') { await p.eval(`(document.querySelector('[data-do="groupby"][data-v="none"]') || { click() {} }).click(); 1`); await sleep(40); }
  return { counts: reads[0].counts, dom: reads[0].dom, reads };
}

// ================================================================================================ the page's own copies of the data
let PAGE_HTML = '';
try { PAGE_HTML = await (await fetch(URL0)).text(); } catch (e) { PAGE_HTML = ''; }
const block = id => { const m = new RegExp('<script[^>]*id="' + id + '"[^>]*>([\\s\\S]*?)</script>').exec(PAGE_HTML); return m ? JSON.parse(m[1]) : null; };
const PAGE_DATA = block('pse-data');  // the engine data the page ships
const PAGE_EXTRA = block('page-data');  // institutions, schools, calendar, riasec, arts, subject levels

// ================================================================================================ 1 Course table
async function check1() {
  // 1.1 same rows, one to one
  const c11 = check(1, '1.1', 'data.json and the taxonomy CSV hold the same courses, one to one');
  const key = (t, d) => [t.institution_type, t.institution, t.course_code, t.admission_route, t.ite_course_code || ''].join('|');
  const taxBy = new Map(TAX.map(t => [key(t), t]));
  const seen = new Set();
  ROWS.forEach(r => {
    const k = key(r); const t = taxBy.get(k);
    if (!t) { c11.fail('in data.json, not in the CSV: ' + k); return; }
    if (seen.has(k)) { c11.fail('duplicate key in data.json: ' + k); return; }
    seen.add(k); c11.ok();
  });
  TAX.forEach(t => { if (!seen.has(key(t))) c11.fail('in the CSV, not in data.json: ' + key(t)); else c11.ok(); });
  c11.ass(ROWS.length === TAX.length, 'row counts differ: data.json ' + ROWS.length + ', CSV ' + TAX.length);
  info('course rows', ROWS.length + ' in data.json, ' + TAX.length + ' in ' + TAXONOMY_REL.split('/').pop());

  // 1.2 every field on every row
  const c12 = check(1, '1.2', 'name, institution, code, field, aggregate type, range and links match the CSV on every row');
  ROWS.forEach(r => {
    const t = taxBy.get(key(r)); if (!t) return;
    const want = {
      course_name: t.course_name, field_of_study: t.field_of_study, faculty_or_school: t.faculty_or_school, aggregate_type: t.aggregate_type,
      moe_url: t.moe_page_url, institution_url: t.course_page_url, duration: t.duration, stream: t.stream, pfp_cluster: t.pfp_cluster, pfp_subcluster: t.pfp_subcluster,
      net_range_2026: t.net_agg_min !== '' && t.net_agg_max !== '' ? [Number(t.net_agg_min), Number(t.net_agg_max)] : null
    };
    let bad = false;
    Object.keys(want).forEach(k => {
      const a = JSON.stringify(r[k] == null ? (k === 'net_range_2026' ? null : '') : r[k]), b = JSON.stringify(want[k]);
      if (a !== b) { c12.fail(r.id + ' ' + k + ': data.json=' + a + ' csv=' + b); bad = true; }
    });
    if (!bad) c12.ok();
  });

  // 1.3 ranges make sense
  const c13 = check(1, '1.3', 'every published range has low <= high, whole numbers, and sits inside the aggregate\'s possible values');
  let ranged = 0, unranged = 0;
  ROWS.forEach(r => {
    const v = r.net_range_2026;
    if (!v) { unranged++; return; }
    ranged++;
    const defId = (r.exercises.find(e => /\(2026\)$/.test(e[2])) || [])[2];
    const slots = defId && DEFS.get(defId) ? DEFS.get(defId).slots.length : 6;
    const ok = Array.isArray(v) && v.length === 2 && Number.isInteger(v[0]) && Number.isInteger(v[1]) && v[0] >= 0 && v[0] <= v[1] && v[1] <= slots * 9;
    c13.ass(ok, r.id + ' range ' + JSON.stringify(v) + ' (aggregate ' + (defId || '?') + ', ' + slots + ' slots)');
  });
  info('published 2026 ranges', ranged + ' of ' + ROWS.length + ' rows have one; ' + unranged + ' do not (no_net_aggregate_range)');

  // 1.4 links
  const c14 = check(1, '1.4', 'every course has an https CourseFinder/SchoolFinder link; ids are unique');
  const ids = new Set();
  const noInstRows = [];
  ROWS.forEach(r => {
    c14.ass(!ids.has(r.id), 'duplicate id ' + r.id); ids.add(r.id);
    c14.ass(/^https:\/\//.test(r.moe_url || ''), r.id + ' moe_url ' + JSON.stringify(r.moe_url));
    if (!/^https:\/\//.test(r.institution_url || '')) noInstRows.push(r); else c14.ok();
  });
  const byInst = {}; noInstRows.forEach(r => { byInst[r.institution] = (byInst[r.institution] || 0) + 1; });
  info('courses with no institution course-page link', noInstRows.length + ' of ' + ROWS.length + ' (' + Object.entries(byInst).map(([k, v]) => k + ' ' + v).join(', ') + '); the page then shows only the CourseFinder link');

  // 1.5 the page ships exactly this data
  const c15 = check(1, '1.5', 'the data inside the page equals app/build/data.json (courses, requirements, definitions, LEP hosts)');
  if (!PAGE_DATA) c15.fail('no pse-data block found in the page');
  else {
    ['courses', 'requirements', 'definitions', 'lep_hosts', 'snapshot_date', 'engine_version', 'matcher_version'].forEach(k => {
      let a = PAGE_DATA[k], b = DATA[k];
      if (k === 'requirements') {  // the page's build drops PFP snapshot ranges (critic finding 5): compare the rest
        const strip = x => JSON.parse(JSON.stringify(x), (kk, v) => (kk === 'net_range_2026' ? undefined : v));
        a = strip(a); b = strip(b);
      }
      c15.ass(JSON.stringify(a) === JSON.stringify(b), 'page copy of ' + k + ' differs from data.json');
    });
  }
  info('data version', 'snapshot ' + SNAPSHOT + ', engine ' + DATA.engine_version + ', matcher ' + DATA.matcher_version);

  // 1.10 words the page must never carry (the floor)
  const c110 = check(1, '1.10', 'the page file and app/build/data.json never carry a local file path');
  c110.ass(PAGE_HTML.length > 1000, 'could not read the page file');
  c110.ass(!/[\/\\](?:Users|home)[\/\\]\w/.test(PAGE_HTML), 'the page file carries a local path');
  c110.ass(!/[\/\\](?:Users|home)[\/\\]\w/.test(JSON.stringify(DATA)), 'data.json carries a local path');
  // 1.5b the raw CourseFinder scrape (data/snapshots/<date>/*.csv): the first source of the taxonomy
  const c19 = check(1, '1.9', 'the raw CourseFinder snapshot (poly, ITE, JC scrapes) agrees with data.json on course name, aggregate type and range, row by row');
  const snapDir = 'data/snapshots/' + SNAPSHOT;
  if (fs.existsSync(ROOT + snapDir)) {
    const poly = readCsv(snapDir + '/poly_courses_master_data.csv'), ite = readCsv(snapDir + '/ite_courses_master_data.csv'), jc = readCsv(snapDir + '/jc_jae_courses.csv');
    const num = v => v === 'N/A' || v === '' || v == null ? null : Number(v);
    const rng = (a, b) => num(a) != null && num(b) != null ? [num(a), num(b)] : null;
    const idx = new Map();
    poly.forEach(r => idx.set('Polytechnic|' + r['Course Code'] + '|' + (r['Polytechnic'] || ''), { name: r['Course Name'], agg: r['Aggregate Type'], range: rng(r['Net Aggregate Min'], r['Net Aggregate Max']), moe: r['MOE Course Page'] }));
    ite.forEach(r => idx.set('ITE|' + r['Course Code'] + '|' + r['Admission Route'] + '|' + r['College'], { name: r['Course Name'], agg: r['Aggregate Type'], range: rng(r['Net Aggregate Min'], r['Net Aggregate Max']), moe: r['MOE Course Page'] }));
    jc.forEach(r => idx.set('JC|' + r['JAE Course Code'] + '|' + r['School Name'], { name: r['Stream'], agg: r['Aggregate Group'], range: rng(r['Aggregate Lower'], r['Aggregate Upper']) }));
    let missing = 0;
    ROWS.forEach(r => {
      const k = r.institution_type === 'Polytechnic' ? 'Polytechnic|' + r.course_code + '|' + r.institution : r.institution_type === 'ITE' ? 'ITE|' + r.course_code + '|' + { JAE: 'JAE', JIEN: 'JIEN', JIEH: 'JIEH' }[r.admission_route] + '|' + r.institution : 'JC|' + r.course_code + '|' + r.institution;
      const s0 = idx.get(k);
      if (!s0) { missing++; c19.fail('no snapshot row for ' + k); return; }
      if (r.institution_type === 'JC' || r.institution_type === 'MI') { c19.eq([r.aggregate_type, r.net_range_2026], [s0.agg, s0.range], r.id + ' [aggregate, range] vs jc_jae_courses.csv'); return; }
      c19.eq([r.course_name, r.aggregate_type, r.net_range_2026], [s0.name, s0.agg, s0.range], r.id + ' [name, aggregate, range] vs the master CSV');
    });
    info('raw scrape rows', poly.length + ' poly + ' + ite.length + ' ITE + ' + jc.length + ' JC/MI = ' + (poly.length + ite.length + jc.length) + ' vs ' + ROWS.length + ' course rows');
  } else c19.fail('no snapshot folder ' + snapDir);

  // 1.6 the LEP host list and the secondary-school affiliations
  const c16 = check(1, '1.6', 'LEP host JCs equal data/taxonomy/lep_host_jcs.csv; the affiliation table is complete and names real JCs');
  const lepA = DATA.lep_hosts.map(h => h.jc + '|' + h.programme).sort(), lepB = LEP_CSV.map(h => h.jc + '|' + h.programme).sort();
  c16.ass(JSON.stringify(lepA) === JSON.stringify(lepB), 'lep_hosts in data.json differ from lep_host_jcs.csv');
  const jcNames = new Set(ROWS.filter(r => r.institution_type === 'JC').map(r => r.institution));
  DATA.lep_hosts.forEach(h => c16.ass(jcNames.has(h.jc), 'LEP host not a JC in the course table: ' + h.jc));
  if (PAGE_EXTRA) {
    const aff = PAGE_EXTRA.schools || [];
    c16.ass(aff.length > 100, 'only ' + aff.length + ' secondary schools in the picker');
    let withJc = 0, bad = 0;
    aff.forEach(s => { if (s[1].length) withJc++; s[1].forEach(j => { if (!jcNames.has(j)) { bad++; c16.fail('affiliated JC not in the course table: ' + s[0] + ' -> ' + j); } }); });
    if (!bad) c16.ok();
    info('secondary schools in the picker', aff.length + ' (' + withJc + ' with an affiliated JC)');
    const srcAff = path.resolve(ROOT, 'data', 'schools', 'affiliations.json');
    if (fs.existsSync(srcAff)) {
      const A = JSON.parse(fs.readFileSync(srcAff, 'utf8'));
      const sf = JSON.parse(fs.readFileSync(path.resolve(ROOT, 'data', 'schools', 'school_finder.json'), 'utf8'));
      const nm = {}; sf.forEach(s => { if (s.school_code && s.level === 'SECONDARY') nm[s.school_code] = s.school_name; });
      const want = Object.keys(nm).map(code => [nm[code], [...new Set((A[code] || []).filter(a => a.level === 'JUNIOR COLLEGE').map(a => a.name))].sort()]);
      const w = new Map(want.map(x => [x[0], JSON.stringify(x[1])]));
      let diff = 0; aff.forEach(s => { if (w.get(s[0]) !== JSON.stringify(s[1])) { diff++; c16.fail('affiliation differs from sg-schools-explorer: ' + s[0]); } });
      if (!diff) c16.ok();
    }
  }
}

// ================================================================================================ students
const SC = { O: G3, G3, 'N(A)': ['1', '2', '3', '4', '5', '6'], G2: ['1', '2', '3', '4', '5', '6'], 'N(T)': ['A', 'B', 'C', 'D', 'E'], G1: ['A', 'B', 'C', 'D', 'E'] };
const MTL = ['Chinese', 'Malay', 'Tamil'];
const HMTL = { Chinese: 'Higher Chinese', Malay: 'Higher Malay', Tamil: 'Higher Tamil' };
const SCI3 = ['Science (Physics, Chemistry)', 'Science (Chemistry, Biology)', 'Science (Physics, Biology)'];
const SCI1 = ['Physics', 'Chemistry', 'Biology'];
const HUM3 = ['Humanities (Social Studies, Geography)', 'Humanities (Social Studies, History)', 'Humanities (Social Studies, Literature in English)'];
const HUM1 = ['Geography', 'History', 'Literature in English'];
const ELECT = ['Principles of Accounts', 'Art', 'Design & Technology', 'Nutrition & Food Science', 'Computing'];
const gradeAt = (scale, mu) => { const a = SC[scale]; const i = Math.max(0, Math.min(a.length - 1, Math.round(mu + gauss() * 1.2) - 1)); return a[i]; };
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(RND() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const AFF_SCHOOLS = (PAGE_EXTRA && PAGE_EXTRA.schools || []).filter(s => s[1].length);
const LEP_PROGS = ['CLEP', 'MLEP', 'TLEP'];
// a secondary school whose affiliated JC also hosts a language elective programme: both bonuses can meet on one JC
const AFF_LEP = (() => { for (const [name, jcs] of AFF_SCHOOLS) for (const jc of jcs) { const h = DATA.lep_hosts.find(x => x.jc === jc); if (h) return { school: name, jc, programme: h.programme }; } return null; })();

function genSubjects(level, mu) {
  const L = level;
  const out = [];
  const g = () => gradeAt(L, mu);
  out.push(['English Language', L, g()]);
  const m = pick(MTL);
  if (L === 'O' && chance(0.3)) out.push([HMTL[m], L, g()]); else out.push([m, L, g()]);
  out.push(['Mathematics', L, g()]);
  if (L === 'N(T)') out.push(['Science (Syllabus T)', L, g()]);
  else out.push([chance(0.75) || !(L === 'O' || L === 'G3') ? pick(SCI3) : pick(SCI1), L, g()]);  // single sciences are examined at O-Level / G3 only
  if (L !== 'N(T)') out.push([chance(0.75) ? pick(HUM3) : pick(HUM1), L, g()]);
  if (L === 'O' || L === 'G3') { if (chance(0.45)) out.push(['Additional Mathematics', L, g()]); if (chance(0.2)) out.push([pick(['Chinese (Special Programme)', 'Malay (Special Programme)', 'Bahasa Indonesia as a Third Language']), L, g()]); }
  const el = L === 'N(T)' ? ['Mobile Robotics', 'Smart Electrical Technology', 'Design & Technology', 'Nutrition & Food Science', 'Art'] : ELECT.filter(n => !(L === 'N(A)' && n === 'Computing'));  // SEAB does not examine Computing at N(A)
  shuffle(el).slice(0, Math.floor(RND() * 3)).forEach(n => out.push([n, L, g()]));
  // drop duplicates by name
  const seen = new Set(); return out.filter(x => !seen.has(x[0]) && seen.add(x[0]));
}
const WHERES = [[], [], [], [], ['jc'], ['jc', 'poly'], ['poly'], ['ite'], ['jc', 'mi'], ['poly', 'ite'], ['jc', 'poly', 'ite'], ['arts'], ['mi'], ['jc', 'mi', 'poly']];

function genStudent(i) {
  const cca = pick(['Excellent', 'Good', 'Fair', 'None', 'Good', 'Excellent', 'Not sure']);
  const mu = 1.2 + RND() * 6;
  const roll = i % 20;  // per 20 students: 7 O-Level, 4 N(A), 2 N(T), 3 mixed levels, 4 SEC 2027 (200 students: 70 / 40 / 20 / 30 / 40)
  let kind, st;
  if (roll < 7) kind = 'O'; else if (roll < 11) kind = 'NA'; else if (roll < 13) kind = 'NT'; else if (roll < 16) kind = 'MIX'; else kind = 'SEC';
  if (kind === 'O') st = { year: 2026, level: 'O', subs: genSubjects('O', mu) };
  else if (kind === 'NA') st = { year: 2026, level: 'N(A)', subs: genSubjects('N(A)', 1.5 + RND() * 3.5) };
  else if (kind === 'NT') st = { year: 2026, level: 'N(T)', subs: genSubjects('N(T)', 1 + RND() * 3) };
  else if (kind === 'MIX') {
    const base = pick(['O', 'N(A)', 'N(T)']); const other = base === 'O' ? 'N(A)' : base === 'N(A)' ? 'O' : 'N(A)';
    const subs = genSubjects(base, base === 'O' ? mu : 2.5);
    const k = 1 + Math.floor(RND() * 3);
    for (let j = 0; j < k && j + 1 < subs.length; j++) { const idx = 1 + j; subs[idx] = [subs[idx][0], other, gradeAt(other, other === 'O' ? mu : 2.5)]; }
    st = { year: 2026, level: base, subs };
  } else {
    const lv = pick(['G3', 'G3', 'G3', 'G2', 'G1']);
    let subs;
    if (lv === 'G1') subs = [['English Language', 'G1', gradeAt('G1', 2)], ['Mathematics', 'G1', gradeAt('G1', 2)], ['Science (Syllabus T)', 'G1', gradeAt('G1', 2)], [pick(MTL), 'G1', gradeAt('G1', 2)], ['Art', 'G1', gradeAt('G1', 2)]];
    else subs = genSubjects(lv, lv === 'G3' ? mu : 2.5);
    if (lv === 'G3' && chance(0.3)) { const idx = 1 + Math.floor(RND() * (subs.length - 1)); subs[idx] = [subs[idx][0], 'G2', gradeAt('G2', 2.5)]; }
    if (lv === 'G3') subs = subs.map(s => s[0] === 'Computing' ? ['Art', 'G3', s[2]] : s);
    const seen = new Set(); subs = subs.filter(x => !seen.has(x[0]) && seen.add(x[0]));
    st = { year: 2027, level: lv, subs };
  }
  st.kind = kind; st.cca = cca; st.name = kind + '-' + i;
  st.where = pick(WHERES).slice();
  st.school = ''; st.lep = 'None';
  if (st.year === 2026 && st.level === 'O' && st.where.includes('jc')) {
    if (chance(0.55) && AFF_SCHOOLS.length) st.school = pick(AFF_SCHOOLS)[0];
    if (chance(0.45)) st.lep = pick(LEP_PROGS);
  }
  return st;
}
const stateOf = st => state({ year: st.year, level: st.level, cca: st.cca, where: st.where, school: st.school, lep: st.lep, reach: st.reach === true, allow: st.allow || 0, jcSort: st.jcSort || undefined,
  fields: st.fields || [], insts: st.insts || [], q: st.q || '', stars: st.stars || [], rows: st.subs.map(s => row(s[0], s[1], s[2])) });

// ------------------------------------------------------------------------------------------------ the engine, run here
const EX_ALL_2026 = ['JAE-2027', 'DPP-2027', 'PFP-2027', 'JIE-N-2027'];
function runEngine(st) {
  const subjects = st.subs.map(s => ({ subject: s[0], level: s[1], grade: s[2], year: st.year }));
  const jcAsked = st.year === 2026 && st.level === 'O' && st.where.includes('jc');
  const affJCs = jcAsked && st.school ? ((PAGE_EXTRA && PAGE_EXTRA.schools || []).find(s => s[0] === st.school) || [0, []])[1] : [];
  const bonus = {};
  if (['Excellent', 'Good', 'Fair'].includes(st.cca)) bonus.cca = st.cca;
  if (affJCs.length) bonus.affiliated_jc = true;
  if (jcAsked && st.lep && st.lep !== 'None') bonus.lep = true;
  const all = PSE.computeAll(subjects, bonus);
  const byId = {}; all.forEach(r => { byId[r.id] = r; });
  const rep = PSE.matchReport(subjects, bonus, st.year === 2027 ? ['PSE-2028'] : EX_ALL_2026);
  const results = new Map(); rep.results.forEach(r => results.set(r.exercise + '|' + r.requirement_key, r));
  return { subjects, bonus, all, byId, rep, results, problems: rep.input_problems || [], jcAsked, affJCs };
}

// ------------------------------------------------------------------------------------------------ gross aggregates, worked out here (O-Level students with one level only)
// The slot rules are read from the definitions' groups: each slot, in order, takes the best remaining subject it accepts.
const GRP = k => new Set((DATA.definitions.groups[k] || {}).members || []);
const G_H = GRP('JAE_HUMANITIES'), G_M = GRP('JAE_MATHEMATICS'), G_S = GRP('JAE_SCIENCE'), G_HM = GRP('HMTL'), G_RK = GRP('RELIGIOUS_KNOWLEDGE');
function greedyGross(items, slots) {
  let pool = items.slice(), total = 0;
  for (const pred of slots) { const c = pool.filter(pred).sort((a, b) => a.p - b.p)[0]; if (!c) return null; pool = pool.filter(y => y !== c); total += c.p; }
  return total;
}
function grossOracle(st, aggId) {
  const all = st.subs.map(s => ({ id: PSE.resolveSubject(s[0]), p: G3.indexOf(s[2]) + 1 })).filter(x => x.id && x.p > 0);
  const noRK = all.filter(x => !G_RK.has(x.id));
  const hms = x => G_H.has(x.id) || G_M.has(x.id) || G_S.has(x.id);
  const lower = (a, b) => a == null ? b : b == null ? a : Math.min(a, b);  // EL as L1 and HMTL as L1 are worked out separately; the lower one counts
  if (aggId === 'L1R5(2026)') { const f = l => greedyGross(noRK, [l, x => G_H.has(x.id), x => G_M.has(x.id) || G_S.has(x.id), hms, () => true, () => true]); return lower(f(x => x.id === 'english_language'), f(x => G_HM.has(x.id))); }
  if (aggId === 'L1R4(2026)') { const f = l => greedyGross(noRK, [l, hms, hms, () => true, () => true]); return lower(f(x => x.id === 'english_language'), f(x => G_HM.has(x.id))); }
  const m = /^ELR2B2-([ABCD])/.exec(aggId);
  if (m) { const g1 = GRP('POLY_' + m[1] + '_G1'), g2 = GRP('POLY_' + m[1] + '_G2'); return greedyGross(all, [x => x.id === 'english_language', x => g1.has(x.id), x => g2.has(x.id), () => true, () => true]); }
  return undefined;
}

// ------------------------------------------------------------------------------------------------ the bonus rules, from the rule text
const gradeIdx = g => G3.indexOf(g);
function g3Ok(st, names, maxIdx = 5) { return st.subs.some(s => names.includes(s[0]) && (s[1] === 'O' || s[1] === 'G3') && gradeIdx(s[2]) >= 0 && gradeIdx(s[2]) <= maxIdx); }
function basePoints(def, st) {
  // points that apply whichever JC is chosen, before the cap (bonus.items of the definition, scope != 'choice')
  const b = def && def.bonus; if (!b) return { total: 0, cap: 0, parts: {} };
  let total = 0; const parts = {};
  (b.items || []).forEach(it => {
    if (it.scope === 'choice') return;
    let p = 0;
    if (it.type === 'cca') p = (it.table && it.table[String(st.cca || '').toUpperCase()]) || 0;
    else if (it.id === 'el_hmtl') p = g3Ok(st, ['English Language']) && g3Ok(st, ['Higher Chinese', 'Higher Malay', 'Higher Tamil']) ? it.points : 0;
    else if (it.id === 'sp_bi') p = g3Ok(st, ['Chinese (Special Programme)', 'Malay (Special Programme)', 'Bahasa Indonesia as a Third Language']) ? it.points : 0;
    else throw new Error('qa_data: a bonus item this script has no rule for: ' + it.id);
    parts[it.id] = p; total += p;
  });
  return { total, cap: b.cap, parts };
}
// the net for one engine result: the student's number for that course, with its marks
function netOracle(r, st, eng) {
  const def = DEFS.get(r.aggregate_id);
  if (r.gross == null) return { value: null, marks: '', base: null };
  const bp = basePoints(def, st);
  const baseNet = r.gross - Math.min(bp.cap, bp.total);
  const noBonus = !def || !def.bonus;
  const baseValue = noBonus ? r.gross : baseNet;
  const out = { value: baseValue, marks: '', base: baseValue, affPts: 0, lepPts: 0 };
  if (r.stream !== 'Junior college' || r.exercise === 'PSE-2028') return out;
  const aff = eng.affJCs.includes(r.institution) ? 2 : 0;
  const lepHost = eng.bonus.lep && DATA.lep_hosts.some(h => h.programme === st.lep && h.jc === r.institution) ? 2 : 0;
  const withAff = r.gross - Math.min(bp.cap, bp.total + aff);
  out.affPts = baseNet - withAff;  // what affiliation really added (0 when the cap is already reached)
  out.lepPts = lepHost;
  out.value = withAff - lepHost;
  out.marks = (out.affPts > 0 ? '¹' : '') + (lepHost > 0 ? '²' : '');
  return out;
}
const stateOracle = r => r.exercise === 'PSE-2028' ? (r.eligible === false ? 'no' : 'browse')
  : r.eligible === true ? ((r.reasons || []).some(x => x.conditional) ? 'cond' : 'yes') : r.eligible === false ? 'no' : 'unsure';
const RANK = { yes: 0, cond: 1, browse: 1, unsure: 2, no: 3 };
function rangeOracle(r) {
  if (r.route === 'PFP' || r.stream === 'Polytechnic Foundation Programme') return { range: null };
  if (r.exercise === 'PSE-2028') {
    const e = estimateOfRow(ROW_OF_KEY.get(r.requirement_key), r.aggregate_id);
    return e ? { range: e.range, from: e.from, est: true, basis: e.basis } : { range: null };
  }
  if (!['JAE-2027', 'DPP-2027', 'JIE-N-2027'].includes(r.exercise)) return { range: null };
  if (r.net_range_basis && r.aggregate_display_name && r.net_range_basis !== r.aggregate_display_name) return { range: null, basisMismatch: true };
  const row = ROW_OF_KEY.get(r.requirement_key);
  const v = row && row.net_range_2026;
  return { range: Array.isArray(v) ? v.slice() : null };
}
function offerOracle(r, st, eng) {
  const net = netOracle(r, st, eng), rg = rangeOracle(r), state = stateOracle(r);
  const o = { state, net, range: rg.range, est: !!rg.est, from: rg.from, basis: rg.basis || '', n: null, kind: 'none', basisDropped: !!rg.basisMismatch };
  if (rg.range && net.value != null && r.stream !== 'Polytechnic Foundation Programme') { o.n = rg.range[1] - net.value; o.kind = o.n >= 2 ? 'spare' : o.n >= -1 ? 'close' : 'short'; }
  return o;
}
function bestOracle(offers) {  // offers: [{label, o}] ; the one whose badge a card shows
  const ok = offers.filter(x => ['yes', 'cond', 'browse'].includes(x.o.state));
  const ranged = ok.filter(x => x.o.n != null);
  if (ranged.length) return ranged.reduce((b, x) => x.o.n > b.o.n ? x : b, ranged[0]);
  if (ok.length) return ok[0];
  return offers.filter(x => x.o.state === 'unsure')[0] || offers[0];
}

// ================================================================================================ the six personas
const PASTE_LINES = {
  A: 'ENGLISH LANGUAGE = B3, CHINESE = C5, MATHEMATICS = A2, SCIENCE (PHYSICS, CHEMISTRY) = B4, HUMANITIES (SOCIAL STUDIES, GEOGRAPHY) = B3, PRINCIPLES OF ACCOUNTS = A2',
  B: 'ENGLISH LANGUAGE = C6, MALAY = B4, MATHEMATICS = C5, SCIENCE (CHEMISTRY, BIOLOGY) = C6, HUMANITIES (SOCIAL STUDIES, HISTORY) = C5, FOOD AND NUTRITION = B4',
  C: 'ENGLISH LANGUAGE = A1, CHINESE = A2, MATHEMATICS = A1, ADDITIONAL MATHEMATICS = A2, PHYSICS = A1, CHEMISTRY = A1, GEOGRAPHY = B3'
};
const PERSONAS = [
  { id: 'P1', year: 2026, level: 'N(A)', cca: 'Fair', where: ['poly'], school: '', lep: 'None',
    subs: [['English Language', 'N(A)', '2'], ['Mathematics', 'N(A)', '3'], ['Science (Physics, Chemistry)', 'N(A)', '3'], ['Humanities (Social Studies, Geography)', 'N(A)', '2'], ['Principles of Accounts', 'N(A)', '2'], ['Malay', 'N(A)', '3']] },
  { id: 'P2', year: 2026, level: 'O', cca: 'Good', where: ['jc'], school: "St Andrew's School (Secondary)", lep: 'None',
    subs: [['English Language', 'O', 'A2'], ['Chinese', 'O', 'B3'], ['Mathematics', 'O', 'A2'], ['Physics', 'O', 'B3'], ['Chemistry', 'O', 'B3'], ['Geography', 'O', 'A2'], ['History', 'O', 'B4']] },
  { id: 'P3', year: 2027, level: 'G3', cca: 'Excellent', where: ['jc', 'poly'], school: '', lep: 'None',
    subs: [['English Language', 'G3', 'B3'], ['Mathematics', 'G3', 'B4'], ['Science (Chemistry, Biology)', 'G3', 'B4'], ['Humanities (Social Studies, Geography)', 'G3', 'A2'], ['Additional Mathematics', 'G3', 'C5'], ['Principles of Accounts', 'G3', 'B3'], ['Chinese', 'G1', 'D']] },
  { id: 'P4', year: 2026, level: 'O', cca: 'Fair', where: ['poly'], school: '', lep: 'None',
    subs: [['English Language', 'O', 'B3'], ['Mathematics', 'O', 'A2'], ['Physics', 'O', 'B4'], ['Chemistry', 'O', 'B3'], ['Additional Mathematics', 'O', 'B3'], ['Chinese', 'O', 'C5'], ['Geography', 'O', 'C6']] },
  { id: 'P5A', year: 2026, level: 'O', cca: 'Good', where: ['jc', 'poly'], school: '', lep: 'None', pasteLine: 'A',
    subs: [['English Language', 'O', 'B3'], ['Chinese', 'O', 'C5'], ['Mathematics', 'O', 'A2'], ['Science (Physics, Chemistry)', 'O', 'B4'], ['Humanities (Social Studies, Geography)', 'O', 'B3'], ['Principles of Accounts', 'O', 'A2']] },
  { id: 'P5B', year: 2026, level: 'O', cca: 'None', where: ['jc', 'poly'], school: '', lep: 'None', pasteLine: 'B',
    subs: [['English Language', 'O', 'C6'], ['Malay', 'O', 'B4'], ['Mathematics', 'O', 'C5'], ['Science (Chemistry, Biology)', 'O', 'C6'], ['Humanities (Social Studies, History)', 'O', 'C5'], ['Food & Nutrition', 'O', 'B4']] },
  { id: 'P5C', year: 2026, level: 'O', cca: 'Excellent', where: ['jc', 'poly'], school: '', lep: 'None', pasteLine: 'C',
    subs: [['English Language', 'O', 'A1'], ['Chinese', 'O', 'A2'], ['Mathematics', 'O', 'A1'], ['Additional Mathematics', 'O', 'A2'], ['Physics', 'O', 'A1'], ['Chemistry', 'O', 'A1'], ['Geography', 'O', 'B3']] },
  { id: 'P6', year: 2026, level: 'O', cca: 'Excellent', where: ['jc'], school: '', lep: 'None',
    subs: [['English Language', 'O', 'A1'], ['Higher Chinese', 'O', 'A1'], ['Chinese', 'O', 'A1'], ['Mathematics', 'O', 'A1'], ['Additional Mathematics', 'O', 'A1'], ['Physics', 'O', 'A1'], ['Chemistry', 'O', 'A2'], ['History', 'O', 'A1']] }
];

// ================================================================================================ the section table (D5) and the cards it should give
const SECDEF = [
  { id: 'jc', ex: 'JAE-2027', stream: 'Junior college', y: 2026, levels: ['O'], g: 'inst', wid: 'jc' },
  { id: 'mi', ex: 'JAE-2027', stream: 'Millennia Institute', y: 2026, levels: ['O'], g: 'inst', wid: 'mi' },
  { id: 'poly', ex: 'JAE-2027', stream: 'Polytechnic diploma', y: 2026, levels: ['O'], g: 'key', wid: 'poly' },
  { id: 'pfp', ex: 'PFP-2027', stream: 'Polytechnic Foundation Programme', y: 2026, levels: ['N(A)'], g: 'pfp', wid: 'poly' },
  { id: 'dppvia', ex: 'DPP-2027', stream: 'ITE 2-year Higher Nitec (DPP)', y: 2026, levels: ['N(A)'], g: 'name', wid: 'poly' },
  { id: 'ite2', ex: 'JAE-2027', stream: 'ITE 2-year Higher Nitec', y: 2026, levels: ['O'], g: 'name', wid: 'ite' },
  { id: 'dpp', ex: 'DPP-2027', stream: 'ITE 2-year Higher Nitec (DPP)', y: 2026, levels: ['N(A)'], g: 'name', wid: 'ite' },
  { id: 'jien', ex: 'JIE-N-2027', stream: 'ITE 3-year Higher Nitec', y: 2026, levels: ['N(A)', 'N(T)'], g: 'name', wid: 'ite' },
  { id: 'pjc', ex: 'PSE-2028', stream: 'Junior college', y: 2027, g: 'inst', wid: 'jc' },
  { id: 'pmi', ex: 'PSE-2028', stream: 'Millennia Institute', y: 2027, g: 'inst', wid: 'mi' },
  { id: 'ppoly', ex: 'PSE-2028', stream: 'Polytechnic diploma', y: 2027, g: 'key', wid: 'poly' },
  { id: 'ppfp', ex: 'PSE-2028', stream: 'Polytechnic Foundation Programme', y: 2027, g: 'pfp', wid: 'poly' },
  { id: 'pite2', ex: 'PSE-2028', stream: 'ITE 2-year Higher Nitec', y: 2027, g: 'name', wid: 'ite' },
  { id: 'pite3', ex: 'PSE-2028', stream: 'ITE 3-year Higher Nitec', y: 2027, g: 'name', wid: 'ite' }
];
const ARTS_AGG = { ai: 'AI4(2026)', nfp: 'ELMAB3:NFP(2026)', pai: 'AI4(2027)', pnfp: 'ELMAB3:NFP(2027)' };  // the arts sections' own aggregates (their cards carry no engine row)
const WID_OF_SEC = Object.fromEntries(SECDEF.map(s => [s.id, s.wid]).concat([['ai', 'arts'], ['nfp', 'arts'], ['pai', 'arts'], ['pnfp', 'arts']]));
const MIXED_MIN = 3;
function liveLevels(st) {
  if (st.year !== 2026) return [];
  const n = {}; st.subs.forEach(s => { n[s[1]] = (n[s[1]] || 0) + 1; });
  return [st.level].concat(['O', 'N(A)', 'N(T)'].filter(l => l !== st.level && (n[l] || 0) >= MIXED_MIN));
}
function liveSecs(st) { return SECDEF.filter(s => st.year === 2027 ? s.y === 2027 : s.y === 2026 && s.levels.some(l => liveLevels(st).includes(l))); }
const STREAM_ORDER = ['Arts', 'Science', 'Commerce', 'International Baccalaureate'];
const streamLabel = s => s === 'International Baccalaureate' ? 'IB' : s;
function expectedCards(st, eng) {
  const out = [];
  liveSecs(st).forEach(sec => {
    const rs = eng.rep.results.filter(r => r.exercise === sec.ex && r.stream === sec.stream);
    if (sec.g === 'inst') {
      const by = new Map();
      rs.forEach(r => { if (!by.has(r.institution)) by.set(r.institution, []); by.get(r.institution).push(r); });
      by.forEach((l, inst) => {
        l = l.slice().sort((a, b) => STREAM_ORDER.indexOf(a.jc_stream || a.course_name) - STREAM_ORDER.indexOf(b.jc_stream || b.course_name));
        out.push({ key: sec.id + '|' + inst, sec: sec.id, wid: sec.wid, kind: 'jc', offers: l.map(r => ({ label: streamLabel(r.jc_stream || r.course_name), r })) });
      });
    } else if (sec.g === 'key') {
      rs.forEach(r => out.push({ key: sec.id + '|' + r.requirement_key, sec: sec.id, wid: sec.wid, kind: 'course', offers: [{ label: '', r }] }));
    } else if (sec.g === 'name') {
      const by = new Map();
      rs.forEach(r => { if (!by.has(r.course_name)) by.set(r.course_name, []); by.get(r.course_name).push(r); });
      by.forEach((l, name) => {
        l = l.slice().sort((a, b) => a.institution < b.institution ? -1 : 1);
        out.push({ key: sec.id + '|' + name, sec: sec.id, wid: sec.wid, kind: 'ite', offers: l.map(r => ({ label: r.institution, r })) });
      });
    } else if (sec.g === 'pfp') {
      out.push({ key: '(pfp)', sec: sec.id, wid: sec.wid, kind: 'pfp', results: rs, offers: [] });
    }
  });
  return out;
}
// . A route is OPEN when at least one of its cards can be applied for; a route with nothing open has no section
// and a pick of it is dropped. Picks that are still open win, even a lower tier. With none left the default is the highest tier that has
// a course within reach (JC/MI > Polytechnic incl. PFP and DPP > ITE 2-year > ITE 3-year), plus Polytechnic when that tier is JC/MI,
// nothing below; Arts only when picked. Hidden open routes sit behind one quiet line "Also open to you: ...".
const ITE2_SECS = ['ite2', 'dpp', 'pite2'], ITE3_SECS = ['jien', 'pite3'];
const WID_LABEL = { jc: 'JC', mi: 'MI', poly: 'Polytechnic', ite: 'ITE', arts: 'Arts' };
function scopeInfo(st, M) {
  ARTS_FALLBACK = false;
  const live = [...new Set(M.cards.map(c => c.where))];
  const cardsW = w => M.cards.filter(c => c.where === w);
  const open = w => cardsW(w).some(canApplyCard);
  const reach = c => canApplyCard(c) && (c.bestN == null || c.bestN >= -1);  // Within reach plus Borderline
  const closed = live.filter(w => !open(w));
  // a pathway (section) with nothing to apply for has no section either: PFP closed inside an open Polytechnic route, say
  const secClosed = sid => { const cs = M.cards.filter(c => c.sec === sid); return cs.length > 0 && !cs.some(canApplyCard); };
  const picked = st.where.filter(w => live.includes(w) && open(w));
  let wids, secOk = () => true, tierTop = 0;
  const defaultMode = !picked.length;
  if (picked.length) wids = picked;
  else {
    const top = pred => {
      if (['jc', 'mi'].some(w => cardsW(w).some(pred))) return 1;
      if (cardsW('poly').some(pred)) return 2;
      if (cardsW('ite').some(c => ITE2_SECS.includes(c.sec) && pred(c))) return 3;
      if (cardsW('ite').some(c => ITE3_SECS.includes(c.sec) && pred(c))) return 4;
      return 0;
    };
    const t = top(reach) || top(canApplyCard); tierTop = t;
    wids = t === 1 ? ['jc', 'mi', 'poly'].filter(open) : t === 2 ? ['poly'] : t >= 3 ? ['ite'] : live.filter(open);  // nothing in the four tiers: whatever is open (Arts)
    if (!t && !wids.length && cardsW('arts').some(c => c.state === 'unsure')) { ARTS_FALLBACK = true; wids = ['arts']; }
    if (t === 3) secOk = sec => !ITE3_SECS.includes(sec);
    if (t === 4) secOk = sec => !ITE2_SECS.includes(sec);
  }
  const tierOk = secOk;
  secOk = sec => tierOk(sec) && !secClosed(sec);
  const hidden = live.filter(w => open(w) && !wids.includes(w));
  const closedHard = live.filter(w => cardsW(w).every(c => c.state === 'no'));  // every card definitely no (not merely "not sure")
  const ite3Hidden = defaultMode && wids.includes('ite') && tierTop === 3 && cardsW('ite').some(c => ITE3_SECS.includes(c.sec) && canApplyCard(c));
  return { wids, secOk, defaultMode, closed, closedHard, hidden, secClosed, ite3Hidden };
}
const inScopeWids = (st, M) => scopeInfo(st, M).wids;

// ================================================================================================ 2 + 4 + parts of 1 and 3: every student, page against engine
const norm = s => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/['’‘"]/g, '').replace(/[^a-z0-9]+/g, '');
const wsp = s => String(s || '').replace(/\s+/g, ' ').trim();
const SAMPLE = [];  // what each student gave, for the report
const COVERED_ROWS = new Set();
// what the screen checks read, for the report: card entries read per route, distinct cards read per route (student by student), lists read (one per grouping per student)
const COVER = { reads: 0, recs: {}, cards: {}, tiles: { open: 0, check: 0, closed: 0, 'merged closed': 0 }, forms: { 'no net/gross word': 0, 'merged pathways': 0, 'value per pathway': 0, 'can\'t be worked out': 0 } };
const ESTIMATE_SEEN = { shown: 0, none: 0, basisDropped: 0, offers: 0 };

// a route lists only institutions of its own kind; the ITE colleges of "Via ITE (DPP)" belong to the ITE route
const TYPE_OF_INST = new Map(ROWS.map(r => [r.institution, r.institution_type]));
const KIND_OF_WID = { jc: 'JC', mi: 'MI', poly: 'Polytechnic', ite: 'ITE' };
const ownInst = (wid, i) => !KIND_OF_WID[wid] || TYPE_OF_INST.get(i) === KIND_OF_WID[wid];
const ARTS_CSV = readCsv('data/locations/arts_institutions_2027.csv');
const artsWhoOf = r => /LASALLE/.test(r.institution) ? 'LASALLE' : 'NAFA';
const artsTitleOf = pt => { const head = String(pt).split(':')[0]; if (/Foundation Programme/.test(head)) return head.split(',')[0]; return head.replace(/\s*\(\d+\)\s*$/, '').replace(/^Full-time diploma,?\s*/i, '') || 'Full-time diplomas'; };
const artsProgsOf = pt => { const i = String(pt).indexOf(':'); return i < 0 ? [] : String(pt).slice(i + 1).split(';').map(x => x.trim()).filter(Boolean); };
function matchesFilter(c, st, M) {
  if (st.insts && st.insts.length) {
    const here = new Set(); M.cards.filter(x => x.where === c.where).forEach(x => x.insts.forEach(i => { if (ownInst(c.where, i)) here.add(i); }));
    const mine = st.insts.filter(i => here.has(i));
    if (mine.length && !c.insts.some(i => mine.includes(i))) return false;
  }
  if (st.fields && st.fields.length && ['course', 'ite', 'pfp'].includes(c.kind)) {
    const fs = c.fields || (c.field ? [c.field] : []);
    if (!fs.some(f => st.fields.includes(f))) return false;
  }
  if (st.q) {
    if (c.kind === 'arts') {  // a search also looks in the programmes an arts card lists (data/locations/arts_institutions_2027.csv)
      const rows = ARTS_CSV.filter(r => artsWhoOf(r) === c.inst && artsTitleOf(r.programme_type) === c.title);
      if (!rows.length) return null;  // no matching row in the CSV: not judged
      return norm([c.title, c.inst].concat(rows.map(r => artsProgsOf(r.programme_type).join(' '))).join(' ')).indexOf(norm(st.q)) >= 0;
    }
    const hay = norm([c.title, c.insts.join(' '), c.codes.join(' '), c.iteCodes.join(' '), c.inst, c.diplomas ? c.diplomas.map(d => d.name).join(' ') : ''].join(' '));
    if (hay.indexOf(norm(st.q)) < 0) return false;
  }
  return true;
}
// the pieces a header, section and fold count are made of (D22 / K6): what the list should hold
// the 2027 sections that carry (estimated) cut-offs, JC, MI, polytechnic diplomas and both ITE routes (PFP and arts none)
const EST_SECS = ['pjc', 'pmi', 'ppoly', 'pite2', 'pite3'];
// inside an open route that has cut-offs the cards fall in three groups by the gap n (cut-off minus the
// student's net, + is better): Within reach n >= 2, Borderline -1..+1, Out of reach n <= -2 (folded as "Out of reach: N more"). Group and route counts are
// Within reach plus Borderline. The Within reach chip and its allowance are gone, so the split no longer reads st.reach / st.allow.
const marginGroup = n => n >= 2 ? 'Within reach' : n >= -1 ? 'Borderline' : 'Out of reach';
function splitOracle(cards, sec, st, offersOf) {
  const no = cards.filter(c => c.state === 'no');
  const yes = cards.filter(c => c.state !== 'no');
  const hasCut = st.year === 2026 || EST_SECS.includes(sec);
  const applies = hasCut && ['jc', 'course', 'ite'].includes(cards[0] ? cards[0].kind : '');
  if (!applies) return { shown: yes, beyond: [], noRange: [], no };
  const shown = [], beyond = [], noRange = [];
  yes.forEach(c => { const n = c.bestN; if (n == null) noRange.push(c); else if (n >= -1) shown.push(c); else beyond.push(c); });
  return { shown, beyond, noRange, no };
}
// an arts card is open when it says yes, or "check with NAFA" with no check failed outright (a failed check that is near, an interview, or an
// unknown such as CCA not given); a failed line that is not near (G2 English against the G3 line) is not an open course. The engine's arts checks decide, as on the card.
let CUR_ENG = null;
const nearArts = c => { const res = CUR_ENG && CUR_ENG.byId[ARTS_AGG[c.sec]]; if (!res) return false;
  const failed = (res.eligibility || []).filter(e => !/_aptitude$/.test(e.id) && !(c.inst === 'NAFA' && e.id === 'lasalle_min') && !(c.inst === 'LASALLE' && e.id === 'nafa_min') && e.met === false);
  return !failed.some(e => !(e.near || /interview/i.test(e.detail || ''))); };  // not sure, and nothing failed outright
// when nothing else is open the "check with NAFA" cards are all there is, and the page lists them (ARTS_FALLBACK, set per student by scopeInfo)
let ARTS_FALLBACK = false;
const canApplyCard = c => ['yes', 'cond', 'browse'].includes(c.state) || (c.kind === 'arts' && c.state === 'unsure' && (ARTS_FALLBACK || nearArts(c)));

async function runStudents() {
  const C = {
    input: check(2, '2.0', 'the page reads each student\'s subjects and grades as given (no row dropped or cleared)'),
    copy: check(2, '2.1', 'the engine copy in the page gives the same gross, net, eligibility and range as app/src/pse_core.js, for every course on every card'),
    state: check(2, '2.2', 'each offer\'s state (can apply / on condition / not sure / can\'t apply / browse) matches the engine'),
    net: check(2, '2.3', 'each offer\'s net aggregate matches the rule text: CCA, English + Higher MTL, cap, affiliation (affiliated JC only), LEP (host JCs only)'),
    bonus: check(2, '2.4', 'the engine\'s own net (before any choice) equals gross minus the capped bonus worked out here'),
    range: check(2, '2.5', 'each offer\'s range is the course\'s own published range (2026) or the estimate of it (2027); none for PFP / ITE 2028 / arts / MI 2028'),
    gap: check(2, '2.6', 'each offer\'s gap is cut-off minus net, with the right colour class'),
    cardState: check(2, '2.7', 'each card\'s state and the offer it shows (best) match the offers under it'),
    domBadge: check(2, '2.8', 'what is printed on every card and JC table row (range text, pill sign, pill colour, label, marks) matches the model'),
    coverage: check(2, '2.9', 'cards and engine results match one to one (no card without a result, none missing) for single-level students'),
    header: check(2, '2.10', 'the "Your net ..." line a route band used to carry is in the pop-over of the tile that stands for the route (and nowhere else on Courses): it equals the engine\'s gross / net / bonus'),
    b2: check(2, '2.16', 'the 2027 ELR2B2 Details names the G2 grade a G3 subject counts as in the B2 slot, and it equals the engine\'s points'),
    artsDet: check(2, '2.15', 'an arts Details screen gives the number and the word the rules give: NAFA diploma net (2026 and 2027, engine 0.1.7), everything else gross, and "gross" where the aggregate has no CCA bonus'),
    gross: check(2, '2.14', 'gross L1R5, MI L1R4 and ELR2B2-A..D worked out here from the subject groups agree with the engine (O-Level students with one level)'),
    why: check(2, '2.13', 'a closed route says why in its tile\'s pop-over (no "Not open to you" line): the tiles are the routes of the top open tier and every closed route in or above it that the top grades would open (; one they would not has no tile); the threshold comes from the rule text, "Yours is N" is not repeated'),
    details: check(2, '2.12', 'the Details screen of a card gives the card\'s net, its range line with the same gap, and a "Which subjects counted" table that adds up to the engine\'s gross'),
    grouping: check(4, '4.13', 'every card sits in the group its gap gives: Within reach at +2 or more, Borderline at -1 to +1, the "Out of reach: N more" fold at -2 or less, "No published cut-off" when the course has none; a Borderline or Out of reach card says what it is missing, the others do not'),
    foldWord: check(4, '4.10', 'the fold is worded "Out of reach: N more" and holds only cards 2 or more points short; the same fold sits in no other group'),
    emptySec: check(4, '4.12', 'a section heading never stays on screen over nothing: every section with a heading holds at least one card the picks and filters leave in'),
    another: check(4, '4.11', 'the route chips under the tiles are the open routes (shown filled with ✕, hidden dashed with +, none for a closed route; the last shown route has no ✕), and "Also open to you" is gone from Courses'),
    order: check(4, '4.8', 'the default order is most competitive first: by cut-off minus your net, then no range, then not sure (card lists, in each grouping); in the JC table, by the picked stream\'s gap'),
    sheetCount: check(4, '4.7', 'the number beside each institution in the Institution sheet equals the cards of that institution the list would show'),
    arts: check(2, '2.11', 'arts cards: "meets" only if the English line and the aggregate minimum are both met; "below" only if one fails'),
    rowsOnScreen: check(1, '1.7', 'every offer on screen carries its data.json row\'s name, institution, code, field and links; every card title/institution on screen is the model\'s'),
    rough: check(3, '3.6', 'the "rough conversion" line is gone from every section (its words live in the indicative tag)'),
    est27: check(3, '3.4', '2027: JC, MI, Polytechnic and ITE offers show an estimate when the course has a 2026 range to take it from (ITE 2-year: its JIE \'H\' range, else the five-subject conversion of its O-Level range; 3-year: its JIE \'N\' range); PFP and arts show none'),
    unpicked: check(4, '4.1', 'a route the student did not pick never shows: no section, no group head, no card, no tools chip in the list'),
    presence: check(4, '4.2', 'with no filter, every card of a picked route is in the list once; with a filter, exactly the cards that match it. a polytechnic or ITE course is one card per college (card key @ institution), and every one is in its route\'s list in each grouping (None, Field, Institution)'),
    headCount: check(4, '4.3', 'each group head, section head and sub-group head count equals the cards it holds that can be applied for. a route with route bands has no number on its head; each band "N within reach · M borderline", each list\'s heads "Within reach · N" / "Borderline · N" and each group heading\'s counts (green · amber) equal the engine and the cards they hold'),
    foldCount: check(4, '4.4', 'each "Show N ..." fold names the number of cards it opens; Within reach puts each card in the fold the rule gives. also the folds inside each grouping, and "Show N more" on a group over 10 (the first 10 are drawn)'),
    groupSame: check(4, '4.14', 'Group: None, Field and Institution show the same cards (every card of every section once, none added, none lost), and each grouping\'s headings are the fields or institutions that exist'),
    toolsCount: check(4, '4.5', 'the sticky toolbar: Group None · Field · Institution (None by default), a Filter chip counting the filters on, the chips under it that remove them, "Show all"; no Sort, no Field or Institution chips of their own')
  };
  const p = await openPage(null, { width: 1280, height: 900 });
  let used = 0, skipped = 0, usedRandom = 0;
  const skipWhy = {};
  const doStudent = async (st) => {
    say('student ' + st.name);
    const eng = runEngine(st);
    if (eng.problems.length && !st.persona) { skipped++; const pr0 = eng.problems[0]; const why = pr0.subject ? pr0.subject.replace(/^(Higher |Science|Chemistry|Physics|Biology|Computing).*$/, '$1') + ' at ' + pr0.value : String(pr0.message || pr0.text || JSON.stringify(pr0)).slice(0, 60); skipWhy[why] = (skipWhy[why] || 0) + 1; return false; }
    // the routes the top grades open, found
    // the way a student would: the same results with every grade at its level's top, entered in the page (2.13 below)
    const best = Object.assign({}, st, { subs: st.subs.map(s => (SC[s[1]] || []).includes(s[2]) ? [s[0], s[1], SC[s[1]][0]] : s) });
    await loadState(p, stateOf(best));
    const BEST_OPEN = new Set((await p.eval(MODEL)).cards.filter(c => ['yes', 'cond', 'browse'].includes(c.state)).map(c => c.where));
    await loadState(p, stateOf(st));
    const M = await p.eval(MODEL);
    if (!INFO.some(i => i.k === 'page version')) info('page version', M.version);
    const label = '[' + st.name + ' ' + st.year + ' ' + st.level + ' ' + st.cca + (st.where.length ? ' ' + st.where.join('+') : '') + (st.school ? ' school' : '') + (st.lep !== 'None' ? ' ' + st.lep : '') + ']';
    // 2.0 the page read the student's rows as given
    const want = st.subs.map(s => [s[0], s[1], s[2]].join('|')).sort(), got = M.sent.map(s => [s.subject, s.level, s.grade].join('|')).sort();
    C.input.eq(got, want, label + ' subjects sent to the engine');
    if (M.error || JSON.stringify(got) !== JSON.stringify(want)) { skipped++; skipWhy['the page changed a row or errored'] = (skipWhy['the page changed a row or errored'] || 0) + 1; return false; }
    used++;
    // filters: some students get one (picked from what the page shows)
    if (!st.persona && !st.filtersSet && chance(0.3) && M.cards.length) {
      st.filtersSet = true;
      const kind = pick(['insts', 'fields', 'q']);
      const c = pick(M.cards.filter(x => x.kind !== 'arts'));
      if (c && kind === 'insts') st.insts = [pick(c.insts)];
      else if (c && kind === 'fields' && (c.field || (c.fields || []).length)) st.fields = [c.field || c.fields[0]];
      else if (c && kind === 'q') st.q = (c.title.split(/[\s,]+/).filter(w => w.length > 4)[0] || c.title.split(' ')[0]);
      if (st.insts || st.fields || st.q) { await loadState(p, stateOf(st)); }
    }
    const M2 = (st.insts || st.fields || st.q) ? await p.eval(MODEL) : M;
    // the list is read as it comes (Group: None); the personas and one student in three are read again with Group: Field and Group: Institution
    const { counts, dom, reads } = await expandAndRead(p, st.persona || GRP_SEEN++ % 3 === 0 ? ['none', 'field', 'inst'] : ['none']);
    const SAMPLE_ROW = { name: st.name, label, cards: M2.cards.length, reach: st.reach, allow: st.allow, filter: [st.insts, st.fields, st.q].filter(Boolean).length > 0 };
    SAMPLE.push(SAMPLE_ROW);

    // ---- expected cards from the engine ----
    const exp = expectedCards(st, eng);
    const mixed = st.kind === 'MIX' || liveLevels(st).length > 1;
    const cardByKey = new Map(M2.cards.map(c => [c.key, c]));
    const expByKey = new Map(exp.filter(e => e.key !== '(pfp)').map(e => [e.key, e]));
    // 2.9 coverage
    const secsLive = new Set(liveSecs(st).map(s => s.id));
    if (!mixed) {
      expByKey.forEach((e, k) => C.coverage.ass(cardByKey.has(k), label + ' engine result without a card: ' + k));
      M2.cards.forEach(c => { if (['arts', 'pfp'].includes(c.kind)) return; C.coverage.ass(expByKey.has(c.key), label + ' card without an engine result: ' + c.key); });
      exp.filter(e => e.kind === 'pfp').forEach(e => {
        const names = new Set(); M2.cards.filter(c => c.sec === e.sec).forEach(c => (c.diplomas || []).forEach(d => names.add(d.name)));
        const want = new Set(e.results.map(r => r.course_name));
        C.coverage.ass(names.size === want.size && [...want].every(n => names.has(n)), label + ' PFP diplomas on cards ' + names.size + ' vs engine ' + want.size);
        // PFP cards keep several diplomas each: their state is the common state, else not sure
      });
      M2.cards.filter(c => !secsLive.has(c.sec) && c.kind !== 'arts').forEach(c => C.coverage.fail(label + ' card of a route the levels do not open: ' + c.key));
    }

    // ---- per offer ----
    const bestN = new Map();  // card key -> n of the best offer (for the counts)
    const expMap = new Map();  // card key -> the expected offers
    M2.cards.forEach(c => {
      if (c.kind === 'arts') return;
      const offers = c.offers.map(o => {
        if (!o.r) return { o, ok: false };
        const er = eng.results.get(o.r.exercise + '|' + o.r.requirement_key);
        return { o, er };
      });
      const exps = [];
      offers.forEach(({ o, er }) => {
        const tag = label + ' ' + c.key + (o.label ? ' [' + o.label + ']' : '') + ' ' + (o.r ? o.r.aggregate_id : '');
        if (!er) { C.copy.fail(tag + ': no engine result for ' + (o.r && o.r.exercise + '|' + o.r.requirement_key)); exps.push(null); return; }
        // 2.1 the engine copy
        C.copy.eq([o.r.gross, o.r.net, o.r.eligible, o.r.net_range_2026], [er.gross, er.net, er.eligible, er.net_range_2026], tag + ' gross/net/eligible/range');
        const x = offerOracle(er, st, eng);
        ESTIMATE_SEEN.offers++; if (x.basisDropped) ESTIMATE_SEEN.basisDropped++;
        if (c.kind === 'pfp') {  // one PFP card holds several diplomas: it can apply only when they agree
          const names = new Set((c.diplomas || []).map(d => d.name));
          const sts = eng.rep.results.filter(rr => rr.exercise === o.r.exercise && rr.stream === 'Polytechnic Foundation Programme' && rr.institution === o.r.institution && names.has(rr.course_name)).map(stateOracle);
          x.state = sts.length && sts.every(v => v === sts[0]) ? sts[0] : 'unsure';
        }
        exps.push({ label: o.label, o: x, er });
        C.state.eq(o.state, x.state, tag + ' state');
        // 2.3 net
        if (x.net.value == null) C.net.ass(o.net.value == null, tag + ' no number expected, page shows ' + o.net.value);
        else { C.net.eq([o.net.value, o.net.marks], [x.net.value, x.net.marks], tag + ' net [value, marks] (gross ' + er.gross + ')'); }
        // 2.4 the engine's own net before any choice
        if (er.net != null && er.gross != null) { const bp = basePoints(DEFS.get(er.aggregate_id), st); C.bonus.eq(er.net, er.gross - Math.min(bp.cap, bp.total), tag + ' engine net vs gross - min(cap ' + bp.cap + ', ' + bp.total + ')'); }
        // 2.5 range
        const rg = o.gap ? o.gap.range : null;
        C.range.eq(rg, x.range, tag + ' range');
        if (x.est) C.range.eq(o.gap.est && o.gap.est.from, x.from, tag + ' estimate taken from');
        // 2.6 gap
        if (x.n != null) { C.gap.eq([o.gap.n, o.gap.kind], [x.n, x.kind], tag + ' gap [n, kind]'); } else C.gap.ass(o.gap.n == null, tag + ' gap shown where none expected: ' + (o.gap && o.gap.n));
        // 3.4 the 2027 estimate lands where it should
        if (st.year === 2027) {
          const shouldEst = EST_SECS.includes(c.sec) && x.est;
          C.est27.eq(!!(o.gap && o.gap.est), !!shouldEst, tag + ' estimate present');
          if (shouldEst) ESTIMATE_SEEN.shown++; else ESTIMATE_SEEN.none++;
          if (['ppfp'].includes(c.sec)) C.est27.ass(!(o.gap && o.gap.range), tag + ' shows a range in a route with no estimate');
        }
        // 1.7 the row on screen is the data row
        const row = ROW_OF_KEY.get(o.r.requirement_key);
        if (!row) C.rowsOnScreen.fail(tag + ' no data.json row for ' + o.r.requirement_key);
        else {
          COVERED_ROWS.add(row.id);
          const pairs = [['course_name', o.r.course_name, row.course_name], ['institution', o.r.institution, row.institution], ['course_code', o.r.course_code, row.course_code],
            ['field', o.r.field_of_study || '', row.field_of_study || ''], ['moe_url', o.r.moe_url, row.moe_url], ['institution_url', o.r.institution_url || '', row.institution_url || ''], ['ite_course_code', o.r.ite_course_code || '', row.ite_course_code || '']];
          let good = true; pairs.forEach(([k, a, b]) => { if (a !== b) { good = false; C.rowsOnScreen.fail(tag + ' ' + k + ': page=' + a + ' data.json=' + b); } });
          if (good) C.rowsOnScreen.ok();
        }
      });
      expMap.set(c.key, exps.map(e => e && e.o));
      // 2.7 card state and best offer
      const live = exps.filter(Boolean);
      if (live.length === c.offers.length && live.length) {
        if (c.kind !== 'pfp') {
          const st0 = live.reduce((b, e) => RANK[e.o.state] < RANK[b] ? e.o.state : b, live[0].o.state);
          C.cardState.eq(c.state, st0, label + ' ' + c.key + ' card state');
          const b = bestOracle(live.map(e => ({ label: e.label, o: e.o })));
          C.cardState.eq(c.best && c.best.label, b.label, label + ' ' + c.key + ' best offer');
          bestN.set(c.key, b.o.n);
        } else {
          C.cardState.eq(c.state, live[0].o.state, label + ' ' + c.key + ' PFP card state');
          bestN.set(c.key, null);
        }
      }
    });
    M2.cards.forEach(c => { c.bestN = bestN.has(c.key) ? bestN.get(c.key) : null; });
    // an ITE course at three colleges is one card per college, each with its own college's range and gap (and a polytechnic course sits at one institution). A "view" is that: the card
    // for one offer, under its own key (card key @ institution), with the state and gap the engine gives that offer (worked out here, not read from the page).
    const views = [];
    M2.cards.filter(c => SPLITSET.has(c.sec)).forEach(c => {
      const eo = expMap.get(c.key); if (!eo) return;
      c.offers.forEach((o, k) => {
        const x = eo[k]; if (!x || !o.r) return;
        const inst = o.r.institution, vkey = c.key + '@' + inst;
        views.push(Object.assign({}, c, { key: vkey, baseKey: c.key, offers: [o], best: { label: o.label, state: o.state }, state: x.state, inst, insts: [inst], bestN: x.n, subField: o.r.field_of_study || 'Other' }));
        expMap.set(vkey, [x]); bestN.set(vkey, x.n);
      });
    });
    views.forEach(v => cardByKey.set(v.key, v));
    { const bySec = {}; dom.forEach(d => { (bySec[d.sec] = bySec[d.sec] || new Set()).add(d.baseKey || d.key); COVER.recs[d.sec] = (COVER.recs[d.sec] || 0) + 1; }); COVER.reads += reads.length; Object.entries(bySec).forEach(([k, v]) => { COVER.cards[k] = (COVER.cards[k] || 0) + v.size; }); }

    // 2.9 PFP card states: the common state of its diplomas, else not sure
    // (the app keeps one engine row per PFP card, the others are listed under "Leads to N diplomas")
    // 2.11 arts invariants
    M2.cards.filter(c => c.kind === 'arts').forEach(c => {
      const tag = label + ' ' + c.key;
      const el = st.subs.find(s => s[0] === 'English Language');
      if (c.sec === 'ai' || c.sec === 'pai') {
        const elOk = el && (el[1] === 'O' || el[1] === 'G3') && gradeIdx(el[2]) >= 0 && gradeIdx(el[2]) <= 5;
        if (c.arts.state === 'meets') C.arts.ass(elOk, tag + ' meets, but English is ' + (el ? el[2] : 'missing'));
        if (c.arts.state === 'below' && elOk) C.arts.ass(c.arts.value != null, tag + ' below with English fine and no aggregate');
        if (c.arts.state === 'meets' && c.arts.value != null) C.arts.ass(c.arts.value <= (st.year === 2026 ? 25 : 21), tag + ' meets with aggregate ' + c.arts.value);
      } else C.arts.ok();
    });

    // ---- the screen ----
    const domBy = new Map(); dom.forEach(d => { if (domBy.has(d.key)) C.presence.fail(label + ' card on screen twice: ' + d.key); domBy.set(d.key, d); });
    CUR_ENG = eng;
    const SCOPE = scopeInfo(st, M2), scope = SCOPE.wids, secOk = SCOPE.secOk;
    const unpickedWids = ['jc', 'mi', 'poly', 'ite', 'arts'].filter(w => !scope.includes(w));
    // 4.1 unpicked routes
    unpickedWids.forEach(w => {
      C.unpicked.ass(!counts.groups.some(g => g.wid === w), label + ' group head for the unpicked route ' + w);
      C.unpicked.ass(!dom.some(d => d.wid === w), label + ' a card of the unpicked route ' + w + ' is on screen');
    });
    // 4.2 presence
    const visible = M2.cards.filter(c => {
      if (!scope.includes(c.where) || !secOk(c.sec)) return false;
      if (c.sec === 'dppvia' && scope.includes('ite')) return false;
      return matchesFilter(c, st, M2) !== false;
    });
    // /a card of a polytechnic or ITE section is judged through its views (one per institution): each must sit in the list, and the list holds no other
    const visibleBase = new Set(visible.filter(c => SPLITSET.has(c.sec)).map(c => c.key));
    const mineOf = wid => { const here = new Set(M2.cards.filter(x => x.where === wid).flatMap(x => x.insts).filter(i => ownInst(wid, i))); return (st.insts || []).filter(i => here.has(i)); };  // the Institution chip, for this route
    const visibleViews = views.filter(v => visibleBase.has(v.baseKey) && (!mineOf(v.where).length || mineOf(v.where).includes(v.inst)));
    const visibleKeys = new Set(visible.filter(c => !SPLITSET.has(c.sec)).map(c => c.key).concat(visibleViews.map(v => v.key)));
    const judged = visible.filter(c => !SPLITSET.has(c.sec)).concat(visibleViews);
    const cardsOf = (sec) => visible.filter(c => c.sec === sec);
    judged.forEach(c => C.presence.ass(domBy.has(c.key), label + ' card missing from the list: ' + c.key + ' (oracle scope ' + scope.join('+') + (SCOPE.defaultMode ? ' default' : ' picks') + '; page groups ' + counts.groups.map(g => g.wid).join('+') + '; card state ' + c.state + '; not open: ' + (counts.notOpen ? counts.notOpen.text : 'none') + ')'));
    dom.forEach(d => {
      const c = cardByKey.get(d.key);
      if (!c) { C.presence.fail(label + ' card on screen that is not in the model: ' + d.key); return; }
      // a card is judged by its key (card key @ institution for a polytechnic or ITE section)
      C.presence.ass(visibleKeys.has(d.key), label + ' card on screen that the picks/filters exclude: ' + d.key);
    });
    // ---- the lists against the engine. A polytechnic, ITE or PFP section has a route band ("Polytechnic Year 1 · N within reach · M borderline"), then one list in chance order: heads read
    // "Within reach · N" and "Borderline · N", a long group shows its first 10 cards, then "Show N more". With Group: Field or Institution each section folds into groups, each heading with its
    // counts in the tile colours. Every number is worked out here from the engine; a group is told by the name of its field (the course's own row) or its institution.
    const tally = list => { let i = 0, b = 0; list.forEach(v => { if (v.state === 'no' || v.bestN == null) return; if (v.bestN >= 2) i++; else if (v.bestN >= -1) b++; }); return { i, b, n: i + b }; };
    const PFPSET = new Set(['pfp', 'ppfp']);
    const margin = sid => SPLITSET.has(sid) && (st.year === 2026 || EST_SECS.includes(sid));  // these sections have Within reach / Borderline / Out of reach
    const itemsOf = sid => SPLITSET.has(sid) ? visibleViews.filter(v => v.sec === sid) : visible.filter(c => c.sec === sid);
    const groupName = (x, mode) => mode === 'inst' ? x.inst : (PFPSET.has(x.sec) ? (x.cluster || 'Diploma-specific programmes') : x.subField);
    const countOf = (sid, list) => margin(sid) ? tally(list) : { i: list.filter(canApplyCard).length, b: 0, n: list.filter(canApplyCard).length };
    const listedSecs = [...new Set(visible.filter(c => SPLITSET.has(c.sec) || PFPSET.has(c.sec)).map(c => c.sec))].sort();
    reads.forEach(rd => {
      const mode = rd.mode, mt = label + ' [Group: ' + mode + ']';
      // 4.3: the sections with a route band are the polytechnic, ITE and PFP sections on screen; the band's two numbers are the engine's
      C.headCount.eq(rd.counts.secs.filter(x => x.rb).map(x => x.id).sort(), listedSecs, mt + ' the sections that have a route band');
      rd.counts.secs.filter(x => x.rb).forEach(x => {
        const T = countOf(x.id, itemsOf(x.id));
        C.headCount.eq(x.band, margin(x.id) ? [T.i, T.b] : null, mt + ' ' + x.id + ' band [within reach, borderline]');
        // the band's two numbers are the section's Within reach and Borderline cards, whatever the grouping
        if (margin(x.id)) {
          const recs = rd.dom.filter(d => d.sec === x.id && d.seg === 'main');
          C.headCount.eq([recs.filter(d => d.grp === 'Within reach').length, recs.filter(d => d.grp === 'Borderline').length], x.band, mt + ' ' + x.id + ' band vs the cards in its groups');
        }
      });
      // each list (the section, or one group of it): the heads "Within reach · N" / "Borderline · N" say what the list holds, and what the engine gives
      const lists = new Map();
      rd.dom.filter(d => (SPLITSET.has(d.sec) || PFPSET.has(d.sec)) && !d.table).forEach(d => { const k = d.sec + '||' + d.sub; if (!lists.has(k)) lists.set(k, { sid: d.sec, sub: d.sub, recs: [] }); lists.get(k).recs.push(d); });
      lists.forEach(L => {
        if (!margin(L.sid)) return;
        const name = L.sub ? L.sub.split('|').slice(2).join('|') : null, its = itemsOf(L.sid).filter(x => name == null || groupName(x, mode) === name), T = tally(its);
        const inR = L.recs.filter(d => d.seg === 'main' && d.grp === 'Within reach'), bR = L.recs.filter(d => d.seg === 'main' && d.grp === 'Borderline'), tg = mt + ' list ' + L.sid + (L.sub ? ' / ' + name : '');
        C.headCount.eq([inR.length, bR.length], [T.i, T.b], tg + ' [Within reach cards, Borderline cards]');
        C.headCount.ass(inR.every(d => d.grpN === inR.length) && bR.every(d => d.grpN === bR.length), tg + ' group heads: "Within reach · ' + (inR[0] || {}).grpN + '" has ' + inR.length + ' cards, "Borderline · ' + (bR[0] || {}).grpN + '" has ' + bR.length);
      });
      // a group heading (Group: Field or Institution): its name and its counts are the group's, and each group opens to its cards
      rd.counts.subs.forEach(sh => {
        const pt = sh.v.split('|'), sid = pt[0], k = pt.slice(2).join('|'), its = itemsOf(sid).filter(x => groupName(x, mode) === k), T = countOf(sid, its);
        C.headCount.eq([pt[1], sh.name, sh.g, margin(sid) ? sh.a : null], [mode, k, T.i, margin(sid) ? T.b : null], mt + ' group heading ' + sh.v + ' [grouping, name, counts]');
        const inside = rd.dom.filter(d => d.sec === sid && d.sub === sh.v && d.seg === 'main' && (d.grp === 'Within reach' || d.grp === 'Borderline'));
        if (margin(sid)) C.headCount.eq([inside.filter(d => d.grp === 'Within reach').length, inside.filter(d => d.grp === 'Borderline').length], [sh.g, sh.a], mt + ' group heading ' + sh.v + ' vs its cards');
      });
      if (mode !== 'none') {
        // the headings are exactly the groups that exist, one level only
        listedSecs.forEach(sid => {
          const want = [...new Set(itemsOf(sid).map(x => groupName(x, mode)))].sort(), got = rd.counts.subs.filter(sh => sh.sec === sid).map(sh => sh.name).sort();
          C.groupSame.eq(got, want, mt + ' ' + sid + ' the group headings');
        });
      }
    });
    // 4.14 the Group control applies to the polytechnic, ITE and PFP lists only: the JC table, MI and the arts lists keep their shape, whatever the grouping
    reads.forEach(rd => C.groupSame.eq(rd.counts.subs.filter(h => !(SPLITSET.has(h.sec) || PFPSET.has(h.sec))).map(h => h.sec), [], label + ' [Group: ' + rd.mode + '] group headings in a section the control does not apply to'));
    // 4.14 the three groupings show the same cards: whatever the grouping, every card of every section is on screen once, and a card's label names what the grouping does not
    if (reads.length > 1) {
      const keysOf = rd => rd.dom.map(d => d.key + '|' + d.sec).sort();
      reads.slice(1).forEach(rd => {
        const a = keysOf(reads[0]), b = keysOf(rd);
        C.groupSame.eq([b.length, new Set(b).size, b.filter(k => a.indexOf(k) < 0).length, a.filter(k => b.indexOf(k) < 0).length], [a.length, a.length, 0, 0], label + ' [Group: ' + rd.mode + '] cards [entries, distinct, not in None, missing from None]');
      });
    }
    // 1.7 titles as printed
    // FIX_r3 item 11: under its own sub-group heading (the cluster) a PFP card's subtitle does not repeat that heading: "Cluster: Programme" prints as "Programme", and a card that is only the cluster prints no subtitle
    const pfpSub = (c, d) => { const sp = d.sub ? d.sub.split('|') : [], head = sp[1] === 'field' ? sp.slice(2).join('|') : ''; if (!head) return c.title; if (c.title === head) return ''; return c.title.indexOf(head + ': ') === 0 ? c.title.slice(head.length + 2) : c.title; };
    // a card's grey label names what its list's grouping does not: no grouping, "institution · field"; by field, the institution; by institution, the field. Inside a 2-year or
    // 3-year Higher Nitec section the title drops "Higher Nitec in " and " (2 Years)" / " (3 Years)" (Details keep MOE's full name: checked with 2.12). Each entry stands for one college's card.
    reads.forEach(rd => rd.dom.forEach(d => { const c = cardByKey.get(d.key); if (!c) return;
      const title = ITE_SHORT_SECS.includes(c.sec) ? iteShortTitle(c.title) : c.title;
      const lab = SPLITSET.has(c.sec) ? (rd.mode === 'none' ? [c.inst, c.field].filter(Boolean).join(' · ') : rd.mode === 'field' ? c.inst : (c.field || '')) : (c.inst || '');
      C.rowsOnScreen.eq([d.title, d.inst], c.kind === 'pfp' && c.inst ? [c.inst, pfpSub(c, d)] : [title, lab], label + ' [Group: ' + rd.mode + '] ' + d.key + ' printed title/label' + (c.kind === 'pfp' ? ' (PFP: polytechnic first, subtitle without the sub-group heading)' : '')); }));

    // 2.8 badges and table cells
    reads.forEach(rd => { const dom = rd.dom; dom.forEach(d => {
      const c = cardByKey.get(d.key); if (!c || c.kind === 'arts') return;
      const eo = expMap.get(c.key); if (!eo || eo.some(x => !x)) return;
      const tag = label + ' ' + d.key;
      const agg = o => letters(o.r.aggregate_id);
      const wantBadge = (i, withLabel) => {
        const o = c.offers[i], x = eo[i];
        if (x.state === 'no') return { text: (withLabel && o.label ? o.label + ' ' : '') + "Can't apply" };
        if (x.state === 'unsure') return { text: (withLabel && o.label ? o.label + ' ' : '') + 'Not sure' };
        if (x.n == null) return null;
        return { label: withLabel ? o.label : '', rng: agg(o) + ' ' + rangeText(x.range), pill: signed(x.n), sup: x.net.marks, cls: pillClass(x.n) };  // the range reads "ELR2B2-B 6-14" plus one indicative tag, for 2026 figures and 2028 estimates alike
      };
      if (d.table) {
        const cols = ['Arts', 'Science'];
        cols.forEach((s, ci) => {
          const oi = c.offers.findIndex(o => o.label === s);
          const cell = d.cells[ci]; if (!cell) { C.domBadge.fail(tag + ' no table cell for ' + s); return; }
          if (oi < 0) { C.domBadge.ass(cell.muted && /^—/.test(cell.text), tag + ' ' + s + ' cell should be a dash: ' + cell.text); return; }
          const x = eo[oi];
          if (x.state === 'no') C.domBadge.ass(cell.muted && /^✗/.test(cell.text), tag + ' ' + s + ' cell should say can\'t apply: ' + cell.text);
          else if (x.state === 'unsure' || x.n == null) C.domBadge.ass(cell.muted && /^\?/.test(cell.text), tag + ' ' + s + ' cell should be "?": ' + cell.text);
          else C.domBadge.eq([cell.n, cell.pill && cell.pill.text, cell.pill && cell.pill.sup, cell.pill && cell.pill.cls], [String(x.range[1]), signed(x.n), x.net.marks, pillClass(x.n)], tag + ' ' + s + ' cell [cut-off, pill, marks, colour]');
        });
        c.offers.forEach((o, oi) => {
          if (cols.includes(o.label)) return;
          const x = eo[oi]; const ex = d.extra.find(e => e.label === o.label);
          if (!ex) { C.domBadge.fail(tag + ' no extra-stream line for ' + o.label); return; }
          if (x.state !== 'no' && x.state !== 'unsure' && x.n != null) C.domBadge.eq([ex.pill && ex.pill.text, ex.pill && ex.pill.cls], [signed(x.n), pillClass(x.n)], tag + ' ' + o.label + ' line pill');
          else C.domBadge.ok();
        });
        return;
      }
      // card list: JC cards show one badge per stream; every other card the best offer's
      const idxs = c.kind === 'jc' ? c.offers.map((_, i) => i) : [c.offers.findIndex(o => o.label === (c.best && c.best.label))].map(i => i < 0 ? 0 : i);
      idxs.forEach((oi, bi) => {
        const want = wantBadge(oi, c.kind === 'jc');
        const got = d.badges[bi];
        if (!want) { C.domBadge.ass(!got || got.kind !== 'gap', tag + ' a range badge where no cut-off is published: ' + JSON.stringify(got)); return; }
        if (want.text) { C.domBadge.ass(got && wsp(got.text) === want.text, tag + ' badge text ' + JSON.stringify(got && got.text) + ' want ' + want.text); return; }
        C.domBadge.eq([got && got.rng, got && got.pill && got.pill.text, got && got.pill && got.pill.sup, got && got.pill && got.pill.cls, got && got.label], [want.rng, want.pill, want.sup, want.cls, want.label], tag + ' badge [range, pill, marks, colour, label]');
        C.domBadge.ass(got && got.ind, tag + ' no "indicative" tag on the range (brief C: one tag on every cut-off range)');
      });
      // the Affiliated tag only on the affiliated JC (2026, JC picked)
      if (c.kind === 'jc' && st.year === 2026) C.domBadge.eq(d.tags.includes('Affiliated'), eng.affJCs.includes(c.title), tag + ' Affiliated tag');
      // FIX_r3 item 11: a PFP card is the same in both years: the "You can apply" tag shows when every diploma on it meets the requirements (2028 included)
      if (c.kind === 'pfp') C.domBadge.eq(d.tags.some(t => /can apply/i.test(t)), pfpMeetsAll(c, c.offers[0].r, eng), tag + ' PFP "You can apply" tag (engine: every diploma on the card eligible)');
    }); });
    // 2.10 headers: the group head's line, and each section head's own line
    const aggsOfSecs = secIds => { const aggs = {}; secIds.forEach(sid => { if (ARTS_AGG[sid]) { aggs[ARTS_AGG[sid]] = true; return; } const sd = SECDEF.find(x => x.id === sid); if (!sd) return; const ex = DATA.requirements.exercises.find(e => e.id === sd.ex); const stream = ex && ex.streams.find(s => s.name === sd.stream); if (stream) Object.values(stream.aggregates).forEach(id => { aggs[id] = true; }); }); return aggs; };
    const checkRemind = (text, secIds, where, tile) => {  // tile = a tile's pop-over line: its own sections; the tiles follow the results, so a filter emptying a section is no fault (only the filter's visible cards are counted, as the page does)
      text = wsp(text); if (!text) return;
      const aggs = aggsOfSecs(secIds);
      const hereCards = M2.cards.filter(c => secIds.includes(c.sec));
      const visCards = hereCards.filter(c => matchesFilter(c, st, M2) !== false);
      const used = {};
      const saysGross = /^Your gross /.test(text);
      const usedAll = {};
      (visCards.length ? visCards : hereCards).forEach(c => c.offers.forEach(o => { if (o.r) { const r = eng.byId[o.r.aggregate_id]; if (r && r.gross != null) used[o.r.aggregate_id] = (saysGross || r.net == null) ? r.gross : r.net; } }));
      hereCards.forEach(c => c.offers.forEach(o => { if (o.r) { const r = eng.byId[o.r.aggregate_id]; if (r && r.gross != null) usedAll[o.r.aggregate_id] = (saysGross || r.net == null) ? r.gross : r.net; } }));
      secIds.forEach(sid => { const id = ARTS_AGG[sid]; const r = id && eng.byId[id]; if (r && r.gross != null) { used[id] = usedAll[id] = (saysGross || r.net == null) ? r.gross : r.net; } });
      text = text.replace(/On this scale every G3 or G2 subject counts as the top grade, so 4 subjects give 4 points before CCA\.$/, '');  // the sentence the page adds under a 3-year ITE line
      { const stripped = text.replace(/^Your (?:(?:net|gross) )?/, ''), bare = /^Your (?!net |gross )/.test(text); let mm;
        const own = (name, aggName) => Object.keys(aggsOfSecs(PW_SECS[name] || [])).filter(id => letters(id) === aggName && eng.byId[id] && eng.byId[id].gross != null);
        const valueOf = r => r.net != null ? r.net : r.gross;
        if ((mm = /^(\S+): (\d+) \((.+)\)$/.exec(stripped)) && mm[3].split('; ').every(x => /^(.+?): (?:gross \d+(?: − \d+ .+)?|no bonus)$/.test(x))) {
          COVER.forms['merged pathways']++; mm[3].split('; ').forEach(part => { const pm = /^(.+?): (?:gross (\d+)(?: − (\d+) .+)?|(no bonus))$/.exec(part), ids = own(pm[1], mm[1]);
            C.header.ass(ids.length > 0 && ids.some(id => { const r = eng.byId[id]; return valueOf(r) === Number(mm[2]) && (pm[4] ? r.gross === valueOf(r) : r.gross === Number(pm[2]) && r.gross - valueOf(r) === Number(pm[3] || 0)); }),
              label + ' ' + where + ' "' + text + '": "' + part + '" is not ' + pm[1] + '\'s ' + mm[1] + ' (engine ' + JSON.stringify(own(pm[1], mm[1]).map(id => [id, eng.byId[id].gross, eng.byId[id].net])) + ')'); });
          return; }
        if ((mm = /^(\S+): (\d+ for .+)$/.exec(stripped)) && mm[2].split(', ').every(x => /^\d+ for .+$/.test(x))) {
          COVER.forms['value per pathway']++; mm[2].split(', ').forEach(part => { const pm = /^(\d+) for (.+)$/.exec(part), ids = own(pm[2], mm[1]);
            C.header.ass(ids.length > 0 && ids.some(id => valueOf(eng.byId[id]) === Number(pm[1])), label + ' ' + where + ' "' + text + '": "' + part + '" is not ' + pm[2] + '\'s ' + mm[1]); });
          return; }
        if (bare) { COVER.forms['no net/gross word']++; const nm = /^(\S+): /.exec(stripped);  // "Your ELMAB3: 15": the word is left out because net equals gross
          const ids = nm ? Object.keys(aggsOfSecs(secIds)).filter(id => letters(id) === nm[1] && eng.byId[id] && eng.byId[id].gross != null) : [];
          C.header.ass(ids.length > 0 && ids.every(id => eng.byId[id].net == null || eng.byId[id].net === eng.byId[id].gross), label + ' ' + where + ' "' + text + '" leaves out net / gross, but they differ: ' + JSON.stringify(ids.map(id => [id, eng.byId[id].gross, eng.byId[id].net]))); } }

      const body = text.replace(/^Your (?:(?:net|gross) )?/, '').replace(/\s*\(.*$/, '');
      const grossM = /\(gross (\d+)(?: − (\d+) (.+))?\)/.exec(text);
      const pairs = []; let m;
      // equal values are said once with the names in brackets: "ELR2B2: 13 (A, B) · 15 (C, D)" and, for ITE, "28 (ELB4-A) · 30 (ELR1B3-B, ELR2B2-C)"
      const full = text.replace(/^Your (?:(?:net|gross) )?/, '');
      const NAMES = '[A-Z0-9][A-Za-z0-9:\\-]*(?:, [A-Z0-9][A-Za-z0-9:\\-]*)*';
      let rich = null;
      if ((m = new RegExp('^ELR2B2: (\\d+ \\([A-D](?:, [A-D])*\\)(?: · \\d+ \\([A-D](?:, [A-D])*\\))*)$').exec(full))) rich = m[1].split(' · ').flatMap(t => { const mm = /^(\d+) \((.+)\)$/.exec(t); return mm[2].split(', ').map(L => ({ name: 'ELR2B2-' + L, val: Number(mm[1]) })); });
      else if ((m = new RegExp('^(\\d+ \\(' + NAMES + '\\)(?: · \\d+ \\(' + NAMES + '\\))*)$').exec(full))) rich = m[1].split(' · ').flatMap(t => { const mm = /^(\d+) \((.+)\)$/.exec(t); return mm[2].split(', ').map(nm => ({ name: nm, val: Number(mm[1]) })); });
      if (rich) rich.forEach(x => pairs.push(x));
      else if ((m = /^(\S+): (\d+)$/.exec(body))) pairs.push({ name: m[1], val: Number(m[2]) });
      else if ((m = /^(\S+): ([A-D] \d+(?: · [A-D] \d+)*)$/.exec(body))) m[2].split(' · ').forEach(t => { const mm = /^([A-D]) (\d+)$/.exec(t); pairs.push({ name: m[1] + '-' + mm[1], val: Number(mm[2]) }); });
      else if ((m = /^([A-Z0-9][A-Za-z0-9\-:]*(?:, [A-Z0-9][A-Za-z0-9\-:]*)+): (\d+)$/.exec(body))) m[1].split(', ').forEach(nm => pairs.push({ name: nm, val: Number(m[2]) }));  // aggregates with one number between them
      else body.split(' · ').forEach(t => { const mm = /^(\S+) (\d+)$/.exec(t); if (mm) pairs.push({ name: mm[1], val: Number(mm[2]) }); });
      if (!pairs.length) { C.header.fail(label + ' ' + where + ' header line not understood: "' + text + '"'); return; }
      pairs.forEach(({ name, val }) => {
        const fam = /^ELR2B2$/.test(name);
        let pool = used;
        let cand = Object.keys(used).filter(id => fam ? /^ELR2B2-/.test(letters(id)) : letters(id) === name);
        if (!cand.length) {  // a filter has emptied the section the line belongs to: the page then reads the section's own cards
          pool = usedAll; cand = Object.keys(usedAll).filter(id => fam ? /^ELR2B2-/.test(letters(id)) : letters(id) === name);
          if (cand.length && !tile) C.header.fail(label + ' ' + where + ' "' + text + '" names ' + name + ', a section the active filter has emptied (the visible cards use ' + Object.keys(used).map(letters).join(', ') + ') (fix list item 22)');
        }
        if (!cand.length) { C.header.fail(label + ' ' + where + ' header names an aggregate no card on screen uses: ' + name + ' in "' + text + '" (engine values of the cards\' aggregates: ' + JSON.stringify(used) + '; sections ' + secIds.join(',') + '; filters ' + JSON.stringify({ i: st.insts, f: st.fields, q: st.q }) + ')'); return; }
        // an ELR2B2 line speaks for all four letters; a name two sections share under different rules (PFP gross, DPP net) is right when it matches one of them
        const agrees = fam ? cand.every(id => pool[id] === val) : cand.some(id => pool[id] === val);
        C.header.ass(agrees, label + ' ' + where + ' "' + text + '": ' + name + ' ' + val + ' vs engine ' + JSON.stringify(cand.map(id => id + '=' + pool[id])));
        if (!fam && agrees) cand = cand.filter(id => pool[id] === val);
        if (grossM && !rich) {  // the gross in brackets belongs to every aggregate the line names (FIX_r3 item 8: the poly line shows it like the JC line)
          cand.forEach(id => {
            const r = eng.byId[id];
            C.header.eq(Number(grossM[1]), r.gross, label + ' ' + where + ' header gross for ' + name + ' (' + id + ')');
            if (grossM[2]) C.header.eq(Number(grossM[1]) - Number(grossM[2]), r.net, label + ' ' + where + ' header gross - bonus for ' + name + ' (' + id + ')');
          });
        }
      });
    };
    // what a tile is, worked out here. It stands for the sections its label names; it is closed when nothing in them can be applied for; it is a "check" tile when it is open but no course in
    // them is open for sure (every one is "check with ..."), who to check with being NAFA or LASALLE for an arts card, else the school (the polytechnic / ITE for those routes), and the school when
    // several differ; otherwise it is open. A closed tile's word starts with ✗, a check tile's is "? Check with <who>" (amber), an open tile's "✓ open".
    const tileInfo = tl => {
      const secs = tileWords(tl).flatMap(w => SECS_OF[w] || []).filter(sid => M2.cards.some(c => c.sec === sid)), cards = M2.cards.filter(c => secs.includes(c.sec));
      const unsure = cards.filter(c => c.state === 'unsure'), sure = cards.some(c => ['yes', 'cond', 'browse'].includes(c.state));
      const whoOf = c => c.kind === 'arts' ? ((c.arts && c.arts.who) || 'the school') : 'the ' + ({ jc: 'school', mi: 'school', poly: 'polytechnic', ite: 'ITE', arts: 'school' })[c.where];
      const ws = [...new Set(unsure.map(whoOf))], closed = secs.length > 0 && secs.every(sid => SCOPE.secClosed(sid));
      const check = !closed && !sure && unsure.length > 0, who = check ? (ws.length === 1 ? ws[0] : 'the school') : '';
      return { secs, closed, check, who, word: closed ? null : check ? '? Check with ' + who : '✓ open' };
    };
    // the aggregate line a route's band carried ("Your net ELR2B2: 13 (gross 14 − 1 CCA)") is in the pop-over of the tile that stands for the route, and nowhere else on Courses: no band
    // line, no tile title, and each open tile says its net the way the band did (the same line, checked against the engine as before). an open tile may say it without the word net / gross
    // ("Your ELMAB3: 15", net = gross) or for merged pathways ("Your ELMAB3: 13 (DPP: gross 14 − 1 CCA; NAFA Foundation Programme: no bonus)"); a "check" tile that has no figure gives the engine's
    // "can't be worked out" reason, and ends with "Check with <who>."; no pop-over is empty, none says one aggregate's number twice, and every line of a merged closed tile starts with its pathway's name
    { const secIds = [...new Set(M2.cards.map(c => c.sec))];  // the tiles follow the results, not the picks: every route the student has results for
      const T = counts.top;
      C.header.ass(!T.gone.remind && !T.gone.tileTitle, label + ' a band net line or a tile title is still on Courses (' + JSON.stringify({ remind: T.gone.remind, tileTitle: T.gone.tileTitle }) + ')');
      const aggNames = l => { let m = /^Your (?:(?:net|gross) )?([A-Za-z0-9\-:]+(?:, [A-Za-z0-9\-:]+)*): /.exec(l); if (m) return m[1].split(', '); m = /^Your (?:net|gross) \d+ \((.+)\)/.exec(l); return m ? m[1].split(', ') : []; };
      T.tiles.forEach(tl => { const info = tileInfo(tl), tg = COVER.tiles[tl.off ? (tileWords(tl).length > 1 ? 'merged closed' : 'closed') : info.check ? 'check' : 'open']++; label + ' tile "' + tl.label + '" ' + JSON.stringify(tl.lines);
        C.header.ass(tl.lines.length > 0 && tl.lines.every(l => l.replace(/×/g, '').trim().length > 0), tg + ': a pop-over with nothing in it');
        const names = tl.lines.flatMap(aggNames), twice = names.filter((n, i) => names.indexOf(n) !== i);
        C.header.ass(!twice.length, tg + ': says the number of ' + twice.join(', ') + ' twice');
        if (tl.off) {
          const bare = tl.lines.filter(l => /^Below the minimum\.?$/.test(l));
          C.header.ass(!bare.length, tg + ': a bare "Below the minimum."');
          // when the rule is on the gross and bonus points would change the number, one line says the gross the tile shows
          const yours = tl.lines.map(l => /^Yours is (\d+)\. Bonus points don.t count for this\.$/.exec(l)).filter(Boolean);
          C.header.ass(yours.length <= 1 && yours.every(m => m[1] === String(tl.num).trim()), tg + ': the "Yours is N" line does not match the tile\'s number ' + tl.num);
          if (tileWords(tl).length > 1) { const mine = info.secs.map(sid => PW_NAME_OF[sid]);  // a merged tile: every line names its own pathway
            tl.lines.forEach(l => C.header.ass(mine.some(n => l.indexOf(n) === 0) || /^You take \d+/.test(l) || /^Yours is \d+\. Bonus points/.test(l), tg + ': the line "' + l + '" does not start with its pathway\'s name (' + mine.join(', ') + ')')); }
          return; }
        // an open or "check" tile: the lines are figures, and on a check tile the engine's reason when there is no figure, then "Check with <who>."
        const figs = info.check ? tl.lines.slice(0, -1) : tl.lines;
        if (info.check) C.header.eq(tl.lines[tl.lines.length - 1], 'Check with ' + info.who + '.', tg + ' last line of a check tile');
        const own = tileWords(tl).flatMap(w => SECS_OF[w] || []).filter(sid => secIds.includes(sid));
        figs.forEach(l => {
          const cw = /^Your (\S+) can't be worked out/.exec(l);
          if (cw) { COVER.forms['can\'t be worked out']++; C.header.ass(info.check && Object.keys(aggsOfSecs(own)).some(id => letters(id) === cw[1] && eng.byId[id] && eng.byId[id].gross == null), tg + ': "' + l.slice(0, 80) + '" but the engine can work ' + cw[1] + ' out, or the tile is not a check tile'); return; }
          checkRemind(l, own, 'tile ' + tl.label, true); }); }); }
    // 3.6 the rough-conversion clause sits where the converted ITE 2-year ranges are
    if (st.year === 2027) {
      counts.secs.forEach(sx => C.rough.ass(!sx.rough, label + ' a "rough" line is on screen in section ' + sx.id));
    }
    // 4.12 no heading over nothing
    { const withCards = new Set(visible.map(c => c.sec));
      counts.secs.forEach(sx => { if (sx.head != null) C.emptySec.ass(withCards.has(sx.id), label + ' section "' + sx.head + '" (' + sx.id + ') is on screen with no card in it (filters ' + JSON.stringify({ i: st.insts, f: st.fields, q: st.q }) + ')'); }); }
    // 4.11 the route chips under the tiles: "Showing: [ITE 2-year ✕] [+ ITE 3-year] [+ Arts]". Shown routes are filled with ✕, the open routes the default hides are dashed with +, a closed route has no chip,
    // the last shown route has no ✕.
    { const T = counts.top, chips = T.rchips, onW = chips.filter(c => c.on).map(c => c.w), offW = chips.filter(c => !c.on).map(c => c.w);
      const hiddenLabels = SCOPE.hidden.map(w => WID_LABEL[w]).concat(SCOPE.ite3Hidden ? ['ITE 3-year'] : []);
      C.another.eq(onW.slice().sort(), SCOPE.wids.slice().sort(), label + ' shown route chips (the routes on screen)');
      C.another.eq(offW.map(w => w).sort(), SCOPE.hidden.concat(SCOPE.ite3Hidden && !SCOPE.hidden.includes('ite') ? ['ite'] : []).sort(), label + ' dashed route chips (the open routes the screen hides: ' + (hiddenLabels.join(', ') || 'none') + ')');
      hiddenLabels.forEach(n => C.another.ass(chips.some(c => !c.on && c.label === n), label + ' no "+ ' + n + '" chip: ' + JSON.stringify(chips.map(c => (c.on ? '' : '+') + c.label))));
      chips.forEach(c => { const lastOne = c.on && onW.length < 2; C.another.eq([c.x, c.add], [c.on && !lastOne, !c.on], label + ' chip "' + c.label + '" [has ✕, has +]'); });
      C.another.ass(T.rchipsAfterTiles || !chips.length, label + ' the route chips are not directly under the tiles');
      C.another.ass(!T.gone.alsoOpen, label + ' "Also open to you" is still on Courses');
      // a closed route has no chip
      SCOPE.closed.filter(w => !SCOPE.wids.includes(w)).forEach(w => C.another.ass(!chips.some(c => c.w === w), label + ' a chip for the closed route ' + w)); }
    // 4.8 the order of the cards inside each block
    reads.forEach(rd => { const dom = rd.dom; { const blocks = new Map();
      dom.forEach(d => { const k = d.sec + '|' + d.sub + '|' + d.seg + '|' + (d.table ? 't' : 'c'); if (!blocks.has(k)) blocks.set(k, []); blocks.get(k).push(d); });
      blocks.forEach((list, k) => {
        if (!/\|main\|/.test(k) && !/\|show-(more|norange)\|/.test(k)) return;
        if (list[0].table) {
          // the rows that carry an Arts pill come first, lowest gap first
          const vals = []; for (const d of list) { const cell = d.cells[0]; if (cell && cell.pill) vals.push(Number(String(cell.pill.text).replace('\u2212', '-'))); else break; }
          if (/\|main\|/.test(k)) { const rk = v => v >= 2 ? 0 : 1;  // Within reach rows first, then Borderline, each lowest gap first
            C.order.ass(vals.every((v, i) => !i || rk(vals[i - 1]) < rk(v) || (rk(vals[i - 1]) === rk(v) && vals[i - 1] <= v)), label + ' JC table ' + k + ': the Arts gaps come in the order ' + vals.join(', ')); }
          return;
        }
        if (/\|show-/.test(k)) return;
        const keyOf = d => { const c = cardByKey.get(d.key); const nm = (c.kind === 'pfp' || c.kind === 'arts') ? (c.inst + ' ' + c.title).toLowerCase() : c.title.toLowerCase();
          const ranged = !(c.state === 'unsure' && c.kind !== 'arts' && c.kind !== 'pfp') && c.kind !== 'arts' && c.kind !== 'pfp' && c.bestN != null;
          // Within reach (+2 or more), then Borderline, each most competitive (lowest gap) first; cards with no cut-off after them; not sure last
          if (ranged) return [c.bestN >= 2 ? 0 : 1, c.bestN, nm]; if (c.state === 'unsure' && c.kind !== 'arts' && c.kind !== 'pfp') return [3, 0, nm];
          return [2, c.kind === 'arts' ? RANK[c.state] : 0, nm]; };
        const keys = list.map(keyOf);
        for (let i = 1; i < keys.length; i++) {
          const a = keys[i - 1], b = keys[i];
          const ok = a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] <= b[2])));
          C.order.ass(ok, label + ' ' + k + ': "' + list[i - 1].key + '" ' + JSON.stringify(a.slice(0, 2)) + ' is followed by "' + list[i].key + '" ' + JSON.stringify(b.slice(0, 2)));
        }
      });
    } });
    // 4.13 the group of each card follows the margin rule, against the gap figures worked out here (JC table rows: 4.9)
    // in each grouping; the heads read "Within reach · N" (the count is checked with 4.3), long groups are whole once their "Show N more" is open, and an ITE card is one per college
    reads.forEach(rd => { const dom = rd.dom; dom.forEach(d => {
      if (d.table) return;
      const c = cardByKey.get(d.key); if (!c) return;
      const applies = (st.year === 2026 || EST_SECS.includes(c.sec)) && ['jc', 'course', 'ite'].includes(c.kind);
      if (!applies || c.state === 'no' || c.state === 'unsure') return;
      const tagg = label + ' ' + d.key + ' (gap ' + c.bestN + ', seg ' + d.seg + ', group "' + d.grp + '")';
      // a sub-group whose only cards have no cut-off needs no heading to tell them apart from the ranged ones above them
      if (c.bestN == null && d.seg === 'main' && d.grp === '') C.grouping.ass(!dom.some(x => x.sec === d.sec && x.sub === d.sub && x.seg === 'main' && x.key !== d.key && x.grp !== ''), tagg + ' sits under no heading although ranged cards share its sub-group');
      else if (c.bestN == null) C.grouping.ass(d.seg === 'main' && (st.year === 2027 ? /^No 2026 figure, so no estimate/ : /^No published cut-off/).test(d.grp), tagg + ' should sit under the no-cut-off heading (' + (st.year === 2027 ? '"No 2026 figure, so no estimate"' : '"No published cut-off"') + ')');
      else if (c.bestN <= -2) C.grouping.ass(d.seg === 'show-more', tagg + ' should be in the "Out of reach" fold');
      else C.grouping.ass(d.seg === 'main' && d.grp === marginGroup(c.bestN), tagg + ' should sit under "' + marginGroup(c.bestN) + '"');
    });
    // 4.13: a Borderline or Out of reach card carries one line saying what. It is a requirement the engine says is not met when there is one, else the gap in words
    // (+0 or +1: "One point better would make it safer."; -1: one point short; -2 or less: "N points short."). Within reach, no-range and can't-apply cards carry none.
    dom.forEach(d => {
      if (d.table) return;
      const c = cardByKey.get(d.key); if (!c || !['course', 'ite'].includes(c.kind)) return;
      if (!(st.year === 2026 || EST_SECS.includes(c.sec)) || c.state === 'no' || c.state === 'unsure') return;
      const g = c.bestN == null ? '' : marginGroup(c.bestN), tagm = label + ' ' + d.key + ' (gap ' + c.bestN + ', group ' + (g || 'none') + ')';
      if (g !== 'Borderline' && g !== 'Out of reach') { C.grouping.eq(d.miss.length, 0, tagm + ' lines saying what is missing'); return; }
      C.grouping.eq(d.miss.length, 1, tagm + ' lines saying what is missing');
      const m = d.miss[0] || '', o = c.offers[0], er = o && o.r ? eng.results.get(o.r.exercise + '|' + o.r.requirement_key) : null;
      const words = c.bestN >= 0 ? /^One point better would make it safer\.$/ : c.bestN === -1 ? /^One point short of (last year’s|the estimated) cut-off\.$/ : new RegExp('^' + (-c.bestN) + ' points short\\.$');
      if (words.test(m)) C.grouping.ok();
      else if (/^(One point better|One point short|\d+ points short)/.test(m)) C.grouping.fail(tagm + ' says "' + m + '", the gap does not give that');
      else C.grouping.ass(!!er && (er.reasons || []).some(x => x.kind === 'gate' || x.kind === 'mer'), tagm + ' names a requirement ("' + m.slice(0, 60) + '") but the engine has none for it');
    }); });
    // 2.12 the Details screen of two cards
    if (!st.insts || !st.insts.length) {
      const pickable = M2.cards.filter(c => !['arts', 'pfp'].includes(c.kind) && c.state !== 'no' && expMap.get(c.key) && expMap.get(c.key).every(Boolean));
      const picks = (st.persona ? pickable.slice(0, 1) : [pick(pickable), pick(pickable)]).filter(Boolean);
      if (st.year === 2027) { const pp = pickable.find(c => c.sec === 'ppoly' && !picks.includes(c)); if (pp) picks.push(pp); }
      for (const c of picks) {
        const eo = expMap.get(c.key);
        const live = eo.map((x, i) => ({ label: c.offers[i].label, o: x }));
        const bi = bestOracle(live); const best = c.offers.find(o => o.label === bi.label);
        const show = (c.kind === 'jc' || c.kind === 'ite') ? live : [bi];
        const est = show.some(x => x.o.est);
        await p.eval(`location.hash = '#course-${c.id}'; 1`); await sleep(70);
        const D = await p.eval(DETAIL_DOM);
        const tag = label + ' Details of ' + c.key;
        if (!D) { C.details.fail(tag + ': no Details screen'); continue; }
        // the list shortens an ITE title inside a Higher Nitec section; Details keep MOE's full name
        C.details.ass(D.title.indexOf(c.title) >= 0, tag + ' Details title "' + D.title + '" should carry MOE\'s full name "' + c.title + '"');
        const er = eng.results.get(best.r.exercise + '|' + best.r.requirement_key);
        const aggRes = eng.byId[er.aggregate_id];
        // the slots add up to the gross
        if (D.slots.length) { C.details.eq(D.slots.reduce((a, b) => a + b, 0), aggRes.gross, tag + ' points in "Which subjects counted" vs engine gross'); C.details.eq(D.total, aggRes.gross, tag + ' total row vs engine gross'); }
        else C.details.fail(tag + ': no "Which subjects counted" table');
        // fix list item 17: in an ELR2B2 line for the 2027 exams, a G3 subject in the B2 slot says it is counted at its G2 grade
        if (/^ELR2B2-[ABCD]\(2027\)/.test(er.aggregate_id)) {
          const b2 = (aggRes.slots || []).find(x => x.slot === 'B2'), row2 = D.slotRows.find(x => x.slot === 'B2');
          if (b2 && row2 && b2.level === 'G3') {
            const want = mapG2(G3.indexOf(b2.grade) + 1);
            C.b2.eq([b2.points, /\u2192 (\d+) at G2 \(B2 uses the G2 grade\)/.exec(row2.text) && Number(/\u2192 (\d+) at G2/.exec(row2.text)[1])], [want, want], tag + ' B2 row "' + row2.text + '" (engine points ' + b2.points + ', ' + b2.grade + ')');
          } else if (b2 && row2) C.b2.ass(!/\u2192/.test(row2.text), tag + ' B2 row at ' + b2.level + ' should carry no arrow: "' + row2.text + '"');
        }
        // the total line: gross - bonus = net, and the per-JC number
        const tl = D.totalLine;
        if (aggRes.net != null) {
          const nb = /^No bonus points, so your net score is (\d+)/.exec(tl);
          if (nb) { C.details.eq(Number(nb[1]), aggRes.net, tag + ' the "no bonus" line vs engine net'); C.details.eq(aggRes.gross, aggRes.net, tag + ' "no bonus" but the engine has gross != net'); }
          else C.details.ass(new RegExp('^' + aggRes.gross + '\\b').test(tl) && (new RegExp('= ' + aggRes.net + '\\b').test(tl)), tag + ' total line "' + tl + '" vs engine gross ' + aggRes.gross + ' / net ' + aggRes.net);
        }
        if (/for this JC/.test(tl)) C.details.ass(new RegExp('= ' + bi.o.net.value + ' for this JC').test(tl), tag + ' per-JC line "' + tl + '" vs ' + bi.o.net.value);
        if (er.exercise === 'PSE-2028' && !est) continue;
        // the net, with its marks
        const lead = show.filter(x => x.o.state !== 'no' && x.o.net.value != null)[0] || show[0];
        const ler = eng.results.get(c.offers.find(o => o.label === lead.label).r.exercise + '|' + c.offers.find(o => o.label === lead.label).r.requirement_key);
        C.details.eq([D.nline, D.nlineB, D.sup], ['Your net ' + letters(ler.aggregate_id) + ' aggregate: ' + lead.o.net.value + lead.o.net.marks, String(lead.o.net.value), lead.o.net.marks], tag + ' net line');
        // one range line per shown offer with the same gap
        // a JC or MI whose streams all carry one and the same gap prints its ranges without pills, then
        // one line with the pill: "+6 for all three streams" / "−2 for both streams"
        const same = c.kind === 'jc' && show.length > 1 && show.every(x => x.o.state !== 'no' && x.o.n != null && x.o.n === show[0].o.n && x.o.net.marks === show[0].o.net.marks);
        if (same) {
          const rl = D.rlines[show.length], n = show[0].o.n, words = show.length === 2 ? 'for both streams' : 'for all ' + (['', '', 'two', 'three', 'four'][show.length] || show.length) + ' streams';
          if (!rl) C.details.fail(tag + ' missing the one-pill line'); else C.details.eq([wsp(rl.text), rl.cls], [wsp(signed(n) + ' ' + words), pillClass(n)], tag + ' one-pill line [text, colour]');
        }
        show.forEach((x, k) => {
          const rl = D.rlines[k]; if (!rl) { C.details.fail(tag + ' missing range line ' + k); return; }
          if (x.o.state === 'no') { C.details.ass(/Can't apply/.test(rl.text), tag + ' range line says "' + rl.text + '", expected can\'t apply'); return; }
          if (x.o.n == null) return;
          const oer = eng.results.get(c.offers.find(o => o.label === x.label).r.exercise + '|' + c.offers.find(o => o.label === x.label).r.requirement_key);
          // "ITE College Central: ELR1B3-B 16-27 [indicative] -3"; the tag's words (textContent) carry the explanation, which names the cut-off in the 2026 view
          const want = (show.length > 1 ? x.label + ': ' : '') + letters(oer.aggregate_id) + ' ' + rangeText(x.o.range) + (same ? '' : ' ' + signed(x.o.n));
          const mm = /^(.*?) indicative(.*)$/.exec(wsp(rl.text));
          C.details.ass(!!mm, tag + ' range line has no "indicative" tag: ' + rl.text.slice(0, 80));
          const tail = mm ? mm[2] : '', pillTxt = same ? '' : ((/\s([+\u2212-]?\d+)$/.exec(tail) || [])[1] || '');
          C.details.eq([mm ? wsp(mm[1] + (pillTxt ? ' ' + pillTxt : '')) : wsp(rl.text), rl.cls], [wsp(want), same ? '' : pillClass(x.o.n)], tag + ' range line [text, colour]');
          if (mm && !x.o.est) { const top = /top number, (\d+), was the cut-off/.exec(tail); C.details.eq(top && Number(top[1]), x.o.range[1], tag + ' the tag names the cut-off'); }
        });
      }
    }
    // 4.7 the numbers in the Institution part of the Filter sheet
    if (st.year === 2026 && !(st.insts && st.insts.length) && !st.q && chance(0.34)) {
      await p.eval(`location.hash = '#courses'; 1`); await sleep(80);
      const sheetOpened = await p.eval(`(() => { const b = document.querySelector('[data-do="sheet-filter"]'); if (!b) return false; b.click(); return true; })()`);
      if (sheetOpened) {
        await sleep(80);
        const entries = await p.eval(`[...document.querySelectorAll('#sheet fieldset.inst-group')].flatMap(f => [...f.querySelectorAll('li')].map(li => ({ g: f.querySelector('legend').textContent, name: li.querySelector('label span[data-wc="0"]').textContent, n: Number((li.querySelector('.count') || {}).textContent) })))`);
        await p.eval(`(document.querySelector('#sheet [data-do="sheet-close"]')||{click(){}}).click(); 1`);
        const LEG = { jc: 'Junior colleges', mi: 'Millennia Institute', poly: 'Polytechnics', ite: 'ITE colleges', arts: 'Arts institutions' };
        const want = new Map();
        const secs = [...new Set(visible.map(c => c.sec))];
        secs.forEach(sid => {
          const cs = cardsOf(sid); const sp = splitOracle(cs, sid, st);
          sp.shown.concat(sp.noRange).filter(canApplyCard).forEach(c => c.insts.forEach(i => { const k = LEG[c.where] + '|' + i; want.set(k, (want.get(k) || 0) + 1); }));
        });
        entries.forEach(e => C.sheetCount.eq(e.n, want.get(e.g + '|' + e.name) || 0, label + ' Institution sheet: ' + e.g + ' / ' + e.name));
      }
    }
    // 2.15 an arts card's Details screen (fix list item 3: "Your net AI4 aggregate: 11")
    if (!(st.insts && st.insts.length)) {
      const artsC = M2.cards.filter(c => c.kind === 'arts' && c.arts && c.arts.value != null);
      if (artsC.length && (st.persona || chance(0.5))) {
        const c = pick(artsC), agg = ARTS_AGG[c.sec], r = eng.byId[agg];
        await p.eval(`location.hash = '#course-${c.id}'; 1`); await sleep(70);
        const D = await p.eval(DETAIL_DOM);
        const tag = label + ' Details of ' + c.key;
        if (!D || !r) C.artsDet.fail(tag + ': no Details screen or no engine result');
        else {
          const hasBonus = !!(DEFS.get(agg) && DEFS.get(agg).bonus);
          const nafaNet = c.inst === 'NAFA' && (c.sec === 'ai' || c.sec === 'pai') && r.net != null;  // engine 0.1.7: NAFA's diploma minimum is on the net in both years (CCA counts)
          const word = hasBonus && nafaNet ? 'net' : 'gross';
          const val = nafaNet ? r.net : r.gross;
          C.artsDet.eq(D.nline, 'Your ' + word + ' ' + letters(agg) + ' aggregate: ' + val, tag + ' number line');
          C.artsDet.eq(c.arts.value, val, tag + ' value on the card model');
        }
      }
    }
    // 2.14 an independent gross
    if (st.year === 2026 && st.subs.every(x => x[1] === 'O')) {
      ['L1R5(2026)', 'L1R4(2026)', 'ELR2B2-A(2026)', 'ELR2B2-B(2026)', 'ELR2B2-C:POLY(2026)', 'ELR2B2-D(2026)'].forEach(id => {
        const r = eng.byId[id]; if (!r || r.status !== 'computed' || r.gross == null) return;
        C.gross.eq(grossOracle(st, id), r.gross, label + ' ' + id + ' gross (engine ' + r.gross + ')');
      });
    }
    // 2.13 a closed route says why in its tile's pop-over (the "Not open to you" line is gone). The tiles follow the results: the routes of the student's top open tier and every closed route in or above
    // it. Each closed tile stands for sections with nothing to apply for, each open tile for sections with something; each reason's limit comes from the rule text; the number the student has is on the tile,
    // so a reason does not say "Yours is N" again.
    { const tiles = counts.top.tiles, TIER = { jc: 1, pjc: 1, mi: 1, pmi: 1, poly: 2, ppoly: 2, pfp: 2, ppfp: 2, dppvia: 2, ite2: 3, pite2: 3, dpp: 3, jien: 4, pite3: 4 };
      const present = sid => M2.cards.some(c => c.sec === sid), closedSec = sid => SCOPE.secClosed(sid);
      tiles.forEach(tl => {
        const words = tileWords(tl), secs = words.flatMap(w => (SECS_OF[w] || []).filter(present));
        C.why.ass(words.every(w => SECS_OF[w]) && secs.length > 0, label + ' tile "' + tl.label + '" stands for no section that has cards');
        if (tl.off) C.why.ass(secs.every(closedSec), label + ' closed tile "' + tl.label + '" although ' + secs.filter(x => !closedSec(x)).join(', ') + ' can be applied for');
        else C.why.ass(secs.some(x => !closedSec(x)), label + ' open tile "' + tl.label + '" although nothing in ' + secs.join(', ') + ' can be applied for');
        if (tl.off) C.why.ass(tl.lines.length > 0, label + ' closed tile "' + tl.label + '" says nothing in its pop-over');
        // closed "✗ …"; open with every course in "check" "? Check with NAFA / LASALLE / the school" (amber); else "✓ open"
        { const info = tileInfo(tl);
          C.why.eq([tl.off, tl.chk, tl.off ? /^✗ /.test(tl.word) : tl.word], [info.closed, info.check, info.closed ? true : info.word], label + ' tile "' + tl.label + '" [closed, amber check look, its word]'); }
      });
      // the closed routes of the top tier and above have a tile (a route below the top open tier has none: its pathway chip says so on Results)
      const cardsW = w => M2.cards.filter(c => c.where === w), topOf = pred => { const ts = M2.cards.filter(c => c.kind !== 'arts' && TIER[c.sec] && pred(c)).map(c => TIER[c.sec]); return ts.length ? Math.min(...ts) : 0; };
      const reachC = c => canApplyCard(c) && (c.bestN == null || c.bestN >= -1), tierTop = topOf(reachC) || topOf(canApplyCard);
      const tierOfW = w => Math.min(...cardsW(w).map(c => TIER[c.sec] || 9));
      // a closed route the top grades would not open has no tile at all; one they would open has its closed tile
      const tileFor = w => tiles.some(tl => tileWords(tl).flatMap(x => SECS_OF[x] || []).some(sid => present(sid) && WID_OF_SEC[sid] === w));
      SCOPE.closedHard.filter(w => w !== 'arts' && cardsW(w).length && !BEST_OPEN.has(w)).forEach(w =>
        C.why.ass(!tileFor(w), label + ' a tile for ' + w + ', which even the top grades would not open'));
      if (tierTop) SCOPE.closedHard.filter(w => w !== 'arts' && cardsW(w).length && BEST_OPEN.has(w)).forEach(w => { if (tierOfW(w) > tierTop) return;
        C.why.ass(tiles.some(tl => tl.off && tileWords(tl).flatMap(x => SECS_OF[x] || []).some(sid => present(sid) && WID_OF_SEC[sid] === w)), label + ' no closed tile for ' + w + ' (tier ' + tierOfW(w) + ' of top ' + tierTop + '): ' + JSON.stringify(tiles.map(tl => (tl.off ? '✗ ' : '') + tl.label))); });
      tiles.filter(tl => tl.off).forEach(tl => tl.lines.forEach(t => {
        const m = /(?:need|needs) an? (?:(gross|net) )?(\S+) of (\d+) or better/.exec(t);
        if (!m) return;
        const [, kind, name, thr] = m;
        const idsAll = Object.keys(eng.byId).filter(id => (letters(id) === name || letters(id).indexOf(name + '-') === 0) && (st.year === 2027 ? /\(2027\)|^EMB1/.test(id) : /\(2026\)/.test(id)));
        const cks = idsAll.flatMap(id => (DEFS.get(id).checks || []).filter(ck => Number(ck.max) === Number(thr) && (!kind || (kind === 'net' ? /net/.test(ck.type) : /gross/.test(ck.type)))));
        C.why.ass(cks.length > 0, label + ' "' + t + '": no ' + (kind || 'gross or net') + ' rule with a limit of ' + thr + ' for ' + name);
        C.why.ass(!/Yours is/.test(t), label + ' "' + t + '" repeats the student\'s number');
      }));
      C.why.ass(!counts.top.gone.notOpen, label + ' a "Not open to you" line is still on Courses');
      // a 5th-year tile exactly when the engine's 5TH-YEAR(2027) summary says the student meets MOE's
      // criteria for sure; its number is the gross aggregate that meets criterion b (the first under its limit, in the
      // definitions' order), else "Meets the criteria"; and the pop-over says whether all subjects can be at G3
      { const sm = eng.byId['5TH-YEAR(2027)'], el = id => ((sm && sm.eligibility) || []).find(x => x.id === id) || {};
        const spec = ((DATA.definitions.summaries) || []).find(x => x.id === '5TH-YEAR(2027)'), f = counts.top.fifth;
        const want = st.year === 2027 && el('eligible').met === true;
        C.why.eq(!!f, want, label + ' a 5th-year tile [shown]');
        if (f && want && spec) {
          const hit = el('criterion_b').met === true ? spec.criterion_b.any_of.find(x => eng.byId[x.aggregate] && eng.byId[x.aggregate].gross != null && eng.byId[x.aggregate].gross <= x.max) : null;
          C.why.eq(f.num, hit ? String(eng.byId[hit.aggregate].gross) : 'Meets the criteria', label + ' the 5th-year tile\'s number');
          C.why.eq(f.word, '✓ open', label + ' the 5th-year tile\'s word');
          const all = eng.byId[spec.all_g3.aggregate], allOk = all && all.gross != null ? all.gross <= spec.all_g3.max : null;
          if (allOk != null) C.why.ass(f.lines.some(l => (allOk ? /you can take all your subjects at G3/ : /To take all your subjects at G3/).test(l)), label + ' the 5th-year pop-over on all subjects at G3: ' + JSON.stringify(f.lines));
        } } }
    // ---- counts (4.3 - 4.5) ----
    counts.groups.forEach(g => {
      // a route whose sections carry a route band (polytechnic, ITE, PFP) has its numbers on the band (checked above, against the engine), so its head carries none of its own
      if (g.listed) { C.headCount.eq(g.n, 0, label + ' group head ' + g.wid + ': a route with route bands carries no number on its head'); return; }
      const secs = [...new Set(M2.cards.filter(c => c.where === g.wid).map(c => c.sec))].filter(s => secOk(s) && !(s === 'dppvia' && scope.includes('ite')));
      let n = 0;
      const why = [];
      secs.forEach(sid => { const cs = cardsOf(sid); const sp = splitOracle(cs, sid, st); const k = sp.shown.concat(sp.noRange).filter(canApplyCard).length; n += k; why.push(sid + ':' + k + '/' + cs.length + '[' + cs.map(c => c.state).join(',') + ']'); });
      C.headCount.eq(g.n, n, label + ' group head ' + g.wid + (g.n !== n ? ' (sections ' + why.join(' ') + '; head text "' + wsp(g.text || '') + '")' : ''));
    });
    counts.secs.forEach(s => {
      if (s.n == null) return;
      const cs = cardsOf(s.id); const sp = splitOracle(cs, s.id, st);
      C.headCount.eq(s.n, sp.shown.concat(sp.noRange).filter(canApplyCard).length, label + ' section head ' + s.id);
    });
    // 4.4 a long group shows its first 10 cards, then "Show N more": the cards drawn under "Within reach · N" / "Borderline · N" before any fold is opened are min(N, 10), and the button is there when N is over 10
    reads.forEach(rd => rd.counts.grps.forEach(g => { const m = /^(.*) \u00B7 (\d+)$/.exec(g.text); if (!m) return;
      C.foldCount.eq([g.shown, g.more], [Math.min(Number(m[2]), 10), Number(m[2]) > 10], label + ' [Group: ' + rd.mode + '] ' + g.sec + ' "' + g.text + '" [cards drawn, "Show N more"]'); }));
    // folds (4.4), in each grouping: the number in the button = the cards in the block that follows it = the rule. "Show N more" opens a long group's cards past the tenth; a polytechnic, ITE or PFP list
    // is judged by its views (one card per college)
    reads.forEach(rd => rd.counts.folds.forEach(f => {
      const tagf = label + ' [Group: ' + rd.mode + '] fold ' + f.do + ' ' + f.v + ' "' + f.text + '"';
      if (!['show-no', 'show-more', 'show-norange', 'show-long'].includes(f.do)) return;
      if (SPLITSET.has(f.sec) || PFPSET.has(f.sec)) {
        const pt = f.v.split('|'), gname = f.do === 'show-long' ? pt.pop() : '', sid = pt[0], mode = pt[1] || 'none', k = pt.slice(2).join('|'), sub = pt.length > 1 ? pt.join('|') : '';
        const its = itemsOf(sid).filter(x => pt.length === 1 || groupName(x, mode) === k);
        if (f.do === 'show-long') { const T = tally(its), N = gname === 'in' ? T.i : T.b; C.foldCount.eq(f.n, N - 10, tagf + ' "Show N more" vs the group (' + N + ' cards, first 10 shown)'); return; }
        const mine = rd.dom.filter(d => d.seg === f.do && d.sec === sid && d.sub === sub);
        const exp = f.do === 'show-no' ? its.filter(x => x.state === 'no') : its.filter(x => x.state !== 'no' && x.bestN != null && x.bestN <= -2);
        C.foldCount.eq([mine.length, f.n], [exp.length, exp.length], tagf + ' [cards in the block, number] vs the rule');
        const got = new Set(mine.map(d => d.key));
        C.foldCount.ass(exp.length === got.size && exp.every(c => got.has(c.key)), tagf + ' holds other cards than the rule gives');
        if (f.do === 'show-more') C.foldWord.ass(/^Out of reach: \d+ more/.test(f.text) && mine.every(d => { const cc = cardByKey.get(d.key); return cc && cc.bestN != null && cc.bestN <= -2; }), tagf + ' says out of reach, but not every card in it is 2 or more points short');
        return;
      }
      if (f.do === 'show-long') return;
      const isSub = f.v.indexOf('|') >= 0;
      const mine = rd.dom.filter(d => d.seg === f.do && d.sec === f.sec && d.sub === (isSub ? f.v : ''));
      C.foldCount.eq(mine.length, f.n, tagf + ' cards in the block');
      const cs = cardsOf(f.sec);
      const sp = splitOracle(cs, f.sec, st);
      const expc = f.do === 'show-no' ? sp.no : f.do === 'show-more' ? sp.beyond : sp.noRange;
      C.foldCount.eq(f.n, expc.length, tagf + ' number vs the rule');
      const got = new Set(mine.map(d => d.key));
      if (f.do === 'show-more') {  // fix list item 13: the wording follows what is inside
        // the fold is "Out of reach: N more": every card in it is 2 or more points short
        const allOut = mine.length > 0 && mine.every(d => { const cc = cardByKey.get(d.key); return cc && cc.bestN != null && cc.bestN <= -2; });
        if (/^Out of reach: \d+ more/.test(f.text)) C.foldWord.ass(allOut, tagf + ' says out of reach, but not every card in it is 2 or more points short');
        else C.foldWord.fail(tagf + ': wording not recognised');
      }
      C.foldCount.ass(expc.length === got.size && expc.every(c => got.has(c.key)), tagf + ' holds other cards than the rule gives');
    }));
    // 4.5 the toolbar: Group None · Field · Institution (None on, when a route has a list to group), the Filter chip with the number of filters on, the chips under the bar that remove them
    // and "Show all"; Sort and the old pickers are gone (the list is always in chance order)
    { const T = counts.top, tb = T.tbar, flt = T.fchips;
      C.toolsCount.ass(!!tb && tb.map, label + ' no toolbar with Map on Courses');
      if (tb) {
        C.toolsCount.eq(tb.group.map(x => x.v + (x.on ? '*' : '')), M2.cards.some(c => scope.includes(c.where) && secOk(c.sec) && !(c.sec === 'dppvia' && scope.includes('ite')) && (SPLITSET.has(c.sec) || PFPSET.has(c.sec))) ? ['none*', 'field', 'inst'] : [], label + ' the Group control [None on by default] (shown when a route has a list to group)');
        C.toolsCount.eq(tb.filter && tb.filter.n, flt.length, label + ' the Filter chip\'s count vs the chips under the bar');
        C.toolsCount.ass(flt.every(x => x.k === 'field' ? (st.fields || []).includes(x.v) : (st.insts || []).includes(x.v)), label + ' a filter chip for a filter that is not on: ' + JSON.stringify(flt));
        C.toolsCount.eq(tb.sticky, 'sticky', label + ' the toolbar sticks under the top bar');
        C.toolsCount.eq(T.showAll, flt.length > 0, label + ' "Show all" beside the chips');
      }
      C.toolsCount.ass(!T.gone.sort && !T.gone.sheetField && !T.gone.sheetInst && !T.gone.gTools, label + ' something took away is still there: ' + JSON.stringify(T.gone)); }
    return true;
  };
  for (let i = 0; usedRandom < N_STUDENTS && i < N_STUDENTS * 3; i++) {
    const st = genStudent(i);
    st.reach = chance(0.4); st.allow = Math.floor(RND() * 4);  // reach and filters vary, so the counts are checked both ways
    if (await doStudent(st)) usedRandom++;
  }
  for (const pr of PERSONAS) await doStudent(Object.assign({ persona: true, name: pr.id, reach: false, allow: 0 }, pr));
  // 4.14: the Group choice applies to every route list on the screen and is kept for the visit (sessionStorage), like the route chips: Field survives a reload and groups the polytechnic list
  // while the JC table stays a table; a new visit starts on None
  { const pg = await openPage(null, { width: 1280, height: 900 }), st = Object.assign({ persona: true, name: 'P5A', reach: false, allow: 0 }, PERSONAS.find(x => x.id === 'P5A'));
    const probe = `(() => ({ on: [...document.querySelectorAll('#tbar [data-do="groupby"]')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.v), polyHeads: document.querySelectorAll('#sec-poly .sub-head').length, polyCards: document.querySelectorAll('#sec-poly .cc').length, jcHeads: document.querySelectorAll('#sec-jc .sub-head').length, jcRows: document.querySelectorAll('#sec-jc .jct-r').length }))()`;
    await loadState(pg, stateOf(st)); await pg.eval(`document.querySelector('[data-do="groupby"][data-v="field"]').click(); 1`); await sleep(120);
    const a1 = await pg.eval(probe); await pg.reload(); await sleep(250); const a2 = await pg.eval(probe);
    C.groupSame.eq([a1.on, a1.polyHeads > 0, a1.polyCards, a1.jcHeads, a1.jcRows > 0], [['field'], true, 0, 0, true], '[P5A] Group: Field on the screen [pressed, poly grouped, poly cards before a group is opened, JC headings, JC table rows]');
    C.groupSame.eq([a2.on, a2.polyHeads > 0], [['field'], true], '[P5A] Group: Field kept after a reload [pressed, poly grouped]');
    await pg.eval(`try { sessionStorage.clear(); } catch (e) {} 1`); await pg.reload(); await sleep(250); const a3 = await pg.eval(probe);
    C.groupSame.eq([a3.on, a3.polyHeads], [['none'], 0], '[P5A] a new visit starts on None [pressed, poly group headings]');
    await pg.close(); }
  // /the personas again on a phone (390 px): the same cards in the same groups, each with the same badges, in each grouping
  { const pw = await openPage(null, { width: 390, height: 844 }), pl = await openPage(null, { width: 1280, height: 900 });
    const strip = ({ sub, cls, sec, wid, ...r }) => JSON.stringify(r);
    for (const pr of PERSONAS) {
      const st = Object.assign({ persona: true, name: pr.id, reach: false, allow: 0 }, pr);
      say('phone parity ' + pr.id);
      await loadState(pl, stateOf(st)); await loadState(pw, stateOf(st));
      await pl.send('Page.bringToFront'); const a = await expandAndRead(pl, ['none', 'field', 'inst']);  // a tab behind another has its timers slowed to one a second
      await pw.send('Page.bringToFront'); const b = await expandAndRead(pw, ['none', 'field', 'inst']);
      a.reads.forEach((ra, i) => { const rb = b.reads[i];
        C.presence.eq(rb.counts.secs.map(x => [x.id, x.band]), ra.counts.secs.map(x => [x.id, x.band]), '[' + pr.id + '] phone [Group: ' + ra.mode + ']: the sections and their bands');
        let why = ''; if (ra.dom.length !== rb.dom.length) why = ra.dom.length + ' cards on a laptop, ' + rb.dom.length + ' on a phone'; else { const j = ra.dom.findIndex((r, n) => strip(r) !== strip(rb.dom[n])); if (j >= 0) why = 'card ' + ra.dom[j].key + ': laptop ' + strip(ra.dom[j]).slice(0, 150) + ' phone ' + strip(rb.dom[j]).slice(0, 150); }
        C.presence.ass(!why, '[' + pr.id + '] phone [Group: ' + ra.mode + ']: the list is not the laptop\'s (' + why + ')'); });
    }
    await pw.close(); await pl.close(); }
  await p.close();
  info('students checked', usedRandom + ' random students + ' + (used - usedRandom) + ' personas (' + skipped + ' mixes skipped because the engine called them invalid: ' + JSON.stringify(skipWhy) + '); seed ' + SEED);
  info('rows reached by a card', COVERED_ROWS.size + ' of ' + ROWS.length + ' course rows');
  info('cards the screen checks read', Object.keys(COVER.recs).sort().map(k => k + ' ' + COVER.cards[k] + ' cards (' + COVER.recs[k] + ' entries)').join(', '));
  info('tiles read in the pop-over checks', Object.entries(COVER.tiles).map(([k, v]) => v + ' ' + k).join(', ') + '; line forms: ' + Object.entries(COVER.forms).map(([k, v]) => v + ' "' + k + '"').join(', '));
  info('Courses reads', COVER.reads + ' (Group: None for every student; Field and Institution too for the personas and one student in three), plus the personas again on a phone');
  const missed = ROWS.filter(r => !COVERED_ROWS.has(r.id));
  const c11 = check(1, '1.8', 'every course row with a requirement record is reached by some card for some student');
  const withRec = new Set(RECS.map(r => ROWS[r.course].id));
  ROWS.forEach(r => { if (!withRec.has(r.id)) return; c11.ass(COVERED_ROWS.has(r.id), 'never shown: ' + r.id); });
  ROWS.filter(r => !withRec.has(r.id)).forEach(r => c11.note('no requirement record, so never on a card: ' + r.id + ' (' + r.admission_route + ')'));
  info('ranges dropped by the basis guard', ESTIMATE_SEEN.basisDropped + ' of ' + ESTIMATE_SEEN.offers + ' offers (a range whose aggregate is not the course\'s own is never shown)');
  info('estimates seen in 2027 views', ESTIMATE_SEEN.shown + ' offers with an estimate, ' + ESTIMATE_SEEN.none + ' without');
}

// ================================================================================================ 3 The 2028 estimates (rule, examples, domain)
async function check3() {
  const p = await openPage(null, { width: 375, height: 812 });
  await loadState(p, state({ year: 2027, level: 'G3', rows: [] }), '#input');
  const pageEst = (agg, x, from) => p.eval(`window.PSE_ATLAS.estimate2028(${JSON.stringify(agg)}, ${x}${from ? ', ' + JSON.stringify(from) : ''})`);
  const c31 = check(3, '3.1', 'worked examples: L1R4 6->5, 12->10, 20->16; ELR2B2 5->5, 10->9, 15->13, 20->18, 25->22, 26->22 (page function and the rule written here)');
  const ex = [['L1R4(2027)', 6, 5], ['L1R4(2027)', 12, 10], ['L1R4(2027)', 20, 16], ['ELR2B2-B(2027)', 5, 5], ['ELR2B2-B(2027)', 10, 9], ['ELR2B2-B(2027)', 15, 13], ['ELR2B2-B(2027)', 20, 18], ['ELR2B2-B(2027)', 25, 22], ['ELR2B2-B(2027)', 26, 22]];
  for (const [agg, x, want] of ex) {
    c31.eq(await pageEst(agg, x), want, 'page estimate2028(' + agg + ', ' + x + ')');
    c31.eq(estimateRef(estKindOf(agg), x), want, 'rule written here (' + agg + ', ' + x + ')');
  }
  for (const [x, want] of [[34, 14], [27, 10], [18, 8], [16, 6]]) {
    c31.eq(await pageEst('ELMAB3:ITE(2027)', x, 'ELR2B2-C'), want, 'page ITE 2-year five-subject conversion of ' + x);
    c31.eq(fiveSubjectEstimate(x), want, 'rule written here, five-subject conversion of ' + x);
  }
  c31.eq(await pageEst('L1R4(2027)', 24, 'L1R4'), 20, 'page MI estimate of 24 (capped at 20)');
  c31.eq(await pageEst('L1R4(2027)', 12, 'L1R4'), 12, 'page MI estimate of 12 (as it is)');
  const c32 = check(3, '3.2', 'the page function equals the rule for every whole number 0..60: L1R4 (JC and MI), each ELR2B2 letter, ITE 2-year (JIE \'H\' as it is; the three five-subject O-Level kinds) and ITE 3-year (as it is); and never goes down as the 2026 figure goes up');
  const CASES = [['L1R4(2027)', '', x => estimateRef('L1R4', x)], ['L1R4(2027)', 'L1R4', x => asItIs(x, 20)]]
    .concat(['A', 'B', 'C', 'D'].map(l => ['ELR2B2-' + l + '(2027)', '', x => estimateRef('ELR2B2', x)]))
    .concat([['ELMAB3:ITE(2027)', 'ELMAB3', x => asItIs(x)]], FIVE_OLEVEL.map(f => ['ELMAB3:ITE(2027)', f, fiveSubjectEstimate]))
    .concat(['R2B2', 'R1B3-A', 'R1B3-B', 'R1B3-C', 'B4'].map(a => [a + '(2027)', '', x => asItIs(x)]));
  for (const [agg, from, rule] of CASES) {
    const got = await p.eval(`(() => { const o = []; for (let x = 0; x <= 60; x++) o.push(window.PSE_ATLAS.estimate2028(${JSON.stringify(agg)}, x${from ? ', ' + JSON.stringify(from) : ''})); return o; })()`);
    let mono = true, same = true;
    got.forEach((v, x) => { if (v !== rule(x)) { same = false; c32.fail(agg + (from ? ' from ' + from : '') + ' x=' + x + ' page=' + v + ' rule=' + rule(x)); } if (x && v < got[x - 1]) mono = false; });
    c32.ass(mono, agg + (from ? ' from ' + from : '') + ' goes down somewhere'); if (same) c32.ok();
  }
  const c33 = check(3, '3.3', 'every 2026 range in the data that feeds a 2028 estimate maps to one between 1 and its cap (16 for JC, 20 for MI, 22 for polytechnic; none for ITE) with low <= high, and the page function gives the rule written here');
  let jcN = 0, polyN = 0, miN = 0, iteN = 0;
  for (const r of ROWS) {
    if (!r.net_range_2026) continue;
    const aggs = r.institution_type === 'JC' && r.aggregate_type === 'L1R5' ? [['L1R4(2027)', '']] : r.institution_type === 'MI' ? [['L1R4(2027)', 'L1R4']]
      : r.institution_type === 'Polytechnic' && /^ELR2B2-[ABCD]$/.test(r.aggregate_type) ? [[r.aggregate_type + '(2027)', r.aggregate_type]]
      : r.institution_type === 'ITE' && r.admission_route === 'JIEH' ? [['ELMAB3:ITE(2027)', 'ELMAB3']]
      : r.institution_type === 'ITE' && r.admission_route === 'JAE' && FIVE_OLEVEL.includes(r.aggregate_type) ? [['ELMAB3:ITE(2027)', r.aggregate_type]]
      : r.institution_type === 'ITE' && r.admission_route === 'JIEN' ? (r.exercises.filter(e => e[0] === 'PSE-2028').map(e => [e[2], r.aggregate_type])) : [];
    for (const [agg, from] of aggs) {
      const lo = await pageEst(agg, r.net_range_2026[0], from), hi = await pageEst(agg, r.net_range_2026[1], from);
      const kind = estKindOf(agg);
      const rule = r.institution_type === 'JC' ? x => estimateRef('L1R4', x) : r.institution_type === 'MI' ? x => asItIs(x, 20) : r.institution_type === 'Polytechnic' ? x => estimateRef('ELR2B2', x)
        : r.admission_route === 'JAE' ? fiveSubjectEstimate : x => asItIs(x);
      const cap = r.institution_type === 'JC' ? 16 : r.institution_type === 'MI' ? 20 : r.institution_type === 'Polytechnic' ? 22 : 1e9;
      c33.ass(lo >= 1 && hi <= cap && lo <= hi && lo === rule(r.net_range_2026[0]) && hi === rule(r.net_range_2026[1]), r.id + ' ' + agg + ' ' + JSON.stringify(r.net_range_2026) + ' -> ' + lo + '-' + hi + ' (cap ' + cap + ')');
      r.institution_type === 'JC' ? jcN++ : r.institution_type === 'MI' ? miN++ : r.institution_type === 'Polytechnic' ? polyN++ : iteN++;
    }
  }
  info('2026 ranges estimated for 2028', jcN + ' JC rows (L1R5 -> L1R4), ' + miN + ' MI rows (L1R4, capped 20), ' + polyN + ' polytechnic rows (ELR2B2) and ' + iteN + ' ITE rows (JIE H, five-subject O-Level, JIE N)');
  const c35 = check(3, '3.5', 'the estimate function refuses PFP and arts aggregates, 2026 aggregate ids and missing numbers');
  for (const agg of ['ELMAB3:PFP(2027)', 'AI4(2027)', 'ELMAB3:NFP(2027)', 'ELMAB3:DPP(2026)', 'B4(2026)']) {
    const v = await pageEst(agg, 10);
    c35.ass(v === null, 'estimate2028(' + agg + ', 10) = ' + v + ' (expected null)');
  }
  for (const agg of ['L1R4(2026)', 'L1R5(2026)', 'ELR2B2-B(2026)', 'ELR2B2-C:POLY(2026)']) {
    const v = await pageEst(agg, 10);
    c35.ass(v === null, 'estimate2028(' + agg + ', 10) = ' + v + ' (fix list item 21: it refuses 2026 aggregate ids)');
  }
  c35.ass(await pageEst('L1R4(2027)', null) === null, 'estimate2028(L1R4, null) is not null');
  await p.close();
}

// ================================================================================================ 5 Dates
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dm = d => Number(d.slice(8, 10)) + ' ' + MON[Number(d.slice(5, 7)) - 1];
const whenText = (s, e) => s && e ? (s === e ? dm(s) : s.slice(0, 7) === e.slice(0, 7) ? Number(s.slice(8, 10)) + '–' + dm(e) : dm(s) + ' – ' + dm(e)) : s ? 'From ' + dm(s) : e ? 'By ' + dm(e) : '';
const FAMILY_OF = { 'Results': ['EXAM-2026', 'PSE-2028'], 'Exams': ['EXAM-2027'], 'JAE': ['JAE-2027'], 'JIE': ['JIE-N-2027', 'JIE-O-2027', 'JIE-E-2027'], 'DPP': ['DPP-2027'], 'PFP': ['PFP-2027'],
  'NAFA / LASALLE': ['AI-ADM-2027', 'AI-EAE-2027', 'AI-EAE-2028', 'NFP-2027'], 'Sec 5': ['SEC5-2027'], 'EAE': ['POLY-EAE-2027-O', 'ITE-EAE-2027', 'POLY-EAE-2028', 'ITE-EAE-2028'], 'DSA': ['DSA-JC-2027', 'DSA-JC-2028'], 'PSE': ['PSE-2028'] };
const CURRENT_ROWS = EXERCISES.filter(r => r.cycle_status === 'current');
// every date text the CSVs can give for an exercise: [{text, start, end, basis, monthOnly, fromRow}]
function csvWhens(exIds) {
  const out = [];
  FILLS.filter(f => exIds.includes(f.exercise_id)).forEach(f => {
    if (f.basis === 'month_only') { out.push({ text: f.note, monthOnly: true, src: 'fill ' + f.exercise_id + ' ' + f.phase_prefix, basis: f.basis }); return; }
    out.push({ text: (f.basis === 'inferred' ? 'expected ' : '') + whenText(f.date_start, f.date_end), start: f.date_start, end: f.date_end, basis: f.basis, src: 'fill ' + f.exercise_id + ' ' + f.phase_prefix, phase: f.phase_prefix });
  });
  CURRENT_ROWS.filter(r => exIds.includes(r.exercise_id)).forEach(r => {
    if (r.date_start || r.date_end) out.push({ text: whenText(r.date_start, r.date_end) + (/tentative/i.test(r.date_text) ? ' (tentative)' : ''), start: r.date_start, end: r.date_end, basis: 'row', src: 'row ' + r.exercise_id + ' ' + r.phase, phase: r.phase });
    else out.push({ text: r.date_text, monthOnly: true, src: 'row ' + r.exercise_id + ' ' + r.phase, basis: 'row' });
  });
  return out;
}
// who can use which application window (MOE's pages; the page's own table is not read)
const WINDOWS = [
  { who: ['O'], where: ['jc', 'mi', 'poly', 'ite'], ex: 'JAE-2027', prefix: 'apply', title: 'Apply in the JAE' },
  { who: ['O'], where: ['ite'], ex: 'JIE-O-2027', prefix: 'apply', title: "Apply for ITE 3-year courses (JIE 'O')" },
  { who: ['O'], where: ['arts'], ex: 'AI-ADM-2027', prefix: 'apply', note: /LASALLE/, title: 'Apply to LASALLE' },
  { who: ['O'], where: ['arts'], ex: 'AI-ADM-2027', prefix: 'apply', note: /NAFA/, title: 'Apply to NAFA' },
  { who: ['N(A)'], where: ['ite', 'poly'], ex: 'DPP-2027', prefix: 'apply (1st window', title: "Apply for DPP (JIE 'H')" },
  { who: ['N(A)'], where: ['ite', 'poly'], ex: 'DPP-2027', prefix: 'apply (2nd window', title: 'DPP second window' },
  { who: ['N(A)', 'N(T)'], where: ['ite'], ex: 'JIE-N-2027', prefix: 'apply', title: "Apply for ITE 3-year courses (JIE 'N')" },
  { who: ['N(T)'], where: ['ite'], ex: 'JIE-E-2027', prefix: 'apply', title: "Apply for JIE 'E'" },
  { who: ['N(A)'], where: ['arts'], ex: 'NFP-2027', prefix: 'apply', title: 'Apply for the NAFA Foundation Programme (NFP)' },
  { who: ['N(A)'], where: ['poly'], ex: 'PFP-2027', prefix: 'apply', title: 'Apply for PFP' }
];
// the "Next:" line may name the route in words; the CSV-style title is still accepted
const NEXT_ALT = { "Apply for DPP (JIE 'H')": ['Apply for DPP (to poly through ITE)'] };
function windowOf(w) {
  const f = FILLS.find(x => x.exercise_id === w.ex && x.phase_prefix.startsWith(w.prefix) && (!w.note || w.note.test(x.note)));
  return f ? Object.assign({ title: w.title, start: f.date_start, end: f.date_end, basis: f.basis }, { w }) : null;
}
// the next application date for a student, from the CSVs: windows open today first, else the soonest to open
function nextWindow(who, wheres, today) {
  const live = WINDOWS.filter(w => w.who.includes(who) && (!wheres.length || w.where.some(x => wheres.includes(x)))).map(windowOf).filter(Boolean);
  const notClosed = live.filter(x => (x.end || '9999') >= today);
  const open = notClosed.filter(x => x.start <= today), later = notClosed.filter(x => x.start > today);
  const pool = open.length ? open : later;
  if (!pool.length) return null;
  const first = pool.reduce((m, x) => x.start < m ? x.start : m, pool[0].start);
  return pool.filter(x => x.start === first);
}
// an N(A) student whose scope holds Polytechnic has two ways in when DPP or PFP comes
// first, so the Next line gives both dates, the one that comes first leading: "DPP (to poly through ITE) expected 17–25 Dec · PFP expected 13–20 Jan".
// The other is the earliest window of the paired exercise that has not closed. Every wording the page may use for the tied first windows.
const NEXT_SHORT_REF = { 'DPP-2027': 'DPP (to poly through ITE)', 'PFP-2027': 'PFP' };
const NEXT_PAIR_REF = { 'DPP-2027': 'PFP-2027', 'PFP-2027': 'DPP-2027' };
function nextOptions(who, wheres, today) {
  const want = nextWindow(who, wheres, today); if (!want) return null;
  const whenOf = x => x.start <= today && x.end ? 'by ' + dm(x.end) : (x.basis === 'inferred' ? 'expected ' : '') + whenText(x.start, x.end);
  const opts = [];
  want.forEach(x => {
    [x.title].concat(NEXT_ALT[x.title] || []).forEach(t => opts.push(t + ', ' + whenOf(x)));
    const ex = x.w.ex, pair = NEXT_PAIR_REF[ex];
    if (pair && (!wheres.length || wheres.includes('poly'))) {
      const other = WINDOWS.filter(w => w.who.includes(who) && w.ex === pair).map(windowOf).filter(Boolean).filter(y => (y.end || '9999') >= today).sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0)[0];
      if (other) opts.push(NEXT_SHORT_REF[ex] + ' ' + whenOf(x) + ' · ' + NEXT_SHORT_REF[pair] + ' ' + whenOf(other));
    }
  });
  return opts;
}
const DATES_DOM = `(() => {
  const el = document.querySelector('#s-pane'); const det = el.querySelector('details.closed'); if (det) det.open = true;
  const t = s => (s || '').replace(/\\s+/g, ' ').trim();
  return { head: (el.querySelector('.panel-h') || {}).textContent, closedSummary: det ? t(det.querySelector('summary').textContent) : '',
    months: [...el.querySelectorAll('.ag-month')].map(m => ({ h: m.querySelector('.ag-mh').textContent, closed: !!m.closest('details.closed'),
      items: [...m.querySelectorAll('li')].map(li => ({ cls: li.className, title: t(((li.querySelector('.ag-title') || {}).firstChild || {}).textContent), fam: t((li.querySelector('.ag-fam') || {}).textContent),
        when: t((li.querySelector('.ag-when') || {}).textContent), stripe: (li.querySelector('.ag-stripe') || {}).className || '' })) })) };
})()`;
async function check5() {
  const todayStr = TODAY || (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
  // 5.1 the page's copy of the calendar
  const c51 = check(5, '5.1', 'the calendar inside the page equals data/calendar/*.csv and the current rows of the exercise list');
  if (!PAGE_EXTRA) c51.fail('no page-data block');
  else {
    const cal = PAGE_EXTRA.calendar;
    const pick = (o, ks) => ks.map(k => o[k] == null ? '' : o[k]);
    const same = (a, b, ks, name) => {
      const x = a.map(o => JSON.stringify(pick(o, ks))).sort(), y = b.map(o => JSON.stringify(pick(o, ks))).sort();
      c51.ass(x.length === y.length && x.every((v, i) => v === y[i]), name + ': page has ' + a.length + ' rows, source ' + b.length + (x.length === y.length ? ' (a field differs)' : ''));
    };
    same(cal.fills, FILLS, ['exercise_id', 'phase_prefix', 'date_start', 'date_end', 'basis', 'note', 'source'], 'exercise_date_fills.csv');
    same(cal.terms, TERMS.filter(t => ['term', 'holiday'].includes(t.kind) && t.date_start && t.date_end), ['year', 'kind', 'name', 'date_start', 'date_end'], 'school_terms.csv (terms and holidays)');
    same(cal.rows, CURRENT_ROWS, ['exercise_id', 'phase', 'date_text', 'date_start', 'date_end', 'source_url'], 'exercises ' + EXERCISES_REL.split('/').pop() + ' (current cycle)');
  }
  const c52 = check(5, '5.2', 'the CSVs are consistent: no window starts after it ends');
  FILLS.forEach(f => { c52.ass(!f.date_start || !f.date_end || f.date_start <= f.date_end, 'fill start after end: ' + f.exercise_id + ' ' + f.phase_prefix); });
  CURRENT_ROWS.forEach(r => c52.ass(!r.date_start || !r.date_end || r.date_start <= r.date_end, 'row start after end: ' + r.exercise_id + ' ' + r.phase));
  const stale = FILLS.filter(f => f.basis !== 'month_only' && f.date_end && f.date_end < todayStr);
  info('date fills already in the past', stale.length + ' of ' + FILLS.length + ' fill rows end before ' + todayStr + ' (they go to "Already closed"); basis: ' + ['confirmed', 'inferred', 'month_only'].map(b => FILLS.filter(f => f.basis === b).length + ' ' + b).join(', '));

  // the Dates screen for several students
  const c53 = check(5, '5.3', 'every date on the Dates screen traces to a CSV row of its own exercise, written the way the page writes it (Expected / (tentative) / By / From), in the right month');
  const c54 = check(5, '5.4', 'open and closed are split at today: nothing closed sits among the open months, nothing open sits under "Already closed"; the count in the fold is right');
  const c55 = check(5, '5.5', 'every application window the CSVs give a student appears on the Dates screen of that student (with All exercises on, every window appears)');
  const c56 = check(5, '5.6', 'no "Next:" line on Courses; the first application window still open, or else the next to open, is the first window on the Dates screen');
  const c58 = check(5, '5.8', 'the term-start and school-holiday lines in each month of the Dates screen equal school_terms.csv (secondary schools)');
  const c57 = check(5, '5.7', 'the dates on a Details screen (apply, posting) are the CSV dates of that course\'s exercise');
  const sets = [
    { n: 'O all routes', st: { year: 2026, level: 'O', where: [] }, who: 'O' }, { n: 'O JC+Poly', st: { year: 2026, level: 'O', where: ['jc', 'poly'] }, who: 'O' }, { n: 'O ITE', st: { year: 2026, level: 'O', where: ['ite'] }, who: 'O' },
    { n: 'N(A) all routes', st: { year: 2026, level: 'N(A)', where: [] }, who: 'N(A)' }, { n: 'N(A) Poly', st: { year: 2026, level: 'N(A)', where: ['poly'] }, who: 'N(A)' }, { n: 'N(A) ITE', st: { year: 2026, level: 'N(A)', where: ['ite'] }, who: 'N(A)' },
    { n: 'N(T) all routes', st: { year: 2026, level: 'N(T)', where: [] }, who: 'N(T)' }, { n: 'SEC all routes', st: { year: 2027, level: 'G3', where: [] }, who: 'SEC' }, { n: 'SEC JC+Poly', st: { year: 2027, level: 'G3', where: ['jc', 'poly'] }, who: 'SEC' }
  ];
  const subsFor = lv => lv === 'O' ? [['English Language', 'O', 'B3'], ['Chinese', 'O', 'B4'], ['Mathematics', 'O', 'B3'], ['Science (Physics, Chemistry)', 'O', 'C5'], ['Humanities (Social Studies, Geography)', 'O', 'B4'], ['Principles of Accounts', 'O', 'C6']]
    : lv === 'N(A)' ? [['English Language', 'N(A)', '2'], ['Chinese', 'N(A)', '3'], ['Mathematics', 'N(A)', '2'], ['Science (Physics, Chemistry)', 'N(A)', '3'], ['Humanities (Social Studies, Geography)', 'N(A)', '3'], ['Principles of Accounts', 'N(A)', '2']]
    : lv === 'N(T)' ? [['English Language', 'N(T)', 'B'], ['Mathematics', 'N(T)', 'B'], ['Science (Syllabus T)', 'N(T)', 'B'], ['Mobile Robotics', 'N(T)', 'A']]
    : [['English Language', 'G3', 'B3'], ['Chinese', 'G3', 'B4'], ['Mathematics', 'G3', 'B3'], ['Science (Physics, Chemistry)', 'G3', 'C5'], ['Humanities (Social Studies, Geography)', 'G3', 'B4'], ['Principles of Accounts', 'G3', 'C6']];
  const p = await openPage(null, { width: 1280, height: 900 });
  for (const s of sets) {
    for (const allEx of [false, true]) {
      const st = state(Object.assign({ cca: 'Good', allEx, rows: subsFor(s.st.level).map(x => row(...x)) }, s.st));
      await loadState(p, st, '#dates');
      await sleep(80);
      const D = await p.eval(DATES_DOM);
      // the routes on the Courses screen are the picks that are still open, or the top-tier default; the Dates screen and "Next:" follow them
      const shownWids = await p.eval(`(async () => { location.hash = '#courses'; await new Promise(r => setTimeout(r, 250)); const g = [...document.querySelectorAll('#s-list section.group')].map(x => x.id.replace(/^g-/, '')); location.hash = '#dates'; await new Promise(r => setTimeout(r, 120)); return g; })()`);
      const effWhere = shownWids.length ? shownWids : s.st.where;
      const tag = s.n + (allEx ? ' + all exercises' : '') + ': ';
      const items = D.months.flatMap(m => m.items.filter(i => /ag-item/.test(i.cls)).map(i => Object.assign({ month: m.h, closed: m.closed }, i)));
      items.forEach(it => {
        const cands = csvWhens(FAMILY_OF[it.fam] || []);
        const ym = ymOf(it.month);
        const toks = it.when.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w && w !== 'in');
        const hit = cands.filter(c => c.monthOnly ? toks.every(t => (c.text || '').toLowerCase().indexOf(t) >= 0) : c.text === it.when);
        if (!hit.length) { c53.fail(tag + it.title + ' [' + it.fam + '] "' + it.when + '" matches no CSV date of ' + (FAMILY_OF[it.fam] || ['?']).join('/')); return; }
        const placed = hit.some(c => c.monthOnly ? true : (c.start || c.end).slice(0, 7) === ym);
        c53.ass(placed, tag + it.title + ' "' + it.when + '" sits under ' + it.month + ' but the CSV says ' + hit.map(c => (c.start || c.end || '').slice(0, 7)).join('/'));
        const inferred = hit.every(c => c.basis === 'inferred');
        if (!hit.some(c => c.monthOnly)) c53.ass(/dashed/.test(it.stripe) === inferred, tag + it.title + ' stripe ' + (/dashed/.test(it.stripe) ? 'dashed' : 'solid') + ' but the dates are ' + (inferred ? 'expected' : 'published'));
        // 5.4 open or closed
        const hh = hit[0]; const edge = hh.monthOnly ? ym + '-31' : (hh.end || hh.start);
        const noEnd = !hh.monthOnly && !hh.end;
        const openEnded = noEnd && /no closing date|open from/i.test((FILLS.find(f => f.exercise_id && f.date_start === hh.start && !f.date_end) || {}).note || '');
        const shouldClose = hh.monthOnly ? ym < todayStr.slice(0, 7) : hh.end ? hh.end < todayStr : !openEnded && hh.start < todayStr;
        c54.ass(it.closed === shouldClose, tag + it.title + ' "' + it.when + '" is under ' + (it.closed ? 'Already closed' : 'the open months') + ' but today is ' + todayStr);
      });
      // 5.8 the term and holiday bands in each open month
      D.months.filter(m => !m.closed).forEach(m => {
        const got = m.items.filter(i => /ag-band|ag-term/.test(i.cls)).map(i => i.title + '|' + i.when).sort();
        c58.eq(got, bandsOracle(ymOf(m.h)), tag + m.h + ' term / holiday bands');
      });
      const nClosed = items.filter(i => i.closed).length;
      const mm = /\((\d+)\)/.exec(D.closedSummary || '');
      if (D.closedSummary) c54.eq(Number(mm && mm[1]), nClosed, tag + 'count in the closed fold');
      // 5.5 windows
      const live = s.who === 'SEC' ? [] : WINDOWS.filter(w => w.who.includes(s.who) && (allEx || !effWhere.length || w.where.some(x => effWhere.includes(x)))).map(windowOf).filter(Boolean);
      live.forEach(w => {
        const want = (w.basis === 'inferred' ? 'expected ' : '') + whenText(w.start, w.end);
        c55.ass(items.some(i => i.when === want), tag + w.title + ' (' + want + ') is not on the Dates screen');
      });
      if (!allEx && s.who !== 'SEC') {
        // windows of other students stay off the screen
        const other = WINDOWS.filter(w => !w.who.includes(s.who)).map(windowOf).filter(Boolean);
        other.forEach(w => { const want = (w.basis === 'inferred' ? 'expected ' : '') + whenText(w.start, w.end); const dup = live.some(x => (x.basis === 'inferred' ? 'expected ' : '') + whenText(x.start, x.end) === want); if (!dup) c55.ass(!items.some(i => i.when === want && i.fam === (FAMILY_BY_EX[w.w.ex] || '')), tag + 'shows ' + w.title + ' that is not for this student'); });
      }
      // 5.6 Next
      { await p.eval(`location.hash = '#courses'; 1`); await sleep(120);
        const nx = await p.eval(`!!document.querySelector('.next-line') || /(^|\\n)\\s*Next:/.test(document.getElementById('s-list').innerText)`);
        c56.ass(!nx, tag + 'a "Next:" line is still on Courses'); }
      if (!allEx && s.who !== 'SEC') {
        const want = nextWindow(s.who, effWhere, todayStr), whenStr = w => (w.basis === 'inferred' ? 'expected ' : '') + whenText(w.start, w.end);
        const firstLive = items.filter(i => !i.closed).find(i => live.some(w => whenStr(w) === i.when));
        if (!want) c56.ass(!firstLive, tag + 'the Dates screen has an open window although the CSVs have none left: ' + (firstLive && firstLive.when));
        else c56.ass(!!firstLive && want.some(w => whenStr(w) === firstLive.when), tag + 'the first window on the Dates screen is "' + (firstLive && firstLive.title + ', ' + firstLive.when) + '", the CSVs say ' + want.map(w => w.title + ', ' + whenStr(w)).join(' / '));
      }
    }
  }
  // 5.7 Details: the dates under a course
  await loadState(p, state({ year: 2026, level: 'O', cca: 'Good', rows: subsFor('O').map(x => row(...x)) }), '#courses');
  const cardsO = (await p.eval(MODEL)).cards;
  const detail = async (id) => { await p.eval(`location.hash = '#course-${id}'; 1`); await sleep(100); return p.eval(`[...document.querySelectorAll('.det-dates li')].map(li => ({ t: li.querySelector('.dd-t').textContent, w: li.querySelector('.dd-w').textContent }))`); };
  const jcCard = cardsO.find(c => c.sec === 'jc'), polyCard = cardsO.find(c => c.sec === 'poly');
  for (const c of [jcCard, polyCard]) {
    const dts = await detail(c.id);
    const apply = dts.find(d => d.t === 'Apply in the JAE'), post = dts.find(d => d.t === 'JAE posting results');
    const f = FILLS.find(x => x.exercise_id === 'JAE-2027' && x.phase_prefix === 'apply');
    c57.ass(apply && apply.w === (f.basis === 'inferred' ? 'expected ' : '') + whenText(f.date_start, f.date_end) + ' ' + f.date_start.slice(0, 4), c.key + ' Details apply date: ' + (apply && apply.w));
    const pr = CURRENT_ROWS.find(r => r.exercise_id === 'JAE-2027' && r.phase === 'posting results');
    c57.ass(post && pr && post.w === whenText(pr.date_start, pr.date_end) + (/tentative/i.test(pr.date_text) ? ' ' + pr.date_start.slice(0, 4) + ' (tentative)' : ' ' + pr.date_start.slice(0, 4)), c.key + ' Details posting date: ' + (post && post.w) + ' vs row ' + (pr && pr.date_text));
  }
  await p.close();
}
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ymOf = h => { const [mn, yr] = h.split(' '); return yr + '-' + String(MONTH_FULL.indexOf(mn) + 1).padStart(2, '0'); };
// the school-term bands MOE gives for secondary schools, as the Dates screen should show them in a month
function bandsOracle(ym) {
  const m0 = ym + '-01', m1 = ym + '-31', out = [];
  TERMS.filter(t => /MK, Primary & Secondary/.test(t.name)).forEach(t => {
    const name = t.name.replace(/\s*\(MK, Primary & Secondary\)/, '');
    if (t.kind === 'holiday' && t.date_start <= m1 && t.date_end >= m0) out.push(name + '|' + whenText(t.date_start, t.date_end));
    if (t.kind === 'term' && t.date_start >= m0 && t.date_start <= m1) { const n = /Term (\d)/.exec(name); out.push((n ? 'Term ' + n[1] + ' starts' : name) + '|' + dm(t.date_start)); }
  });
  return out.sort();
}
const FAMILY_BY_EX = Object.fromEntries(Object.entries(FAMILY_OF).flatMap(([fam, ids]) => ids.map(id => [id, fam])));

// ================================================================================================ 6 Share text (K7)
const rangeExerciseLabel = r => r.exercise === 'JAE-2027' ? '2026 JAE' : (r.exercise === 'DPP-2027' || r.exercise === 'JIE-N-2027') ? '2026 JIE' : '';
// the three lines of one starred course as K7 writes them, from the engine and the data
const NO_ESTIMATE = 'No 2026 figure, so no estimate.';
// every diploma a PFP card holds meets the entry requirements (the engine's eligibility, 2026 and 2028 alike)
// 2028: the engine's overall eligibility is null while the course's own entry requirements are unpublished, so "meets" is every published
// gate (the ELMAB3 gross limit; not the unpublished-requirements line, not the aggregate line) met; 2026: the engine's eligibility.
const gatesMet = rr => { const g = (rr.reasons || []).filter(x => x.blocking && x.kind !== 'mer' && x.kind !== 'aggregate'); return g.length > 0 && g.every(x => x.met === true); };
const pfpMeetsAll = (c, er, eng) => { const names = new Set((c.diplomas || []).map(d => d.name)); const rs = eng.rep.results.filter(rr => rr.exercise === er.exercise && rr.stream === 'Polytechnic Foundation Programme' && rr.institution === er.institution && names.has(rr.course_name)); return rs.length > 0 && rs.every(rr => er.exercise === 'PSE-2028' ? gatesMet(rr) : rr.eligible === true); };
function shareFacts(c, st, eng) {
  if (c.kind === 'arts') return { title: c.title + ', ' + c.inst, range: (c.arts.state === 'meets' ? 'Meets the minimum' : c.arts.state === 'below' ? 'Below the minimum' : 'Check with ' + c.arts.who) + '.', net: '', state: [], notes: [], link: '(any link)' };
  const items = c.offers.map(o => { const er = eng.results.get(o.r.exercise + '|' + o.r.requirement_key); return { label: o.label, er, x: offerOracle(er, st, eng) }; });
  const f = { title: '', range: '', net: '', state: [], notes: [], link: '' };
  const sub = c.kind === 'jc' ? items.slice().sort((a, b) => (b.label === st.jcSort ? 1 : 0) - (a.label === st.jcSort ? 1 : 0)) : (c.kind === 'ite' && items.length > 1) ? items.map(i => Object.assign(i, { label: i.er.institution.replace(/^ITE College /, '') })) : [bestOracle(items.map(i => ({ label: i.label, o: i.x, i }))).i];
  const first = sub[0];
  f.title = c.title + (c.kind !== 'jc' && !(c.kind === 'ite' && items.length > 1) && c.inst ? ', ' + c.inst : '');
  f.link = (bestOracle(items.map(i => ({ label: i.label, o: i.x, i }))).i.er || first.er).moe_url;
  const agg = letters(first.er.aggregate_id);
  if (c.kind === 'pfp') {
    // FIX_r3 items 11 and 14: the PFP line is the same in both years; a 2028 PFP card has no 'can apply' state, so "you meet" is the engine's eligibility of every diploma on the card
    const pfpMeets = first.er.exercise === 'PSE-2028' ? pfpMeetsAll(c, first.er, eng) : ['yes', 'cond'].includes(first.x.state);
    if (pfpMeets) f.range = 'Polytechnic Foundation Programme: you meet the entry requirements. PFP has no cut-offs.';
    if (first.x.net.value != null) f.net = 'Your gross ' + agg + ': ' + first.er.gross;
    return f;
  }
  const ranged = sub.filter(s => s.x.range);
  // FIX_r3 item 10: one wording for "no figure": a 2028 course with no 2026 range to estimate from says so (the arts note says NAFA and LASALLE don't publish cut-offs)
  if (first.er.exercise === 'PSE-2028' && !sub.some(s => s.x.est)) { f.range = NO_ESTIMATE; }
  else {
    const list = sub.length > 1 ? ranged.map(s => s.label + ' ' + rangeText(s.x.range)).join(', ') : (ranged[0] ? rangeText(ranged[0].x.range) : '');
    const est = ranged.some(s => s.x.est);
    f.range = list ? (est ? 'Estimated 2028 ' + agg + ' net aggregate ' + fromWords(ranged.some(s => s.x.basis === 'olevel') ? 'olevel' : '') + ': ' + list : rangeExerciseLabel(ranged[0].er) + ' ' + agg + ' net aggregate: ' + list) : (rangeExerciseLabel(first.er) ? rangeExerciseLabel(first.er) + ' ' : '') + agg + ' net aggregate: not published';
    const lead = sub.filter(s => s.x.net.value != null && s.x.state !== 'no')[0] || sub.filter(s => s.x.net.value != null)[0];
    if (lead) {
      const gaps = sub.filter(s => s.x.n != null && s.x.state !== 'no');
      f.net = 'Your net aggregate: ' + lead.x.net.value + lead.x.net.marks + (gaps.length ? ' (' + gaps.map(s => (sub.length > 1 ? s.label + ' ' : '') + signed(s.x.n)).join(', ') + ')' : '');
    }
  }
  sub.forEach(s => { if (s.x.state === 'cond') f.state.push('On condition'); if (s.x.state === 'unsure') f.state.push('Not sure'); });
  if (sub.every(s => s.x.state === 'no')) f.state.push("Can't apply");
  sub.forEach(s => { if (s.x.state !== 'no' && s.x.net.affPts > 0 && !f.notes.includes('aff')) f.notes.push('aff'); if (s.x.state !== 'no' && s.x.net.lepPts > 0 && !f.notes.includes('lep')) f.notes.push('lep'); });
  return f;
}
async function readShare(p, st, keys, width) {
  await loadState(p, Object.assign({}, st, { stars: keys }), '#starred');
  await sleep(100);
  await p.eval(`(document.querySelector('[data-do="share"]')||{click(){}}).click(); 1`);
  await sleep(100);
  return p.eval(`(() => { const t = document.getElementById('share-text'); const wa = document.querySelector('#sheet a[href^="https://wa.me/"]');
    return { text: t ? t.value : null, wa: wa ? decodeURIComponent(wa.getAttribute('href').replace('https://wa.me/?text=', '')) : null,
      rows: [...document.querySelectorAll('table.cmp tbody tr')].map(tr => [...tr.children].map(td => td.innerText.replace(/\\s+/g, ' ').trim())),
      hints: [...document.querySelectorAll('#s-pane p.hint')].map(h => h.textContent.trim()).filter(t => /^[\u00B9\u00B2] /.test(t)) }; })()`);
}
async function shareScenario(p, sc, c64, c65) {
    const st = Object.assign({ name: sc.name, reach: false, allow: 0 }, sc.st);
    const eng = runEngine(st);
    await loadState(p, stateOf(st), '#courses');
    const M = await p.eval(MODEL);
    const cards = sc.pickKeys(M);
    const uniq = [...new Map(cards.map(c => [c.key, c])).values()];
    const R = await readShare(p, stateOf(st), uniq.map(c => c.key), 1280);
    const tag = sc.name + ': ';
    if (!R.text) { sc.c.fail(tag + 'the share sheet did not open'); return; }
    // expected text
    const lines = ['My course shortlist:'];
    const expFacts = [];
    uniq.forEach((c, i) => {
      const f = shareFacts(c, st, eng); expFacts.push(f);
      lines.push(''); lines.push((i + 1) + '. ' + f.title);
      if (f.range) lines.push(f.range);
      if (f.net) lines.push(f.net);
      f.state.forEach(s => lines.push(s));
      if (f.notes.length) lines.push('(notes:' + f.notes.join(',') + ')');
      if (f.link) lines.push(f.link);
    });
    // compare line by line; the free wording of the state and affiliation / LEP notes is matched by pattern
    const got = R.text.split('\n');
    const want = lines;
    let gi = 0;
    const eq = (a, b, msg) => sc.c.ass(a === b, tag + msg + ': page "' + a + '" want "' + b + '"');
    want.forEach((w, wi) => {
      const nm = /^\(notes:(.*)\)$/.exec(w);
      if (nm) {
        const found = [];
        while (/^[\u00B9\u00B2] /.test(got[gi] || '')) { found.push(got[gi]); gi++; }
        const wantSet = nm[1].split(',');
        sc.c.ass(wantSet.includes('aff') === found.some(l => /^\u00B9 Includes \d+ points? for affiliation/.test(l)), tag + 'affiliation note under the net line: found ' + JSON.stringify(found));
        sc.c.ass(wantSet.includes('lep') === found.some(l => /^\u00B2 Includes \d+ points for [CMT]LEP/.test(l)), tag + 'LEP note under the net line: found ' + JSON.stringify(found));
        if (found.length > 1) c65.ass(found[0].charAt(0) === '\u00B9', tag + 'footnotes come in the order ' + found.map(l => l.charAt(0)).join(' ') + ' (\u00B9 should come first)');
        return;
      }
      if (w === 'On condition') { const g = got[gi] || ''; sc.c.ass(/^On condition: /.test(g), tag + 'expected an "On condition:" line, found "' + g + '"'); gi++; return; }
      if (w === "Can't apply") { const g = got[gi] || ''; sc.c.ass(/^Can't apply: /.test(g), tag + 'expected a "Can\'t apply:" line, found "' + g + '"'); gi++; return; }
      if (w === 'Not sure') { const g = got[gi] || ''; sc.c.ass(/^Not sure: /.test(g), tag + 'expected a "Not sure:" line, found "' + g + '"'); gi++; return; }
      if (w === '(any link)') { sc.c.ass(/^https:\/\//.test(got[gi] || ''), tag + 'line ' + (gi + 1) + ' should be a link: "' + got[gi] + '"'); gi++; return; }
      eq(got[gi], w, 'line ' + (gi + 1));
      gi++;
    });
    sc.c.ass(gi === got.length, tag + 'the text has ' + (got.length - gi) + ' more line(s) than expected: ' + JSON.stringify(got.slice(gi, gi + 3)));
    // K7 shape: nothing but the three facts (title / range / net) and a link per course
    if (R.hints && R.hints.length > 1) c65.ass(R.hints[0].charAt(0) === '\u00B9', tag + 'on Starred the footnotes come in the order ' + R.hints.map(h => h.charAt(0)).join(' ') + ' (\u00B9 should come first)');
    // 6.4 WhatsApp and the compare table
    c64.eq(R.wa, R.text, tag + 'WhatsApp text');
    if (R.rows.length) {
      uniq.forEach((c, i) => {
        const f = expFacts[i]; const cells = R.rows.find(rw => (rw[0] || '').startsWith(c.title)) || [];
        if (!f.range) return;
        let rangeCell = f.range.replace(/^(Estimated 2028 |2026 (JAE|JIE) )/, '').replace(/ net aggregate( \(from 2026( O-Level cut-offs)?\))?:/, ':');
        if (/not published$/.test(f.range)) rangeCell = f.range.replace(/^(2026 (JAE|JIE) )/, '');
        if (f.range === NO_ESTIMATE) rangeCell = NO_ESTIMATE.replace(/\.$/, '');  // a table cell carries no full stop
        // a cell that holds a range carries the indicative tag; the words before it are the text's range
        if (c.kind !== 'pfp' && c.kind !== 'arts') { const hasR = /\d/.test(rangeCell) && !/^No 2026 figure/.test(rangeCell) && !/not published$/.test(f.range); const cellR = hasR ? String(cells[1] || '').replace(/ indicative$/, '') : cells[1];
          c64.ass(cellR === rangeCell && (!hasR || / indicative$/.test(String(cells[1]))), tag + c.key + ' compare table range cell "' + cells[1] + '" vs "' + rangeCell + '" + indicative'); }
        const netNum = (f.net.match(/: (\d+[¹²]*)/) || [])[1];
        if (netNum && c.kind !== 'pfp') c64.ass((cells[2] || '').startsWith(netNum), tag + c.key + ' compare table net cell "' + cells[2] + '" vs ' + netNum);
      });
    }
    // 6.6 the laptop Starred table is grouped by route (JC, MI, Polytechnic, ITE, Arts), most competitive first inside each route (fix list item 31, K4);
    // the share text keeps the starred order (checked line by line above)
    if (R.rows.length > 1) {
      const c66 = C66 || (C66 = check(6, '6.6', 'the Starred compare table is grouped by route and ordered most competitive first inside each route, while the share text keeps the starred order'));
      const RR = { jc: 0, mi: 1, poly: 2, ite: 3, arts: 4 };
      const info = uniq.map(c => {
        let n = null, bucket = 1;
        if (c.kind !== 'arts' && c.kind !== 'pfp' && c.offers.every(o => o.r)) {
          const items = c.offers.map(o => { const er = eng.results.get(o.r.exercise + '|' + o.r.requirement_key); return { label: o.label, o: offerOracle(er, st, eng) }; });
          const b = bestOracle(items); if (b.o.n != null) { n = b.o.n; bucket = 0; }
          if (items.every(x => x.o.state === 'unsure')) bucket = 2;
        }
        return { c, n, bucket, pos: R.rows.findIndex(rw => (rw[0] || '').startsWith(c.title)) };
      }).filter(x => x.pos >= 0).sort((a, b) => a.pos - b.pos);
      let ok = true, why = '';
      for (let i = 1; i < info.length; i++) {
        const a = info[i - 1], b = info[i];
        const ra = RR[a.c.where], rb = RR[b.c.where];
        if (ra > rb) { ok = false; why = a.c.title + ' (' + a.c.where + ') is above ' + b.c.title + ' (' + b.c.where + ')'; break; }
        if (ra === rb && (a.bucket > b.bucket || (a.bucket === b.bucket && a.bucket === 0 && a.n > b.n))) { ok = false; why = a.c.title + ' (gap ' + a.n + ') is above ' + b.c.title + ' (gap ' + b.n + ') in the same route'; break; }
      }
      c66.ass(ok, tag + 'compare table order: ' + (why || info.map(x => x.c.title + ' [' + x.c.where + ' ' + x.n + ']').join(' | ')));
    }
    sc.c.note('sample text (' + sc.name + '):\n' + R.text);
}
let C66 = null;

async function check6() {
  const c61 = check(6, '6.1', '2026 share text matches K7 line by line: JC (both streams, affiliated ¹ and not), polytechnic (with and without a published range), ITE at several colleges, MI, arts');
  const c62 = check(6, '6.2', 'the PFP and DPP / JIE lines of an N(A) share text match K7 ("you meet the entry requirements", "2026 JIE ... net aggregate")');
  const c63 = check(6, '6.3', '2027 share text says "Estimated 2028 ... (from 2026)" with the estimated ranges for JC, MI, polytechnic and ITE (a course with no 2026 range to take it from says "No 2026 figure, so no estimate."), and PFP / arts say no cut-offs');
  const c65 = check(6, '6.5', 'when a JC carries both footnotes, \u00B9 (affiliation) comes before \u00B2 (LEP), in the share text and on Starred');
  const c64 = check(6, '6.4', 'the WhatsApp link carries the same text, and the laptop compare table shows the same range and net as the text');
  const p = await openPage(null, { width: 1280, height: 900 });
  const P2subs = PERSONAS[1].subs;
  const hostOf = prog => DATA.lep_hosts.filter(h => h.programme === prog).map(h => h.jc);
  const scenarios = [
    { name: "2026 O-Level, Good CCA, St Andrew's (affiliated to SAJC), all routes", c: c61,
      st: { year: 2026, level: 'O', cca: 'Good', where: ['jc', 'mi', 'poly', 'ite', 'arts'], school: "St Andrew's School (Secondary)", lep: 'None', subs: P2subs },
      pickKeys: M => [M.cards.find(c => c.sec === 'jc' && c.title === "St Andrew's Junior College"), M.cards.find(c => c.sec === 'jc' && c.title === 'Anglo-Chinese Junior College'),
        M.cards.find(c => c.sec === 'mi'), M.cards.find(c => c.sec === 'poly' && c.offers[0].gap.range && c.state === 'yes'), M.cards.find(c => c.sec === 'poly' && !c.offers[0].gap.range && c.state === 'yes'),
        M.cards.find(c => c.sec === 'ite2' && c.offers.length > 1 && c.offers.every(o => o.gap.range)), M.cards.find(c => c.sec === 'poly' && c.state === 'cond'), M.cards.find(c => c.sec === 'ai')].filter(Boolean) }
  ];
  if (AFF_LEP) {
    const hosts = hostOf(AFF_LEP.programme);
    scenarios.push({ name: '2026 O-Level, Good CCA, ' + AFF_LEP.school + ' (affiliated to ' + AFF_LEP.jc + ', a ' + AFF_LEP.programme + ' host), ' + AFF_LEP.programme, c: c61,
      st: { year: 2026, level: 'O', cca: 'Good', where: ['jc'], school: AFF_LEP.school, lep: AFF_LEP.programme, subs: P2subs },
      pickKeys: M => [M.cards.find(c => c.sec === 'jc' && c.title === AFF_LEP.jc), M.cards.find(c => c.sec === 'jc' && hosts.includes(c.title) && c.title !== AFF_LEP.jc), M.cards.find(c => c.sec === 'jc' && !hosts.includes(c.title) && c.title !== AFF_LEP.jc)].filter(Boolean) });
  }
  scenarios.push(
    { name: '2026 O-Level, Excellent CCA + Higher Chinese (bonus at the cap), JC + poly + ITE', c: c61,
      st: { year: 2026, level: 'O', cca: 'Excellent', where: ['jc', 'poly', 'ite'], school: "St Andrew's School (Secondary)", lep: 'None', subs: P2subs.filter(x => x[0] !== 'Chinese').concat([['Higher Chinese', 'O', 'B3']]) },
      pickKeys: M => [M.cards.find(c => c.sec === 'jc' && c.title === "St Andrew's Junior College"), M.cards.find(c => c.sec === 'poly' && c.offers[0].gap.range), M.cards.find(c => c.sec === 'ite2' && c.offers.length > 1)].filter(Boolean) },
    { name: '2026 O-Level, Science remembered as the stream (fix list item 15), JC + poly', c: c61,
      st: { year: 2026, level: 'O', cca: 'Good', where: ['jc', 'poly'], school: "St Andrew's School (Secondary)", lep: 'None', jcSort: 'Science', subs: P2subs },
      pickKeys: M => [M.cards.find(c => c.sec === 'jc' && c.title === "St Andrew's Junior College"), M.cards.find(c => c.sec === 'jc' && c.title === 'Anglo-Chinese Junior College'), M.cards.find(c => c.sec === 'poly' && c.offers[0].gap.range)].filter(Boolean) },
    { name: '2026 O-Level, weak results (JC closed), JC + poly + ITE', c: c61,
      st: { year: 2026, level: 'O', cca: 'Good', where: ['jc', 'poly', 'ite'], school: '', lep: 'None', subs: PERSONAS[3].subs },
      pickKeys: M => [M.cards.find(c => c.sec === 'jc'), M.cards.find(c => c.sec === 'poly' && c.offers[0].gap.range), M.cards.find(c => c.sec === 'ite2' && c.offers.length > 1)].filter(Boolean) },
    { name: '2026 N(A), poly + ITE + arts', c: c62,
      st: { year: 2026, level: 'N(A)', cca: 'Fair', where: ['poly', 'ite', 'arts'], school: '', lep: 'None', subs: PERSONAS[0].subs },
      pickKeys: M => [M.cards.find(c => c.sec === 'pfp' && c.state === 'yes'), M.cards.find(c => c.sec === 'dpp' && c.offers[0].gap.range), M.cards.find(c => c.sec === 'jien' && c.offers.length > 1 && c.offers.some(o => o.gap.range)), M.cards.find(c => c.sec === 'nfp')].filter(Boolean) },
    { name: "2027 SEC, JC + poly + ITE", c: c63,
      st: { year: 2027, level: 'G3', cca: 'Excellent', where: ['jc', 'poly', 'ite'], school: '', lep: 'None', subs: PERSONAS[2].subs },
      pickKeys: M => [M.cards.find(c => c.sec === 'pjc'), M.cards.find(c => c.sec === 'pjc' && c.offers.some(o => o.gap.n >= 0)), M.cards.find(c => c.sec === 'ppoly' && c.offers[0].gap.range), M.cards.find(c => c.sec === 'ppoly' && !c.offers[0].gap.range), M.cards.find(c => c.sec === 'ppfp'), M.cards.find(c => c.sec === 'pite3'), M.cards.find(c => c.sec === 'pite2')].filter(Boolean) },
    { name: '2027 SEC, weaker results, all routes', c: c63,
      st: { year: 2027, level: 'G3', cca: 'Good', where: [], school: '', lep: 'None', subs: [['English Language', 'G3', 'C5'], ['Mathematics', 'G3', 'C6'], ['Science (Physics, Chemistry)', 'G3', 'C5'], ['Humanities (Social Studies, Geography)', 'G3', 'B4'], ['Chinese', 'G3', 'C5'], ['Art', 'G3', 'B4']] },
      pickKeys: M => [M.cards.find(c => c.sec === 'pjc'), M.cards.find(c => c.sec === 'pmi'), M.cards.find(c => c.sec === 'ppoly' && c.offers[0].gap.range), M.cards.find(c => c.sec === 'pai')].filter(Boolean) }
  );
  for (const sc of scenarios) await shareScenario(p, sc, c64, c65);
  await p.close();
}


// ================================================================================================ the persona truth (engine + data only; the page is not read)
const personaState = p => Object.assign({ name: p.id, reach: false, allow: 0 }, p);
function facts(p) {
  const st = personaState(p), eng = runEngine(st);
  const cards = expectedCards(st, eng).filter(e => e.kind !== 'pfp').map(e => {
    const offs = e.offers.map(o => ({ label: o.label, r: o.r, x: offerOracle(o.r, st, eng) }));
    const first = offs[0];
    const title = e.kind === 'jc' ? first.r.institution : first.r.course_name;
    const inst = e.kind === 'course' ? first.r.institution : e.kind === 'ite' ? offs.map(o => o.r.institution.replace(/^ITE College /, '')).join(', ') : '';
    const state = offs.reduce((b, o) => RANK[o.x.state] < RANK[b] ? o.x.state : b, offs[0].x.state);
    return Object.assign(e, { offs, title, inst, state, field: first.r.field_of_study || '' });
  });
  const pfp = expectedCards(st, eng).filter(e => e.kind === 'pfp').map(e => ({ sec: e.sec, results: e.results }));
  return { st, eng, cards, pfp };
}
const aggLine = (eng, id) => { const r = eng.byId[id]; return r ? { id, letters: letters(id), gross: r.gross, net: r.net, bonus: r.gross != null && r.net != null ? r.gross - r.net : null, status: r.status } : null; };
const fmtRange = (x, agg) => x.range ? (x.est ? 'Est. ' : '') + agg + ' ' + rangeText(x.range) + (x.est ? ' (from 2026 ' + rangeText(x.from) + ')' : '') : 'no range published';
const colourOf = n => n >= 2 ? 'green' : n >= -1 ? 'amber' : 'grey';
function offerStr(o) { const x = o.x; const agg = letters(o.r.aggregate_id); return (o.label ? o.label + ': ' : '') + (x.state === 'no' ? "can't apply" : x.n == null ? fmtRange(x, agg) + ', your net ' + x.net.value + x.net.marks : fmtRange(x, agg) + ', your net ' + x.net.value + x.net.marks + ', ' + signed(x.n) + ' ' + colourOf(x.n)) + (x.state === 'cond' ? ' [on condition]' : x.state === 'unsure' ? ' [not sure]' : ''); }
const clears = o => o.x.state !== 'no' && o.x.n != null && o.x.n >= 0;
function jcTable(F, secId, stream) {  // JCs that can be applied for, with this stream's cut-off, most competitive (lowest cut-off) first
  return F.cards.filter(c => c.sec === secId).map(c => ({ c, o: c.offs.find(o => o.label === stream) })).filter(x => x.o && x.o.x.state !== 'no' && x.o.x.n != null).sort((a, b) => a.o.x.range[1] - b.o.x.range[1] || (a.c.title.toLowerCase() < b.c.title.toLowerCase() ? -1 : 1));
}
const polyBest = (F, secId, filter = () => true) => F.cards.filter(c => c.sec === secId && filter(c) && c.offs[0].x.state !== 'no' && c.offs[0].x.n != null && c.offs[0].x.n >= 0).sort((a, b) => a.offs[0].x.range[1] - b.offs[0].x.range[1] || (a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1));
const jcShort = n => n.replace(/ \(Junior College\)$/, '').replace(/ Junior College$/, ' JC');

function truthMarkdown() {
  const today = TODAY || new Date().toISOString().slice(0, 10);
  const L = [];
  const Q = [];
  const w = (s = '') => L.push(s);
  const F = Object.fromEntries(PERSONAS.map(p => [p.id, facts(p)]));
  const nextStr = (who, wheres) => { const nw = nextWindow(who, wheres, today); return nw ? nw.map(x => x.title + ': ' + (x.basis === 'inferred' ? 'expected ' : '') + whenText(x.start, x.end) + ' ' + (x.start || x.end).slice(0, 4)).join(' / ') : 'no window left'; };
  w('# Persona truth, round ' + arg('round', 'r3'));
  w();
  w('Built by `app/src/ui/_fixtures/qa_data.mjs --truth=...` from the engine (`app/src/pse_core.js`) and the data (`app/build/data.json`, `data/calendar/*.csv`), with the bonus rules and the 2028 estimate worked out in the script from the rule text. The page is not read, so a persona\'s answer can be matched against this without circularity. Data snapshot ' + SNAPSHOT + ' (CourseFinder), engine ' + DATA.engine_version + ', matcher ' + DATA.matcher_version + '. Dates worked out for today = ' + today + '.');
  w();
  w('**How to read a line.** "Range" is last year\'s published net aggregate range (2026 JAE or JIE), or the estimate for 2028 where marked "Est.". "Your net" includes CCA, the English + Higher Mother Tongue bonus, the cap, affiliation (affiliated JC only) and LEP (host JCs only). The gap is the top of the range minus your net: **+ is better**. Green = +2 or more, amber = −1 to +1, grey outline = −2 or less. **"Clears" means gap 0 or more** (your net is at or under the top of last year\'s range).');
  w();
  w('@@QUICK@@');
  w();
  w('Scoring a persona: 1 = the answer below within the tap budget; 0.5 = right but over budget or guessed; 0 = stuck or a wrong number. Numbers must be the **net** unless the task says gross. A persona that names a course with state "can\'t apply" or a wrong gap sign scores 0 for that item.');
  w();
  const aggTable = (eng, ids) => { w('| Aggregate | Gross | Bonus | Net |'); w('|---|---|---|---|'); ids.forEach(id => { const a = aggLine(eng, id); if (a) w('| ' + a.letters + (/:\w+\(/.test(id) ? ' (' + id.replace(/^.*:(\w+)\(.*$/, '$1') + ')' : '') + ' | ' + (a.gross == null ? "can't be worked out" : a.gross) + ' | ' + (a.bonus == null ? '' : a.bonus) + ' | ' + (a.net == null ? (a.gross == null ? '' : 'no bonus, so ' + a.gross) : a.net) + ' |'); }); w(); };
  const stateCount = (F_, sec) => { const cs = F_.cards.filter(c => c.sec === sec); const n = s => cs.filter(c => c.state === s).length; return cs.length + ' courses: ' + (n('browse') ? n('browse') + ' open to browse (2028 entry requirements not published), ' : '') + (n('yes') ? n('yes') + ' can apply, ' : '') + (n('cond') ? n('cond') + ' on condition, ' : '') + (n('unsure') ? n('unsure') + ' not sure, ' : '') + n('no') + " can't apply"; };

  // ---- P1
  { const f = F.P1, e = f.eng;
    w('## P1. N(A), CCA Fair, Polytechnic (phone, 30 taps)');
    w('Results: EL 2, Maths 3, Science (Physics, Chemistry) 3, Humanities (SS, Geography) 2, POA 2, Malay 3.');
    w();
    aggTable(e, ['ELMAB3:PFP(2026)', 'ELMAB3:DPP(2026)']);
    const pfpClusters = f.pfp.flatMap(x => x.results);
    const byState = {}; pfpClusters.forEach(r => { const s = stateOracle(r); byState[s] = (byState[s] || 0) + 1; });
    w('- **PFP** (gross ELMAB3 counts, no CCA; MOE: gross ' + ((DEFS.get('ELMAB3:PFP(2026)').checks || []).find(c => c.id === 'pfp_gross') || {}).max + ' or better). No cut-off is published. PFP diplomas by state for this student: ' + JSON.stringify(byState) + '.');
    const yesPfp = pfpClusters.filter(r => stateOracle(r) === 'yes');
    w('  PFP diplomas the student **can apply for** (state "can apply"), ' + yesPfp.length + ' in all, e.g. ' + [...new Set(yesPfp.map(r => r.course_name + ' (' + r.institution.replace(/ Polytechnic$/, '') + ')'))].slice(0, 8).join('; ') + '.');
    const cond = pfpClusters.filter(r => stateOracle(r) === 'cond'); if (cond.length) w('  On condition: ' + cond.length + ' (e.g. ' + [...new Set(cond.map(r => r.course_name))].slice(0, 4).join('; ') + ').');
    const dppAll = f.cards.filter(c => c.sec === 'dppvia' && c.state !== 'no' && c.offs[0].x.n != null);
    w('- **DPP, via ITE** ("Via ITE (DPP)" on the Polytechnic screen): ' + stateCount(f, 'dppvia') + ', **' + dppAll.filter(c => clears(c.offs[0])).length + ' of them clear** (gap 0 or more; the page\'s count with Within reach on). Ranges are last year\'s JIE net aggregate (ELMAB3). The page names the ITE Higher Nitec only; it does not say which poly diploma follows, so a persona that names a **poly diploma** from DPP is guessing.');
    const dpp = f.cards.filter(c => c.sec === 'dppvia' && c.state !== 'no' && c.offs[0].x.n != null).sort((a, b) => a.offs[0].x.range[1] - b.offs[0].x.range[1]);
    dpp.filter(c => clears(c.offs[0])).slice(0, 5).forEach(c => w('  - ' + c.title + ' (' + c.inst + '): ' + offerStr(c.offs[0])));
    w('- **Success** = names 2 or more poly courses they can apply for. PFP gives named diplomas (above). DPP gives ITE Higher Nitec names only.');
    w('- **The "Next:" line on the Polytechnic screen** gives the two ways in together, the earlier first: ' + (nextOptions('N(A)', ['poly'], today) || []).filter(t => / · /.test(t)).map(t => '"' + t + '"').join(' or ') + '.');
    w('- **Next application date:** ' + nextStr('N(A)', ['poly']) + '; then PFP: ' + WINDOWS.filter(x => x.ex === 'PFP-2027').map(windowOf).map(x => (x.basis === 'inferred' ? 'expected ' : '') + whenText(x.start, x.end) + ' 2027').join('') + '; DPP second window: ' + WINDOWS.filter(x => x.ex === 'DPP-2027' && /2nd/.test(x.prefix)).map(windowOf).map(x => (x.basis === 'inferred' ? 'expected ' : '') + whenText(x.start, x.end) + ' 2027').join('') + '. N-Level results: 17-21 Dec 2026 (tentative). These windows are *expected* (worked out from results day, not published); the page must say "expected". For PFP the date is the January window; DPP\'s first window opens in December.');
    Q.push({ id: 'P1', nums: 'ELMAB3 gross 12, net 12 (CCA Fair adds nothing); PFP needs 12 or better', names: 'PFP: ' + [...new Set(yesPfp.map(r => r.course_name))].slice(0, 3).join('; ') + ' (no cut-off). DPP via ITE: ' + dpp.filter(c => clears(c.offs[0])).slice(0, 2).map(c => c.title).join('; '), date: nextStr('N(A)', ['poly']) + '; PFP: ' + WINDOWS.filter(x => x.ex === 'PFP-2027').map(windowOf).map(x => (x.basis === 'inferred' ? 'expected ' : '') + whenText(x.start, x.end) + ' 2027').join('') });
    w(); }

  // ---- P2
  { const f = F.P2, e = f.eng;
    w('## P2. O-Level, CCA Good, St Andrew\'s (affiliated to SAJC), no LEP, JC (phone, 40 taps)');
    w('Results: EL A2, Chinese B3, Maths A2, Physics B3, Chemistry B3, Geography A2, History B4. In the page the school is listed as "St Andrew\'s School (Secondary)".');
    w();
    aggTable(e, ['L1R5(2026)']);
    const r = e.byId['L1R5(2026)'];
    w('- L1R5 gross ' + r.gross + ', bonus ' + (r.gross - r.net) + ' (CCA Good 1; English A2 + Chinese B3 is not Higher MTL, so no +2), net ' + r.net + '. **At SAJC the affiliation adds 2 more, net ' + (r.net - 2) + '¹** (1st or 1st and 2nd choice only; the cap of 4 is not reached). No LEP.');
    w();
    const seven = ['River Valley High School (Junior College)', 'Hwa Chong Institution (Junior College)', 'National Junior College', "St Andrew's Junior College", 'Anglo-Chinese Junior College', 'Jurong Pioneer Junior College', 'Nanyang Junior College'];
    w('The seven JCs (RVHS, HCI, NJC, SAJC, ACJC, JPJC, NYJC), stream by stream. **In reach = gap 0 or more.**');
    w();
    w('| JC | Your net | Arts cut-off | Arts gap | Science cut-off | Science gap |'); w('|---|---|---|---|---|---|');
    const reach = { Arts: [], Science: [] };
    seven.forEach(n => {
      const c = f.cards.find(x => x.sec === 'jc' && x.title === n); if (!c) { w('| ' + n + ' | (not in data) | | | | |'); return; }
      const A = c.offs.find(o => o.label === 'Arts'), S = c.offs.find(o => o.label === 'Science');
      const cell = o => o ? (o.x.state === 'no' ? ["can't apply", ''] : o.x.range ? [String(o.x.range[1]) + ' (' + rangeText(o.x.range) + ')', signed(o.x.n) + ' ' + colourOf(o.x.n)] : ['none', '']) : ['-', ''];
      if (A && clears(A)) reach.Arts.push(jcShort(n)); if (S && clears(S)) reach.Science.push(jcShort(n));
      w('| ' + jcShort(n) + ' | ' + (A || S).x.net.value + (A || S).x.net.marks + ' | ' + cell(A)[0] + ' | ' + cell(A)[1] + ' | ' + cell(S)[0] + ' | ' + cell(S)[1] + ' |');
    });
    w();
    w('- **In reach for Arts:** ' + (reach.Arts.join(', ') || 'none') + '.');
    w('- **In reach for Science:** ' + (reach.Science.join(', ') || 'none') + '.');
    const near = st => seven.map(n => f.cards.find(x => x.sec === 'jc' && x.title === n)).filter(Boolean).filter(c => { const o = c.offs.find(o => o.label === st); return o && o.x.state !== 'no' && o.x.n != null && o.x.n < 0 && o.x.n >= -2; }).map(c => jcShort(c.title) + ' ' + signed(c.offs.find(o => o.label === st).x.n));
    w('- Within 2 points short (the page\'s "Also show courses up to 2 points short"): Arts ' + (near('Arts').join(', ') || 'none') + '; Science ' + (near('Science').join(', ') || 'none') + '. Those are *not* in reach, but a persona that lists them with the right minus sign is still correct.');
    w('- **Success** = the shortlist is the in-reach JCs of the stream they choose, and the shared text carries the right numbers and the affiliation note. Expected shape of the text for SAJC: `1. St Andrew\'s Junior College` / `2026 JAE L1R5 net aggregate: Arts ' + rangeText(f.cards.find(x => x.title === "St Andrew's Junior College").offs[0].x.range) + ', Science ' + rangeText(f.cards.find(x => x.title === "St Andrew's Junior College").offs[1].x.range) + '` / `Your net aggregate: ' + (r.net - 2) + '¹ (Arts ' + signed(f.cards.find(x => x.title === "St Andrew's Junior College").offs[0].x.n) + ', Science ' + signed(f.cards.find(x => x.title === "St Andrew's Junior College").offs[1].x.n) + ')` / `¹ Includes 2 points for affiliation: 1st, or 1st and 2nd, choice only.` / link. Other JCs show net ' + r.net + ' with no mark.');
    w('- **Next application date:** ' + nextStr('O', ['jc']) + ' (O-Level results 13-15 Jan 2027, tentative). Expected, not published.');
    Q.push({ id: 'P2', nums: 'L1R5 gross ' + r.gross + ', net ' + r.net + '; at SAJC net ' + (r.net - 2) + '\u00B9', names: 'in reach: Arts ' + (reach.Arts.join(', ') || 'none') + '; Science ' + (reach.Science.join(', ') || 'none') + '; SAJC is 2 short (Arts \u22122)', date: nextStr('O', ['jc']) });
    w(); }

  // ---- P3
  { const f = F.P3, e = f.eng;
    w('## P3. 2027 SEC, CCA Excellent, JC + Polytechnic (laptop, 30 taps)');
    w('G3: EL B3, Maths B4, Science (Chem, Bio) B4, Humanities (SS, Geog) A2, Additional Maths C5, POA B3; G1: Chinese D.');
    w();
    aggTable(e, ['L1R4(2027)', 'ELR2B2-A(2027)', 'ELR2B2-B(2027)', 'ELR2B2-C(2027)', 'ELR2B2-D(2027)']);
    const l = e.byId['L1R4(2027)'];
    w('- **L1R4 = ' + l.net + ' net (gross ' + l.gross + ' − ' + (l.gross - l.net) + ' CCA).** ELR2B2 net: ' + ['A', 'B', 'C', 'D'].map(k => k + ' ' + e.byId['ELR2B2-' + k + '(2027)'].net).join(', ') + '.');
    const nets3 = ['A', 'B', 'C', 'D'].map(k => e.byId['ELR2B2-' + k + '(2027)'].net), gross3 = ['A', 'B', 'C', 'D'].map(k => e.byId['ELR2B2-' + k + '(2027)'].gross), by3 = [];
    ['A', 'B', 'C', 'D'].forEach((k, i) => { const g = by3.find(y => y.v === nets3[i]); if (g) g.k.push(k); else by3.push({ v: nets3[i], k: [k] }); });
    w('- No ITE, MI, arts or PFP-as-a-route shows unless picked (JC and Polytechnic only). There is no MOE table. The Results screen has one route line per picked route: JC ' + (l.gross <= 16 ? '"✓ You meet the 2028 criteria"' : 'closed') + '; Polytechnic "Year 1 ✓ · PFP ' + (e.byId['ELMAB3:PFP(2027)'].gross <= 12 ? '✓' : '✗') + '" (PFP: ELMAB3 gross ' + e.byId['ELMAB3:PFP(2027)'].gross + ', needs 12 or better). The Courses headers carry the same lines.');
    w('- Header lines: JC "Your net L1R4: ' + l.net + ' (gross ' + l.gross + ' − ' + (l.gross - l.net) + ' CCA)"; Polytechnic "' + (by3.length === 1 ? 'Your net ELR2B2: ' + nets3[0] + (gross3[0] !== nets3[0] ? ' (gross ' + gross3[0] + ' − ' + (gross3[0] - nets3[0]) + ' CCA)' : '') : 'Your net ELR2B2: ' + by3.map(y => y.v + ' (' + y.k.join(', ') + ')').join(' · ')) + '" (the poly header shows gross − CCA like the JC one).');
    w('- Every cut-off is an **estimate** (Est.), worked out from the 2026 range by the estimate rule. Never an MOE figure. JC and Polytechnic follow the rules in the README; MI, if picked: its own 2026 L1R4 range as it is, capped at 20; ITE, if picked: JIE \'H\' / \'N\' ranges as they are, a five-subject conversion for the O-Level-only 2-year courses (not part of this persona).');
    const jcA = jcTable(f, 'pjc', 'Arts'), jcS = jcTable(f, 'pjc', 'Science');
    w();
    w('JCs, estimated 2028 cut-off (L1R4): student clears **' + jcA.filter(x => clears(x.o)).length + ' of ' + jcA.length + '** on Arts and **' + jcS.filter(x => clears(x.o)).length + ' of ' + jcS.length + '** on Science. Examples they clear (most competitive first):');
    w();
    w('| JC | Arts | Science |'); w('|---|---|---|');
    const names = [...new Set(jcA.filter(x => clears(x.o)).concat(jcS.filter(x => clears(x.o))).map(x => x.c.title))].slice(0, 8);
    names.forEach(n => { const c = f.cards.find(x => x.sec === 'pjc' && x.title === n); const A = c.offs.find(o => o.label === 'Arts'), S = c.offs.find(o => o.label === 'Science'); w('| ' + jcShort(n) + ' | ' + (A ? offerStr(A).replace(/^.*?: /, '') : '-') + ' | ' + (S ? offerStr(S).replace(/^.*?: /, '') : '-') + ' |'); });
    w();
    const miss = st => jcTable(f, 'pjc', st).filter(x => !clears(x.o)).sort((a, b) => b.o.x.n - a.o.x.n).slice(0, 4).map(x => jcShort(x.c.title) + ' (cut-off ' + x.o.x.range[1] + ', ' + signed(x.o.x.n) + ')').join('; ');
    w();
    w('**Only the JCs above clear.** Nearest misses, Arts: ' + miss('Arts') + '. Science: ' + miss('Science') + '. A persona that calls a miss "cleared" is wrong; one that names it with its minus sign is right. (PERSONA_INPUTS says P3 "names 2 or more JCs ... they would clear"; with a net of ' + l.net + ' only one JC clears, so score "2 or more" as: the clearing JC plus near misses shown with the right sign.)');
    const pb = polyBest(f, 'ppoly');
    w();
    w('Polytechnic diplomas with an estimated range: ' + stateCount(f, 'ppoly') + '; they clear **' + pb.length + '**. Examples (most competitive they clear):');
    w();
    pb.slice(0, 8).forEach(c => w('- ' + c.title + ', ' + c.inst + ': ' + offerStr(c.offs[0])));
    const nr = f.cards.filter(c => c.sec === 'ppoly' && c.offs[0].x.range == null).length;
    w(); w('- ' + nr + ' polytechnic diplomas have no 2026 range and so no estimate (shown without a range).');
    w('- **Success** = states L1R4 ' + l.net + ' net and ELR2B2 ' + e.byId['ELR2B2-B(2027)'].net + ' net (both nets), names 2+ JCs and 2+ poly courses with estimated cut-offs they would clear, and sees no ITE or other route they did not pick.');
    w('- **Next:** nothing is open for SEC 2027 students; the first dated step is "MOE publishes the 2028 course information, mid-2027".');
    Q.push({ id: 'P3', nums: 'L1R4 net ' + l.net + ' (gross ' + l.gross + '); ELR2B2 net ' + e.byId['ELR2B2-B(2027)'].net + ' (gross ' + e.byId['ELR2B2-B(2027)'].gross + ')', names: 'JC that clears: ' + [...new Set(jcA.filter(x => clears(x.o)).concat(jcS.filter(x => clears(x.o))).map(x => jcShort(x.c.title)))].join(', ') + '; nearest misses ' + miss('Arts').split(';').slice(0, 2).join(';') + '. Poly e.g. ' + pb.slice(0, 3).map(c => c.title + ' (' + c.inst.replace(' Polytechnic', '') + ')').join('; '), date: 'none open; first step is MOE\'s 2028 course update, mid-2027' });
    w(); }

  // ---- P4
  { const f = F.P4, e = f.eng;
    w('## P4. O-Level, CCA Fair, Polytechnic, parent asking about engineering at SP or NP (phone, 30 taps)');
    w('Results: EL B3, Maths A2, Physics B4, Chemistry B3, Additional Maths B3, Chinese C5, Geography C6.');
    w();
    aggTable(e, ['ELR2B2-A(2026)', 'ELR2B2-B(2026)', 'ELR2B2-C:POLY(2026)', 'ELR2B2-D(2026)']);
    w('CCA Fair earns no bonus point, so net = gross on every aggregate.');
    const eng = f.cards.filter(c => c.sec === 'poly' && c.field === 'Engineering' && /^(Singapore|Ngee Ann) Polytechnic$/.test(c.inst));
    w();
    w('Engineering diplomas at SP and NP (' + eng.length + ' in the data; the page\'s Field filter "Engineering" + Institution SP, NP shows exactly these):');
    w();
    w('| Course | Poly | State | Range (ELR2B2-C) | Your net | Gap |'); w('|---|---|---|---|---|---|');
    eng.sort((a, b) => (a.inst < b.inst ? -1 : a.inst > b.inst ? 1 : a.title < b.title ? -1 : 1)).forEach(c => { const o = c.offs[0]; w('| ' + c.title + ' | ' + c.inst.replace(' Polytechnic', '') + ' | ' + o.x.state + ' | ' + (o.x.range ? rangeText(o.x.range) : 'none') + ' | ' + o.x.net.value + ' | ' + (o.x.n == null ? '' : signed(o.x.n) + ' ' + colourOf(o.x.n)) + ' |'); });
    w();
    const okE = eng.filter(c => c.offs[0].x.state !== 'no' && c.offs[0].x.n != null && c.offs[0].x.n >= 0);
    w('- They can apply for ' + eng.filter(c => c.offs[0].x.state !== 'no').length + ' of the ' + eng.length + '; **clear (gap 0 or more) ' + okE.length + '**: ' + okE.map(c => c.title + ' (' + c.inst.replace(' Polytechnic', '') + ' ' + signed(c.offs[0].x.n) + ')').join('; ') + '.');
    { const allE = f.cards.filter(c => c.sec === 'poly' && c.field === 'Engineering' && c.state !== 'no');
      const inReach = allE.filter(c => c.offs[0].x.n != null && c.offs[0].x.n >= 0), shortE = allE.filter(c => c.offs[0].x.n != null && c.offs[0].x.n < 0), noRng = allE.filter(c => c.offs[0].x.n == null);
      w('- Field "Engineering" alone (all five polytechnics, Within reach on): the list and its header both say **' + inReach.length + '**, with "Show the ' + shortE.length + ' you\'re short for" and "Show ' + noRng.length + ' with no published cut-off" under it (' + allE.length + ' in all). Include the courses MOE files under Engineering whose name does not say so (for example Common Business & Technology Programme, NYP).'); }
    w('- **Success** = names 2+ engineering courses at SP or NP **and reads each gap with the right sign**: "−" is short of last year\'s cut-off, "+" is to spare. A persona that calls a "−" course safe, or a "+" course out of reach, scores 0 for that course.');
    w('- **Next application date:** ' + nextStr('O', ['poly']) + '.');
    Q.push({ id: 'P4', nums: 'ELR2B2-C gross ' + e.byId['ELR2B2-C:POLY(2026)'].gross + ', net ' + e.byId['ELR2B2-C:POLY(2026)'].net + ' (A and B ' + e.byId['ELR2B2-A(2026)'].net + ')', names: 'clear: ' + okE.slice(0, 5).map(c => c.title + ' ' + c.inst.replace(' Polytechnic', '') + ' ' + signed(c.offs[0].x.n)).join('; ') + '; short: ' + eng.filter(c => c.offs[0].x.n < 0).slice(0, 3).map(c => c.title + ' ' + c.inst.replace(' Polytechnic', '') + ' ' + signed(c.offs[0].x.n)).join('; '), date: nextStr('O', ['poly']) });
    w(); }

  // ---- P5
  { w('## P5. Form teacher, three students, JC + Polytechnic (laptop, 36 taps, 12 per student)');
    w();
    ['P5A', 'P5B', 'P5C'].forEach((id, i) => {
      const f = F[id], e = f.eng, L1 = e.byId['L1R5(2026)'];
      const cca = f.st.cca;
      w('### Student ' + 'ABC'[i] + ' (CCA ' + cca + ')');
      w('Results line: `' + PASTE_LINES['ABC'[i]] + '`');
      w('The page reads it as: ' + f.st.subs.map(x => x[0] + ' ' + x[2]).join('; ') + '.' + (id === 'P5B' ? ' "FOOD AND NUTRITION" becomes the earlier subject Food & Nutrition (not Nutrition & Food Science); it counts as an ordinary elective.' : '') + (id === 'P5C' ? ' Geography is a single subject here (not the combined Humanities).' : ''));
      w();
      aggTable(e, ['L1R5(2026)', 'ELR2B2-A(2026)', 'ELR2B2-B(2026)', 'ELR2B2-C:POLY(2026)', 'ELR2B2-D(2026)']);
      const jcA = jcTable(f, 'jc', 'Arts'), jcS = jcTable(f, 'jc', 'Science');
      const cA = jcA.filter(x => clears(x.o)), cS = jcS.filter(x => clears(x.o));
      const jcState = f.cards.filter(c => c.sec === 'jc');
      w('- **JC:** ' + (jcState.every(c => c.state === 'no') ? "closed (L1R5 gross over 20, or a specific-subject requirement is not met): every JC shows \"can't apply\"." : stateCount(f, 'jc') + '.'));
      if (cA.length || cS.length) {
        w('  - Arts, most competitive JC they clear: ' + cA.slice(0, 3).map(x => jcShort(x.c.title) + ' (cut-off ' + x.o.x.range[1] + ', ' + signed(x.o.x.n) + ')').join('; ') + ' (clears ' + cA.length + ' of ' + jcA.length + ').');
        w('  - Science, most competitive JC they clear: ' + cS.slice(0, 3).map(x => jcShort(x.c.title) + ' (cut-off ' + x.o.x.range[1] + ', ' + signed(x.o.x.n) + ')').join('; ') + ' (clears ' + cS.length + ' of ' + jcS.length + ').');
      }
      const pb = polyBest(f, 'poly');
      w('- **Polytechnic:** ' + stateCount(f, 'poly') + '; clears (gap 0 or more) **' + pb.length + '**. Most competitive they clear: ' + pb.slice(0, 4).map(c => c.title + ', ' + c.inst.replace(' Polytechnic', '') + ' (' + rangeText(c.offs[0].x.range) + ', ' + signed(c.offs[0].x.n) + ')').join('; ') + '.');
      Q.push({ id: id, nums: 'L1R5 gross ' + L1.gross + ', net ' + L1.net + '; ELR2B2-C net ' + e.byId['ELR2B2-C:POLY(2026)'].net, names: (jcState.every(c => c.state === 'no') ? 'JC closed' : 'JC Arts: ' + (cA.slice(0, 2).map(x => jcShort(x.c.title)).join(', ') || 'none clear') + ' / Science: ' + (cS.slice(0, 2).map(x => jcShort(x.c.title)).join(', ') || 'none clear')) + '. Poly: ' + pb.slice(0, 2).map(c => c.title + ' (' + c.inst.replace(' Polytechnic', '') + ')').join('; '), date: nextStr('O', ['jc', 'poly']) });
      w('- **Scoring "best":** a pick is right if it is a course the student can apply for, clears (gap 0 or more) and is read with the right sign. The courses listed above are the top of the page\'s own "most competitive first" order. A pick further down the cleared list is still correct, just less competitive. A pick that is "can\'t apply", short of the cut-off, or read with the wrong sign is wrong.');
      w();
    }); }

  // ---- P6
  { const f = F.P6, e = f.eng;
    w('## P6. O-Level, CCA Excellent, JC, wants the most competitive JCs for Science (phone, 30 taps)');
    w('Results: EL A1, Higher Chinese A1, Chinese A1, Maths A1, Additional Maths A1, Physics A1, Chemistry A2, History A1. Note: Higher Chinese and Chinese together is not a normal O-Level combination; the engine counts both as given.');
    w();
    aggTable(e, ['L1R5(2026)']);
    const jcS = jcTable(f, 'jc', 'Science');
    w('Science cut-offs the student clears, **most competitive first** (this is the order the page\'s "Sort by Science" shows, rows above the "Your net" divider are the ones not cleared):');
    w();
    w('| # | JC | Science range | Cut-off | Your net | Gap |'); w('|---|---|---|---|---|---|');
    jcS.filter(x => clears(x.o)).slice(0, 6).forEach((x, i) => w('| ' + (i + 1) + ' | ' + jcShort(x.c.title) + ' | ' + rangeText(x.o.x.range) + ' | ' + x.o.x.range[1] + ' | ' + x.o.x.net.value + x.o.x.net.marks + ' | ' + signed(x.o.x.n) + ' ' + colourOf(x.o.x.n) + ' |'));
    const notCleared = jcS.filter(x => !clears(x.o));
    w();
    w('- Cut-offs lower than the student\'s net are *not cleared* (they sit above the divider): ' + (notCleared.length ? notCleared.map(x => jcShort(x.c.title) + ' ' + x.o.x.range[1]).join(', ') : 'none') + '.');
    const top = jcS.filter(x => clears(x.o));
    const cut3 = top[2] && top[2].o.x.range[1];
    const tied = top.filter(x => x.o.x.range[1] === cut3);
    w('- **Success** = sorts by Science and names the top 3 by Science cut-off that they clear: **' + top.slice(0, 3).map(x => jcShort(x.c.title)).join(', ') + '**' + (tied.length > 1 && tied.some(x => top.indexOf(x) >= 3) ? '. The 3rd place is a **tie at cut-off ' + cut3 + '** between ' + tied.map(x => jcShort(x.c.title)).join(' and ') + '; accept either (the page lists them in name order).' : '. Ties on the same cut-off may come in either order.'));
    w('- **Next application date:** ' + nextStr('O', ['jc']) + '.');
    Q.push({ id: 'P6', nums: 'L1R5 gross ' + e.byId['L1R5(2026)'].gross + ', net ' + e.byId['L1R5(2026)'].net, names: 'top 3 by Science cut-off: ' + top.slice(0, 3).map(x => jcShort(x.c.title) + ' ' + x.o.x.range[1]).join(', ') + (tied.length > 1 ? ' (3rd is a tie)' : ''), date: nextStr('O', ['jc']) });
    w(); }
  const qi = L.indexOf('@@QUICK@@');
  const qt = ['**Quick match.** One line per persona; the sections below have the detail.', '', '| Persona | Aggregates | Names to expect | Next application date |', '|---|---|---|---|'].concat(Q.map(q => '| ' + q.id + ' | ' + q.nums + ' | ' + q.names + ' | ' + (q.date || '') + ' |'));
  L.splice(qi, 1, ...qt);
  return L.join('\n');
}
function writeTruth(file) { fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true }); fs.writeFileSync(file, truthMarkdown() + '\n'); info('persona truth written', file); }


// ================================================================================================ 7 The six personas, end to end
async function check7() {
  const c71 = check(7, '7.1', 'P5: each results line, pasted into the page\'s "Paste your results" box, becomes the intended subjects and grades');
  const c72 = check(7, '7.2', "P3: the \"Your aggregates\" tiles (big net, a tick when open, the net and how it is made in the tile's pop-over, no title) and \"Your pathways\" with the courses within reach, no route lines; poly cards carry ranges with the indicative tag and a pill; the JC table carries estimates; tapping a pathway leaves Where alone and the route chips name the picked routes ()");
  const c73 = check(7, '7.3', 'P2: the shared text for the seven JCs matches the engine, with the affiliation note on SAJC only');
  const c74 = check(7, '7.4', 'P4: Field "Engineering" + Institution SP and NP lists exactly the engineering diplomas of those two polytechnics, each with the gap the engine gives');
  const c75 = check(7, '7.5', 'P6: "Sort by Science" orders the JCs by Science cut-off against the net, the way the truth does');
  const c76 = check(7, '7.6', 'P1: the Polytechnic screen of an N(A) student shows PFP and Via ITE (DPP) under their route bands, and has no "Next:" line ()');
  const c77 = check(7, '7.7', 'no footer on any tab; About (the "i" in the top bar) names the data snapshot date that data.json carries, with the other five items');
  const p = await openPage(null, { width: 1280, height: 900 });
  // 7.1 the results paste
  for (const pr of PERSONAS.filter(x => x.pasteLine)) {
    const st = state({ year: 2026, level: 'O', cca: pr.cca, where: pr.where, rows: [] });
    await loadState(p, st, '#input');
    await p.eval(`(document.querySelector('[data-do="paste-toggle"]')||{click(){}}).click(); 1`); await sleep(60);
    await p.eval(`(() => { const t = document.getElementById('paste-text'); t.value = ${JSON.stringify(PASTE_LINES[pr.pasteLine])}; t.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('[data-do="paste-read"]').click(); return 1; })()`);
    await sleep(120);
    const rows = await p.eval(`window.PSE_ATLAS.state().rows.filter(r => !r.skip && r.name).map(r => [r.name, r.level, r.grade])`);
    const gotS = rows.map(r => r.join('|')).sort(), wantS = pr.subs.map(r => r.join('|')).sort();
    c71.eq(gotS, wantS, pr.id + ' results line "' + pr.pasteLine + '"');
  }
  // 7.8 a pasted name the engine does not know: flagged at its row, counted in the bar, never sent to the engine
  { const c78 = check(7, '7.8', 'a pasted name the engine does not know is flagged at its row and in the paste line, holds back the Add / Calculate buttons, and is never sent to the engine (no bar count)');
    await loadState(p, state({ year: 2026, level: 'O', cca: 'Good', where: ['jc'], rows: [] }), '#input');
    await p.eval(`(document.querySelector('[data-do="paste-toggle"]')||{click(){}}).click(); 1`); await sleep(60);
    await p.eval(`(() => { const t = document.getElementById('paste-text'); t.value = 'ENGLISH LANGUAGE = A1, FOO BAR = A1, MATHEMATICS = B3, CHINESE = B4, SCIENCE (PHYSICS, CHEMISTRY) = B4, HUMANITIES (SOCIAL STUDIES, GEOGRAPHY) = B4'; document.querySelector('[data-do="paste-read"]').click(); return 1; })()`);
    await sleep(200);
    const R7 = await p.eval(`({ missing: window.PSE_ATLAS.missing(), text: document.body.innerText, sent: (window.PSE_ATLAS.result() && window.PSE_ATLAS.result().sent) ? window.PSE_ATLAS.result().sent.subjects.map(x => x.subject) : null,
      buttons: [...document.querySelectorAll('button')].filter(b => b.offsetParent && /Calculate my aggregates|Add a subject|Show my courses/.test(b.innerText)).map(b => b.innerText.trim()), bar: (document.getElementById('bar') || {}).innerText || '' })`);
    c78.eq(R7.missing, 1, 'rows that block "Show my courses"');
    c78.ass(/Not a subject we know: FOO BAR\./.test(R7.text), 'no "Not a subject we know: FOO BAR." at the row');
    // there is no bar count any more. The paste says it ("1 name we don't know: FOO BAR."), the row says it, the bottom bar is empty before Calculate, and while the row is
    // open neither "+ Add a subject" nor "Calculate my aggregates" shows, so the unknown name cannot reach the engine
    c78.ass(/1 name we don't know: FOO BAR/.test(R7.text), 'the paste line does not count the unknown name: ' + wsp(R7.text).slice(wsp(R7.text).indexOf('Read 5'), wsp(R7.text).indexOf('Read 5') + 120));
    c78.eq([R7.bar, R7.buttons], ['', []], 'bottom bar and the Add / Calculate buttons while the unknown name is open');
    c78.ass(!R7.sent || !R7.sent.includes('FOO BAR'), 'FOO BAR was sent to the engine');
    // removing the row frees the step: Calculate shows, and what the engine gets is the five subjects
    await p.eval(`(document.querySelector('[data-do="remove-row"][aria-label="Remove FOO BAR"]') || { click() {} }).click(); 1`); await sleep(250);
    const R8 = await p.eval(`({ missing: window.PSE_ATLAS.missing(), buttons: [...document.querySelectorAll('button')].filter(b => b.offsetParent && /Calculate my aggregates|Add a subject/.test(b.innerText)).map(b => b.innerText.trim()) })`);
    c78.eq([R8.missing, R8.buttons], [0, ['+ Add a subject', 'Calculate my aggregates']], 'after removing the row: rows that block, buttons');
    await p.eval(`(([...document.querySelectorAll('button')].find(b => b.offsetParent && /^Calculate my aggregates/.test(b.innerText.trim()))) || { click() {} }).click(); 1`); await sleep(300);
    const R9 = await p.eval(`(window.PSE_ATLAS.result() && window.PSE_ATLAS.result().sent) ? window.PSE_ATLAS.result().sent.subjects.map(x => x.subject).sort() : null`);
    c78.eq(R9, ['Chinese', 'English Language', 'Humanities (Social Studies, Geography)', 'Mathematics', 'Science (Physics, Chemistry)'], 'subjects the engine gets after Calculate');
  }
  { const pr = PERSONAS[2], st = personaState(pr), eng = runEngine(st);
    await loadState(p, stateOf(st), '#courses');
    const M = await p.eval(MODEL);
    const { counts, dom } = await expandAndRead(p);
    // the Results screen says, per picked route, how to get in
    // level 1 is a row of tiles, one per key aggregate: a small label "JC · L1R4", the net as the big number (gross - bonus in the tile's title),
    // one word below ("✓ open" / "✗ needs 16"); level 3 "Your pathways" follows with the courses within reach (Within reach plus Borderline), most competitive first
    await p.eval(`location.hash = '#input'; 1`); await sleep(300);
    const ov = await p.eval(`(() => { const a = document.getElementById('aggs'); if (!a) return null; const pw = document.querySelector('section.pathways'); const tx = e => ((e || {}).textContent || '').replace(/\\s+/g, ' ').trim(); return { rows: [...a.querySelectorAll('.tile-w')].map(w => { const r = w.querySelector('.tile'); return ({ label: tx(r.querySelector('.t-k')), n: tx(r.querySelector('.agg-n')), title: r.getAttribute('title') || '', lines: [...w.querySelectorAll('.tip-l')].map(tx), word: tx(r.querySelector('.t-w')) }); }),
      lines: pw ? [...pw.querySelectorAll('a')].map(x => x.innerText.replace(/\\s+/g, ' ').replace(/ ›$/, '').trim()) : [], tables: a.querySelectorAll('table, thead, th').length, text: a.innerText.replace(/\\s+/g, ' '), rt: document.querySelectorAll('.rt-line').length }; })()`);
    c72.ass(!!ov, 'the "Your aggregates" tiles are missing from the Results screen');
    const l = eng.byId['L1R4(2027)'];
    const Fx7 = facts(pr);
    if (ov) {
      c72.eq(ov.tables, 0, 'a table in the aggregates card');
      c72.eq(ov.rt, 0, 'route lines are still on the Results screen');
      const nets7 = ['A', 'B', 'C', 'D'].map(k => eng.byId['ELR2B2-' + k + '(2027)']);
      const polyW = nets7.every(r => r.net === nets7[0].net && r.gross === nets7[0].gross) ? 'gross ' + nets7[0].gross + ' − ' + (nets7[0].gross - nets7[0].net) + ' CCA' : null;
      const pf = eng.byId['ELMAB3:PFP(2027)'];
      const jcOk = l.gross <= 16, pfOk = pf.gross <= 12;
      // identical figures share a tile, and the tiles follow the results, not the route chips. In 2027 JC and MI both use L1R4(2027), so with both open the tile is "JC, MI · L1R4"
      const openOf = stream => eng.rep.results.some(r => r.exercise === 'PSE-2028' && r.stream === stream && r.eligible !== false);
      const jcMi = openOf('Junior college') === openOf('Millennia Institute') ? 'JC, MI' : 'JC';
      // a tile has no title; what the title carried is in its pop-over: an open tile says its net the way the route bands did, "Your net L1R4: 14 (gross 16 − 2 CCA)"
      const netLine = (name, r) => 'Your net ' + name + ': ' + r.net + (r.gross !== r.net ? ' (gross ' + r.gross + ' − ' + (r.gross - r.net) + ' CCA)' : '');
      const polyLine = (() => { const nets = nets7.map(r => r.net), by = []; ['A', 'B', 'C', 'D'].forEach((k, i) => { const g = by.find(y => y.v === nets[i]); if (g) g.k.push(k); else by.push({ v: nets[i], k: [k] }); });
        const grosses = nets7.map(r => r.gross); return by.length === 1 && grosses.every(v => v === grosses[0]) ? netLine('ELR2B2', nets7[0]) : 'Your net ELR2B2: ' + by.map(y => y.v + ' (' + y.k.join(', ') + ')').join(' · '); })();
      c72.eq(ov.rows.map(r => [r.label, r.n, r.title, /^✓ open/.test(r.word), r.lines]), [[jcMi + ' · L1R4', String(l.net), '', jcOk, jcOk ? [netLine('L1R4', l)] : ov.rows[0] && ov.rows[0].lines],
        ['Poly · ELR2B2', String(nets7[0].net), '', true, [polyLine]], ['PFP · ELMAB3', String(pf.gross), '', pfOk, pfOk ? ['Your gross ELMAB3: ' + pf.gross + ' (PFP needs 12 or better)'] : ov.rows[2] && ov.rows[2].lines]], 'the aggregate tiles [label, number, title, open, pop-over lines]');
      // "Your pathways": the courses within reach are those 2 or more points better (Within reach) plus those within 1 point (Borderline); PFP has no cut-offs, so every course it can apply for
      const jcN = new Set(['Arts', 'Science'].flatMap(st2 => jcTable(Fx7, 'pjc', st2).filter(x => x.o.x.n >= -1).map(x => x.c.title))).size;
      const polyN = Fx7.cards.filter(c => c.sec === 'ppoly' && c.offs[0].x.state !== 'no' && (c.offs[0].x.n == null || c.offs[0].x.n >= -1)).length, pfpN = M.cards.filter(c => c.sec === 'ppfp' && c.state !== 'no').length;
      const plural = n => n + (n === 1 ? ' course' : ' courses');
      // Results has no "Your pathways" lines and no "Also open to you" ("Show my courses" is the one way to Courses); jcN, polyN and pfpN are kept for the record
      void [jcN, polyN, pfpN, plural];
      c72.eq(ov.lines, [], 'no "Your pathways" lines on Results');
      c72.eq(await p.eval(`/Also open to you/.test(document.getElementById('s-input').innerText)`), false, '"Also open to you" on Results');
      c72.ass(!/Nitec|\bITE\b|NAFA|LASALLE|Millennia|JIE|DPP/.test(ov.text), 'the aggregate tiles name a route that was not picked: "' + ov.text.slice(0, 200) + '"');
    }
    await p.eval(`location.hash = '#courses'; 1`); await sleep(250);
    // (the route chips under the tiles name the routes that are not shown, by design: "+ MI"; the list text leaves them out)
    const openText = `(() => { const e = document.getElementById('s-list').cloneNode(true); e.querySelectorAll('.foot, .rchips').forEach(x => x.remove());
      e.querySelectorAll('details:not([open])').forEach(d => [...d.children].forEach(c => { if (c.tagName !== 'SUMMARY') c.remove(); })); return e.innerText; })()`;
    const listText = await p.eval(openText);
    const foldText = await p.eval(`(() => { const e = document.getElementById('s-list'); return [...e.querySelectorAll('.foot details, .overview details')].map(d => d.innerText).join(' '); })()`);
    if (/Nitec|ITE/.test(foldText)) c72.note("the \"MOE's note\" fold under the overview table still quotes MOE's footnote about 3-Year Higher Nitec (the 4 G1 column) although ITE was not picked and the student is in the 5 G3 column");
    const stray = /Nitec|\bITE\b|NAFA|LASALLE|Millennia|Arts Institutions|JIE|DPP/.exec(listText);
    c72.ass(!stray, 'a route that was not picked is named on the Courses screen: "' + (stray && stray[0]) + '" near "' + (stray ? listText.slice(Math.max(0, stray.index - 40), stray.index + 40).replace(/\s+/g, ' ') : '') + '"');
    // the band net lines ("Your net L1R4: ...") are gone from the route bands: they are the tiles' pop-over lines, checked with the tiles above and in 2.10
    // no route lines on the Courses screen either
    c72.eq(await p.eval(`document.querySelectorAll('#s-list .rt-line').length`), 0, 'route lines on the Courses screen');
    // the sentence about estimates at the head of each estimated section
    // fix list item 9: the sentence stands once per screen, at the first estimated section
    // the once-per-screen estimate sentence is gone (the indicative tag explains it)
    c72.ass(counts.secs.every(sx => !/Estimated from the 2026/.test(sx.note || '')), 'the estimate sentence is still on the Courses screen');
    // poly cards with an estimated range and a pill
    const polyCards = dom.filter(d => d.sec === 'ppoly' && !d.table);
    const withEst = polyCards.filter(d => d.badges.some(b => b.kind === 'gap' && /^ELR2B2-[ABCD] \d+(–\d+)?$/.test(b.rng) && b.ind && b.pill && b.pill.cls));
    const modelPoly = M.cards.filter(c => c.sec === 'ppoly' && c.offers[0].gap.range);
    c72.eq(withEst.length, modelPoly.length, 'poly cards that show "ELR2B2-x a–b", the indicative tag and a pill');
    // the JC table
    const jcRows = dom.filter(d => d.sec === 'pjc' && d.table);
    c72.ass(jcRows.length > 0 && jcRows.every(r => r.cells.length === 2), 'the JC table has no rows or no two cut-off columns');
    c72.ass(jcRows.some(r => r.cells.some(c => c.n && c.pill)), 'no JC row shows an estimated cut-off with a pill');
    // tapping a row of the overview leaves Where alone
    const before = await p.eval(`JSON.stringify(window.PSE_ATLAS.state().where)`);
    await p.eval(`location.hash = '#input'; 1`); await sleep(250);
    // no pathway links on Results; "Show my courses" (the bar's button) is the way in, and it too leaves Where alone
    c72.eq(await p.eval(`document.querySelectorAll('section.pathways a, [data-do="path-go"]').length`), 0, 'pathway links on the Results screen');
    for (let i = 0; i < 1; i++) {
      await p.eval(`location.hash = '#input'; 1`); await sleep(200);
      await p.eval(`document.querySelector('#bar [data-do="show"]').click(); 1`); await sleep(300);
      c72.eq(await p.eval(`JSON.stringify(window.PSE_ATLAS.state().where)`), before, 'Where after "Show my courses"');
      // the shown chips are the two picked routes; the dashed ones are the other open routes (the route chips replace the old "picked routes" filter chips)
      { const chips = await p.eval(`[...document.querySelectorAll('#s-list .rchips .rchip')].map(b => (b.classList.contains('on') ? '' : '+') + b.dataset.v)`);
        const openW = ['jc', 'mi', 'poly', 'ite', 'arts'].filter(w => M.cards.some(c => c.where === w && canApplyCard(c)));
        c72.eq(chips.filter(x => x[0] !== '+').sort(), ['jc', 'poly'], 'shown route chips after "Show my courses" (only the two picked routes)');
        c72.eq(chips.filter(x => x[0] === '+').map(x => x.slice(1)).sort(), openW.filter(w => w !== 'jc' && w !== 'poly').sort(), 'dashed route chips after "Show my courses" (the other open routes)'); }
      c72.ass(!(await p.eval(`/Nitec|ITE\\b/.test((${openText}))`)), 'an unpicked route appeared after "Show my courses"');
    }
  }
  // 7.3 P2's seven JCs, starred, shared
  { const pr = PERSONAS[1], st = personaState(pr), eng = runEngine(st);
    await loadState(p, stateOf(st), '#courses');
    const M = await p.eval(MODEL);
    const seven = ['River Valley High School (Junior College)', 'Hwa Chong Institution (Junior College)', 'National Junior College', "St Andrew's Junior College", 'Anglo-Chinese Junior College', 'Jurong Pioneer Junior College', 'Nanyang Junior College'];
    await shareScenario(p, { name: 'P2 seven JCs', c: c73, st: pr, pickKeys: M2 => seven.map(n => M2.cards.find(c => c.sec === 'jc' && c.title === n)).filter(Boolean) }, c73, c73);
    c73.eq(M.cards.filter(c => seven.includes(c.title)).length, 7, 'the seven JCs are all in the list');
  }
  // 7.4 P4 engineering
  { const pr = PERSONAS[3], st = personaState(pr), eng = runEngine(st);
    const st2 = Object.assign({}, st, { fields: ['Engineering'], insts: ['Singapore Polytechnic', 'Ngee Ann Polytechnic'] });
    await loadState(p, stateOf(st2), '#courses');
    const M = await p.eval(MODEL);
    // Filter Field = Engineering and Institution = SP and NP (two chips under the toolbar and a Filter chip saying 3). The Polytechnic Year 1 list then holds exactly the 16 engineering diplomas of those two
    // polytechnics, in chance order (Within reach, Borderline, no range, then the folds), each with the gap the engine gives; its band says the same two numbers as the engine. Grouped by Field it is one group,
    // grouped by Institution two, each heading with the counts of its cards.
    const { dom, reads } = await expandAndRead(p, ['none', 'field', 'inst']);
    const want = M.cards.filter(c => c.sec === 'poly' && c.field === 'Engineering' && /^(Singapore|Ngee Ann) Polytechnic$/.test(c.inst));
    c74.ass(want.length === 16, 'expected 16 engineering diplomas at SP and NP in the data, found ' + want.length);
    const xs = want.map(c => { const er = eng.results.get(c.offers[0].r.exercise + '|' + c.offers[0].r.requirement_key); return { c, x: offerOracle(er, st, eng) }; });
    const tallyX = list => list.reduce((a, e) => { if (e.x.state !== 'no' && e.x.n != null) { if (e.x.n >= 2) a[0]++; else if (e.x.n >= -1) a[1]++; } return a; }, [0, 0]);
    const T0 = reads[0].counts.top;
    c74.eq(T0.fchips.map(f => f.k + ':' + f.v).sort(), ['field:Engineering', 'inst:Ngee Ann Polytechnic', 'inst:Singapore Polytechnic'], 'the filter chips under the bar');
    c74.eq([T0.fchips.length, T0.tbar && T0.tbar.filter && T0.tbar.filter.n, T0.showAll], [3, 3, true], 'filter chips, the Filter chip\'s number, "Show all"');
    const sec0 = reads[0].counts.secs.find(x => x.id === 'poly');
    c74.eq(sec0 && sec0.band, tallyX(xs), 'the band of Polytechnic Year 1 [within reach, borderline]');
    reads.forEach(rd => {
      const mt = '[Group: ' + rd.mode + '] ', polyRecs = rd.dom.filter(d => d.sec === 'poly');
      c74.eq(polyRecs.map(d => d.baseKey).sort(), want.map(c => c.key).sort(), mt + 'the list holds the 16 engineering diplomas of SP and NP');
      xs.forEach(({ c, x }) => {
        const d = polyRecs.find(z => z.key === c.key + '@' + c.inst);
        c74.eq(d && d.badges[0] && d.badges[0].pill && d.badges[0].pill.text, x.n == null ? undefined : signed(x.n), mt + c.title + ' ' + c.inst + ' gap pill');
      });
    });
    // chance order in the plain list: Within reach (lowest gap first), Borderline, no range, the Out of reach fold, the can't-apply fold
    { const rank = e => e.x.state === 'no' ? 4 : e.x.n == null ? 2 : e.x.n >= 2 ? 0 : e.x.n >= -1 ? 1 : 3, order = xs.slice().sort((a, b) => rank(a) - rank(b) || (a.x.n || 0) - (b.x.n || 0) || (a.c.title.toLowerCase() < b.c.title.toLowerCase() ? -1 : a.c.title.toLowerCase() > b.c.title.toLowerCase() ? 1 : 0));
      const got = reads[0].dom.filter(d => d.sec === 'poly').map(d => d.baseKey);
      const idx = new Map(order.map((e, i) => [e.c.key, i])), rk = new Map(xs.map(e => [e.c.key, rank(e)])), nn = new Map(xs.map(e => [e.c.key, e.x.n]));
      let ok = got.length === 16;
      for (let i = 1; i < got.length && ok; i++) { const a = got[i - 1], b = got[i]; ok = rk.get(a) < rk.get(b) || (rk.get(a) === rk.get(b) && (nn.get(a) || 0) <= (nn.get(b) || 0)); }
      c74.ass(ok, 'the 16 diplomas are not in chance order: ' + got.map(k => rk.get(k) + '/' + nn.get(k)).join(' ')); }
    // the groups: Field has one heading with all 16 counted, Institution two (NP, SP), each heading's counts equal its cards and the engine
    { const rf = reads[1].counts.subs.filter(h => h.sec === 'poly'), ri = reads[2].counts.subs.filter(h => h.sec === 'poly');
      c74.eq(rf.map(h => [h.name, h.g, h.a]), [['Engineering'].concat(tallyX(xs))], '[Group: field] the headings of Polytechnic Year 1 [name, within reach, borderline]');
      c74.eq(ri.map(h => [h.name, h.g, h.a]).sort(), ['Ngee Ann Polytechnic', 'Singapore Polytechnic'].map(i => [i].concat(tallyX(xs.filter(e => e.c.inst === i)))).sort(), '[Group: inst] the headings of Polytechnic Year 1 [name, within reach, borderline]');
      [reads[1], reads[2]].forEach(rd => rd.counts.subs.filter(h => h.sec === 'poly').forEach(h => {
        const inside = rd.dom.filter(d => d.sec === 'poly' && d.sub === h.v && d.seg === 'main');
        c74.eq([inside.filter(d => d.grp === 'Within reach').length, inside.filter(d => d.grp === 'Borderline').length], [h.g, h.a], '[Group: ' + rd.mode + '] "' + h.name + '" heading vs its cards'); })); }
  }
  const ranked75 = (list, gapOf, titleOf) => list.slice().sort((a, b) => { const ga = gapOf(a), gb = gapOf(b), ra = ga >= 2 ? 0 : 1, rb = gb >= 2 ? 0 : 1; return ra - rb || ga - gb || (titleOf(a).toLowerCase() < titleOf(b).toLowerCase() ? -1 : 1); });
  // 7.5 P6 sorted by Science
  { const pr = PERSONAS[7], st = personaState(pr), eng = runEngine(st);
    await loadState(p, stateOf(st), '#courses');
    await p.eval(`(() => { const b = [...document.querySelectorAll('#sec-jc .jct-h button')].find(x => /Science/.test(x.textContent));  if (b) b.click(); return !!b; })()`);
    await sleep(150);
    const order = await p.eval(`[...document.querySelectorAll('#sec-jc .jct-r')].map(r => r.querySelector('.cc-title').textContent)`);
    const Fx = facts(pr);
    // Within reach (+2 or more) first, then Borderline, each lowest gap first; the Out of reach rows are in the fold, not on screen
    const want = ranked75(jcTable(Fx, 'jc', 'Science').filter(x => x.o.x.n >= -1), x => x.o.x.n, x => x.c.title).map(x => x.c.title);
    c75.ass(order.length > 0, 'no JC rows on screen');
    c75.eq(order.slice(0, want.length), want, 'JC order when sorted by Science (the 16 JCs with a Science cut-off; the IB-only schools come after)');
    const top3 = jcTable(Fx, 'jc', 'Science').filter(x => clears(x.o)).slice(0, 3).map(x => x.c.title);
    c75.eq(order.filter(n => top3.includes(n)).sort(), top3.slice().sort(), 'the top three by Science cut-off that the student clears are on screen');
  }
  // 7.6 P1
  { const pr = PERSONAS[0], st = personaState(pr), eng = runEngine(st);
    await loadState(p, stateOf(st), '#courses');
    // a route's sections are headed by their route band (.rb-h); the "Next:" line is gone from Courses (the Dates screen has the windows: 5.5, 5.6)
    const D = await p.eval(`(() => ({ next: !!document.querySelector('.next-line') || /(^|\\n)\\s*Next:/.test(document.getElementById('s-list').innerText), secs: [...document.querySelectorAll('#s-list .sec-h, #s-list .rb-h')].map(h => h.textContent.replace(/\\s+/g, ' ').trim()), text: document.getElementById('s-list').innerText }))()`);
    c76.ass(!D.next, 'a "Next:" line is on the Courses screen');
    c76.ass(D.secs.some(t => /^Polytechnic Foundation Programme/.test(t)), 'no PFP section: ' + JSON.stringify(D.secs));
    c76.ass(D.secs.some(t => /^Via ITE \(DPP\)/.test(t)), 'no "Via ITE (DPP)" section: ' + JSON.stringify(D.secs));
    c76.ass(!/3-year Higher Nitec|JIE 'N'|NAFA/.test(D.text.replace(/Not an MOE app[\s\S]*$/, '')), 'a route the student did not pick shows');
  }
  // 7.7 there is no footer on any tab; the snapshot date is in About, behind the "i" in the top bar, with the other five things: "Not an MOE app", "About these numbers", MOE's table and note as links,
  // "Saved on this device only", the sources
  { await loadState(p, state({ year: 2026, level: 'O', rows: [] }), '#courses');
    for (const h of ['#input', '#courses', '#starred', '#dates']) {
      await p.eval(`location.hash = '${h}'; 1`); await sleep(150);
      c77.eq(await p.eval(`!!document.querySelector('.foot')`), false, 'a footer on ' + h);
    }
    c77.ass(await p.eval(`!!document.querySelector('.topbar [data-do="about-open"]')`), 'no "i" button in the top bar');
    await p.eval(`(document.querySelector('[data-do="about-open"]') || { click() {} }).click(); 1`); await sleep(200);
    const ab = await p.eval(`(() => { const sh = document.getElementById('sheet'); return { open: !sh.hidden, text: sh.innerText.replace(/\\s+/g, ' ').trim(), links: [...sh.querySelectorAll('a[href]')].map(a => a.textContent.trim() + ' | ' + a.getAttribute('href')), label: ((document.querySelector('[data-do="about-open"]') || {}).getAttribute('aria-label') || (document.querySelector('[data-do="about-open"]') || {}).textContent || '').trim() }; })()`);
    const d = new Date(SNAPSHOT + 'T12:00:00Z');
    c77.ass(ab.open, 'the "i" does not open About');
    c77.ass(ab.text.indexOf(d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear()) >= 0, 'About does not name the snapshot date ' + SNAPSHOT + ': "' + ab.text.slice(0, 160) + '"');
    [/Not an MOE app/, /About these numbers/, /Saved on this device only/, /CourseFinder and SchoolFinder/].forEach(re => c77.ass(re.test(ab.text), 'About lacks ' + re + ': "' + ab.text.slice(0, 200) + '"'));
    c77.ass(ab.links.filter(l => /moe\.gov\.sg/.test(l)).length >= 2, 'About has fewer than two MOE links (MOE\'s table and MOE\'s note): ' + JSON.stringify(ab.links));
    c77.ass(ab.label.length > 0, 'the "i" button has no label');
    await p.eval(`(document.querySelector('#sheet [data-do="sheet-close"]') || { click() {} }).click(); 1`); await sleep(80);
  }
  await p.close();
}


// ================================================================================================ 4.6 an unpicked route in the sheets, the map and the Dates screen
// the IB-only table of a JC section: after the main table, headed "IB · ...", rows by their own gap (FIX_r3 item 2)
const IB_TABLE = secId => `(() => { const sec = document.getElementById('sec-${secId}'); const ib = sec && sec.querySelector('.jct.jct-ib'); if (!ib) return null;
  const main = sec.querySelector('.jct:not(.jct-ib)');
  return { head: ((ib.querySelector('.jct-grp') || {}).textContent || '').replace(/\\s+/g, ' ').trim(), titles: [...ib.querySelectorAll('.jct-r')].map(r => r.querySelector('.cc-title').textContent), divs: ib.querySelectorAll('.jct-div').length,
    after: !main || !!(main.compareDocumentPosition(ib) & Node.DOCUMENT_POSITION_FOLLOWING) }; })()`;
async function check46() {
  const c = check(4, '4.6', 'the Filter sheet (Field and Institution, behind the toolbar), the Map and the Dates screen list only the picked routes; a polytechnic list holds only polytechnics');
  const POLYS = new Set(ROWS.filter(r => r.institution_type === 'Polytechnic').map(r => r.institution));
  const ITES = new Set(ROWS.filter(r => r.institution_type === 'ITE').map(r => r.institution));
  const JCS = new Set(ROWS.filter(r => r.institution_type === 'JC' || r.institution_type === 'MI').map(r => r.institution));
  const POLY_FIELDS = new Set(ROWS.filter(r => r.institution_type === 'Polytechnic').map(r => r.field_of_study));
  const ITE_ONLY_FIELDS = new Set(ROWS.filter(r => r.institution_type === 'ITE').map(r => r.field_of_study).filter(f => !POLY_FIELDS.has(f)));
  const subs = {
    O: PERSONAS[1].subs, 'N(A)': PERSONAS[0].subs, G3: PERSONAS[2].subs
  };
  const scenarios = [
    { n: 'O-Level, JC + Polytechnic', year: 2026, level: 'O', where: ['jc', 'poly'], bad: /\bITE\b|JIE|NAFA|LASALLE|NFP|DPP/, allowedLegends: ['Junior colleges', 'Polytechnics'] },
    { n: 'N(A), Polytechnic', year: 2026, level: 'N(A)', where: ['poly'], bad: /NAFA|LASALLE|NFP|JIE 'N'|JIE 'E'|3-year|ITE Early/, allowedLegends: ['Polytechnics'] },
    { n: '2027 SEC, JC + Polytechnic', year: 2027, level: 'G3', where: ['jc', 'poly'], bad: /\bITE\b|NAFA|LASALLE|Arts institutions/, allowedLegends: ['Junior colleges', 'Polytechnics'] }
  ];
  const p = await openPage(null, { width: 1280, height: 900 });
  for (const sc of scenarios) {
    const st = state({ year: sc.year, level: sc.level, cca: 'Good', where: sc.where, rows: subs[sc.level].map(x => row(...x)), reach: true });
    await loadState(p, st, '#courses');
    const tag = sc.n + ': ';
    // the Filter sheet behind the toolbar holds the Field list and the Institution list (the old Field and Institution sheets are gone)
    await p.eval(`document.querySelector('[data-do="sheet-filter"]').click(); 1`); await sleep(120);
    const legends = await p.eval(`[...document.querySelectorAll('#sheet fieldset.inst-group')].map(f => ({ name: f.querySelector('legend').textContent, items: [...f.querySelectorAll('li label span[data-wc="0"]')].map(x => x.textContent) }))`);
    legends.forEach(g => {
      c.ass(sc.allowedLegends.includes(g.name), tag + 'the Filter sheet has an institution group for a route that was not picked: "' + g.name + '"');
      if (g.name === 'Polytechnics') { const bad = g.items.filter(x => !POLYS.has(x)); c.ass(!bad.length, tag + 'the Filter sheet lists ' + bad.join(', ') + ' under Polytechnics'); }
      if (g.name === 'Junior colleges') { const bad = g.items.filter(x => !JCS.has(x)); c.ass(!bad.length, tag + 'the Filter sheet lists ' + bad.join(', ') + ' under Junior colleges'); }
    });
    const heads = await p.eval(`[...document.querySelectorAll('#sheet .fs-h')].map(x => x.textContent.trim())`);
    c.eq(heads, ['Field', 'Institution'], tag + 'the Filter sheet\'s two parts');
    const fields = await p.eval(`[...document.querySelectorAll('#sheet .sheet-body > ul.checklist li label')].map(x => x.textContent.replace(/\\s+\\d+$/, '').trim())`);
    const leak = fields.filter(f => ITE_ONLY_FIELDS.has(f));
    c.ass(fields.length > 0 && !leak.length, tag + 'the Field list offers ITE-only fields although ITE was not picked: ' + leak.join(', '));
    await p.eval(`(document.querySelector('#sheet [data-do="sheet-close"]')||{click(){}}).click(); 1`); await sleep(80);
    // the map
    await p.eval(`location.hash = '#map'; 1`); await sleep(200);
    const mapNames = await p.eval(`[...document.querySelectorAll('.inst-list .inst-btn span[data-wc="0"]')].map(x => x.textContent)`);
    const bad = mapNames.filter(n => ITES.has(n) && !sc.where.includes('ite') && !(sc.year === 2026 && sc.level === 'N(A)'));
    c.ass(!bad.length, tag + 'the Map lists ITE colleges although ITE was not picked: ' + bad.join(', '));
    const badArts = mapNames.filter(n => /NAFA|LASALLE/.test(n));
    c.ass(!badArts.length, tag + 'the Map lists arts institutions: ' + badArts.join(', '));
    if (sc.level === 'N(A)') { const ite = mapNames.filter(n => ITES.has(n)); if (ite.length) c.note(tag + 'the Map shows ITE colleges (' + ite.join(', ') + ') because the polytechnic route includes "Via ITE (DPP)" cards'); }
    // the Dates screen
    await p.eval(`location.hash = '#dates'; 1`); await sleep(150);
    const D = await p.eval(DATES_DOM);
    D.months.flatMap(m => m.items.filter(i => /ag-item/.test(i.cls))).filter(it => !/polytechnic or ITE/.test(it.title)).forEach(it => c.ass(!sc.bad.test(it.title), tag + 'the Dates screen lists "' + it.title + '" although its route was not picked'));
    // the "Another route" line names routes the student did not pick
    await p.eval(`location.hash = '#courses'; 1`); await sleep(150);
    const another = await p.eval(`(document.querySelector('#s-list .another') || {}).textContent || ''`);
    if (another && /JIE|ITE|Nitec|NAFA/.test(another)) c.note(tag + 'the "Another route" line still names a route that was not picked: "' + wsp(another) + '"');
  }
  // 4.9 the JC table: caption rows "Within reach" (+2 or more) and "Borderline" (-1 to +1) by the picked stream's gap, each group most competitive (lowest gap) first;
  // the "Out of reach" rows (-2 or less) sit in the fold after them; no "Your net ..." divider; IB-only schools in their own table(s) after, by their own gap
  const c49 = check(4, '4.9', 'the JC table groups its rows under "Within reach" / "Borderline" captions by the picked stream\'s gap, lowest gap first inside each group, the "Out of reach" rows after them (fold), no "Your net" divider; IB-only schools in their own table after; the Arts | Science toggle changes the order');
  const ranked = (list, gapOf, titleOf) => list.slice().sort((a, b) => { const ga = gapOf(a), gb = gapOf(b), ra = ga >= 2 ? 0 : ga >= -1 ? 1 : 2, rb = gb >= 2 ? 0 : gb >= -1 ? 1 : 2; return ra - rb || ga - gb || (titleOf(a).toLowerCase() < titleOf(b).toLowerCase() ? -1 : 1); });
  const TABLES = secId => `(() => { const sec = document.getElementById('sec-${secId}'); if (!sec) return null; const out = [];
    sec.querySelectorAll('.jct').forEach(t => { const ib = t.classList.contains('jct-ib'); let cap = ''; const prev = t.previousElementSibling, fold = !!(prev && prev.classList && prev.classList.contains('btn-more'));
      [...t.children].forEach(el => { if (el.classList.contains('jct-gh') || el.classList.contains('jct-grp')) { cap = el.textContent.replace(/\\s+/g, ' ').trim(); out.push({ cap, ib, fold, head: true }); }
        else if (el.classList.contains('jct-div')) out.push({ div: el.textContent.replace(/\\s+/g, ' ').trim(), ib });
        else if (el.classList.contains('jct-r')) out.push({ title: el.querySelector('.cc-title').textContent, cap, ib, fold }); }); });
    return out; })()`;
  for (const [pr, secId, aggId] of [[PERSONAS[1], 'jc', 'L1R5(2026)'], [PERSONAS[7], 'jc', 'L1R5(2026)'], [PERSONAS[2], 'pjc', 'L1R4(2027)']]) {
    const st = personaState(pr), Fx = facts(pr);
    for (const stream of ['Arts', 'Science']) {
      await loadState(p, Object.assign(stateOf(st), { jcSort: stream }), '#courses');
      await p.eval(OPEN); await p.eval(OPEN_FOLDS);
      const rows = await p.eval(TABLES(secId));
      const tag = pr.id + ' ' + stream + ' (' + (st.year === 2027 ? '2027' : '2026') + '): ';
      if (!rows) { c49.fail(tag + 'no JC table'); continue; }
      const cand = Fx.cards.filter(c => c.sec === secId).map(c => ({ c, o: c.offs.find(o => o.label === stream) })).filter(x => x.o && x.o.x.state !== 'no' && x.o.x.n != null);
      const want = ranked(cand, x => x.o.x.n, x => x.c.title);
      const gotRows = rows.filter(r => r.title && !r.ib);
      c49.eq(gotRows.map(r => r.title), want.map(x => x.c.title), tag + 'row order: Within reach, Borderline, then the Out of reach fold, lowest gap first inside each group');
      want.forEach(x => { const r = gotRows.find(g => g.title === x.c.title); if (!r) return; const g = marginGroup(x.o.x.n);
        if (g === 'Out of reach') c49.ass(r.fold, tag + x.c.title + ' (gap ' + x.o.x.n + ') should be in the Out of reach fold');
        else c49.ass(!r.fold && r.cap === g, tag + x.c.title + ' (gap ' + x.o.x.n + ') sits under "' + r.cap + '", expected "' + g + '"'); });
      c49.ass(!rows.some(r => r.div), tag + 'a "Your net ..." divider is still in the table: ' + JSON.stringify(rows.filter(r => r.div)));
      // IB-only schools: their own table(s) after the stream table, by their own gap, grouped the same way; never rows of the stream table
      const ibCards = Fx.cards.filter(c => c.sec === secId && c.offs.every(o => o.label !== 'Arts' && o.label !== 'Science') && c.offs.some(o => o.x.state !== 'no' && o.x.n != null));
      const ibGap = c => Math.max(...c.offs.filter(o => o.x.n != null).map(o => o.x.n));
      const ibWant = ranked(ibCards, ibGap, c => c.title).map(c => c.title);
      const ibGot = rows.filter(r => r.title && r.ib).map(r => r.title);
      c49.ass(!gotRows.some(r => ibCards.some(c => c.title === r.title)), tag + 'an IB-only school is a row of the stream table');
      c49.eq(ibGot, ibWant, tag + 'IB-only schools by their own gap');
      if (ibCards.length) c49.ass(rows.some(r => r.ib && r.head && /^IB\b/.test(r.cap)), tag + 'no "IB · ..." heading over the IB table');
      // the same on a phone (375 px)
      const q = await openPage(null, { width: 375, height: 900 });
      await loadState(q, Object.assign(stateOf(st), { jcSort: stream }), '#courses');
      await q.eval(OPEN); await q.eval(OPEN_FOLDS);
      const rows2 = await q.eval(TABLES(secId)); await q.close();
      if (rows2) { c49.eq(rows2.filter(r => r.title && !r.ib).map(r => r.title), want.map(x => x.c.title), tag + 'row order at 375 px'); c49.ass(!rows2.some(r => r.div), tag + 'a divider at 375 px'); c49.eq(rows2.filter(r => r.title && r.ib).map(r => r.title), ibWant, tag + 'IB-only schools at 375 px'); }
    }
  }
  await p.close();
}

//@@RUN@@
// ================================================================================================ run
function report() {
  const rows = CHECKS.slice().sort((a, b) => a.group - b.group || String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
  const pass = rows.filter(c => !c.bad.length && c.items > 0).length;
  const empty = rows.filter(c => c.items === 0);
  const w = Math.max(...rows.map(c => c.id.length));
  console.log('\n=== qa_data: ' + URL0 + ' ===');
  console.log('check'.padEnd(w) + '  result  items  failed  what');
  rows.forEach(c => console.log(c.id.padEnd(w) + '  ' + (c.items === 0 ? 'EMPTY ' : c.bad.length ? 'FAIL  ' : 'pass  ') + String(c.items).padStart(5) + '  ' + String(c.bad.length).padStart(6) + '  ' + c.name));
  const share = rows.length ? pass / rows.length : 0;
  console.log('\nchecks passing: ' + pass + ' of ' + rows.length + ' = ' + (share * 100).toFixed(1) + '%' + (empty.length ? '  (' + empty.length + ' checks matched nothing: ' + empty.map(c => c.id).join(', ') + ')' : ''));
  rows.filter(c => c.bad.length).forEach(c => {
    console.log('\n--- ' + c.id + ' ' + c.name + ': ' + c.bad.length + ' failure(s) ---');
    c.bad.slice(0, 12).forEach(m => console.log('  ' + m));
    if (c.bad.length > 12) console.log('  ... and ' + (c.bad.length - 12) + ' more');
  });
  console.log('');
  INFO.forEach(i => console.log('info  ' + i.k + ': ' + i.v));
  rows.filter(c => c.notes.length).forEach(c => c.notes.forEach(n => console.log('note  ' + c.id + ': ' + n)));
  return { pass, total: rows.length, share, rows };
}

let exitCode = 0;
try {
  if (want(1)) await check1();
  if (want(2) || want(4) || want(1) || want(3)) { if (want(2) || want(4)) await runStudents(); }
  if (want(3)) await check3();
  if (want(5)) await check5();
  if (want(6)) await check6();
  if (want(4) || ONLY.includes('4.6')) await check46();
  if (want(7) && typeof check7 === 'function') await check7();
  if (TRUTH_OUT && typeof writeTruth === 'function') writeTruth(TRUTH_OUT);
  const rep = report();
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ url: URL0, seed: SEED, students: N_STUDENTS, today: TODAY, score: rep.share, passed: rep.pass, total: rep.total,
    checks: rep.rows.map(c => ({ id: c.id, name: c.name, items: c.items, failed: c.bad.length, bad: c.bad.slice(0, 40), notes: c.notes })), info: INFO }, null, 1));
  exitCode = rep.pass === rep.total ? 0 : 1;
} catch (e) {
  console.error('qa_data crashed:', e && e.stack || e);
  exitCode = 2;
} finally {
  browser.close();
  await sleep(500);
  try {
    if (!TMP_GIVEN) fs.rmSync(process.env.PSE_TMP, { recursive: true, force: true });
    else fs.readdirSync(process.env.PSE_TMP).filter(d => !PROFILES_BEFORE.has(d) && /^pse-cdp-/.test(d)).forEach(d => fs.rmSync(path.join(process.env.PSE_TMP, d), { recursive: true, force: true }));
  } catch (e) { /* a profile still in use: left for the next run */ }
}
process.exit(exitCode);
