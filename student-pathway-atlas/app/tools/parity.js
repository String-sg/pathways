#!/usr/bin/env node
/*
 * Parity harness, JavaScript side: runs app/src/pse_core.js on the students app/tools/parity.py wrote to
 * app/tools/_parity/ and compares every field with the Python output.
 *
 *   python3 app/tools/parity.py && node app/tools/parity.js
 *   node app/tools/parity.js --limit 2000          first 2,000 students only
 *   node app/tools/parity.js --data path/to/data.json --examples 5
 *   node app/tools/parity.js --core path/to/other/pse_core.js     (e.g. to prove the harness catches a planted bug)
 *   node app/tools/parity.js --clean      delete the shards (~400 MB) after a run with 0 differences
 *
 * Compared per student: checkInputs (every field), computeAll (every Result field; input_problems against the one
 * list Python stored), compute(one random id), and for the matcher subset match on every course (requirement key,
 * exercise, stream, eligible, aggregate id, gross, net, each reason's id and met flag, each MER line's met flag),
 * match(subset of exercises) for some, and the full matchReport (every CourseResult field) for the first ones.
 * Differences are grouped by aggregate (or exercise + aggregate) and field path; the report goes to stdout and to
 * _parity/report.json. Exit code 1 when anything differs. No npm packages.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');

const HERE = __dirname;
const APP = path.dirname(HERE);
const args = process.argv.slice(2);
function arg(name, dflt) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
}
const DATA = arg('--data', path.join(APP, 'build', 'data.json'));
const DIR = arg('--dir', path.join(HERE, '_parity'));
const LIMIT = Number(arg('--limit', 'Infinity'));
const EXAMPLES = Number(arg('--examples', '3'));

const CORE = arg('--core', path.join(APP, 'src', 'pse_core.js'));
const PSE = require(path.resolve(CORE));
PSE.load(JSON.parse(fs.readFileSync(DATA, 'utf8')));

const stats = {students: 0, check_inputs: 0, results: 0, compute: 0, match_students: 0, course_results: 0,
               match_subset_runs: 0, full_match_students: 0, full_course_results: 0, leaf_comparisons: 0,
               differences: 0};
const groups = new Map();

function plain(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }

function addDiff(group, where, py, js, student) {
  stats.differences += 1;
  let g = groups.get(group);
  if (!g) { g = {group, count: 0, students: new Set(), examples: []}; groups.set(group, g); }
  g.count += 1;
  g.students.add(student);
  if (g.examples.length < EXAMPLES) g.examples.push({student, where, python: py, js});
}

function label(el, i) {
  if (el && typeof el === 'object' && !Array.isArray(el)) {
    if (typeof el.id === 'string') return el.id;
    if (typeof el.slot === 'string') return el.slot;
  }
  return '*';
}

/** Deep compare; `gpath` is the generalised path used for grouping, `where` the exact one. */
function cmp(py, js, groupPrefix, gpath, where, student) {
  if (py === null || typeof py !== 'object' || js === null || typeof js !== 'object') {
    stats.leaf_comparisons += 1;
    if (!(py === js || (typeof py === 'number' && typeof js === 'number' && Object.is(py + 0, js + 0)))) {
      addDiff(groupPrefix + ' :: ' + (gpath || '(value)'), where, py, js, student);
    }
    return;
  }
  if (Array.isArray(py) !== Array.isArray(js)) {
    stats.leaf_comparisons += 1;
    addDiff(groupPrefix + ' :: ' + gpath + ' (type)', where, py, js, student);
    return;
  }
  if (Array.isArray(py)) {
    stats.leaf_comparisons += 1;
    if (py.length !== js.length) addDiff(groupPrefix + ' :: ' + gpath + '.length', where, py.length, js.length, student);
    const n = Math.min(py.length, js.length);
    for (let i = 0; i < n; i++) {
      cmp(py[i], js[i], groupPrefix, gpath + '[' + label(py[i], i) + ']', where + '[' + i + ']', student);
    }
    return;
  }
  const keys = new Set(Object.keys(py).concat(Object.keys(js)));
  for (const k of keys) {
    const sub = gpath ? gpath + '.' + k : k;
    if (!(k in js)) { stats.leaf_comparisons += 1; addDiff(groupPrefix + ' :: ' + sub + ' (missing in JS)', where + '.' + k, py[k], undefined, student); continue; }
    if (!(k in py)) { stats.leaf_comparisons += 1; addDiff(groupPrefix + ' :: ' + sub + ' (extra in JS)', where + '.' + k, undefined, js[k], student); continue; }
    cmp(py[k], js[k], groupPrefix, sub, where + '.' + k, student);
  }
}

