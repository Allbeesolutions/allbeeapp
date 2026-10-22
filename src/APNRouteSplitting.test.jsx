import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const app=readFileSync("src/AllbeeApp.jsx","utf8");

describe("APN route-level code splitting contract",()=>{
  for(const [name,file] of [
    ["APNInactive","Inactive"],
    ["APNCheckIn","AttendanceCheckIn"],
    ["APNBankDetails","BankDetails"],
    ["APNHeadPartnerCard","HeadPartnerCard"],
  ]){
    it(`lazy loads ${name} from ${file}`,()=>{
      expect(app).toMatch(new RegExp(`const ${name} = React\\.lazy\\(\\(\\) => import\\("\\./modules/apn/[^"]*/?${file}\\.jsx"\\)`));
      expect(app).not.toContain(`import { ${name} } from`);
    });
  }
  it("keeps an APN tab Suspense boundary to handle async route components",()=>{
    expect(app).toContain('<React.Suspense fallback={<APNSkeleton />}>');
    expect(app).toContain('<SafePageRenderer renderPage={section}/>');
    expect(app).toContain('<APNTabErrorBoundary key={tab}>');
    expect(app).toContain('<React.Suspense fallback={<APNSkeleton />}><APNInactive');
  });
});
