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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      active_effects: {
        Row: {
          consumed: boolean
          created_at: string
          expires_at: string | null
          id: string
          payload: Json
          source_user_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          consumed?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          payload?: Json
          source_user_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          consumed?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          payload?: Json
          source_user_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_quests: {
        Row: {
          baselines: Json
          claimed: Json
          expires_at: string
          generated_at: string
          id: string
          quests: Json
          user_id: string
        }
        Insert: {
          baselines?: Json
          claimed?: Json
          expires_at?: string
          generated_at?: string
          id?: string
          quests?: Json
          user_id: string
        }
        Update: {
          baselines?: Json
          claimed?: Json
          expires_at?: string
          generated_at?: string
          id?: string
          quests?: Json
          user_id?: string
        }
        Relationships: []
      }
      duel_sessions: {
        Row: {
          challenger_id: string
          challenger_score: number
          created_at: string
          ends_at: string | null
          id: string
          opponent_id: string
          opponent_score: number
          stake: number
          starts_at: string | null
          status: string
          winner_id: string | null
        }
        Insert: {
          challenger_id: string
          challenger_score?: number
          created_at?: string
          ends_at?: string | null
          id?: string
          opponent_id: string
          opponent_score?: number
          stake?: number
          starts_at?: string | null
          status?: string
          winner_id?: string | null
        }
        Update: {
          challenger_id?: string
          challenger_score?: number
          created_at?: string
          ends_at?: string | null
          id?: string
          opponent_id?: string
          opponent_score?: number
          stake?: number
          starts_at?: string | null
          status?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      friend_requests: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          status: string
          to_user_id: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          status?: string
          to_user_id: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          status?: string
          to_user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      game_state: {
        Row: {
          active_boosts: Json
          active_theme: string
          ai_tokens_used: number
          coins: number
          created_at: string
          dark_mode: boolean
          earned_badges: string[]
          equipped_badge: string | null
          focus_sessions_completed: number
          id: string
          last_active_date: string
          level: number
          purchased_items: string[]
          streak: number
          streak_freezes: number
          total_tasks_completed: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          active_boosts?: Json
          active_theme?: string
          ai_tokens_used?: number
          coins?: number
          created_at?: string
          dark_mode?: boolean
          earned_badges?: string[]
          equipped_badge?: string | null
          focus_sessions_completed?: number
          id?: string
          last_active_date?: string
          level?: number
          purchased_items?: string[]
          streak?: number
          streak_freezes?: number
          total_tasks_completed?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          active_boosts?: Json
          active_theme?: string
          ai_tokens_used?: number
          coins?: number
          created_at?: string
          dark_mode?: boolean
          earned_badges?: string[]
          equipped_badge?: string | null
          focus_sessions_completed?: number
          id?: string
          last_active_date?: string
          level?: number
          purchased_items?: string[]
          streak?: number
          streak_freezes?: number
          total_tasks_completed?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json
          id: string
          message: string
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          message: string
          read?: boolean
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          message?: string
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pinned_callouts: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          message: string
          sender_user_id: string
          target_user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          message: string
          sender_user_id: string
          target_user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          message?: string
          sender_user_id?: string
          target_user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_aura: string | null
          avatar_url: string | null
          created_at: string
          custom_title: string | null
          display_name: string | null
          id: string
          notification_overrides: Json
          notification_settings: Json
          saved_subjects: Json
          show_badges: boolean
          show_level: boolean
          show_streak: boolean
          show_tasks_completed: boolean
          show_xp: boolean
          task_durations: Json
          task_links: Json
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          active_aura?: string | null
          avatar_url?: string | null
          created_at?: string
          custom_title?: string | null
          display_name?: string | null
          id?: string
          notification_overrides?: Json
          notification_settings?: Json
          saved_subjects?: Json
          show_badges?: boolean
          show_level?: boolean
          show_streak?: boolean
          show_tasks_completed?: boolean
          show_xp?: boolean
          task_durations?: Json
          task_links?: Json
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          active_aura?: string | null
          avatar_url?: string | null
          created_at?: string
          custom_title?: string | null
          display_name?: string | null
          id?: string
          notification_overrides?: Json
          notification_settings?: Json
          saved_subjects?: Json
          show_badges?: boolean
          show_level?: boolean
          show_streak?: boolean
          show_tasks_completed?: boolean
          show_xp?: boolean
          task_durations?: Json
          task_links?: Json
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      task_completions: {
        Row: {
          coins_granted: number
          completed_at: string
          id: string
          reversed: boolean
          reversed_at: string | null
          task_id: string
          user_id: string
          xp_granted: number
        }
        Insert: {
          coins_granted?: number
          completed_at?: string
          id?: string
          reversed?: boolean
          reversed_at?: string | null
          task_id: string
          user_id: string
          xp_granted?: number
        }
        Update: {
          coins_granted?: number
          completed_at?: string
          id?: string
          reversed?: boolean
          reversed_at?: string | null
          task_id?: string
          user_id?: string
          xp_granted?: number
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed: boolean
          created_at: string
          deadline: string | null
          description: string | null
          id: string
          priority: string
          subject: string | null
          subject_color: string | null
          tags: string[]
          title: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          priority?: string
          subject?: string | null
          subject_color?: string | null
          tags?: string[]
          title: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          priority?: string
          subject?: string | null
          subject_color?: string | null
          tags?: string[]
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      timetable_entries: {
        Row: {
          created_at: string
          day: number
          days: number[]
          end_time: string
          id: string
          is_recurring: boolean
          room: string | null
          specific_date: string | null
          start_time: string
          subject: string
          subject_color: string
          teacher: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          day: number
          days?: number[]
          end_time: string
          id?: string
          is_recurring?: boolean
          room?: string | null
          specific_date?: string | null
          start_time: string
          subject: string
          subject_color?: string
          teacher?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          day?: number
          days?: number[]
          end_time?: string
          id?: string
          is_recurring?: boolean
          room?: string | null
          specific_date?: string | null
          start_time?: string
          subject?: string
          subject_color?: string
          teacher?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_friend_request: {
        Args: { _request_id: string }
        Returns: undefined
      }
      cast_effect: {
        Args: {
          _expires_at: string
          _payload: Json
          _target_user_id: string
          _type: string
        }
        Returns: string
      }
      cast_task_curse: {
        Args: {
          _priority: string
          _subject: string
          _target_user_id: string
          _title: string
        }
        Returns: string
      }
      consume_curse_block: {
        Args: { _target_user_id: string }
        Returns: boolean
      }
      resolve_duel: { Args: { _duel_id: string }; Returns: string }
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
