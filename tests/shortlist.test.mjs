import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const S = createRequire(import.meta.url)('../shortlist-core.js');
const person = { 'First Name': 'Renée', 'Last Name': 'Smith', 'LinkedIn URL': 'www.linkedin.com/in/renee-smith/', Description: 'Current public bio' };
const entry = { id: S.personId(person), role: 'Engineer', url: 'https://example.com/role', note: 'API experience — explore fit.' };
const list = { v: 1, title: 'Engine — 技術', intro: 'Hello 👋', items: [entry] };
test('Unicode links round-trip across browsers; extra fields never serialize', () => {
 const copy = S.decode(S.encode({ ...list, privateEmail: 'do-not-copy', items: [{ ...entry, privateBio: 'secret' }] }));
 assert.deepEqual(copy, list); assert.ok(!S.encode(copy).includes('secret'));
});
test('IDs survive name changes, protocol variations and directory reordering', () => {
 assert.equal(S.personId(person), S.personId({ ...person, 'First Name': 'New display name', 'LinkedIn URL': 'https://linkedin.com/in/renee-smith' }));
 const result = S.resolve(list, [{ 'First Name': 'Other' }, { ...person, Description: 'Updated bio' }]);
 assert.equal(result.items[0].person.Description, 'Updated bio');
});
test('removed or ambiguous profiles are withheld instead of restored from a snapshot', () => {
 assert.equal(S.resolve(list, []).items.length, 0); assert.equal(S.resolve(list, []).unavailable, 1);
 assert.equal(S.resolve(list, [person, { ...person }]).items.length, 0);
 const p = { name: 'Duplicate name' }; const raw = { ...list, items: [{ ...entry, id: S.personId(p) }] };
 assert.equal(S.resolve(raw, [p, p]).items.length, 0);
});
test('unsafe role URLs, embedded credentials and malformed payloads are rejected', () => {
 for (const url of ['javascript:alert(1)', 'data:text/html,bad', 'https://name:pass@example.com', '//evil.example']) {
  assert.throws(() => S.validate({ ...list, items: [{ ...entry, url }] }));
 }
 for (const text of ['bad%', 'a'.repeat(32001), btoa('{"v":2}')]) assert.throws(() => S.decode(text));
 assert.equal(S.linkedin({ linkedin: 'https://linkedin.com.evil.example/in/fake' }), '');
});
test('empty, duplicate, excessive and oversized shared lists fail with useful errors', () => {
 assert.throws(() => S.encode({ ...list, items: [] }), /Choose between/);
 assert.throws(() => S.validate({ ...list, items: [entry, entry] }), /unique/);
 assert.throws(() => S.validate({ ...list, items: Array(21).fill(entry) }), /Choose between/);
 assert.throws(() => S.validate({ ...list, title: 'x'.repeat(101) }), /Title/);
 assert.throws(() => S.validate({ ...list, items: [{ ...entry, note: 'x'.repeat(501) }] }), /Match note/);
 assert.throws(() => S.validate({ ...list, title: '' }), /title/);
});
test('fresh and corrupt drafts work; blocked storage does not crash selection', () => {
 assert.equal(S.draftFrom(null).items.length, 0);
 assert.equal(S.draftFrom({ getItem: () => '{broken' }).items.length, 0);
 const draft = { v: 1, title: '', intro: '', items: [] };
 assert.equal(S.resolve({ ...draft, title: 'Draft' }, []).items.length, 0);
 assert.equal(S.saveDraft({ setItem: () => { throw Error('blocked'); } }, draft), false);
 let stored; const storage = { setItem: (_, value) => { stored = value; }, getItem: () => stored };
 assert.equal(S.saveDraft(storage, list), true); assert.deepEqual(S.draftFrom(storage), list);
});
test('Engine fixture resolves only to existing public profiles and valid role links', () => {
 const fixture = JSON.parse(readFileSync(new URL('../shortlists/engine.json', import.meta.url)));
 const people = JSON.parse(readFileSync(new URL('../people.json', import.meta.url)));
 const result = S.resolve(fixture, people);
 assert.equal(result.unavailable, 0); assert.equal(result.items.length, 7);
 assert.ok(result.items.every(item => item.url.startsWith('https://job-boards.greenhouse.io/engine/jobs/')));
});

for (const [company, expectedCount, host] of [
 ['instacart', 8, 'www.instacart.careers'],
 ['airbnb', 8, 'careers.airbnb.com'],
 ['angi', 7, 'www.angi.com']
]) {
 test(`${company} shortlist uses unique current public profiles and official role links`, () => {
  const fixture = JSON.parse(readFileSync(new URL(`../shortlists/${company}.json`, import.meta.url)));
  const people = JSON.parse(readFileSync(new URL('../people.json', import.meta.url)));
  const result = S.resolve(fixture, people);
  assert.equal(result.unavailable, 0);
  assert.equal(result.items.length, expectedCount);
  assert.equal(new Set(result.items.map(item => item.id)).size, expectedCount);
  assert.ok(result.items.every(item => new URL(item.url).hostname === host));
  assert.ok(result.items.every(item => item.role && item.note));
  assert.deepEqual(S.decode(S.encode(fixture)), S.validate(fixture));
  const removed = result.items[0].id;
  const current = people.filter(person => S.personId(person) !== removed);
  assert.equal(S.resolve(fixture, current).items.length, expectedCount - 1);
 });
}

test('Shopify includes four current profiles and a scoped community introduction', () => {
 const fixture = JSON.parse(readFileSync(new URL('../shortlists/shopify.json', import.meta.url)));
 const people = JSON.parse(readFileSync(new URL('../people.json', import.meta.url)));
 const introductions = JSON.parse(readFileSync(new URL('../shortlists/shopify-profiles.json', import.meta.url)));
 assert.equal(introductions.length, 1);
 assert.equal(S.name(introductions[0]), 'Gina Reynolds');
 const result = S.resolve(fixture, [...people, ...introductions]);
 assert.equal(result.items.length, 5); assert.equal(result.unavailable, 0);
 assert.ok(result.items.every(item => new URL(item.url).hostname === 'www.shopify.com'));
 assert.ok(result.items.every(item => !/norm/i.test(S.name(item.person))));
 assert.equal(S.resolve(fixture, people).items.length, 4);
 const removed = result.items[0].id;
 assert.equal(S.resolve(fixture, [...people.filter(p => S.personId(p) !== removed), ...introductions]).items.length, 4);
 const gina = result.items.find(item => S.name(item.person) === 'Gina Reynolds');
 assert.match(gina.role, /general application/);
 assert.match(gina.note, /not a verified specific vacancy/);
 assert.ok(!/gmail|@|312[ .-]/i.test(JSON.stringify(introductions)));
 assert.deepEqual(S.decode(S.encode(fixture)), S.validate(fixture));
});
