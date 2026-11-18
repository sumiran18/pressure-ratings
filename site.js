window.renderLanding = function (tables) {
  var host = document.getElementById('landing');
  if (!host) return;
  var el = function (tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  var ranked = function (rows) { return rows.slice().sort(function (a, b) { return +a.rank - +b.rank; }).slice(0, 10); };
  var jump = function (tab) {
    var b = document.querySelector('.ci-tab[data-tab="' + tab + '"]');
    if (b) { b.click(); document.getElementById('tabs').scrollIntoView({ block: 'start' }); }
  };
  var card = function (r, figure, unit, expected, average) {
    var c = el('article', 'spot-card' + (+r.rank === 1 ? ' spot-first' : ''));
    c.appendChild(el('span', 'spot-rank', '#' + r.rank));
    c.appendChild(el('h3', 'spot-name', r.name));
    c.appendChild(el('p', 'spot-team', r.teams));
    var num = el('p', 'spot-num'); num.appendChild(el('b', null, figure)); num.appendChild(document.createTextNode(' ' + unit)); c.appendChild(num);
    c.appendChild(el('p', 'spot-ctx', average + ' on the same balls: ' + expected));
    return c;
  };
  var column = function (title, rows, tab, more, pick) {
    var col = el('section', 'spot-col');
    col.appendChild(el('h2', 'spot-h', title));
    var top = ranked(rows), cards = el('div', 'spot-cards');
    top.slice(0, 3).forEach(function (r) { cards.appendChild(pick(r)); });
    col.appendChild(cards);
    var rest = el('ol', 'spot-rest');
    top.slice(3).forEach(function (r) { var li = el('li'); li.appendChild(el('span', 'spot-n', r.rank)); li.appendChild(document.createTextNode(r.name)); rest.appendChild(li); });
    col.appendChild(rest);
    var btn = el('button', 'spot-more', more); btn.type = 'button'; btn.addEventListener('click', function () { jump(tab); }); col.appendChild(btn);
    return col;
  };
  host.className = 'spot';
  host.replaceChildren(
    column('Top batters under pressure', tables.batters, 'batters', 'Full batting table', function (r) { return card(r, r.p_sr, 'strike rate under pressure', r.p_xsr, 'An average batter'); }),
    column('Top bowlers under pressure', tables.bowlers, 'bowlers', 'Full bowling table', function (r) { return card(r, r.p_econ, 'economy under pressure', r.p_xecon, 'An average bowler'); })
  );
};

window.extraTables = ['worked_example'];

(function () {
  var val = function (v) { return v === '' || v == null ? NaN : +v; };
  var el = function (tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  var ranked = function (rows) { return rows.slice().sort(function (a, b) { return +a.rank - +b.rank; }); };
  var plus = function (x, d) { return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d == null ? 1 : d); };
  var thousands = d3.format(',');

  var canvas = function (host, h) {
    host.replaceChildren();
    var w = Math.max(280, host.clientWidth || 640);
    var svg = d3.select(host).append('svg').attr('viewBox', '0 0 ' + w + ' ' + h).attr('height', h);
    var tip = el('div', 'ci-tip'); tip.hidden = true; host.appendChild(tip);
    return { svg: svg, w: w, tip: tip };
  };
  var show = function (tip, host, ev, lines) {
    tip.replaceChildren.apply(tip, lines.filter(function (t) { return t != null && t !== ''; }).map(function (t, i) { return el(i ? 'span' : 'b', null, t); }));
    tip.hidden = false;
    var r = host.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    var x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 14;
    if (x + tw > r.width) x = Math.max(0, ev.clientX - r.left - tw - 14);
    if (y + th > r.height) y = Math.max(0, r.height - th);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  };
  var card = function (id, title, note) {
    var b = el('div', 'ci-block'); b.id = id;
    b.appendChild(el('h3', 'ci-h3', title));
    if (note) b.appendChild(el('p', 'ci-note', note));
    return b;
  };
  var plot = function (name, label) { var c = el('div', 'ci-chart'); c.dataset.draw = name; c.setAttribute('role', 'img'); c.setAttribute('aria-label', label); return c; };
  var putAfter = function (id, node) { var ref = document.getElementById(id); if (ref) ref.insertAdjacentElement('afterend', node); };

  // actual against expected: the headline figure for each player
  var SIDE = {
    bat: { rows: 'batters', one: 'batter', many: 'batters', anchor: 'bat-ranking', act: 'p_sr', exp: 'p_xsr', dec: 0, stat: 'Strike rate',
      gap: function (r) { return val(r.p_sr) - val(r.p_xsr); }, gapName: 'Above expected', verb: 'beat the expected strike rate', axis: 'Strike rate above or below expected, pressure balls',
      better: 'above expected', worse: 'below expected', value: 'Runs above average per 100 balls at high pressure' },
    bowl: { rows: 'bowlers', one: 'bowler', many: 'bowlers', anchor: 'bowl-ranking', act: 'p_econ', exp: 'p_xecon', dec: 2, stat: 'Economy',
      gap: function (r) { return val(r.p_xecon) - val(r.p_econ); }, gapName: 'Saved per over', verb: 'concede less than expected', axis: 'Runs an over saved against expected, pressure balls',
      better: 'an over better than expected', worse: 'an over worse than expected', value: 'Runs saved above average per 100 balls at high pressure' }
  };

  // ---- worked example and pipeline on the landing page
  var example = function (tables) {
    var host = document.getElementById('landing'), rows = tables.worked_example;
    if (!host || !rows || !rows.length) return;
    var first = rows[0], last = rows[rows.length - 1], sumRun = d3.sum(rows, function (r) { return val(r.rae); }), sumWin = d3.sum(rows, function (r) { return val(r.wpaa); });
    var peak = d3.max(rows, function (r) { return val(r.wpaa); });
    var box = el('section', 'spot-wide wx');
    box.appendChild(el('h2', 'spot-h', 'The same six: worth ' + first.wpaa + ' points of win chance with ' + first.need + ' needed, ' + last.wpaa + ' with ' + last.need + ' needed'));
    box.appendChild(el('p', 'ci-note', first.striker_name + ' off ' + first.bowler_name + ', ' + first.fixture + ', ' + first.comp_name + ', ' + first.match_date + '. Every ball went for six. What changes is the situation, and with it the pressure and what the shot was worth.'));
    var strip = el('div', 'wx-strip');
    rows.forEach(function (r) {
      var c = el('article', 'wx-ball');
      c.appendChild(el('p', 'wx-ob', 'Ball ' + r.ob));
      c.appendChild(el('p', 'wx-sit', r.need + ' needed off ' + r.balls_left));
      var dl = el('dl', 'wx-rows');
      [['Pressure Index', Math.round(val(r.pi))], ['Win chance before', r.wp_before + '%'], ['Runs: actual − expected', r.runs + ' − ' + val(r.x_runs).toFixed(1) + ' = ' + plus(val(r.rae))]].forEach(function (p) {
        var row = el('div'); row.appendChild(el('dt', null, p[0])); row.appendChild(el('dd', null, p[1])); dl.appendChild(row);
      });
      c.appendChild(dl);
      var meter = el('div', 'wx-meter'); meter.setAttribute('role', 'img'); meter.setAttribute('aria-label', 'Pressure Index ' + r.pi + ' of 100');
      var fill = el('i'); fill.style.width = Math.max(1, val(r.pi)) + '%'; meter.appendChild(fill); c.appendChild(meter);
      var gain = el('p', 'wx-gain'); gain.appendChild(el('b', null, plus(val(r.wpaa)))); gain.appendChild(document.createTextNode(' points of win chance added')); c.appendChild(gain);
      var bar = el('div', 'wx-bar'); var bf = el('i'); bf.style.width = Math.max(1, 100 * val(r.wpaa) / peak) + '%'; bar.appendChild(bf); c.appendChild(bar);
      strip.appendChild(c);
    });
    box.appendChild(strip);
    var lastTwo = d3.sum(rows.slice(-2), function (r) { return val(r.wpaa); });
    box.appendChild(el('p', 'wx-sum', 'Added up: ' + plus(sumRun) + ' runs above average and ' + plus(sumWin) + ' points of win chance from ' + rows.length + ' balls. The last two balls carry ' + Math.round(100 * lastTwo / sumWin) + '% of the win chance. Runs above average treats the sixes alike; the Pressure Index and win chance added are what tell them apart.'));
    host.appendChild(box);
  };

  var pipeline = function (tables) {
    var host = document.getElementById('landing'), s = tables.summary && tables.summary[0];
    if (!host || !s) return;
    var steps = [
      ['Data', thousands(val(s.balls_rated)) + ' balls from ' + thousands(val(s.matches_rated)) + ' IPL and T20I matches, each rebuilt into the state of the game before it was bowled.'],
      ['Win-probability engine', 'The chance of winning from any score, wickets down and balls left, checked against matches it had not seen.'],
      ['Pressure Index', 'How far the next ball can move that chance, compared with an average ball. Scored 0 to 100 and known before the ball is bowled.'],
      ['Ball value', 'Actual against expected: runs and win chance above what an average player would do with that exact ball.'],
      ['Player model', 'Pools every ball a player faced or bowled and pulls small samples toward the average. ' + s.batters + ' batters and ' + s.bowlers + ' bowlers have enough pressure balls to rank.'],
      ['Clutch Index', 'The rating at high pressure and the wins added on pressure balls, combined into one 0 to 100 score with a range around every rank.']
    ];
    var box = el('section', 'spot-wide pipe');
    box.appendChild(el('h2', 'spot-h', 'Six steps take one ball to a rank'));
    var ol = el('ol', 'pipe-steps');
    steps.forEach(function (st, i) { var li = el('li'); li.appendChild(el('span', 'pipe-n', i + 1)); li.appendChild(el('h3', 'pipe-t', st[0])); li.appendChild(el('p', 'pipe-d', st[1])); ol.appendChild(li); });
    box.appendChild(ol);
    host.appendChild(box);
  };

  // ---- highest ranked and lowest ranked, with the gap to expected
  var highLow = function (tables, key) {
    var S = SIDE[key], all = ranked(tables[S.rows]), hi = all.slice(0, 5), lo = all.slice(-5).reverse();
    var mean = function (rows) { return d3.mean(rows, S.gap); };
    var say = function (m) { return Math.abs(m).toFixed(S.dec === 0 ? 0 : 2) + ' ' + (m >= 0 ? S.better : S.worse); };
    var b = card(key + '-highlow', 'The five highest-ranked ' + S.many + ' average ' + say(mean(hi)) + ' on pressure balls; the five lowest, ' + say(mean(lo)),
      'Actual is what the player did on pressure balls. Expected is what an average ' + S.one + ' would do on the same balls. Green cells beat expectation; red cells fall short.');
    var pair = el('div', 'hl-pair');
    [['Highest ranked', hi, 'hl-up'], ['Lowest ranked', lo, 'hl-down']].forEach(function (g) {
      var col = el('div', 'hl-col'); col.appendChild(el('p', 'hl-tag ' + g[2], g[0]));
      var scroll = el('div', 'ci-scroll'), t = el('table', 'ci-table hl-table'), tr = el('tr');
      [['#', 1], [key === 'bat' ? 'Batter' : 'Bowler', 0], [S.stat, 1], ['Expected', 1], [S.gapName, 1]].forEach(function (h) { tr.appendChild(el('th', h[1] ? 'ci-n' : null, h[0])); });
      var thead = el('thead'); thead.appendChild(tr); t.appendChild(thead);
      var tb = el('tbody');
      g[1].forEach(function (r) {
        var row = el('tr'), gap = S.gap(r);
        row.appendChild(el('td', 'ci-n', r.rank)); row.appendChild(el('td', null, r.name));
        row.appendChild(el('td', 'ci-n', r[S.act])); row.appendChild(el('td', 'ci-n', r[S.exp]));
        row.appendChild(el('td', 'ci-n hl-cell ' + (gap >= 0 ? 'hl-good' : 'hl-bad'), plus(gap, S.dec)));
        tb.appendChild(row);
      });
      t.appendChild(tb); scroll.appendChild(t); col.appendChild(scroll); pair.appendChild(col);
    });
    b.appendChild(pair);
    putAfter(S.anchor, b);
    return b;
  };

  // ---- every eligible player: actual against expected, as diverging bars
  var drawGap = function (host, rows, S) {
    var data = rows.map(function (r) { return { r: r, g: S.gap(r) }; }).filter(function (d) { return !isNaN(d.g); }).sort(function (a, b) { return b.g - a.g; });
    var h = 300, f = canvas(host, h), ml = 44, mr = 10, mt = 26, mb = 30;
    var x = d3.scaleBand().domain(d3.range(data.length)).range([ml, f.w - mr]).paddingInner(0.18);
    var y = d3.scaleLinear().domain(d3.extent(data, function (d) { return d.g; })).nice().range([h - mb, mt]);
    y.ticks(5).forEach(function (t) {
      f.svg.append('line').attr('class', t === 0 ? 'ci-ref' : 'ci-grid').attr('x1', ml).attr('x2', f.w - mr).attr('y1', y(t)).attr('y2', y(t));
      f.svg.append('text').attr('class', 'ci-t').attr('x', ml - 6).attr('y', y(t) + 4).attr('text-anchor', 'end').text(plus(t, S.dec === 0 ? 0 : 1));
    });
    f.svg.append('g').selectAll('rect').data(data).join('rect').attr('x', function (d, i) { return x(i); }).attr('width', Math.max(1, x.bandwidth()))
      .attr('y', function (d) { return Math.min(y(0), y(d.g)); }).attr('height', function (d) { return Math.max(1, Math.abs(y(d.g) - y(0))); }).attr('rx', Math.min(2, x.bandwidth() / 2))
      .style('fill', function (d) { return +d.r.rank <= 10 ? 'var(--ci-s0)' : 'var(--chart-muted)'; });
    var best = data[0], worst = data[data.length - 1];
    f.svg.append('text').attr('class', 'ci-tt').attr('x', x(0)).attr('y', y(best.g) - 6).text(best.r.name + ' ' + plus(best.g, S.dec));
    f.svg.append('text').attr('class', 'ci-tt').attr('x', x(data.length - 1) + x.bandwidth()).attr('y', y(worst.g) + 14).attr('text-anchor', 'end').text(worst.r.name + ' ' + plus(worst.g, S.dec));
    f.svg.append('text').attr('class', 'ci-t').attr('x', ml).attr('y', h - 8).text('← most ' + (S.dec === 0 ? 'above' : 'saved against') + ' expected');
    f.svg.append('text').attr('class', 'ci-t').attr('x', f.w - mr).attr('y', h - 8).attr('text-anchor', 'end').text('furthest behind →');
    f.svg.append('g').selectAll('rect').data(data).join('rect').attr('x', function (d, i) { return x(i) - x.step() * 0.09; }).attr('width', x.step()).attr('y', mt).attr('height', h - mb - mt).style('fill', 'transparent')
      .on('pointermove', function (ev, d) { show(f.tip, host, ev, [d.r.name, S.stat + ' ' + d.r[S.act] + ', expected ' + d.r[S.exp], S.gapName + ' ' + plus(d.g, S.dec), 'Clutch Index rank ' + d.r.rank]); })
      .on('pointerleave', function () { f.tip.hidden = true; });
  };
  var gapBlock = function (tables, key, anchor) {
    var S = SIDE[key], rows = tables[S.rows], topTen = rows.filter(function (r) { return +r.rank <= 10; });
    var t = topTen.filter(function (r) { return S.gap(r) > 0; }).length, n = rows.filter(function (r) { return S.gap(r) > 0; }).length;
    var b = card(key + '-gap', (t === topTen.length ? 'All ' + t : t + ' of ' + topTen.length) + ' of the top ten ' + S.verb + ' on their pressure balls; ' + n + ' of all ' + rows.length + ' eligible ' + S.many + ' do',
      'One bar for each eligible ' + S.one + ', ordered from furthest ahead of expectation to furthest behind. The top ten on the Clutch Index are highlighted. Point at a bar for the player.');
    var lg = el('div', 'ci-legend');
    [['var(--ci-s0)', 'Top ten on the Clutch Index', '0'], ['var(--chart-muted)', 'Other eligible ' + S.many, 'm']].forEach(function (p) { var s = el('span'), i = el('i', 'ci-sw'); i.dataset.sw = p[2]; i.style.background = p[0]; s.appendChild(i); s.appendChild(document.createTextNode(p[1])); lg.appendChild(s); });
    b.appendChild(lg);
    b.appendChild(plot('gap-' + key, S.axis + ' for every eligible ' + S.one));
    putAfter(anchor, b);
    dash.draw('gap-' + key, function (host) { drawGap(host, rows, S); });
    return b;
  };

  // ---- where the top ten sit in the whole field
  var drawHist = function (host, rows, get, label, dec) {
    var data = rows.map(function (r) { return { r: r, v: get(r) }; }).filter(function (d) { return !isNaN(d.v); });
    var h = 250, f = canvas(host, h), ml = 30, mr = 12, mt = 64, mb = 40;
    var x = d3.scaleLinear().domain(d3.extent(data, function (d) { return d.v; })).nice().range([ml, f.w - mr]);
    var bins = d3.bin().value(function (d) { return d.v; }).domain(x.domain()).thresholds(x.ticks(f.w < 480 ? 12 : 18))(data);
    var y = d3.scaleLinear().domain([0, d3.max(bins, function (b) { return b.length; })]).range([h - mb, mt]);
    y.ticks(3).forEach(function (t) {
      f.svg.append('line').attr('class', 'ci-grid').attr('x1', ml).attr('x2', f.w - mr).attr('y1', y(t)).attr('y2', y(t));
      f.svg.append('text').attr('class', 'ci-t').attr('x', ml - 6).attr('y', y(t) + 4).attr('text-anchor', 'end').text(t);
    });
    x.ticks(f.w < 480 ? 4 : 7).forEach(function (t) { f.svg.append('text').attr('class', 'ci-t').attr('x', x(t)).attr('y', h - mb + 16).attr('text-anchor', 'middle').text(plus(t, 0)); });
    f.svg.append('text').attr('class', 'ci-t').attr('x', (ml + f.w - mr) / 2).attr('y', h - 6).attr('text-anchor', 'middle').text(label);
    f.svg.append('g').selectAll('rect').data(bins).join('rect').attr('x', function (b) { return x(b.x0) + 1; }).attr('width', function (b) { return Math.max(1, x(b.x1) - x(b.x0) - 2); })
      .attr('y', function (b) { return y(b.length); }).attr('height', function (b) { return y(0) - y(b.length); }).attr('rx', 2).style('fill', 'var(--chart-muted)')
      .on('pointermove', function (ev, b) { show(f.tip, host, ev, [plus(b.x0, dec) + ' to ' + plus(b.x1, dec), b.length + (b.length === 1 ? ' player' : ' players')]); })
      .on('pointerleave', function () { f.tip.hidden = true; });
    var med = d3.median(data, function (d) { return d.v; });
    f.svg.append('line').attr('class', 'ci-ref').attr('x1', x(med)).attr('x2', x(med)).attr('y1', mt - 40).attr('y2', h - mb);
    f.svg.append('text').attr('class', 'ci-t').attr('x', x(med) - 5).attr('y', mt - 32).attr('text-anchor', 'end').text('median ' + plus(med, dec));
    var marks = [];
    bins.forEach(function (b) { b.filter(function (d) { return +d.r.rank <= 10; }).sort(function (p, q) { return +q.r.rank - +p.r.rank; }).forEach(function (d, k) { marks.push({ d: d, cx: (x(b.x0) + x(b.x1)) / 2, cy: y(b.length) - 9 - k * 11 }); }); });
    f.svg.append('g').selectAll('circle').data(marks).join('circle').attr('cx', function (m) { return m.cx; }).attr('cy', function (m) { return m.cy; }).attr('r', 4.5).style('fill', 'var(--ci-s0)').style('stroke', 'var(--color-bg)').style('stroke-width', 1.5);
    var lead = marks.filter(function (m) { return +m.d.r.rank === 1; })[0];
    if (lead) f.svg.append('text').attr('class', 'ci-tt').attr('x', lead.cx - 9).attr('y', lead.cy + 4).attr('text-anchor', 'end').text(lead.d.r.name);
    f.svg.append('g').selectAll('circle').data(marks).join('circle').attr('cx', function (m) { return m.cx; }).attr('cy', function (m) { return m.cy; }).attr('r', 9).style('fill', 'transparent')
      .on('pointermove', function (ev, m) { show(f.tip, host, ev, [m.d.r.rank + '. ' + m.d.r.name, label + ' ' + plus(m.d.v, dec)]); })
      .on('pointerleave', function () { f.tip.hidden = true; });
  };
  var distBlock = function (tables, key, anchor) {
    var S = SIDE[key], rows = tables[S.rows], top = rows.filter(function (r) { return +r.rank <= 10; });
    var est = function (r) { return val(r.est100); }, wins = function (r) { return val(r.wins); };
    var minE = d3.min(top, est), medE = d3.median(rows, est), minW = d3.min(top, wins), maxW = d3.max(top, wins), medW = d3.median(rows, wins);
    var wrap = el('div', 'ci-two'); wrap.id = key + '-dist';
    var a = card(key + '-dist-rating', (minE > 0 ? 'Every top-ten ' + S.one + ' is worth at least ' + plus(minE) + ' runs per 100 balls under pressure' : 'The top ten start at ' + plus(minE) + ' runs per 100 balls under pressure') + '; the middle of the field is at ' + plus(medE),
      'All ' + rows.length + ' eligible ' + S.many + ' by the model’s estimate. Dots are the top ten, stacked on the bar they fall in.');
    a.appendChild(plot('dist-rating-' + key, 'Distribution of ' + S.value.toLowerCase() + ' across eligible ' + S.many));
    var b = card(key + '-dist-wins', 'The top ten added between ' + plus(minW) + ' and ' + plus(maxW) + ' wins on pressure balls; the middle of the field added ' + plus(medW),
      'Wins added is the win chance a player gained for the side on pressure balls, above an average ' + S.one + ', summed and expressed in matches.');
    b.appendChild(plot('dist-wins-' + key, 'Distribution of wins added under pressure across eligible ' + S.many));
    wrap.appendChild(a); wrap.appendChild(b);
    putAfter(anchor, wrap);
    dash.draw('dist-rating-' + key, function (host) { drawHist(host, rows, est, S.value, 1); });
    dash.draw('dist-wins-' + key, function (host) { drawHist(host, rows, wins, 'Wins added on pressure balls', 1); });
  };

  window.renderViews = function (tables, flag) {
    var attempt = function (name, fn) { try { fn(); } catch (e) { flag(name + ': ' + e.message); } };
    attempt('example', function () { example(tables); });
    attempt('pipeline', function () { pipeline(tables); });
    ['bat', 'bowl'].forEach(function (key) {
      attempt('views-' + key, function () {
        var hl = highLow(tables, key), gap = gapBlock(tables, key, hl.id);
        distBlock(tables, key, gap.id);
      });
    });
  };
})();

(function () {
  var problems = [], drawings = {}, tables = {};
  var flag = function (m) { problems.push(m); document.documentElement.dataset.errors = problems.join(' | '); if (window.console) console.error(m); };
  window.addEventListener('error', function (e) { flag('error: ' + e.message); });

  var drawOne = function (name) {
    document.querySelectorAll('[data-draw="' + name + '"]').forEach(function (el) {
      if (el.closest('[hidden]')) return;
      try { if (drawings[name]) drawings[name](el); } catch (e) { flag(name + ': ' + e.message); }
    });
  };
  var drawAll = function () { Object.keys(drawings).forEach(drawOne); };

  window.dash = {
    colors: ['var(--ci-s0)', 'var(--ci-s1)', 'var(--ci-s2)'],
    data: function (id) { return tables[id] ? { status: 'ok', data: tables[id] } : { status: 'missing', data: [] }; },
    draw: function (name, fn) { if (fn) drawings[name] = fn; else drawOne(name); },
    onData: function (fn) { fn(); },
    setLink: function (id) { try { history.replaceState(null, '', '#' + id); } catch (e) {} },
    params: function () { return {}; }, setParams: function () {}, resetParams: function () {}, calc: function () {}, loader: function () {}, refresh: function () {}
  };

  var CSV = ['summary', 'tiers', 'heat', 'moments', 'match_balls', 'definitions', 'notes', 'splits', 'player_matches', 'player_moments', 'styles', 'lift_test', 'validity', 'calibration', 'ball_models', 'reranks'].concat(window.extraTables || []);
  var JSONS = ['batters', 'bowlers'];
  var msg = document.getElementById('site-msg'), root = document.getElementById('dash-root');
  if (!window.d3) { msg.textContent = 'The charts could not load. Check your connection and reload.'; return; }

  Promise.all(CSV.map(function (n) { return d3.csv('data/' + n + '.csv').then(function (r) { tables[n] = r; }); })
    .concat(JSONS.map(function (n) { return d3.json('data/' + n + '.json').then(function (r) { tables[n] = r.rows; }); })))
    .then(function () {
      root.hidden = false; msg.hidden = true;
      if (window.renderLanding) { try { window.renderLanding(tables); } catch (e) { flag('landing: ' + e.message); } }
      if (window.renderViews) { try { window.renderViews(tables, flag); } catch (e) { flag('views: ' + e.message); } }
      var s = document.createElement('script'); s.src = 'app.js';
      s.onload = function () {
        drawAll();
        new MutationObserver(function (list) {
          if (list.some(function (m) { return !m.target.closest('[data-draw]'); })) drawAll();
        }).observe(root, { attributes: true, attributeFilter: ['hidden'], subtree: true });
        var timer = null, width = window.innerWidth;
        window.addEventListener('resize', function () {
          if (window.innerWidth === width) return;
          width = window.innerWidth; clearTimeout(timer); timer = setTimeout(drawAll, 150);
        });
        document.documentElement.dataset.ready = '1';
      };
      s.onerror = function () { flag('app.js failed to load'); };
      document.body.appendChild(s);
    })
    .catch(function (e) { flag('data: ' + e.message); msg.textContent = 'The data could not load. Reload the page to try again.'; });
})();
