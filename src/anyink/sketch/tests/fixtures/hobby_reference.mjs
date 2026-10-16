// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/* global process */
// Independent reference for S1's hobby.js: a line-by-line port of mp.w's solve_choices
// (forward elimination with uu / vv / ww, the cyclic closing step, curl_ratio, velocity,
// set_controls) in floating point, for paths given as MetaPost would read them. MetaPost was
// not on the machine on 10/16/2026, so these numbers stand in for it until hobby_reference.mp
// is run through mpost.
// Writes hobby_reference.json (these numbers, plus hobby-curve 0.2.1's for the cases with no
// direction or tension) and hobby_reference.mp (the same paths for MetaPost).
// Not part of the app or the test run. To remake: copy this file into a scratch folder where
// `npm install hobby-curve@0.2.1` was run (never into the repo), then
// `node hobby_reference.mjs <this fixtures folder>`.
import fs from 'node:fs';
import path from 'node:path';
import { createHobbyBezier } from 'hobby-curve';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const DEG = Math.PI / 180;
const red = (a) => {
	while (a > Math.PI) a -= 2 * Math.PI;
	while (a <= -Math.PI) a += 2 * Math.PI;
	return a;
};
function velocity(st, ct, sf, cf, t) {
	const num = 2 + Math.SQRT2 * (st - sf / 16) * (sf - st / 16) * (ct - cf);
	const denom = 3 + 1.5 * (Math.sqrt(5) - 1) * ct + 1.5 * (3 - Math.sqrt(5)) * cf;
	const d = t === 1 ? denom : denom * t;
	if (num / 4 >= d) return 4;
	return num / d;
}
function curlRatio(gamma, aT, bT) {
	const alpha = 1 / aT;
	const beta = 1 / bT;
	const num = (3 - alpha) * alpha * alpha * gamma + beta * beta * beta;
	const den = alpha * alpha * alpha * gamma + (3 - beta) * beta * beta;
	return Math.min(4, num / den);
}

