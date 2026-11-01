// node tests.cjs — extracts the engine between /*ENGINE-START*/ and /*ENGINE-END*/ from index.html
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
const code = src.split('/*ENGINE-START*/')[1].split('/*ENGINE-END*/')[0];
const m = { exports: {} };
new Function('module', code)(m);
const HCC = m.exports;
let n = 0, fail = 0;
const eq = (a, b, msg) => { n++; if (JSON.stringify(a) !== JSON.stringify(b)) { fail++; console.log('FAIL', msg, '→ got', a, 'expected', b); } };
const ok = (c, msg) => eq(!!c, true, msg);

const base = {
  bili: 1.0, alb: 4.0, inr: 1.0, crea: 1.0, na: 140, sex: 'M', dialysis: false, cholestatic: false,
  enceph: 1, ascites: 1, decompHx: false, cspH: false, ecog: 0, ltCandidate: false,
  nodules: 1, size: 1.5, vasc: false, extra: false, afp: '', bPattern: 'defined', extendedLT: false,
};
const S = o => ({ ...base, ...o });
const stage = o => HCC.evaluate(S(o)).bclc?.stage;

// Child-Pugh cut points
eq(HCC.childPugh(S({})).score, 5, 'CP minimum 5');
eq(HCC.childPugh(S({ bili: 1.99 })).parts.bili, 1, 'bili <2 → 1');
eq(HCC.childPugh(S({ bili: 2 })).parts.bili, 2, 'bili 2 → 2');
eq(HCC.childPugh(S({ bili: 3 })).parts.bili, 2, 'bili 3 → 2');
eq(HCC.childPugh(S({ bili: 3.1 })).parts.bili, 3, 'bili >3 → 3');
eq(HCC.childPugh(S({ bili: 3.1, cholestatic: true })).parts.bili, 1, 'cholestatic bili 3.1 → 1');
eq(HCC.childPugh(S({ bili: 10, cholestatic: true })).parts.bili, 2, 'cholestatic bili 10 → 2');
eq(HCC.childPugh(S({ bili: 11, cholestatic: true })).parts.bili, 3, 'cholestatic bili 11 → 3');
eq(HCC.childPugh(S({ alb: 3.5 })).parts.alb, 2, 'alb 3.5 → 2');
eq(HCC.childPugh(S({ alb: 2.8 })).parts.alb, 2, 'alb 2.8 → 2');
eq(HCC.childPugh(S({ alb: 2.7 })).parts.alb, 3, 'alb 2.7 → 3');
eq(HCC.childPugh(S({ inr: 1.7 })).parts.inr, 2, 'INR 1.7 → 2');
eq(HCC.childPugh(S({ inr: 2.4 })).parts.inr, 3, 'INR 2.4 → 3');
eq(HCC.childPugh(S({ bili: 2.5 })).cls, 'A', 'CP 6 → A');
eq(HCC.childPugh(S({ bili: 2.5, alb: 3.0 })).cls, 'B', 'CP 7 → B');
eq(HCC.childPugh(S({ bili: 2.5, alb: 3.0, inr: 1.8 })).cls, 'B', 'CP 8 → B');
eq(HCC.childPugh(S({ bili: 4, alb: 2.5, inr: 2.5, ascites: 2 })).cls, 'C', 'CP 13 → C');
eq(HCC.childPugh(S({ bili: 4, alb: 2.5, inr: 2.5, ascites: 3, enceph: 3 })).score, 15, 'CP max 15');

// ALBI (Johnson 2015): bili 17.1 µmol/L & alb 40 g/L → log10(17.1)*0.66 − 3.4 = −2.586 → grade 2
const a1 = HCC.albi(S({}));
eq(Math.round(a1.score * 1000) / 1000, -2.586, 'ALBI score');
eq(a1.grade, 2, 'ALBI −2.586 → grade 2');
eq(HCC.albi(S({ bili: 0.5, alb: 4.5 })).grade, 1, 'ALBI grade 1');
eq(HCC.albi(S({ bili: 3, alb: 2.5 })).grade, 3, 'ALBI grade 3');

