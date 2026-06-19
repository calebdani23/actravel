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
      bookings: {
        Row: {
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
          consent_marketing: boolean
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string | null
          notes: string | null
          phone: string | null
          preferred_locale: string
          source: string | null
          updated_at: string
        }
        Insert: {
          consent_marketing?: boolean
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          preferred_locale?: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          consent_marketing?: boolean
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          preferred_locale?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      destinations: {
        Row: {
          country: string
          created_at: string
          detail_sections_en: Json | null
          detail_sections_es: Json | null
          description_en: string | null
          description_es: string | null
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
          detail_sections_en?: Json | null
          detail_sections_es?: Json | null
          description_en?: string | null
          description_es?: string | null
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
          detail_sections_en?: Json | null
          detail_sections_es?: Json | null
          description_en?: string | null
          description_es?: string | null
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
          contact_id: string | null
          created_at: string
          document_type: string
          id: string
          lead_id: string | null
          path: string
          status: string
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          booking_id?: string | null
          bucket?: string
          contact_id?: string | null
          created_at?: string
          document_type?: string
          id?: string
          lead_id?: string | null
          path: string
          status?: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          booking_id?: string | null
          bucket?: string
          contact_id?: string | null
          created_at?: string
          document_type?: string
          id?: string
          lead_id?: string | null
          path?: string
          status?: string
          title?: string
          updated_at?: string
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
            foreignKeyName: "documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
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
          assigned_to: string | null
          budget_mxn: number | null
          budget_usd: number | null
          contact_id: string
          created_at: string
          destination_id: string | null
          id: string
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
          assigned_to?: string | null
          budget_mxn?: number | null
          budget_usd?: number | null
          contact_id: string
          created_at?: string
          destination_id?: string | null
          id?: string
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
          assigned_to?: string | null
          budget_mxn?: number | null
          budget_usd?: number | null
          contact_id?: string
          created_at?: string
          destination_id?: string | null
          id?: string
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
        ]
      }
      packages: {
        Row: {
          created_at: string
          detail_sections_en: Json | null
          detail_sections_es: Json | null
          description_en: string | null
          description_es: string | null
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
          detail_sections_en?: Json | null
          detail_sections_es?: Json | null
          description_en?: string | null
          description_es?: string | null
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
          detail_sections_en?: Json | null
          detail_sections_es?: Json | null
          description_en?: string | null
          description_es?: string | null
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
          detail_sections_en: Json | null
          detail_sections_es: Json | null
          description_en: string | null
          description_es: string | null
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
          detail_sections_en?: Json | null
          detail_sections_es?: Json | null
          description_en?: string | null
          description_es?: string | null
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
          detail_sections_en?: Json | null
          detail_sections_es?: Json | null
          description_en?: string | null
          description_es?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: { Args: { role_name: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_assigned_lead: { Args: { lead_uuid: string }; Returns: boolean }
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
