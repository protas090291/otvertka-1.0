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
      apartments: {
        Row: {
          apartment_number: number
          area: number
          building: string | null
          created_at: string | null
          floor: number
          id: string
          price: number
          project_id: string | null
          rooms: number
          status: string | null
          updated_at: string | null
        }
        Insert: {
          apartment_number: number
          area: number
          building?: string | null
          created_at?: string | null
          floor: number
          id?: string
          price: number
          project_id?: string | null
          rooms: number
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          apartment_number?: number
          area?: number
          building?: string | null
          created_at?: string | null
          floor?: number
          id?: string
          price?: number
          project_id?: string | null
          rooms?: number
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apartments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      architectural_plans: {
        Row: {
          apartment_id: string | null
          created_at: string | null
          file_url: string
          id: string
          updated_at: string | null
        }
        Insert: {
          apartment_id?: string | null
          created_at?: string | null
          file_url: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          apartment_id?: string | null
          created_at?: string | null
          file_url?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "architectural_plans_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
        ]
      }
      defect_comments: {
        Row: {
          author: string
          created_at: string | null
          date: string | null
          defect_id: string | null
          id: string
          photos: string[] | null
          text: string
        }
        Insert: {
          author: string
          created_at?: string | null
          date?: string | null
          defect_id?: string | null
          id?: string
          photos?: string[] | null
          text: string
        }
        Update: {
          author?: string
          created_at?: string | null
          date?: string | null
          defect_id?: string | null
          id?: string
          photos?: string[] | null
          text?: string
        }
        Relationships: []
      }
      defect_images: {
        Row: {
          created_at: string
          defect_id: string
          id: string
          url: string
        }
        Insert: {
          created_at?: string
          defect_id: string
          id?: string
          url: string
        }
        Update: {
          created_at?: string
          defect_id?: string
          id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "defect_images_defect_id_fkey"
            columns: ["defect_id"]
            isOneToOne: false
            referencedRelation: "defects"
            referencedColumns: ["id"]
          },
        ]
      }
      defects: {
        Row: {
          apartment_id: string
          assigned_to: string
          created_at: string
          created_by: string
          description: string
          due_date: string
          id: string
          severity: Database["public"]["Enums"]["DefectSeverity"]
          status: Database["public"]["Enums"]["DefectStatus"]
          title: string
          updated_at: string
          x_coord: number
          y_coord: number
        }
        Insert: {
          apartment_id: string
          assigned_to: string
          created_at?: string
          created_by: string
          description?: string
          due_date: string
          id?: string
          severity?: Database["public"]["Enums"]["DefectSeverity"]
          status?: Database["public"]["Enums"]["DefectStatus"]
          title?: string
          updated_at?: string
          x_coord: number
          y_coord: number
        }
        Update: {
          apartment_id?: string
          assigned_to?: string
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string
          id?: string
          severity?: Database["public"]["Enums"]["DefectSeverity"]
          status?: Database["public"]["Enums"]["DefectStatus"]
          title?: string
          updated_at?: string
          x_coord?: number
          y_coord?: number
        }
        Relationships: [
          {
            foreignKeyName: "defects_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defects_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          created_by: string | null
          defect_id: string | null
          id: string
          message: string
          persistent: boolean | null
          read: boolean | null
          read_at: string | null
          recipient_id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          created_by?: string | null
          defect_id?: string | null
          id?: string
          message: string
          persistent?: boolean | null
          read?: boolean | null
          read_at?: string | null
          recipient_id: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          created_by?: string | null
          defect_id?: string | null
          id?: string
          message?: string
          persistent?: boolean | null
          read?: boolean | null
          read_at?: string | null
          recipient_id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_defect_id_fkey"
            columns: ["defect_id"]
            isOneToOne: false
            referencedRelation: "defects"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_data: {
        Row: {
          apartment_id: string
          created_at: string | null
          fact_progress: number | null
          id: string
          notes: string | null
          plan_progress: number | null
          section: string
          task_name: string
          updated_at: string | null
          updated_by: string | null
          work_description: string | null
        }
        Insert: {
          apartment_id: string
          created_at?: string | null
          fact_progress?: number | null
          id?: string
          notes?: string | null
          plan_progress?: number | null
          section: string
          task_name: string
          updated_at?: string | null
          updated_by?: string | null
          work_description?: string | null
        }
        Update: {
          apartment_id?: string
          created_at?: string | null
          fact_progress?: number | null
          id?: string
          notes?: string | null
          plan_progress?: number | null
          section?: string
          task_name?: string
          updated_at?: string | null
          updated_by?: string | null
          work_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_data_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: Database["public"]["Enums"]["ProjectStatus"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["ProjectStatus"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["ProjectStatus"]
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          apartment_id: string | null
          approved_at: string | null
          approved_by: string | null
          attachments: string[] | null
          author: string
          content: string
          created_at: string | null
          created_by: string
          date: string | null
          description: string | null
          id: string
          notes: string | null
          organization_id: string | null
          photos: string[] | null
          project_id: string | null
          status: string
          title: string
          type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          apartment_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attachments?: string[] | null
          author: string
          content?: string
          created_at?: string | null
          created_by?: string
          date?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          photos?: string[] | null
          project_id?: string | null
          status?: string
          title: string
          type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          apartment_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attachments?: string[] | null
          author?: string
          content?: string
          created_at?: string | null
          created_by?: string
          date?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          photos?: string[] | null
          project_id?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      task_dependencies: {
        Row: {
          created_at: string | null
          dependency_type: string
          depends_on_task_id: string | null
          id: string
          task_id: string | null
        }
        Insert: {
          created_at?: string | null
          dependency_type?: string
          depends_on_task_id?: string | null
          id?: string
          task_id?: string | null
        }
        Update: {
          created_at?: string | null
          dependency_type?: string
          depends_on_task_id?: string | null
          id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_hours: number | null
          assigned_to: string | null
          created_at: string | null
          created_by: string
          created_by_user_id: string | null
          description: string | null
          end_date: string | null
          estimated_hours: number | null
          id: string
          organization_id: string | null
          priority: string
          progress_percentage: number | null
          project_id: string | null
          review_feedback: string | null
          start_date: string | null
          status: string
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          actual_hours?: number | null
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string
          created_by_user_id?: string | null
          description?: string | null
          end_date?: string | null
          estimated_hours?: number | null
          id?: string
          organization_id?: string | null
          priority?: string
          progress_percentage?: number | null
          project_id?: string | null
          review_feedback?: string | null
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          actual_hours?: number | null
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string
          created_by_user_id?: string | null
          description?: string | null
          end_date?: string | null
          estimated_hours?: number | null
          id?: string
          organization_id?: string | null
          priority?: string
          progress_percentage?: number | null
          project_id?: string | null
          review_feedback?: string | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      work_journal: {
        Row: {
          apartment_id: string
          created_at: string | null
          id: string
          notes: string | null
          progress_after: number
          progress_before: number
          section: string
          task_name: string
          updated_at: string | null
          work_date: string
          work_description: string
          work_time: string
          worker_name: string | null
          worker_role: string | null
        }
        Insert: {
          apartment_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          progress_after?: number
          progress_before?: number
          section: string
          task_name: string
          updated_at?: string | null
          work_date?: string
          work_description: string
          work_time?: string
          worker_name?: string | null
          worker_role?: string | null
        }
        Update: {
          apartment_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          progress_after?: number
          progress_before?: number
          section?: string
          task_name?: string
          updated_at?: string | null
          work_date?: string
          work_description?: string
          work_time?: string
          worker_name?: string | null
          worker_role?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      DefectSeverity: "low" | "medium" | "high" | "critical"
      DefectStatus: "opened" | "canceled" | "resolved" | "active"
      ProjectStatus: "active" | "completed" | "paused" | "canceled"
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
    Enums: {
      DefectSeverity: ["low", "medium", "high", "critical"],
      DefectStatus: ["opened", "canceled", "resolved", "active"],
      ProjectStatus: ["active", "completed", "paused", "canceled"],
    },
  },
} as const
