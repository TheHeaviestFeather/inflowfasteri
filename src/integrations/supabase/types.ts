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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_requests: {
        Row: {
          artifact_generated: boolean
          artifact_type: string | null
          created_at: string
          id: string
          latency_ms: number | null
          message_count: number
          model: string
          parse_errors: string[] | null
          parsed_successfully: boolean
          project_id: string | null
          prompt_version: string | null
          raw_output: string | null
          request_id: string
          tokens_in: number | null
          tokens_out: number | null
          user_id: string
        }
        Insert: {
          artifact_generated?: boolean
          artifact_type?: string | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          message_count: number
          model: string
          parse_errors?: string[] | null
          parsed_successfully?: boolean
          project_id?: string | null
          prompt_version?: string | null
          raw_output?: string | null
          request_id: string
          tokens_in?: number | null
          tokens_out?: number | null
          user_id: string
        }
        Update: {
          artifact_generated?: boolean
          artifact_type?: string | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          message_count?: number
          model?: string
          parse_errors?: string[] | null
          parsed_successfully?: boolean
          project_id?: string | null
          prompt_version?: string | null
          raw_output?: string | null
          request_id?: string
          tokens_in?: number | null
          tokens_out?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      artifact_versions: {
        Row: {
          artifact_id: string
          artifact_type: string
          content: string
          created_at: string
          id: string
          project_id: string
          version: number
        }
        Insert: {
          artifact_id: string
          artifact_type: string
          content: string
          created_at?: string
          id?: string
          project_id: string
          version: number
        }
        Update: {
          artifact_id?: string
          artifact_type?: string
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "artifact_versions_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artifact_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artifact_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      artifacts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          artifact_type: string
          content: string
          created_at: string
          id: string
          project_id: string
          prompt_version: string | null
          stale_reason: string | null
          status: string
          updated_at: string
          updated_by_message_id: string | null
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          artifact_type: string
          content?: string
          created_at?: string
          id?: string
          project_id: string
          prompt_version?: string | null
          stale_reason?: string | null
          status?: string
          updated_at?: string
          updated_by_message_id?: string | null
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          artifact_type?: string
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          prompt_version?: string | null
          stale_reason?: string | null
          status?: string
          updated_at?: string
          updated_by_message_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "artifacts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artifacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artifacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          project_id: string
          prompt_version: string | null
          role: string
          sequence: number
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          project_id: string
          prompt_version?: string | null
          role: string
          sequence?: never
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          project_id?: string
          prompt_version?: string | null
          role?: string
          sequence?: never
        }
        Relationships: [
          {
            foreignKeyName: "messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_metrics: {
        Row: {
          completed_at: string | null
          created_at: string
          first_approval_at: string | null
          first_artifact_at: string | null
          project_id: string
          started_at: string
          total_artifacts: number | null
          total_messages: number | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          first_approval_at?: string | null
          first_artifact_at?: string | null
          project_id: string
          started_at?: string
          total_artifacts?: number | null
          total_messages?: number | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          first_approval_at?: string | null
          first_artifact_at?: string | null
          project_id?: string
          started_at?: string
          total_artifacts?: number | null
          total_messages?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_metrics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_metrics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      project_state: {
        Row: {
          id: string
          project_id: string
          prompt_version: string | null
          state_json: Json
          updated_at: string
          updated_by_message_id: string | null
        }
        Insert: {
          id?: string
          project_id: string
          prompt_version?: string | null
          state_json?: Json
          updated_at?: string
          updated_by_message_id?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          prompt_version?: string | null
          state_json?: Json
          updated_at?: string
          updated_by_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_state_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_state_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_name: string | null
          created_at: string
          current_stage: string | null
          description: string | null
          id: string
          mode: string
          name: string
          prompt_version: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          current_stage?: string | null
          description?: string | null
          id?: string
          mode?: string
          name: string
          prompt_version?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_name?: string | null
          created_at?: string
          current_stage?: string | null
          description?: string | null
          id?: string
          mode?: string
          name?: string
          prompt_version?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          request_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          request_count?: number
          user_id: string
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          request_count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      response_cache: {
        Row: {
          created_at: string
          expires_at: string
          hit_count: number
          id: string
          last_hit_at: string | null
          model: string
          prompt_hash: string
          prompt_version: string
          response: string
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          hit_count?: number
          id?: string
          last_hit_at?: string | null
          model: string
          prompt_hash: string
          prompt_version: string
          response: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          hit_count?: number
          id?: string
          last_hit_at?: string | null
          model?: string
          prompt_hash?: string
          prompt_version?: string
          response?: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: []
      }
      system_prompts: {
        Row: {
          content: string
          created_at: string
          id: string
          is_active: boolean
          version: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          version: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          version?: string
        }
        Relationships: []
      }
      token_usage: {
        Row: {
          created_at: string
          id: string
          message_id: string | null
          project_id: string | null
          tokens_in: number
          tokens_out: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id?: string | null
          project_id?: string | null
          tokens_in?: number
          tokens_out?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string | null
          project_id?: string | null
          tokens_in?: number
          tokens_out?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_usage_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_usage_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_usage_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_billing: {
        Row: {
          created_at: string
          id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      projects_with_stats: {
        Row: {
          artifact_count: number | null
          client_name: string | null
          created_at: string | null
          current_stage: string | null
          description: string | null
          id: string | null
          message_count: number | null
          mode: string | null
          name: string | null
          prompt_version: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          artifact_count?: never
          client_name?: string | null
          created_at?: string | null
          current_stage?: string | null
          description?: string | null
          id?: string | null
          message_count?: never
          mode?: string | null
          name?: string | null
          prompt_version?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          artifact_count?: never
          client_name?: string | null
          created_at?: string | null
          current_stage?: string | null
          description?: string | null
          id?: string | null
          message_count?: never
          mode?: string | null
          name?: string | null
          prompt_version?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_rate_limit: {
        Args: {
          p_endpoint: string
          p_max_requests?: number
          p_user_id: string
          p_window_seconds?: number
        }
        Returns: boolean
      }
      cleanup_expired_cache: { Args: never; Returns: undefined }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      record_cache_hit: { Args: { p_prompt_hash: string }; Returns: undefined }
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
