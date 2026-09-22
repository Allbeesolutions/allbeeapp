import { round2 } from "../../utils/dateFormat.js";

export function apnNormalizeFinanceCollections(rows, { projectId, partnerId, value, rate, receivedDate, createdBy }) {
  const maximum = round2(value * rate / 100);
  let received = 0;
  let earned = 0;
  const normalized = (rows || []).map((row) => ({
    ...row,
    projectId,
    partnerId,
    receivedAmount: Number(row.receivedAmount) || 0,
    incentive: Number(row.incentive || 0),
    receivedDate: row.receivedDate || receivedDate,
    createdBy: row.createdBy || createdBy,
    createdAt: row.createdAt || Date.now(),
    commissionStatus: row.commissionStatus || "Pending",
  })).map((row) => {
    if (row.receivedAmount <= 0) throw new Error("Collection amounts must be greater than zero.");
    if (row.incentive < 0) throw new Error("Incentives cannot be negative.");
    received += row.receivedAmount;
    if (received > value) throw new Error("Collections cannot exceed the APN project value.");
    const commissionGenerated = round2(Math.min(Math.max(0, maximum - earned), row.receivedAmount * rate / 100));
    earned += commissionGenerated;
    return { ...row, commissionGenerated };
  });
  return { normalized, received: round2(received), earned: round2(earned), maximum };
}

export function apnNormalizeLinkedCollections(existing, collection, sourceProject) {
  const linkedCollections = [...(existing || []), collection].sort((a, b) => String(a.receivedDate || a.createdAt).localeCompare(String(b.receivedDate || b.createdAt)));
  let received = 0;
  let earned = 0;
  const max = Number(sourceProject.maximumCommission) || (Number(sourceProject.projectValue) * Number(sourceProject.commissionRate) / 100);
  const rate = Number(sourceProject.commissionRate) || 0;
  const normalized = linkedCollections.map((row) => {
    const amount = Number(row.receivedAmount) || 0;
    if (amount <= 0) throw new Error("APN collection amounts must be greater than zero.");
    received += amount;
    const commission = round2(Math.min(Math.max(0, max - earned), amount * rate / 100));
    earned += commission;
    return { ...row, receivedAmount: amount, commissionGenerated: commission };
  });
  if (received > Number(sourceProject.projectValue)) throw new Error("This income exceeds the APN project's remaining value.");
  return { normalized, received: round2(received), earned: round2(earned), maximum: round2(Number(sourceProject.projectValue) * rate / 100) };
}