// MELD-Na (OPTN 2016)
eq(HCC.meldNa(S({})), { meld: 6, meldNa: 6 }, 'MELD floor 6');
eq(HCC.meldNa(S({ bili: 3, inr: 1.8, crea: 2.0, na: 128 })), { meld: 24, meldNa: 29 }, 'MELD-Na worked example');
eq(HCC.meldNa(S({ bili: 3, inr: 1.8, crea: 2.0, na: 110 })).meldNa, HCC.meldNa(S({ bili: 3, inr: 1.8, crea: 2.0, na: 125 })).meldNa, 'Na floor 125');
eq(HCC.meldNa(S({ bili: 1, inr: 1, crea: 1.2, na: 120 })).meldNa, HCC.meldNa(S({ bili: 1, inr: 1, crea: 1.2, na: 120 })).meld, 'MELD(i) ≤11 → no Na adjustment');
eq(HCC.meldNa(S({ crea: 0.5, dialysis: true })).meld, HCC.meldNa(S({ crea: 4 })).meld, 'dialysis → Cr 4');
eq(HCC.meldNa(S({ crea: 9 })).meld, HCC.meldNa(S({ crea: 4 })).meld, 'Cr capped at 4');
eq(HCC.meldNa(S({ bili: 40, inr: 8, crea: 4, na: 125 })).meldNa, 40, 'MELD-Na capped at 40');

// MELD 3.0 (Kim 2021)
eq(HCC.meld3(S({ alb: 3.5, na: 137 })), 6, 'MELD 3.0 floor male');
eq(HCC.meld3(S({ alb: 3.5, na: 137, sex: 'F' })), 7, 'MELD 3.0 female +1.33');
eq(HCC.meld3(S({ bili: 3, inr: 1.8, crea: 2.0, na: 128, alb: 2.5 })), 30, 'MELD 3.0 worked example');
eq(HCC.meld3(S({ crea: 0.4, dialysis: true })), HCC.meld3(S({ crea: 3 })), 'MELD 3.0 dialysis → Cr 3');
eq(HCC.meld3(S({ crea: 5 })), HCC.meld3(S({ crea: 3 })), 'MELD 3.0 Cr capped at 3');
eq(HCC.meld3(S({ alb: 1.0 })), HCC.meld3(S({ alb: 1.5 })), 'MELD 3.0 alb floor 1.5');
eq(HCC.meld3(S({ alb: 4.5 })), HCC.meld3(S({ alb: 3.5 })), 'MELD 3.0 alb ceiling 3.5');
eq(HCC.meld3(S({ bili: 40, inr: 8, crea: 4, na: 125, alb: 1.5 })), 40, 'MELD 3.0 capped at 40');

// Validation: blank / out-of-range inputs must not produce scores
let e = HCC.evaluate(S({ na: '' }));
eq([e.meldNa, e.meld3, !!e.cp], [null, null, true], 'blank Na → no MELD, CP still computed');
eq(e.labErr.na, '必填', 'blank Na flagged');
e = HCC.evaluate(S({ bili: '' }));
eq([e.cp, e.albi, e.bclc], [null, null, null], 'blank bili → no CP / ALBI / BCLC');
ok(HCC.evaluate(S({ alb: 40 })).labErr.alb, 'alb in g/L flagged');
ok(HCC.evaluate(S({ nodules: 1.5 })).tumorErr.nodules, 'non-integer nodules flagged');
eq(HCC.evaluate(S({ size: '' })).bclc, null, 'blank size → no BCLC');

// Milan / up-to-7
eq(HCC.burden(S({ nodules: 1, size: 5 })).milan, true, 'single 5 cm within Milan');
eq(HCC.burden(S({ nodules: 1, size: 5.1 })).milan, false, 'single 5.1 cm beyond Milan');
eq(HCC.burden(S({ nodules: 3, size: 3 })).milan, true, '3 × 3 cm within Milan');
eq(HCC.burden(S({ nodules: 2, size: 3.5 })).milan, false, '2 nodules 3.5 cm beyond Milan');
eq(HCC.burden(S({ nodules: 1, size: 3, vasc: true })).milan, false, 'MVI beyond Milan');
eq(HCC.burden(S({ nodules: 3, size: 4 })).upTo7, true, 'up-to-7: 3 + 4 = 7');
eq(HCC.burden(S({ nodules: 4, size: 3.5 })).upTo7, false, 'up-to-7: 4 + 3.5 > 7');

