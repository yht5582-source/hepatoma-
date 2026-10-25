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
ok(tx({ nodules: 1, size: 1.8 }).primary.includes('肝切除'), 'BCLC-0 no CSPH → resection');
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

console.log(`${n - fail}/${n} passed`);
process.exit(fail ? 1 : 0);
