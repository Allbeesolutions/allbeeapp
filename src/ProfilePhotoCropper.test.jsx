import {describe,expect,it} from "vitest";
import fs from "node:fs";
import path from "node:path";
import {PROFILE_PHOTO_SIZE,profilePhotoCropGeometry} from "./ui/ProfilePhotoCropper.jsx";

const read=(file)=>fs.readFileSync(path.join(process.cwd(),"src",file),"utf8");

describe("profile photo crop contract",()=>{
  it("always targets a 500px square output",()=>{
    expect(PROFILE_PHOTO_SIZE).toBe(500);
    const landscape=profilePhotoCropGeometry(1600,900,1,0,0);
    expect(landscape.sw).toBeCloseTo(900);
    expect(landscape.sh).toBeCloseTo(900);
    expect(landscape.sx).toBeCloseTo(350);
    expect(landscape.sy).toBeCloseTo(0);
    const portrait=profilePhotoCropGeometry(900,1600,1,0,0);
    expect(portrait.sw).toBeCloseTo(900);
    expect(portrait.sh).toBeCloseTo(900);
    expect(portrait.sx).toBeCloseTo(0);
    expect(portrait.sy).toBeCloseTo(350);
  });

  it("clamps drag offsets so the crop never exposes empty pixels",()=>{
    const g=profilePhotoCropGeometry(1600,900,1,99999,-99999);
    expect(g.sx).toBeGreaterThanOrEqual(0);
    expect(g.sy).toBeGreaterThanOrEqual(0);
    expect(g.sx+g.sw).toBeLessThanOrEqual(1600.0001);
    expect(g.sy+g.sh).toBeLessThanOrEqual(900.0001);
  });

  it("requires the shared cropper on every live DP upload surface",()=>{
    const app=read("AllbeeApp.jsx");
    const client=read("ClientPortal.jsx");
    const apn=read("APNProfile.jsx");
    expect(app).toContain('LazyProfilePhotoCropper = React.lazy(() => import("./ui/ProfilePhotoCropper.jsx"))');
    expect(app.match(/<LazyProfilePhotoCropper/g)?.length).toBeGreaterThanOrEqual(2); // onboarding + internal profile
    expect(client).toContain('ProfilePhotoCropper from "./ui/ProfilePhotoCropper.jsx"');
    expect(client).toContain("applyClientCroppedPhoto");
    expect(apn).toContain('ProfilePhotoCropper from "./ui/ProfilePhotoCropper.jsx"');
    expect(apn).toContain("applyCroppedPhoto");
  });

  it("does not upload immediately from the file-picker handlers",()=>{
    const app=read("AllbeeApp.jsx");
    const client=read("ClientPortal.jsx");
    const apn=read("APNProfile.jsx");
    expect(client).toContain("setCropFile(file)");
    expect(apn).toContain("setCropFile(file)");
    expect(app).toContain("setCropFile(file)");
    expect(read("ui/ProfilePhotoCropper.jsx")).toContain('new File([blob],`${base}-500x500.webp`');
  });
});
