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
      addresses: {
        Row: {
          city: string | null
          created_at: string
          governorate: string | null
          id: string
          is_default: boolean
          phone: string | null
          recipient: string | null
          street: string | null
          user_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          governorate?: string | null
          id?: string
          is_default?: boolean
          phone?: string | null
          recipient?: string | null
          street?: string | null
          user_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          governorate?: string | null
          id?: string
          is_default?: boolean
          phone?: string | null
          recipient?: string | null
          street?: string | null
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          id: string
          label: string
          sort_order?: number
        }
        Update: {
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          brand: string | null
          id: string
          name: string
          order_id: string
          price: number
          product_slug: string | null
          qty: number
        }
        Insert: {
          brand?: string | null
          id?: string
          name: string
          order_id: string
          price: number
          product_slug?: string | null
          qty: number
        }
        Update: {
          brand?: string | null
          id?: string
          name?: string
          order_id?: string
          price?: number
          product_slug?: string | null
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          delivery_fee: number
          discount: number
          id: string
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          shipping: Json | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          delivery_fee?: number
          discount?: number
          id?: string
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          shipping?: Json | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          delivery_fee?: number
          discount?: number
          id?: string
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          shipping?: Json | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          user_id?: string | null
        }
        Relationships: []
      }
      product_images: {
        Row: {
          id: string
          position: number
          product_id: string
          url: string
        }
        Insert: {
          id?: string
          position?: number
          product_id: string
          url: string
        }
        Update: {
          id?: string
          position?: number
          product_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          badge_label: string | null
          badge_tone: Database["public"]["Enums"]["badge_tone"] | null
          brand: string | null
          category_id: string | null
          created_at: string
          description: string | null
          dosage: string | null
          id: string
          ingredients: string | null
          is_popular: boolean
          name: string
          price: number
          rating: number | null
          review_count: number
          slug: string
          stock: Database["public"]["Enums"]["stock_state"]
          storage: string | null
          sub: string | null
          warnings: string | null
          was_price: number | null
        }
        Insert: {
          badge_label?: string | null
          badge_tone?: Database["public"]["Enums"]["badge_tone"] | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          dosage?: string | null
          id?: string
          ingredients?: string | null
          is_popular?: boolean
          name: string
          price: number
          rating?: number | null
          review_count?: number
          slug: string
          stock?: Database["public"]["Enums"]["stock_state"]
          storage?: string | null
          sub?: string | null
          warnings?: string | null
          was_price?: number | null
        }
        Update: {
          badge_label?: string | null
          badge_tone?: Database["public"]["Enums"]["badge_tone"] | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          dosage?: string | null
          id?: string
          ingredients?: string | null
          is_popular?: boolean
          name?: string
          price?: number
          rating?: number | null
          review_count?: number
          slug?: string
          stock?: Database["public"]["Enums"]["stock_state"]
          storage?: string | null
          sub?: string | null
          warnings?: string | null
          was_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          author_name: string
          body: string | null
          created_at: string
          id: string
          product_id: string
          rating: number
        }
        Insert: {
          author_name: string
          body?: string | null
          created_at?: string
          id?: string
          product_id: string
          rating: number
        }
        Update: {
          author_name?: string
          body?: string | null
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_order: {
        Args: {
          p_delivery_fee: number
          p_discount: number
          p_items: Json
          p_payment_method: Database["public"]["Enums"]["payment_method"]
          p_shipping: Json
          p_subtotal: number
          p_total: number
        }
        Returns: string
      }
    }
    Enums: {
      badge_tone: "sale" | "bestseller" | "new"
      order_status: "placed" | "confirmed" | "delivered" | "cancelled"
      payment_method: "cod" | "card" | "wallet"
      stock_state: "in" | "low" | "out"
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
      badge_tone: ["sale", "bestseller", "new"],
      order_status: ["placed", "confirmed", "delivered", "cancelled"],
      payment_method: ["cod", "card", "wallet"],
      stock_state: ["in", "low", "out"],
    },
  },
} as const
