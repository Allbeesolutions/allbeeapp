import React, { useId } from "react";

// The rig reuses the approved pixels. Joint pivots and masks separate the limbs;
// the immutable PNG remains the static/reduced-motion fallback.
export default function AllbeeMascotRig({ artwork }) {
  const id = `allbee-rig-${useId().replace(/:/g, "")}`;
  const url = (part) => `url(#${id}-${part})`;
  const art = `#${id}-art`;
  const leftArm = "M-8 0H327L311 154 250 245 245 292 298 330 307 421 268 447 167 434 68 369-8 286Z";
  const leftHand = "M-8 0H327L311 155 255 236 222 278 163 294 80 280-8 254Z";
  const rightArm = "M920 440L1064 460V745H803L807 580 849 547 895 531Z";
  const rightHand = "M925 523L1059 559V748H803L808 591 849 552Z";
  const mouth = "M537 302C575 321 625 351 683 341C730 339 680 429 607 423C550 421 510 363 524 319C528 307 532 301 537 302Z";
  return <svg className="allbee-mascot-rig" viewBox="-120 -30 1234 1090" focusable="false" aria-hidden="true">
    <defs>
      <image id={`${id}-art`} href={artwork} width="1054" height="990" />
      <clipPath id={`${id}-body`}><path d="M597 0C793-10 930 103 954 296C986 511 817 710 593 714C375 721 236 583 222 380C209 189 279 75 459 20C503 7 555 2 597 0Z" /></clipPath>
      <clipPath id={`${id}-left-arm`}><path d={leftArm} /></clipPath>
      <clipPath id={`${id}-left-hand`}><path d={leftHand} /></clipPath>
      <clipPath id={`${id}-right-arm`}><path d={rightArm} /></clipPath>
      <clipPath id={`${id}-right-hand`}><path d={rightHand} /></clipPath>
      <clipPath id={`${id}-left-leg`}><path d="M418 626L507 650 499 734 523 815 515 999H155V750L312 703 382 669Z" /></clipPath>
      <clipPath id={`${id}-right-leg`}><path d="M621 670L707 674 756 763 894 864 914 999H559V800Z" /></clipPath>
      <clipPath id={`${id}-mouth`}><path d={mouth} /></clipPath>
      <mask id={`${id}-forearm-left`} maskUnits="userSpaceOnUse" x="-60" y="-30" width="1174" height="1090"><rect x="-60" y="-30" width="1174" height="1090" fill="white" /><path d={leftHand} fill="black" /></mask>
      <mask id={`${id}-forearm-right`} maskUnits="userSpaceOnUse" x="-60" y="-30" width="1174" height="1090"><rect x="-60" y="-30" width="1174" height="1090" fill="white" /><path d={rightHand} fill="black" /></mask>
      <mask id={`${id}-face`} maskUnits="userSpaceOnUse" x="-60" y="-30" width="1174" height="1090"><rect x="-60" y="-30" width="1174" height="1090" fill="white" /><path d={mouth} fill="black" /></mask>
      <linearGradient id={`${id}-skin`} x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#f8f8fc" /></linearGradient>
    </defs>
    <g className="allbee-mascot-body">
      <g className="allbee-mascot-leg allbee-mascot-leg--left"><use href={art} clipPath={url("left-leg")} /></g>
      <g className="allbee-mascot-leg allbee-mascot-leg--right"><use href={art} clipPath={url("right-leg")} /></g>
      <g className="allbee-mascot-arm allbee-mascot-arm--left">
        <use href={art} clipPath={url("left-arm")} mask={url("forearm-left")} />
        <g className="allbee-mascot-hand allbee-mascot-hand--left"><use href={art} clipPath={url("left-hand")} /></g>
      </g>
      <g className="allbee-mascot-arm allbee-mascot-arm--right">
        <use href={art} clipPath={url("right-arm")} mask={url("forearm-right")} />
        <g className="allbee-mascot-hand allbee-mascot-hand--right"><use href={art} clipPath={url("right-hand")} /></g>
      </g>
      <g className="allbee-mascot-face">
        <path d={mouth} fill={url("skin")} />
        <use href={art} clipPath={url("body")} mask={url("face")} />
        <g className="allbee-mascot-mouth"><use href={art} clipPath={url("mouth")} /></g>
        <g className="allbee-mascot-eyelid allbee-mascot-eyelid--left">
          <ellipse cx="515" cy="216" rx="73" ry="85" transform="rotate(19 515 216)" fill={url("skin")} />
          <path d="M468 221Q510 257 565 233" fill="none" stroke="#162338" strokeWidth="7" strokeLinecap="round" />
        </g>
        <g className="allbee-mascot-eyelid allbee-mascot-eyelid--right">
          <ellipse cx="750" cy="277" rx="69" ry="77" transform="rotate(19 750 277)" fill={url("skin")} />
          <path d="M708 279Q749 309 793 286" fill="none" stroke="#162338" strokeWidth="7" strokeLinecap="round" />
        </g>
      </g>
    </g>
  </svg>;
}
