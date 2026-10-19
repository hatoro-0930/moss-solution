import { addFiles, LIMITS } from './file-policy.js';
const input=document.getElementById('attachment-input');
const choose=document.getElementById('choose-files');
const zone=document.getElementById('file-dropzone');
const list=document.getElementById('file-list');
const summary=document.getElementById('file-summary');
const errorView=document.getElementById('file-errors');
let selected=[], errors=[], busy=false, dragDepth=0;
const en=()=>window.mossLanguage?.()==='en';
const size=n=>n<1024*1024?`${Math.max(1,Math.round(n/1024))} KB`:`${(n/1024/1024).toFixed(1)} MB`;
const messages={type:['지원하지 않는 형식입니다. ZIP으로 묶어 첨부해주세요.','Unsupported format. Please attach it as a ZIP file.'],empty:['빈 파일은 첨부할 수 없습니다.','Empty files cannot be attached.'],size:['파일당 10MB까지 가능합니다.','Each file must be 10 MB or smaller.'],duplicate:['이미 선택한 파일입니다.','This file is already selected.'],count:['최대 10개까지 첨부할 수 있습니다.','You can attach up to 10 files.'],total:['전체 용량은 20MB까지 가능합니다.','The combined size must not exceed 20 MB.']};
function render() {
 list.replaceChildren();
 for(const [index,file] of selected.entries()) {
  const row=document.createElement('li');row.className='file-row';
  const info=document.createElement('div');info.className='file-info';
  const name=document.createElement('span');name.className='file-name';name.textContent=file.name;
  const bytes=document.createElement('span');bytes.className='file-size';bytes.textContent=size(file.size);
  const remove=document.createElement('button');remove.type='button';remove.className='file-remove';remove.disabled=busy;
  remove.textContent=en()?'Remove':'삭제';remove.setAttribute('aria-label',`${file.name} ${en()?'Remove':'삭제'}`);
  remove.addEventListener('click',()=>{if(busy)return;selected.splice(index,1);errors=[];render();(list.querySelectorAll('button')[Math.min(index,selected.length-1)]||choose).focus();});
  info.append(name,bytes);row.append(info,remove);list.append(row);
 }
 const total=selected.reduce((n,f)=>n+f.size,0);
 summary.textContent=selected.length?(en()?`${selected.length} / ${LIMITS.count} files selected · ${size(total)} / 20 MB`:`${selected.length} / ${LIMITS.count}개 선택 · ${size(total)} / 20MB`):'';
 errorView.hidden=!errors.length;
 errorView.textContent=errors.map(({name,code})=>`${name}: ${messages[code][en()?1:0]}`).join('\n');
 list.setAttribute('aria-label',en()?'Selected files':'선택한 파일');
 input.setAttribute('aria-label',en()?'Reference files':'참고 파일');
 choose.disabled=busy; input.disabled=busy;zone.setAttribute('aria-busy',String(busy));
}
function receive(files) {
 if(busy)return;
 const result=addFiles(selected,Array.from(files));selected=result.files;errors=result.errors;input.value='';render();
}
choose.addEventListener('click',()=>input.click());
input.addEventListener('change',()=>receive(input.files));
zone.addEventListener('dragenter',e=>{e.preventDefault();dragDepth++;if(!busy)zone.classList.add('drag-over');});
zone.addEventListener('dragover',e=>{e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect=busy?'none':'copy';});
zone.addEventListener('dragleave',()=>{dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)zone.classList.remove('drag-over');});
zone.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;zone.classList.remove('drag-over');receive(e.dataTransfer.files);});
document.addEventListener('languagechange',render);
export const attachments={files:()=>[...selected],setBusy(value){busy=value;render();},reset(){selected=[];errors=[];input.value='';render();}};
render();
