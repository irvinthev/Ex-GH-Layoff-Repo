(async function () {
  'use strict';
  const S = window.TalentShortlist;
  const byId = id => document.getElementById(id);
  const selected = new Set();
  let resolved;
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
    byId('shortlist-status').textContent = `${resolved.items.length} current public profile${resolved.items.length === 1 ? '' : 's'}${resolved.unavailable ? ` · ${resolved.unavailable} selected profile(s) are no longer available.` : ''}`;
    for (const item of resolved.items) {
      const person = item.person;
      const card = node('article', '', 'shortlist-card');
      card.appendChild(node('h2', S.name(person)));
      card.appendChild(node('p', S.value(person, ['Former Job Title', 'formerRole', 'role'])));
      card.appendChild(node('p', S.value(person, ['Location', 'location']), 'shortlist-help'));
      card.appendChild(node('p', S.value(person, ['Description', 'description', 'Short Description']), 'shortlist-profile-bio'));
      const link = S.linkedin(person);
      if (link) card.appendChild(external('View LinkedIn ↗', link));
      const current = S.value(person, ['Open to Work', 'openToWork', 'availability']).toLowerCase();
      card.appendChild(node('p', ['yes', 'true', 'active', 'actively searching'].includes(current) ? 'Listed as actively searching; confirm current availability.' : 'Availability unverified.', 'shortlist-help'));
      if (item.role || item.url || item.note) {
        const role = node('div', '', 'shortlist-role'); role.appendChild(node('small', 'Suggested opportunity · Sender’s assessment'));
        role.appendChild(item.url ? external(item.role || 'View role ↗', item.url) : node('h3', item.role));
        if (item.note) role.appendChild(node('p', item.note));
        card.appendChild(role);
      }
      const label = node('label', '', 'shortlist-interest'); const checkbox = node('input'); checkbox.type = 'checkbox';
      checkbox.onchange = () => {
        checkbox.checked ? selected.add(item.id) : selected.delete(item.id);
        byId('copy-interest').textContent = selected.size ? `Copy ${selected.size} selected name${selected.size === 1 ? '' : 's'}` : 'Copy interest list';
      };
      label.append(checkbox, node('span', `Interested in ${S.name(person)}`)); card.appendChild(label);
      byId('shortlist-cards').appendChild(card);
    }
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
