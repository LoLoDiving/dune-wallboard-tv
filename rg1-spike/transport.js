'use strict';
(() => {
 const endpoint='https://script.google.com/macros/s/AKfycbzruM3eVQVDvBd9QpTm4Cr0y7FJCK-rHcqHKSRzozVpBgNewxGzfucaqbTaXucCCO0K/exec';
 const protocol='DIVEOPS_TV_BRIDGE_V1';
 const hint=new URLSearchParams(location.search).get('account');
 const account=['laurent.sampere@dune-world.com','info.malta@dune-world.com'].includes(hint)?hint:null;
 let frame,channel,peer,peerOrigin,readyPromise,readyResolve,readyReject,readyTimer,pending,nextId=0,queue=Promise.resolve(),failures=0,nextAttempt=0;
 const status=text=>{let el=document.getElementById('bridge-status');if(!el){el=document.createElement('div');el.id='bridge-status';el.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#fff;color:#123;padding:6px;font:14px sans-serif';document.body.appendChild(el);}el.textContent='RG1 SPIKE — '+text;};
 const reset=()=>{clearTimeout(readyTimer);if(frame)frame.remove();frame=null;peer=null;peerOrigin=null;readyPromise=null;};
 const fail=code=>{failures++;nextAttempt=Date.now()+Math.min(60000,1000*2**Math.min(failures,6));status(code+'; previous valid display retained');};
 function start(){
  if(readyPromise)return readyPromise;
  if(Date.now()<nextAttempt)return Promise.reject(new Error('BRIDGE_BACKOFF'));
  channel=Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
  readyPromise=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
  frame=document.createElement('iframe');frame.title='DIVEOPS authenticated transport';frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;border:0';frame.src=endpoint+'?page=TV_TRANSPORT_BRIDGE&channel='+channel+(account?'&authuser='+encodeURIComponent(account):'');document.body.appendChild(frame);status('waiting for authenticated bridge');
  readyTimer=setTimeout(()=>{const reject=readyReject;reset();fail('BRIDGE_AUTH_OR_LOAD_TIMEOUT');reject(new Error('BRIDGE_AUTH_OR_LOAD_TIMEOUT'));},25000);
  return readyPromise;
 }
 window.addEventListener('message',event=>{
  const m=event.data;if(!m||m.protocol!==protocol||m.channel!==channel||!frame)return;
  if(m.kind==='ready'){
   let belongs=false;try{belongs=event.source!==frame.contentWindow&&event.source.parent.parent===frame.contentWindow;}catch(_){}
   if(!belongs||!/^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(event.origin)){status('BRIDGE_SOURCE_REJECTED');return;}
   if(peer&&(peer!==event.source||peerOrigin!==event.origin))return;
   peer=event.source;peerOrigin=event.origin;clearTimeout(readyTimer);status('authenticated bridge ready');readyResolve();return;
  }
  if(event.source!==peer||event.origin!==peerOrigin||!pending||m.id!==pending.id)return;
  if(m.kind!=='result'&&m.kind!=='error')return;
  const task=pending;pending=null;clearTimeout(task.timer);
  if(m.kind==='error'){fail('RPC_UNAVAILABLE');task.reject(new Error('RPC_UNAVAILABLE'));return;}
  const data=m.data;const valid=data&&typeof data==='object'&&(task.operation==='wallboard'?Array.isArray(data.days)&&data.days.length>0:typeof data.date==='string'&&data.slots&&typeof data.slots==='object'&&!Array.isArray(data.slots));
  if(!valid){fail('MALFORMED_RESPONSE');task.reject(new Error('MALFORMED_RESPONSE'));return;}
  failures=0;nextAttempt=0;status('data received '+new Date().toLocaleTimeString());task.resolve(data);
 });
 async function request(operation,date){
  if(!['wallboard','daily'].includes(operation)||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('INVALID_REQUEST');
  await start();return new Promise((resolve,reject)=>{const id=++nextId;pending={id,operation,resolve,reject,timer:setTimeout(()=>{pending=null;reset();fail('RPC_TIMEOUT');reject(new Error('RPC_TIMEOUT'));},120000)};peer.postMessage({protocol,channel,kind:'request',id,operation,date},peerOrigin);});
 }
 window.DiveOpsTvBridge=Object.freeze({request(operation,date){const task=queue.then(()=>request(operation,date));queue=task.catch(()=>{});return task;}});
})();
