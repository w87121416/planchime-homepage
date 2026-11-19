import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createVoiceClip, voiceWavBase64 } from '../app/lib/services/voice-audio.ts';
import { BrowserVoiceRecorder } from '../app/lib/services/voice-recorder.ts';
import { MemberVoiceController } from '../app/lib/services/voice-controller.ts';
import { parseVoiceDraft } from '../app/lib/services/voice-protocol.ts';
import { parseTextDraft } from '../app/lib/services/protocol.ts';
import { PlannerRepository } from '../app/lib/planner/model.ts';
import { confirmedDraftDocument } from '../app/lib/services/planner.ts';
import { PurchaseTransport } from '../app/lib/purchase/transport.ts';
import { memberFixture } from './fixtures/member-services.ts';

const instant='2026-11-19T00:00:00.000Z';
const clip=()=>createVoiceClip([new Float32Array(16001).fill(.2)],16000,instant);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(options={}) {
 const f=memberFixture(options);let captures=0,cancelled=0,current=true;
 const recorder={capture:async notify=>{captures++;notify(1);return clip();},stop(){},cancel(){cancelled++;}};
 const c=new MemberVoiceController(f.client,'synthetic-account-a',()=>current,()=>{current=false;},recorder);
 return {f,c,recorder,get captures(){return captures;},get cancelled(){return cancelled;},loseAccount(){current=false;}};
}
function repository() {let raw=null;return {repo:new PlannerRepository({storage:{getItem:()=>raw,setItem:(_,value)=>{raw=value;}},exclusive:async fn=>fn(),uuid:()=> 'revision',now:()=>instant}),read:()=>raw};}

