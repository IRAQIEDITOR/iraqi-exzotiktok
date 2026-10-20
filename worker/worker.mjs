const REPO='IRAQIEDITOR/iraqi-exzotiktok', FILE='iraqi-tik.json', CHUNK=8*1024*1024, MAX=2*1024**3-1;
const enc=new TextEncoder();
export function ver(s){if(typeof s!=='string'||!/^\d+\.\d+\.\d+$/.test(s))throw Error('رقم الإصدار يجب أن يكون مثل 1.5.1');return s.split('.').map(Number)}
export function newer(a,b){const x=ver(a),y=ver(b);for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]>y[i]}return false}
function b64(s){return btoa(String.fromCharCode(...enc.encode(s)))}
function decode(s){return new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g,'')),c=>c.charCodeAt(0)))}
async function same(a,b){const x=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(a))),y=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(b)));let z=0;for(let i=0;i<x.length;i++)z|=x[i]^y[i];return z===0}
async function json(req){const s=await req.text();if(s.length>40000)throw Error('طلب كبير');return JSON.parse(s)}
async function gh(env,path,method='GET',body){const r=await fetch('https://api.github.com/repos/'+REPO+path,{method,headers:{Authorization:'Bearer '+env.GITHUB_TOKEN,'User-Agent':'IRAQI-TIK-Admin',Accept:'application/vnd.github+json','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok)throw Error('GitHub '+r.status+' — تحقق من الصلاحية أو تعارض الإصدار.');return r.status===204?{}:r.json()}
async function current(env){const f=await gh(env,'/contents/'+FILE+'?ref=main');const data=JSON.parse(decode(f.content));if(data.app_id!=='iraqi-tik')throw Error('ملف تطبيق غير صحيح');ver(data.version);return {sha:f.sha,data}}
async function save(env,record,message){return gh(env,'/contents/'+FILE,'PUT',{branch:'main',message,sha:record.sha,content:b64(JSON.stringify(record.data,null,2)+'\n')})}
async function session(env,id){if(!/^[a-f0-9-]{36}$/.test(id||''))throw Error('جلسة رفع غير صحيحة');const o=await env.UPLOADS.get('sessions/'+id);if(!o)throw Error('جلسة الرفع غير موجودة');const s=await o.json();if(Date.now()>s.expires)throw Error('انتهت جلسة الرفع؛ ابدأ من جديد');return s}
export default {async fetch(req,env){
 const origin=req.headers.get('Origin'),allowed=env.ALLOWED_ORIGIN;
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
 if(origin===allowed){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Headers']='Authorization, Content-Type';headers['Access-Control-Allow-Methods']='GET, POST, PUT, OPTIONS'}
 const respond=(v,status=200)=>new Response(JSON.stringify(v),{status,headers});
 if(!allowed||!env.ADMIN_KEY||env.ADMIN_KEY.length<32||!env.GITHUB_TOKEN||!env.UPLOADS)return respond({error:'إعداد الخادم غير مكتمل'},503);
 if(origin && origin!==allowed)return respond({error:'Origin denied'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 const supplied=req.headers.get('Authorization')||'';
 if(!await same(supplied,'Bearer '+env.ADMIN_KEY))return respond({error:'مفتاح الإدارة غير صحيح'},401);
 try{
 const url=new URL(req.url),path=url.pathname;
 if(req.method==='GET'&&path==='/api/status'){const c=await current(env);return respond(c.data)}
 if(req.method==='POST'&&path==='/api/status'){
  const d=await json(req);if(typeof d.enabled!=='boolean'||typeof d.message!=='string'||d.message.length>500)throw Error('إعدادات غير صحيحة');
  const c=await current(env);c.data.enabled=d.enabled;c.data.message=d.message;
  await save(env,c,'Admin: '+(d.enabled?'enable':'pause')+' IRAQI TIK');return respond(c.data);
 }
 if(req.method==='POST'&&path==='/api/upload/start'){
  const d=await json(req);ver(d.version);if(!Number.isSafeInteger(d.size)||d.size<2||d.size>MAX)throw Error('حجم المثبت يجب أن يكون أقل من 2 GB');
  if(typeof d.notes!=='string'||d.notes.length>4000)throw Error('ملاحظات طويلة');
  const c=await current(env);if(!newer(d.version,c.data.version)&&d.version!==c.data.version)throw Error('لا يمكن نشر نسخة أقدم');
  if(d.version===c.data.version&&c.data.download_url)throw Error('هذا الإصدار منشور؛ استخدم رقمًا أعلى');
  const id=crypto.randomUUID(),key='files/'+id;
  const upload=await env.UPLOADS.createMultipartUpload(key,{httpMetadata:{contentType:'application/octet-stream'}});
  const s={id,key,uploadId:upload.uploadId,version:d.version,notes:d.notes,size:d.size,expires:Date.now()+86400000};
  await env.UPLOADS.put('sessions/'+id,JSON.stringify(s));return respond({id,chunkSize:CHUNK});
 }
 if(req.method==='PUT'&&path==='/api/upload/part'){
  const s=await session(env,url.searchParams.get('id')),n=Number(url.searchParams.get('n')),count=Math.ceil(s.size/CHUNK);
  if(!Number.isInteger(n)||n<1||n>count)throw Error('رقم جزء غير صحيح');
  const expected=n===count?s.size-(n-1)*CHUNK:CHUNK;
  if(Number(req.headers.get('Content-Length'))!==expected)throw Error('حجم الجزء غير صحيح');
  const data=await req.arrayBuffer();if(data.byteLength!==expected)throw Error('جزء غير مكتمل');
  if(n===1&&(new Uint8Array(data)[0]!==77||new Uint8Array(data)[1]!==90))throw Error('الملف ليس Windows EXE');
  const result=await env.UPLOADS.resumeMultipartUpload(s.key,s.uploadId).uploadPart(n,data);return respond(result);
 }
 if(req.method==='POST'&&path==='/api/upload/finish'){
  const d=await json(req),s=await session(env,d.id),count=Math.ceil(s.size/CHUNK);
  if(!Array.isArray(d.parts)||d.parts.length!==count||d.parts.some((p,i)=>p.partNumber!==i+1||typeof p.etag!=='string'))throw Error('الأجزاء غير مكتملة');
  let obj=await env.UPLOADS.get(s.key);
  if(!obj){await env.UPLOADS.resumeMultipartUpload(s.key,s.uploadId).complete(d.parts);obj=await env.UPLOADS.get(s.key)}
  if(!obj||obj.size!==s.size)throw Error('حجم الملف النهائي غير صحيح');
  let c=await current(env);if(newer(c.data.version,s.version))throw Error('يوجد إصدار أحدث بالفعل');
  const tag='iraqi-tik-v'+s.version;
  let release;
  try{release=await gh(env,'/releases/tags/'+tag)}catch(e){if(!e.message.includes('404'))throw e;release=await gh(env,'/releases','POST',{tag_name:tag,name:'IRAQI TIK '+s.version,body:s.notes,draft:true,prerelease:false})}
  // Only reuse an existing asset if it exactly matches the staged upload.
  const digest=new crypto.DigestStream('SHA-256');
  const existing=release.assets?.find(a=>a.name==='IRAQI_TIK_Setup.exe');
  let asset=existing,sha;
  if(existing){await obj.body.pipeTo(digest);sha=hex(await digest.digest);if(existing.digest!=='sha256:'+sha||existing.size!==s.size)throw Error('يوجد ملف مختلف بنفس الإصدار. استخدم رقم إصدار جديد.')}
  else{
   const [a,b]=obj.body.tee();const fixed=new FixedLengthStream(obj.size);
   const writes=Promise.all([a.pipeTo(digest),b.pipeTo(fixed.writable)]);
   const r=await fetch('https://uploads.github.com/repos/'+REPO+'/releases/'+release.id+'/assets?name=IRAQI_TIK_Setup.exe',{method:'POST',headers:{Authorization:'Bearer '+env.GITHUB_TOKEN,'User-Agent':'IRAQI-TIK-Admin','Content-Type':'application/octet-stream'},body:fixed.readable});
   await writes;sha=hex(await digest.digest);if(!r.ok)throw Error('فشل رفع GitHub '+r.status+'؛ أعد محاولة النشر.');asset=await r.json();
   if(asset.size!==s.size||(asset.digest&&asset.digest!=='sha256:'+sha))throw Error('بصمة أو حجم GitHub غير مطابق');
  }
  if(release.draft)await gh(env,'/releases/'+release.id,'PATCH',{draft:false});
  const prefix='https://github.com/'+REPO+'/releases/download/';if(!asset.browser_download_url.startsWith(prefix))throw Error('رابط تنزيل غير متوقع');
  c=await current(env);if(newer(c.data.version,s.version))throw Error('تم نشر نسخة أحدث أثناء الرفع؛ لن نستبدلها');
  if(c.data.version===s.version&&c.data.sha256&&c.data.sha256!==sha)throw Error('تعارض إصدار؛ اختر رقمًا جديدًا');
  Object.assign(c.data,{version:s.version,download_url:asset.browser_download_url,sha256:sha,notes:s.notes});
  await save(env,c,'Publish IRAQI TIK '+s.version);
  await env.UPLOADS.delete([s.key,'sessions/'+s.id]);return respond(c.data);
 }
 return respond({error:'Not found'},404);
 }catch(e){return respond({error:e.message||'تعذرت العملية؛ حاول مجددًا'},400)}
}};
function hex(buffer){return [...new Uint8Array(buffer)].map(v=>v.toString(16).padStart(2,'0')).join('')}
