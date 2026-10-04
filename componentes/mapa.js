/* Mapa interativo de Lumina. Sem dependências.
   Emite: document 'lumina:progresso' { detail: { feitos, total } } a cada lugar concluído. */
(function () {
  'use strict';

  var raiz = document.getElementById('mapa-jogo');
  if (!raiz) return;

  var W = 1400, H = 781;
  var PARADA = 52;          // o herói para a esta distância (px da imagem) antes da estrela
  var VELOCIDADE = 330;     // px da imagem por segundo
  var DUR_MIN = 0.7, DUR_MAX = 3.2;
  var SERES_RODIZIO = ['formiga.webp', 'goblin.webp', 'golem.webp', 'morcego.webp', 'slime.webp'];
  var base = raiz.getAttribute('data-base');
  if (base == null) base = 'arte/';

  /* Caminho pontilhado em coordenadas da imagem (medido nos pontinhos de mapa-dia.webp).
     Pontos repetidos entre cadeias viram cruzamentos. */
  var CADEIAS = [
    // Caminho principal: esquerda, arco pelo topo, desce até o rio, ponte, segue à direita
    [[138, 311], [165, 294], [192, 276], [221, 256], [247, 241], [279, 232], [307, 222], [341, 214], [373, 209],
     [405, 204], [436, 199], [467, 195], [497, 191], [528, 186], [560, 180], [592, 175], [624, 169], [656, 165],
     [689, 163], [721, 163], [754, 167], [783, 175], [810, 185], [835, 199], [859, 217], [881, 237], [902, 255],
     [925, 273], [949, 291], [974, 305], [1000, 318], [1028, 332], [1055, 341], [1072, 350], [1080, 382],
     [1076, 414], [1062, 444], [1052, 470], [1080, 466], [1110, 464], [1140, 468], [1162, 478], [1176, 491],
     [1211, 498], [1242, 504], [1262, 506]],
    // Ramo vertical: do cruzamento no alto até o caminho de baixo
    [[279, 232], [282, 254], [284, 267], [287, 301], [288, 330], [288, 357], [286, 387], [284, 416], [279, 446],
     [273, 477], [266, 506], [258, 535], [249, 564], [237, 591], [228, 617], [224, 648]],
    // Caminho de baixo: da esquerda até a beira do rio
    [[108, 596], [134, 609], [159, 622], [186, 633], [211, 644], [224, 648], [238, 654], [267, 662], [296, 669],
     [325, 675], [355, 679], [384, 682], [414, 686], [446, 688], [476, 689], [508, 690], [540, 690], [570, 689],
     [602, 687], [634, 685], [665, 682], [696, 678], [727, 673], [755, 669], [784, 661], [810, 655]],
    // Subida de luz até a Ponte de Nuvens (no céu)
    [[528, 186], [525, 162], [517, 136], [507, 110], [500, 84]]
  ];

  /* ---------- Grafo ---------- */
  var nos = {};
  function chave(p) { return p[0] + ',' + p[1]; }
  function dist(a, b) { var dx = a[0] - b[0], dy = a[1] - b[1]; return Math.sqrt(dx * dx + dy * dy); }
  CADEIAS.forEach(function (c) {
    for (var i = 0; i < c.length; i++) {
      var k = chave(c[i]);
      if (!nos[k]) nos[k] = { p: c[i], viz: [] };
      if (i > 0) {
        var kp = chave(c[i - 1]), d = dist(c[i], c[i - 1]);
        nos[k].viz.push({ k: kp, d: d });
        nos[kp].viz.push({ k: k, d: d });
      }
    }
  });
  // Dijkstra a partir do destino: devolve distância e "próximo passo" rumo ao destino
  function dijkstra(destino) {
    var d = {}, prox = {}, feito = {}, ks = Object.keys(nos);
    ks.forEach(function (k) { d[k] = Infinity; });
    d[destino] = 0;
    for (;;) {
      var u = null;
      for (var i = 0; i < ks.length; i++) if (!feito[ks[i]] && (u === null || d[ks[i]] < d[u])) u = ks[i];
      if (u === null || d[u] === Infinity) break;
      feito[u] = true;
      nos[u].viz.forEach(function (v) {
        if (d[u] + v.d < d[v.k]) { d[v.k] = d[u] + v.d; prox[v.k] = u; }
      });
    }
    return { d: d, prox: prox };
  }

  /* ---------- Elementos ---------- */
  var palco = raiz.querySelector('.mapa-jogo__palco');
  var trilhas = raiz.querySelector('[data-trilhas]');
  var seresEl = raiz.querySelector('[data-seres]');
  var faiscasEl = raiz.querySelector('[data-faiscas]');
  var painel = raiz.querySelector('[data-painel]');
  var heroiEl = raiz.querySelector('[data-heroi-sprite]');
  var heroiImg = heroiEl.querySelector('img');
  var feitosEl = raiz.querySelector('[data-feitos]');
  var heroiNomeEl = raiz.querySelector('[data-heroi-nome]');
  var retratos = Array.prototype.slice.call(raiz.querySelectorAll('.mapa-jogo__retrato'));
  var reduzido = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // Artes: aplica data-base
  Array.prototype.forEach.call(raiz.querySelectorAll('img[data-arte]'), function (img) {
    img.src = base + img.getAttribute('data-arte');
  });

  function num(elm, at, padrao) { var v = elm.getAttribute(at); return v == null || v === '' ? padrao : parseFloat(v); }
  var lugares = Array.prototype.map.call(raiz.querySelectorAll('.mapa-jogo__lugar'), function (btn) {
    var cs = btn.getAttribute('style') || '';
    var x = +(/--x:\s*(-?[\d.]+)/.exec(cs) || [0, 0])[1];
    var y = +(/--y:\s*(-?[\d.]+)/.exec(cs) || [0, 0])[1];
    return {
      btn: btn, n: +btn.getAttribute('data-lugar'), x: x, y: y, k: chave([x, y]),
      nome: btn.getAttribute('data-nome'), unidade: btn.getAttribute('data-unidade'),
      embaracado: btn.getAttribute('data-embaracado'), ser: btn.getAttribute('data-ser'),
      dica: btn.getAttribute('data-dica'), lado: btn.getAttribute('data-balao') || 'abaixo',
      parada: num(btn, 'data-parada', PARADA), serDx: num(btn, 'data-ser-dx', null), serDy: num(btn, 'data-ser-dy', 14),
      feito: false, serEl: null
    };
  });
  var TOTAL = lugares.length;

  /* ---------- Estado do herói ---------- */
  var heroi = {
    id: 'lamina', ancora: 0.28,
    pos: null, seg: null,       // posição atual e o trecho [chaveA, chaveB] onde ele está
    lugar: null,                // lugar onde está parado
    andando: false, golpeando: false
  };
  var ativo = null;             // lugar com painel aberto
  var anim = null;              // requestAnimationFrame da caminhada
  var rodizioTimer = null;
  var contTrilha = 0;

  function colocarHeroi(p) {
    heroi.pos = p;
    heroiEl.style.left = (p[0] / W * 100) + '%';
    heroiEl.style.top = (p[1] / H * 100) + '%';
    heroiEl.classList.toggle('is-no-ceu', p[1] < 150);
  }
  function virar(paraEsquerda) { heroiEl.classList.toggle('is-esquerda', !!paraEsquerda); }

  // Ponto a uma distância s ao longo de uma polilinha
  function medir(pts) {
    var acc = [0];
    for (var i = 1; i < pts.length; i++) acc.push(acc[i - 1] + dist(pts[i - 1], pts[i]));
    return acc;
  }
  function pontoEm(pts, acc, s) {
    if (s <= 0) return { p: pts[0], i: 0 };
    for (var i = 1; i < pts.length; i++) {
      if (acc[i] >= s) {
        var L = acc[i] - acc[i - 1], t = L ? (s - acc[i - 1]) / L : 0;
        return { p: [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t], i: i - 1 };
      }
    }
    return { p: pts[pts.length - 1], i: pts.length - 2 };
  }

  // Posição inicial: no primeiro lugar, um pouco à frente da estrela
  (function () {
    var l = lugares[0], c = CADEIAS[0];
    var acc = medir(c), r = pontoEm(c, acc, PARADA);
    heroi.seg = [chave(c[r.i]), chave(c[r.i + 1])];
    heroi.lugar = l;
    colocarHeroi(r.p);
    virar(true);
  })();

  /* ---------- Rota ---------- */
  function rota(destino) {
    var r = dijkstra(destino.k);
    var a = heroi.seg[0], b = heroi.seg[1];
    var da = dist(heroi.pos, nos[a].p) + r.d[a], db = dist(heroi.pos, nos[b].p) + r.d[b];
    var k = da <= db ? a : b;
    var pts = [heroi.pos];
    var guarda = 0;
    while (k && guarda++ < 500) {
      pts.push(nos[k].p);
      if (k === destino.k) break;
      k = r.prox[k];
    }
    // remove trechos de comprimento zero
    return pts.filter(function (p, i) { return i === 0 || dist(p, pts[i - 1]) > 0.01; });
  }

  function novaTrilha(pts) {
    var ns = 'http://www.w3.org/2000/svg';
    var id = 'mapa-jogo-m' + (++contTrilha);
    var g = document.createElementNS(ns, 'g');
    var mask = document.createElementNS(ns, 'mask');
    mask.setAttribute('id', id);
    mask.setAttribute('maskUnits', 'userSpaceOnUse');
    mask.setAttribute('x', '-50'); mask.setAttribute('y', '-50');
    mask.setAttribute('width', W + 100); mask.setAttribute('height', H + 100);
    var revela = document.createElementNS(ns, 'polyline');
    var ptsStr = pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    revela.setAttribute('points', ptsStr);
    revela.setAttribute('fill', 'none');
    revela.setAttribute('stroke', '#fff');
    revela.setAttribute('stroke-width', '30');
    revela.setAttribute('stroke-linecap', 'round');
    revela.setAttribute('stroke-linejoin', 'round');
    var L = medir(pts); L = L[L.length - 1];
    revela.setAttribute('stroke-dasharray', L + ' ' + (L + 40));
    revela.setAttribute('stroke-dashoffset', L);
    mask.appendChild(revela);
    g.appendChild(mask);
    var brilho = document.createElementNS(ns, 'polyline');
    brilho.setAttribute('points', ptsStr);
    brilho.setAttribute('class', 'brilho');
    brilho.setAttribute('filter', 'url(#mapa-jogo-brilho)');
    brilho.setAttribute('mask', 'url(#' + id + ')');
    var pontos = document.createElementNS(ns, 'polyline');
    pontos.setAttribute('points', ptsStr);
    pontos.setAttribute('class', 'pontos');
    pontos.setAttribute('mask', 'url(#' + id + ')');
    g.appendChild(brilho);
    g.appendChild(pontos);
    trilhas.appendChild(g);
    return function (frac) { revela.setAttribute('stroke-dashoffset', (L * (1 - frac)).toFixed(1)); };
  }

  function suave(t) { return 0.5 - Math.cos(Math.PI * t) / 2; }

  function andarAte(destino, doTeclado) {
    if (heroi.golpeando) return;
    if (anim) { cancelAnimationFrame(anim); anim = null; }
    fecharPainel();
    sairDoLugar();
    lugares.forEach(function (l) { l.btn.classList.toggle('is-ativo', l === destino); });

    if (heroi.lugar === destino && !heroi.andando) { chegar(destino, doTeclado); return; }

    var pts = rota(destino);
    var acc = medir(pts), total = acc[acc.length - 1];
    var alvo = Math.max(0, total - destino.parada);
    if (alvo < 1) { heroi.lugar = destino; chegar(destino, doTeclado); return; }

    // pontos da trilha até onde o herói vai parar
    var fim = pontoEm(pts, acc, alvo);
    var ptsTrilha = pts.slice(0, fim.i + 1).concat([fim.p]);
    var desenhar = novaTrilha(ptsTrilha);
    var segFinal = fim.i === 0 ? heroi.seg : [chave(pts[fim.i]), chave(pts[fim.i + 1])];

    heroi.lugar = null;
    heroi.andando = true;

    if (reduzido.matches) {
      desenhar(1);
      colocarHeroi(fim.p);
      terminar();
      return;
    }

    var dur = Math.min(DUR_MAX, Math.max(DUR_MIN, alvo / VELOCIDADE)) * 1000;
    var t0 = null, xAnt = heroi.pos[0];
    heroiEl.classList.add('is-andando');
    function passo(ts) {
      if (t0 === null) t0 = ts;
      var t = Math.min(1, (ts - t0) / dur), e = suave(t);
      var r = pontoEm(pts, acc, alvo * e);
      if (Math.abs(r.p[0] - xAnt) > 0.3) { virar(r.p[0] < xAnt); xAnt = r.p[0]; }
      colocarHeroi(r.p);
      desenhar(e);
      if (t < 1) { anim = requestAnimationFrame(passo); } else { anim = null; terminar(); }
    }
    anim = requestAnimationFrame(passo);

    function terminar() {
      heroiEl.classList.remove('is-andando');
      heroi.andando = false;
      heroi.seg = segFinal;
      heroi.lugar = destino;
      chegar(destino, doTeclado);
    }
  }

  /* ---------- Embaraçados ---------- */
  function ladoDoSer(l) { return l.x >= heroi.pos[0] ? 1 : -1; }

  function criarSer(l) {
    var dx = l.serDx != null ? l.serDx : ladoDoSer(l) * 78;
    var cx = Math.min(W - 60, Math.max(60, l.x + dx));
    var el = document.createElement('div');
    el.className = 'mapa-jogo__ser';
    el.style.left = (cx / W * 100) + '%';
    el.style.top = ((l.y + l.serDy) / H * 100) + '%';
    var img = document.createElement('img');
    img.alt = '';
    img.src = base + (l.ser === 'rodizio' ? SERES_RODIZIO[0] : l.ser);
    el.appendChild(img);
    seresEl.appendChild(el);
    l.serEl = el;
    l.serX = cx;
    if (l.ser === 'rodizio' && !l.feito) {
      var i = 0;
      rodizioTimer = setInterval(function () {
        i = (i + 1) % SERES_RODIZIO.length;
        img.src = base + SERES_RODIZIO[i];
        el.classList.remove('is-troca');
        void el.offsetWidth;
        el.classList.add('is-troca');
      }, 1300);
    }
    return el;
  }

  function sairDoLugar() {
    if (rodizioTimer) { clearInterval(rodizioTimer); rodizioTimer = null; }
    lugares.forEach(function (l) {
      if (l.serEl && !l.feito) {
        var el = l.serEl; l.serEl = null;
        el.classList.add('is-saindo');
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
      }
    });
  }

  function chegar(l, doTeclado) {
    ativo = l;
    if (!l.serEl) criarSer(l);
    virar(l.serX < heroi.pos[0]);
    abrirPainel(l, doTeclado);
  }

  /* ---------- Painel ---------- */
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function abrirPainel(l, doTeclado) {
    painel.innerHTML = '';
    painel.appendChild(el('p', 'mapa-jogo__sobre', 'Lugar ' + l.n + ' de ' + TOTAL));
    painel.appendChild(el('h3', 'mapa-jogo__titulo', l.nome));
    var dl = el('dl', 'mapa-jogo__dados');
    [['Unidade da BNCC', l.unidade], [l.ser === 'rodizio' ? 'Embaraçados' : 'Embaraçado', l.embaracado]].forEach(function (par) {
      var d = el('div'); d.appendChild(el('dt', null, par[0])); d.appendChild(el('dd', null, par[1])); dl.appendChild(d);
    });
    painel.appendChild(dl);
    var no = el('div', 'mapa-jogo__no');
    no.appendChild(el('span', null, 'Nó'));
    var barra = el('span', 'mapa-jogo__no-barra'); var fill = el('i'); barra.appendChild(fill); no.appendChild(barra);
    if (l.feito) fill.style.width = '0%';
    painel.appendChild(no);

    var acoes = el('div', 'mapa-jogo__acoes');
    var foco;
    if (!l.feito) {
      painel.appendChild(el('p', 'mapa-jogo__dica', l.dica));
      var b = el('button', 'mapa-jogo__botao', 'Desembaraçar');
      b.type = 'button';
      b.addEventListener('click', function () { desembaracar(l, b, fill); });
      acoes.appendChild(b);
      foco = b;
    } else {
      painel.appendChild(el('p', 'mapa-jogo__solto', 'Se soltou! Virou aliado.'));
      foco = botaoProximo(acoes);
    }
    painel.appendChild(acoes);
    painel.setAttribute('aria-label', l.nome);
    painel.classList.add('is-aberto');
    posicionarPainel();
    if (doTeclado && foco) foco.focus({ preventScroll: true });
  }

  function botaoProximo(acoes) {
    var prox = proximoPendente();
    if (prox) {
      var p = el('button', 'mapa-jogo__link', 'Próximo lugar: ' + prox.nome);
      p.type = 'button';
      p.addEventListener('click', function (ev) { andarAte(prox, ev.detail === 0); });
      acoes.appendChild(p);
      return p;
    }
    acoes.appendChild(el('p', 'mapa-jogo__dica', 'Os seis lugares estão livres. Lumina brilha!'));
    return null;
  }

  function proximoPendente() {
    var i0 = ativo ? lugares.indexOf(ativo) : -1;
    for (var j = 1; j <= TOTAL; j++) {
      var l = lugares[(i0 + j) % TOTAL];
      if (!l.feito) return l;
    }
    return null;
  }

  function fecharPainel() { painel.classList.remove('is-aberto'); ativo = null; }

  function compacto() { return raiz.clientWidth <= 700; }

  function posicionarPainel() {
    if (!ativo || !painel.classList.contains('is-aberto')) return;
    if (compacto()) { painel.style.left = ''; painel.style.top = ''; return; }
    var l = ativo;
    var pw = palco.clientWidth, ph = palco.clientHeight;
    var ox = palco.offsetLeft, oy = palco.offsetTop;
    var mx = l.x / W * pw, my = l.y / H * ph;
    var bw = painel.offsetWidth, bh = painel.offsetHeight;
    var serH = 0.155 * ph;
    var left, top, m = 10;
    if (l.lado === 'direita') {
      left = mx + 0.05 * pw; top = my - 10;
    } else if (l.lado === 'esquerda') {
      left = mx - bw - 0.13 * pw; top = my - bh / 2;
    } else if (l.lado === 'acima') {
      left = mx - bw / 2; top = my - serH - bh - 16;
    } else {
      left = mx - bw / 2; top = my + 28;
    }
    left = Math.max(m, Math.min(pw - bw - m, left));
    var hud = raiz.querySelector('.mapa-jogo__hud');
    var topoMin = hud ? hud.offsetTop + hud.offsetHeight + 8 - oy : m;
    top = Math.max(topoMin, Math.min(ph - bh - m, top));
    painel.style.left = (ox + left) + 'px';
    painel.style.top = (oy + top) + 'px';
  }

  /* ---------- Golpe ---------- */
  function srcHeroi(sufixo) { return base + 'heroi-' + heroi.id + (sufixo || '') + '.webp'; }

  function desembaracar(l, botao, fill) {
    if (heroi.golpeando || l.feito || heroi.andando) return;
    heroi.golpeando = true;
    botao.disabled = true;
    if (rodizioTimer) { clearInterval(rodizioTimer); rodizioTimer = null; }
    var rapido = reduzido.matches;
    var quadros = rapido ? [] : ['-golpe-1', '-golpe-2', '-golpe-1', '-golpe-2'];
    var i = 0;
    (function prox() {
      if (i < quadros.length) {
        heroiImg.src = srcHeroi(quadros[i]);
        if (i === 1) { fill.style.width = '35%'; }
        i++;
        setTimeout(prox, 150);
        return;
      }
      heroiImg.src = srcHeroi('');
      fill.style.width = '0%';
      soltar(l);
      heroi.golpeando = false;
    })();
  }

  function soltar(l) {
    l.feito = true;
    l.btn.classList.add('is-feito');
    l.btn.setAttribute('aria-label', l.btn.getAttribute('aria-label').replace(/ Concluído\.$/, '') + ' Concluído.');
    if (l.serEl) l.serEl.classList.add('is-solto');
    estourar(l);
    var feitos = lugares.filter(function (x) { return x.feito; }).length;
    feitosEl.textContent = feitos;
    document.dispatchEvent(new CustomEvent('lumina:progresso', { detail: { feitos: feitos, total: TOTAL } }));
    // atualiza o painel
    var focoNoBotao = document.activeElement && painel.contains(document.activeElement);
    var dica = painel.querySelector('.mapa-jogo__dica');
    var acoes = painel.querySelector('.mapa-jogo__acoes');
    var msg = el('p', 'mapa-jogo__solto', 'Se soltou! Virou aliado.');
    if (dica) dica.parentNode.replaceChild(msg, dica); else painel.insertBefore(msg, acoes);
    acoes.innerHTML = '';
    var f = botaoProximo(acoes);
    posicionarPainel();
    if (focoNoBotao && f) f.focus({ preventScroll: true });
  }

  function estourar(l) {
    if (reduzido.matches) return;
    var cx = (l.serX != null ? l.serX : l.x), cy = l.y - 50;
    for (var i = 0; i < 14; i++) {
      var s = document.createElement('span');
      s.className = 'mapa-jogo__faisca';
      var ang = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
      var r = 40 + Math.random() * 50;
      s.style.left = (cx / W * 100) + '%';
      s.style.top = (cy / H * 100) + '%';
      s.style.setProperty('--dx', (Math.cos(ang) * r).toFixed(0) + 'px');
      s.style.setProperty('--dy', (Math.sin(ang) * r).toFixed(0) + 'px');
      s.style.setProperty('--t', (8 + Math.random() * 10).toFixed(0) + 'px');
      s.style.animationDelay = (Math.random() * 0.08).toFixed(2) + 's';
      faiscasEl.appendChild(s);
      (function (s) { setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 1000); })(s);
    }
  }

  /* ---------- Seletor de herói ---------- */
  function preCarregar(id) {
    ['-golpe-1', '-golpe-2'].forEach(function (s) { var i = new Image(); i.src = base + 'heroi-' + id + s + '.webp'; });
  }
  retratos.forEach(function (r) {
    r.addEventListener('click', function () {
      if (heroi.golpeando) return;
      heroi.id = r.getAttribute('data-heroi');
      heroi.ancora = parseFloat(r.getAttribute('data-ancora')) || 0.4;
      heroiEl.style.setProperty('--ax', heroi.ancora);
      heroiImg.src = srcHeroi('');
      retratos.forEach(function (o) { o.setAttribute('aria-pressed', o === r ? 'true' : 'false'); });
      if (heroiNomeEl) heroiNomeEl.textContent = r.getAttribute('data-nome');
      preCarregar(heroi.id);
    });
  });
  heroiEl.style.setProperty('--ax', heroi.ancora);
  preCarregar(heroi.id);

  /* ---------- Marcadores ---------- */
  lugares.forEach(function (l) {
    l.btn.addEventListener('click', function (ev) { andarAte(l, ev.detail === 0); });
  });

  /* ---------- Convite inicial ---------- */
  (function () {
    ativo = lugares[0];
    lugares[0].btn.classList.add('is-ativo');
    painel.appendChild(el('p', 'mapa-jogo__sobre', 'Você está aqui: ' + lugares[0].nome));
    painel.appendChild(el('h3', 'mapa-jogo__titulo', 'Escolha um lugar'));
    painel.appendChild(el('p', 'mapa-jogo__dica', 'Clique numa estrela. Seu herói anda até lá e encontra um Embaraçado.'));
    painel.setAttribute('aria-label', 'Como jogar');
    painel.classList.add('is-aberto');
    requestAnimationFrame(posicionarPainel);
  })();

  /* ---------- Layout ---------- */
  if (window.ResizeObserver) new ResizeObserver(posicionarPainel).observe(raiz);
  else window.addEventListener('resize', posicionarPainel);
})();
