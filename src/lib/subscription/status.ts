import { chinaIso } from "@/lib/datetime";

export type SubscriptionProfileLite = {
  subscription_end?: string | null;
  subscription_end_at?: string | null;
  cancel_at_period_end?: boolean | null;
};

function parseIsoDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getSubscriptionEndDate(profile: SubscriptionProfileLite) {
  return parseIsoDate(profile.subscription_end ?? profile.subscription_end_at);
}

export function shouldDowngradeAfterExpiry(
  profile: SubscriptionProfileLite,
  now: Date = new Date()
) {
  if (!profile.cancel_at_period_end) return false;
  const endDate = getSubscriptionEndDate(profile);
  if (!endDate) return false;
  return now.getTime() > endDate.getTime();
}

export async function downgradeExpiredSubscriptionIfNeeded(params: {
  supabase: {
    from: (table: string) => {
      update: (values: Record<string, unknown>) => {
        eq: (
          column: string,
          value: string
        ) => PromiseLike<{ error: { message: string } | null }>;
      };
    };
  };
  userId: string;
  profile: SubscriptionProfileLite | null | undefined;
  now?: Date;
}) {
  if (!params.profile || !shouldDowngradeAfterExpiry(params.profile, params.now)) {
    return false;
  }

  const nowIso = chinaIso(params.now ?? new Date());
  const { error } = await params.supabase
    .from("profiles")
    .update({
      is_subscribed: false,
      subscription_status: "expired",
      updated_at: nowIso,
    })
    .eq("id", params.userId);

  if (!error) return true;

  await params.supabase
    .from("profiles")
    .update({
      subscription_status: "expired",
      updated_at: nowIso,
    })
    .eq("id", params.userId);

  return true;
}
