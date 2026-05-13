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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      books: {
        Row: {
          author: string | null
          cover_url: string | null
          created_at: string
          id: string
          isbn: string | null
          notes: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          isbn?: string | null
          notes?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          isbn?: string | null
          notes?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      character_states: {
        Row: {
          affiliation: string | null
          character_id: string
          created_at: string
          current_location: string | null
          emotion: string | null
          goal: string | null
          id: string
          notes: string | null
          observed_in_scene_id: string | null
          scene_id: string
          updated_at: string
          visual_change: string | null
        }
        Insert: {
          affiliation?: string | null
          character_id: string
          created_at?: string
          current_location?: string | null
          emotion?: string | null
          goal?: string | null
          id?: string
          notes?: string | null
          observed_in_scene_id?: string | null
          scene_id: string
          updated_at?: string
          visual_change?: string | null
        }
        Update: {
          affiliation?: string | null
          character_id?: string
          created_at?: string
          current_location?: string | null
          emotion?: string | null
          goal?: string | null
          id?: string
          notes?: string | null
          observed_in_scene_id?: string | null
          scene_id?: string
          updated_at?: string
          visual_change?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "character_states_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_states_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "visible_characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_states_observed_in_scene_id_fkey"
            columns: ["observed_in_scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_states_observed_in_scene_id_fkey"
            columns: ["observed_in_scene_id"]
            isOneToOne: false
            referencedRelation: "visible_scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_states_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_states_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "visible_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          aliases: string[] | null
          book_id: string
          created_at: string
          first_appearance_scene_id: string | null
          id: string
          name: string
          notes: string | null
          static_attributes: Json | null
          updated_at: string
          visual_description: string | null
        }
        Insert: {
          aliases?: string[] | null
          book_id: string
          created_at?: string
          first_appearance_scene_id?: string | null
          id?: string
          name: string
          notes?: string | null
          static_attributes?: Json | null
          updated_at?: string
          visual_description?: string | null
        }
        Update: {
          aliases?: string[] | null
          book_id?: string
          created_at?: string
          first_appearance_scene_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          static_attributes?: Json | null
          updated_at?: string
          visual_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "characters_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "characters_first_appearance_scene_id_fkey"
            columns: ["first_appearance_scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "characters_first_appearance_scene_id_fkey"
            columns: ["first_appearance_scene_id"]
            isOneToOne: false
            referencedRelation: "visible_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          book_id: string
          color: string | null
          created_at: string
          id: string
          name: string
          parent_id: string | null
          type: Database["public"]["Enums"]["label_type"]
        }
        Insert: {
          book_id: string
          color?: string | null
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          type?: Database["public"]["Enums"]["label_type"]
        }
        Update: {
          book_id?: string
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          type?: Database["public"]["Enums"]["label_type"]
        }
        Relationships: [
          {
            foreignKeyName: "labels_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labels_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
        ]
      }
      memos: {
        Row: {
          body: string
          bookmark_note: string | null
          created_at: string
          id: string
          is_bookmark: boolean
          is_flashback_ref: boolean
          refers_to_scene_id: string | null
          scene_id: string
          updated_at: string
        }
        Insert: {
          body: string
          bookmark_note?: string | null
          created_at?: string
          id?: string
          is_bookmark?: boolean
          is_flashback_ref?: boolean
          refers_to_scene_id?: string | null
          scene_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          bookmark_note?: string | null
          created_at?: string
          id?: string
          is_bookmark?: boolean
          is_flashback_ref?: boolean
          refers_to_scene_id?: string | null
          scene_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memos_refers_to_scene_id_fkey"
            columns: ["refers_to_scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memos_refers_to_scene_id_fkey"
            columns: ["refers_to_scene_id"]
            isOneToOne: false
            referencedRelation: "visible_scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memos_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memos_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "visible_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_progress: {
        Row: {
          book_id: string
          current_scene_id: string | null
          finished_at: string | null
          mode: Database["public"]["Enums"]["reading_mode"]
          started_at: string
          updated_at: string
        }
        Insert: {
          book_id: string
          current_scene_id?: string | null
          finished_at?: string | null
          mode?: Database["public"]["Enums"]["reading_mode"]
          started_at?: string
          updated_at?: string
        }
        Update: {
          book_id?: string
          current_scene_id?: string | null
          finished_at?: string | null
          mode?: Database["public"]["Enums"]["reading_mode"]
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_progress_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: true
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_progress_current_scene_id_fkey"
            columns: ["current_scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_progress_current_scene_id_fkey"
            columns: ["current_scene_id"]
            isOneToOne: false
            referencedRelation: "visible_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      relationships: {
        Row: {
          book_id: string
          created_at: string
          from_character_id: string
          id: string
          is_symmetric: boolean
          notes: string | null
          observed_at_scene_id: string
          relation_type: string
          to_character_id: string
          updated_at: string
        }
        Insert: {
          book_id: string
          created_at?: string
          from_character_id: string
          id?: string
          is_symmetric?: boolean
          notes?: string | null
          observed_at_scene_id: string
          relation_type: string
          to_character_id: string
          updated_at?: string
        }
        Update: {
          book_id?: string
          created_at?: string
          from_character_id?: string
          id?: string
          is_symmetric?: boolean
          notes?: string | null
          observed_at_scene_id?: string
          relation_type?: string
          to_character_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationships_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationships_from_character_id_fkey"
            columns: ["from_character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationships_from_character_id_fkey"
            columns: ["from_character_id"]
            isOneToOne: false
            referencedRelation: "visible_characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationships_observed_at_scene_id_fkey"
            columns: ["observed_at_scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationships_observed_at_scene_id_fkey"
            columns: ["observed_at_scene_id"]
            isOneToOne: false
            referencedRelation: "visible_scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationships_to_character_id_fkey"
            columns: ["to_character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationships_to_character_id_fkey"
            columns: ["to_character_id"]
            isOneToOne: false
            referencedRelation: "visible_characters"
            referencedColumns: ["id"]
          },
        ]
      }
      scene_labels: {
        Row: {
          created_at: string
          label_id: string
          scene_id: string
        }
        Insert: {
          created_at?: string
          label_id: string
          scene_id: string
        }
        Update: {
          created_at?: string
          label_id?: string
          scene_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scene_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scene_labels_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scene_labels_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "visible_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      scenes: {
        Row: {
          book_id: string
          created_at: string
          id: string
          order_key: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          order_key: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          order_key?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenes_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      latest_visible_character_states: {
        Row: {
          affiliation: string | null
          character_id: string | null
          created_at: string | null
          current_location: string | null
          emotion: string | null
          goal: string | null
          id: string | null
          notes: string | null
          observed_in_scene_id: string | null
          scene_id: string | null
          updated_at: string | null
          visual_change: string | null
        }
        Relationships: [
          {
            foreignKeyName: "character_states_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_states_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "visible_characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_states_observed_in_scene_id_fkey"
            columns: ["observed_in_scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_states_observed_in_scene_id_fkey"
            columns: ["observed_in_scene_id"]
            isOneToOne: false
            referencedRelation: "visible_scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_states_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_states_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "visible_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_memos: {
        Row: {
          body: string | null
          bookmark_note: string | null
          created_at: string | null
          id: string | null
          is_bookmark: boolean | null
          is_flashback_ref: boolean | null
          refers_to_scene_id: string | null
          scene_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memos_refers_to_scene_id_fkey"
            columns: ["refers_to_scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memos_refers_to_scene_id_fkey"
            columns: ["refers_to_scene_id"]
            isOneToOne: false
            referencedRelation: "visible_scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memos_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memos_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "visible_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      visible_characters: {
        Row: {
          aliases: string[] | null
          book_id: string | null
          created_at: string | null
          first_appearance_scene_id: string | null
          id: string | null
          name: string | null
          notes: string | null
          static_attributes: Json | null
          updated_at: string | null
          visual_description: string | null
        }
        Relationships: [
          {
            foreignKeyName: "characters_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "characters_first_appearance_scene_id_fkey"
            columns: ["first_appearance_scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "characters_first_appearance_scene_id_fkey"
            columns: ["first_appearance_scene_id"]
            isOneToOne: false
            referencedRelation: "visible_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      visible_memos: {
        Row: {
          body: string | null
          bookmark_note: string | null
          created_at: string | null
          id: string | null
          is_bookmark: boolean | null
          is_flashback_ref: boolean | null
          refers_to_scene_id: string | null
          scene_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memos_refers_to_scene_id_fkey"
            columns: ["refers_to_scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memos_refers_to_scene_id_fkey"
            columns: ["refers_to_scene_id"]
            isOneToOne: false
            referencedRelation: "visible_scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memos_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memos_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "visible_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      visible_scenes: {
        Row: {
          book_id: string | null
          created_at: string | null
          id: string | null
          order_key: string | null
          summary: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scenes_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      label_type: "chapter" | "viewpoint" | "location" | "time_axis" | "custom"
      reading_mode: "reading" | "finished" | "rereading"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      label_type: ["chapter", "viewpoint", "location", "time_axis", "custom"],
      reading_mode: ["reading", "finished", "rereading"],
    },
  },
} as const
