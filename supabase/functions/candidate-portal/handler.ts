import {classifyRole,scoreCandidate} from './scoring.ts';
import {importJobFromUrl,validatePublicJobUrl} from './job-import.ts';
const allowedOrigins = new Set(['https://irvinthev.github.io','http://localhost:8000']);
const statuses = new Set(['new','interested','pass','applied']);
const fields='id,source_url,title,company,description,location_text,remote_type,evidence_kind,review_notes,evaluation,status,feedback_note,updated_at,job_id,jobs(status)';
function checked(r:any) {if(r.error) throw r.error;return r.data;}
const text=(v:unknown,n:number)=>typeof v==='string'?v.trim().slice(0,n):'';
export function completeDescription(s:string) {return s.length>=400 && s.split(/\s+/).length>=70 && !/curated summary/i.test(s);}
export function createHandler({auth,db,importJob=importJobFromUrl}:any) {
 return async(req:Request)=>{
  const origin=req.headers.get('origin')||'';
  const headers={'Access-Control-Allow-Origin':allowedOrigins.has(origin)?origin:'https://irvinthev.github.io','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
  if(req.method==='OPTIONS') return reply({});
  if(req.method!=='POST') return reply({error:'Method not allowed'},405);
  if(origin&&!allowedOrigins.has(origin)) return reply({error:'Origin not allowed'},403);
  try {
   const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
   if(!token) return reply({error:'Please sign in'},401);
   const session=await auth.getUser(token); const user=session.data?.user;
   if(session.error||!user?.email_confirmed_at||!user.email) return reply({error:'Sign in with your verified email'},401);
   const access=checked(await db.from('candidate_portal_access').select('candidate_id').eq('email',user.email.toLowerCase().trim()).eq('active',true).maybeSingle());
   if(!access) return reply({error:'This email is not enrolled in the candidate pilot. Use the email you shared with Irvin.'},403);
   const id=access.candidate_id;
   const member=checked(await db.from('network_members').select('id,first_name,last_name,former_job_title,former_team,function_name,location_text,linkedin_url,public_description,public_skills').eq('id',id).eq('matching_opt_in',true).maybeSingle());
   if(!member) return reply({error:'Matching is not enabled for this profile'},403);
   let raw='',size=0;const reader=req.body?.getReader(),decoder=new TextDecoder();
   if(reader) while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>65000){await reader.cancel();return reply({error:'Description too large'},413);}raw+=decoder.decode(value,{stream:true});}
   let body:any;try{body=JSON.parse(raw+decoder.decode());}catch{return reply({error:'Invalid request'},400);}
   if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:'Invalid request'},400);
   if(body.action==='list'){
    const rows=checked(await db.from('candidate_saved_roles').select(fields).eq('candidate_id',id).order('updated_at',{ascending:false}));
    return reply({profile:{name:`${member.first_name} ${member.last_name}`},roles:(rows||[]).filter((r:any)=>!r.job_id||r.jobs?.status==='active').map(({job_id,jobs,...r}:any)=>r)});
   }
   if(body.action==='feedback'){
    if(!/^[0-9a-f-]{36}$/i.test(body.id||'')||!statuses.has(body.status)||typeof body.note!=='string'||body.note.length>1000)return reply({error:'Invalid feedback'},400);
    const row=checked(await db.from('candidate_saved_roles').update({status:body.status,feedback_note:body.note,updated_at:new Date().toISOString()}).eq('candidate_id',id).eq('id',body.id).select('id,status,feedback_note').maybeSingle());
    return row?reply(row):reply({error:'Role not found'},404);
   }
   if(body.action!=='import')return reply({error:'Unknown action'},400);
   if(!checked(await db.rpc('consume_candidate_import',{p_candidate_id:id})))return reply({error:'Please wait a minute before trying another import'},429);
   let url='',title=text(body.title,300),description=text(body.description,50000),location=text(body.location,300),remoteType=text(body.remoteType,100),kind='pasted';
   if(body.jobUrl){
    try{url=validatePublicJobUrl(text(body.jobUrl,2049)).href;}catch(e){return reply({error:(e as Error).message},400);}
    const saved=checked(await db.from('candidate_saved_roles').select('id').eq('candidate_id',id).eq('source_url',url).maybeSingle());
    if(saved&&!body.refresh&&!description)return reply({id:saved.id,reused:true});
    if(!description){try{const job=await importJob(url);url=job.canonicalUrl;title=job.title;description=job.description;location=job.location;remoteType=job.remoteType;kind='full_posting';}catch(e){return reply({error:`${(e as Error).message}. Paste the full job description instead.`},422);}}
   }
   if(!title||!completeDescription(description))return reply({error:'Add a title and the full description, including responsibilities and requirements (at least 70 words). Summaries cannot be scored.'},422);
   const [f,p,t]=await Promise.all([db.from('candidate_features').select('candidate_id,primary_role_slug,seniority,skills,domains,evidence').eq('candidate_id',id).maybeSingle(),db.from('candidate_role_preferences').select('candidate_id,role_slug,preference,priority').eq('candidate_id',id),db.from('role_taxonomy').select('slug,function_name,role_family,specialty,aliases').eq('active',true)]);
   const feature=checked(f),preferences=checked(p),taxonomy=checked(t);if(!feature)return reply({error:'Your profile needs experience information before scoring'},422);
   const {candidate,...evaluation}=scoreCandidate(member,feature,preferences||[],classifyRole(title,description,taxonomy||[]),title,description,location,remoteType);
   if(!url){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(title+'\n'+description));url='pasted:'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');}
   const row=checked(await db.from('candidate_saved_roles').upsert({candidate_id:id,source_url:url,title,description,location_text:location,remote_type:remoteType||'unknown',evidence_kind:kind,evaluation:{...evaluation,methodology:'Candidate pilot evidence overlap v1'},review_notes:kind==='pasted'?'Based on your pasted text; current vacancy and source page not verified.':'Confirm current availability and essential requirements with the employer.',updated_at:new Date().toISOString()},{onConflict:'candidate_id,source_url',defaultToNull:false}).select('id').single());
   return reply(row);
  }catch{ return reply({error:'Unable to complete the request. Please try again.'},500);}
 };
}
