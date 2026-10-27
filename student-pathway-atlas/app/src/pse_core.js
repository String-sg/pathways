/*
 * SG PSE Atlas - pse_core.js
 *
 * The aggregate engine and the course matcher, ported from Python so a
 * single-file HTML app can run them on a phone. One dependency-free file: plain ES2017, no modules, no build step.
 * In a browser it sets `window.PSE`; in Node `module.exports`.
 *
 *   PSE.load({definitions, requirements, courses})      the JSON the app inlines (app/build/data.json); no file or
 *                                                        network access in this file
 *   PSE.checkInputs(subjects)                           {entries, input_problems, warnings}
 *   PSE.computeAll(subjects, bonusInputs, ids?)         [Result, ...] (+ the 5th-year summary when ids is omitted)
 *   PSE.compute(id, subjects, bonusInputs)              one Result
 *   PSE.match(subjects, bonusInputs, exercises?)        [CourseResult, ...]
 *   PSE.matchReport(subjects, bonusInputs, exercises?)  {engine_version, matcher_version, input_problems, warnings,
 *                                                        summary, results}
 *
 * Inputs and result fields are the Python ones, snake_case, so one harness compares both (app/tools/parity.*).
 * Every rule comes from the data: engine/definitions.json (levels, grades, scales, subjects, name matching, groups,
 * definitions, the 5th-year summary) and matcher/requirements.json (exercises, streams, gates, course MER). What is
 * left in this file is the search and the wording of reasons; where the Python hard-codes something that is not
 * data, the line says which Python line it mirrors.
 *
 * Python behaviour reproduced on purpose: truthiness (`or`, `if x`), str/repr of input values in messages,
 * int of a year, float of a mark, str.split/strip whitespace (incl. \x1c-\x1f, \x85), and the regexes
 * exported as Python patterns (pyRe). One known limit: JSON cannot tell 72 from 72.0, so a float that is a whole
 * number prints as "72" where Python prints "72.0".
 */
