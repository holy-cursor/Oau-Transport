import { useEffect, useState } from 'react';
import { transport } from '../data/index.js';
import { createRefreshLoop } from '../services/liveRefresh.js';
export default function usePublicMap() {
 const [state,setState]=useState({stops:[],buses:[],loading:true,error:'',updatedAt:null});
 useEffect(()=>{
  let disposed=false;
  const loop=createRefreshLoop(async()=>{
   try{const data=await transport.publicMap();if(!disposed)setState({...data,loading:false,error:'',updatedAt:Date.now()});}
   catch{if(!disposed)setState(previous=>({...previous,loading:false,error:'Live locations are unavailable. Check your connection or try again shortly.'}));}
  },{interval:transport.mode==='demo'?1000:5000});
  const wake=()=>loop.refresh();
  const offline=()=>setState(previous=>({...previous,loading:false,error:'Offline. Showing the last locations.'}));
  loop.refresh();const unsubscribe=transport.subscribe(loop.notify);
  document.addEventListener('visibilitychange',wake);window.addEventListener('online',wake);window.addEventListener('offline',offline);
  return()=>{disposed=true;loop.stop();unsubscribe();document.removeEventListener('visibilitychange',wake);window.removeEventListener('online',wake);window.removeEventListener('offline',offline);};
 },[]);
 return state;
}
