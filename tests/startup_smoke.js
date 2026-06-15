const fs=require('fs'), vm=require('vm'), path=require('path');
const html=fs.readFileSync(process.argv[2],'utf8');
const sourceFiles=process.argv.slice(3);
if(!sourceFiles.length) throw new Error('No application source files supplied to startup smoke test.');
const ids=[...html.matchAll(/<([a-zA-Z0-9-]+)[^>]*\sid="([^"]+)"[^>]*>/g)].map(m=>[m[2],m[1].toLowerCase()]);
class ClassList{constructor(el){this.el=el;this.s=new Set((el.className||'').split(/\s+/).filter(Boolean));}add(...x){x.forEach(v=>this.s.add(v));this.sync()}remove(...x){x.forEach(v=>this.s.delete(v));this.sync()}toggle(x,on){if(on===undefined){this.s.has(x)?this.s.delete(x):this.s.add(x)}else on?this.s.add(x):this.s.delete(x);this.sync();return this.s.has(x)}contains(x){return this.s.has(x)}sync(){this.el.className=[...this.s].join(' ')}}
const all=[];
class El{
 constructor(tag='div',id=''){this.tagName=tag.toUpperCase();this.id=id;this.children=[];this.parentElement=null;this.style={};this.dataset={};this.className='';this.classList=new ClassList(this);this.textContent='';this._innerHTML='';this.hidden=false;this.disabled=false;this.value=tag==='input'?'70':'';this.files=[];this.type='';this.userData={};this.width=0;this.height=0;this.listeners=new Map();all.push(this)}
 appendChild(c){if(c){c.parentElement=this;this.children.push(c)}return c} removeChild(c){this.children=this.children.filter(x=>x!==c)} remove(){if(this.parentElement)this.parentElement.removeChild(this)}
 addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn)} removeEventListener(type,fn){if(this.listeners.has(type))this.listeners.set(type,this.listeners.get(type).filter(x=>x!==fn))} dispatchEvent(event={}){event.type=event.type||'event';event.target=event.target||this;event.currentTarget=this;event.preventDefault=event.preventDefault||(()=>{event.defaultPrevented=true});event.stopPropagation=event.stopPropagation||(()=>{});for(const fn of this.listeners.get(event.type)||[])fn(event);return !event.defaultPrevented} click(){if(!this.disabled)this.dispatchEvent({type:'click'})} closest(sel){if(sel.startsWith('#')){let e=this;while(e){if('#'+e.id===sel)return e;e=e.parentElement}}return null}
 querySelectorAll(sel){return query(sel,this)} querySelector(sel){return this.querySelectorAll(sel)[0]||null}
 set innerHTML(v){this._innerHTML=String(v)} get innerHTML(){return this._innerHTML}
 getBoundingClientRect(){return {left:0,top:0,width:1280,height:720,right:1280,bottom:720}}
 setAttribute(k,v){this[k]=v} getContext(){return {}} 
}
const elements=new Map();
for(const [id,tag] of ids){const e=new El(tag,id);elements.set(id,e)}
const body=new El('body','body'), head=new El('head','head');
function descendants(root){const out=[];const walk=e=>{for(const c of e.children){out.push(c);walk(c)}};walk(root);return out}
function query(sel,root=null){let pool=root?descendants(root):all;if(sel.startsWith('.'))return pool.filter(e=>e.classList.contains(sel.slice(1)) || e.className.split(/\s+/).includes(sel.slice(1)));if(sel.startsWith('#')){const e=elements.get(sel.slice(1));return e?[e]:[]}if(sel==='button')return pool.filter(e=>e.tagName==='BUTTON');return []}
const document={body,head,hidden:false,createElement:t=>new El(t),getElementById:id=>elements.get(id)||null,querySelectorAll:s=>query(s),querySelector:s=>query(s)[0]||null,addEventListener(){},removeEventListener(){}};
for(const e of elements.values())body.appendChild(e);
const windowListeners=new Map();
global.window=global;global.document=document;global.navigator={userAgent:'smoke'};global.innerWidth=1280;global.innerHeight=720;global.devicePixelRatio=1;global.performance={now:()=>0};global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};global.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});global.addEventListener=(type,fn)=>{if(!windowListeners.has(type))windowListeners.set(type,[]);windowListeners.get(type).push(fn)};global.removeEventListener=(type,fn)=>{if(windowListeners.has(type))windowListeners.set(type,windowListeners.get(type).filter(x=>x!==fn))};global.dispatchWindowEvent=(type,event={})=>{event.type=type;event.key=event.key||'';event.code=event.code||'';event.ctrlKey=!!event.ctrlKey;event.metaKey=!!event.metaKey;event.shiftKey=!!event.shiftKey;event.repeat=!!event.repeat;event.preventDefault=event.preventDefault||(()=>{event.defaultPrevented=true});for(const fn of windowListeners.get(type)||[])fn(event);return event};global.URL={createObjectURL:()=>'',revokeObjectURL(){}};global.Blob=class{};global.FileReader=class{readAsText(){}};global.alert=()=>{};global.confirm=()=>true;global.setTimeout=(fn)=>0;global.clearTimeout=()=>{};
vm.runInThisContext(fs.readFileSync(path.join(__dirname,'browser_stub_libs.js'),'utf8'),{filename:'stub-libs.js'});
try{
 for(const sourceFile of sourceFiles){
   vm.runInThisContext(fs.readFileSync(sourceFile,'utf8'),{filename:path.basename(sourceFile)});
 }
 if(!global.VAW_RUNTIME) throw new Error('Foundation runtime was not exposed.');
 const assert=(condition,message)=>{if(!condition)throw new Error(message)};
 assert(elements.get('ui-blocks').textContent==='0','Fresh v8 workspace must start empty.');
 assert(all.some(el=>el.dataset.tool==='Core'),'Command Core must be available in the tool palette.');
 assert(elements.get('ui-binding-warning').textContent.includes('Flight Focus'),'Default Ctrl binding must explain the browser-safe focus mode.');
 const descendBindingButton=all.find(el=>el.dataset.bindingAction==='lift-' && el.dataset.bindingSlot==='0');
 assert(descendBindingButton,'Runtime must render a rebind button for descend.');
 descendBindingButton.click();
 const reboundEvent=dispatchWindowEvent('keydown',{key:'x',code:'KeyX'});
 assert(reboundEvent.defaultPrevented===true,'Binding capture must claim the selected physical key.');
 elements.get('btn-input-profile-reset').click();
 elements.get('thruster-power').value='41';
 elements.get('thruster-power').dispatchEvent({type:'input'});
 assert(elements.get('ui-thruster-power').textContent==='41%','Passive-thrust slider must refresh its numeric readout immediately.');
 assert(elements.get('ui-thruster-guidance').innerHTML.includes('− / +'),'Passive-thrust guidance must expose its current shortcut pair.');
 elements.get('balloon-power').value='37';
 elements.get('balloon-power').dispatchEvent({type:'input'});
 assert(elements.get('ui-balloon-power').textContent==='37%','Balloon slider must refresh its numeric readout immediately.');
 elements.get('btn-flight').click();
 assert(elements.get('ui-mode').textContent==='BUILD','An empty craft must remain in build mode after rejected launch.');
 assert(elements.get('ui-status').textContent==='INVALID CRAFT','Rejected empty launch must produce a clear invalid-craft status.');
 elements.get('btn-starter-craft').click();
 assert(elements.get('ui-blocks').textContent==='17','Starter craft must load after an empty workspace.');
 elements.get('start-engineering').click();
 elements.get('btn-flight').click();
 assert(elements.get('ui-mode').textContent==='FLIGHT','A compiled starter craft must enter flight mode.');
 elements.get('thruster-power').value='70';
 elements.get('thruster-power').dispatchEvent({type:'input'});
 const thrusterUpEvent=dispatchWindowEvent('keydown',{key:'+',code:'Equal'});
 assert(thrusterUpEvent.defaultPrevented===true,'Passive-thrust hotkey must suppress browser text handling during flight.');
 assert(elements.get('ui-thruster-power').textContent==='72%','Equal must increase passive thrust by 2%.');
 assert(elements.get('thruster-power').value==='72','Passive-thrust hotkey must keep the slider thumb synchronized.');
 dispatchWindowEvent('keydown',{key:'-',code:'Minus'});
 assert(elements.get('ui-thruster-power').textContent==='70%','Minus must decrease passive thrust by 2%.');
 const balloonUpEvent=dispatchWindowEvent('keydown',{key:'.',code:'Period'});
 assert(balloonUpEvent.defaultPrevented===true,'Balloon power hotkey must suppress browser text handling during flight.');
 assert(elements.get('ui-balloon-power').textContent==='72%','Period must increase balloon power by 2%.');
 assert(elements.get('balloon-power').value==='72','Balloon hotkey must keep the slider thumb synchronized.');
 dispatchWindowEvent('keydown',{key:',',code:'Comma'});
 assert(elements.get('ui-balloon-power').textContent==='70%','Comma must decrease balloon power by 2%.');
 dispatchWindowEvent('keydown',{key:'w',code:'KeyW'});
 assert(elements.get('ui-surge-value').textContent==='100%','W must drive the forward translation axis.');
 dispatchWindowEvent('keyup',{key:'w',code:'KeyW'});
 dispatchWindowEvent('keydown',{key:' ',code:'Space'});
 assert(elements.get('ui-lift-command-value').textContent==='100%','Space must drive the upward translation axis.');
 dispatchWindowEvent('keyup',{key:' ',code:'Space'});
 dispatchWindowEvent('keydown',{key:'Control',code:'ControlLeft',ctrlKey:true});
 const ctrlReverseEvent=dispatchWindowEvent('keydown',{key:'s',code:'KeyS',ctrlKey:true});
 assert(ctrlReverseEvent.defaultPrevented===true,'A delivered Ctrl+S flight chord must be claimed by the game.');
 assert(elements.get('ui-lift-command-value').textContent==='-100%','Left Ctrl must remain available as down thrust while another axis is held.');
 assert(elements.get('ui-surge-value').textContent==='-100%','Left Ctrl + S must command down + reverse.');
 dispatchWindowEvent('keyup',{key:'s',code:'KeyS',ctrlKey:true});
 const ctrlThrusterEvent=dispatchWindowEvent('keydown',{key:'+',code:'Equal',ctrlKey:true});
 assert(ctrlThrusterEvent.defaultPrevented===true,'Ctrl + Equal must remain a game input when the browser delivers it.');
 assert(elements.get('ui-lift-command-value').textContent==='-100%','Adjusting passive thrust must not release held descent.');
 assert(elements.get('ui-thruster-power').textContent==='72%','Ctrl + Equal must adjust passive thrust while descending.');
 dispatchWindowEvent('keydown',{key:'-',code:'Minus',ctrlKey:true});
 assert(elements.get('ui-thruster-power').textContent==='70%','Ctrl + Minus must adjust passive thrust while descending.');
 const ctrlBalloonEvent=dispatchWindowEvent('keydown',{key:'.',code:'Period',ctrlKey:true});
 assert(ctrlBalloonEvent.defaultPrevented===true,'Ctrl + Period must remain a game input when the browser delivers it.');
 assert(elements.get('ui-lift-command-value').textContent==='-100%','Adjusting Balloon power must not release held descent.');
 assert(elements.get('ui-balloon-power').textContent==='72%','Ctrl + Period must adjust Balloon power while descending.');
 dispatchWindowEvent('keydown',{key:',',code:'Comma',ctrlKey:true});
 assert(elements.get('ui-balloon-power').textContent==='70%','Ctrl + Comma must adjust Balloon power while descending.');
 dispatchWindowEvent('keyup',{key:'Control',code:'ControlLeft'});
 elements.get('btn-build').click();
 elements.get('btn-clear').click();
 assert(elements.get('ui-blocks').textContent==='0','New blueprint must return to a truly empty workspace.');
 console.log('STARTUP_OK', {ids:ids.length,elements:all.length,modules:global.VAW.inspect().initialized.length,sources:sourceFiles.length,interaction:'ok'});
}catch(e){console.error(e.stack||e);process.exit(1)}
