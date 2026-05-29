export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type GenericRow = Record<string, any>;
type GenericInsert = Record<string, any>;
type GenericUpdate = Record<string, any>;

type GenericTable = {
  Row: GenericRow;
  Insert: GenericInsert;
  Update: GenericUpdate;
  Relationships: any[];
};

type PublicTables = {
  profiles: GenericTable;
  roles: GenericTable;
  profile_roles: GenericTable;
  contacts: GenericTable;
  lead_statuses: GenericTable;
  leads: GenericTable;
  lead_notes: GenericTable;
  lead_events: GenericTable;
  quote_requests: GenericTable;
  destinations: GenericTable;
  services: GenericTable;
  packages: GenericTable;
  promotions: GenericTable;
  promotion_media: GenericTable;
  payment_methods: GenericTable;
  bookings: GenericTable;
  payments: GenericTable;
  documents: GenericTable;
  message_templates: GenericTable;
  whatsapp_clicks: GenericTable;
  notification_logs: GenericTable;
  sheet_sync_logs: GenericTable;
  [key: string]: GenericTable;
};

export type Database = {
  public: {
    Tables: PublicTables;
    Views: Record<string, never>;
    Functions: {
      has_role: {
        Args: { role_name: string };
        Returns: boolean;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_assigned_lead: {
        Args: { lead_uuid: string };
        Returns: boolean;
      };
      [key: string]: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
  storage: {
    Tables: {
      buckets: GenericTable;
      objects: GenericTable;
      [key: string]: GenericTable;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<TableName extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][TableName]["Row"];

export type TablesInsert<TableName extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][TableName]["Insert"];

export type TablesUpdate<TableName extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][TableName]["Update"];
