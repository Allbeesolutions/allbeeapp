import React,{useEffect,useRef,useState} from "react";

export const PROFILE_PHOTO_SIZE=500;
const MIN_ZOOM=1;
const MAX_ZOOM=4;

export function profilePhotoCropGeometry(width,height,zoom=1,offsetX=0,offsetY=0){
  const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1);
  const z=Math.min(MAX_ZOOM,Math.max(MIN_ZOOM,Number(zoom)||1));
  const base=Math.max(PROFILE_PHOTO_SIZE/w,PROFILE_PHOTO_SIZE/h);
  const scale=base*z;
  const maxX=Math.max(0,(w*scale-PROFILE_PHOTO_SIZE)/2);
  const maxY=Math.max(0,(h*scale-PROFILE_PHOTO_SIZE)/2);
  const x=Math.min(maxX,Math.max(-maxX,Number(offsetX)||0));
  const y=Math.min(maxY,Math.max(-maxY,Number(offsetY)||0));
  const sourceSize=PROFILE_PHOTO_SIZE/scale;
  const sx=Math.min(w-sourceSize,Math.max(0,w/2-(PROFILE_PHOTO_SIZE/2+x)/scale));
  const sy=Math.min(h-sourceSize,Math.max(0,h/2-(PROFILE_PHOTO_SIZE/2+y)/scale));
  return {sx,sy,sw:sourceSize,sh:sourceSize,offsetX:x,offsetY:y,scale,zoom:z};
}

async function decodeImage(file){
  if(typeof createImageBitmap==="function"){
    try{return await createImageBitmap(file,{imageOrientation:"from-image"});}catch{/* fallback below */}
  }
  const url=URL.createObjectURL(file);
  try{
    const image=new Image();
    image.decoding="async";
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error("Could not read that image."));image.src=url;});
    return image;
  }finally{URL.revokeObjectURL(url);}
}

function canvasFile(canvas,sourceName){
  return new Promise((resolve,reject)=>{
    canvas.toBlob((blob)=>{
      if(!blob){reject(new Error("Could not create the cropped image."));return;}
      const base=String(sourceName||"profile-photo").replace(/\.[^.]+$/,"").replace(/[^a-z0-9_-]+/gi,"-").slice(0,60)||"profile-photo";
      resolve(new File([blob],`${base}-500x500.webp`,{type:"image/webp",lastModified:Date.now()}));
    },"image/webp",0.9);
  });
}

