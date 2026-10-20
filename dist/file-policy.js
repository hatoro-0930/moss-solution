export const LIMITS = {count:10,each:10*1024*1024,total:20*1024*1024};
export const EXTENSIONS = new Set('pdf png jpg jpeg webp zip txt csv xlsx docx step stp kicad_pcb kicad_sch sch brd pcb pcbdoc schdoc gbr ger drl'.split(' '));
export function addFiles(existing,incoming) {
 const files = [...existing], errors=[];
 for(const file of incoming) {
  const name=file.name, ext=name.split('.').pop().toLowerCase();
  let code;
  if(!EXTENSIONS.has(ext)) code='type';
  else if(file.size===0) code='empty';
  else if(file.size>LIMITS.each) code='size';
  else if(files.some(f=>f.name===name&&f.size===file.size&&f.lastModified===file.lastModified)) code='duplicate';
  else if(files.length>=LIMITS.count) code='count';
  else if(files.reduce((n,f)=>n+f.size,0)+file.size>LIMITS.total) code='total';
  if(code) errors.push({name,code}); else files.push(file);
 }
 return {files,errors};
}
