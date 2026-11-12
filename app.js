(function () {
  'use strict';
  var C = window.TRIP;
  var $ = function (id) { return document.getElementById(id); };
  var LANGS = Object.keys(C.ui);
  var lang = LANGS[0];
  var picked = new Set(C.preselected || []);
  var lastSummary = '';

  function t(key) { return C.ui[lang][key] || key; }
  function L(obj) { return obj[lang] || obj[LANGS[0]]; }
  function locale() { return lang === 'uk' ? 'uk-UA' : 'en-CA'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function money(n) {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: C.currency, maximumFractionDigits: 0 }).format(n);
  }
  function parse(iso) { return new Date(iso + 'T12:00:00'); }
  function fmtDate(iso, withYear) {
    var opt = { day: 'numeric', month: 'long' };
    if (withYear) opt.year = 'numeric';
    return new Intl.DateTimeFormat(locale(), opt).format(parse(iso));
  }
  function fmtRange(a, b) {
    var f = new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long', year: 'numeric' });
    return f.formatRange ? f.formatRange(parse(a), parse(b)) : fmtDate(a) + ' – ' + fmtDate(b, true);
  }
  function count(id) {
    var el = $(id);
    var v = Math.round(+el.value || 0);
    return Math.min(+el.max, Math.max(+el.min, v));
  }

  function priceText(x) {
    function part(v, label) {
      if (v === null) return label + ': ' + t('notAllowed');
      return label + ': ' + (v === 0 ? t('free') : money(v));
    }
    if (x.a === 0 && x.c === 0 && !x.t) return t('free');
    return [part(x.a, t('perAdult')), part(x.c, t('perKid')), part(x.t, t('perToddler'))].join(', ');
  }

  function renderStatic() {
    document.documentElement.lang = lang;
    document.title = t('pageTitle');
    document.querySelectorAll('[data-t]').forEach(function (el) { el.textContent = t(el.dataset.t); });
    document.querySelectorAll('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
    $('demo').hidden = !C.demo;
    $('heroDates').textContent = fmtRange(C.start, C.end);
    if ($('heroImg')) $('heroImg').alt = t('heroAlt');
    $('days').innerHTML = C.days.map(function (d) {
      return '<li><div class="days__date">' + esc(fmtDate(d.date)) + '</div><div><h3>' + esc(L(d.title)) + '</h3><p>' + esc(L(d.text)) + '</p></div></li>';
    }).join('');
    $('acts').innerHTML = C.activities.map(function (x) {
      return '<label class="act" data-act="' + x.id + '"><input type="checkbox" value="' + x.id + '"' + (picked.has(x.id) ? ' checked' : '') + '>' +
        '<span class="act__name">' + esc(L(x.name)) + ' <span class="act__when"></span></span>' +
        '<span class="act__price">' + esc(priceText(x)) + '</span></label>';
    }).join('');
  }

  function calc() {
    var a = count('adults'), c = count('kids'), k = count('toddlers');
    var start = $('arrival').value, end = $('departure').value;
    var okDates = Boolean(start && end && start < end);
    var nights = okDates ? Math.round((parse(end) - parse(start)) / 86400000) : 0;
    $('dateError').hidden = okDates;

    var lines = [], sum = 0, feeBase = 0, taxBase = 0;
    C.activities.forEach(function (x) {
      var row = document.querySelector('[data-act="' + x.id + '"]');
      var box = row.querySelector('input');
      var available = okDates && (!x.day || (x.day >= start && x.day < end));
      box.disabled = !available;
      row.classList.toggle('is-off', !available);
      row.querySelector('.act__when').textContent =
        '(' + (x.day ? fmtDate(x.day) : t('anyDay')) + (available || !okDates ? '' : ', ' + t('outOfDates')) + ')';
      if (!available || !picked.has(x.id)) return;
      var amount = x.a * a + x.c * c + (x.t || 0) * k;
      lines.push({ name: L(x.name), amount: amount });
      sum += amount;
      if (x.fee) feeBase += amount;
      if (x.tax) taxBase += amount;
    });

    var fee = Math.round(feeBase * C.feeRate);
    var tax = Math.round(taxBase * C.taxRate);
    var total = sum + fee + tax;

    var who = [a + ' × ' + t('adults')];
    if (c) who.push(c + ' × ' + t('kids'));
    if (k) who.push(k + ' × ' + t('toddlers'));
    var whoText = who.join(', ');
    var whoLine = whoText + (okDates ? ', ' + t('nights') + ': ' + nights : '');
    var linesHtml = lines.map(function (l) {
      return '<li><span>' + esc(l.name) + '</span><span>' + (l.amount ? money(l.amount) : esc(t('free'))) + '</span></li>';
    }).join('');
    $('sumWho').textContent = whoLine;
    $('sumLines').innerHTML = linesHtml;
    $('prevWho').textContent = whoLine;
    $('prevLines').innerHTML = linesHtml;
    $('prevTotal').textContent = money(total);
    $('sumEmpty').hidden = lines.length > 0;
    $('sumActs').textContent = money(sum);
    $('sumFee').textContent = money(fee);
    $('sumTax').textContent = money(tax);
    $('sumTotal').textContent = money(total);

    var msg = [t('msgHello'), t('msgPeople') + ': ' + whoText];
    if (okDates) msg.push(t('msgDates') + ': ' + fmtRange(start, end));
    lines.forEach(function (l) { msg.push('• ' + l.name + ': ' + money(l.amount)); });
    msg.push(t('fee') + ': ' + money(fee), t('tax') + ': ' + money(tax), t('total') + ': ' + money(total));
    lastSummary = msg.join('\n');
    $('send').href = 'https://wa.me/' + C.contact.whatsapp + '?text=' + encodeURIComponent(lastSummary);
  }

  function setLang(next) {
    lang = LANGS.indexOf(next) >= 0 ? next : LANGS[0];
    renderStatic();
    calc();
  }

  // Події
  document.querySelectorAll('[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () {
      setLang(b.dataset.lang);
      var url = new URL(location.href);
      url.searchParams.set('lang', lang);
      history.replaceState(null, '', url);
    });
  });
  document.querySelectorAll('[data-step]').forEach(function (b) {
    b.addEventListener('click', function () {
      var el = $(b.dataset.for);
      el.value = Math.min(+el.max, Math.max(+el.min, count(b.dataset.for) + +b.dataset.step));
      calc();
    });
  });
  ['adults', 'kids', 'toddlers'].forEach(function (id) {
    $(id).addEventListener('input', calc);
    $(id).addEventListener('change', function () { $(id).value = count(id); calc(); });
  });
  ['arrival', 'departure'].forEach(function (id) { $(id).addEventListener('change', calc); });
  $('acts').addEventListener('change', function (e) {
    if (e.target.checked) picked.add(e.target.value); else picked.delete(e.target.value);
    calc();
  });
  $('copy').addEventListener('click', function () {
    var btn = $('copy');
    function done() { btn.textContent = t('copied'); setTimeout(function () { btn.textContent = t('copy'); }, 1800); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lastSummary).then(done, function () {});
    }
  });

  $('menuBtn').addEventListener('click', function () {
    var open = document.querySelector('.top').classList.toggle('is-open');
    $('menuBtn').setAttribute('aria-expanded', String(open));
  });
  document.querySelectorAll('.top__nav a').forEach(function (a) {
    a.addEventListener('click', function () {
      document.querySelector('.top').classList.remove('is-open');
      $('menuBtn').setAttribute('aria-expanded', 'false');
    });
  });

  // Початковий стан
  ['arrival', 'departure'].forEach(function (id) { $(id).min = C.start; $(id).max = C.end; });
  $('arrival').value = C.start;
  $('departure').value = C.end;
  $('linkWa').href = 'https://wa.me/' + C.contact.whatsapp;
  $('linkTg').href = C.contact.telegram;
  $('linkIg').href = C.contact.instagram;
  setLang(new URLSearchParams(location.search).get('lang'));
})();