function compact(results) {
  return results.map((d) => [d.requirement_key, d.exercise, d.stream, d.eligible, d.aggregate_id, d.gross, d.net,
    d.reasons.map((x) => [x.id, x.met, (x.lines || []).map((l) => l.met)])]);
}

function cmpCompact(py, js, scope, student) {
  stats.leaf_comparisons += 1;
  if (py.length !== js.length) addDiff(scope + ' :: course count', scope, py.length, js.length, student);
  const names = ['requirement_key', 'exercise', 'stream', 'eligible', 'aggregate_id', 'gross', 'net'];
  for (let i = 0; i < Math.min(py.length, js.length); i++) {
    const p = py[i];
    const j = js[i];
    const g = scope + ' ' + p[1] + ' ' + p[4];
    names.forEach((n, k) => cmp(p[k], j[k], g, n, p[0] + '.' + n, student));
    stats.leaf_comparisons += 1;
    if (p[7].length !== j[7].length) addDiff(g + ' :: reasons.length', p[0], p[7].length, j[7].length, student);
    for (let r = 0; r < Math.min(p[7].length, j[7].length); r++) {
      const rid = p[7][r][0];
      cmp(p[7][r][0], j[7][r][0], g, 'reasons[' + r + '].id', p[0] + '.reasons[' + r + ']', student);
      cmp(p[7][r][1], j[7][r][1], g, 'reason ' + rid + '.met', p[0] + '.' + rid + '.met', student);
      cmp(p[7][r][2], j[7][r][2], g, 'reason ' + rid + '.lines[].met', p[0] + '.' + rid + '.lines', student);
    }
  }
}

function runStudent(rec) {
  const s = rec.i;
  const subjects = rec.subjects;
  const bonus = rec.bonus;
  stats.students += 1;

  cmp(rec.check_inputs, plain(PSE.checkInputs(subjects)), 'checkInputs', '', 'check_inputs', s);
  stats.check_inputs += 1;

  const all = plain(PSE.computeAll(subjects, bonus));
  stats.leaf_comparisons += 1;
  if (all.length !== rec.results.length) addDiff('computeAll :: result count', 'results', rec.results.length, all.length, s);
  for (let k = 0; k < Math.min(all.length, rec.results.length); k++) {
    const py = rec.results[k];
    const js = all[k];
    cmp(py.id, js.id, 'computeAll', 'id (order)', 'results[' + k + '].id', s);
    cmp(rec.problems, js.input_problems, py.id, 'input_problems', 'results[' + k + '].input_problems', s);
    delete js.input_problems;
    cmp(py, js, py.id, '', 'results[' + k + ']', s);
    stats.results += 1;
  }

  const c = rec.compute;
  cmp(c.result, plain(PSE.compute(c.id, subjects, bonus)), 'compute ' + c.id, '', 'compute', s);
  stats.compute += 1;

  if (rec.match_report) {
    const rep = plain(PSE.matchReport(subjects, bonus));
    const pyRes = rec.match_report.results;
    const jsRes = rep.results;
    const top = Object.assign({}, rec.match_report, {results: null});
    cmp(top, Object.assign({}, rep, {results: null}), 'matchReport', '', 'match_report', s);
    stats.leaf_comparisons += 1;
    if (pyRes.length !== jsRes.length) addDiff('matchReport :: results.length', 'results', pyRes.length, jsRes.length, s);
    for (let k = 0; k < Math.min(pyRes.length, jsRes.length); k++) {
      cmp(pyRes[k], jsRes[k], 'matchReport ' + pyRes[k].exercise + ' ' + pyRes[k].aggregate_id, '',
          'match_report.results[' + k + '] ' + pyRes[k].requirement_key, s);
    }
    stats.full_match_students += 1;
    stats.full_course_results += pyRes.length;
  }
  if (rec.match_compact) {
    const js = rec.match_report ? null : compact(plain(PSE.match(subjects, bonus)));
    cmpCompact(rec.match_compact, js || compact(plain(PSE.match(subjects, bonus))), 'match', s);
    stats.match_students += 1;
    stats.course_results += rec.match_compact.length;
  }
  if (rec.match_compact_ex) {
    cmpCompact(rec.match_compact_ex, compact(plain(PSE.match(subjects, bonus, rec.match_exercises))),
               'match[' + rec.match_exercises.join(',') + ']', s);
    stats.match_subset_runs += 1;
  }
}

