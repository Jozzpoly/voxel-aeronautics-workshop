const fs=require('fs'), vm=require('vm'), path=require('path');
const html=fs.readFileSync(process.argv[2],'utf8');
const sourceFiles=process.argv.slice(3);
if(!sourceFiles.length) throw new Error('No application source files supplied to startup smoke test.');
const ids=[...html.matchAll(/<([a-zA-Z0-9-]+)[^>]*\sid="([^"]+)"[^>]*>/g)].map(m=>[m[2],m[1].toLowerCase()]);
class ClassList{constructor(el){this.el=el;this.s=new Set((el.className||'').split(/\s+/).filter(Boolean));}add(...x){x.forEach(v=>this.s.add(v));this.sync()}remove(...x){x.forEach(v=>this.s.delete(v));this.sync()}toggle(x,on){if(on===undefined){this.s.has(x)?this.s.delete(x):this.s.add(x)}else on?this.s.add(x):this.s.delete(x);this.sync();return this.s.has(x)}contains(x){return this.s.has(x)}sync(){this.el.className=[...this.s].join(' ')}}
const all=[];
class El{
 constructor(tag='div',id=''){this.tagName=tag.toUpperCase();this.id=id;this.children=[];this.parentElement=null;this.style={};this.dataset={};this.className='';this.classList=new ClassList(this);this.textContent='';this._innerHTML='';this.hidden=false;this.disabled=false;this.value=tag==='input'?'70':'';this.files=[];this.type='';this.userData={};this.width=0;this.height=0;all.push(this)}
 appendChild(c){if(c){c.parentElement=this;this.children.push(c)}return c} removeChild(c){this.children=this.children.filter(x=>x!==c)} remove(){if(this.parentElement)this.parentElement.removeChild(this)}
 addEventListener(){} removeEventListener(){} click(){} closest(sel){if(sel.startsWith('#')){let e=this;while(e){if('#'+e.id===sel)return e;e=e.parentElement}}return null}
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
global.window=global;global.document=document;global.navigator={userAgent:'smoke'};global.innerWidth=1280;global.innerHeight=720;global.devicePixelRatio=1;global.performance={now:()=>0};global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};global.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});global.addEventListener=()=>{};global.removeEventListener=()=>{};global.URL={createObjectURL:()=>'',revokeObjectURL(){}};global.Blob=class{};global.FileReader=class{readAsText(){}};global.alert=()=>{};global.confirm=()=>true;global.setTimeout=(fn)=>0;global.clearTimeout=()=>{};
vm.runInThisContext(fs.readFileSync(path.join(__dirname,'browser_stub_libs.js'),'utf8'),{filename:'stub-libs.js'});
try{
 for(const sourceFile of sourceFiles){
   vm.runInThisContext(fs.readFileSync(sourceFile,'utf8'),{filename:path.basename(sourceFile)});
 }
 if(!global.VAW_RUNTIME) throw new Error('Foundation runtime was not exposed.');
 console.log('STARTUP_OK', {ids:ids.length,elements:all.length,modules:global.VAW.inspect().initialized.length,sources:sourceFiles.length});
}catch(e){console.error(e.stack||e);process.exit(1)}