// knots: [{x, y, ltype, rtype ('open'|'curl'|'given'|'endcycle'), lgiven, rgiven (rad),
//          lt, rt (tensions), lcurl, rcurl}]
// solve one run from knot index s0 (k = 0) to the run end; idx(k) maps run position to knot
function solveRun(K, idx, n, cyclicRun) {
	const at = (k) => K[idx(k)];
	const dx = [];
	const dy = [];
	const delta = [];
	const psi = [];
	for (let k = 0; k <= n; k++) {
		if (k < n || cyclicRun) {
			dx[k] = at(k + 1).x - at(k).x;
			dy[k] = at(k + 1).y - at(k).y;
			delta[k] = Math.hypot(dx[k], dy[k]);
		}
		if (k > 0 && (k < n || cyclicRun)) {
			const sine = dy[k - 1] / delta[k - 1];
			const cosine = dx[k - 1] / delta[k - 1];
			psi[k] = Math.atan2(dy[k] * cosine - dx[k] * sine, dx[k] * cosine + dy[k] * sine);
		}
	}
	if (cyclicRun) {
		// mp.w: n is the number of knots; psi[n] wraps, delta[n] = delta[0]
		psi[n] = psi[0] ?? 0;
		dx[n] = dx[0];
		dy[n] = dy[0];
		delta[n] = delta[0];
	} else psi[n] = 0;
	if (cyclicRun) {
		const sine = dy[n - 1] / delta[n - 1];
		const cosine = dx[n - 1] / delta[n - 1];
		psi[n] = Math.atan2(dy[n] * cosine - dx[n] * sine, dx[n] * cosine + dy[n] * sine);
		psi[0] = psi[n];
		psi[n + 1] = psi[1];
	}
	const uu = [];
	const vv = [];
	const ww = [];
	const theta = [];
	const s0 = at(0);
	const t1 = at(1);
	if (s0.rtype === 'given') {
		if (t1.ltype === 'given' && n === 1) {
			const aa = red(s0.rgiven - Math.atan2(dy[0], dx[0]));
			const bb = red(Math.atan2(dy[0], dx[0]) - t1.lgiven);
			return [ctrl(at(0), at(1), dx[0], dy[0], aa, bb)];
		}
		vv[0] = red(s0.rgiven - Math.atan2(dy[0], dx[0]));
		uu[0] = 0;
		ww[0] = 0;
	} else if (s0.rtype === 'curl') {
		if (t1.ltype === 'curl' && n === 1) {
			const a = s0.rt;
			const b = t1.lt;
			return [
				[
					[s0.x, s0.y],
					[s0.x + dx[0] / (3 * a), s0.y + dy[0] / (3 * a)],
					[t1.x - dx[0] / (3 * b), t1.y - dy[0] / (3 * b)],
					[t1.x, t1.y],
				],
			];
		}
		uu[0] = curlRatio(s0.rcurl, s0.rt, t1.lt);
		vv[0] = -psi[1] * uu[0];
		ww[0] = 0;
	} else {
		uu[0] = 0;
		vv[0] = 0;
		ww[0] = 1;
	}
	let k = 1;
	for (;;) {
		const r = at(k - 1);
		const s = at(k);
		const t = at(k + 1);
		const ltype = cyclicRun && k === n ? 'endcycle' : k === n ? s.ltype : 'open';
		if (ltype === 'open' || ltype === 'endcycle') {
			const aa = 1 / (3 * r.rt - 1);
			let dd = delta[k] * (3 - 1 / r.rt);
			const bb = 1 / (3 * t.lt - 1);
			let ee = delta[k - 1] * (3 - 1 / t.lt);
			const cc = 1 - uu[k - 1] * aa;
			dd = dd * cc;
			const lt = s.lt;
			const rt = s.rt;
			if (lt !== rt) {
				if (lt < rt) dd *= (lt / rt) ** 2;
				else ee *= (rt / lt) ** 2;
			}
			let ff = ee / (ee + dd);
			uu[k] = ff * bb;
			let acc = -psi[k + 1] * uu[k];
			if (r.rtype === 'curl' && k === 1) {
				ww[k] = 0;
				vv[k] = acc - psi[1] * (1 - ff);
			} else {
				ff = (1 - ff) / cc;
				acc = acc - psi[k] * ff;
				ff = ff * aa;
				vv[k] = acc - vv[k - 1] * ff;
				ww[k] = -ww[k - 1] * ff;
			}
			if (ltype === 'endcycle') {
				let a = 0;
				let b = 1;
				let j = n;
				do {
					j--;
					if (j === 0) j = n;
					a = vv[j] - a * uu[j];
					b = ww[j] - b * uu[j];
				} while (j !== n);
				a = a / (1 - b);
				theta[n] = a;
				vv[0] = a;
				for (let i = 1; i < n; i++) vv[i] = vv[i] + a * ww[i];
				break;
			}
		} else if (ltype === 'curl') {
			const ff = curlRatio(s.lcurl, s.lt, r.rt);
			theta[n] = (-vv[n - 1] * ff) / (1 - ff * uu[n - 1]);
			break;
		} else if (ltype === 'given') {
			theta[n] = red(s.lgiven - Math.atan2(dy[n - 1], dx[n - 1]));
			break;
		}
		k++;
	}
	for (let j = n - 1; j >= 0; j--) theta[j] = vv[j] - theta[j + 1] * uu[j];
	const out = [];
	for (let j = 0; j < n; j++) {
		const phi = -psi[j + 1] - theta[j + 1];
		out.push(ctrl(at(j), at(j + 1), dx[j], dy[j], theta[j], phi));
	}
	return out;
}
function ctrl(p, q, dx, dy, theta, phi) {
	const st = Math.sin(theta);
	const ct = Math.cos(theta);
	const sf = Math.sin(phi);
	const cf = Math.cos(phi);
	const rr = velocity(st, ct, sf, cf, p.rt);
	const ss = velocity(sf, cf, st, ct, q.lt);
	return [
		[p.x, p.y],
		[p.x + (dx * ct - dy * st) * rr, p.y + (dy * ct + dx * st) * rr],
		[q.x - (dx * cf + dy * sf) * ss, q.y - (dy * cf - dx * sf) * ss],
		[q.x, q.y],
	];
}