async function main() {
  const t0 = Date.now();
  const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
  let stop = false;
  for (const shard of manifest.shards) {
    if (stop) break;
    const rl = readline.createInterface({input: fs.createReadStream(path.join(DIR, shard)).pipe(zlib.createGunzip()),
                                         crlfDelay: Infinity});
    for await (const line of rl) {
      if (!line) continue;
      if (stats.students >= LIMIT) { stop = true; break; }
      const rec = JSON.parse(line);
      try {
        runStudent(rec);
      } catch (e) {
        addDiff('exception :: ' + String(e && e.message).slice(0, 120), 'student ' + rec.i, null, String(e && e.stack), rec.i);
      }
    }
    rl.close();
  }
  const out = Object.assign({}, stats, {
    seconds: Math.round((Date.now() - t0) / 100) / 10, data: path.relative(APP, DATA), python_digest: manifest.python_digest,
    engine_version: PSE.versions().engine, matcher_version: PSE.versions().matcher,
    groups: Array.from(groups.values()).sort((a, b) => b.count - a.count).map((g) => ({
      group: g.group, count: g.count, students: g.students.size, examples: g.examples}))
  });
  fs.writeFileSync(path.join(DIR, 'report.json'), JSON.stringify(out, null, 1));
  console.log('students %d | computeAll results %d | compute %d | checkInputs %d', stats.students, stats.results,
              stats.compute, stats.check_inputs);
  console.log('matcher: %d students x every course = %d course results (+ %d exercise-subset runs); full matchReport on %d students (%d course results)',
              stats.match_students, stats.course_results, stats.match_subset_runs, stats.full_match_students,
              stats.full_course_results);
  console.log('leaf comparisons %d | differences %d | %ss', stats.leaf_comparisons, stats.differences, out.seconds);
  out.groups.slice(0, 40).forEach((g) => {
    console.log('\n%d x %s  (%d students)', g.count, g.group, g.students);
    g.examples.forEach((e) => console.log('   student %d %s\n     py: %s\n     js: %s', e.student, e.where,
      JSON.stringify(e.python === undefined ? '(missing)' : e.python).slice(0, 400),
      JSON.stringify(e.js === undefined ? '(missing)' : e.js).slice(0, 400)));
  });
  if (out.groups.length > 40) console.log('\n... %d more groups in _parity/report.json', out.groups.length - 40);
  if (args.indexOf('--clean') >= 0 && !stats.differences && stats.students === manifest.students) {
    manifest.shards.forEach((f) => fs.unlinkSync(path.join(DIR, f)));
    console.log('\n0 differences: deleted the %d shards (manifest.json and report.json kept)', manifest.shards.length);
  }
  process.exitCode = stats.differences ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 2; });
