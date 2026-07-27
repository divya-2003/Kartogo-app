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
      app_orders: {
        Row: {
          address: string
          cancel_reason: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          delivery_boy_id: string | null
          delivery_fee: number
          discount: number
          driver_surge_share: number
          id: string
          items: Json
          payment_method: string
          promo_code: string | null
          refund_initiated_at: string | null
          refund_request_reason: string | null
          refund_request_resolution: string | null
          refund_request_status: string | null
          refund_request_type: string | null
          refund_requested_at: string | null
          refunded: boolean
          refunded_at: string | null
          return_picked_up_at: string | null
          return_stage: string | null
          status: string
          subtotal: number
          surge_amount: number
          surge_reason: string | null
          total: number
          updated_at: string
        }
        Insert: {
          address: string
          cancel_reason?: string | null
          created_at?: string
          customer_name: string
          customer_phone: string
          delivery_boy_id?: string | null
          delivery_fee?: number
          discount?: number
          driver_surge_share?: number
          id: string
          items?: Json
          payment_method?: string
          promo_code?: string | null
          refund_initiated_at?: string | null
          refund_request_reason?: string | null
          refund_request_resolution?: string | null
          refund_request_status?: string | null
          refund_request_type?: string | null
          refund_requested_at?: string | null
          refunded?: boolean
          refunded_at?: string | null
          return_picked_up_at?: string | null
          return_stage?: string | null
          status?: string
          subtotal?: number
          surge_amount?: number
          surge_reason?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          address?: string
          cancel_reason?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          delivery_boy_id?: string | null
          delivery_fee?: number
          discount?: number
          driver_surge_share?: number
          id?: string
          items?: Json
          payment_method?: string
          promo_code?: string | null
          refund_initiated_at?: string | null
          refund_request_reason?: string | null
          refund_request_resolution?: string | null
          refund_request_status?: string | null
          refund_request_type?: string | null
          refund_requested_at?: string | null
          refunded?: boolean
          refunded_at?: string | null
          return_picked_up_at?: string | null
          return_stage?: string | null
          status?: string
          subtotal?: number
          surge_amount?: number
          surge_reason?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      catalog_items: {
        Row: {
          category: string
          created_at: string
          description: string
          emoji: string
          id: string
          image: string | null
          mrp: number | null
          name: string
          price: number
          source: string
          stock: number
          unit: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string
          emoji?: string
          id: string
          image?: string | null
          mrp?: number | null
          name: string
          price?: number
          source?: string
          stock?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          emoji?: string
          id?: string
          image?: string | null
          mrp?: number | null
          name?: string
          price?: number
          source?: string
          stock?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      combos: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          emoji: string | null
          id: string
          image: string | null
          is_active: boolean
          items: Json
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          emoji?: string | null
          id?: string
          image?: string | null
          is_active?: boolean
          items?: Json
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          emoji?: string | null
          id?: string
          image?: string | null
          is_active?: boolean
          items?: Json
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      customer_wallets: {
        Row: {
          balance: number
          created_at: string
          phone: string
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          phone: string
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_wishlists: {
        Row: {
          created_at: string
          id: string
          phone: string
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          phone: string
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          phone?: string
          product_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string
          saved_addresses: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone: string
          saved_addresses?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string
          saved_addresses?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      driver_availability: {
        Row: {
          access_requested_at: string | null
          active: boolean
          created_at: string
          driver_id: string
          name: string | null
          phone: string | null
          shift_end: string | null
          shift_start: string | null
          shift_type: string | null
          updated_at: string
        }
        Insert: {
          access_requested_at?: string | null
          active?: boolean
          created_at?: string
          driver_id: string
          name?: string | null
          phone?: string | null
          shift_end?: string | null
          shift_start?: string | null
          shift_type?: string | null
          updated_at?: string
        }
        Update: {
          access_requested_at?: string | null
          active?: boolean
          created_at?: string
          driver_id?: string
          name?: string | null
          phone?: string | null
          shift_end?: string | null
          shift_start?: string | null
          shift_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      driver_ratings: {
        Row: {
          comment: string | null
          created_at: string
          customer_phone: string
          driver_id: string
          id: string
          order_id: string
          rating: number
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_phone: string
          driver_id: string
          id?: string
          order_id: string
          rating: number
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_phone?: string
          driver_id?: string
          id?: string
          order_id?: string
          rating?: number
          updated_at?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          created_at: string
          current_latitude: number | null
          current_longitude: number | null
          id: string
          is_active: boolean
          name: string
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_latitude?: number | null
          current_longitude?: number | null
          id?: string
          is_active?: boolean
          name: string
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_latitude?: number | null
          current_longitude?: number | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      merchants: {
        Row: {
          address: string
          balance: number
          commission_rate: number
          created_at: string
          id: string
          is_open: boolean
          latitude: number | null
          longitude: number | null
          store_name: string
          updated_at: string
        }
        Insert: {
          address: string
          balance?: number
          commission_rate?: number
          created_at?: string
          id?: string
          is_open?: boolean
          latitude?: number | null
          longitude?: number | null
          store_name: string
          updated_at?: string
        }
        Update: {
          address?: string
          balance?: number
          commission_rate?: number
          created_at?: string
          id?: string
          is_open?: boolean
          latitude?: number | null
          longitude?: number | null
          store_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_call_logs: {
        Row: {
          callee_id: string
          callee_role: string
          caller_id: string
          caller_role: string
          created_at: string
          id: string
          order_id: string
          provider_ref: string | null
          status: string
        }
        Insert: {
          callee_id: string
          callee_role: string
          caller_id: string
          caller_role: string
          created_at?: string
          id?: string
          order_id: string
          provider_ref?: string | null
          status?: string
        }
        Update: {
          callee_id?: string
          callee_role?: string
          caller_id?: string
          caller_role?: string
          created_at?: string
          id?: string
          order_id?: string
          provider_ref?: string | null
          status?: string
        }
        Relationships: []
      }
      order_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          order_id: string
          sender_id: string
          sender_role: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          order_id: string
          sender_id: string
          sender_role: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          order_id?: string
          sender_id?: string
          sender_role?: string
        }
        Relationships: []
      }
      order_status_log: {
        Row: {
          changed_at: string
          from_status: string | null
          id: string
          order_id: string
          to_status: string
        }
        Insert: {
          changed_at?: string
          from_status?: string | null
          id?: string
          order_id: string
          to_status: string
        }
        Update: {
          changed_at?: string
          from_status?: string | null
          id?: string
          order_id?: string
          to_status?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          commission_amount: number
          created_at: string
          customer_id: string
          delivery_fee: number
          driver_id: string | null
          id: string
          merchant_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          payout_amount: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          updated_at: string
        }
        Insert: {
          commission_amount?: number
          created_at?: string
          customer_id: string
          delivery_fee?: number
          driver_id?: string | null
          id?: string
          merchant_id: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          payout_amount?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          updated_at?: string
        }
        Update: {
          commission_amount?: number
          created_at?: string
          customer_id?: string
          delivery_fee?: number
          driver_id?: string | null
          id?: string
          merchant_id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          payout_amount?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed: boolean
          created_at: string
          expires_at: string
          id: string
          phone: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed?: boolean
          created_at?: string
          expires_at: string
          id?: string
          phone: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed?: boolean
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
        }
        Relationships: []
      }
      partner_markets: {
        Row: {
          address: string
          created_at: string
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      print_jobs: {
        Row: {
          address: string | null
          copies: number
          created_at: string
          customer_name: string | null
          customer_phone: string
          file_data: string
          file_name: string
          file_size: number
          file_type: string
          id: string
          notes: string | null
          order_id: string | null
          service: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          copies?: number
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          file_data: string
          file_name: string
          file_size?: number
          file_type: string
          id?: string
          notes?: string | null
          order_id?: string | null
          service: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          copies?: number
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          file_data?: string
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          service?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_reviews: {
        Row: {
          created_at: string
          customer_name: string
          customer_phone: string
          feedback: string
          id: string
          order_id: string
          product_id: string
          product_name: string
          rating: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name?: string
          customer_phone: string
          feedback?: string
          id?: string
          order_id: string
          product_id: string
          product_name?: string
          rating: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string
          customer_phone?: string
          feedback?: string
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          rating?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: Database["public"]["Enums"]["product_category"]
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          merchant_id: string
          name: string
          price: number
          stock_count: number
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["product_category"]
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          merchant_id: string
          name: string
          price?: number
          stock_count?: number
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          merchant_id?: string
          name?: string
          price?: number
          stock_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_audit_log: {
        Row: {
          actor: string
          created_at: string
          credit_amount: number
          credit_expires_at: string | null
          customer_phone: string | null
          decision: string
          gst_percent: number | null
          id: string
          order_id: string
          order_total: number | null
          resolution: string | null
          threshold_amount: number | null
        }
        Insert: {
          actor?: string
          created_at?: string
          credit_amount?: number
          credit_expires_at?: string | null
          customer_phone?: string | null
          decision: string
          gst_percent?: number | null
          id?: string
          order_id: string
          order_total?: number | null
          resolution?: string | null
          threshold_amount?: number | null
        }
        Update: {
          actor?: string
          created_at?: string
          credit_amount?: number
          credit_expires_at?: string | null
          customer_phone?: string | null
          decision?: string
          gst_percent?: number | null
          id?: string
          order_id?: string
          order_total?: number | null
          resolution?: string | null
          threshold_amount?: number | null
        }
        Relationships: []
      }
      refund_config: {
        Row: {
          credit_expiry_days: number
          gst_percent: number
          id: number
          threshold_amount: number
          updated_at: string
        }
        Insert: {
          credit_expiry_days?: number
          gst_percent?: number
          id?: number
          threshold_amount?: number
          updated_at?: string
        }
        Update: {
          credit_expiry_days?: number
          gst_percent?: number
          id?: number
          threshold_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      surge_config: {
        Row: {
          amount: number
          driver_share_percent: number
          enabled: boolean
          id: number
          note: string | null
          reason: string
          updated_at: string
        }
        Insert: {
          amount?: number
          driver_share_percent?: number
          enabled?: boolean
          id?: number
          note?: string | null
          reason?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          driver_share_percent?: number
          enabled?: boolean
          id?: number
          note?: string | null
          reason?: string
          updated_at?: string
        }
        Relationships: []
      }
      unserviceable_requests: {
        Row: {
          area_text: string | null
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          note: string | null
          phone: string | null
          pincode: string | null
          status: string
          updated_at: string
        }
        Insert: {
          area_text?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          note?: string | null
          phone?: string | null
          pincode?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          area_text?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          note?: string | null
          phone?: string | null
          pincode?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      wallet_topups: {
        Row: {
          amount: number
          created_at: string
          id: string
          phone: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          phone: string
          status: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          phone?: string
          status?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          expired_at: string | null
          expires_at: string | null
          id: string
          note: string
          phone: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          expired_at?: string | null
          expires_at?: string | null
          id?: string
          note?: string
          phone: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          expired_at?: string | null
          expires_at?: string | null
          id?: string
          note?: string
          phone?: string
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_wallet: {
        Args: {
          p_amount: number
          p_note: string
          p_phone: string
          p_type: string
        }
        Returns: number
      }
      credit_wallet_with_expiry: {
        Args: {
          p_amount: number
          p_expires_at: string
          p_note: string
          p_phone: string
        }
        Returns: number
      }
      expire_wallet_credits: { Args: { p_phone: string }; Returns: undefined }
    }
    Enums: {
      order_status:
        | "pending"
        | "accepted"
        | "preparing"
        | "out_for_delivery"
        | "delivered"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      product_category:
        | "OTC Health"
        | "Electronics"
        | "Party Supplies"
        | "Gourmet Snacks"
        | "Pet Care"
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
      order_status: [
        "pending",
        "accepted",
        "preparing",
        "out_for_delivery",
        "delivered",
      ],
      payment_status: ["pending", "paid", "failed", "refunded"],
      product_category: [
        "OTC Health",
        "Electronics",
        "Party Supplies",
        "Gourmet Snacks",
        "Pet Care",
      ],
    },
  },
} as const