// BCLC stages
eq(stage({ nodules: 1, size: 2 }), '0', 'single 2 cm → 0');
eq(stage({ nodules: 1, size: 2.1 }), 'A', 'single 2.1 cm → A');
eq(stage({ nodules: 1, size: 8 }), 'A', 'single 8 cm → A (any size)');
eq(stage({ nodules: 3, size: 3 }), 'A', '3 × ≤3 cm → A');
eq(stage({ nodules: 2, size: 3.1 }), 'B', '2 nodules, one >3 cm → B');
eq(stage({ nodules: 4, size: 1.5 }), 'B', '4 small nodules → B');
eq(stage({ nodules: 1, size: 2, vasc: true }), 'C', 'MVI → C');
eq(stage({ extra: true, nodules: 5, size: 6 }), 'C', 'extrahepatic → C');
eq(stage({ ecog: 1 }), 'C', 'ECOG 1 → C');
eq(stage({ ecog: 2, nodules: 4, size: 5 }), 'C', 'ECOG 2 → C');
eq(stage({ ecog: 3 }), 'D', 'ECOG 3 → D');
eq(stage({ bili: 4, alb: 2.5, inr: 2.5, ascites: 2 }), 'D', 'CP C → D');
eq(stage({ decompHx: true }), 'D', 'decompensation history with CP A → D');
eq(stage({ ascites: 2 }), 'D', 'current ascites → not preserved → D');
eq(stage({ ascites: 2, ltCandidate: true, nodules: 1, size: 4 }), 'LT', 'decompensated within Milan + LT candidate → LT');
eq(stage({ ascites: 2, ltCandidate: true, nodules: 1, size: 4, afp: 1500 }), 'D', 'AFP >1000 blocks LT → D');
eq(stage({ ascites: 2, ltCandidate: true, nodules: 1, size: 6 }), 'D', 'decompensated beyond Milan → D');
eq(stage({ bili: 2.5, alb: 3.0, inr: 1.8 }), '0', 'CP B by labs only, no decompensation → staged by tumour');
ok(HCC.evaluate(S({ bili: 2.5, alb: 3.0, inr: 1.8 })).notes.some(x => x.text.includes('Child-Pugh B')), 'CP B gray-zone warning');

// Treatment recommendations
const tx = o => HCC.evaluate(S(o)).bclc;
ok(tx({ nodules: 1, size: 1.8 }).primary.includes('燒灼'), 'BCLC-0 not LT candidate, no CSPH → ablation (Fig. 5)');
ok(tx({ nodules: 1, size: 1.8, cspH: true }).primary.includes('燒灼'), 'BCLC-0 not LT candidate, CSPH → ablation');
ok(tx({ nodules: 1, size: 1.8, ltCandidate: true }).primary.includes('肝切除'), 'BCLC-0 LT candidate, no CSPH → resection');
ok(tx({ nodules: 1, size: 1.8, ltCandidate: true, cspH: true }).primary.includes('肝臟移植'), 'BCLC-0 LT candidate, CSPH → transplant');
ok(tx({ nodules: 1, size: 1.8, ltCandidate: true, cspH: true, afp: 2000 }).primary.includes('燒灼'), 'BCLC-0 LT candidate, CSPH, AFP > 1000 → ablation');
ok(tx({ nodules: 1, size: 3 }).primary.includes('肝切除'), 'BCLC-A not LT candidate, no CSPH → still resection');
ok(tx({ nodules: 1, size: 1.8, cspH: true }).primary.includes('燒灼'), 'BCLC-0 CSPH, no LT → ablation');
ok(tx({ nodules: 1, size: 1.8, cspH: true, ltCandidate: true }).primary.includes('移植'), 'BCLC-0 CSPH, LT → transplant');
ok(tx({ nodules: 1, size: 4, cspH: true }).primary.includes('TACE'), 'BCLC-A single 4 cm CSPH no LT → TACE/TARE/EBRT alternatives');
ok(tx({ nodules: 3, size: 2.5 }).primary.includes('燒灼'), 'BCLC-A multifocal no LT → ablation');
ok(tx({ nodules: 3, size: 2.5, ltCandidate: true }).primary.includes('移植'), 'BCLC-A multifocal LT → transplant');
ok(tx({ nodules: 3, size: 2.5, ltCandidate: true, afp: 2000 }).primary.includes('燒灼'), 'AFP >1000 → no LT → ablation');
ok(tx({ nodules: 5, size: 4 }).primary.startsWith('TACE'), 'BCLC-B defined → TACE');
ok(tx({ nodules: 5, size: 4, bPattern: 'diffuse' }).primary.includes('全身性治療'), 'BCLC-B diffuse → systemic');
ok(tx({ nodules: 5, size: 4, ltCandidate: true, extendedLT: true }).primary.includes('肝臟移植'), 'BCLC-B extended LT → transplant');
ok(tx({ nodules: 5, size: 4, extendedLT: true }).primary.startsWith('TACE'), 'extendedLT ignored if not LT candidate');
ok(tx({ vasc: true }).primary.includes('Atezolizumab'), 'BCLC-C → IO combination');
ok(tx({ vasc: true, afp: 500 }).options.some(o => o.includes('本例符合')), 'AFP ≥400 → ramucirumab flag');
ok(tx({ ecog: 4 }).primary.includes('支持性'), 'BCLC-D → BSC');

