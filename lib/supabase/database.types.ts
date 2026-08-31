export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_account_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          target_email: string | null
          target_profile_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_email?: string | null
          target_profile_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_email?: string | null
          target_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_account_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_account_events_target_profile_id_fkey"
            columns: ["target_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_lead_deletion_audit: {
        Row: {
          actor_id: string | null
          blocked_reasons: Json
          blocker_counts: Json
          contact_blocked_reasons: Json
          contact_blocker_counts: Json
          contact_deleted: boolean
          deleted_at: string
          deleted_contact_id: string | null
          deleted_lead_id: string
          id: string
          metadata: Json
        }
        Insert: {
          actor_id?: string | null
          blocked_reasons?: Json
          blocker_counts?: Json
          contact_blocked_reasons?: Json
          contact_blocker_counts?: Json
          contact_deleted?: boolean
          deleted_at?: string
          deleted_contact_id?: string | null
          deleted_lead_id: string
          id?: string
          metadata?: Json
        }
        Update: {
          actor_id?: string | null
          blocked_reasons?: Json
          blocker_counts?: Json
          contact_blocked_reasons?: Json
          contact_blocker_counts?: Json
          contact_deleted?: boolean
          deleted_at?: string
          deleted_contact_id?: string | null
          deleted_lead_id?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "admin_lead_deletion_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          accepted_quote_version_id: string | null
          assigned_to: string | null
          booking_code: string | null
          contact_id: string
          created_at: string
          currency: string
          destination_id: string | null
          ends_on: string | null
          id: string
          lead_id: string | null
          notes: string | null
          service_id: string | null
          starts_on: string | null
          status: string
          total_mxn: number | null
          total_usd: number | null
          travelers_count: number
          updated_at: string
        }
        Insert: {
          accepted_quote_version_id?: string | null
          assigned_to?: string | null
          booking_code?: string | null
          contact_id: string
          created_at?: string
          currency?: string
          destination_id?: string | null
          ends_on?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          service_id?: string | null
          starts_on?: string | null
          status?: string
          total_mxn?: number | null
          total_usd?: number | null
          travelers_count?: number
          updated_at?: string
        }
        Update: {
          accepted_quote_version_id?: string | null
          assigned_to?: string | null
          booking_code?: string | null
          contact_id?: string
          created_at?: string
          currency?: string
          destination_id?: string | null
          ends_on?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          service_id?: string | null
          starts_on?: string | null
          status?: string
          total_mxn?: number | null
          total_usd?: number | null
          travelers_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_accepted_quote_version_id_fkey"
            columns: ["accepted_quote_version_id"]
            isOneToOne: false
            referencedRelation: "quote_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          blocked_at: string | null
          blocked_by: string | null
          blocked_reason: string | null
          consent_marketing: boolean
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          email: string | null
          first_name: string
          id: string
          is_test_data: boolean
          last_name: string | null
          lifecycle_status: string
          normalized_email: string | null
          normalized_phone: string | null
          notes: string | null
          phone: string | null
          preferred_locale: string
          source: string | null
          updated_at: string
        }
        Insert: {
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          consent_marketing?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          email?: string | null
          first_name: string
          id?: string
          is_test_data?: boolean
          last_name?: string | null
          lifecycle_status?: string
          normalized_email?: string | null
          normalized_phone?: string | null
          notes?: string | null
          phone?: string | null
          preferred_locale?: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          consent_marketing?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          email?: string | null
          first_name?: string
          id?: string
          is_test_data?: boolean
          last_name?: string | null
          lifecycle_status?: string
          normalized_email?: string | null
          normalized_phone?: string | null
          notes?: string | null
          phone?: string | null
          preferred_locale?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_blocked_by_fkey"
            columns: ["blocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_bulk_mutation_items: {
        Row: {
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          error_code: string | null
          error_message: string | null
          id: string
          job_id: string
          outcome: string
        }
        Insert: {
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          job_id: string
          outcome: string
        }
        Update: {
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          job_id?: string
          outcome?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_bulk_mutation_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "crm_bulk_mutation_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_bulk_mutation_jobs: {
        Row: {
          actor_id: string | null
          completed_at: string | null
          created_at: string
          failure_count: number
          id: string
          metadata: Json
          operation: string
          requested_count: number
          success_count: number
        }
        Insert: {
          actor_id?: string | null
          completed_at?: string | null
          created_at?: string
          failure_count?: number
          id?: string
          metadata?: Json
          operation: string
          requested_count?: number
          success_count?: number
        }
        Update: {
          actor_id?: string | null
          completed_at?: string | null
          created_at?: string
          failure_count?: number
          id?: string
          metadata?: Json
          operation?: string
          requested_count?: number
          success_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_bulk_mutation_jobs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      destinations: {
        Row: {
          country: string
          created_at: string
          description_en: string | null
          description_es: string | null
          detail_sections_en: Json | null
          detail_sections_es: Json | null
          hero_image_url: string | null
          id: string
          is_featured: boolean
          name_en: string
          name_es: string
          published_at: string | null
          region: string | null
          slug_en: string
          slug_es: string
          status: string
          summary_en: string | null
          summary_es: string | null
          thumbnail_image_url: string | null
          updated_at: string
        }
        Insert: {
          country?: string
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          detail_sections_en?: Json | null
          detail_sections_es?: Json | null
          hero_image_url?: string | null
          id?: string
          is_featured?: boolean
          name_en: string
          name_es: string
          published_at?: string | null
          region?: string | null
          slug_en: string
          slug_es: string
          status?: string
          summary_en?: string | null
          summary_es?: string | null
          thumbnail_image_url?: string | null
          updated_at?: string
        }
        Update: {
          country?: string
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          detail_sections_en?: Json | null
          detail_sections_es?: Json | null
          hero_image_url?: string | null
          id?: string
          is_featured?: boolean
          name_en?: string
          name_es?: string
          published_at?: string | null
          region?: string | null
          slug_en?: string
          slug_es?: string
          status?: string
          summary_en?: string | null
          summary_es?: string | null
          thumbnail_image_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          booking_id: string | null
          bucket: string
          byte_size: number | null
          contact_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          document_type: string
          id: string
          lead_id: string | null
          mime_type: string | null
          path: string
          quote_link_source: string | null
          quote_linked_at: string | null
          quote_linked_by: string | null
          quote_version_id: string | null
          sha256: string | null
          status: string
          storage_state: string
          title: string
          updated_at: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          booking_id?: string | null
          bucket?: string
          byte_size?: number | null
          contact_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          document_type?: string
          id?: string
          lead_id?: string | null
          mime_type?: string | null
          path: string
          quote_link_source?: string | null
          quote_linked_at?: string | null
          quote_linked_by?: string | null
          quote_version_id?: string | null
          sha256?: string | null
          status?: string
          storage_state?: string
          title: string
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          booking_id?: string | null
          bucket?: string
          byte_size?: number | null
          contact_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          document_type?: string
          id?: string
          lead_id?: string | null
          mime_type?: string | null
          path?: string
          quote_link_source?: string | null
          quote_linked_at?: string | null
          quote_linked_by?: string | null
          quote_version_id?: string | null
          sha256?: string | null
          status?: string
          storage_state?: string
          title?: string
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_quote_linked_by_fkey"
            columns: ["quote_linked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_quote_version_id_fkey"
            columns: ["quote_version_id"]
            isOneToOne: true
            referencedRelation: "quote_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          lead_id: string
          payload: Json
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          lead_id: string
          payload?: Json
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          lead_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          is_internal: boolean
          lead_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          lead_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          lead_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_statuses: {
        Row: {
          created_at: string
          id: string
          is_terminal: boolean
          label_en: string
          label_es: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_terminal?: boolean
          label_en: string
          label_es: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_terminal?: boolean
          label_en?: string
          label_es?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      leads: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          assigned_to: string | null
          budget_mxn: number | null
          budget_usd: number | null
          contact_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          destination_id: string | null
          id: string
          is_featured: boolean
          is_test_data: boolean
          opportunity_basis: Json
          opportunity_signature: string | null
          opportunity_signature_version: number
          priority: string
          service_id: string | null
          source: string
          status_id: string
          summary: string | null
          travel_end_date: string | null
          travel_start_date: string | null
          travelers_count: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          assigned_to?: string | null
          budget_mxn?: number | null
          budget_usd?: number | null
          contact_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          destination_id?: string | null
          id?: string
          is_featured?: boolean
          is_test_data?: boolean
          opportunity_basis?: Json
          opportunity_signature?: string | null
          opportunity_signature_version?: number
          priority?: string
          service_id?: string | null
          source?: string
          status_id: string
          summary?: string | null
          travel_end_date?: string | null
          travel_start_date?: string | null
          travelers_count?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          assigned_to?: string | null
          budget_mxn?: number | null
          budget_usd?: number | null
          contact_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          destination_id?: string | null
          id?: string
          is_featured?: boolean
          is_test_data?: boolean
          opportunity_basis?: Json
          opportunity_signature?: string | null
          opportunity_signature_version?: number
          priority?: string
          service_id?: string | null
          source?: string
          status_id?: string
          summary?: string | null
          travel_end_date?: string | null
          travel_start_date?: string | null
          travelers_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "lead_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body_en: string
          body_es: string
          category: string
          channel: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          subject_en: string | null
          subject_es: string | null
          updated_at: string
          variables: Json
        }
        Insert: {
          body_en: string
          body_es: string
          category?: string
          channel: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          subject_en?: string | null
          subject_es?: string | null
          updated_at?: string
          variables?: Json
        }
        Update: {
          body_en?: string
          body_es?: string
          category?: string
          channel?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          subject_en?: string | null
          subject_es?: string | null
          updated_at?: string
          variables?: Json
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          attempt_count: number
          channel: string
          contact_id: string | null
          created_at: string
          error_message: string | null
          id: string
          incident_status: string
          incident_updated_at: string
          incident_updated_by: string | null
          last_attempt_at: string | null
          last_retried_by: string | null
          lead_id: string | null
          locked_at: string | null
          payload: Json
          provider: string | null
          provider_message_id: string | null
          quote_request_id: string | null
          recipient: string | null
          sent_at: string | null
          status: string
          template_name: string | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          channel: string
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          incident_status?: string
          incident_updated_at?: string
          incident_updated_by?: string | null
          last_attempt_at?: string | null
          last_retried_by?: string | null
          lead_id?: string | null
          locked_at?: string | null
          payload?: Json
          provider?: string | null
          provider_message_id?: string | null
          quote_request_id?: string | null
          recipient?: string | null
          sent_at?: string | null
          status?: string
          template_name?: string | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          channel?: string
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          incident_status?: string
          incident_updated_at?: string
          incident_updated_by?: string | null
          last_attempt_at?: string | null
          last_retried_by?: string | null
          lead_id?: string | null
          locked_at?: string | null
          payload?: Json
          provider?: string | null
          provider_message_id?: string | null
          quote_request_id?: string | null
          recipient?: string | null
          sent_at?: string | null
          status?: string
          template_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          created_at: string
          description_en: string | null
          description_es: string | null
          detail_sections_en: Json | null
          detail_sections_es: Json | null
          hero_image_url: string | null
          id: string
          is_featured: boolean
          name_en: string
          name_es: string
          price_from_mxn: number | null
          price_from_usd: number | null
          published_at: string | null
          slug_en: string
          slug_es: string
          sort_order: number
          status: string
          summary_en: string | null
          summary_es: string | null
          thumbnail_image_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          detail_sections_en?: Json | null
          detail_sections_es?: Json | null
          hero_image_url?: string | null
          id?: string
          is_featured?: boolean
          name_en: string
          name_es: string
          price_from_mxn?: number | null
          price_from_usd?: number | null
          published_at?: string | null
          slug_en: string
          slug_es: string
          sort_order?: number
          status?: string
          summary_en?: string | null
          summary_es?: string | null
          thumbnail_image_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          detail_sections_en?: Json | null
          detail_sections_es?: Json | null
          hero_image_url?: string | null
          id?: string
          is_featured?: boolean
          name_en?: string
          name_es?: string
          price_from_mxn?: number | null
          price_from_usd?: number | null
          published_at?: string | null
          slug_en?: string
          slug_es?: string
          sort_order?: number
          status?: string
          summary_en?: string | null
          summary_es?: string | null
          thumbnail_image_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label_en: string
          label_es: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label_en: string
          label_es: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label_en?: string
          label_es?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      payments: {
        Row: {
          accepted_quote_version_id: string | null
          amount: number
          booking_id: string | null
          contact_id: string | null
          created_at: string
          currency: string
          id: string
          lead_id: string | null
          method_id: string | null
          notes: string | null
          paid_at: string | null
          payment_type: string
          proof_bucket: string | null
          proof_path: string | null
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          accepted_quote_version_id?: string | null
          amount: number
          booking_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          lead_id?: string | null
          method_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_type?: string
          proof_bucket?: string | null
          proof_path?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          accepted_quote_version_id?: string | null
          amount?: number
          booking_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          lead_id?: string | null
          method_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_type?: string
          proof_bucket?: string | null
          proof_path?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_accepted_quote_version_id_fkey"
            columns: ["accepted_quote_version_id"]
            isOneToOne: false
            referencedRelation: "quote_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_roles: {
        Row: {
          created_at: string
          profile_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promotion_media: {
        Row: {
          alt_en: string | null
          alt_es: string | null
          bucket: string
          created_at: string
          destination_id: string | null
          id: string
          is_public: boolean
          media_type: string
          path: string
          promotion_id: string | null
          service_id: string | null
          sort_order: number
        }
        Insert: {
          alt_en?: string | null
          alt_es?: string | null
          bucket?: string
          created_at?: string
          destination_id?: string | null
          id?: string
          is_public?: boolean
          media_type?: string
          path: string
          promotion_id?: string | null
          service_id?: string | null
          sort_order?: number
        }
        Update: {
          alt_en?: string | null
          alt_es?: string | null
          bucket?: string
          created_at?: string
          destination_id?: string | null
          id?: string
          is_public?: boolean
          media_type?: string
          path?: string
          promotion_id?: string | null
          service_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "promotion_media_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_media_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_media_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_services: {
        Row: {
          created_at: string
          promotion_id: string
          service_id: string
        }
        Insert: {
          created_at?: string
          promotion_id: string
          service_id: string
        }
        Update: {
          created_at?: string
          promotion_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_services_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          commercial_sections_en: Json | null
          commercial_sections_es: Json | null
          created_at: string
          destination_id: string | null
          details_en: string | null
          details_es: string | null
          ends_at: string | null
          hero_image_url: string | null
          id: string
          is_featured: boolean
          package_id: string | null
          price_from_mxn: number | null
          price_from_usd: number | null
          published_at: string | null
          service_id: string | null
          slug_en: string
          slug_es: string
          starts_at: string | null
          status: string
          summary_en: string | null
          summary_es: string | null
          thumbnail_image_url: string | null
          title_en: string
          title_es: string
          updated_at: string
        }
        Insert: {
          commercial_sections_en?: Json | null
          commercial_sections_es?: Json | null
          created_at?: string
          destination_id?: string | null
          details_en?: string | null
          details_es?: string | null
          ends_at?: string | null
          hero_image_url?: string | null
          id?: string
          is_featured?: boolean
          package_id?: string | null
          price_from_mxn?: number | null
          price_from_usd?: number | null
          published_at?: string | null
          service_id?: string | null
          slug_en: string
          slug_es: string
          starts_at?: string | null
          status?: string
          summary_en?: string | null
          summary_es?: string | null
          thumbnail_image_url?: string | null
          title_en: string
          title_es: string
          updated_at?: string
        }
        Update: {
          commercial_sections_en?: Json | null
          commercial_sections_es?: Json | null
          created_at?: string
          destination_id?: string | null
          details_en?: string | null
          details_es?: string | null
          ends_at?: string | null
          hero_image_url?: string | null
          id?: string
          is_featured?: boolean
          package_id?: string | null
          price_from_mxn?: number | null
          price_from_usd?: number | null
          published_at?: string | null
          service_id?: string | null
          slug_en?: string
          slug_es?: string
          starts_at?: string | null
          status?: string
          summary_en?: string | null
          summary_es?: string | null
          thumbnail_image_url?: string | null
          title_en?: string
          title_es?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      public_rate_limits: {
        Row: {
          context_hash: string | null
          count: number
          created_at: string
          first_seen_at: string
          id: string
          key_hash: string
          last_seen_at: string
          metadata: Json
          scope: string
          updated_at: string
          window_start: string
        }
        Insert: {
          context_hash?: string | null
          count?: number
          created_at?: string
          first_seen_at?: string
          id?: string
          key_hash: string
          last_seen_at?: string
          metadata?: Json
          scope: string
          updated_at?: string
          window_start: string
        }
        Update: {
          context_hash?: string | null
          count?: number
          created_at?: string
          first_seen_at?: string
          id?: string
          key_hash?: string
          last_seen_at?: string
          metadata?: Json
          scope?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      quote_events: {
        Row: {
          actor_id: string | null
          contact_id: string
          created_at: string
          event_type: string
          id: string
          idempotency_key: string | null
          lead_id: string
          payload: Json
          quote_id: string
          quote_version_id: string | null
        }
        Insert: {
          actor_id?: string | null
          contact_id: string
          created_at?: string
          event_type: string
          id?: string
          idempotency_key?: string | null
          lead_id: string
          payload?: Json
          quote_id: string
          quote_version_id?: string | null
        }
        Update: {
          actor_id?: string | null
          contact_id?: string
          created_at?: string
          event_type?: string
          id?: string
          idempotency_key?: string | null
          lead_id?: string
          payload?: Json
          quote_id?: string
          quote_version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_events_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_events_quote_version_id_fkey"
            columns: ["quote_version_id"]
            isOneToOne: false
            referencedRelation: "quote_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_registration_intents: {
        Row: {
          abandoned_at: string | null
          actor_id: string
          advisory_sha256: string
          attempt_count: number
          attempt_started_at: string
          bucket: string
          contact_id: string
          created_at: string
          currency: string
          deposit_amount: number | null
          expected_mime_type: string
          expected_size_bytes: number
          expires_at: string
          failed_at: string | null
          finalized_at: string | null
          id: string
          idempotency_key: string
          last_error_code: string | null
          last_error_message: string | null
          notes: string | null
          opportunity_id: string
          originating_request_id: string | null
          path: string
          recovery_deadline: string
          status: string
          summary: string | null
          target_document_id: string
          target_quote_id: string
          target_quote_version_id: string
          title: string
          total_amount: number | null
          trusted_verified_sha256: string | null
          trusted_verified_size_bytes: number | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          abandoned_at?: string | null
          actor_id: string
          advisory_sha256: string
          attempt_count?: number
          attempt_started_at: string
          bucket?: string
          contact_id: string
          created_at?: string
          currency: string
          deposit_amount?: number | null
          expected_mime_type?: string
          expected_size_bytes: number
          expires_at: string
          failed_at?: string | null
          finalized_at?: string | null
          id?: string
          idempotency_key: string
          last_error_code?: string | null
          last_error_message?: string | null
          notes?: string | null
          opportunity_id: string
          originating_request_id?: string | null
          path: string
          recovery_deadline: string
          status?: string
          summary?: string | null
          target_document_id: string
          target_quote_id: string
          target_quote_version_id: string
          title: string
          total_amount?: number | null
          trusted_verified_sha256?: string | null
          trusted_verified_size_bytes?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          abandoned_at?: string | null
          actor_id?: string
          advisory_sha256?: string
          attempt_count?: number
          attempt_started_at?: string
          bucket?: string
          contact_id?: string
          created_at?: string
          currency?: string
          deposit_amount?: number | null
          expected_mime_type?: string
          expected_size_bytes?: number
          expires_at?: string
          failed_at?: string | null
          finalized_at?: string | null
          id?: string
          idempotency_key?: string
          last_error_code?: string | null
          last_error_message?: string | null
          notes?: string | null
          opportunity_id?: string
          originating_request_id?: string | null
          path?: string
          recovery_deadline?: string
          status?: string
          summary?: string | null
          target_document_id?: string
          target_quote_id?: string
          target_quote_version_id?: string
          title?: string
          total_amount?: number | null
          trusted_verified_sha256?: string | null
          trusted_verified_size_bytes?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_registration_intents_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_registration_intents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_registration_intents_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_registration_intents_originating_request_id_fkey"
            columns: ["originating_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_request_quote_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          quote_id: string
          quote_request_id: string
          relation: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          quote_id: string
          quote_request_id: string
          relation: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          quote_id?: string
          quote_request_id?: string
          relation?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_request_quote_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_request_quote_links_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_request_quote_links_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_requests: {
        Row: {
          contact_id: string | null
          created_at: string
          destination_slug: string | null
          id: string
          lead_id: string | null
          locale: string
          payload: Json
          service_slug: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          destination_slug?: string | null
          id?: string
          lead_id?: string | null
          locale?: string
          payload?: Json
          service_slug?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          destination_slug?: string | null
          id?: string
          lead_id?: string | null
          locale?: string
          payload?: Json
          service_slug?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_requests_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_upload_intents: {
        Row: {
          abandoned_at: string | null
          actor_id: string
          attempt_count: number
          bucket: string
          created_at: string
          document_id: string
          expected_mime_type: string
          expected_size_bytes: number | null
          expires_at: string
          finalized_at: string | null
          id: string
          idempotency_key: string | null
          last_error_code: string | null
          last_error_message: string | null
          max_size_bytes: number
          path: string
          quote_id: string
          quote_version_id: string
          status: string
          updated_at: string
          uploaded_at: string | null
        }
        Insert: {
          abandoned_at?: string | null
          actor_id: string
          attempt_count?: number
          bucket?: string
          created_at?: string
          document_id: string
          expected_mime_type?: string
          expected_size_bytes?: number | null
          expires_at: string
          finalized_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          max_size_bytes?: number
          path: string
          quote_id: string
          quote_version_id: string
          status?: string
          updated_at?: string
          uploaded_at?: string | null
        }
        Update: {
          abandoned_at?: string | null
          actor_id?: string
          attempt_count?: number
          bucket?: string
          created_at?: string
          document_id?: string
          expected_mime_type?: string
          expected_size_bytes?: number | null
          expires_at?: string
          finalized_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          max_size_bytes?: number
          path?: string
          quote_id?: string
          quote_version_id?: string
          status?: string
          updated_at?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_upload_intents_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_upload_intents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_upload_intents_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_upload_intents_quote_version_id_fkey"
            columns: ["quote_version_id"]
            isOneToOne: true
            referencedRelation: "quote_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_versions: {
        Row: {
          accepted_at: string | null
          contact_id: string
          content_sha256: string | null
          created_at: string
          created_by: string | null
          currency: string
          deposit_amount: number | null
          expired_at: string | null
          finalized_at: string | null
          finalized_by: string | null
          id: string
          idempotency_key: string | null
          lead_id: string
          notes: string | null
          quote_id: string
          quote_request_id: string | null
          rejected_at: string | null
          sent_at: string | null
          status: string
          summary: string | null
          title: string
          total_amount: number | null
          updated_at: string
          valid_until: string | null
          version_number: number
        }
        Insert: {
          accepted_at?: string | null
          contact_id: string
          content_sha256?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          deposit_amount?: number | null
          expired_at?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          idempotency_key?: string | null
          lead_id: string
          notes?: string | null
          quote_id: string
          quote_request_id?: string | null
          rejected_at?: string | null
          sent_at?: string | null
          status?: string
          summary?: string | null
          title: string
          total_amount?: number | null
          updated_at?: string
          valid_until?: string | null
          version_number: number
        }
        Update: {
          accepted_at?: string | null
          contact_id?: string
          content_sha256?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deposit_amount?: number | null
          expired_at?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          idempotency_key?: string | null
          lead_id?: string
          notes?: string | null
          quote_id?: string
          quote_request_id?: string | null
          rejected_at?: string | null
          sent_at?: string | null
          status?: string
          summary?: string | null
          title?: string
          total_amount?: number | null
          updated_at?: string
          valid_until?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_versions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_versions_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_versions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_versions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_versions_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          accepted_version_id: string | null
          cancelled_at: string | null
          contact_id: string
          created_at: string
          created_by: string | null
          current_version_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          expired_at: string | null
          id: string
          idempotency_key: string | null
          lead_id: string
          lock_version: number
          next_version_number: number
          owner_id: string | null
          quote_number: string
          ready_at: string | null
          registration_intent_id: string | null
          rejected_at: string | null
          sent_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_version_id?: string | null
          cancelled_at?: string | null
          contact_id: string
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          expired_at?: string | null
          id?: string
          idempotency_key?: string | null
          lead_id: string
          lock_version?: number
          next_version_number?: number
          owner_id?: string | null
          quote_number?: string
          ready_at?: string | null
          registration_intent_id?: string | null
          rejected_at?: string | null
          sent_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_version_id?: string | null
          cancelled_at?: string | null
          contact_id?: string
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          expired_at?: string | null
          id?: string
          idempotency_key?: string | null
          lead_id?: string
          lock_version?: number
          next_version_number?: number
          owner_id?: string | null
          quote_number?: string
          ready_at?: string | null
          registration_intent_id?: string | null
          rejected_at?: string | null
          sent_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_accepted_version_id_fkey"
            columns: ["accepted_version_id"]
            isOneToOne: false
            referencedRelation: "quote_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_current_version_id_fkey"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "quote_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_registration_intent_id_fkey"
            columns: ["registration_intent_id"]
            isOneToOne: true
            referencedRelation: "quote_registration_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          created_at: string
          description_en: string | null
          description_es: string | null
          detail_sections_en: Json | null
          detail_sections_es: Json | null
          hero_image_url: string | null
          id: string
          is_featured: boolean
          name_en: string
          name_es: string
          price_from_mxn: number | null
          price_from_usd: number | null
          published_at: string | null
          slug_en: string
          slug_es: string
          sort_order: number
          status: string
          summary_en: string | null
          summary_es: string | null
          thumbnail_image_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          detail_sections_en?: Json | null
          detail_sections_es?: Json | null
          hero_image_url?: string | null
          id?: string
          is_featured?: boolean
          name_en: string
          name_es: string
          price_from_mxn?: number | null
          price_from_usd?: number | null
          published_at?: string | null
          slug_en: string
          slug_es: string
          sort_order?: number
          status?: string
          summary_en?: string | null
          summary_es?: string | null
          thumbnail_image_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          detail_sections_en?: Json | null
          detail_sections_es?: Json | null
          hero_image_url?: string | null
          id?: string
          is_featured?: boolean
          name_en?: string
          name_es?: string
          price_from_mxn?: number | null
          price_from_usd?: number | null
          published_at?: string | null
          slug_en?: string
          slug_es?: string
          sort_order?: number
          status?: string
          summary_en?: string | null
          summary_es?: string | null
          thumbnail_image_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sheet_sync_logs: {
        Row: {
          attempt_count: number
          created_at: string
          direction: string
          error_message: string | null
          id: string
          idempotency_key: string | null
          incident_status: string
          incident_updated_at: string
          incident_updated_by: string | null
          last_attempt_at: string | null
          last_retried_by: string | null
          lead_id: string | null
          locked_at: string | null
          payload: Json
          quote_request_id: string | null
          row_id: string | null
          sheet_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          direction?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          incident_status?: string
          incident_updated_at?: string
          incident_updated_by?: string | null
          last_attempt_at?: string | null
          last_retried_by?: string | null
          lead_id?: string | null
          locked_at?: string | null
          payload?: Json
          quote_request_id?: string | null
          row_id?: string | null
          sheet_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          direction?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          incident_status?: string
          incident_updated_at?: string
          incident_updated_by?: string | null
          last_attempt_at?: string | null
          last_retried_by?: string | null
          lead_id?: string | null
          locked_at?: string | null
          payload?: Json
          quote_request_id?: string | null
          row_id?: string | null
          sheet_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sheet_sync_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheet_sync_logs_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          description: string
          due_at: string
          id: string
          idempotency_key: string
          lead_id: string | null
          owner_id: string
          quote_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          due_at: string
          id?: string
          idempotency_key: string
          lead_id?: string | null
          owner_id: string
          quote_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          due_at?: string
          id?: string
          idempotency_key?: string
          lead_id?: string | null
          owner_id?: string
          quote_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_clicks: {
        Row: {
          contact_id: string | null
          created_at: string
          id: string
          ip_hash: string | null
          lead_id: string | null
          locale: string
          message: string | null
          page_path: string | null
          phone: string | null
          user_agent: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          lead_id?: string | null
          locale?: string
          message?: string | null
          page_path?: string | null
          phone?: string | null
          user_agent?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          lead_id?: string | null
          locale?: string
          message?: string | null
          page_path?: string | null
          phone?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_clicks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_clicks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_inbound_messages: {
        Row: {
          contact_id: string | null
          created_at: string
          error_message: string | null
          from_phone: string
          id: string
          ignored_reason: string | null
          lead_id: string | null
          message_text: string | null
          message_type: string
          meta_message_id: string
          normalized_text: string | null
          phone_number_id: string
          processed_at: string | null
          processing_status: string
          profile_name: string | null
          raw_payload: Json
          received_at: string
          referral: Json
          updated_at: string
          wa_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          from_phone: string
          id?: string
          ignored_reason?: string | null
          lead_id?: string | null
          message_text?: string | null
          message_type: string
          meta_message_id: string
          normalized_text?: string | null
          phone_number_id: string
          processed_at?: string | null
          processing_status?: string
          profile_name?: string | null
          raw_payload?: Json
          received_at?: string
          referral?: Json
          updated_at?: string
          wa_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          from_phone?: string
          id?: string
          ignored_reason?: string | null
          lead_id?: string | null
          message_text?: string | null
          message_type?: string
          meta_message_id?: string
          normalized_text?: string | null
          phone_number_id?: string
          processed_at?: string | null
          processing_status?: string
          profile_name?: string | null
          raw_payload?: Json
          received_at?: string
          referral?: Json
          updated_at?: string
          wa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_inbound_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inbound_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_task: {
        Args: {
          p_description: string
          p_due_at: string
          p_lead_id: string
          p_owner_id: string
          p_quote_id: string
        }
        Returns: {
          created_at: string
          description: string
          due_at: string
          id: string
          idempotency_key: string
          lead_id: string | null
          owner_id: string
          quote_id: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_accept_quote: {
        Args: {
          p_expected_accepted_quote_id: string
          p_expected_lock_version: number
          p_idempotency_key: string
          p_quote_id: string
          p_quote_version_id: string
          p_supersede_reason: string
        }
        Returns: {
          accepted_version_id: string
          idempotent_replay: boolean
          lock_version: number
          quote_id: string
          quote_number: string
          quote_status: string
          quote_version_id: string
          superseded_quote_id: string
          version_number: number
          version_status: string
        }[]
      }
      crm_accepted_quote_handoff: {
        Args: { p_quote_id: string }
        Returns: {
          accepted_at: string
          accepted_balance_amount: number
          accepted_currency: string
          accepted_deposit_amount: number
          accepted_quote_version_id: string
          accepted_title: string
          accepted_total_amount: number
          accepted_valid_until: string
          accepted_version_number: number
          can_manage_booking: boolean
          can_manage_payment: boolean
          contact_id: string
          contact_name: string
          destination_id: string
          document_id: string
          latest_booking_id: string
          latest_payment_id: string
          linked_booking_count: number
          linked_payment_count: number
          lock_version: number
          opportunity_id: string
          opportunity_label: string
          owner_id: string
          pdf_bucket: string
          pdf_byte_size: number
          pdf_path: string
          pdf_sha256: string
          quote_id: string
          quote_number: string
          quote_status: string
          service_id: string
          travel_end_date: string
          travel_start_date: string
          travelers_count: number
        }[]
      }
      crm_add_quote_version: {
        Args: {
          p_clone_version_id: string
          p_currency: string
          p_deposit_amount: number
          p_expected_lock_version: number
          p_idempotency_key: string
          p_notes: string
          p_quote_id: string
          p_quote_request_id: string
          p_summary: string
          p_title: string
          p_total_amount: number
          p_valid_until: string
        }
        Returns: {
          idempotent_replay: boolean
          lock_version: number
          quote_id: string
          quote_number: string
          quote_status: string
          quote_version_id: string
          version_number: number
        }[]
      }
      crm_advisor_can_access_live_opportunity: {
        Args: { p_lead_id: string }
        Returns: boolean
      }
      crm_begin_quote_pdf_upload: {
        Args: {
          p_expected_size_bytes: number
          p_idempotency_key: string
          p_quote_id: string
          p_quote_version_id: string
        }
        Returns: {
          attempt_count: number
          bucket: string
          document_id: string
          expected_size_bytes: number
          expires_at: string
          idempotent_replay: boolean
          intent_id: string
          intent_status: string
          path: string
          quote_id: string
          quote_version_id: string
        }[]
      }
      crm_begin_quote_registration: {
        Args: {
          p_advisory_sha256: string
          p_currency: string
          p_deposit_amount: number
          p_expected_size_bytes: number
          p_idempotency_key: string
          p_notes: string
          p_opportunity_id: string
          p_originating_request_id: string
          p_summary: string
          p_title: string
          p_total_amount: number
          p_valid_until: string
        }
        Returns: {
          attempt_count: number
          bucket: string
          contact_id: string
          expected_mime_type: string
          expected_size_bytes: number
          expires_at: string
          idempotent_replay: boolean
          intent_id: string
          intent_status: string
          opportunity_id: string
          path: string
          recovery_deadline: string
          target_document_id: string
          target_quote_id: string
          target_quote_version_id: string
        }[]
      }
      crm_bulk_archive_opportunities: {
        Args: { p_archived: boolean; p_opportunity_ids: string[] }
        Returns: {
          failure_count: number
          job_id: string
          requested_count: number
          success_count: number
        }[]
      }
      crm_bulk_block_contacts: {
        Args: { p_contact_ids: string[] }
        Returns: {
          failure_count: number
          job_id: string
          requested_count: number
          success_count: number
        }[]
      }
      crm_bulk_delete_restore_contacts: {
        Args: {
          p_confirmation: string
          p_contact_ids: string[]
          p_restore: boolean
        }
        Returns: {
          failure_count: number
          job_id: string
          requested_count: number
          success_count: number
        }[]
      }
      crm_bulk_delete_restore_opportunities: {
        Args: {
          p_confirmation: string
          p_opportunity_ids: string[]
          p_restore: boolean
        }
        Returns: {
          failure_count: number
          job_id: string
          requested_count: number
          success_count: number
        }[]
      }
      crm_bulk_feature_opportunities: {
        Args: { p_featured: boolean; p_opportunity_ids: string[] }
        Returns: {
          failure_count: number
          job_id: string
          requested_count: number
          success_count: number
        }[]
      }
      crm_bulk_mutate: {
        Args: {
          p_confirmation?: string
          p_entity_ids: string[]
          p_operation: string
          p_status_value?: string
        }
        Returns: {
          failure_count: number
          job_id: string
          requested_count: number
          success_count: number
        }[]
      }
      crm_bulk_unblock_contacts: {
        Args: { p_contact_ids: string[] }
        Returns: {
          failure_count: number
          job_id: string
          requested_count: number
          success_count: number
        }[]
      }
      crm_bulk_update_contact_lifecycle: {
        Args: { p_contact_ids: string[]; p_lifecycle_status: string }
        Returns: {
          failure_count: number
          job_id: string
          requested_count: number
          success_count: number
        }[]
      }
      crm_bulk_update_opportunity_status: {
        Args: { p_opportunity_ids: string[]; p_status_id: string }
        Returns: {
          failure_count: number
          job_id: string
          requested_count: number
          success_count: number
        }[]
      }
      crm_can_delete_quote_registration_object: {
        Args: { p_bucket: string; p_path: string }
        Returns: boolean
      }
      crm_can_manage_generic_document_object: {
        Args: { p_bucket: string; p_path: string }
        Returns: boolean
      }
      crm_can_mutate_quote: { Args: { p_quote_id: string }; Returns: boolean }
      crm_can_read_quote: { Args: { p_quote_id: string }; Returns: boolean }
      crm_can_upload_quote_registration_object: {
        Args: { p_bucket: string; p_path: string }
        Returns: boolean
      }
      crm_cancel_quote: {
        Args: {
          p_expected_lock_version: number
          p_idempotency_key: string
          p_quote_id: string
          p_quote_version_id: string
        }
        Returns: {
          accepted_version_id: string
          idempotent_replay: boolean
          lock_version: number
          quote_id: string
          quote_number: string
          quote_status: string
          quote_version_id: string
          superseded_quote_id: string
          version_number: number
          version_status: string
        }[]
      }
      crm_contact_360_summary: {
        Args: { p_contact_id: string }
        Returns: {
          accepted_quote_count: number
          accepted_quote_value_mxn: number
          accepted_quote_value_usd: number
          active_opportunity_count: number
          archived_opportunity_count: number
          blocked_at: string
          blocked_by: string
          blocked_by_name: string
          blocked_reason: string
          booking_count: number
          consent_marketing: boolean
          contact_id: string
          created_at: string
          deleted_at: string
          deleted_by: string
          deleted_by_name: string
          deleted_opportunity_count: number
          deleted_reason: string
          document_count: number
          duplicate_email_count: number
          duplicate_phone_count: number
          duplicate_risk: boolean
          email: string
          first_name: string
          is_test_data: boolean
          last_activity_at: string
          last_name: string
          lifecycle_status: string
          next_follow_up_at: string
          normalized_email: string
          normalized_phone: string
          notes: string
          open_opportunity_count: number
          overdue_follow_up_count: number
          payment_count: number
          phone: string
          pipeline_mxn: number
          pipeline_usd: number
          preferred_locale: string
          quote_version_count: number
          request_count: number
          source: string
          total_opportunity_count: number
          unassigned_request_count: number
          updated_at: string
        }[]
      }
      crm_contact_aggregate_page: {
        Args: {
          p_advisor?: string
          p_blocked?: boolean
          p_contact_id?: string
          p_deleted_only?: boolean
          p_deleted_opportunity_only?: boolean
          p_destination?: string
          p_duplicate?: boolean
          p_include_deleted?: boolean
          p_lifecycle?: string
          p_limit?: number
          p_offset?: number
          p_open_only?: boolean
          p_overdue?: boolean
          p_quick_view?: string
          p_search?: string
          p_service?: string
          p_source?: string
          p_unassigned?: boolean
        }
        Returns: {
          blocked_at: string
          blocked_reason: string
          contact_id: string
          deleted_at: string
          deleted_opportunity_count: number
          destinations: string[]
          duplicate_risk: boolean
          email: string
          featured_opportunity_count: number
          first_name: string
          last_activity_at: string
          last_name: string
          lifecycle_status: string
          next_follow_up_at: string
          open_opportunity_count: number
          overdue_count: number
          owners: string[]
          phone: string
          pipeline_mxn: number
          pipeline_usd: number
          quote_count: number
          request_count: number
          services: string[]
          total_count: number
          total_opportunity_count: number
        }[]
      }
      crm_contact_count: {
        Args: { p_include_deleted?: boolean }
        Returns: number
      }
      crm_contact_opportunity_page: {
        Args: {
          p_after_id?: string
          p_after_updated_at?: string
          p_contact_id: string
          p_limit?: number
          p_state?: string
        }
        Returns: {
          accepted_quote_accepted_at: string
          accepted_quote_amount: number
          accepted_quote_currency: string
          accepted_quote_id: string
          accepted_quote_version_number: number
          active_quote_version_count: number
          archived_at: string
          archived_by: string
          archived_by_name: string
          assigned_to: string
          budget_mxn: number
          budget_usd: number
          contact_id: string
          created_at: string
          deleted_at: string
          deleted_by: string
          deleted_by_name: string
          deleted_reason: string
          destination_id: string
          destination_name: string
          follow_up_overdue: boolean
          is_featured: boolean
          is_test_data: boolean
          last_activity_at: string
          latest_follow_up_at: string
          latest_follow_up_created_at: string
          latest_quote_amount: number
          latest_quote_currency: string
          latest_quote_id: string
          latest_quote_status: string
          latest_quote_title: string
          latest_quote_updated_at: string
          latest_quote_version_number: number
          latest_request_created_at: string
          latest_request_id: string
          latest_request_locale: string
          latest_request_source: string
          latest_request_status: string
          open_request_count: number
          opportunity_id: string
          opportunity_state: string
          owner_name: string
          page_has_more: boolean
          priority: string
          quote_version_count: number
          request_count: number
          service_id: string
          service_name: string
          source: string
          status_id: string
          status_is_terminal: boolean
          status_label: string
          status_name: string
          summary: string
          travel_end_date: string
          travel_start_date: string
          travelers_count: number
          updated_at: string
        }[]
      }
      crm_delete_lead_guarded: {
        Args: {
          p_confirmation: string
          p_delete_orphan_contact: boolean
          p_lead_id: string
        }
        Returns: {
          blocked: boolean
          blocked_reasons: Json
          blocker_counts: Json
          contact_deleted: boolean
          contact_id: string
          deleted: boolean
          deleted_at: string
          lead_id: string
        }[]
      }
      crm_delete_lead_guarded_unchecked: {
        Args: { p_delete_orphan_contact?: boolean; p_lead_id: string }
        Returns: {
          blocked: boolean
          blocked_reasons: Json
          blocker_counts: Json
          contact_deleted: boolean
          contact_id: string
          deleted: boolean
          deleted_at: string
          lead_id: string
        }[]
      }
      crm_expire_quote: {
        Args: {
          p_expected_lock_version: number
          p_idempotency_key: string
          p_quote_id: string
          p_quote_version_id: string
        }
        Returns: {
          accepted_version_id: string
          idempotent_replay: boolean
          lock_version: number
          quote_id: string
          quote_number: string
          quote_status: string
          quote_version_id: string
          superseded_quote_id: string
          version_number: number
          version_status: string
        }[]
      }
      crm_fail_quote_pdf_upload: {
        Args: {
          p_error_code: string
          p_error_message: string
          p_idempotency_key: string
          p_intent_id: string
        }
        Returns: {
          attempt_count: number
          document_id: string
          document_state: string
          idempotent_replay: boolean
          intent_id: string
          intent_status: string
          quote_id: string
          quote_version_id: string
        }[]
      }
      crm_fail_quote_registration: {
        Args: {
          p_error_code: string
          p_error_message: string
          p_intent_id: string
        }
        Returns: {
          attempt_count: number
          failed_at: string
          idempotent_replay: boolean
          intent_id: string
          intent_status: string
          last_error_code: string
          target_document_id: string
          target_quote_id: string
          target_quote_version_id: string
        }[]
      }
      crm_finalize_quote_pdf_upload: {
        Args: {
          p_idempotency_key: string
          p_intent_id: string
          p_sha256: string
        }
        Returns: {
          document_id: string
          document_state: string
          idempotent_replay: boolean
          intent_id: string
          lock_version: number
          quote_id: string
          quote_status: string
          quote_version_id: string
          version_status: string
        }[]
      }
      crm_is_valid_accepted_quote_scope: {
        Args: {
          p_contact_id: string
          p_lead_id: string
          p_quote_version_id: string
        }
        Returns: boolean
      }
      crm_mark_quote_ready: {
        Args: {
          p_expected_lock_version: number
          p_idempotency_key: string
          p_quote_id: string
          p_quote_version_id: string
        }
        Returns: {
          accepted_version_id: string
          idempotent_replay: boolean
          lock_version: number
          quote_id: string
          quote_number: string
          quote_status: string
          quote_version_id: string
          superseded_quote_id: string
          version_number: number
          version_status: string
        }[]
      }
      crm_mark_quote_sent: {
        Args: {
          p_expected_lock_version: number
          p_idempotency_key: string
          p_quote_id: string
          p_quote_version_id: string
        }
        Returns: {
          accepted_version_id: string
          idempotent_replay: boolean
          lock_version: number
          quote_id: string
          quote_number: string
          quote_status: string
          quote_version_id: string
          superseded_quote_id: string
          version_number: number
          version_status: string
        }[]
      }
      crm_next_quote_number: { Args: never; Returns: string }
      crm_normalize_email: { Args: { value: string }; Returns: string }
      crm_normalize_identity_ascii: { Args: { value: string }; Returns: string }
      crm_normalize_phone: { Args: { value: string }; Returns: string }
      crm_quote_data_quality_page: {
        Args: {
          p_after_issue_key?: string
          p_issue_type?: string
          p_limit?: number
        }
        Returns: {
          booking_id: string
          contact_id: string
          detected_at: string
          document_id: string
          intent_id: string
          issue_key: string
          issue_type: string
          opportunity_id: string
          page_has_more: boolean
          payment_id: string
          quote_id: string
          quote_version_id: string
          severity: string
          summary: string
        }[]
      }
      crm_quote_detail: {
        Args: { p_quote_id: string }
        Returns: {
          accepted_accepted_at: string
          accepted_at: string
          accepted_currency: string
          accepted_deposit_amount: number
          accepted_document_id: string
          accepted_pdf_bucket: string
          accepted_pdf_byte_size: number
          accepted_pdf_mime_type: string
          accepted_pdf_path: string
          accepted_pdf_sha256: string
          accepted_pdf_state: string
          accepted_pdf_uploaded_at: string
          accepted_total_amount: number
          accepted_valid_until: string
          accepted_version_id: string
          accepted_version_number: number
          accepted_version_status: string
          accepted_version_title: string
          advisor_name: string
          cancelled_at: string
          contact_email: string
          contact_id: string
          contact_name: string
          contact_phone: string
          created_at: string
          created_by: string
          created_by_name: string
          current_currency: string
          current_deposit_amount: number
          current_document_id: string
          current_finalized_at: string
          current_pdf_bucket: string
          current_pdf_byte_size: number
          current_pdf_mime_type: string
          current_pdf_path: string
          current_pdf_sha256: string
          current_pdf_state: string
          current_pdf_uploaded_at: string
          current_total_amount: number
          current_valid_until: string
          current_version_id: string
          current_version_number: number
          current_version_status: string
          current_version_title: string
          deleted_at: string
          deleted_by: string
          deleted_by_name: string
          deleted_reason: string
          event_count: number
          expired_at: string
          latest_event_at: string
          latest_event_type: string
          lock_version: number
          next_version_number: number
          opportunity_id: string
          opportunity_label: string
          originating_request_id: string
          originating_request_status: string
          owner_id: string
          quote_id: string
          quote_number: string
          ready_at: string
          rejected_at: string
          request_count: number
          sent_at: string
          status: string
          title: string
          updated_at: string
          version_count: number
        }[]
      }
      crm_quote_event_page: {
        Args: {
          p_after_created_at?: string
          p_after_id?: string
          p_limit?: number
          p_quote_id: string
        }
        Returns: {
          actor_id: string
          actor_name: string
          created_at: string
          event_id: string
          event_type: string
          page_has_more: boolean
          payload: Json
          quote_id: string
          quote_version_id: string
        }[]
      }
      crm_quote_page: {
        Args: {
          p_after_id?: string
          p_after_updated_at?: string
          p_contact_id?: string
          p_currency?: string
          p_include_deleted?: boolean
          p_limit?: number
          p_opportunity_id?: string
          p_owner_id?: string
          p_search?: string
          p_status?: string
          p_validity?: string
        }
        Returns: {
          accepted_accepted_at: string
          accepted_at: string
          accepted_currency: string
          accepted_deposit_amount: number
          accepted_document_id: string
          accepted_pdf_byte_size: number
          accepted_pdf_mime_type: string
          accepted_pdf_sha256: string
          accepted_pdf_state: string
          accepted_pdf_uploaded_at: string
          accepted_total_amount: number
          accepted_valid_until: string
          accepted_version_id: string
          accepted_version_number: number
          accepted_version_status: string
          accepted_version_title: string
          advisor_name: string
          cancelled_at: string
          contact_email: string
          contact_id: string
          contact_name: string
          contact_phone: string
          created_at: string
          current_currency: string
          current_deposit_amount: number
          current_document_id: string
          current_finalized_at: string
          current_pdf_byte_size: number
          current_pdf_mime_type: string
          current_pdf_sha256: string
          current_pdf_state: string
          current_pdf_uploaded_at: string
          current_total_amount: number
          current_updated_at: string
          current_valid_until: string
          current_version_id: string
          current_version_number: number
          current_version_status: string
          current_version_title: string
          deleted_at: string
          deleted_by: string
          deleted_reason: string
          expired_at: string
          lock_version: number
          next_version_number: number
          opportunity_id: string
          opportunity_label: string
          owner_id: string
          page_has_more: boolean
          quote_id: string
          quote_number: string
          ready_at: string
          rejected_at: string
          request_count: number
          sent_at: string
          status: string
          title: string
          updated_at: string
          version_count: number
        }[]
      }
      crm_quote_profile_label: {
        Args: { p_profile_id: string; p_quote_id: string }
        Returns: string
      }
      crm_quote_registration_intent: {
        Args: { p_intent_id: string }
        Returns: {
          abandoned_at: string
          attempt_count: number
          attempt_started_at: string
          bucket: string
          cleanup_allowed: boolean
          contact_id: string
          created_at: string
          expected_mime_type: string
          expected_size_bytes: number
          expires_at: string
          failed_at: string
          finalized_at: string
          intent_id: string
          intent_status: string
          last_error_code: string
          last_error_message: string
          opportunity_id: string
          originating_request_id: string
          path: string
          recovery_deadline: string
          retry_allowed: boolean
          target_document_id: string
          target_quote_id: string
          target_quote_version_id: string
          updated_at: string
          upload_allowed: boolean
        }[]
      }
      crm_quote_request_link_page: {
        Args: {
          p_after_created_at?: string
          p_after_id?: string
          p_limit?: number
          p_quote_id: string
        }
        Returns: {
          destination_slug: string
          link_id: string
          linked_at: string
          linked_by: string
          linked_by_name: string
          page_has_more: boolean
          quote_id: string
          quote_request_id: string
          relation: string
          request_created_at: string
          request_locale: string
          request_status: string
          service_slug: string
        }[]
      }
      crm_quote_version_page: {
        Args: {
          p_after_id?: string
          p_after_version_number?: number
          p_limit?: number
          p_quote_id: string
        }
        Returns: {
          accepted_at: string
          content_sha256: string
          created_at: string
          created_by: string
          created_by_name: string
          currency: string
          deposit_amount: number
          document_id: string
          expired_at: string
          finalized_at: string
          finalized_by: string
          finalized_by_name: string
          notes: string
          page_has_more: boolean
          pdf_bucket: string
          pdf_byte_size: number
          pdf_mime_type: string
          pdf_path: string
          pdf_sha256: string
          pdf_state: string
          pdf_uploaded_at: string
          quote_id: string
          quote_request_id: string
          quote_version_id: string
          rejected_at: string
          sent_at: string
          status: string
          summary: string
          title: string
          total_amount: number
          updated_at: string
          valid_until: string
          version_number: number
        }[]
      }
      crm_record_quote_mutation: {
        Args: {
          p_actor_id: string
          p_event_type: string
          p_extra_payload?: Json
          p_idempotency_key: string
          p_next_status: string
          p_previous_status: string
          p_quote_id: string
          p_quote_version_id: string
        }
        Returns: boolean
      }
      crm_register_quote_with_pdf: {
        Args: {
          p_intent_id: string
          p_verified_sha256: string
          p_verified_size_bytes: number
        }
        Returns: {
          document_id: string
          document_state: string
          idempotent_replay: boolean
          intent_id: string
          lock_version: number
          quote_id: string
          quote_number: string
          quote_status: string
          quote_version_id: string
          version_number: number
          version_status: string
        }[]
      }
      crm_reject_quote: {
        Args: {
          p_expected_lock_version: number
          p_idempotency_key: string
          p_quote_id: string
          p_quote_version_id: string
        }
        Returns: {
          accepted_version_id: string
          idempotent_replay: boolean
          lock_version: number
          quote_id: string
          quote_number: string
          quote_status: string
          quote_version_id: string
          superseded_quote_id: string
          version_number: number
          version_status: string
        }[]
      }
      crm_resolve_opportunity_lead: {
        Args: {
          p_assigned_to?: string
          p_budget_mxn?: number
          p_budget_usd?: number
          p_contact_id: string
          p_destination_id?: string
          p_opportunity_basis?: Json
          p_opportunity_signature?: string
          p_opportunity_signature_version?: number
          p_priority?: string
          p_service_id?: string
          p_source?: string
          p_status_id: string
          p_summary?: string
          p_travel_end_date?: string
          p_travel_start_date?: string
          p_travelers_count?: number
        }
        Returns: {
          basis: Json
          created_new: boolean
          lead_id: string
          reliable_purpose: boolean
          resolution_status: string
          review_required: boolean
          signature: string
          signature_version: number
        }[]
      }
      crm_restore_quote: {
        Args: {
          p_confirmation: string
          p_expected_lock_version: number
          p_idempotency_key: string
          p_quote_id: string
        }
        Returns: {
          deleted_at: string
          idempotent_replay: boolean
          lock_version: number
          quote_id: string
          quote_number: string
          quote_status: string
          restored: boolean
        }[]
      }
      crm_soft_delete_quote: {
        Args: {
          p_confirmation: string
          p_expected_lock_version: number
          p_idempotency_key: string
          p_quote_id: string
          p_reason: string
        }
        Returns: {
          deleted: boolean
          deleted_at: string
          idempotent_replay: boolean
          lock_version: number
          quote_id: string
          quote_number: string
          quote_status: string
        }[]
      }
      crm_transition_quote: {
        Args: {
          p_action: string
          p_expected_accepted_quote_id: string
          p_expected_lock_version: number
          p_idempotency_key: string
          p_quote_id: string
          p_quote_version_id: string
          p_supersede_reason: string
        }
        Returns: {
          accepted_version_id: string
          idempotent_replay: boolean
          lock_version: number
          quote_id: string
          quote_number: string
          quote_status: string
          quote_version_id: string
          superseded_quote_id: string
          version_number: number
          version_status: string
        }[]
      }
      crm_validate_quote_commercial_input: {
        Args: {
          p_currency: string
          p_deposit_amount: number
          p_idempotency_key: string
          p_notes: string
          p_summary: string
          p_title: string
          p_total_amount: number
        }
        Returns: undefined
      }
      has_role: { Args: { role_name: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_assigned_lead: { Args: { lead_uuid: string }; Returns: boolean }
      task_actor_can_manage: { Args: { p_owner_id: string }; Returns: boolean }
      task_transition: {
        Args: { p_target_status: string; p_task_id: string }
        Returns: {
          created_at: string
          description: string
          due_at: string
          id: string
          idempotency_key: string
          lead_id: string | null
          owner_id: string
          quote_id: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