test('48k 实际重采样为 16k 单声道 PCM16，秒数向上取整，规范 Base64',()=>{
 const c=createVoiceClip([new Float32Array(48003).fill(.5)],48000,instant),v=new DataView(c.wav.buffer);
 assert.equal(c.sampleCount,16001);assert.equal(c.units,2);assert.equal(c.wav.length,32046);assert.equal(v.getUint32(24,true),16000);assert.equal(v.getUint32(28,true),32000);assert.equal(v.getUint16(22,true),1);assert.equal(v.getInt16(44,true),16384);
 const b64=voiceWavBase64(c.wav);assert.deepEqual(Buffer.from(b64,'base64'),Buffer.from(c.wav));
 assert.equal(createVoiceClip([new Float32Array(960000)],16000,instant).units,60);
 assert.throws(()=>createVoiceClip([new Float32Array(960001)],16000,instant));assert.throws(()=>createVoiceClip([new Float32Array([NaN])],16000,instant));assert.throws(()=>createVoiceClip([],16000,instant));
 const bad=c.wav.slice();bad[22]=2;assert.throws(()=>voiceWavBase64(bad));
});
test('正式关闭时不请求麦克风或任何语音接口',async()=>{
 const s=setup({closed:true});await s.c.load();await s.c.record('Asia/Shanghai');await s.c.send(true);assert.equal(s.captures,0);assert.deepEqual(s.f.calls,[]);s.c.dispose();
});
test('先本机录音，双重确认才授权上传，精确 DTO 不允许客户端计量/账号',async()=>{
 const s=setup();await s.c.load();await s.c.record('Asia/Shanghai');assert.equal(s.captures,1);assert.equal(s.f.calls.some(c=>c.method==='POST'),false);
 await s.c.send(false);assert.equal(s.f.calls.some(c=>c.method==='POST'),false);await s.c.send(true);
 const post=s.f.calls.find(c=>c.path==='/v1/web-pro/voice-drafts');assert.deepEqual(Object.keys(post.body).sort(),['confirmedUpload','consentRecordId','referenceInstant','requestId','schemaVersion','timeZoneId','wavBase64']);
 assert.equal(post.body.referenceInstant,instant);assert.equal(post.body.timeZoneId,'Asia/Shanghai');assert.equal(post.body.confirmedUpload,true);assert.equal(post.credentials,'include');assert.equal(post.headers['X-Planchime-Pro-Version'],'2026-11-12');assert.equal(post.headers['X-Planchime-Web-Version'],'2026-10-19');assert.equal(post.headers.Authorization,undefined);assert.ok(post.headers['X-Planchime-CSRF']);
 assert.equal(s.f.state.remaining,300);assert.equal(s.f.state.voiceRemaining,3598);s.c.dispose();
});
test('取消本机录音不会上传，额度不足不开始录音',async()=>{
 const s=setup();await s.c.load();await s.c.record('Asia/Shanghai');s.c.discard();await s.c.send(true);assert.equal(s.c.getSnapshot().clip,null);assert.equal(s.f.calls.some(c=>c.method==='POST'),false);
 s.f.state.voiceRemaining=0;await s.c.load();await s.c.record('Asia/Shanghai');assert.equal(s.captures,1);s.c.dispose();
});
test('未知上传/刷新只查询原 ID，绝不再次 POST，恢复槽没有音频或转写',async()=>{
 const s=setup();s.f.state.unknownVoice=true;await s.c.load();await s.c.record('Asia/Shanghai');await s.c.send(true);const id=s.c.getSnapshot().requestId;assert.ok(id);await s.c.send(true);await s.c.finish();assert.equal(s.c.getSnapshot().requestId,id);assert.ok(s.c.getSnapshot().clip);
 const again=new MemberVoiceController(s.f.client,'synthetic-account-a',()=>true,()=>{},s.recorder);await again.load();assert.equal(again.getSnapshot().requestId,id);await again.query();assert.equal(again.getSnapshot().draft.state,'ready');assert.equal(s.f.calls.filter(c=>c.path==='/v1/web-pro/voice-drafts').length,1);
 const stored=JSON.stringify([...s.f.storage]);assert.ok(!stored.includes('合成'));assert.ok(!stored.includes('wavBase64'));assert.ok(!stored.includes('synthetic-account-a'));s.c.dispose();again.dispose();
});
test('独立语音授权：外层 sourceConsent、内层 speech-transcript 与原文字 typed-text 互不放宽',async()=>{
 const s=setup();await s.c.load();await s.c.record('Asia/Shanghai');await s.c.send(true);const id=s.c.getSnapshot().requestId;await s.c.query();
 const draft=s.f.state.voiceDrafts.get(id),wrapped={schemaVersion:1,accountId:'synthetic-account-a',draft};assert.ok(parseVoiceDraft(wrapped,'synthetic-account-a',id,draft.sourceConsentRecordId).proposal);
 for(const patch of [{sourceConsentPolicyVersion:'ai-data-policy.v1'},{sourceConsentRecordId:'other'}])assert.throws(()=>parseVoiceDraft({...wrapped,draft:{...draft,...patch}},'synthetic-account-a',id,draft.sourceConsentRecordId));
 assert.throws(()=>parseVoiceDraft(wrapped,'synthetic-account-b',id,draft.sourceConsentRecordId));
 const wrong=structuredClone(wrapped);wrong.draft.result.audit.dataScopes=['typed-text'];assert.throws(()=>parseVoiceDraft(wrong,'synthetic-account-a',id,draft.sourceConsentRecordId));
 const text={schemaVersion:1,accountId:'synthetic-account-a',draft:s.f.ready('typed')};assert.ok(parseTextDraft(text,'synthetic-account-a','typed').proposal);
 text.draft.result.audit.dataScopes=['speech-transcript'];assert.throws(()=>parseTextDraft(text,'synthetic-account-a','typed'));delete text.draft.result.audit.dataScopes;assert.throws(()=>parseTextDraft(text,'synthetic-account-a','typed'));s.c.dispose();
});
test('可信转写可手工保存，未知扣量仍保留原查询；未经确认不写事项',async()=>{
 const s=setup();s.f.state.voiceOutcome='indeterminate';await s.c.load();await s.c.record('Asia/Shanghai');await s.c.send(true);await s.c.query();const local=repository(),draft={title:'手工核对的合成事项',date:'',time:'',notes:''};
 assert.equal(s.c.getSnapshot().draft.proposal,null);assert.ok(s.c.getSnapshot().draft.transcript);await s.c.save(()=>local.repo,draft,false);assert.equal(local.read(),null);
 await s.c.save(()=>local.repo,draft,true);await s.c.save(()=>local.repo,draft,true);assert.equal(local.repo.read().items.length,1);assert.ok(s.c.getSnapshot().requestId);assert.equal(await s.f.client.pending('synthetic-account-a','voice'),s.c.getSnapshot().requestId);s.c.dispose();assert.equal(local.repo.read().items.length,1);
});
test('撤回及时清录音/结果；旧响应不能回填，已保存日程不移除',async()=>{
 const s=setup();await s.c.load();await s.c.record('Asia/Shanghai');await s.c.send(true);await s.c.query();assert.ok(s.c.getSnapshot().draft.transcript);await s.c.revoke();assert.equal(s.c.getSnapshot().clip,null);assert.equal(s.c.getSnapshot().draft,null);assert.ok(s.c.getSnapshot().consent.revokedAt);assert.ok(s.cancelled);
 let release;const original=s.f.client.readVoice.bind(s.f.client);s.f.client.readVoice=async(...args)=>{const result=await original(...args);await new Promise(r=>{release=r;});return result;};const pending=s.c.query();await tick();s.c.dispose();release();await pending;assert.equal(s.c.getSnapshot().draft,null);
});
test('权益或授权拒绝也不自动重发，退出忽略迟到录音',async()=>{
 const s=setup();s.f.state.voiceRejected=true;await s.c.load();await s.c.record('Asia/Shanghai');await s.c.send(true);await s.c.send(true);await s.c.query();assert.equal(s.f.calls.filter(c=>c.path==='/v1/web-pro/voice-drafts').length,1);assert.ok(s.c.getSnapshot().clip);assert.equal(s.c.getSnapshot().rejectedBeforeTask,true);
 await s.c.finish();assert.equal(s.c.getSnapshot().requestId,null);assert.ok(s.c.getSnapshot().clip);assert.equal(s.f.calls.filter(c=>c.path==='/v1/web-pro/voice-drafts').length,1);s.c.dispose();
 const t=setup();let release;t.recorder.capture=()=>new Promise(r=>{release=r;});await t.c.load();const recording=t.c.record('Asia/Shanghai');t.loseAccount();t.c.dispose();release(clip());await recording;assert.equal(t.c.getSnapshot().clip,null);
});
test('本地保存失败仍留草稿；24 小时结果到期后不能保存旧提案',async()=>{
 const s=setup();await s.c.load();await s.c.record('Asia/Shanghai');await s.c.send(true);await s.c.query();const draft={title:'合成事项',date:'',time:'',notes:''};
 await s.c.save(()=>({merge:async()=>{throw new Error('synthetic full');}}),draft,true);assert.ok(s.c.getSnapshot().draft.proposal);assert.equal(s.c.getSnapshot().error,'草稿已生成，但还没有保存到浏览器。内容仍保留着。');
 s.f.state.voiceDrafts.get(s.c.getSnapshot().requestId).expiresAt='2026-01-01T00:00:00.000Z';await s.c.query();assert.equal(s.c.getSnapshot().draft.transcript,null);assert.equal(s.c.getSnapshot().draft.proposal,null);
 const local=repository();await s.c.save(()=>local.repo,draft,true);assert.equal(local.read(),null);s.c.dispose();
});
test('语音白名单仅固定 consent/create/read，不能假造取消或附加账号参数',async()=>{
 const f=memberFixture(),t=new PurchaseTransport(f.configuration.transport,f.runtime);
 for(const path of ['/v1/web-pro/voice-drafts/x/cancel','/v1/web-pro/voice-drafts/x?accountId=y','/v1/web-pro/voice-drafts?retry=1'])await assert.rejects(()=>t.request(path,'service',{csrfToken:'a'.repeat(64),body:{schemaVersion:1}}));
 assert.equal(f.calls.length,0);
});
function fakeRecorderRuntime(mediaOverride) {
 const track={stopped:0,onended:null,stop(){this.stopped++;}},stream={getTracks:()=>[track]};
 const port={onmessage:null,closed:false,close(){this.closed=true;},postMessage(){queueMicrotask(()=>this.onmessage?.({data:{type:'done'}}));}};
 const node={port,onprocessorerror:null,connect(){},disconnect(){}};
 const context={sampleRate:48000,state:'running',closed:0,audioWorklet:{addModule:async()=>{}},resume:async()=>{},close(){this.closed++;this.state='closed';return Promise.resolve();},createMediaStreamSource:()=>({connect(){},disconnect(){}}),createGain:()=>({gain:{value:1},connect(){},disconnect(){}}),destination:{}};
 return {runtime:{media:mediaOverride??(async()=>stream),context:()=>context,node:()=>node,now:()=>instant},track,stream,node,context};
}
test('权限迟到许可也停止音轨，拒绝/卸载关闭 AudioContext',async()=>{
 let release;const f=fakeRecorderRuntime(()=>new Promise(r=>{release=r;})),r=new BrowserVoiceRecorder(f.runtime),pending=r.capture(()=>{});const rejected=assert.rejects(pending,e=>e.code==='cancelled');r.cancel();release(f.stream);await rejected;await tick();assert.equal(f.track.stopped,1);assert.equal(f.context.closed,1);
 const denied=fakeRecorderRuntime(async()=>{throw new DOMException('denied','NotAllowedError');});await assert.rejects(new BrowserVoiceRecorder(denied.runtime).capture(()=>{}),e=>e.code==='denied');assert.equal(denied.context.closed,1);
});
test('停止录音编码真实采样、关闭设备；worklet 报错也释放',async()=>{
 const f=fakeRecorderRuntime(),r=new BrowserVoiceRecorder(f.runtime),pending=r.capture(()=>{});await tick();f.node.port.onmessage({data:{type:'samples',data:new Float32Array(48000)}});r.stop();const result=await pending;assert.equal(result.units,1);assert.equal(result.sampleCount,16000);assert.ok(f.track.stopped);assert.equal(f.context.closed,1);assert.equal(f.node.port.closed,true);
 const bad=fakeRecorderRuntime(),record=new BrowserVoiceRecorder(bad.runtime),broken=record.capture(()=>{}),rejected=assert.rejects(broken,e=>e.code==='unavailable');await tick();bad.node.onprocessorerror();await rejected;assert.equal(bad.context.closed,1);assert.ok(bad.track.stopped);
});
test('真实 worklet 源码硬限制 60 秒并下混单声道，不靠主线程计时器',async()=>{
 const source=await readFile(new URL('../public/audio/planchime-voice-capture.v1.js',import.meta.url),'utf8'),messages=[];let Processor;
 runInNewContext(source,{Float32Array,sampleRate:16000,AudioWorkletProcessor:class{port={onmessage:null,postMessage:message=>messages.push(message)};},registerProcessor:(_,value)=>{Processor=value;}});
 const p=new Processor(),left=new Float32Array(128).fill(1),right=new Float32Array(128).fill(-1);
 for(let i=0;i<7600;i++)if(!p.process([[left,right]]))break;
 const samples=messages.filter(m=>m.type==='samples').flatMap(m=>[...m.data]);assert.equal(samples.length,960000);assert.ok(samples.every(v=>v===0));assert.equal(messages.filter(m=>m.type==='done').length,1);assert.equal(p.process([[left,right]]),false);
});
test('F3.1 保存成功终结编辑；重查/重开识别本机版本，未知查询保持',async()=>{
 const s=setup();s.f.state.voiceOutcome='indeterminate';await s.c.load();await s.c.record('Asia/Shanghai');await s.c.send(true);await s.c.query();const local=repository(),a={title:'已保存A',date:'',time:'',notes:''};
 await s.c.save(()=>local.repo,a,true);assert.equal(s.c.getSnapshot().saved,'saved');const id=s.c.getSnapshot().requestId;
 await s.c.save(()=>local.repo,{...a,title:'不应假保存B'},true);assert.equal(local.repo.read().items[0].title,'已保存A');assert.equal(local.repo.read().items.length,1);assert.equal(await s.f.client.pending('synthetic-account-a','voice'),id);
 const existing=local.repo.read().items[0];await local.repo.save({...existing,title:'用户在日程页改成C'},existing);
 const again=new MemberVoiceController(s.f.client,'synthetic-account-a',()=>true,()=>{},s.recorder,()=>local.repo.read());await again.load();await again.query();assert.equal(again.getSnapshot().saved,'existing');
 await again.save(()=>local.repo,{...a,title:'不能覆盖C'},true);assert.equal(local.repo.read().items[0].title,'用户在日程页改成C');s.c.dispose();again.dispose();
});
test('F3.1 另页先保存导致merge跳过时明确已有版本，不谎称新输入写入',async()=>{
 const s=setup();await s.c.load();await s.c.record('Asia/Shanghai');await s.c.send(true);await s.c.query();const local=repository(),id=s.c.getSnapshot().requestId;
 await local.repo.merge(await confirmedDraftDocument({title:'另一页保存A',date:'',time:'',notes:''},'synthetic-account-a',`voice:${id}`));
 await s.c.save(()=>local.repo,{title:'本页编辑B',date:'',time:'',notes:''},true);assert.equal(s.c.getSnapshot().saved,'existing');assert.equal(s.c.getSnapshot().notice,'本次日程已在当前浏览器中，已保留本机版本，没有覆盖修改。');assert.equal(local.repo.read().items[0].title,'另一页保存A');s.c.dispose();
});
test('F3.1 同账号额度复核保留clip，独立授权已撤回则清理clip和草稿',async()=>{
 const s=setup();await s.c.load();await s.c.record('Asia/Shanghai');const before=s.c.getSnapshot().clip;await s.c.load();assert.equal(s.c.getSnapshot().clip,before);
 await s.c.send(true);await s.c.query();s.f.state.voiceConsent.revokedAt=new Date().toISOString();await s.c.load();assert.equal(s.c.getSnapshot().clip,null);assert.equal(s.c.getSnapshot().draft,null);s.c.dispose();
});