// our input -> MetaPost knots -> runs, the way mp.w splits a path at given directions
function reference(points, cyclic) {
	const n = points.length;
	const K = points.map((p, i) => {
		const dir = Number.isFinite(p.dir) ? p.dir * DEG : null;
		const isEnd = !cyclic && (i === 0 || i === n - 1);
		const corner = !!p.corner;
		const type = dir !== null && !corner ? 'given' : corner || isEnd ? 'curl' : 'open';
		return {
			x: p.x,
			y: p.y,
			ltype: type,
			rtype: type,
			lgiven: dir,
			rgiven: dir,
			lt: p.tin ?? 1,
			rt: p.tout ?? 1,
			lcurl: 1,
			rcurl: 1,
		};
	});
	const breaks = K.map((k, i) => (k.ltype !== 'open' ? i : -1)).filter((i) => i >= 0);
	const segs = cyclic ? n : n - 1;
	const out = new Array(segs);
	if (cyclic && breaks.length === 0) {
		const res = solveRun(K, (k) => ((k % n) + n) % n, n, true);
		res.forEach((c, i) => (out[i] = c));
		return out;
	}
	const runs = cyclic ? breaks.length : breaks.length - 1;
	for (let r = 0; r < runs; r++) {
		const from = breaks[r];
		const to = r + 1 < breaks.length ? breaks[r + 1] : breaks[0] + n;
		const res = solveRun(K, (k) => (from + k) % n, to - from, false);
		res.forEach((c, i) => (out[(from + i) % n] = c));
	}
	return out;
}

const cases = [
	{ name: 'arch3', mp: '(0,0)..(100,100)..(200,0)', points: [[0, 0], [100, 100], [200, 0]] },
	{
		name: 'open5',
		mp: '(0,0)..(60,120)..(170,140)..(260,40)..(330,90)',
		points: [[0, 0], [60, 120], [170, 140], [260, 40], [330, 90]],
	},
	{
		name: 'cyclic5',
		mp: '(0,0)..(200,133)..(130,300)..(33,233)..(100,167)..cycle',
		cyclic: true,
		points: [[0, 0], [200, 133], [130, 300], [33, 233], [100, 167]],
	},
	{
		name: 'oval4',
		mp: '(300,0)..(0,200)..(-300,0)..(0,-200)..cycle',
		cyclic: true,
		points: [[300, 0], [0, 200], [-300, 0], [0, -200]],
	},
	{
		name: 'line2',
		mp: '(10,20)..(250,90)',
		points: [[10, 20], [250, 90]],
	},
	{
		name: 'dirMiddle',
		mp: '(0,0)..(100,100){right}..(200,0)',
		points: [[0, 0], [100, 100, { dir: 0 }], [200, 0]],
	},
	{
		name: 'dirEnds',
		mp: '(0,0){up}..(100,80)..(200,0){down}',
		points: [[0, 0, { dir: 90 }], [100, 80], [200, 0, { dir: -90 }]],
	},
	{
		name: 'dirOneEnd',
		mp: '(0,0){dir 30}..(120,40)',
		points: [[0, 0, { dir: 30 }], [120, 40]],
	},
	{
		name: 'tension2',
		mp: '(0,0)..tension 2..(100,100)..(200,0)',
		points: [[0, 0, { tout: 2 }], [100, 100, { tin: 2 }], [200, 0]],
	},
	{
		name: 'tensionAB',
		mp: '(0,0)..tension 0.75 and 3..(100,100)..(200,0)',
		points: [[0, 0, { tout: 0.75 }], [100, 100, { tin: 3 }], [200, 0]],
	},
	{
		name: 'tensionMiddle',
		mp: '(0,0)..(80,120)..tension 1.4 and 2.5..(220,140)..(300,30)',
		points: [[0, 0], [80, 120, { tout: 1.4 }], [220, 140, { tin: 2.5 }], [300, 30]],
	},
	{
		name: 'dirTension',
		mp: '(0,0){dir 60}..tension 1.5..(150,120){dir -20}..(300,0)',
		points: [[0, 0, { dir: 60, tout: 1.5 }], [150, 120, { dir: -20, tin: 1.5 }], [300, 0]],
	},
	{
		name: 'cyclicDir',
		mp: '(0,0)..(100,0){up}..(100,100)..(0,100)..cycle',
		cyclic: true,
		points: [[0, 0], [100, 0, { dir: 90 }], [100, 100], [0, 100]],
	},
	{
		name: 'cyclicTension',
		mp: '(0,0)..tension 1.3..(100,0)..(100,100)..tension 3 and 0.9..(0,100)..cycle',
		cyclic: true,
		points: [
			[0, 0, { tout: 1.3 }],
			[100, 0, { tin: 1.3 }],
			[100, 100, { tout: 3 }],
			[0, 100, { tin: 0.9 }],
		],
	},
	{
		name: 'corner',
		mp: '(0,0)..(100,100) & (100,100)..(200,40)..(260,120)',
		points: [[0, 0], [100, 100, { corner: true }], [200, 40], [260, 120]],
	},
];

