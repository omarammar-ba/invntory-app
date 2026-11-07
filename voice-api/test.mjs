import test from 'node:test';import assert from 'node:assert/strict';import {generateKeyPair,exportJWK,SignJWT} from 'jose';import {handleRequest,cleanDraft,verifyFirebaseToken} from './src/worker.mjs';
const origin='https://inventory.example';const env={GROQ_API_KEY:'test-only-key',FIREBASE_PROJECT_ID:'test-project',ALLOWED_ORIGINS:origin,USER_LIMIT:{limit:async()=>({success:true})},GLOBAL_LIMIT:{limit:async()=>({success:true})}};
const cats=[{id:'tiles',name:'بورسلان',unit:'meters'},{id:'ceramics',name:'سيراميك',unit:'meters'}];const draft={categoryId:'tiles',name:'0012064',quantity:45.36,size:'120×60',surface:'مطفي',quality:null,uncertainties:[]};
function request({token=true,locked='',headers={}}={}){const f=new FormData();f.set('audio',new Blob([new Uint8Array(300)],{type:'audio/webm'}),'test.webm');f.set('categories',JSON.stringify(cats));f.set('categoryId',locked);return new Request('https://worker.example/analyze',{method:'POST',headers:{Origin:origin,...(token?{Authorization:'Bearer token'}:{}),...headers},body:f})}
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
test('short stock lookup skips interpretation; edit followup keeps the selected target', async () => {
  const makeRequest = (transcript, target = null) => {
    const body = new FormData();
    body.set('mode', 'stock-command');
    body.set('categories', JSON.stringify(cats));
    body.set('transcript', transcript);
    if (target) { body.set('editTarget', target); body.set('categoryId', 'tiles'); }
    return new Request('https://worker.example/analyze', { method: 'POST', headers: { Origin: origin, Authorization: 'Bearer token' }, body });
  };
  let calls = 0;
  const deps = { verifyToken: async () => 'u1', fetcher: async (url, opts) => {
    if (url.includes('firestore')) return json({fields:{status:{stringValue:'active'},role:{stringValue:'admin'}}});
    assert.ok(url.endsWith('chat/completions'));
    calls++;
    const sent = JSON.parse(JSON.parse(opts.body).messages[1].content);
    assert.equal(sent.editTarget, '12500');
    assert.equal(sent.lockedCategoryId, 'tiles');
    return json({ choices: [{message:{content:JSON.stringify({action:'edit',color:'أسود'})}}] });
  } };
  const lookup = await (await handleRequest(makeRequest('كم كمية البلاطة 12,500؟'), env, deps)).json();
  assert.equal(lookup.command.action, 'search');
  assert.equal(lookup.command.target, '12500');
  assert.equal(calls, 0);
  const edit = await (await handleRequest(makeRequest('خلّي اللون أسود', '12500'), env, deps)).json();
  assert.equal(calls, 1);
  assert.deepEqual([edit.command.action, edit.command.target, edit.command.color], ['edit', '12500', 'أسود']);
});
test('live preview checks staff access and transcribes WAV without running stock analysis', async () => {
  const makeRequest = (type = 'audio/wav') => {
    const body = new FormData();
    body.set('mode', 'transcribe-preview');
    body.set('audio', new Blob([new Uint8Array(320)], { type }), 'preview.wav');
    return new Request('https://worker.example/analyze', {
      method: 'POST', headers: { Origin: origin, Authorization: 'Bearer token' }, body,
    });
  };
  const keys = [], calls = [];
  const limiter = { limit: async ({ key }) => { keys.push(key); return { success: true }; } };
  let status = 'active';
  const deps = { verifyToken: async () => 'u1', fetcher: async (url, opts) => {
    calls.push(url);
    if (url.includes('firestore')) {
      assert.equal(opts.method, undefined);
      return json({ fields: { status: { stringValue: status }, role: { stringValue: 'employee' } } });
    }
    assert.ok(url.endsWith('audio/transcriptions'));
    assert.equal(opts.body.get('file').name, 'preview.wav');
    assert.equal(opts.body.get('model'), 'whisper-large-v3-turbo');
    return json({ text: 'بورسلان كود 0012064 مقاس 120 في 60' });
  } };
  const settings = { ...env, USER_LIMIT: limiter, GLOBAL_LIMIT: limiter };
  const response = await handleRequest(makeRequest(), settings, deps);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.match(result.transcript, /0012064/);
  assert.equal(result.command, undefined);
  assert.equal(result.draft, undefined);
  assert.deepEqual(keys, ['preview:u1', 'voice-preview']);
  assert.equal(calls.length, 2);
  assert.equal((await handleRequest(makeRequest('audio/webm'), settings, deps)).status, 400);
  status = 'inactive';
  assert.equal((await handleRequest(makeRequest(), settings, deps)).status, 403);
  assert.equal(calls.filter(url => url.endsWith('audio/transcriptions')).length, 1);
});
test('rejects missing auth, disallowed origins, missing configuration and rate exhaustion before any provider call',async()=>{
 const never=async()=>{throw Error('provider must not run')};assert.equal((await handleRequest(request({token:false}),env,{fetcher:never})).status,401);assert.equal((await handleRequest(request({headers:{Origin:'https://evil.example'}}),env,{fetcher:never})).status,403);assert.equal((await handleRequest(request(),{...env,GROQ_API_KEY:''},{fetcher:never})).status,503);assert.equal((await handleRequest(request(),{...env,USER_LIMIT:{limit:async()=>({success:false})}},{verifyToken:async()=> 'u1',fetcher:never})).status,429);
});
test('two-stage extraction returns a draft, preserves code zeros, normalizes size, never writes Firestore',async()=>{
 const seen=[];const fetcher=async(url,opts)=>{seen.push(url);if(url.includes('firestore.googleapis.com')){assert.equal(opts.method,undefined);return json({fields:{status:{stringValue:'active'},role:{stringValue:'admin'}}})}if(url.endsWith('audio/transcriptions')){assert.equal(opts.body.get('model'),'whisper-large-v3');return json({text:'بورسلان كود 0012064 مقاس120 في60 مطفي كمية45.36'})}const body=JSON.parse(opts.body);assert.equal(body.model,'openai/gpt-oss-120b');assert.equal(body.response_format.json_schema.strict,true);return json({choices:[{message:{content:JSON.stringify(draft)}}]})};const response=await handleRequest(request(),env,{verifyToken:async()=> 'u1',fetcher});assert.equal(response.status,200);const r=await response.json();assert.equal(r.draft.name,'0012064');assert.equal(r.draft.size,'120*60');assert.equal(r.draft.quality,null);assert.equal(seen.length,3);assert.equal(seen.filter(x=>x.includes('firestore')).length,1);
});
test('inactive staff is rejected before audio leaves for Groq',async()=>{let calls=0;const res=await handleRequest(request(),env,{verifyToken:async()=> 'u1',fetcher:async()=>{calls++;return json({fields:{status:{stringValue:'inactive'},role:{stringValue:'admin'}}})}});assert.equal(res.status,403);assert.equal(calls,1)});
test('ambiguous quantities and unknown departments remain missing, fixed department stays locked',()=>{const r=cleanDraft({...draft,quantity:-5,categoryId:'invented',id:'overwrite',hiddenForStaff:true},cats,'');assert.equal(r.quantity,null);assert.equal(r.categoryId,null);assert.ok(r.uncertainties.length);assert.equal('id' in r,false);assert.equal('hiddenForStaff' in r,false);assert.equal(cleanDraft({...draft,categoryId:'ceramics'},cats,'tiles').categoryId,'tiles')});
test('provider free-tier exhaustion is shown as429, without a retry or paid fallback',async()=>{let calls=0;const res=await handleRequest(request(),env,{verifyToken:async()=> 'u1',fetcher:async url=>{calls++;return url.includes('firestore')?json({fields:{status:{stringValue:'active'},role:{stringValue:'employee'}}}):json({},429)}});assert.equal(res.status,429);assert.match((await res.json()).error,/المجاني/);assert.equal(calls,2)});
test('Firebase JWT verification accepts only signed project-bound unexpired identities',async()=>{
 const {privateKey,publicKey}=await generateKeyPair('RS256');const key=await exportJWK(publicKey);key.kid='test-key';key.use='sig';key.alg='RS256';const original=globalThis.fetch;globalThis.fetch=async url=>{assert.ok(String(url).startsWith('https://www.googleapis.com/service_accounts/v1/jwk/'));return json({keys:[key]})};try{const now=Math.floor(Date.now()/1000);const sign=async(aud='test-project',exp=now+300)=>new SignJWT({auth_time:now-10}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setIssuer('https://securetoken.google.com/test-project').setAudience(aud).setSubject('u1').setIssuedAt(now-10).setExpirationTime(exp).sign(privateKey);assert.equal(await verifyFirebaseToken(await sign(),'test-project'),'u1');await assert.rejects(()=>verifyFirebaseToken('eyJhbGciOiJub25lIn0.e30.','test-project'));await assert.rejects(async()=>verifyFirebaseToken(await sign('other-project'),'test-project'));await assert.rejects(async()=>verifyFirebaseToken(await sign('test-project',now-100),'test-project'))}finally{globalThis.fetch=original}
});

test('edited text uses authenticated model-only extraction, with no transcription call or writes',async()=>{
 const body=new FormData();body.set('transcript','عندي بورسلان كود0012064 مية وعشرين متر');body.set('categories',JSON.stringify(cats));body.set('categoryId','tiles');
 const req=new Request('https://worker.example/analyze',{method:'POST',headers:{Origin:origin,Authorization:'Bearer token'},body});const seen=[];
 const res=await handleRequest(req,env,{verifyToken:async()=> 'u1',fetcher:async(url,opts)=>{seen.push(url);if(url.includes('firestore'))return json({fields:{status:{stringValue:'active'},role:{stringValue:'admin'}}});assert.ok(url.endsWith('chat/completions'));const b=JSON.parse(opts.body);assert.ok(b.messages[0].content.includes('عامي أردني'));assert.ok(b.messages[1].content.includes('0012064'));return json({choices:[{message:{content:JSON.stringify(draft)}}]})}});
 assert.equal(res.status,200);assert.equal(seen.length,2);assert.equal((await res.json()).draft.name,'0012064');
 const invalid=new FormData();invalid.set('transcript',' ');invalid.set('categories',JSON.stringify(cats));const bad=await handleRequest(new Request('https://worker.example/analyze',{method:'POST',headers:{Origin:origin,Authorization:'Bearer token'},body:invalid}),env,{verifyToken:async()=> 'u1',fetcher:async()=>json({fields:{status:{stringValue:'active'},role:{stringValue:'admin'}}})});assert.equal(bad.status,400);
});

test('stock mode sends only a structured interpretation request and keeps Firestore read-only', async () => {
  const body = new FormData();
  body.set('mode','stock-command');
  body.set('transcript','احذف كود 0012064 من البورسلان');
  body.set('categories', JSON.stringify(cats));
  const req = new Request('https://worker.example/analyze',{method:'POST',headers:{Origin:origin,Authorization:'Bearer token'},body});
  const called=[];
  const res = await handleRequest(req,env,{verifyToken:async()=> 'u1',fetcher:async(url,opts)=>{
    called.push(url);
    if(url.includes('firestore')) {
      assert.equal(opts.method,undefined);
      return json({fields:{status:{stringValue:'active'},role:{stringValue:'admin'}}});
    }
    assert.ok(url.endsWith('chat/completions'));
    const b=JSON.parse(opts.body);
    assert.equal(b.response_format.json_schema.name,'inventory_stock_command');
    assert.equal(b.response_format.json_schema.strict,true);
    assert.equal(b.tools,undefined);
    return json({choices:[{message:{content:JSON.stringify({action:'delete',target:'0012064',categoryId:'tiles',id:'untrusted'})}}]});
  }});
  assert.equal(res.status,200);
  const result=await res.json();
  assert.equal(result.command.action,'delete');
  assert.equal(result.command.target,'0012064');
  assert.equal(result.command.id,undefined);
  assert.equal(result.draft,undefined);
  assert.equal(called.length,2);
});

test('mixed-language audio sends a clean transcript without losing size, code or specifications', async () => {
  const original = request();
  const form = await original.formData();
  form.set('mode', 'stock-command');
  const req = new Request(original.url, {method:'POST', headers:{Origin:origin,Authorization:'Bearer token'},body:form});
  const spoken = 'أضف بورسلان model Pearl الكود صفر صفر واحد واحد كود 0011، المقاس one hundred and twenty by sixty، نخب أول نخب أول مطفي مطفي، الكمية 11 متر';
  const expected = 'أضف بورسلان model Pearl الكود 0011، المقاس 120*60، نخب أول مطفي، الكمية 11 متر';
  const res = await handleRequest(req, env, {verifyToken:async()=> 'u1',fetcher:async(url,opts)=>{
    if(url.includes('firestore')) return json({fields:{status:{stringValue:'active'},role:{stringValue:'admin'}}});
    if(url.endsWith('audio/transcriptions')) {
      assert.equal(opts.body.has('language'), false);
      return json({text:spoken});
    }
    assert.equal(JSON.parse(JSON.parse(opts.body).messages[1].content).transcript, expected);
    return json({choices:[{message:{content:JSON.stringify({
      action:'add',categoryId:'tiles',name:'11',brand:'Pearl',size:'120 ضرب 60',
      quality:'نخب أول',surface:'مطفي',amount:11,unit:'meters'
    })}}]});
  }});
  assert.equal(res.status, 200);
  const {transcript,command} = await res.json();
  assert.equal(transcript, expected);
  assert.deepEqual([command.name,command.brand,command.size,command.quality,command.surface,command.amount], ['0011','Pearl','120*60','نخب أول','مطفي',11]);
});
