(async function () {
  'use strict';
  const S = window.TalentShortlist;
  const byId = id => document.getElementById(id);
  const selected = new Set();
  const displayName = person => S.personId(person) === 'linkedin:/in/corey-laffel-solon' ? 'Corey Laffel Solon' : S.name(person);
  let resolved;
  let activeDiscipline = 'All';
  const cards = new Map();
  function discipline(item) {
    if (/product manager/i.test(item.role)) return 'Product';
    if (/partner.*(?:growth|success|acquisition)/i.test(item.role)) return 'Partnerships';
    if (/counsel/i.test(item.role)) return 'Legal';
    if (/engineer/i.test(item.role)) return 'Engineering';
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
      const text = [displayName(item.person), item.role, brazeReasons[item.id] || item.note || '', S.value(item.person, ['Former Job Title', 'formerRole', 'role']), S.value(item.person, ['Description', 'description']), discipline(item)].join(' ').toLowerCase();
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
  const shortlistSlug = new URLSearchParams(window.location.search).get('list');
  const isBraze = shortlistSlug === 'braze' && !new URLSearchParams(window.location.hash.slice(1)).has('data');
  const isSeatGeek = shortlistSlug === 'seatgeek' && !new URLSearchParams(window.location.hash.slice(1)).has('data');
  const isExecutive = isBraze || isSeatGeek;
  // Public hiring posts supplied by the network curator; only verified matches display a manager.
  const doordashManagers = {
    'linkedin:/in/jessica-marie-fabrizi': ['Angel David', 'https://lnkd.in/p/gkBb5DxJ'],
    'linkedin:/in/gerard-salerno-28825146': ['Angel David', 'https://lnkd.in/p/gkBb5DxJ'],
    'linkedin:/in/chip-richards': ['Angel David', 'https://lnkd.in/p/gkBb5DxJ'],
    'linkedin:/in/jane-k-77b86b98': ['Logan D.', 'https://lnkd.in/p/gX2-daqB'],
    'linkedin:/in/patel-prem': ['Kazim Ahmed Mohammed', 'https://lnkd.in/p/gFuPpEfs'],
    'linkedin:/in/hoa-tommy-tran': ['Kazim Ahmed Mohammed', 'https://lnkd.in/p/gFuPpEfs']
  };
  const brazeHighlights = {
    'linkedin:/in/jill-weinstein-0192b4a': ['15+ years across Grubhub, PayPal and American Express','Reported churn reduction of up to 58%','Multi-million-dollar growth programs'],
    'linkedin:/in/corey-laffel-solon': ['15+ years in growth and marketing','Helped scale a $150M+ advertising business','Enterprise partner marketing'],
    'linkedin:/in/elena-moilan': ['Enterprise data onboarding and compliance','Cross-functional customer operations','Process and data governance improvements'],
    'linkedin:/in/daniel-hara-0258234': ['13+ years at Grubhub','Progressed from tech lead to Associate Director','Led Android, iOS and web teams'],
    'linkedin:/in/patel-prem': ['Backend platforms and APIs','Checkout and payments systems','Distributed systems engineering'],
    'linkedin:/in/kritikaumashankar': ['React, Node.js and Java development','Recent full-stack application delivery','Experience spanning frontend and backend'],
    'linkedin:/in/roxanne-dean-856bb0216': ['Salesforce and revenue operations','Cross-functional system implementations','Data and process improvement'],
    'linkedin:/in/edsancha': ['20+ years leading product engineering','30+ applications and services; teams up to 36','AI-enabled customer care and platform modernization'],
    'linkedin:/in/pdelucena': ['Technical PM and decision science at Grubhub','CTO and Head of Product at Unlocked Labs','AI product development at TalentBot; Blackboard integrations']
  };
  const brazeReasons = {
    'linkedin:/in/jill-weinstein-0192b4a': 'Jill has led B2B marketing and lifecycle programs at major platforms, with reported outcomes in growth and retention. Her experience is directly relevant to the Director, Lifecycle Marketing conversation already underway.',
    'linkedin:/in/corey-laffel-solon': 'Corey brings enterprise partner marketing and monetization experience, including scaling a major advertising business. That commercial perspective is relevant to Braze growth and partnership leadership.',
    'linkedin:/in/elena-moilan': 'Elena brings operational depth in enterprise onboarding, escalation, and data governance. Those strengths translate to complex customer-facing programs; direct ownership of renewals and expansion remains to be confirmed.',
    'linkedin:/in/daniel-hara-0258234': 'Daniel helped build and lead mobile and post-purchase experiences at marketplace scale. His engineering leadership across mobile and web teams is relevant to Braze product engineering.',
    'linkedin:/in/patel-prem': 'Prem has built backend, API, checkout, and distributed systems. That foundation could translate to Braze platform engineering, subject to the specific team stack and system-scale requirements.',
    'linkedin:/in/kritikaumashankar': 'Kritika combines modern React and Node.js development with Java experience. Her full-stack background is relevant to application teams, with role-specific stack and production-scale fit to establish.',
    'linkedin:/in/roxanne-dean-856bb0216': 'Roxanne combines Salesforce, revenue operations, and cross-functional process implementation experience. She offers relevant skills for the systems and processes supporting commercial operations.',
    'linkedin:/in/edsancha': 'Eduardo brings 20+ years in consumer product engineering, leading multi-team organizations and modernization across 30+ services. His experience in AI-enabled care and platform delivery warrants a VP, Product Engineering conversation; messaging-channel depth, VP-level management scope and NYC feasibility remain open questions.',
    'linkedin:/in/pdelucena': 'Paul combines technical product ownership, AI product development, SDK and integration architecture, and decision science. His product work across Grubhub, Unlocked Labs, TalentBot, and Blackboard is relevant to Braze Banners and Content Cards; confirm eight-plus years of formal PM tenure and NYC hybrid feasibility.'
  };
  function updateBrazeSelection() {
    if (!isExecutive || !resolved) return;
    const button = byId('copy-interest');
    button.disabled = selected.size === 0;
    button.textContent = selected.size ? `Copy introduction request · ${selected.size}` : 'Select someone to request an introduction';
    const count = byId('braze-selection-count');
    if (count) count.textContent = `${selected.size} selected`;
    const names = byId('braze-selection-names');
    if (names) names.textContent = resolved.items.filter(item => selected.has(item.id)).map(item => displayName(item.person)).join(' · ') || 'Choose people above to build your request';
  }
  function brazeCard(item) {
    const person = item.person;
    const card = node('article', '', 'shortlist-card braze-candidate');
    card.appendChild(node('p', discipline(item), 'recruiter-discipline'));
    const who = node('section', '', 'braze-who');
    who.appendChild(node('p', 'WHO', 'braze-kicker'));
    who.appendChild(node('h2', displayName(person)));
    who.appendChild(node('p', S.value(person, ['Former Job Title','formerRole','role']), 'recruiter-background'));
    who.appendChild(node('p', S.value(person, ['Location','location']), 'recruiter-location'));
    card.appendChild(who);
    const why = node('section', '', 'braze-why');
    why.appendChild(node('h3', isSeatGeek ? 'Why SeatGeek should meet them' : 'Why Braze should meet them'));
    why.appendChild(node('p', isSeatGeek ? (item.note || 'Explore this candidate’s relevant background.') : (brazeReasons[item.id] || item.note || 'Explore this candidate’s relevant background.')));
    const highlights = node('ul', '', 'braze-highlights');
    for (const h of (isSeatGeek ? [] : (brazeHighlights[item.id] || []))) highlights.appendChild(node('li', h));
    why.appendChild(highlights);
    card.appendChild(why);
    const opportunity = node('section', '', 'braze-opportunity');
    opportunity.appendChild(node('p',isSeatGeek ? 'POTENTIAL SEATGEEK ALIGNMENT' : 'POTENTIAL BRAZE ALIGNMENT','braze-kicker'));
    opportunity.appendChild(item.url ? external(item.role, item.url) : node('strong', item.role || 'Exploratory introduction'));
    if (!item.url || (isSeatGeek && /seatgeek\.com\/jobs\/?$/.test(item.url))) opportunity.appendChild(node('small', 'Exploratory alignment · specific opening not confirmed'));
    card.appendChild(opportunity);
    if (isSeatGeek) {
      const profileText = S.value(person, ['Description','description','Short Description']);
      const background = node('details', '', 'braze-details seatgeek-background');
      background.appendChild(node('summary', 'Explore full professional background'));
      const content = node('div', '', 'seatgeek-background-content');
      const previousRole = S.value(person, ['Former Job Title', 'formerRole', 'role']);
      if (previousRole) content.appendChild(node('p', previousRole, 'seatgeek-background-position'));
      content.appendChild(node('p', profileText || 'Additional experience is available through the candidate’s public profile.'));
      background.appendChild(content);
      card.appendChild(background);
    }
    const meet = node('section', '', 'braze-meet');
    meet.appendChild(node('h3', 'How to meet them'));
    const actions = node('div', '', 'braze-actions');
    const link = S.linkedin(person);
    if (link) actions.appendChild(external('View LinkedIn ↗', link));
    const pick = node('button', '＋ Add to introduction list', 'braze-select');
    pick.type = 'button';
    pick.setAttribute('aria-pressed', 'false');
    pick.onclick = () => {
      if (selected.has(item.id)) selected.delete(item.id);
      else selected.add(item.id);
      const active = selected.has(item.id);
      pick.setAttribute('aria-pressed', String(active));
      pick.textContent = active ? '✓ Added to introduction list' : '＋ Add to introduction list';
      updateBrazeSelection();
    };
    actions.appendChild(pick);
    meet.appendChild(actions);
    card.appendChild(meet);
    if (!isSeatGeek) {
      const details = node('details', '', 'braze-details');
      details.appendChild(node('summary', 'Read full background'));
      details.appendChild(node('p', S.value(person, ['Description','description','Short Description'])));
      card.appendChild(details);
    }
    return card;
  }
  try {
    let raw;
    let supplementalProfiles = [];
    const params = new URLSearchParams(window.location.search);
    const data = new URLSearchParams(window.location.hash.slice(1)).get('data');
    if (data) raw = S.decode(data);
    else {
      const slug = params.get('list');
      if (slug === 'braze' || slug === 'seatgeek') {
        if (slug === 'seatgeek') document.body.classList.add('seatgeek-shortlist');
        document.body.classList.add('braze-shortlist');
        const fonts = document.createElement('link');
        fonts.rel = 'stylesheet';
        fonts.href = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
        document.head.appendChild(fonts);
      }
      if (!slug || slug.length > 60 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Choose a shortlist link from its sender, or create one from the directory.');
      const response = await fetch(`./shortlists/${slug}.json?v=seatgeek-fix-20261023-2`, { cache: 'no-store' });
      if (!response.ok) throw new Error('This saved shortlist is unavailable. Ask the sender for a current link.');
      raw = S.validate(await response.json());
      // Company-scoped introductions are maintained separately from the opt-in directory.
      // Shared URL payloads cannot supply or restore profile data.
      if (slug === 'shopify' || slug === 'braze') {
        const profiles = await fetch(`./shortlists/${slug}-profiles.json`, { cache: 'no-store' });
        if (profiles.ok) {
          const entries = await profiles.json();
          if (!Array.isArray(entries)) throw new Error('Community introductions are unavailable.');
          supplementalProfiles = entries.map(person => ({ ...person, shortlistIntroduction: true }));
        }
      }
    }
    const response = await fetch('./people.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load current profiles. Please refresh to try again.');
    const people = await response.json();
    if (!Array.isArray(people)) throw new Error('The directory is unavailable. Please try again later.');
    resolved = S.resolve(raw, [...people, ...supplementalProfiles]);
    byId('shortlist-title').textContent = resolved.title;
    document.title = `${resolved.title} | Talent Network HQ`;
    byId('shortlist-intro').textContent = resolved.intro;
    byId('shortlist-status').textContent = resolved.unavailable ? `${resolved.unavailable} selected profile(s) are no longer available in the current sources.` : '';
    for (const item of resolved.items) {
      if (isExecutive) {
        const card = brazeCard(item);
        cards.set(item.id, card);
        byId('shortlist-cards').appendChild(card);
        continue;
      }
      const person = item.person;
      const card = node('article', '', 'shortlist-card');
      if (shortlistSlug === 'doordash' && doordashManagers[item.id]) {
        const [managerName, hiringPost] = doordashManagers[item.id];
        const manager = node('div', '', 'shortlist-hiring-manager');
        manager.appendChild(node('span', 'TARGETED HIRING MANAGER', 'shortlist-manager-label'));
        manager.appendChild(external(managerName + ' · View hiring post 🔗', hiringPost));
        card.appendChild(manager);
      }
      card.appendChild(node('p', discipline(item), 'recruiter-discipline'));
      card.appendChild(node('h2', displayName(person)));
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
      else if (person.shortlistIntroduction) footer.appendChild(node('span', 'Ask Irvin for an introduction'));
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
      checkbox.setAttribute('aria-label', `Interested in ${displayName(person)}`);
      label.append(checkbox, node('span', 'Interested')); footer.appendChild(label); card.appendChild(footer);
      const current = S.value(person, ['Open to Work', 'openToWork', 'availability']).toLowerCase();
      card.appendChild(node('p', ['yes', 'true', 'active', 'actively searching'].includes(current) ? 'Listed as actively searching · Confirm current availability' : 'Availability unverified', 'recruiter-availability'));
      cards.set(item.id, card);
      byId('shortlist-cards').appendChild(card);
    }
    renderFilters();
    if (isExecutive) {
      const response = byId('shortlist-response');
      response.classList.add('braze-selection-panel');
      const heading = response.querySelector('h2');
      heading.textContent = 'Build your introduction list';
      const lead = response.querySelector('p:not(.recruiter-eyebrow)');
      lead.textContent = 'Select the people you would like to meet, then copy a prepared request to send to Irvin. No message is sent automatically.';
      const summary = node('div', '', 'braze-selection-summary');
      summary.appendChild(node('strong', '0 selected', 'braze-selection-count'));
      summary.firstChild.id = 'braze-selection-count';
      const names = node('p', 'Choose people above to build your request'); names.id = 'braze-selection-names'; summary.appendChild(names);
      response.insertBefore(summary, response.querySelector('.recruiter-response-actions'));
      updateBrazeSelection();
    }
    byId('shortlist-response').hidden = !resolved.items.length;
    if (!resolved.items.length) byId('shortlist-status').textContent += ' No current candidates are available in this shortlist. Contact the sender for an update.';
  } catch (error) {
    byId('shortlist-title').textContent = 'Shortlist unavailable';
    byId('shortlist-status').textContent = error.message;
    byId('shortlist-status').classList.add('error');
  }
  byId('copy-interest').onclick = () => {
    if (!resolved) return;
    const items = resolved.items.filter(item => isExecutive ? selected.has(item.id) : (!selected.size || selected.has(item.id)));
    if (!items.length) return;
    copy(`I’d like to learn more about these candidates from “${resolved.title}”:\n\n${items.map(item => `• ${displayName(item.person)}${item.role ? ` — ${item.role}` : ''}`).join('\n')}\n\nCould you confirm their interest and availability for an introduction?`);
  };
  byId('copy-shortlist-link').onclick = () => copy(window.location.href);
})();
