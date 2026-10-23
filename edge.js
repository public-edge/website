// Public Edge hero: a deterministic model of how Public Edge Manager answers DNS.
// Candidates are excluded on evidence, short probe failures keep the last known good
// answer for a hold window, and each locality gets the best remaining edge.
(function () {
  var root = document.querySelector('[data-edge]');
  if (!root) return;
  var copy = JSON.parse(document.getElementById('site-copy').textContent);
  var NS = 'http://www.w3.org/2000/svg';
  var svg = root.querySelector('svg');
  var pane = root.querySelector('[data-edge-pane]');
  var verdict = root.querySelector('[data-edge-verdict]');
  var HOLD = 6;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, attrs, parent) {
    var node = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    if (parent) parent.appendChild(node);
    return node;
  }
  function text(parent, x, y, value, cls, anchor) {
    var node = el('text', { x: x, y: y, class: cls, 'text-anchor': anchor || 'middle' }, parent);
    node.textContent = value;
    return node;
  }

  var clients = [
    { id: 'apac', y: 84 }, { id: 'emea', y: 184 }, { id: 'amer', y: 284 }
  ];
  var edges = [
    { name: 'edge-ap-1', region: 'apac', priority: 1, y: 58 },
    { name: 'edge-ap-2', region: 'apac', priority: 2, y: 136 },
    { name: 'edge-eu-1', region: 'emea', priority: 1, y: 214 },
    { name: 'edge-us-1', region: 'amer', priority: 1, y: 292 }
  ];
  var CYCLE = ['healthy', 'full', 'failing', 'unready'];
  edges.forEach(function (edge) { edge.state = 'healthy'; edge.failingFor = 0; });
  var clock = 0;
  var lastAnswer = {};

  el('rect', { x: 222, y: 20, width: 156, height: 316, rx: 10, class: 'svg-zone' }, svg);
  text(svg, 300, 44, 'PublicEdgeManager', 'svg-title');
  text(svg, 300, 60, copy.zone, 'svg-mono');
  text(svg, 300, 318, copy.zoneFoot, 'svg-mono');
  var gRoutes = el('g', {}, svg);
  var gShapes = el('g', {}, svg);

  clients.forEach(function (client) {
    el('rect', { x: 14, y: client.y - 20, width: 150, height: 40, rx: 8, class: 'svg-box' }, gShapes);
    text(gShapes, 28, client.y - 2, copy.regions[client.id], 'svg-title', 'start');
    text(gShapes, 28, client.y + 12, copy.clients, 'svg-mono', 'start');
    client.route = el('path', { fill: 'none', 'stroke-width': 2.2, 'stroke-linecap': 'round', class: reduced ? '' : 'flow-line' }, gRoutes);
  });

  edges.forEach(function (edge) {
    var group = el('g', { class: 'hit', tabindex: '0', role: 'button', 'aria-pressed': 'false' }, gShapes);
    edge.box = el('rect', { x: 412, y: edge.y - 22, width: 176, height: 44, rx: 8, class: 'svg-box focus-ring' }, group);
    edge.dot = el('circle', { cx: 428, cy: edge.y - 6, r: 4.5 }, group);
    text(group, 440, edge.y - 2, edge.name, 'svg-title', 'start');
    edge.sub = text(group, 428, edge.y + 13, '', 'svg-mono', 'start');
    edge.ring = el('circle', { cx: 568, cy: edge.y, r: 9, fill: 'none', stroke: 'var(--warn)', 'stroke-width': 2.5, 'stroke-dasharray': '0 57', transform: 'rotate(-90 568 ' + edge.y + ')' }, group);
    edge.group = group;
    var cycle = function () {
      edge.state = CYCLE[(CYCLE.indexOf(edge.state) + 1) % CYCLE.length];
      edge.failingFor = 0;
      update();
    };
    group.addEventListener('click', cycle);
    group.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); cycle(); }
    });
  });

  // A failing probe stays eligible while the last-known-good hold lasts.
  function eligible(edge) {
    if (edge.state === 'unready') return false;
    if (edge.state === 'failing') return edge.failingFor < HOLD;
    return true;
  }
  function choose(client) {
    var ranked = edges.filter(eligible).sort(function (a, b) {
      return (a.region === client.id ? 0 : 1) - (b.region === client.id ? 0 : 1) ||
        (a.state === 'full' ? 1 : 0) - (b.state === 'full' ? 1 : 0) ||
        // The hold protects a locality's current answer; failover never moves onto a failing edge.
        (a.state === 'failing' && a.region !== client.id ? 1 : 0) - (b.state === 'failing' && b.region !== client.id ? 1 : 0) ||
        a.priority - b.priority || (a.name < b.name ? -1 : 1);
    });
    return ranked[0] || null;
  }

  function color(state) {
    return { healthy: 'var(--ok)', full: 'var(--warn)', failing: 'var(--warn)', unready: 'var(--bad)' }[state];
  }

  function line(spans) {
    var div = document.createElement('div');
    spans.forEach(function (part) {
      var span = document.createElement('span');
      if (part[1]) span.className = part[1];
      span.textContent = part[0];
      div.appendChild(span);
    });
    pane.appendChild(div);
  }

  function update() {
    edges.forEach(function (edge) {
      var holding = edge.state === 'failing' && edge.failingFor < HOLD;
      var expired = edge.state === 'failing' && !holding;
      edge.dot.setAttribute('fill', expired ? 'var(--bad)' : color(edge.state));
      edge.sub.textContent = copy.regionsShort[edge.region] + ' · ' + (expired ? copy.states.expired : copy.states[edge.state]);
      edge.box.setAttribute('stroke-dasharray', eligible(edge) ? '' : '4 4');
      edge.group.setAttribute('aria-label', edge.name + ', ' + edge.sub.textContent + '. ' + copy.cycleHint);
      var arc = holding ? 57 * (1 - edge.failingFor / HOLD) : 0;
      edge.ring.setAttribute('stroke-dasharray', arc.toFixed(1) + ' 57');
    });

    pane.textContent = '';
    line([['$ edgectl status', 'dim'], ['   t+' + clock + 's', 'dim']]);
    var changed = [];
    clients.forEach(function (client) {
      var edge = choose(client);
      var answer = edge ? edge.name : copy.fallback;
      if (lastAnswer[client.id] && lastAnswer[client.id] !== answer) changed.push(copy.regionsShort[client.id]);
      lastAnswer[client.id] = answer;
      line([['app.example.com  ' + pad(copy.regionsShort[client.id], 5) + ' → '], [answer, edge ? (edge.region === client.id ? 'ok' : 'warn') : 'bad']]);
      var y2 = edge ? edge.y : 330;
      client.route.setAttribute('d', 'M164 ' + client.y + ' C 260 ' + client.y + ', 330 ' + y2 + ', 412 ' + y2);
      client.route.setAttribute('stroke', edge ? (edge.region === client.id ? 'var(--ok)' : 'var(--warn)') : 'var(--bad)');
      client.route.setAttribute('stroke-dasharray', edge ? '6 6' : '2 5');
    });
    edges.forEach(function (edge) {
      if (edge.state === 'unready') line([[copy.excluded + ' ' + edge.name + ' (' + copy.states.unready + ')', 'bad']]);
      else if (edge.state === 'failing' && edge.failingFor < HOLD) line([[copy.holding + ' ' + edge.name + ' (' + copy.lkg.replace('{s}', HOLD - edge.failingFor) + ')', 'warn']]);
      else if (edge.state === 'failing') line([[copy.excluded + ' ' + edge.name + ' (' + copy.states.expired + ')', 'bad']]);
    });

    var holdingAny = edges.some(function (edge) { return edge.state === 'failing' && edge.failingFor < HOLD; });
    var crossRegion = clients.some(function (client) { var edge = choose(client); return !edge || edge.region !== client.id; });
    verdict.textContent = '';
    var b = document.createElement('b');
    var span = document.createElement('span');
    if (holdingAny) { verdict.dataset.state = 'hold'; b.textContent = copy.verdict.holdTitle; span.textContent = copy.verdict.hold; }
    else if (crossRegion) { verdict.dataset.state = 'hold'; b.textContent = copy.verdict.crossTitle; span.textContent = copy.verdict.cross; }
    else { verdict.dataset.state = 'ok'; b.textContent = copy.verdict.okTitle; span.textContent = copy.verdict.ok; }
    if (changed.length) span.textContent += ' ' + copy.verdict.changed.replace('{list}', changed.join(', '));
    verdict.appendChild(b);
    verdict.appendChild(span);
  }
  function pad(value, size) { while (value.length < size) value += ' '; return value; }

  setInterval(function () {
    if (document.hidden) return;
    clock += 1;
    var dirty = false;
    edges.forEach(function (edge) { if (edge.state === 'failing' && edge.failingFor < HOLD) { edge.failingFor += 1; dirty = true; } });
    if (dirty || clock % 5 === 0) update();
  }, 1000);
  update();
})();
