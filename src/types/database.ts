export type JobStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type TechnicianStatus = 'pending' | 'available' | 'busy' | 'off_duty' | 'on_break'
export type PhoneCallStatus = 'in_progress' | 'answered' | 'missed' | 'called_back' | 'converted'

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          owner_id: string
          full_name: string | null
          company_name: string | null
          theme: 'light' | 'dark' | 'system' | string | null
          accent_color: string | null
          service_area_radius: number | null
          retell_agent_id: string | null
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          stripe_details_submitted: boolean
          stripe_analytics_key_hint: string | null
          stripe_analytics_last_sync_at: string | null
          vip_threshold_cents: number
          logo_url: string | null
          business_phone: string | null
          rings_before_ai: number
          business_hours: unknown
          after_hours_message: string | null
          business_address: string | null
          business_lat: number | null
          business_lng: number | null
          service_radius_miles: number | null
          covered_cities: unknown
          service_area_center_lat: number | null
          service_area_center_lng: number | null
          onboarding_welcome_dismissed: boolean
          onboarding_checklist: unknown
          onboarding_completed_at: string | null
          margen_phone_number: string | null
          margen_phone_digits: string | null
          margen_phone_sid: string | null
          twilio_forwarding_code: string | null
          carrier: string | null
          call_forwarding_active: boolean
          created_at: string
        }
        Insert: {
          id: string
          owner_id?: string
          full_name?: string | null
          company_name?: string | null
          theme?: 'light' | 'dark' | 'system' | string | null
          accent_color?: string | null
          service_area_radius?: number | null
          retell_agent_id?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_details_submitted?: boolean
          stripe_analytics_key_hint?: string | null
          stripe_analytics_last_sync_at?: string | null
          vip_threshold_cents?: number
          logo_url?: string | null
          business_phone?: string | null
          rings_before_ai?: number
          business_hours?: unknown
          after_hours_message?: string | null
          business_address?: string | null
          business_lat?: number | null
          business_lng?: number | null
          service_radius_miles?: number | null
          covered_cities?: unknown
          service_area_center_lat?: number | null
          service_area_center_lng?: number | null
          onboarding_welcome_dismissed?: boolean
          onboarding_checklist?: unknown
          onboarding_completed_at?: string | null
          margen_phone_number?: string | null
          margen_phone_sid?: string | null
          twilio_forwarding_code?: string | null
          carrier?: string | null
          call_forwarding_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          full_name?: string | null
          company_name?: string | null
          theme?: 'light' | 'dark' | 'system' | string | null
          accent_color?: string | null
          service_area_radius?: number | null
          retell_agent_id?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_details_submitted?: boolean
          stripe_analytics_key_hint?: string | null
          stripe_analytics_last_sync_at?: string | null
          vip_threshold_cents?: number
          logo_url?: string | null
          business_phone?: string | null
          rings_before_ai?: number
          business_hours?: unknown
          after_hours_message?: string | null
          business_address?: string | null
          business_lat?: number | null
          business_lng?: number | null
          service_radius_miles?: number | null
          covered_cities?: unknown
          service_area_center_lat?: number | null
          service_area_center_lng?: number | null
          onboarding_welcome_dismissed?: boolean
          onboarding_checklist?: unknown
          onboarding_completed_at?: string | null
          margen_phone_number?: string | null
          margen_phone_sid?: string | null
          twilio_forwarding_code?: string | null
          carrier?: string | null
          call_forwarding_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          id: string
          owner_id: string
          name: string
          phone: string | null
          phone_normalized: string | null
          email: string | null
          address: string | null
          lat: number | null
          lng: number | null
          owner_notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          phone?: string | null
          phone_normalized?: string | null
          email?: string | null
          address?: string | null
          lat?: number | null
          lng?: number | null
          owner_notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          phone?: string | null
          phone_normalized?: string | null
          email?: string | null
          address?: string | null
          lat?: number | null
          lng?: number | null
          owner_notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      technicians: {
        Row: {
          id: string
          owner_id: string
          user_id: string | null
          name: string
          phone: string | null
          email: string | null
          role: string | null
          status: TechnicianStatus
          skills: string[]
          map_color: string
          last_lat: number | null
          last_lng: number | null
          last_location_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          user_id?: string | null
          name: string
          phone?: string | null
          email?: string | null
          role?: string | null
          status?: TechnicianStatus
          skills?: string[]
          map_color?: string
          last_lat?: number | null
          last_lng?: number | null
          last_location_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          user_id?: string | null
          name?: string
          phone?: string | null
          email?: string | null
          role?: string | null
          status?: TechnicianStatus
          skills?: string[]
          map_color?: string
          last_lat?: number | null
          last_lng?: number | null
          last_location_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      technician_invites: {
        Row: {
          id: string
          token: string
          owner_id: string
          technician_id: string
          invited_name: string
          invited_phone: string | null
          role: string
          expires_at: string
          consumed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          token: string
          owner_id: string
          technician_id: string
          invited_name: string
          invited_phone?: string | null
          role: string
          expires_at?: string
          consumed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          token?: string
          owner_id?: string
          technician_id?: string
          invited_name?: string
          invited_phone?: string | null
          role?: string
          expires_at?: string
          consumed_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      technician_clock_sessions: {
        Row: {
          id: string
          technician_id: string
          owner_id: string
          clock_in_at: string
          clock_out_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          technician_id: string
          owner_id: string
          clock_in_at?: string
          clock_out_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          technician_id?: string
          owner_id?: string
          clock_in_at?: string
          clock_out_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      job_customer_ratings: {
        Row: {
          id: string
          job_id: string
          owner_id: string
          rating_token: string
          rating: number | null
          comment: string | null
          submitted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          job_id: string
          owner_id: string
          rating_token: string
          rating?: number | null
          comment?: string | null
          submitted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          owner_id?: string
          rating_token?: string
          rating?: number | null
          comment?: string | null
          submitted_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'job_customer_ratings_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'jobs'
            referencedColumns: ['id']
          },
        ]
      }
      jobs: {
        Row: {
          id: string
          owner_id: string
          customer_id: string | null
          technician_id: string | null
          title: string
          description: string | null
          address: string | null
          latitude: number | null
          longitude: number | null
          job_type: string
          urgency: string
          status: JobStatus
          scheduled_at: string | null
          completed_at: string | null
          cancelled_at: string | null
          cancel_reason: 'customer_cancelled' | 'technician_unavailable' | 'rescheduled' | null
          cancel_reason_details: string | null
          cancelled_by: string | null
          assignment_note: string | null
          needs_approval: boolean
          source: string | null
          source_phone_call_id: string | null
          emergency_created_at: string | null
          emergency_assigned_at: string | null
          emergency_ack_deadline_at: string | null
          emergency_ack_at: string | null
          emergency_ack_by: string | null
          emergency_assignment_attempt: number
          emergency_tried_technician_ids: string[]
          paid_at: string | null
          is_paid: boolean
          revenue_cents: number
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          customer_id?: string | null
          technician_id?: string | null
          title: string
          description?: string | null
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          job_type?: string
          urgency?: string
          status?: JobStatus
          scheduled_at?: string | null
          completed_at?: string | null
          cancelled_at?: string | null
          cancel_reason?: 'customer_cancelled' | 'technician_unavailable' | 'rescheduled' | null
          cancel_reason_details?: string | null
          cancelled_by?: string | null
          assignment_note?: string | null
          needs_approval?: boolean
          source?: string | null
          source_phone_call_id?: string | null
          emergency_created_at?: string | null
          emergency_assigned_at?: string | null
          emergency_ack_deadline_at?: string | null
          emergency_ack_at?: string | null
          emergency_ack_by?: string | null
          emergency_assignment_attempt?: number
          emergency_tried_technician_ids?: string[]
          paid_at?: string | null
          is_paid?: boolean
          revenue_cents?: number
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          customer_id?: string | null
          technician_id?: string | null
          title?: string
          description?: string | null
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          job_type?: string
          urgency?: string
          status?: JobStatus
          scheduled_at?: string | null
          completed_at?: string | null
          cancelled_at?: string | null
          cancel_reason?: 'customer_cancelled' | 'technician_unavailable' | 'rescheduled' | null
          cancel_reason_details?: string | null
          cancelled_by?: string | null
          assignment_note?: string | null
          needs_approval?: boolean
          source?: string | null
          source_phone_call_id?: string | null
          emergency_created_at?: string | null
          emergency_assigned_at?: string | null
          emergency_ack_deadline_at?: string | null
          emergency_ack_at?: string | null
          emergency_ack_by?: string | null
          emergency_assignment_attempt?: number
          emergency_tried_technician_ids?: string[]
          paid_at?: string | null
          is_paid?: boolean
          revenue_cents?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'jobs_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'jobs_technician_id_fkey'
            columns: ['technician_id']
            isOneToOne: false
            referencedRelation: 'technicians'
            referencedColumns: ['id']
          },
        ]
      }
      job_assignment_decisions: {
        Row: {
          id: string
          owner_id: string
          job_id: string
          kind: 'auto' | 'manual' | 'failed'
          chosen_technician_id: string | null
          emergency: boolean
          job_type: string | null
          reason: string
          distance_meters: number | null
          distance_text: string | null
          duration_seconds: number | null
          candidate_count: number
          candidates: unknown
          raw_distance_matrix: unknown | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          job_id: string
          kind: 'auto' | 'manual' | 'failed'
          chosen_technician_id?: string | null
          emergency?: boolean
          job_type?: string | null
          reason: string
          distance_meters?: number | null
          distance_text?: string | null
          duration_seconds?: number | null
          candidate_count?: number
          candidates?: unknown
          raw_distance_matrix?: unknown | null
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          job_id?: string
          kind?: 'auto' | 'manual' | 'failed'
          chosen_technician_id?: string | null
          emergency?: boolean
          job_type?: string | null
          reason?: string
          distance_meters?: number | null
          distance_text?: string | null
          duration_seconds?: number | null
          candidate_count?: number
          candidates?: unknown
          raw_distance_matrix?: unknown | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'job_assignment_decisions_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'jobs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'job_assignment_decisions_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'job_assignment_decisions_chosen_technician_id_fkey'
            columns: ['chosen_technician_id']
            isOneToOne: false
            referencedRelation: 'technicians'
            referencedColumns: ['id']
          },
        ]
      }
      invoices: {
        Row: {
          id: string
          owner_id: string
          job_id: string | null
          customer_id: string | null
          technician_id: string | null
          status: 'draft' | 'sent' | 'paid' | 'void'
          amount_cents: number
          currency: string
          invoice_number: number
          stripe_checkout_session_id: string | null
          stripe_checkout_url: string | null
          stripe_payment_intent_id: string | null
          sms_to: string | null
          sent_at: string | null
          last_reminder_at: string | null
          paid_at: string | null
          payment_confirmation_token: string | null
          payment_confirmation_sent_at: string | null
          payment_confirmation_deadline_at: string | null
          payment_method: string | null
          payment_confirmed_at: string | null
          owner_payment_reminder_sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          job_id?: string | null
          customer_id?: string | null
          technician_id?: string | null
          status?: 'draft' | 'sent' | 'paid' | 'void'
          amount_cents?: number
          currency?: string
          invoice_number?: number
          stripe_checkout_session_id?: string | null
          stripe_checkout_url?: string | null
          stripe_payment_intent_id?: string | null
          sms_to?: string | null
          sent_at?: string | null
          last_reminder_at?: string | null
          paid_at?: string | null
          payment_confirmation_token?: string | null
          payment_confirmation_sent_at?: string | null
          payment_confirmation_deadline_at?: string | null
          payment_method?: string | null
          payment_confirmed_at?: string | null
          owner_payment_reminder_sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          job_id?: string | null
          customer_id?: string | null
          technician_id?: string | null
          status?: 'draft' | 'sent' | 'paid' | 'void'
          amount_cents?: number
          currency?: string
          invoice_number?: number
          stripe_checkout_session_id?: string | null
          stripe_checkout_url?: string | null
          stripe_payment_intent_id?: string | null
          sms_to?: string | null
          sent_at?: string | null
          last_reminder_at?: string | null
          paid_at?: string | null
          payment_confirmation_token?: string | null
          payment_confirmation_sent_at?: string | null
          payment_confirmation_deadline_at?: string | null
          payment_method?: string | null
          payment_confirmed_at?: string | null
          owner_payment_reminder_sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invoices_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'jobs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_technician_id_fkey'
            columns: ['technician_id']
            isOneToOne: false
            referencedRelation: 'technicians'
            referencedColumns: ['id']
          },
        ]
      }
      subscriptions: {
        Row: {
          id: string
          owner_id: string
          stripe_customer_id: string
          stripe_subscription_id: string
          plan: 'starter' | 'growth' | 'scale'
          status: string
          current_period_end: string | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          stripe_customer_id: string
          stripe_subscription_id: string
          plan: 'starter' | 'growth' | 'scale'
          status: string
          current_period_end?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          plan?: 'starter' | 'growth' | 'scale'
          status?: string
          current_period_end?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'subscriptions_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      stripe_ledger_lines: {
        Row: {
          id: string
          owner_id: string
          stripe_balance_txn_id: string
          amount_cents: number
          fee_cents: number
          currency: string
          reporting_category: string | null
          txn_type: string | null
          description: string | null
          available_on: string | null
          stripe_created_at: string
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          stripe_balance_txn_id: string
          amount_cents: number
          fee_cents?: number
          currency?: string
          reporting_category?: string | null
          txn_type?: string | null
          description?: string | null
          available_on?: string | null
          stripe_created_at: string
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          stripe_balance_txn_id?: string
          amount_cents?: number
          fee_cents?: number
          currency?: string
          reporting_category?: string | null
          txn_type?: string | null
          description?: string | null
          available_on?: string | null
          stripe_created_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'stripe_ledger_lines_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          owner_id: string
          type: string | null
          title: string
          message: string | null
          link: string | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          type?: string | null
          title: string
          message?: string | null
          link?: string | null
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          type?: string | null
          title?: string
          message?: string | null
          link?: string | null
          read?: boolean
          created_at?: string
        }
        Relationships: []
      }
      expo_push_tokens: {
        Row: {
          id: string
          owner_id: string
          user_id: string
          token: string
          platform: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          user_id: string
          token: string
          platform?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          user_id?: string
          token?: string
          platform?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      technician_location_events: {
        Row: {
          id: string
          owner_id: string
          technician_id: string
          recorded_at: string
          lat: number
          lng: number
        }
        Insert: {
          id?: string
          owner_id: string
          technician_id: string
          recorded_at?: string
          lat: number
          lng: number
        }
        Update: {
          id?: string
          owner_id?: string
          technician_id?: string
          recorded_at?: string
          lat?: number
          lng?: number
        }
        Relationships: []
      }
      missed_calls: {
        Row: {
          id: string
          owner_id: string
          caller_phone: string | null
          occurred_at: string
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          caller_phone?: string | null
          occurred_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          caller_phone?: string | null
          occurred_at?: string
          created_at?: string
        }
        Relationships: []
      }
      phone_calls: {
        Row: {
          id: string
          owner_id: string
          customer_id: string | null
          caller_phone: string | null
          caller_phone_normalized: string | null
          occurred_at: string
          status: PhoneCallStatus
          estimated_value_cents: number
          duration_seconds: number | null
          ended_at: string | null
          twilio_call_sid: string | null
          twilio_from: string | null
          twilio_to: string | null
          ai_handled: boolean
          bland_call_id: string | null
          transcript: string | null
          transcript_summary: string | null
          recording_url: string | null
          collected: unknown
          converted_job_id: string | null
          converted_at: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          customer_id?: string | null
          caller_phone?: string | null
          caller_phone_normalized?: string | null
          occurred_at?: string
          status?: PhoneCallStatus
          estimated_value_cents?: number
          duration_seconds?: number | null
          ended_at?: string | null
          twilio_call_sid?: string | null
          twilio_from?: string | null
          twilio_to?: string | null
          ai_handled?: boolean
          bland_call_id?: string | null
          transcript?: string | null
          transcript_summary?: string | null
          recording_url?: string | null
          collected?: unknown
          converted_job_id?: string | null
          converted_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          customer_id?: string | null
          caller_phone?: string | null
          caller_phone_normalized?: string | null
          occurred_at?: string
          status?: PhoneCallStatus
          estimated_value_cents?: number
          duration_seconds?: number | null
          ended_at?: string | null
          twilio_call_sid?: string | null
          twilio_from?: string | null
          twilio_to?: string | null
          ai_handled?: boolean
          bland_call_id?: string | null
          transcript?: string | null
          transcript_summary?: string | null
          recording_url?: string | null
          collected?: unknown
          converted_job_id?: string | null
          converted_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      ai_receptionist_settings: {
        Row: {
          id: string
          owner_id: string
          company_name: string | null
          greeting_message: string | null
          sign_off_message: string | null
          flow_steps: unknown
          voice_id: string | null
          business_hours: unknown
          after_hours_message: string | null
          escalation_rules: unknown
          retell_llm_id: string | null
          retell_agent_id: string | null
          retell_phone_number: string | null
          created_at: string
          /** Present on DBs that ran migration 016/022 before 026 */
          updated_at?: string
        }
        Insert: {
          id?: string
          owner_id: string
          company_name?: string | null
          greeting_message?: string | null
          sign_off_message?: string | null
          flow_steps?: unknown
          voice_id?: string | null
          business_hours?: unknown
          after_hours_message?: string | null
          escalation_rules?: unknown
          retell_llm_id?: string | null
          retell_agent_id?: string | null
          retell_phone_number?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          company_name?: string | null
          greeting_message?: string | null
          sign_off_message?: string | null
          flow_steps?: unknown
          voice_id?: string | null
          business_hours?: unknown
          after_hours_message?: string | null
          escalation_rules?: unknown
          retell_llm_id?: string | null
          retell_agent_id?: string | null
          retell_phone_number?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      customer_summary: {
        Row: {
          customer_id: string
          owner_id: string
          name: string
          phone: string | null
          email: string | null
          address: string | null
          notes: string | null
          lifetime_value_cents: number
          last_service_at: string | null
          total_jobs: number
          is_vip: boolean
        }
        Relationships: []
      }
      technicians_live: {
        Row: {
          id: string
          owner_id: string
          name: string
          map_color: string | null
          last_lat: number | null
          last_lng: number | null
          last_location_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      sync_dev_bypass_subscription: {
        Args: Record<string, never>
        Returns: undefined
      }
      lookup_technician_invite: {
        Args: { p_token: string }
        Returns: unknown
      }
      submit_customer_rating: {
        Args: { p_token: string; p_rating: number; p_comment: string }
        Returns: boolean
      }
      submit_payment_confirmation: {
        Args: { p_token: string; p_method: string }
        Returns: boolean
      }
      get_payment_confirmation_details: {
        Args: { p_token: string }
        Returns: unknown
      }
    }
    Enums: Record<string, never>
  }
}
