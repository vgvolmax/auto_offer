export function downloadTextFile(name:string,content:string,mime='text/plain;charset=utf-8') {
  const url=URL.createObjectURL(new Blob([content],{type:mime}));
  const anchor=document.createElement('a');
  anchor.href=url;anchor.download=name;anchor.click();
  URL.revokeObjectURL(url);
}
export function downloadJsonFile(name:string,value:unknown) {
  downloadTextFile(name,`${JSON.stringify(value,null,2)}\n`,'application/json;charset=utf-8');
}
