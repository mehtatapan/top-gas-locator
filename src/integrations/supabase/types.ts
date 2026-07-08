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
      atm_cash_events: {
        Row: {
          amount: number
          atm_id: string
          by_user: string | null
          created_at: string
          id: string
          kind: string
          notes: string | null
          occurred_at: string
          store_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          atm_id: string
          by_user?: string | null
          created_at?: string
          id?: string
          kind: string
          notes?: string | null
          occurred_at?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          atm_id?: string
          by_user?: string | null
          created_at?: string
          id?: string
          kind?: string
          notes?: string | null
          occurred_at?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atm_cash_events_atm_id_fkey"
            columns: ["atm_id"]
            isOneToOne: false
            referencedRelation: "atm_machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atm_cash_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      atm_machines: {
        Row: {
          active: boolean
          created_at: string
          id: string
          label: string
          meta: Json
          provider: string | null
          serial: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          label: string
          meta?: Json
          provider?: string | null
          serial?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          label?: string
          meta?: Json
          provider?: string | null
          serial?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atm_machines_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      atm_reports: {
        Row: {
          atm_id: string
          attachment_id: string | null
          created_at: string
          fees: number | null
          id: string
          period_end: string
          period_start: string
          store_id: string
          total_dispensed: number | null
          transactions: number | null
          updated_at: string
        }
        Insert: {
          atm_id: string
          attachment_id?: string | null
          created_at?: string
          fees?: number | null
          id?: string
          period_end: string
          period_start: string
          store_id: string
          total_dispensed?: number | null
          transactions?: number | null
          updated_at?: string
        }
        Update: {
          atm_id?: string
          attachment_id?: string | null
          created_at?: string
          fees?: number | null
          id?: string
          period_end?: string
          period_start?: string
          store_id?: string
          total_dispensed?: number | null
          transactions?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atm_reports_atm_id_fkey"
            columns: ["atm_id"]
            isOneToOne: false
            referencedRelation: "atm_machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atm_reports_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atm_reports_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          deleted_at: string | null
          drive_file_id: string
          drive_folder_id: string | null
          drive_folder_path: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          mime_type: string | null
          module: string
          name: string
          size_bytes: number | null
          store_id: string | null
          uploaded_at: string
          uploaded_by: string | null
          web_view_link: string | null
        }
        Insert: {
          deleted_at?: string | null
          drive_file_id: string
          drive_folder_id?: string | null
          drive_folder_path?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          mime_type?: string | null
          module: string
          name: string
          size_bytes?: number | null
          store_id?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
          web_view_link?: string | null
        }
        Update: {
          deleted_at?: string | null
          drive_file_id?: string
          drive_folder_id?: string | null
          drive_folder_path?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          mime_type?: string | null
          module?: string
          name?: string
          size_bytes?: number | null
          store_id?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
          web_view_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip: string | null
          module: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip?: string | null
          module: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip?: string | null
          module?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key: string
          meta: Json
          module: string
          name: string
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key: string
          meta?: Json
          module: string
          name: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key?: string
          meta?: Json
          module?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_checklists: {
        Row: {
          active: boolean
          cadence: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cadence?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cadence?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      compliance_items: {
        Row: {
          checklist_id: string
          created_at: string
          help: string | null
          id: string
          label: string
          required: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          checklist_id: string
          created_at?: string
          help?: string | null
          id?: string
          label: string
          required?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          checklist_id?: string
          created_at?: string
          help?: string | null
          id?: string
          label?: string
          required?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "compliance_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_responses: {
        Row: {
          answer: string | null
          attachment_id: string | null
          created_at: string
          id: string
          item_id: string
          notes: string | null
          responded_at: string
          responded_by: string | null
          run_id: string
          store_id: string
          updated_at: string
        }
        Insert: {
          answer?: string | null
          attachment_id?: string | null
          created_at?: string
          id?: string
          item_id: string
          notes?: string | null
          responded_at?: string
          responded_by?: string | null
          run_id: string
          store_id: string
          updated_at?: string
        }
        Update: {
          answer?: string | null
          attachment_id?: string | null
          created_at?: string
          id?: string
          item_id?: string
          notes?: string | null
          responded_at?: string
          responded_by?: string | null
          run_id?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_responses_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_responses_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "compliance_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_responses_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "compliance_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_responses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_runs: {
        Row: {
          checklist_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          due_at: string | null
          id: string
          notes: string | null
          score: number | null
          store_id: string
          updated_at: string
        }
        Insert: {
          checklist_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          notes?: string | null
          score?: number | null
          store_id: string
          updated_at?: string
        }
        Update: {
          checklist_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          notes?: string | null
          score?: number | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_runs_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "compliance_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_runs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_folders: {
        Row: {
          created_at: string
          drive_folder_id: string
          id: string
          parent_id: string | null
          path: string
        }
        Insert: {
          created_at?: string
          drive_folder_id: string
          id?: string
          parent_id?: string | null
          path: string
        }
        Update: {
          created_at?: string
          drive_folder_id?: string
          id?: string
          parent_id?: string | null
          path?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "drive_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          payload: Json
          send_after: string
          sent_at: string | null
          status: string
          subject: string | null
          template: string
          to_email: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          payload?: Json
          send_after?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template: string
          to_email: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          payload?: Json
          send_after?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template?: string
          to_email?: string
          updated_at?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          created_at: string
          email: string | null
          first_name: string
          hire_date: string | null
          hourly_rate: number | null
          id: string
          last_name: string
          meta: Json
          phone: string | null
          position_id: string | null
          salary: number | null
          status: string
          store_id: string | null
          termination_date: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name: string
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          last_name: string
          meta?: Json
          phone?: string | null
          position_id?: string | null
          salary?: number | null
          status?: string
          store_id?: string | null
          termination_date?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          last_name?: string
          meta?: Json
          phone?: string | null
          position_id?: string | null
          salary?: number | null
          status?: string
          store_id?: string | null
          termination_date?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          meta: Json
          name: string
          purchased_at: string | null
          serial: string | null
          status: string
          store_id: string
          updated_at: string
          vendor_id: string | null
          warranty_until: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          name: string
          purchased_at?: string | null
          serial?: string | null
          status?: string
          store_id: string
          updated_at?: string
          vendor_id?: string | null
          warranty_until?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          name?: string
          purchased_at?: string | null
          serial?: string | null
          status?: string
          store_id?: string
          updated_at?: string
          vendor_id?: string | null
          warranty_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key: string
          name: string
          parent_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key: string
          name: string
          parent_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_deliveries: {
        Row: {
          created_at: string
          created_by: string | null
          delivered_at: string
          id: string
          invoice_attachment_id: string | null
          invoice_number: string | null
          notes: string | null
          product_id: string
          store_id: string
          total_cost: number | null
          unit_cost: number | null
          updated_at: string
          vendor_id: string | null
          volume: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivered_at?: string
          id?: string
          invoice_attachment_id?: string | null
          invoice_number?: string | null
          notes?: string | null
          product_id: string
          store_id: string
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string
          vendor_id?: string | null
          volume: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivered_at?: string
          id?: string
          invoice_attachment_id?: string | null
          invoice_number?: string | null
          notes?: string | null
          product_id?: string
          store_id?: string
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string
          vendor_id?: string | null
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "fuel_deliveries_invoice_attachment_id_fkey"
            columns: ["invoice_attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_deliveries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fuel_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_deliveries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_deliveries_vendor_fk"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_inventory_readings: {
        Row: {
          created_at: string
          entered_by: string | null
          id: string
          notes: string | null
          reading_at: string
          store_id: string
          tank_id: string
          updated_at: string
          volume: number
        }
        Insert: {
          created_at?: string
          entered_by?: string | null
          id?: string
          notes?: string | null
          reading_at?: string
          store_id: string
          tank_id: string
          updated_at?: string
          volume: number
        }
        Update: {
          created_at?: string
          entered_by?: string | null
          id?: string
          notes?: string | null
          reading_at?: string
          store_id?: string
          tank_id?: string
          updated_at?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "fuel_inventory_readings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_inventory_readings_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "fuel_tanks"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_orders: {
        Row: {
          created_at: string
          created_by: string | null
          expected_at: string | null
          id: string
          notes: string | null
          ordered_at: string
          product_id: string
          status: string
          store_id: string
          unit_price: number | null
          updated_at: string
          vendor_id: string | null
          volume: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_at?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string
          product_id: string
          status?: string
          store_id: string
          unit_price?: number | null
          updated_at?: string
          vendor_id?: string | null
          volume: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_at?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string
          product_id?: string
          status?: string
          store_id?: string
          unit_price?: number | null
          updated_at?: string
          vendor_id?: string | null
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "fuel_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fuel_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_orders_vendor_fk"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_products: {
        Row: {
          active: boolean
          created_at: string
          grade: string | null
          id: string
          name: string
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          grade?: string | null
          id?: string
          name: string
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          grade?: string | null
          id?: string
          name?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      fuel_tanks: {
        Row: {
          active: boolean
          capacity: number | null
          created_at: string
          id: string
          label: string
          product_id: string
          store_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          capacity?: number | null
          created_at?: string
          id?: string
          label: string
          product_id: string
          store_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          capacity?: number | null
          created_at?: string
          id?: string
          label?: string
          product_id?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_tanks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fuel_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_tanks_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      gaming_manual_payouts: {
        Row: {
          amount: number
          created_at: string
          id: string
          paid_at: string
          paid_by: string | null
          period_id: string
          reason: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          paid_at?: string
          paid_by?: string | null
          period_id: string
          reason?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          paid_at?: string
          paid_by?: string | null
          period_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gaming_manual_payouts_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "gaming_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      gaming_periods: {
        Row: {
          closed_by: string | null
          created_at: string
          id: string
          notes: string | null
          opened_by: string | null
          period_end: string | null
          period_start: string
          status: Database["public"]["Enums"]["gaming_period_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          closed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          opened_by?: string | null
          period_end?: string | null
          period_start: string
          status?: Database["public"]["Enums"]["gaming_period_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          closed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          opened_by?: string | null
          period_end?: string | null
          period_start?: string
          status?: Database["public"]["Enums"]["gaming_period_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gaming_periods_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      gaming_reports: {
        Row: {
          generated_at: string
          generated_by: string | null
          id: string
          pdf_attachment_id: string | null
          period_id: string
        }
        Insert: {
          generated_at?: string
          generated_by?: string | null
          id?: string
          pdf_attachment_id?: string | null
          period_id: string
        }
        Update: {
          generated_at?: string
          generated_by?: string | null
          id?: string
          pdf_attachment_id?: string | null
          period_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gaming_reports_pdf_attachment_id_fkey"
            columns: ["pdf_attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gaming_reports_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "gaming_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      gaming_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          machine_id: string | null
          notes: string | null
          occurred_at: string
          period_id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          machine_id?: string | null
          notes?: string | null
          occurred_at?: string
          period_id: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          machine_id?: string | null
          notes?: string | null
          occurred_at?: string
          period_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "gaming_transactions_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "gaming_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      lottery_games: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          ticket_price: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          ticket_price?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          ticket_price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      lottery_shifts: {
        Row: {
          closed_by: string | null
          created_at: string
          id: string
          notes: string | null
          opened_by: string | null
          period_end: string | null
          period_start: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          closed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          opened_by?: string | null
          period_end?: string | null
          period_start: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          closed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          opened_by?: string | null
          period_end?: string | null
          period_start?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lottery_shifts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      lottery_transactions: {
        Row: {
          activated: number
          created_at: string
          game_id: string
          id: string
          notes: string | null
          redeemed: number
          returned: number
          shift_id: string
          sold: number
          store_id: string
          updated_at: string
        }
        Insert: {
          activated?: number
          created_at?: string
          game_id: string
          id?: string
          notes?: string | null
          redeemed?: number
          returned?: number
          shift_id: string
          sold?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          activated?: number
          created_at?: string
          game_id?: string
          id?: string
          notes?: string | null
          redeemed?: number
          returned?: number
          shift_id?: string
          sold?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lottery_transactions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "lottery_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lottery_transactions_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "lottery_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lottery_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_schedules: {
        Row: {
          active: boolean
          created_at: string
          equipment_id: string
          id: string
          interval_days: number
          label: string
          next_due: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          equipment_id: string
          id?: string
          interval_days: number
          label: string
          next_due?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          equipment_id?: string
          id?: string
          interval_days?: number
          label?: string
          next_due?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_schedules_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_schedules_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          cost: number | null
          created_at: string
          equipment_id: string
          id: string
          notes: string | null
          schedule_id: string | null
          scheduled_for: string | null
          store_id: string
          ticket_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          cost?: number | null
          created_at?: string
          equipment_id: string
          id?: string
          notes?: string | null
          schedule_id?: string | null
          scheduled_for?: string | null
          store_id: string
          ticket_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          cost?: number | null
          created_at?: string
          equipment_id?: string
          id?: string
          notes?: string | null
          schedule_id?: string | null
          scheduled_for?: string | null
          store_id?: string
          ticket_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tasks_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "maintenance_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payroll_entries: {
        Row: {
          created_at: string
          deductions: Json
          employee_id: string
          gross: number
          id: string
          net: number
          notes: string | null
          ot_hours: number
          period_id: string
          regular_hours: number
          store_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deductions?: Json
          employee_id: string
          gross?: number
          id?: string
          net?: number
          notes?: string | null
          ot_hours?: number
          period_id: string
          regular_hours?: number
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deductions?: Json
          employee_id?: string
          gross?: number
          id?: string
          net?: number
          notes?: string | null
          ot_hours?: number
          period_id?: string
          regular_hours?: number
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_periods: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          period_end: string
          period_start: string
          processed_at: string | null
          processed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          module: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          module?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          module?: string | null
        }
        Relationships: []
      }
      pnl_entries: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          entry_date: string
          expense_category_id: string | null
          id: string
          kind: Database["public"]["Enums"]["pnl_kind"]
          memo: string | null
          period_month: string
          revenue_category_id: string | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          entry_date?: string
          expense_category_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["pnl_kind"]
          memo?: string | null
          period_month: string
          revenue_category_id?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          entry_date?: string
          expense_category_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["pnl_kind"]
          memo?: string | null
          period_month?: string
          revenue_category_id?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pnl_entries_expense_category_id_fkey"
            columns: ["expense_category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pnl_entries_revenue_category_id_fkey"
            columns: ["revenue_category_id"]
            isOneToOne: false
            referencedRelation: "revenue_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pnl_entries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          avatar_drive_file_id: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_drive_file_id?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_drive_file_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          banner_attachment_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          starts_at: string | null
          status: Database["public"]["Enums"]["promotion_status"]
          store_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          banner_attachment_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["promotion_status"]
          store_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          banner_attachment_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["promotion_status"]
          store_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_banner_attachment_id_fkey"
            columns: ["banner_attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      report_definitions: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          key: string
          module: string
          name: string
          params: Json
          sql_snippet: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          key: string
          module: string
          name: string
          params?: Json
          sql_snippet: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          module?: string
          name?: string
          params?: Json
          sql_snippet?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_snapshots: {
        Row: {
          created_at: string
          definition_id: string
          generated_at: string
          generated_by: string | null
          id: string
          output_attachment_id: string | null
          params: Json
          summary: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          definition_id: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          output_attachment_id?: string | null
          params?: Json
          summary?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          definition_id?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          output_attachment_id?: string | null
          params?: Json
          summary?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_snapshots_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "report_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_snapshots_output_attachment_id_fkey"
            columns: ["output_attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key: string
          name: string
          parent_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key: string
          name: string
          parent_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "revenue_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          name?: string
        }
        Relationships: []
      }
      shifts: {
        Row: {
          created_at: string
          employee_id: string
          ends_at: string
          id: string
          notes: string | null
          role: string | null
          starts_at: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          ends_at: string
          id?: string
          notes?: string | null
          role?: string | null
          starts_at: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          ends_at?: string
          id?: string
          notes?: string | null
          role?: string | null
          starts_at?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_managers: {
        Row: {
          created_at: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_managers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          active: boolean
          address: string | null
          city: string | null
          created_at: string
          id: string
          meta: Json
          name: string
          phone: string | null
          slug: string
          state: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          meta?: Json
          name: string
          phone?: string | null
          slug: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          meta?: Json
          name?: string
          phone?: string | null
          slug?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ticket_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          assignee_id: string | null
          id: string
          ticket_id: string
          unassigned_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          assignee_id?: string | null
          id?: string
          ticket_id: string
          unassigned_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          assignee_id?: string | null
          id?: string
          ticket_id?: string
          unassigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_assignments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_categories: {
        Row: {
          created_at: string
          id: string
          key: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          name?: string
        }
        Relationships: []
      }
      ticket_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          ticket_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          ticket_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_history: {
        Row: {
          actor_id: string | null
          created_at: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          ticket_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          ticket_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assignee_id: string | null
          category_id: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          number: number
          priority: Database["public"]["Enums"]["ticket_priority"]
          status: Database["public"]["Enums"]["ticket_status"]
          store_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          category_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          number?: number
          priority?: Database["public"]["Enums"]["ticket_priority"]
          status?: Database["public"]["Enums"]["ticket_status"]
          store_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          category_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          number?: number
          priority?: Database["public"]["Enums"]["ticket_priority"]
          status?: Database["public"]["Enums"]["ticket_status"]
          store_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ticket_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          clock_in: string
          clock_out: string | null
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          source: string
          store_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          clock_in: string
          clock_out?: string | null
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          source?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          source?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          role_id: string
          store_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role_id: string
          store_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role_id?: string
          store_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          role: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          role?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          role?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_contacts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_contracts: {
        Row: {
          attachment_id: string | null
          created_at: string
          ends_at: string | null
          id: string
          starts_at: string | null
          terms: string | null
          title: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          attachment_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          starts_at?: string | null
          terms?: string | null
          title: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          attachment_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          starts_at?: string | null
          terms?: string | null
          title?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_contracts_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_contracts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          active: boolean
          address: string | null
          category_id: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          meta: Json
          name: string
          phone: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          category_id?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          meta?: Json
          name: string
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          category_id?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          meta?: Json
          name?: string
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_store: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: { _perm_key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: { _role_key: string; _user_id: string }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      my_permissions: {
        Args: never
        Returns: {
          permission_key: string
        }[]
      }
      user_store_ids: { Args: { _user_id: string }; Returns: string[] }
    }
    Enums: {
      gaming_period_status: "open" | "closed"
      pnl_kind: "expense" | "revenue"
      promotion_status: "draft" | "scheduled" | "active" | "archived"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status:
        | "open"
        | "in_progress"
        | "waiting"
        | "resolved"
        | "closed"
        | "cancelled"
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
      gaming_period_status: ["open", "closed"],
      pnl_kind: ["expense", "revenue"],
      promotion_status: ["draft", "scheduled", "active", "archived"],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: [
        "open",
        "in_progress",
        "waiting",
        "resolved",
        "closed",
        "cancelled",
      ],
    },
  },
} as const
