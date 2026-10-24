(async function () {
  'use strict';
  const S = window.TalentShortlist;
  const byId = id => document.getElementById(id);
  const selected = new Set();
  const displayName = person => S.personId(person) === 'linkedin:/in/corey-laffel-solon' ? 'Corey Laffel Solon' : S.name(person);
  let resolved;
  let activeDiscipline = 'All';
  // DoorDash uses one shortlist with shareable team-specific views.
  const doorDashTeams = [
    ['overview','Overview'], ['sales','Sales & SevenRooms'], ['engineering','Engineering'],
    ['product','Product & Strategy'], ['partnerships','Partnerships & Success'], ['data','Data & AI']
  ];
  const angiTeams = [['overview','Overview'],['large-pro','Large Pro & Partnerships'],['enterprise-sales','Enterprise Sales'],['enablement','Sales Enablement']];
  const angiTeamMembers = { 'large-pro':['linkedin:/in/elizabeth-doll-a45b10b0','linkedin:/in/michael-cognetti-3b926910b','linkedin:/in/corey-laffel-solon','linkedin:/in/christian-reeve','linkedin:/in/jonathan-spatz'], 'enterprise-sales':['linkedin:/in/chip-richards'], enablement:['linkedin:/in/jacqueline-wujec'] };
  const angiTeamExplanations = { overview:'Browse seven candidates across three Angi teams. Contacts below have public hiring signals; requisition ownership is only confirmed when explicitly stated.', 'large-pro':'Enterprise partnership and marketplace strategy. Lily Inman Wilson publicly announced Large Pro hiring, but does not establish ownership of every requisition.', 'enterprise-sales':'Enterprise new business. Steven Woody publicly recruited for related Angi enterprise sales roles; ownership of this exact opening is unconfirmed.', enablement:'Sales enablement strategy. Bethanni Buikema publicly identified this opening as part of her team.' };
  const angiHiringSignals = { 'linkedin:/in/elizabeth-doll-a45b10b0':['Kristen le Roux','','Relevant Angi recruiting contact for Senior Account Partner'], 'linkedin:/in/michael-cognetti-3b926910b':['Kristen le Roux','','Relevant Angi recruiting contact for Senior Account Partner'], 'linkedin:/in/corey-laffel-solon':['Lily Inman Wilson','https://www.linkedin.com/in/linktolily','Large Pro team hiring; requisition owner unconfirmed'], 'linkedin:/in/christian-reeve':['Lily Inman Wilson','https://www.linkedin.com/in/linktolily','Large Pro hiring announcement; reporting line unconfirmed'], 'linkedin:/in/jonathan-spatz':['Lily Inman Wilson','https://www.linkedin.com/in/linktolily','Large Pro hiring announcement; reporting line unconfirmed'], 'linkedin:/in/chip-richards':['Steven Woody','https://www.linkedin.com/in/stevenwoody3','Recruited for related enterprise sales roles; owner unconfirmed'], 'linkedin:/in/jacqueline-wujec':['Bethanni Buikema','https://www.linkedin.com/in/bethanni-buikema','Publicly confirmed: this role is on her team'] };
  const airbnbTeams = [
    ['overview','Overview'],['product','Product & Platform'],
    ['experiences','Experiences & Growth'],['support','Community Support'],['partnerships','Partnerships'],
    ['engineering','Engineering & Analytics']
  ];
  const airbnbTeamMembers = {
    experiences:['linkedin:/in/elena-moilan'],
    support:['linkedin:/in/tai-worlds-mba-pmp-csm-28b98a282'],
    product:['linkedin:/in/connorkaddatz','linkedin:/in/pdelucena'],
    partnerships:['linkedin:/in/corey-laffel-solon','linkedin:/in/michael-cognetti-3b926910b'],
    engineering:['linkedin:/in/abhinauv-kapoor']
  };
  const airbnbTeamExplanations = {
    overview:'Curated introductions across four Airbnb organizations. Contacts below are relevant team leaders with past public hiring signals, not confirmed owners of these specific requisitions.',
    experiences:'Airbnb Experiences growth and business operations. Lauren Dickstein has publicly recruited for related growth roles and Bertrand Burdet previously promoted this specific position; current hiring ownership is not confirmed.',
    support:'Program management and process improvement candidates. Zach Hinkle previously recruited within Community Support; direct ownership of these requisitions is not established.',
    product:'API platform product candidates. Rohan Kamath previously recruited for platform product leadership; this does not establish ownership of the API Platform opening.',
    partnerships:'Commercial partnerships candidates. Sam Kline and Alston Cheek have public historical hiring signals; current opening ownership is unconfirmed.',
    engineering:'Media Foundation engineering leadership. This new requisition needs a directly relevant hiring contact; no current owner has been established.'
  };
  const airbnbHiringSignals = {
    'linkedin:/in/elena-moilan': [['Lauren Dickstein — Experiences Growth','https://www.linkedin.com/posts/lauren-dickstein-0182532a_dream-jobs-alert-looking-for-the-activity-7419399259336122368-HkKy'],['Bertrand Burdet — posted this role','https://www.linkedin.com/posts/bertrand-burdet-6796ab23_programs-and-business-operations-lead-careers-activity-7445458011092914176-UJW8']],
    'linkedin:/in/tai-worlds-mba-pmp-csm-28b98a282': [['Zach Hinkle','https://www.linkedin.com/posts/zachhinkle_senior-program-manager-community-support-activity-7356755772745129984-qC-8']],
    'linkedin:/in/connorkaddatz': [['Rohan Kamath','https://www.linkedin.com/posts/rohankamath_staff-platform-manager-business-host-payouts-activity-7442628207503343616-8D_6']],
    'linkedin:/in/pdelucena': [['Rohan Kamath','https://www.linkedin.com/posts/rohankamath_staff-platform-manager-business-host-payouts-activity-7442628207503343616-8D_6']],
    'linkedin:/in/corey-laffel-solon': [['Sam Kline','https://www.linkedin.com/posts/jamieconlonrocha_partnerships-strategy-lead-magnit-airbnb-activity-7503149673151361024-ZDSM']],
    'linkedin:/in/michael-cognetti-3b926910b': [['Sam Kline','https://www.linkedin.com/posts/jamieconlonrocha_partnerships-strategy-lead-magnit-airbnb-activity-7503149673151361024-ZDSM']],
  };
  const doorDashTeamMembers = {
    sales: ['linkedin:/in/jessica-marie-fabrizi','linkedin:/in/gerard-salerno-28825146','linkedin:/in/chip-richards','linkedin:/in/jane-k-77b86b98'],
    engineering: ['linkedin:/in/patel-prem','linkedin:/in/hoa-tommy-tran','linkedin:/in/mingyang-yan','linkedin:/in/ankita0207','linkedin:/in/daniel-hara-0258234'],
    product: ['linkedin:/in/arushi-tayal','linkedin:/in/connorkaddatz'],
    partnerships: ['linkedin:/in/michael-cognetti-3b926910b','linkedin:/in/corey-laffel-solon','linkedin:/in/jill-weinstein-0192b4a'],
    data: []
  };
  const doorDashTeamExplanations = {
    overview: 'Explore all curated introductions or choose a team to share a more focused link.',
    sales: 'Sales and SevenRooms prospects. Manager announcements identify potential pathways; location and qualifications require confirmation.',
    engineering: 'Platform, mobile and merchant-systems engineers. Only the Merchant GTM prospects currently have a named hiring-manager post.',
    product: 'Product leaders matched to general recruiting opportunities; specific hiring managers are not yet confirmed.',
    partnerships: 'Merchant partnerships, lifecycle marketing and customer engagement matches; some previously listed roles need a fresh status check.',
    data: 'No verified candidate match yet for the specialist Agentic Foundations ML opening. We will not imply that general AI exposure meets the production ML requirements.'
  };
  const shortlistQuery = new URLSearchParams(window.location.search);
  const doorDashPortal = shortlistQuery.get('list') === 'doordash' && !new URLSearchParams(window.location.hash.slice(1)).has('data');
  const airbnbPortal = shortlistQuery.get('list') === 'airbnb' && !new URLSearchParams(window.location.hash.slice(1)).has('data');
  const angiPortal = shortlistQuery.get('list') === 'angi' && !new URLSearchParams(window.location.hash.slice(1)).has('data');
  const requestedTeam = shortlistQuery.get('team') || 'overview';
  const portalTeams = angiPortal ? angiTeams : airbnbPortal ? airbnbTeams : doorDashTeams;
  let activeTeam = portalTeams.some(([slug]) => slug === requestedTeam) ? requestedTeam : 'overview';
  function setupDoorDashTabs() {
    if (!doorDashPortal && !airbnbPortal && !angiPortal) return;
    const nav = node('nav','','doordash-team-nav');
    nav.setAttribute('aria-label', angiPortal ? 'Angi hiring teams' : airbnbPortal ? 'Airbnb hiring teams' : 'DoorDash hiring teams');
    for (const [slug,label] of portalTeams) {
      const a = node('a',label,'doordash-team-tab');
      const url = new URL(window.location.href);
      if (slug === 'overview') url.searchParams.delete('team'); else url.searchParams.set('team',slug);
      a.href = url.pathname + url.search + url.hash;
      a.setAttribute('aria-current',activeTeam === slug ? 'page' : 'false');
      nav.appendChild(a);
    }
    if (airbnbPortal || angiPortal) {
      const mobile = node('div','','airbnb-mobile-team-picker');
      const label = node('label',angiPortal ? 'Browse Angi teams' : 'Browse Airbnb teams','airbnb-mobile-team-label');
      label.htmlFor = 'airbnb-team-select';
      const select = node('select','','airbnb-team-select');
      select.id = 'airbnb-team-select';
      for (const [slug, name] of portalTeams) {
        const option = node('option',name);
        option.value = slug;
        option.selected = slug === activeTeam;
        select.appendChild(option);
      }
      select.onchange = () => {
        const target = new URL(window.location.href);
        if (select.value === 'overview') target.searchParams.delete('team');
        else target.searchParams.set('team',select.value);
        window.location.assign(target.href);
      };
      mobile.append(label,select);
      nav.after(mobile);
      if (activeTeam !== 'overview') {
        const secondary = byId('shortlist-filters');
        secondary.hidden = true;
        secondary.setAttribute('aria-hidden','true');
      }
    }
    const heading = node('div','','doordash-team-context');
    const title = node('h2',portalTeams.find(([s])=>s===activeTeam)[1]);
    const description = node('p',(angiPortal ? angiTeamExplanations : airbnbPortal ? airbnbTeamExplanations : doorDashTeamExplanations)[activeTeam]);
    heading.append(title,description);
    const filterArea = byId('shortlist-filters').closest('.recruiter-explore');
    filterArea.parentNode.insertBefore(nav,filterArea);
    filterArea.parentNode.insertBefore(heading,filterArea);
  }

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
      const inTeam = !(doorDashPortal || airbnbPortal || angiPortal) || activeTeam === 'overview' || ((angiPortal ? angiTeamMembers : airbnbPortal ? airbnbTeamMembers : doorDashTeamMembers)[activeTeam] || []).includes(item.id);
      const matches = inTeam && (activeDiscipline === 'All' || discipline(item) === activeDiscipline) && text.includes(query);
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
  const isExecutive = isBraze || isSeatGeek || airbnbPortal || angiPortal;
  // Public hiring posts supplied by the network curator; only verified matches display a manager.
  const doordashManagers = {
    'linkedin:/in/jessica-marie-fabrizi': ['Angel David Medina', 'https://lnkd.in/p/gkBb5DxJ', 'https://www.linkedin.com/in/angeldavidmedina/'],
    'linkedin:/in/gerard-salerno-28825146': ['Angel David Medina', 'https://lnkd.in/p/gkBb5DxJ', 'https://www.linkedin.com/in/angeldavidmedina/'],
    'linkedin:/in/chip-richards': ['Angel David Medina', 'https://lnkd.in/p/gkBb5DxJ', 'https://www.linkedin.com/in/angeldavidmedina/'],
    'linkedin:/in/jane-k-77b86b98': ['Logan D.', 'https://lnkd.in/p/gX2-daqB'],
    'linkedin:/in/patel-prem': ['Kazim Ahmed Mohammed', 'https://lnkd.in/p/gFuPpEfs', 'https://www.linkedin.com/in/itskaz/'],
    'linkedin:/in/hoa-tommy-tran': ['Kazim Ahmed Mohammed', 'https://lnkd.in/p/gFuPpEfs', 'https://www.linkedin.com/in/itskaz/']
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
    if (angiPortal && angiHiringSignals[item.id]) {
      const [name,profile,evidence] = angiHiringSignals[item.id];
      const region = node('div','','shortlist-hiring-manager airbnb-manager-banner');
      region.appendChild(node('span',item.id === 'linkedin:/in/jacqueline-wujec' ? 'CONFIRMED TEAM HIRING LEADER' : (['linkedin:/in/elizabeth-doll-a45b10b0','linkedin:/in/michael-cognetti-3b926910b'].includes(item.id) ? 'DIRECTLY KNOWN RECRUITING CONTACT · HIRING MANAGER STATUS UNCONFIRMED' : 'RELEVANT TEAM CONTACT · ROLE OWNERSHIP UNCONFIRMED'),'shortlist-manager-label'));
      const links = node('span','','shortlist-manager-links');
      if (profile) links.appendChild(external(name + ' · LinkedIn ↗',profile)); else links.appendChild(node('strong',name));
      links.appendChild(node('small',evidence)); region.appendChild(links); card.appendChild(region);
    }
    if (airbnbPortal && airbnbHiringSignals[item.id]) {
      const region = node('div','','shortlist-hiring-manager airbnb-manager-banner');
      region.appendChild(node('span','RELEVANT TEAM LEADER · CURRENT ROLE OWNERSHIP UNCONFIRMED','shortlist-manager-label'));
      const links = node('span','','shortlist-manager-links');
      for (const [name,post] of airbnbHiringSignals[item.id]) links.appendChild(external(name + ' · Historical hiring post ↗',post));
      region.appendChild(links);
      card.appendChild(region);
    }
    card.appendChild(node('p', discipline(item), 'recruiter-discipline'));
    const who = node('section', '', 'braze-who');
    who.appendChild(node('p', 'WHO', 'braze-kicker'));
    who.appendChild(node('h2', displayName(person)));
    who.appendChild(node('p', S.value(person, ['Former Job Title','formerRole','role']), 'recruiter-background'));
    who.appendChild(node('p', S.value(person, ['Location','location']), 'recruiter-location'));
    card.appendChild(who);
    const why = node('section', '', 'braze-why');
    why.appendChild(node('h3', angiPortal ? 'Why Angi should meet them' : airbnbPortal ? 'Why Airbnb should meet them' : (isSeatGeek ? 'Why SeatGeek should meet them' : 'Why Braze should meet them')));
    why.appendChild(node('p', (isSeatGeek || airbnbPortal || angiPortal) ? (item.note || 'Explore this candidate’s relevant background.') : (brazeReasons[item.id] || item.note || 'Explore this candidate’s relevant background.')));
    const highlights = node('ul', '', 'braze-highlights');
    for (const h of ((isSeatGeek || airbnbPortal || angiPortal) ? [] : (brazeHighlights[item.id] || []))) highlights.appendChild(node('li', h));
    why.appendChild(highlights);
    card.appendChild(why);
    const opportunity = node('section', '', 'braze-opportunity');
    opportunity.appendChild(node('p',angiPortal ? 'POTENTIAL ANGI ALIGNMENT' : airbnbPortal ? 'POTENTIAL AIRBNB ALIGNMENT' : (isSeatGeek ? 'POTENTIAL SEATGEEK ALIGNMENT' : 'POTENTIAL BRAZE ALIGNMENT'),'braze-kicker'));
    opportunity.appendChild(item.url ? external(item.role, item.url) : node('strong', item.role || 'Exploratory introduction'));
    if (!item.url || (isSeatGeek && /seatgeek\.com\/jobs\/?$/.test(item.url))) opportunity.appendChild(node('small', 'Exploratory alignment · specific opening not confirmed'));
    card.appendChild(opportunity);
    if (isSeatGeek || airbnbPortal || angiPortal) {
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
    if (!isSeatGeek && !airbnbPortal && !angiPortal) {
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
      if (slug === 'braze' || slug === 'seatgeek' || slug === 'airbnb' || slug === 'angi') {
        if (slug === 'seatgeek') document.body.classList.add('seatgeek-shortlist');
        if (slug === 'airbnb' || slug === 'angi') document.body.classList.add('airbnb-shortlist');
        if (slug === 'angi') document.body.classList.add('angi-shortlist');
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
    if (doorDashPortal && activeTeam === 'data') byId('shortlist-status').textContent += (byId('shortlist-status').textContent ? '\n' : '') + doorDashTeamExplanations.data;
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
        const [managerName, hiringPost, profileUrl] = doordashManagers[item.id];
        const manager = node('div', '', 'shortlist-hiring-manager');
        manager.appendChild(node('span', 'TARGETED HIRING MANAGER', 'shortlist-manager-label'));
        const links = node('span', '', 'shortlist-manager-links');
        if (profileUrl) links.appendChild(external(managerName + ' · LinkedIn ↗', profileUrl));
        else links.appendChild(node('strong', managerName));
        if (hiringPost) links.appendChild(external('Original hiring post 🔗', hiringPost));
        manager.appendChild(links);
        card.appendChild(manager);
      }
      if (airbnbPortal && airbnbHiringSignals[item.id]) {
        const region = node('div','','shortlist-hiring-manager');
        region.appendChild(node('span','RELEVANT TEAM CONTACT · OWNERSHIP UNCONFIRMED','shortlist-manager-label'));
        const links = node('span','','shortlist-manager-links');
        for (const [name,post] of airbnbHiringSignals[item.id]) {
          links.appendChild(external(name + ' · Past hiring announcement 🔗',post));
        }
        region.appendChild(links);
        card.appendChild(region);
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
    setupDoorDashTabs();
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
