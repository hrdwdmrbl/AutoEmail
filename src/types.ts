export interface EmailMessage {
  id: string;
  date: Date;
  from: {
    name?: string;
    address: string;
  };
  to: {
    name?: string;
    address: string;
  }[];
  subject: string;
  text: string;
  html?: string;
  // Additional fields for thread handling
  threadId?: string;
  // In Fastmail's implementation, messageId is an array of strings
  messageId?: string | string[];
  references?: string[];
  inReplyTo?: string | string[];
}

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
  mailbox: string;
}

export interface JmapConfig {
  sessionUrl: string;
  apiKey: string;
  accountId?: string;
  emailAddress?: string;
}

export interface AppConfig {
  imap: ImapConfig;
  jmap: JmapConfig;
  openaiApiKey: string;
  knowledgeFile: string;
  dbConfig: DbConfig;
  dryRun?: boolean;
}

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface ShopifyShop {
  id: number;
  shopify_domain: string;
  shopify_token: string;
  encrypted_api_key: string;
  encrypted_api_pass: string;
  encrypted_secret: string;
  name: string;
  currency: string;
  primary_location_id: number;
  user_id: number;
  created_at: Date;
  updated_at: Date;
  sync: boolean;
  import_step: number;
  shopify_shop_id: number;
  first_failed_at: Date;
  failed_attempts: number;
  latest_failure_error: string;
  status: number;
  email?: string;
  current_import_job_id: number;
  current_import_job_saved_state: JSON;
  country_code: string;
  shopify_created_at: Date;
  customer_email: string;
  money_format: string;
  money_in_emails_format: string;
  money_with_currency_format: string;
  money_with_currency_in_emails_format: string;
  multi_location_enabled: boolean;
  domain?: string;
  phone: string;
  plan_display_name: string;
  plan_name: string;
  shop_owner: string;
  timezone: string;
  weight_unit: string;
  shopify_updated_at: Date;
  access_scopes: string;
}

export interface StoreInfo {
  name: string;
  domain?: string;
  syncMode: string;
  currency: string;
  company_name?: string;
  email?: string;
}

export interface User {
  id: number;
  created_at: Date;
  updated_at: Date;
  currency: string;
  horse_plan_id: number;
  shopify_plan_name: string;
  shopify_plan_id: number;
  paid_up: number;
  activated_on: Date;
  cancelled_on: Date;
  billing_on: Date;
  trial_ends_on: Date;
  plan_shopify_shop_id: number;
  shopify_updated_at: Date;
  sync_level: number;
  shopify_shops_count: number;
  over_limit_at: Date;
  syncback_setting: number;
  costsync_setting: number;
  company_name?: string;
  company_address?: string;
  brand_logo?: string;
  email?: string;
  recommendation_subscription: boolean;
  recommendation_subscription_token: string;
  include_cost_adjustment: boolean;
}

export interface DbQueryConfig {
  name: string;
  query: string;
  params?: string[];
}