const round = (v) => Math.round(v * 1e6) / 1e6;
const fixture = cases.map((c) => {
	const pts = c.points.map(([x, y, extra]) => ({ x, y, ...(extra || {}) }));
	const cubics = reference(pts, !!c.cyclic).map((cu) => cu.map(([x, y]) => [round(x), round(y)]));
	const plain = pts.every((p) => p.dir === undefined && !p.tin && !p.tout && !p.corner);
	let hobbyCurve = null;
	if (plain) {
		const bez = createHobbyBezier(
			pts.map(({ x, y }) => ({ x, y })),
			{ tension: 1, cyclic: !!c.cyclic }
		);
		hobbyCurve = bez.map((b, i) => {
			const p0 = i === 0 ? pts[0] : bez[i - 1].point;
			return [
				[round(p0.x), round(p0.y)],
				[round(b.startControl.x), round(b.startControl.y)],
				[round(b.endControl.x), round(b.endControl.y)],
				[round(b.point.x), round(b.point.y)],
			];
		});
	}
	return { name: c.name, mp: c.mp, cyclic: !!c.cyclic, points: pts, knuthRef: cubics, hobbyCurve };
});

const out = process.argv[2] || here;
fs.writeFileSync(
	path.join(out, 'hobby_reference.json'),
	JSON.stringify(
		{
			made: '10/16/2026',
			by:
				'src/anyink/sketch/tests/fixtures/hobby_reference.mjs. knuthRef: its own port of mp.w solve_choices ' +
				'(no MetaPost on the machine), the only reference for the direction, tension and corner cases. ' +
				'hobbyCurve: hobby-curve 0.2.1 createHobbyBezier, tension 1, the outside check for the cases ' +
				'with no direction, tension or corner (null elsewhere). Remake knuthRef from hobby_reference.mp ' +
				'with mpost when it is available.',
			cases: fixture,
		},
		null,
		1
	) + '\n'
);
const mp = [
	'% S1 hobby.js reference paths. Run: mpost hobby_reference.mp; read the log.',
	'% Each line prints, per piece: point i, postcontrol i, precontrol i+1.',
	'tracingonline := 1;',
	'def dump(expr p) = for i = 0 upto length p - 1: show point i of p, postcontrol i of p, precontrol (i+1) of p; endfor enddef;',
	...cases.map((c) => `message "${c.name}"; dump(${c.mp});`),
	'end',
	'',
].join('\n');
fs.writeFileSync(path.join(out, 'hobby_reference.mp'), mp);
console.log('cases', fixture.length);
for (const f of fixture) if (f.hobbyCurve) console.log(f.name, JSON.stringify(f.knuthRef[0]), JSON.stringify(f.hobbyCurve[0]));