export default function ProfilePhotoCropper({file,onCancel,onConfirm,title="Crop profile photo"}){
  const canvasRef=useRef(null),imageRef=useRef(null),dragRef=useRef(null);
  const [meta,setMeta]=useState(null),[zoom,setZoom]=useState(1),[offset,setOffset]=useState({x:0,y:0}),[busy,setBusy]=useState(false),[error,setError]=useState("");

  useEffect(()=>{
    let alive=true; let decoded=null;
    setMeta(null);setZoom(1);setOffset({x:0,y:0});setError("");
    decodeImage(file).then((image)=>{decoded=image;if(!alive){image.close?.();return;} imageRef.current=image;setMeta({width:image.width||image.naturalWidth,height:image.height||image.naturalHeight});}).catch((e)=>alive&&setError(e.message||"Could not read that image."));
    return()=>{alive=false;if(imageRef.current===decoded)imageRef.current=null;decoded?.close?.();};
  },[file]);

  useEffect(()=>{
    if(!meta||!imageRef.current||!canvasRef.current)return;
    const g=profilePhotoCropGeometry(meta.width,meta.height,zoom,offset.x,offset.y);
    if(g.offsetX!==offset.x||g.offsetY!==offset.y)setOffset({x:g.offsetX,y:g.offsetY});
    const canvas=canvasRef.current,ctx=canvas.getContext("2d",{alpha:false});
    ctx.save();ctx.fillStyle="#10131a";ctx.fillRect(0,0,PROFILE_PHOTO_SIZE,PROFILE_PHOTO_SIZE);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
    ctx.drawImage(imageRef.current,g.sx,g.sy,g.sw,g.sh,0,0,PROFILE_PHOTO_SIZE,PROFILE_PHOTO_SIZE);ctx.restore();
  },[meta,zoom,offset.x,offset.y]);

  useEffect(()=>{const key=(e)=>{if(e.key==="Escape")onCancel?.();};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);},[onCancel]);

  const moveBy=(dx,dy)=>setOffset((p)=>({x:p.x+dx,y:p.y+dy}));
  const pointerDown=(e)=>{if(!meta)return;e.currentTarget.setPointerCapture?.(e.pointerId);dragRef.current={id:e.pointerId,x:e.clientX,y:e.clientY};};
  const pointerMove=(e)=>{const d=dragRef.current;if(!d||d.id!==e.pointerId)return;const rect=e.currentTarget.getBoundingClientRect();const factor=PROFILE_PHOTO_SIZE/Math.max(1,rect.width);moveBy((e.clientX-d.x)*factor,(e.clientY-d.y)*factor);dragRef.current={id:e.pointerId,x:e.clientX,y:e.clientY};};
  const pointerUp=(e)=>{if(dragRef.current?.id===e.pointerId)dragRef.current=null;};
  const keyMove=(e)=>{const step=e.shiftKey?25:8;if(e.key==="ArrowLeft"){e.preventDefault();moveBy(-step,0)}else if(e.key==="ArrowRight"){e.preventDefault();moveBy(step,0)}else if(e.key==="ArrowUp"){e.preventDefault();moveBy(0,-step)}else if(e.key==="ArrowDown"){e.preventDefault();moveBy(0,step)}};
  const confirm=async()=>{if(!canvasRef.current||!meta||busy)return;setBusy(true);setError("");try{const cropped=await canvasFile(canvasRef.current,file?.name);await onConfirm?.(cropped);}catch(e){setError(e.message||"Could not crop that image.");setBusy(false);}};

  return <div className="profile-crop-overlay" role="dialog" aria-modal="true" aria-labelledby="profile-crop-title">
    <div className="profile-crop-card">
      <div className="profile-crop-head"><div><span className="profile-crop-eyebrow">500 × 500 PX · SQUARE</span><h2 id="profile-crop-title">{title}</h2><p>Drag the photo to position it inside the square. Zoom until it looks right.</p></div><button type="button" className="iconbtn" onClick={onCancel} aria-label="Cancel photo crop">×</button></div>
      <div className="profile-crop-stage" tabIndex={0} aria-label="Profile photo crop area. Drag to reposition or use arrow keys." onKeyDown={keyMove} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
        <canvas ref={canvasRef} width={PROFILE_PHOTO_SIZE} height={PROFILE_PHOTO_SIZE}/>
        <div className="profile-crop-grid" aria-hidden="true"><i/><i/><i/><i/></div>
        {!meta&&!error&&<div className="profile-crop-loading">Preparing image…</div>}
      </div>
      <label className="profile-crop-zoom"><span>Zoom</span><input type="range" min={MIN_ZOOM} max={MAX_ZOOM} step="0.01" value={zoom} onChange={(e)=>setZoom(Number(e.target.value))} disabled={!meta}/><b>{Math.round(zoom*100)}%</b></label>
      <div className="profile-crop-tools"><button className="btn sm" type="button" onClick={()=>{setZoom(1);setOffset({x:0,y:0})}} disabled={!meta||busy}>Reset crop</button><span className="hint-line">Output is always 500 × 500 px.</span></div>
      {error&&<div className="auth-msg err" role="alert">{error}</div>}
      <div className="profile-crop-actions"><button className="btn" type="button" onClick={onCancel} disabled={busy}>Cancel</button><button className="btn primary" type="button" onClick={confirm} disabled={!meta||busy}>{busy?"Applying…":"Use cropped photo"}</button></div>
    </div>
  </div>;
}
