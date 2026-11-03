// Approved financial policy parameters. In production these come from the board-approved
// policy and should be moved into the Setting table with maker-checker edits.
export const POLICY = {
  /** Withdrawals at or above this need a FINANCE_APPROVER (dual control). ₦500,000 */
  dualApprovalThresholdKobo: 50_000_000n,
  /** Promised processing time shown to members. */
  withdrawalSla: "within 1 business day",
  /** Loan eligibility: member must have been approved for at least this many days. */
  minMembershipDaysForLoan: Number(process.env.MIN_MEMBERSHIP_DAYS_FOR_LOAN ?? 0),
  /** Max loan as a multiple of savings balance (bps, 30000 = 3x). 0 disables the rule. */
  maxLoanToSavingsBps: Number(process.env.MAX_LOAN_TO_SAVINGS_BPS ?? 30000),
  /** Max instalment as a share of disposable monthly income (bps, 4000 = 40%). */
  maxAffordabilityBps: 4000,
  /** Days past due before an instalment is flagged and the loan moves to arrears. */
  arrearsGraceDays: 3,
} as const;

export const isDemo = () => process.env.DEMO_MODE === "true";
