import React, { useMemo, useState } from "react";

export default function APNLeadForm({ meRow, db, initial, onSave, onClose, runtime = {} }) {
  const { APN_SERVICES, Field, SelectOther, Empty, Modal, SearchableSelect, supabase, emitToast, todayISO } = runtime;
  const unlocked = apnUnlocked(meRow);
  const enabled = APN_SERVICES.filter(([k]) => unlocked[k]);
  const [f, setF] = useState(() => ({ clientName: "", mobile: "", business: "", service: enabled[0]?.[0] || "", budget: "", college: "", tieUp: "", notes: "", ...initial }));
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  const rules = apnFormRules(f.service);
  const save = () => {
    if (!enabled.length) { setErr("Pass a sales quiz first to unlock lead submission."); return; }
    if (!f.clientName.trim()) { setErr("Client name is required."); return; }
    if (!f.mobile.trim()) { setErr("Client mobile number is required."); return; }
    if (!f.service) { setErr("Choose the service required."); return; }
    const nums = (db.apn_leads || []).map((l) => Number(String(l.leadId || "").replace(/\D/g, "")) || 0);
    const n = (nums.length ? Math.max(...nums) : 0) + 1;
    onSave({ id: uid(), leadId: apnLeadId(n), partnerId: meRow.id, partnerName: meRow.name, clientName: f.clientName.trim(), mobile: f.mobile.trim(), business: String(f.business || "").trim(), service: f.service, budget: String(f.budget || "").trim(), college: String(f.college || "").trim(), tieUp: f.tieUp || "", tieUpReciprocal: false, notes: f.notes.trim(), status: "Submitted", createdAt: Date.now() });
    onClose();
  };
  return (
    <Modal title="Submit a lead" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save} disabled={!enabled.length}><Send size={15} />Submit lead</button></>}>
      {!enabled.length && <div className="banner" style={{ margin: "0 0 12px" }}><AlertTriangle size={15} />Complete a training quiz to unlock lead submission.</div>}
      <Field label="Client name" required error={err}><input className="input" value={f.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="Client's name" /></Field>
      <div className="grid2">
        <Field label="Mobile number" required><input className="input" value={f.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="10-digit mobile" /></Field>
        <Field label={rules.showBusiness ? "Business name" : "College / campus"}><input className="input" value={rules.showBusiness ? f.business : f.college} onChange={(e) => set(rules.showBusiness ? "business" : "college", e.target.value)} placeholder={rules.showBusiness ? "Business / shop" : "College / campus"} /></Field>
      </div>
      <Field label="Service required" required>
        <select className="select" value={f.service} onChange={(e) => set("service", e.target.value)}>
          {enabled.length ? enabled.map(([k, l]) => <option key={k} value={k}>{l}</option>) : <option value="">No services unlocked yet</option>}
        </select>
      </Field>
      {rules.showBudget && <Field label="Expected budget"><input className="input mono" value={f.budget} onChange={(e) => set("budget", e.target.value)} placeholder="Approximate budget (₹)" /></Field>}
      {rules.showTieUps && (
        <Field label="Tie-up with the client" hint="Mark an express tie-up — when the client works with ALLBEE on the other side of the deal both sides govern the relationship.">
          <select className="select" value={f.tieUp} onChange={(e) => set("tieUp", e.target.value)}>
            <option value="">No tie-up</option>
            {(APN_TIEUPS[f.service] || []).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      )}
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything useful about the lead…" /></Field>
    </Modal>
  );
}
/* ── quotations ──────────────────────────────────────────────────────── */
  const QUOTE_CATALOG = {
  website: {
    base: 15000, baseLabel: "Website (starter)",
    options: [
      { key: "ecommerce", label: "E-commerce store", amount: 12000 },
      { key: "seo", label: "SEO setup", amount: 5000 },
      { key: "extra", label: "Extra pages / sections", amount: 4000 },
      { key: "maintenance", label: "Annual maintenance (per year)", amount: 6000 },
    ],
  },
  marketing: {
    base: 8000, baseLabel: "Digital marketing (monthly)",
    options: [
      { key: "ads", label: "Paid ad management (monthly)", amount: 5000 },
      { key: "content", label: "Content creation (monthly)", amount: 4000 },
      { key: "social", label: "Social media handling (monthly)", amount: 3000 },
    ],
  },
  course: {
    base: 5000, baseLabel: "Course admission",
    options: [
      { key: "advanced", label: "Advanced module", amount: 3000 },
      { key: "certification", label: "Certification", amount: 1500 },
    ],
  },
};
const QUOTE_BUSINESS_EMAIL = { key: "business_email", label: "Business Email (per year)", amount: 999 };
const QUOTE_URGENT_RATE = 0.10;
const QUOTE_SITE_TYPES = [
  ["static", "Static website", "Standard pages — the Starter website."],
  ["dynamic", "Dynamic website", "Custom pages, modules and content management."],
  ["ecommerce", "E-commerce", "Online store with cart, checkout and payments."],
  ["custom", "Custom build", "Built from scratch to the client's exact scope."],
];
const QUOTE_TECHS = ["React", "HTML-CSS or WordPress", "PHP", ".NET", "No Preference"];
const QUOTE_STEP_LABELS = ["Service", "Type", "Technology", "Add-ons", "Urgency", "Client", "Summary"];
const QUOTE_DISCLAIMER = "This is an AllBee partner network's estimated quotation. Final pricing is confirmed by the ALLBEE sales team after scope review.";
const QUOTE_SERVICE_LABEL = { website: "Website Development", marketing: "Digital Marketing", course: "Course Admission" };

// Share a quotation over email or WhatsApp — a plain-text summary (line items
// + total) since attachments need a server; the sender can attach the PDF
// they just downloaded.
const quoteShareText = (q) => {
  const lines = (q.items || []).map((it) => `• ${it.label}: ${it.amount == null ? "to be confirmed" : money(it.amount)}`).join("\n");
  return `Quotation ${q.quoteNo || ""} — ${q.clientName || "Client"}\n${QUOTE_SERVICE_LABEL[q.service] || q.service || ""}${lines ? `\n\n${lines}` : ""}\nTotal: ${money(q.total)}\n\n${QUOTE_DISCLAIMER}`;
};
const shareQuoteVia = (q, via) => {
  const text = quoteShareText(q);
  if (via === "whatsapp") {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  if (typeof window !== "undefined") {
    window.location.href = `mailto:?subject=${encodeURIComponent(`Quotation ${q.quoteNo || ""} — ${q.clientName || "Client"}`)}&body=${encodeURIComponent(text)}`;
  }
};

async function downloadQuotePdf(q, meRow) {
  const addWorkingDays = (startDate, days) => {
    let date = new Date(startDate);
    let count = 0;
    while (count < days) {
      date.setDate(date.getDate() + 1);
      const day = date.getDay();
      if (day !== 0 && day !== 6) { // 0 = Sunday, 6 = Saturday
        count++;
      }
    }
    return date;
  };

  try {
    const { jsPDF, autoTable } = await loadPdfEngine();
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const inr = (n) => pdfSafe("Rs. " + (Number(n) || 0).toLocaleString("en-IN"));

    // Header drawing helper — use the supplied ALLBEE logo asset and brand blue.
    let quoteLogoData = null;
    try {
      const logoResponse = await fetch("/allbee-quotation-logo.png");
      if (logoResponse.ok) {
        const logoBlob = await logoResponse.blob();
        quoteLogoData = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(logoBlob);
        });
      }
    } catch (logoError) {
      console.warn("Quotation logo could not be loaded; using text fallback.", logoError);
    }

    const drawHeader = (pageDoc) => {
      const logoX = W / 2;
      if (quoteLogoData) {
        pageDoc.addImage(quoteLogoData, "PNG", logoX - 22, 28, 44, 44, undefined, "FAST");
      } else {
        pageDoc.setFillColor(112, 176, 210);
        pageDoc.circle(logoX, 48, 14, "F");
        pageDoc.setTextColor(255);
        pageDoc.setFont("helvetica", "bold"); pageDoc.setFontSize(12);
        pageDoc.text("AB", logoX, 52, { align: "center" });
      }

      // Company Name
      pageDoc.setFont("helvetica", "bold"); pageDoc.setFontSize(14); pageDoc.setTextColor(112, 176, 210);
      pageDoc.text("ALLBEE SOLUTIONS", logoX, 76, { align: "center" });

      // Tagline
      pageDoc.setFont("helvetica", "normal"); pageDoc.setFontSize(7.5); pageDoc.setTextColor(100, 110, 130);
      pageDoc.text("DIGITAL MARKETING & IT SOLUTIONS", logoX, 88, { align: "center" });

      // Elegant divider accent line
      pageDoc.setDrawColor(112, 176, 210); pageDoc.setLineWidth(1);
      pageDoc.line(W/2 - 60, 96, W/2 + 60, 96);
    };

    // Footer drawing helper (recreates letterhead contact layout natively)
    const drawFooter = (pageDoc, pageNum, totalPages) => {
      // Bottom divider line
      pageDoc.setDrawColor(226, 232, 240); pageDoc.setLineWidth(1);
      pageDoc.line(45, 775, W - 45, 775);

      // Contact details
      pageDoc.setFont("helvetica", "normal"); pageDoc.setFontSize(8.5); pageDoc.setTextColor(74, 85, 104);
      pageDoc.text("+91 7904082982  ·  allbeesolutions@gmail.com  ·  www.allbeesolutions.com", W / 2, 792, { align: "center" });
      pageDoc.text("No. 80 Noori Complex, Nagore Main Road, Nagore - 611002", W / 2, 806, { align: "center" });

      // Watermark
      pageDoc.setFont("helvetica", "normal"); pageDoc.setFontSize(7.5); pageDoc.setTextColor(160, 174, 192);
      pageDoc.text("Generated by the ALLBEE APN quotation assistant.", 45, 765);

      // Dynamic page numbering
      pageDoc.text(`Page ${pageNum} of ${totalPages}`, W - 45, 765, { align: "right" });
    };

    // --- Page 1 Content Layout ---

    // Title Section
    let y = 132;
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(112, 176, 210);
    doc.text("QUOTATION", W / 2, y, { align: "center" });

    // Quote Meta (Date & ID on the same row)
    y += 18;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(113, 128, 150);
    doc.text(pdfSafe(`Quotation No: ${q.quoteNo || ""}`), 45, y);
    doc.text(pdfSafe(`Date: ${q.createdAt ? fmtDate(new Date(q.createdAt)) : fmtDate(new Date())}`), W - 45, y, { align: "right" });

    // Header divider line
    y += 8;
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(1);
    doc.line(45, y, W - 45, y);

    // Columns: Prepared For vs Prepared By
    y += 16;

    // Left Box: Client details card
    doc.setFillColor(248, 250, 252);
    doc.rect(45, y, 240, 72, "F");
    doc.setFillColor(112, 176, 210);
    doc.rect(45, y, 3, 72, "F"); // brand color bar

    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(112, 176, 210);
    doc.text("PREPARED FOR", 58, y + 16);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(26, 32, 44);
    doc.text(pdfSafe(q.clientName || "Client"), 58, y + 32);

    let clientY = y + 46;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(74, 85, 104);
    if (q.business) { doc.text(pdfSafe(q.business), 58, clientY); clientY += 12; }
    if (q.contact) { doc.text(pdfSafe(q.contact), 58, clientY); clientY += 12; }

    // Right Box: Partner details card
    doc.setFillColor(248, 250, 252);
    doc.rect(310, y, 240, 72, "F");
    doc.setFillColor(112, 176, 210);
    doc.rect(310, y, 3, 72, "F"); // brand color bar

    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(112, 176, 210);
    doc.text("PREPARED BY", 323, y + 16);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(26, 32, 44);
    doc.text(pdfSafe(meRow?.name || "APN Partner"), 323, y + 32);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(74, 85, 104);
    doc.text(pdfSafe(`ID: ${meRow?.apnId || ""}`), 323, y + 46);
    doc.text(pdfSafe(`Service: ${QUOTE_SERVICE_LABEL[q.service] || q.service || ""}`), 323, y + 59);

    // Project Overview Section
    let overviewY = y + 72 + 15;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(112, 176, 210);
    doc.text("PROJECT OVERVIEW", 45, overviewY + 12);
    doc.setDrawColor(226, 232, 240);
    doc.line(45, overviewY + 18, W - 45, overviewY + 18);

    doc.setFont("helvetica", "normal"); doc.setFontSize(9);

    // Left Grid
    doc.setTextColor(113, 128, 150); doc.text("Project:", 50, overviewY + 32);
    doc.setFont("helvetica", "bold"); doc.setTextColor(26, 32, 44); doc.text(pdfSafe(QUOTE_SERVICE_LABEL[q.service] || q.service || ""), 140, overviewY + 32);

    doc.setFont("helvetica", "normal"); doc.setTextColor(113, 128, 150); doc.text("Package Type:", 50, overviewY + 46);
    doc.setFont("helvetica", "bold"); doc.setTextColor(26, 32, 44); doc.text(pdfSafe(q.siteType ? (QUOTE_SITE_TYPES.find(([k]) => k === q.siteType)?.[1] || q.siteType) : "Starter Package"), 140, overviewY + 46);

    doc.setFont("helvetica", "normal"); doc.setTextColor(113, 128, 150); doc.text("Tech Preference:", 50, overviewY + 60);
    doc.setFont("helvetica", "bold"); doc.setTextColor(26, 32, 44); doc.text(pdfSafe(q.tech || "No Preference"), 140, overviewY + 60);

    // Right Grid
    const rightColX = 320;
    doc.setFont("helvetica", "normal"); doc.setTextColor(113, 128, 150); doc.text("Quotation Validity:", rightColX, overviewY + 32);
    doc.setFont("helvetica", "bold"); doc.setTextColor(26, 32, 44); doc.text("30 Days", rightColX + 110, overviewY + 32);

    doc.setFont("helvetica", "normal"); doc.setTextColor(113, 128, 150); doc.text("Est. Duration:", rightColX, overviewY + 46);
    doc.setFont("helvetica", "bold"); doc.setTextColor(26, 32, 44);

    const minDays = q.catalogSnapshot?.deliveryMin ?? 10;
    const maxDays = q.catalogSnapshot?.deliveryMax ?? 15;
    const durationText = minDays === 0 ? "Ongoing retainer" : `${minDays}-${maxDays} working days`;
    doc.text(pdfSafe(durationText), rightColX + 110, overviewY + 46);

    // Calculate dynamic expected delivery dates excluding weekends
    const startDate = q.createdAt ? new Date(q.createdAt) : new Date();
    let expectedDelText = "Ongoing retainer";
    if (minDays > 0) {
      const dateMin = fmtDate(addWorkingDays(startDate, minDays));
      const dateMax = fmtDate(addWorkingDays(startDate, maxDays));
      expectedDelText = `${dateMin} to ${dateMax}`;
    }

    doc.setFont("helvetica", "normal"); doc.setTextColor(113, 128, 150); doc.text("Expected Delivery:", rightColX, overviewY + 60);
    doc.setFont("helvetica", "bold"); doc.setTextColor(26, 32, 44); doc.text(pdfSafe(expectedDelText), rightColX + 110, overviewY + 60);

    // Scope & Description Section
    let nextSectionY = overviewY + 74;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(112, 176, 210);
    doc.text("SCOPE OF WORK & DETAILS", 45, nextSectionY + 12);
    doc.setDrawColor(226, 232, 240);
    doc.line(45, nextSectionY + 18, W - 45, nextSectionY + 18);

    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(74, 85, 104);
    const scopeLines = doc.splitTextToSize(pdfSafe(q.requirements || "Standard website build and delivery matching client specifications."), W - 100);
    doc.text(scopeLines, 50, nextSectionY + 32);

    let inclusionsY = nextSectionY + 32 + scopeLines.length * 13 + 12;

    // Inclusions Checklist (For Website development or any package with features)
    let startTableY = inclusionsY;
    const featuresList = q.catalogSnapshot?.features || [];
    if (q.service === "website" || featuresList.length > 0) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(112, 176, 210);
      doc.text("PACKAGE INCLUDES", 45, inclusionsY);

      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(74, 85, 104);
      let inclusions = [];
      if (featuresList.length > 0) {
        inclusions = featuresList.map((f) => `✓ ${f.name}`);
      } else {
        inclusions = [
          "✓ Up to 5 website pages",
          "✓ Responsive design (Mobile/Tablet/Desktop)",
          "✓ Basic business website structure",
          "✓ Contact / enquiry submission form",
          "✓ Basic SEO-friendly structure",
          "✓ SSL Certificate / HTTPS setup",
          "✓ Website deployment",
          "✓ Support for 15 days (Post Delivery)"
        ];
      }

      for (let idx = 0; idx < inclusions.length; idx++) {
        const colIdx = idx % 2;
        const rowIdx = Math.floor(idx / 2);
        const itemX = colIdx === 0 ? 50 : 300;
        const itemY = inclusionsY + 14 + rowIdx * 14;
        doc.text(inclusions[idx], itemX, itemY);
      }

      startTableY = inclusionsY + 14 + Math.ceil(inclusions.length / 2) * 14 + 18;
    }

    // Dynamic 4-column detailed commercial rows building
    const tableRows = [];
    if (q.catalogSnapshot) {
      let index = 1;
      for (const it of (q.items || [])) {
        let details = "Service requirement / package item";
        if (it.label.toLowerCase().includes("domain")) details = "Approx. subject to name availability & extension";
        else if (it.label.toLowerCase().includes("hosting")) details = "Standard web hosting package for 1 year";
        else if (it.label.toLowerCase().includes("ssl")) details = "SSL Certificate (HTTPS) configuration & setup";
        else if (it.isBase) details = q.catalogSnapshot.packageDesc || "Base package development";
        else details = "Additional custom requirement / addon";

        tableRows.push([
          String(index++),
          pdfSafe(it.label),
          pdfSafe(details),
          it.amount == null ? "Quote on request" : inr(it.amount)
        ]);
      }
    } else if (q.service === "website") {
      const baseItem = (q.items || []).find((it) => it.label.toLowerCase().includes("website") || it.label.toLowerCase().includes("base") || it.label.toLowerCase().includes("starter"));
      const baseAmount = baseItem ? baseItem.amount : (q.subtotal || 0);

      tableRows.push([
        "1",
        "Website Design & Development",
        pdfSafe(baseItem?.label || "Starter static website — up to 5 pages"),
        baseAmount != null ? inr(baseAmount) : "Quote on request"
      ]);
      tableRows.push([
        "2",
        "Domain Registration (1 Year)",
        "Approx. subject to name availability & extension",
        "Included*"
      ]);
      tableRows.push([
        "3",
        "Web Hosting (1 Year)",
        "Standard web hosting package for 1 year",
        "Included"
      ]);
      tableRows.push([
        "4",
        "SSL Certificate & Security",
        "SSL Certificate (HTTPS) configuration & setup",
        "Included"
      ]);

      const otherItems = (q.items || []).filter((it) => it.id !== baseItem?.id && !it.label.toLowerCase().includes("starter"));
      let index = 5;
      for (const it of otherItems) {
        tableRows.push([
          String(index++),
          pdfSafe(it.label),
          "Additional custom requirement / addon",
          it.amount == null ? "Quote on request" : inr(it.amount)
        ]);
      }
    } else {
      let index = 1;
      for (const it of (q.items || [])) {
        tableRows.push([
          String(index++),
          pdfSafe(it.label),
          "Service requirement / package item",
          it.amount == null ? "Quote on request" : inr(it.amount)
        ]);
      }
    }

    // Striped 4-Column Commercial Breakdown Table
    autoTable(doc, {
      startY: startTableY,
      head: [["S.No.", "ITEM / DESCRIPTION", "DETAILS", "AMOUNT"]],
      body: tableRows,
      theme: "striped",
      styles: {
        fontSize: 9,
        cellPadding: { top: 8, bottom: 8, left: 10, right: 10 },
        textColor: [45, 55, 72],
        font: "helvetica",
        lineColor: [226, 232, 240],
        lineWidth: 0.5
      },
      headStyles: {
        fillColor: [112, 176, 210],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
        halign: "left",
        valign: "middle"
      },
      columnStyles: {
        0: { halign: "center", fontStyle: "normal", width: 40 },
        1: { halign: "left", fontStyle: "bold", width: 140 },
        2: { halign: "left", fontStyle: "normal", width: 220 },
        3: { halign: "right", fontStyle: "bold", textColor: [26, 32, 44], width: 100 }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: 45, right: 45, top: 120, bottom: 90 }
    });

    let tailY = doc.lastAutoTable.finalY + 18;

    // Show domain disclaimer if relevant right below table
    if (q.service === "website") {
      doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(113, 128, 150);
      doc.text("* Domain charges are approximate and subject to domain-name availability and the selected extension (.com, .in, etc.).", 45, tailY);
      tailY += 16;
    }

    // Spacing guard to keep totals block and notes block together
    if (tailY > 660) {
      doc.addPage();
      tailY = 130;
    }

    // Totals Section
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(74, 85, 104);
    doc.text("Subtotal", W - 180, tailY, { align: "right" });
    doc.setFont("helvetica", "bold"); doc.setTextColor(26, 32, 44);
    doc.text(inr(q.subtotal ?? (q.items || []).reduce((s, it) => s + (Number(it.amount) || 0), 0)), W - 45, tailY, { align: "right" });

    if (q.urgent) {
      tailY += 16;
      doc.setFont("helvetica", "normal"); doc.setTextColor(74, 85, 104);
      doc.text("Urgent Delivery Surcharge (+10%)", W - 180, tailY, { align: "right" });
      doc.setFont("helvetica", "bold"); doc.setTextColor(229, 62, 62);
      doc.text(inr(Math.round((q.subtotal || 0) * QUOTE_URGENT_RATE)), W - 45, tailY, { align: "right" });
    }

    tailY += 22;
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(1.5);
    doc.line(W - 220, tailY - 12, W - 45, tailY - 12);

    doc.setFont("helvetica", "bold"); doc.setFontSize(11.5); doc.setTextColor(112, 176, 210);
    doc.text("TOTAL AMOUNT", W - 180, tailY, { align: "right" });
    doc.text(inr(q.total || 0), W - 45, tailY, { align: "right" });

    // Terms & Notes Box
    let noteY = tailY + 28;
    if (noteY > 640) {
      doc.addPage();
      noteY = 130;
    }

    doc.setFillColor(248, 250, 252);
    doc.rect(45, noteY, W - 90, 80, "F");
    doc.setFillColor(112, 176, 210);
    doc.rect(45, noteY, 3, 80, "F"); // brand left highlight

    // Payment Terms (Left column of the box)
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(112, 176, 210);
    doc.text("PAYMENT TERMS", 60, noteY + 18);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(74, 85, 104);
    const paymentTermsText = q.catalogSnapshot?.paymentTerms?.description || "50% advance at project start,\n50% on final delivery.";
    doc.text(paymentTermsText, 60, noteY + 32);

    // Disclaimer / Notes (Right column of the box)
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(112, 176, 210);
    doc.text("IMPORTANT NOTES", 295, noteY + 18);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(113, 128, 150);
    const discLines = doc.splitTextToSize(pdfSafe(q.catalogSnapshot?.disclaimer || QUOTE_DISCLAIMER), 240);
    doc.text(discLines, 295, noteY + 32);

    // --- Post-Generation Header & Footer Pages Drawing Loop ---
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawHeader(doc);
      drawFooter(doc, i, totalPages);
    }

    // Save PDF file
    doc.save(`allbee-quotation-${(q.clientName || "client").replace(/[^\w-]+/g, "-").slice(0, 24)}-${todayISO()}.pdf`);
  } catch (e) {
    console.error(e);
    emitToast("Couldn't build the PDF file — check your connection and try again.", "error");
  }
}
