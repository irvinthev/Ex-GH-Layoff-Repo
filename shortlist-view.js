(async function () {
  'use strict';
  const S = window.TalentShortlist;
  const byId = id => document.getElementById(id);
  const selected = new Set();
  let resolved;
  let activeDiscipline = 'All';
  const cards = new Map();
  function discipline(item) {
    if (/product manager/i.test(item.role)) return 'Product';
    if (/partner.*(?:growth|success|acquisition)/i.test(item.role)) return 'Partnerships';
    if (/counsel/i.test(item.role)) return 'Legal';
    if (/operations/i.test(item.role)) return 'Operations';
    const fn = S.value(item.person, ['Function', 'function']);
    if (/marketing/i.test(fn)) return 'Marketing';
    if (/engineering/i.test(fn)) return 'Engineering';
    return fn || 'Other';
  }
  function filterCards() {
    const query = byId('shortlist-search').value.toLowerCase().trim();
    let count = 0;
    for (const item of resolved.items) {
      const text = [S.name(item.person), item.role, S.value(item.person, ['Former Job Title', 'formerRole', 'role']), S.value(item.person, ['Description', 'description']), discipline(item)].join(' ').toLowerCase();
      const matches = (activeDiscipline === 'All' || discipline(item) === activeDiscipline) && text.includes(query);
      cards.get(item.id).hidden = !matches;
      if (matches) count++;
    }
    byId('shortlist-count').textContent = `${count} of ${resolved.items.length} people`;
    byId('shortlist-empty').hidden = count > 0 || !resolved.items.length;
  }
  function renderFilters() {
    const categories = ['All', ...new Set(resolved.items.map(discipline))];
    for (const category of categories) {
      const button = node('button', category, 'recruiter-filter'); button.type = 'button';
      button.setAttribute('aria-pressed', String(category === activeDiscipline));
      button.onclick = () => {
        activeDiscipline = category;
        byId('shortlist-filters').querySelectorAll('button').forEach(btn => btn.setAttribute('aria-pressed', String(btn === button)));
        filterCards();
      };
      byId('shortlist-filters').appendChild(button);
    }
    byId('shortlist-search').oninput = filterCards;
    filterCards();
  }
  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function external(text, url) {
    const link = node('a', text); link.href = S.safeUrl(url); link.target = '_blank'; link.rel = 'noopener noreferrer'; return link;
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); byId('copy-status').textContent = 'Copied. Paste it into your reply to the sender.'; }
    catch { byId('copy-output').value = text; byId('copy-output-label').hidden = false; byId('copy-output').focus(); byId('copy-output').select(); byId('copy-status').textContent = 'Copy the selected text manually.'; }
  }
  try {
    let raw;
    const params = new URLSearchParams(window.location.search);
    const data = new URLSearchParams(window.location.hash.slice(1)).get('data');
    if (data) raw = S.decode(data);
    else {
      const slug = params.get('list');
      if (!slug || slug.length > 60 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Choose a shortlist link from its sender, or create one from the directory.');
      const response = await fetch(`./shortlists/${slug}.json`, { cache: 'no-store' });
      if (!response.ok) throw new Error('This saved shortlist is unavailable. Ask the sender for a current link.');
      raw = S.validate(await response.json());
    }
    const response = await fetch('./people.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load current profiles. Please refresh to try again.');
    const people = await response.json();
    if (!Array.isArray(people)) throw new Error('The directory is unavailable. Please try again later.');
    resolved = S.resolve(raw, people);
    byId('shortlist-title').textContent = resolved.title;
    document.title = `${resolved.title} | Talent Network HQ`;
    byId('shortlist-intro').textContent = resolved.intro;
    byId('shortlist-status').textContent = resolved.unavailable ? `${resolved.unavailable} selected profile(s) are no longer available in the public directory.` : '';
    for (const item of resolved.items) {
      const person = item.person;
      const card = node('article', '', 'shortlist-card');
      card.appendChild(node('p', discipline(item), 'recruiter-discipline'));
      card.appendChild(node('h2', S.name(person)));
      card.appendChild(node('p', S.value(person, ['Former Job Title', 'formerRole', 'role']), 'recruiter-background'));
      card.appendChild(node('p', S.value(person, ['Location', 'location']), 'recruiter-location'));
      const bio = S.value(person, ['Description', 'description', 'Short Description']);
      const background = node('div', '', 'shortlist-profile-bio');
      background.appendChild(node('p', bio.length > 260 ? `${bio.slice(0, 260).trim()}…` : bio));
      if (bio.length > 260) {
        const details = node('details'); details.appendChild(node('summary', 'Read full background'));
        details.appendChild(node('p', bio)); background.appendChild(details);
      }
      card.appendChild(background);
      if (item.role || item.url || item.note) {
        const role = node('div', '', 'shortlist-role'); role.appendChild(node('small', 'Suggested opportunity'));
        role.appendChild(item.url ? external(item.role || 'View role ↗', item.url) : node('h3', item.role));
        if (item.note) role.appendChild(node('p', item.note));
        card.appendChild(role);
      }
      const footer = node('div', '', 'recruiter-card-footer');
      const link = S.linkedin(person);
      if (link) footer.appendChild(external('LinkedIn ↗', link));
      else {
        const profile = node('a', 'View public profile ↗');
        profile.href = `index.html?search=${encodeURIComponent(S.name(person))}&expand=1#directory-section`;
        profile.target = '_blank'; profile.rel = 'noopener noreferrer'; footer.appendChild(profile);
      }
      const label = node('label', '', 'shortlist-interest'); const checkbox = node('input'); checkbox.type = 'checkbox';
      checkbox.onchange = () => {
        checkbox.checked ? selected.add(item.id) : selected.delete(item.id);
        byId('copy-interest').textContent = selected.size ? `Copy ${selected.size} selected name${selected.size === 1 ? '' : 's'}` : 'Copy all names';
      };
      checkbox.setAttribute('aria-label', `Interested in ${S.name(person)}`);
      label.append(checkbox, node('span', 'Interested')); footer.appendChild(label); card.appendChild(footer);
      const current = S.value(person, ['Open to Work', 'openToWork', 'availability']).toLowerCase();
      card.appendChild(node('p', ['yes', 'true', 'active', 'actively searching'].includes(current) ? 'Listed as actively searching · Confirm current availability' : 'Availability unverified', 'recruiter-availability'));
      cards.set(item.id, card);
      byId('shortlist-cards').appendChild(card);
    }
    renderFilters();
    byId('shortlist-response').hidden = !resolved.items.length;
    if (!resolved.items.length) byId('shortlist-status').textContent += ' No current candidates are available in this shortlist. Contact the sender for an update.';
  } catch (error) {
    byId('shortlist-title').textContent = 'Shortlist unavailable';
    byId('shortlist-status').textContent = error.message;
    byId('shortlist-status').classList.add('error');
  }
  byId('copy-interest').onclick = () => {
    const items = resolved.items.filter(item => !selected.size || selected.has(item.id));
    copy(`I’d like to learn more about these candidates from “${resolved.title}”:\n\n${items.map(item => `• ${S.name(item.person)}${item.role ? ` — ${item.role}` : ''}`).join('\n')}\n\nCould you confirm their interest and availability for an introduction?`);
  };
  byId('copy-shortlist-link').onclick = () => copy(window.location.href);
})();
