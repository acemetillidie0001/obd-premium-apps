import BillingPlanPageClient from "./BillingPlanPageClient";

function parseBillingEnabledFlag(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

export default function BillingPlanPage() {
  const billingEnabled = parseBillingEnabledFlag(process.env.BILLING_ENABLED);
  return <BillingPlanPageClient billingEnabled={billingEnabled} />;
}

