import React,{useState} from "react";

export default function ChatProfileCard({person,Avatar,X,onClose}){
 const [photo,setPhoto]=useState(false);
 if(!person)return null;
 const name=person.name||person.client_name||"ALLBEE member";
 const url=person.photo_url||person.client_photo_url||null;
 const role=person.role_label||person.role||person.contact_type||person.apn_id||"ALLBEE member";
 return <>{photo&&url&&<div className="tc-photo-viewer" role="dialog" aria-modal="true" aria-label={`${name} photo`} onClick={()=>setPhoto(false)}><button className="iconbtn tc-photo-viewer-close" aria-label="Close photo" onClick={()=>setPhoto(false)}><X size={20}/></button><div className="tc-photo-viewer-square" onClick={e=>e.stopPropagation()}><img src={url} alt={`${name} profile`}/></div></div>}<div className="tc-profile-overlay" role="dialog" aria-modal="true" aria-label={`${name} profile`} onClick={onClose}><div className="tc-profile-card" onClick={e=>e.stopPropagation()}><button className="iconbtn tc-profile-close" aria-label="Close profile" onClick={onClose}><X size={18}/></button><button type="button" className="tc-profile-photo-trigger" aria-label={`View ${name} photo`} onClick={()=>url&&setPhoto(true)}><Avatar name={name} url={url} size={152} fontSize={46}/></button><h3>{name}</h3><div className="tc-profile-role">{String(role).replace(/_/g," ")}</div>{person.location&&<div className="hint-line">{person.location}</div>}<div className="tc-profile-about"><span>Bio</span><p>{person.bio||"No bio yet."}</p></div></div></div></>;
}
