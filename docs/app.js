'use strict';
const $=id=>document.getElementById(id);let key='',base='',busy=false,state=null,selected=null,upload=null;
$('endpoint').value=localStorage.getItem('iraqi_tik_worker')||'';
function notice(t){$('notice').textContent=t;$('notice').hidden=false}
function lock(v){busy=v;document.querySelectorAll('button').forEach(b=>b.disabled=v);$('enabled').disabled=v;}
async function api(path,method='GET',body){const r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+key,...(body instanceof Blob?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:body instanceof Blob?body:JSON.stringify(body),cache:'no-store',credentials:'omit'});let d;try{d=await r.json()}catch{throw Error('تعذر الوصول للخادم؛ تحقق من رابط Worker وإعداد ALLOWED_ORIGIN.')}if(!r.ok)throw Error(d.error||'تعذّر الطلب');return d}
function render(d){state=d;$('state').textContent=d.enabled?'شغّال':'متوقف';$('version').textContent=d.version;$('enabled').checked=d.enabled;$('availability').textContent=d.enabled?'متاح للمستخدمين':'وضع الصيانة مفعّل';$('message').value=d.message||'';const link=d.download_url||'';if(link.startsWith('https://github.com/IRAQIEDITOR/iraqi-exzotiktok/releases/download/')){$('release').href=link;$('release').hidden=false}else $('release').hidden=true}
async function task(fn){if(busy)return;lock(true);$('notice').hidden=true;try{await fn()}catch(e){notice(e.message||'تعذّر الاتصال')}finally{lock(false)}}
$('loginForm').onsubmit=e=>{e.preventDefault();task(async()=>{const u=new URL($('endpoint').value.trim());if(u.protocol!=='https:'||!u.hostname.endsWith('.workers.dev')||u.pathname!=='/'||u.search||u.hash)throw Error('استخدم رابط Worker الأساسي من workers.dev عبر HTTPS');base=u.origin;key=$('key').value;render(await api('/api/status'));$('key').value='';localStorage.setItem('iraqi_tik_worker',base);$('login').hidden=true;$('dashboard').hidden=false})};
$('logout').onclick=()=>{key='';upload=null;selected=null;$('file').value='';$('key').value='';$('dashboard').hidden=true;$('login').hidden=false;};
$('refresh').onclick=()=>task(async()=>render(await api('/api/status')));
$('save').onclick=()=>task(async()=>{if(!$('enabled').checked&&!confirm('إيقاف الاستخدام الجديد للتطبيق عند الفحص التالي؟'))return;render(await api('/api/status','POST',{enabled:$('enabled').checked,message:$('message').value}));notice('تم حفظ حالة التطبيق.')});
function choose(f){if(busy)return;if(!f||!f.name.toLowerCase().endsWith('.exe')){notice('اختر ملف Setup.exe');return}selected=f;upload=null;$('filename').textContent=f.name+' · '+(f.size/1048576).toFixed(1)+' MB';$('progress').value=0;$('uploadStatus').textContent='جاهز لرفع المثبّت';}
$('file').onchange=()=>choose($('file').files[0]);$('drop').ondragover=e=>{e.preventDefault();$('drop').classList.add('over')};$('drop').ondragleave=()=>$('drop').classList.remove('over');$('drop').ondrop=e=>{e.preventDefault();$('drop').classList.remove('over');choose(e.dataTransfer.files[0])};
$('publish').onclick=()=>task(async()=>{
 if(!selected)throw Error('اختر المثبّت أولًا');const version=$('newversion').value.trim(),notes=$('notes').value;
 if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('اكتب رقم إصدار مثل 1.5.1');
 if(!confirm('نشر '+version+' كتحديث إلزامي؟ تأكد أن رقم النسخة داخل المثبّت مطابق.'))return;
 if(upload&&(upload.version!==version||upload.notes!==notes))throw Error('أعد اختيار الملف لبدء جلسة بإعدادات مختلفة');
 if(!upload){$('uploadStatus').textContent='تجهيز الرفع…';upload={...await api('/api/upload/start','POST',{version,notes,size:selected.size}),parts:[],version,notes}}
 for(let i=upload.parts.length*upload.chunkSize;i<selected.size;i+=upload.chunkSize){const part=await api('/api/upload/part?id='+upload.id+'&n='+(upload.parts.length+1),'PUT',selected.slice(i,Math.min(i+upload.chunkSize,selected.size)));upload.parts.push(part);const percent=Math.min(100,Math.round((i+upload.chunkSize)/selected.size*100));$('progress').value=percent;$('uploadStatus').textContent='رفع الملف: '+percent+'%';}
 $('uploadStatus').textContent='جارٍ النقل إلى GitHub والتحقق والنشر… أبقِ الصفحة مفتوحة.';
 render(await api('/api/upload/finish','POST',{id:upload.id,parts:upload.parts}));upload=null;selected=null;$('file').value='';$('uploadStatus').textContent='تم نشر التحديث وتفعيل الإلزام بنجاح.';notice('التحديث منشور. تستقبله التطبيقات عند الفحص التالي.');
});
window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue=''}});
