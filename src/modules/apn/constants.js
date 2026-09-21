// Static APN portal configuration. Runtime calculations remain in AllbeeApp.

export const APN_ID_PREFIX = "APN-TN-";
export const APN_RESERVED_NUMBERS = new Set([2, 3]);
export const APN_MIN_DYNAMIC_NUMBER = 6;
export const TN_DISTRICTS = ["Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kancheepuram", "Kanniyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar"];
export const APN_SERVICES = [["website", "Website Development"], ["marketing", "Digital Marketing"], ["course", "Course Admission"]];
export const APN_SERVICE_LABEL = { website: "Website", marketing: "Digital marketing", course: "Course" };
export const APN_ADMIN_LEVELS = ["Trainee", "Partner", "Senior Partner", "District Head", "State Head"];
export const APN_ADMIN_STATUSES = ["pending", "active", "inactive", "suspended", "deleted"];
export const APN_PERCENT_MIN = 0;
export const APN_PERCENT_MAX = 100;
export const APN_SUSPEND_REASONS = ["Spam", "Fake Leads", "Policy Violation", "Requested by Admin", "Other"];
export const APN_WARNING_TYPES = ["Poor Lead Quality", "Fake Information", "Customer Complaint", "Spam Behaviour", "Policy Violation", "Inactivity", "Other"];
export const APN_REACTIVATION_REASONS = ["Training Completed", "Investigation Closed", "Admin Decision", "Mistaken Suspension", "Other"];
export const APN_TAG_OPTIONS = ["Website Expert", "Software Sales", "High Performer", "New Partner", "Needs Training", "Premium Partner", "Follow-up Required", "Top Closer"];
export const APN_DOCUMENT_TYPES = ["Aadhaar", "PAN", "Bank Passbook", "Photo", "Agreement", "Certificate", "Other"];
export const APN_COMMUNICATION_TYPES = ["Notification", "Email", "WhatsApp Message", "Manual Call", "Internal Message"];
export const APN_LEAD_STATUS = ["Submitted", "Approved", "Duplicate", "Invalid", "Fake", "Quotation Sent", "Converted", "Lost"];
export const APN_LEAD_REJECTED = new Set(["Duplicate", "Invalid", "Fake", "Lost"]);
export const APN_COMM_STATUS = ["Pending", "Approved", "Payable", "Paid"];
export const APN_COMM_REVERSED = "Reversed";
export const APN_TARGET_METRICS = [["leads", "Leads"], ["conversions", "Conversions"], ["website", "Website projects"], ["course", "Course admissions"], ["marketing", "Marketing projects"]];
export const APN_GOVERNED_TARGETS_LIMIT = 1;
export const APN_TIEUPS = {
  website: ["Website + maintenance", "Referral swap", "Joint marketing"],
  marketing: ["Joint campaign", "Referral swap", "Regular retainer"],
  course: ["Admissions partner", "Campus referral", "Franchise interest"],
};
export const APN_INACTIVE_DAYS = 30;
export const APN_ACTION_PENDING_STATUSES = new Set(["pending", "under_review", "pending approval", "needs_publish", "unpublished", "draft"]);

export const APN_COMMISSION_RULES = Object.freeze([
  Object.freeze({ key: 0, name: "Trainee Partner", rate: 10, minProject: 1, maxProject: 1 }),
  Object.freeze({ key: 1, name: "Active Partner", rate: 15, minProject: 2, maxProject: 9 }),
  Object.freeze({ key: 2, name: "Growth Partner", rate: 20, minProject: 10, maxProject: Infinity }),
]);

export const APN_WITHDRAWAL_TYPES = [
  ["commission", "Commission"], ["referral", "Referral"], ["incentive", "Incentive"],
];

export const APN_TICKET_STATUSES = ["open", "under_review", "waiting_for_partner", "answered", "resolved", "closed"];
export const APN_TICKET_TONE = { open: "pri", under_review: "accent", waiting_for_partner: "accent", answered: "pos", resolved: "pos", closed: "" };
export const APN_AI_CHIPS = [
  ["My wallet", "What is my wallet balance and when can I withdraw?"],
  ["My commission", "Why haven't I received my commission yet? Explain from my records."],
  ["My reversal", "Which reversals appear on my account and why were they made?"],
  ["My projects", "Which of my projects and revenue collections are on record?"],
  ["My referrals", "How much have I earned from referrals and when were they effective?"],
  ["Rules", "Explain the current commission ladder and caps under the active rule version."],
  ["Escalate to support", "I need help from the ALLBEE support team."],
];

export const APN_APPROVERS = [
  { name: "Syed Hasan Kuddos Sahib", designation: "Co-Founder & CFO" },
  { name: "Mohamed Backer Alim Sahib", designation: "Founder & CEO" },
];

export const AGREEMENT_CATEGORIES = ["Agreement", "Terms & Conditions", "Commission Schedule", "Code of Conduct", "Privacy & Data Notice", "IP & Brand", "Confidentiality", "Lead & Client Management", "Quotation & Sales", "Training & Certification", "Suspension & Termination", "Dispute & Grievance"];
