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
      agenda_items: {
        Row: {
          assignee_id: string | null
          color: string
          created_at: string
          created_by: string
          date: string
          deleted_at: string | null
          done: boolean
          id: string
          kind: string
          note: string
          org_id: string
          source_id: string | null
          source_type: string | null
          time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          color?: string
          created_at?: string
          created_by?: string
          date: string
          deleted_at?: string | null
          done?: boolean
          id?: string
          kind?: string
          note?: string
          org_id: string
          source_id?: string | null
          source_type?: string | null
          time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          color?: string
          created_at?: string
          created_by?: string
          date?: string
          deleted_at?: string | null
          done?: boolean
          id?: string
          kind?: string
          note?: string
          org_id?: string
          source_id?: string | null
          source_type?: string | null
          time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      board_columns: {
        Row: {
          board_id: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          org_id: string
          position: number
          updated_at: string
        }
        Insert: {
          board_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          org_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          board_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          org_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_columns_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_columns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          folder: string
          id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          folder?: string
          id?: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          folder?: string
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boards_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      card_items: {
        Row: {
          card_id: string
          content: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          done: boolean
          id: string
          kind: string
          org_id: string
          path: string
          position: number
          updated_at: string
        }
        Insert: {
          card_id: string
          content?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          done?: boolean
          id?: string
          kind?: string
          org_id: string
          path?: string
          position?: number
          updated_at?: string
        }
        Update: {
          card_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          done?: boolean
          id?: string
          kind?: string
          org_id?: string
          path?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_items_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          archived: boolean
          assignee_id: string | null
          board_id: string
          color: string
          column_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string
          done: boolean
          due_date: string | null
          id: string
          label: string
          org_id: string
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          assignee_id?: string | null
          board_id: string
          color?: string
          column_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          done?: boolean
          due_date?: string | null
          id?: string
          label?: string
          org_id: string
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          assignee_id?: string | null
          board_id?: string
          color?: string
          column_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          done?: boolean
          due_date?: string | null
          id?: string
          label?: string
          org_id?: string
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "board_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_opening: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string
          opening_date: string
          org_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          note?: string
          opening_date?: string
          org_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string
          opening_date?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_opening_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          created_at: string
          created_by: string
          id: string
          key_mask: string | null
          label: string
          last_sync_at: string | null
          org_id: string
          provider: string
          secret_ref: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          key_mask?: string | null
          label?: string
          last_sync_at?: string | null
          org_id: string
          provider: string
          secret_ref?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          key_mask?: string | null
          label?: string
          last_sync_at?: string | null
          org_id?: string
          provider?: string
          secret_ref?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          doc: string | null
          email: string | null
          id: string
          kind: string
          name: string
          note: string
          org_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          doc?: string | null
          email?: string | null
          id?: string
          kind?: string
          name: string
          note?: string
          org_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          doc?: string | null
          email?: string | null
          id?: string
          kind?: string
          name?: string
          note?: string
          org_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          contact_id: string | null
          content: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          folder_id: string | null
          id: string
          kind: string
          mime_type: string
          name: string
          org_id: string
          path: string
          size_bytes: number
          updated_at: string
          url: string
        }
        Insert: {
          contact_id?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          kind?: string
          mime_type?: string
          name: string
          org_id: string
          path?: string
          size_bytes?: number
          updated_at?: string
          url?: string
        }
        Update: {
          contact_id?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          kind?: string
          mime_type?: string
          name?: string
          org_id?: string
          path?: string
          size_bytes?: number
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_entries: {
        Row: {
          account: string
          amount: number
          category: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string
          entry_date: string
          id: string
          kind: string
          org_id: string
          origin: string
          received: boolean
          updated_at: string
        }
        Insert: {
          account?: string
          amount: number
          category?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description: string
          entry_date?: string
          id?: string
          kind?: string
          org_id: string
          origin?: string
          received?: boolean
          updated_at?: string
        }
        Update: {
          account?: string
          amount?: number
          category?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          entry_date?: string
          id?: string
          kind?: string
          org_id?: string
          origin?: string
          received?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_costs: {
        Row: {
          active: boolean
          amount: number
          category: string
          created_at: string
          created_by: string | null
          day_of_month: number
          end_month: string | null
          id: string
          label: string
          org_id: string
          start_month: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount: number
          category?: string
          created_at?: string
          created_by?: string | null
          day_of_month?: number
          end_month?: string | null
          id?: string
          label: string
          org_id: string
          start_month?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          day_of_month?: number
          end_month?: string | null
          id?: string
          label?: string
          org_id?: string
          start_month?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_costs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          org_id: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          org_id: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          org_id?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_tasks: {
        Row: {
          card_id: string | null
          created_at: string
          done: boolean
          goal_id: string
          id: string
          text: string
        }
        Insert: {
          card_id?: string | null
          created_at?: string
          done?: boolean
          goal_id: string
          id?: string
          text: string
        }
        Update: {
          card_id?: string | null
          created_at?: string
          done?: boolean
          goal_id?: string
          id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_tasks_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          color: string
          created_at: string
          created_by: string
          current_source: string
          deleted_at: string | null
          due_date: string | null
          group_name: string
          id: string
          note: string
          org_id: string
          period_start: string
          target: number
          title: string
          unit: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string
          current_source?: string
          deleted_at?: string | null
          due_date?: string | null
          group_name?: string
          id?: string
          note?: string
          org_id: string
          period_start?: string
          target?: number
          title: string
          unit?: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          current_source?: string
          deleted_at?: string | null
          due_date?: string | null
          group_name?: string
          id?: string
          note?: string
          org_id?: string
          period_start?: string
          target?: number
          title?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_accounts: {
        Row: {
          color: string
          created_at: string
          created_by: string
          fee_percent: number
          id: string
          name: string
          org_id: string
          payout_days: number
          provider: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string
          fee_percent?: number
          id?: string
          name: string
          org_id: string
          payout_days?: number
          provider?: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          fee_percent?: number
          id?: string
          name?: string
          org_id?: string
          payout_days?: number
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_receipts: {
        Row: {
          account_id: string | null
          created_at: string
          created_by: string
          date: string
          deleted_at: string | null
          description: string
          external_id: string | null
          fee_percent: number
          finance_entry_id: string | null
          gross: number
          id: string
          org_id: string
          paid_out: boolean
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          created_by?: string
          date?: string
          deleted_at?: string | null
          description?: string
          external_id?: string | null
          fee_percent?: number
          finance_entry_id?: string | null
          gross?: number
          id?: string
          org_id: string
          paid_out?: boolean
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          created_by?: string
          date?: string
          deleted_at?: string | null
          description?: string
          external_id?: string | null
          fee_percent?: number
          finance_entry_id?: string | null
          gross?: number
          id?: string
          org_id?: string
          paid_out?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "payment_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_receipts_finance_entry_id_fkey"
            columns: ["finance_entry_id"]
            isOneToOne: false
            referencedRelation: "finance_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_receipts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin_or_owner: { Args: { target_org: string }; Returns: boolean }
      is_member: { Args: { org_id: string }; Returns: boolean }
      is_member_via_goal: { Args: { target_goal: string }; Returns: boolean }
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