(function (root, factory) {
  var PSE = factory();
  if (typeof module === 'object' && module && module.exports) {
    module.exports = PSE;
  } else {
    root.PSE = PSE;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ============================================================================================ Python compatibility
  // Python's str.isspace set: what str.split, str.strip and re's \s treat as whitespace.
  var WS = '\\t\\n\\x0b\\x0c\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
  var RE_WS = new RegExp('[' + WS + ']+');
  var RE_LSTRIP = new RegExp('^[' + WS + ']+');
  var RE_RSTRIP = new RegExp('[' + WS + ']+$');

  function strip(s) { return s.replace(RE_LSTRIP, '').replace(RE_RSTRIP, ''); }
  function wsSplit(s) { return s.split(RE_WS).filter(function (p) { return p !== ''; }); }
  function replaceAll(s, a, b) { return s.split(a).join(b); }
  function isNone(v) { return v === null || v === undefined; }
  function hasOwn(o, k) { return o !== null && o !== undefined && Object.prototype.hasOwnProperty.call(o, k); }
  /** dict.get(key, default): the value when the key exists (even null), else the default (null). */
  function get(o, k, dflt) { return hasOwn(o, k) ? (o[k] === undefined ? null : o[k]) : (dflt === undefined ? null : dflt); }

  function truthy(v) {
    if (isNone(v)) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;  // NaN is truthy in Python
    if (typeof v === 'string' || Array.isArray(v)) return v.length > 0;
    if (v instanceof Set || v instanceof Map) return v.size > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  }

  function hex(n, w) { var s = n.toString(16); while (s.length < w) s = '0' + s; return s; }

  var RE_NONPRINT = (function () {
    try { return new RegExp('[\\p{Cc}\\p{Cf}\\p{Cs}\\p{Co}\\p{Cn}\\p{Zl}\\p{Zp}\\p{Zs}]', 'u'); } catch (e) { return null; }
  }());

  /** str.isprintable for one code point (falls back to the common cases on engines without \p{}). */
  function printable(ch, cp) {
    if (cp === 0x20) return true;
    if (RE_NONPRINT) return !RE_NONPRINT.test(ch);
    return !(cp < 0x20 || (cp >= 0x7f && cp <= 0xa0) || cp === 0xad || cp === 0x1680 ||
             (cp >= 0x2000 && cp <= 0x200f) || (cp >= 0x2028 && cp <= 0x202f) || (cp >= 0x205f && cp <= 0x206f) ||
             cp === 0x3000 || cp === 0xfeff || (cp >= 0xd800 && cp <= 0xf8ff) || (cp >= 0xfff9 && cp <= 0xfffb));
  }

  function reprStr(s) {
    var q = (s.indexOf("'") >= 0 && s.indexOf('"') < 0) ? '"' : "'";
    var out = q;
    for (var i = 0; i < s.length; i++) {
      var cp = s.codePointAt(i);
      var ch = String.fromCodePoint(cp);
      if (cp > 0xffff) i++;
      if (ch === q || ch === '\\') out += '\\' + ch;
      else if (ch === '\t') out += '\\t';
      else if (ch === '\n') out += '\\n';
      else if (ch === '\r') out += '\\r';
      else if (cp < 0x20 || cp === 0x7f) out += '\\x' + hex(cp, 2);
      else if (cp < 0x7f) out += ch;
      else if (!printable(ch, cp)) out += cp <= 0xff ? '\\x' + hex(cp, 2) : (cp <= 0xffff ? '\\u' + hex(cp, 4) : '\\U' + hex(cp, 8));
      else out += ch;
    }
    return out + q;
  }

  function pyNum(v) {
    if (v !== v) return 'nan';
    if (v === Infinity) return 'inf';
    if (v === -Infinity) return '-inf';
    return String(v);
  }

  /** repr of a JSON value. */
  function pyRepr(v) {
    if (typeof v === 'string') return reprStr(v);
    if (Array.isArray(v)) return '[' + v.map(pyRepr).join(', ') + ']';
    if (v !== null && typeof v === 'object') {
      return '{' + Object.keys(v).map(function (k) { return reprStr(k) + ': ' + pyRepr(v[k]); }).join(', ') + '}';
    }
    return pyStr(v);
  }

  /** str of a JSON value (what "%s" prints). */
  function pyStr(v) {
    if (isNone(v)) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return pyNum(v);
    return pyRepr(v);
  }

  /** int(year) as engine/engine.py prepare_entries calls it; null where Python raises ValueError / TypeError. */
  function pyIntOrNull(v) {
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'number') return isFinite(v) ? (v < 0 ? Math.ceil(v) : Math.floor(v)) + 0 : null;
    if (typeof v === 'string') {
      var s = strip(v);
      if (/^[+-]?[0-9]+(?:_[0-9]+)*$/.test(s)) return parseInt(replaceAll(s, '_', ''), 10);
      return null;
    }
    return null;
  }

  /** float(mark) (engine/grades.py mark_to_grade). Python raises on anything else, so does this. */
  function pyFloat(v) {
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'string') {
      var s = strip(v);
      var D = '[0-9](?:_?[0-9])*';
      if (new RegExp('^[+-]?(?:' + D + '(?:\\.(?:' + D + ')?)?|\\.' + D + ')(?:[eE][+-]?' + D + ')?$').test(s)) {
        return parseFloat(replaceAll(s, '_', ''));
      }
      var m = /^([+-]?)(inf|infinity|nan)$/i.exec(s);
      if (m) return m[2].toLowerCase() === 'nan' ? NaN : (m[1] === '-' ? -Infinity : Infinity);
    }
    throw new Error('could not convert mark to a number: ' + pyRepr(v));
  }

  /**
   * A regex exported by the Python (definitions.json) -> RegExp with Python's meaning: \s = Python whitespace,
   * '.' does not match only '\n', '$' also matches before a final '\n'. \b stays ASCII: it only meets catalogue names
   * (ASCII), where Python's Unicode \b gives the same split. Anything else Python-specific is refused, so a changed
   * export fails loudly instead of matching differently.
   */
  function pyRe(src, flags) {
    var out = '';
    var inClass = false;
    for (var i = 0; i < src.length; i++) {
      var c = src[i];
      if (c === '\\') {
        var n = src[i + 1];
        i++;
        if (n === 's') out += inClass ? WS : '[' + WS + ']';
        else if ('SwWdDAZ'.indexOf(n) >= 0) throw new Error('pse_core: Python regex escape \\' + n + ' is not ported: ' + src);
        else out += '\\' + n;
        continue;
      }
      if (inClass) {
        if (c === ']') inClass = false;
        out += c;
        continue;
      }
      if (c === '[') {
        inClass = true;
        out += c;
        if (src[i + 1] === '^') { out += '^'; i++; }
        if (src[i + 1] === ']') { out += ']'; i++; }
        continue;
      }
      if (c === '.') { out += '[^\\n]'; continue; }
      if (c === '$') { out += '(?=\\n?$)'; continue; }
      if (c === '(' && src[i + 1] === '?' && ':=!'.indexOf(src[i + 2]) < 0) {
        throw new Error('pse_core: Python regex group syntax is not ported: ' + src);
      }
      out += c;
    }
    return new RegExp(out, flags || '');
  }

  function shallow(o) { return Object.assign({}, o); }
  function cmpNum(a, b) { return a < b ? -1 : (a > b ? 1 : 0); }
  function cmpStr(a, b) { return a < b ? -1 : (a > b ? 1 : 0); }
  function cmpSeq(a, b) {
    for (var i = 0; i < a.length && i < b.length; i++) {
      var c = typeof a[i] === 'string' ? cmpStr(a[i], b[i]) : cmpNum(a[i], b[i]);
      if (c) return c;
    }
    return cmpNum(a.length, b.length);
  }
  function deepFreeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { deepFreeze(o[k]); });
    }
    return o;
  }
  /** JSON with sorted keys: the equality Python's repr(sorted(d.items)) gives on this data. */
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v !== null && typeof v === 'object') {
      return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
    }
    return JSON.stringify(v === undefined ? null : v);
  }

  // ============================================================================================ loaded data
  var S = null;

  function need(obj, key, where) {
    if (!hasOwn(obj, key)) {
      throw new Error('pse_core: ' + where + ' has no "' + key + '" - rebuild app/build/data.json ' +
                      '(python3 -m engine.export_definitions; python3 -m matcher build; python3 app/tools/build_data.py)');
    }
    return obj[key];
  }

  function requireLoaded() {
    if (S === null) throw new Error('pse_core: call PSE.load({definitions, requirements, courses}) first');
  }

  function expandCourses(courses) {
    if (isNone(courses)) return [];
    if (Array.isArray(courses)) return courses;
    var cols = need(courses, 'columns', 'courses');
    return need(courses, 'rows', 'courses').map(function (row) {
      var o = {};
      for (var i = 0; i < cols.length; i++) o[cols[i]] = row[i];
      if (Array.isArray(o.exercises)) {
        o.exercises = o.exercises.map(function (x) { return {exercise: x[0], stream: x[1], aggregate_id: x[2]}; });
      }
      return o;
    });
  }

  // Course-level fields a requirement record takes from its course row (app/tools/build_data.py checks the join).
  var COURSE_FIELDS = ['institution_type', 'institution', 'course_code', 'ite_course_code', 'course_name',
                       'field_of_study', 'stream', 'pfp_cluster', 'aggregate_type', 'net_range_2026', 'moe_url',
                       'institution_url'];

  function expandRecords(reqs, courseList) {
    var recs = need(reqs, 'records', 'requirements');
    if (!hasOwn(reqs, 'mers')) return recs;  // matcher/requirements.json as written by the matcher
    var mers = reqs.mers;
    var notes = need(reqs, 'notes', 'requirements');
    return recs.map(function (r) {
      var c = courseList[r.course];
      if (!c) throw new Error('pse_core: requirement ' + r.key + ' points at a missing course row ' + r.course);
      var o = {key: r.key, route: r.route};
      COURSE_FIELDS.forEach(function (f) { o[f] = c[f]; });
      o.is_nursing_diploma = !!r.is_nursing_diploma;
      o.mer = mers[r.mer];
      o.notes = (r.notes || []).map(function (i) { return notes[i]; });
      o.data_flags = (c.data_flags || []).concat(r.flags || []);
      if (r.application_requirements) o.application_requirements = r.application_requirements;
      o.course_id = c.id;
      return o;
    });
  }

  function load(data) {
    var defs = need(data, 'definitions', 'PSE.load input');
    var reqs = need(data, 'requirements', 'PSE.load input');
    var st = {};
    var lv = need(defs, 'levels', 'definitions');
    var lvn = need(lv, 'normalise', 'definitions.levels');
    st.levelAliases = need(lv, 'aliases', 'definitions.levels');
    st.levelSplit = lvn.split_on;
    st.levelPrefixRe = pyRe(lvn.strip_prefix_regex, 'g');
    st.levelSuffixRe = pyRe(lvn.strip_suffix_regex, 'g');
    st.gradeOrder = lv.grade_order;
    st.gradeAliases = lv.grade_aliases;
    st.gradesByKind = lv.grades_by_kind;
    st.absent = lv.absent_aliases;
    st.absentScoresAs = need(lv, 'absent_scores_as', 'definitions.levels');
    st.nonScoring = lv.non_scoring_grades;
    st.gradeStrip = need(lv, 'grade_strip_words', 'definitions.levels');
    st.markBands = need(defs, 'mark_bands', 'definitions');
    st.scales = need(defs, 'scales', 'definitions');
    st.subjects = need(defs, 'subjects', 'definitions');
    st.subjectsById = new Map();
    st.subjects.forEach(function (s) { st.subjectsById.set(s.id, s); });
    var snm = need(defs, 'subject_name_matching', 'definitions');
    var nn = need(snm, 'normalise', 'definitions.subject_name_matching');
    st.norm = {quotes: nn.quote_map, drop: nn.drop_chars, parensRe: pyRe(nn.parens_regex, 'g'),
               sepRe: pyRe(nn.separator_in_parens_regex), joiner: nn.parens_joiner, amp: nn.amp_outside_parens,
               tight: nn.tight_chars};
    st.levelSpecific = snm.level_specific_names;
    var lp = need(snm, 'level_prefix', 'definitions.subject_name_matching');
    st.levelPrefix = pyRe(lp.regex, lp.ignore_case ? 'i' : '');
    st.groups = need(defs, 'groups', 'definitions');
    st.examined = need(defs, 'examined_levels', 'definitions');
    st.defs = need(defs, 'definitions', 'definitions');
    st.defsById = new Map();
    st.defs.forEach(function (d) { st.defsById.set(d.id, d); });
    st.summary = need(defs, 'summaries', 'definitions')[0];
    st.ignoredReasons = need(defs, 'ignored_reasons', 'definitions');
    st.levelLabels = need(defs, 'level_labels', 'definitions');
    st.lepHosts = Array.isArray(data.lep_hosts) ? data.lep_hosts : [];
    st.engineVersion = defs.engine_version;
    st.exercises = need(reqs, 'exercises', 'requirements');
    st.exerciseIds = st.exercises.map(function (e) { return e.id; });
    st.matcherVersion = reqs.matcher_version;
    st.courses = expandCourses(data.courses);
    st.records = expandRecords(reqs, st.courses);
    st.acceptsCache = new WeakMap();

    var prev = S;
    S = st;
    try {
      st.aliasIndex = new Map();
      st.subjects.forEach(function (s) {
        [s.name, s.id].concat(s.aliases).forEach(function (n) {
          var k = norm(n);
          if (!st.aliasIndex.has(k)) st.aliasIndex.set(k, s.id);
        });
      });
      deepFreeze(defs);
      deepFreeze(reqs);
      deepFreeze(st.courses);
      deepFreeze(st.records);
      deepFreeze(st.lepHosts);
    } catch (e) {
      S = prev;
      throw e;
    }
    return PSE;
  }

  // ============================================================================================ grades (grades.py)
  function levelPart(part) {
    if (hasOwn(S.levelAliases, part)) return S.levelAliases[part];
    var p = part.replace(S.levelPrefixRe, '');
    p = strip(p.replace(S.levelSuffixRe, ''));
    return hasOwn(S.levelAliases, p) ? S.levelAliases[p] : null;
  }

  function normaliseLevel(level) {
    if (isNone(level)) return null;
    var key = wsSplit(strip(pyStr(level)).toUpperCase()).join(' ');
    if (!key) return null;
    if (hasOwn(S.levelAliases, key)) return S.levelAliases[key];
    var parts = key.split(S.levelSplit).map(strip).filter(function (p) { return p !== ''; });
    var found = new Set(parts.map(levelPart));
    if (!parts.length || found.has(null) || found.size !== 1) return null;
    return found.values().next().value;
  }

  function normaliseGrade(level, grade, kind) {
    if (isNone(grade)) return null;
    var raw = strip(pyStr(grade)).toUpperCase();
    var g = raw;
    for (var i = 0; i < S.gradeStrip.length; i++) g = replaceAll(g, S.gradeStrip[i], '');
    g = strip(g);
    if (S.absent.indexOf(g) >= 0) return 'ABS';  // grades.py normalise_grade: "ABS"
    var byKind = (!isNone(kind) && hasOwn(S.gradesByKind, kind)) ? S.gradesByKind[kind] : null;
    if (byKind !== null) {
      if (hasOwn(byKind.grades, raw)) return byKind.grades[raw];  // before stripping: "UNGRADED" holds "GRADE"
      if (hasOwn(byKind.grades, g)) return byKind.grades[g];
      if (truthy(get(byKind, 'only_these'))) return null;
    }
    if (S.nonScoring.indexOf(g) >= 0) return g;
    if (hasOwn(S.gradeAliases, level) && hasOwn(S.gradeAliases[level], g)) g = S.gradeAliases[level][g];
    if (hasOwn(S.gradeOrder, level) && S.gradeOrder[level].indexOf(g) >= 0) return g;
    return null;
  }

  function markToGrade(level, mark) {
    var bands = hasOwn(S.markBands, level) ? S.markBands[level] : null;
    if (bands === null || isNone(mark)) return null;
    var m = pyFloat(mark);
    for (var i = 0; i < bands.length; i++) {
      if (m >= bands[i][0]) return bands[i][1];
    }
    return bands[bands.length - 1][1];
  }

  function points(scale, level, grade) {
    if (grade === 'ABS') grade = hasOwn(S.absentScoresAs, level) ? S.absentScoresAs[level] : null;  // grades.py points
    var lv = hasOwn(scale.levels, level) ? scale.levels[level] : null;
    return (lv !== null && hasOwn(lv, grade)) ? lv[grade] : null;
  }

  function isMerUnusable(scale, level, grade) {
    var mu = get(scale, 'mer_unusable', {});
    var list = get(mu, level, []);
    return list.indexOf(grade) >= 0;
  }

  function gradeAtOrBetter(level, grade, worst) {
    var order = get(S.gradeOrder, level, []);
    var a = order.indexOf(grade);
    var b = order.indexOf(worst);
    if (a < 0 || b < 0) return false;
    return a <= b;
  }

  // ============================================================================================ subjects (subjects.py)
  function norm(name) {
    var N = S.norm;
    var s = strip(pyStr(name)).toLowerCase();
    var i;
    for (i = 0; i < N.quotes.length; i++) s = replaceAll(s, N.quotes[i][0], N.quotes[i][1]);
    for (i = 0; i < N.drop.length; i++) s = replaceAll(s, N.drop[i], '');
    s = s.replace(N.parensRe, function (whole, inner) {
      var parts = inner.split(N.sepRe).map(strip).filter(function (p) { return p !== ''; });
      return '(' + parts.join(N.joiner) + ')';
    });
    s = replaceAll(s, N.amp[0], N.amp[1]);
    s = wsSplit(s).join(' ');
    for (i = 0; i < N.tight.length; i++) {
      var ch = N.tight[i];
      s = replaceAll(replaceAll(s, ' ' + ch, ch), ch + ' ', ch);
    }
    return s;
  }

  function resolveSubject(name) {
    if (isNone(name)) return null;
    var sid = S.aliasIndex.get(norm(name));
    return sid === undefined ? null : sid;
  }

  /** -> [subject_id or null, hint or null]; hint when the name is ambiguous at this level (bare 'Science'). */
  function resolveSubjectAt(name, level) {
    if (isNone(name)) return [null, null];
    var key = norm(name);
    if (hasOwn(S.levelSpecific, key)) {
      var spec = S.levelSpecific[key];
      var sid = isNone(level) ? null : get(spec.by_level, level);
      return truthy(sid) ? [sid, null] : [null, spec.hint];
    }
    var id = S.aliasIndex.get(key);
    return [id === undefined ? null : id, null];
  }

  function group(name) {
    if (!hasOwn(S.groups, name)) throw new Error('pse_core: unknown subject group ' + name);
    return S.groups[name];
  }
  function groupMembers(name) { return group(name).members; }
  function slotMembers(name) {
    var g = group(name);
    return hasOwn(g, 'effective_members') ? g.effective_members : g.members;
  }

  // ============================================================================================ engine (engine.py)
  function Entry(idx, rawName, sid, name, known, kind, family, level, grade, year) {
    this.idx = idx;
    this.raw_name = rawName;
    this.subject_id = sid;
    this.name = name;
    this.known = known;
    this.kind = kind;
    this.family = family;
    this.level = level;
    this.grade = grade;
    this.year = year;
  }
  Entry.prototype.describe = function () {
    return {subject_id: this.subject_id, subject: this.name, input_name: this.raw_name, level: this.level,
            grade: this.grade, year: this.year};
  };

  function problem(i, name, field, value, text, action) {
    return {row: i + 1, subject: isNone(name) ? null : name, field: field, value: isNone(value) ? null : value,
            problem: text, action: action};
  }

  function blank(v) { return isNone(v) || (typeof v === 'string' && strip(v) === ''); }

  // subjects.py examined_levels / examined_text / default_level: the levels SEAB examines a subject at, by exam year.
  function examinedGroup(year) {
    if (year === null) return null;
    var gs = S.examined.groups;
    for (var i = 0; i < gs.length; i++) {
      var g = gs[i];
      if ((hasOwn(g, 'max_year') && year <= g.max_year) || (hasOwn(g, 'min_year') && year >= g.min_year)) return g;
    }
    return null;
  }

  function examinedLevels(sid, year) {
    var s = S.subjectsById.get(sid);
    var g = examinedGroup(year);
    var systems = g !== null ? g.systems : [].concat.apply([], S.examined.groups.map(function (x) { return x.systems; }));
    var lbs = get(s, 'levels_by_system') || {};
    var levels = new Set();
    systems.forEach(function (sy) { (hasOwn(lbs, sy) ? lbs[sy] : []).forEach(function (l) { levels.add(l); }); });
    if (!levels.size && truthy(get(s, 'only_level'))) levels.add(s.only_level);
    if (!levels.size) return null;
    var view;
    if (truthy(s.earlier)) {
      view = S.examined.groups.filter(function (x) { return x.id === S.examined.earlier_group; })[0];
    } else {
      view = g !== null ? g : S.examined.no_year;
    }
    return [levels, view];
  }

  function examinedText(sid, found) {
    var view = found[1];
    var names = view.order.filter(function (l) { return found[0].has(l); }).map(function (l) { return view.labels[l]; });
    var joined = names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
    var s = S.subjectsById.get(sid);
    return S.examined.text.split('{subject}').join(s.name).split('{verb}').join(truthy(s.earlier) ? 'was' : 'is')
      .split('{levels}').join(joined);
  }

  function defaultLevel(sid, year) {
    var found = examinedLevels(sid, year);
    return (found !== null && found[0].size === 1) ? Array.from(found[0])[0] : null;
  }

  /** engine.py prepare_entries: caller rows -> [entries, warnings, input_problems]. */
  function prepareEntries(rows) {
    var entries = [];
    var warnings = [];
    var problems = [];
    rows = truthy(rows) ? rows : [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var name = truthy(get(row, 'subject')) ? get(row, 'subject') : get(row, 'name');
      if (blank(name)) {
        problems.push(problem(i, name, 'subject', name, 'no subject name', 'row ignored'));
        continue;
      }
      name = pyStr(name);
      var rawLevel = get(row, 'level');
      var level = normaliseLevel(rawLevel);

      var core = name;
      var prefixLevel = null;
      var m = S.levelPrefix.exec(name);
      if (m && resolveSubject(name) === null) {
        core = m[2];
        prefixLevel = m[1].toUpperCase();
      }

      if (level === null) {
        if (!blank(rawLevel)) {
          problems.push(problem(i, name, 'level', rawLevel, 'unreadable level ' + pyRepr(rawLevel), 'row ignored'));
          continue;
        }
        if (prefixLevel) {
          level = prefixLevel;
          warnings.push('row ' + (i + 1) + ' (' + name + '): no level given - ' + level + ' taken from the subject name');
        } else {
          var sid0 = resolveSubject(core);
          var y0 = blank(get(row, 'year')) ? null : pyIntOrNull(get(row, 'year'));  // engine.py _year_hint
          var only0 = sid0 ? defaultLevel(sid0, y0) : null;
          if (only0 === null) {
            problems.push(problem(i, name, 'level', rawLevel, 'no level given', 'row ignored'));
            continue;
          }
          level = only0;
          var txt0 = examinedText(sid0, examinedLevels(sid0, y0));
          warnings.push('row ' + (i + 1) + ' (' + name + '): no level given - ' + txt0.slice(0, -1) + ', so ' + only0 +
                        ' is assumed');
        }
      } else if (prefixLevel && prefixLevel !== level) {
        problems.push(problem(i, name, 'level', rawLevel, 'level ' + level + ' contradicts the ' + prefixLevel +
                              ' in the subject name', 'level column used'));
      }

      var rawGrade = get(row, 'grade');
      if (blank(rawGrade) && get(row, 'mark') !== null) {
        rawGrade = markToGrade(level, get(row, 'mark'));
        warnings.push('row ' + (i + 1) + ' (' + name + '): grade ' + pyStr(rawGrade) + ' derived from mark ' +
                      pyStr(get(row, 'mark')) + ' using the usual school mark bands (not MOE text)');
      }
      var sidK = resolveSubjectAt(core, level)[0];
      var kind = sidK ? S.subjectsById.get(sidK).kind : null;
      var grade = normaliseGrade(level, rawGrade, kind);
      if (grade === null) {
        var msg = (kind !== null && hasOwn(S.gradesByKind, kind))
          ? 'grade ' + pyRepr(rawGrade) + ": a 'B' Syllabus is graded Merit / Pass / Ungraded"
          : 'unreadable grade ' + pyRepr(rawGrade) + ' for level ' + level;
        problems.push(problem(i, name, 'grade', rawGrade, msg, 'row ignored'));
        continue;
      }

      var year = get(row, 'year');
      if (!blank(year)) {
        var y = pyIntOrNull(year);
        if (y === null) {
          problems.push(problem(i, name, 'year', year, 'unreadable year ' + pyRepr(year), 'used for every exam year'));
        }
        year = y;
      } else {
        year = null;
      }

      var res = resolveSubjectAt(core, level);
      var sid = res[0];
      var hint = res[1];
      if (sid === null) {
        var key = 'unknown:' + wsSplit(name.toLowerCase()).join(' ');  // engine.py: "unknown:" + name
        entries.push(new Entry(i, name, key, name, false, 'OTHER', null, level, grade, year));
        problems.push(problem(i, name, 'subject', name,
                              hint ? 'ambiguous at ' + level + ': ' + hint : 'subject not in the catalogue',
                              "treated as an 'Others' subject (fills 'any subject' slots only)"));
        continue;
      }
      var s = S.subjectsById.get(sid);
      var found = examinedLevels(sid, year);  // SEAB's lists for the row's year (engine 0.1.6)
      if (found !== null && !found[0].has(level)) {
        problems.push(problem(i, name, 'level', rawLevel, examinedText(sid, found), 'kept as given'));
      }
      entries.push(new Entry(i, name, sid, s.name, true, s.kind, s.family, level, grade, year));
    }
    return [entries, warnings, problems];
  }

  /** An `accepts` spec -> Set of subject ids, or null = any subject. */
  function acceptsIds(accepts) {
    if (S.acceptsCache.has(accepts)) return S.acceptsCache.get(accepts);
    var out;
    if (truthy(get(accepts, 'any'))) {
      out = null;
    } else {
      out = new Set(get(accepts, 'subjects', []));
      get(accepts, 'groups', []).forEach(function (g) { slotMembers(g).forEach(function (m) { out.add(m); }); });
    }
    S.acceptsCache.set(accepts, out);
    return out;
  }

  function effectiveSlots(defn, alternative, slotAccepts) {
    var over = truthy(alternative) ? get(alternative, 'slot_overrides', {}) : {};
    return defn.slots.map(function (s) {
      var s2 = shallow(s);
      if (hasOwn(over, s.name)) Object.assign(s2, over[s.name]);
      if (truthy(slotAccepts) && hasOwn(slotAccepts, s.name)) s2.accepts = slotAccepts[s.name];
      return s2;
    });
  }

  function merOk(mer, scale, entry, pts) {
    if (!truthy(mer)) return true;
    if (entry.grade === 'ABS') return false;
    if (truthy(get(mer, 'exclude_mer_unusable')) && isMerUnusable(scale, entry.level, entry.grade)) return false;
    var mx = get(mer, 'max_points');
    if (mx !== null && pts > mx) return false;
    return true;
  }

  function scaleOf(name) {
    if (!hasOwn(S.scales, name)) throw new Error('pse_core: unknown scale ' + name);
    return S.scales[name];
  }

  function buildCandidates(slots, entries, excludeIds, hardMer) {
    var bySubject = new Map();
    entries.forEach(function (e) {
      if (!bySubject.has(e.subject_id)) bySubject.set(e.subject_id, []);
      bySubject.get(e.subject_id).push(e);
    });
    return slots.map(function (s) {
      var scale = scaleOf(s.scale);
      var allowed = acceptsIds(s.accepts);
      var soft = get(s, 'mer');
      var hard = (hardMer && hasOwn(hardMer, s.name)) ? get(hardMer, s.name) : null;
      var cands = [];
      bySubject.forEach(function (ents, sid) {
        if (excludeIds.has(sid)) return;
        if (allowed !== null && !allowed.has(sid)) return;
        var best = null;
        var bestKey = null;
        ents.forEach(function (e) {
          var p = points(scale, e.level, e.grade);
          if (p === null) return;
          if (hard !== null && !merOk(hard, scale, e, p)) return;
          var ok = merOk(soft, scale, e, p);
          var key = [p, ok ? 0 : 1, e.idx];
          if (best === null || cmpSeq(key, bestKey) < 0) {
            bestKey = key;
            best = {sid: sid, entry: e, points: p, mer_ok: ok, rank: 0};
          }
        });
        if (best !== null) cands.push(best);
      });
      cands.sort(function (a, b) {
        return cmpNum(a.points, b.points) || cmpNum(a.mer_ok ? 0 : 1, b.mer_ok ? 0 : 1) || cmpNum(a.entry.idx, b.entry.idx);
      });
      cands.forEach(function (c, r) { c.rank = r; });
      return cands;
    });
  }

  /** The MTL / HMTL rule between two candidates (engine.py conflicts). */
  function conflicts(a, b, rule) {
    if (isNone(rule)) return false;
    var ka = a.entry.kind;
    var kb = b.entry.kind;
    if (rule === 'same_language') {
      return ((ka === 'MTL' && kb === 'HMTL') || (ka === 'HMTL' && kb === 'MTL')) && a.entry.family === b.entry.family;
    }
    if (rule === 'any_language') {
      var hasH = ka === 'HMTL' || kb === 'HMTL';
      var hasM = ka === 'MTL' || kb === 'MTL' || ka === 'MTL_IN_LIEU' || kb === 'MTL_IN_LIEU';
      return hasH && hasM;
    }
    throw new Error('unknown mtl_rule ' + pyRepr(rule));
  }

  function slotSig(s, hardMer) {
    var hard = (hardMer && hasOwn(hardMer, s.name) && truthy(hardMer[s.name])) ? hardMer[s.name] : {};
    var mer = truthy(get(s, 'mer')) ? s.mer : {};
    return canon(s.accepts) + '|' + s.scale + '|' + canon(mer) + '|' + canon(hard);
  }

  function keyLess(a, b) {
    return cmpNum(a[0], b[0]) || cmpNum(a[1], b[1]) || cmpSeq(a[2], b[2]) || cmpSeq(a[3], b[3]);
  }

  /** Lowest-total complete assignment (engine.py exact_search) -> {key, picks} or null. */
  function exactSearch(slots, cands, rule, hardMer) {
    var n = slots.length;
    var i;
    for (i = 0; i < n; i++) if (cands[i].length === 0) return null;
    var samePrev = [];
    for (i = 0; i < n; i++) samePrev.push(i > 0 && slotSig(slots[i], hardMer) === slotSig(slots[i - 1], hardMer));
    var lb = new Array(n + 1);
    lb[n] = 0;
    for (i = n - 1; i >= 0; i--) lb[i] = lb[i + 1] + cands[i][0].points;
    var best = null;
    var used = new Set();
    var picked = [];

    function dfs(k, total, misses) {
      if (best !== null && total + lb[k] > best.key[0]) return;
      if (k === n) {
        var key = [total, misses, picked.map(function (c) { return c.points; }), picked.map(function (c) { return c.entry.idx; })];
        if (best === null || keyLess(key, best.key) < 0) best = {key: key, picks: picked.slice()};
        return;
      }
      var list = cands[k];
      for (var j = samePrev[k] ? picked[picked.length - 1].rank + 1 : 0; j < list.length; j++) {
        var c = list[j];
        if (used.has(c.sid)) continue;
        var clash = false;
        for (var q = 0; q < picked.length; q++) {
          if (conflicts(c, picked[q], rule)) { clash = true; break; }
        }
        if (clash) continue;
        used.add(c.sid);
        picked.push(c);
        dfs(k + 1, total + c.points, misses + (c.mer_ok ? 0 : 1));
        picked.pop();
        used.delete(c.sid);
      }
    }

    dfs(0, 0, 0);
    return best;
  }

  function greedySearch(slots, cands, rule) {
    var used = new Set();
    var picked = [];
    for (var i = 0; i < slots.length; i++) {
      var sorted = cands[i].slice().sort(function (a, b) {
        return cmpNum(a.points, b.points) || cmpNum(a.entry.idx, b.entry.idx);
      });
      var choice = null;
      for (var j = 0; j < sorted.length && choice === null; j++) {
        var c = sorted[j];
        if (used.has(c.sid)) continue;
        if (picked.some(function (p) { return conflicts(c, p, rule); })) continue;
        choice = c;
      }
      if (choice === null) return null;
      used.add(choice.sid);
      picked.push(choice);
    }
    return picked;
  }

  function excludeIdsFor(defn) {
    var ids = new Set();
    get(defn, 'exclude_groups', []).forEach(function (g) { groupMembers(g).forEach(function (m) { ids.add(m); }); });
    return ids;
  }

  function slotRows(slots, picks) {
    var rows = [];
    for (var i = 0; i < slots.length && i < picks.length; i++) {
      var s = slots[i];
      var c = picks[i];
      rows.push({slot: s.name, label: s.label, subject_id: c.sid, subject: c.entry.name, input_name: c.entry.raw_name,
                 level: c.entry.level, grade: c.entry.grade, year: c.entry.year, points: c.points, scale: s.scale,
                 meets_slot_requirement: truthy(get(s, 'mer')) ? c.mer_ok : null});
    }
    return rows;
  }

  function explainFailure(slots, cands) {
    var empty = [];
    for (var i = 0; i < slots.length; i++) if (!cands[i].length) empty.push(slots[i].label);
    if (empty.length) return 'no usable subject for ' + empty.join('; ');
    return 'not enough different usable subjects to fill every slot (each subject counts once; ' +
           'MTL / HMTL rule applied)';
  }

  /** Exact + greedy for one alternative (engine.py solve). */
  function solve(defn, entries, alternative, slotAccepts, hardMer) {
    var slots = effectiveSlots(defn, alternative, slotAccepts);
    var cands = buildCandidates(slots, entries, excludeIdsFor(defn), hardMer);
    var rule = get(defn, 'mtl_rule');
    var exact = exactSearch(slots, cands, rule, hardMer);
    var greedy = isNone(hardMer) ? greedySearch(slots, cands, rule) : null;
    var out = {alternative: truthy(alternative) ? alternative.id : null,
               label: truthy(alternative) ? alternative.label : null, slots_def: slots};
    if (exact === null) {
      out.gross = null; out.slots = []; out.picks = []; out.reason = explainFailure(slots, cands); out.misses = null;
    } else {
      out.gross = exact.key[0]; out.misses = exact.key[1]; out.picks = exact.picks;
      out.slots = slotRows(slots, exact.picks); out.reason = null;
    }
    if (greedy !== null) {
      out.greedy_total = greedy.reduce(function (t, c) { return t + c.points; }, 0);
      out.greedy_slots = slotRows(slots, greedy);
    } else {
      out.greedy_total = null;
      out.greedy_slots = [];
    }
    return out;
  }

  /** Usable entries, split into 2-exam-year combinations when the caller gave more years (engine.py year_sets);
   *  singleYearLevels: levels whose results from different years are not combined (NFP), split by that year. */
  function yearSets(entries, maxYear, singleYearLevels) {
    var usable = entries.filter(function (e) { return e.year === null || maxYear === null || e.year <= maxYear; });
    var seen = new Set();
    usable.forEach(function (e) { if (e.year !== null) seen.add(e.year); });
    var years = Array.from(seen).sort(cmpNum);
    var combos = [];
    if (years.length <= 2) {
      combos.push([years, usable]);
    } else {
      for (var i = 0; i < years.length; i++) {
        for (var j = i + 1; j < years.length; j++) {
          var a = years[i];
          var b = years[j];
          combos.push([[a, b], usable.filter(function (e) { return e.year === null || e.year === a || e.year === b; })]);
        }
      }
    }
    if (!truthy(singleYearLevels)) return combos;
    var out = [];
    combos.forEach(function (c) {
      var ys = new Set();
      c[1].forEach(function (e) { if (singleYearLevels.indexOf(e.level) >= 0 && e.year !== null) ys.add(e.year); });
      var split = Array.from(ys).sort(cmpNum);
      if (split.length <= 1) { out.push(c); return; }
      split.forEach(function (y) {
        out.push([c[0], c[1].filter(function (e) {
          return singleYearLevels.indexOf(e.level) < 0 || e.year === null || e.year === y;
        })]);
      });
    });
    return out;
  }

  // ============================================================================================ bonus (bonus.py)
  function bestGradeOk(entries, accepts, level, maxGrade) {
    var ids = acceptsIds(accepts);
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (ids !== null && !ids.has(e.subject_id)) continue;
      if (e.level === level && gradeAtOrBetter(level, e.grade, maxGrade)) return true;
    }
    return false;
  }

  function itemPoints(item, entries, inputs) {
    var t = item.type;
    if (t === 'cca') {
      var raw = get(inputs, 'cca');
      if (raw === null) return [0, 'CCA grade not given'];
      var k = strip(pyStr(raw)).toUpperCase();
      return [hasOwn(item.table, k) ? item.table[k] : 0, 'CCA ' + pyStr(raw)];
    }
    if (t === 'grades_all') {
      var ok = item.requirements.every(function (req) { return bestGradeOk(entries, req, item.level, item.max_grade); });
      return ok ? [item.points, 'met'] : [0, 'not met'];
    }
    if (t === 'grades_any') {
      return bestGradeOk(entries, item.accepts, item.level, item.max_grade) ? [item.points, 'met'] : [0, 'not met'];
    }
    if (t === 'flag') {
      return truthy(get(inputs, item.flag)) ? [item.points, 'flag set'] : [0, 'flag not set'];
    }
    throw new Error('unknown bonus item type ' + pyRepr(t));
  }

  function computeBonus(schedule, entries, inputs) {
    if (isNone(schedule)) return null;
    inputs = truthy(inputs) ? inputs : {};
    var items = [];
    var baseCapped = 0;
    var baseUncapped = 0;
    var choice = [];
    function run(list, capped) {
      list.forEach(function (item) {
        var r = itemPoints(item, entries, inputs);
        var scope = get(item, 'scope', 'all');
        items.push({id: item.id, label: item.label, points: r[0], detail: r[1], scope: scope, capped: capped,
                    applies_to: get(item, 'applies_to')});
        if (r[0]) {
          if (scope === 'choice') choice.push([item, r[0], capped]);
          else if (capped) baseCapped += r[0];
          else baseUncapped += r[0];
        }
      });
    }
    run(schedule.items, true);
    run(get(schedule, 'uncapped', []), false);
    // bonus.py orders the choice items capped first, then uncapped
    choice = choice.filter(function (c) { return c[2]; }).concat(choice.filter(function (c) { return !c[2]; }));
    var cap = schedule.cap;
    var base = Math.min(baseCapped, cap) + baseUncapped;
    var variants = {};
    var n = choice.length;
    for (var mask = 1; mask < (1 << n); mask++) {
      var picked = [];
      for (var k = 0; k < n; k++) if (mask & (1 << k)) picked.push(choice[k]);
      var capped = baseCapped;
      var uncapped = baseUncapped;
      picked.forEach(function (c) { if (c[2]) capped += c[1]; else uncapped += c[1]; });
      var label = picked.map(function (c) { return c[0].label.split(' (')[0]; }).join(' + ');
      var scopes = new Set();
      picked.forEach(function (c) { if (truthy(get(c[0], 'applies_to'))) scopes.add(c[0].applies_to); });
      if (scopes.size) label += ' [' + Array.from(scopes).sort(cmpStr).join('/') + ' choices only]';
      variants[label] = Math.min(capped, cap) + uncapped;
    }
    return {base: base, items: items, cap: cap, variants: variants, source: get(schedule, 'source')};
  }

  // ============================================================================================ eligibility
  function chk(check, met, detail, extra) {
    var d = {id: check.id, label: check.label, met: met, detail: detail, source: get(check, 'source')};
    if (extra) Object.keys(extra).forEach(function (k) { d[k] = extra[k]; });
    return d;
  }

  function optionMet(option, entries) {
    var ids = acceptsIds(option.accepts);
    var hits = [];
    var absent = false;
    entries.forEach(function (e) {
      if (ids !== null && !ids.has(e.subject_id)) return;
      if (e.grade === 'ABS') { absent = true; return; }
      if (hasOwn(option, 'grades') && option.grades.indexOf(e.grade) >= 0) { hits.push(e); return; }
      var worst = get(get(option, 'max_grade', {}), e.level);
      if (truthy(worst) && gradeAtOrBetter(e.level, e.grade, worst)) hits.push(e);
    });
    return [hits, absent];
  }

  /** eligibility.py _item_ids: subject ids a requirement line names (null = any subject). */
  function itemIds(item, withSilent) {
    var specs = item.options.map(function (o) { return o.accepts; });
    if (withSilent && truthy(get(item, 'silent_accepts'))) specs.push(item.silent_accepts);
    var ids = new Set();
    for (var i = 0; i < specs.length; i++) {
      var got = acceptsIds(specs[i]);
      if (got === null) return null;
      got.forEach(function (x) { ids.add(x); });
    }
    return ids;
  }

  // eligibility.py _item_levels: levels a requirement line grades (null = any level)
  function itemLevels(item) {
    var levels = new Set();
    for (var i = 0; i < item.options.length; i++) {
      var o = item.options[i];
      if (hasOwn(o, 'grades') || !truthy(get(o, 'max_grade'))) return null;
      Object.keys(o.max_grade).forEach(function (k) { levels.add(k); });
    }
    return levels;
  }

  function silentDesc(entries) {
    return entries.map(function (e) { return e.name + ' ' + e.level + ' ' + e.grade; }).join(', ');
  }

  function restsOnList(entries) {
    return entries.map(function (e) { return {subject: e.name, level: e.level, grade: e.grade}; });
  }

  function subjectRequirements(check, entries, silent) {
    var failed = [];
    var unknown = [];
    var absentAny = false;
    var noResult = [];
    var wrongLevel = [];
    var notes = [];
    var near = [];
    var rests = [];
    check.items.forEach(function (item) {
      var ok = false;
      var absentHere = false;
      for (var i = 0; i < item.options.length; i++) {
        var r = optionMet(item.options[i], entries);
        absentHere = absentHere || r[1];
        if (r[0].length) {
          ok = true;
          notes.push(item.label.split(':')[0] + ': ' + r[0][0].name + ' ' + r[0][0].grade);
          break;
        }
      }
      if (ok) return;
      var ids = itemIds(item, true);
      var resting = silent.filter(function (p) { return ids === null || ids.has(p[0].subject_id); }).map(function (p) { return p[0]; });
      if (resting.length) {
        unknown.push(item.label);
        rests = rests.concat(resting);
        return;
      }
      failed.push(item.label);
      absentAny = absentAny || absentHere;
      var ids2 = itemIds(item, false);
      var sat = entries.filter(function (e) { return e.grade !== 'ABS' && (ids2 === null || ids2.has(e.subject_id)); });
      var levels = itemLevels(item);
      if (!sat.length) noResult.push(item.label);
      else if (levels !== null && !sat.some(function (e) { return levels.has(e.level); })) wrongLevel.push(item.label);
      if (truthy(get(item, 'near')) && item.near.options.some(function (o) { return optionMet(o, entries)[0].length > 0; })) {
        near.push(item.near.note);
      }
    });
    var extra = {absent: absentAny, no_result: noResult, wrong_level: wrongLevel};
    if (near.length) extra.near = near;
    if (failed.length) {
      var detail = 'not met: ' + failed.join('; ');
      if (near.length) detail += ' (' + near.join(' ') + ')';
      return chk(check, false, detail, extra);
    }
    if (unknown.length) {
      extra.rests_on = restsOnList(rests);
      return chk(check, null, "can't be worked out: " + unknown.join('; ') + ' rests on ' + silentDesc(rests) +
                 ', which is not counted (the rules do not say whether it counts)', extra);
    }
    return chk(check, true, 'met (' + notes.join('; ') + ')', extra);
  }

  function conditional(check, byId, altSolutions) {
    var req = byId.get(check.when_failed);
    if (req === undefined) return chk(check, null, 'subject requirements not evaluated');
    if (req.met === null) {
      return chk(check, null, "can't be worked out: the grade requirements for specific subjects can't be worked out");
    }
    if (req.met) return chk(check, null, 'not needed: grade requirements for specific subjects are met');
    if (truthy(get(req, 'absent'))) {
      return chk(check, false, "an 'Absent' grade in a specific subject: not eligible for conditional admission");
    }
    if (truthy(get(req, 'no_result'))) {
      return chk(check, false, 'no result for a specific subject (' + req.no_result.join('; ') + '): not eligible for ' +
                 'conditional admission, which is for a subject you sat and must sit again');
    }
    if (truthy(get(req, 'wrong_level'))) {
      return chk(check, false, 'a result only at another level for a specific subject (' + req.wrong_level.join('; ') +
                 '): not eligible for conditional admission, which is for the subject at the level asked');
    }
    var lo = check.band[0];
    var hi = check.band[1];
    var reasons = [];
    for (var i = 0; i < altSolutions.length; i++) {
      var sol = altSolutions[i];
      var g = sol.gross;
      if (g === null) continue;
      var tag = truthy(sol.label) ? sol.label : 'computation';
      if (g <= check.gross_max) return chk(check, true, tag + ': gross ' + g + ' <= ' + check.gross_max);
      if (lo <= g && g <= hi) {
        var rel = sol.slots.filter(function (row) { return check.relevant_slots.indexOf(row.slot) >= 0; });
        var okGrades = check.relevant_grades;
        if (rel.length && rel.every(function (row) { return get(okGrades, row.level, []).indexOf(row.grade) >= 0; })) {
          return chk(check, true, tag + ': gross ' + g + ' with A1/A2 in all relevant subjects');
        }
        reasons.push(tag + ': gross ' + g + ' but not A1/A2 in every relevant subject');
      } else {
        reasons.push(tag + ': gross ' + g + ' outside ' + lo + '-' + hi);
      }
    }
    return chk(check, false, reasons.join('; ') || 'no aggregate computed');
  }

  function constrained(check, defn, entries, baseGross, silent) {
    var best = null;
    var alts = truthy(get(defn, 'alternatives')) ? defn.alternatives : [null];
    alts.forEach(function (alt) {
      var sol = solve(defn, entries, alt, get(check, 'slot_accepts'), check.slot_mer);
      if (sol.gross !== null && (best === null || sol.gross < best.gross)) best = sol;
    });
    var extra = {};
    if (truthy(get(check, 'provisional'))) extra.provisional = check.provisional;
    var mx = get(check, 'total_max');
    var rests = [];
    if (best === null || (mx !== null && best.gross > mx)) rests = floorRestsOn(check, defn, silent || []);
    if (rests.length) extra.rests_on = restsOnList(rests);
    function withExtra(o) { Object.keys(extra).forEach(function (k) { o[k] = extra[k]; }); return o; }
    if (best === null) {
      if (rests.length) {
        return chk(check, null, "can't be worked out: no assignment meets the grade floors without " + silentDesc(rests) +
                   ', which is not counted (the rules do not say whether it counts)', withExtra({total: null, slots: []}));
      }
      return chk(check, false, 'no assignment meets the grade floors', withExtra({total: null, slots: []}));
    }
    var met = mx === null || best.gross <= mx;
    var detail = 'assignment meeting the floors totals ' + best.gross;
    if (mx !== null) detail += ' (needs <= ' + mx + ')';
    if (baseGross !== null && best.gross !== baseGross) detail += "; differs from the aggregate's own gross " + baseGross;
    if (!met && rests.length) {
      met = null;
      detail = "can't be worked out: " + detail + '; it may change with ' + silentDesc(rests) + ', which is not counted';
    }
    return chk(check, met, detail, withExtra({total: best.gross, slots: best.slots}));
  }

  /** eligibility.py _floor_rests_on. */
  function floorRestsOn(check, defn, silent) {
    var over = get(check, 'slot_accepts') || {};
    var out = [];
    silent.forEach(function (p) {
      if (get(p[1], 'floor') === false) return;
      var hit = defn.slots.some(function (s) {
        var ids = acceptsIds(hasOwn(over, s.name) ? over[s.name] : s.accepts);
        return ids === null || ids.has(p[0].subject_id);
      });
      if (hit) out.push(p[0]);
    });
    return out;
  }

  function minSubjects(check, entries) {
    var byYear = new Set();
    var subjects = new Set();
    entries.forEach(function (e) {
      if (check.levels.indexOf(e.level) >= 0 && e.grade !== 'ABS') {
        subjects.add(e.subject_id);
        if (e.year !== null) byYear.add(e.year);
      }
    });
    var n = subjects.size;
    return chk(check, n >= check.count, n + ' distinct subject(s) at ' + check.levels.join('/') + ' across ' +
               Math.max(byYear.size, 1) + ' exam year(s)');
  }

  function passes(check, entries) {
    var details = [];
    for (var a = 0; a < check.any_of.length; a++) {
      var alt = check.any_of[a];
      var passing = new Map();
      entries.forEach(function (e) {
        var worst = get(alt.pass_grades, e.level);
        if (truthy(worst) && gradeAtOrBetter(e.level, e.grade, worst) && !passing.has(e.subject_id)) passing.set(e.subject_id, e);
      });
      var used = new Set();
      var ok = true;
      for (var r = 0; r < alt.must_include.length; r++) {
        var ids = acceptsIds(alt.must_include[r]);
        var hit = null;
        var it = passing.keys();
        for (var nx = it.next(); !nx.done; nx = it.next()) {
          var sid = nx.value;
          if (!used.has(sid) && (ids === null || ids.has(sid))) { hit = sid; break; }
        }
        if (hit === null) { ok = false; break; }
        used.add(hit);
      }
      if (ok && passing.size >= alt.count) return chk(check, true, 'met: ' + alt.label);
      details.push(alt.label + ': ' + passing.size + ' passing subject(s)' + (ok ? '' : ', prerequisite missing'));
    }
    return chk(check, false, 'not met (' + details.join('; ') + ')');
  }

  function requiresLevel(check, entries) {
    var has = entries.some(function (e) { return e.level === check.level; });
    return chk(check, has, has ? 'has ' + check.level + ' results' : 'no ' + check.level + ' results');
  }

  function evaluateChecks(defn, entries, gross, net, altSolutions, netReason, silent) {
    silent = silent || [];
    var out = [];
    var byId = new Map();
    get(defn, 'checks', []).forEach(function (check) {
      var t = check.type;
      var r;
      if (t === 'gross_max') {
        r = chk(check, gross === null ? null : gross <= check.max,
                gross === null ? 'gross not computed' : 'gross ' + gross + ' (max ' + check.max + ')');
      } else if (t === 'net_max') {
        r = net === null ? chk(check, null, truthy(netReason) ? netReason : 'net not computed')
                         : chk(check, net <= check.max, 'net ' + net + ' (max ' + check.max + ')');
      } else if (t === 'subject_requirements') {
        r = subjectRequirements(check, entries, silent);
      } else if (t === 'conditional_admission') {
        r = conditional(check, byId, altSolutions);
      } else if (t === 'constrained') {
        r = constrained(check, defn, entries, gross, silent);
      } else if (t === 'min_subjects') {
        r = minSubjects(check, entries);
      } else if (t === 'passes') {
        r = passes(check, entries);
      } else if (t === 'requires_level') {
        r = requiresLevel(check, entries);
      } else if (t === 'info') {
        r = chk(check, null, 'not evaluated');
      } else {
        throw new Error('unknown check type ' + pyRepr(t));
      }
      byId.set(check.id, r);
      out.push(r);
    });
    return out;
  }

  // ============================================================================================ ignored (ignored.py)
  // Typed grades an aggregate does not use, with the reason (definitions.json ignored_reasons + each definition's
  // ignored_policy). Same steps and order as ignored.py.
  var IGNORED_FALLBACK = 'unlisted';

  function slotTakes(slot, sid) {
    var ids = acceptsIds(slot.accepts);
    return ids === null || ids.has(sid);
  }

  function softKey(slot, scale, e, p) {
    return [p, merOk(get(slot, 'mer'), scale, e, p) ? 0 : 1, e.idx];
  }

  /** ignored.py _preferred_other: the same-subject entry every slot takes instead of `e`, or null. */
  function preferredOther(e, others, slots) {
    var winner = null;
    var usable = false;
    for (var i = 0; i < slots.length; i++) {
      var s = slots[i];
      if (!slotTakes(s, e.subject_id)) continue;
      var scale = scaleOf(s.scale);
      var p = points(scale, e.level, e.grade);
      if (p === null) continue;
      usable = true;
      var u = isMerUnusable(scale, e.level, e.grade) ? 1 : 0;
      var mine = softKey(s, scale, e, p);
      var best = null;
      var bestKey = null;
      for (var j = 0; j < others.length; j++) {
        var o = others[j];
        var po = points(scale, o.level, o.grade);
        if (po === null) continue;
        var uo = isMerUnusable(scale, o.level, o.grade) ? 1 : 0;
        var key = softKey(s, scale, o, po);
        if (po <= p && uo <= u && cmpSeq(key, mine) < 0 && (best === null || cmpSeq(key, bestKey) < 0)) {
          best = o;
          bestKey = key;
        }
      }
      if (best === null) return null;
      if (winner === null) winner = best;
    }
    return usable ? winner : null;
  }

  function usedText(o, e, labels) {
    if (o.level !== e.level) return labels[o.level] + ' ' + o.grade;
    if (o.year !== null && o.year !== e.year) return o.grade + ' (' + o.year + ')';
    return o.grade;
  }

  function fillReason(text, fill) {
    return text.split('{max_year}').join(fill.max_year).split('{years}').join(fill.years).split('{used}').join(fill.used);
  }

  function ignoredItem(e, code, fill) {
    var r = S.ignoredReasons[code];
    return {subject: e.name, level: e.level, grade: e.grade, year: e.year, row: e.idx + 1, input_name: e.raw_name,
            state: r.state, code: code, reason: fillReason(r.text, fill)};
  }

  function levelGradeReason(e, policy, slots) {
    if (slots.some(function (s) { return points(scaleOf(s.scale), e.level, e.grade) !== null; })) return null;
    if (S.nonScoring.indexOf(e.grade) >= 0) return e.kind === 'MTL_B' ? get(policy, 'non_scoring') : 'no_points';
    var levels = new Set();
    slots.forEach(function (s) { Object.keys(scaleOf(s.scale).levels).forEach(function (l) { levels.add(l); }); });
    if (!levels.has(e.level)) return get(get(policy, 'levels') || {}, e.level);
    return get(get(policy, 'grades') || {}, e.level + ':' + e.grade);
  }

  /** ignored.py ignored_entries -> [items, silent pairs [entry, reason]]. */
  function ignoredEntries(defn, entries, window, yearsUsed) {
    if (get(defn, 'status') === 'stub') return [[], []];
    var policy = get(defn, 'ignored_policy') || {};
    var labels = get(S.levelLabels, get(defn, 'exam_key')) || S.levelLabels.SEC;
    var slots = defn.slots;
    var maxYear = get(defn, 'max_year');
    var inWindow = new Set(window.map(function (e) { return e.idx; }));
    var years = (yearsUsed || []).slice();
    var single = get(defn, 'single_year_levels') || [];
    var excluded = new Map();
    get(defn, 'exclude_groups', []).forEach(function (g) {
      groupMembers(g).forEach(function (sid) { if (!excluded.has(sid)) excluded.set(sid, g); });
    });
    var bySubject = new Map();
    window.forEach(function (e) {
      if (!bySubject.has(e.subject_id)) bySubject.set(e.subject_id, []);
      bySubject.get(e.subject_id).push(e);
    });
    var fill = {max_year: pyStr(maxYear), years: years.map(String).join(' and '), used: ''};
    var items = [];
    var silent = [];
    entries.forEach(function (e) {
      var code = null;
      var checkSilent = false;
      if (e.year !== null && maxYear !== null && e.year > maxYear) {
        code = 'later_year';
      } else if (!inWindow.has(e.idx)) {
        code = (single.indexOf(e.level) >= 0 && years.indexOf(e.year) >= 0) ? (get(policy, 'single_year') || IGNORED_FALLBACK)
                                                                             : 'not_best_years';
      } else if (e.grade === 'ABS' && !slots.some(function (s) {
        return slotTakes(s, e.subject_id) && points(scaleOf(s.scale), e.level, e.grade) !== null; })) {
        code = 'absent';
      } else if (excluded.has(e.subject_id)) {
        code = get(get(policy, 'excluded') || {}, excluded.get(e.subject_id)) || IGNORED_FALLBACK;
        checkSilent = true;
        var shadow = levelGradeReason(e, policy, slots);
        if (truthy(shadow) && S.ignoredReasons[shadow].state === 'silent') silent.push([e, S.ignoredReasons[shadow]]);
      } else {
        var usable = slots.some(function (s) { return slotTakes(s, e.subject_id) && points(scaleOf(s.scale), e.level, e.grade) !== null; });
        if (!usable) {
          var taking = slots.filter(function (s) { return slotTakes(s, e.subject_id); });
          var levelsHere = new Set();
          taking.forEach(function (s) { Object.keys(scaleOf(s.scale).levels).forEach(function (l) { levelsHere.add(l); }); });
          var found = [];
          var nonScoring = S.nonScoring.indexOf(e.grade) >= 0;
          if (nonScoring) found.push(e.kind === 'MTL_B' ? get(policy, 'non_scoring') : 'no_points');
          if (!taking.length) found.push('no_slot');
          else if (!levelsHere.has(e.level)) found.push(get(get(policy, 'levels') || {}, e.level));
          else if (!nonScoring) found.push(get(get(policy, 'grades') || {}, e.level + ':' + e.grade));
          found = found.filter(function (c) { return truthy(c); });
          if (!found.length) found = [IGNORED_FALLBACK];
          code = found.filter(function (c) { return S.ignoredReasons[c].state === 'rule'; })[0] || found[0];
          checkSilent = true;
        } else {
          var others = (bySubject.get(e.subject_id) || []).filter(function (o) { return o !== e; });
          var o = others.length ? preferredOther(e, others, slots) : null;
          if (o !== null) {
            var c2;
            if (o.level !== e.level) c2 = get(policy, 'cross_level') || get(policy, 'same_level') || IGNORED_FALLBACK;
            else if (o.year !== null && e.year !== null && o.year !== e.year) c2 = get(policy, 'same_level') || IGNORED_FALLBACK;
            else c2 = 'duplicate';
            items.push(ignoredItem(e, c2, {max_year: fill.max_year, years: fill.years, used: usedText(o, e, labels)}));
            return;
          }
        }
      }
      if (code === null) return;
      items.push(ignoredItem(e, code, fill));
      if (checkSilent && S.ignoredReasons[code].state === 'silent') silent.push([e, S.ignoredReasons[code]]);
    });
    return [items, silent];
  }

  /** ignored.py silent_text. */
  function silentText(pairs, labels) {
    return pairs.map(function (p) {
      var e = p[0];
      return e.name + ' (' + (hasOwn(labels, e.level) ? labels[e.level] : e.level) + ' ' + e.grade + ')';
    }).join(', ');
  }

  // ============================================================================================ api (api.py)
  function baseResult(defn, status) {
    return {
      id: defn.id, display_name: get(defn, 'display_name', defn.id), letters: get(defn, 'letters'),
      exam_year: get(defn, 'exam_year'), exercise: get(defn, 'exercise'), institution: get(defn, 'institution'),
      route: get(defn, 'route'), status: status, gross: null, net: null, bonus: null, net_variants: {}, slots: [],
      ignored: [], alternatives: [], chosen_alternative: null, eligibility: [], not_computable_reason: null, greedy_total: null,
      greedy_slots: [], greedy_differs: false, years_used: [], warnings: [], input_problems: [],
      sources: get(defn, 'sources', []).slice(), notes: get(defn, 'notes', []).slice(),
      open_questions: get(defn, 'open_questions', []).slice()
    };
  }

  function usableAnywhere(defn, entries) {
    return defn.slots.some(function (s) {
      var scale = scaleOf(s.scale);
      return entries.some(function (e) { return points(scale, e.level, e.grade) !== null; });
    });
  }

  function solveAllAlternatives(defn, entries) {
    var alts = truthy(get(defn, 'alternatives')) ? defn.alternatives : [null];
    var sols = alts.map(function (a) { return solve(defn, entries, a); });
    var chosen = null;
    sols.forEach(function (s) { if (s.gross !== null && (chosen === null || s.gross < chosen.gross)) chosen = s; });
    var greedyBest = null;
    sols.forEach(function (s) {
      if (s.greedy_total !== null && (greedyBest === null || s.greedy_total < greedyBest.greedy_total)) greedyBest = s;
    });
    return [sols, chosen, greedyBest];
  }

  function computeDefinition(defn, entries, bonusInputs, baseWarnings, inputProblems) {
    var r = computeDefinitionInner(defn, entries, bonusInputs, baseWarnings);
    r.input_problems = inputProblems.map(shallow);
    return r;
  }

  function computeDefinitionInner(defn, entries, bonusInputs, baseWarnings) {
    if (get(defn, 'status') === 'stub') {
      var st = baseResult(defn, 'stub');
      st.not_computable_reason = get(defn, 'stub_reason');
      return st;
    }
    var best = null;
    var combos = yearSets(entries, get(defn, 'max_year'), get(defn, 'single_year_levels'));
    combos.forEach(function (combo) {
      var res = solveAllAlternatives(defn, combo[1]);
      var g = res[1] ? res[1].gross : Infinity;
      if (best === null || g < best.g) best = {g: g, years: combo[0], ents: combo[1], sols: res[0], chosen: res[1], greedy: res[2]};
    });
    var sols = best.sols;
    var chosen = best.chosen;
    var ents = best.ents;

    var r = baseResult(defn, 'computed');
    r.warnings = baseWarnings.slice();
    r.years_used = best.years.slice();
    var ig = ignoredEntries(defn, entries, ents, best.years);
    r.ignored = ig[0];
    var silent = ig[1];
    var pairs = new Set();
    combos.forEach(function (c) { pairs.add(c[0].join(',')); });
    if (pairs.size > 1) {
      r.warnings.push('results from more than 2 exam years: the best 2-year combination (' + best.years.join('+') + ') is used');
    }
    r.alternatives = truthy(get(defn, 'alternatives')) ? sols.map(function (s) {
      return {id: s.alternative, label: s.label, gross: s.gross, slots: s.slots, greedy_total: s.greedy_total,
              not_computable_reason: s.reason};
    }) : [];

    if (!usableAnywhere(defn, ents)) {
      r.status = 'not_applicable';
      r.not_computable_reason = 'no results usable by this aggregate (exam year ' + pyStr(get(defn, 'max_year')) +
                                ' or earlier; scale: ' + scaleOf(defn.slots[0].scale).label + ')';
    } else if (chosen === null) {
      r.status = 'not_computable';
      r.not_computable_reason = sols.map(function (s) { return truthy(s.label) ? s.label + ': ' + s.reason : s.reason; }).join('; ');
      var rests = slotRestsOn(defn, silent);
      if (rests.length) {
        r.not_computable_reason += '; the rules do not say whether ' +
          silentText(rests, get(S.levelLabels, get(defn, 'exam_key')) || S.levelLabels.SEC) + ' counts';
      }
    } else {
      r.gross = chosen.gross;
      r.slots = chosen.slots;
      r.chosen_alternative = chosen.alternative;
      if (truthy(chosen.misses)) {
        r.warnings.push(chosen.misses + " slot pick(s) do not meet that slot's subject grade requirement " +
                        '(the subject still counts in the aggregate)');
      }
    }

    if (best.greedy !== null) {
      r.greedy_total = best.greedy.greedy_total;
      r.greedy_slots = best.greedy.greedy_slots;
    }
    r.greedy_differs = (r.gross !== null && r.greedy_total !== r.gross) || (r.gross === null && r.greedy_total !== null);
    if (r.greedy_differs) {
      r.warnings.push('greedy slot-by-slot filling gives ' + pyStr(r.greedy_total) + ', exact search gives ' + pyStr(r.gross));
    }

    var netReason = null;
    if (get(defn, 'bonus') === null) {
      netReason = get(defn, 'bonus_missing_reason', 'no bonus schedule');
    } else if (r.gross !== null) {
      var b = computeBonus(defn.bonus, ents, bonusInputs);
      r.bonus = b;
      r.net = r.gross - b.base;
      var nv = {};
      Object.keys(b.variants).forEach(function (k) { nv[k] = r.gross - b.variants[k]; });
      r.net_variants = nv;
      if (!truthy(get(truthy(bonusInputs) ? bonusInputs : {}, 'cca'))) {
        r.warnings.push('CCA grade not given: net assumes no CCA bonus');
      }
    }
    if (truthy(netReason) && r.gross !== null) r.notes.push('net: ' + netReason);

    r.eligibility = evaluateChecks(defn, ents, r.gross, r.net, sols, netReason, silent);
    return r;
  }

  /** api.py _slot_rests_on: silent entries some slot of the aggregate could take. */
  function slotRestsOn(defn, silent) {
    return silent.filter(function (p) {
      return defn.slots.some(function (s) {
        var ids = acceptsIds(s.accepts);
        return ids === null || ids.has(p[0].subject_id);
      });
    });
  }

  function g3Passes(entries, maxYear, worst) {
    var ids = new Set();
    entries.forEach(function (e) {
      if (e.level === 'G3' && (e.year === null || e.year <= maxYear) && gradeAtOrBetter('G3', e.grade, worst)) ids.add(e.subject_id);
    });
    return ids.size;
  }

  function allMet(result, checkIds) {
    var el = {};
    result.eligibility.forEach(function (e) { el[e.id] = e.met; });
    return checkIds.every(function (c) { return truthy(hasOwn(el, c) ? el[c] : null); });
  }

  /** 5th year in secondary school (PSE 2028); thresholds from definitions.json summaries[0] (api.py). */
  function fifthYearSummary(byId, entries, spec) {
    var src = spec.source;
    var r = baseResult({id: spec.id, display_name: get(spec, 'display_name', spec.id), exam_year: spec.exam_year,
                        exercise: spec.exercise, institution: spec.institution, route: spec.route,
                        sources: [src], open_questions: spec.open_questions}, 'summary');
    var nPass = g3Passes(entries, spec.exam_year, spec.g3_pass_max_grade);

    var a = spec.criterion_a;
    var jcmiRes = byId.get(a.jcmi_aggregate);
    var jcmi = false;
    if (jcmiRes !== undefined && jcmiRes.gross !== null) {
      jcmi = a.jc_ok.some(function (ids) { return allMet(jcmiRes, ids); }) ||
             a.mi_ok.some(function (ids) { return allMet(jcmiRes, ids); });
    }
    var nets = [];
    a.poly_aggregates.forEach(function (id) { if (byId.has(id) && byId.get(id).net !== null) nets.push(byId.get(id).net); });
    var minNet = nets.length ? Math.min.apply(null, nets) : null;
    var polyOut = !nets.length || minNet >= a.poly_fail_net_from;
    var aMet;
    var aDetail;
    if (nPass < a.min_g3_passes) { aMet = false; aDetail = nPass + ' G3 pass(es)'; }
    else if (jcmi) { aMet = false; aDetail = 'qualifies for JC or MI (' + a.jcmi_aggregate + ')'; }
    else if (!polyOut) { aMet = null; aDetail = 'ELR2B2 net ' + minNet + ': depends on course MER (not checked)'; }
    else { aMet = true; aDetail = nPass + ' G3 passes; no JC / MI; no ELR2B2 net below ' + a.poly_fail_net_from; }

    var b = spec.criterion_b;
    var hits = b.any_of.filter(function (x) {
      var res = byId.get(x.aggregate);
      return res !== undefined && res.gross !== null && res.gross <= x.max;
    }).map(function (x) { return x.aggregate; });
    var bMet;
    var bDetail;
    if (nPass > b.max_g3_passes) { bMet = false; bDetail = nPass + ' G3 passes (needs ' + b.max_g3_passes + ' or fewer)'; }
    else { bMet = hits.length > 0; bDetail = hits.length ? 'met by ' + hits.join(', ') : 'no aggregate under its threshold'; }

    var g = spec.all_g3;
    var agg = byId.get(g.aggregate);
    var allG3 = (agg === undefined || agg.gross === null) ? null : agg.gross <= g.max;
    var overall = (truthy(aMet) || truthy(bMet)) ? true : (aMet === null ? null : false);
    r.eligibility = [
      {id: 'criterion_a', label: a.label, met: aMet, detail: aDetail, source: src},
      {id: 'criterion_b', label: b.label, met: bMet, detail: bDetail, source: src},
      {id: 'all_g3', label: g.label, met: allG3, detail: g.aggregate + ' = ' + pyStr(agg !== undefined ? agg.gross : null),
       source: src},
      {id: 'eligible', label: 'Eligible for a 5th year', met: overall, detail: 'either criterion', source: src}
    ];
    r.warnings.push(spec.g3_pass_note);
    return r;
  }

  function checkInputs(subjects) {
    requireLoaded();
    var p = prepareEntries(subjects);
    return {entries: p[0].map(function (e) { return e.describe(); }), input_problems: p[2], warnings: p[1]};
  }

  function computePrepared(p, bonusInputs, ids, includeSummary) {
    var defs = isNone(ids) ? S.defs : ids.map(function (id) {
      if (!S.defsById.has(id)) throw new Error('pse_core: unknown aggregate id ' + pyRepr(id));
      return S.defsById.get(id);
    });
    var results = defs.map(function (d) { return computeDefinition(d, p[0], bonusInputs, p[1], p[2]); });
    if (includeSummary && isNone(ids)) {
      var byId = new Map();
      results.forEach(function (r) { byId.set(r.id, r); });
      var summary = fifthYearSummary(byId, p[0], S.summary);
      summary.input_problems = p[2].map(shallow);
      results.push(summary);
    }
    return results;
  }

  function computeAll(subjects, bonusInputs, ids, includeSummary) {
    requireLoaded();
    return computePrepared(prepareEntries(subjects), isNone(bonusInputs) ? null : bonusInputs, ids,
                           includeSummary === undefined ? true : includeSummary);
  }

  function compute(aggregateId, subjects, bonusInputs) {
    return computeAll(subjects, bonusInputs, [aggregateId])[0];
  }

  // ============================================================================================ matcher: evaluate.py
  // evaluate.py LEVEL_RANK: which result is shown as evidence when two meet a line equally (G3, then G2, then G1).
  var LEVEL_RANK = {G3: 0, G2: 1, G1: 2};
  // evaluate.py _grade_text: level names in "not met" details.
  var LEVEL_TEXT = {G3: 'O-Level/G3', G2: 'N(A)/G2', G1: 'N(T)/G1'};

  function rank(e) {
    var order = get(S.gradeOrder, e.level, []);
    var gi = order.indexOf(e.grade);
    return [gi >= 0 ? gi : 99, hasOwn(LEVEL_RANK, e.level) ? LEVEL_RANK[e.level] : 9, e.idx];
  }
  function rankCmp(a, b) { return cmpSeq(rank(a), rank(b)); }

  function evOf(e) { return {subject: e.name, subject_id: e.subject_id, level: e.level, grade: e.grade, year: e.year}; }
  function evText(e) { return e.name + ' ' + e.grade + (truthy(e.year) ? ' (' + e.year + ')' : ''); }

  function meets(e, maxGrade) {
    if (e.grade === 'ABS') return false;
    var worst = get(maxGrade || {}, e.level);
    return worst !== null && gradeAtOrBetter(e.level, e.grade, worst);
  }

  function gradeText(maxGrade) {
    return Object.keys(maxGrade).sort(function (x, y) { return cmpNum(LEVEL_RANK[x], LEVEL_RANK[y]); })
      .map(function (k) { return LEVEL_TEXT[k] + ' ' + maxGrade[k] + ' or better'; }).join(' or ');
  }

  /** {subject_id: entry} as a Map: the best entry of each subject that meets the line. */
  function lineCandidates(line, entries) {
    var out = new Map();
    function consider(e) {
      if (!out.has(e.subject_id) || rankCmp(e, out.get(e.subject_id)) < 0) out.set(e.subject_id, e);
    }
    if (line.kind === 'subject') {
      line.options.forEach(function (opt) {
        var ids = new Set(opt.subjects);
        entries.forEach(function (e) { if (ids.has(e.subject_id) && meets(e, get(opt, 'max_grade'))) consider(e); });
      });
    } else if (line.kind === 'any_other') {
      entries.forEach(function (e) { if (meets(e, get(line, 'max_grade'))) consider(e); });
    }
    return out;
  }

  function closest(line, entries) {
    var ids = null;
    if (line.kind === 'subject') {
      ids = new Set();
      line.options.forEach(function (o) { o.subjects.forEach(function (s) { ids.add(s); }); });
    }
    var best = null;
    entries.forEach(function (e) {
      if (ids !== null && !ids.has(e.subject_id)) return;
      if (best === null || rankCmp(e, best) < 0) best = e;
    });
    return best;
  }

  function requirementText(line) {
    if (line.kind === 'subject') {
      return line.options.map(function (o) {
        return gradeText(o.max_grade) + (truthy(get(o, 'printed')) ? ' in ' + o.printed : '');
      }).join('; ');
    }
    if (line.kind === 'any_other') return line.count + ' subject(s) at ' + gradeText(line.max_grade);
    return '';
  }

  function sortedValues(map) { return Array.from(map.values()).sort(rankCmp); }
  function lineCount(ln) { return hasOwn(ln, 'count') ? ln.count : 1; }

  /** Distinct-subject assignment for the lines in `which` -> Map(line index -> [entries]) or null. */
  function assign(consuming, cand, which) {
    var order = which.slice().sort(function (a, b) {
      return cmpNum(consuming[a].kind === 'subject' ? 0 : 1, consuming[b].kind === 'subject' ? 0 : 1) || cmpNum(a, b);
    });
    var slots = [];
    order.forEach(function (i) {
      var ranked = Array.from(cand.get(i).entries()).sort(function (x, y) { return rankCmp(x[1], y[1]); });
      for (var k = 0; k < lineCount(consuming[i]); k++) slots.push([i, ranked]);
    });
    var picks = new Array(slots.length);
    var used = new Set();
    function rec(k) {
      if (k === slots.length) return true;
      var ranked = slots[k][1];
      for (var j = 0; j < ranked.length; j++) {
        var sid = ranked[j][0];
        if (used.has(sid)) continue;
        used.add(sid);
        picks[k] = [slots[k][0], ranked[j][1]];
        if (rec(k + 1)) return true;
        used.delete(sid);
      }
      picks[k] = null;
      return false;
    }
    if (!rec(0)) return null;
    var byLine = new Map();
    picks.forEach(function (p) {
      if (!byLine.has(p[0])) byLine.set(p[0], []);
      byLine.get(p[0]).push(p[1]);
    });
    return byLine;
  }

  function evalIndependent(lines, entries) {
    var consuming = lines.filter(function (l) { return l.kind === 'subject' || l.kind === 'any_other'; });
    var cand = new Map();
    consuming.forEach(function (ln, i) { cand.set(i, lineCandidates(ln, entries)); });
    var short = new Set();
    consuming.forEach(function (ln, i) { if (cand.get(i).size < lineCount(ln)) short.add(i); });
    var able = [];
    consuming.forEach(function (ln, i) { if (!short.has(i)) able.push(i); });
    var byLine = assign(consuming, cand, able);
    var joint = byLine !== null;
    var leftOver = new Map();
    var namedUsed = new Set();
    function minusNamed(i) {
      var n = 0;
      cand.get(i).forEach(function (e, sid) { if (!namedUsed.has(sid)) n++; });
      return n;
    }
    if (!joint) {
      // Diagnosis only: "any N other subjects" means other than the subjects the named lines use.
      var named = able.filter(function (i) { return consuming[i].kind === 'subject'; });
      var namedPick = assign(consuming, cand, named) || new Map();
      namedPick.forEach(function (es) { es.forEach(function (e) { namedUsed.add(e.subject_id); }); });
      able.forEach(function (i) {
        var ln = consuming[i];
        if (ln.kind === 'any_other') {
          leftOver.set(i, minusNamed(i));
          if (leftOver.get(i) < lineCount(ln)) short.add(i);
        }
      });
      able = able.filter(function (i) { return !short.has(i); });
      byLine = assign(consuming, cand, able);
      joint = byLine !== null;
    }
    byLine = byLine || new Map();
    var nSlots = 0;
    able.forEach(function (i) { nSlots += lineCount(consuming[i]); });

    var out = [];
    var anyUnknown = false;
    lines.forEach(function (ln) {
      var r = {id: ln.id, text: ln.text, kind: ln.kind, met: null, satisfied_by: [], detail: ''};
      if (ln.kind === 'unknown') {
        r.detail = 'cannot check: ' + ln.unknown_reason;
        anyUnknown = true;
      } else if (ln.kind === 'subject' || ln.kind === 'any_other') {
        var i = consuming.indexOf(ln);
        var need = lineCount(ln);
        if (!short.has(i) && joint) {
          var es = byLine.get(i) || [];
          r.met = true;
          r.satisfied_by = es.map(evOf);
          r.detail = 'met by ' + es.map(evText).join(', ');
        } else if (!short.has(i)) {
          var top = sortedValues(cand.get(i)).slice(0, need);
          r.met = true;
          r.satisfied_by = top.map(evOf);
          r.detail = 'met on its own by ' + top.map(evText).join(', ') + ' (but see: each line needs a different subject)';
        } else {
          r.met = false;
          var best = ln.kind === 'subject' ? closest(ln, entries) : null;
          var have = best ? ' - best result: ' + evText(best) : (ln.kind === 'subject' ? ' - no result for these subjects' : '');
          if (ln.kind === 'any_other') {
            have = ' - ' + (leftOver.has(i) ? leftOver.get(i) : minusNamed(i)) +
                   ' qualifying subject(s) besides those used for the other lines';
          }
          r.detail = 'not met: needs ' + requirementText(ln) + have;
        }
      } else if (ln.kind === 'sat_for') {
        var ids = new Set(ln.subjects);
        var hits = entries.filter(function (e) { return ids.has(e.subject_id) && e.grade !== 'ABS'; }).sort(rankCmp);
        r.met = hits.length > 0;
        r.satisfied_by = hits.length ? [evOf(hits[0])] : [];
        r.detail = hits.length ? 'sat ' + evText(hits[0]) : 'not met: no result for these subjects';
      } else if (ln.kind === 'completed') {
        var has = entries.some(function (e) { return ln.levels.indexOf(e.level) >= 0 && e.grade !== 'ABS'; });
        r.met = has;
        r.detail = has ? 'has ' + ln.levels.join('/') + ' results' : 'no ' + ln.levels.join('/') + ' results';
      }
      out.push(r);
    });

    var mets = out.map(function (r) { return r.met; });
    if (!joint && nSlots) {
      out.push({id: 'distinct', text: 'Each line needs a different subject', kind: 'distinct', met: false,
                satisfied_by: [], detail: 'not met: the lines can each be met, but not with ' + nSlots + ' different subjects'});
      mets.push(false);
    }
    if (mets.indexOf(false) >= 0) return [false, out];
    if (anyUnknown || mets.indexOf(null) >= 0) return [null, out];
    return [true, out];
  }

  /** JIE 'H' / PFP: the lines are grade floors on the aggregate's slots; the engine's constrained search decides. */
  function evalSlots(lines, aggId, entries, totalMax, baseGross, label, silent) {
    var defn = S.defsById.get(aggId);
    if (lines.some(function (l) { return l.kind !== 'slot'; })) {
      return [null, lines.map(function (l) {
        return {id: l.id, text: l.text, kind: l.kind, met: null, satisfied_by: [],
                detail: 'cannot check: ' + get(l, 'unknown_reason', 'unreadable')};
      }), null];
    }
    var check = {id: 'course_mer', type: 'constrained', label: label, slot_mer: {}, slot_accepts: {},
                 total_max: totalMax, source: null};
    lines.forEach(function (ln) {
      ln.slots.forEach(function (s) {
        // evaluate.py eval_slots: an MER floor can never be met by a grade the scale marks mer_unusable
        check.slot_mer[s] = {max_points: ln.max_points, exclude_mer_unusable: true};
        if (ln.accepts !== null) check.slot_accepts[s] = {subjects: ln.accepts.slice()};
      });
    });
    var res = constrained(check, defn, entries, baseGross, silent || []);
    var bySlot = {};
    (res.slots || []).forEach(function (row) { bySlot[row.slot] = row; });
    var hasBySlot = Object.keys(bySlot).length > 0;
    var scales = {};
    defn.slots.forEach(function (s) { scales[s.name] = scaleOf(s.scale); });

    function within(ln) {
      var scale = scales[ln.slots[0]];
      var acc = ln.accepts !== null ? new Set(ln.accepts) : null;
      var best = new Map();
      entries.forEach(function (e) {
        if (acc !== null && !acc.has(e.subject_id)) return;
        var p = points(scale, e.level, e.grade);
        if (p === null || p > ln.max_points || isMerUnusable(scale, e.level, e.grade)) return;
        if (!best.has(e.subject_id) || p < best.get(e.subject_id)) best.set(e.subject_id, p);
      });
      return best;
    }

    // Diagnosis only (the decision is the engine's search): named slots take their best subject first;
    // "any other subject" slots count what is left.
    var taken = new Set();
    if (!res.met) {
      // Python's stable sorted(key=accepts is None); the index makes it stable on any engine
      var ordered = lines.map(function (ln, k) { return [ln.accepts === null ? 1 : 0, k]; }).sort(cmpSeq)
        .map(function (x) { return lines[x[1]]; });
      ordered.forEach(function (ln) {
        var cands = within(ln);
        if (ln.accepts !== null) {
          var free = [];
          cands.forEach(function (p, s) { if (!taken.has(s)) free.push([p, s]); });
          free.sort(cmpSeq);
          free.slice(0, ln.slots.length).forEach(function (x) { taken.add(x[1]); });
        }
      });
    }
    var out = [];
    lines.forEach(function (ln) {
      var r = {id: ln.id, text: ln.text, kind: 'slot', slots: ln.slots, met: null, satisfied_by: [], detail: ''};
      if (res.met !== null && hasBySlot) {
        var rows = ln.slots.filter(function (s) { return hasOwn(bySlot, s); }).map(function (s) { return bySlot[s]; });
        r.satisfied_by = rows.map(function (x) {
          return {subject: x.subject, subject_id: x.subject_id, level: x.level, grade: x.grade, year: x.year,
                  points: x.points, slot: x.slot};
        });
        r.met = true;
        r.detail = 'met by ' + rows.map(function (x) { return x.subject + ' ' + x.grade + ' (' + x.points + ' pt)'; }).join(', ');
      }
      if (!res.met) {
        var ok = new Set(within(ln).keys());
        if (ln.accepts === null) taken.forEach(function (s) { ok.delete(s); });
        var need = ln.slots.length;
        if (ok.size < need) {
          r.met = res.met === false ? false : null;
          r.satisfied_by = [];
          r.detail = (res.met === false ? 'not met' : "can't be worked out") + ': needs ' + need + ' ' +
                     (ln.accepts === null ? 'other ' : '') + 'subject(s) worth ' + ln.max_points + ' point(s) or better; ' +
                     ok.size + ' found';
        } else if (!hasBySlot) {
          r.met = true;
          r.detail = 'met on its own (' + ok.size + ' subject(s) within the floor)';
        }
      }
      out.push(r);
    });
    if (!res.met) {
      out.push({id: 'together', text: 'All lines met by the subjects that make up ' + defn.letters +
                (truthy(totalMax) ? ' with a total of ' + totalMax + ' or better' : ''),
                kind: 'together', met: res.met, satisfied_by: [], detail: res.detail});
    }
    return [res.met, out, res];
  }

  function evalMer(mer, entries, totalMax, baseGross, label, silent) {
    if (mer.mode === 'slots') {
      var s = evalSlots(mer.lines, mer.aggregate_id, entries, totalMax, baseGross, label, silent);
      return {met: s[0], lines: s[1], alternative_used: null, pdf_variant: null, total: s[2] ? get(s[2], 'total') : null};
    }
    var m = evalIndependent(mer.lines, entries);
    var out = {met: m[0], lines: m[1], alternative_used: null, pdf_variant: null};
    var alts = get(mer, 'alternatives');
    if (m[0] !== true && truthy(alts)) {
      for (var i = 0; i < alts.length; i++) {
        var a = evalIndependent(alts[i].lines, entries);
        if (truthy(a[0])) {
          out.met = true;
          out.alternative_used = {label: alts[i].label, lines: a[1], source: alts[i].source};
          break;
        }
        if (a[0] === null && out.met === false) out.met = null;
      }
    }
    if (truthy(get(mer, 'pdf_variant'))) {
      var v = evalIndependent(mer.pdf_variant, entries);
      out.pdf_variant = {met: v[0], lines: v[1]};
      if (v[0] !== out.met && out.alternative_used === null) {
        out.met_coursefinder = out.met;
        out.met = null;
      }
    }
    return out;
  }

  // ============================================================================================ matcher: match.py
  function windowEntries(entries, result, defn) {
    var years = result ? result.years_used : [];
    var mx = get(defn, 'max_year');
    if (years.length) return entries.filter(function (e) { return e.year === null || years.indexOf(e.year) >= 0; });
    return entries.filter(function (e) { return e.year === null || mx === null || e.year <= mx; });
  }

  function combine(items) {
    var mets = items.filter(function (i) { return truthy(get(i, 'blocking')); }).map(function (i) { return i.met; });
    if (mets.indexOf(false) >= 0) return false;
    if (mets.indexOf(null) >= 0) return null;
    return true;
  }

  function whyNot(result) {
    if (truthy(result.not_computable_reason)) return result.not_computable_reason;
    return result.status === 'not_applicable' ? 'no results this aggregate can use' : result.status;
  }

  // match.py _gate_items: these check types need the aggregate, so "can't be worked out" fails them.
  var AGGREGATE_CHECK_TYPES = ['gross_max', 'net_max', 'constrained'];

  function gateItems(stream, record, result, defn) {
    var elig = {};
    result.eligibility.forEach(function (e) { elig[e.id] = e; });
    var ctype = {};
    get(defn, 'checks', []).forEach(function (c) { ctype[c.id] = c.type; });
    var computed = result.gross !== null;
    var items = [];
    get(stream, 'gates', []).forEach(function (gate) {
      var ids = gate.slice();
      var rep = get(stream, 'nursing_replaces');
      if (truthy(record.is_nursing_diploma) && truthy(get(stream, 'nursing_gate')) && ids.indexOf(rep) >= 0) {
        ids = ids.map(function (i) { return i === rep ? stream.nursing_gate : i; });
      }
      var found = ids.filter(function (i) { return hasOwn(elig, i); }).map(function (i) { return elig[i]; });
      if (!found.length) {
        items.push({id: ids.join('+'), kind: 'gate', label: ids.join(' or '), met: null,
                    detail: 'check not available in the engine result', blocking: true});
        return;
      }
      if (found.length === 1) {
        var e = found[0];
        var met = e.met;
        var detail = e.detail;
        if (met === null && !computed && AGGREGATE_CHECK_TYPES.indexOf(ctype[e.id]) >= 0) {
          met = false;
          detail = result.display_name + " can't be worked out: " + whyNot(result);
        }
        items.push({id: e.id, kind: 'gate', label: e.label, met: met, detail: detail, source: get(e, 'source'), blocking: true});
        return;
      }
      var mets = found.map(function (x) { return x.met; });
      var m2 = mets.indexOf(true) >= 0 ? true : (mets.every(function (x) { return x === false; }) ? false : null);
      var hit = null;
      for (var k = 0; k < found.length; k++) if (found[k].met === true) { hit = found[k]; break; }
      var d2;
      if (hit === found[0]) d2 = hit.detail;
      else if (hit) d2 = hit.label + ': ' + hit.detail;
      else d2 = found.map(function (x) { return x.label + ': ' + x.detail; }).join('; ');
      items.push({id: found.map(function (x) { return x.id; }).join('|'), kind: 'gate',
                  label: found.map(function (x) { return x.label; }).join(' - or - '), met: m2, detail: d2,
                  source: get(found[0], 'source'), blocking: true,
                  conditional: !!(hit && hit.id.indexOf('conditional') >= 0)});
    });
    return items;
  }

  function aggregateItem(aggId, result, blockingIfMissing) {
    var base = {id: 'aggregate', kind: 'aggregate', label: result.display_name, aggregate_id: aggId, met: null};
    if (result.gross !== null) {
      var detail = 'gross ' + result.gross;
      if (result.net !== null && result.net !== result.gross) {
        detail += ', net ' + result.net + ' (bonus ' + (result.gross - result.net) + ')';
      } else if (result.net !== null) {
        detail += ', net ' + result.net;
      }
      var nv = result.net_variants || {};
      Object.keys(nv).sort(cmpStr).forEach(function (k) { detail += '; net ' + nv[k] + ' with ' + replaceAll(k, '_', ' '); });
      base.detail = detail;
      base.blocking = false;
      return base;
    }
    base.detail = "can't be worked out: " + whyNot(result) + (blockingIfMissing ? ' (needed for posting)' : '');
    base.blocking = blockingIfMissing;
    base.cant_be_worked_out = true;
    return base;
  }

  function yn(v) { return v === true ? 'met' : (v === false ? 'not met' : 'unknown'); }

  function merItem(record, stream, entries, result) {
    var mer = record.mer;
    var label = 'Course minimum entry requirements (MER)';
    // match.py _mer_item: DPP / PFP floors use the engine's silent rule, as its own family / cluster checks do
    var silent = mer.mode === 'slots' ? ignoredEntries(S.defsById.get(mer.aggregate_id), entries, entries, result.years_used)[1] : [];
    var ev = evalMer(mer, entries, get(stream, 'mer_total_max'), result.gross, label, silent);
    var item = {id: 'mer', kind: 'mer', label: label, met: ev.met, lines: ev.lines, blocking: true, mode: mer.mode,
                source: get(mer, 'rule_source')};
    if (truthy(ev.alternative_used)) {
      item.alternative_used = ev.alternative_used;
      item.detail = 'met through: ' + ev.alternative_used.label;
    } else if (ev.met === true) {
      item.detail = 'every line met';
    } else if (ev.met === false) {
      item.detail = 'not met: ' + ev.lines.filter(function (l) { return l.met === false; }).map(function (l) {
        return l.id.length === 1 ? l.id + ') ' + l.text : l.text;
      }).join('; ');
    } else {
      item.detail = 'cannot be decided from the published data';
    }
    if (truthy(ev.pdf_variant)) {
      item.pdf_variant = ev.pdf_variant;
      if (hasOwn(ev, 'met_coursefinder')) {
        item.detail = 'CourseFinder and MOE\'s consolidated MER PDF print different MER for this course, and ' +
                      'the answer depends on which is right (CourseFinder: ' + yn(ev.met_coursefinder) + ', PDF: ' +
                      yn(ev.pdf_variant.met) + ')';
      }
    }
    if (mer.mode === 'slots' && !isNone(ev.total)) item.total = ev.total;
    return item;
  }

  /** Requirements to apply for this course beyond the MER (PFP N95's Tamil scores): blocking. */
  function applicationItems(record, entries) {
    return get(record, 'application_requirements', []).map(function (req) {
      var ev = evalIndependent(req.lines, entries);
      return {id: req.id, kind: 'gate', label: req.label, met: ev[0],
              detail: ev[1].map(function (l) { return l.detail; }).join('; '), lines: ev[1], source: req.source,
              decision: get(req, 'decision'), blocking: true};
    });
  }

  /** PSE 2028: eligibility and thresholds only; each course marked as not yet published. */
  function unpublishedItems(ex) {
    return [{id: 'mer', kind: 'mer', label: ex.requirements_note, met: null,
             detail: need(ex, 'requirements_note_detail', 'exercise ' + ex.id),
             source: need(ex, 'requirements_note_source', 'exercise ' + ex.id),
             decision: need(ex, 'requirements_note_decision', 'exercise ' + ex.id), blocking: true}];
  }

  function aggregateFor(stream, record) {
    var a = stream.aggregates;
    var v = hasOwn(a, record.aggregate_type) ? a[record.aggregate_type] : null;
    return truthy(v) ? v : get(a, '*');
  }

  function courseResult(ex, stream, record, byId, entriesAll) {
    var aggId = aggregateFor(stream, record);
    var result = byId.get(aggId);
    var defn = S.defsById.get(aggId);
    var entries = windowEntries(entriesAll, result, defn);
    var reasons = [aggregateItem(aggId, result, get(stream, 'aggregate_gates') === false)];
    gateItems(stream, record, result, defn).forEach(function (g) { reasons.push(g); });
    if (stream.mer === 'course') {
      applicationItems(record, entries).forEach(function (a) { reasons.push(a); });
      reasons.push(merItem(record, stream, entries, result));
    }
    else if (stream.mer === 'unpublished') unpublishedItems(ex).forEach(function (u) { reasons.push(u); });
    var flags = record.data_flags.slice();
    var netRange = get(record, 'net_range_2026');
    var basis = null;
    if (get(stream, 'net_range') === 'none' || get(ex, 'net_range') === 'none') {
      netRange = null;  // PFP: the row's range is JAE's; PSE 2028: no cut-off comparison
    } else if (truthy(netRange)) {
      basis = result.display_name;  // the 2026 range is on this exercise's own (2026) aggregate
    }
    if (get(ex, 'course_list') === '2026') flags.push('course_list_2026');  // match.py literal
    if (truthy(get(stream, 'aggregate_map_source'))) flags.push('aggregate_type_mapped_from_2026');  // match.py literal
    return {
      exercise: ex.id, exercise_label: ex.label, institution_type: record.institution_type,
      institution: record.institution, course_code: record.course_code, course_name: record.course_name,
      field_of_study: get(record, 'field_of_study', ''), aggregate_id: aggId,
      aggregate_display_name: result.display_name, gross: result.gross, net: result.net,
      net_range_2026: isNone(netRange) ? null : netRange.slice(), eligible: combine(reasons), reasons: reasons,
      moe_url: record.moe_url, institution_url: record.institution_url, data_flags: flags, stream: stream.name,
      route: record.route, ite_course_code: get(record, 'ite_course_code', ''), jc_stream: get(record, 'stream', ''),
      pfp_cluster: get(record, 'pfp_cluster', ''), aggregate_type: record.aggregate_type,
      aggregate_status: result.status, net_range_basis: basis,
      requirements_note: stream.mer === 'unpublished' ? get(ex, 'requirements_note', '') : '',
      notes: get(record, 'notes', []).slice(), requirement_key: record.key
    };
  }

  function matchPrepared(p, bonusInputs, exercises) {
    var wanted = isNone(exercises) ? S.exerciseIds : Array.prototype.slice.call(exercises);
    var unknown = wanted.filter(function (e) { return S.exerciseIds.indexOf(e) < 0; });
    if (unknown.length) {
      throw new Error('unknown exercise id(s) ' + pyRepr(unknown) + '; known: ' + pyRepr(S.exerciseIds));
    }
    var results = computePrepared(p, bonusInputs, null, true);
    var byId = new Map();
    results.forEach(function (r) { byId.set(r.id, r); });
    var out = [];
    S.exercises.forEach(function (ex) {
      if (wanted.indexOf(ex.id) < 0) return;
      ex.streams.forEach(function (stream) {
        S.records.forEach(function (rec) {
          if (stream.institution_types.indexOf(rec.institution_type) >= 0 && rec.route === stream.route) {
            out.push(courseResult(ex, stream, rec, byId, p[0]));
          }
        });
      });
    });
    return out;
  }

  function match(subjects, bonusInputs, exercises) {
    requireLoaded();
    return matchPrepared(prepareEntries(subjects), isNone(bonusInputs) ? null : bonusInputs, exercises);
  }

  function matchReport(subjects, bonusInputs, exercises) {
    requireLoaded();
    var p = prepareEntries(subjects);
    var res = matchPrepared(p, isNone(bonusInputs) ? null : bonusInputs, exercises);
    var summary = new Map();
    res.forEach(function (r) {
      var k = r.exercise + '\u0000' + r.stream;
      if (!summary.has(k)) {
        summary.set(k, {exercise: r.exercise, stream: r.stream, courses: 0, eligible: 0, unknown: 0, not_eligible: 0});
      }
      var s = summary.get(k);
      s.courses += 1;
      s[r.eligible === true ? 'eligible' : (r.eligible === null ? 'unknown' : 'not_eligible')] += 1;
    });
    return {engine_version: S.engineVersion, matcher_version: S.matcherVersion,
            input_problems: p[2].map(shallow), warnings: p[1].slice(),
            summary: Array.from(summary.values()), results: res};
  }

  // ============================================================================================ public API
  var PSE = {
    load: load,
    checkInputs: checkInputs,
    computeAll: computeAll,
    compute: compute,
    match: match,
    matchReport: matchReport,
    /** {engine, matcher} versions of the loaded data. */
    versions: function () { requireLoaded(); return {engine: S.engineVersion, matcher: S.matcherVersion}; },
    /** The exercises and their streams (requirements.exercises). */
    exercises: function () { requireLoaded(); return S.exercises; },
    /** JCs hosting CLEP / MLEP / TLEP (app/build/data.json "lep_hosts"): [{jc, programme, source, quote, note}]. */
    lepHosts: function () { requireLoaded(); return S.lepHosts; },
    /** The course table (app/build/data.json "courses"), one row per course offering. */
    courses: function () { requireLoaded(); return S.courses; },
    /** The course row behind a CourseResult (by its requirement_key), or null. */
    courseOf: function (requirementKey) {
      requireLoaded();
      if (!S.courseByKey) {
        var byId = new Map();
        S.courses.forEach(function (c) { byId.set(c.id, c); });
        S.courseByKey = new Map();
        S.records.forEach(function (r) { S.courseByKey.set(r.key, byId.get(r.course_id) || null); });
      }
      return S.courseByKey.has(requirementKey) ? S.courseByKey.get(requirementKey) : null;
    },
    /** One aggregate definition by engine ID (definitions.json), or null. */
    definition: function (id) { requireLoaded(); return S.defsById.has(id) ? S.defsById.get(id) : null; },
    /** The subject catalogue (for a subject picker). */
    subjects: function () { requireLoaded(); return S.subjects; },
    /** Subject name -> catalogue id (null if unknown); the engine's own name matching. */
    resolveSubject: function (name, level) {
      requireLoaded();
      return isNone(level) ? resolveSubject(name) : resolveSubjectAt(name, normaliseLevel(level) || level)[0];
    },
    /** Level text -> 'G3' / 'G2' / 'G1' or null. */
    normaliseLevel: function (level) { requireLoaded(); return normaliseLevel(level); },
    _internal: {pyRepr: pyRepr, pyStr: pyStr, pyRe: pyRe, norm: function (n) { requireLoaded(); return norm(n); }}
  };
  return PSE;
}));
