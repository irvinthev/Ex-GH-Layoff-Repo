import test from "node:test";
import assert from "node:assert/strict";
import { assessCandidateRequirements } from "../supabase/functions/evaluate-job/requirement-mapping.ts";
const requirement = (text, options = {}) => ({requirementId:"r1", category:"core", originalText:text, label:text, sourceSection:"Requirements", ambiguityFlags:[], markedReviewed:false, ...options});
const candidate = (evidence = [], title = "Operations Director") => ({candidate:{id:"synthetic-1",formerJobTitle:title},coreCoverage:{evidenced:evidence.map(x=>x.capability)},evidenceTrace:evidence,score:72,fitBand:"Possible"});
test("direct evidence is demonstrated with provenance",()=>{
 const rows=assessCandidateRequirements([requirement("Experience with data analysis.")],[candidate([{capability:"Data analysis",source:"resume_derived",evidence:"Analyzed transaction trends."}])],false);
 assert.equal(rows[0].status,"demonstrated");
 assert.equal(rows[0].evidenceSource,"resume");
});
test("explicit adjacent experience permission produces transferable, not demonstrated",()=>{
 const rows=assessCandidateRequirements([requirement("Experience with reporting and dashboards.",{markedReviewed:true,acceptsAdjacentExperience:true})],[candidate([{capability:"Data analysis",source:"directory_description",evidence:"Analyzed operational performance."}])],true);
 assert.equal(rows[0].status,"transferable");
 assert.match(rows[0].rationale,/unverified/);
});
test("without specific reviewer approval adjacent evidence cannot establish transfer",()=>{
 const req=requirement("Experience with reporting and dashboards.");
 const m=candidate([{capability:"Data analysis",source:"directory_description",evidence:"Analyzed operations."}]);
 assert.equal(assessCandidateRequirements([req],[m],true)[0].status,"not_evidenced");
});
test("job title overlap is a validation lead, not proof",()=>{
 const rows=assessCandidateRequirements([requirement("Advertising pricing strategy")],[candidate([],"Director Advertising Operations")],false);
 assert.equal(rows[0].status,"needs_validation");
 assert.equal(rows[0].candidateEvidenceText,null);
});
test("unknown experience stays not evidenced and scoring metadata is untouched",()=>{
 const m=candidate([], "Operations Director");
 const before=JSON.stringify(m);
 const rows=assessCandidateRequirements([requirement("Enterprise SaaS pricing")],[m],false);
 assert.equal(rows[0].status,"not_evidenced");
 assert.equal(JSON.stringify(m),before);
});
