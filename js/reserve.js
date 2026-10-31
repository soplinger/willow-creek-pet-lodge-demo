(function () {
  'use strict';

  var NS = window.WillowCreekSite;
  var form = document.getElementById('intake-form');
  if (!form) return;

  var MAX_PETS = 5;
  var MAX_FILE_MB = 10;
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var SERVICE_LABELS = {
    'dog-boarding': 'Dog boarding',
    'cat-boarding': 'Cat boarding',
    'daycare': 'Doggie daycare',
    'grooming': 'Grooming',
    'small-pet': 'Small pet or exotic boarding'
  };
  var PREF_LABELS = { text: 'text message', call: 'phone call', email: 'email' };
  var SPECIES_LABELS = { dog: 'Dog', cat: 'Cat', small: 'Small pet or exotic' };

  var petsBox = document.getElementById('pets');
  var petTemplate = document.getElementById('pet-template');
  var petCount = document.getElementById('pet-count');
  var addBtn = document.getElementById('add-pet');
  var summaryBox = document.getElementById('form-errors');
  var summaryList = document.getElementById('form-errors-list');
  var warning = document.getElementById('checkin-warning');
  var formWrap = document.getElementById('form-wrap');
  var confirmBox = document.getElementById('confirm');
  var smsPreview = document.getElementById('sms-preview');
  var newRequestBtn = document.getElementById('new-request');
  var formTitle = document.getElementById('form-title');
  var activitiesBox = document.getElementById('activities');
  var vaccinesBox = document.getElementById('vaccines');
  var reviewBox = document.getElementById('review');
  var progress = document.getElementById('progress');
  var backBtn = document.getElementById('step-back');
  var nextBtn = document.getElementById('step-next');
  var submitBtn = document.getElementById('step-submit');
  var confetti = document.getElementById('confetti');
  var STEPS = 4;
  var STEP_NEXT = { 1: 'Next: Dates', 2: 'Next: Vaccines', 3: 'Next: Confirm' };
  var step = 1;
  var nextPetId = 1;
  var today = NS.nyNow().date;

  function $(id) { return document.getElementById(id); }
  function val(id) { var n = $(id); return n ? n.value.trim() : ''; }
  function petCards() { return Array.prototype.slice.call(petsBox.querySelectorAll('.pet-card')); }
  function cardIdOf(card) { return card.getAttribute('data-pet'); }
  function petVal(id, field) { return val('pet-' + id + '-' + field); }

  function validPhone(s) {
    var digits = s.replace(/\D/g, '');
    return /^[\d\s().+-]+$/.test(s) && (digits.length === 10 || (digits.length === 11 && digits.charAt(0) === '1'));
  }

  function nightsBetween(ci, co) {
    if (!ci || !co) return 0;
    return Math.round((Date.parse(co + 'T00:00:00Z') - Date.parse(ci + 'T00:00:00Z')) / 86400000);
  }

  function fmtSize(bytes) {
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function fmtDay(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
    });
  }

  function hoursUntilCheckin() {
    var ci = val('checkin');
    if (!ci) return null;
    return (new Date(ci + 'T00:00:00').getTime() - Date.now()) / 3600000;
  }

  function updateWarning() {
    var ci = val('checkin');
    var hrs = hoursUntilCheckin();
    warning.hidden = !(ci && ci >= today && hrs !== null && hrs < 48);
  }

  function petLabel(card) {
    var i = petCards().indexOf(card);
    var name = petVal(cardIdOf(card), 'name');
    return name ? name : 'Pet ' + (i + 1);
  }

  function buildActivity(id) {
    var wrap = document.createElement('div');
    wrap.className = 'per-pet';
    wrap.innerHTML =
      '<h3><svg class="i" aria-hidden="true"><use href="#i-dog"/></svg><span></span></h3>' +
      '<div class="field"><label for="pet-' + id + '-activity">Dog activity</label>' +
      '<select id="pet-' + id + '-activity" aria-describedby="pet-' + id + '-activity-hint pet-' + id + '-activity-error">' +
      '<option value="">Choose an activity</option>' +
      '<option value="individual">Individual play</option>' +
      '<option value="personal">Personal play (one on one)</option>' +
      '<option value="couch">Couch potato cuddle time (one on one)</option>' +
      '<option value="group">Group play</option>' +
      '<option value="unsure">Not sure yet, help me choose</option></select>' +
      '<span class="hint" id="pet-' + id + '-activity-hint">Required for a dog stay longer than one night. Activity prices: Ask us.</span>' +
      '<span class="error" id="pet-' + id + '-activity-error" hidden></span></div>';
    return wrap;
  }

  function buildVaccines(id) {
    var wrap = document.createElement('div');
    wrap.className = 'per-pet';
    wrap.innerHTML =
      '<h3><svg class="i" aria-hidden="true"><use href="#i-shield"/></svg><span></span></h3>' +
      '<div class="field"><span class="label" id="pet-' + id + '-vaccines-label">Vaccine records</span>' +
      '<label class="dropzone"><input type="file" id="pet-' + id + '-vaccines" accept="image/*,.pdf" multiple aria-labelledby="pet-' + id + '-vaccines-label" aria-describedby="pet-' + id + '-vaccines-hint pet-' + id + '-vaccines-error">' +
      '<svg class="i" aria-hidden="true"><use href="#i-upload"/></svg>' +
      '<span class="dropzone-title">Drop vaccine records here, or choose files</span>' +
      '<span class="dropzone-sub">Photos or PDFs, up to 10 MB each</span></label>' +
      '<span class="hint" id="pet-' + id + '-vaccines-hint">Records are due 48 hours before check-in.</span>' +
      '<ul class="file-list" id="pet-' + id + '-vaccines-list" aria-live="polite"></ul>' +
      '<span class="error" id="pet-' + id + '-vaccines-error" hidden></span></div>';
    return wrap;
  }

  function activityNeeded(id) {
    return petVal(id, 'species') === 'dog' && val('service') === 'dog-boarding' && nightsBetween(val('checkin'), val('checkout')) > 1;
  }

  function syncActivities() {
    var needed = petCards().filter(function (c) { return activityNeeded(cardIdOf(c)); });
    var ids = needed.map(cardIdOf);
    Array.prototype.slice.call(activitiesBox.children).forEach(function (n) {
      if (ids.indexOf(n.getAttribute('data-for')) === -1) n.remove();
    });
    needed.forEach(function (card) {
      var id = cardIdOf(card);
      var node = activitiesBox.querySelector('[data-for="' + id + '"]');
      if (!node) {
        node = buildActivity(id);
        node.setAttribute('data-for', id);
        activitiesBox.appendChild(node);
      }
      node.querySelector('h3 span').textContent = petLabel(card) + ': activity';
    });
  }

  function syncVaccines() {
    var ids = petCards().map(cardIdOf);
    Array.prototype.slice.call(vaccinesBox.children).forEach(function (n) {
      if (ids.indexOf(n.getAttribute('data-for')) === -1) n.remove();
    });
    petCards().forEach(function (card) {
      var id = cardIdOf(card);
      var node = vaccinesBox.querySelector('[data-for="' + id + '"]');
      if (!node) {
        node = buildVaccines(id);
        node.setAttribute('data-for', id);
        vaccinesBox.appendChild(node);
      }
      node.querySelector('h3 span').textContent = petLabel(card);
    });
  }

  function renumber() {
    var cards = petCards();
    cards.forEach(function (card, i) {
      card.querySelector('h3').textContent = 'Pet ' + (i + 1);
      var rm = card.querySelector('[data-remove-pet]');
      rm.hidden = cards.length === 1;
      rm.setAttribute('aria-label', 'Remove pet ' + (i + 1));
    });
    addBtn.disabled = cards.length >= MAX_PETS;
    petCount.value = String(cards.length);
  }

  function addPet() {
    if (petCards().length >= MAX_PETS) return;
    var id = String(nextPetId++);
    petsBox.insertAdjacentHTML('beforeend', petTemplate.innerHTML.replace(/__N__/g, id));
    renumber();
  }

  function setCount(n) {
    var target = Math.min(MAX_PETS, Math.max(1, n || 1));
    while (petCards().length < target) addPet();
    while (petCards().length > target) {
      var cards = petCards();
      cards[cards.length - 1].remove();
    }
    renumber();
  }

  function renderFiles(input) {
    var list = $(input.id + '-list');
    list.textContent = '';
    Array.prototype.forEach.call(input.files, function (f) {
      list.appendChild(NS.el('li', { text: f.name + ' (' + fmtSize(f.size) + ')' }));
    });
  }

  function clearErrors() {
    form.querySelectorAll('[aria-invalid]').forEach(function (n) { n.removeAttribute('aria-invalid'); });
    form.querySelectorAll('.error').forEach(function (s) { s.textContent = ''; s.hidden = true; });
    summaryBox.hidden = true;
    summaryList.textContent = '';
  }

  function showErrors(errs) {
    clearErrors();
    errs.forEach(function (e) {
      var target = $(e.key);
      if (target) target.setAttribute('aria-invalid', 'true');
      var span = $(e.key + '-error');
      if (span) { span.textContent = e.msg; span.hidden = false; }
      summaryList.appendChild(NS.el('li', null, [NS.el('a', { href: '#' + e.focus, text: e.msg })]));
    });
    summaryBox.hidden = false;
    summaryBox.focus();
  }

  function validate(only) {
    var errs = [];
    function inStep(n) { return !only || only === n; }
    function add(key, focus, msg) { errs.push({ key: key, focus: focus || key, msg: msg }); }

    if (inStep(1)) {
    var ownerName = val('owner-name');
    if (ownerName.length < 2) add('owner-name', 'owner-name', 'Enter the owner name.');
    var phone = val('owner-phone');
    if (!validPhone(phone)) add('owner-phone', 'owner-phone', 'Enter a 10-digit phone number, such as 610-555-0123.');
    if (!EMAIL.test(val('owner-email'))) add('owner-email', 'owner-email', 'Enter a valid email address.');
    if (!form.querySelector('input[name="preferred_contact"]:checked')) {
      add('preferred-contact', 'pref-text', 'Choose how we should contact you.');
    }
    }
    var service = val('service');
    if (inStep(2) && !service) add('service', 'service', 'Choose a service.');

    var ci = val('checkin');
    var co = val('checkout');
    if (inStep(2)) {
    if (!ci) add('checkin', 'checkin', 'Choose a check-in date.');
    else if (ci < today) add('checkin', 'checkin', 'Check-in can\'t be in the past.');
    if (!co) add('checkout', 'checkout', 'Choose a check-out date.');
    else if (co < today) add('checkout', 'checkout', 'Check-out can\'t be in the past.');
    else if (ci && co < ci) add('checkout', 'checkout', 'Check-out must be on or after check-in.');
    }
    var nights = nightsBetween(ci, co);

    petCards().forEach(function (card, i) {
      var id = cardIdOf(card);
      var label = 'Pet ' + (i + 1);
      if (inStep(1)) {
      if (!petVal(id, 'name')) add('pet-' + id + '-name', 'pet-' + id + '-name', label + ': enter the pet\'s name.');
      if (!petVal(id, 'species')) add('pet-' + id + '-species', 'pet-' + id + '-species', label + ': choose a species.');
      if (!petVal(id, 'breed')) add('pet-' + id + '-breed', 'pet-' + id + '-breed', label + ': enter the breed (or mixed).');
      if (!petVal(id, 'age')) add('pet-' + id + '-age', 'pet-' + id + '-age', label + ': enter the age.');
      if (!petVal(id, 'vet-name')) add('pet-' + id + '-vet-name', 'pet-' + id + '-vet-name', label + ': enter the vet clinic name.');
      if (!validPhone(petVal(id, 'vet-phone'))) add('pet-' + id + '-vet-phone', 'pet-' + id + '-vet-phone', label + ': enter the vet clinic phone number.');
      }
      if (inStep(2) && petVal(id, 'species') === 'dog' && service === 'dog-boarding' && nights > 1 && !petVal(id, 'activity')) {
        add('pet-' + id + '-activity', 'pet-' + id + '-activity', label + ': choose an activity for a stay longer than one night.');
      }
      if (inStep(3)) {
      var vin = $('pet-' + id + '-vaccines');
      var files = vin ? vin.files : [];
      var tooBig = Array.prototype.filter.call(files, function (f) { return f.size > MAX_FILE_MB * 1024 * 1024; });
      if (tooBig.length) {
        add('pet-' + id + '-vaccines', 'pet-' + id + '-vaccines', label + ': ' + tooBig[0].name + ' is larger than ' + MAX_FILE_MB + ' MB. Upload a smaller file.');
      }
      }
    });

    if (inStep(2)) {
    if (val('emergency-name').length < 2) add('emergency-name', 'emergency-name', 'Enter an emergency contact name.');
    if (!validPhone(val('emergency-phone'))) add('emergency-phone', 'emergency-phone', 'Enter a 10-digit emergency contact phone number.');
    }
    if (inStep(4)) {
    if (!$('agree').checked) add('agree', 'agree', 'Please agree to the policies to continue.');
    if (val('signature').length < 2) add('signature', 'signature', 'Type your name as your signature.');
    }
    return errs;
  }

  function collect() {
    var service = val('service');
    var ci = val('checkin');
    var co = val('checkout');
    var nights = nightsBetween(ci, co);
    var pref = form.querySelector('input[name="preferred_contact"]:checked');
    return {
      owner: { name: val('owner-name'), phone: val('owner-phone'), email: val('owner-email'), preferred: pref ? pref.value : '' },
      service: service,
      checkin: ci,
      checkout: co,
      nights: nights,
      pets: petCards().map(function (card) {
        var id = cardIdOf(card);
        var species = petVal(id, 'species');
        var vin = $('pet-' + id + '-vaccines');
        var files = Array.prototype.map.call(vin ? vin.files : [], function (f) { return { name: f.name, size: f.size }; });
        return {
          name: petVal(id, 'name'),
          species: species,
          breed: petVal(id, 'breed'),
          age: petVal(id, 'age'),
          needs: petVal(id, 'needs'),
          activity: petVal(id, 'activity'),
          vetName: petVal(id, 'vet-name'),
          vetPhone: petVal(id, 'vet-phone'),
          files: files
        };
      }),
      emergency: { name: val('emergency-name'), phone: val('emergency-phone') },
      signature: val('signature')
    };
  }

  function buildStaffText(d) {
    var lines = [];
    var hrs = hoursUntilCheckin();
    lines.push('NEW REQUEST - Willow Creek Pet Lodge (demo preview)');
    if (hrs !== null && hrs < 48) lines.push('ALERT: check-in is under 48 hours away.');
    lines.push('Owner: ' + d.owner.name + ', ' + d.owner.phone + ', ' + d.owner.email);
    lines.push('Prefers: ' + (PREF_LABELS[d.owner.preferred] || 'not set'));
    lines.push('Service: ' + (SERVICE_LABELS[d.service] || d.service));
    var stay = fmtDay(d.checkin) + ' to ' + fmtDay(d.checkout);
    lines.push('Stay: ' + stay + (d.nights > 0 ? ' (' + d.nights + (d.nights === 1 ? ' night)' : ' nights)') : ' (same day)'));
    lines.push('Pets:');
    var missing = [];
    d.pets.forEach(function (p, i) {
      var parts = [(i + 1) + '. ' + p.name, SPECIES_LABELS[p.species] || p.species, p.breed, p.age];
      lines.push('   ' + parts.join(', '));
      if (p.activity) lines.push('      Activity: ' + p.activity);
      lines.push('      Needs/meds: ' + (p.needs || 'none listed'));
      lines.push('      Vet: ' + p.vetName + ', ' + p.vetPhone);
      lines.push('      Vaccine files: ' + (p.files.length ? p.files.length + ' attached' : 'NONE YET'));
      if (!p.files.length) missing.push(p.name);
    });
    lines.push('Emergency contact: ' + d.emergency.name + ', ' + d.emergency.phone);
    lines.push('Agreement signed by: ' + d.signature);
    lines.push(missing.length
      ? 'Records missing for: ' + missing.join(', ') + '. Reminders would go out 7 and 3 days before check-in.'
      : 'All pets have records attached.');
    return lines.join('\n');
  }

  function stepEl(n) { return form.querySelector('[data-step="' + n + '"]'); }

  function fmtService(d) { return SERVICE_LABELS[d.service] || d.service; }

  function renderReview() {
    var d = collect();
    var dl = NS.el('dl');
    function row(k, v) { dl.appendChild(NS.el('div', null, [NS.el('dt', { text: k }), NS.el('dd', { text: v })])); }
    row('Owner', d.owner.name + ', ' + d.owner.phone);
    row('Service', fmtService(d));
    row('Dates', fmtDay(d.checkin) + ' to ' + fmtDay(d.checkout) + (d.nights > 0 ? ' (' + d.nights + (d.nights === 1 ? ' night)' : ' nights)') : ' (same day)'));
    d.pets.forEach(function (p, i) {
      row('Pet ' + (i + 1), p.name + ', ' + (SPECIES_LABELS[p.species] || p.species) + ', ' + p.breed);
      row('Vaccine files', p.files.length ? p.files.length + ' added' : 'None yet (due 48 hours before check-in)');
    });
    row('Emergency contact', d.emergency.name + ', ' + d.emergency.phone);
    reviewBox.textContent = '';
    reviewBox.appendChild(dl);
  }

  function goStep(n, focus) {
    step = Math.min(STEPS, Math.max(1, n));
    for (var i = 1; i <= STEPS; i++) stepEl(i).hidden = i !== step;
    Array.prototype.forEach.call(progress.children, function (li, idx) {
      var num = idx + 1;
      li.classList.toggle('is-done', num < step);
      li.classList.toggle('is-current', num === step);
      if (num === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    if (step === 2) syncActivities();
    if (step === 3) syncVaccines();
    if (step === 4) renderReview();
    backBtn.hidden = step === 1;
    nextBtn.hidden = step === STEPS;
    submitBtn.hidden = step !== STEPS;
    if (STEP_NEXT[step]) nextBtn.textContent = STEP_NEXT[step];
    if (focus !== false) {
      var head = stepEl(step).querySelector('.sr-step');
      if (head) head.focus({ preventScroll: true });
      formWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function burst() {
    if (!confetti || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    confetti.textContent = '';
    var colors = ['#d9480f', '#ffd166', '#a3245a', '#c9ecd9', '#dcd6ff'];
    for (var i = 0; i < 36; i++) {
      var bit = document.createElement('i');
      bit.style.left = Math.round(Math.random() * 100) + '%';
      bit.style.background = colors[i % colors.length];
      bit.style.animationDelay = (Math.random() * 0.6).toFixed(2) + 's';
      confetti.appendChild(bit);
    }
  }

  function showConfirmation(d) {
    burst();
    smsPreview.textContent = buildStaffText(d);
    formWrap.hidden = true;
    confirmBox.hidden = false;
    confirmBox.focus();
  }

  function resetForm() {
    clearErrors();
    form.reset();
    petCards().forEach(function (c) { c.remove(); });
    setCount(1);
    updateWarning();
    confirmBox.hidden = true;
    formWrap.hidden = false;
    vaccinesBox.textContent = '';
    activitiesBox.textContent = '';
    goStep(1, false);
    formTitle.focus();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var errs = validate();
    if (errs.length) {
      var firstBad = 4;
      for (var n = 1; n <= STEPS; n++) { if (validate(n).length) { firstBad = n; break; } }
      syncActivities();
      syncVaccines();
      goStep(firstBad, false);
      showErrors(validate(firstBad));
      return;
    }
    clearErrors();
    showConfirmation(collect());
  });

  form.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'pet-count') {
      setCount(parseInt(t.value, 10));
    } else if (t.type === 'file' && /^pet-\d+-vaccines$/.test(t.id)) {
      renderFiles(t);
    } else if (t.id === 'checkin' || t.id === 'checkout' || t.id === 'service') {
      if (t.id === 'checkin' && t.value && (!val('checkout') || val('checkout') < t.value)) $('checkout').value = t.value;
      if (t.id === 'checkin') $('checkout').min = t.value || today;
      updateWarning();
      syncActivities();
    }
  });

  petsBox.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-remove-pet]');
    if (!btn) return;
    var card = petsBox.querySelector('[data-pet="' + btn.getAttribute('data-remove-pet') + '"]');
    if (card) card.remove();
    renumber();
    petCount.focus();
  });

  petsBox.addEventListener('dragover', function (e) {
    var zone = e.target.closest && e.target.closest('.dropzone');
    if (!zone) return;
    e.preventDefault();
    zone.classList.add('is-dragover');
  });

  petsBox.addEventListener('dragleave', function (e) {
    var zone = e.target.closest && e.target.closest('.dropzone');
    if (zone) zone.classList.remove('is-dragover');
  });

  petsBox.addEventListener('drop', function (e) {
    var zone = e.target.closest && e.target.closest('.dropzone');
    if (!zone) return;
    e.preventDefault();
    zone.classList.remove('is-dragover');
    var input = zone.querySelector('input[type="file"]');
    if (!input || !e.dataTransfer.files.length) return;
    input.files = e.dataTransfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  addBtn.addEventListener('click', function () {
    addPet();
    var cards = petCards();
    var last = cards[cards.length - 1];
    if (last) last.querySelector('input').focus();
  });

  newRequestBtn.addEventListener('click', resetForm);

  var checkin = $('checkin');
  var checkout = $('checkout');
  checkin.min = today;
  checkout.min = today;
  setCount(1);
  updateWarning();
  setInterval(updateWarning, 60000);

  nextBtn.addEventListener('click', function () {
    var errs = validate(step);
    if (errs.length) { showErrors(errs); return; }
    clearErrors();
    goStep(step + 1);
  });
  backBtn.addEventListener('click', function () { clearErrors(); goStep(step - 1); });

  // Prefill from the home page booking bar: ?service=&checkin=&checkout=&pet=
  (function prefill() {
    var q;
    try { q = new URLSearchParams(window.location.search); } catch (e) { return; }
    var svc = q.get('service');
    if (svc && SERVICE_LABELS[svc]) $('service').value = svc;
    var ci = q.get('checkin');
    var co = q.get('checkout');
    var iso = /^\d{4}-\d{2}-\d{2}$/;
    if (ci && iso.test(ci) && ci >= today) { checkin.value = ci; checkout.min = ci; }
    if (co && iso.test(co) && co >= (checkin.value || today)) checkout.value = co;
    var pet = q.get('pet');
    var first = petCards()[0];
    if (first && SPECIES_LABELS[pet]) $('pet-' + cardIdOf(first) + '-species').value = pet;
    updateWarning();
  })();
  goStep(1, false);
})();
