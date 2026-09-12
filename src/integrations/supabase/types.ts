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
      admin_access: {
        Row: {
          created_at: string
          is_super_admin: boolean
          permissions: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_super_admin?: boolean
          permissions?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_super_admin?: boolean
          permissions?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "staff_accounts"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ai_forecasts: {
        Row: {
          accuracy: number | null
          actual_units: number | null
          available_stock: number
          confidence: number
          created_at: string
          days_to_stockout: number | null
          forecast_date: string
          id: string
          predicted_next_day: number
          predicted_next_month: number
          predicted_next_week: number
          product_id: string
          product_name: string
          recommended_quantity: number
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          actual_units?: number | null
          available_stock?: number
          confidence?: number
          created_at?: string
          days_to_stockout?: number | null
          forecast_date?: string
          id?: string
          predicted_next_day?: number
          predicted_next_month?: number
          predicted_next_week?: number
          product_id: string
          product_name?: string
          recommended_quantity?: number
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          actual_units?: number | null
          available_stock?: number
          confidence?: number
          created_at?: string
          days_to_stockout?: number | null
          forecast_date?: string
          id?: string
          predicted_next_day?: number
          predicted_next_month?: number
          predicted_next_week?: number
          product_id?: string
          product_name?: string
          recommended_quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_insights: {
        Row: {
          audience: string
          body: string
          confidence: number
          created_at: string
          data: Json
          id: string
          kind: string
          market_id: string | null
          product_id: string | null
          product_name: string | null
          read: boolean
          reasoning: string
          recommended_quantity: number | null
          severity: string
          status: string
          supplier_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          body: string
          confidence?: number
          created_at?: string
          data?: Json
          id?: string
          kind: string
          market_id?: string | null
          product_id?: string | null
          product_name?: string | null
          read?: boolean
          reasoning?: string
          recommended_quantity?: number | null
          severity?: string
          status?: string
          supplier_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          body?: string
          confidence?: number
          created_at?: string
          data?: Json
          id?: string
          kind?: string
          market_id?: string | null
          product_id?: string | null
          product_name?: string | null
          read?: boolean
          reasoning?: string
          recommended_quantity?: number | null
          severity?: string
          status?: string
          supplier_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
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
          scheduled_date: string | null
          scheduled_end: string | null
          scheduled_slot_label: string | null
          scheduled_start: string | null
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
          scheduled_date?: string | null
          scheduled_end?: string | null
          scheduled_slot_label?: string | null
          scheduled_start?: string | null
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
          scheduled_date?: string | null
          scheduled_end?: string | null
          scheduled_slot_label?: string | null
          scheduled_start?: string | null
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
          deleted_at: string | null
          deleted_by: string | null
          description: string
          emoji: string
          id: string
          image: string | null
          is_deleted: boolean
          max_per_order: number | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          emoji?: string
          id: string
          image?: string | null
          is_deleted?: boolean
          max_per_order?: number | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          emoji?: string
          id?: string
          image?: string | null
          is_deleted?: boolean
          max_per_order?: number | null
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
      customer_category_preferences: {
        Row: {
          category: string
          id: string
          interest_score: number
          last_activity_at: string | null
          phone: string
          purchase_count: number
          updated_at: string
          view_count: number
        }
        Insert: {
          category: string
          id?: string
          interest_score?: number
          last_activity_at?: string | null
          phone: string
          purchase_count?: number
          updated_at?: string
          view_count?: number
        }
        Update: {
          category?: string
          id?: string
          interest_score?: number
          last_activity_at?: string | null
          phone?: string
          purchase_count?: number
          updated_at?: string
          view_count?: number
        }
        Relationships: []
      }
      customer_events: {
        Row: {
          category: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          order_id: string | null
          phone: string | null
          product_id: string | null
          search_query: string | null
          session_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          order_id?: string | null
          phone?: string | null
          product_id?: string | null
          search_query?: string | null
          session_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          order_id?: string | null
          phone?: string | null
          product_id?: string | null
          search_query?: string | null
          session_id?: string | null
        }
        Relationships: []
      }
      customer_product_preferences: {
        Row: {
          average_purchase_interval_days: number | null
          cart_count: number
          favorite_count: number
          id: string
          interest_score: number
          last_added_to_cart_at: string | null
          last_purchased_at: string | null
          last_searched_at: string | null
          last_viewed_at: string | null
          phone: string
          product_id: string
          purchase_count: number
          search_count: number
          updated_at: string
          view_count: number
        }
        Insert: {
          average_purchase_interval_days?: number | null
          cart_count?: number
          favorite_count?: number
          id?: string
          interest_score?: number
          last_added_to_cart_at?: string | null
          last_purchased_at?: string | null
          last_searched_at?: string | null
          last_viewed_at?: string | null
          phone: string
          product_id: string
          purchase_count?: number
          search_count?: number
          updated_at?: string
          view_count?: number
        }
        Update: {
          average_purchase_interval_days?: number | null
          cart_count?: number
          favorite_count?: number
          id?: string
          interest_score?: number
          last_added_to_cart_at?: string | null
          last_purchased_at?: string | null
          last_searched_at?: string | null
          last_viewed_at?: string | null
          phone?: string
          product_id?: string
          purchase_count?: number
          search_count?: number
          updated_at?: string
          view_count?: number
        }
        Relationships: []
      }
      customer_replenishment_predictions: {
        Row: {
          average_purchase_interval_days: number | null
          confidence_score: number
          created_at: string
          days_until_predicted_purchase: number | null
          id: string
          last_purchase_at: string | null
          phone: string
          predicted_next_purchase_at: string | null
          product_id: string
          status: string
          updated_at: string
        }
        Insert: {
          average_purchase_interval_days?: number | null
          confidence_score?: number
          created_at?: string
          days_until_predicted_purchase?: number | null
          id?: string
          last_purchase_at?: string | null
          phone: string
          predicted_next_purchase_at?: string | null
          product_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          average_purchase_interval_days?: number | null
          confidence_score?: number
          created_at?: string
          days_until_predicted_purchase?: number | null
          id?: string
          last_purchase_at?: string | null
          phone?: string
          predicted_next_purchase_at?: string | null
          product_id?: string
          status?: string
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
          referral_code: string | null
          referral_rewarded: boolean
          referred_by: string | null
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
          referral_code?: string | null
          referral_rewarded?: boolean
          referred_by?: string | null
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
          referral_code?: string | null
          referral_rewarded?: boolean
          referred_by?: string | null
          saved_addresses?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      delivery_assignments: {
        Row: {
          attempt: number
          created_at: string
          distance_meters: number | null
          driver_id: string
          drop_latitude: number | null
          drop_longitude: number | null
          expires_at: string
          id: string
          offered_at: string
          order_id: string
          pickup_latitude: number | null
          pickup_longitude: number | null
          reason: string | null
          responded_at: string | null
          status: Database["public"]["Enums"]["assignment_status"]
          updated_at: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          distance_meters?: number | null
          driver_id: string
          drop_latitude?: number | null
          drop_longitude?: number | null
          expires_at?: string
          id?: string
          offered_at?: string
          order_id: string
          pickup_latitude?: number | null
          pickup_longitude?: number | null
          reason?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
        }
        Update: {
          attempt?: number
          created_at?: string
          distance_meters?: number | null
          driver_id?: string
          drop_latitude?: number | null
          drop_longitude?: number | null
          expires_at?: string
          id?: string
          offered_at?: string
          order_id?: string
          pickup_latitude?: number | null
          pickup_longitude?: number | null
          reason?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
        }
        Relationships: []
      }
      delivery_events: {
        Row: {
          actor: string
          created_at: string
          driver_id: string | null
          event_type: string
          id: string
          order_id: string
          payload: Json
        }
        Insert: {
          actor?: string
          created_at?: string
          driver_id?: string | null
          event_type: string
          id?: string
          order_id: string
          payload?: Json
        }
        Update: {
          actor?: string
          created_at?: string
          driver_id?: string | null
          event_type?: string
          id?: string
          order_id?: string
          payload?: Json
        }
        Relationships: []
      }
      delivery_partners: {
        Row: {
          active_order_id: string | null
          completed_orders: number
          created_at: string
          current_latitude: number | null
          current_longitude: number | null
          driver_id: string
          id: string
          last_location_at: string | null
          mobile_number: string
          name: string
          online: boolean
          rating: number
          rating_count: number
          status: Database["public"]["Enums"]["driver_status"]
          updated_at: string
          vehicle_type: string
        }
        Insert: {
          active_order_id?: string | null
          completed_orders?: number
          created_at?: string
          current_latitude?: number | null
          current_longitude?: number | null
          driver_id: string
          id?: string
          last_location_at?: string | null
          mobile_number: string
          name: string
          online?: boolean
          rating?: number
          rating_count?: number
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
          vehicle_type?: string
        }
        Update: {
          active_order_id?: string | null
          completed_orders?: number
          created_at?: string
          current_latitude?: number | null
          current_longitude?: number | null
          driver_id?: string
          id?: string
          last_location_at?: string | null
          mobile_number?: string
          name?: string
          online?: boolean
          rating?: number
          rating_count?: number
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
          vehicle_type?: string
        }
        Relationships: []
      }
      delivery_slots: {
        Row: {
          created_at: string
          end_time: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      driver_access_events: {
        Row: {
          active: boolean
          driver_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          driver_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          driver_id?: string
          updated_at?: string
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
      driver_locations: {
        Row: {
          accuracy: number | null
          driver_id: string
          heading: number | null
          id: string
          latitude: number
          longitude: number
          order_id: string | null
          recorded_at: string
          speed: number | null
        }
        Insert: {
          accuracy?: number | null
          driver_id: string
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          order_id?: string | null
          recorded_at?: string
          speed?: number | null
        }
        Update: {
          accuracy?: number | null
          driver_id?: string
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          order_id?: string | null
          recorded_at?: string
          speed?: number | null
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
      driver_status_history: {
        Row: {
          actor: string
          created_at: string
          driver_id: string
          from_status: Database["public"]["Enums"]["driver_status"] | null
          id: string
          order_id: string | null
          to_status: Database["public"]["Enums"]["driver_status"]
        }
        Insert: {
          actor?: string
          created_at?: string
          driver_id: string
          from_status?: Database["public"]["Enums"]["driver_status"] | null
          id?: string
          order_id?: string | null
          to_status: Database["public"]["Enums"]["driver_status"]
        }
        Update: {
          actor?: string
          created_at?: string
          driver_id?: string
          from_status?: Database["public"]["Enums"]["driver_status"] | null
          id?: string
          order_id?: string | null
          to_status?: Database["public"]["Enums"]["driver_status"]
        }
        Relationships: []
      }
      inventory_alerts: {
        Row: {
          alert_type: string
          created_at: string
          current_stock: number
          id: string
          inventory_item_id: string | null
          market_id: string | null
          product_id: string
          product_name: string
          reorder_level: number
          resolved_at: string | null
          status: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          current_stock?: number
          id?: string
          inventory_item_id?: string | null
          market_id?: string | null
          product_id: string
          product_name?: string
          reorder_level?: number
          resolved_at?: string | null
          status?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          current_stock?: number
          id?: string
          inventory_item_id?: string | null
          market_id?: string | null
          product_id?: string
          product_name?: string
          reorder_level?: number
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_alerts_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          available_stock: number | null
          barcode: string
          created_at: string
          current_stock: number
          id: string
          market_id: string
          max_stock: number
          min_stock: number
          product_id: string
          product_name: string
          reorder_level: number
          reserved_stock: number
          selling_price: number
          sku: string
          updated_at: string
        }
        Insert: {
          available_stock?: number | null
          barcode?: string
          created_at?: string
          current_stock?: number
          id?: string
          market_id: string
          max_stock?: number
          min_stock?: number
          product_id: string
          product_name?: string
          reorder_level?: number
          reserved_stock?: number
          selling_price?: number
          sku?: string
          updated_at?: string
        }
        Update: {
          available_stock?: number | null
          barcode?: string
          created_at?: string
          current_stock?: number
          id?: string
          market_id?: string
          max_stock?: number
          min_stock?: number
          product_id?: string
          product_name?: string
          reorder_level?: number
          reserved_stock?: number
          selling_price?: number
          sku?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "partner_markets"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_notifications: {
        Row: {
          audience: string
          body: string
          created_at: string
          id: string
          kind: string
          order_id: string | null
          product_id: string | null
          purchase_order_id: string | null
          read: boolean
          supplier_id: string | null
          title: string
        }
        Insert: {
          audience?: string
          body?: string
          created_at?: string
          id?: string
          kind?: string
          order_id?: string | null
          product_id?: string | null
          purchase_order_id?: string | null
          read?: boolean
          supplier_id?: string | null
          title: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          id?: string
          kind?: string
          order_id?: string | null
          product_id?: string | null
          purchase_order_id?: string | null
          read?: boolean
          supplier_id?: string | null
          title?: string
        }
        Relationships: []
      }
      inventory_reservations: {
        Row: {
          created_at: string
          id: string
          market_id: string
          order_id: string
          product_id: string
          quantity: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          market_id: string
          order_id: string
          product_id: string
          quantity: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          market_id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "partner_markets"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          actor: string
          created_at: string
          id: string
          inventory_item_id: string | null
          market_id: string | null
          new_quantity: number
          new_reserved: number
          old_quantity: number
          old_reserved: number
          order_id: string | null
          product_id: string
          product_name: string
          reason: string
        }
        Insert: {
          actor?: string
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          market_id?: string | null
          new_quantity?: number
          new_reserved?: number
          old_quantity?: number
          old_reserved?: number
          order_id?: string | null
          product_id: string
          product_name?: string
          reason: string
        }
        Update: {
          actor?: string
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          market_id?: string | null
          new_quantity?: number
          new_reserved?: number
          old_quantity?: number
          old_reserved?: number
          order_id?: string | null
          product_id?: string
          product_name?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      market_replenish_requests: {
        Row: {
          created_at: string
          id: string
          market_id: string | null
          market_name: string
          note: string
          product_id: string
          product_name: string
          quantity: number
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          market_id?: string | null
          market_name?: string
          note?: string
          product_id?: string
          product_name?: string
          quantity?: number
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          market_id?: string | null
          market_name?: string
          note?: string
          product_id?: string
          product_name?: string
          quantity?: number
          status?: string
        }
        Relationships: []
      }
      mobile_number_changes: {
        Row: {
          changed_at: string
          id: string
          new_mobile_number: string
          old_mobile_number: string
          user_id: string
        }
        Insert: {
          changed_at?: string
          id?: string
          new_mobile_number: string
          old_mobile_number: string
          user_id: string
        }
        Update: {
          changed_at?: string
          id?: string
          new_mobile_number?: string
          old_mobile_number?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mobile_number_changes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notification_log: {
        Row: {
          body: string
          channel: string
          created_at: string
          error: string | null
          id: string
          kind: string
          recipient: string
          status: string
          title: string
        }
        Insert: {
          body?: string
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          recipient?: string
          status?: string
          title?: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          recipient?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          delivery_updates: boolean
          important_updates: boolean
          order_updates: boolean
          promotional_offers: boolean
          updated_at: string
          user_phone: string
        }
        Insert: {
          created_at?: string
          delivery_updates?: boolean
          important_updates?: boolean
          order_updates?: boolean
          promotional_offers?: boolean
          updated_at?: string
          user_phone: string
        }
        Update: {
          created_at?: string
          delivery_updates?: boolean
          important_updates?: boolean
          order_updates?: boolean
          promotional_offers?: boolean
          updated_at?: string
          user_phone?: string
        }
        Relationships: []
      }
      notification_recipients: {
        Row: {
          active: boolean
          address: string
          audience: string
          channel: string
          created_at: string
          id: string
          kinds: string[]
          label: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address: string
          audience?: string
          channel?: string
          created_at?: string
          id?: string
          kinds?: string[]
          label?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string
          audience?: string
          channel?: string
          created_at?: string
          id?: string
          kinds?: string[]
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          delivered_at: string | null
          error_message: string | null
          fcm_token: string | null
          id: string
          notification_type: string
          order_id: string | null
          read_at: string | null
          sent_at: string | null
          status: string
          title: string
          user_phone: string
        }
        Insert: {
          body?: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          fcm_token?: string | null
          id?: string
          notification_type: string
          order_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          status?: string
          title: string
          user_phone: string
        }
        Update: {
          body?: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          fcm_token?: string | null
          id?: string
          notification_type?: string
          order_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          status?: string
          title?: string
          user_phone?: string
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
      order_substitutions: {
        Row: {
          created_at: string
          id: string
          note: string | null
          order_id: string
          original_price: number
          product_id: string
          product_name: string
          quantity: number
          replacement_name: string | null
          replacement_price: number
          replacement_product_id: string | null
          responded_at: string | null
          status: string
          suggested_by: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          original_price?: number
          product_id: string
          product_name: string
          quantity?: number
          replacement_name?: string | null
          replacement_price?: number
          replacement_product_id?: string | null
          responded_at?: string | null
          status?: string
          suggested_by?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          original_price?: number
          product_id?: string
          product_name?: string
          quantity?: number
          replacement_name?: string | null
          replacement_price?: number
          replacement_product_id?: string | null
          responded_at?: string | null
          status?: string
          suggested_by?: string
          updated_at?: string
        }
        Relationships: []
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
          accepting_orders: boolean
          address: string
          created_at: string
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          phone: string | null
          prep_minutes: number
          updated_at: string
        }
        Insert: {
          accepting_orders?: boolean
          address: string
          created_at?: string
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          prep_minutes?: number
          updated_at?: string
        }
        Update: {
          accepting_orders?: boolean
          address?: string
          created_at?: string
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          prep_minutes?: number
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
      product_associations: {
        Row: {
          associated_product_id: string
          association_score: number
          co_purchase_count: number
          id: string
          product_id: string
          updated_at: string
        }
        Insert: {
          associated_product_id: string
          association_score?: number
          co_purchase_count?: number
          id?: string
          product_id: string
          updated_at?: string
        }
        Update: {
          associated_product_id?: string
          association_score?: number
          co_purchase_count?: number
          id?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_costs: {
        Row: {
          cost_price: number
          created_at: string
          product_id: string
          updated_at: string
        }
        Insert: {
          cost_price?: number
          created_at?: string
          product_id: string
          updated_at?: string
        }
        Update: {
          cost_price?: number
          created_at?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_offers: {
        Row: {
          applies_to_all: boolean
          badge: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          product_ids: Json
          sort_order: number
          title: string
          tone: string
          updated_at: string
        }
        Insert: {
          applies_to_all?: boolean
          badge?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          product_ids?: Json
          sort_order?: number
          title: string
          tone?: string
          updated_at?: string
        }
        Update: {
          applies_to_all?: boolean
          badge?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          product_ids?: Json
          sort_order?: number
          title?: string
          tone?: string
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
      promo_codes: {
        Row: {
          code: string
          created_at: string
          description: string
          discount_type: string
          discount_value: number
          ends_at: string | null
          first_order_only: boolean
          id: string
          is_active: boolean
          max_discount: number | null
          min_subtotal: number
          per_customer_limit: number
          product_ids: Json
          starts_at: string | null
          updated_at: string
          usage_limit: number | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          first_order_only?: boolean
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_subtotal?: number
          per_customer_limit?: number
          product_ids?: Json
          starts_at?: string | null
          updated_at?: string
          usage_limit?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          first_order_only?: boolean
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_subtotal?: number
          per_customer_limit?: number
          product_ids?: Json
          starts_at?: string | null
          updated_at?: string
          usage_limit?: number | null
        }
        Relationships: []
      }
      promo_redemptions: {
        Row: {
          code: string
          created_at: string
          discount: number
          id: string
          order_id: string | null
          phone: string
        }
        Insert: {
          code: string
          created_at?: string
          discount?: number
          id?: string
          order_id?: string | null
          phone: string
        }
        Update: {
          code?: string
          created_at?: string
          discount?: number
          id?: string
          order_id?: string | null
          phone?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          product_name: string
          purchase_order_id: string
          quantity: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          product_name?: string
          purchase_order_id: string
          quantity?: number
          unit_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          product_name?: string
          purchase_order_id?: string
          quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          auto_generated: boolean
          created_at: string
          expected_cost: number
          id: string
          market_id: string | null
          market_name: string
          notes: string | null
          status: string
          supplier_id: string
          supplier_name: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          auto_generated?: boolean
          created_at?: string
          expected_cost?: number
          id?: string
          market_id?: string | null
          market_name?: string
          notes?: string | null
          status?: string
          supplier_id?: string
          supplier_name?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          auto_generated?: boolean
          created_at?: string
          expected_cost?: number
          id?: string
          market_id?: string | null
          market_name?: string
          notes?: string | null
          status?: string
          supplier_id?: string
          supplier_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "partner_markets"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_settings: {
        Row: {
          cart_weight: number
          favorite_weight: number
          id: number
          min_co_purchase_count: number
          min_recommendation_score: number
          purchase_weight: number
          recommendation_limit: number
          repeat_purchase_bonus: number
          search_weight: number
          updated_at: string
          view_weight: number
        }
        Insert: {
          cart_weight?: number
          favorite_weight?: number
          id?: number
          min_co_purchase_count?: number
          min_recommendation_score?: number
          purchase_weight?: number
          recommendation_limit?: number
          repeat_purchase_bonus?: number
          search_weight?: number
          updated_at?: string
          view_weight?: number
        }
        Update: {
          cart_weight?: number
          favorite_weight?: number
          id?: number
          min_co_purchase_count?: number
          min_recommendation_score?: number
          purchase_weight?: number
          recommendation_limit?: number
          repeat_purchase_bonus?: number
          search_weight?: number
          updated_at?: string
          view_weight?: number
        }
        Relationships: []
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
      staff_accounts: {
        Row: {
          created_at: string
          full_name: string
          mobile_number: string
          ref_id: string | null
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          mobile_number: string
          ref_id?: string | null
          role: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          mobile_number?: string
          ref_id?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stock_alerts: {
        Row: {
          category: string
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          markets: string
          product_id: string
          product_name: string
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          markets?: string
          product_id: string
          product_name?: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          markets?: string
          product_id?: string
          product_name?: string
          status?: string
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
      user_notification_tokens: {
        Row: {
          created_at: string
          device_name: string
          fcm_token: string
          id: string
          notification_enabled: boolean
          platform: string
          updated_at: string
          user_phone: string
        }
        Insert: {
          created_at?: string
          device_name?: string
          fcm_token: string
          id?: string
          notification_enabled?: boolean
          platform?: string
          updated_at?: string
          user_phone: string
        }
        Update: {
          created_at?: string
          device_name?: string
          fcm_token?: string
          id?: string
          notification_enabled?: boolean
          platform?: string
          updated_at?: string
          user_phone?: string
        }
        Relationships: []
      }
      wallet_topups: {
        Row: {
          amount: number
          created_at: string
          id: string
          phone: string
          reference: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          phone: string
          reference?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          phone?: string
          reference?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
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
      commit_inventory: {
        Args: { p_actor?: string; p_order_id: string }
        Returns: undefined
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
      release_inventory: {
        Args: { p_actor?: string; p_order_id: string }
        Returns: undefined
      }
      reserve_inventory: {
        Args: { p_actor?: string; p_items: Json; p_order_id: string }
        Returns: Json
      }
    }
    Enums: {
      assignment_status:
        | "OFFERED"
        | "ACCEPTED"
        | "REJECTED"
        | "EXPIRED"
        | "CANCELLED"
        | "COMPLETED"
      driver_status:
        | "OFFLINE"
        | "ONLINE"
        | "AVAILABLE"
        | "ASSIGNED"
        | "PICKING_ORDER"
        | "ARRIVED_AT_STORE"
        | "EN_ROUTE"
        | "ARRIVED_AT_CUSTOMER"
        | "DELIVERED"
        | "BREAK"
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
      assignment_status: [
        "OFFERED",
        "ACCEPTED",
        "REJECTED",
        "EXPIRED",
        "CANCELLED",
        "COMPLETED",
      ],
      driver_status: [
        "OFFLINE",
        "ONLINE",
        "AVAILABLE",
        "ASSIGNED",
        "PICKING_ORDER",
        "ARRIVED_AT_STORE",
        "EN_ROUTE",
        "ARRIVED_AT_CUSTOMER",
        "DELIVERED",
        "BREAK",
      ],
    },
  },
} as const
