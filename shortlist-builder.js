(async function () {
  'use strict';
  const S = window.TalentShortlist;
  const byId = id => document.getElementById(id);
  const status = byId('builder-status');
  let storage;
  try { storage = window.sessionStorage; } catch { storage = null; }
  let draft = S.draftFrom(storage);
  let people = [];
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function message(text, error = false) {
    status.textContent = text;
    status.classList.toggle('error', error);
  }
  function persist() {
    draft.title = byId('list-title').value;
    draft.intro = byId('list-intro').value;
    if (!S.saveDraft(storage, draft)) message('Tab storage is unavailable. Keep this page open until you copy the link.');
    byId('share-result').hidden = true;
  }
  function toggle(person, checked) {
    const id = S.personId(person);
    if (checked && !draft.items.some(item => item.id === id)) {
      if (draft.items.length >= S.MAX_ITEMS) { message(`A shortlist can include up to ${S.MAX_ITEMS} people.`, true); renderChoices(); return; }
      draft.items.push({ id, role: '', url: '', note: '' });
    } else if (!checked) draft.items = draft.items.filter(item => item.id !== id);
    message(''); persist(); renderChoices(); renderSelected();
  }
  function renderChoices() {
    const query = byId('candidate-search').value;
    const results = byId('candidate-results');
    results.replaceChildren();
    byId('selection-count').textContent = `${draft.items.length} of ${S.MAX_ITEMS} people selected`;
    const filtered = people.filter(person => window.DirectorySearch.matches(query, [S.name(person), S.value(person, ['Former Job Title', 'formerRole', 'role']), S.value(person, ['Description', 'description']), S.value(person, ['Top 3 Skills', 'skills'])]));
    if (!filtered.length) results.appendChild(element('p', 'No matching public profiles. Try a different search.'));
    for (const person of filtered) {
      const label = element('label', '', 'shortlist-candidate-result');
      const checkbox = element('input'); checkbox.type = 'checkbox';
      checkbox.checked = draft.items.some(item => item.id === S.personId(person));
      checkbox.onchange = () => toggle(person, checkbox.checked);
      label.append(checkbox, element('span', `${S.name(person)} — ${S.value(person, ['Former Job Title', 'formerRole', 'role'])}`));
      results.appendChild(label);
    }
  }
  function renderSelected() {
    const container = byId('selected-people'); container.replaceChildren();
    if (!draft.items.length) container.appendChild(element('p', 'Select people above or use the checkboxes in the directory.'));
    draft.items.forEach(item => {
      const person = people.find(person => S.personId(person) === item.id);
      const card = element('article', '', 'shortlist-builder-row');
      const top = element('div', '', 'shortlist-row-top');
      top.appendChild(element('h3', S.name(person)));
      const remove = element('button', 'Remove', 'clear-btn'); remove.type = 'button';
      remove.setAttribute('aria-label', `Remove ${S.name(person)} from shortlist`);
      remove.onclick = () => toggle(person, false); top.appendChild(remove); card.appendChild(top);
      const fields = element('div', '', 'shortlist-metadata');
      for (const [key, caption, max, tag] of [['role', 'Suggested role', 160, 'input'], ['url', 'Role URL', 1000, 'input'], ['note', 'Why this person may fit / points to explore', 500, 'textarea']]) {
        const label = element('label', caption, key === 'note' ? 'shortlist-note-field' : '');
        const input = element(tag); input.maxLength = max; input.value = item[key];
        if (key === 'url') { input.type = 'url'; input.placeholder = 'https://…'; }
        input.oninput = () => { item[key] = input.value; persist(); };
        label.appendChild(input); fields.appendChild(label);
      }
      card.appendChild(fields); container.appendChild(card);
    });
  }
  byId('list-title').oninput = persist;
  byId('list-intro').oninput = persist;
  byId('candidate-search').oninput = renderChoices;
  byId('clear-draft').onclick = () => {
    draft = { v: 1, title: '', intro: '', items: [] };
    byId('list-title').value = ''; byId('list-intro').value = '';
    persist(); renderChoices(); renderSelected(); message('Draft cleared. Previously shared links still work.');
  };
  byId('shortlist-form').onsubmit = event => {
    event.preventDefault();
    try {
      persist();
      const url = new URL('shortlist.html', window.location.href); url.hash = `data=${S.encode(draft)}`;
      byId('share-url').value = url.href; byId('preview-link').href = url.href;
      byId('share-result').hidden = false; message('Link created. Preview it before sharing.');
      byId('share-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) { message(error.message, true); }
  };
  byId('copy-link').onclick = async () => {
    try { await navigator.clipboard.writeText(byId('share-url').value); byId('share-result-note').textContent = 'Link copied. Ready to share.'; }
    catch { byId('share-url').focus(); byId('share-url').select(); byId('share-result-note').textContent = 'Copy the selected link manually.'; }
  };
  try {
    const res = await fetch('./people.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load current profiles. Please refresh to try again.');
    people = await res.json();
    if (!Array.isArray(people)) throw new Error('The directory is unavailable. Please try again later.');
    const incoming = new URLSearchParams(window.location.hash.slice(1)).get('from');
    if (incoming) { draft = S.decode(incoming); history.replaceState(null, '', window.location.pathname + window.location.search); }
    // Drop references to removed profiles, including draft data held in tab storage.
    const resolved = S.resolve({ ...draft, title: draft.title || 'Recruiter shortlist' }, people);
    draft.items = resolved.items.map(({ person, ...item }) => item);
    if (resolved.unavailable) message(`${resolved.unavailable} profile(s) are no longer available and were removed from the draft.`);
    byId('list-title').value = draft.title; byId('list-intro').value = draft.intro;
    S.saveDraft(storage, draft); renderChoices(); renderSelected(); byId('generate-link').disabled = false;
  } catch (error) { message(error.message, true); }
})();
