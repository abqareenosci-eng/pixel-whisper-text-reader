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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          amount: number | null
          booking_reference: string
          business_id: string
          created_at: string
          currency: string
          destination: string | null
          end_date: string | null
          fawry_expires_at: string | null
          fawry_fees: number | null
          fawry_merchant_ref: string | null
          fawry_reference_number: string | null
          fawry_status: string | null
          id: string
          identity_id: string | null
          notes: string | null
          origin: string | null
          paid_at: string | null
          payment_method: string | null
          payment_proof_path: string | null
          payment_reference: string | null
          payment_rejection_reason: string | null
          payment_reviewed_at: string | null
          payment_reviewed_by: string | null
          payment_status: string
          payment_submitted_at: string | null
          service_type: string
          start_date: string
          status: string
          traveler_user_id: string
        }
        Insert: {
          amount?: number | null
          booking_reference?: string
          business_id: string
          created_at?: string
          currency?: string
          destination?: string | null
          end_date?: string | null
          fawry_expires_at?: string | null
          fawry_fees?: number | null
          fawry_merchant_ref?: string | null
          fawry_reference_number?: string | null
          fawry_status?: string | null
          id?: string
          identity_id?: string | null
          notes?: string | null
          origin?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_proof_path?: string | null
          payment_reference?: string | null
          payment_rejection_reason?: string | null
          payment_reviewed_at?: string | null
          payment_reviewed_by?: string | null
          payment_status?: string
          payment_submitted_at?: string | null
          service_type?: string
          start_date?: string
          status?: string
          traveler_user_id: string
        }
        Update: {
          amount?: number | null
          booking_reference?: string
          business_id?: string
          created_at?: string
          currency?: string
          destination?: string | null
          end_date?: string | null
          fawry_expires_at?: string | null
          fawry_fees?: number | null
          fawry_merchant_ref?: string | null
          fawry_reference_number?: string | null
          fawry_status?: string | null
          id?: string
          identity_id?: string | null
          notes?: string | null
          origin?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_proof_path?: string | null
          payment_reference?: string | null
          payment_rejection_reason?: string | null
          payment_reviewed_at?: string | null
          payment_reviewed_by?: string | null
          payment_status?: string
          payment_submitted_at?: string | null
          service_type?: string
          start_date?: string
          status?: string
          traveler_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_identity_id_fkey"
            columns: ["identity_id"]
            isOneToOne: false
            referencedRelation: "identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_payment_reviewed_by_fkey"
            columns: ["payment_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_traveler_user_id_fkey"
            columns: ["traveler_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          business_name: string
          business_type: string
          city: string
          country: string
          created_at: string
          id: string
          instapay_address: string | null
          payment_instructions: string | null
          user_id: string
          verified: boolean
          vodafone_cash_number: string | null
        }
        Insert: {
          address?: string | null
          business_name: string
          business_type?: string
          city?: string
          country?: string
          created_at?: string
          id?: string
          instapay_address?: string | null
          payment_instructions?: string | null
          user_id: string
          verified?: boolean
          vodafone_cash_number?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string
          business_type?: string
          city?: string
          country?: string
          created_at?: string
          id?: string
          instapay_address?: string | null
          payment_instructions?: string | null
          user_id?: string
          verified?: boolean
          vodafone_cash_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      identities: {
        Row: {
          created_at: string
          date_of_birth: string | null
          document_type: string
          expiry_date: string | null
          full_name: string
          gender: string | null
          id: string
          issue_date: string | null
          issuing_country: string | null
          nationality: string
          passport_number: string
          passport_type: string | null
          place_of_birth: string | null
          qr_token: string
          status: string
          updated_at: string
          user_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          document_type?: string
          expiry_date?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          issue_date?: string | null
          issuing_country?: string | null
          nationality?: string
          passport_number?: string
          passport_type?: string | null
          place_of_birth?: string | null
          qr_token?: string
          status?: string
          updated_at?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          document_type?: string
          expiry_date?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          issue_date?: string | null
          issuing_country?: string | null
          nationality?: string
          passport_number?: string
          passport_type?: string | null
          place_of_birth?: string | null
          qr_token?: string
          status?: string
          updated_at?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "identities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mismatch_reports: {
        Row: {
          admin_notes: string | null
          business_id: string
          created_at: string
          details: string | null
          id: string
          identity_id: string | null
          report_reason: string
          resolved_at: string | null
          status: string
          traveler_user_id: string
          verification_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          business_id: string
          created_at?: string
          details?: string | null
          id?: string
          identity_id?: string | null
          report_reason?: string
          resolved_at?: string | null
          status?: string
          traveler_user_id: string
          verification_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          business_id?: string
          created_at?: string
          details?: string | null
          id?: string
          identity_id?: string | null
          report_reason?: string
          resolved_at?: string | null
          status?: string
          traveler_user_id?: string
          verification_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mismatch_reports_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mismatch_reports_identity_id_fkey"
            columns: ["identity_id"]
            isOneToOne: false
            referencedRelation: "identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mismatch_reports_traveler_user_id_fkey"
            columns: ["traveler_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mismatch_reports_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "verifications"
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
          phone: string | null
          role: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          role?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verifications: {
        Row: {
          business_id: string
          created_at: string
          id: string
          identity_id: string | null
          notes: string | null
          qr_token_scanned: string
          result: string
          traveler_user_id: string | null
          verified_fields: Json | null
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          identity_id?: string | null
          notes?: string | null
          qr_token_scanned?: string
          result?: string
          traveler_user_id?: string | null
          verified_fields?: Json | null
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          identity_id?: string | null
          notes?: string | null
          qr_token_scanned?: string
          result?: string
          traveler_user_id?: string | null
          verified_fields?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "verifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_identity_id_fkey"
            columns: ["identity_id"]
            isOneToOne: false
            referencedRelation: "identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_traveler_user_id_fkey"
            columns: ["traveler_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_identity_verified: {
        Args: { _identity_id: string; _verified: boolean }
        Returns: undefined
      }
      choose_initial_role: {
        Args: { _full_name: string; _role: string }
        Returns: undefined
      }
      fawry_apply_status: {
        Args: {
          _booking_id: string
          _fawry_reference: string
          _fees: number
          _status: string
        }
        Returns: undefined
      }
      fawry_attach_voucher: {
        Args: {
          _booking_id: string
          _expires_at: string
          _fees: number
          _merchant_ref: string
          _reference: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      owns_booking_business: { Args: { _booking_id: string }; Returns: boolean }
      review_booking_payment: {
        Args: { _booking_id: string; _decision: string; _reason?: string }
        Returns: undefined
      }
      submit_booking_payment: {
        Args: {
          _booking_id: string
          _method: string
          _proof_path: string
          _reference: string
        }
        Returns: undefined
      }
      traveler_linked_to_business: {
        Args: { _business_id: string }
        Returns: boolean
      }
      verify_traveler_qr: { Args: { _token: string }; Returns: Json }
    }
    Enums: {
      app_role: "traveler" | "business" | "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["traveler", "business", "admin"],
    },
  },
} as const