// 教學分頁：病例、考題、心智圖與引擎互相核對
const block = (a, b) => src.split(a)[1].split(b)[0];
const { HCC_CASES, HCC_QUIZ, HCC_MAP } = new Function(
  block('/*CASES-START*/', '/*CASES-END*/') + block('/*QUIZ-START*/', '/*QUIZ-END*/') + block('/*MAP-START*/', '/*MAP-END*/') +
  '; return { HCC_CASES, HCC_QUIZ, HCC_MAP };')();

eq(HCC_CASES.length, 6, '6 cases');
eq(new Set(HCC_CASES.map(c => c.id)).size, 6, 'case ids unique');
for (const c of HCC_CASES) {
  const r = HCC.evaluate(S(c.input)), e = c.expect;
  eq(Object.keys(r.labErr).length + Object.keys(r.tumorErr).length, 0, c.id + ' inputs valid');
  eq(r.bclc.stage, e.stage, c.id + ' stage');
  eq(r.cp.cls, e.cp, c.id + ' Child-Pugh class');
  eq(r.cp.score, e.cpScore, c.id + ' Child-Pugh score');
  eq(r.albi.grade, e.albi, c.id + ' ALBI grade');
  eq(r.burden.milan, e.milan, c.id + ' Milan');
  eq(r.burden.upTo7, e.upTo7, c.id + ' Up-to-7');
  ok(r.bclc.primary.includes(e.primary), c.id + ' primary includes ' + e.primary);
  ok(c.teach.length >= 3 && c.whatIf.length >= 2 && c.src, c.id + ' has teaching content');
  for (const w of c.whatIf) ok(HCC.evaluate(S({ ...c.input, ...w.set })).bclc.primary.includes(w.expect), c.id + ' what-if: ' + w.label);
}
// 病例敘述與解析中的數值
const caseById = id => HCC_CASES.find(c => c.id === id);
eq(HCC.albi(S(caseById('c6').input)).score.toFixed(2), '-1.60', 'c6 ALBI text');
ok(caseById('c6').teach.join('').includes('−1.60'), 'c6 teach states ALBI −1.60');
ok(HCC.evaluate(S(caseById('c6').input)).notes.some(x => x.text.includes('Child-Pugh B')), 'c6 grey-zone note fires');
ok(HCC.evaluate(S(caseById('c2').input)).notes.some(x => x.text.includes('AFP > 1000')), 'c2 AFP note fires');
eq(HCC.evaluate(S(caseById('c2').input)).burden.milan, true, 'c2 inside Milan despite AFP');

