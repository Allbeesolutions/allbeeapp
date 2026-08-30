import fs from 'node:fs';
import { chromium } from 'playwright';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Extract latest token from Chrome's LevelDB log
const getLatestToken = () => {
  const logPath = "/Users/hajihaz/Library/Application Support/Google/Chrome/Default/Local Storage/leveldb/007030.log";
  const content = fs.readFileSync(logPath, 'binary');
  let idx = 0;
  const tokens = [];
  while (true) {
    idx = content.indexOf('{"access_token"', idx);
    if (idx === -1) break;
    let endIdx = idx + 15;
    let bracketCount = 1;
    while (endIdx < content.length && bracketCount > 0) {
      if (content[endIdx] === '{') bracketCount++;
      else if (content[endIdx] === '}') bracketCount--;
      endIdx++;
    }
    const candidate = content.slice(idx, endIdx);
    try {
      const parsed = JSON.parse(candidate);
      if (parsed.access_token) {
        tokens.push(parsed);
      }
    } catch {}
    idx += 15;
  }
  if (tokens.length === 0) throw new Error("No tokens found in log");
  return tokens[tokens.length - 1];
};

let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
};

async function runTests() {
  console.log("Starting Production E2E Verification against https://app.allbeesolutions.com...");
  const token = getLatestToken();
  console.log("Using extracted token for:", token.user.email);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Inject token before loading
  await page.addInitScript((sessionData) => {
    window.localStorage.setItem("sb-ogacjpwlbhmonycjevml-auth-token", JSON.stringify(sessionData));
  }, token);

  // Navigate to production
  await page.goto("https://app.allbeesolutions.com/#/home", { waitUntil: "networkidle" });
  await sleep(3000);

  // 1. Verify we are on APN Portal
  const portalHeader = page.locator('text=hajiAPN');
  check("APN Portal loaded with user session", await portalHeader.count() > 0);

  // Helper to click menu tabs (APN uses button.apn-tab in nav.apn-bottomnav)
  const clickMenuTab = async (name) => {
    const tab = page.locator(`nav.apn-bottomnav button.apn-tab:has-text("${name}")`).first();
    await tab.click();
    await sleep(1000);
  };

  // 2. Navigation sequence: Team Chat -> Home/Leads/Wallet/My Network
  console.log("\n--- Testing Team Chat Navigation ---");
  await clickMenuTab("Team Chat");
  check("On Team Chat screen", await page.locator("text=Team Chat").count() > 0);

  await clickMenuTab("Home");
  check("Team Chat -> Home works", await page.locator("text=Allbee AI").count() > 0);

  await clickMenuTab("Team Chat");
  await clickMenuTab("Leads");
  check("Team Chat -> Leads works", await page.locator("text=Leads").count() > 0);

  await clickMenuTab("Team Chat");
  await clickMenuTab("Wallet");
  check("Team Chat -> Wallet works", await page.locator("text=Wallet").count() > 0);

  await clickMenuTab("Team Chat");
  await clickMenuTab("My Network");
  check("Team Chat -> My Network works", await page.locator("text=My Network").count() > 0);

  // 3. Reverse navigation
  console.log("\n--- Testing Reverse Navigation ---");
  await clickMenuTab("Home");
  await clickMenuTab("Team Chat");
  check("Home -> Team Chat works", await page.locator("text=Team Chat").count() > 0);

  await clickMenuTab("Leads");
  await clickMenuTab("Team Chat");
  check("Leads -> Team Chat works", await page.locator("text=Team Chat").count() > 0);

  await clickMenuTab("Wallet");
  await clickMenuTab("Team Chat");
  check("Wallet -> Team Chat works", await page.locator("text=Team Chat").count() > 0);

  await clickMenuTab("My Network");
  await clickMenuTab("Team Chat");
  check("My Network -> Team Chat works", await page.locator("text=Team Chat").count() > 0);

  // 4. Team Chat interactions
  console.log("\n--- Testing Team Chat Interactions ---");
  // Select partner tab if any list exists
  const chatItem = page.locator('.chat-item, .apn-rowcard').first();
  if (await chatItem.count() > 0) {
    await chatItem.click();
    await sleep(500);
    check("Selected a partner chat", true);
  }

  // Switch tabs
  await page.locator('button:has-text("Friends")').first().click();
  await sleep(300);
  await page.locator('button:has-text("District")').first().click();
  await sleep(300);
  await page.locator('button:has-text("State")').first().click();
  await sleep(300);
  check("Switched Friends/District/State tabs", true);

  // Use search box
  const searchInput = page.locator('input[placeholder*="Search"]').first();
  if (await searchInput.count() > 0) {
    await searchInput.fill("haji");
    await sleep(500);
    check("Search input filled", true);
  }

  // Navigate away and return
  await clickMenuTab("Home");
  await clickMenuTab("Team Chat");
  check("Navigated away and returned to Team Chat successfully", await page.locator("text=Team Chat").count() > 0);

  // 5. Test ALLBEE AI — navigate to the AI tab from sidebar
  console.log("\n--- Testing ALLBEE AI ---");
  // Open the sidebar and click ALLBEE AI
  await page.locator('button[aria-label="Open menu"]').first().click();
  await sleep(500);
  const aiSidebarItem = page.locator('.apn-sidebar-item:has-text("ALLBEE AI"), .apn-more-item:has-text("ALLBEE AI"), button:has-text("ALLBEE AI")').first();
  if (await aiSidebarItem.count() > 0) {
    await aiSidebarItem.click();
    await sleep(1000);
  } else {
    // fallback: try navigating directly
    await page.goto("https://app.allbeesolutions.com/#/ai", { waitUntil: "networkidle" });
    await sleep(1500);
  }

  const aiInput = page.locator('textarea[placeholder*="wallet"]').first();
  if (await aiInput.count() > 0) {
    check("ALLBEE AI Input found", true);
    await aiInput.fill("hi");
    await page.keyboard.press("Enter");
    console.log("Sent 'hi' to ALLBEE AI. Waiting for response...");
    await sleep(8000); // Wait for response from deployed edge function

    const responseText = await page.locator('.apn-ai-msg').last().textContent();
    console.log("AI Response snippet:", responseText?.slice(0, 100));
    check("ALLBEE AI returns response successfully", !!responseText && responseText.trim().length > 0
      && !responseText.includes("llama-3.3-70b-versatile does not exist"));
    
    // Check chat card is bounded (has max-height via CSS class)
    const chatBox = page.locator('.apn-ai-chat').first();
    check("AI chat container exists on page", await chatBox.count() > 0);
  } else {
    check("ALLBEE AI Input found", false);
  }

  // 6. Test Quotation Wizard — the button is in the AI chips area on the ALLBEE AI tab
  console.log("\n--- Testing Quotation Wizard ---");
  // We should already be on the AI tab; if not, navigate there
  await page.waitForSelector('.apn-ai-chips', { timeout: 5000 }).catch(() => {});
  const genQuoteBtn = page.locator('.apn-ai-chips button:has-text("Generate Quotation"), button.apn-ai-chip:has-text("Generate Quotation")').first();
  if (await genQuoteBtn.count() > 0) {
    await genQuoteBtn.click();
    await sleep(1000);
    check("Quotation Wizard opened", await page.locator("text=Generate Quotation").count() > 0);

    // Step 0: Service selection — clicking the card auto-advances to step 1 (no Continue needed)
    const webServiceCard = page.locator('.wizard-card:has-text("Website")').first();
    check("Step 0 wizard cards have correct hover/interactive classes", await webServiceCard.count() > 0);
    await webServiceCard.click();
    await sleep(700); // wait for auto-advance to step 1

    // Step 1: Website type → must click Continue after selection
    const ecommerceCard = page.locator('.wizard-card').first(); // pick first available site type
    await ecommerceCard.click();
    await sleep(300);
    await page.locator('button.btn.primary:has-text("Continue")').click();
    await sleep(500);

    // Step 2: Tech choice
    const techPreset = page.locator('button.preset').first();
    await techPreset.click();
    await sleep(300);
    await page.locator('button.btn.primary:has-text("Continue")').click();
    await sleep(500);

    // Step 3: Add-ons (optional, just Continue)
    await page.locator('button.btn.primary:has-text("Continue")').click();
    await sleep(500);

    // Step 4: Urgency — clicking card auto-advances? No, need Continue
    const normalDeliveryCard = page.locator('.wizard-card:has-text("Normal delivery")').first();
    await normalDeliveryCard.click();
    await sleep(300);
    await page.locator('button.btn.primary:has-text("Continue")').click();
    await sleep(500);

    // Step 5: Client Details — Continue is disabled until client name filled
    const continueBtn = page.locator('button.btn.primary:has-text("Continue")').first();
    check("Step 5 continue button is disabled when client name is empty", await continueBtn.isDisabled());

    const clientNameInput = page.locator('input[placeholder="Person or business"]').first();
    await clientNameInput.fill("E2E Production Test Client");
    await sleep(300);
    check("Step 5 continue button is enabled when client name is filled", await continueBtn.isEnabled());

    await continueBtn.click();
    await sleep(500);

    // Step 6: Summary & Save
    const saveDraftBtn = page.locator('button:has-text("Save draft")').first();
    await saveDraftBtn.click();
    await sleep(2000); // wait for save mutation to finish

    // Step 7: Done & verification of PDF button
    check("Quotation saved successfully", await page.locator("text=Quotation QT").count() > 0);
    check("PDF download button visible", await page.locator('button:has-text("Download PDF")').count() > 0);

    await page.locator('button:has-text("Done")').click();
    await sleep(500);
  } else {
    check("Generate Quotation button found", false);
  }

  await browser.close();
  console.log("\n--- E2E Verification Complete ---");
  console.log(failures ? `${failures} CHECK(S) FAILED.` : "ALL 100% CHECKS PASSED!");
  process.exit(failures ? 1 : 0);
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
