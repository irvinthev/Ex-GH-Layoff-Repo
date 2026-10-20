(function (root) {
  'use strict';
  const MAX_ITEMS = 20;
  const MAX_PAYLOAD = 32000;
  const STORAGE_KEY = 'talent-shortlist-draft-v1';
  function value(person, keys) {
    for (const key of keys) if (person[key] != null && String(person[key]).trim()) return String(person[key]).trim();
    return '';
  }
  function name(person) {
    return value(person, ['name', 'fullName']) || `${value(person, ['First Name', 'firstName'])} ${value(person, ['Last Name', 'lastName'])}`.trim();
  }
  function safeUrl(raw) {
    try {
      const url = new URL(String(raw || '').trim());
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  }
  function linkedin(person) {
    let raw = value(person, ['linkedin', 'LinkedIn', 'Linkedin', 'Linked In', 'LinkedIn URL']);
    if (/^(www\.)?linkedin\.com\//i.test(raw)) raw = `https://${raw}`;
    const url = safeUrl(raw);
    return url && /^(www\.)?linkedin\.com$/i.test(new URL(url).hostname) ? url : '';
  }
  function personId(person) {
    const link = linkedin(person);
    // Profile keys remain stable through directory reordering and display-name changes.
    if (link) return `linkedin:${new URL(link).pathname.replace(/\/+$/, '').toLowerCase()}`;
    return `name:${name(person).toLowerCase().normalize('NFKC').replace(/\s+/g, ' ')}`;
  }
  function cleanText(raw, max, label) {
    if (typeof raw !== 'string' || raw.length > max) throw new Error(`${label} is missing or too long.`);
    return raw.trim();
  }
  function validate(raw, allowEmpty = false) {
    if (!raw || raw.v !== 1 || !Array.isArray(raw.items) || raw.items.length > MAX_ITEMS || (!allowEmpty && !raw.items.length)) {
      throw new Error(`Choose between 1 and ${MAX_ITEMS} people for a shortlist.`);
    }
    const title = cleanText(raw.title, 100, 'Title');
    if (!allowEmpty && !title) throw new Error('Add a company or shortlist title.');
    const intro = cleanText(raw.intro || '', 1200, 'Introduction');
    const seen = new Set();
    const items = raw.items.map(item => {
      if (!item || typeof item !== 'object') throw new Error('Invalid candidate entry.');
      const id = cleanText(item.id, 300, 'Profile reference');
      if (!id || seen.has(id)) throw new Error('Each selected person must have one unique profile reference.');
      seen.add(id);
      const url = cleanText(item.url || '', 1000, 'Role URL');
      if (url && !safeUrl(url)) throw new Error('Role links must use http:// or https:// without embedded credentials.');
      return { id, role: cleanText(item.role || '', 160, 'Role title'), url: url ? safeUrl(url) : '', note: cleanText(item.note || '', 500, 'Match note') };
    });
    // Whitelist fields: do not serialize profile biographies, contact information, or arbitrary extra properties.
    return { v: 1, title, intro, items };
  }
  function encode(raw) {
    const text = JSON.stringify(validate(raw));
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    if (encoded.length > MAX_PAYLOAD) throw new Error('This link is too long. Shorten the introduction or match notes.');
    return encoded;
  }
  function decode(encoded) {
    if (!encoded || encoded.length > MAX_PAYLOAD || !/^[\w-]+$/.test(encoded)) throw new Error('This shortlist link is invalid or too long.');
    try {
      const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      return validate(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
    } catch { throw new Error('This shortlist link is invalid. Ask the sender for a new link.'); }
  }
  function resolve(raw, people) {
    const list = validate(raw, true);
    const map = new Map();
    for (const person of people) {
      const id = personId(person);
      // Ambiguous fallback names must not silently resolve to the wrong person.
      map.set(id, map.has(id) ? null : person);
    }
    const items = list.items.map(item => ({ ...item, person: map.get(item.id) })).filter(item => item.person);
    return { ...list, items, unavailable: list.items.length - items.length };
  }
  function draftFrom(storage) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      return raw ? validate(JSON.parse(raw), true) : { v: 1, title: '', intro: '', items: [] };
    } catch { return { v: 1, title: '', intro: '', items: [] }; }
  }
  function saveDraft(storage, raw) {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(validate(raw, true))); return true; } catch { return false; }
  }
  const api = { MAX_ITEMS, STORAGE_KEY, value, name, linkedin, personId, safeUrl, validate, encode, decode, resolve, draftFrom, saveDraft };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TalentShortlist = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
