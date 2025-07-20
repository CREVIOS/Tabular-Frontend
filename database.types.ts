export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      clause_library: {
        Row: {
          clause_metadata: Json | null
          clause_text: string
          clause_type: string
          created_at: string
          file_id: string
          folder_id: string
          id: string
          user_id: string
        }
        Insert: {
          clause_metadata?: Json | null
          clause_text: string
          clause_type: string
          created_at?: string
          file_id: string
          folder_id: string
          id?: string
          user_id: string
        }
        Update: {
          clause_metadata?: Json | null
          clause_text?: string
          clause_type?: string
          created_at?: string
          file_id?: string
          folder_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clause_library_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clause_library_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clause_library_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      file_info: {
        Row: {
          contract_infos: Json | null
          file_id: string
          id: string
          user_id: string | null
        }
        Insert: {
          contract_infos?: Json | null
          file_id: string
          id?: string
          user_id?: string | null
        }
        Update: {
          contract_infos?: Json | null
          file_id?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "file_info_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: true
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_info_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          created_at: string | null
          error_message: string | null
          extracted_metadata: Json | null
          extracted_text: string | null
          file_size: number | null
          file_type: string | null
          folder_id: string | null
          id: string
          job_id: string | null
          original_filename: string
          processed_at: string | null
          processing_completed_at: string | null
          processing_started_at: string | null
          status: string | null
          storage_path: string | null
          storage_url: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          extracted_metadata?: Json | null
          extracted_text?: string | null
          file_size?: number | null
          file_type?: string | null
          folder_id?: string | null
          id?: string
          job_id?: string | null
          original_filename: string
          processed_at?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          status?: string | null
          storage_path?: string | null
          storage_url?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          extracted_metadata?: Json | null
          extracted_text?: string | null
          file_size?: number | null
          file_type?: string | null
          folder_id?: string | null
          id?: string
          job_id?: string | null
          original_filename?: string
          processed_at?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          status?: string | null
          storage_path?: string | null
          storage_url?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          in_progress_job_id: string | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          in_progress_job_id?: string | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          in_progress_job_id?: string | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      job_steps: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          job_id: string
          metadata: Json | null
          progress: number | null
          started_at: string | null
          status: string
          step_name: string
          step_order: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_id: string
          metadata?: Json | null
          progress?: number | null
          started_at?: string | null
          status?: string
          step_name: string
          step_order: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_id?: string
          metadata?: Json | null
          progress?: number | null
          started_at?: string | null
          status?: string
          step_name?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_steps_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          celery_task_id: string | null
          completed_at: string | null
          created_at: string | null
          current_step: number | null
          current_step_name: string | null
          error_message: string | null
          id: string
          job_type: string
          metadata: Json | null
          progress: number | null
          result: Json | null
          started_at: string | null
          status: string
          total_steps: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          celery_task_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_step?: number | null
          current_step_name?: string | null
          error_message?: string | null
          id?: string
          job_type: string
          metadata?: Json | null
          progress?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          total_steps?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          celery_task_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_step?: number | null
          current_step_name?: string | null
          error_message?: string | null
          id?: string
          job_type?: string
          metadata?: Json | null
          progress?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          total_steps?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      markdown_content: {
        Row: {
          content: string
          created_at: string | null
          file_id: string
          id: string
          updated_at: string | null
          user_id: string
          word_count: number | null
        }
        Insert: {
          content: string
          created_at?: string | null
          file_id: string
          id?: string
          updated_at?: string | null
          user_id: string
          word_count?: number | null
        }
        Update: {
          content?: string
          created_at?: string | null
          file_id?: string
          id?: string
          updated_at?: string | null
          user_id?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "markdown_content_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "markdown_content_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tabular_review_columns: {
        Row: {
          column_name: string
          column_order: number
          created_at: string | null
          data_type: string | null
          id: string
          prompt: string
          review_id: string
        }
        Insert: {
          column_name: string
          column_order?: number
          created_at?: string | null
          data_type?: string | null
          id?: string
          prompt: string
          review_id: string
        }
        Update: {
          column_name?: string
          column_order?: number
          created_at?: string | null
          data_type?: string | null
          id?: string
          prompt?: string
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tabular_review_columns_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "tabular_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      tabular_review_files: {
        Row: {
          added_at: string | null
          file_id: string
          id: string
          review_id: string
        }
        Insert: {
          added_at?: string | null
          file_id: string
          id?: string
          review_id: string
        }
        Update: {
          added_at?: string | null
          file_id?: string
          id?: string
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tabular_review_files_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabular_review_files_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "tabular_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      tabular_review_results: {
        Row: {
          column_id: string
          confidence_score: number | null
          created_at: string | null
          extracted_value: string | null
          file_id: string
          id: string
          long: string | null
          review_id: string
          source_reference: string | null
          updated_at: string | null
        }
        Insert: {
          column_id: string
          confidence_score?: number | null
          created_at?: string | null
          extracted_value?: string | null
          file_id: string
          id?: string
          long?: string | null
          review_id: string
          source_reference?: string | null
          updated_at?: string | null
        }
        Update: {
          column_id?: string
          confidence_score?: number | null
          created_at?: string | null
          extracted_value?: string | null
          file_id?: string
          id?: string
          long?: string | null
          review_id?: string
          source_reference?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tabular_review_results_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "tabular_review_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabular_review_results_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabular_review_results_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "tabular_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      tabular_reviews: {
        Row: {
          created_at: string | null
          description: string | null
          folder_id: string | null
          id: string
          last_heartbeat: string | null
          last_processed_at: string | null
          name: string
          review_scope: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          folder_id?: string | null
          id?: string
          last_heartbeat?: string | null
          last_processed_at?: string | null
          name: string
          review_scope?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          folder_id?: string | null
          id?: string
          last_heartbeat?: string | null
          last_processed_at?: string | null
          name?: string
          review_scope?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tabular_reviews_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabular_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      template_usage_stats: {
        Row: {
          action_type: string
          created_at: string | null
          id: string
          metadata: Json | null
          template_id: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          template_id: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          template_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_template_stats_template"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          content: string
          content_json: Json | null
          content_markdown: string | null
          created_at: string | null
          file_extension: string | null
          folder_id: string
          formatting_data: Json | null
          id: string
          is_active: boolean | null
          name: string
          template_type: string | null
          updated_at: string | null
          word_compatible: boolean | null
        }
        Insert: {
          content: string
          content_json?: Json | null
          content_markdown?: string | null
          created_at?: string | null
          file_extension?: string | null
          folder_id: string
          formatting_data?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          template_type?: string | null
          updated_at?: string | null
          word_compatible?: boolean | null
        }
        Update: {
          content?: string
          content_json?: Json | null
          content_markdown?: string | null
          created_at?: string | null
          file_extension?: string | null
          folder_id?: string
          formatting_data?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          template_type?: string | null
          updated_at?: string | null
          word_compatible?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_templates_folder"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      clause_library_with_stats: {
        Row: {
          avg_word_count: number | null
          clause_text: string | null
          clause_type: string | null
          drafting_note: string | null
          first_used: string | null
          last_updated: string | null
          template_count: number | null
          usage_count: number | null
          used_in_folders: string[] | null
          used_in_template_types: string[] | null
        }
        Relationships: []
      }
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      check_template_health: {
        Args: { template_id: string }
        Returns: {
          health_score: number
          issues_found: string[]
          recommendations: string[]
          compliance_status: string
        }[]
      }
      cleanup_old_usage_stats: {
        Args: { p_days_to_keep?: number }
        Returns: number
      }
      find_similar_clauses: {
        Args: {
          reference_clause_text: string
          similarity_threshold?: number
          exclude_template_id?: string
        }
        Returns: {
          template_id: string
          template_name: string
          clause_type: string
          clause_text: string
          similarity_score: number
        }[]
      }
      get_clause_analytics: {
        Args: { target_folder_id?: string }
        Returns: {
          clause_type: string
          usage_count: number
          avg_word_count: number
          template_count: number
          avg_drafting_note_length: number
          most_common_position: number
        }[]
      }
      get_review_files: {
        Args: { review_id_param: string }
        Returns: {
          file_id: string
          file_name: string
          file_size: number
          is_in_review: boolean
          folder_id: string
          folder_name: string
        }[]
      }
      get_template_analytics: {
        Args: { p_template_id: string; p_days_back?: number }
        Returns: {
          template_id: string
          template_name: string
          total_views: number
          total_downloads: number
          total_exports: number
          total_edits: number
          last_activity: string
          daily_activity: Json
        }[]
      }
      get_template_export_data: {
        Args: { p_template_id: string }
        Returns: {
          template_data: Json
        }[]
      }
      get_template_statistics: {
        Args: { template_id: string }
        Returns: {
          total_clauses: number
          total_words: number
          has_structured_content: boolean
          clause_types: string[]
          last_modified: string
          complexity_score: number
          missing_common_clauses: string[]
        }[]
      }
      get_user_recent_template_activity: {
        Args: { p_user_id: string; p_limit?: number }
        Returns: {
          template_id: string
          template_name: string
          action_type: string
          metadata: Json
          created_at: string
          folder_name: string
        }[]
      }
      get_user_template_types: {
        Args: { p_user_id: string }
        Returns: {
          template_type: string
          count: number
        }[]
      }
      get_user_template_usage_stats: {
        Args: {
          p_user_id: string
          p_action_type?: string
          p_days_back?: number
        }
        Returns: {
          template_id: string
          template_name: string
          action_type: string
          action_count: number
          last_action: string
        }[]
      }
      get_user_templates_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      migrate_html_to_structured_batch: {
        Args: { batch_size?: number; folder_id_filter?: string }
        Returns: {
          processed_count: number
          success_count: number
          error_count: number
          error_details: string[]
        }[]
      }
      search_clauses_in_templates: {
        Args: {
          search_term: string
          user_folder_ids?: string[]
          clause_type_filter?: string
          limit_results?: number
        }
        Returns: {
          template_id: string
          template_name: string
          template_type: string
          clause_type: string
          clause_text: string
          clause_number: string
          drafting_note: string
          relevance_score: number
          folder_id: string
        }[]
      }
      search_user_templates: {
        Args: {
          p_user_id: string
          p_search_query?: string
          p_template_type?: string
          p_folder_id?: string
          p_is_active?: boolean
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          id: string
          name: string
          template_type: string
          folder_id: string
          folder_name: string
          created_at: string
          updated_at: string
          last_used: string
          usage_count: number
        }[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
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
