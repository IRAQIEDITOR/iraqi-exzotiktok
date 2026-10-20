import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import worker,{newer,ver} from './worker.mjs';
const origin='https://iraqieditor.github.io';const env={ALLOWED_ORIGIN:origin,ADMIN_KEY:'a'.repeat(40),GITHUB_TOKEN:'test-only',UPLOADS:{}};
const req=(path,method='GET',body,auth=true,site=origin)=>new Request('https://test.workers.dev'+path,{method,headers:{Origin:site,...(auth?{Authorization:'Bearer '+env.ADMIN_KEY}:{}),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
test('versions',()=>{assert(newer('1.10.0','1.9.0'));assert(!newer('1.5.0','1.5.0'));assert.throws(()=>ver('1.5'))});
test('auth and origin guards',async()=>{assert.equal((await worker.fetch(req('/api/status','GET',undefined,false),env)).status,401);assert.equal((await worker.fetch(req('/api/status','GET',undefined,true,'https://evil.example'),env)).status,403);assert.equal((await worker.fetch(req('/api/status','OPTIONS'),env)).status,204)});
test('manifest toggle preserves download and publication succeeds after matching upload',async()=>{
 let manifest={app_id:'iraqi-tik',enabled:false,version:'1.5.0',download_url:'',sha256:'',message:'maintenance'},rev=0,release=null,stored=new Map(),parts=new Map();
 env.UPLOADS={async get(k){const b=stored.get(k);return b?{size:b.length,body:new Blob([b]).stream(),json:async()=>JSON.parse(b.toString())}:null},async put(k,v){stored.set(k,Buffer.from(v))},async delete(keys){for(const k of keys)stored.delete(k)},async createMultipartUpload(key){return {uploadId:'u'}},resumeMultipartUpload(key,id){return {async uploadPart(n,data){parts.set(n,Buffer.from(data));return {partNumber:n,etag:'p'+n}},async complete(){stored.set(key,Buffer.concat([...parts.values()]))}}}};
 const native=globalThis.fetch;
 globalThis.FixedLengthStream=class extends TransformStream{constructor(){super()}};
 crypto.DigestStream=class extends WritableStream{constructor(){let resolve;const digest=new Promise(r=>resolve=r),hash=createHash('sha256');super({write(c){hash.update(c)},close(){resolve(hash.digest())}});this.digest=digest}};
 globalThis.fetch=async(url,opts={})=>{const p=new URL(url).pathname,body=opts.body&&typeof opts.body==='string'?JSON.parse(opts.body):null;const out=d=>new Response(JSON.stringify(d));
 if(p.endsWith('/contents/iraqi-tik.json')){if(opts.method==='PUT'){assert.equal(body.sha,String(rev));manifest=JSON.parse(Buffer.from(body.content,'base64'));rev++;return out({})}return out({sha:String(rev),content:Buffer.from(JSON.stringify(manifest)).toString('base64')})}
 if(p.includes('/releases/tags/'))return release?out(release):new Response('{}',{status:404});
 if(p.endsWith('/releases')&&opts.method==='POST'){release={id:8,draft:true,assets:[]};return out(release)}
 if(p.endsWith('/releases/8/assets')){const b=Buffer.from(await new Response(opts.body).arrayBuffer());const asset={size:b.length,digest:'sha256:'+createHash('sha256').update(b).digest('hex'),name:'IRAQI_TIK_Setup.exe',browser_download_url:'https://github.com/IRAQIEDITOR/iraqi-exzotiktok/releases/download/iraqi-tik-v1.5.1/IRAQI_TIK_Setup.exe'};release.assets.push(asset);return out(asset)}
 if(p.endsWith('/releases/8')&&opts.method==='PATCH'){release.draft=false;return out(release)}throw Error('Unexpected '+url)};
 try{
 let r=await worker.fetch(req('/api/upload/start','POST',{version:'1.5.1',size:6,notes:'test'}),env);assert.equal(r.status,200);const s=await r.json();
 const partReq=new Request('https://test.workers.dev/api/upload/part?id='+s.id+'&n=1',{method:'PUT',headers:{Origin:origin,Authorization:'Bearer '+env.ADMIN_KEY,'Content-Length':'6'},body:'MZtest'});
 r=await worker.fetch(partReq,env);const part=await r.json();assert.equal(r.status,200);
 r=await worker.fetch(req('/api/upload/finish','POST',{id:s.id,parts:[part]}),env);const result=await r.json();assert.equal(r.status,200,JSON.stringify(result));assert.equal(result.enabled,false);assert.equal(result.version,'1.5.1');assert.match(result.sha256,/^[a-f0-9]{64}$/);assert(!release.draft);assert.equal(stored.size,0);
 r=await worker.fetch(req('/api/status','POST',{enabled:true,message:'ready'}),env);assert.equal(r.status,200);assert.equal(manifest.version,'1.5.1');assert.equal(manifest.enabled,true);
 r=await worker.fetch(req('/api/upload/start','POST',{version:'1.4.0',size:6,notes:''}),env);assert.equal(r.status,400);
 }finally{globalThis.fetch=native}
});
