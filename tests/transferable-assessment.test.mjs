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
 const rows=assessCandidateRequirements([requirement("Experience with reporting and dashboards.",{label:"Reporting and dashboards",interpretedAs:"Data analysis",markedReviewed:true,acceptsAdjacentExperience:true})],[candidate([{capability:"Data analysis",source:"directory_description",evidence:"Analyzed operational performance."}])],true);
 assert.equal(rows[0].status,"transferable");
 assert.match(rows[0].rationale,/unverified/);
});
test("without specific reviewer approval adjacent evidence cannot establish transfer",()=>{
 const req=requirement("Experience with reporting and dashboards.");
 const m=candidate([{capability:"Data analysis",source:"directory_description",evidence:"Analyzed operations."}]);
 assert.equal(assessCandidateRequirements([req],[m],true)[0].status,"not_evidenced");
});
test("job title overlap alone is not qualification evidence",()=>{
 const rows=assessCandidateRequirements([requirement("Advertising pricing strategy")],[candidate([],"Director Advertising Operations")],false);
 assert.equal(rows[0].status,"not_evidenced");
 assert.equal(rows[0].candidateEvidenceText,null);
});
test("unknown experience stays not evidenced and scoring metadata is untouched",()=>{
 const m=candidate([], "Operations Director");
 const before=JSON.stringify(m);
 const rows=assessCandidateRequirements([requirement("Enterprise SaaS pricing")],[m],false);
 assert.equal(rows[0].status,"not_evidenced");
 assert.equal(JSON.stringify(m),before);
});

test("multi-capability sentence resolves independent parser labels",()=>{
 const a=requirement("SQL and data analysis required",{label:"SQL"});
 const b=requirement("SQL and data analysis required",{requirementId:"r2",label:"Data analysis"});
 const m=candidate([{capability:"SQL",source:"resume_derived",evidence:"Built SQL reporting."},{capability:"Data analysis",source:"resume_derived",evidence:"Analyzed transactions."}]);
 const rows=assessCandidateRequirements([a,b],[m],false);
 assert.deepEqual(rows.map(x=>x.status),["demonstrated","demonstrated"]);
});
test("admin interpretation can resolve unrecognized requirement without rewriting employer text",()=>{
 const r=requirement("Operational insights",{label:"Operational insights",markedReviewed:true,interpretedAs:"Data analysis"});
 const m=candidate([{capability:"Data analysis",source:"resume_derived",evidence:"Analyzed merchant performance."}]);
 const [row]=assessCandidateRequirements([r],[m],false);
 assert.equal(row.status,"demonstrated");
 assert.equal(row.requirementText,"Operational insights");
 assert.equal(row.reviewedInterpretation,"Data analysis");
});
test("listed public skill is reported rather than demonstrated",()=>{
 const [row]=assessCandidateRequirements([requirement("SQL required",{label:"SQL"})],[candidate([{capability:"SQL",source:"public_skill",evidence:"SQL"}])],false);
 assert.equal(row.status,"reported");
});
test("preferred-only evidence is assessed",()=>{
 const r=requirement("Reporting and dashboards preferred",{label:"Reporting and dashboards",category:"preferred"});
 const m=candidate([{capability:"Reporting and dashboards",source:"resume_derived",evidence:"Owned reporting dashboards."}]);
 m.coreCoverage.evidenced=[];
 m.coreCoverage.preferredEvidenced=["Reporting and dashboards"];
 assert.equal(assessCandidateRequirements([r],[m],false)[0].status,"demonstrated");
});
test("legacy links retain core-only requirement scope",async()=>{
 const {mapCandidateToCoreRequirements}=await import("../supabase/functions/evaluate-job/requirement-mapping.ts");
 const m=candidate([{capability:"SQL",source:"public_skill",evidence:"SQL"}]);
 const links=mapCandidateToCoreRequirements([requirement("SQL required",{label:"SQL"}),requirement("SQL preferred",{label:"SQL",category:"preferred",requirementId:"r2"})],[m]);
 assert.equal(links.length,1);
 assert.equal(links[0].requirementId,"r1");
});
test("adjacent interpretation requires reviewed permission and evidence",()=>{
 const r=requirement("Reporting and dashboards",{label:"Reporting and dashboards",markedReviewed:true,acceptsAdjacentExperience:true,interpretedAs:"Data analysis"});
 const m=candidate([{capability:"Data analysis",source:"resume_derived",evidence:"Analyzed commercial data."}]);
 assert.equal(assessCandidateRequirements([r],[m],true)[0].status,"transferable");
 assert.equal(assessCandidateRequirements([r],[m],false)[0].status,"not_evidenced");
});
test("missing evidence retains a useful validation question",()=>{
 const [row]=assessCandidateRequirements([requirement("Enterprise SaaS pricing")],[candidate()],false);
 assert.equal(row.status,"not_evidenced");
 assert.ok(row.validationQuestion);
});
