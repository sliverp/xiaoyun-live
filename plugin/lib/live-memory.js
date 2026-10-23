/** Keep only aired notes from the current page; comment payloads never become durable model memory. */
export function createLiveMemory(){
  let pageKey='',notes=[],outline=[]
  const setPage=key=>{if(key!==pageKey){pageKey=key;notes=[];outline=[]}}
  const record=(key,text)=>{setPage(key);notes.push(String(text).slice(0,220));notes=notes.slice(-4);const point=String(text).split(/[。！？!?]/)[0].slice(0,60);if(point&&outline.at(-1)!==point)outline.push(point);outline=outline.slice(-32)}
  const clear=()=>{pageKey='';notes=[];outline=[]}
  const status=()=>({pageKey,notes:notes.slice(),outline:outline.slice(),characters:notes.join('').length+outline.join('').length})
  return {setPage,record,clear,status}
}
