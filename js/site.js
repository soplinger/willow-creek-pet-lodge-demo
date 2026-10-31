(function () {
  'use strict';

  var TZ = 'America/New_York';
  var DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  var DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  var DAY_NAME = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
  var DAY_SHORT = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
  var IMAGE_DIMS = {
    'hero-dogs': { 1200: [1200, 675], 640: [640, 360] }
  };
  var DEFAULT_DIMS = { 1200: [1152, 864], 640: [640, 480] };

  function el(tag, props, kids) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (key) {
        if (key === 'class') node.className = props[key];
        else if (key === 'text') node.textContent = props[key];
        else node.setAttribute(key, props[key]);
      });
    }
    (kids || []).forEach(function (kid) {
      if (kid === null || kid === undefined || kid === false) return;
      node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    });
    return node;
  }

  function tbdTag() {
    return el('span', { class: 'tbd', text: 'owner to fill' });
  }

  function loadJSON(name) {
    return fetch('content/' + name + '.json', { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error(name + ' ' + res.status);
        return res.json();
      })
      .catch(function () { return null; });
  }

  function nyNow() {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date());
    var m = {};
    parts.forEach(function (p) { m[p.type] = p.value; });
    return {
      date: m.year + '-' + m.month + '-' + m.day,
      minutes: (parseInt(m.hour, 10) % 24) * 60 + parseInt(m.minute, 10)
    };
  }

  function addDays(dateStr, n) {
    var d = new Date(dateStr + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function dowOf(dateStr) {
    return DAY_KEYS[new Date(dateStr + 'T12:00:00Z').getUTCDay()];
  }

  function toMin(v) {
    var m = typeof v === 'string' ? /^(\d{2}):(\d{2})$/.exec(v) : null;
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
  }

  function fmtTime(v) {
    var mins = toMin(v);
    if (mins === null) return 'Ask us';
    var h = Math.floor(mins / 60);
    var mm = mins % 60;
    var suffix = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 || 12;
    return h12 + ':' + (mm < 10 ? '0' : '') + mm + ' ' + suffix;
  }

  function fmtDate(dateStr) {
    return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
    });
  }

  function holidayFor(hours, dateStr) {
    var list = hours.holidays || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].date === dateStr) return list[i];
    }
    return null;
  }

  function periodsOn(hours, dateStr, key) {
    var sched = hours[key];
    if (!sched) return { closed: true, periods: [], tbd: false, note: '' };
    var hol = key === 'desk' ? holidayFor(hours, dateStr) : null;
    var entry;
    if (hol) {
      entry = {
        closed: !!hol.closed,
        periods: hol.closed ? [] : [{ open: hol.open, close: hol.close }],
        note: hol.note || ''
      };
    } else {
      entry = (sched.days || []).filter(function (d) { return d.day === dowOf(dateStr); })[0] || { closed: true, periods: [] };
    }
    var periods = entry.closed ? [] : (entry.periods || []);
    var tbd = periods.some(function (p) { return toMin(p.open) === null || toMin(p.close) === null; });
    return { closed: !!entry.closed, periods: periods, tbd: tbd, note: entry.note || '' };
  }

  function shortTime(v) {
    return fmtTime(v).replace(':00', '').replace(' ', ' ');
  }

  function deskStatus(hours, now) {
    var today = periodsOn(hours, now.date, 'desk');
    if (today.tbd) return { state: 'unknown', text: "Call for today's hours" };
    var active = today.periods.filter(function (p) {
      return toMin(p.open) <= now.minutes && now.minutes < toMin(p.close);
    })[0];
    if (active) return { state: 'open', text: 'Front desk open now, until ' + fmtTime(active.close), short: 'Open until ' + shortTime(active.close) };
    var later = today.periods.filter(function (p) { return toMin(p.open) > now.minutes; })[0];
    if (later) return { state: 'closed', text: 'Closed now, opens today at ' + fmtTime(later.open), short: 'Opens ' + shortTime(later.open) };
    for (var i = 1; i <= 7; i++) {
      var day = addDays(now.date, i);
      var next = periodsOn(hours, day, 'desk').periods.filter(function (p) { return toMin(p.open) !== null; })[0];
      if (next) {
        return { state: 'closed', text: 'Closed now, opens ' + DAY_NAME[dowOf(day)] + ' at ' + fmtTime(next.open), short: 'Opens ' + DAY_SHORT[dowOf(day)] + ' ' + shortTime(next.open) };
      }
    }
    return { state: 'closed', text: 'Closed now' };
  }

  function timeNode(v) {
    if (toMin(v) === null) return [el('span', { text: 'Ask us' }), tbdTag()];
    return [el('span', { text: fmtTime(v) })];
  }

  function renderOpenNow(hours) {
    var status = deskStatus(hours, nyNow());
    document.querySelectorAll('[data-open-now]').forEach(function (node) {
      node.textContent = node.classList.contains('open-pill') && status.short ? status.short : status.text;
      node.setAttribute('data-state', status.state);
    });
    document.querySelectorAll('[data-open-now-dot]').forEach(function (node) {
      node.setAttribute('data-state', status.state);
    });
  }

  function renderSchedule(container, sched) {
    var byDay = {};
    (sched.days || []).forEach(function (d) { byDay[d.day] = d; });
    var groups = [];
    DAY_ORDER.forEach(function (key) {
      var d = byDay[key] || { closed: true, periods: [] };
      var sig = d.closed ? 'closed' : (d.periods || []).map(function (p) { return p.open + '-' + p.close; }).join(',') + '|' + (d.note || '');
      var last = groups[groups.length - 1];
      if (last && last.sig === sig) {
        last.end = key;
      } else {
        groups.push({ sig: sig, start: key, end: key, entry: d });
      }
    });

    var dl = el('dl', { class: 'hours-list' });
    groups.forEach(function (g) {
      var label = g.start === g.end ? DAY_NAME[g.start] : DAY_SHORT[g.start] + ' to ' + DAY_SHORT[g.end];
      var value;
      if (g.entry.closed) {
        value = [el('span', { text: 'Closed' })];
      } else {
        value = [];
        (g.entry.periods || []).forEach(function (p, i) {
          if (i > 0) value.push(el('span', { text: ', ' }));
          var open = timeNode(p.open);
          var close = timeNode(p.close);
          value = value.concat(open);
          value.push(el('span', { text: ' to ' }));
          value = value.concat(close);
        });
        if (g.entry.note) value.push(el('span', { class: 'hours-note', text: ' ' + g.entry.note }));
      }
      dl.appendChild(el('div', null, [
        el('dt', { text: label }),
        el('dd', null, value)
      ]));
    });
    container.textContent = '';
    if (sched.label) container.appendChild(el('h3', { text: sched.label }));
    container.appendChild(dl);
  }

  function renderHoursBlocks(hours) {
    document.querySelectorAll('[data-hours]').forEach(function (node) {
      var sched = hours[node.getAttribute('data-hours')];
      if (sched) renderSchedule(node, sched);
    });
  }

  function renderHolidays(hours) {
    document.querySelectorAll('[data-holidays]').forEach(function (list) {
      var today = nyNow().date;
      var upcoming = (hours.holidays || []).filter(function (h) { return h.date >= today; });
      list.textContent = '';
      if (!upcoming.length) {
        list.appendChild(el('li', { text: 'No holiday closures listed.' }));
        return;
      }
      upcoming.forEach(function (h) {
        var value;
        if (h.closed) value = [el('strong', { text: 'Closed all day' })];
        else value = [el('strong', { text: fmtTime(h.open) + ' to ' + fmtTime(h.close) })].concat(toMin(h.open) === null ? [tbdTag()] : []);
        var line = [el('span', { text: h.label + ', ' + fmtDate(h.date) + ': ' })].concat(value);
        if (h.note) line.push(el('span', { class: 'hours-note', text: ' (' + h.note + ')' }));
        list.appendChild(el('li', null, line));
      });
    });
  }

  function isLive(item, today) {
    if (item.active !== true) return false;
    var start = typeof item.start_date === 'string' ? item.start_date.slice(0, 10) : '';
    var end = typeof item.end_date === 'string' ? item.end_date.slice(0, 10) : '';
    if (start && today < start) return false;
    if (end && today > end) return false;
    return true;
  }

  function renderAnnouncements(data) {
    var today = nyNow().date;
    document.querySelectorAll('[data-announcements]').forEach(function (box) {
      var live = (data.items || []).filter(function (item) { return isLive(item, today); });
      box.textContent = '';
      live.forEach(function (item) {
        var children = [el('h3', { text: item.title }), el('p', { text: item.body })];
        if (item.code) {
          children.push(el('p', null, ['Use code ', el('span', { class: 'code', text: item.code }), ' when you book.']));
        }
        box.appendChild(el('article', { class: 'notice' }, children));
      });
      var wrap = box.closest('[data-news]') || box;
      wrap.hidden = live.length === 0;
    });
  }

  function imageAttrs(path, sizes) {
    var m = /^(.*)-1200\.webp$/.exec(path || '');
    if (!m) return { src: path, attrs: {} };
    var base = m[1];
    var name = base.replace(/^images\//, '');
    var dims = IMAGE_DIMS[name] || DEFAULT_DIMS;
    return {
      src: base + '-1200.webp',
      attrs: {
        srcset: base + '-640.webp 640w, ' + base + '-1200.webp 1200w',
        sizes: sizes,
        width: dims[1200][0],
        height: dims[1200][1]
      }
    };
  }

  function buildImage(path, alt, sizes, lazy) {
    var info = imageAttrs(path, sizes);
    var attrs = Object.assign({ src: info.src, alt: alt || '', decoding: 'async' }, info.attrs);
    if (lazy) attrs.loading = 'lazy';
    return el('img', attrs);
  }

  var SERVICE_ICONS = { 'dog-boarding': 'dog', 'cat-boarding': 'cat', 'daycare': 'sun', 'grooming': 'scissors', 'small-pets': 'bunny' };

  function svgIcon(name, cls) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', cls || 'i');
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#i-' + name);
    svg.appendChild(use);
    return svg;
  }

  function priceChip(price) {
    var text = (price || '').trim();
    if (!text) return el('span', { class: 'price-chip', text: 'Ask us' });
    var m = /^(from\s+)?(\$[\d.,]+)(\/.*)?$/i.exec(text);
    if (!m) return el('span', { class: 'price-chip', text: text });
    return el('span', { class: 'price-chip' }, [
      el('small', { text: 'from ' }), m[2], el('small', { text: m[3] || '' })
    ]);
  }

  function renderServices(data) {
    document.querySelectorAll('[data-services]').forEach(function (grid) {
      grid.textContent = '';
      (data.items || []).forEach(function (s) {
        grid.appendChild(el('article', { class: 'card reveal' }, [
          el('div', { class: 'card-media' }, [
            buildImage(s.image, s.alt, '(min-width: 860px) 33vw, 100vw', true),
            el('span', { class: 'card-icon' }, [svgIcon(SERVICE_ICONS[s.slug] || 'paw')])
          ]),
          el('div', { class: 'card-body' }, [
            el('h3', null, [el('a', { href: s.slug + '.html', text: s.name })]),
            el('p', { text: s.summary }),
            el('div', { class: 'card-foot' }, [
              priceChip(s.price),
              el('span', { class: 'card-go' }, ['See details', svgIcon('arrow')])
            ])
          ])
        ]));
      });
    });
  }

  function priceCell(p) {
    var children = [el('span', { text: p.price || 'Ask us' })];
    if (p.owner_to_fill) children.push(tbdTag());
    return el('td', null, children);
  }

  function renderPrices(data) {
    document.querySelectorAll('[data-prices]').forEach(function (box) {
      var rows = (data.items || []).map(function (p) {
        return el('tr', null, [
          el('th', { scope: 'row', text: p.category }),
          el('td', { text: p.item }),
          priceCell(p),
          el('td', { text: p.note || '' })
        ]);
      });
      var table = el('table', null, [
        el('caption', { text: 'Current prices (Ask us means we will quote you directly)' }),
        el('thead', null, [el('tr', null, [
          el('th', { scope: 'col', text: 'Service' }),
          el('th', { scope: 'col', text: 'Item' }),
          el('th', { scope: 'col', text: 'Price' }),
          el('th', { scope: 'col', text: 'Notes' })
        ])]),
        el('tbody', null, rows)
      ]);
      box.textContent = '';
      box.appendChild(el('div', { class: 'table-wrap' }, [table]));
    });
  }

  function renderFaqs(data) {
    document.querySelectorAll('[data-faqs]').forEach(function (box) {
      var only = box.getAttribute('data-category');
      var items = (data.items || []).filter(function (f) { return !only || f.category === only; });
      var limit = parseInt(box.getAttribute('data-limit'), 10);
      if (limit > 0) items = items.slice(0, limit);
      box.textContent = '';
      items.forEach(function (f) {
        box.appendChild(el('details', null, [
          el('summary', { text: f.question }),
          el('p', { text: f.answer })
        ]));
      });
    });
  }

  function renderGallery(data) {
    document.querySelectorAll('[data-gallery]').forEach(function (box) {
      box.textContent = '';
      (data.items || []).forEach(function (g) {
        box.appendChild(el('figure', { class: 'reveal' }, [
          buildImage(g.image, g.alt, '(min-width: 860px) 33vw, (min-width: 620px) 50vw, 100vw', true),
          el('figcaption', { text: g.caption || '' })
        ]));
      });
    });
  }

  function setupNav() {
    var toggle = document.querySelector('[data-nav-toggle]');
    var nav = document.getElementById('site-nav');
    if (!toggle || !nav) return;
    function setOpen(open) {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Close' : 'Menu';
      nav.classList.toggle('is-open', open);
    }
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  function setupReveal() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var targets = document.querySelectorAll('.reveal, .section h2, .section .lead, .hours-block, .notice, .callout, .step, .feature-list li, .faq details, .table-wrap, .two-col img');
    if (reduce || !('IntersectionObserver' in window)) {
      targets.forEach(function (n) { n.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    var i = 0;
    targets.forEach(function (n) {
      if (n.classList.contains('reveal-seen')) return;
      n.classList.add('reveal', 'reveal-seen');
      n.style.setProperty('--d', ((i++ % 4) * 80) + 'ms');
      io.observe(n);
    });
  }

  function setupBookBar() {
    var ci = document.getElementById('bb-checkin');
    var co = document.getElementById('bb-checkout');
    var svc = document.getElementById('bb-service');
    var pet = document.getElementById('bb-pet');
    if (!ci || !co) return;
    var today = nyNow().date;
    ci.min = today; co.min = today;
    ci.addEventListener('change', function () {
      co.min = ci.value || today;
      if (co.value && co.value < ci.value) co.value = ci.value;
    });
    var PET_FOR = { 'dog-boarding': 'dog', 'daycare': 'dog', 'cat-boarding': 'cat', 'small-pet': 'small' };
    svc.addEventListener('change', function () { if (PET_FOR[svc.value]) pet.value = PET_FOR[svc.value]; });
  }

  function init() {
    setupNav();
    setupBookBar();
    setupReveal();
    Promise.all([
      loadJSON('hours'),
      loadJSON('announcements'),
      loadJSON('prices'),
      loadJSON('services'),
      loadJSON('faqs'),
      loadJSON('gallery')
    ]).then(function (d) {
      var hours = d[0], announcements = d[1], prices = d[2], services = d[3], faqs = d[4], gallery = d[5];
      if (hours) {
        renderHoursBlocks(hours);
        renderHolidays(hours);
        renderOpenNow(hours);
        setInterval(function () { renderOpenNow(hours); }, 60000);
      }
      if (announcements) renderAnnouncements(announcements);
      if (prices) renderPrices(prices);
      if (services) renderServices(services);
      if (faqs) renderFaqs(faqs);
      if (gallery) renderGallery(gallery);
      setupReveal();
    });
  }

  window.WillowCreekSite = {
    el: el,
    nyNow: nyNow,
    addDays: addDays,
    toMin: toMin,
    loadJSON: loadJSON
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
