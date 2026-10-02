import React,{useEffect,useRef,useState} from "react";
import {normalizeChatPerson} from "../identity/chatIdentity.js";
import "./team-chat.css";

export default function ChatProfileCard({person,Avatar,X,onClose}){
 const p=normalizeChatPerson(person);
 const [photo,setPhoto]=useState(false),[photoFailed,setPhotoFailed]=useState(false);
 const dialogRef=useRef(null),closeRef=useRef(onClose);closeRef.current=onClose;
 useEffect(()=>{
   const previous=document.activeElement,overflow=document.body.style.overflow;
   document.body.style.overflow="hidden";
   return()=>{document.body.style.overflow=overflow;previous?.focus?.()};
 },[]);
 useEffect(()=>{
   const dialog=dialogRef.current;
   dialog?.querySelector("button")?.focus();
   const key=e=>{
     if(e.key==="Escape"){e.preventDefault();e.stopPropagation();photo?setPhoto(false):closeRef.current?.();return}
     if(e.key!=="Tab")return;
     const controls=[...dialog.querySelectorAll("button:not(:disabled),a[href],input,textarea,[tabindex='0']")];
     const first=controls[0],last=controls.at(-1);
     if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}
     else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
   };
   document.addEventListener("keydown",key,true);return()=>document.removeEventListener("keydown",key,true);
 },[photo]);
 if(!person)return null;
 if(photo&&p.photo_url)return <div ref={dialogRef} className="tc-photo-viewer" role="dialog" aria-modal="true" aria-label={`${p.name} photo`} onClick={()=>setPhoto(false)}>
   <button type="button" className="iconbtn tc-photo-viewer-close" aria-label="Close photo" onClick={()=>setPhoto(false)}><X size={20}/></button>
   <div className="tc-photo-viewer-square" onClick={e=>e.stopPropagation()}>{photoFailed?<p role="alert">This photo could not load. Close the viewer and try again.</p>:<img src={p.photo_url} alt={`${p.name} profile`} onError={()=>setPhotoFailed(true)}/>}</div>
 </div>;
 return <div ref={dialogRef} className="tc-profile-overlay" role="dialog" aria-modal="true" aria-label={`${p.name} profile`} onClick={onClose}>
  <div className="tc-profile-card" onClick={e=>e.stopPropagation()}>
   <button type="button" className="iconbtn tc-profile-close" aria-label="Close profile" onClick={onClose}><X size={18}/></button>
   <button type="button" className="tc-profile-photo-trigger" disabled={!p.photo_url} aria-label={`View ${p.name} photo`} onClick={()=>{setPhotoFailed(false);setPhoto(true)}}><Avatar name={p.name} url={p.photo_url} size={152} fontSize={46}/></button>
   <h3>{p.name}</h3><div className="tc-profile-role">{String(p.role_label).replaceAll("_"," ")}</div>
   {p.location&&<div className="hint-line">{p.location}</div>}
   <div className="tc-profile-about"><span>Bio</span><p>{p.bio||"No bio yet."}</p></div>
  </div>
 </div>;
}
