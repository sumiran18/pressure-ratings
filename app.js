// Clutch Index dashboard: drawings. Text that is known in advance lives in index.html; this file draws only what the data decides.
const S = window.ciState = window.ciState || { variant: { bat: 'rank', bowl: 'rank' }, more: { bat: false, bowl: false }, role: 'bat', a: null, b: null, match: null };
const D = (id) => dash.data(id);
const rowsOf = (id) => { const g = D(id); return g.status === 'ok' && Array.isArray(g.data) ? g.data : null; };
const N = (v) => (v === '' || v == null ? NaN : +v);
const T = (v) => (v === '' || v == null || (typeof v === 'number' && isNaN(v)) ? '—' : String(v));
const fmtInt = d3.format(',');
const C = (i) => `var(--ci-s${i % 3}, ${dash.colors[i % dash.colors.length]})`;
const MUTED = 'var(--chart-muted)';
const srcOf = (role) => (role === 'bat' ? 'batters' : 'bowlers');
const byRank = (r) => r.slice().sort((a, b) => N(a.rank) - N(b.rank));
const el$ = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

function waiting(el, ids) {
  if (ids.every((i) => D(i).status === 'ok')) return false;
  el.replaceChildren(document.createTextNode(ids.some((i) => D(i).status === 'error') ? 'Failed to load' : '—'));
  return true;
}
function box(el, h) {
  el.replaceChildren();
  const w = Math.max(280, el.clientWidth || 640);
  const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${w} ${h}`).attr('height', h);
  const tip = el$('div', 'ci-tip'); tip.hidden = true; el.appendChild(tip);
  const size = (H) => svg.attr('viewBox', `0 0 ${w} ${H}`).attr('height', H);
  return { svg, w, tip, size };
}
function showTip(tip, el, ev, lines) {
  tip.replaceChildren(...lines.filter((t) => t != null && t !== '').map((t, i) => el$(i ? 'span' : 'b', null, t)));
  tip.hidden = false;
  const r = el.getBoundingClientRect(); const tw = tip.offsetWidth, th = tip.offsetHeight;
  let x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 14;
  if (x + tw > r.width) x = Math.max(0, ev.clientX - r.left - tw - 14);
  if (y + th > r.height) y = Math.max(0, r.height - th);
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}
const hideTip = (tip) => { tip.hidden = true; };
const hover = (sel, tip, el, lines) => sel.on('pointermove', (ev, d) => showTip(tip, el, ev, lines(d))).on('pointerleave', () => hideTip(tip));

// ---------- headline figures
const KPI_INT = new Set(['matches_rated', 'balls_rated', 'batters', 'bowlers']);
dash.draw('kpi', (el) => {
  const r = rowsOf('summary');
  if (!r || !r.length) { el.textContent = '—'; return; }
  const v = r[0][el.dataset.field];
  el.textContent = KPI_INT.has(el.dataset.field) && !isNaN(N(v)) ? fmtInt(N(v)) : T(v);
});

// ---------- plain tables
function table(name, src, fields, opt = {}) {
  dash.draw(name, (tb) => {
    const r = rowsOf(src);
    if (!r) { tb.replaceChildren(); return; }
    const rr = opt.pick ? opt.pick(r) : r;
    tb.replaceChildren(...rr.map((row) => {
      const tr = el$('tr');
      fields.forEach(([f, cls]) => tr.appendChild(el$('td', cls || '', T(row[f]))));
      return tr;
    }));
  });
}
const ordered = (r) => r.slice().sort((a, b) => N(a.order) - N(b.order));
table('tiertable', 'tiers', [['tier'], ['balls', 'ci-n'], ['leverage', 'ci-n'], ['runout', 'ci-n'], ['fulltoss', 'ci-n'], ['extra', 'ci-n'], ['wkt', 'ci-n'], ['dot', 'ci-n'], ['chase_pct', 'ci-n']], { pick: ordered });
table('moments', 'moments', [['n', 'ci-n'], ['match_date'], ['fixture'], ['comp_name'], ['ob'], ['situation'], ['striker_name'], ['bowler_name'], ['outcome'], ['wp_cal', 'ci-n']]);
table('defs', 'definitions', [['definition'], ['tight_finishes', 'ci-n'], ['runouts', 'ci-n'], ['extras', 'ci-n'], ['fulltosses', 'ci-n'], ['dead_chase_pct', 'ci-n']], { pick: ordered });
table('lifttest', 'lift_test', [['injected'], ['batters', 'ci-n'], ['bowlers', 'ci-n']], { pick: ordered });
table('validity', 'validity', [['rating'], ['batters', 'ci-n'], ['bowlers', 'ci-n']], { pick: ordered });
table('models', 'ball_models', [['model'], ['unseen_matches', 'ci-n'], ['season_2026', 'ci-n']], { pick: ordered });
table('reranks', 'reranks', [['setting'], ['batters_shared', 'ci-n'], ['bowlers_shared', 'ci-n'], ['batters_agreement', 'ci-n'], ['bowlers_agreement', 'ci-n']], { pick: ordered });

// ---------- overview: errors by pressure tier (small multiples, bars from 1.0)
dash.draw('tierchart', (el) => {
  if (waiting(el, ['tiers'])) return;
  const data = ordered(D('tiers').data);
  const M = [['runout', 'Run-outs'], ['fulltoss', 'Full tosses, pace bowlers'], ['extra', 'Wides + no-balls'], ['wkt', 'Wickets']];
  const { svg, w, tip, size } = box(el, 10);
  const cols = w >= 760 ? 4 : w >= 440 ? 2 : 1, gap = 28, pw = (w - gap * (cols - 1)) / cols, lab = 66, rh = 24, top = 28, ph = top + data.length * rh + 6;
  const nr = Math.ceil(M.length / cols); size(nr * ph + (nr - 1) * 14);
  const hi = Math.max(1.6, d3.max(data, (d) => d3.max(M, (m) => N(d[m[0]]))) * 1.02);
  M.forEach((m, i) => {
    const g = svg.append('g').attr('transform', `translate(${(i % cols) * (pw + gap)},${Math.floor(i / cols) * (ph + 14)})`);
    const x = d3.scaleLinear().domain([0.6, hi]).range([lab, pw - 42]);
    g.append('text').attr('class', 'ci-tt').attr('x', 0).attr('y', 13).text(m[1]);
    g.append('line').attr('class', 'ci-ref').attr('x1', x(1)).attr('x2', x(1)).attr('y1', top - 4).attr('y2', ph - 4);
    data.forEach((d, j) => {
      const v = N(d[m[0]]), y = top + j * rh;
      g.append('text').attr('class', 'ci-t').attr('x', 0).attr('y', y + rh / 2 + 4).text(d.tier);
      const bar = g.append('rect').datum(d).attr('x', Math.min(x(1), x(v))).attr('y', y + 4).attr('width', Math.max(1.5, Math.abs(x(v) - x(1)))).attr('height', rh - 8).attr('rx', 4).style('fill', v >= 1 ? C(0) : MUTED);
      hover(bar, tip, el, () => [`${m[1]}: ${d.tier}`, `${v.toFixed(2)} times the rate on ordinary balls`, `${fmtInt(N(d.balls))} balls in this tier`]);
      g.append('text').attr('class', 'ci-tv').attr('x', Math.max(x(v), x(1)) + 6).attr('y', y + rh / 2 + 4).text(v.toFixed(2));
    });
  });
});

// ---------- overview: pressure by over and wickets down
dash.draw('heat', (el) => {
  if (waiting(el, ['heat'])) return;
  const data = D('heat').data, panels = ['Batting first', 'Chasing'];
  const { svg, w, tip, size } = box(el, 10);
  const cols = w >= 640 ? 2 : 1, gap = 32, pw = (w - gap * (cols - 1)) / cols, ml = 30, mt = 26, mb = 34, cw = (pw - ml) / 20, ch = Math.max(14, Math.min(24, cw)), ph = mt + 10 * ch + mb;
  size(cols === 2 ? ph : ph * 2 + 12);
  const op = d3.scaleLinear().domain([15, 95]).range([0.06, 1]).clamp(true);
  panels.forEach((p, i) => {
    const g = svg.append('g').attr('transform', `translate(${(i % cols) * (pw + gap)},${Math.floor(i / cols) * (ph + 12)})`);
    g.append('text').attr('class', 'ci-tt').attr('x', ml).attr('y', 13).text(p);
    const cells = g.selectAll('rect').data(data.filter((d) => d.innings_n === p)).join('rect')
      .attr('x', (d) => ml + (N(d.overid) - 1) * cw + 1).attr('y', (d) => mt + N(d.wk_before) * ch + 1).attr('width', Math.max(1, cw - 2)).attr('height', ch - 2).attr('rx', 4)
      .style('fill', C(0)).style('fill-opacity', (d) => op(N(d.pi)));
    hover(cells, tip, el, (d) => [`${p}: over ${d.overid}, ${d.wk_before} down`, `Average Pressure Index ${N(d.pi).toFixed(0)}`, `${fmtInt(N(d.balls))} balls`]);
    [1, 5, 10, 15, 20].forEach((o) => g.append('text').attr('class', 'ci-t').attr('text-anchor', 'middle').attr('x', ml + (o - 0.5) * cw).attr('y', mt + 10 * ch + 15).text(o));
    g.append('text').attr('class', 'ci-t').attr('x', ml).attr('y', mt + 10 * ch + 30).text('Over');
    [0, 3, 6, 9].forEach((k) => g.append('text').attr('class', 'ci-t').attr('text-anchor', 'end').attr('x', ml - 8).attr('y', mt + (k + 0.5) * ch + 4).text(k));
    g.append('text').attr('class', 'ci-t').attr('text-anchor', 'end').attr('x', pw).attr('y', 13).text('rows: wickets down');
  });
});

// ---------- pressure lab: match replay
dash.draw('matchsel', (sel) => {
  const r = rowsOf('match_balls');
  if (!r) { sel.replaceChildren(); return; }
  const seen = new Map(); r.forEach((d) => { if (!seen.has(d.match_id)) seen.set(d.match_id, d.label); });
  if (!S.match || !seen.has(S.match)) S.match = seen.keys().next().value;
  sel.replaceChildren(...[...seen].map(([id, l]) => new Option(l, id))); sel.value = S.match;
  sel.onchange = () => { S.match = sel.value; dash.draw('worm'); };
});
dash.draw('worm', (el) => {
  if (waiting(el, ['match_balls'])) return;
  const all = D('match_balls').data;
  if (!S.match) S.match = all[0].match_id;
  const data = all.filter((d) => d.match_id === S.match).map((d) => ({ ...d, s: N(d.seq), wp: N(d.wp_first), p: N(d.pi) }));
  if (!data.length) { el.replaceChildren(document.createTextNode('—')); return; }
  const { svg, w, tip, size } = box(el, 10);
  const ml = 44, mr = 14, mt = 24, h1 = 250, gv = 30, h2 = 54, mb = 28, H = mt + h1 + gv + h2 + mb; size(H);
  const n = data.length, x = d3.scaleLinear().domain([1, n]).range([ml, w - mr]), y = d3.scaleLinear().domain([0, 100]).range([mt + h1, mt]);
  [0, 25, 50, 75, 100].forEach((t) => {
    svg.append('line').attr('class', t === 50 ? 'ci-ref' : 'ci-grid').attr('x1', ml).attr('x2', w - mr).attr('y1', y(t)).attr('y2', y(t));
    svg.append('text').attr('class', 'ci-t').attr('text-anchor', 'end').attr('x', ml - 8).attr('y', y(t) + 4).text(t + '%');
  });
  svg.append('text').attr('class', 'ci-t').attr('x', ml + 6).attr('y', mt + 13).text(`${data[0].first_team} ahead ↑`);
  svg.append('text').attr('class', 'ci-t').attr('x', ml + 6).attr('y', mt + h1 - 7).text(`${data[0].second_team} ahead ↓`);
  const y0 = mt + h1 + gv, i2 = data.findIndex((d) => String(d.innings) === '2');
  if (i2 > 0) {
    const xb = (x(data[i2 - 1].s) + x(data[i2].s)) / 2;
    svg.append('line').attr('class', 'ci-ref').attr('x1', xb).attr('x2', xb).attr('y1', mt).attr('y2', y0 + h2);
    svg.append('text').attr('class', 'ci-t').attr('text-anchor', 'middle').attr('x', (ml + xb) / 2).attr('y', H - 8).text('First innings');
    svg.append('text').attr('class', 'ci-t').attr('text-anchor', 'middle').attr('x', (xb + w - mr) / 2).attr('y', H - 8).text('Chase');
  }
  svg.append('path').attr('d', d3.line().x((d) => x(d.s)).y((d) => y(d.wp))(data)).style('fill', 'none').style('stroke', C(0)).style('stroke-width', 2).style('stroke-linejoin', 'round');
  svg.append('text').attr('class', 'ci-t').attr('x', ml).attr('y', y0 - 7).text('Pressure Index of each ball');
  const bw = Math.max(1, (w - ml - mr) / n);
  svg.append('g').selectAll('rect').data(data).join('rect').attr('x', (d) => x(d.s) - bw / 2).attr('y', y0).attr('width', bw + 0.3).attr('height', h2).style('fill', C(0)).style('fill-opacity', (d) => 0.05 + 0.95 * Math.pow(d.p / 100, 2.2));
  const mark = svg.append('g').style('display', 'none');
  mark.append('line').attr('class', 'ci-ref').attr('y1', mt).attr('y2', y0 + h2);
  mark.append('circle').attr('r', 5).style('fill', C(0)).style('stroke', 'var(--color-bg)').style('stroke-width', 2);
  svg.append('rect').attr('x', ml).attr('y', mt).attr('width', w - ml - mr).attr('height', h1 + gv + h2).style('fill', 'transparent')
    .on('pointermove', (ev) => {
      const [px] = d3.pointer(ev, svg.node()); const d = data[Math.max(0, Math.min(n - 1, Math.round(x.invert(px)) - 1))];
      mark.style('display', null); mark.select('line').attr('x1', x(d.s)).attr('x2', x(d.s)); mark.select('circle').attr('cx', x(d.s)).attr('cy', y(d.wp));
      showTip(tip, el, ev, [`Over ${d.ob} · ${d.score} · ${d.situation}`, `${d.striker_name} facing ${d.bowler_name}`, d.outcome, `Pressure Index ${d.p.toFixed(0)}`, `${data[0].first_team} win chance ${d.wp.toFixed(0)}%`]);
    })
    .on('pointerleave', () => { mark.style('display', 'none'); hideTip(tip); });
});

// ---------- rankings
dash.draw('rankhead', (th) => { const v = S.variant[th.dataset.role]; th.dataset.field = v; th.textContent = v === 'rank' ? 'Rank' : 'Rank in this setting'; });
dash.draw('ranktable', (tb) => {
  const role = tb.dataset.role, r = rowsOf(srcOf(role));
  if (!r) { tb.replaceChildren(); return; }
  const v = S.variant[role], n = S.more[role] ? 25 : 10;
  const rr = r.filter((d) => !isNaN(N(d[v]))).sort((a, b) => N(a[v]) - N(b[v])).slice(0, n);
  const mid = role === 'bat' ? ['p_balls', 'p_sr', 'p_xsr', 'est100', 'wins', 'clutch', 'top10_pct', 'holds'] : ['p_balls', 'p_econ', 'p_xecon', 'p_wkts', 'p_xwkts', 'est100', 'wins', 'clutch', 'top10_pct', 'holds'];
  tb.replaceChildren(...rr.map((d) => {
    const tr = el$('tr', N(d.rank) <= 10 ? 'ci-hi' : ''); tr.dataset.key = String(d.player_id);
    tr.append(el$('td', 'ci-n', T(d[v])), el$('td', 'ci-n ci-finalcol', T(d.rank)), el$('td', '', T(d.name)), el$('td', '', T(d.teams)));
    mid.forEach((f) => tr.appendChild(el$('td', 'ci-n', T(d[f]))));
    return tr;
  }));
});
function intervalChart(name, lo, mid, hi, opt) {
  dash.draw(name, (el) => {
    const role = el.dataset.role, src = srcOf(role);
    if (waiting(el, [src])) return;
    const data = byRank(D(src).data).filter((d) => N(d.rank) <= 15);
    const { svg, w, tip, size } = box(el, 10);
    const ml = Math.min(150, w * 0.4), mr = 46, mt = 22, rh = 24, mb = 26, H = mt + data.length * rh + mb; size(H);
    const dom = opt.domain(data), x = d3.scaleLinear().domain(dom).range([ml, w - mr]);
    x.ticks(w > 520 ? 6 : 4).forEach((t) => {
      svg.append('line').attr('class', 'ci-grid').attr('x1', x(t)).attr('x2', x(t)).attr('y1', mt - 4).attr('y2', H - mb);
      svg.append('text').attr('class', 'ci-t').attr('text-anchor', 'middle').attr('x', x(t)).attr('y', H - mb + 16).text(t);
    });
    if (opt.ref != null) {
      svg.append('line').attr('class', 'ci-ref').attr('x1', x(opt.ref)).attr('x2', x(opt.ref)).attr('y1', mt - 8).attr('y2', H - mb);
      svg.append('text').attr('class', 'ci-t').attr('text-anchor', 'middle').attr('x', x(opt.ref)).attr('y', mt - 11).text(opt.refLabel);
    }
    data.forEach((d, j) => {
      const y = mt + j * rh + rh / 2, a = Math.max(dom[0], N(d[lo])), b = Math.min(dom[1], N(d[hi]));
      svg.append('text').attr('class', 'ci-t').attr('text-anchor', 'end').attr('x', ml - 10).attr('y', y + 4).text(d.name.length > 20 ? d.name.slice(0, 19) + '…' : d.name);
      svg.append('line').attr('x1', x(a)).attr('x2', x(b)).attr('y1', y).attr('y2', y).style('stroke', C(0)).style('stroke-width', 3).style('stroke-linecap', 'round').style('stroke-opacity', 0.45);
      svg.append('circle').attr('cx', x(Math.max(dom[0], Math.min(dom[1], N(d[mid]))))).attr('cy', y).attr('r', 5).style('fill', C(0)).style('stroke', 'var(--color-bg)').style('stroke-width', 2);
      svg.append('text').attr('class', 'ci-tv').attr('x', x(b) + 8).attr('y', y + 4).text(opt.endLabel(d));
      hover(svg.append('rect').attr('x', 0).attr('y', y - rh / 2).attr('width', w).attr('height', rh).style('fill', 'transparent'), tip, el, () => opt.tip(d, role));
    });
  });
}
intervalChart('rangechart', 'rank_lo', 'rank', 'rank_hi', {
  domain: (data) => [1, Math.min(80, d3.max(data, (d) => N(d.rank_hi)))], ref: 10, refLabel: 'top 10',
  endLabel: (d) => `${d.rank_lo}–${d.rank_hi}`,
  tip: (d) => [d.name, `Final rank ${d.rank}`, `Rank falls between ${d.rank_lo} and ${d.rank_hi} nine times in ten`, `Chance of the top 10: ${d.top10_pct}%`],
});
intervalChart('liftchart', 'lift_lo', 'raw_lift', 'lift_hi', {
  domain: (data) => { const m = d3.max(data, (d) => Math.max(Math.abs(N(d.lift_lo)), Math.abs(N(d.lift_hi)))); return [-m, m]; }, ref: 0, refLabel: 'no lift',
  endLabel: (d) => (N(d.raw_lift) > 0 ? '+' : '') + d.raw_lift,
  tip: (d, role) => [d.name, `Lift ${d.raw_lift} runs per 100 balls`, `Range ${d.lift_lo} to ${d.lift_hi}`, N(d.lift_lo) <= 0 && N(d.lift_hi) >= 0 ? 'The range crosses zero: the data cannot tell' : 'The range does not cross zero', `${d.p_balls} pressure balls ${role === 'bat' ? 'faced' : 'bowled'}`],
});
dash.draw('scatter', (el) => {
  const role = el.dataset.role, bat = role === 'bat', src = srcOf(role);
  if (waiting(el, [src])) return;
  const fx = bat ? 'p_xsr' : 'p_xecon', fy = bat ? 'p_sr' : 'p_econ';
  const data = D(src).data.filter((d) => !isNaN(N(d[fx])) && !isNaN(N(d[fy])));
  const { svg, w, tip, size } = box(el, 10);
  const ml = 46, mr = 18, mt = 16, mb = 44, H = Math.min(460, Math.max(320, w * 0.6)); size(H);
  const ex = d3.extent(data, (d) => N(d[fx])), ey = d3.extent(data, (d) => N(d[fy])), px_ = (ex[1] - ex[0]) * 0.06, py_ = (ey[1] - ey[0]) * 0.06;
  const dx = [ex[0] - px_, ex[1] + px_], dy = [ey[0] - py_, ey[1] + py_], dom = [Math.max(dx[0], dy[0]), Math.min(dx[1], dy[1])];
  const x = d3.scaleLinear().domain(dx).range([ml, w - mr]), y = d3.scaleLinear().domain(dy).range([H - mb, mt]);
  x.ticks(6).forEach((t) => {
    svg.append('line').attr('class', 'ci-grid').attr('x1', x(t)).attr('x2', x(t)).attr('y1', mt).attr('y2', H - mb);
    svg.append('text').attr('class', 'ci-t').attr('text-anchor', 'middle').attr('x', x(t)).attr('y', H - mb + 16).text(t);
  });
  y.ticks(6).forEach((t) => {
    svg.append('line').attr('class', 'ci-grid').attr('x1', ml).attr('x2', w - mr).attr('y1', y(t)).attr('y2', y(t));
    svg.append('text').attr('class', 'ci-t').attr('text-anchor', 'end').attr('x', ml - 8).attr('y', y(t) + 4).text(t);
  });
  svg.append('line').attr('class', 'ci-ref').attr('x1', x(dom[0])).attr('y1', y(dom[0])).attr('x2', x(dom[1])).attr('y2', y(dom[1]));
  svg.append('text').attr('class', 'ci-t').attr('text-anchor', 'end').attr('x', w - mr).attr('y', H - 8).text(bat ? 'Expected strike rate for an average batter →' : 'Expected economy for an average bowler →');
  svg.append('text').attr('class', 'ci-t').attr('x', ml + 6).attr('y', mt + 10).text(bat ? '↑ Actual strike rate' : '↑ Actual economy');
  const pts = data.map((d) => ({ d, px: x(N(d[fx])), py: y(N(d[fy])), top: N(d.rank) <= 10 })).sort((a, b) => a.top - b.top);
  svg.append('g').selectAll('circle').data(pts).join('circle').attr('cx', (p) => p.px).attr('cy', (p) => p.py).attr('r', (p) => (p.top ? 6 : 4))
    .style('fill', (p) => (p.top ? C(0) : MUTED)).style('fill-opacity', (p) => (p.top ? 1 : 0.75)).style('stroke', 'var(--color-bg)').style('stroke-width', (p) => (p.top ? 2 : 1));
  const placed = [{ x0: ml, x1: ml + 150, y0: mt - 4, y1: mt + 16 }]; // the axis caption in the top-left corner
  pts.filter((p) => N(p.d.rank) <= 4).sort((a, b) => N(a.d.rank) - N(b.d.rank)).forEach((p) => {
    // a name goes to the right of its dot, or to the left when it would run off the chart or onto another name; if neither fits, pointing at the dot still names it
    const lw = p.d.name.length * 7;
    const spot = [false, true].map((left) => ({ left, x0: left ? p.px - 9 - lw : p.px + 9, x1: left ? p.px - 9 : p.px + 9 + lw, y0: p.py - 9, y1: p.py + 9 }))
      .find((b) => b.x0 >= ml && b.x1 <= w && !placed.some((q) => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0));
    if (!spot) return;
    placed.push(spot);
    svg.append('text').attr('class', 'ci-tv').attr('text-anchor', spot.left ? 'end' : 'start').attr('x', spot.left ? spot.x1 : spot.x0).attr('y', p.py + 4).text(p.d.name);
  });
  const ring = svg.append('circle').attr('r', 9).style('fill', 'none').style('stroke', 'var(--color-fg)').style('stroke-width', 1.5).style('display', 'none');
  svg.append('rect').attr('x', 0).attr('y', 0).attr('width', w).attr('height', H).style('fill', 'transparent')
    .on('pointermove', (ev) => {
      const [mx, my] = d3.pointer(ev, svg.node()); const p = d3.least(pts, (q) => (q.px - mx) ** 2 + (q.py - my) ** 2);
      if (!p || (p.px - mx) ** 2 + (p.py - my) ** 2 > 900) { ring.style('display', 'none'); hideTip(tip); return; }
      ring.style('display', null).attr('cx', p.px).attr('cy', p.py);
      showTip(tip, el, ev, [p.d.name, `Final rank ${p.d.rank}`, `${bat ? 'Strike rate' : 'Economy'} ${p.d[fy]} against ${p.d[fx]} expected`, `${p.d.p_balls} pressure balls`]);
    })
    .on('pointerleave', () => { ring.style('display', 'none'); hideTip(tip); });
});

// ---------- player card
function pick(slot) {
  const r = rowsOf(srcOf(S.role)); if (!r) return null;
  const list = byRank(r);
  if (!S.a || !list.some((d) => String(d.player_id) === S.a)) S.a = String(list[0].player_id);
  if (S.b == null) S.b = String(list[1].player_id);
  const id = slot === 'a' ? S.a : S.b;
  return id ? list.find((d) => String(d.player_id) === id) || null : null;
}
const CARD = ['pcv', 'note', 'splits', 'strip', 'pmoments', 'styles'];
dash.draw('playersel', (sel) => {
  const r = rowsOf(srcOf(S.role));
  if (!r) { sel.replaceChildren(); return; }
  pick('a'); const slot = sel.dataset.slot;
  const opts = byRank(r).map((d) => new Option(`${d.rank}. ${d.name}`, String(d.player_id)));
  sel.replaceChildren(...(slot === 'b' ? [new Option('No one', '')] : []), ...opts);
  sel.value = slot === 'a' ? S.a : S.b || '';
  sel.onchange = () => { if (slot === 'a') S.a = sel.value; else S.b = sel.value; CARD.forEach((n) => dash.draw(n)); };
});
dash.draw('pcv', (el) => {
  const p = el.dataset.role === S.role ? pick(el.dataset.slot) : null;
  if (!p) { el.textContent = '—'; el.removeAttribute('data-where'); return; }
  el.dataset.source = srcOf(S.role); el.dataset.field = el.dataset.f; el.dataset.where = 'player_id=' + p.player_id;
  el.textContent = T(p[el.dataset.f]);
});
dash.draw('note', (el) => {
  const r = rowsOf('notes'), p = pick('a');
  const n = r && p ? r.find((d) => String(d.player_id) === String(p.player_id) && d.role === S.role) : null;
  if (n) el.dataset.where = `player_id=${p.player_id}&role=${S.role}`; else el.removeAttribute('data-where');
  el.textContent = n ? n.note : '—';
});
dash.draw('splits', (el) => {
  if (waiting(el, ['splits', srcOf(S.role)])) return;
  const p = pick('a'), bat = S.role === 'bat';
  const mine = p ? D('splits').data.filter((d) => String(d.player_id) === String(p.player_id) && d.role === S.role) : [];
  if (!mine.length) { el.replaceChildren(document.createTextNode('—')); return; }
  const G = [['tier', 'By pressure tier, all balls', ['Calm', 'Building', 'High', 'Extreme']], ['phase', 'By phase, pressure balls', ['Powerplay', 'Middle', 'Death']],
    ['matchup', bat ? 'Against pace and spin, pressure balls' : 'Against right- and left-handers, pressure balls', bat ? ['Pace', 'Spin'] : ['RHB', 'LHB']], ['competition', 'IPL and T20I, pressure balls', ['IPL', 'T20I']]];
  const NAME = { RHB: 'Right-handers', LHB: 'Left-handers' };
  const { svg, w, tip, size } = box(el, 10);
  const cols = w >= 640 ? 2 : 1, gap = 36, pw = (w - gap * (cols - 1)) / cols, lab = 96, rh = 36, top = 28, ph = top + 4 * rh + 8;
  const nr = Math.ceil(G.length / cols); size(nr * ph + (nr - 1) * 10);
  const max = d3.max(mine, (d) => Math.max(N(d.rate), N(d.xrate))) * 1.05, f = bat ? (v) => v.toFixed(0) : (v) => v.toFixed(1);
  G.forEach((gdef, i) => {
    const g = svg.append('g').attr('transform', `translate(${(i % cols) * (pw + gap)},${Math.floor(i / cols) * (ph + 10)})`);
    const x = d3.scaleLinear().domain([0, max]).range([lab, pw - 44]);
    g.append('text').attr('class', 'ci-tt').attr('x', 0).attr('y', 13).text(gdef[1]);
    gdef[2].map((s) => mine.find((d) => d.grp === gdef[0] && d.split === s)).filter(Boolean).forEach((d, j) => {
      const y = top + j * rh, a = N(d.rate), e = N(d.xrate);
      g.append('text').attr('class', 'ci-t').attr('x', 0).attr('y', y + 17).text(NAME[d.split] || d.split);
      g.append('rect').attr('x', lab).attr('y', y + 3).attr('width', Math.max(1.5, x(a) - lab)).attr('height', 11).attr('rx', 4).style('fill', C(0));
      g.append('rect').attr('x', lab).attr('y', y + 16).attr('width', Math.max(1.5, x(e) - lab)).attr('height', 11).attr('rx', 4).style('fill', MUTED);
      g.append('text').attr('class', 'ci-tv').attr('x', x(a) + 6).attr('y', y + 13).text(f(a));
      g.append('text').attr('class', 'ci-t').attr('x', x(e) + 6).attr('y', y + 26).text(f(e));
      hover(g.append('rect').attr('x', 0).attr('y', y).attr('width', pw).attr('height', rh - 4).style('fill', 'transparent'), tip, el,
        () => [`${p.name}: ${NAME[d.split] || d.split}`, `${bat ? 'Strike rate' : 'Economy'} ${f(a)} against ${f(e)} expected`, `${d.balls} balls, ${d.outs} ${bat ? 'dismissals' : 'wickets'}`]);
    });
  });
});
dash.draw('strip', (el) => {
  if (waiting(el, ['player_matches', srcOf(S.role)])) return;
  const p = pick('a');
  const data = p ? D('player_matches').data.filter((d) => String(d.player_id) === String(p.player_id) && d.role === S.role).sort((a, b) => d3.ascending(a.date, b.date)) : [];
  if (!data.length) { el.replaceChildren(document.createTextNode('—')); return; }
  const { svg, w, tip, size } = box(el, 10);
  const ml = 44, mr = 10, mt = 12, mb = 24, H = 210; size(H);
  const m = d3.max(data, (d) => Math.abs(N(d.value))) || 1, x = d3.scaleBand().domain(d3.range(data.length)).range([ml, w - mr]).paddingInner(0.25), y = d3.scaleLinear().domain([-m, m]).range([H - mb, mt]);
  [-m, 0, m].forEach((t) => {
    svg.append('line').attr('class', t === 0 ? 'ci-ref' : 'ci-grid').attr('x1', ml).attr('x2', w - mr).attr('y1', y(t)).attr('y2', y(t));
    svg.append('text').attr('class', 'ci-t').attr('text-anchor', 'end').attr('x', ml - 8).attr('y', y(t) + 4).text((t > 0 ? '+' : '') + t.toFixed(0));
  });
  const bars = svg.append('g').selectAll('rect').data(data).join('rect').attr('x', (d, i) => x(i)).attr('width', Math.max(1, x.bandwidth()))
    .attr('y', (d) => Math.min(y(0), y(N(d.value)))).attr('height', (d) => Math.max(1, Math.abs(y(N(d.value)) - y(0)))).attr('rx', Math.min(4, x.bandwidth() / 2))
    .style('fill', (d) => (N(d.value) >= 0 ? C(0) : MUTED));
  hover(bars, tip, el, (d) => [`${d.date} v ${d.vs}`, d.comp, d.line, `${N(d.value) >= 0 ? '+' : ''}${N(d.value).toFixed(1)} runs against average, pressure-weighted`, `${d.p_balls} pressure balls`]);
  svg.append('text').attr('class', 'ci-t').attr('x', ml).attr('y', H - 6).text(data[0].date.slice(0, 7));
  svg.append('text').attr('class', 'ci-t').attr('text-anchor', 'end').attr('x', w - mr).attr('y', H - 6).text(data[data.length - 1].date.slice(0, 7));
});
function cardTable(name, src, fields, sort) {
  dash.draw(name, (tb) => {
    const r = rowsOf(src), p = pick('a');
    if (!r || !p) { tb.replaceChildren(); return; }
    const mine = r.filter((d) => String(d.player_id) === String(p.player_id) && d.role === S.role).sort(sort);
    tb.replaceChildren(...mine.map((d) => { const tr = el$('tr'); fields.forEach(([f, cls]) => tr.appendChild(el$('td', cls || '', T(d[f])))); return tr; }));
  });
}
cardTable('pmoments', 'player_moments', [['match_date'], ['fixture'], ['ob'], ['situation'], ['other'], ['outcome'], ['swing', 'ci-n']], (a, b) => N(b.swing) - N(a.swing));
cardTable('styles', 'styles', [['kind'], ['balls', 'ci-n'], ['runs', 'ci-n'], ['outs', 'ci-n'], ['rate', 'ci-n']], (a, b) => N(b.balls) - N(a.balls));

// ---------- model: calibration
dash.draw('calib', (el) => {
  if (waiting(el, ['calibration'])) return;
  const data = D('calibration').data, panels = ['Batting first', 'Chasing'], series = ['Calibrated', 'Exact'];
  const { svg, w, tip, size } = box(el, 10);
  const cols = w >= 560 ? 2 : 1, gap = 36, pw = (w - gap * (cols - 1)) / cols, ml = 40, mt = 28, mb = 40, side = Math.min(300, pw - ml - 10), ph = mt + side + mb;
  size(cols === 2 ? ph : ph * 2 + 10);
  const pts = [];
  panels.forEach((pn, i) => {
    const ox = (i % cols) * (pw + gap), oy = Math.floor(i / cols) * (ph + 10), g = svg.append('g').attr('transform', `translate(${ox},${oy})`);
    const x = d3.scaleLinear().domain([0, 100]).range([ml, ml + side]), y = d3.scaleLinear().domain([0, 100]).range([mt + side, mt]);
    g.append('text').attr('class', 'ci-tt').attr('x', ml).attr('y', 13).text(pn);
    [0, 25, 50, 75, 100].forEach((t) => {
      g.append('line').attr('class', 'ci-grid').attr('x1', x(t)).attr('x2', x(t)).attr('y1', mt).attr('y2', mt + side);
      g.append('line').attr('class', 'ci-grid').attr('x1', ml).attr('x2', ml + side).attr('y1', y(t)).attr('y2', y(t));
      g.append('text').attr('class', 'ci-t').attr('text-anchor', 'middle').attr('x', x(t)).attr('y', mt + side + 16).text(t);
      g.append('text').attr('class', 'ci-t').attr('text-anchor', 'end').attr('x', ml - 8).attr('y', y(t) + 4).text(t);
    });
    g.append('line').attr('class', 'ci-ref').attr('x1', x(0)).attr('y1', y(0)).attr('x2', x(100)).attr('y2', y(100));
    g.append('text').attr('class', 'ci-t').attr('x', ml).attr('y', mt + side + 32).text('Predicted win chance, %  ·  rows: actual, %');
    series.slice().reverse().forEach((sn) => {
      const k = series.indexOf(sn), d = data.filter((r) => r.innings === pn && r.surface === sn).sort((a, b) => N(a.predicted) - N(b.predicted));
      g.append('path').attr('d', d3.line().x((r) => x(N(r.predicted))).y((r) => y(N(r.actual)))(d)).style('fill', 'none').style('stroke', C(k)).style('stroke-width', 2);
      g.selectAll(null).data(d).join('circle').attr('cx', (r) => x(N(r.predicted))).attr('cy', (r) => y(N(r.actual))).attr('r', 4).style('fill', C(k)).style('stroke', 'var(--color-bg)').style('stroke-width', 1.5);
      d.forEach((r) => pts.push({ r, pn, sn, px: ox + x(N(r.predicted)), py: oy + y(N(r.actual)) }));
    });
  });
  svg.append('rect').attr('x', 0).attr('y', 0).attr('width', w).attr('height', +svg.attr('height')).style('fill', 'transparent')
    .on('pointermove', (ev) => {
      const [mx, my] = d3.pointer(ev, svg.node()); const p = d3.least(pts, (q) => (q.px - mx) ** 2 + (q.py - my) ** 2);
      if (!p || (p.px - mx) ** 2 + (p.py - my) ** 2 > 700) { hideTip(tip); return; }
      showTip(tip, el, ev, [`${p.pn}: ${p.sn} surface`, `Predicted ${N(p.r.predicted).toFixed(0)}%, actually won ${N(p.r.actual).toFixed(0)}%`, `${fmtInt(N(p.r.balls))} balls`]);
    })
    .on('pointerleave', () => hideTip(tip));
});

// ---------- controls: these only listen and set state, classes and attributes
function openTab(id, link) {
  document.querySelectorAll('.ci-page').forEach((s) => { s.hidden = s.id !== id; });
  document.querySelectorAll('.ci-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
  if (link) dash.setLink(id);
}
document.querySelectorAll('.ci-tab').forEach((b) => b.addEventListener('click', () => openTab(b.dataset.tab, true)));
document.querySelectorAll('.ci-variant').forEach((sel) => sel.addEventListener('change', () => {
  const role = sel.dataset.role; S.variant[role] = sel.value;
  const t = document.getElementById(role + '-table'); if (t) t.classList.toggle('ci-final', sel.value === 'rank');
  dash.draw('rankhead'); dash.draw('ranktable');
}));
document.querySelectorAll('.ci-more').forEach((btn) => btn.addEventListener('click', () => {
  const role = btn.dataset.role; S.more[role] = !S.more[role]; btn.setAttribute('aria-pressed', String(S.more[role])); dash.draw('ranktable');
}));
document.querySelectorAll('#role-select').forEach((sel) => sel.addEventListener('change', () => {
  S.role = sel.value; S.a = null; S.b = null;
  document.querySelectorAll('#card-bat').forEach((n) => { n.hidden = S.role !== 'bat'; });
  document.querySelectorAll('#card-bowl').forEach((n) => { n.hidden = S.role !== 'bowl'; });
  dash.draw('playersel'); CARD.forEach((n) => dash.draw(n));
}));
document.querySelectorAll('.ci-sw').forEach((n) => { n.style.background = n.dataset.sw === 'm' ? MUTED : C(+n.dataset.sw); });
const first = (location.hash || '').slice(1);
if (['overview', 'lab', 'batters', 'bowlers', 'player', 'model'].includes(first)) openTab(first, false);
