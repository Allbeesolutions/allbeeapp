import React from "react";
import "./allbee.css";

const CONTACT = "hello@allbee.in";

export default function PrivacyPolicy({ mode = "privacy" }) {
  const deletion = mode === "delete";
  return (
    <div className="allbee" data-theme="light" style={{ minHeight: "100vh", padding: "32px 18px" }}>
      <main className="content" style={{ maxWidth: 900, margin: "0 auto" }}>
        <div className="card" style={{ padding: "28px 30px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
            <img src="/icon-192.png" alt="ALLBEE Solutions" width="56" height="56" style={{ borderRadius: 14 }} />
            <div>
              <h1 style={{ margin: 0 }}>ALLBEE Solutions</h1>
              <div className="hint-line">Business management platform</div>
            </div>
          </div>
          {deletion ? <DeletionContent /> : <PrivacyContent />}
        </div>
      </main>
    </div>
  );
}

function DeletionContent() {
  return (
    <>
      <h2>Request account deletion</h2>
      <p>ALLBEE Solutions provides a clear way for account holders to request deletion of their account and associated personal data.</p>
      <ol>
        <li>Send an email to <a href="mailto:hello@allbee.in?subject=ALLBEE%20Account%20Deletion%20Request">hello@allbee.in</a> from the email address associated with your ALLBEE account.</li>
        <li>Use the subject <b>ALLBEE Account Deletion Request</b> and include your name and username, if applicable.</li>
        <li>We will verify the request and remove the account identity and personal data that we are not required to retain.</li>
      </ol>
      <p>Some records may need to be retained where required for legal, accounting, fraud-prevention, security, dispute-resolution, or audit purposes. Retained records are restricted to the purpose for which retention is required.</p>
      <p>For questions about deletion or privacy, contact <a href="mailto:hello@allbee.in">hello@allbee.in</a>.</p>
      <p style={{ marginTop: 24 }}><a href="/privacy-policy">Read the ALLBEE Privacy Policy</a></p>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p><b>Last updated: 6 September 2026</b></p>
      <p>ALLBEE Solutions ("ALLBEE", "we", "us", or "our") operates the ALLBEE Solutions business management platform and its Android/web experience. This policy explains what information we process, why we process it, how we protect it, and the choices available to account holders.</p>

      <h2>1. Information we process</h2>
      <p>Depending on the account type and features used, ALLBEE may process:</p>
      <ul>
        <li><b>Account and profile data:</b> name, email address, username, phone/mobile number, date of birth where required, role, organization information, profile photo, and account status.</li>
        <li><b>Business data:</b> leads, clients, projects, quotations, invoices, tasks, documents, notes, announcements, training records, and related work information entered by authorized users.</li>
        <li><b>Financial data:</b> business income and expenses, payment/withdrawal records, APN commission information, and payout details such as UPI or bank information when an authorized user or partner provides them.</li>
        <li><b>Communications:</b> chat messages, support requests, notifications, feedback, and activity/audit records needed to operate and secure the platform.</li>
        <li><b>Uploaded content:</b> documents, images, PDFs, and other files that users choose to upload for business workflows.</li>
        <li><b>AI and workflow information:</b> prompts, approved workflow inputs, knowledge records, and related outputs where an organization enables those features.</li>
        <li><b>Technical information:</b> information necessary to keep the service secure and functional, such as browser/app environment information and service logs. We do not use the app to sell advertising profiles.</li>
      </ul>

      <h2>2. How we use information</h2>
      <ul>
        <li>Authenticate users and provide role-based access.</li>
        <li>Operate CRM, project, finance, APN, communication, document, training, and administrative workflows.</li>
        <li>Process authorized payments, withdrawals, commissions, and accounting records.</li>
        <li>Send service notifications and security messages when enabled.</li>
        <li>Maintain audit trails, prevent abuse, investigate security incidents, and enforce access controls.</li>
        <li>Improve reliability, performance, accessibility, and business workflows.</li>
        <li>Comply with legal, regulatory, accounting, tax, and contractual obligations.</li>
      </ul>

      <h2>3. Sharing and service providers</h2>
      <p>We do not sell personal information. Information may be processed by service providers that are necessary to operate ALLBEE, such as cloud hosting, database/authentication, storage, deployment, email, notification, and other infrastructure providers. Access is limited to the data and purpose required for the service.</p>
      <p>Information can also be visible to other authorized users within the organization according to their role and permissions. Users should only enter or upload information they are authorized to share.</p>

      <h2>4. Security</h2>
      <p>ALLBEE uses authentication controls, encrypted HTTPS connections, database row-level access controls, role-based authorization, protected storage for sensitive files, audit logging, and security monitoring. No internet service can guarantee absolute security, so users should protect their credentials and report suspected unauthorized access promptly.</p>

      <h2>5. Data retention</h2>
      <p>We retain information for as long as necessary to provide the service, maintain business records, meet contractual or legal obligations, resolve disputes, prevent abuse, and maintain security. Retention periods vary by data type and business requirement.</p>

      <h2>6. Account deletion and data requests</h2>
      <p>Account holders can request deletion through the <a href="/delete-account">account deletion request page</a> or by emailing <a href="mailto:hello@allbee.in">hello@allbee.in</a>. We verify requests before acting on them. Personal data that is not required to be retained will be deleted or anonymized. Records that must be retained for legal, accounting, security, fraud-prevention, dispute, or audit purposes may remain restricted for the applicable retention period.</p>

      <h2>7. Children's privacy</h2>
      <p>ALLBEE is a business management platform and is not directed to children. APN partner registration requires the applicant to meet the applicable minimum age requirement shown in the app.</p>

      <h2>8. Changes to this policy</h2>
      <p>We may update this policy when the service, legal requirements, or data practices change. The latest version will be published at this URL with its updated date.</p>

      <h2>9. Contact</h2>
      <p>Privacy and data questions: <a href="mailto:hello@allbee.in">hello@allbee.in</a></p>
      <p>ALLBEE Solutions</p>
      <p style={{ marginTop: 26 }}><a href="/delete-account">Request account deletion</a></p>
    </>
  );
}