eq(HCC_QUIZ.length, 20, '20 questions');
eq(HCC_QUIZ.filter(q => q.level === 'basic').length, 10, '10 basic');
eq(HCC_QUIZ.filter(q => q.level === 'adv').length, 10, '10 advanced');
eq(new Set(HCC_QUIZ.map(q => q.id)).size, 20, 'quiz ids unique');
eq([0, 1, 2, 3].map(i => HCC_QUIZ.filter(q => q.ans === i).length), [5, 5, 5, 5], 'answers spread A–D 5 each');
for (const q of HCC_QUIZ) {
  eq(q.opts.length, 4, q.id + ' has 4 options');
  eq(new Set(q.opts).size, 4, q.id + ' options distinct');
  ok(q.why && q.src && q.topic, q.id + ' has explanation and source');
}
const strictLongest = HCC_QUIZ.filter(q => { const m = Math.max(...q.opts.map(o => o.length)); return q.opts[q.ans].length === m && q.opts.filter(o => o.length === m).length === 1; });
ok(strictLongest.length <= 6, 'correct option is not usually the longest (' + strictLongest.length + ')');
const Q = id => HCC_QUIZ.find(q => q.id === id), key = id => Q(id).opts[Q(id).ans];
// 可計算的題目以引擎核對
eq(stage({ nodules: 1, size: 1.9 }), '0', 'b1 1.9 cm → 0');
eq(stage({ nodules: 1, size: 2.5 }), 'A', 'b1 distractor 2.5 cm → A');
eq(stage({ nodules: 2, size: 1.5 }), 'A', 'b1 distractor 2 × 1.5 cm → A');
const b2 = HCC.childPugh(S({ bili: 2.5, alb: 3.0, inr: 1.8 }));
ok(key('b2').includes(b2.cls + ' 級') && key('b2').includes(b2.score + ' 分'), 'b2 key matches engine');
const b3 = HCC.albi(S({ bili: 1, alb: 4 }));
ok(key('b3').includes('第 ' + b3.grade + ' 級') && key('b3').includes('−2.59') && b3.score.toFixed(2) === '-2.59', 'b3 key matches engine');
eq(key('b4'), 'BCLC-' + stage({ nodules: 2, size: 3.5 }), 'b4 key matches engine');
eq(stage({ nodules: 1, size: 2, ecog: 1 }), 'C', 'b5 ECOG 1 → C');
ok(key('b5').includes('BCLC-C'), 'b5 key says C');
eq(stage({ decompHx: true, nodules: 1, size: 2 }), 'D', 'b8 prior bleed not preserved');
const os = o => HCC.evaluate(S(o)).bclc.os;
ok(key('b9').includes('B 期 ' + os({ nodules: 5, size: 3 })) && key('b9').includes('C 期約 2 年') && os({ vasc: true }) === '約 2 年' && key('b9').includes('D 期 ' + os({ ecog: 3 })), 'b9 key matches engine OS');
const b10 = HCC.burden(S({ nodules: 3, size: 4 }));
eq([b10.milan, b10.upTo7], [false, true], 'b10 burden');
ok(key('b10').includes('Milan 不符合') && key('b10').includes('Up-to-7 符合'), 'b10 key text');
ok(tx({ nodules: 3, size: 2.5, ltCandidate: false }).primary.includes('燒灼'), 'a2 engine → ablation');
ok(tx({ nodules: 4, size: 2.5 }).options.some(o => o.includes('技術因素') && o.includes('TARE') && o.includes('EBRT')), 'a4 engine lists technical alternative');
ok(tx({ nodules: 5, size: 3 }).options.some(o => o.includes('OS 尚未證實')), 'a5 engine says OS unproven');
ok(tx({ vasc: true }).options.some(o => o.includes('最佳序列尚未確立')), 'a6 engine agrees');
// a7 UNOS 條件：與每個選項逐一比對
const unos = (n, max, total, afp) => afp < 1000 && ((n === 1 && max > 5 && max <= 8) || (n >= 2 && n <= 3 && max <= 5 && total <= 8) || (n >= 4 && n <= 5 && max <= 3 && total <= 8));
eq([unos(1, 9, 9, 30), unos(3, 5.5, 9, 100), unos(2, 4, 7, 1200), unos(4, 3, 8, 150)], [false, false, false, true], 'a7 only option D meets UNOS');
eq(Q('a7').ans, 3, 'a7 key is D');
// a10 透析以 4.0 / 3.0 計
eq(HCC.meldNa(S({ crea: 0.5, dialysis: true })).meld, HCC.meldNa(S({ crea: 4 })).meld, 'a10 MELD-Na dialysis 4.0');
eq(HCC.meld3(S({ crea: 0.5, dialysis: true })), HCC.meld3(S({ crea: 3 })), 'a10 MELD 3.0 dialysis 3.0');

eq(HCC_MAP.dx.length, 6, 'map: 6 assessment branches');
eq(HCC_MAP.tx.length, 6, 'map: 6 treatment branches');
for (const b of [...HCC_MAP.dx, ...HCC_MAP.tx]) ok(b.t && b.s && b.l.length >= 3 && b.l.every(x => x.k && x.x), 'map branch complete: ' + b.t);
const mapText = JSON.stringify(HCC_MAP);
for (const t of ['HVPG ≥ 10', '≤ −2.60', '> −1.39', '5–6 A', '7–9 B', '10–15 C', '單顆 ≤ 5 cm', '> 1000 ng/mL', '> 5 年', '> 2.5 年', '約 2 年', '< 1 年']) ok(mapText.includes(t), 'map states ' + t);
const mapTx = name => HCC_MAP.tx.find(b => b.t.startsWith(name));
ok(mapTx('BCLC-0').s.includes(os({ nodules: 1, size: 1.5 })), 'map BCLC-0 OS matches engine');
ok(mapTx('BCLC-A').s.includes(os({ nodules: 1, size: 4 })), 'map BCLC-A OS matches engine');
ok(mapTx('BCLC-B').s.includes(os({ nodules: 5, size: 3 })), 'map BCLC-B OS matches engine');
ok(mapTx('BCLC-C').s.includes(os({ vasc: true })), 'map BCLC-C OS matches engine');
ok(mapTx('BCLC-D').s.includes(os({ ecog: 3 })), 'map BCLC-D OS matches engine');

console.log(`${n - fail}/${n} passed`);
process.exit(fail ? 1 : 0);
