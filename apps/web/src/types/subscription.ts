export interface SubscriptionPlan {
  id: number;
  code: string;
  name: string;
  priceLabel: string;
  description: string;
  features: string[];
}

export interface UserSubscription {
  status: string;
  plan: SubscriptionPlan;
}
