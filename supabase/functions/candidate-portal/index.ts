import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {createHandler} from './handler.ts';
function key(current:string,legacy:string){try{const keys=JSON.parse(Deno.env.get(current)||'{}');if(keys.default)return keys.default;}catch{}return Deno.env.get(legacy)||'';}
const options={auth:{persistSession:false,autoRefreshToken:false}};
const url=Deno.env.get('SUPABASE_URL')||'';
const db=createClient(url,key('SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY'),options);
const client=createClient(url,key('SUPABASE_PUBLISHABLE_KEYS','SUPABASE_ANON_KEY'),options);
Deno.serve(createHandler({auth:client.auth,db}));
