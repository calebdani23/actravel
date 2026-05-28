export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type BaseRow = { id: string; created_at: string };
type TimestampedRow = BaseRow & { updated_at: string };
type BilingualCatalogRow = TimestampedRow & {
  name_es: string;
  name_en: string;
  slug_es: string;
  slug_en: string;
  summary_es: string | null;
  summary_en: string | null;
  description_es: string | null;
  description_en: string | null;
  is_featured: boolean;
  status: string;
  published_at: string | null;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: unknown[];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<TimestampedRow & { full_name: string; phone: string | null; avatar_url: string | null; is_active: boolean }>;
      roles: Table<BaseRow & { name: "admin" | "asesor" | "operaciones" | "finanzas" | "marketing"; description: string | null }>;
      profile_roles: Table<{ profile_id: string; role_id: string; created_at: string }>;
      contacts: Table<TimestampedRow & { first_name: string; last_name: string | null; email: string | null; phone: string | null; preferred_locale: string; source: string | null; consent_marketing: boolean; notes: string | null }>;
      lead_statuses: Table<BaseRow & { name: string; label_es: string; label_en: string; sort_order: number; is_terminal: boolean }>;
      leads: Table<TimestampedRow & { contact_id: string; status_id: string; assigned_to: string | null; destination_id: string | null; service_id: string | null; travel_start_date: string | null; travel_end_date: string | null; travelers_count: number; budget_mxn: number | null; budget_usd: number | null; source: string; priority: string; summary: string | null }>;
      lead_notes: Table<TimestampedRow & { lead_id: string; author_id: string | null; body: string; is_internal: boolean }>;
      lead_events: Table<BaseRow & { lead_id: string; actor_id: string | null; event_type: string; payload: Json }>;
      quote_requests: Table<TimestampedRow & { lead_id: string | null; contact_id: string | null; locale: string; destination_slug: string | null; service_slug: string | null; payload: Json; status: string }>;
      destinations: Table<BilingualCatalogRow & { country: string; region: string | null; hero_image_url: string | null; thumbnail_image_url: string | null }>;
      services: Table<BilingualCatalogRow & { price_from_mxn: number | null; price_from_usd: number | null; sort_order: number; hero_image_url: string | null; thumbnail_image_url: string | null }>;
      promotions: Table<TimestampedRow & { destination_id: string | null; service_id: string | null; title_es: string; title_en: string; slug_es: string; slug_en: string; summary_es: string | null; summary_en: string | null; details_es: string | null; details_en: string | null; hero_image_url: string | null; thumbnail_image_url: string | null; price_from_mxn: number | null; price_from_usd: number | null; starts_at: string | null; ends_at: string | null; is_featured: boolean; status: string; published_at: string | null }>;
      promotion_media: Table<BaseRow & { promotion_id: string | null; destination_id: string | null; service_id: string | null; bucket: string; path: string; alt_es: string | null; alt_en: string | null; media_type: string; sort_order: number; is_public: boolean }>;
      payment_methods: Table<BaseRow & { name: string; label_es: string; label_en: string; is_active: boolean; sort_order: number }>;
      bookings: Table<TimestampedRow & { lead_id: string | null; contact_id: string; assigned_to: string | null; booking_code: string | null; status: string; destination_id: string | null; service_id: string | null; starts_on: string | null; ends_on: string | null; travelers_count: number; total_mxn: number | null; total_usd: number | null; currency: string; notes: string | null }>;
      payments: Table<TimestampedRow & { booking_id: string | null; lead_id: string | null; contact_id: string | null; method_id: string | null; amount: number; currency: string; status: string; payment_type: string; proof_bucket: string | null; proof_path: string | null; paid_at: string | null; verified_by: string | null; verified_at: string | null; notes: string | null }>;
      documents: Table<TimestampedRow & { booking_id: string | null; lead_id: string | null; contact_id: string | null; uploaded_by: string | null; document_type: string; title: string; bucket: string; path: string; status: string }>;
      message_templates: Table<TimestampedRow & { name: string; channel: string; category: string; description: string | null; sort_order: number; subject_es: string | null; subject_en: string | null; body_es: string; body_en: string; variables: Json; is_active: boolean }>;
      whatsapp_clicks: Table<BaseRow & { lead_id: string | null; contact_id: string | null; locale: string; page_path: string | null; phone: string | null; message: string | null; user_agent: string | null; ip_hash: string | null }>;
      notification_logs: Table<BaseRow & { lead_id: string | null; contact_id: string | null; channel: string; provider: string | null; recipient: string | null; template_name: string | null; status: "queued" | "processing" | "sent" | "failed" | "skipped" | "ambiguous"; error_message: string | null; payload: Json; provider_message_id: string | null; sent_at: string | null; updated_at: string; attempt_count: number; last_attempt_at: string | null; locked_at: string | null; last_retried_by: string | null }>;
      public_rate_limits: Table<TimestampedRow & { scope: string; key_hash: string; window_start: string; count: number; first_seen_at: string; last_seen_at: string; context_hash: string | null; metadata: Json }>;
      sheet_sync_logs: Table<BaseRow & { lead_id: string | null; direction: string; sheet_name: string | null; row_id: string | null; status: "queued" | "processing" | "success" | "failed" | "skipped" | "ambiguous"; error_message: string | null; payload: Json; quote_request_id: string | null; idempotency_key: string | null; attempt_count: number; last_attempt_at: string | null; locked_at: string | null; last_retried_by: string | null; updated_at: string }>;
    };
    Views: Record<string, never>;
    Functions: {
      has_role: { Args: { role_name: string }; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_assigned_lead: { Args: { lead_uuid: string }; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<TableName extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][TableName]["Row"];
export type TablesInsert<TableName extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][TableName]["Insert"];
export type TablesUpdate<TableName extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][TableName]["Update"];
