(function () {
  'use strict';
  const nojs = document.getElementById('nojs');
  if (nojs) nojs.remove();

  const APP_VERSION = "0.14.4";
  const APP_DISPLAY_NAME = "Rosetta: Student Pathway Atlas";
  const STORE_KEY = 'rosetta-sg-pse-atlas-v0.3';

  /* ================================================================================================ data */
  function readJSON(id) {
    const el = document.getElementById(id);
    try { return el ? JSON.parse(el.textContent) : {}; } catch (e) { return {}; }
  }
  const DATA = readJSON('pse-data');
  const PAGE = readJSON('page-data');
  const DEF_ROOT = (DATA.definitions && DATA.definitions.definitions) ? DATA.definitions : { definitions: DATA.definitions || [] };
  const DEFS = {};
  (DEF_ROOT.definitions || []).forEach(function (d) { DEFS[d.id] = d; });
  const SCALES = DEF_ROOT.scales || {};
  const CATALOGUE = DEF_ROOT.subjects || [];
  const GRADE_ORDER = (DEF_ROOT.levels && DEF_ROOT.levels.grade_order) ||
    { G3: ['A1', 'A2', 'B3', 'B4', 'C5', 'C6', 'D7', 'E8', 'F9'], G2: ['1', '2', '3', '4', '5', '6'], G1: ['A', 'B', 'C', 'D', 'E', 'U'] };
  const MTL_B_GRADES = ['Merit', 'Pass', 'Ungraded'];
  const MARK_BANDS = DEF_ROOT.mark_bands || {};
  // requirement records by key, with their course row's fields (data.json keeps the MERs, notes and course rows once)
  const REQ = DATA.requirements || {};
  const RECS = {};
  (function () {
    const recs = Array.isArray(REQ) ? REQ : (REQ.records || []);
    const C = DATA.courses;
    const rows = !C ? [] : Array.isArray(C) ? C : (C.rows || []).map(function (row) {
      const o = {};
      (C.columns || []).forEach(function (col, i) { o[col] = row[i]; });
      return o;
    });
    recs.forEach(function (r) {
      if (!r || !r.key) return;
      if (REQ.mers && typeof r.course === 'number') {
        RECS[r.key] = Object.assign({}, rows[r.course] || {}, { key: r.key, route: r.route, mer: REQ.mers[r.mer],
          application_requirements: r.application_requirements || [] });
      } else RECS[r.key] = r;
    });
  })();
  const INSTITUTIONS = PAGE.institutions || [];
  const SCHOOLS = PAGE.schools || [];
  const POLY_SCHOOLS = PAGE.poly_schools || {};
  const CAL = PAGE.calendar || { terms: [], fills: [], rows: [] };
  const ARTS = PAGE.arts || [];
  const RIASEC_OF = {};  // MOE field (or JC/MI stream) -> letters, our suggestion (data/taxonomy/riasec_fields.csv)
  (PAGE.riasec || []).forEach(function (r) { RIASEC_OF[r.field] = String(r.letters || '').toUpperCase(); });
  // the engine contract: LEP host JCs, when the data carries them (absent: LEP points are never added to a number)
  const LEP_HOSTS = Array.isArray(DATA.lep_hosts) ? DATA.lep_hosts :
    (REQ && Array.isArray(REQ.lep_hosts) ? REQ.lep_hosts : null);

  let CORE_OK = false;
  try {
    if (window.PSE && typeof window.PSE.load === 'function') {
      window.PSE.load({ definitions: DATA.definitions, requirements: DATA.requirements, courses: DATA.courses });
      CORE_OK = typeof window.PSE.matchReport === 'function' && typeof window.PSE.computeAll === 'function';
    }
  } catch (e) { CORE_OK = false; }

  /* ================================================================================================ words */
  const STRINGS = {
    yearHead: 'Exam year',
    year: { 2026: '2026 exams', 2027: '2027 exams' },
    yearAria: { 2026: 'Results from the 2026 exams: O-Level or N-Level', 2027: 'Results from the 2027 exams: SEC' },
    levelHead: 'Level of most subjects',
    levelShort: { 'O': 'O', 'N(A)': 'N(A)', 'N(T)': 'N(T)', G3: 'G3', G2: 'G2', G1: 'G1' },
    levelName: { 'O': 'O-Level', 'N(A)': 'N(A)', 'N(T)': 'N(T)', G3: 'G3', G2: 'G2', G1: 'G1' },
    subjects: 'Subjects',
    grades: 'Grades', marks: 'Marks',
    didntTake: "I didn't take this",
    changeWord: 'change', changeSubject: function (n) { return 'Change the subject: ' + n; },
    notTaken: 'not taken',
    coveredBy: function (names) { return 'covered by ' + joinAnd(names); },
    alsoTook: 'Also took:',
    edit: 'Edit',
    other: 'Other',
    addHead: '+ Add a subject',
    addSearch: 'Another subject',
    addPlaceholder: 'Type a subject name',
    addTyped: function (t) { return 'Add “' + t + '” as typed'; },
    typeMore: 'Type at least 2 letters.',
    remove: function (n) { return 'Remove ' + n; },
    paste: 'Paste your results',
    pasteHint: 'Paste your subjects and grades in one line. It replaces the grades below.',
    pasteRead: 'Read this line',
    pasteDone: function (n, list) { return 'Read ' + n + ' ' + (n === 1 ? 'subject' : 'subjects') + ': ' + list + '.'; },
    pasteNone: 'No subject could be read from this line.',
    pasteUnread: 'These parts could not be read, so they are not in the list:',
    bandsInfo: function (top, grade) { return 'Marks become grades with the usual school bands (' + top + ' and above is ' + grade + '). Your exam grades come from SEAB.'; },
    cca: 'CCA',
    ccaOpts: ['Excellent', 'Good', 'Fair', 'None', 'Not sure'],
    whereHead: 'What are you looking at?',
    whereOpts: { jc: 'JC', mi: 'MI', poly: 'Polytechnic', ite: 'ITE', arts: 'Arts (NAFA, LASALLE)' },
    school: 'Your secondary school',
    schoolOpt: 'Your secondary school (optional)',
    schoolWhy: 'Used to work out affiliation points for your affiliated JC.',
    schoolPlaceholder: 'Type part of its name',
    schoolNone: function (q) { return 'No school matches “' + q + '”.'; },
    schoolClear: 'Clear the school',
    affiliated: 'Affiliated JC:',
    lepHead: 'Language elective programme',
    lepOpts: ['None', 'CLEP', 'MLEP', 'TLEP'],
    fieldsHead: 'Fields (optional)',
    fieldsPicked: function (n) { return 'Fields: ' + n + ' picked'; },
    interests: 'Interests', optional: 'optional',
    riasecNames: { R: 'Realistic', I: 'Investigative', A: 'Artistic', S: 'Social', E: 'Enterprising', C: 'Conventional' },
    yourCode: function (c) { return 'Your code: ' + c.join(' '); },
    quiz: 'Take the quiz on MySkillsFuture',
    quizUrl: 'https://www.myskillsfuture.gov.sg/content/student/en/secondary-v2/discover-yourself.html',
    show: 'Show my courses',
    // the step after the subjects, and the subjects card folded to one line
    calc: 'Calculate my aggregates',
    ccaShort: function (c) { return c && c !== 'Not sure' ? 'CCA ' + c : ''; },
    subjShort: { 'English Language': 'EL', 'Chinese': 'CL', 'Malay': 'ML', 'Tamil': 'TL', 'Higher Chinese': 'HCL', 'Higher Malay': 'HML',
      'Higher Tamil': 'HTL', 'Mathematics': 'Math', 'Additional Mathematics': 'A Math', 'Principles of Accounts': 'POA', 'Social Studies': 'SS',
      'Geography': 'Geog', 'History': 'Hist' },
    // a pasted name the engine does not know is never counted until it is fixed
    unknownSubject: function (name) { return 'Not a subject we know: ' + name + '. Pick the subject or remove it.'; },
    pickSubject: 'Pick the subject', pickSubjectFor: function (n) { return 'Pick the subject for ' + n; },
    pasteUnknown: function (list) { return (list.length === 1 ? '1 name we don\'t know: ' : list.length + ' names we don\'t know: ') + list.join('; ') + '.'; },
    didYouMean: function (n) { return 'did you mean ' + n + '?'; },
    oneGrade: ', one grade',
    rowNeed: { markBad: 'Type a mark from 0 to 100.' },
    gradeCleared: function (g, scale) { return 'Grade cleared, because ' + g + ' is not ' + (/^[AEIOU]/.test(scale) ? 'an ' : 'a ') + scale + ' grade.'; },

    // Screen 2
    strip: function (lv, n, cca) { return lv + ' · ' + n + ' ' + (n === 1 ? 'subject' : 'subjects') + (cca ? ' · CCA ' + cca : ''); },
    nextLine: 'Next:',
    by: function (d) { return 'by ' + d; },
    search: 'Search courses',
    chip: { field: 'Field', inst: 'Institution', sort: 'Sort', map: 'Map', filter: 'Filter' },
    // the bar on Courses, the route chips, a tile's pop-over and About
    groupBy: 'Group', groupOpts: { none: 'None', field: 'Field', inst: 'Institution' },
    showN: function (n) { return 'Show ' + n + ' more'; },
    cntWords: function (i, b) { return i + ' within reach, ' + b + ' borderline'; },
    cntCan: function (n) { return n + ' you can apply for'; },
    showing: 'Showing',
    routeHide: function (r) { return 'Hide ' + r; }, routeAdd: function (r) { return 'Show ' + r; },
    grossOnly: function (n) { return 'Yours is ' + n + '. Bonus points don\u2019t count for this.'; },
    youTake: function (n, at) { return 'You take ' + n + at + '.'; },
    aboutHead: 'About', aboutApp: 'About this app', aboutResults: 'Your results',
    aboutAppLine: 'Not an MOE app. Course data from MOE CourseFinder, 17 Oct 2026.',
    sorts: { comp: 'Most competitive first', fit: 'Fits your interests first', name: 'Course name' },
    divider: { none: 'No published cut-off', unsure: 'Not sure', noFig: 'No 2026 figure, so no estimate' },
    yourNetAgg: function (v) { return 'Your net aggregate: ' + v; },
    yourNetAggOf: function (agg) { return 'Your net ' + agg + ' aggregate:'; },
    yourGrossAggOf: function (agg) { return 'Your gross ' + agg + ' aggregate:'; },
    // one pill when every stream has the same gap: "+6 for all three streams"
    allStreams: function (n) { return n === 2 ? 'for both streams' : 'for all ' + (['', '', 'two', 'three', 'four', 'five'][n] || n) + ' streams'; },
    rangeNone: function (ex, agg) { return (ex ? ex + ' ' : '') + agg + ' net aggregate: not published'; },
    pfpMeets: 'You meet the entry requirements.',
    pfpShare: function () { return 'Polytechnic Foundation Programme: you meet the entry requirements. ' + STRINGS.pfpNoCut.split('. ')[0] + '.'; },
    condLine: function (t) { return 'On condition: ' + t; },
    unsureLine: function (who) { return 'Not sure: check with the ' + who + '.'; },
    cantLine: function (t) { return "Can't apply: " + t; },
    colRange: function () { return S.year === 2027 ? 'Estimated 2028 net aggregate range' : '2026 net aggregate range'; },
    colNet: 'Your net aggregate',
    showNo: function (n) { return 'Show ' + n + " you can't apply for"; },
    hideNo: "Hide the ones you can't apply for",
    // the fold says what is inside it: courses you are short for, or more you clear
    showNoRange: function (n) { return 'Show ' + n + (S.year === 2027 ? ' with no 2026 figure' : ' with no published cut-off'); },
    noStream: 'Not offered here',
    jcCut: function (agg) { return (S.year === 2027 ? 'Estimated 2028 cut-off (' : '2026 cut-off (') + agg + ' net)'; },
    // the table's head names the aggregate ("L1R4 net") where it said "JC" again; the caption above it says
    // only what the line above doesn't (2027: nothing, the estimate line says it; 2026: "2026 cut-off")
    jcHead: function (agg) { return agg + ' net'; },
    yourNetOf: function (agg, v) { return 'Your net ' + agg + ': ' + v; },
    sortBy: 'Sort by',
    showFewer: 'Show fewer',
    // the overview grid at the top of Polytechnic Year 1 and the ITE Higher Nitec sections
    ogWithin: 'within reach', ogBorder: 'borderline',
    ogLegend: ['Courses within reach or borderline.', 'Green', 'at least one within reach.', 'Amber', 'borderline only.'],
    ogHint: { poly: 'Tap a number, a field or a polytechnic.', ite: 'Tap a number, a field or a college.' },
    ogNone: 'No course here is within reach or borderline.',
    ogBack: '‹ Overview', ogField: 'Field', showAll: 'Show all',
    ogCell: function (f, i, n) { return f + ' at ' + i + ': ' + n; },
    ogAll: function (i) { return 'Everything at ' + i; },
    // the margin groups, "what you're missing", the tiles and the near miss
    grp: { in: 'Within reach', border: 'Borderline' },
    outFold: function (n) { return 'Out of reach: ' + n + ' more'; },
    grpRule: 'Within reach: 2 or more points better than the cut-off. Borderline: within 1 point. Out of reach: 2 or more points short.',
    missSafer: 'One point better would make it safer.',
    missOne: function () { return S.year === 2027 ? 'One point short of the estimated cut-off.' : 'One point short of last year’s cut-off.'; },
    missShort: function (n) { return n + ' points short.'; },
    tileOpen: '✓ open', tileNeeds: function (n) { return '✗ needs ' + n; }, tileNo: '✗ not open',
    // a closed tile with no number says why, in short, from MOE's table (the open-to group) or the engine's reason
    tileWhy: { '5G3': 'Needs G3 subjects', '4G3+1G2': 'Needs G3 subjects', '5G2': 'Needs G2 subjects', '4G1': 'Needs 4 subjects', mtl: 'Needs Mother Tongue' },
    tileLevels: function (lvs) { return 'Needs ' + lvs.join(' or ') + ' subjects'; },
    tileMore: function (n) { return 'Needs ' + n + ' subjects'; },
    tileGrade: function (g) { return 'Needs grade ' + g + ' or better'; }, tileGrades: 'Needs better grades',
    nmAgg: function (k, route) { return (k === 1 ? 'One point' : k + ' points') + ' better opens ' + route + '.'; },
    nmExample: function (subj, to, from) { return 'For example, ' + subj + ' ' + to + ' instead of ' + from + '.'; },
    nmReq: function (subj, to, from, route) { return subj + ' ' + to + ' instead of ' + from + ' opens ' + route + '.'; },
    nmBtn: 'What if?',
    nmDone: function (subj, to) { return subj + ' changed to ' + to + '.'; },
    cantAny: function (what) { return "You can't " + what + ' with these results.'; },
    dppIntro: 'Two years of Higher Nitec at ITE. With a good enough GPA, you then get a place in a related polytechnic diploma.',
    dppLink: 'DPP on the MOE website', aboutDpp: 'About DPP',
    dppUrl: 'https://www.moe.gov.sg/post-secondary/admissions/dpp',
    pseNote: 'Cut-offs for 2028 are not published yet.',
    // B4: estimated 2028 cut-offs, always labelled as estimates
    est2028: 'Estimated 2028',
    // the pill's words for screen readers
    pillWords: function (n) { return n > 0 ? n + (n === 1 ? ' point' : ' points') + ' better than the cut-off' : n < 0 ? (-n) + (n === -1 ? ' point' : ' points') + ' short of the cut-off' : 'On the cut-off'; },
    // "(from 2026)", or "(from 2026 O-Level cut-offs)" for the ITE 2-year ranges converted from O-Level ones
    estFrom: function (basis) { return basis === 'olevel' ? '(from 2026 O-Level cut-offs)' : '(from 2026)'; },
    // one wording for "no figure", on every screen
    noFigure: 'No 2026 figure, so no estimate',
    artsNoCut: 'NAFA and LASALLE do not publish cut-offs. If you meet the minimum, you can apply.',
    ibFold: { out: 'out of reach', no: "can't apply" },
    // one line for the course, however many streams: "Worked out from the 2026 L1R5 ranges, Arts 6–10 and Science 3–7: …"
    estHow: function (from, ranges, agg, basis, same) {
      const why = basis === 'olevel' ? 'each O-Level grade is turned into its G2 grade, so this is a rough estimate.'
        : basis === 'jie' ? 'the 2028 aggregate uses the same grade scale, so the range is used as it is.'
        : /^L1R4/.test(agg) ? (from === 'L1R4' ? 'MI counts the same five subjects, so the range is used as it is.' : 'five subjects now count instead of six.')
        : 'the second of the best 2 other subjects can now be a G2 subject.';
      const asIs = basis === 'jie' || (/^L1R4/.test(agg) && from === 'L1R4');
      return 'Worked out from the 2026 ' + from + (asIs || same ? (ranges.length > 1 ? ' ranges' : ' range') : ranges.length > 1 ? ' ranges, ' + joinAnd(ranges) : ' range, ' + ranges[0]) + ': ' + why;
    },
    estShare: function (agg, list, basis) { return 'Estimated 2028 ' + agg + ' net aggregate ' + STRINGS.estFrom(basis) + ': ' + list; },
    ite3Scale: 'On this scale every G3 or G2 subject counts as the top grade, so 4 subjects give 4 points before CCA.',
    pfpNoCut: 'PFP has no cut-offs. Meet the requirements and you can apply.',  // r4 Q2: the one PFP sentence (share, table and Details take its first part)
    jieONoCut: "JIE 'O' does not publish cut-offs. If you meet the requirements, you can apply.",
    remindNet: function (agg, v) { return 'Your net ' + agg + ': ' + v; },
    remindGross: function (agg, v) { return 'Your gross ' + agg + ': ' + v; },
    remindOne: function (agg, v) { return 'Your ' + agg + ': ' + v; }, noBonus: 'no bonus',
    remindBonus: function (g, parts) { return ' (gross ' + g + parts + ')'; },
    remindNets: function (txt) { return 'Your net ' + txt; },
    pfpNeeds: function (g, max) { return 'Your gross ELMAB3: ' + g + ' (PFP needs ' + max + ' or better)'; },
    instAll: function (n, noun) { return 'All ' + n + ' ' + noun; },
    instSome: function (k, n, noun) { return k + ' of ' + n + ' ' + noun; },
    instNoun: { jc: 'JCs', poly: 'polys', ite: 'ITE colleges' },
    fieldsAll: 'All fields',
    fieldsSome: function (n) { return n + (n === 1 ? ' field' : ' fields'); },
    allWord: 'All', noneWord: 'None',
    openTo: function (path, need, have) { return path + ' is open to students taking at least ' + need + '. You take ' + have + '.'; },
    another: 'Another route', others: 'Other routes',
    noMatch: function (parts) { return 'No courses match ' + parts + '.'; },
    clearFilters: 'Clear filters',
    removeFilter: function (n) { return 'Remove the filter ' + n; },
    done: 'Done',
    close: 'Close',
    sheetFields: 'Fields', sheetInst: 'Institutions', sheetSort: 'Sort',
    instTypes: { JC: 'Junior colleges', MI: 'Millennia Institute', Polytechnic: 'Polytechnics', ITE: 'ITE colleges', Arts: 'Arts institutions' },

    // the gap badge (D8) and the states (D7)
    canApply: 'You can apply',
    state: { cond: 'On condition', unsure: 'Not sure', no: "Can't apply", meets: 'Meets the minimum', below: 'Below the minimum' },
    checkWith: function (inst) { return 'Check with ' + inst; },
    // the 5th-year tile (MOE, PSE pathways: "5th year in secondary school")
    fifthMeets: 'Meets the criteria',
    fifthFig: function (agg, n, max) { return 'Your gross ' + agg + ' at G2: ' + n + ' (a 5th year needs ' + max + ' or better).'; },
    fifthA: "You have 3 or more G3 passes, and you don't qualify for JC, MI or a polytechnic diploma.",
    fifthAllG3: function (max) { return 'With ' + max + ' or better, you can take all your subjects at G3.'; },
    fifthNotAllG3: function (max) { return 'To take all your subjects at G3, you need an ELMAB3 of ' + max + ' or better.'; },
    fifthSchool: 'Your school handles the application.',
    applyDirect: function (inst) { return 'Apply to ' + inst + ' directly'; },
    fits: 'Fits your interests',
    fitInfo: 'Courses that often suit your RIASEC code are shown first. This is only a guide.',
    starAria: function (t) { return 'Star ' + t; },
    toastStarred: 'Starred', toastUnstarred: 'Removed from Starred', undo: 'Undo',
    mark: { yes: '✓', cond: '!', unsure: '?', no: '✗', notyet: '…' },

    // Screen 3
    back: { courses: '‹ Courses', starred: '‹ Starred' },
    tabs: { input: 'Results', courses: 'Courses', starred: 'Starred', dates: 'Dates' },
    star: '☆ Star', starred: '★ Starred',
    uses: function (name) { return 'Uses ' + name; },
    counted: 'Which subjects counted',
    total: 'Total',
    noBonus: function (n) { return 'No bonus points, so your net score is ' + n + '.'; },
    capped: function (cap) { return '(bonus points are capped at ' + cap + ')'; },
    affShort: 'affiliation (1st, or 1st and 2nd, choice only)',
    lepShort: function (p) { return p + ' (only if posted to its ' + p + ')'; },
    forThisJC: 'for this JC',
    notCounted: function (s) { return 'Not counted: ' + s + '.'; },
    notCountedSilent: 'Check with your teacher.',
    affNote: function (n) { return 'Includes ' + n + ' ' + (n === 1 ? 'point' : 'points') + ' for affiliation: 1st, or 1st and 2nd, choice only.'; },
    affCapped: function (cap) { return 'Affiliation adds no points for you, because bonus points are capped at ' + cap + '.'; },
    lepNote: function (n, prog) { return 'Includes ' + n + ' points for ' + prog + ', only if you are posted to this JC’s ' + prog + '.'; },
    lepMaybe: 'You get 2 more bonus points if you are placed in its language elective programme.',
    entryLines: "The course's entry requirements",
    // met requirements read the same in both years and for every kind of course
    allMet: function () { return STRINGS.pfpMeets.replace(/\.$/, ''); },
    resitHead: 'What on condition means',
    resit: {
      jc: 'If you are conditionally admitted to a JC course, you must sit for the specific subject again and obtain the required grade by the end of Year 1 in JC. If you fail to do so, you will be transferred to Year 2 of a course in MI.',
      mi: 'If you are conditionally admitted to an MI course, you must sit for the specific subject again and obtain the required grade by the end of Year 1 in MI. If you do not obtain it, you will be given another year to sit for the subject.',
      source: 'MOE, JAE: Junior colleges and Millennia Institute',
      url: 'https://www.moe.gov.sg/post-secondary/admissions/jae/junior-colleges-and-millennia-institute'
    },
    cf: 'CourseFinder', sf: 'SchoolFinder', coursePage: 'Course page', schoolSite: 'School website',
    notInList: 'This course is not in your list now.',
    minimum: 'Minimum entry requirement',
    addMarksFor: function (names, agg) { return 'Add marks for ' + joinAnd(names) + ' to work out your ' + agg + '.'; },
    gradeOrMark: function (g) { return g + ' — or type a mark'; },
    examinedOnly: function (n, lv) { return n + ' is examined at ' + lv + ' only. Change its level.'; },
    artsEnglish: 'English needs C6 or better.',
    artsEnglishNfp: function () { return S.year === 2027 ? 'English needs G2 grade 3 or better.' : 'English needs N(A) grade 3 or better.'; },
    noEnglish: 'You have no English grade.',
    yoursIs: function (v) { return 'Yours is ' + v + '.'; },
    artsMin: function (max) { return 'The minimum is ' + max + ' points or better in 4 other subjects.'; },
    artsMinNfp: function (max) { return 'The minimum is an ELMAB3 of ' + max + ' or better, without CCA points.'; },
    artsNa: 'The NAFA Foundation Programme is for students with N(A)-Level results.',
    artsOther: 'One of the minimum entry requirements is not met.',
    nfpInterview: 'NAFA may still consider an N(A) English grade of 4 or 5, with an interview, case by case.',
    programmes: 'Programmes',
    leadsTo: function (n) { return 'Leads to ' + n + ' ' + (n === 1 ? 'diploma' : 'diplomas'); },
    cfNotes: 'Notes from CourseFinder',
    cfNotesLinks: 'The course page has the links these notes mention.',
    cfNotesMedical: 'See the course page for the medical requirements.',

    // Starred and Compare (D11)
    starredHead: 'Starred',
    starredEmpty: 'Tap ☆ to keep a course here.',
    cols: { course: 'Course', inst: 'Institution', net: 'Your net', cut: "Last year's cut-off", gap: 'Difference', link: 'Link' },
    share: function (n) { return 'Share (' + n + ')'; },
    copy: 'Copy text', whatsapp: 'Open WhatsApp', copied: 'Copied', copyFailed: 'The text is selected. Copy it from here.',
    shareHead: 'My course shortlist:',
    starredHeadWide: 'Starred — compare',
    osShare: 'More ways to share',
    bestAt: function (c) { return 'best: ' + c; },
    affiliatedTag: 'Affiliated',

    // Key dates (D14)
    datesHead: 'Key dates',
    allEx: 'All exercises', forMe: 'For me', exWhich: 'Exercises shown',  // a two-way choice, "For me" first
    closed: function (n) { return 'Already closed (' + n + ')'; },
    expected: 'expected',
    tentative: 'tentative',
    from: function (d) { return 'From ' + d; },
    sources: 'Sources',
    termStarts: function (n) { return 'Term ' + n + ' starts'; },
    legendSolid: 'Solid bar: dates published.',
    legendOutline: 'Outlined bar: another exercise, named by its tag.',
    legendDashed: 'Dashed bar: expected dates, worked out from last year.',
    nothingDated: 'MOE has not published these dates yet.',

    // the 2027 exams (D13)
    meets2028: 'You meet the 2028 criteria',
    closedWith: function (t) { return 'Closed: ' + t; },
    mtlNeeded: function (who) { return who + ' needs a pass in Mother Tongue Language.'; },
    mtlMark: 'Add your Mother Tongue Language mark to check.',
    onCondition: function (t) { return 'On condition: you do not meet the grade requirement for ' + t + '.'; },
    ovNote: "MOE's note",
    ovAll: "MOE's table for all students",
    aggsHead: 'Your aggregates', pathwaysHead: 'Your pathways', openAria: 'Open to you',
    routeShort: { jc: 'JC', mi: 'MI', poly: 'Polytechnic', ite: 'ITE', arts: 'Arts' },
    coursesWord: function (n) { return n === 1 ? 'course' : 'courses'; },
    notOpenFold: function (n) { return n + ' not open to you'; },
    notOpenLine: function (names) { return 'Not open to you: ' + names.join(', '); },
    alsoOpen: 'Also open to you',
    indicative: 'indicative', noCutTag: 'no cut-off',
    indTip26: function (ex, cut) { return 'Last year’s range: the net aggregates of the students admitted in the ' + ex + '. The top number, ' + cut + ', was the cut-off. A lower aggregate is better.'; },
    indTip27: function (how) { return 'An estimate from the 2026 cut-offs. ' + how; },
    indTipJC: function (how) { return S.year === 2027 ? 'Each number is an estimate of the JC’s 2028 cut-off. ' + how : 'Each number is the JC’s 2026 cut-off: the net aggregate of the last student admitted in the 2026 JAE. A lower aggregate is better.'; },
    indPill: 'The coloured number is how far your aggregate is from the cut-off: +4 is 4 points better, −2 is 2 points short.',
    // not yet in any of MOE's groups: "You are taking 3 subjects at G3. MOE's routes start at 4 subjects at G1 or higher, so 1 more is needed."
    placeNeed: function (p) {
      const parts = [];
      if (p.n3) parts.push(p.n3 + ' at G3'); if (p.n2) parts.push(p.n2 + ' at G2'); if (p.n1) parts.push(p.n1 + ' at G1');
      const need = Math.max(1, 4 - p.total);
      return (parts.length ? 'You are taking ' + parts.join(', ').replace(/^(\d+) at/, function (_, n) { return n + (n === '1' ? ' subject at' : ' subjects at'); }) + '. ' : '') +
        "MOE's routes start at 4 subjects at G1 or higher, so " + (need === 1 ? '1 more subject is' : need + ' more subjects are') + ' needed.';
    },
    addToList: function (route) { return 'Add ' + route + ' to my list ›'; },

    // footer and About (D16)
    foot: 'Not an MOE app',
    data: 'CourseFinder data, 17 Oct 2026',
    about: 'About these numbers',
    saved: 'Saved on this device only',
    caution: 'These aggregate scores are meant as a reference for applicants applying to these courses, and do not constitute the admission scores for subsequent admission exercises.',
    cautionSrc: 'MOE, JAE 2027 booklet',
    cautionUrl: 'https://www.moe.gov.sg/post-secondary/admissions/jae',
    // r1 D14: in 2027 the ranges on screen are estimates
    aboutEst: 'In the 2027 view, the ranges for JCs, MI, polytechnic diplomas and ITE courses are estimated 2028 ranges, worked out from the 2026 ones until MOE publishes the 2028 figures. The ITE 2-year ranges taken from O-Level cut-offs are rough conversions.',
    aboutParas: [
      'Your gross aggregate adds up the grade points of the subjects that count for the course. Your net aggregate is the gross aggregate minus any bonus points, such as CCA points. A lower aggregate is better.',
      'The range, for example 4–11, shows the net aggregates of the students admitted in the 2026 JAE or JIE. The higher number, 11, is the cut-off: the last student admitted had a net aggregate of 11.',
      'If your net aggregate is 7, it is 4 points better than the cut-off, shown as +4. A minus number such as −2 means you are 2 points short of the cut-off. Cut-offs change every year, so use them as a guide.'
    ],
    aboutLines: [
      '',
      'Your results slip and the forms from MOE and your school are the official record.',
      'Marks become grades with the usual school bands. Your exam grades come from SEAB.',
      'Courses that often suit your RIASEC code are shown first. This is only a guide.',
      'The table that links RIASEC letters to fields is our suggestion, from Holland’s descriptions of the six types.'
    ],
    aboutSources: 'Courses, entry requirements and ranges: MOE CourseFinder and SchoolFinder, 17 Oct 2026. Dates: MOE, ITE, NAFA and LASALLE pages, 18 Oct 2026.',

    // Start again (D12)
    restart: 'Start again',
    confirm: function (n) { return 'Clears your results' + (n ? ' and ' + n + ' starred ' + (n === 1 ? 'course' : 'courses') : '') + '.'; },
    clear: 'Clear', cancel: 'Cancel',
    // a teacher moves to the next student without losing the year, level and choices
    g2Mapped: function (p, slot) { return ' → ' + p + ' at G2 (' + slot + ' uses the G2 grade)'; },
    // "Next student" clears the stars too, says how many, and has no Undo
    nextStudent: 'Next student',
    nextStudentHint: function (n) { return 'Clears the results' + (n ? ', CCA and ' + n + ' starred ' + (n === 1 ? 'course' : 'courses') : ' and CCA') + '. Keeps the exam year, level and choices.'; },
    cleared: 'Your results are cleared.',

    // map (D17)
    mapHead: 'Map',
    mapTap: 'Tap a dot or a name to show only that institution’s courses.',
    mapList: function (n) { return 'See the list (' + n + ') ›'; },
    mapType: { JC: 'JC', MI: 'Millennia Institute', Poly: 'Polytechnic', ITE: 'ITE college' },
    mapNone: 'No course you can apply for',
    mapDot: function (name, n) { return name + ': ' + n + ' ' + (n === 1 ? 'course' : 'courses') + ' you can apply for'; },
    mapDotBrowse: function (name) { return name + ': courses to browse'; },
    mapLocations: 'Locations: addresses from MOE SchoolFinder and each institution’s website, 17 Oct 2026.',

    // states of the page (D18)
    coreMissing: 'The calculator did not load, so this page cannot work out scores. Download the file again, or ask the person who shared it.',
    engineError: 'Something went wrong while working out your scores. Try Start again.',
    enterFirst: 'Enter your results first.',
    toInput: 'Go to your results'
  };

  /* ================================================================================================ subjects and levels */
  const LEVEL = {
    'O': { label: 'O-Level', scale: 'G3' }, 'N(A)': { label: 'N(A)-Level', scale: 'G2' }, 'N(T)': { label: 'N(T)-Level', scale: 'G1' },
    'G3': { label: 'G3', scale: 'G3' }, 'G2': { label: 'G2', scale: 'G2' }, 'G1': { label: 'G1', scale: 'G1' }
  };
  const YEAR_LEVELS = { 2026: ['O', 'N(A)', 'N(T)'], 2027: ['G3', 'G2', 'G1'] };
  const SCIENCES = ['Science (Physics, Chemistry)', 'Science (Chemistry, Biology)', 'Science (Physics, Biology)', 'Physics', 'Chemistry', 'Biology'];
  const COMBINED_SCIENCES = ['Science (Physics, Chemistry)', 'Science (Chemistry, Biology)', 'Science (Physics, Biology)'];
  const HUMANITIES = ['Humanities (Social Studies, Geography)', 'Humanities (Social Studies, History)',
    'Humanities (Social Studies, Literature in English)', 'Humanities (Social Studies, Literature in Chinese)',
    'Humanities (Social Studies, Literature in Malay)', 'Humanities (Social Studies, Literature in Tamil)',
    'Geography', 'History', 'Literature in English', 'Literature in Chinese', 'Literature in Malay', 'Literature in Tamil'];
  // N(T) subjects MOE offers that the engine's catalogue does not list yet: kept, and explained in plain words
  const NOT_YET_IN_CATALOGUE = ['Computer Applications', 'Elements of Business Skills', 'Retail Operations', 'Basic Chinese'];
  function byKind(kinds) { return CATALOGUE.filter(function (s) { return kinds.indexOf(s.kind) >= 0; }).map(function (s) { return s.name; }); }
  // a core row whose subject the student picks: chips for the usual ones, the rest in a list
  const PICKS = {
    mtl: { label: 'Mother Tongue Language', chips: ['Chinese', 'Malay', 'Tamil'], options: function () { return byKind(['MTL', 'MTL_B', 'MTL_IN_LIEU']); } },
    mtl_n: { label: 'Mother Tongue Language', chips: ['Chinese', 'Malay', 'Tamil'], options: function () { return byKind(['MTL', 'MTL_B']); } },
    science: { label: 'Science', chips: SCIENCES, options: function () { return SCIENCES; } },
    science_sec: { label: 'Science', chips: SCIENCES.concat(['Science (Syllabus T)']), options: function () { return SCIENCES.concat(['Science (Syllabus T)']); } },
    science_n: { label: 'Science', chips: COMBINED_SCIENCES, options: function () { return COMBINED_SCIENCES; } },
    // at G1 Science and Computing are a pair: one is compulsory, the other can be added ("+ Add a subject"
    // offers it first)
    science_g1: { label: 'Science or Computing', chips: ['Science (Syllabus T)', 'Computing'], options: function () { return ['Science (Syllabus T)', 'Computing']; }, pair: true },
    // SS is compulsory, so the slot offers only SS plus an elective (Literature in Chinese, Malay and Tamil
    // under "Other…"); the pure Geography, History and Literature come through "+ Add a subject"
    humanities: { label: 'Humanities', chips: HUMANITIES.slice(0, 3), options: function () { return HUMANITIES.slice(0, 6); } }
  };
  const SUBJECTS_FROM_FILE = Array.isArray(PAGE.subject_levels) && PAGE.subject_levels.length > 0;
  const SUBJECT_LEVELS = (function () {
    const out = {};
    const combined = ['Science (Physics, Chemistry)', 'Science (Chemistry, Biology)', 'Science (Physics, Biology)'];
    const hmtl = ['Higher Chinese', 'Higher Malay', 'Higher Tamil'];
    const stated = [{ subject: 'Science (Syllabus T)', year: 2026, levels: ['N(T)'] }, { subject: 'Science (Syllabus T)', year: 2027, levels: ['G1'] }]
      .concat(combined.map(function (n) { return { subject: n, year: 2026, levels: ['O', 'N(A)'] }; }))
      .concat(combined.map(function (n) { return { subject: n, year: 2027, levels: ['G3', 'G2'] }; }))
      .concat(hmtl.map(function (n) { return { subject: n, year: 2026, levels: ['O'] }; }))
      .concat(hmtl.map(function (n) { return { subject: n, year: 2027, levels: ['G3'] }; }));
    const rows = SUBJECTS_FROM_FILE ? PAGE.subject_levels : stated;
    rows.forEach(function (r) { if (r && r.subject && r.levels) out[norm(r.subject) + '|' + r.year] = r.levels; });
    return out;
  })();
  // the subjects of each exam year, in the file's spelling (the engine's names), for the pickers and the search
  const SUBJECTS_OF = { 2026: [], 2027: [] };
  const SEAB_NAME = {};  // SEAB's shorter name where the engine's only adds to it, by year ("Science" in the SEC)
  if (SUBJECTS_FROM_FILE) PAGE.subject_levels.forEach(function (r) {
    if (SUBJECTS_OF[r.year] && SUBJECTS_OF[r.year].indexOf(r.subject) < 0) SUBJECTS_OF[r.year].push(r.subject);
    if (r.seab) SEAB_NAME[norm(r.subject) + '|' + r.year] = r.seab;
  });
  function shown(name) { return (name && SEAB_NAME[norm(name) + '|' + S.year]) || name; }
  // D3: only the cores are listed; electives come from "+ Add a subject"
  const CORES = {
    'O': [{ core: 'el', name: 'English Language' }, { core: 'mtl', pick: 'mtl' }, { core: 'math', name: 'Mathematics' }, { core: 'sci', pick: 'science' }, { core: 'hum', pick: 'humanities' }],
    'N(A)': [{ core: 'el', name: 'English Language' }, { core: 'mtl', pick: 'mtl_n' }, { core: 'math', name: 'Mathematics' }, { core: 'sci', pick: 'science_n' }, { core: 'hum', pick: 'humanities' }],
    // "2026 N(T), CPA is compulsory, Science is optional": Computer Applications is the core row and
    // Science (Syllabus T) comes first under "+ Add a subject" (the Science-or-Computing pair is for 2027 G1 onwards only)
    'N(T)': [{ core: 'el', name: 'English Language' }, { core: 'mtl', pick: 'mtl_n' }, { core: 'math', name: 'Mathematics' }, { core: 'cpa', name: 'Computer Applications' }],
    'SEC': [{ core: 'el', name: 'English Language' }, { core: 'mtl', pick: 'mtl' }, { core: 'math', name: 'Mathematics' }, { core: 'sci', pick: 'science_sec' }, { core: 'hum', pick: 'humanities' }],
    // SEC with most subjects at G1: SEAB has no examinable Humanities at G1, and its only G1 Science is Science (Syllabus T).
    // the fourth subject is Science or Computing
    'SEC1': [{ core: 'el', name: 'English Language' }, { core: 'mtl', pick: 'mtl' }, { core: 'math', name: 'Mathematics' }, { core: 'sci', pick: 'science_g1' }]
  };
  // one-tap electives under "+ Add a subject" (HMTL follows the Mother Tongue picked)
  const COMMON = {
    'O': ['Additional Mathematics', 'Principles of Accounts', '@HMTL', 'Physics', 'Chemistry', 'Biology', 'Geography', 'History', 'Literature in English', 'Art'],
    'N(A)': ['Principles of Accounts', 'Additional Mathematics', 'Geography', 'History', 'Literature in English', 'Art', 'Design & Technology', 'Nutrition & Food Science', 'Computing'],
    'N(T)': ['Science (Syllabus T)', 'Elements of Business Skills', 'Mobile Robotics', 'Smart Electrical Technology', 'Design & Technology', 'Nutrition & Food Science', 'Art', 'Retail Operations'],
    'SEC': ['Additional Mathematics', 'Principles of Accounts', '@HMTL', 'Physics', 'Chemistry', 'Biology', 'Geography', 'History', 'Literature in English', 'Art'],
    'SEC1': ['Computing', 'Design & Technology', 'Nutrition & Food Science', 'Art', 'Music', 'Elements of Business Skills', 'Mobile Robotics', 'Smart Electrical Technology', 'Retail Operations']
  };

  /* ================================================================================================ D5: the WHERE table */
  // Each section is one exercise and stream; `levels` are the student levels that make it live (2026 exams); `pse`
  // holds the 2027 exams' (PSE 2028) sections. Polytechnic shows DPP as "Via ITE (DPP)" when ITE is not on screen.
  const WHERE = {
    jc: { label: 'JC', type: 'JC', unsure: 'school',
      sections: [{ id: 'jc', ex: 'JAE-2027', stream: 'Junior college', kind: 'jc', levels: ['O'] }],
      pse: [{ id: 'pjc', ex: 'PSE-2028', stream: 'Junior college', kind: 'jc' }] },
    mi: { label: 'MI', type: 'MI', unsure: 'school',
      sections: [{ id: 'mi', ex: 'JAE-2027', stream: 'Millennia Institute', kind: 'jc', levels: ['O'] }],
      pse: [{ id: 'pmi', ex: 'PSE-2028', stream: 'Millennia Institute', kind: 'jc' }] },
    poly: { label: 'Polytechnic', type: 'Polytechnic', unsure: 'polytechnic', fields: true,
      sections: [
        { id: 'poly', ex: 'JAE-2027', stream: 'Polytechnic diploma', kind: 'course', levels: ['O'], head: 'Diplomas (JAE)' },
        { id: 'pfp', ex: 'PFP-2027', stream: 'Polytechnic Foundation Programme', kind: 'pfp', levels: ['N(A)'], head: 'Polytechnic Foundation Programme (PFP)' },
        { id: 'dppvia', ex: 'DPP-2027', stream: 'ITE 2-year Higher Nitec (DPP)', kind: 'ite', levels: ['N(A)'], head: 'Via ITE (DPP)', viaIte: true }],
      pse: [{ id: 'ppoly', ex: 'PSE-2028', stream: 'Polytechnic diploma', kind: 'course', head: 'Diplomas' },
        { id: 'ppfp', ex: 'PSE-2028', stream: 'Polytechnic Foundation Programme', kind: 'pfp', head: 'Polytechnic Foundation Programme (PFP)' }] },
    ite: { label: 'ITE', type: 'ITE', unsure: 'ITE', fields: true,
      sections: [
        { id: 'ite2', ex: 'JAE-2027', stream: 'ITE 2-year Higher Nitec', kind: 'ite', levels: ['O'], head: '2-year Higher Nitec (JAE)' },
        { id: 'dpp', ex: 'DPP-2027', stream: 'ITE 2-year Higher Nitec (DPP)', kind: 'ite', levels: ['N(A)'], head: "2-year Higher Nitec (DPP, JIE 'H')" },
        { id: 'jien', ex: 'JIE-N-2027', stream: 'ITE 3-year Higher Nitec', kind: 'ite', levels: ['N(A)', 'N(T)'], head: "3-year Higher Nitec (JIE 'N')" }],
      pse: [{ id: 'pite2', ex: 'PSE-2028', stream: 'ITE 2-year Higher Nitec', kind: 'ite', head: '2-year Higher Nitec' },
        { id: 'pite3', ex: 'PSE-2028', stream: 'ITE 3-year Higher Nitec', kind: 'ite', head: '3-year Higher Nitec' }] },
    arts: { label: 'Arts (NAFA, LASALLE)', type: 'Arts', unsure: 'school',
      sections: [
        { id: 'ai', kind: 'arts', arts: 'diploma', agg: 'AI4(2026)', levels: ['O'], head: 'Diplomas' },
        { id: 'nfp', kind: 'arts', arts: 'nfp', agg: 'ELMAB3:NFP(2026)', levels: ['N(A)'], head: 'NAFA Foundation Programme (NFP)' }],
      pse: [{ id: 'pai', kind: 'arts', arts: 'diploma', agg: 'AI4(2027)', head: 'Diplomas' },
        { id: 'pnfp', kind: 'arts', arts: 'nfp', agg: 'ELMAB3:NFP(2027)', head: 'NAFA Foundation Programme (NFP)' }] }
  };
  const WHERE_ORDER = ['jc', 'mi', 'poly', 'ite', 'arts'];
  // the exercises whose published range belongs to the same exercise and aggregate as the course row (D8)
  const RANGE_EXERCISES = ['JAE-2027', 'DPP-2027', 'JIE-N-2027'];
  // a level other than the "level of most subjects" adds its own routes from this many subjects ([new]: one stray
  // N(A) Mother Tongue paper does not open DPP or PFP to an O-Level student)
  const MIXED_MIN = 3;

  // D5: the "Another route" line, by level. Words: MOE's booklet and pages (the route cards).
  const ANOTHER = {
    jie_o: { name: "ITE 3-year Higher Nitec (JIE 'O')", short: "JIE 'O'", levels: ['O'],
      text: ["You can apply for ITE 3-year Higher Nitec courses through JIE 'O' in January 2027."],
      link: { label: 'JIE on the MOE website', url: 'https://www.moe.gov.sg/post-secondary/admissions/jie' } },
    sec5: { name: 'Secondary 5', levels: ['N(A)'],
      text: ['Secondary 5 is also an option. Your school handles the application.'],
      link: { label: 'N-Level routes on the MOE website', url: 'https://www.moe.gov.sg/post-secondary/admissions/n-level' } },
    jie_e: { name: "JIE 'E'", levels: ['N(T)'],
      text: ["If you have 0 or 1 N-Level pass, you can apply for ITE 4-year Higher Nitec courses with the Enhanced Foundation Programme through JIE 'E' in December 2026."],
      link: { label: "JIE 'N' and JIE 'E' on the ITE website", url: 'https://www.ite.edu.sg/secondary-school-students/admissions/entry-qualifications/gce-n-level/for-gce-n-and-gce-o-students-jie-n/' } },
    lateral: { name: 'Lateral transfer to Secondary 4N(A)', short: 'Lateral transfer', levels: ['N(T)'],
      text: ['MOE: “Eligible students may also laterally transfer to Secondary 4N(A) to take the N(A)-Level examinations. Applications can be made via your secondary school.”'],
      link: { label: 'MOE post-secondary booklet', url: 'https://www.moe.gov.sg/media/files/post-secondary/343f646d-986a-4496-b981-063d6d9346cc.pdf' } },
    fifth: { name: '5th year in secondary school', short: '5th year', pse: true,
      text: [],
      link: { label: 'PSE pathways on the MOE website', url: 'https://www.moe.gov.sg/post-secondary/admissions/pse/explore-pathways' } }
  };

  const MOE_OVERVIEW = {
    title: 'From 2028, more post-secondary options will be available.',
    groupsHead: 'Students taking at least', pathwaysHead: 'Post-sec pathways',
    groups: [
      { id: '5G3', name: '5 G3 subjects', short: '5 G3' },
      { id: '4G3+1G2', name: '4 G3 subjects + 1 G2 subject', short: '4 G3 + 1 G2' },
      { id: '5G2', name: '5 G2 subjects', short: '5 G2' },
      { id: '4G1', name: '4 G1 subjects', short: '4 G1' }
    ],
    pathways: ['3-Year Higher Nitec', '2-Year Higher Nitec', 'NAFA Foundation Programme (NFP)', 'Arts Institutions',
      'Polytechnic Foundation Programme (PFP)', 'Polytechnic Year 1', 'Millennia Institute', 'Junior College'],
    cells: {
      '5G3': ['yes', 'yes', 'new', 'yes', 'new', 'yes', 'yes', 'new'],
      '4G3+1G2': ['yes', 'yes', 'new', 'new', 'new', 'new', '—', '—'],
      '5G2': ['yes', 'yes', 'yes', '—', 'yes', '—', '—', '—'],
      '4G1': ['yes', 'new*', '—', '—', '—', '—', '—', '—']
    },
    footnote: '*Students who offer 4 G1 subjects will join Year 1 of 3-Year Higher Nitec, and may be offered the accelerated pathway if they meet academic requirements during their Year 1 Semester 1 examinations. This pathway will allow them to attain a Higher Nitec in a shorter duration of about two years.',
    source: 'Source: MOE, Subject-Level Requirements for Post-Secondary Pathways (accurate as of Apr 2026).',
    url: 'https://www.moe.gov.sg/media/files/microsite/433a1904-b166-437f-bcf6-0fc8b2abd8eb.pdf'
  };

  const POLY_FIELDS = ['Applied Sciences', 'Built Environment', 'Business and Management', 'Engineering', 'Health Sciences', 'Humanities',
    'Information and Digital Technologies', 'Maritime Studies', 'Media and Design'];
  const ITE_FIELDS = ['Business and Services', 'Electronics and Info-comm Technology', 'Engineering', 'Health Sciences', 'Hospitality', 'Media and Design'];
  // PFP admits by cluster, except these diploma-specific programmes (MOE PFP page)
  const PFP_SPECIALISED = ['Nursing', 'Early Childhood Development & Education', 'Tamil Studies With Early Education'];
  const PFP_CLUSTERS = ['Sciences', 'Humanities, Arts, Media and Business', 'Design, Engineering and Technology', 'Diploma-specific programmes'];
  const BONUS_SHORT = { cca: 'CCA', el_hmtl: 'English and Higher Mother Tongue', sp_bi: 'Chinese (SP), Malay (SP) or Bahasa Indonesia' };
  const BONUS_NAMES = { cca: 'CCA', el_hmtl: 'English and Higher Mother Tongue grades', sp_bi: 'Chinese (SP), Malay (SP) or Bahasa Indonesia grade', affiliated_jc: 'affiliated JC', lep: 'language elective programme' };
  const RIASEC = ['R', 'I', 'A', 'S', 'E', 'C'];

  /* ================================================================================================ D14: the key dates */
  // One row per step. `fill` reads data/calendar/exercise_date_fills.csv (basis confirmed / inferred / month_only);
  // `phase` reads the current-cycle rows of the exercise list. Previous-cycle rows are never read.
  // who: student levels (2026 exams) or 'SEC' (2027 exams); where: Where ids ([] = everyone); fam: colour family;
  // month: where a step with no date sits (MOE gives a month or less); apply: an application step (for "Next:").
  const AGENDA = [
    { fam: 'exam', ex: 'EXAM-2026', phase: 'results release', pick: /Dec/, title: 'N-Level results', who: ['N(A)', 'N(T)'], where: [] },
    { fam: 'exam', ex: 'EXAM-2026', phase: 'results release', pick: /Jan/, title: 'O-Level results', who: ['O'], where: [] },
    { fam: 'dsa', ex: 'DSA-JC-2027', phase: 'explore and apply', title: 'DSA-JC applications', who: ['O'], where: ['jc'] },
    { fam: 'eae', ex: 'ITE-EAE-2027', phase: 'apply', title: 'ITE Early Admissions Exercise', who: ['O', 'N(A)', 'N(T)'], where: ['ite'] },
    { fam: 'eae', ex: 'POLY-EAE-2027-O', phase: 'apply', title: 'Polytechnic Early Admissions Exercise', who: ['O'], where: ['poly'] },
    { fam: 'arts', ex: 'AI-EAE-2027', fill: 'apply (LASALLE)', title: 'LASALLE Early Admissions Exercise', who: ['O'], where: ['arts'] },
    { fam: 'arts', ex: 'AI-EAE-2027', fill: 'apply (NAFA)', title: 'NAFA Early Admissions Exercise', who: ['O'], where: ['arts'] },
    { fam: 'jae', ex: 'JAE-2027', phase: 'verify CCA records', title: 'Check your CCA records', who: ['O'], where: ['jc', 'mi', 'poly', 'ite'] },
    { fam: 'arts', ex: 'AI-ADM-2027', fill: 'apply', note: /LASALLE/, title: 'Apply to LASALLE', who: ['O'], where: ['arts'], apply: true },
    { fam: 'arts', ex: 'AI-ADM-2027', fill: 'apply', note: /NAFA/, title: 'Apply to NAFA', who: ['O'], where: ['arts'], apply: true, open: true },
    { fam: 'dpp', ex: 'DPP-2027', fill: 'apply (1st window)', title: "Apply for DPP (JIE 'H')", who: ['N(A)'], where: ['ite', 'poly'], apply: true },
    { fam: 'jie', ex: 'JIE-N-2027', fill: 'apply', title: "Apply for ITE 3-year courses (JIE 'N')", who: ['N(A)', 'N(T)'], where: ['ite'], apply: true },
    { fam: 'jie', ex: 'JIE-E-2027', fill: 'apply', title: "Apply for JIE 'E'", who: ['N(T)'], where: ['ite'], apply: true },
    { fam: 'arts', ex: 'NFP-2027', fill: 'apply', title: 'Apply for the NAFA Foundation Programme (NFP)', who: ['N(A)'], where: ['arts'], apply: true },
    { fam: 'sec5', ex: 'SEC5-2027', fill: 'apply', title: 'Secondary 5 classes start', who: ['N(A)'], where: [] },
    { fam: 'jae', ex: 'JAE-2027', fill: 'apply', title: 'Apply in the JAE', who: ['O'], where: ['jc', 'mi', 'poly', 'ite'], apply: true },
    { fam: 'jie', ex: 'JIE-O-2027', fill: 'apply', title: "Apply for ITE 3-year courses (JIE 'O')", who: ['O'], where: ['ite'], apply: true },
    { fam: 'pfp', ex: 'PFP-2027', fill: 'apply', title: 'Apply for PFP', who: ['N(A)'], where: ['poly'], apply: true },
    { fam: 'dpp', ex: 'DPP-2027', fill: 'apply (2nd window', title: 'DPP second window', who: ['N(A)'], where: ['ite', 'poly'], apply: true },
    { fam: 'jae', ex: 'JAE-2027', phase: 'posting results', title: 'JAE posting results', who: ['O'], where: ['jc', 'mi', 'poly', 'ite'] },
    { fam: 'jae', ex: 'JAE-2027', phase: 'acceptance / report (JC and MI)', title: 'Report to your JC or MI', who: ['O'], where: ['jc', 'mi'] },
    { fam: 'jae', ex: 'JAE-2027', phase: 'appeal (polytechnic or ITE 2-year Higher Nitec)', title: 'Appeal for a polytechnic or ITE course', who: ['O'], where: ['poly', 'ite'] },
    { fam: 'jae', ex: 'JAE-2027', fill: 'appeal outcome', title: 'Appeal outcome', who: ['O'], where: ['poly', 'ite'] },
    { fam: 'jae', ex: 'JAE-2027', fill: 'acceptance / enrolment instructions (polytechnic)', title: 'Polytechnic enrolment email', who: ['O'], where: ['poly'] },
    // the 2027 exams (PSE 2028): MOE gives months only, so these are labels with no bar
    { fam: 'arts', ex: 'AI-EAE-2028', phase: 'apply', month: '2027-05', title: 'Arts institutions Early Admissions Exercise', who: ['SEC'], where: ['arts'] },
    { fam: 'dsa', ex: 'DSA-JC-2028', phase: 'apply / selection (before SEC examinations)', month: '2027-06', title: 'DSA-JC', who: ['SEC'], where: ['jc'] },
    { fam: 'eae', ex: 'POLY-EAE-2028', phase: 'apply / selection (before SEC examinations)', month: '2027-06', title: 'Polytechnic Early Admissions Exercise', who: ['SEC'], where: ['poly'] },
    { fam: 'eae', ex: 'ITE-EAE-2028', phase: 'apply / selection (before SEC examinations)', month: '2027-06', title: 'ITE Early Admissions Exercise', who: ['SEC'], where: ['ite'] },
    { fam: 'pse', ex: 'PSE-2028', phase: 'MOE info update', month: '2027-07', title: 'MOE publishes the 2028 course information', who: ['SEC'], where: [] },
    { fam: 'pse', ex: 'PSE-2028', phase: 'verify CCA records', month: '2027-09', title: 'Check your CCA records', who: ['SEC'], where: [] },
    { fam: 'exams', ex: 'EXAM-2027', phase: 'exam period', month: '2027-09', title: 'SEC written exams', who: ['SEC'], where: [] },
    { fam: 'exam', ex: 'PSE-2028', phase: 'results release (SEC)', month: '2028-01', title: 'SEC results', who: ['SEC'], where: [] },
    { fam: 'pse', ex: 'PSE-2028', phase: 'apply', month: '2028-01', title: 'Apply in the PSE', who: ['SEC'], where: [], apply: true },
    { fam: 'pse', ex: 'PSE-2028', phase: 'posting results', month: '2028-02', title: 'PSE posting results', who: ['SEC'], where: [] }
  ];
  // the exercise a family's label names on the stripe (never colour alone)
  const FAMILY = {
    exam: { label: 'Results' }, exams: { label: 'Exams' }, dsa: { label: 'DSA' }, jae: { label: 'JAE' }, jie: { label: 'JIE' }, dpp: { label: 'DPP' }, pfp: { label: 'PFP' },
    arts: { label: 'NAFA / LASALLE' }, sec5: { label: 'Sec 5' }, eae: { label: 'EAE' }, pse: { label: 'PSE' }
  };
  // the details screen's dates for each exercise
  const EX_STEPS = {
    'JAE-2027': ['Apply in the JAE', 'JAE posting results'], 'DPP-2027': ["Apply for DPP (JIE 'H')", 'DPP second window'],
    'JIE-N-2027': ["Apply for ITE 3-year courses (JIE 'N')"], 'PFP-2027': ['Apply for PFP'], 'PSE-2028': ['Apply in the PSE', 'PSE posting results']
  };

  /* ================================================================================================ state */
  function defaultState() {
    return { year: null, level: null, mode: 'grade', rows: [], cca: null, where: [], school: '', lep: 'None', fields: [], riasec: [],
      insts: [], q: '', sort: '', fold: {}, showNo: {}, showMore: {}, showNoRange: {}, subOpen: {}, reach: true, allow: 0,
      stars: [], allEx: false, calc: false };
  }
  let S = defaultState();
  let R = null;  // the last computation
  let CARDS = null;  // cards built from R
  let DIRTY = true;  // R needs recomputing
  let UNDO = null;
  let OPEN_ROW = '';  // the row the student reopened, or the mark box being typed in
  let CARD_OPEN = false;  // the subjects card reopened with ✎ Edit after "Calculate my aggregates"
  let ADDING = false;  // "+ Add a subject" is open
  let LVL_OPEN = '';  // the row whose level choice is showing (2026 exams)
  let PICK_OPEN = '';  // the row whose subject choice is open again ("change")
  let addOpen = false, addQuery = '', schoolQuery = '', pasteOpen = false, pasteReadBack = '', pasteUnread = [];
  let fieldsOpen = false;
  const KEEP = {};  // disclosures the student opened, kept open across re-renders (memory only)
  function keep(k) { return ' data-keep="' + esc(k) + '"' + (KEEP[k] ? ' open' : ''); }

  // the route chips are kept for this visit only (a reload keeps them, a new visit starts empty); the results,
  // stars and the Grades/Marks choice stay on the device
  const WHERE_KEY = STORE_KEY + '-where';
  function save() {
    try { const o = Object.assign({}, S); delete o.where; localStorage.setItem(STORE_KEY, JSON.stringify(o)); } catch (e) { /* private window: the page still works */ }
    try { sessionStorage.setItem(WHERE_KEY, JSON.stringify(S.where || [])); } catch (e) { /* the chips are then not kept */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && typeof s === 'object') S = Object.assign(defaultState(), s);
        if (S.year !== 2026 && S.year !== 2027) S = Object.assign(defaultState(), { stars: S.stars || [] });
        if (!Array.isArray(S.rows)) S.rows = [];
        delete S.sec;  // the pathway filter, gone in
      }
    } catch (e) { S = defaultState(); }
    S.where = [];
    try { const w = JSON.parse(sessionStorage.getItem(WHERE_KEY) || '[]'); if (Array.isArray(w)) S.where = w.filter(function (x) { return !!WHERE[x]; }); } catch (e) { /* none kept */ }
  }

  /* ================================================================================================ helpers */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  // a range ("4–16") and "(cut-off 12)" never break inside themselves (input is escaped HTML)
  // also a date range with its month ("17–25 Dec"), "Mid-2027", "cut-offs." and an aggregate's letter
  // ("R1B3-C"); text only, never inside a tag's attributes
  const NW_RE = /(\d+–\d+ [A-Z][a-z]{2}\b|\d+–\d+|\(cut-off \d+\)|\(from 2026(?: O-Level cut-offs)?\)|\bMid-\d{4}\b|\b[Cc]ut-offs?\b\.?|\b[A-Z0-9]{2,}-[A-D]\b,?)/g;
  function nw(html) { return String(html).split(/(<[^>]*>)/).map(function (seg, i) { return i % 2 ? seg : seg.replace(NW_RE, '<span class="nw">$1</span>'); }).join(''); }
  function joinAnd(a) { return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function joinOr(a) { return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' or ' + a[a.length - 1]; }
  function norm(s) { return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/['’‘"]/g, '').replace(/[^a-z0-9]+/g, ''); }
  function shortName(id) { const d = DEFS[id]; return (d && d.letters) || String(id || '').replace(/[:(].*$/, ''); }
  function displayName(id) { const d = DEFS[id]; return (d && d.display_name) || id; }
  function checkOf(defId, checkId) {
    const d = DEFS[defId];
    return d && (d.checks || []).filter(function (c) { return c.id === checkId; })[0];
  }
  function ext(url, label, cls, aria) {
    return url ? '<a class="ext' + (cls ? ' ' + cls : '') + '" href="' + esc(url) + '" target="_blank" rel="noopener"' + (aria ? ' aria-label="' + esc(aria) + '" title="' + esc(aria) + '"' : '') + '>' + esc(label) + '</a>' : '';
  }
  function hash36(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
  function isWide() { return !!(window.matchMedia && window.matchMedia('(min-width: 1024px)').matches); }
  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  let toastTimer = null;
  function toast(msg, action) {
    const t = $('#toast');
    t.innerHTML = (msg ? '<span>' + esc(msg) + '</span> ' : '') + (action ? '<button type="button" class="btn-link" data-do="' + action.do + '"' + (action.v ? ' data-v="' + esc(action.v) + '"' : '') + '>' + esc(action.label) + '</button>' : '');
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); UNDO = null; }, action ? 6000 : 2500);
  }
  // an engine value the page has no wording for: a safe sentence on screen, nothing in the console
  const UNMAPPED = [];
  function unmapped(key) { if (UNMAPPED.indexOf(key) < 0) UNMAPPED.push(key); }

  /* catalogue look-up for the tap lists (the engine is the real resolver) */
  const CAT_INDEX = {}, CAT_BY_ID = {};
  CATALOGUE.forEach(function (s) {
    CAT_INDEX[norm(s.name)] = s; CAT_BY_ID[s.id] = s;
    (s.aliases || []).forEach(function (a) { if (!CAT_INDEX[norm(a)]) CAT_INDEX[norm(a)] = s; });
  });
  function catalogueEntry(name) {
    if (!name) return null;
    if (CORE_OK && typeof window.PSE.resolveSubject === 'function') {
      try { const id = window.PSE.resolveSubject(name); if (id && CAT_BY_ID[id]) return CAT_BY_ID[id]; } catch (e) { /* fall back */ }
    }
    return CAT_INDEX[norm(name)] || null;
  }

  /* ================================================================================================ rows, levels and marks */
  function coreKey() { return S.year === 2027 ? (S.level === 'G1' ? 'SEC1' : 'SEC') : (S.level === 'N(T)' ? 'N(T)' : S.level === 'N(A)' ? 'N(A)' : 'O'); }
  function levelFor(subjectName, wanted) {
    const ok = allowedLevels(subjectName);
    if (wanted && ok.indexOf(wanted) >= 0) return wanted;
    if (S.level && ok.indexOf(S.level) >= 0) return S.level;
    return ok[0] || wanted || S.level || '';
  }
  // D19: the levels this subject exists at, in the exam year picked
  function allowedLevels(name, year) {
    year = year || S.year;
    const all = YEAR_LEVELS[year] || [];
    if (!name) return all;
    const c = catalogueEntry(name);
    let lv = SUBJECT_LEVELS[norm(c ? c.name : name) + '|' + year] || SUBJECT_LEVELS[norm(name) + '|' + year];
    if (!lv && c && c.only_level) lv = [year === 2027 ? c.only_level : ({ G3: 'O', G2: 'N(A)', G1: 'N(T)' })[c.only_level]];
    lv = lv ? all.filter(function (l) { return lv.indexOf(l) >= 0; }) : all;
    return lv.length ? lv : all;
  }
  // D19: is this subject offered at this level in the exam year picked? (with the file: only its rows exist)
  function existsAt(name, level, year) {
    year = year || S.year;
    const c = catalogueEntry(name);
    const lv = SUBJECT_LEVELS[norm(c ? c.name : name) + '|' + year] || SUBJECT_LEVELS[norm(name) + '|' + year];
    if (lv) return !level || lv.indexOf(level) >= 0;
    if (SUBJECTS_FROM_FILE) return false;
    return !level || allowedLevels(name, year).indexOf(level) >= 0;
  }
  function pickOptions(pick, level) {
    return pick.options().filter(function (o) { return existsAt(o, level); });
  }
  function isMtlB(row) { const c = catalogueEntry(row.name); return !!(c && c.kind === 'MTL_B'); }
  function rowMode(row) { return isMtlB(row) ? 'grade' : S.mode; }
  function scaleOf(level) { return LEVEL[level] ? LEVEL[level].scale : /^G[123]$/.test(level || '') ? level : ''; }
  function gradeLabel(level, g) {
    if (g == null || g === '') return '';
    const sc = scaleOf(level);
    if (g === 'F9') return '9';
    if (g === 'U') return sc === 'G2' ? '6' : sc === 'G1' ? 'E' : g;
    return g;
  }
  function gradesFor(row) {
    if (isMtlB(row)) return MTL_B_GRADES;
    const lv = LEVEL[row.level];
    return lv ? (GRADE_ORDER[lv.scale] || []).filter(function (g) { return !(lv.scale === 'G1' && g === 'U'); }) : [];
  }
  function markValue(v) {
    const t = String(v == null ? '' : v).trim();
    if (!/^\d{1,3}(\.\d+)?$/.test(t)) return null;
    const m = Number(t);
    return m >= 0 && m <= 100 ? m : null;
  }
  // the grade a mark becomes, from the engine's own bands (the same rule as pse_core.js)
  function markGrade(row, m) {
    const lv = LEVEL[row.level];
    const bands = lv && MARK_BANDS[lv.scale];
    if (!bands || m == null) return '';
    for (let i = 0; i < bands.length; i++) if (m >= bands[i][0]) return bands[i][1];
    return bands[bands.length - 1][1];
  }
  function rowGrade(row) {
    if (isMtlB(row)) return row.grade || '';
    const m = markValue(row.mark);
    return m != null ? markGrade(row, m) : (row.grade || '');
  }
  // what the row still needs: '' when complete (D4)
  // the engine's own answer on a name (checkInputs: "subject not in the catalogue"), asked once per name and year
  const UNKNOWN = {};
  function isUnknownSubject(row) {
    if (!row.name || catalogueEntry(row.name)) return false;
    if (NOT_YET_IN_CATALOGUE.some(function (n) { return norm(n) === norm(row.name); })) return false;
    const k = S.year + '|' + norm(row.name);
    if (UNKNOWN[k] == null) {
      let unknown = true;
      try {
        if (CORE_OK && typeof window.PSE.checkInputs === 'function') {
          const lv = row.level || S.level || 'O', sc = LEVEL[lv] ? LEVEL[lv].scale : 'G3';
          const rep = window.PSE.checkInputs([{ subject: row.name, level: lv, grade: (GRADE_ORDER[sc] || ['A1'])[0], year: S.year }]) || {};
          unknown = (rep.input_problems || []).some(function (p) { return p.field === 'subject' && /not in the catalogue/.test(String(p.problem || '')); });
        }
      } catch (e) { unknown = true; }
      UNKNOWN[k] = unknown;
    }
    return UNKNOWN[k];
  }
  function rowNeed(row) {
    if (row.skip) return '';
    if (!row.name) return 'pick';
    if (isUnknownSubject(row)) return 'unknown';
    if (!row.level) return 'level';
    const t = String(row.mark || '').trim();
    if (t && markValue(t) == null && !isMtlB(row)) return 'markBad';
    if (rowGrade(row)) return '';
    if (rowMode(row) === 'mark') return S.year === 2027 ? 'mark27' : 'mark';
    return S.year === 2027 ? 'grade27' : 'grade';
  }
  // D3: a complete row collapses to one line; in 2027 a row with a level and no mark is complete for the overview only
  function rowCollapsed(row) {
    if (OPEN_ROW === row.id) return false;
    if (row.skip) return true;
    return rowNeed(row) === '' && !!row.name;
  }
  // one subject at a time. A row is answered when it is complete or not taken. The open row is
  // the one being changed, else the first one not answered; a row not answered and not open is not reached yet, so it
  // doesn't show. The same rows fold on every screen size: nothing here depends on the window.
  function rowDone(r) { return !!r.skip || (rowNeed(r) === '' && !!r.name); }
  function openRowId() {
    if (OPEN_ROW && rowById(OPEN_ROW)) return OPEN_ROW;
    const r = S.rows.filter(function (x) { return !rowDone(x); })[0];
    return r ? r.id : '';
  }
  function coreDone() { return S.rows.length > 0 && S.rows.every(function (r) { return r.added || rowDone(r); }); }
  function allDone() { return S.rows.length > 0 && S.rows.every(rowDone); }
  // A5: the results are calculated (the tiles show) once "Calculate my aggregates" is tapped, until a subject is cleared
  function calcOn() { return !!S.calc && allDone(); }
  let rowSeq = 0;
  function newRow(spec) {
    rowSeq += 1;
    const name = spec.name || '';
    return { id: 'r' + Date.now().toString(36) + rowSeq, core: spec.core || '', pick: spec.pick || '', name: name,
      level: name ? levelFor(name, spec.level) : (spec.level || S.level || ''), grade: spec.grade || '',
      mark: spec.mark != null ? String(spec.mark) : '', skip: false, added: !!spec.added };
  }
  function coreRows() { return (CORES[coreKey()] || []).map(function (c) { return newRow(c); }); }
  // put each {name, level, grade|mark} on its core row (a fixed name, or a pick row that offers it), else add a row
  function fillRows(specs) {
    const rows = coreRows();
    specs.forEach(function (sp) {
      const free = function (x) { return !x.grade && !x.mark; };
      let r = rows.filter(function (x) { return free(x) && x.name && norm(x.name) === norm(sp.name); })[0];
      if (!r) r = rows.filter(function (x) { return free(x) && !x.name && x.pick && PICKS[x.pick].options().some(function (o) { return norm(o) === norm(sp.name); }); })[0];
      if (r) {
        if (!r.name) r.name = PICKS[r.pick].options().filter(function (o) { return norm(o) === norm(sp.name); })[0] || sp.name;
        r.level = levelFor(r.name, sp.level);
        if (sp.mark != null && sp.mark !== '') r.mark = String(sp.mark); else r.grade = sp.grade || '';
      } else {
        rows.push(newRow({ name: sp.name, level: sp.level, grade: sp.grade, mark: sp.mark, added: true }));
      }
    });
    return rows;
  }
  // a grade survives a change of level or subject when the new scale has it; otherwise it is cleared, and the row says so
  function keepOrClear(r) {
    r.note = '';
    if (!r.grade || !r.level || gradesFor(r).indexOf(r.grade) >= 0) return;
    const scale = isMtlB(r) ? "'B' Syllabus" : (LEVEL[r.level] ? LEVEL[r.level].label : r.level);
    r.note = STRINGS.gradeCleared(gradeLabel(r.level, r.grade), scale);
    r.grade = '';
  }
  function rowById(id) { return S.rows.filter(function (r) { return r.id === id; })[0]; }
  function takenRows() { return S.rows.filter(function (r) { return !r.skip && r.name && r.level; }); }
  // the levels the student entered, for the routes (D5): the level of most subjects, plus any other level with
  // MIXED_MIN subjects or more
  function levelsLive() {
    if (S.year !== 2026 || !S.level) return [];
    const n = {};
    takenRows().forEach(function (r) { n[r.level] = (n[r.level] || 0) + 1; });
    const out = [S.level];
    YEAR_LEVELS[2026].forEach(function (lv) { if (lv !== S.level && (n[lv] || 0) >= MIXED_MIN) out.push(lv); });
    return out;
  }
  function levelsUsed() {
    const seen = [];
    takenRows().forEach(function (r) { if (seen.indexOf(r.level) < 0) seen.push(r.level); });
    const order = YEAR_LEVELS[S.year] || [];
    seen.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
    if (S.level && seen.indexOf(S.level) > 0) { seen.splice(seen.indexOf(S.level), 1); seen.unshift(S.level); }
    return seen;
  }

  /* ================================================================================================ where, sections, scope */
  function sectionsOf(wid) {
    const w = WHERE[wid];
    if (S.year === 2027) return w.pse;
    const live = levelsLive();
    return w.sections.filter(function (s) { return s.levels.some(function (l) { return live.indexOf(l) >= 0; }); });
  }
  function liveWheres() { return WHERE_ORDER.filter(function (w) { return sectionsOf(w).length > 0; }); }
  // D2.5: none picked = all; once the results are in, none picked = the student's top tier (defaultRoutes)
  function scope() {
    const live = liveWheres();
    const picked = S.where.filter(function (w) { return live.indexOf(w) >= 0; });
    if (picked.length) return picked;
    const d = defaultRoutes();
    return d ? d.routes : live;
  }
  function inScope(wid) { return scope().indexOf(wid) >= 0; }
  // the sections a group shows: Polytechnic's "Via ITE (DPP)" only when the ITE group is not on screen; with nothing
  // picked, only the pathways of the default tiers (F)
  function groupSections(wid) {
    const secs = sectionsOf(wid), d = picksMade() ? null : defaultRoutes();
    return secs.filter(function (sc) { return (!sc.viaIte || !inScope('ite')) && (!d || !!d.secs[sc.id]); });
  }
  function exercisesNeeded() {
    if (S.year === 2027) return ['PSE-2028'];
    const ex = [];
    liveWheres().forEach(function (w) { sectionsOf(w).forEach(function (s) { if (s.ex && ex.indexOf(s.ex) < 0) ex.push(s.ex); }); });
    return ex;
  }
  function anotherRoutes() {
    if (S.year === 2027) return (fifthYear() === true || fifthYear() === null) ? ['fifth'] : [];
    const live = levelsLive();
    return Object.keys(ANOTHER).filter(function (k) { const a = ANOTHER[k]; return !a.pse && a.levels.some(function (l) { return live.indexOf(l) >= 0; }); });
  }

  /* ================================================================================================ engine calls */
  function engineSubjects() {
    const out = [], ids = [];
    S.rows.forEach(function (r) {
      if (r.skip || !r.name || !r.level || isUnknownSubject(r)) return;
      const m = isMtlB(r) ? null : markValue(r.mark);
      if (m != null) out.push({ subject: r.name, level: r.level, mark: m, year: S.year });
      else if (r.grade) out.push({ subject: r.name, level: r.level, grade: r.grade, year: S.year });
      else return;
      ids.push(r.id);
    });
    return { subjects: out, ids: ids };
  }
  function affiliatedJCs() {
    if (!S.school || !jcAsked()) return [];
    const hit = SCHOOLS.filter(function (s) { return s[0] === S.school; })[0];
    return hit ? hit[1] : [];
  }
  function lepHere(inst) {
    if (!LEP_HOSTS || !S.lep || S.lep === 'None' || !jcAsked()) return '';
    return LEP_HOSTS.some(function (h) { return h && h.programme === S.lep && norm(h.jc) === norm(inst); }) ? S.lep : '';
  }
  function engineBonus() {
    const b = {};
    if (S.cca === 'Excellent' || S.cca === 'Good' || S.cca === 'Fair') b.cca = S.cca;
    if (affiliatedJCs().length) b.affiliated_jc = true;
    if (LEP_HOSTS && S.lep && S.lep !== 'None' && jcAsked()) b.lep = true;
    return b;
  }
  function recompute() {
    R = null; CARDS = null; DIRTY = false;
    if (!S.year || !CORE_OK) return;
    const sent = engineSubjects();
    if (S.year === 2026 && !sent.subjects.length) return;
    try {
      const bonus = engineBonus();
      const all = sent.subjects.length ? window.PSE.computeAll(sent.subjects, bonus) : [];
      const rep = window.PSE.matchReport(sent.subjects, bonus, exercisesNeeded());
      const byId = {};
      (all || []).forEach(function (r) { byId[r.id] = r; });
      const problems = (rep && rep.input_problems) || [];
      const entries = sent.subjects.length ? ((window.PSE.checkInputs(sent.subjects) || {}).entries || []) : [];
      R = { all: all, byId: byId, results: (rep && rep.results) || [], problems: problems, sent: sent, bonus: bonus, entries: entries };
      CARDS = buildCards();
    } catch (e) {
      R = { error: true, byId: {}, results: [], problems: [], sent: sent, entries: [] };
      CARDS = [];
    }
  }
  function ensureR() { if (DIRTY) recompute(); }
  function changed() { DIRTY = true; }

  /* ================================================================================================ plain reasons */
  // what a missing slot needs, in a student's words (every slot label in engine/definitions.json)
  const SLOT_NEED = {
    'B1: best other G3 subject': '+G3', 'R4: best other G3 subject': '+G3',
    'B1: best other subject': '+', 'B2: best other subject': '+', 'B3: best other subject': '+', 'B4: best other subject': '+',
    'B5: best other subject': '+', 'R3: best other subject': '+', 'R4: best other subject': '+', 'R5: best other subject': '+',
    'B2: 2nd best subject at G2 or G3, G2-equivalent grade': 'one more subject at G2 or G3',
    'EL: English Language': 'English Language', 'R1: English Language': 'English Language',
    'EL: G3 English Language': 'English Language at G3',
    'L1: English or Higher Mother Tongue Language': 'English Language or a Higher Mother Tongue Language',
    'L1: G3 English or Higher Mother Tongue Language': 'English Language or a Higher Mother Tongue Language at G3',
    'MA: Mathematics': 'Mathematics', 'R1: Mathematics': 'Mathematics', 'R2: Mathematics': 'Mathematics',
    'MA: Mathematics or Additional Mathematics': 'Mathematics or Additional Mathematics',
    'R1: best of the 1st group (Additional Mathematics, Mathematics)': 'Mathematics or Additional Mathematics',
    'Mathematics or Science (or an ITE substitute subject)': 'Mathematics or a Science subject',
    'R1: Mathematics or Science': 'Mathematics or a Science subject', 'R2: best Mathematics or Science': 'Mathematics or a Science subject',
    'R2: best G3 Mathematics or Science': 'Mathematics or a Science subject at G3',
    'R1: best Humanities': 'a Humanities subject', 'R1: best G3 Humanities': 'a Humanities subject at G3',
    'R1: best Humanities, Mathematics or Science': 'a Humanities, Mathematics or Science subject',
    'R2: best Humanities, Mathematics or Science': 'a Humanities, Mathematics or Science subject',
    'R3: best Humanities, Mathematics or Science': 'a Humanities, Mathematics or Science subject',
    'R3: best G3 Humanities, Mathematics or Science': 'a Humanities, Mathematics or Science subject at G3',
    'R1: best of Additional Mathematics, Mathematics, Principles of Accounts': 'Additional Mathematics, Mathematics or Principles of Accounts',
    'R1: best of the 1st group of relevant subjects': 'a subject from the 1st group of relevant subjects',
    'R2: best of the 2nd group of relevant subjects': 'a subject from the 2nd group of relevant subjects',
    'R2: best of the 2nd group (ITE list)': 'a subject from the 2nd group of relevant subjects',
    'R1: best G3 subject of the 1st group': 'a G3 subject from the 1st group of relevant subjects',
    'R2: best G3 subject of the 2nd group': 'a G3 subject from the 2nd group of relevant subjects'
  };
  function whoCounts(id) {
    const t = [[/^L1R4\(2027\)/, 'JC and MI'], [/^L1R5/, 'JC courses'], [/^L1R4\(2026\)/, 'Millennia Institute'], [/^ELR2B2-[ABD]\(|^ELR2B2-C:POLY|^ELR2B2-C\(2027/, 'Polytechnic diplomas'],
      [/^ELMAB3:PFP/, 'PFP'], [/^ELMAB3:ITE/, 'ITE 2-year courses'], [/^ELMAB3:DPP/, 'DPP'], [/^ELMAB3:NFP/, 'The NAFA Foundation Programme'], [/^AI4/, 'Arts institutions'],
      [/^ELB4-A|^ELR1B3-B|^ELR2B2-C:ITE/, 'ITE 2-year courses'], [/^B5/, "JIE 'O'"], [/\(2027\)$/, 'ITE 3-year courses'], [/\(2026\)$/, "JIE 'N'"]];
    for (let i = 0; i < t.length; i++) if (t[i][0].test(id)) return t[i][1];
    return 'This score';
  }
  function levelName(lv) {
    if (S.year === 2027) return lv;
    return ({ G3: 'O-Level', G2: 'N(A)-Level', G1: 'N(T)-Level' })[lv] || lv;
  }
  function groupMembers(g) {
    const grp = DEF_ROOT.groups && DEF_ROOT.groups[g];
    return grp ? (grp.effective_members || grp.members || []) : [];
  }
  function slotLevels(slot) { return Object.keys(((SCALES[slot.scale] || {}).levels) || {}); }
  function missingInfo(res) {
    if (!res) return { kind: 'other' };
    if (res.status === 'not_applicable') return { kind: 'na' };
    if (res.status === 'stub') return { kind: 'stub' };
    const why = String(res.not_computable_reason || '');
    const d = DEFS[res.id];
    const entries = (R && R.entries) || [];
    if (!d || !d.slots) return { kind: 'other' };
    const allSame = (function () {
      const ls = d.slots.map(function (sl) { return slotLevels(sl).sort().join(','); });
      return ls.every(function (x) { return x === ls[0]; }) ? slotLevels(d.slots[0]) : null;
    })();
    const emptySlots = d.slots.filter(function (sl) { return why.indexOf(sl.label) >= 0; });
    const onlyL1 = emptySlots.length && emptySlots.every(function (sl) { return /^L1:/.test(sl.label); });
    if (why.indexOf('no usable subject for') >= 0 && !(onlyL1 && why.indexOf('not enough different usable subjects') >= 0)) {
      let slots = emptySlots;
      if (slots.some(function (sl) { return !/^L1:/.test(sl.label); })) slots = slots.filter(function (sl) { return !/^L1:/.test(sl.label); });
      for (let i = 0; i < slots.length; i++) {
        const sl = slots[i], ok = slotLevels(sl);
        const acc = sl.accepts || {};
        let members = null;
        if (!acc.any) { members = []; (acc.groups || []).forEach(function (g) { members = members.concat(groupMembers(g)); }); members = members.concat(acc.subjects || []); }
        const hit = entries.filter(function (e) { return e.grade !== 'ABS' && ok.indexOf(e.level) < 0 && (!members || members.indexOf(e.subject_id) >= 0); })[0];
        if (hit) return { kind: 'level', subject: hit.subject, level: hit.level, ok: ok, slot: sl, allSame: allSame };
      }
      const needs = [];
      let more = 0, moreG3 = 0;
      slots.forEach(function (sl) {
        const n = SLOT_NEED[sl.label];
        if (n === '+') more += 1;
        else if (n === '+G3') moreG3 += 1;
        else if (n) { if (needs.indexOf(n) < 0) needs.push(n); }
        else { unmapped('slot:' + sl.label); needs.push('a subject for ' + sl.label.split(':')[0]); }
      });
      if (moreG3) needs.push(moreG3 === 1 ? 'one more G3 subject' : moreG3 + ' more G3 subjects');
      if (more) needs.push(more === 1 ? 'one more subject' : more + ' more subjects');
      if (needs.length) return { kind: 'needs', needs: needs, allSame: allSame };
    }
    if (why.indexOf('not enough different usable subjects') >= 0) {
      if (allSame) {
        const lvmap = (SCALES[d.slots[0].scale] || {}).levels || {};
        const have = {}, low = {};
        entries.forEach(function (e) {
          if (lvmap[e.level] && lvmap[e.level][e.grade] != null) have[e.subject_id] = true;
          else if (lvmap[e.level] && e.grade !== 'ABS') low[e.level] = true;  // a subject at a level that counts, at a grade that can't be used
        });
        const n = d.slots.length, k = Object.keys(have).length;
        // MOE's PFP
        // page, "G2/N(A)-Level grade 5 and 6 cannot be used", so name the grades the rule can't use, level by level, from its scale
        const lowGrades = Object.keys(low).map(function (lv) {
          const gs = gradesFor({ level: lv }).filter(function (g) { return lvmap[lv][g] == null && g !== 'ABS'; });
          return { level: lv, grades: gs, best: gradesFor({ level: lv }).filter(function (g) { return lvmap[lv][g] != null; }).slice(-1)[0] };
        }).filter(function (x) { return x.grades.length; });
        if (k < n) return { kind: 'fewer', n: n, have: k, ok: allSame, low: lowGrades };
      }
      return { kind: 'fewer' };
    }
    unmapped('why:' + why);
    return { kind: 'other' };
  }
  function levelsPhrase(ok) { return 'only ' + joinAnd(ok.map(levelName)) + ' subjects'; }
  function counts(who) { return /courses$|diplomas$|institutions$| and /.test(who) ? ' count ' : ' counts '; }
  function atLevels(ok) { return ok.length >= 3 ? '' : ' at ' + (ok.length === 2 ? ok.map(levelName).join(' or ') : levelName(ok[0])); }
  function levelReason(res, m) {
    const head = 'your ' + m.subject + ' is at ' + levelName(m.level) + '. ';
    if (m.allSame) return head + whoCounts(res.id) + counts(whoCounts(res.id)) + levelsPhrase(m.ok) + '.';
    const need = SLOT_NEED[m.slot.label];
    return head + 'It needs ' + (need && need.charAt(0) !== '+' ? need : 'a subject at ' + joinAnd(m.ok.map(levelName))) + '.';
  }
  function whyNot(res) {
    const m = missingInfo(res);
    if (m.kind === 'na') return 'None of your subjects can be used for it.';
    if (m.kind === 'stub') return 'This app does not work it out.';
    if (m.kind === 'level') { const t = levelReason(res, m); return t.charAt(0).toUpperCase() + t.slice(1); }
    if (m.kind === 'needs') return 'You need ' + joinAnd(m.needs) + ' for it.';
    if (m.kind === 'fewer' && m.n && m.low && m.low.length) return lowSentence(m).replace(/^./, function (c) { return c.toUpperCase(); });
    if (m.kind === 'fewer' && m.n) return 'It needs ' + m.n + ' subjects' + atLevels(m.ok) + ', and you have ' + m.have + '.';
    if (m.kind === 'fewer') return 'You need more subjects that count for it. Each subject counts only once.';
    return 'It needs subjects that are not in your list.';
  }
  function cantSentence(res, name) {
    const nm = name || shortName(res && res.id);
    // fix 5: in 2027 a level with no mark yet is the usual reason; name those subjects
    const blank = unmarkedRows();
    if (S.year === 2027 && blank.length) return STRINGS.addMarksFor(blank.map(rowLabel), nm);
    const m = missingInfo(res);
    if (m.kind === 'level') return 'Your ' + nm + " can't be worked out because " + levelReason(res, m);
    if (m.kind === 'fewer' && m.n && m.low && m.low.length) return 'Your ' + nm + " can't be worked out because " + lowSentence(m);
    if (m.kind === 'fewer' && m.n) return 'Your ' + nm + " can't be worked out because it needs " + m.n + ' subjects' + atLevels(m.ok) + ', and you have ' + m.have + '.';
    return 'Your ' + nm + " can't be worked out. " + whyNot(res);
  }
  // "G2 grades 5 and 6 can't be used for it, so 3 of your subjects count, and it needs 5."
  function lowSentence(m) {
    const which = joinAnd(m.low.map(function (x) { return levelName(x.level) + ' grade' + (x.grades.length > 1 ? 's ' : ' ') + joinAnd(x.grades.map(function (g) { return gradeLabel(x.level, g); })); }));
    return which + " can't be used for it, so " + m.have + ' of your subjects count' + (m.have === 1 ? 's' : '') + ', and it needs ' + m.n + '.';
  }
  // 2027: subjects with a level and no mark (or grade) yet; listed only once some marks are in
  function unmarkedRows() {
    if (S.year !== 2027) return [];
    const blank = S.rows.filter(function (r) { return !r.skip && r.level && (rowNeed(r) === 'mark27' || rowNeed(r) === 'grade27' || (!r.name && r.core)); });
    const any = S.rows.some(function (r) { return !r.skip && r.name && r.level && rowNeed(r) === ''; });
    return any ? blank : [];
  }
  function bonusItems(res) {
    return ((res && res.bonus && res.bonus.items) || []).filter(function (it) { return it.points && it.scope !== 'choice'; })
      .map(function (it) { return (BONUS_NAMES[it.id] || String(it.label).split(' (')[0]) + ' ' + it.points; });
  }
  // "Your net ELR2B2-A is 12, after 1 bonus point (CCA 1)."
  function scoreSentence(res) {
    const name = shortName(res.id);
    if (res.gross == null) return cantSentence(res, name);
    if (res.net == null) return 'Your ' + name + ' is ' + res.gross + '. ' + whoCounts(res.id) + counts(whoCounts(res.id)) + 'no bonus points.';
    const b = res.gross - res.net;
    if (!b) return 'Your net ' + name + ' is ' + res.net + '. You have no bonus points for it.';
    const items = bonusItems(res);
    const sum = ((res.bonus && res.bonus.items) || []).reduce(function (a, it) { return a + (it.scope !== 'choice' && it.capped !== false ? it.points : 0); }, 0);
    const capped = res.bonus && res.bonus.cap != null && sum > res.bonus.cap;
    return 'Your net ' + name + ' is ' + res.net + ', after ' + plural(b, 'bonus point') + ' (' + items.join(', ') + (capped ? ', capped at ' + res.bonus.cap : '') + ').';
  }
  const GATE_WHO = {
    jc_gross: 'JC courses need', mi_gross: 'Millennia Institute courses need', poly_net: 'Polytechnic diplomas need',
    nursing_net: 'The Diploma in Nursing needs', dpp_gross: 'DPP needs', pfp_gross: 'PFP needs', ite2_gross: 'ITE 2-year courses need'
  };
  function thresholdItem(checkId, aggId, met) {
    const c = checkOf(aggId, checkId);
    const res = R.byId[aggId];
    const net = c && c.type === 'net_max';
    const short = shortName(aggId);
    let text = GATE_WHO[checkId] + ' a ' + (net ? 'net ' : 'gross ') + short + ' of ' + (c ? c.max : '') + ' or better' + (net ? '.' : ', counted before bonus points.');
    if (!res || res.gross == null) text += ' ' + cantSentence(res);
    else text += net ? ' Yours is ' + res.net + '.' : ' Your gross ' + short + ' is ' + res.gross + '.';
    return { met: met, text: text };
  }
  function failedSubjectItems(aggId, checkId) {
    const res = R.byId[aggId];
    const e = res && (res.eligibility || []).filter(function (x) { return x.id === checkId; })[0];
    const c = checkOf(aggId, checkId);
    if (!e || !c) return [];
    return (c.items || []).filter(function (it) { return String(e.detail).indexOf(it.label) >= 0; }).map(function (it) { return it.label; });
  }
  function subjectsItems(gate, r) {
    const ids = gate.id.split('|');
    const subjId = ids.filter(function (i) { return /_subjects$/.test(i); })[0] || (r.stream === 'Millennia Institute' ? 'mi_subjects' : 'jc_subjects');
    const condId = ids.filter(function (i) { return /_conditional$/.test(i); })[0] || (r.stream === 'Millennia Institute' ? 'mi_conditional' : 'jc_conditional');
    const res = R.byId[r.aggregate_id];
    const el = {};
    ((res && res.eligibility) || []).forEach(function (x) { el[x.id] = x; });
    const subj = el[subjId], cond = el[condId];
    if (subj && subj.met === true) return [{ met: true, text: 'You meet the grade requirements for English Language, Mathematics and Mother Tongue Language.' }];
    if (subj && subj.met === null) {
      // the engine contract: a requirement that rests on a grade the rules are silent about is "can't be worked out"
      const on = (subj.rests_on || []).map(function (x) { return x.subject + ' (' + levelName(x.level) + ' ' + gradeLabel(x.level, x.grade) + ')'; });
      return [{ met: null, text: "The grade requirement for specific subjects can't be worked out" + (on.length ? ', because it rests on your ' + joinAnd(on) + ', which may not count.' : '.') + ' Check with your teacher.' }];
    }
    const failed = failedSubjectItems(r.aggregate_id, subjId);
    const list = failed.length ? failed : ['one of the specific subjects'];
    const out = [{ met: cond && cond.met === true ? 'cond' : false, text: 'You do not meet the grade requirement for: ' + list.join('; ') + '.' }];
    if (cond && cond.met === true) {
      out.push({ met: 'cond', text: 'You can still apply on condition.', resit: r.stream === 'Millennia Institute' ? 'mi' : 'jc' });
    } else if (subj && subj.absent) {
      out.push({ met: false, text: "An 'Absent' grade in one of these subjects rules out conditional admission." });
    } else if (subj && subj.no_result && subj.no_result.length) {
      out.push({ met: false, text: "You can't apply on condition, because you have no result in this subject. Conditional admission is for a subject you sat and must sit again." });
    } else if (subj && subj.wrong_level && subj.wrong_level.length) {
      // a G2 grade never stands in for a G3 one: grades map down a level, not up
      out.push({ met: false, text: "You can't apply on condition, because your result in this subject is not at the level asked. Conditional admission is for a subject you sat at that level and must sit again." });
    } else {
      const c = checkOf(r.aggregate_id, condId);
      if (c && c.band) out.push({ met: false, text: "You can't apply on condition either. That needs an " + shortName(r.aggregate_id) + ' of ' + c.gross_max +
        ' or better, or ' + c.band[0] + ' to ' + c.band[1] + ' with A1 or A2 in every relevant subject.' });
    }
    return out;
  }
  function applyingItems(g, r) {
    const rec = RECS[r.requirement_key] || {};
    const src = (rec.application_requirements || []).filter(function (a) { return a.id === g.id; })[0];
    const line = src && src.lines && src.lines[0];
    const opts = (line && line.options) || [];
    const ids = [];
    const words = opts.map(function (o) {
      const lv = Object.keys(o.max_grade || {})[0];
      (o.subjects || []).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
      const name = (o.subjects || []).map(function (id) { return CAT_BY_ID[id] ? CAT_BY_ID[id].name : id; }).join(' or ');
      return name + ' ' + (o.max_grade || {})[lv] + ' (' + (({ G3: 'O-Level', G2: 'N(A)-Level', G1: 'N(T)-Level' })[lv] || lv) + ')';
    });
    const fam = ids.map(function (id) { return CAT_BY_ID[id] && CAT_BY_ID[id].family; }).filter(Boolean)[0];
    const lang = fam ? fam.charAt(0).toUpperCase() + fam.slice(1) : 'subject';
    const by = ((g.lines && g.lines[0] && g.lines[0].satisfied_by) || []).map(function (x) { return x.subject + ' ' + gradeLabel(x.level, x.grade); });
    if (g.met === true) return [{ met: true, text: 'You have the ' + lang + ' grade this diploma asks for: ' + (by.join(', ') || lang) + '.' }];
    if (!words.length) { unmapped('apply:' + g.id); return [{ met: g.met, text: 'This diploma asks for a grade in a particular subject. CourseFinder lists it.' }]; }
    const mine = ((R && R.entries) || []).filter(function (e) { return ids.indexOf(e.subject_id) >= 0 && e.grade !== 'ABS'; })
      .map(function (e) { return e.subject + ' ' + gradeLabel(e.level, e.grade) + ' (' + levelName(e.level) + ')'; });
    return [{ met: g.met, text: 'This diploma asks for one of: ' + joinOr(words) + '. Yours: ' + (mine.length ? mine.join(', ') : 'none') + '.' }];
  }
  function gateItems(g, r) {
    const base = g.id.split('|')[0];
    if (GATE_WHO[base]) return [thresholdItem(base, r.aggregate_id, g.met)];
    if (/_subjects$/.test(base)) return subjectsItems(g, r);
    if (base === 'ite_sat5') {
      const m = /^(\d+) distinct/.exec(g.detail || '');
      return [{ met: g.met, text: 'ITE courses in the JAE need at least 5 O-Level subjects.' + (m ? ' You have ' + m[1] + '.' : '') }];
    }
    if (base === 'dpp_na') return [{ met: g.met, text: g.met ? 'You have N(A)-Level results.' : 'DPP is for students with N(A)-Level results.' }];
    if (base === 'pfp_na') return [{ met: g.met, text: g.met ? 'You have N(A)-Level results.' : 'PFP is for students with N(A)-Level results.' }];
    if (base === 'applying_requirement') return applyingItems(g, r);
    if (base === 'ite3_mer') {
      if (g.met === null) return [];
      return [{ met: g.met, text: (g.met ? 'You meet' : 'You do not meet') + ' the grade requirements for ' + shortName(r.aggregate_id) + '.' }];
    }
    unmapped('gate:' + g.id);
    return [{ met: g.met, text: 'One of the requirements could not be described here. CourseFinder lists them all.' }];
  }
  function lineSubjects(line) {
    return (line.satisfied_by || []).map(function (s) { return s.subject + ' ' + gradeLabel(s.level, s.grade); }).join(', ');
  }
  function lineChoices(r, line) {
    if (!/^Any one of the following/i.test(line.text || '')) return '';
    const rec = RECS[r.requirement_key];
    const src = rec && rec.mer && (rec.mer.lines || []).filter(function (l) { return l.id === line.id; })[0];
    if (!src || !src.options) return '';
    const names = [];
    src.options.forEach(function (o) { (o.subjects || []).forEach(function (id) { const c = CAT_BY_ID[id]; if (c && names.indexOf(c.name) < 0) names.push(c.name); }); });
    return names.join(', ');
  }
  function starNote() {
    const names = groupMembers('ITE_SCIENCE_SUBSTITUTES').map(function (id) { return CAT_BY_ID[id] ? CAT_BY_ID[id].name : id; });
    return names.length ? joinOr(names) + ' can count in place of Science' : '';
  }
  function merItems(m, r) {
    if (r.exercise === 'PSE-2028') return [];
    const head = { met: m.met };
    if (m.met === true) {
      head.text = m.alternative_used ? "You meet the course's entry requirements through this route: " +
        String(m.alternative_used.label || '').replace(/^Or\s+/i, '') + '.' : "You meet the course's entry requirements.";
    } else if (m.met === false) {
      head.text = "You do not meet the course's entry requirements.";
    } else if (m.pdf_variant) {
      head.text = "MOE's two lists give different entry requirements for this course. Your results meet one list but not the other.";
    } else {
      head.text = 'The published entry requirements do not say enough to decide.';
    }
    head.lines = (m.lines || []).map(function (l) {
      if (l.kind === 'together') {
        const d = DEFS[r.aggregate_id];
        const n = d ? (d.slots || []).length : 5;
        const mx = /total of (\d+)/.exec(l.text || '');
        return { met: l.met, text: 'The same ' + n + ' subjects that make up ' + shortName(r.aggregate_id) + ' must meet all these lines' +
          (mx ? ', with a total of ' + mx[1] + ' or better.' : '.'), by: '', choices: '' };
      }
      return { met: l.met, text: l.text, by: lineSubjects(l), choices: lineChoices(r, l), star: /\*/.test(l.text || '') ? starNote() : '' };
    });
    return [head];
  }
  function reasonItems(r) {
    const out = [];
    (r.reasons || []).forEach(function (x) {
      if (x.kind === 'aggregate') {
        if (x.blocking && x.cant_be_worked_out) out.push({ met: null, text: cantSentence(R.byId[r.aggregate_id]) + ' ITE uses it to place students.' });
        return;
      }
      if (x.kind === 'gate') { gateItems(x, r).forEach(function (i) { out.push(i); }); return; }
      if (x.kind === 'mer') { merItems(x, r).forEach(function (i) { out.push(i); }); return; }
      unmapped('kind:' + x.kind);
    });
    return out;
  }

  /* ================================================================================================ states, ranges, nets, the gap */
  function offerState(r) {
    if (r.exercise === 'PSE-2028') return r.eligible === false ? 'no' : 'browse';
    if (r.eligible === true) return (r.reasons || []).some(function (x) { return x.conditional; }) ? 'cond' : 'yes';
    if (r.eligible === false) return 'no';
    return 'unsure';
  }
  const STATE_RANK = { yes: 0, cond: 1, browse: 1, unsure: 2, no: 3 };
  // THE ONLY READER of last year's range (D8). It refuses PFP and PSE rows, and any range whose exercise or aggregate
  // does not match the course row's own route (a PFP row's snapshot range is the JAE diploma range).
  function lastYearRange(r) {
    if (!r || r.route === 'PFP' || r.stream === 'Polytechnic Foundation Programme' || r.exercise === 'PSE-2028') return null;
    if (RANGE_EXERCISES.indexOf(r.exercise) < 0) return null;
    if (r.net_range_basis && r.aggregate_display_name && r.net_range_basis !== r.aggregate_display_name) return null;
    const v = r.net_range_2026;
    return (Array.isArray(v) && v.length === 2 && isFinite(v[0]) && isFinite(v[1]) && v[0] !== null && v[1] !== null) ? [Number(v[0]), Number(v[1])] : null;
  }
  function roundHalfUp(v) { return Math.floor(v + 0.5); }
  function g3ToG2(p) { return p <= 3 ? 1 : p <= 6 ? 2 : Math.min(5, p - 4); }
  const ITE3_2028 = /^(R2B2|R1B3-[ABC]|B4)\(2027\)$/;
  const OLEVEL_FIVE = ['ELR2B2-C', 'ELR1B3-B', 'ELB4-A'];
  function estimate2028(agg, x, from) {
    if (x == null || !isFinite(x)) return null;
    agg = String(agg);
    if (!/\(2027\)$/.test(agg)) return null;  // only 2027 (SEC) ids; a 2026 id never gets an estimate
    let v;
    if (/^L1R4\(/.test(agg)) v = from === 'L1R4' ? Math.min(20, x) : Math.min(16, roundHalfUp(x * 5 / 6));
    else if (/^ELR2B2-[ABCD]\(/.test(agg)) v = Math.min(22, roundHalfUp(x * 4 / 5 + g3ToG2(roundHalfUp(x / 5))));
    else if (/^ELMAB3:ITE\(/.test(agg)) {
      if (OLEVEL_FIVE.indexOf(from) >= 0) { const q = Math.floor(x / 5), r = x % 5; v = r * g3ToG2(q + 1) + (5 - r) * g3ToG2(q); }
      else if (!from || from === 'ELMAB3') v = x;
      else return null;
    } else if (ITE3_2028.test(agg)) v = x;
    else return null;
    return Math.max(1, v);
  }
  const EST_SECS = ['pjc', 'pmi', 'ppoly', 'pite2', 'pite3'];
  // the 2026 JIE 'H' (DPP) row of an ITE course, by college and course name
  const JIEH_BY = {};
  Object.keys(RECS).forEach(function (k) { const x = RECS[k]; if (x && x.institution_type === 'ITE' && x.admission_route === 'JIEH') JIEH_BY[x.institution + '|' + x.course_name] = x; });
  // a 2028 course row -> the range it is estimated from, read where every range is read (lastYearRange, same guards).
  // { range, from, fromAgg, basis: 'jae' | 'jie' | 'olevel' }, or { none: true } when no 2026 figure exists
  function estRange(r) {
    if (!r || r.exercise !== 'PSE-2028' || r.route === 'PFP' || r.stream === 'Polytechnic Foundation Programme') return null;
    const rec = RECS[r.requirement_key], agg = r.aggregate_id;
    if (!rec) return null;
    const read = function (row, ex) { return lastYearRange(Object.assign({}, row, { exercise: ex, route: row.route || row.admission_route || '', stream: '' })); };
    let src = null;
    if (agg === 'L1R4(2027)' && rec.admission_route === 'JAE' && (rec.aggregate_type === 'L1R5' || rec.aggregate_type === 'L1R4')) {
      const v = read(rec, 'JAE-2027'); if (v) src = { from: v, fromAgg: rec.aggregate_type, basis: 'jae' };
    } else if (/^ELR2B2-[ABCD]\(2027\)$/.test(agg) && rec.admission_route === 'JAE' && rec.aggregate_type === agg.replace(/\(2027\)$/, '')) {
      const v = read(rec, 'JAE-2027'); if (v) src = { from: v, fromAgg: rec.aggregate_type, basis: 'jae' };
    } else if (/^ELMAB3:ITE\(/.test(agg)) {
      const h = JIEH_BY[rec.institution + '|' + rec.course_name], hv = h && read(h, 'DPP-2027');
      if (hv) src = { from: hv, fromAgg: 'ELMAB3', basis: 'jie' };
      else if (rec.admission_route === 'JAE' && OLEVEL_FIVE.indexOf(rec.aggregate_type) >= 0) { const v = read(rec, 'JAE-2027'); if (v) src = { from: v, fromAgg: rec.aggregate_type, basis: 'olevel' }; }
    } else if (ITE3_2028.test(agg) && rec.admission_route === 'JIEN') {
      const v = read(rec, 'JIE-N-2027'); if (v) src = { from: v, fromAgg: rec.aggregate_type, basis: 'jie' };
    } else return null;
    if (!src) return { none: true };
    const lo = estimate2028(agg, src.from[0], src.fromAgg), hi = estimate2028(agg, src.from[1], src.fromAgg);
    return lo == null || hi == null ? { none: true } : { range: [lo, hi], from: src.from, fromAgg: src.fromAgg, basis: src.basis };
  }
  function hasCutoffs(sec) { return S.year === 2026 || (S.year === 2027 && !!sec && EST_SECS.indexOf(sec.id) >= 0); }
  // D9: the net for this course's own aggregate. CCA and HMTL come with the engine's net; affiliation only on the
  // affiliated JC and LEP only on a host JC (when the data names the hosts), both marked with ¹.
  function offerNet(r) {
    const base = r.net != null ? r.net : r.gross;
    const out = { value: base, base: base, marked: false, marks: '', aff: 0, lep: 0, prog: '', notes: [] };
    if (base == null || r.stream !== 'Junior college' || r.exercise === 'PSE-2028') return out;
    const res = R && R.byId[r.aggregate_id];
    const v = (res && res.net_variants) || {};
    const keys = Object.keys(v);
    const affKey = keys.filter(function (k) { return /affiliated/i.test(k) && !/LEP/.test(k); })[0];
    const lepKey = keys.filter(function (k) { return /LEP/.test(k) && !/affiliated/i.test(k); })[0];
    const bothKey = keys.filter(function (k) { return /affiliated/i.test(k) && /LEP/.test(k); })[0];
    const aff = affiliatedJCs().some(function (n) { return norm(n) === norm(r.institution); });
    const lep = lepHere(r.institution);
    const cap = res && res.bonus && res.bonus.cap;
    const key = aff && lep ? bothKey : aff ? affKey : lep ? lepKey : null;
    if (key && v[key] != null && v[key] < base) { out.value = v[key]; out.marked = true; }
    // fix 3 + 6: a distinct mark for each condition (¹ affiliation, ² LEP), written on the "You" number
    if (aff) {
      const a = affKey && v[affKey] != null ? base - v[affKey] : 0;
      if (a > 0 && out.marked) { out.aff = a; out.marks += '¹'; out.notes.push('¹ ' + STRINGS.affNote(a)); }
      else out.notes.push(STRINGS.affCapped(cap));
    }
    if (lep && out.marked) {
      out.lep = (aff && out.aff ? base - out.aff : base) - out.value; out.prog = lep;
      if (out.lep > 0) { out.marks += '²'; out.notes.push('² ' + STRINGS.lepNote(out.lep, lep)); }
    } else if (!lep && !LEP_HOSTS && S.lep && S.lep !== 'None' && jcAsked()) out.notes.push(STRINGS.lepMaybe);
    return out;
  }
  // D8: one gap per offer. spare = last year's cut-off (the top of the range) minus your net; lower is better.
  // K1: the exercise a range comes from, by name
  function rangeExercise(r) { return !r ? '' : r.exercise === 'JAE-2027' ? '2026 JAE' : (r.exercise === 'DPP-2027' || r.exercise === 'JIE-N-2027') ? '2026 JIE' : ''; }
  function gapOf(r, net) {
    const agg = r ? shortName(r.aggregate_id) : '';
    if (r.stream === 'Polytechnic Foundation Programme') return { kind: 'pfp', agg: agg };
    const est = r.exercise === 'PSE-2028' ? estRange(r) : null;
    if (r.exercise === 'PSE-2028' && !est) return { kind: 'pse', agg: agg };
    if (est && est.none) return { kind: 'none', agg: agg, noFig: true };
    const range = est ? est.range : lastYearRange(r);
    if (!range || net == null || net.value == null) return { kind: 'none', range: range, agg: agg, est: est };
    const n = range[1] - net.value;
    return { kind: n >= 2 ? 'spare' : n >= -1 ? 'close' : 'short', n: n, range: range, agg: agg, ex: est ? STRINGS.est2028 : rangeExercise(r), est: est };
  }
  function signedNum(n) { return n < 0 ? '−' + (-n) : String(n); }
  function signed(n) { return n > 0 ? '+' + n : n < 0 ? '−' + (-n) : '0'; }
  function rangeText(rg) { return rg[0] === rg[1] ? String(rg[0]) : rg[0] + '–' + rg[1]; }
  function gapText(g) { return g && g.n != null ? signed(g.n) : ''; }
  // the pill: "+4" green (2 or more), amber (−1 to +1), outlined (−2 or less); a bonus mark rides on it
  function pillHTML(g, marks) {
    if (!g || g.n == null) return '';
    const cls = g.kind === 'spare' ? 'g-spare' : g.kind === 'close' ? 'g-close' : 'g-short';
    const words = STRINGS.pillWords(g.n);
    return '<span class="pill ' + cls + '" title="' + esc(words) + '" aria-label="' + esc(words) + '">' + esc(signed(g.n)) + (marks ? '<sup>' + marks + '</sup>' : '') + '</span>';
  }
  // the one badge: green fill (2+ to spare), amber (within 1 point), outlined (2+ short), grey text (no range)
  function gapHTML(g, marks, opts) {
    opts = opts || {};
    if (g && g.noFig) return '<span class="st-text">' + (opts.label ? '<span class="gap-l">' + esc(opts.label) + '</span> ' : '') + esc(STRINGS.noFigure) + '</span>';
    if (!g || g.n == null) return '';
    // "ELR2B2-B 6–14 [indicative] +4", the same in both years; the tag says what the range is
    return '<span class="gapr' + (opts.big ? ' big' : '') + '">' + (opts.label ? '<span class="gap-l">' + esc(opts.label) + '</span> ' : '') + rangeTagHTML(g, marks) + '</span>';
  }

  /* ================================================================================================ cards (D7) */
  function fieldLetters(field) { return RIASEC_OF[field] || ''; }
  // [new] a course fits a code when its field's letters include the code's first letter, or two of its letters
  function fits(letters) {
    if (!S.riasec.length || !letters) return false;
    const hit = S.riasec.filter(function (l) { return letters.indexOf(l) >= 0; });
    return letters.indexOf(S.riasec[0]) >= 0 || hit.length >= 2;
  }
  function makeOffer(r, label) {
    const net = offerNet(r);
    return { r: r, label: label || '', state: offerState(r), net: net, gap: gapOf(r, net) };
  }
  function bestOffer(offers) {
    const ok = offers.filter(function (o) { return o.state === 'yes' || o.state === 'cond' || o.state === 'browse'; });
    const ranged = ok.filter(function (o) { return o.gap.n != null; });
    if (ranged.length) return ranged.reduce(function (b, o) { return o.gap.n > b.gap.n ? o : b; }, ranged[0]);
    if (ok.length) return ok[0];
    const uns = offers.filter(function (o) { return o.state === 'unsure'; });
    return uns[0] || offers[0];
  }
  function finishCard(c) {
    c.id = 'c' + hash36(c.key);
    c.state = c.offers.reduce(function (b, o) { return STATE_RANK[o.state] < STATE_RANK[b] ? o.state : b; }, c.offers[0].state);
    c.best = bestOffer(c.offers);
    c.letters = c.letters || fieldLetters(c.field);
    c.fits = fits(c.letters);
    return c;
  }
  const STREAM_ORDER = ['Arts', 'Science', 'Commerce', 'International Baccalaureate'];
  function streamLabel(s) { return s === 'International Baccalaureate' ? 'IB' : s; }
  function buildCards() {
    const out = [];
    WHERE_ORDER.forEach(function (wid) {
      sectionsOf(wid).forEach(function (sec) {
        if (sec.kind === 'arts') { artsCards(wid, sec).forEach(function (c) { out.push(c); }); return; }
        const rs = R.results.filter(function (r) { return r.exercise === sec.ex && r.stream === sec.stream; });
        if (sec.kind === 'jc') {
          const by = {}, order = [];
          rs.forEach(function (r) { if (!by[r.institution]) { by[r.institution] = []; order.push(r.institution); } by[r.institution].push(r); });
          order.forEach(function (inst) {
            const list = by[inst].slice().sort(function (a, b) { return STREAM_ORDER.indexOf(a.jc_stream || a.course_name) - STREAM_ORDER.indexOf(b.jc_stream || b.course_name); });
            out.push(finishCard({ key: sec.id + '|' + inst, where: wid, sec: sec.id, kind: 'jc', title: inst, inst: '', insts: [inst],
              codes: list.map(function (r) { return r.course_code; }), field: '', letters: '',
              offers: list.map(function (r) { return makeOffer(r, streamLabel(r.jc_stream || r.course_name)); }), sortName: inst.toLowerCase(),
              streams: list.map(function (r) { return r.jc_stream || r.course_name; }) }));
          });
          // a JC's streams fit different interests: the card fits when any stream does
          out.forEach(function (c) { if (c.kind === 'jc' && c.streams) { const l = c.streams.map(fieldLetters).join(''); c.letters = ''; c.fits = c.streams.some(function (s) { return fits(fieldLetters(s)); }); c.streamLetters = l; } });
        } else if (sec.kind === 'course') {
          rs.forEach(function (r) {
            const rec = RECS[r.requirement_key] || {};
            out.push(finishCard({ key: sec.id + '|' + r.requirement_key, where: wid, sec: sec.id, kind: 'course', title: r.course_name, inst: r.institution,
              insts: [r.institution], codes: [r.course_code], field: r.field_of_study || '', school: rec.faculty_or_school || POLY_SCHOOLS[r.institution + '|' + r.course_code] || '',
              offers: [makeOffer(r)], sortName: r.course_name.toLowerCase() }));
          });
        } else if (sec.kind === 'ite') {
          const by = {}, order = [];
          rs.forEach(function (r) { const k = r.course_name; if (!by[k]) { by[k] = []; order.push(k); } by[k].push(r); });
          order.forEach(function (k) {
            const list = by[k].slice().sort(function (a, b) { return a.institution < b.institution ? -1 : 1; });
            const inst = list.length === 1 ? list[0].institution : 'ITE College ' + list.map(function (r) { return r.institution.replace(/^ITE College /, ''); }).join(', ');
            out.push(finishCard({ key: sec.id + '|' + k, where: wid, sec: sec.id, kind: 'ite', title: k, inst: inst, insts: list.map(function (r) { return r.institution; }),
              codes: list.map(function (r) { return r.course_code; }), iteCodes: list.map(function (r) { return r.ite_course_code || ''; }), field: list[0].field_of_study || '',
              offers: list.map(function (r) { return makeOffer(r, r.institution); }), sortName: k.toLowerCase() }));
          });
        } else if (sec.kind === 'pfp') {
          const by = {}, order = [];
          rs.forEach(function (r) {
            const rec = RECS[r.requirement_key] || {};
            const special = PFP_SPECIALISED.some(function (n) { return norm(n) === norm(r.course_name); });
            const k = special ? 'S|' + r.institution + '|' + r.course_name : 'C|' + r.institution + '|' + r.pfp_cluster + '|' + (rec.pfp_subcluster || '');
            if (!by[k]) { by[k] = []; order.push(k); }
            by[k].push(r);
          });
          order.forEach(function (k) { out.push(pfpCard(wid, sec, k, by[k])); });
        }
      });
    });
    return out;
  }
  function pfpCard(wid, sec, key, rs) {
    const special = key.charAt(0) === 'S';
    const r0 = rs[0];
    const rec = RECS[r0.requirement_key] || {};
    const states = rs.map(offerState);
    const same = states.every(function (s) { return s === states[0]; });
    const title = special ? r0.course_name : (rec.pfp_subcluster ? r0.pfp_cluster + ': ' + rec.pfp_subcluster : r0.pfp_cluster);
    const fields = [];
    rs.forEach(function (r) { if (r.field_of_study && fields.indexOf(r.field_of_study) < 0) fields.push(r.field_of_study); });
    const offer = makeOffer(r0);
    offer.state = same ? states[0] : 'unsure';
    offer.mixed = !same;
    const letters = fields.map(fieldLetters).join('');
    return finishCard({ key: sec.id + '|' + key, where: wid, sec: sec.id, kind: 'pfp', title: title, inst: r0.institution, insts: [r0.institution],
      codes: rs.map(function (r) { return r.course_code; }), field: fields.length === 1 ? fields[0] : '', fields: fields, letters: letters, special: special,
      cluster: special ? PFP_CLUSTERS[3] : r0.pfp_cluster,
      offers: [offer], sortName: (r0.institution + ' ' + title).toLowerCase(),
      diplomas: rs.map(function (r, i) {
        return { name: r.course_name, url: r.moe_url, state: states[i], field: r.field_of_study,
          progress: (r.notes || []).filter(function (n) { return /^Needed to progress to Year 1/.test(n); }) };
      }).sort(function (a, b) { return a.name < b.name ? -1 : 1; }) });
  }
  // the arts institutions (D7 kind arts): no gap; "Meets the minimum" / "Below the minimum" / "Check with NAFA"
  // minimums in the institutions' words (data/locations/arts_institutions_2027.csv), used when the engine gives no checks
  const ARTS_MIN = { diploma: { 2026: 25, 2027: 21 }, nfp: { 2026: 15, 2027: 15 } };
  function artsWho(row) { return /LASALLE/.test(row.institution) ? 'LASALLE' : 'NAFA'; }
  function artsRows(kind) {
    return ARTS.filter(function (a) {
      if (/Early Admissions/i.test(a.programme_type)) return false;
      return kind === 'nfp' ? /Foundation Programme/.test(a.programme_type) : /^Full-time diploma/i.test(a.programme_type);
    });
  }
  function artsTitle(row) {
    const head = String(row.programme_type).split(':')[0];
    if (/Foundation Programme/.test(head)) return head.split(',')[0];
    const t = head.replace(/\s*\(\d+\)\s*$/, '').replace(/^Full-time diploma,?\s*/i, '');
    return t || 'Full-time diplomas';
  }
  function artsProgrammes(row) {
    const i = String(row.programme_type).indexOf(':');
    return i < 0 ? [] : row.programme_type.slice(i + 1).split(';').map(function (s) { return s.trim(); }).filter(Boolean);
  }
  // D7 + fix 1: one filter for the arts checks, used by the cards and the MOE table row: every engine check except
  // aptitude (a portfolio or an audition, information only); a 2026 card reads its own institution's minimum only
  function artsChecks(res, who) {
    return ((res && res.eligibility) || []).filter(function (e) {
      if (/_aptitude$/.test(e.id)) return false;
      if (who === 'NAFA' && e.id === 'lasalle_min') return false;
      if (who === 'LASALLE' && e.id === 'nafa_min') return false;
      return true;
    });
  }
  function artsVerdict(res, who) {
    const elig = artsChecks(res, who);
    if (!elig.length) return null;
    const failed = elig.filter(function (e) { return e.met === false; });
    if (failed.length && failed.every(function (e) { return e.near || /interview/i.test(e.detail || ''); })) return { state: 'check', near: true, failed: failed };
    if (failed.length) return { state: 'below', failed: failed };
    if (elig.some(function (e) { return e.met !== true; })) return { state: 'check', failed: [] };
    return { state: 'meets', failed: [] };
  }
  // a failed arts check in plain words: "English needs C6 or better. Yours is D7."
  function artsReason(e) {
    const id = String(e.id || '');
    const el = ((R && R.entries) || []).filter(function (x) { return x.subject_id === 'english_language'; });
    if (/english/.test(id)) {
      const nfp = /^nfp/.test(id);
      const mine = el.filter(function (x) { return nfp ? (x.level === 'G2' || x.level === 'N(A)') : (x.level === 'G3' || x.level === 'O'); })[0] || el[0];
      return (nfp ? STRINGS.artsEnglishNfp() : STRINGS.artsEnglish) + ' ' + (mine ? STRINGS.yoursIs(gradeLabel(mine.level, mine.grade)) : STRINGS.noEnglish);
    }
    const m = /(gross|net) (\d+) \(max (\d+)\)/.exec(e.detail || '');
    if (/^nfp_gross/.test(id) && m) return STRINGS.artsMinNfp(m[3]) + ' ' + STRINGS.yoursIs(m[2]);
    if (m) return STRINGS.artsMin(m[3]) + ' ' + STRINGS.yoursIs(m[2]);
    if (/_na$/.test(id)) return STRINGS.artsNa;
    return STRINGS.artsOther;
  }
  function artsState(sec, row) {
    const who = artsWho(row);
    const res = R && R.byId[sec.agg];
    if (!res || res.status !== 'computed' || res.gross == null) return { state: 'check', who: who, failed: [] };
    const value = who === 'NAFA' && sec.arts === 'diploma' && res.net != null ? res.net : res.gross;
    const v = artsVerdict(res, who);
    if (v) return { state: v.state, who: who, value: value, near: !!v.near, failed: v.failed };
    // no checks from the engine: the minimum in the institutions' words
    const max = ARTS_MIN[sec.arts][S.year];
    const el = ((R && R.entries) || []).filter(function (e) { return e.subject_id === 'english_language'; });
    let ok;
    if (sec.arts === 'diploma') {
      const g3 = el.filter(function (e) { return e.level === 'G3'; })[0];
      if (!g3) return { state: 'check', who: who, value: value, failed: [] };
      ok = value <= max && GRADE_ORDER.G3.indexOf(g3.grade) >= 0 && GRADE_ORDER.G3.indexOf(g3.grade) <= 5;
    } else {
      const g2 = el.filter(function (e) { return e.level === 'G2'; })[0];
      if (!g2) return { state: 'check', who: who, value: value, failed: [] };
      if (value <= max && (g2.grade === '4' || g2.grade === '5')) return { state: 'check', who: who, value: value, near: true, failed: [] };
      ok = value <= max && ['1', '2', '3'].indexOf(g2.grade) >= 0;
    }
    return { state: ok ? 'meets' : 'below', who: who, value: value, failed: [] };
  }
  function artsCards(wid, sec) {
    return artsRows(sec.arts).map(function (row, i) {
      const st = artsState(sec, row);
      const offer = { r: null, row: row, label: '', state: st.state === 'meets' ? 'yes' : st.state === 'below' ? 'no' : 'unsure', arts: st, gap: { kind: 'none' }, net: { value: st.value } };
      const who = artsWho(row);
      return finishCard({ key: sec.id + '|' + who + '|' + artsTitle(row), where: wid, sec: sec.id, kind: 'arts', title: artsTitle(row), inst: who, insts: [who],
        codes: [], field: '', letters: '', offers: [offer], row: row,
        sortName: (who + ' ' + artsTitle(row)).toLowerCase() });
    });
  }

  /* ================================================================================================ filters and order (D6) */
  function cardsIn(wid, secId) { return (CARDS || []).filter(function (c) { return c.where === wid && (!secId || c.sec === secId); }); }
  function filterParts() {
    const parts = [];
    if (S.q) parts.push('“' + S.q + '”');
    S.fields.forEach(function (f) { parts.push(f); });
    S.insts.forEach(function (i) { parts.push(i); });
    return parts;
  }
  function matchesFilters(card, skipInst) {
    if (!skipInst && S.insts.length) {
      const mine = instFilterFor(card.where);
      if (mine.length && !card.insts.some(function (i) { return mine.indexOf(i) >= 0; })) return false;
    }
    if (S.fields.length && (card.kind === 'course' || card.kind === 'ite' || card.kind === 'pfp')) {
      const fs = card.fields || (card.field ? [card.field] : []);
      if (!fs.some(function (f) { return S.fields.indexOf(f) >= 0; })) return false;
    }
    if (S.q) {
      const q = norm(S.q);
      const hay = norm(card.title + ' ' + card.insts.join(' ') + ' ' + card.codes.join(' ') + ' ' + (card.iteCodes || []).join(' ') + ' ' + (card.inst || '') +
        (card.diplomas ? ' ' + card.diplomas.map(function (d) { return d.name; }).join(' ') : '') +
        (card.row ? ' ' + artsProgrammes(card.row).join(' ') : ''));
      if (q && hay.indexOf(q) < 0) return false;
    }
    return true;
  }
  // no Sort: every list is in chance order
  function sortKey() { return 'comp'; }
  // the buckets of the default order: within reach (smallest margin first), short (smallest shortfall first),
  // no range, not sure; can't apply sits in the fold at the end
  function bucketOf(c) {
    if (c.state === 'no') return 'no';
    if (c.state === 'unsure') return 'unsure';
    if (c.kind === 'arts') return 'none';
    const g = c.best.gap;
    if (g.n == null) return 'none';
    return g.n >= 0 ? 'reach' : 'short';
  }
  function byName(a, b) { return a.sortName < b.sortName ? -1 : a.sortName > b.sortName ? 1 : 0; }
  function orderCards(list) {
    const key = sortKey();
    if (key === 'name') return [{ cards: list.slice().sort(byName) }];
    // K4: (cut-off − your net) ascending: the most competitive course for you first; short ones above your number
    function compOrder(cards) {
      const ranged = [], none = [], unsure = [];
      cards.forEach(function (c) {
        if (c.state === 'unsure' && c.kind !== 'arts' && c.kind !== 'pfp') unsure.push(c);
        else if (c.kind === 'arts' || c.kind === 'pfp' || !c.best || c.best.gap.n == null) none.push(c);
        else ranged.push(c);
      });
      ranged.sort(function (x, y) { return x.best.gap.n - y.best.gap.n || byName(x, y); });
      none.sort(function (x, y) { return (x.kind === 'arts' ? STATE_RANK[x.state] - STATE_RANK[y.state] : 0) || byName(x, y); });
      unsure.sort(byName);
      return [{ cards: ranged }, { divider: 'none', cards: none }, { divider: 'unsure', cards: unsure }];
    }
    if (key === 'fit') {
      const yes = list.filter(function (c) { return c.fits; }), rest = list.filter(function (c) { return !c.fits; });
      return compOrder(yes).concat([{ rule: true, cards: [] }]).concat(compOrder(rest));
    }
    return compOrder(list);
  }
  /* ================================================================================================ Screen 1: results and choices (D2-D4) */
  // pick one = a joined bar with one part filled; pick any = separate chips with + / ✓ (design principles B1)
  function segHTML(name, opts, current, attrs) {
    return '<div class="seg seg-' + opts.length + '" role="group" aria-label="' + esc(attrs.label) + '">' + opts.map(function (o) {
      const v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o, aria = Array.isArray(o) && o[2] ? ' aria-label="' + esc(o[2]) + '"' : '';
      return '<button type="button" class="seg-btn" data-do="' + name + '" data-v="' + esc(v) + '" aria-pressed="' + (String(current) === String(v)) + '"' + aria + '>' + esc(t) + '</button>';
    }).join('') + '</div>';
  }
  function anyChip(act, v, label, on, extra) {
    return '<button type="button" class="chip-any" data-do="' + act + '" data-v="' + esc(v) + '" aria-pressed="' + !!on + '"' + (extra || '') + '>' +
      '<span class="ca-mark" aria-hidden="true">' + (on ? '✓' : '+') + '</span>' + esc(label) + '</button>';
  }
  // rows that stop "Show my courses" (D4): in 2026 every listed subject not marked "I didn't take this"; in 2027 only
  // a mark that cannot be read
  function blocking(need) {
    if (S.year === 2027) return need === 'markBad' || need === 'unknown';
    return need === 'pick' || need === 'level' || need === 'grade' || need === 'mark' || need === 'markBad' || need === 'unknown';
  }
  function missingRows() { return S.rows.filter(function (r) { return blocking(rowNeed(r)); }); }
  let INPUT_PROBLEMS = [];  // the engine's reading of the rows, shown at each row (never raw)
  function inputProblems() {
    INPUT_PROBLEMS = [];
    if (!CORE_OK || typeof window.PSE.checkInputs !== 'function') return;
    const sent = engineSubjects();
    if (!sent.subjects.length) return;
    try {
      const rep = window.PSE.checkInputs(sent.subjects) || {};
      (rep.input_problems || []).forEach(function (p) { INPUT_PROBLEMS.push({ p: p, row: sent.ids[(p.row || 0) - 1] }); });
    } catch (e) { INPUT_PROBLEMS = []; }
  }
  function renderInput() {
    const el = $('#s-input');
    if (!el) return;
    inputProblems();
    // one step at a time. The year shows alone; the level after it; then the subjects, one at a time; then the
    // CCA and the two buttons; the tiles and the rest only after "Calculate my aggregates"
    let h = '<div class="s1">';
    h += '<section class="q q-year"><h2 class="q-h">' + esc(STRINGS.yearHead) + '</h2>' + segHTML('year', [[2026, STRINGS.year[2026], STRINGS.yearAria[2026]], [2027, STRINGS.year[2027], STRINGS.yearAria[2027]]], S.year, { label: 'Exam year' }) + '</section>';
    if (!CORE_OK) h += '<div class="card warn"><p>' + esc(STRINGS.coreMissing) + '</p></div>';
    if (S.year) {
      h += '<section class="q"><h2 class="q-h">' + esc(STRINGS.levelHead) + '</h2>' +
        segHTML('level', YEAR_LEVELS[S.year].map(function (l) { return [l, STRINGS.levelName[l]]; }), S.level, { label: STRINGS.levelHead }) + '</section>';
    }
    if (S.year && S.level) {
      h += subjectsHTML();
      if (calcOn()) {
        h += '<div id="aggs-slot">' + summaryHTML('results') + '</div>';  // levels 1–3, live once calculated
        h += whereCardHTML();
        h += interestsHTML();
      }
    }
    h += '</div>';  // no footer (About, behind the i)
    holdFloor(el);
    el.innerHTML = h;
    RENDERED_INPUT = true;
    tileMotion();
    renderBar();
  }
  // K8: "What are you looking at?" is one card; each chip's follow-ups sit inside it, under the chips, in chip order
  function oLevelTrack() { return S.year === 2026 && S.level === 'O'; }
  // the JC follow-ups (secondary school, LEP) open under the JC chip; hidden means ignored, saved values kept
  function jcAsked() { return oLevelTrack() && S.where.indexOf('jc') >= 0; }
  let RENDERED_INPUT = false;
  let FU_SHOWN = [];  // follow-ups on screen last time, so a new one can pulse once (K9)
  let FIELDS_SEEN = false;
  let CHIP_WHY = '';
  // the tag's words open under the tag and stay inside the window
  function placeTip(btn) {
    const tip = btn && btn.nextElementSibling;
    if (!tip) return;
    tip.style.left = '0px';
    // inside the window and inside its own pane (a pane that scrolls must not grow sideways); a tile's keeps the page's
    // gutters
    const tile = tip.classList.contains('tile-tip'), pane = tile && !isWide() ? null : btn.closest('#s-list, #s-pane, .sheet');
    const pr = pane ? pane.getBoundingClientRect() : { left: 0, right: document.documentElement.clientWidth };
    const pad = tile ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sp-4')) || 0 : 8;
    const lo = Math.max(0, pr.left) + pad, hi = Math.min(document.documentElement.clientWidth, pr.right) - pad;
    const b = btn.getBoundingClientRect(), r = tip.getBoundingClientRect(), over = r.right - hi;
    if (over > 0) tip.style.left = Math.max(lo - b.left, -over) + 'px';
    // its arrow points at the middle of its trigger
    const nr = tip.getBoundingClientRect();
    tip.style.setProperty('--ax', Math.round(b.left + b.width / 2 - nr.left) + 'px');
  }
  let KEYED = false;
  document.addEventListener('keydown', function () { KEYED = true; }, true);
  document.addEventListener('pointerdown', function () { KEYED = false; }, true);
  document.addEventListener('pointerover', function (e) { const w = e.pointerType === 'mouse' && e.target.closest && e.target.closest('.ind-w'); if (w) { w.classList.add('hov'); placeTip(w.querySelector('.ind')); } });
  document.addEventListener('pointerout', function (e) { const w = e.target.closest && e.target.closest('.ind-w'); if (w && !w.contains(e.relatedTarget)) w.classList.remove('hov'); });
  document.addEventListener('focusin', function (e) { if (KEYED && e.target.classList && e.target.classList.contains('ind')) { e.target.setAttribute('aria-expanded', 'true'); placeTip(e.target); } });
  document.addEventListener('focusout', function (e) { if (KEYED && e.target.classList && e.target.classList.contains('ind')) e.target.setAttribute('aria-expanded', 'false'); });
  // G (B11): an open tag's words close three ways: the tag again, a tap anywhere else, or Esc
  // the tiles open the same pop-over. A tap inside a pop-over, or on its own trigger, is left to the trigger's
  // click; any other tap closes it; Escape closes it, and a tile gets the focus back
  function closeTips(except) { $$('.ind[aria-expanded="true"], .tile[aria-expanded="true"]').forEach(function (x) { if (x !== except) x.setAttribute('aria-expanded', 'false'); }); }
  document.addEventListener('pointerdown', function (e) { const w = e.target.closest && e.target.closest('.ind-w, .tile-w'); closeTips(w ? w.querySelector('.ind, .tile') : null); }, true);
  document.addEventListener('keydown', function (e) { if (e.key !== 'Escape') return; const t = $('.tile[aria-expanded="true"]'); closeTips(null); if (t) t.focus({ preventScroll: true }); });
  function whereCardHTML() {
    const live = liveWheres().filter(function (w) { return !resultsIn() || !routeShut(w) || routeReachable(w); });
    const fus = [];
    if (jcAsked() && live.indexOf('jc') >= 0 && !routeShut('jc')) fus.push('jc');  // no school question for a shut JC
    if (S.where.some(function (w) { return WHERE[w] && WHERE[w].fields && live.indexOf(w) >= 0; })) {
      fus.push('fields');
      if (!FIELDS_SEEN) { fieldsOpen = true; FIELDS_SEEN = true; }
    }
    if (live.length < 2 && !fus.length) return '';
    let h = '<section class="card where-card"><h2 class="q-h">' + esc(STRINGS.whereHead) + '</h2>';
    // "All" is on when no route is picked, and tapping it clears the picks
    const none = !S.where.some(function (w) { return live.indexOf(w) >= 0; });
    // once the results are in, a route with nothing open is greyed; a tap says why, in place, and adds nothing
    const shut = {};
    live.forEach(function (w) { shut[w] = routeShut(w); });
    if (live.length > 1) h += '<div class="chips-wrap" role="group" aria-label="' + esc(STRINGS.whereHead) + '">' + anyChip('where-all', 'all', STRINGS.allWord, none) +
      live.map(function (w) {
        return shut[w] ? anyChip('where-off', w, STRINGS.whereOpts[w], false, ' aria-disabled="true" data-shut="' + w + '" title="' + esc(shut[w].reason) + '"')
          : anyChip('where', w, STRINGS.whereOpts[w], S.where.indexOf(w) >= 0);
      }).join('') + '</div>';
    if (CHIP_WHY && shut[CHIP_WHY]) h += '<p class="chip-why" role="status" data-shut="' + CHIP_WHY + '">' + esc(shut[CHIP_WHY].reason) + '</p>';
    // no reason lines under the chips for a picked route's closed
    // pathways; a closed pathway better grades could open is a greyed tile with its own pop-over, and one they
    // couldn't isn't shown
    fus.forEach(function (k) {
      const fresh = RENDERED_INPUT && FU_SHOWN.indexOf(k) < 0;
      h += '<div class="fu' + (fresh ? ' pulse' : '') + '" data-fu="' + k + '">';
      if (k === 'jc') {
        h += '<p class="fu-l">' + esc(STRINGS.whereOpts.jc) + '</p>' + schoolHTML() +
          '<p class="q-h fu-h">' + esc(STRINGS.lepHead) + '</p>' + segHTML('lep', STRINGS.lepOpts, S.lep || 'None', { label: STRINGS.lepHead });
      } else {
        const names = ['poly', 'ite'].filter(function (w) { return S.where.indexOf(w) >= 0 && live.indexOf(w) >= 0; }).map(function (w) { return STRINGS.whereOpts[w]; });
        h += '<p class="fu-l">' + esc(names.join(' and ')) + '</p>' + fieldsHTML();
      }
      h += '</div>';
    });
    FU_SHOWN = fus;
    return h + '</section>';
  }
  function subjectsHTML() {
    // A5: once calculated, the card folds to one line (the subjects and grades, CCA, ✎ Edit) until Edit reopens it
    if (calcOn() && !CARD_OPEN) {
      const line = cardLine();
      return '<section class="card subj subj-c" id="subj-c"><button type="button" class="subj-open" data-do="subj-edit" aria-label="' + esc(STRINGS.subjects + ': ' + line + '. ' + STRINGS.edit) + '">' +
        '<span class="subj-line" data-wc="0">' + esc(line) + '</span><span class="subj-ed"><span aria-hidden="true">✎ </span>' + esc(STRINGS.edit) + '</span></button></section>';
    }
    let h = '<section class="card subj" aria-labelledby="h-subj"><div class="card-head"><h2 class="q-h" id="h-subj">' + esc(STRINGS.subjects) + '</h2>';
    if (S.mode === 'mark' && MARK_BANDS.G3) h += '<button type="button" class="info" data-do="bands" aria-expanded="' + !!KEEP.bands + '" aria-label="How marks become grades">ⓘ</button>';
    h += segHTML('mode', [['grade', STRINGS.grades], ['mark', STRINGS.marks]], S.mode, { label: 'Grades or marks' }) + '</div>';
    if (S.mode === 'mark' && KEEP.bands) h += bandsHTML();
    if (S.year === 2026) {
      h += '<p class="paste-line"><button type="button" class="btn-link quiet" data-do="paste-toggle" aria-expanded="' + pasteOpen + '">' + esc(STRINGS.paste) + '</button></p>';
      if (pasteOpen) h += pasteHTML();
    }
    // A3: the subjects answered (folded) and the one open subject; the ones not reached yet don't show
    const open = openRowId();
    h += '<div class="rows">' + S.rows.filter(function (r) { return rowDone(r) || r.id === open; }).map(function (r) { return rowHTML(r) + alsoTookHTML(r); }).join('') + '</div>';
    // the add list opens after the last subject, above the CCA, so the subject picked opens where it was
    if (ADDING && allDone()) h += addHTML();
    // A4: the core subjects done: the CCA, then "+ Add a subject" and "Calculate my aggregates" (once every row is done)
    if (coreDone()) {
      h += '<div class="step-end" id="step-end"><h3 class="q-h">' + esc(STRINGS.cca) + '</h3>' + segHTML('cca', STRINGS.ccaOpts, S.cca, { label: 'CCA grade' });
      if (allDone()) {
        h += '<div class="step-acts"><button type="button" class="btn" data-do="add-open" aria-expanded="' + ADDING + '">' + esc(STRINGS.addHead) + '</button>' +
          '<button type="button" class="' + (solidAction() === 'calc' ? 'btn-primary' : 'btn') + '" data-do="calc">' + esc(STRINGS.calc) + '</button></div>';
      }
      h += '</div>';
    }
    return h + '</section>';
  }
  // the folded card's one line: "EL 2 · CL 2 · Math 2 · Science (Chemistry, Biology) 4 · Humanities (SS, Geog) 4 · CCA Good"
  function subjShort(n) { return String(n).replace(/[A-Za-z][A-Za-z ]*[A-Za-z]/g, function (w) { return STRINGS.subjShort[w] || w; }); }
  function cardLine() {
    const parts = S.rows.filter(function (r) { return !r.skip && r.name; }).map(function (r) {
      return subjShort(shown(r.name)) + ' ' + (r.level !== S.level ? (STRINGS.levelShort[r.level] || r.level) + ' ' : '') + gradeLabel(r.level, rowGrade(r));
    });
    const cca = STRINGS.ccaShort(S.cca);
    if (cca) parts.push(cca);
    return parts.join(' · ');
  }
  // ONE place decides the one solid button on Results: "Calculate my aggregates" while the subjects card is open with its
  // buttons, else "What if?" when the near-miss card shows, else "Show my courses"
  function solidAction() {
    if (ROUTE.name === 'input' && S.year && S.level && (!calcOn() || CARD_OPEN)) return allDone() ? 'calc' : '';
    return nearMiss() ? 'what-if' : 'show';
  }
  function rowLabel(r) { return shown(r.name) || (PICKS[r.pick] && PICKS[r.pick].label) || 'this subject'; }
  /* one scroll rule, the same on every device. After a pick the page never scrolls up; when the
     newly opened subject (or the CCA and the two buttons) ends below the bottom bar or the window, the page scrolls down
     just enough to show it. The only other scroll is the one after "Calculate my aggregates" (toTiles). */
  function calmScroll(d) { window.scrollBy({ top: d, left: 0, behavior: calm() ? 'auto' : 'smooth' }); }
  function viewEdges() {
    const top = $('.topbar'), hi = top ? top.getBoundingClientRect().bottom : 0;
    let lo = window.innerHeight;
    const vv = window.visualViewport;
    if (vv) lo = Math.min(lo, vv.offsetTop + vv.height);
    ['#bar', '#tabs'].forEach(function (s) {
      const el = $(s);
      if (!el || el.hidden || !el.getClientRects().length || getComputedStyle(el).position !== 'fixed') return;
      const t = el.getBoundingClientRect().top;
      if (t > window.innerHeight / 2) lo = Math.min(lo, t);
    });
    return { hi: hi, lo: lo };
  }
  // the page never shrinks under the window: a fold near the bottom of the page can't pull the page up
  function holdFloor(el) {
    el = el || $('#s-input');
    if (!el || ROUTE.name !== 'input') return;
    el.style.minHeight = Math.max(0, Math.ceil(window.innerHeight - el.getBoundingClientRect().top)) + 'px';
  }
  // room for the page to scroll d further down
  function room(d) {
    const el = $('#s-input');
    if (!el) return;
    const more = window.scrollY + d - (document.documentElement.scrollHeight - window.innerHeight);
    if (more > 0) el.style.minHeight = Math.ceil(el.offsetHeight + more) + 'px';
  }
  // the gap kept between what opened and the window's edge: the spacing token --sp-3
  function gapPx() { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sp-3')) || 0; }
  function revealDown(el) {
    if (!el || ROUTE.name !== 'input') return;
    const r = el.getBoundingClientRect(), e = viewEdges();
    const g = gapPx(), d = Math.min(r.bottom - (e.lo - g), r.top - (e.hi + g));
    if (d < 1) return;
    room(d); calmScroll(d);
  }
  // A5, after "Calculate my aggregates" the page lands with the tiles just under the top bar, whether that is
  // up or down (the card above them has just folded). A frame lets the layout settle, then one scroll; once it ends, one
  // more look corrects anything more than 4 px out. Reduced motion: at once
  function tilesOff() {
    const card = $('#aggs') || $('#aggs-slot'), t = $('#aggs .tiles') || card;
    if (!card) return 0;
    const hi = viewEdges().hi;
    // the tiles a gap under the top bar, but never the card's own top under the bar
    return Math.min(t.getBoundingClientRect().top - (hi + gapPx()), card.getBoundingClientRect().top - hi);
  }
  function toTiles() {
    if (!$('#aggs') && !$('#aggs-slot')) return;
    const go = function (instant) { const d = tilesOff(); if (Math.abs(d) < 1) return; if (d > 0) room(d); window.scrollBy({ top: d, left: 0, behavior: instant || calm() ? 'auto' : 'smooth' }); };
    const raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
    raf(function () {
      go(false);
      let done = false;
      const fix = function () { if (done) return; done = true; window.removeEventListener('scrollend', fix); if (ROUTE.name === 'input' && Math.abs(tilesOff()) > 4) go(true); };
      window.addEventListener('scrollend', fix);
      setTimeout(fix, MOTION.flip + 760);
    });
  }
  // B: a double tap must not land on the subject that just opened: taps inside it are ignored for 300 ms
  let OPENED = { id: '', at: 0 };
  document.addEventListener('click', function (e) {
    if (!e.isTrusted || !OPENED.id || Date.now() - OPENED.at > 300) return;
    const box = document.getElementById(OPENED.id);
    if (box && box.contains(e.target)) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  // a pick on Results: render, then show what opened (the next subject, or the CCA and the buttons); kbd moves focus to it
  function stepSnap() { return { open: openRowId(), end: allDone() }; }
  function stepShow(snap, kbd) {
    if (ROUTE.name !== 'input') return;
    const open = openRowId();
    let el = null;
    if (open) { el = document.getElementById('row-' + open); if (el && open !== snap.open) OPENED = { id: el.id, at: Date.now() }; }
    else if (!snap.end && allDone()) { el = $('#step-end'); if (el) OPENED = { id: el.id, at: Date.now() }; }
    if (!el) return;
    revealDown(el);
    if (kbd) {
      const f = el.querySelector('.mark-in, [data-do="pick"]:not([disabled]), [data-do="grade"]:not([disabled]), [data-do="cca"], [data-do="calc"]');
      if (f) f.focus({ preventScroll: true });
    }
  }
  // snap: what was open before the change (taken before the data changes; the click handler takes it first thing)
  function stepTo(dataChanged, kbd, snap) { snap = snap || stepSnap(); update(dataChanged); stepShow(snap, kbd); }
  function rowHTML(r) {
    const need = rowNeed(r);
    const err = need === 'unknown';  // an unknown name is red at once, at its row
    if (rowCollapsed(r) && !err) {
      const meta = r.skip ? (r.auto && familyRows(r).length ? STRINGS.coveredBy(familyRows(r).map(rowLabel)) : STRINGS.notTaken) : (STRINGS.levelShort[r.level] || r.level) + ' · ' + gradeLabel(r.level, rowGrade(r));
      return '<div class="srow srow-c" id="row-' + r.id + '" data-row="' + r.id + '"><button type="button" class="srow-open" data-do="row-open" data-row="' + r.id + '" aria-label="' + esc(rowLabel(r) + ', ' + meta + '. Change it') + '">' +
        '<span class="srow-name" data-wc="0">' + esc(rowLabel(r)) + '</span><span class="srow-meta' + (r.skip ? ' muted' : '') + '" data-wc="0">' + esc(meta) + '</span><span class="pencil" aria-hidden="true">✎</span></button>' +
        (r.added ? '<button type="button" class="btn-x" data-do="remove-row" data-row="' + r.id + '" aria-label="' + esc(STRINGS.remove(rowLabel(r))) + '">×</button>' : '') + '</div>';
    }
    const pick = PICKS[r.pick];
    // a row that asks which subject shows only that choice; once picked, the choice folds into the title
    // ("Science (Chemistry, Biology) · change") and the level and grades sit right under it, as in every other row
    const picking = !!pick && (!r.name || PICK_OPEN === r.id);
    let h = '<div class="srow' + (err ? ' err' : '') + '" id="row-' + r.id + '" data-row="' + r.id + '"><div class="srow-head">' +
      (pick && r.name && !picking ? '<span class="srow-t"><span class="srow-name" data-wc="0">' + esc(rowLabel(r)) + '</span><span class="srow-chg-w" data-wc="0"><span aria-hidden="true"> · </span><button type="button" class="btn-link srow-chg" data-do="pick-change" data-row="' + r.id + '" aria-label="' + esc(STRINGS.changeSubject(rowLabel(r))) + '">' + esc(STRINGS.changeWord) + '</button></span></span>'
        : '<span class="srow-name" data-wc="0">' + esc(rowLabel(r)) + '</span>');
    const lvls = r.name ? allowedLevels(r.name) : YEAR_LEVELS[S.year];
    if (S.year === 2026 && r.name && lvls.length > 1 && !isMtlB(r)) {
      h += '<button type="button" class="lvl-chip" data-do="lvl-open" data-row="' + r.id + '" aria-expanded="' + (LVL_OPEN === r.id) + '" aria-label="Level: ' +
        esc(LEVEL[r.level] ? LEVEL[r.level].label : 'not set') + '. Change it" data-wc="0">' + esc(STRINGS.levelShort[r.level] || '?') + '</button>';
    }
    if (r.added) h += '<button type="button" class="btn-x" data-do="remove-row" data-row="' + r.id + '" aria-label="' + esc(STRINGS.remove(rowLabel(r))) + '">×</button>';
    h += '</div>';
    if (picking) {
      h += pickChipsHTML(r, pick);
      if (!r.added) h += '<div class="entry" data-wc="0"><button type="button" class="btn-link skip-btn" data-do="skip" data-row="' + r.id + '">' + esc(STRINGS.didntTake) + '</button></div>';
    } else if (S.year === 2027 && lvls.length > 1 && !isMtlB(r)) {
      h += '<div class="seg seg-' + lvls.length + ' seg-lvl" role="group" aria-label="Level for ' + esc(rowLabel(r)) + '" data-wc="0">' + lvls.map(function (lv) {
        return '<button type="button" class="seg-btn" data-do="row-level" data-row="' + r.id + '" data-v="' + lv + '" aria-pressed="' + (r.level === lv) + '">' + lv + '</button>';
      }).join('') + '</div>';
    } else if (LVL_OPEN === r.id && lvls.length > 1) {
      h += '<div class="seg seg-' + lvls.length + ' seg-lvl" role="group" aria-label="Level for ' + esc(rowLabel(r)) + '" data-wc="0">' + lvls.map(function (lv) {
        return '<button type="button" class="seg-btn" data-do="row-level" data-row="' + r.id + '" data-v="' + lv + '" aria-pressed="' + (r.level === lv) + '">' + esc(LEVEL[lv].label) + '</button>';
      }).join('') + '</div>';
    }
    if (picking) { /* the subject first; its level and grade once it is picked */ }
    else if (r.name && r.level) {
      h += '<div class="entry" data-wc="0">';
      if (rowMode(r) === 'mark') {
        h += '<div class="mark-line"><input id="mark-' + r.id + '" class="mark-in" type="text" inputmode="numeric" enterkeyhint="next" autocomplete="off" maxlength="5" placeholder="Mark" aria-label="Mark for ' +
          esc(rowLabel(r)) + '" value="' + esc(r.mark || '') + '" data-input="mark" data-row="' + r.id + '"><span class="mark-to" id="mark-to-' + r.id + '" aria-live="polite">' + markToText(r) + '</span></div>';
      } else {
        const grades = gradesFor(r);
        h += '<div class="chips n' + grades.length + '" role="group" aria-label="Grade for ' + esc(rowLabel(r)) + '">' + grades.map(function (g) {
          return '<button type="button" class="chip" data-do="grade" data-row="' + r.id + '" data-v="' + esc(g) + '" aria-pressed="' + (rowGrade(r) === g || (g === 'E' && rowGrade(r) === 'U' && scaleOf(r.level) === 'G1')) + '">' + esc(gradeLabel(r.level, g)) + '</button>';
        }).join('') + '</div>';
      }
      if (!r.added) h += '<button type="button" class="btn-link skip-btn" data-do="skip" data-row="' + r.id + '">' + esc(STRINGS.didntTake) + '</button>';
      h += '</div>';
    } else if (!r.added) {
      h += '<div class="entry" data-wc="0"><button type="button" class="btn-link skip-btn" data-do="skip" data-row="' + r.id + '">' + esc(STRINGS.didntTake) + '</button></div>';
    }
    if (need === 'unknown') {
      const opts = levelSubjects(r.level || S.level);
      h += '<div class="srow-err" role="alert">' + problemHTML({ field: 'subject', problem: 'unknown', subject: r.name }, r) + '</div>' +
        (opts.length ? '<select class="pick-more" data-change="pick" data-row="' + r.id + '" aria-label="' + esc(STRINGS.pickSubjectFor(r.name)) + '"><option value="">' + esc(STRINGS.pickSubject) + '…</option>' +
          opts.map(function (n) { return '<option value="' + esc(n) + '"' + (n === didYouMean(r.name)[0] ? ' selected' : '') + '>' + esc(shown(n)) + '</option>'; }).join('') + '</select>' : '');
    }
    else if (need === 'markBad') h += '<p class="srow-err">' + esc(STRINGS.rowNeed.markBad) + '</p>';
    if (r.note) h += '<p class="srow-note" role="status">' + esc(r.note) + '</p>';
    INPUT_PROBLEMS.filter(function (x) { return x.row === r.id; }).forEach(function (x) { h += '<div class="srow-note">' + problemHTML(x.p, r) + '</div>'; });
    return h + '</div>';
  }
  // a combined subject is one subject with one grade: "Science (Physics, Chemistry), one grade"
  function oneGrade(n) { return /^(Science|Humanities) \((?!Syllabus)/.test(n) ? shown(n) + STRINGS.oneGrade : shown(n); }
  // on a chip, "one grade" sits on its own small line, so the name is never cut off
  function oneGradeHTML(n) { return /^(Science|Humanities) \((?!Syllabus)/.test(n) ? esc(shown(n)) + '<span class="one-g"><span class="sr-only">, </span>' + esc(STRINGS.oneGrade.replace(/^, /, '')) + '</span>' : esc(shown(n)); }
  // an empty Science or Humanities slot steps aside once a subject of its family is entered elsewhere
  // it is never "not taken" while a subject of its family counts ("covered by Physics"), and it asks again
  // once those subjects are removed
  const SLOT_PICKS = ['science', 'science_sec', 'science_n', 'humanities'];
  function slotFamily(r) { return r.core && SLOT_PICKS.indexOf(r.pick) >= 0 && PICKS[r.pick] ? PICKS[r.pick].options() : null; }
  function familyRows(r) { const fam = slotFamily(r); return fam ? S.rows.filter(function (x) { return x !== r && x.name && !x.skip && fam.indexOf(x.name) >= 0; }) : []; }
  function settleSlots() {
    S.rows.forEach(function (r) {
      if (!slotFamily(r) || r.name) return;
      const covered = familyRows(r).length > 0;
      if (covered && !r.skip && !r.mine) { r.skip = true; r.auto = true; }
      else if (!covered && r.auto) { r.skip = false; r.auto = false; }
    });
  }
  // a pure subject on its slot offers its siblings right under the row: "Also took: + Chemistry + Biology"
  const PURE = { science: ['Physics', 'Chemistry', 'Biology'], humanities: ['Geography', 'History', 'Literature in English', 'Literature in Chinese', 'Literature in Malay', 'Literature in Tamil'] };
  // only under a collapsed row (an open row's own chips already offer them); the
  // Higher Mother Tongue under the Mother Tongue row
  function alsoOptions(r) {
    if (!r.name || !rowCollapsed(r) || r.skip) return [];
    let fam = null;
    if (r.core && /^science/.test(r.pick) && PURE.science.indexOf(r.name) >= 0) fam = PURE.science;
    else if (r.core && r.pick === 'humanities' && PURE.humanities.indexOf(r.name) >= 0) fam = PURE.humanities;
    else if (/^(Chinese|Malay|Tamil)$/.test(r.name) && catalogueEntry('Higher ' + r.name)) fam = ['Higher ' + r.name];
    if (!fam) return [];
    const taken = S.rows.map(function (x) { return x.name; });
    return fam.filter(function (n) { return taken.indexOf(n) < 0 && allowedLevels(n).length && existsAt(n, S.level); }).slice(0, 3);
  }
  function alsoTookHTML(r) {
    const opts = alsoOptions(r);
    if (!opts.length) return '';
    return '<div class="also"><span class="also-l">' + esc(STRINGS.alsoTook) + '</span>' + opts.map(function (n) {
      return '<button type="button" class="chip-any" data-do="add-pick" data-after="' + r.id + '" data-v="' + esc(n) + '"><span class="ca-mark" aria-hidden="true">+</span><span data-wc="0">' + esc(n) + '</span></button>';
    }).join('') + '</div>';
  }
  function pickChipsHTML(r, pick) {
    const lv = r.level || '';
    const opts = pickOptions(pick, lv);
    const chips = pick.chips.filter(function (n) { return opts.indexOf(n) >= 0; });
    const rest = opts.filter(function (o) { return chips.indexOf(o) < 0; });
    let h = '<div class="pick-chips" role="group" aria-label="' + esc(pick.label) + '" data-wc="0">' + chips.map(function (n) {
      return '<button type="button" class="chip chip-name" data-do="pick" data-row="' + r.id + '" data-v="' + esc(n) + '" aria-pressed="' + (r.name === n) + '">' + oneGradeHTML(n) + '</button>';
    }).join('');
    if (rest.length) {
      const inRest = r.name && chips.indexOf(r.name) < 0;
      h += '<select class="pick-more' + (inRest ? ' on' : '') + '" data-change="pick" data-row="' + r.id + '" aria-label="' + esc(STRINGS.other + ' ' + pick.label) + '"><option value="">' + esc(STRINGS.other) + '…</option>' +
        rest.map(function (n) { return '<option value="' + esc(n) + '"' + (n === r.name ? ' selected' : '') + '>' + esc(oneGrade(n)) + '</option>'; }).join('') + '</select>';
    }
    return h + '</div>';
  }
  function markToText(r) {
    const t = String(r.mark || '').trim();
    if (!t) return r.grade ? '<span class="muted">' + esc(STRINGS.gradeOrMark(gradeLabel(r.level, r.grade))) + '</span>' : '';
    const m = markValue(t);
    if (m == null) return '';
    return '→ <b>' + esc(gradeLabel(r.level, markGrade(r, m))) + '</b>';
  }
  function bandsHTML() {
    const g3 = MARK_BANDS.G3 && MARK_BANDS.G3[0];
    if (!g3) return '';
    const scales = [];
    (YEAR_LEVELS[S.year] || []).forEach(function (lv) { const sc = LEVEL[lv].scale; if (MARK_BANDS[sc] && scales.indexOf(sc) < 0) scales.push(sc); });
    const tables = scales.map(function (sc) {
      // the grade labels without "fail" names; two bands with the same label (G1 E and U) read as one
      const b = [];
      MARK_BANDS[sc].forEach(function (row) { const lab = gradeLabel(sc, row[1]); if (b.length && b[b.length - 1][1] === lab) b[b.length - 1] = [row[0], lab]; else b.push([row[0], lab]); });
      return '<table class="bands"><caption>' + esc(levelName(sc)) + '</caption><tbody>' + b.map(function (row, i) {
        const range = i === 0 ? row[0] + ' and above' : (i === b.length - 1 ? 'Below ' + b[i - 1][0] : row[0] + ' to below ' + b[i - 1][0]);
        return '<tr><td>' + esc(range) + '</td><td class="num">' + esc(row[1]) + '</td></tr>';
      }).join('') + '</tbody></table>';
    }).join('');
    return '<div class="bands-note"><p class="hint">' + esc(STRINGS.bandsInfo(g3[0], g3[1])) + '</p><div class="bands-tables">' + tables + '</div></div>';
  }
  // the subjects that exist at a level, by name (the catalogue; the engine is the real resolver)
  function levelSubjects(lv) {
    const taken = S.rows.map(function (r) { return norm(r.name); });
    return CATALOGUE.map(function (c) { return c.name; }).filter(function (n) { return taken.indexOf(norm(n)) < 0 && existsAt(n, lv); }).sort();
  }
  function commonFor() {
    const mtl = S.rows.filter(function (r) { return r.core === 'mtl' && r.name; })[0];
    const hm = mtl && catalogueEntry('Higher ' + mtl.name) ? 'Higher ' + mtl.name : 'Higher Chinese';
    const taken = S.rows.map(function (r) { return norm(r.name); });
    const offered = [];
    S.rows.forEach(function (r) {
      alsoOptions(r).forEach(function (n) { offered.push(norm(n)); });
      if (!r.name && !r.skip && PICKS[r.pick]) pickOptions(PICKS[r.pick], r.level || '').filter(function (n) { return PICKS[r.pick].chips.indexOf(n) >= 0; }).forEach(function (n) { offered.push(norm(n)); });
    });
    // a pair's other subject (Computing after Science, Science after Computing) comes first
    const pair = [];
    S.rows.forEach(function (r) { const pk = PICKS[r.pick]; if (r.core && r.name && pk && pk.pair) pk.chips.forEach(function (n) { if (n !== r.name && pair.indexOf(n) < 0) pair.push(n); }); });
    const list = pair.concat((COMMON[coreKey()] || []).map(function (n) { return n === '@HMTL' ? hm : n; }).filter(function (n) { return pair.indexOf(n) < 0; }));
    return list.filter(function (n) { return taken.indexOf(norm(n)) < 0 && offered.indexOf(norm(n)) < 0 && existsAt(n, S.level); });
  }
  function addHTML() {
    let h = '<div class="add"><p class="add-h">' + esc(STRINGS.addHead) + '</p><div class="chips-wrap add-chips" data-wc="0">' +
      commonFor().map(function (n) { return '<button type="button" class="chip chip-name" data-do="add-pick" data-v="' + esc(n) + '">' + esc(shown(n)) + '</button>'; }).join('') +
      '<button type="button" class="chip chip-name chip-more" data-do="add-toggle" aria-expanded="' + addOpen + '">' + esc(STRINGS.addSearch) + '…</button></div>';
    if (addOpen) {
      h += '<div class="add-box"><label class="sr-only" for="subj-q">' + esc(STRINGS.addPlaceholder) + '</label><input id="subj-q" type="search" autocomplete="off" placeholder="' +
        esc(STRINGS.addPlaceholder) + '" value="' + esc(addQuery) + '" data-input="subj-q"><div id="subj-list" class="pick-list">' + addListHTML() + '</div></div>';
    }
    return h + '</div>';
  }
  function addListHTML() {
    const q = norm(addQuery);
    if (q.length < 2) return '<p class="hint">' + esc(STRINGS.typeMore) + '</p>';
    const taken = S.rows.map(function (r) { return norm(r.name); });
    // D19: the exam year's own subjects (the file), plus earlier O-Level subjects for the 2026 O-Level route
    const pool = [];
    CATALOGUE.forEach(function (s) {
      const ok = s.earlier ? (S.year === 2026 && levelsLive().indexOf('O') >= 0) : existsAt(s.name, '');
      if (ok) pool.push({ name: s.name, names: [s.name].concat(s.aliases || []), earlier: !!s.earlier });
    });
    (SUBJECTS_OF[S.year] || []).forEach(function (n) { if (!catalogueEntry(n)) pool.push({ name: n, names: [n], earlier: false }); });
    const scored = [];
    pool.forEach(function (x) {
      if (taken.indexOf(norm(x.name)) >= 0) return;
      let best = 0;
      x.names.forEach(function (n) { const k = norm(n); if (k === q) best = Math.max(best, 3); else if (k.indexOf(q) === 0) best = Math.max(best, 2); else if (k.indexOf(q) > 0) best = Math.max(best, 1); });
      if (best) scored.push([best - (x.earlier ? 0.5 : 0), x]);
    });
    scored.sort(function (a, b) { return b[0] - a[0] || (a[1].name < b[1].name ? -1 : 1); });
    let h = scored.slice(0, 8).map(function (x) {
      return '<button type="button" class="pick-item" data-do="add-pick" data-v="' + esc(x[1].name) + '">' + esc(shown(x[1].name)) +
        (x[1].earlier ? '<span class="muted"> (earlier O-Level subject)</span>' : '') + '</button>';
    }).join('');
    if (!scored.some(function (x) { return norm(x[1].name) === q; })) h += '<button type="button" class="pick-item add-typed" data-do="add-typed">' + esc(STRINGS.addTyped(addQuery.trim())) + '</button>';
    return h;
  }
  function pasteHTML() {
    return '<div class="paste-box"><p class="hint">' + esc(STRINGS.pasteHint) + '</p>' +
      '<label class="sr-only" for="paste-text">Results line</label><textarea id="paste-text" rows="3" placeholder="ENGLISH LANGUAGE = A1, CHINESE = B4, …"></textarea>' +
      '<button type="button" class="btn" data-do="paste-read">' + esc(STRINGS.pasteRead) + '</button>' +
      (pasteReadBack ? '<p class="note paste-back" role="status">' + esc(pasteReadBack) + '</p>' : '') +
      (pasteUnread.length ? '<div class="unread"><p>' + esc(STRINGS.pasteUnread) + '</p><ul>' + pasteUnread.map(function (u) { return '<li><code>' + esc(u) + '</code></li>'; }).join('') + '</ul></div>' : '') + '</div>';
  }
  function schoolHTML() {
    if (!SCHOOLS.length) return '';
    let h = '<div class="fu-q"><p class="q-h fu-h">' + esc(STRINGS.schoolOpt) + '</p><p class="hint fu-hint">' + esc(STRINGS.schoolWhy) + '</p>';
    if (S.school) {
      const aff = affiliatedJCs();
      h += '<p class="pill-chip"><span data-wc="0">' + esc(S.school) + '</span><button type="button" class="btn-x" data-do="school-clear" aria-label="' + esc(STRINGS.schoolClear) + '">×</button></p>';
      if (aff.length) h += '<p class="hint">' + esc(STRINGS.affiliated) + ' <span data-wc="0">' + esc(joinAnd(aff)) + '</span></p>';
    } else {
      h += '<input id="school" type="search" autocomplete="off" aria-label="' + esc(STRINGS.school) + '" placeholder="' + esc(STRINGS.schoolPlaceholder) + '" value="' + esc(schoolQuery) + '" data-input="school">' +
        '<div id="school-list" class="pick-list">' + schoolListHTML() + '</div>';
    }
    return h + '</div>';
  }
  function schoolBase(name) { return norm(String(name).replace(/\s*\([^)]*\)/g, '')); }
  function schoolMatches(q) {
    const n = norm(q);
    if (n.length < 2) return [];
    return SCHOOLS.map(function (x) { return x[0]; }).filter(function (name) { return norm(name).indexOf(n) >= 0 || schoolBase(name).indexOf(n) >= 0; }).slice(0, 6);
  }
  function schoolExact(q) {
    const n = norm(q);
    return SCHOOLS.map(function (x) { return x[0]; }).filter(function (name) { return norm(name) === n || schoolBase(name) === n; })[0] || '';
  }
  function schoolListHTML() {
    const q = schoolQuery.trim();
    if (norm(q).length < 2) return '';
    const m = schoolMatches(q);
    if (!m.length) return '<p class="hint" role="status">' + esc(STRINGS.schoolNone(q)) + '</p>';
    return m.map(function (name) { return '<button type="button" class="pick-item" data-do="school-pick" data-v="' + esc(name) + '" data-wc="0">' + esc(name) + '</button>'; }).join('');
  }
  // the fields of the Where values picked, one full MOE name per line (D2.7); the same state as the Screen 2 filter
  function fieldList() {
    let list = [];
    const picked = scope();
    if (picked.indexOf('poly') >= 0) list = list.concat(POLY_FIELDS);
    if (picked.indexOf('ite') >= 0) list = list.concat(ITE_FIELDS);
    return list.filter(function (f, i) { return list.indexOf(f) === i; }).sort();
  }
  function fieldChecklistHTML() {
    return '<ul class="checklist">' + fieldList().map(function (f) {
      const id = 'fld-' + hash36(f);
      return '<li><input type="checkbox" id="' + id + '" data-change="field" data-v="' + esc(f) + '"' + (S.fields.indexOf(f) >= 0 ? ' checked' : '') + '><label for="' + id + '" data-wc="0">' + esc(f) + '</label></li>';
    }).join('') + '</ul>';
  }
  function fieldsHTML() {
    const n = S.fields.length;
    if (fieldsOpen) return '<div class="fu-q"><p class="q-h fu-h">' + esc(STRINGS.fieldsHead) + '</p>' + fieldChecklistHTML() +
      '<button type="button" class="btn-link" data-do="fields-toggle" aria-expanded="true">' + esc(STRINGS.done) + '</button></div>';
    return '<div class="fu-q"><button type="button" class="fold-btn" data-do="fields-toggle" aria-expanded="false">' + esc(n ? STRINGS.fieldsPicked(n) : STRINGS.fieldsHead) + '</button></div>';
  }
  // shown, not folded, with "optional" beside the heading
  function interestsHTML() {
    return '<section class="q q-int" aria-labelledby="h-int"><h2 class="q-h" id="h-int">' + esc(STRINGS.interests) + ' <span class="opt-l">' + esc(STRINGS.optional) + '</span></h2>' +
      '<div class="riasec" role="group" aria-label="Your RIASEC code, in order">' + RIASEC.map(function (l) {
        const i = S.riasec.indexOf(l);
        const full = S.riasec.length >= 3 && i < 0;
        return '<button type="button" class="chip chip-letter" data-do="riasec" data-v="' + l + '" aria-pressed="' + (i >= 0) + '"' + (full ? ' aria-disabled="true"' : '') +
          ' aria-label="' + esc(STRINGS.riasecNames[l]) + (i >= 0 ? ', ' + (i + 1) : '') + '" title="' + esc(STRINGS.riasecNames[l]) + '">' + l + (i >= 0 ? '<sup>' + (i + 1) + '</sup>' : '') + '</button>';
      }).join('') + '</div>' +
      (S.riasec.length ? '<p class="code-line">' + esc(STRINGS.yourCode(S.riasec)) + '</p>' : '') +
      '<p>' + ext(STRINGS.quizUrl, STRINGS.quiz) + '</p></section>';
  }
  // the bottom bar shows nothing before "Calculate my aggregates" (the step's own button is the action), nor while
  // the subjects card is open for an edit; after it, "Show my courses", an outline when the near-miss card shows
  function renderBar() {
    const bar = $('#bar');
    if (!bar) return;
    const on = ROUTE.name === 'input' && !!S.year && !!S.level && calcOn() && !CARD_OPEN;
    bar.hidden = !on;
    document.body.classList.toggle('has-bar', on);
    if (!on) { bar.innerHTML = ''; return; }
    bar.innerHTML = '<button type="button" class="' + (solidAction() === 'show' ? 'btn-primary' : 'btn btn-wide') + '" data-do="show">' + esc(STRINGS.show) + '</button>';
  }
  // the engine's reading of a row, in plain words, at the row (the problem list)
  function problemHTML(p, row) {
    const name = p.subject || p.value || rowLabel(row);
    const what = String(p.problem || ''), act = String(p.action || '');
    let text, suggest = [];
    if (p.field === 'subject' && what === 'unknown') { text = STRINGS.unknownSubject(name); suggest = didYouMean(name); }
    else if (p.field === 'subject' && /not in the catalogue/.test(what)) {
      if (NOT_YET_IN_CATALOGUE.some(function (n) { return norm(n) === norm(name); })) text = 'We do not have “' + name + '” in our list of subjects yet, so it counts only where any subject can be used.';
      else { text = '“' + name + '” is not a subject name we know, so it counts only where any subject can be used.'; suggest = didYouMean(name); }
    } else if (p.field === 'subject' && /ambiguous/.test(what)) {
      text = '“' + name + '” could be more than one subject. Pick the one you took.';
      suggest = /^science$/i.test(String(name).trim()) ? SCIENCES.slice() : didYouMean(name);
    } else if (p.field === 'grade') {
      text = '“' + (p.value || '') + '” is not a grade we can read for ' + name + ', so this subject was left out.';
    } else if (p.field === 'level' && /is examined at (.+) only/.test(what)) {
      text = STRINGS.examinedOnly(shown(name), /is examined at (.+) only/.exec(what)[1]);
    } else if (p.field === 'level' && /ignored/.test(act)) {
      text = 'The level for ' + name + ' could not be read, so this subject was left out.';
    } else if (p.field === 'level') {
      text = 'Check the level for ' + name + '. It may not be offered at the level picked.';
    } else if (/ignored/.test(act)) {
      text = name + ' could not be read, so it was left out.';
    } else {
      unmapped('problem:' + what);
      text = name + ' could not be read in full. Check it.';
    }
    let h = esc(text);
    const taken = S.rows.filter(function (r) { return r.id !== row.id && r.name; }).map(function (r) { return norm(r.name); });
    suggest = suggest.filter(function (n) { return taken.indexOf(norm(n)) < 0; });
    if (suggest.length) {
      h += '<div class="dym"><span class="muted">Did you mean:</span> ' + suggest.slice(0, 6).map(function (s) {
        return '<button type="button" class="chip chip-name" data-do="dym" data-row="' + row.id + '" data-v="' + esc(s) + '" data-wc="0">' + esc(s) + '</button>';
      }).join('') + '</div>';
    }
    return h;
  }
  function editDistance(a, b) {
    let prev = []; for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  function didYouMean(name) {
    const q = norm(name);
    const words = String(name).toLowerCase().split(/[^a-z]+/).filter(function (w) { return w.length >= 3; });
    const scored = [];
    CATALOGUE.forEach(function (s) {
      let best = 0;
      [s.name].concat(s.aliases || []).forEach(function (n) {
        const k = norm(n);
        if (k === q) best = Math.max(best, 100);
        else if (q.length >= 3 && (k.indexOf(q) >= 0 || q.indexOf(k) >= 0) && k.length >= 3) best = Math.max(best, 60);
        if (q.length >= 5 && k.length >= 5) { const d = editDistance(q, k); if (d <= Math.max(2, Math.round(Math.max(q.length, k.length) * 0.2))) best = Math.max(best, 90 - d * 5); }
        const nw = String(n).toLowerCase();
        let hits = 0;
        words.forEach(function (w) { if (nw.indexOf(w) >= 0) hits += 1; });
        best = Math.max(best, hits * 20);
      });
      if (best >= 40 && !s.earlier) scored.push([best, s.name]);
    });
    scored.sort(function (a, b) { return b[0] - a[0] || (a[1] < b[1] ? -1 : 1); });
    return scored.map(function (x) { return x[1]; }).filter(function (n, i, a) { return a.indexOf(n) === i; }).slice(0, 6);
  }

  /* MOE's overview (2027 exams), with "You" worked out from the levels alone (D13) */
  function overviewPlace() {
    const seen = {};
    let loose = 0;
    S.rows.forEach(function (r) {
      if (r.skip || !r.level || isMtlB(r)) return;
      if (!r.name) { if (r.core) { loose += 1; seen['core:' + r.core] = r.level; } return; }
      const c = catalogueEntry(r.name);
      seen[c ? c.id : 'typed:' + norm(r.name)] = r.level;
    });
    const lv = Object.keys(seen).map(function (k) { return seen[k]; });
    const n3 = lv.filter(function (l) { return l === 'G3'; }).length;
    const n2 = lv.filter(function (l) { return l === 'G2'; }).length;
    const n1 = lv.filter(function (l) { return l === 'G1'; }).length;
    let group = null;
    if (n3 >= 5) group = '5G3';
    else if (n3 >= 4 && n3 + n2 >= 5) group = '4G3+1G2';
    else if (n3 + n2 >= 5) group = '5G2';
    else if (n3 + n2 + n1 >= 4) group = '4G1';
    return { group: group, n3: n3, n2: n2, n1: n1, total: lv.length };
  }
  // no MOE table. Each route says how to get in: one line of its pathways with a mark each, and
  // the reason under any that is not open. ONE renderer for Results (under the subjects) and the Courses headers.
  const PATH_SHORT = { 'Polytechnic Year 1': 'Year 1', 'Polytechnic Foundation Programme (PFP)': 'PFP', '3-Year Higher Nitec': '3-year Higher Nitec',
    '2-Year Higher Nitec': '2-year Higher Nitec', 'NAFA Foundation Programme (NFP)': 'NAFA Foundation Programme', 'Arts Institutions': 'Diplomas', 'Millennia Institute': 'Millennia Institute',
    'Junior College': 'Junior College' };
  // the 2026 view has route lines too, from the cards: a section is ✓ when a course in it is open
  const SEC_SHORT = { poly: 'Year 1', pfp: 'PFP', dppvia: 'DPP', ite2: '2-year Higher Nitec', dpp: 'DPP', jien: '3-year Higher Nitec', ai: 'Diplomas', nfp: 'NAFA Foundation Programme' };
  function pathParts(wid) {
    if (S.year !== 2027) {
      return groupSections(wid).map(function (sc) {
        const cards = cardsIn(wid, sc.id);
        const st = !hasMarks() || !cards.length ? { state: 'notyet', text: '' } : cards.some(canApply) ? { state: 'yes', text: '' }
          : cards.some(function (c) { return c.state === 'unsure'; }) ? { state: 'unsure', text: '' } : { state: 'no', text: emptyNote(sc, cards) };
        return { path: SEC_SHORT[sc.id] || WHERE[wid].label, sec: sc.id, st: st };
      });
    }
    const p = overviewPlace();
    return MOE_OVERVIEW.pathways.map(function (path, i) { return { path: path, i: i }; }).filter(function (x) { return OV_PATH[x.path].where === wid; })
      .map(function (x) { const st = pathStatus(x.path, x.i, p) || { state: 'notyet', text: '' }; return { path: x.path, sec: OV_PATH[x.path].sec, st: st }; }).reverse();
  }
  /* ================================================================================================ where the student can go */
  function picksMade() { const live = liveWheres(); return S.where.some(function (w) { return live.indexOf(w) >= 0; }); }
  // the results are in: every subject done (2027: every mark or grade), and the engine has run on them
  function resultsIn() {
    if (!S.year || !S.level || DIRTY || !R || R.error || !CARDS || !hasMarks()) return false;
    return !missingRows().length && !unmarkedRows().length;
  }
  // the reason in one sentence, without the number the screen shows beside it ("Yours is 22.")
  function bareReason(t) {
    return String(t || '').replace(/^Closed: /, '').replace(/ Yours: .*$/, '').replace(/ (?:Yours is|Your (?:gross|net) \S+ is) \d+(?: for (?:all four|each))?\.?$/, '')
      .replace(/, counted before bonus points\.?$/, '.').replace(/([^.])$/, '$1.');
  }
  // one pathway (a section): shut (nothing in it can be applied for, whatever the filters) with its reason, or how many
  // of its courses are within reach
  function secStatus(wid, sc) {
    // a pathway is open when any of its courses can be applied for (the engine's result per course); only when none can is
    // it shut, and then MOE's pathway rule (2027) or the general limit says why
    const cards = cardsIn(wid, sc.id);
    if (!cards.length) return { none: true };
    if (!cards.some(canApply)) {
      const part = S.year === 2027 ? pathParts(wid).filter(function (x) { return x.sec === sc.id; })[0] : null;
      return { shut: true, reason: (part && part.st.state === 'no' && bareReason(part.st.text)) || bareReason(emptyNote(sc, cards)) };
    }
    // the count within reach is the group heads' count (the cards the list shows, by the same split)
    return { reach: cards.filter(function (c) { return matchesFilters(c) && inReach(c, sc); }).length, can: cards.filter(canApply).length };
  }
  // within reach as the group heads count it: can be applied for and, where a section has cut-offs, a gap of the allowance or
  // better, whatever the list's Within reach switch
  function inReach(c, sc) { return canApply(c) && (!groupsApply(sc) || marginGroup(c.best.gap.n) !== 'out'); }
  function pathSecs(wid) { return sectionsOf(wid).filter(function (sc) { return !sc.viaIte; }); }
  // a route is shut when every pathway in it with courses is shut: { reason } (the first pathway's), else null
  function routeShut(wid) {
    if (!resultsIn()) return null;
    // every pathway, DPP via ITE included: Polytechnic is open to an N(A) student through DPP even when PFP isn't
    const st = sectionsOf(wid).map(function (sc) { return secStatus(wid, sc); }).filter(function (x) { return !x.none; });
    return st.length && st.every(function (x) { return x.shut; }) ? { reason: st[0].reason } : null;
  }
  // a closed pathway shows only if better grades could open it. "if the student were to get all As (or
  // grade 1 or A1), then the student can enter. then you should show. but if the student can't enter even if the student get
  // all As. then no point showing" (a G1 student has no L1R4 or ELMAB3 at all). The engine re-runs once on a copy of the
  // results with every subject at its level's top grade (the rules are never re-implemented); a pathway still shut then gets
  // no tile, no route chip and no "not open" line. On any error everything counts as reachable, as before
  let BEST = null;
  function reachable(wid, sc) {
    if (!resultsIn()) return true;
    if (!BEST || BEST.R !== R) BEST = { R: R, open: bestCaseOpen() };
    return !BEST.open || !!BEST.open[wid + '|' + sc.id];
  }
  function routeReachable(wid) { return pathSecs(wid).some(function (sc) { return reachable(wid, sc); }); }
  function bestCaseOpen() {
    const keep = { rows: S.rows, R: R, CARDS: CARDS, DIRTY: DIRTY, DR: DR, AO: AO }, open = {};
    try {
      S.rows = keep.rows.map(function (r) {
        const order = gradesFor(r);
        return r.skip || !r.name || isMtlB(r) || !order || !order.length ? r : Object.assign({}, r, { grade: order[0], mark: '' });
      });
      recompute(); DR = null; AO = null;
      liveWheres().forEach(function (wid) { sectionsOf(wid).forEach(function (sc) { const st = secStatus(wid, sc); if (!st.none && !st.shut) open[wid + '|' + sc.id] = true; }); });
      return open;
    } catch (e) { return null; } finally { S.rows = keep.rows; R = keep.R; CARDS = keep.CARDS; DIRTY = keep.DIRTY; DR = keep.DR; AO = keep.AO; }
  }
  // F: tiers, most competitive first (Arts is a path of its own, shown only when picked)
  const TIER = { jc: 1, mi: 1, pjc: 1, pmi: 1, poly: 2, pfp: 2, dppvia: 2, ppoly: 2, ppfp: 2, ite2: 3, dpp: 3, pite2: 3, jien: 4, pite3: 4 };
  const PW_NAME = { jc: 'JC', mi: 'MI', poly: 'Polytechnic Year 1', pfp: 'PFP', dppvia: 'DPP', ite2: 'ITE 2-year', dpp: 'DPP', jien: 'ITE 3-year',
    ai: 'Arts diplomas', nfp: 'NAFA Foundation Programme', pjc: 'JC', pmi: 'MI', ppoly: 'Polytechnic Year 1', ppfp: 'PFP', pite2: 'ITE 2-year', pite3: 'ITE 3-year',
    pai: 'Arts diplomas', pnfp: 'NAFA Foundation Programme' };
  // F: what shows when the student hasn't picked a route: the top open tier (open = a course within reach), Polytechnic as
  // well when that tier is JC/MI, nothing below, Arts only when picked. { routes, secs, hidden } or null (results not in)
  let DR = null;
  function defaultRoutes() {
    if (!resultsIn()) return null;
    const k = [S.year, S.level].join('|');
    if (DR && DR.R === R && DR.k === k) return DR.v;
    DR = { R: R, k: k, v: defaultRoutesNow() };
    return DR.v;
  }
  function defaultRoutesNow() {
    const live = liveWheres(), open = {};
    // a tier is open when a course in it can be applied for within reach (a course with no range counts); failing that, any
    // course that can be applied for
    const near = function (c) { return canApply(c) && (c.best.gap.n == null || c.best.gap.n >= -1); }, any = {};  // not Out of reach
    live.forEach(function (wid) { sectionsOf(wid).forEach(function (sc) { if (!TIER[sc.id]) return; const cs = cardsIn(wid, sc.id); if (cs.some(near)) open[TIER[sc.id]] = true; if (cs.some(canApply)) any[TIER[sc.id]] = true; }); });
    const top = [1, 2, 3, 4].filter(function (t) { return open[t]; })[0] || [1, 2, 3, 4].filter(function (t) { return any[t]; })[0];
    if (!top) return null;
    const tiers = top === 1 ? [1, 2] : [top], secs = {}, routes = [];
    live.forEach(function (wid) { sectionsOf(wid).forEach(function (sc) {
      if (tiers.indexOf(TIER[sc.id]) < 0) return;
      secs[sc.id] = true; if (routes.indexOf(wid) < 0) routes.push(wid);
    }); });
    // the open routes (or a route's open pathways) this leaves out, for the one "Also open to you" line
    const hidden = [];
    live.forEach(function (wid) {
      const left = pathSecs(wid).filter(function (sc) { return !secs[sc.id] && !(sc.id === 'dpp' && secs.dppvia) && cardsIn(wid, sc.id).some(canApply); });
      if (!left.length) return;
      hidden.push({ wid: wid, name: routes.indexOf(wid) < 0 ? STRINGS.routeShort[wid] : left.map(function (sc) { return PW_NAME[sc.id]; }).join(', ') });
    });
    return { routes: routes, secs: secs, hidden: hidden };
  }
  // B: a picked route that has since closed is unpicked (its chip then shows greyed)
  function unpickShut() {
    if (!resultsIn() || !S.where.length) return;
    const keep = S.where.filter(function (w) { return !routeShut(w); });
    if (keep.length !== S.where.length) { S.where = keep; save(); }
  }
  // the tiles follow the results, nothing else. The routes of the student's top open tier
  // (Polytechnic too when that tier is JC/MI) and every shut route above it, the same on every device whatever route chips
  // are picked; Arts is the one exception, its tiles only while it is picked
  function cardRoutes() {
    const live = liveWheres(), d = defaultRoutes(), arts = artsPicked();
    if (!d) return live.filter(function (w) { return w !== 'arts' || arts; });
    const tierOf = function (w) { return Math.min.apply(null, pathSecs(w).map(function (sc) { return TIER[sc.id] || 9; })); };
    const top = topTier();
    return live.filter(function (w) { return w === 'arts' ? arts : d.routes.indexOf(w) >= 0 || (!!routeShut(w) && tierOf(w) <= top && routeReachable(w)); });
  }
  // the pathways a tile row stands for: a default route's pathways in the default tiers; every pathway of any other route
  function rowSecs(wid) {
    const d = defaultRoutes();
    if (!d || d.routes.indexOf(wid) < 0) return pathSecs(wid);
    const mine = sectionsOf(wid).filter(function (sc) { return (!sc.viaIte || d.routes.indexOf('ite') < 0) && !!d.secs[sc.id]; });
    // and its closed pathways more competitive than those, when better grades could open them ("2-year and 3-year ITE")
    const t0 = Math.min.apply(null, mine.map(function (sc) { return TIER[sc.id] || 9; }).concat([9]));
    // (every pathway the row had before stays, DPP via ITE included: walk sectionsOf, not pathSecs)
    return sectionsOf(wid).filter(function (sc) { return mine.indexOf(sc) >= 0 || (!sc.viaIte && (TIER[sc.id] || 9) < t0 && secStatus(wid, sc).shut && reachable(wid, sc)); });
  }
  // a closed tile with no number says why in a few words: MOE's open-to group (2027), else the engine's reason the
  // aggregate can't be worked out ("Needs G3 subjects"); '' when there is no short form
  function tileWhy(wid, sc) {
    if (S.year === 2027) {
      const part = pathParts(wid).filter(function (x) { return x.sec === sc.id; })[0];
      if (part && part.st.g && STRINGS.tileWhy[part.st.g]) return STRINGS.tileWhy[part.st.g];
      if (part && part.st.mtl) return STRINGS.tileWhy.mtl;
    }
    const id = sc.kind === 'arts' ? sc.agg : (REMIND[sc.id] || [])[0];
    const res = id && R && R.byId ? R.byId[id] : null;
    if (!res) return '';
    const m = missingInfo(res);
    if (m.kind === 'fewer' && m.low && m.low.length) return m.low.length === 1 ? STRINGS.tileGrade(gradeLabel(m.low[0].level, m.low[0].best)) : STRINGS.tileGrades;
    if ((m.kind === 'level' || m.kind === 'fewer') && m.ok && m.ok.length && m.ok.length < 3) return STRINGS.tileLevels(m.ok.map(levelName));
    if (m.kind === 'fewer' && m.n) return STRINGS.tileMore(m.n);
    return '';
  }
  // A: one key aggregate as the card shows it: { name, num, work } (the net, gross − bonus small), or the need when it
  // can't be worked out. The poly variants are one number or "12–15"; other variants merge as in K5
  function aggFigure(wid, sc) {
    if (!R || !R.byId) return null;
    const ids = sc.kind === 'arts' ? [sc.agg] : (REMIND[sc.id] || []);
    const res = ids.map(function (id) { return R.byId[id]; }).filter(function (x) { return x && x.gross != null; });
    if (!res.length) return null;
    const gross = sc.kind === 'pfp';
    const val = function (x) { return gross || x.net == null ? x.gross : x.net; };
    const fam = res.length > 1 && res.every(function (x) { return /^ELR2B2-/.test(shortName(x.id)); });
    if (res.length === 1 || fam) {
      const vs = res.map(val), lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs), x = res[0];
      const work = !gross && x.net != null && x.gross !== x.net && res.every(function (y) { return y.gross === x.gross && y.net === x.net; }) ? 'gross ' + x.gross + bonusParts(x) : '';
      return { parts: [{ name: (gross ? 'gross ' : '') + (fam ? 'ELR2B2' : shortName(x.id)), num: lo === hi ? String(lo) : lo + '–' + hi }], work: work };
    }
    const grp = [];
    res.forEach(function (x) { const v = val(x), g = grp.filter(function (y) { return y.num === String(v); })[0]; if (g) g.names.push(shortName(x.id)); else grp.push({ num: String(v), names: [shortName(x.id)] }); });
    return { parts: grp.map(function (g) { return { name: g.names.join(', '), num: g.num }; }), work: '' };
  }
  // the limit a pathway's aggregate must meet, from the engine's gate check (the general limit)
  function needOf(wid, sc) {
    const cs = cardsIn(wid, sc.id);
    for (let i = 0; i < cs.length; i++) {
      const r = cs[i].best && cs[i].best.r;
      if (!r) continue;
      const gate = (r.reasons || []).filter(function (x) { return x.kind === 'gate' && GATE_WHO[x.id.split('|')[0]] && x.id.split('|')[0] !== 'nursing_net'; })[0];
      const ck = gate && checkOf(r.aggregate_id, gate.id.split('|')[0]);
      const res = R && R.byId[r.aggregate_id];
      if (ck && ck.max != null && res) return { max: ck.max, value: ck.type === 'net_max' ? res.net : res.gross, gross: ck.type !== 'net_max', net: res.net };
    }
    return null;
  }
  // the key aggregates as tiles, one per figure (two pathways with one number share a tile): { label, num, title, off, why, keys }
  function aggTiles() {
    const rows = [], bySig = {};
    cardRoutes().forEach(function (wid) {
      const shut = routeShut(wid);
      rowSecs(wid).forEach(function (sc) {
        const st = secStatus(wid, sc);
        if (st.none) return;
        if ((st.shut || shut) && !reachable(wid, sc)) return;
        const f = aggFigure(wid, sc), key = SHUT_KEY[sc.id] || sc.id, off = !!(st.shut || shut);
        const parts = f ? f.parts.slice().sort(function (a, b) { return parseFloat(a.num) - parseFloat(b.num); }) : [{ name: aggOfSec(sc.id), num: '—' }];
        const title = f ? f.parts.map(function (p) { return p.name + ' ' + p.num; }).join(' · ') + (f.work ? ' (' + f.work + ')' : '') : aggOfSec(sc.id);
        const why = st.shut ? st.reason : shut ? shut.reason : '', need = off ? needOf(wid, sc) : null;
        // a closed tile with no number shows its short reason; tiles with the same reason merge ("JC, MI, Poly")
        const short = !f && off ? tileWhy(wid, sc) : '';
        const sig = short ? 'why|' + short : title + '|' + off;
        const label = PW_ROW[sc.id] || STRINGS.routeShort[wid];
        if (bySig[sig]) { const r0 = bySig[sig]; r0.labels.push(label); r0.keys.push(key); r0.pw.push({ wid: wid, sc: sc }); if (why && r0.why.indexOf(why) < 0) r0.why.push(why); return; }
        // a closed tile shows the number its rule judges. JC's rule is on the gross L1R5, so a gross 21 with one CCA
        // point reads "21 ✗ needs 20", not the net "20 ✗ needs 20"
        const failed = off && need && need.value > need.max;
        rows.push(bySig[sig] = { labels: [label], agg: parts[0].name.replace(/^gross /, '').split(',')[0], num: failed ? String(need.value) : parts[0].num, title: title, off: off, keys: [key], why: why ? [why] : [],
          need: failed ? need.max : null, judged: failed && need.gross && need.net !== need.value ? need : null, short: short, pw: [{ wid: wid, sc: sc }] });
      });
    });
    // an open tile with no course open for sure, only "check with the school" ones, says so (the engine's call stands)
    rows.forEach(function (r) { if (!r.off) r.check = checkOnly(r.pw); });
    return rows;
  }
  // who to check with when none of these pathways' courses is open for sure and some are "check": NAFA, LASALLE, or the school
  function checkOnly(pw) {
    const cs = [];
    pw.forEach(function (x) { cardsIn(x.wid, x.sc.id).forEach(function (c) { cs.push(c); }); });
    if (!cs.length || cs.some(function (c) { return c.state === 'yes' || c.state === 'cond' || c.state === 'browse'; })) return '';
    const who = [];
    cs.filter(function (c) { return c.state === 'unsure'; }).forEach(function (c) {
      const a = c.kind === 'arts' && c.offers[0] && c.offers[0].arts, w = a && a.who ? a.who : 'the ' + WHERE[c.where].unsure;
      if (who.indexOf(w) < 0) who.push(w);
    });
    return who.length === 1 ? who[0] : who.length ? 'the ' + WHERE.arts.unsure : '';
  }
  // ONE renderer for the summary, in two places with the same words: 'results' (under the subjects: the tiles, the
  // near miss, the route lines) and 'courses' (the top of Courses: the tiles in one compact row, then the near miss)
  function summaryHTML(variant) {
    // 2027: subjects too few for any of MOE's groups is said at once, from the levels (no marks needed for it)
    if (!resultsIn()) {
      const p = variant === 'results' && S.year === 2027 && !DIRTY && R ? overviewPlace() : null;
      return p && p.total && !p.group ? '<section class="card aggs" id="aggs"><h2 class="q-h">' + esc(STRINGS.aggsHead) + '</h2><p class="rt-note">' + esc(STRINGS.placeNeed(p)) + '</p></section>' : '';
    }
    const tiles = aggTiles().concat(fifthTile());
    // level 1: one tile per key aggregate; open is green-tinted, closed grey. a tap opens its details in the
    // pop-over the indicative tag uses, anchored to the tile, over the page (nothing under it moves)
    const tileHTML = function (r) {
      const k = r.keys[0], id = 'tp-' + variant + '-' + k;
      const word = r.check ? esc(STRINGS.mark.unsure + ' ' + STRINGS.checkWith(r.check)) : !r.off ? esc(STRINGS.tileOpen) : r.need != null ? esc(STRINGS.tileNeeds('')) + '<span data-wc="0">' + r.need + '</span>' : esc(STRINGS.tileNo);
      const body = r.short ? '<span class="t-k">' + esc(r.labels.join(', ')) + '</span><b class="t-r">' + esc(r.short) + '</b><span class="t-w">' + word + '</span>'
        : '<span class="t-k">' + esc(r.labels.join(', ')) + '<span data-wc="0"> · ' + esc(r.agg) + '</span></span><b class="agg-n" data-wc="0">' + esc(r.num) + '</b><span class="t-w">' + word + '</span>';
      return '<span class="tile-w"><button type="button" class="tile' + (r.off ? ' off' : r.check ? ' chk' : '') + '" data-do="tile" data-v="' + k + '"' + (r.off ? ' data-shut="' + r.keys.join(' ') + '"' : '') +
        ' aria-expanded="false" aria-controls="' + id + '">' + body + '</button><span class="ind-tip tile-tip" id="' + id + '" role="dialog" tabindex="-1" aria-label="' + esc(r.labels.join(', ')) + '" data-wc="0">' +
        '<button type="button" class="btn-x tip-x" data-do="tile-close" aria-label="' + esc(STRINGS.close) + '">×</button>' + tileLines(r).map(function (l) { return '<span class="tip-l">' + l + '</span>'; }).join('') + '</span></span>';
    };
    // the tiles carry no heading, as in the mockup: the section is named for screen readers only
    let h = '<section class="card aggs' + (variant === 'courses' ? ' compact' : '') + '" id="' + (variant === 'courses' ? 'aggs-c' : 'aggs') + '" aria-label="' + esc(STRINGS.aggsHead) + '">';
    if (S.year === 2027 && !overviewPlace().group) h += '<p class="rt-note">' + esc(STRINGS.placeNeed(overviewPlace())) + '</p>';
    h += '<div class="tiles">' + tiles.map(tileHTML).join('') + '</div>';
    h += '</section>' + (variant === 'courses' ? routeChipsHTML() : '') + nearMissHTML();  // the routes right under the tiles
    if (variant !== 'results') return h;
    // no course links on Results ("Your pathways" lines, "Also open to you"): "Show my courses" in the bar is
    // the one way to Courses
    return h;
  }
  // "What if?": one realistic change (one subject, one grade step better; never a level change) that opens a pathway
  // that is closed now. The engine in the page re-runs on a copy of the results for each candidate; the rules are never
  // re-implemented. At most one card: the most competitive pathway it opens; ties go to the change that gains the most
  let NM = null;
  function nearMiss() {
    if (!resultsIn()) return null;
    const k = artsPicked();
    if (NM && NM.R === R && NM.k === k) return NM.v;
    let v = null;
    try { v = findNearMiss(); } catch (e) { v = null; }
    NM = { R: R, k: k, v: v };
    return v;
  }
  // the near miss only opens something new. A candidate is a closed pathway in a more competitive tier than the
  // student's top open tier, never one beside
  // it (PFP when Polytechnic Year 1 is open) or below it. The order is F's by how competitive a pathway is: JC above MI, so
  // a student with MI open still hears that JC is one point away (the brief keeps the phone A card), and DPP with the
  // ITE 2-year courses it is, so an N(A) student with DPP open still hears that PFP is one step away (the PFP card).
  // Arts, a path of its own, only while it is picked, and only a pathway above any open Arts pathway
  function artsPicked() { return S.where.indexOf('arts') >= 0; }
  const NM_TIER = { jc: 1, pjc: 1, mi: 2, pmi: 2, poly: 3, ppoly: 3, pfp: 3, ppfp: 3, dppvia: 4, ite2: 4, pite2: 4, dpp: 4, jien: 5, pite3: 5 };
  const ARTS_RANK = { ai: 1, pai: 1, nfp: 2, pnfp: 2 };
  function topTier() { const d = defaultRoutes(); return d ? Math.min.apply(null, Object.keys(d.secs).map(function (k) { return TIER[k] || 9; })) : 0; }
  function nmTop() {
    const near = function (c) { return canApply(c) && (c.best.gap.n == null || c.best.gap.n >= -1); };
    let best = 0, any = 0;
    liveWheres().forEach(function (wid) { sectionsOf(wid).forEach(function (sc) {
      const t = NM_TIER[sc.id], cs = t ? cardsIn(wid, sc.id) : [];
      if (cs.some(near) && (!best || t < best)) best = t;
      if (cs.some(canApply) && (!any || t < any)) any = t;
    }); });
    return best || any;
  }
  function nmCandidate(wid, sc, top) {
    if (wid === 'arts') {
      return artsPicked() && !pathSecs('arts').some(function (o) { const st = secStatus('arts', o); return !st.shut && !st.none && (ARTS_RANK[o.id] || 9) <= (ARTS_RANK[sc.id] || 9); });
    }
    return !top || (NM_TIER[sc.id] || 9) < top;
  }
  function stepUp(row) {
    const order = gradesFor(row), g = rowGrade(row), k = order.indexOf(g);
    if (row.skip || !row.name || isMtlB(row) || k <= 0) return null;
    const to = order[k - 1], m = markValue(row.mark);
    if (m == null) return { grade: to, from: g };
    const bands = MARK_BANDS[(LEVEL[row.level] || {}).scale] || [], band = bands.filter(function (b) { return b[1] === to; })[0];
    return band ? { mark: String(band[0]), grade: to, from: g } : null;
  }
  function findNearMiss() {
    const targets = [], top = nmTop();
    liveWheres().forEach(function (wid) { pathSecs(wid).forEach(function (sc) { if (secStatus(wid, sc).shut && nmCandidate(wid, sc, top)) targets.push({ wid: wid, sc: sc, t: TIER[sc.id] || 5, need: needOf(wid, sc) }); }); });
    if (!targets.length) return null;
    targets.sort(function (a, b) { return a.t - b.t; });
    const keep = { rows: S.rows, R: R, CARDS: CARDS, DIRTY: DIRTY, DR: DR, AO: AO };
    const tries = [];
    try {
      S.rows.forEach(function (row, i) {
        const st = stepUp(row);
        if (!st) return;
        S.rows = keep.rows.map(function (r, j) { return j === i ? Object.assign({}, r, st.mark != null ? { mark: st.mark } : { grade: st.grade, mark: '' }) : r; });
        recompute(); DR = null; AO = null;
        const opened = targets.filter(function (x) { const s2 = secStatus(x.wid, x.sc); return !s2.shut && !s2.none && s2.can > 0; });
        if (opened.length) tries.push({ i: i, step: st, opened: opened, value: opened.map(function (x) { const n = needOf(x.wid, x.sc); return n ? n.value : 0; }),
          within: opened.map(function (x) { const n = needOf(x.wid, x.sc); return !!n && n.value <= n.max; }) });
        S.rows = keep.rows;
      });
    } finally { S.rows = keep.rows; R = keep.R; CARDS = keep.CARDS; DIRTY = keep.DIRTY; DR = keep.DR; AO = keep.AO; }
    for (let t = 0; t < targets.length; t++) {
      const x = targets[t];
      const hits = tries.filter(function (y) { return y.opened.indexOf(x) >= 0; });
      if (!hits.length) continue;
      hits.sort(function (a, b) { return a.value[a.opened.indexOf(x)] - b.value[b.opened.indexOf(x)] || a.i - b.i; });
      const best = hits[0], row = S.rows[best.i], name = shown(row.name), to = gradeLabel(row.level, best.step.grade), from = gradeLabel(row.level, best.step.from);
      const route = NM_NAME[x.sc.id] || PW_NAME[x.sc.id];
      const k = x.need && x.need.value > x.need.max && best.within[best.opened.indexOf(x)] ? x.need.value - x.need.max : 0;
      return { i: best.i, step: best.step, key: SHUT_KEY[x.sc.id] || x.sc.id, wid: x.wid, name: name, to: to,
        lines: k ? [STRINGS.nmAgg(k, route), STRINGS.nmExample(name, to, from)] : [STRINGS.nmReq(name, to, from, route)] };
    }
    return null;
  }
  const NM_NAME = { jc: 'JC', pjc: 'JC', mi: 'MI', pmi: 'MI', poly: 'Polytechnic', ppoly: 'Polytechnic', pfp: 'PFP', ppfp: 'PFP', ite2: 'ITE', pite2: 'ITE',
    dpp: 'DPP', jien: 'ITE', pite3: 'ITE', ai: 'Arts diplomas', pai: 'Arts diplomas', nfp: 'NAFA Foundation Programme', pnfp: 'NAFA Foundation Programme' };
  // level 2: the near-miss card, with the one solid button on the screen
  function nearMissHTML() {
    const nm = nearMiss();
    if (!nm) return '';
    return '<section class="nm" data-opens="' + nm.key + '"><p class="nm-t">' + esc(nm.lines[0]) + '</p>' + (nm.lines[1] ? '<p class="nm-s">' + esc(nm.lines[1]) + '</p>' : '') +
      '<button type="button" class="btn-cta' + (solidAction() === 'what-if' ? '' : ' alt') + '" data-do="what-if">' + esc(STRINGS.nmBtn) + '</button></section>';
  }
  const SHUT_KEY = { jc: 'jc', pjc: 'jc', mi: 'mi', pmi: 'mi', poly: 'poly', ppoly: 'poly', pfp: 'pfp', ppfp: 'pfp', ite2: 'ite', pite2: 'ite', dpp: 'dpp',
    jien: 'ite3', pite3: 'ite3', ai: 'arts', pai: 'arts', nfp: 'nfp', pnfp: 'nfp' };
  const PW_ROW = { jc: 'JC', pjc: 'JC', mi: 'MI', pmi: 'MI', poly: 'Poly', ppoly: 'Poly', pfp: 'PFP', ppfp: 'PFP', dpp: 'DPP', dppvia: 'DPP', ite2: 'ITE',
    pite2: 'ITE 2-year', jien: 'ITE 3-year', pite3: 'ITE 3-year', ai: 'Arts', pai: 'Arts', nfp: 'NAFA Foundation Programme', pnfp: 'NAFA Foundation Programme' };

  // what isn't open, route by route (or pathway by pathway inside an open route), with its reason
  function shutPathways() {
    const out = [];
    liveWheres().forEach(function (wid) {
      const r = routeShut(wid);
      if (r) { if (routeReachable(wid)) out.push({ wid: wid, key: wid, name: STRINGS.routeShort[wid], reason: r.reason }); return; }
      if (!inScope(wid)) return;
      pathSecs(wid).forEach(function (sc) { const st = secStatus(wid, sc); if (st.shut && reachable(wid, sc)) out.push({ wid: wid, key: SHUT_KEY[sc.id] || sc.id, name: PW_NAME[sc.id], reason: st.reason }); });
    });
    return out;
  }

  // C: ONE "indicative" tag. Its explanation shows on tap, hover or keyboard focus; the words of the page stay its own
  let TIP_N = 0;
  function indTagHTML(tip, label) {
    const id = 'tip-' + (++TIP_N);
    return '<span class="ind-w"><button type="button" class="ind" data-do="ind" aria-expanded="false" aria-describedby="' + id + '"><span class="ind-t">' + esc(label || STRINGS.indicative) + '</span></button>' +
      '<span class="ind-tip" role="tooltip" id="' + id + '" data-wc="0">' + esc(tip) + '</span></span>';
  }
  // the tag's words for a range: last year's (2026), or how the 2028 estimate is made ("rough" for the ITE conversion)
  function tipFor(g) {
    if (!g) return '';
    if (g.est) return STRINGS.indTip27(STRINGS.estHow(g.est.fromAgg, [rangeText(g.est.from)], g.agg, g.est.basis, rangeText(g.range) === rangeText(g.est.from))) + ' ' + STRINGS.indPill + ' ' + STRINGS.grpRule;
    return STRINGS.indTip26(g.ex, g.range[1]) + ' ' + STRINGS.indPill + ' ' + STRINGS.grpRule;
  }
  // "ELR2B2-B 6–14 [indicative] +4": the range plain, the tag, the pill (one renderer for cards and Details)
  function rangeTagHTML(g, marks, noPill) {
    return '<span class="rng">' + nw(esc(g.agg + ' ' + rangeText(g.range))) + '</span> ' + indTagHTML(tipFor(g)) + (noPill ? '' : ' ' + pillHTML(g, marks));
  }
  // B: the bottom of Courses: "Not open to you: JC, MI ›", the reasons on tap
  function moeLinkHTML() {
    const o = MOE_OVERVIEW;
    return '<p class="src ov-src">' + ext(o.url, STRINGS.ovAll) + '</p>' +
      '<details class="fold-s"' + keep('ovnote') + '><summary>' + esc(STRINGS.ovNote) + '</summary><div data-wc="0"><p class="hint">' + esc(o.footnote) + '</p><p class="src">' + ext(o.url, o.source) + '</p></div></details>';
  }

  /* ================================================================================================ Screen 2: the list (D6, D7, D13) */
  function isStarred(key) { return S.stars.indexOf(key) >= 0; }
  function starBtn(c, big) {
    const on = isStarred(c.key);
    return '<button type="button" class="star' + (big ? ' star-big' : '') + '" data-do="star" data-key="' + esc(c.key) + '" aria-pressed="' + on + '" aria-label="' + esc(STRINGS.starAria(c.title)) + '">' +
      (big ? esc(on ? STRINGS.starred : STRINGS.star) : '<span aria-hidden="true">' + (on ? '★' : '☆') + '</span>') + '</button>';
  }
  function stateTag(state, text) {
    return '<span class="tag st-' + state + '"><span class="st-mark" aria-hidden="true">' + STRINGS.mark[state] + '</span>' + esc(text) + '</span>';
  }
  function offerBadge(o, c, opts) {
    opts = opts || {};
    const label = c.kind === 'jc' && !opts.big && !opts.inTable ? o.label : '';
    if (c.kind === 'arts') {
      const a = o.arts;
      if (a.state === 'meets') return stateTag('yes', STRINGS.state.meets);
      if (a.state === 'below') return stateTag('no', STRINGS.state.below);
      return stateTag('unsure', STRINGS.checkWith(a.who));
    }
    if (o.state === 'no') return '<span class="st-text">' + (label ? '<span class="gap-l">' + esc(label) + '</span> ' : '') + esc(STRINGS.state.no) + '</span>';
    if (o.state === 'unsure') return '<span class="st-text">' + (label ? '<span class="gap-l">' + esc(label) + '</span> ' : '') + esc(STRINGS.state.unsure) + '</span>';
    return gapHTML(o.gap, o.net.marks, { label: label, big: opts.big });
  }
  // the part of a PFP title after its cluster ("Design, Engineering and Technology: Design" -> "Design"); nothing when it
  // only repeats the cluster heading above it
  // under its own sub-group heading a PFP card doesn't repeat it ("Design, Engineering and Technology:
  // Design" → "Design"; "Sciences" under "Sciences" → nothing); anywhere else it keeps its full name
  let CARD_SUB = '';
  function pfpSub(c) {
    const t = String(c.title || '');
    if (!CARD_SUB || norm(subKey(c)) !== norm(CARD_SUB)) return t;
    const i = t.indexOf(': ');
    return i >= 0 && norm(t.slice(0, i)) === norm(CARD_SUB) ? t.slice(i + 2) : norm(t) === norm(CARD_SUB) ? '' : t;
  }
  // a card's grey label names what its list's grouping doesn't: the institution and field with no grouping, the
  // institution when grouped by field, the field when grouped by institution
  function cardLabel(c) {
    if (CARD_LABEL === 'field') return c.field || '';
    if (CARD_LABEL === 'both') return [c.inst, c.field].filter(Boolean).join(' · ');
    return c.inst || '';
  }
  function cardHTML(c) {
    const on = ROUTE.name === 'course' && ROUTE.id === c.id;
    let badges = '';
    if (c.kind === 'jc') badges = c.offers.map(function (o) { return offerBadge(o, c); }).join('');
    else badges = offerBadge(c.best, c);
    const tags = [];
    if (c.state === 'cond') tags.push(stateTag('cond', STRINGS.state.cond));
    if (c.kind === 'pfp' && (c.state === 'yes' || c.state === 'browse')) tags.push(stateTag('yes', STRINGS.canApply));
    if (c.state === 'unsure' && c.kind !== 'arts' && c.kind !== 'jc') tags.push(stateTag('unsure', STRINGS.state.unsure));
    if (c.fits) tags.push('<span class="tag tag-fit">' + esc(STRINGS.fits) + '</span>');
    // fix 3: an ITE course at several colleges names the college its badge comes from
    const best = c.kind === 'ite' && c.offers.length > 1 && c.best && c.best.r && c.best.gap.n != null ? STRINGS.bestAt(c.best.r.institution.replace(/^ITE College /, '')) : '';
    if (c.kind === 'jc' && S.year === 2026 && affiliatedJCs().some(function (n) { return norm(n) === norm(c.title); })) tags.push('<span class="tag">' + esc(STRINGS.affiliatedTag) + '</span>');
    let side = '<span class="cc-badges">' + badges + '</span>';
    if (c.kind === 'arts') side += ext(c.row.how_to_apply_url, STRINGS.applyDirect(c.inst), 'cc-apply');
    return '<article class="cc k-' + c.kind + ' st-' + c.state + (on ? ' on' : '') + '" data-key="' + esc(c.key) + '" data-id="' + c.id + '">' +
      '<a class="cc-main" href="#course-' + c.id + '"' + (on ? ' aria-current="true"' : '') + '>' +
      // a PFP card leads with the polytechnic (the school first), its cluster under it
      (c.kind === 'pfp' && c.inst ? '<span class="cc-title" data-wc="0">' + esc(c.inst) + '</span>' + (pfpSub(c) ? '<span class="cc-inst" data-wc="0">' + esc(pfpSub(c)) + '</span>' : '')
        : '<span class="cc-title" data-wc="0">' + esc(CARD_SHORT ? iteShort(c.title) : c.title) + '</span>' + (cardLabel(c) ? '<span class="cc-inst" data-wc="0">' + esc(cardLabel(c)) + '</span>' : '')) +
      (best ? '<span class="cc-best" data-wc="0">' + esc(best) + '</span>' : '') + '</a>' +
      '<div class="cc-side">' + side + (tags.length ? '<span class="cc-tags">' + tags.join('') + '</span>' : '') + '</div>' + starBtn(c) + missHTML(c) + '</article>';
  }
  // what a Borderline or Out of reach course is missing, in one line: a requirement the engine says isn't met (or is
  // met only on condition) first, else the gap in words. '' for every other course
  function missLine(c, o) {
    o = o || (c && c.best);
    if (!o || !o.gap || !groupsApply(secOf(c))) return '';
    const g = marginGroup(o.gap.n);
    if (g !== 'border' && g !== 'out') return '';
    const it = o.r ? reasonItems(o.r).filter(function (x) { return x.met !== true; })[0] : null;
    if (it) return it.text;
    return o.gap.n >= 0 ? STRINGS.missSafer : o.gap.n === -1 ? STRINGS.missOne() : STRINGS.missShort(-o.gap.n);
  }
  function missHTML(c, o, inline) { const t = missLine(c, o); return t ? (inline ? '<span class="cc-miss">' : '<p class="cc-miss">') + esc(t) + (inline ? '</span>' : '</p>') : ''; }
  function stripText() {
    const lv = levelsUsed().map(function (l) { return STRINGS.levelName[l]; });
    const n = takenRows().length;
    const cca = S.cca && S.cca !== 'Not sure' ? S.cca : '';
    return STRINGS.strip(lv.join(' + ') || STRINGS.levelName[S.level] || '', n, cca);
  }
  function chipBtn(act, label, n, expanded) {
    return '<button type="button" class="tchip" data-do="' + act + '" aria-haspopup="dialog" aria-expanded="' + !!expanded + '">' + esc(label) +
      (n ? ' <span class="count">' + n + '</span>' : '') + '<span class="caret" aria-hidden="true"></span></button>';
  }
  // an arts "check with the school" card counts when no check failed outright (only near ones, an interview, or an
  // unknown), as the engine's arts checks say on the card; when nothing else at all can be applied for, every such card does
  function canApply(c) { return c.state === 'yes' || c.state === 'cond' || c.state === 'browse' || (c.kind === 'arts' && c.state === 'unsure' && (artsNear(c) || artsOnly())); }
  function artsNear(c) {
    const sec = artsSec(c), res = sec && R && R.byId[sec.agg];
    if (!res) return false;
    return !artsChecks(res, c.inst).some(function (e) { return e.met === false && !(e.near || /interview/i.test(e.detail || '')); });
  }
  let AO = null;
  function artsOnly() {
    if (AO && AO.cards === CARDS) return AO.v;
    const v = !(CARDS || []).some(function (c) { return c.state === 'yes' || c.state === 'cond' || c.state === 'browse' || (c.kind === 'arts' && c.state === 'unsure' && artsNear(c)); });
    AO = { cards: CARDS, v: v };
    return v;
  }
  function groupOpen(wid, n) {
    if (S.fold[wid] != null) return !S.fold[wid];
    return n <= 2;
  }
  function renderList() {
    const el = $('#s-list');
    if (!el) return;
    const keepTop = el.scrollTop;
    ensureR();
    let h = '';
    if (!S.year || !R) {
      el.innerHTML = '<div class="card empty"><p>' + esc(CORE_OK ? STRINGS.enterFirst : STRINGS.coreMissing) + '</p><a class="btn" href="#input">' + esc(STRINGS.toInput) + '</a></div>';
      return;
    }
    if (R.error) { el.innerHTML = '<div class="card warn"><p>' + esc(STRINGS.engineError) + '</p></div>'; return; }
    // results from a paste: "Edit" opens the paste box, and "Next student" sits beside it
    h += '<div class="strip"><span class="strip-t">' + esc(stripText()) + '</span>' + (S.pasted ? '<button type="button" class="btn-link" data-do="edit-paste">' + esc(STRINGS.edit) + '</button><button type="button" class="btn-link" data-do="restart" aria-haspopup="dialog">' + esc(STRINGS.nextStudent) + '</button>'
      : '<a class="btn-link" href="#input" data-do="subj-edit">' + esc(STRINGS.edit) + '</a>') + '</div>';
    if (calcOn()) h += summaryHTML('courses');  // the same words as on Results; once calculated, as there
    // no "Next:" line here (Dates has it); A: the search, then the bar that sticks
    h += '<div class="tools"><input id="q" type="search" aria-label="' + esc(STRINGS.search) + '" placeholder="' + esc(STRINGS.search) + '" value="' + esc(S.q) + '" data-input="q"></div>' + toolbarHTML();
    // fix 4: groups with something to apply for come first; a group a filter empties is left out (fix 19)
    // a shut route has no group, and a shut pathway inside an open route no section; both are listed at the foot
    const filtering = filterParts().length > 0;
    const info = scope().map(function (wid) {
      const shut = routeShut(wid);
      if (shut) return null;
      const secs = groupSections(wid).filter(function (sc) { return !secStatus(wid, sc).shut; });
      let n = 0, vis = 0;
      const secInfo = secs.map(function (sc) {
        const cards = cardsIn(wid, sc.id).filter(function (c) { return matchesFilters(c); });
        const parts = splitCards(cards, sc);
        const can = parts.shown.filter(cardInReach).length;  // the courses shown by default (not Out of reach)
        n += can; vis += cards.length;
        return { sc: sc, can: parts.shown.filter(canApply).length };
      });
      secInfo.sort(function (a, b) { return (b.can > 0) - (a.can > 0); });
      return { wid: wid, secs: secInfo.map(function (x) { return x.sc; }), n: n, vis: vis, open: secInfo.some(function (x) { return x.can > 0; }) };
    }).filter(function (g) { return g && (!filtering || g.vis > 0); });
    info.sort(function (a, b) { return (b.open ? 1 : 0) - (a.open ? 1 : 0); });
    const multi = info.length > 1;
    let shownTotal = 0;
    let body = '';
    info.forEach(function (g) {
      const wid = g.wid;
      shownTotal += g.vis;
      const open = !multi || (S.fold[wid] != null ? !S.fold[wid] : (g.open && groupOpen(wid, info.length)));
      // K5: a band that sticks while its section scrolls: the route's name
      // a route whose sections carry their own counts on their bands has no second number on its head
      const gn = g.secs.some(groupable) ? '' : countHTML(g.n, 'g:' + wid);
      let gh = '<section class="group" id="g-' + wid + '" tabindex="-1"><div class="g-band">';
      if (multi) gh += '<button type="button" class="group-head" data-do="group" data-v="' + wid + '" aria-expanded="' + open + '"><span class="g-name">' + esc(WHERE[wid].label) +
        '</span>' + gn + '<span class="caret" aria-hidden="true"></span></button>';
      else gh += '<h3 class="g-title"><span class="g-name">' + esc(WHERE[wid].label) + '</span>' + gn + '</h3>';
      gh += '</div>';
      // one set of filters, in the bar at the top (no pickers under the band)
      if (open) {
        gh += '<div class="group-body' + (JUST_OPENED === 'group|' + wid ? ' opening' : '') + '">';
        g.secs.forEach(function (sc) { gh += sectionHTML(wid, sc, g.secs.length > 1 || (multi && SEC_HEAD_ALWAYS.indexOf(sc.id) >= 0)); });
        gh += '</div>';
      }
      body += gh + '</section>';
    });
    if (!shownTotal && filterParts().length) {
      h += '<div class="card empty"><p>' + esc(STRINGS.noMatch(joinAnd(filterParts()))) + '</p><button type="button" class="btn" data-do="clear-filters">' + esc(STRINGS.clearFilters) + '</button></div>';
    } else h += body;
    // "Another route" is an offer, shown only when none of the picked routes has anything to apply for
    const rt = scope().some(function (w) { return shownCards(w).some(canApply); }) ? [] : anotherRoutes();
    if (rt.length) h += routeLineHTML(rt.length > 1 ? STRINGS.others : STRINGS.another, rt.map(function (k) { return ANOTHER[k].short || ANOTHER[k].name; }).join(', '), 'another', '');
    // –D: no "Also open to you" (the route chips are under the tiles), no "Not open to you" (the tiles' pop-overs
    // say why), and no MOE links or footer (About, behind the i)
    el.innerHTML = h;
    // scrolling a row into view stops below the sticky section header, at every width
    // the bar sticks under the top bar, and each route's band under the bar (--tbar-h)
    const tb = $('#tbar'), tbH = tb ? tb.offsetHeight : 0;
    document.documentElement.style.setProperty('--tbar-h', tbH + 'px');
    let stickyH = 0;
    $$('#s-list .group').forEach(function (g) {
      const b = g.querySelector('.g-band');
      if (!b) return;
      g.style.setProperty('--band-h', b.offsetHeight + 'px');
      stickyH = Math.max(stickyH, b.offsetHeight);
    });
    document.documentElement.style.setProperty('--sticky-h', (stickyH + tbH) + 'px');
    if (isWide()) el.scrollTop = keepTop;
  }
  // a section with cut-offs groups its courses by a fixed margin rule, never a percentage:
  // Within reach (+2 or more), Borderline (−1 to +1), Out of reach (−2 or less, folded). It replaces Within reach and its
  // allowance. The courses shown by default are the first two groups (and, with no range, every course)
  function groupsApply(sec) { return !!sec && hasCutoffs(sec) && (sec.kind === 'course' || sec.kind === 'ite' || sec.kind === 'jc'); }
  function marginGroup(n) { return n == null ? '' : n >= 2 ? 'in' : n >= -1 ? 'border' : 'out'; }
  function secOf(c) { return (WHERE[c.where].sections.concat(WHERE[c.where].pse)).filter(function (x) { return x.id === c.sec; })[0]; }
  function cardGroup(c) { return groupsApply(secOf(c)) && c.best && c.best.gap ? marginGroup(c.best.gap.n) : ''; }
  function splitCards(cards, sec) {
    const no = cards.filter(function (c) { return c.state === 'no'; });
    return { shown: cards.filter(function (c) { return c.state !== 'no'; }), beyond: [], noRange: [], no: no };
  }
  // fix 8: one renderer for a route line ("Another route: JIE 'O' ›", "Millennia Institute is open to you ›")
  function routeLineHTML(kicker, text, act, v) {
    return '<button type="button" class="another" data-do="' + act + '"' + (v ? ' data-v="' + esc(v) + '"' : '') + '>' +
      (kicker ? '<span class="nl-k">' + esc(kicker) + ':</span> ' : '') + esc(text) + ' <span aria-hidden="true">›</span></button>';
  }
  // a card the list shows by default (the counts on group heads, route lines and the Institution sheet): can apply, and not
  // Out of reach
  function cardInReach(c) { return canApply(c) && cardGroup(c) !== 'out'; }
  function countHTML(n, id) { return n ? '<span class="count"' + (id ? ' data-c="' + esc(id) + '" data-n="' + n + '"' : '') + '>' + n + '</span>' : ''; }
  // K5: the key number(s) for a section, in one line: "Your net L1R5: 9 (gross 11 − 2 CCA)"
  const REMIND = {
    jc: ['L1R5(2026)'], mi: ['L1R4(2026)'], poly: ['ELR2B2-A(2026)', 'ELR2B2-B(2026)', 'ELR2B2-C:POLY(2026)', 'ELR2B2-D(2026)'],
    ite2: ['ELB4-A(2026)', 'ELR1B3-B(2026)', 'ELR2B2-C:ITE(2026)'], dpp: ['ELMAB3:DPP(2026)'], dppvia: ['ELMAB3:DPP(2026)'],
    jien: ['MAS1B3(2026)', 'ELB3(2026)', 'B4(2026)', 'MAB3(2026)', 'ELMAB2(2026)'], pfp: ['ELMAB3:PFP(2026)'],
    pjc: ['L1R4(2027)'], pmi: ['L1R4(2027)'], ppoly: ['ELR2B2-A(2027)', 'ELR2B2-B(2027)', 'ELR2B2-C(2027)', 'ELR2B2-D(2027)'], ppfp: ['ELMAB3:PFP(2027)'],
    pite2: ['ELMAB3:ITE(2027)'], pite3: ['R2B2(2027)', 'R1B3-A(2027)', 'R1B3-B(2027)', 'R1B3-C(2027)', 'B4(2027)']
  };
  // the aggregate a section's line names: "L1R4", "ELR2B2" (the poly variants as one)
  function aggOfSec(secId) { const id = (REMIND[secId] || [])[0]; return id ? shortName(id).replace(/^(ELR2B2)-[A-D]$/, '$1') : ''; }
  // the section's aggregates its cards on screen use (all its cards when a filter empties it), each worked out
  function remindRes(wid, sec) {
    const used = {};
    const all = cardsIn(wid, sec.id), vis = all.filter(function (c) { return matchesFilters(c); });
    (vis.length ? vis : all).forEach(function (c) { c.offers.forEach(function (o) { if (o.r) used[o.r.aggregate_id] = true; }); });
    return (REMIND[sec.id] || []).filter(function (id) { return used[id]; }).map(function (id) { return R.byId[id]; }).filter(function (x) { return x && x.gross != null; });
  }
  function remindLine(wid, sec, bare) {
    if (!R || !R.byId) return '';
    if (sec.kind === 'arts' && sec.agg) { const x = R.byId[sec.agg]; return x && x.gross != null ? (x.net == null ? STRINGS.remindGross(shortName(x.id), x.gross) : STRINGS.remindNet(shortName(x.id), x.net) + (x.gross !== x.net ? STRINGS.remindBonus(x.gross, ' − ' + (x.gross - x.net) + ' CCA') : '')) : ''; }
    const res = remindRes(wid, sec);
    if (!res.length) return '';
    // bare (Details, ): the number alone, as the check line under it states the rule
    if (sec.kind === 'pfp') { const ck = checkOf(res[0].id, 'pfp_gross'); return bare ? STRINGS.remindGross('ELMAB3', res[0].gross) : STRINGS.pfpNeeds(res[0].gross, ck ? ck.max : ''); }
    if (res.length === 1) {
      const x = res[0];
      if (x.net == null) return STRINGS.remindGross(shortName(x.id), x.gross);
      return STRINGS.remindNet(shortName(x.id), x.net) + (x.gross !== x.net ? STRINGS.remindBonus(x.gross, bonusParts(x)) : '');
    }
    const val = function (x) { return x.net != null ? x.net : x.gross; };
    // the poly variants all equal, gross too: the JC form, "Your net ELR2B2: 12 (gross 14 − 2 CCA)"
    const fam = res.every(function (x) { return /^ELR2B2-/.test(shortName(x.id)); });
    if (fam && res.every(function (x) { return val(x) === val(res[0]) && x.gross === res[0].gross; }) && res[0].net != null) {
      const x = res[0];
      return STRINGS.remindNet('ELR2B2', x.net) + (x.gross !== x.net ? STRINGS.remindBonus(x.gross, bonusParts(x)) : '');
    }
    return STRINGS.remindNets(fmtNets(res.map(function (x) { return { agg: shortName(x.id), v: val(x) }; })));
  }
  // " − 2 CCA", kept whole (no-break spaces)
  function bonusParts(x) {
    const items = ((x.bonus && x.bonus.items) || []).filter(function (it) { return it.points && it.scope !== 'choice'; });
    const b = x.gross - x.net;
    return !b ? '' : ' − ' + b + ' ' + (items.length === 1 ? (BONUS_SHORT[items[0].id] || items[0].id) : 'bonus');
  }
  // ONE formatter for header and divider lines. Equal values once, each with its names in brackets on one
  // line: "ELR2B2: 13 (A, B) · 15 (C, D)" for the poly letters, "11 (ELB4-A, ELR1B3-B, ELR2B2-C)" for the rest
  function fmtNets(list) {
    const NB = '\u00a0', fam = list.length > 1 && list.every(function (x) { return /^ELR2B2-/.test(x.agg); });
    const grp = [];
    list.forEach(function (x) { const k = fam ? x.agg.replace(/^ELR2B2-/, '') : x.agg; const g = grp.filter(function (y) { return y.v === x.v; })[0]; if (g) g.k.push(k); else grp.push({ v: x.v, k: [k] }); });
    // a value never leaves its first name; the poly letters stay on one line, longer names may wrap after a comma
    return (fam ? 'ELR2B2: ' : '') + grp.map(function (y) { return y.v + NB + '(' + y.k.join(',' + (fam ? NB : ' ')) + ')'; }).join(' · ');
  }
  // B3: the line a section header carries: the first of its sections that has one; the others say theirs in their own head
  const BAND_SEC = {};
  function bandRemind(wid) {
    // a section a filter has emptied is not quoted while another section still shows cards
    // a shut pathway has no section, so the band doesn't quote its number
    const all = groupSections(wid).filter(function (sc) { return !secStatus(wid, sc).shut; });
    const seen = all.filter(function (sc) { return sc.kind === 'arts' || cardsIn(wid, sc.id).some(function (c) { return matchesFilters(c); }); });
    const secs = seen.length ? seen : all;
    for (let i = 0; i < secs.length; i++) { const t = remindLine(wid, secs[i]); if (t) { BAND_SEC[wid] = secs[i].id; return { text: t, sec: secs[i] }; } }
    BAND_SEC[wid] = '';
    return { text: '', sec: null };
  }
  // the student's number(s) in bold, the working in brackets as it is: "Your net L1R4: <b>14</b> (gross 16 − 2 CCA)"
  // a header or divider line (escaped HTML) never splits a name from its number, "13 (A, B)" or "− 2 CCA"
  function nwLine(html) {
    // one pass, small pieces, never nested: "L1R4: <b>14</b>" · "(gross 16" · "− 2 CCA)" · "13 (A," — a narrow screen
    // may break between pieces, never inside one
    const N = '(?:<b>)?\\d+(?:<\\/b>)?';
    const re = new RegExp('(\\S+: ' + N + '(?: \\((?!gross|net)[^\\s()]+)?)|(\\((?:gross|net) ' + N + ')|(− ' + N + ' [A-Za-z]+\\)?)|(' + N + ' \\([^\\s()]+)', 'g');
    return String(html).replace(re, '<span class="nw">$&</span>');
  }
  // + say each number once: drop "Yours is 30." (or "Your gross ELMAB3 is 7.") when the line beside it shows 30
  // only the "Yours is N." clause goes; "gross" / "net" stay, so the rule still says which number it uses.
  // "Yours is 26 for all four." / "for each" goes too. a reason whose whole rule the line beside it
  // already states ("(PFP needs 12 or better)") is not said again at all.
  function sayOnce(t, shown) {
    const m = / (?:Yours is|Your (?:gross|net) \S+ is) (\d+)(?: for (?:all four|each))?\.?$/.exec(t);
    if (!m || !shown || !new RegExp('(^|[^\\d])' + m[1] + '([^\\d]|$)').test(shown)) return t;
    const rest = t.slice(0, m.index).replace(/, counted before bonus points\.?$/, '.').replace(/([^.])$/, '$1.');
    const lim = / of (\d+) or better\.$/.exec(rest);
    return lim && shown.indexOf('needs ' + lim[1] + ' or better') >= 0 ? '' : rest;
  }
  // the student's numbers in bold: every value outside brackets; the gross in brackets too where the route's rule uses the
  // gross (2027 ITE; arts, where LASALLE uses the gross and NAFA the net). Names keep their digits plain.
  const GROSS_RULE = ['pite2', 'pite3', 'ai', 'pai'];
  function remindHTML(t, sec, grossOnly) {
    const grossToo = grossOnly || (!!sec && GROSS_RULE.indexOf(sec.id) >= 0);
    // with no bonus there is no "(gross …)": the one number is the gross, so it is the bold one
    const noBracket = grossOnly && !/\(gross /.test(t);
    let first = true;
    const html = esc(t).replace(/(\d+)(?![\w-])/g, function (m, d, off, str) {
      const before = str.slice(0, off);
      if (/[A-Z#&]$/.test(before)) return m;
      const depth = (before.match(/\(/g) || []).length - (before.match(/\)/g) || []).length;
      if (noBracket) { const b = first && depth === 0; if (depth === 0) first = false; return b ? '<b>' + d + '</b>' : m; }
      if (grossOnly) return /gross $/.test(before) ? '<b>' + d + '</b>' : m;
      return depth === 0 || (grossToo && /gross $/.test(before)) ? '<b>' + d + '</b>' : m;
    });
    return '<span class="rm">' + nwLine(html) + '</span>';  // the ITE 3-year scale note sits on that list's band
  }
  // K6: the choice of schools and fields sits in the section's own header (the same state as the toolbar)
  // an institution belongs to its own type (an ITE college under "Via ITE (DPP)" is still ITE), and only the
  // cards a section shows count (Via ITE hides itself while the ITE group is on screen)
  const INST_TYPE = {};
  INSTITUTIONS.forEach(function (i) { INST_TYPE[i.name] = i.type === 'Poly' ? 'Polytechnic' : i.type; });
  function instType(name, wid) { return INST_TYPE[name] || WHERE[wid].type; }
  function shownCards(wid) {
    const ids = groupSections(wid).map(function (sc) { return sc.id; });
    return cardsIn(wid).filter(function (c) { return ids.indexOf(c.sec) >= 0; });
  }
  function instsOf(wid) {
    const out = [];
    const shut = {};
    // (by the cards alone, as secStatus decides it: secStatus reads the filters, and the filters read this list)
    sectionsOf(wid).forEach(function (sc) { const cs = cardsIn(wid, sc.id); shut[sc.id] = cs.length > 0 && !cs.some(canApply); });
    shownCards(wid).filter(function (c) { return !shut[c.sec]; }).forEach(function (c) { c.insts.forEach(function (i) { if (out.indexOf(i) < 0 && instType(i, wid) === WHERE[wid].type) out.push(i); }); });
    return out;
  }

  // B2: the schools picked in the routes on screen; a school kept from a route the student dropped stays saved, unseen
  function liveInsts() {
    const all = {};
    scope().forEach(function (w) { instsOf(w).forEach(function (i) { all[i] = true; }); });
    return S.insts.filter(function (i) { return all[i]; });
  }
  function instFilterFor(wid) { const all = instsOf(wid); return S.insts.filter(function (i) { return all.indexOf(i) >= 0; }); }
  // the line that says why a section has nothing to apply for: 2027 from its pathway row (D21), 2026 from the engine
  // D24: inside Polytechnic and ITE, sub-groups by Field of Study (PFP by cluster) when a section has more than 8 courses
  const SUB_MIN = 8;
  function subKey(c) { return c.kind === 'pfp' ? (c.cluster || PFP_CLUSTERS[3]) : (c.field || 'Other'); }
  function foldBtn(kind, key, n, open, words) {
    return '<button type="button" class="btn-more" data-do="' + kind + '" data-v="' + esc(key) + '" aria-expanded="' + open + '">' + esc(open ? (kind === 'show-no' ? STRINGS.hideNo : STRINGS.showFewer) : words) + '</button>';
  }
  // the list's blocks (the fit rule, and the "No published cut-off" / "Not sure" dividers), in the sort the student chose
  function blocksHTML(blocks, after) {
    let h = '', first = !after;
    blocks.forEach(function (block) {
      if (block.rule) { h += '<hr class="fit-rule">'; first = true; return; }
      if (!block.cards.length) return;
      if (block.divider && !first) h += '<p class="divider"><span class="div-t">' + nwLine(esc(STRINGS.divider[block.divider === 'none' && S.year === 2027 ? 'noFig' : block.divider])) + '</span></p>';
      h += '<div class="cards">' + block.cards.map(cardHTML).join('') + '</div>';
      first = false;
    });
    return h;
  }
  function orderFlat(list) { return orderCards(list).reduce(function (a, b) { return a.concat(b.cards || []); }, []); }
  // a group's heading, its dot the group's colour (green, amber), its name in words
  // a list's group heading carries its count ("Within reach · 12"); the JC table's carries none
  function grpHeadHTML(g, n) { return '<p class="grp grp-' + g + '"><span class="grp-dot" aria-hidden="true"></span><span>' + esc(STRINGS.grp[g]) + (n != null ? '<span data-wc="0"> · ' + n + '</span>' : '') + '</span></p>'; }
  const LONG = 10;  // a long group shows its first 10 cards, then "Show N more"
  function cardsBody(key, parts, sec) {
    if (sec.kind === 'jc' && hasCutoffs(sec)) return jcTableHTML(key, parts, sec);
    let h = '';
    if (groupsApply(sec)) {
      // Within reach, then Borderline, most competitive first in each; Out of reach folded; no range or not sure after
      const by = marginParts(parts.shown);  // the one function the bands and group headings count with
      ['in', 'border'].forEach(function (g) {
        if (!by[g].length) return;
        const list = orderFlat(by[g]), lk = key + '|' + g, all = !!S.showMore[lk] || list.length <= LONG;
        h += grpHeadHTML(g, list.length) + '<div class="cards">' + (all ? list : list.slice(0, LONG)).map(cardHTML).join('') + '</div>';
        if (list.length > LONG) h += foldBtn('show-long', lk, list.length - LONG, !!S.showMore[lk], STRINGS.showN(list.length - LONG));
      });
      h += blocksHTML(orderCards(by.rest), !!(by.in.length || by.border.length));
      if (by.out.length) {
        const o = !!S.showMore[key];
        h += foldBtn('show-more', key, by.out.length, o, STRINGS.outFold(by.out.length));
        if (o) h += '<div class="cards cards-more' + (JUST_OPENED === 'show-more|' + key ? ' opening' : '') + '">' + orderFlat(by.out).map(cardHTML).join('') + '</div>';
      }
    } else h += blocksHTML(orderCards(parts.shown), false);
    if (parts.no.length) {
      const o = !!S.showNo[key];
      h += foldBtn('show-no', key, parts.no.length, o, STRINGS.showNo(parts.no.length));
      if (o) h += '<div class="cards cards-no' + (JUST_OPENED === 'show-no|' + key ? ' opening' : '') + '">' + parts.no.slice().sort(byName).map(cardHTML).join('') + '</div>';
    }
    return h;
  }
  /* ================================================================================================ one list by chance */
  const RB_NAME = { poly: 'Polytechnic Year 1', ppoly: 'Polytechnic Year 1' };
  function rbName(sec) { return RB_NAME[sec.id] || sec.head; }
  // the margin groups for a list of cards: the ONE place a course is put in Within reach, Borderline or Out of reach
  // (no range and not sure after them, can't apply in its own fold); every list, band and group heading counts with it
  function marginParts(cards) {
    const by = { in: [], border: [], out: [], rest: [], no: [] };
    cards.forEach(function (c) { if (c.state === 'no') by.no.push(c); else (by[marginGroup(c.best && c.best.gap ? c.best.gap.n : null)] || by.rest).push(c); });
    return by;
  }
  function chanceCount(list) { const p = marginParts(list); return { i: p.in.length, b: p.border.length }; }
  function itemView(c, o) { const v = Object.create(c); v.offers = [o]; v.best = o; v.state = o.state; v.insts = [o.r.institution]; v.inst = o.r.institution; return v; }
  function listItems(wid, sec) {
    const mine = instFilterFor(wid), out = [];
    cardsIn(wid, sec.id).filter(function (c) { return matchesFilters(c); }).forEach(function (c) {
      (c.kind === 'ite' && c.offers.length > 1 ? c.offers.map(function (o) { return itemView(c, o); }) : [c]).forEach(function (x) {
        if (!mine.length || mine.indexOf(x.insts[0]) >= 0) out.push(x);
      });
    });
    return out;
  }
  // the Group control's choice, kept for this visit like the route chips
  const GROUP_KEY = STORE_KEY + '-group';
  let GROUP = (function () { let g = ''; try { g = sessionStorage.getItem(GROUP_KEY) || ''; } catch (e) { g = ''; } return g === 'field' || g === 'inst' ? g : 'none'; })();
  function setGroup(g) { GROUP = g === 'field' || g === 'inst' ? g : 'none'; try { sessionStorage.setItem(GROUP_KEY, GROUP); } catch (e) { /* not kept */ } }
  function groupable(sec) { return !!sec && (sec.kind === 'course' || sec.kind === 'ite' || sec.kind === 'pfp'); }
  function groupKey(x) { return GROUP === 'inst' ? x.insts[0] : subKey(x); }  // PFP folds by its cluster (subKey)
  // E: inside a "Higher Nitec" section an ITE card drops the words its heading already says (Details keep MOE's name)
  const ITE_SHORT_SECS = ['ite2', 'pite2', 'jien', 'pite3', 'dpp'];
  function iteShort(t) { return String(t).replace(/^Higher Nitec in /, '').replace(/ \([23] Years\)$/, ''); }
  let CARD_LABEL = '';  // a card's grey label: 'both' (institution · field), 'inst' (grouped by field), 'field' (by institution)
  let CARD_SHORT = false;
  // counts in the tile colours: green within reach · amber borderline (a list with no cut-offs: the ones you can apply for)
  function cntHTML(c, margin) {
    return '<span class="cnt" data-wc="0"><b class="cnt-g">' + c.i + '</b>' + (margin ? ' · <b class="cnt-a">' + c.b + '</b>' : '') +
      '<span class="sr-only"> ' + esc(margin ? STRINGS.cntWords(c.i, c.b) : STRINGS.cntCan(c.i)) + '</span></span>';
  }
  // the route band: the section's name, and its counts under it
  function rbHTML(sec, c) {
    return '<div class="rb-band"><h4 class="rb-h">' + esc(rbName(sec)) + '</h4>' + (c ? '<p class="rb-n"><b class="cnt-g" data-wc="0">' + c.i + '</b> ' + esc(STRINGS.ogWithin) +
      ' · <b class="cnt-a" data-wc="0">' + c.b + '</b> ' + esc(STRINGS.ogBorder) + '</p>' : '') + '</div>';
  }
  // a section of polytechnic, ITE or PFP courses: its band, then one list by chance, or its groups (folded, each heading
  // with its counts; opening one shows its cards by chance). One level of grouping only.
  function listSectionHTML(wid, sec) {
    const items = listItems(wid, sec), margin = groupsApply(sec);
    if (!items.length && filterParts().length) return '';  // a filter emptied this section: no band over nothing
    let h = '<div class="sec" id="sec-' + sec.id + '">' + rbHTML(sec, margin ? chanceCount(items) : null);
    if (sec.id === 'pite3') h += '<p class="rb-note">' + esc(STRINGS.ite3Scale) + '</p>';  // how the 3-year aggregates count, once, where they are read
    if (sec.kind === 'pfp') h += '<p class="sec-tag">' + indTagHTML(STRINGS.pfpNoCut, STRINGS.noCutTag) + '</p>';
    if (sec.id === 'dpp' || sec.id === 'dppvia') h += '<details class="fold-s"' + keep('dpp') + '><summary>' + esc(STRINGS.aboutDpp) + '</summary><p class="sec-intro">' + esc(STRINGS.dppIntro) + ' ' + ext(STRINGS.dppUrl, STRINGS.dppLink) + '</p></details>';
    CARD_SHORT = ITE_SHORT_SECS.indexOf(sec.id) >= 0;
    if (GROUP === 'none') { CARD_LABEL = 'both'; h += cardsBody(sec.id, splitCards(items, sec), sec); }
    else {
      CARD_LABEL = GROUP === 'field' ? 'inst' : 'field';
      const keys = [];
      items.forEach(function (x) { const k = groupKey(x); if (keys.indexOf(k) < 0) keys.push(k); });
      keys.map(function (k) {
        const its = items.filter(function (x) { return groupKey(x) === k; });
        return { k: k, its: its, c: margin ? chanceCount(its) : { i: its.filter(canApply).length, b: 0 } };
      }).sort(function (a, b) { return b.c.i - a.c.i || b.c.b - a.c.b || (a.k < b.k ? -1 : 1); }).forEach(function (g) {
        const key = sec.id + '|' + GROUP + '|' + g.k, open = !!S.subOpen[key];
        h += '<div class="sub"><button type="button" class="sub-head" data-do="sub" data-v="' + esc(key) + '" aria-expanded="' + open + '"><span class="g-name" data-wc="0">' + esc(g.k) +
          '</span>' + cntHTML(g.c, margin) + '<span class="caret" aria-hidden="true"></span></button>';
        if (open) { CARD_SUB = GROUP === 'field' ? g.k : ''; h += '<div class="sub-body">' + cardsBody(key, splitCards(g.its, sec), sec) + '</div>'; CARD_SUB = ''; }
        h += '</div>';
      });
    }
    CARD_LABEL = ''; CARD_SHORT = false;
    return h + '</div>';
  }
  // A: the bar that sticks under the top bar on Courses: Group, Filter, Map; the filters that are on under it, as chips
  // that remove themselves, and "Show all"
  function toolbarHTML() {
    const grp = scope().some(function (w) { return !routeShut(w) && groupSections(w).some(groupable); });
    const fl = fieldList(), fields = S.fields.filter(function (f) { return fl.indexOf(f) >= 0; }), insts = liveInsts();
    let h = '<div class="tbar" id="tbar">';
    if (grp) h += '<div class="tb-g"><span class="tb-l" aria-hidden="true">' + esc(STRINGS.groupBy) + '</span>' +
      segHTML('groupby', [['none', STRINGS.groupOpts.none], ['field', STRINGS.groupOpts.field], ['inst', STRINGS.groupOpts.inst]], GROUP, { label: STRINGS.groupBy }) + '</div>';
    h += chipBtn('sheet-filter', STRINGS.chip.filter, fields.length + insts.length, SHEET.kind === 'filter') + '<a class="tchip" href="#map">' + esc(STRINGS.chip.map) + '</a></div>';
    const parts = fields.map(function (f) { return ['field', f, f]; }).concat(insts.map(function (i) { return ['inst', i, INST_SHORT[i] || i]; }));
    if (parts.length) {
      h += '<div class="fchips">' + parts.map(function (p) {
        return '<button type="button" class="fchip" data-do="unfilter" data-k="' + p[0] + '" data-v="' + esc(p[1]) + '" aria-label="' + esc(STRINGS.removeFilter(p[1])) + '"><span data-wc="0">' + esc(p[2]) + '</span> <span aria-hidden="true">×</span></button>';
      }).join('') + '<button type="button" class="btn-link" data-do="clear-filters">' + esc(STRINGS.showAll) + '</button></div>';
    }
    return h;
  }
  // B: the routes on Courses, right under the tiles: the open ones only (a closed route's tile already says so); shown
  // ones filled with ×, hidden ones dashed with +. The same state as "What are you looking at?" on Results (S.where,
  // defaultRoutes); the last route shown has no ×
  function routeChips() {
    const open = liveWheres().filter(function (w) { return !routeShut(w); }), shown = scope().filter(function (w) { return open.indexOf(w) >= 0; });
    const d = picksMade() ? null : defaultRoutes(), out = [];
    shown.forEach(function (w) {
      const secs = groupSections(w).filter(function (sc) { return !secStatus(w, sc).shut && !secStatus(w, sc).none; });
      const all = pathSecs(w).filter(function (sc) { const st = secStatus(w, sc); return !st.shut && !st.none; });
      const part = d && secs.length && secs.length < all.length;
      out.push({ w: w, on: true, label: part ? secs.map(function (sc) { return PW_NAME[sc.id]; }).join(', ') : STRINGS.routeShort[w] });
    });
    if (d) d.hidden.forEach(function (x) { out.push({ w: x.wid, on: false, label: x.name }); });
    else open.filter(function (w) { return shown.indexOf(w) < 0; }).forEach(function (w) { out.push({ w: w, on: false, label: STRINGS.routeShort[w] }); });
    return out;
  }
  function routeChipsHTML() {
    const cs = routeChips(), n = cs.filter(function (c) { return c.on; }).length;
    if (!cs.length) return '';
    return '<div class="rchips" role="group" aria-label="' + esc(STRINGS.showing) + '"><span class="rc-l">' + esc(STRINGS.showing) + '</span>' + cs.map(function (c) {
      if (c.on && n < 2) return '<span class="rchip on" data-v="' + c.w + '"><span data-wc="0">' + esc(c.label) + '</span></span>';
      return c.on ? '<button type="button" class="rchip on" data-do="route-hide" data-v="' + c.w + '" aria-label="' + esc(STRINGS.routeHide(c.label)) + '"><span data-wc="0">' + esc(c.label) + '</span> <span aria-hidden="true">×</span></button>'
        : '<button type="button" class="rchip" data-do="route-add" data-v="' + c.w + '" aria-label="' + esc(STRINGS.routeAdd(c.label)) + '"><span aria-hidden="true">+ </span><span data-wc="0">' + esc(c.label) + '</span></button>';
    }).join('') + '</div>';
  }
  // C: a tile's details, in the pop-over the indicative tag uses: a closed tile says why, one line per route in plain
  // words; an open tile gives the net and how it is made
  const NEED_SHORT = { '5G3': '5 subjects at G3', '4G3+1G2': '4 at G3 and 1 at G2', '5G2': '5 subjects at G2 or G3', '4G1': '4 subjects at G1 or higher' };
  // one aggregate a pathway uses, as { agg, v, g, b }: its number, the gross, and the bonus words (" − 1 CCA");
  // null when the pathway's line is not one number (PFP's rule line, the poly and ITE variants keep remindLine's words)
  function tileFig(wid, sc) {
    if (!R || !R.byId || sc.kind === 'pfp') return null;
    let x = null;
    if (sc.kind === 'arts' && sc.agg) x = R.byId[sc.agg];
    else { const res = remindRes(wid, sc); if (res.length === 1) x = res[0]; }
    if (!x || x.gross == null) return null;
    const v = x.net != null ? x.net : x.gross;
    return { agg: shortName(x.id), v: v, g: x.gross, b: v === x.gross ? '' : sc.kind === 'arts' ? ' − ' + (x.gross - v) + ' CCA' : bonusParts(x) };
  }
  function figLine(fs) {
    const a = fs[0].agg, same = fs.every(function (f) { return f.v === fs[0].v && f.g === fs[0].g && f.b === fs[0].b; });
    if (same) return fs[0].b ? STRINGS.remindNet(a, fs[0].v) + STRINGS.remindBonus(fs[0].g, fs[0].b) : STRINGS.remindOne(a, fs[0].v);
    if (fs.every(function (f) { return f.v === fs[0].v; })) return STRINGS.remindOne(a, fs[0].v) + ' (' + fs.map(function (f) { return f.name + ': ' + (f.b ? 'gross ' + f.g + f.b : STRINGS.noBonus); }).join('; ') + ')';
    return STRINGS.remindOne(a, fs.map(function (f) { return f.v + ' for ' + f.name; }).join(', '));
  }
  // a closed arts pathway in the engine's words: below the minimum, and why when the engine says
  function artsWhy(wid, sc) {
    const res = sc.agg && R && R.byId ? R.byId[sc.agg] : null;
    if (res && res.gross == null) return cantSentence(res);
    const c = cardsIn(wid, sc.id).filter(function (k) { return k.offers[0] && k.offers[0].arts && k.offers[0].arts.failed && k.offers[0].arts.failed.length; })[0];
    return c ? artsReason(c.offers[0].arts.failed[0]) : '';
  }
  function tileLines(r) {
    if (r.fifth) return fifthLines(r);
    const lines = [];
    if (!r.off) {
      const figs = {};
      r.pw.forEach(function (x) {
        const f = tileFig(x.wid, x.sc);
        if (f) { f.name = PW_NAME[x.sc.id] || STRINGS.routeShort[x.wid]; f.sc = x.sc; if (!figs[f.agg]) { figs[f.agg] = [f]; lines.push({ fig: f.agg }); } else figs[f.agg].push(f); return; }
        const t = remindLine(x.wid, x.sc); let hl = t ? remindHTML(t, x.sc, false) : '';
        // no figure on a "check" tile: the engine's reason, in the words the cards use
        if (!hl && r.check) { const res = x.sc.agg ? R.byId[x.sc.agg] : null; if (res && res.gross == null) hl = esc(cantSentence(res)); }
        if (hl && lines.indexOf(hl) < 0) lines.push(hl);
      });
      lines.forEach(function (l, i) { if (l.fig) lines[i] = remindHTML(figLine(figs[l.fig]), figs[l.fig][0].sc, false); });
      if (r.check) lines.push(esc(STRINGS.checkWith(r.check) + '.'));
      if (!lines.length) lines.push(esc(STRINGS.canApply + '.'));  // never an empty pop-over: the route's state words
      return lines;
    }
    const byG = {}, gs = [];
    r.pw.forEach(function (x) {
      const part = S.year === 2027 ? pathParts(x.wid).filter(function (p) { return p.sec === x.sc.id; })[0] : null;
      if (part && part.st.g && NEED_SHORT[part.st.g]) { if (!byG[part.st.g]) { byG[part.st.g] = []; gs.push(part.st.g); } byG[part.st.g].push(PW_NAME[x.sc.id]); return; }
      const arts = x.sc.kind === 'arts' && !(part && part.st.text) && cardsIn(x.wid, x.sc.id).length;
      let t = arts ? STRINGS.state.below + '. ' + artsWhy(x.wid, x.sc) : part && part.st.text ? part.st.text : (cardsIn(x.wid, x.sc.id).length ? emptyNote(x.sc, cardsIn(x.wid, x.sc.id)) : '');
      // the tile shows the student's number already, so the line doesn't say it again ("Yours is 21")
      t = (r.short ? String(t || '').replace(/^Closed: /, '') : bareReason(t)).trim();
      // on a tile that stands for several pathways, every line names its own ("Arts diplomas: below the minimum.")
      if (r.labels.length > 1 && t) {
        t = t.replace(/^You can't .+? with these results\. /, '');
        if (arts) t = t.charAt(0).toLowerCase() + t.slice(1);
        const hl = '<b>' + esc(PW_NAME[x.sc.id] || STRINGS.routeShort[x.wid]) + ':</b> ' + esc(t);
        if (lines.indexOf(hl) < 0) lines.push(hl);
        return;
      }
      t = t.charAt(0).toUpperCase() + t.slice(1);
      const hl = t ? esc(t) : '';
      if (hl && lines.indexOf(hl) < 0) lines.push(hl);
    });
    const need = gs.map(function (g) { return '<b>' + esc(joinAnd(byG[g])) + ':</b> ' + esc((byG[g].length > 1 ? 'need ' : 'needs ') + NEED_SHORT[g] + '.'); });
    if (gs.length) {
      const p = overviewPlace();
      need.push(esc(gs.some(function (g) { return /G3/.test(g); }) ? STRINGS.youTake(p.n3, ' at G3') : gs.indexOf('5G2') >= 0 ? STRINGS.youTake(p.n3 + p.n2, ' at G2 or G3') : STRINGS.youTake(p.total, '')));
    }
    const out = need.concat(lines);
    // when the rule is on the gross and bonus points would change the number, say so once
    if (r.judged) out.push(esc(STRINGS.grossOnly(r.judged.value)));
    if (!out.length) out.push(esc(STRINGS.state.no + '.'));  // never an empty pop-over: the route's state words
    return out;
  }
  /* K3: JC and MI as a table: one row per school, Arts and Science side by side, the most competitive first by the
     stream the student picks (Arts by default); a row "Your net L1R5: 9" where the student's number falls */
  const JC_COLS = ['Arts', 'Science'];
  function streamOffer(c, s) { return c.offers.filter(function (o) { return (o.r.jc_stream || o.r.course_name) === s; })[0]; }
  // the stream is remembered on this device, through "Start again" too
  const STREAM_KEY = 'rosetta-sg-pse-atlas-stream';
  let STREAM_SAVED = null;
  function savedStream() { if (STREAM_SAVED == null) { try { STREAM_SAVED = localStorage.getItem(STREAM_KEY) || ''; } catch (e) { STREAM_SAVED = ''; } } return STREAM_SAVED; }
  function jcSortStream() { return (S.jcSort || savedStream()) === 'Science' ? 'Science' : 'Arts'; }
  function jcCellHTML(o) {
    if (!o) return '<span class="jct-c muted" aria-label="' + esc(STRINGS.noStream) + '">—</span>';
    if (o.state === 'no') return '<span class="jct-c muted">' + esc(STRINGS.mark.no) + '<span class="sr-only"> ' + esc(STRINGS.state.no) + '</span></span>';
    if (o.state === 'unsure' || o.gap.n == null) return '<span class="jct-c muted">?<span class="sr-only"> ' + esc(STRINGS.state.unsure) + '</span></span>';
    return '<span class="jct-c"><span class="jct-n">' + esc(o.gap.range[1]) + '</span>' + pillHTML(o.gap, o.net.marks) + '</span>';
  }
  function jcRowHTML(c) {
    const on = ROUTE.name === 'course' && ROUTE.id === c.id;
    const extra = c.offers.filter(function (o) { return JC_COLS.indexOf(o.r.jc_stream || o.r.course_name) < 0; });
    const tags = [];
    if (affiliatedJCs().some(function (n) { return norm(n) === norm(c.title); })) tags.push('<span class="tag">' + esc(STRINGS.affiliatedTag) + '</span>');
    if (c.offers.some(function (o) { return o.state === 'cond'; })) tags.push(stateTag('cond', STRINGS.state.cond));
    return '<div class="cc jct-r st-' + c.state + (on ? ' on' : '') + '" role="row" data-key="' + esc(c.key) + '" data-id="' + c.id + '">' +
      '<a class="cc-main jct-name" role="cell" href="#course-' + c.id + '"' + (on ? ' aria-current="true"' : '') + '><span class="cc-title" data-wc="0">' + esc(c.title) + '</span>' +
      extra.map(function (o) { return '<span class="jct-x"><span data-wc="0">' + esc(o.label) + '</span>: ' + (o.state !== 'no' && o.state !== 'unsure' && o.gap.n != null ? esc(o.gap.range[1]) + ' ' + pillHTML(o.gap, o.net.marks) : esc(o.state === 'no' ? STRINGS.state.no : STRINGS.state.unsure)) + '</span>'; }).join('') +
      (tags.length ? '<span class="cc-tags">' + tags.join('') + '</span>' : '') + missHTML(c, streamOffer(c, jcSortStream()) || c.best, true) + '</a>' +
      JC_COLS.map(function (s) { return jcCellHTML(streamOffer(c, s)); }).join('') + starBtn(c) + '</div>';
  }
  function jcTableHTML(key, parts, sec) {
    const st = jcSortStream();
    const can = parts.shown.concat(parts.beyond, parts.noRange);
    // an offer counts by the cards' own rule (can apply, 2027 browse included) when it has a gap
    const live = function (o) { return !!o && o.state !== 'no' && o.state !== 'unsure' && o.gap.n != null; };
    const has = function (c) { return live(streamOffer(c, st)); };
    // a school with neither stream (IB only) goes in its own short group after the table, by its own gap
    const extraOnly = function (c) { return !streamOffer(c, 'Arts') && !streamOffer(c, 'Science'); };
    const ownGap = function (c) { const g = c.offers.filter(live).map(function (o) { return o.gap.n; }); return g.length ? Math.min.apply(null, g) : null; };
    const key2 = function (c) { const g = has(c) ? streamOffer(c, st).gap.n : ownGap(c); return g == null ? 99 : g; };
    // the margin groups by the chosen stream's gap (or the school's own, IB only): Within reach, then Borderline, in one
    // table with a caption row each; Out of reach folded; IB-only schools in their own small table after, as before
    const grpOf = function (c) { const g = key2(c); return g === 99 ? '' : marginGroup(g); };
    const out = can.filter(function (c) { return grpOf(c) === 'out'; }), main = can.filter(function (c) { return grpOf(c) !== 'out'; });
    const rows = main.filter(has), ib = main.filter(function (c) { return !has(c) && extraOnly(c); }), other = main.filter(function (c) { return !has(c) && !extraOnly(c); });
    rows.sort(function (a, b) { return (grpOf(a) === 'in' ? 0 : 1) - (grpOf(b) === 'in' ? 0 : 1) || key2(a) - key2(b) || byName(a, b); });
    ib.sort(function (a, b) { return key2(a) - key2(b) || byName(a, b); });
    const res = R.byId[(can[0] || parts.no[0] || {}).best ? (can[0] || parts.no[0]).best.r.aggregate_id : ''];
    // the head names the aggregate and carries the one indicative tag (what the numbers are, how 2028 is estimated)
    const est0 = can.concat(parts.no).map(function (c) { return c.offers.map(function (o) { return o.gap && o.gap.est; }).filter(Boolean)[0]; }).filter(Boolean)[0];
    const jcTip = STRINGS.indTipJC(est0 ? STRINGS.estHow(est0.fromAgg, [], res ? shortName(res.id) : 'L1R4', est0.basis, true) : '') + ' ' + STRINGS.indPill + ' ' + STRINGS.grpRule;
    const head = '<div class="jct-h" role="row"><span role="columnheader">' + esc(STRINGS.jcHead(res ? shortName(res.id) : 'L1R5')) + ' ' + indTagHTML(jcTip) + '</span>' + JC_COLS.map(function (s) {
      return '<span role="columnheader" class="' + (s === st ? 'on' : '') + '"><button type="button" class="jct-sort" data-do="jcsort" data-v="' + s + '" aria-pressed="' + (s === st) + '" title="' + esc(STRINGS.sortBy + ' ' + s) + '">' + esc(s) + '</button></span>';
    }).join('') + '<span role="columnheader"><span class="sr-only" data-wc="0">Star</span></span></div>';
    // the IB-only schools are a second small table after the main one closes, with their own head
    // ("IB · 2026 cut-off (L1R5 net)"), so no IB row ever sits under the main table's "Your net …" rule
    // an IB group inside an open fold says what sets it apart ("IB · short"), so the main IB caption shows once
    const group = function (list, kind) {
      if (!list.length) return '';
      const labels = [];
      list.forEach(function (c) { c.offers.forEach(function (o) { if (labels.indexOf(o.label) < 0) labels.push(o.label); }); });
      const cap = labels.join(' · ') + ' · ' + (kind ? STRINGS.ibFold[kind] : STRINGS.jcHead(res ? shortName(res.id) : 'L1R5'));
      return '<div class="jct jct-ib" role="table" aria-label="' + esc(cap) + '"><p class="jct-grp" role="caption">' + esc(cap) + (kind ? '' : ' ' + indTagHTML(jcTip)) + '</p>' + list.map(jcRowHTML).join('') + '</div>';
    };
    const table = function (list, withDivider, kind) {
      let t = '<div class="jct" role="table" aria-label="' + esc(STRINGS.jcCut(res ? shortName(res.id) : 'L1R5')) + '">' + head;
      let ibl = [];
      if (withDivider) {
        let at = '';
        rows.forEach(function (c) { const g = grpOf(c); if (g !== at) { at = g; t += '<div class="jct-gh" role="row"><span role="cell">' + grpHeadHTML(g) + '</span></div>'; } t += jcRowHTML(c); });
        t += other.slice().sort(byName).map(jcRowHTML).join('');
        ibl = ib;
      } else {
        ibl = list.filter(extraOnly);
        t += list.filter(function (c) { return !extraOnly(c); }).map(jcRowHTML).join('');
      }
      return t + '</div>' + group(ibl, kind);
    };
    // the cut-off caption only over a table that has rows
    let h = '';  // the tag in the head says what the caption said
    if (rows.length || other.length) h += table(null, true);
    else if (ib.length) h += group(ib);
    if (out.length) {
      const o = !!S.showMore[key];
      h += foldBtn('show-more', key, out.length, o, STRINGS.outFold(out.length));
      if (o) h += table(out.slice().sort(function (a, b) { return key2(a) - key2(b) || byName(a, b); }), false, 'out');
    }
    if (parts.no.length) {
      const o = !!S.showNo[key];
      h += foldBtn('show-no', key, parts.no.length, o, STRINGS.showNo(parts.no.length));
      if (o) h += table(parts.no.slice().sort(byName), false, 'no');
    }
    return h;
  }

  function sectionHTML(wid, sec, showHead) {
    if (groupable(sec)) return listSectionHTML(wid, sec);  // one list by chance, with the Group control
    // the JC and MI tables and the arts lists keep their shape
    const vis = cardsIn(wid, sec.id).filter(function (c) { return matchesFilters(c); });
    if (!vis.length && filterParts().length) return '';  // a filter emptied this section: no head over nothing
    const parts = splitCards(vis, sec);
    let h = '<div class="sec" id="sec-' + sec.id + '">';
    // the head keeps its name and count; the student's number is in the tile's pop-over
    if (showHead) h += '<h4 class="sec-h">' + esc(sec.head) + ' ' + countHTML(parts.shown.filter(cardInReach).length) + '</h4>';
    // NAFA and LASALLE never publish cut-offs; the 2027 arts sections say so
    if (S.year === 2027 && vis.length && sec.kind === 'arts') h += '<p class="g-note">' + esc(STRINGS.artsNoCut) + '</p>';
    h += cardsBody(sec.id, parts, sec);
    return h + '</div>';
  }
  // nothing to apply for in a section: say why, from the first card's own reasons (critic, "Other states")
  // the reason a section has nothing to apply for, short: "JC courses need a gross L1R5 of 20 or better. Yours is 22."
  function emptyNote(sec, cards) {
    const c = cards[0];
    if (c.kind === 'arts') return STRINGS.state.below + '.';
    const r = c.best && c.best.r;
    const gate = r && (r.reasons || []).filter(function (x) { return x.kind === 'gate' && x.met === false && GATE_WHO[x.id.split('|')[0]]; })[0];
    const res = gate && R.byId[r.aggregate_id];
    const ck = gate && checkOf(r.aggregate_id, gate.id.split('|')[0]);
    if (gate && res && res.gross != null && ck) {
      const net = ck.type === 'net_max';
      return GATE_WHO[gate.id.split('|')[0]] + ' a ' + (net ? 'net ' : 'gross ') + shortName(r.aggregate_id) + ' of ' + ck.max + ' or better. ' + STRINGS.yoursIs(net ? res.net : res.gross);
    }
    const why = r ? reasonItems(r).filter(function (it) { return it.met === false || it.met === null; })[0] : null;
    return STRINGS.cantAny(SEC_NOUN[sec.id] || 'apply for these courses') + (why ? ' ' + why.text : '');
  }
  // a lone section still says what it is when the Where's own name does not (PFP, DPP, JIE 'N', NFP)
  const SEC_HEAD_ALWAYS = ['pfp', 'dppvia', 'dpp', 'jien', 'nfp', 'ppfp', 'pnfp'];
  const SEC_NOUN = { jc: 'apply to a JC', mi: 'apply to Millennia Institute', poly: 'apply for a polytechnic diploma', pfp: 'apply for PFP', dppvia: 'apply for DPP',
    ite2: 'apply for an ITE 2-year course', dpp: 'apply for DPP', jien: "apply for an ITE 3-year course through JIE 'N'", ai: 'apply for these diplomas', nfp: 'apply for the NAFA Foundation Programme' };
  function sortOptions() {
    return S.riasec.length ? ['comp', 'fit', 'name'] : ['comp', 'name'];
  }

  /* the 2027 exams: MOE's "you are in" line and the six pathway rows, then the browse list */
  function hasMarks() { return !!(R && R.sent && R.sent.subjects.length); }
  function g3Count() {
    const seen = {};
    ((R && R.entries) || []).forEach(function (e) { if (e.level === 'G3' && e.grade !== 'ABS') seen[e.subject_id] = true; });
    return Object.keys(seen).length;
  }
  function eligibilityOf(id, checkId) {
    const res = R.byId[id];
    return res && (res.eligibility || []).filter(function (e) { return e.id === checkId; })[0];
  }
  function shortList(ids) {
    const names = ids.map(shortName);
    if (names.length > 1 && names.every(function (n) { return /^ELR2B2-/.test(n); })) {
      const tail = names.slice(1).map(function (n) { return n.replace(/^ELR2B2/, ''); });
      return names[0] + (tail.length > 1 ? ', ' + tail.slice(0, -1).join(', ') : '') + ' or ' + tail[tail.length - 1];
    }
    return joinOr(names);
  }
  // D20: no Mother Tongue result (not taken, or Absent) closes JC and MI; it is never "on condition"
  function mtlState() {
    const fam = ['MTL', 'MTL_B', 'MTL_IN_LIEU', 'HMTL'];
    if (((R && R.entries) || []).some(function (e) { const c = CAT_BY_ID[e.subject_id]; return c && fam.indexOf(c.kind) >= 0 && e.grade !== 'ABS'; })) return 'yes';
    const open = S.rows.some(function (r) { const c = catalogueEntry(r.name); return !r.skip && (r.core === 'mtl' || (c && fam.indexOf(c.kind) >= 0)); });
    return open ? 'pending' : 'none';
  }
  function pathwayJCMI(kind) {
    const id = 'L1R4(2027)';
    const res = R.byId[id];
    const label = kind === 'jc' ? 'JC' : 'MI';
    const mtl = mtlState();
    if (mtl === 'none') return { state: 'no', text: STRINGS.closedWith(STRINGS.mtlNeeded(label)), mtl: true };
    if (!res || res.gross == null) {
      const n = g3Count();
      if (n < 5 && !unmarkedRows().length) return { state: 'notyet', text: label + ' needs 5 subjects at G3. You have ' + n + '.' };
      return { state: 'notyet', text: cantSentence(res, shortName(id)) };
    }
    const gross = eligibilityOf(id, kind + '_gross');
    const subj = eligibilityOf(id, 'jcmi_subjects');
    const cond = eligibilityOf(id, kind + '_conditional');
    const c = checkOf(id, kind + '_gross');
    const need = label + ' needs a gross ' + shortName(id) + ' of ' + (c ? c.max : '') + ' or better. Yours is ' + res.gross + '.';
    if (!gross || gross.met !== true) return { state: 'no', text: STRINGS.closedWith(need) };
    if (subj && subj.met === true) return { state: 'yes', text: need };
    if (mtl === 'pending') return { state: 'notyet', text: STRINGS.mtlMark };
    const failed = failedSubjectItems(id, 'jcmi_subjects').join('; ') || 'one of the specific subjects';
    if (cond && cond.met === true) return { state: 'cond', text: STRINGS.onCondition(failed) };
    return { state: 'no', text: STRINGS.closedWith(label + ' needs ' + failed + '.') };
  }
  function pathwayPoly() {
    const ids = ['ELR2B2-A(2027)', 'ELR2B2-B(2027)', 'ELR2B2-C(2027)', 'ELR2B2-D(2027)'];
    const c = checkOf(ids[0], 'poly_net');
    const max = c ? c.max : '';
    const done = ids.filter(function (id) { return R.byId[id] && R.byId[id].net != null; });
    if (!done.length) {
      if (g3Count() < 4 && !unmarkedRows().length) return { state: 'notyet', text: 'Diplomas need 4 subjects at G3 and 1 more at G2 or G3. You have ' + g3Count() + ' at G3.' };
      return { state: 'notyet', text: cantSentence(R.byId[ids[0]], 'ELR2B2') };
    }
    const ok = ids.filter(function (id) { const e = eligibilityOf(id, 'poly_net'); return e && e.met === true; });
    const nets = done.map(function (id) { return R.byId[id].net; });
    const same = nets.every(function (v) { return v === nets[0]; });
    const yours = same ? 'Yours is ' + nets[0] + (done.length > 1 ? ' for ' + (done.length === 4 ? 'all four' : 'each') : '') + '.'
      : 'Yours: ' + done.map(function (id, i) { return (i ? shortName(id).replace(/^ELR2B2/, '') : shortName(id)) + ' ' + R.byId[id].net; }).join(', ') + '.';
    const text = 'Diplomas need a net ELR2B2 of ' + max + ' or better. ' + yours;
    if (ok.length === ids.length) return { state: 'yes', text: text };
    if (ok.length) return { state: 'yes', phrase: STRINGS.meets2028 + ' for diplomas that use ' + shortList(ok), text: text };
    return { state: 'no', text: STRINGS.closedWith(text) };
  }
  function pathwayGross(id, checkId, who) {
    const res = R.byId[id];
    const c = checkOf(id, checkId);
    const e = eligibilityOf(id, checkId);
    if (!res || res.gross == null) return { state: 'notyet', text: cantSentence(res) };
    const text = who + ' a gross ' + shortName(id) + ' of ' + (c ? c.max : '') + ' or better. Yours is ' + res.gross + '.';
    if (!e || e.met !== true) return { state: 'no', text: STRINGS.closedWith(text) };
    // PFP: the grade requirement of at least one cluster must be met too (the engine's own checks)
    const clusters = (res.eligibility || []).filter(function (x) { return /^pfp_cluster/.test(x.id); });
    if (clusters.length && clusters.every(function (x) { return x.met === false; })) return { state: 'no', text: STRINGS.closedWith('your grades do not meet the entry requirements of any PFP cluster.') };
    return { state: 'yes', text: text };
  }
  function pathwayITE3() {
    const ids = ['R2B2(2027)', 'R1B3-A(2027)', 'R1B3-B(2027)', 'R1B3-C(2027)', 'B4(2027)'];
    const done = ids.filter(function (id) { return R.byId[id] && R.byId[id].gross != null; });
    if (!done.length) return { state: 'notyet', text: cantSentence(R.byId['B4(2027)'], 'B4') };
    const ok = done.filter(function (id) { const e = eligibilityOf(id, 'ite3_mer'); return !e || e.met !== false; });
    const text = 'Each course uses one of 5 aggregate types. Yours: ' + done.map(function (id) { return shortName(id) + ' ' + R.byId[id].gross; }).join(', ') + '.';
    if (!ok.length) return { state: 'no', text: STRINGS.closedWith('your results do not meet the grade requirements of any of the 5 aggregate types.') };
    return { state: 'yes', phrase: ok.length === ids.length ? '' : STRINGS.meets2028 + ' for courses that use ' + shortList(ok), text: text };
  }
  function pathwayArts(sec) {
    const res = R.byId[sec.agg];
    const who = sec.arts === 'nfp' ? 'NAFA' : 'NAFA / LASALLE';
    if (!res || res.status !== 'computed' || res.gross == null) return { state: 'unsure', text: STRINGS.checkWith(who) + '.' };
    const v = artsVerdict(res, null);
    if (v && v.state === 'meets') return { state: 'yes', text: '' };
    if (v && v.state === 'below') return { state: 'no', text: STRINGS.closedWith(artsReason(v.failed[0])) };
    return { state: 'unsure', text: STRINGS.checkWith(who) + '.' };
  }
  // D21: MOE's pathways (the table's rows) -> the student's own status and the courses behind each one
  const OV_PATH = {
    '3-Year Higher Nitec': { where: 'ite', sec: 'pite3', fn: pathwayITE3 },
    '2-Year Higher Nitec': { where: 'ite', sec: 'pite2', fn: function () { return pathwayGross('ELMAB3:ITE(2027)', 'ite2_gross', 'ITE 2-year courses need'); } },
    'NAFA Foundation Programme (NFP)': { where: 'arts', sec: 'pnfp', fn: function () { return pathwayArts(WHERE.arts.pse[1]); } },
    'Arts Institutions': { where: 'arts', sec: 'pai', fn: function () { return pathwayArts(WHERE.arts.pse[0]); } },
    'Polytechnic Foundation Programme (PFP)': { where: 'poly', sec: 'ppfp', fn: function () { return pathwayGross('ELMAB3:PFP(2027)', 'pfp_gross', 'PFP needs'); } },
    'Polytechnic Year 1': { where: 'poly', sec: 'ppoly', fn: pathwayPoly },
    'Millennia Institute': { where: 'mi', sec: 'pmi', fn: function () { return pathwayJCMI('mi'); } },
    'Junior College': { where: 'jc', sec: 'pjc', fn: function () { return pathwayJCMI('jc'); } }
  };
  // fix 2: what opens a pathway, from MOE's table: "Junior College is open to students taking at least 5 subjects at G3."
  const OPEN_NEED = { '5G3': '5 subjects at G3', '4G3+1G2': '4 subjects at G3 and 1 at G2', '5G2': '5 subjects at G2 or G3', '4G1': '4 subjects at G1 or higher' };
  const LOOSEST_FIRST = ['4G1', '5G2', '4G3+1G2', '5G3'];
  function openToStatus(path, i, p) {
    const open = LOOSEST_FIRST.filter(function (g) { return MOE_OVERVIEW.cells[g][i] !== '—'; });
    // what the student takes, in the same terms as the need: "You take 4." (subjects at G3 for a G3 need)
    const g = open[0];
    const have = g === '5G3' ? String(p.n3) : g === '4G3+1G2' ? p.n3 + ' at G3 and ' + p.n2 + ' at G2' : g === '5G2' ? String(p.n3 + p.n2) : String(p.total);
    return { state: 'no', text: STRINGS.closedWith(STRINGS.openTo(path, OPEN_NEED[g] || '', have)), need: OPEN_NEED[g] || '', have: have, g: g };
  }
  function pathStatus(path, i, p) {
    const cell = p.group ? MOE_OVERVIEW.cells[p.group][i] : null;
    if (!hasMarks()) return cell === '—' ? openToStatus(path, i, p) : null;
    let st;
    try { st = OV_PATH[path].fn(); } catch (e) { st = { state: 'notyet', text: '' }; }
    if (cell === '—' && st.state !== 'yes' && st.state !== 'no') st = openToStatus(path, i, p);
    return st;
  }
  function fifthYear() {
    const s = R && R.byId['5TH-YEAR(2027)'];
    const e = s && (s.eligibility || []).filter(function (x) { return x.id === 'eligible'; })[0];
    return e ? e.met : false;
  }
  // 2027 students who meet MOE's 5th-year criteria get a
  // tile of their own (the engine's 5TH-YEAR(2027) summary; thresholds from definitions.json summaries). It shows the gross
  // aggregate that meets criterion b, else "Meets the criteria" (criterion a)
  function fifthSpec() { return (DEF_ROOT.summaries || []).filter(function (x) { return x.id === '5TH-YEAR(2027)'; })[0] || null; }
  function fifthHit() {
    const sp = fifthSpec(), sm = R && R.byId && R.byId['5TH-YEAR(2027)'];
    const b = sm && (sm.eligibility || []).filter(function (x) { return x.id === 'criterion_b'; })[0];
    if (!sp || !b || b.met !== true) return null;  // the number only when it is how the student qualifies (criterion b)
    return (sp.criterion_b.any_of || []).map(function (x) { const res = R.byId[x.aggregate]; return res && res.gross != null && res.gross <= x.max ? { res: res, max: x.max } : null; }).filter(Boolean)[0] || null;
  }
  function fifthTile() {
    // only when the criteria are met for sure: "may meet" (the engine can't tell) stays a line on Courses, not a tile
    if (S.year !== 2027 || !resultsIn() || fifthYear() !== true) return [];
    const h = fifthHit();
    return [{ labels: [ANOTHER.fifth.short], agg: h ? shortName(h.res.id) : '', num: h ? String(h.res.gross) : '', off: false, keys: ['fifth'], why: [], need: null,
      short: h ? '' : STRINGS.fifthMeets, check: '', fifth: true, pw: [] }];
  }
  function fifthLines(r) {
    const sp = fifthSpec(), h = fifthHit(), out = [];
    if (h) out.push(esc(STRINGS.fifthFig(shortName(h.res.id), h.res.gross, h.max)));
    else out.push(esc(STRINGS.fifthA));
    const all = sp && R.byId[sp.all_g3.aggregate];
    if (sp && all && all.gross != null) out.push(esc(all.gross <= sp.all_g3.max ? STRINGS.fifthAllG3(sp.all_g3.max) : STRINGS.fifthNotAllG3(sp.all_g3.max)));
    out.push(esc(STRINGS.fifthSchool));
    return out;
  }
  function anotherText(k) {
    if (k === 'fifth') return [fifthYear() === true ? 'Your results meet the criteria for a 5th year in secondary school. Your school handles the application.'
      : 'You may meet the criteria for a 5th year in secondary school. Check with your school.'];
    if (k === 'jie_o') {
      const b5 = R && R.byId['B5(2026)'];
      return ANOTHER.jie_o.text.concat([STRINGS.jieONoCut]).concat(b5 ? [scoreSentence(b5)] : []);
    }
    return ANOTHER[k].text;
  }

  /* ================================================================================================ Screen 3: one course (D10) */
  function markFor(met) { return met === true ? 'yes' : met === false ? 'no' : met === 'cond' ? 'cond' : 'unsure'; }
  function itemHTML(it) {
    let li = '<li class="rs-' + markFor(it.met) + '"><span class="rs-mark" aria-hidden="true">' + STRINGS.mark[markFor(it.met)] + '</span><span>' + esc(it.text);
    if (it.lines && it.lines.length) {
      li += '<details class="lines"' + keep('lines|' + it.text.length) + (it.met === true ? '' : ' open') + '><summary>' + esc(STRINGS.entryLines) + '</summary><ul class="mer">' + it.lines.map(function (l) {
        return '<li class="rs-' + markFor(l.met) + '"><span class="rs-mark" aria-hidden="true">' + STRINGS.mark[markFor(l.met)] + '</span><span>' + esc(l.text) +
          (l.choices ? '<span class="muted">: ' + esc(l.choices) + '</span>' : '') + (l.star ? '<span class="muted"> (* ' + esc(l.star) + ')</span>' : '') +
          (l.by ? '<span class="muted"> · yours: ' + esc(l.by) + '</span>' : '') + '</span></li>';
      }).join('') + '</ul></details>';
    }
    li += '</span></li>';
    if (it.resit) li += '<li class="resit"><details' + keep('resit') + '><summary>' + esc(STRINGS.resitHead) + '</summary><blockquote>' + esc(STRINGS.resit[it.resit]) +
      '</blockquote><p class="src">' + ext(STRINGS.resit.url, STRINGS.resit.source) + '</p></details></li>';
    return li;
  }
  function slotsHTML(res, o, c) {
    if (!res) return '';
    let h = '<p class="muted">' + esc(STRINGS.uses(displayName(res.id))) + '</p>';
    if (res.slots && res.slots.length) {
      h += '<table class="slots"><tbody>' + res.slots.map(function (s) {
        return '<tr><th scope="row" title="' + esc(s.label || '') + '">' + esc(String(s.label || s.slot || '').split(':')[0]) + '</th><td>' +
          esc(s.subject) + ' ' + esc(gradeLabel(s.level, s.grade)) + (S.year === 2026 && s.level && s.level !== 'G3' ? ' (' + esc(levelName(s.level)) + ')' : '') +
          // a G3 grade the 2027 B2 slot reads on the G2 scale says so
          (/^G2EQ/.test(String(s.scale || '')) && s.level === 'G3' ? esc(STRINGS.g2Mapped(s.points, String(s.slot || 'B2'))) : '') + '</td><td class="num">' + esc(s.points) + '</td></tr>';
      }).join('') + (res.gross != null ? '<tr class="tot"><th scope="row">' + esc(STRINGS.total) + '</th><td></td><td class="num">' + esc(res.gross) + '</td></tr>' : '') + '</tbody></table>';
    }
    h += '<p class="total">' + esc(totalLine(res, o, c)) + '</p>';
    // the engine contract: grades the aggregate cannot use, with the engine's own reason
    (res.ignored || []).forEach(function (g) {
      const who = (g.subject || '') + ' (' + levelName(g.level) + (g.grade ? ' ' + gradeLabel(g.level, g.grade) : '') + ')';
      h += '<p class="ign">' + esc(STRINGS.notCounted(who)) + (g.reason ? ' ' + esc(g.reason) : '') + (g.state === 'silent' ? ' ' + esc(STRINGS.notCountedSilent) : '') + '</p>';
    });
    return h;
  }
  // "18 − 1 CCA = 17 · − 2 CLEP (only if posted to its CLEP) = 15 for this JC"
  function totalLine(res, o, c) {
    if (res.gross == null || res.net == null) return scoreSentence(res);
    const items = ((res.bonus && res.bonus.items) || []).filter(function (it) { return it.points && it.scope !== 'choice'; });
    let t;
    if (!items.length) t = STRINGS.noBonus(res.net);
    else {
      t = res.gross + items.map(function (it) { return ' − ' + it.points + ' ' + (BONUS_SHORT[it.id] || BONUS_NAMES[it.id] || it.id); }).join('') + ' = ' + res.net;
      const sum = items.reduce(function (a, it) { return a + it.points; }, 0);
      if (res.gross - res.net < sum && res.bonus && res.bonus.cap != null) t += ' ' + STRINGS.capped(res.bonus.cap);
    }
    if (o && o.net && o.net.marks) {
      if (o.net.aff) t += ' · − ' + o.net.aff + ' ' + STRINGS.affShort;
      if (o.net.lep) t += (o.net.aff ? ' ' : ' · ') + '− ' + o.net.lep + ' ' + STRINGS.lepShort(o.net.prog);
      t += ' = ' + o.net.value + ' ' + STRINGS.forThisJC;
    }
    return t;
  }
  function exerciseDates(c) {
    let titles = [];
    if (c.kind === 'arts') {
      const items = AGENDA.filter(function (a) { return a.fam === 'arts' && a.apply && (c.sec === 'nfp' || c.sec === 'pnfp' ? a.ex === 'NFP-2027' : a.note && a.note.test(c.inst)); });
      titles = items.map(function (a) { return a.title; });
    } else {
      const r = c.best && c.best.r;
      titles = (r && EX_STEPS[r.exercise]) || [];
    }
    const items = titles.map(function (t) { return resolveItem(AGENDA.filter(function (a) { return a.title === t; })[0]); }).filter(Boolean);
    if (!items.length) return '';
    return '<ul class="det-dates">' + items.map(function (i) {
      return '<li><span class="dd-t">' + esc(i.title) + '</span> <span class="dd-w">' + esc(i.whenY) + '</span></li>';
    }).join('') + '</ul>';
  }
  function cfNotesHTML(r) {
    if (!r || !r.notes || !r.notes.length) return '';
    let medical = false, links = false;
    const text = r.notes.map(function (n) {
      let t = String(n);
      if (/View medical requirements\s*\./.test(t)) { medical = true; t = t.replace(/\s*View medical requirements\s*\./g, ''); }
      if (/\s\.(\s|$)/.test(t)) { links = true; t = t.replace(/\s+\.(\s|$)/g, '.$1'); }
      return t.trim();
    }).join(' ');
    let h = '<details class="fold-s"' + keep('notes|' + r.requirement_key) + '><summary>' + esc(STRINGS.cfNotes) + '</summary><p class="muted">' + esc(text) + '</p>';
    if (medical) h += '<p class="muted">' + esc(STRINGS.cfNotesMedical) + ' ' + ext(r.institution_url, STRINGS.coursePage) + '</p>';
    else if (links) h += '<p class="muted">' + esc(STRINGS.cfNotesLinks) + ' ' + ext(r.institution_url, STRINGS.coursePage) + '</p>';
    return h + '</details>';
  }
  function linksFor(r) {
    if (!r) return '';
    const mlabel = /schoolfinder/i.test(r.moe_url || '') ? STRINGS.sf : STRINGS.cf;
    const ilabel = (r.stream === 'Junior college' || r.stream === 'Millennia Institute') ? STRINGS.schoolSite : STRINGS.coursePage;
    const parts = [ext(r.moe_url, mlabel), ext(r.institution_url, ilabel)].filter(Boolean);
    return parts.length ? '<p class="links">' + parts.join('') + '</p>' : '';
  }
  // D25: Details is pushed from Courses or Starred, and goes back to where it came from; the map goes back to Courses
  function backHTML() {
    const to = ROUTE.name === 'course' ? ORIGIN : 'courses';
    return '<a class="back" href="#' + to + '" data-do="back">' + esc(STRINGS.back[to] || STRINGS.back.courses) + '</a>';
  }
  function detailHTML(c) {
    if (!c) return backHTML() + '<div class="card empty"><p>' + esc(STRINGS.notInList) + '</p></div>';
    const b = c.best;
    let h = backHTML() + '<article class="det k-' + c.kind + '"><div class="det-head"><h2 class="det-title" tabindex="-1" data-wc="0">' + esc(c.title) + '</h2>';
    if (c.inst) h += '<p class="det-inst" data-wc="0">' + esc(c.inst) + '</p>';
    // K10: the field line without RIASEC letters
    const fieldLine = c.kind === 'jc' ? (c.streams || []).map(streamLabel).join(' · ') : c.kind === 'pfp' ? (c.fields || []).join(' · ') : c.field || '';
    if (fieldLine) h += '<p class="det-field">' + esc(fieldLine) + '</p>';
    if (c.fits) h += '<p class="det-fit"><span class="tag tag-fit">' + esc(STRINGS.fits) + '</span> <button type="button" class="info" data-do="fit-info" aria-expanded="' + !!KEEP.fitInfo + '" aria-label="About this tag">ⓘ</button></p>' +
      (KEEP.fitInfo ? '<p class="hint">' + esc(STRINGS.fitInfo) + '</p>' : '');
    h += starBtn(c, true) + '</div>';
    if (c.kind === 'arts') return h + artsDetailHTML(c) + '</article>';
    // the badge, large, and the number line (D10: no sentence under it)
    const show = c.kind === 'jc' || c.kind === 'ite' ? c.offers : [b];
    h += detNumbersHTML(c, show);
    const notes = [];
    show.forEach(function (o) { if (o.state !== 'no') (o.net.notes || []).forEach(function (n) { if (notes.indexOf(n) < 0) notes.push(n); }); });
    if (notes.length) h += notes.map(function (n) { return '<p class="hint">' + esc(n) + '</p>'; }).join('');
    // the checks, ✓ / ✗ with reasons
    if (b.r) {
      // a number the lines above already show is not said again in a check
      const items = reasonItems(b.r).map(function (it) { return Object.assign({}, it, { text: sayOnce(it.text, h) }); }).filter(function (it) { return it.text; });
      if (b.mixed) items.unshift({ met: null, text: 'The diplomas in this cluster list different entry requirements. You meet some of them.' });
      // two or more met requirements fold under one line, worded the same in both years; one shows as itself
      const allMet = items.length > 1 && items.every(function (it) { return it.met === true; });
      if (allMet) h += '<details class="fold-s reqs"' + keep('reqs') + '><summary><span class="rs-mark st-yes" aria-hidden="true">✓</span> ' + esc(STRINGS.allMet(items.length)) + '</summary><ul class="reasons">' + items.map(itemHTML).join('') + '</ul></details>';
      else if (items.length) h += '<ul class="reasons">' + items.map(itemHTML).join('') + '</ul>';
    }
    // the aggregate used, and which subjects counted (with the grades it cannot use)
    if (b.r && b.r.aggregate_id) {
      const res = R.byId[b.r.aggregate_id];
      h += '<details class="fold-s counted"' + keep('counted') + '><summary>' + esc(STRINGS.counted) + '</summary>' + slotsHTML(res, b, c) + '</details>';
    }
    if (c.diplomas) {
      h += '<details class="fold-s"' + keep('dips|' + c.key) + '><summary>' + esc(STRINGS.leadsTo(c.diplomas.length)) + '</summary><ul class="dips">' + c.diplomas.map(function (d) {
        return '<li>' + (b.mixed ? '<span class="rs-mark st-' + d.state + '" aria-hidden="true">' + STRINGS.mark[d.state === 'browse' ? 'yes' : d.state] + '</span> ' : '') +
          ext(d.url, d.name) + (d.progress && d.progress.length ? '<p class="muted">' + esc(d.progress.join(' ')) + '</p>' : '') + '</li>';
      }).join('') + '</ul></details>';
    }
    h += exerciseDates(c);
    if (b.r) h += cfNotesHTML(b.r);
    if (c.kind === 'ite' && c.offers.length > 1) h += '<p class="links">' + c.offers.map(function (o) { return ext(o.r.moe_url, o.r.institution.replace(/^ITE College /, '') + ' · ' + STRINGS.cf); }).join('') + '</p>';
    else h += linksFor(b.r);
    return h + '</article>';
  }
  // K1: the numbers named in full: "Your net ELR2B2-B aggregate: 7" and "2026 JAE ELR2B2-B net aggregate: 4–11 (cut-off 11)" +4
  function detNumbersHTML(c, show) {
    const b = c.best;
    if (c.kind === 'pfp') {
      // "12 or better" once. The check line under it says it (the number line is bare); when the
      // requirements fold away, the number line says it and the folded check drops it (sayOnce)
      const its = b.r ? reasonItems(b.r) : [], folds = its.length > 1 && its.every(function (it) { return it.met === true; });
      const rl = remindLine(c.where, { id: c.sec, kind: 'pfp' }, !folds);
      return '<div class="det-offers">' + (rl ? '<p class="nline">' + esc(rl) + ' ' + indTagHTML(STRINGS.pfpNoCut, STRINGS.noCutTag) + '</p>' : '') + '</div>';
    }
    // every 2027 Details shows the student's number, with or without a range
    if (b.r && b.r.exercise === 'PSE-2028' && !show.some(function (o) { return o.gap.est || o.gap.noFig; })) {
      const o0 = show.filter(function (o) { return o.net && o.net.value != null; })[0];
      return '<div class="det-offers">' + (o0 ? '<p class="nline">' + esc(STRINGS.yourNetAggOf(o0.gap.agg)) + ' <b>' + esc(o0.net.value) + '</b></p>' : '') + '</div>';
    }
    const lead = show.filter(function (o) { return o.state !== 'no' && o.net.value != null; })[0] || show[0];
    let h = '<div class="det-offers">';
    if (lead.net.value != null) h += '<p class="nline">' + esc(STRINGS.yourNetAggOf(lead.gap.agg)) + ' <b>' + esc(lead.net.value) + '</b>' + (lead.net.marks ? '<sup>' + lead.net.marks + '</sup>' : '') + '</p>';
    const one = sameGap(c, show);  // equal stream gaps print one pill, after the ranges
    // each range is "Arts: L1R5 7–12 [indicative] +2"; how a 2028 estimate is made is in the tag's words
    show.forEach(function (o) {
      const lbl = show.length > 1 ? esc(o.label + ': ') : '';
      let t;
      if (o.state === 'no') t = lbl + esc(STRINGS.state.no);
      else if (o.gap.n != null) t = lbl + rangeTagHTML(o.gap, '', !!one);
      else if (o.state === 'unsure') t = lbl + esc(STRINGS.state.unsure);
      else t = lbl + esc(o.gap.noFig ? STRINGS.noFigure + '.' : STRINGS.rangeNone(rangeExercise(o.r), o.gap.agg));
      h += '<p class="rline">' + t + '</p>';
    });
    if (one) h += '<p class="rline">' + pillHTML(one.gap, '') + ' ' + esc(STRINGS.allStreams(one.count)) + '</p>';
    h += missHTML(c, lead);  // the same words as on the card
    return h + '</div>';
  }
  // a JC or MI whose streams can all be applied for with one and the same gap: { gap, count }, else null
  function sameGap(c, offers) {
    if (c.kind !== 'jc' || offers.length < 2) return null;
    const live = offers.filter(function (o) { return o.state !== 'no' && o.gap && o.gap.n != null; });
    if (live.length !== offers.length || live.some(function (o) { return o.gap.n !== live[0].gap.n || o.net.marks !== live[0].net.marks; })) return null;
    return { gap: live[0].gap, count: live.length };
  }
  // the arts number named as K1 names every number: "Your net AI4 aggregate: 11"
  function artsSec(c) { return WHERE.arts.sections.concat(WHERE.arts.pse).filter(function (x) { return x.id === c.sec; })[0]; }
  function artsValueLine(c, v) {
    const sec = artsSec(c), res = sec && R && R.byId[sec.agg];
    // the same rule as artsState: only a NAFA diploma uses the net; every other arts value is the gross
    const gross = !(artsWho(c.row) === 'NAFA' && sec && sec.arts === 'diploma' && res && res.net != null);
    return esc((gross ? STRINGS.yourGrossAggOf : STRINGS.yourNetAggOf)(sec ? shortName(sec.agg) : '')) + ' <b>' + esc(v) + '</b>';
  }
  function artsDetailHTML(c) {
    const row = c.row, a = c.best.arts;
    let h = '<div class="det-offers"><div class="det-offer">' + offerBadge(c.best, c, { big: true }) +
      (a.value != null ? '<p class="nline">' + artsValueLine(c, a.value) + '</p>' : '') + '</div></div>';
    if (a.near) h += '<p class="hint">' + esc(STRINGS.nfpInterview) + '</p>';
    // the NFP card shows its English line too; a check the engine leaves open shows the engine's reason
    const sec = artsSec(c), res = sec && R && R.byId[sec.agg], checks = artsChecks(res, artsWho(row));
    if (sec && sec.arts === 'nfp') checks.filter(function (e) { return /english/.test(e.id) && a.failed.indexOf(e) < 0; }).forEach(function (e) { h += '<p class="nline">' + esc(artsReason(e)) + '</p>'; });
    checks.filter(function (e) { return e.met == null && e.reason; }).forEach(function (e) { h += '<p class="hint">' + esc(e.reason) + '</p>'; });
    if (a.state === 'below') h += '<ul class="reasons">' + a.failed.map(function (e) { return itemHTML({ met: false, text: artsReason(e) }); }).join('') + '</ul>';
    h += '<details class="fold-s"' + keep('min|' + c.key) + (a.state !== 'meets' ? ' open' : '') + '><summary>' + esc(STRINGS.minimum) + '</summary><blockquote>' + esc(row.minimum_requirements) + '</blockquote>' +
      '<p class="src">' + ext(row.source_url, c.inst) + '</p></details>';
    const progs = artsProgrammes(row);
    if (progs.length) h += '<details class="fold-s"' + keep('progs|' + c.key) + '><summary>' + esc(STRINGS.programmes) + ' (' + progs.length + ')</summary><ul class="dips">' +
      progs.map(function (p) { return '<li data-wc="0">' + esc(p) + '</li>'; }).join('') + '</ul></details>';
    h += exerciseDates(c);
    h += '<p class="links">' + ext(row.how_to_apply_url, STRINGS.applyDirect(c.inst)) + '</p>';
    return h;
  }

  /* ================================================================================================ Starred and Compare (D11) */
  function starredCards() { return S.stars.map(function (k) { return (CARDS || []).filter(function (c) { return c.key === k; })[0]; }).filter(Boolean); }
  // fix 3: one starred item = one group, led by the school or course name; its streams or colleges are sub-lines
  // grouped by route (JC, MI, Poly, ITE, Arts), the most competitive first within each, as the list (K4)
  function starGap(c) {
    const o = c.kind === 'jc' ? (streamOffer(c, jcSortStream()) || c.best) : c.best;
    return o && o.gap && o.gap.n != null && o.state !== 'no' ? o.gap.n : 99;
  }
  function compareItems(byRoute) {
    const list = starredCards().slice();
    if (byRoute) list.sort(function (a, b) { return WHERE_ORDER.indexOf(a.where) - WHERE_ORDER.indexOf(b.where) || starGap(a) - starGap(b) || byName(a, b); });
    return list.map(function (c) {
      let subs;
      if (c.kind === 'jc') subs = c.offers.map(function (o) { return { label: o.label, o: o }; });
      else if (c.kind === 'ite' && c.offers.length > 1) subs = c.offers.map(function (o) { return { label: o.r.institution.replace(/^ITE College /, ''), o: o }; });
      else subs = [{ label: '', o: c.best }];
      const r0 = c.best && c.best.r;
      return { c: c, title: c.title, inst: (c.kind === 'jc' || subs.length > 1) && c.kind !== 'course' ? (c.kind === 'ite' ? 'ITE' : '') : c.inst, subs: subs,
        link: r0 ? r0.moe_url : (c.row ? c.row.how_to_apply_url : ''), linkLabel: r0 ? (/schoolfinder/i.test(r0.moe_url || '') ? STRINGS.sf : STRINGS.cf) : STRINGS.applyDirect(c.inst) };
    });
  }
  // "Arts: on condition, 3 to spare (you 4¹², cut-off 7)"
  // never "jC" or "iTE"; a sentence that starts with a name keeps its capital ("Millennia Institute courses …", "Mathematics …")
  function lowerFirst(t) {
    if (!t || !/^[A-Z][a-z]/.test(t)) return t;
    const w = t.split(' ');
    if (/^[A-Z]/.test(w[1] || '') || SUBJECTS_OF[2026].concat(SUBJECTS_OF[2027]).some(function (n) { return n.split(' ')[0] === w[0]; })) return t;
    return t.charAt(0).toLowerCase() + t.slice(1);
  }
  // K7: the facts of one starred item: the published range, your net aggregate with the gap(s), and any state
  function itemFacts(x) {
    // the chosen stream first for a JC : "Science 3–7, Arts 5–9"
    const c = x.c, subs = c.kind === 'jc' ? x.subs.slice().sort(function (a, b) { return (b.label === jcSortStream()) - (a.label === jcSortStream()); }) : x.subs, first = subs[0].o;
    const f = { range: '', rangeCell: '', cellText: '', tip: '', tipLabel: '', net: '', netValue: '', pills: [], state: [] };
    const reason = function (o, met) { const it = o.r ? reasonItems(o.r).filter(function (i) { return i.met === met; })[0] : null; return it ? lowerFirst(it.text) : ''; };
    if (c.kind === 'arts') { f.range = f.rangeCell = f.cellText = offerText(first, c) + '.'; return f; }
    const allNo = subs.every(function (sb) { return sb.o.state === 'no'; });
    if (c.kind === 'pfp') {
      const res = first.r && R.byId[first.r.aggregate_id];
      if (first.state === 'yes' || first.state === 'cond' || first.state === 'browse') f.range = STRINGS.pfpShare();
      f.rangeCell = STRINGS.pfpNoCut.split('. ')[0] + '.';
      f.cellText = ''; f.tip = STRINGS.pfpNoCut; f.tipLabel = STRINGS.noCutTag;  // the sentence lives in the tag
      if (res && res.gross != null) { f.net = STRINGS.remindGross('ELMAB3', res.gross); f.netValue = STRINGS.remindGross('ELMAB3', res.gross); }
    } else if (first.r && first.r.exercise === 'PSE-2028' && !subs.some(function (sb) { return sb.o.gap.est || sb.o.gap.noFig; })) {
      f.range = f.rangeCell = STRINGS.pseNote; f.cellText = '';
    } else {
      const ranged = subs.filter(function (sb) { return sb.o.gap.range; });
      const ex = (ranged[0] && ranged[0].o.gap.ex) || rangeExercise(first.r);
      const agg = first.gap.agg;
      const named = subs.length > 1 || (c.kind === 'jc' && subs[0].label && JC_COLS.indexOf(subs[0].label) < 0);
      const list = named ? ranged.map(function (sb) { return sb.label + ' ' + rangeText(sb.o.gap.range); }).join(', ') : (ranged[0] ? rangeText(ranged[0].o.gap.range) : '');
      const est = ranged.some(function (sb) { return sb.o.gap.est; });
      const basis = (ranged.filter(function (sb) { return sb.o.gap.est; })[0] || { o: { gap: { est: {} } } }).o.gap.est.basis;
      f.range = list ? (est ? STRINGS.estShare(agg, list, basis) : ex + ' ' + agg + ' net aggregate: ' + list) : (subs.some(function (sb) { return sb.o.gap.noFig; }) ? STRINGS.noFigure + '.' : STRINGS.rangeNone(ex, agg));
      // in the table cell each "stream range" pair stays on one line
      const cellList = named ? ranged.map(function (sb) { return sb.label + '\u00a0' + rangeText(sb.o.gap.range); }).join(', ') : list;
      f.rangeCell = list ? agg + ': ' + cellList + (est && basis === 'olevel' ? ' ' + STRINGS.estFrom('olevel') : '') : (subs.some(function (sb) { return sb.o.gap.noFig; }) ? STRINGS.noFigure : STRINGS.rangeNone('', agg));
      // on screen, the range and one indicative tag (its words say where the range comes from)
      f.cellText = list ? agg + ': ' + cellList : f.rangeCell; f.tip = list ? tipFor(ranged[0].o.gap) : '';
      const lead = subs.map(function (sb) { return sb.o; }).filter(function (o) { return o.net.value != null && o.state !== 'no'; })[0] || subs.map(function (sb) { return sb.o; }).filter(function (o) { return o.net.value != null; })[0];
      // a course with no 2026 figure has no gap to show, so (as before) no net line: the header already says the net
      if (lead && (list || !subs.some(function (sb) { return sb.o.gap.noFig; }))) {
        const gaps = subs.filter(function (sb) { return sb.o.gap.n != null && sb.o.state !== 'no'; });
        f.pills = gaps.map(function (sb) { return { label: named ? sb.label : '', g: sb.o.gap }; });
        f.same = gaps.length === subs.length ? sameGap(c, subs.map(function (sb) { return sb.o; })) : null;
        // the shared text keeps K7's form, one gap per stream: "(Arts −6, Science −6)"
        f.net = STRINGS.yourNetAgg(lead.net.value) + (lead.net.marks || '') + (!gaps.length ? '' : ' (' + gaps.map(function (sb) { return (named ? sb.label + ' ' : '') + signed(sb.o.gap.n); }).join(', ') + ')');
        f.netValue = String(lead.net.value) + (lead.net.marks || '');
      }
    }
    subs.forEach(function (sb) {
      const o = sb.o, pre = subs.length > 1 ? sb.label + ': ' : '';
      if (o.state === 'cond') f.state.push(STRINGS.condLine(pre + reason(o, 'cond')));
      if (o.state === 'unsure') f.state.push(STRINGS.unsureLine(WHERE[c.where].unsure));
    });
    if (allNo) f.state.push(STRINGS.cantLine(c.kind === 'jc' || c.kind === 'course' || c.kind === 'ite' || c.kind === 'pfp' ? reason(first, false) || STRINGS.state.no : STRINGS.state.no));
    return f;
  }
  function itemNotes(items) {
    const notes = [];
    items.forEach(function (x) { x.subs.forEach(function (sb) { if (sb.o.state !== 'no') (sb.o.net.notes || []).forEach(function (n) { if (/^[¹²]/.test(n) && notes.indexOf(n) < 0) notes.push(n); }); }); });
    // ¹ before ², by number ("²" sorts before "¹" as a string)
    const rank = function (t) { return '¹²³'.indexOf(t.charAt(0)); };
    return notes.sort(function (a, b) { return rank(a) - rank(b) || (a < b ? -1 : 1); });
  }
  // ONE renderer for "your net aggregate" and its pills, on the laptop table and the phone cards: the
  // number, then a stream | pill grid; with no stream names, the pill sits right beside the number
  // the range as Starred shows it: the text and one tag
  function cellHTML(f) { return (f.cellText ? nw(esc(f.cellText)) : '') + (f.tip ? (f.cellText ? ' ' : '') + indTagHTML(f.tip, f.tipLabel) : ''); }
  function netPillsHTML(f, wide) {
    if (f.same) {
      const one = '<span class="pl">' + pillHTML(f.same.gap, '') + '</span> ' + esc(STRINGS.allStreams(f.same.count));
      if (wide) return (f.netValue ? '<b class="cmp-n">' + esc(f.netValue) + '</b>' : '') + one;
      return f.net ? '<div class="nline">' + esc(f.net.replace(/ \(.*\)$/, '')) + ' ' + one + '</div>' : '';
    }
    const lab = f.pills.some(function (q) { return q.label; });
    const pills = f.pills.map(function (q, i) {
      return (lab ? '<span class="gap-l" data-wc="0">' + esc(q.label || '') + '</span>' : '') + '<span class="pl">' + pillHTML(q.g, '') + '</span>';
    }).join('');
    const grid = f.pills.length ? (lab ? '<span class="cmp-grid">' + pills + '</span>' : ' ' + pills) : '';
    if (wide) { const n = (f.netValue ? '<b class="cmp-n' + (lab ? '' : ' inl') + '">' + esc(f.netValue) + '</b>' : '') + grid; return lab ? n : '<span class="nw">' + n + '</span>'; }  // "13 +16" on one line
    return f.net ? '<div class="nline">' + esc(f.net.replace(/ \(.*\)$/, '')) + (lab ? '' : grid) + '</div>' + (lab ? grid : '') : '';
  }
  function starredHTML() {
    const items = compareItems(true);
    const wide = isWide();
    let h = '<div class="panel-head"><h2 class="panel-h" tabindex="-1">' + esc(wide ? STRINGS.starredHeadWide : STRINGS.starredHead) + ' ' + countHTML(items.length) + '</h2>' +
      (items.length ? '<button type="button" class="btn btn-share" data-do="share">' + esc(STRINGS.share(items.length)) + '</button>' : '') + '</div>';
    if (!items.length) return h + '<p class="empty-note">' + esc(STRINGS.starredEmpty) + '</p>';
    const stateLines = function (f) { return f.state.map(function (t) { return '<p class="hint st-line">' + esc(t) + '</p>'; }).join(''); };
    if (wide) {
      // K7: the same three facts as the shared text: course · 2026 net aggregate range · your net aggregate with the pill
      h += '<table class="cmp"><thead><tr><th scope="col">' + esc(STRINGS.cols.course) + '</th><th scope="col">' + esc(STRINGS.colRange()) + '</th><th scope="col">' + esc(STRINGS.colNet) +
        '</th><th scope="col"><span class="sr-only">' + esc(STRINGS.cols.link) + '</span></th><th scope="col"><span class="sr-only" data-wc="0">Star</span></th></tr></thead><tbody>' +
        items.map(function (x) {
          const f = itemFacts(x);
          return '<tr><td><a href="#course-' + x.c.id + '"><strong data-wc="0">' + esc(x.title) + '</strong></a>' + (x.inst ? ' <span class="quiet" data-wc="0">' + esc(x.inst) + '</span>' : '') + stateLines(f) + '</td>' +
            // the number on its own line, then a stream | pill grid, so every pill sits at one x
            '<td class="cmp-rng">' + cellHTML(f) + '</td><td class="cmp-net">' + netPillsHTML(f, true) + '</td>' +
            '<td class="cmp-link">' + ext(x.link, '↗', '', x.linkLabel) + '</td><td>' + starBtn(x.c) + '</td></tr>';
        }).join('') + '</tbody></table>';
    } else {
      h += '<div class="cmp-list">' + items.map(function (x) {
        const f = itemFacts(x);
        return '<div class="cmp-card"><a class="cc-title" href="#course-' + x.c.id + '" data-wc="0">' + esc(x.title) + '</a>' + (x.inst ? '<p class="cc-inst" data-wc="0">' + esc(x.inst) + '</p>' : '') +
          (f.cellText || f.tip ? '<p class="rline">' + cellHTML(f) + '</p>' : '') + netPillsHTML(f, false) + stateLines(f) +
          '<p class="links">' + ext(x.link, x.linkLabel) + '</p>' + starBtn(x.c) + '</div>';
      }).join('') + '</div>';
    }
    h += itemNotes(items).map(function (n) { return '<p class="hint">' + esc(n) + '</p>'; }).join('');
    return h;
  }
  function shareText() {
    const items = compareItems();
    const lines = [STRINGS.shareHead];
    items.forEach(function (x, i) {
      const f = itemFacts(x);
      lines.push('');
      lines.push((i + 1) + '. ' + x.title + (x.inst && x.c.kind !== 'jc' && x.inst !== 'ITE' ? ', ' + x.inst : ''));
      if (f.range) lines.push(f.range);
      if (f.net) lines.push(f.net);
      f.state.forEach(function (t) { lines.push(t); });
      itemNotes([x]).forEach(function (n) { lines.push(n); });
      if (x.link) lines.push(x.link);
    });
    return lines.join('\n');
  }
  function offerText(o, c) {
    if (c.kind === 'arts') return o.arts.state === 'meets' ? STRINGS.state.meets : o.arts.state === 'below' ? STRINGS.state.below : STRINGS.checkWith(o.arts.who);
    return gapText(o.gap);
  }

  /* ================================================================================================ Key dates (D14) */
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function dm(d) { return Number(d.slice(8, 10)) + ' ' + MON[Number(d.slice(5, 7)) - 1]; }
  function whenText(start, end) {
    if (start && end) {
      if (start === end) return dm(start);
      if (start.slice(0, 7) === end.slice(0, 7)) return Number(start.slice(8, 10)) + '–' + dm(end);
      return dm(start) + ' – ' + dm(end);
    }
    if (start) return STRINGS.from(dm(start));
    if (end) return 'By ' + dm(end);
    return '';
  }
  function cleanWhen(t) {
    let s = String(t || '').split(';')[0].split(' -- ')[0].split(' (')[0];
    s = s.split(': ')[0].trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }
  const WHEN_OVERRIDE = { 'AI-EAE-2028': 'LASALLE in May, NAFA in June' };
  function resolveItem(a) {
    if (!a) return null;
    let start = '', end = '', basis = 'confirmed', tentative = false, monthOnly = false, when = '', src = '';
    if (a.fill) {
      const f = (CAL.fills || []).filter(function (x) { return x.exercise_id === a.ex && String(x.phase_prefix || '').indexOf(a.fill) === 0 && (!a.note || a.note.test(x.note || '')); })[0];
      if (f) { start = f.date_start || ''; end = f.date_end || ''; basis = f.basis || 'confirmed'; src = f.source || ''; if (basis === 'month_only') { monthOnly = true; when = cleanWhen(f.note); } }
    }
    if (!start && !end && !monthOnly && a.phase) {
      const row = (CAL.rows || []).filter(function (x) { return x.exercise_id === a.ex && x.phase === a.phase && (!a.pick || a.pick.test(x.date_text || '')); })[0];
      if (row) {
        start = row.date_start || ''; end = row.date_end || ''; src = String(row.source_url || '').split(' ; ')[0];
        tentative = /tentative/i.test(row.date_text || '');
        if (!start && !end) { monthOnly = true; when = WHEN_OVERRIDE[a.ex] || cleanWhen(row.date_text); }
      }
    }
    if (!start && !end && !monthOnly) return null;
    if (monthOnly && !when) return null;

    const placeDate = monthOnly ? (a.month ? a.month + '-01' : (end || start)) : (start || end);
    if (!placeDate) return null;
    const month = placeDate.slice(0, 7);
    const t = today();
    let closed;
    if (monthOnly) closed = month < t.slice(0, 7);
    else if (start && !end) closed = !a.open && start < t;
    else closed = (end || start) < t;
    let whenY = when;
    if (!monthOnly) {
      const pre = basis === 'inferred' ? STRINGS.expected + ' ' : '', post = tentative && basis !== 'inferred' ? ' (' + STRINGS.tentative + ')' : '';
      when = pre + whenText(start, end) + post;
      whenY = pre + whenText(start, end) + ' ' + month.slice(0, 4) + post;
    }
    return { a: a, title: a.title, fam: a.fam, start: start, end: end, basis: basis, monthOnly: monthOnly, when: when, whenY: whenY, month: month, year: month.slice(0, 4),
      sort: placeDate, closed: closed, src: src, apply: !!a.apply };
  }
  function agendaItems(all) {
    const who = S.year === 2027 ? ['SEC'] : levelsLive();
    const sc = scope();
    return AGENDA.filter(function (a) {
      if (all) return true;
      return a.who.some(function (w) { return who.indexOf(w) >= 0; }) && (!a.where.length || a.where.some(function (w) { return sc.indexOf(w) >= 0; }));
    }).map(resolveItem).filter(Boolean).sort(function (x, y) { return x.sort < y.sort ? -1 : x.sort > y.sort ? 1 : 0; });
  }
  // D6: "Next:" = the first open or upcoming application step (open windows first)
  // the "Next:" line names the route in words, not only its code
  const NEXT_WORDS = { 'DPP-2027': 'Apply for DPP (to poly through ITE)', 'PFP-2027': 'Apply for PFP (a foundation year at a poly)' };
  const NEXT_PAIR = { 'DPP-2027': 'PFP-2027', 'PFP-2027': 'DPP-2027' };
  const NEXT_SHORT = { 'DPP-2027': 'DPP (to poly through ITE)', 'PFP-2027': 'PFP' };
  function nextStep() {
    if (!S.year) return null;
    const items = agendaItems(false).filter(function (i) { return !i.closed; });
    if (S.year === 2027) return items.filter(function (i) { return i.fam === 'pse' || i.fam === 'exam'; })[0] || items[0] || null;
    const apply = items.filter(function (i) { return i.apply; });
    const t = today();
    const openNow = apply.filter(function (i) { return i.start && i.start <= t; });
    return openNow[0] || apply[0] || items[0] || null;
  }
  const FAM_ORDER = ['jae', 'pse', 'dpp', 'jie', 'pfp', 'arts', 'eae', 'dsa'];
  // each exercise keeps one colour whatever else is on screen. Only three hues clear the colour-blind
  // check in both themes, so the three main exercises take them; the others are grey outlines told apart by their
  // name tag; families that draw no stripe of their own (PSE, exams) stay plain grey.
  const FAM_HUE = { jae: 'jae', jie: 'jie', dpp: 'dpp' };
  function famColours() {
    const out = {};
    FAM_ORDER.forEach(function (f) { if (f !== 'pse') out[f] = FAM_HUE[f] ? { hue: FAM_HUE[f], outline: false } : { hue: 'n', outline: true }; });
    return out;
  }
  function bandsFor(month) {
    const out = [];
    const m0 = month + '-01', m1 = month + '-31';
    (CAL.terms || []).forEach(function (t) {
      if (!/MK, Primary & Secondary/.test(t.name || '')) return;
      const name = String(t.name).replace(/\s*\(MK, Primary & Secondary\)/, '');
      if (t.kind === 'holiday' && t.date_start <= m1 && t.date_end >= m0) out.push({ kind: 'band', name: name, when: whenText(t.date_start, t.date_end), sort: t.date_start < m0 ? m0 : t.date_start });
      if (t.kind === 'term' && t.date_start >= m0 && t.date_start <= m1) {
        const n = /Term (\d)/.exec(name);
        out.push({ kind: 'term', name: n ? STRINGS.termStarts(n[1]) : name, when: dm(t.date_start), sort: t.date_start });
      }
    });
    return out;
  }
  function agendaItemHTML(i, col) {
    if (i.kind === 'band') return '<li class="ag-band"><span class="ag-title">' + esc(i.name) + '</span> <span class="ag-when">' + esc(i.when) + '</span></li>';
    if (i.kind === 'term') return '<li class="ag-term"><span class="ag-title">' + esc(i.name) + '</span> <span class="ag-when">' + esc(i.when) + '</span></li>';
    const c = col[i.fam];
    const stripe = i.monthOnly ? '' : '<span class="ag-stripe ' + (c ? 'ex-' + c.hue + (c.outline ? ' outline' : '') : 'ex-n') + (i.basis === 'inferred' ? ' dashed' : '') + '" aria-hidden="true"></span>';
    return '<li class="ag-item' + (i.monthOnly ? ' ag-label' : '') + '">' + stripe + '<div class="ag-body"><p class="ag-title">' + esc(i.title) +
      ' <span class="ag-fam">' + esc(FAMILY[i.fam].label) + '</span></p><p class="ag-when">' + esc(i.when) + '</p></div></li>';
  }
  function monthsHTML(items, col, withBands) {
    const months = [];
    items.forEach(function (i) { if (months.indexOf(i.month) < 0) months.push(i.month); });
    return '<div class="ag-months">' + months.map(function (m) {
      const rows = items.filter(function (i) { return i.month === m; }).map(function (i) { return Object.assign({ kind: 'item' }, i); });
      const all = (withBands ? bandsFor(m) : []).concat(rows).sort(function (x, y) { return x.sort < y.sort ? -1 : x.sort > y.sort ? 1 : (x.kind === 'band' ? -1 : 1); });
      return '<section class="ag-month"><h3 class="ag-mh">' + MONTH_FULL[Number(m.slice(5, 7)) - 1] + ' ' + m.slice(0, 4) + '</h3><ul>' + all.map(function (i) { return agendaItemHTML(i, col); }).join('') + '</ul></section>';
    }).join('') + '</div>';
  }
  function datesHTML() {
    const items = agendaItems(S.allEx);
    const col = famColours(items);
    const open = items.filter(function (i) { return !i.closed; }), closed = items.filter(function (i) { return i.closed; });
    let h = '<div class="panel-head"><h2 class="panel-h">' + esc(STRINGS.datesHead) + '</h2>' +
      segHTML('allex', [['me', STRINGS.forMe], ['all', STRINGS.allEx]], S.allEx ? 'all' : 'me', { label: STRINGS.exWhich }) + '</div>';
    // the legend only when bars are on screen, and only the lines for the bars shown
    const bars = items.filter(function (i) { return !i.monthOnly; });
    const lg = [];
    if (bars.some(function (i) { return i.basis !== 'inferred'; })) lg.push(STRINGS.legendSolid);
    if (bars.some(function (i) { return i.basis === 'inferred'; })) lg.push(STRINGS.legendDashed);
    if (bars.some(function (i) { return col[i.fam] && col[i.fam].outline; })) lg.push(STRINGS.legendOutline);
    if (lg.length) h += '<p class="hint ag-legend">' + lg.map(esc).join('<br>') + '</p>';
    if (!open.length) h += '<p class="empty-note">' + esc(STRINGS.nothingDated) + '</p>';
    else h += monthsHTML(open, col, true);
    if (closed.length) h += '<details class="fold-s closed"' + keep('closed') + '><summary>' + esc(STRINGS.closed(closed.length)) + '</summary>' + monthsHTML(closed, col, false) + '</details>';
    const srcs = [];
    items.forEach(function (i) { if (i.src && /^https?:/.test(i.src) && srcs.indexOf(i.src) < 0) srcs.push(i.src); });
    srcs.push('https://www.moe.gov.sg/news/press-releases/20260714-school-terms-and-holidays-for-2027');
    h += '<details class="fold-s"' + keep('dsrc') + '><summary>' + esc(STRINGS.sources) + '</summary><ul class="src-list">' + srcs.map(function (u) {
      return '<li>' + ext(u, u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')) + '</li>';
    }).join('') + '</ul></details>';
    return h;
  }

  /* ================================================================================================ the map (D17, the panel) */
  // MOE's and the schools' usual short forms
  const INST_SHORT = { 'Anderson Serangoon Junior College': 'ASRJC', 'Anglo-Chinese Junior College': 'ACJC', 'Anglo-Chinese School (Independent) (Junior College)': 'ACS(I)',
    'Catholic Junior College': 'CJC', 'Dunman High School (Junior College)': 'DHS', 'Eunoia Junior College': 'EJC', 'Hwa Chong Institution (Junior College)': 'HCI',
    'Jurong Pioneer Junior College': 'JPJC', 'Millennia Institute': 'MI', 'Nanyang Junior College': 'NYJC', 'National Junior College': 'NJC',
    'Raffles Institution (Junior College)': 'RI', 'River Valley High School (Junior College)': 'RVHS', "St Andrew's Junior College": 'SAJC',
    "St. Joseph's Institution (Junior College)": 'SJI', 'Tampines Meridian Junior College': 'TMJC', 'Temasek Junior College': 'TJC', 'Victoria Junior College': 'VJC',
    'Yishun Innova Junior College': 'YIJC', 'Nanyang Polytechnic': 'NYP', 'Singapore Polytechnic': 'SP', 'Ngee Ann Polytechnic': 'NP', 'Republic Polytechnic': 'RP',
    'Temasek Polytechnic': 'TP', 'ITE College Central': 'ITE Central', 'ITE College East': 'ITE East', 'ITE College West': 'ITE West' };
  function mapHTML() {
    const counts = {}, present = {};
    const cards = (CARDS || []).filter(function (c) { return inScope(c.where) && matchesFilters(c, true); });
    cards.forEach(function (c) {
      c.insts.forEach(function (inst) { present[inst] = true; if (canApply(c)) counts[inst] = (counts[inst] || 0) + 1; });
    });
    const dots = INSTITUTIONS.filter(function (i) { return present[i.name]; });
    const rings = (PAGE.coast && PAGE.coast.rings) || [];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const k = Math.cos(1.35 * Math.PI / 180);
    function P(lng, lat) { return [(lng - 103.6) * k * 1000, (1.48 - lat) * 1000]; }
    rings.forEach(function (ring) { ring.forEach(function (pt) { const p = P(pt[0], pt[1]); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }); });
    if (!isFinite(x0)) { x0 = 0; x1 = 400; y0 = 0; y1 = 250; }
    const pad = 6;
    const vb = [x0 - pad, y0 - pad, (x1 - x0) + 2 * pad, (y1 - y0) + 2 * pad].map(function (v) { return v.toFixed(1); }).join(' ');
    const land = rings.map(function (ring) {
      return '<path d="M' + ring.map(function (pt) { const p = P(pt[0], pt[1]); return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join('L') + 'Z"/>';
    }).join('');
    const browse = S.year === 2027;
    const marks = dots.map(function (d) {
      const p = P(d.lng, d.lat);
      const n = counts[d.name] || 0;
      const t = browse ? STRINGS.mapDotBrowse(d.name) : STRINGS.mapDot(d.name, n);
      return '<g class="dot dot-' + d.type.toLowerCase() + (n || browse ? '' : ' hollow') + (S.insts.indexOf(d.name) >= 0 ? ' on' : '') + '" data-do="map-dot" data-v="' + esc(d.name) +
        '" tabindex="0" role="button" aria-pressed="' + (S.insts.indexOf(d.name) >= 0) + '" aria-label="' + esc(t) + '"><title>' + esc(t) + '</title><circle class="hit" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) +
        '" r="16"/>' + (d.type === 'MI' ? '<rect class="mk" x="' + (p[0] - 7).toFixed(1) + '" y="' + (p[1] - 7).toFixed(1) + '" width="14" height="14" rx="2"/>'
          : '<circle class="mk" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="8"/>') + '</g>';
    }).join('');
    // short names on the dots, placed so no two overlap at the map's size on screen; a name with no
    // free place shows once its dot is picked (tap), and every name is in the list under the map
    const vbW = (x1 - x0) + 2 * pad;
    const pane = $(isWide() ? '#s-pane' : '#main');
    const shownW = Math.max(280, ((pane && pane.clientWidth) || window.innerWidth) - 2 * 16);
    const u = vbW / shownW;  // map units per screen pixel
    const fs = 11 * u, gap = 3 * u, boxes = [];
    dots.forEach(function (d) { const p = P(d.lng, d.lat); boxes.push([p[0] - 8, p[1] - 8, p[0] + 8, p[1] + 8]); });
    const hit = function (b) { return boxes.some(function (o) { return b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]; }); };
    const order = dots.slice().sort(function (a, b) { return (S.insts.indexOf(b.name) >= 0) - (S.insts.indexOf(a.name) >= 0) || (counts[b.name] || 0) - (counts[a.name] || 0) || (a.name < b.name ? -1 : 1); });
    const labels = order.map(function (d) {
      const p = P(d.lng, d.lat), t = INST_SHORT[d.name] || d.name, w = t.length * fs * 0.72 + gap, hgt = fs * 1.25;
      const spots = [[p[0] + 8 + gap, p[1] - hgt / 2, 'start'], [p[0] - 8 - gap - w, p[1] - hgt / 2, 'end'], [p[0] - w / 2, p[1] - 8 - gap - hgt, 'middle'], [p[0] - w / 2, p[1] + 8 + gap, 'middle']];
      const picked = S.insts.indexOf(d.name) >= 0;
      for (let i = 0; i < spots.length; i++) {
        const b = [spots[i][0], spots[i][1], spots[i][0] + w, spots[i][1] + hgt];
        if (!hit(b) || (picked && i === spots.length - 1)) {
          boxes.push(b);
          const x = spots[i][2] === 'start' ? b[0] : spots[i][2] === 'end' ? b[2] : (b[0] + b[2]) / 2;
          return '<text class="lbl' + (picked ? ' on' : '') + '" x="' + x.toFixed(1) + '" y="' + (b[1] + hgt * 0.8).toFixed(1) + '" text-anchor="' + spots[i][2] + '" font-size="' + fs.toFixed(1) + '" stroke-width="' + (3 * u).toFixed(1) + '">' + esc(t) + '</text>';
        }
      }
      return '';
    }).join('');
    const types = ['JC', 'MI', 'Poly', 'ITE'].filter(function (t) { return dots.some(function (d) { return d.type === t; }); });
    const visible = (CARDS || []).filter(function (c) { return inScope(c.where) && matchesFilters(c) && c.state !== 'no'; }).length;
    let h = backHTML() + '<div class="panel-head"><h2 class="panel-h">' + esc(STRINGS.mapHead) + '</h2><a class="btn" href="#courses" data-do="back">' + esc(STRINGS.mapList(visible)) + '</a></div>';
    h += '<svg class="map" viewBox="' + vb + '" role="group" aria-label="Map of Singapore with the institutions"><g class="land">' + land + '</g>' + marks + '<g class="lbls" aria-hidden="true">' + labels + '</g></svg>';
    h += '<ul class="legend">' + types.map(function (t) { return '<li><span class="lg lg-' + t.toLowerCase() + '"></span>' + esc(STRINGS.mapType[t]) + '</li>'; }).join('') +
      (browse ? '' : '<li><span class="lg lg-hollow"></span>' + esc(STRINGS.mapNone) + '</li>') + '</ul>';
    h += '<p class="hint">' + esc(STRINGS.mapTap) + '</p><ul class="inst-list">' +
      dots.slice().sort(function (a, b) { return (!counts[a.name]) - (!counts[b.name]) || (a.name < b.name ? -1 : 1); }).map(function (d) {
        const n = counts[d.name] || 0, on = S.insts.indexOf(d.name) >= 0;
        return '<li><button type="button" class="inst-btn' + (on ? ' on' : '') + '" data-do="map-dot" data-v="' + esc(d.name) + '" aria-pressed="' + on + '"><span data-wc="0">' + esc(d.name) + '</span>' +
          (browse ? '' : '<span class="count">' + n + '</span>') + '</button></li>';
      }).join('') + '</ul>';
    h += '<p class="src">' + esc((PAGE.coast && PAGE.coast.credit) || '') + '.</p><p class="src">' + esc(STRINGS.mapLocations) + '</p>';
    return h;
  }

  /* ================================================================================================ footer (D16) */
  // About, one place for what the footer said on every tab, MOE's table and note, and the sources
  function aboutHTML() {
    return '<section class="ab"><h3 class="fs-h">' + esc(STRINGS.aboutApp) + '</h3><p>' + esc(STRINGS.aboutAppLine) + '</p></section>' +
      '<section class="ab about"><h3 class="fs-h">' + esc(STRINGS.about) + '</h3>' + STRINGS.aboutParas.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + (S.year === 2027 ? '<p>' + esc(STRINGS.aboutEst) + '</p>' : '') +
      '<blockquote>' + esc(STRINGS.caution) + '</blockquote><p class="src">' + ext(STRINGS.cautionUrl, STRINGS.cautionSrc) + '</p>' +
      STRINGS.aboutLines.slice(1).map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + moeLinkHTML() + '</section>' +
      '<section class="ab"><h3 class="fs-h">' + esc(STRINGS.aboutResults) + '</h3><p>' + esc(STRINGS.saved) + '.</p></section>' +
      '<section class="ab"><h3 class="fs-h">' + esc(STRINGS.sources) + '</h3><p class="src">' + esc(STRINGS.aboutSources) + '</p></section>';
  }

  /* ================================================================================================ sheets: filters, sort, share, confirm, routes */
  const SHEET = { kind: '', sel: '', scope: '' };
  const PICK_NONE = {};  // K6: "None" pressed in a section's checklist (shows all until one is ticked)
  function openSheet(kind, trigger) {
    SHEET.kind = kind;
    SHEET.sel = trigger && trigger.dataset && trigger.dataset.do ? '[data-do="' + trigger.dataset.do + '"]' + (trigger.dataset.v ? '[data-v="' + trigger.dataset.v + '"]' : '') : '';
    SHEET.scope = trigger && trigger.dataset ? trigger.dataset.v || '' : '';
    if (!SHEET.pushed) { try { history.pushState({ sheet: 1 }, '', location.hash); SHEET.pushed = true; } catch (e) { SHEET.pushed = false; } }
    renderSheet(true);
  }
  function closeSheet(fromBack) {
    const sel = SHEET.sel;
    SHEET.kind = ''; SHEET.sel = '';
    renderSheet();
    if (SHEET.pushed) { SHEET.pushed = false; if (!fromBack) history.back(); }
    const t = sel && $(sel);
    if (t) t.focus();
  }
  function instSheetHTML() {
    const cards = [];
    scope().forEach(function (w) { shownCards(w).forEach(function (c) { if (matchesFilters(c, true)) cards.push(c); }); });
    const by = {};
    const types = scope().map(function (w) { return WHERE[w].type; });
    cards.forEach(function (c) {
      c.insts.forEach(function (i) { const type = instType(i, c.where); if (types.indexOf(type) < 0) return; by[type] = by[type] || {}; by[type][i] = (by[type][i] || 0) + (cardInReach(c) ? 1 : 0); });
    });
    liveInsts().forEach(function (i) { let found = false; Object.keys(by).forEach(function (t) { if (by[t][i] != null) found = true; }); if (!found) { by.Other = by.Other || {}; by.Other[i] = 0; } });
    // a group whose every count is 0 comes last; a 0 is not printed (its name stays grey, a screen reader still hears it)
    const live = function (t) { return Object.keys(by[t]).some(function (i) { return by[t][i] > 0; }); };
    return ['JC', 'MI', 'Polytechnic', 'ITE', 'Arts', 'Other'].filter(function (t) { return by[t]; }).sort(function (a, b) { return S.year === 2026 ? live(b) - live(a) : 0; }).map(function (t) {
      return '<fieldset class="inst-group"><legend>' + esc(STRINGS.instTypes[t] || t) + '</legend><ul class="checklist">' + Object.keys(by[t]).sort(function (a, b) { return (by[t][b] > 0) - (by[t][a] > 0) || (a < b ? -1 : 1); }).map(function (i) {
        const id = 'inst-' + hash36(i);
        return '<li' + (S.year === 2026 && !by[t][i] ? ' class="zero"' : '') + '><input type="checkbox" id="' + id + '" data-change="inst" data-v="' + esc(i) + '"' + (S.insts.indexOf(i) >= 0 ? ' checked' : '') + '><label for="' + id + '"><span data-wc="0">' + esc(i) + '</span>' +
          (S.year === 2027 ? '' : ' <span class="count' + (by[t][i] ? '' : ' sr-only') + '">' + by[t][i] + '</span>') + '</label></li>';
      }).join('') + '</ul></fieldset>';
    }).join('');
  }
  function renderSheet(focusFirst) {
    const el = $('#sheet'), scrim = $('#scrim');
    if (!el) return;
    const k = SHEET.kind;
    document.body.classList.toggle('sheet-on', !!k);
    if (!k) { el.hidden = true; el.innerHTML = ''; el.className = 'sheet'; el.removeAttribute('style'); scrim.hidden = true; return; }
    let head = '', body = '';
    if (k === 'field') { head = STRINGS.sheetFields; body = fieldChecklistHTML(); }
    // one Filter sheet with the Field and Institution pickers; D: About
    else if (k === 'filter') { head = STRINGS.chip.filter; body = (fieldList().length ? '<h3 class="fs-h">' + esc(STRINGS.chip.field) + '</h3>' + fieldChecklistHTML() : '') + '<h3 class="fs-h">' + esc(STRINGS.chip.inst) + '</h3>' + instSheetHTML(); }
    else if (k === 'about') { head = STRINGS.aboutHead; body = aboutHTML(); }
    else if (k === 'inst') { head = STRINGS.sheetInst; body = instSheetHTML(); }
    else if (k === 'secinst') {
      const wid = SHEET.scope, all = instsOf(wid), mine = instFilterFor(wid), st = jcSortStream();
      const cut = function (i) {
        if (wid !== 'jc' && wid !== 'mi') return null;
        const c = cardsIn(wid).filter(function (x) { return x.insts.indexOf(i) >= 0; })[0];
        const o = c && streamOffer(c, st);
        return o && o.gap.range ? o.gap.range[1] : null;
      };
      const list = all.slice().sort(function (a, b) { const x = cut(a), y = cut(b); return (x == null ? 99 : x) - (y == null ? 99 : y) || (a < b ? -1 : 1); });
      head = WHERE[wid].label;
      body = '<div class="sheet-acts sheet-acts-top"><button type="button" class="btn" data-do="secinst-all" data-v="' + wid + '">' + esc(STRINGS.allWord) + '</button><button type="button" class="btn" data-do="secinst-none" data-v="' + wid + '">' + esc(STRINGS.noneWord) + '</button></div>' +
        '<ul class="checklist">' + list.map(function (i) {
          const id = 'si-' + hash36(i), on = mine.length ? mine.indexOf(i) >= 0 : !PICK_NONE[wid], cv = cut(i);
          return '<li><input type="checkbox" id="' + id + '" data-change="secinst" data-w="' + wid + '" data-v="' + esc(i) + '"' + (on ? ' checked' : '') + '><label for="' + id + '"><span data-wc="0">' + esc(i) + '</span>' +
            (cv != null ? ' <span class="count">' + esc(st + ' ' + cv) + '</span>' : '') + '</label></li>';
        }).join('') + '</ul>';
    } else if (k === 'sort') {
      head = STRINGS.sheetSort;
      body = '<ul class="radios">' + sortOptions().map(function (o) {
        return '<li><button type="button" class="radio" data-do="sort-pick" data-v="' + o + '" aria-pressed="' + (sortKey() === o) + '"><span class="rd" aria-hidden="true"></span>' + esc(STRINGS.sorts[o]) + '</button></li>';
      }).join('') + '</ul>';
    } else if (k === 'share') {
      head = STRINGS.share(starredCards().length);
      const text = shareText();
      body = '<textarea id="share-text" class="share-text" rows="8" readonly data-wc="0">' + esc(text) + '</textarea><div class="sheet-acts">' +
        '<button type="button" class="btn-primary" data-do="copy">' + esc(STRINGS.copy) + '</button>' +
        '<a class="btn" href="https://wa.me/?text=' + encodeURIComponent(text) + '" target="_blank" rel="noopener">' + esc(STRINGS.whatsapp) + '</a>' +
        (navigator.share ? '<button type="button" class="btn" data-do="os-share">' + esc(STRINGS.osShare) + '</button>' : '') + '</div>';
    } else if (k === 'confirm') {
      head = STRINGS.restart;
      body = '<p>' + esc(STRINGS.confirm(S.stars.length)) + '</p><div class="sheet-acts"><button type="button" class="btn-primary btn-danger" data-do="confirm-clear">' + esc(STRINGS.clear) +
        '</button><button type="button" class="btn" data-do="sheet-close">' + esc(STRINGS.cancel) + '</button></div>' +
        (S.year ? '<div class="next-student"><button type="button" class="btn" data-do="next-student">' + esc(STRINGS.nextStudent) + '</button><p class="hint">' + esc(STRINGS.nextStudentHint(S.stars.length)) + '</p></div>' : '');
    } else if (k === 'route') {
      const rt = anotherRoutes();
      head = rt.length > 1 ? STRINGS.others : STRINGS.another;
      body = rt.map(function (key) {
        return '<section class="route"><h3 class="route-h">' + esc(ANOTHER[key].name) + '</h3>' + anotherText(key).map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') +
          '<p class="links">' + ext(ANOTHER[key].link.url, ANOTHER[key].link.label) + '</p></section>';
      }).join('');
    }
    const pop = isWide() && (k === 'field' || k === 'inst' || k === 'sort' || k === 'secinst' || k === 'filter');
    const done = (k === 'field' || k === 'inst' || k === 'route' || k === 'secinst' || k === 'filter') ? '<div class="sheet-acts"><button type="button" class="btn-primary" data-do="sheet-close">' + esc(STRINGS.done) + '</button></div>' : '';
    el.className = 'sheet' + (pop ? ' pop' : '') + ' sheet-' + k;
    el.innerHTML = '<div class="sheet-in" role="' + (k === 'confirm' ? 'alertdialog' : 'dialog') + '" aria-modal="true" aria-labelledby="sheet-h"><div class="sheet-head"><h2 id="sheet-h">' + esc(head) + '</h2>' +
      '<button type="button" class="btn-x" data-do="sheet-close" aria-label="' + esc(STRINGS.close) + '">×</button></div><div class="sheet-body">' + body + '</div>' + done + '</div>';
    el.hidden = false;
    scrim.hidden = false;
    el.removeAttribute('style');
    { const tt = $('#toast'); if (tt) tt.classList.remove('on'); }
    if (pop) {
      const t = SHEET.sel && $(SHEET.sel);
      if (t) {
        // the popover fits the screen: below the opener if it fits (or has more room), else above it;
        // its own scroll inside, with Done kept in view (sticky, CSS)
        const r = t.getBoundingClientRect(), vh = window.innerHeight, gap = 6, edge = 16;
        const w = Math.min(360, window.innerWidth - 32);
        el.style.left = Math.round(Math.max(16, Math.min(r.left, window.innerWidth - w - 16))) + 'px';
        el.style.width = w + 'px';
        const below = vh - r.bottom - gap - edge, above = r.top - gap - edge, want = Math.min(el.scrollHeight, vh * 0.6);
        if (below >= want || below >= above) { el.style.top = Math.round(r.bottom + gap) + 'px'; el.style.maxHeight = Math.round(Math.max(120, below)) + 'px'; }
        else { el.style.top = 'auto'; el.style.bottom = Math.round(vh - r.top + gap) + 'px'; el.style.maxHeight = Math.round(Math.min(above, vh * 0.6)) + 'px'; }
      }
    }
    if (focusFirst) { const f = k === 'confirm' ? el.querySelector('.sheet-acts [data-do="sheet-close"]') : k === 'about' ? el.querySelector('.sheet-head .btn-x') : el.querySelector('input:not([readonly]),button:not(.btn-x),a'); if (f) f.focus(); }  // never a textarea: on a phone, focusing it zooms the page
  }

  /* ================================================================================================ K9: motion
     every animation reads its duration from a token, is never longer than --dur-flip, eases out, and is off under
     prefers-reduced-motion (the CSS kill switch covers the CSS ones; calm covers these) */
  const MOTION = (function () {
    const cs = getComputedStyle(document.documentElement);
    const ms = function (n, d) { const v = parseFloat(cs.getPropertyValue(n)); return isNaN(v) ? d : v; };
    return { d1: ms('--dur-1', 100), d2: ms('--dur-2', 200), exit: ms('--dur-exit', 150), flip: ms('--dur-flip', 240),
      ease: cs.getPropertyValue('--ease-enter').trim() || 'ease-out', easeExit: cs.getPropertyValue('--ease-exit').trim() || 'ease-in' };
  })();
  function calm() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function anim(el, frames, dur, easing) {
    if (!el || !el.animate || calm()) return null;
    try { return el.animate(frames, { duration: Math.min(dur, MOTION.flip), easing: easing || MOTION.ease }); } catch (e) { return null; }
  }
  // a height change, from what it was to what it is now
  function grow(el, from) {
    if (!el || calm()) return;
    const to = el.offsetHeight;
    if (Math.abs(to - from) < 2) return;
    el.style.overflow = 'hidden';
    const a = anim(el, [{ height: from + 'px' }, { height: to + 'px' }], MOTION.flip);
    if (a) a.onfinish = a.oncancel = function () { el.style.overflow = ''; }; else el.style.overflow = '';
  }
  // once, a soft highlight on the row Next jumps to or a follow-up that just appeared
  function pulse(el) { if (!el || calm()) return; el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); setTimeout(function () { el.classList.remove('pulse'); }, MOTION.flip + 20); }
  // when a tile's number first appears or changes, the tile settles in and the number
  // counts up to it, all within --dur-flip. Nothing moves on its own, a tile whose number is unchanged stays still (Results
  // re-renders on every tap), and nothing moves under reduced motion. Results only: Courses shows the same numbers again
  let TILE_SEEN = {};
  function tileMotion() {
    const seen = {};
    $$('#aggs .tile').forEach(function (t, i) {
      const n = t.querySelector('.agg-n'), k = t.dataset.v, v = (n || t.querySelector('.t-r') || t).textContent;
      seen[k] = v;
      if (TILE_SEEN[k] === v || calm() || !t.animate) return;
      // one after another, a beat apart, the last one done by --dur-flip
      const beat = MOTION.flip / 8;
      try {
        t.animate([{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'scale(1.03)', offset: 0.7 }, { transform: 'none' }],
          { duration: MOTION.flip - 2 * beat, delay: Math.min(i, 2) * beat, easing: MOTION.ease, fill: 'backwards' });
      } catch (e) { /* an old browser: no motion */ }
      if (n && /^\d+$/.test(v)) countUp(n, /^\d+$/.test(TILE_SEEN[k] || '') ? Number(TILE_SEEN[k]) : 0, Number(v));
    });
    TILE_SEEN = seen;
  }
  // the number climbs (or drops) to its value. The page holds the value itself until a frame is drawn, so a page that draws no
  // frames (in the background) never shows a wrong number; the last frame, and a timer after it, write the value
  function countUp(el, a, b) {
    const raf = window.requestAnimationFrame;
    if (a === b || !raf || !window.performance) return;
    const t0 = performance.now(), end = String(b);
    const step = function (t) { const p = Math.min(1, Math.max(0, (t - t0) / MOTION.flip)); el.textContent = p >= 1 ? end : String(Math.round(a + (b - a) * p)); if (p < 1) raf(step); };
    raf(step);
    setTimeout(function () { el.textContent = end; }, MOTION.flip + MOTION.d1);
  }
  // the list before a change: where each card was and what each count said (FLIP)
  function snapList() {
    if (ROUTE.name === 'input' || calm()) return null;
    const pos = {}, counts = {};
    $$('#s-list .cc[data-key]').forEach(function (c) { pos[c.dataset.key] = c.getBoundingClientRect().top; });
    $$('#s-list [data-c]').forEach(function (c) { counts[c.dataset.c] = Number(c.dataset.n); });
    return { route: routeHash(ROUTE), pos: pos, counts: counts, any: Object.keys(pos).length > 0 };
  }
  function playList(snap) {
    if (!snap || snap.route !== routeHash(ROUTE) || ROUTE.name === 'input') return;
    const vh = window.innerHeight;
    if (snap.any) $$('#s-list .cc[data-key]').forEach(function (c) {
      const r = c.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      const was = snap.pos[c.dataset.key];
      if (was == null) { anim(c, [{ opacity: 0 }, { opacity: 1 }], MOTION.d2); return; }
      const dy = Math.max(-vh, Math.min(vh, was - r.top));
      if (Math.abs(dy) >= 1) anim(c, [{ transform: 'translateY(' + Math.round(dy) + 'px)' }, { transform: 'none' }], MOTION.flip);
    });
    $$('#s-list [data-c]').forEach(function (c) {
      const from = snap.counts[c.dataset.c], to = Number(c.dataset.n);
      if (from != null && from !== to) tick(c, from, to);
    });
  }
  // a count runs to its new number
  function tick(el, from, to) {
    if (calm() || !window.requestAnimationFrame) return;
    const t0 = performance.now();
    el.classList.add('ticking');
    const step = function (t) {
      const k = Math.min(1, (t - t0) / MOTION.flip);
      el.textContent = k < 1 ? Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))) : to;
      if (k < 1) requestAnimationFrame(step); else el.classList.remove('ticking');
    };
    requestAnimationFrame(step);
  }
  // a fold that just opened grows from nothing
  function playOpened() {
    if (!JUST_OPENED) return;
    JUST_OPENED = '';
    $$('.opening').forEach(function (el) { grow(el, 0); el.classList.remove('opening'); });
  }
  // a fold that is closing shrinks first, then the page re-renders
  function closeThen(el, fn) {
    if (!el || calm() || !el.animate) { fn(); return; }
    el.style.overflow = 'hidden';
    const a = anim(el, [{ height: el.offsetHeight + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], MOTION.exit, MOTION.easeExit);
    if (!a) { el.style.overflow = ''; fn(); return; }
    a.onfinish = fn;
  }

  /* ================================================================================================ the frame: router, header, render (D1) */
  let ROUTE = { name: 'input', id: '' };
  let FOCUS_AFTER = '';  // an element to focus once the new route has rendered
  let FOCUS_SCROLL = false;
  let JUST_OPENED = '';  // K9: the fold that just opened animates in once       // and whether to bring it into view (a pathway tap, a new group); never on Back
  let ORIGIN = 'courses';  // where Details was opened from (D25)
  const NAV = [];
  let LIST_Y = 0;
  function routeHash(r) { return r.name === 'course' ? 'course-' + r.id : r.name; }
  function parseHash(h) {
    const s = String(h || '').replace(/^#/, '');
    const m = /^course-([a-z0-9]+)$/.exec(s);
    if (m) return { name: 'course', id: m[1] };
    if (['input', 'courses', 'starred', 'dates', 'map'].indexOf(s) >= 0) return { name: s, id: '' };
    return { name: 'input', id: '' };
  }
  function go(hash, replace) {
    if (replace) { history.replaceState(null, '', '#' + hash); onRoute(); return; }
    if (location.hash === '#' + hash) { onRoute(); return; }
    location.hash = hash;
  }
  function goBack(fallback) {
    if (NAV.length >= 2 && NAV[NAV.length - 2] === '#' + fallback) history.back();
    else go(fallback);
  }
  const LIST_ROUTES = ['courses', 'course', 'starred', 'dates', 'map'];
  function onRoute() {
    const prev = ROUTE;
    if (/^#demo[-=]/.test(location.hash)) {
      const scr = applyDemo();
      if (scr) { changed(); history.replaceState(null, '', '#' + scr); }
    }
    let next = parseHash(location.hash);
    if (next.name !== 'input' && !S.year) { history.replaceState(null, '', '#input'); next = { name: 'input', id: '' }; }
    const h = '#' + routeHash(next);
    if (NAV.length >= 2 && NAV[NAV.length - 2] === h) NAV.pop(); else if (NAV[NAV.length - 1] !== h) NAV.push(h);
    if (!isWide() && prev.name === 'courses' && next.name !== 'courses') LIST_Y = window.scrollY;
    if (SHEET.kind) { SHEET.kind = ''; renderSheet(); }
    if (next.name === 'course' && prev.name !== 'course') ORIGIN = prev.name === 'starred' ? 'starred' : 'courses';
    ROUTE = next;
    render();
    if (!isWide()) {
      if (next.name === 'courses' && LIST_ROUTES.indexOf(prev.name) > 0) window.scrollTo(0, LIST_Y);
      else if (next.name !== prev.name || next.id !== prev.id) window.scrollTo(0, 0);
    } else {
      const pane = $('#s-pane');
      if (pane && (next.name !== prev.name || next.id !== prev.id)) pane.scrollTop = 0;
      if (prev.name === 'input' && next.name !== 'input') { const l = $('#s-list'); if (l) l.scrollTop = 0; }
      if (next.name === 'course') { const on = $('#s-list .cc.on'); if (on && on.scrollIntoView) { const lr = $('#s-list').getBoundingClientRect(), cr = on.getBoundingClientRect(); if (cr.top < lr.top || cr.bottom > lr.bottom) on.scrollIntoView({ block: 'nearest' }); } }
    }
    // fix 16: Details takes the focus on its heading; a return to the list goes back to the card
    if (next.name === 'course' && (prev.name !== 'course' || prev.id !== next.id)) { const t = $('#s-pane .det-title'); if (t) t.focus({ preventScroll: true }); }
    else if (next.name === 'courses' && prev.name === 'course' && !FOCUS_AFTER) FOCUS_AFTER = '.cc[data-id="' + prev.id + '"] .cc-main';
    focusAfter();
    toSec();
  }
  // B2: a pathway row lands on its own section inside the group (below the sticky header), not only on the group
  let PATH_SEC = '';
  function toSec() {
    const id = PATH_SEC;
    PATH_SEC = '';
    const el = id && document.getElementById('sec-' + id);
    if (!el || !el.previousElementSibling) return;
    const band = el.closest('.group') && el.closest('.group').querySelector('.g-band'), top = isWide() ? 0 : ($('.topbar') || {}).offsetHeight || 0;
    el.style.scrollMarginTop = (top + (band ? band.offsetHeight : 0)) + 'px';
    el.scrollIntoView({ block: 'start' });
  }
  window.addEventListener('hashchange', function () {
    const next = parseHash(location.hash), pane = $('#s-pane');
    if (!isWide() && ROUTE.name === 'course' && next.name !== 'course' && pane && !calm() && pane.animate) {
      const a = anim(pane, [{ transform: 'none' }, { transform: 'translateX(100%)' }], MOTION.exit, MOTION.easeExit);
      if (a) { a.onfinish = onRoute; return; }
    }
    onRoute();
  });
  function focusAfter() {
    if (!FOCUS_AFTER) return;
    const el = $(FOCUS_AFTER);
    const scroll = FOCUS_SCROLL;
    FOCUS_AFTER = ''; FOCUS_SCROLL = false;
    if (!el) return;
    if (scroll) el.scrollIntoView({ block: 'start' });
    el.focus({ preventScroll: true });
  }
  window.addEventListener('popstate', function () { if (SHEET.kind && SHEET.pushed) closeSheet(true); });
  // an icon on each tab, drawn in the tab's own colour (currentColor), hidden from
  // screen readers (the word says it)
  const TAB_ICON = {
    input: '<path d="M4 20h16M7 16v-5M12 16V6M17 16v-8"/>',
    courses: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.6" cy="6.5" r="1.3"/><circle cx="4.6" cy="12" r="1.3"/><circle cx="4.6" cy="17.5" r="1.3"/>',
    starred: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
    dates: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'
  };
  // D25: four sections, a tab bar at the bottom of a phone and in the header of a laptop
  function renderHeader() {
    const el = $('#tabs');
    if (!el) return;
    const cur = ROUTE.name === 'input' ? 'input' : ROUTE.name === 'starred' ? 'starred' : ROUTE.name === 'dates' ? 'dates' :
      ROUTE.name === 'course' && ORIGIN === 'starred' ? 'starred' : 'courses';
    const n = S.year ? starredCards().length : 0;
    el.innerHTML = ['input', 'courses', 'starred', 'dates'].map(function (k) {
      return '<a class="tab" href="#' + k + '"' + (k === cur ? ' aria-current="page"' : '') + '><svg class="tab-i" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        TAB_ICON[k] + '</svg><span>' + esc(STRINGS.tabs[k]) + '</span>' +
        (k === 'starred' && n ? '<span class="tab-n">' + n + '</span>' : '') + '</a>';
    }).join('');
    // on a laptop the toast sits in the header between the last tab and "Start again" / the i, never over a tab
    if (isWide()) { const t = el.lastElementChild; document.documentElement.style.setProperty('--toast-l', (t ? Math.ceil(t.getBoundingClientRect().right + gapPx()) : 0) + 'px'); }
  }
  function cardById(id) { return (CARDS || []).filter(function (c) { return c.id === id; })[0] || null; }
  function renderPane() {
    const el = $('#s-pane');
    if (!el) return;
    const keepTop = el.scrollTop;
    ensureR();
    let h = '';
    if (ROUTE.name === 'course') h = detailHTML(cardById(ROUTE.id));
    else if (ROUTE.name === 'dates') h = datesHTML();
    else if (ROUTE.name === 'map') h = mapHTML();
    else if (ROUTE.name === 'starred' || isWide()) h = starredHTML();
    el.innerHTML = h;  // no footer
    el.scrollTop = keepTop;
  }
  // the selector that finds an element again after a re-render
  function selOf(a) {
    if (!a || a === document.body) return '';
    if (a.id) return '#' + a.id;
    if (!a.dataset || !(a.dataset.do || a.dataset.change)) return '';
    let sel = a.dataset.do ? '[data-do="' + a.dataset.do + '"]' : '[data-change="' + a.dataset.change + '"]';
    ['v', 'row', 'key'].forEach(function (k) { if (a.dataset[k] != null) sel += '[data-' + k + '="' + String(a.dataset[k]).replace(/["\\]/g, '\\$&') + '"]'; });
    return sel;
  }
  let TAP_SEL = '';  // K9: the chip just tapped, so only it eases into its new state
  function keepFocus(fn) {
    const a = document.activeElement;
    const sel = selOf(a);
    const caret = a && typeof a.selectionStart === 'number' ? [a.selectionStart, a.selectionEnd] : null;
    fn();
    if (sel) {
      let b = null;
      try { b = document.querySelector(sel); } catch (e) { b = null; }
      if (b && b !== document.activeElement) {
        b.focus({ preventScroll: true });
        if (caret && typeof b.setSelectionRange === 'function') { try { b.setSelectionRange(caret[0], caret[1]); } catch (e) { /* type=search */ } }
      }
    }
  }
  let PANE_AT = '';
  function render() {
    if (S.calc && !allDone()) { S.calc = false; CARD_OPEN = false; }  // a subject cleared: the tiles go, "Calculate" returns
    ensureR(); unpickShut();  // a picked route that has closed is unpicked
    const snap = snapList();
    keepFocus(function () {
      document.body.dataset.route = ROUTE.name;
      if (ROUTE.name === 'input') { renderInput(); document.documentElement.style.setProperty('--sticky-h', '0px'); }
      else { renderList(); renderPane(); }
      renderHeader(); renderBar();
      if (SHEET.kind) renderSheet();
    });
    playList(snap);
    playOpened();
    if (TAP_SEL) { let b = null; try { b = document.querySelector(TAP_SEL); } catch (e) { b = null; } TAP_SEL = ''; if (b && b.getAttribute('aria-pressed') === 'true' && !calm()) { b.classList.add('tapped'); setTimeout(function () { b.classList.remove('tapped'); }, MOTION.d2 + 20); } }
    // K9: Details slides in from the right on a phone; on a laptop the right pane cross-fades
    const at = routeHash(ROUTE);
    if (PANE_AT && PANE_AT !== 'input' && at !== 'input' && at !== PANE_AT) {
      const pane = $('#s-pane');
      if (isWide()) anim(pane, [{ opacity: 0 }, { opacity: 1 }], MOTION.d2);
      else if (ROUTE.name === 'course') anim(pane, [{ transform: 'translateX(100%)' }, { transform: 'none' }], MOTION.flip);
    }
    PANE_AT = at;
    save();
  }
  function update(dataChanged) { if (dataChanged) { settleSlots(); changed(); } render(); }

  /* ================================================================================================ paste your results */
  function splitTop(text) {
    const out = [];
    let depth = 0, cur = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') depth += 1;
      if (ch === ')') depth = Math.max(0, depth - 1);
      if (depth === 0 && (ch === ',' || ch === ';' || ch === '\n')) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function readPaste(text) {
    const rows = [], unread = [];
    splitTop(text).forEach(function (part) {
      const m = /^(.+?)\s*[=:]\s*([A-Za-z0-9]+)\s*$/.exec(part) || /^(.+?)\s+([A-F][1-9]|[1-6]|[A-EU]|MERIT|PASS|UNGRADED)\s*$/i.exec(part);
      if (!m) { unread.push(part); return; }
      const name = m[1].trim();
      let grade = m[2].trim().toUpperCase();
      const cat = catalogueEntry(name);
      const level = levelFor(cat ? cat.name : name);
      const scale = LEVEL[level] ? LEVEL[level].scale : 'G3';
      if (cat && cat.kind === 'MTL_B') {
        const g = { M: 'Merit', MERIT: 'Merit', P: 'Pass', PASS: 'Pass', U: 'Ungraded', UNGRADED: 'Ungraded' }[grade];
        if (!g) { unread.push(part); return; }
        grade = g;
      } else {
        if (scale === 'G3' && /^[1-9]$/.test(grade)) grade = GRADE_ORDER.G3[Number(grade) - 1];
        if (scale === 'G3' && grade === 'F') grade = 'F9';
        if (scale === 'G2' && grade === 'U') grade = '6';
        if (scale === 'G1' && grade === 'U') grade = 'E';
        if ((GRADE_ORDER[scale] || []).indexOf(grade) < 0) { unread.push(part); return; }
      }
      rows.push({ name: cat ? cat.name : name, level: level, grade: grade });
    });
    return { rows: rows, unread: unread };
  }

  /* ================================================================================================ events */
  function snapshot() { return JSON.parse(JSON.stringify(S)); }
  // 2027 starts on Marks and 2026 on Grades; after that the page keeps the last choice for each year
  const MODE_KEY = 'rosetta-sg-pse-atlas-mode';
  function modeFor(y) {
    let m = '';
    try { m = (JSON.parse(localStorage.getItem(MODE_KEY) || '{}') || {})[y] || ''; } catch (e) { m = ''; }
    return m === 'mark' || m === 'grade' ? m : y === 2027 ? 'mark' : 'grade';
  }
  function rememberMode(y, m) {
    if (!y) return;
    try { const o = JSON.parse(localStorage.getItem(MODE_KEY) || '{}') || {}; o[y] = m; localStorage.setItem(MODE_KEY, JSON.stringify(o)); } catch (e) { /* private window */ }
  }
  function setYear(y) {
    if (S.year === y) return;
    const had = S.rows.some(function (r) { return r.grade || r.mark; });
    if (had) UNDO = snapshot();
    // nothing is preselected for the level; the subjects come with it (setLevel)
    S.year = y; S.level = null; S.mode = modeFor(y); S.calc = false;
    S.where = []; S.fields = []; S.insts = []; S.q = ''; S.sort = ''; S.fold = {}; S.showNo = {}; S.showMore = {}; S.showNoRange = {}; S.subOpen = {};
    S.rows = []; S.pasted = false; OPEN_ROW = ''; LVL_OPEN = ''; CARD_OPEN = false; ADDING = false; addOpen = false; pasteOpen = false; pasteReadBack = ''; pasteUnread = [];
    update(true);
    if (had) toast('Grades cleared for the new exam year.', { do: 'undo', label: STRINGS.undo });
  }
  // D2.2: the level of most subjects sets every row; the cores follow the level (N(T) has no Humanities row)
  function setLevel(lv) {
    if (S.level === lv) return;
    S.level = lv;
    const old = S.rows;
    const cores = coreRows();
    cores.forEach(function (c) {
      const o = old.filter(function (r) { return r.core === c.core; })[0];
      if (!o) return;
      // D19: a picked subject that does not exist at the new level is picked again
      if (c.pick && o.name && pickOptions(PICKS[c.pick], lv).indexOf(o.name) >= 0) c.name = o.name;
      if (!c.pick && o.name !== c.name) return;
      c.grade = o.grade; c.mark = o.mark; c.skip = o.skip;
      c.level = c.name ? levelFor(c.name, lv) : lv;
      keepOrClear(c);
    });
    const added = old.filter(function (r) { return r.added; }).map(function (r) {
      const ok = allowedLevels(r.name);
      r.level = ok.indexOf(lv) >= 0 ? lv : (ok.indexOf(r.level) >= 0 ? r.level : ok[0]);
      keepOrClear(r);
      return r;
    });
    S.rows = cores.concat(added);
    LVL_OPEN = '';
    update(true);
  }
  function toggleStar(key, viaSwipe) {
    UNDO = { stars: S.stars.slice() };
    const on = isStarred(key);
    if (on) S.stars = S.stars.filter(function (k) { return k !== key; }); else S.stars.push(key);
    render();
    $$('.star[data-key="' + String(key).replace(/["\\]/g, '\\$&') + '"]').forEach(function (b) { anim(b, [{ transform: 'scale(.8)' }, { transform: 'scale(1.2)', offset: 0.5 }, { transform: 'scale(1)' }], MOTION.flip); });
    anim($('.tab-n'), [{ transform: 'scale(1)' }, { transform: 'scale(1.3)', offset: 0.4 }, { transform: 'scale(1)' }], MOTION.flip);
    if (viaSwipe) { const el = document.querySelector('.cc[data-key="' + String(key).replace(/["\\]/g, '\\$&') + '"]'); if (el) { el.classList.add('flash'); setTimeout(function () { el.classList.remove('flash'); }, 700); } }
    toast(on ? STRINGS.toastUnstarred : STRINGS.toastStarred, { do: 'undo', label: STRINGS.undo });
  }
  // a "Show N more" fold: the cards right after its button grow in, or shrink away before they go
  function foldTo(btn, kind, map, v) {
    if (map[v]) { const nx = btn.nextElementSibling; closeThen(nx && /\b(cards|jct)\b/.test(nx.className) ? nx : null, function () { map[v] = false; update(false); }); return; }
    map[v] = true; JUST_OPENED = kind + '|' + v; update(false);
  }
  function share() {
    const text = shareText();
    const fallback = function () { openSheet('share', $('[data-do="share"]')); };
    const laptop = isWide() || !!(window.matchMedia && window.matchMedia('(pointer: fine)').matches);
    if (laptop || !navigator.share) { fallback(); return; }
    try {
      navigator.share({ title: STRINGS.shareHead.replace(/:$/, ''), text: text }).catch(function () { fallback(); });
    } catch (e) { fallback(); }
  }
  function copyShare() {
    const ta = $('#share-text');
    const text = ta ? ta.value : shareText();
    // K9: the button itself reads "Copied" for 1.5 s
    const mark = function () {
      const b = $('[data-do="copy"]');
      if (b) { b.textContent = STRINGS.copied; setTimeout(function () { if (b.isConnected) b.textContent = STRINGS.copy; }, 1500); }
    };
    const done = function () { mark(); toast(STRINGS.copied); };
    const fail = function () {
      if (ta) { ta.focus(); ta.select(); }
      let ok = false;
      try { ok = document.execCommand && document.execCommand('copy'); } catch (e) { ok = false; }
      if (ok) mark();
      toast(ok ? STRINGS.copied : STRINGS.copyFailed);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try { navigator.clipboard.writeText(text).then(done, fail); } catch (e) { fail(); }
    } else fail();
  }
  function nextStudent() {
    UNDO = null;
    S.stars = [];
    S.rows = coreRows(); S.cca = defaultState().cca; S.school = ''; S.lep = defaultState().lep; S.mode = modeFor(S.year); S.pasted = false; S.calc = false;
    R = null; CARDS = null; DIRTY = true; OPEN_ROW = ''; LVL_OPEN = ''; CARD_OPEN = false; ADDING = false;
    addOpen = false; addQuery = ''; schoolQuery = ''; pasteOpen = true; pasteReadBack = ''; pasteUnread = [];
    changed();
    SHEET.kind = ''; renderSheet();
    go('input');
    render();
    const ta = $('#paste-text'); if (ta) ta.value = '';  // never focused by script: on a phone that zooms the page
    toast(STRINGS.cleared);
  }
  function clearAll() {
    UNDO = snapshot();
    S = defaultState(); R = null; CARDS = null; DIRTY = true; OPEN_ROW = ''; LVL_OPEN = ''; CARD_OPEN = false; ADDING = false; KEEP.about = false;
    addOpen = false; addQuery = ''; schoolQuery = ''; pasteOpen = false; pasteReadBack = ''; pasteUnread = []; fieldsOpen = false;
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* nothing stored */ }
    SHEET.kind = ''; renderSheet();
    go('input');
    render();
    toast(STRINGS.cleared, { do: 'undo', label: STRINGS.undo });
  }

  document.addEventListener('click', function (e) {
    const t = e.target.closest && e.target.closest('[data-do]');
    if (!t) {
      if (e.target.id === 'scrim') closeSheet();
      return;
    }
    const act = t.dataset.do, v = t.dataset.v;
    TAP_SEL = /\b(chip|chip-any|seg-btn)\b/.test(t.className) ? selOf(t) : '';
    const r = t.dataset.row ? rowById(t.dataset.row) : null;
    const kbd = e.detail === 0;  // a click from the keyboard (Enter or Space): focus follows what opens
    const snap = ROUTE.name === 'input' ? stepSnap() : null;  // what was open before this tap (B: what opens is shown)
    switch (act) {
      case 'year': setYear(Number(v)); stepShow(snap, kbd); return;
      case 'level': setLevel(v); stepShow(snap, kbd); return;
      case 'mode': if (S.mode !== v) { S.mode = v; OPEN_ROW = ''; rememberMode(S.year, v); stepTo(true, undefined, snap); } return;
      case 'grade':
        if (!r) return;
        // the newest entry wins: a tapped grade replaces a mark. a complete row folds at once and the next subject
        // opens below it; on a row opened for an edit, its own grade tapped again just folds it
        if (rowGrade(r) === v) { if (OPEN_ROW === r.id) OPEN_ROW = ''; else { r.grade = ''; r.mark = ''; } }
        else { r.grade = v; r.mark = ''; if (OPEN_ROW === r.id) OPEN_ROW = ''; }
        r.note = '';
        stepTo(true, kbd, snap);
        return;
      case 'pick':
        if (!r) return;
        r.name = v; r.level = levelFor(v, r.level || S.level); keepOrClear(r); r.skip = false; PICK_OPEN = '';
        stepTo(true, false, snap); return;
      case 'skip': if (r) { r.skip = !r.skip; r.auto = false; r.mine = true; OPEN_ROW = ''; LVL_OPEN = ''; stepTo(true, kbd, snap); } return;
      case 'row-open':
        if (r) {
          OPEN_ROW = r.id; r.skip = false; r.auto = false; r.mine = true; update(true);
          stepShow(snap, false);
          const el = document.getElementById('row-' + r.id), f = el && el.querySelector('.mark-in, .chip[aria-pressed="true"], .chip');
          if (f) f.focus({ preventScroll: true });
        }
        return;
      case 'pick-change': if (r) { PICK_OPEN = r.id; OPEN_ROW = r.id; update(false); const el = document.getElementById('row-' + r.id), f = el && el.querySelector('[data-do="pick"][aria-pressed="true"], [data-do="pick"]'); if (f) f.focus({ preventScroll: true }); } return;
      case 'lvl-open': if (r) { LVL_OPEN = LVL_OPEN === r.id ? '' : r.id; stepTo(false, undefined, snap); } return;
      case 'row-level':
        if (r) {
          r.level = r.level === v && S.year === 2027 && !r.name ? '' : v;
          if (r.name && r.level && allowedLevels(r.name).indexOf(r.level) < 0) { if (r.pick) r.name = ''; else r.level = levelFor(r.name, r.level); }
          keepOrClear(r); LVL_OPEN = ''; stepTo(true, undefined, snap);
        }
        return;
      case 'remove-row': S.rows = S.rows.filter(function (x) { return x.id !== t.dataset.row; }); if (OPEN_ROW === t.dataset.row) OPEN_ROW = ''; stepTo(true, undefined, snap); return;
      // A4: "+ Add a subject" opens the add list; the new row is the open row, and the buttons return when it is done
      case 'add-open': ADDING = !ADDING; addOpen = false; update(false); if (ADDING) revealDown($('.add')); return;
      case 'add-pick': {
        const nr = newRow({ name: v, added: true }), after = t.dataset.after;
        let at = S.rows.length;
        if (after) { at = S.rows.findIndex(function (x) { return x.id === after; }) + 1; while (at > 0 && at < S.rows.length && S.rows[at].added && S.rows[at].after === after) at += 1; nr.after = after; }
        S.rows.splice(at, 0, nr); settleSlots(); addQuery = ''; addOpen = false; ADDING = false; OPEN_ROW = '';
        stepTo(true, kbd || !!after, snap);
        return;
      }
      case 'add-toggle': addOpen = !addOpen; update(false); if (addOpen) { const q = $('#subj-q'); if (q) q.focus(); } return;
      case 'add-typed': if (addQuery.trim()) { S.rows.push(newRow({ name: addQuery.trim(), added: true })); settleSlots(); addQuery = ''; addOpen = false; ADDING = false; OPEN_ROW = ''; stepTo(true, undefined, snap); } return;
      case 'paste-toggle': pasteOpen = !pasteOpen; update(false); return;  // never focused by script: on a phone a text box zooms the page
      // A5: "Calculate my aggregates" folds the subjects card to one line, shows the tiles, and scrolls once to them
      case 'calc': S.calc = true; CARD_OPEN = false; ADDING = false; OPEN_ROW = ''; update(true); toTiles(); return;
      case 'subj-edit': e.preventDefault(); CARD_OPEN = true; OPEN_ROW = ''; if (ROUTE.name !== 'input') go('input'); else render(); return;
      case 'paste-read': {
        const ta = $('#paste-text');
        const res = readPaste(ta ? ta.value : '');
        pasteUnread = res.unread;
        const known = res.rows.filter(function (x) { return !isUnknownSubject(x); }), unknown = res.rows.filter(function (x) { return isUnknownSubject(x); });
        pasteReadBack = known.length ? STRINGS.pasteDone(known.length, known.map(function (x) { return x.name + ' ' + gradeLabel(x.level, x.grade); }).join(', ')) : STRINGS.pasteNone;
        if (unknown.length) pasteReadBack += ' ' + STRINGS.pasteUnknown(unknown.map(function (x) { const g = didYouMean(x.name)[0]; return x.name + (g ? ' (' + STRINGS.didYouMean(g) + ')' : ''); }));
        if (res.rows.length) { UNDO = snapshot(); S.mode = 'grade'; S.rows = fillRows(res.rows); settleSlots(); OPEN_ROW = ''; S.pasted = true; }
        // a line read in full lands on the calculated state, its read-back in the toast; anything not read keeps
        // the card open, at the first subject still to answer
        const whole = res.rows.length > 0 && !unknown.length && !pasteUnread.length && allDone();
        if (whole) { S.calc = true; CARD_OPEN = false; ADDING = false; pasteOpen = false; update(true); toTiles(); toast(pasteReadBack); }
        else if (res.rows.length) stepTo(true, undefined, snap);
        else update(false);
        return;
      }
      case 'dym': if (r) { r.name = v; r.pick = ''; r.level = levelFor(v, r.level); } stepTo(true, undefined, snap); return;
      case 'cca': S.cca = v; update(true); return;
      case 'allex': S.allEx = v === 'all'; update(false); return;
      // the Group control (every route list on screen), B: the route chips under the tiles, C: a tile's pop-over
      case 'groupby': setGroup(v); update(false); return;
      case 'route-hide': case 'route-add': {
        const d = picksMade() ? null : defaultRoutes(), cur = d ? d.routes.slice() : S.where.filter(function (w) { return liveWheres().indexOf(w) >= 0; });
        S.where = act === 'route-add' ? cur.concat(cur.indexOf(v) < 0 ? [v] : []) : cur.filter(function (w) { return w !== v; });
        if (!S.where.length) return;
        const fl = fieldList(); S.fields = S.fields.filter(function (f) { return fl.indexOf(f) >= 0; });
        update(true); return;
      }
      case 'tile': {
        const open = t.getAttribute('aria-expanded') === 'true';
        closeTips(null);
        if (!open) { t.setAttribute('aria-expanded', 'true'); placeTip(t); const tip = t.nextElementSibling; if (tip) tip.focus({ preventScroll: true }); }
        else t.focus({ preventScroll: true });
        return;
      }
      case 'tile-close': { const w = t.closest('.tile-w'), tb = w && w.querySelector('.tile'); if (tb) { tb.setAttribute('aria-expanded', 'false'); tb.focus({ preventScroll: true }); } return; }
      case 'about-open': if (SHEET.kind === 'about') closeSheet(); else openSheet('about', t); return;
      case 'where': {
        const i = S.where.indexOf(v);
        if (i >= 0) S.where.splice(i, 1); else S.where.push(v);
        const fl = fieldList();
        S.fields = S.fields.filter(function (f) { return fl.indexOf(f) >= 0; });
        update(true); return;
      }
      case 'school-pick': S.school = v; schoolQuery = ''; update(true); return;
      case 'school-clear': S.school = ''; schoolQuery = ''; update(true); { const i = $('#school'); if (i) i.focus(); } return;
      case 'lep': S.lep = v; update(true); return;
      case 'fields-toggle': fieldsOpen = !fieldsOpen; update(false); return;
      case 'riasec': {
        const i = S.riasec.indexOf(v);
        if (i >= 0) S.riasec.splice(i, 1); else if (S.riasec.length < 3) S.riasec.push(v); else return;
        KEEP.riasec = true; update(true); return;
      }
      case 'bands': KEEP.bands = !KEEP.bands; update(false); return;
      case 'about': KEEP.about = !KEEP.about; update(false); return;
      case 'fit-info': KEEP.fitInfo = !KEEP.fitInfo; update(false); return;
      case 'show': changed(); go('courses'); return;  // only after "Calculate my aggregates", every subject done
      // a greyed route chip adds nothing; it says why, in place
      case 'where-off': CHIP_WHY = CHIP_WHY === v ? '' : v; update(false); return;
      case 'what-if': {
        const nm = nearMiss();
        if (!nm || !S.rows[nm.i]) return;
        UNDO = snapshot();
        const row = S.rows[nm.i];
        if (nm.step.mark != null) row.mark = nm.step.mark; else { row.grade = nm.step.grade; row.mark = ''; }
        if (picksMade() && S.where.indexOf(nm.wid) < 0) S.where.push(nm.wid);  // the route it opens joins what is shown
        changed(); save(); update(true);
        toast(STRINGS.nmDone(nm.name, nm.to), { do: 'undo', label: STRINGS.undo });
        return;
      }
      case 'not-open': KEEP.notOpen = !KEEP.notOpen; update(false); return;
      // the open tiers the default leaves out join the picks (the picks then win)
      case 'also-open': { const d = defaultRoutes(); if (d) S.where = d.routes.concat(d.hidden.map(function (x) { return x.wid; })).filter(function (w, i, a) { return a.indexOf(w) === i; }); update(true); return; }
      // the indicative tag's words, on tap (hover and keyboard focus show them through CSS)
      case 'ind': { e.preventDefault(); const open = t.getAttribute('aria-expanded') !== 'true'; $$('.ind[aria-expanded="true"]').forEach(function (x) { x.setAttribute('aria-expanded', 'false'); }); t.setAttribute('aria-expanded', String(open)); if (open) placeTip(t); return; }
      case 'where-all': S.where = []; S.fields = S.fields.filter(function (f) { return fieldList().indexOf(f) >= 0; }); update(true); return;
      case 'add-where': if (S.where.indexOf(v) < 0) S.where.push(v); S.fold[v] = false; update(true); { const g = $('#g-' + v); if (g) { g.scrollIntoView({ block: 'start' }); g.focus({ preventScroll: true }); } } return;
      case 'path-go': {
        // B2: a row never changes what the student picked; it goes to its section, or offers to add the route
        e.preventDefault();
        // 2026 pathways too (their lines on Results did nothing before)
        const w = Object.keys(WHERE).filter(function (k) { return WHERE[k].pse.concat(WHERE[k].sections).some(function (x) { return x.id === v; }); })[0];
        if (!w) return;
        if (!inScope(w)) { toast('', { do: 'add-where', v: w, label: STRINGS.addToList(STRINGS.whereOpts[w]) }); return; }
        S.fold[w] = false;
        FOCUS_AFTER = '#g-' + w; FOCUS_SCROLL = true; PATH_SEC = v;
        if (ROUTE.name === 'courses') { render(); focusAfter(); toSec(); } else go('courses');
        return;
      }
      case 'group': { const open = !t.getAttribute('aria-expanded') || t.getAttribute('aria-expanded') === 'true'; const g = $('#g-' + v);
        if (open) { closeThen(g && g.querySelector('.group-body'), function () { S.fold[v] = true; update(false); }); return; }
        S.fold[v] = false; JUST_OPENED = 'group|' + v; update(false); return; }
      case 'show-no': foldTo(t, 'show-no', S.showNo, v); return;
      case 'star': e.preventDefault(); toggleStar(t.dataset.key, false); return;
      case 'share': share(); return;
      case 'copy': copyShare(); return;
      case 'os-share': try { navigator.share({ title: STRINGS.shareHead.replace(/:$/, ''), text: shareText() }).catch(function () {}); } catch (err) { /* the sheet stays */ } return;
      case 'jcsort': S.jcSort = v; STREAM_SAVED = v; try { localStorage.setItem(STREAM_KEY, v); } catch (e) { /* private window */ } update(false); return;
      case 'sheet-secinst': if (SHEET.kind === 'secinst' && SHEET.scope === v) closeSheet(); else openSheet('secinst', t); return;
      case 'secinst-all': S.insts = S.insts.filter(function (i) { return instsOf(v).indexOf(i) < 0; }); PICK_NONE[v] = false; update(false); return;
      case 'secinst-none': S.insts = S.insts.filter(function (i) { return instsOf(v).indexOf(i) < 0; }); PICK_NONE[v] = true; update(false); return;
      case 'show-long': foldTo(t, 'show-long', S.showMore, v); return;
      case 'sheet-field': case 'sheet-inst': case 'sheet-sort': case 'sheet-filter': {
        const k = act.replace('sheet-', '');
        if (SHEET.kind === k) closeSheet(); else openSheet(k, t);
        return;
      }
      case 'sort-pick': S.sort = v; SHEET.kind = ''; renderSheet(); update(false); return;
      case 'unfilter':
        if (t.dataset.k === 'field') S.fields = S.fields.filter(function (f) { return f !== v; });
        else if (t.dataset.k === 'where') { S.where = S.where.filter(function (w) { return w !== v; }); const fl = fieldList(); S.fields = S.fields.filter(function (f) { return fl.indexOf(f) >= 0; }); }
        else S.insts = S.insts.filter(function (i) { return i !== v; });
        update(false); return;
      case 'sub': { const open = t.getAttribute('aria-expanded') === 'true'; S.subOpen[v] = !open; update(false); return; }
      case 'show-more': foldTo(t, 'show-more', S.showMore, v); return;
      case 'show-norange': foldTo(t, 'show-norange', S.showNoRange, v); return;
      case 'clear-filters': S.fields = []; S.insts = []; S.q = ''; update(false); return;
      case 'another': openSheet('route', t); return;
      case 'map-dot': {
        const i = S.insts.indexOf(v);
        if (i >= 0) S.insts.splice(i, 1); else S.insts.push(v);
        update(false); return;
      }
      case 'back': e.preventDefault(); goBack(t.getAttribute('href').slice(1) || 'courses'); return;
      case 'restart': openSheet('confirm', t); return;
      case 'confirm-clear': clearAll(); return;
      case 'next-student': nextStudent(); return;
      case 'edit-paste': pasteOpen = true; CARD_OPEN = true; go('input'); return;  // the box shows, never focused by script
      case 'sheet-close': closeSheet(); return;
      case 'undo':
        if (UNDO) {
          if (UNDO.stars && Object.keys(UNDO).length === 1) S.stars = UNDO.stars; else S = UNDO;
          UNDO = null; $('#toast').classList.remove('on'); update(true);
        }
        return;
      default: unmapped('act:' + act);
    }
  });
  document.addEventListener('change', function (e) {
    const t = e.target;
    const d = t.dataset || {};
    if (d.change === 'pick') { const r = rowById(d.row); if (r && t.value) { r.name = t.value; r.level = levelFor(r.name, r.level || S.level); keepOrClear(r); r.skip = false; PICK_OPEN = ''; } update(true); }
    else if (d.change === 'field') {
      const i = S.fields.indexOf(d.v);
      if (t.checked && i < 0) S.fields.push(d.v); else if (!t.checked && i >= 0) S.fields.splice(i, 1);
      update(false);
    } else if (d.change === 'inst') {
      const i = S.insts.indexOf(d.v);
      if (t.checked && i < 0) S.insts.push(d.v); else if (!t.checked && i >= 0) S.insts.splice(i, 1);
      update(false);
    } else if (d.change === 'secinst') {
      const wid = d.w, all = instsOf(wid), mine = instFilterFor(wid);
      if (!mine.length && !PICK_NONE[wid]) { if (!t.checked) S.insts = S.insts.concat(all.filter(function (i) { return i !== d.v; })); }
      else {
        const i = S.insts.indexOf(d.v);
        if (t.checked && i < 0) S.insts.push(d.v); else if (!t.checked && i >= 0) S.insts.splice(i, 1);
        PICK_NONE[wid] = !instFilterFor(wid).length;
      }
      update(false);
    }
  });
  let qTimer = null;
  let routesTick = 0;
  document.addEventListener('input', function (e) {
    // a new line in the paste box clears the old read-back
    if (e.target && e.target.id === 'paste-text' && pasteReadBack) { pasteReadBack = ''; const nb = $('.paste-back'); if (nb) nb.remove(); }
    const t = e.target;
    const d = t.dataset || {};
    if (d.input === 'mark') {
      const r = rowById(d.row);
      if (!r) return;
      r.mark = t.value; r.note = '';
      OPEN_ROW = r.id;  // the row being typed in stays open until Enter / Next or until focus leaves it
      if (String(t.value).trim()) r.grade = '';
      const to = document.getElementById('mark-to-' + r.id);
      if (to) to.innerHTML = markToText(r);
      changed(); save();
      renderBar();
      // B: the aggregates card and the route chips follow the marks as they are typed (not the rows)
      clearTimeout(routesTick);
      routesTick = setTimeout(function () {
        const slot = $('#aggs-slot'), wc = $('.where-card');
        if (ROUTE.name !== 'input' || !slot) return;
        ensureR(); unpickShut();
        const html = summaryHTML('results');
        if (slot.innerHTML !== html) { holdFloor(); slot.innerHTML = html; tileMotion(); }
        if (wc) { const w = whereCardHTML(); if (wc.outerHTML !== w) wc.outerHTML = w; }
      }, 300);
      return;
    }
    if (d.input === 'subj-q') {
      addQuery = t.value;
      const l = $('#subj-list');
      if (l) l.innerHTML = addListHTML();
    } else if (d.input === 'school') {
      schoolQuery = t.value;
      const exact = schoolExact(schoolQuery);
      if (exact) { S.school = exact; schoolQuery = ''; update(true); return; }
      const l = $('#school-list');
      if (l) l.innerHTML = schoolListHTML();
    } else if (d.input === 'q') {
      S.q = t.value.trim();
      clearTimeout(qTimer);
      qTimer = setTimeout(function () { render(); }, 200);
    }
  });
  // D3, a mark row is complete on Enter / Next or when focus leaves it with a valid mark; it then folds and the
  // next subject opens. While a finger or the mouse is still down, the fold waits for it to lift, so the tap lands first.
  let PTR_DOWN = false, AFTER_UP = null, LAST_TAB = 0;
  document.addEventListener('pointerdown', function () { PTR_DOWN = true; }, true);
  const lift = function () { PTR_DOWN = false; if (AFTER_UP) { const f = AFTER_UP; AFTER_UP = null; setTimeout(f, 0); } };
  document.addEventListener('pointerup', lift, true);
  document.addEventListener('pointercancel', lift, true);
  document.addEventListener('focusin', function (e) {
    if (e.target.matches && e.target.matches('input[type="text"], input[type="search"], textarea') && !e.target.readOnly) document.body.classList.add('kb');
  });
  document.addEventListener('focusout', function (e) {
    const t = e.target;
    if (t.matches && t.matches('input[type="text"], input[type="search"], textarea')) document.body.classList.remove('kb');
    const row0 = t.closest && t.closest('.srow');
    const id = row0 && row0.dataset.row, r0 = id && rowById(id);
    if (!r0 || rowMode(r0) !== 'mark' || OPEN_ROW !== id) return;
    setTimeout(function () {
      const done = function () {
        const row = document.getElementById('row-' + id);
        if (!row || OPEN_ROW !== id || ROUTE.name !== 'input') return;  // another action already moved on
        if (document.activeElement && row.contains(document.activeElement)) return;
        const snap = stepSnap();
        OPEN_ROW = '';
        stepTo(true, Date.now() - LAST_TAB < 600, snap);
      };
      if (PTR_DOWN) AFTER_UP = done; else done();
    }, 0);
  });
  document.addEventListener('toggle', function (e) {
    const t = e.target;
    if (t && t.dataset && t.dataset.keep) { if (t.open) KEEP[t.dataset.keep] = true; else delete KEEP[t.dataset.keep]; }
    if (t && t.tagName === 'DETAILS' && t.open) Array.prototype.forEach.call(t.children, function (c) { if (c.tagName !== 'SUMMARY') anim(c, [{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }], MOTION.d2); });
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && SHEET.kind) { closeSheet(); return; }
    // r1 P-9: Tab stays inside an open sheet or popover
    if (e.key === 'Tab' && SHEET.kind) {
      const f = $$('#sheet button, #sheet input, #sheet a[href], #sheet textarea, #sheet select').filter(function (x) { return x.getClientRects().length && !x.disabled; });
      if (f.length) {
        const a = document.activeElement, i = f.indexOf(a);
        if (i < 0) { e.preventDefault(); f[0].focus(); return; }
        if (e.shiftKey && i === 0) { e.preventDefault(); f[f.length - 1].focus(); return; }
        if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); return; }
      }
    }
    // fix 16: on a laptop Esc closes Details and returns to its card
    if (e.key === 'Escape' && isWide() && ROUTE.name === 'course') { const id = ROUTE.id; FOCUS_AFTER = '.cc[data-id="' + id + '"] .cc-main'; go('courses'); return; }
    // school suggestions take the arrow keys
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && (e.target.id === 'school' || (e.target.closest && e.target.closest('#school-list')))) {
      const items = $$('#school-list .pick-item');
      if (!items.length) return;
      e.preventDefault();
      const i = items.indexOf(e.target);
      const nx = e.key === 'ArrowDown' ? items[Math.min(items.length - 1, i + 1)] : (i <= 0 ? $('#school') : items[i - 1]);
      if (nx) nx.focus();
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute && e.target.getAttribute('role') === 'button' && e.target.dataset.do) {
      e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    if (e.key === 'Tab') LAST_TAB = Date.now();
    // Tab out of the last control of a mark row being answered completes it there and then, and the next subject
    // takes the focus
    if (e.key === 'Tab' && !e.shiftKey && ROUTE.name === 'input' && e.target.closest) {
      const row = e.target.closest('.srow'), id = row && row.dataset.row, r = id && rowById(id);
      if (r && rowMode(r) === 'mark' && OPEN_ROW === id && String(r.mark || '').trim()) {
        const fs = [].slice.call(row.querySelectorAll('button, input, select, a[href]')).filter(function (x) { return !x.disabled && x.getClientRects().length; });
        if (fs[fs.length - 1] === e.target) { e.preventDefault(); const snap = stepSnap(); OPEN_ROW = ''; stepTo(true, true, snap); return; }
      }
    }
    if (e.key === 'Enter' && e.target.dataset && e.target.dataset.input === 'mark') {
      // D3, Enter / Next completes the row (a valid mark): it folds, the next subject opens and takes the focus
      e.preventDefault();
      const r = rowById(e.target.dataset.row);
      if (!r || !String(r.mark || '').trim()) return;
      const snap = stepSnap();
      if (OPEN_ROW === r.id) OPEN_ROW = '';
      stepTo(true, true, snap);
      if (rowNeed(r) === 'markBad') { const m = $('#mark-' + r.id); if (m) m.focus({ preventScroll: true }); }
    }
    // Enter in the paste box reads the line (Shift+Enter still makes a new line)
    if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'paste-text') { const rd = $('[data-do="paste-read"]'); if (rd) { e.preventDefault(); rd.click(); } return; }
    if (e.key === 'Enter' && e.target.id === 'subj-q') { const first = $('#subj-list .pick-item'); if (first) { e.preventDefault(); first.click(); } }
    if (e.key === 'Enter' && e.target.id === 'school') { const first = $('#school-list .pick-item'); if (first) { e.preventDefault(); first.click(); } }
  });

  // D11: on a phone, a right swipe on a card also stars it (not from the left edge; 40 % of the card; Undo)
  let SW = null, SWIPED = 0;
  document.addEventListener('pointerdown', function (e) {
    if (isWide() || e.pointerType === 'mouse') return;
    const card = e.target.closest && e.target.closest('.cc');
    if (!card || e.target.closest('.star, .cc-apply')) return;
    if (e.clientX < 24) return;
    SW = { card: card, x0: e.clientX, y0: e.clientY, w: card.offsetWidth, dx: 0, on: false, id: e.pointerId };
  }, { passive: true });
  document.addEventListener('pointermove', function (e) {
    if (!SW || e.pointerId !== SW.id) return;
    const dx = e.clientX - SW.x0, dy = e.clientY - SW.y0;
    if (!SW.on) {
      if (Math.abs(dy) > 12 && Math.abs(dy) >= Math.abs(dx)) { SW = null; return; }
      if (dx > 12 && dx > 2 * Math.abs(dy)) { SW.on = true; SW.card.classList.add('swiping'); } else return;
    }
    SW.dx = Math.max(0, dx);
    // the card follows the finger with resistance; the star waits underneath in the gap it leaves
    const cap = SW.w * 0.55, tx = Math.round(cap * (1 - Math.exp(-SW.dx / cap)));
    SW.card.style.transform = 'translateX(' + tx + 'px)';
    SW.card.style.setProperty('--sw', tx + 'px');
    SW.card.classList.toggle('sw-ready', SW.dx >= SW.w * 0.4);
  }, { passive: true });
  function swipeEnd(cancel) {
    if (!SW) return;
    const s = SW;
    SW = null;
    if (!s.on) return;
    const star = !cancel && s.dx >= s.w * 0.4;
    s.card.classList.remove('swiping');
    s.card.style.transform = '';
    SWIPED = Date.now();
    const end = function () { s.card.classList.remove('sw-ready'); s.card.style.removeProperty('--sw'); if (star) toggleStar(s.card.dataset.key, true); };
    if (calm()) end(); else setTimeout(end, MOTION.flip);
  }
  document.addEventListener('pointerup', function () { swipeEnd(false); });
  document.addEventListener('pointercancel', function () { swipeEnd(true); });
  document.addEventListener('click', function (e) {
    if (Date.now() - SWIPED < 450 && e.target.closest && e.target.closest('.cc')) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  let WIDE = isWide();
  window.addEventListener('resize', function () {
    const w = isWide();
    if (w !== WIDE) { WIDE = w; if (SHEET.kind) { SHEET.kind = ''; renderSheet(); } render(); }
  });

  /* ================================================================================================ demo results */
  // #demo-O2026 (or NA2026, NT2026, SEC2027) fills made-up results (the students of `python3 -m matcher demo`);
  // add -courses, -dates, -starred or -map to open that screen. For demonstrations and visual checks only.
  const DEMOS = {
    O2026: { year: 2026, level: 'O', cca: 'Good', rows: [['English Language', 'O', 'B3'], ['Mathematics', 'O', 'B4'], ['Science (Physics, Chemistry)', 'O', 'C5'],
      ['Humanities (Social Studies, Geography)', 'O', 'C6'], ['Chinese', 'O', 'A2'], ['Principles of Accounts', 'O', 'B3'], ['Art', 'O', 'A2']] },
    NA2026: { year: 2026, level: 'N(A)', cca: 'Excellent', rows: [['English Language', 'N(A)', '2'], ['Mathematics', 'N(A)', '3'], ['Science (Physics, Chemistry)', 'N(A)', '2'],
      ['Humanities (Social Studies, Geography)', 'N(A)', '3'], ['Principles of Accounts', 'N(A)', '1'], ['Tamil', 'N(A)', '2']] },
    NT2026: { year: 2026, level: 'N(T)', cca: 'None', rows: [['English Language', 'N(T)', 'C'], ['Mathematics', 'N(T)', 'E'], ['Mobile Robotics', 'N(T)', 'B'], ['Computer Applications', 'N(T)', 'A']] },
    SEC2027: { year: 2027, level: 'G3', cca: 'Good', marks: true, rows: [['English Language', 'G3', '66'], ['Mathematics', 'G3', '61'], ['Science (Physics, Chemistry)', 'G3', '56'],
      ['History', 'G3', '51'], ['Geography', 'G2', '76'], ['Tamil', 'G2', '71']] },
    SEC2027JP: { year: 2027, level: 'G3', cca: 'Excellent', where: ['jc', 'poly'], rows: [['English Language', 'G3', 'B3'], ['Mathematics', 'G3', 'B4'],
      ['Science (Chemistry, Biology)', 'G3', 'B4'], ['Humanities (Social Studies, Geography)', 'G3', 'A2'], ['Additional Mathematics', 'G3', 'C5'],
      ['Principles of Accounts', 'G3', 'B3'], ['Chinese', 'G1', 'D']] }
  };
  function applyDemo() {
    const raw = String(location.hash || '').replace(/^#/, '');
    let id = '', screen = 'input';
    const plain = /^demo-([A-Za-z0-9]+?)(?:-(courses|dates|starred|map|input))?$/.exec(raw);
    if (plain) { id = plain[1]; screen = plain[2] || 'input'; }
    else if (/^demo=/.test(raw)) {
      const q = {};
      raw.split('&').forEach(function (kv) { const p = kv.split('='); if (p[0]) q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
      id = q.demo; if (q.tab === 'courses') screen = 'courses';
    }
    const d = DEMOS[id];
    if (!d) return '';
    const stars = S.stars;
    S = defaultState();
    S.stars = stars;
    S.year = d.year; S.level = d.level; S.cca = d.cca; S.mode = d.marks ? 'mark' : 'grade'; S.where = (d.where || []).slice();
    S.calc = true; CARD_OPEN = false;  // a demo lands on the calculated state
    S.rows = fillRows(d.rows.map(function (x) { return d.marks ? { name: x[0], level: x[1], mark: x[2] } : { name: x[0], level: x[1], grade: x[2] }; }));
    // rows the demo student did not take
    S.rows.forEach(function (r) { if (!r.name || (!r.grade && !r.mark)) r.skip = true; });
    return screen;
  }

  /* ================================================================================================ boot */
  function selfCheck() {
    const names = [];
    Object.keys(PICKS).forEach(function (k) { PICKS[k].options().forEach(function (n) { names.push(n); }); });
    Object.keys(CORES).forEach(function (k) { CORES[k].forEach(function (r) { if (r.name) names.push(r.name); }); });
    Object.keys(COMMON).forEach(function (k) { COMMON[k].forEach(function (n) { if (n.charAt(0) !== '@') names.push(n); }); });
    names.forEach(function (n) { if (!catalogueEntry(n) && NOT_YET_IN_CATALOGUE.indexOf(n) < 0) unmapped('cat:' + n); });
  }
  load();
  if (S.year && S.level && !S.rows.length) S.rows = coreRows();
  selfCheck();
  if (!location.hash || location.hash === '#') history.replaceState(null, '', '#input');
  onRoute();
  window.PSE_ATLAS = { version: APP_VERSION, name: APP_DISPLAY_NAME, state: function () { return S; }, result: function () { ensureR(); return R; },
    cards: function () { ensureR(); return CARDS; }, route: function () { return ROUTE; }, unmapped: function () { return UNMAPPED.slice(); },
    missing: function () { return missingRows().length; }, estimate2028: estimate2028 };
})();
