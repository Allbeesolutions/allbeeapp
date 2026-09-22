import { APN_APPROVERS } from "./constants.js";

export const apnApproverFor = (actor) => /syed|haji/i.test(String(actor || "")) ? APN_APPROVERS[0] : APN_APPROVERS[1];
export const apnNotificationSender = (n) => {
  const approvedBy = n?.approvedBy || {};
  return { name: n?.senderName || approvedBy.name || n?.createdBy || "ALLBEE", designation: n?.senderDesignation || approvedBy.designation || n?.senderRole || "Admin", avatar: n?.senderAvatar || approvedBy.avatar || approvedBy.photo_url || "" };
};
export const apnApprovalNotification = (partner, actor) => {
  const approvedBy = apnApproverFor(actor);
  return { title: "Welcome to APN 🎉", body: "Your partner account has been approved.\n\nApproved by\n" + approvedBy.name + "\n" + approvedBy.designation, approvedBy, senderName: approvedBy.name, senderRole: approvedBy.designation, senderDesignation: approvedBy.designation, partnerId: partner.id, audience: "partner:" + partner.id };
};
export const apnNotify = (n, uid) => {
  const createdAt = Date.now();
  return { id: uid(), title: n.title || "", body: n.body || "", audience: n.audience || "all", level: n.level || "General", reads: [], createdAt, createdDate: new Date(createdAt).toISOString().slice(0, 10), createdTime: new Date(createdAt).toTimeString().slice(0, 8), ...(n.approvedBy ? { approvedBy: n.approvedBy } : {}), ...(n.partnerId ? { partnerId: n.partnerId } : {}), ...(n.metadata ? { metadata: n.metadata } : {}), ...(n.senderName ? { senderName: n.senderName } : {}), ...(n.senderRole ? { senderRole: n.senderRole } : {}), ...(n.senderDesignation ? { senderDesignation: n.senderDesignation } : {}), ...(n.senderAvatar ? { senderAvatar: n.senderAvatar } : {}) };
};
