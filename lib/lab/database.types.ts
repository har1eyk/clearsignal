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
      assay_runs: {
        Row: {
          approved_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          id: string
          idempotency_key: string | null
          instrument_id: string
          lab_id: string
          method_version_id: string
          notes: string | null
          plate_format: number
          reagent_lot_id: string
          report_snapshot: Json | null
          run_number: string
          standard_lot_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["run_status"]
          submitted_at: string | null
          supersedes_run_id: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          idempotency_key?: string | null
          instrument_id: string
          lab_id: string
          method_version_id: string
          notes?: string | null
          plate_format: number
          reagent_lot_id: string
          report_snapshot?: Json | null
          run_number: string
          standard_lot_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["run_status"]
          submitted_at?: string | null
          supersedes_run_id?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          idempotency_key?: string | null
          instrument_id?: string
          lab_id?: string
          method_version_id?: string
          notes?: string | null
          plate_format?: number
          reagent_lot_id?: string
          report_snapshot?: Json | null
          run_number?: string
          standard_lot_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["run_status"]
          submitted_at?: string | null
          supersedes_run_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assay_runs_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assay_runs_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assay_runs_method_version_id_fkey"
            columns: ["method_version_id"]
            isOneToOne: false
            referencedRelation: "method_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assay_runs_reagent_lot_id_fkey"
            columns: ["reagent_lot_id"]
            isOneToOne: false
            referencedRelation: "material_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assay_runs_standard_lot_id_fkey"
            columns: ["standard_lot_id"]
            isOneToOne: false
            referencedRelation: "material_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assay_runs_supersedes_run_id_fkey"
            columns: ["supersedes_run_id"]
            isOneToOne: false
            referencedRelation: "assay_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          correlation_id: string | null
          entity_id: string | null
          entity_type: string
          id: number
          lab_id: string | null
          occurred_at: string
          operation: string
          reason: string | null
          transaction_id: number
        }
        Insert: {
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          correlation_id?: string | null
          entity_id?: string | null
          entity_type: string
          id?: never
          lab_id?: string | null
          occurred_at?: string
          operation: string
          reason?: string | null
          transaction_id?: number
        }
        Update: {
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          correlation_id?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: never
          lab_id?: string | null
          occurred_at?: string
          operation?: string
          reason?: string | null
          transaction_id?: number
        }
        Relationships: []
      }
      calculation_revisions: {
        Row: {
          calculated_at: string
          calculated_by: string
          curve_parameters: Json | null
          diagnostics: Json
          id: string
          idempotency_key: string | null
          input_sha256: string
          is_valid: boolean
          lab_id: string
          revision: number
          run_id: string
        }
        Insert: {
          calculated_at?: string
          calculated_by: string
          curve_parameters?: Json | null
          diagnostics: Json
          id?: string
          idempotency_key?: string | null
          input_sha256: string
          is_valid: boolean
          lab_id: string
          revision: number
          run_id: string
        }
        Update: {
          calculated_at?: string
          calculated_by?: string
          curve_parameters?: Json | null
          diagnostics?: Json
          id?: string
          idempotency_key?: string | null
          input_sha256?: string
          is_valid?: boolean
          lab_id?: string
          revision?: number
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calculation_revisions_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_revisions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "assay_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      deviations: {
        Row: {
          created_at: string
          created_by: string
          description: string
          deviation_code: string
          id: string
          impact_assessment: string | null
          lab_id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          run_id: string | null
          sample_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          deviation_code: string
          id?: string
          impact_assessment?: string | null
          lab_id: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          run_id?: string | null
          sample_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          deviation_code?: string
          id?: string
          impact_assessment?: string | null
          lab_id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          run_id?: string | null
          sample_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "deviations_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deviations_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "assay_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deviations_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
        ]
      }
      endpoint_readings: {
        Row: {
          entered_at: string
          entered_by: string
          fluorescence_rfu: number
          id: string
          lab_id: string
          plate_well_id: string
          run_id: string
          updated_at: string
        }
        Insert: {
          entered_at?: string
          entered_by: string
          fluorescence_rfu: number
          id?: string
          lab_id: string
          plate_well_id: string
          run_id: string
          updated_at?: string
        }
        Update: {
          entered_at?: string
          entered_by?: string
          fluorescence_rfu?: number
          id?: string
          lab_id?: string
          plate_well_id?: string
          run_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "endpoint_readings_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "endpoint_readings_plate_well_id_fkey"
            columns: ["plate_well_id"]
            isOneToOne: true
            referencedRelation: "plate_wells"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "endpoint_readings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "assay_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      instrument_events: {
        Row: {
          created_at: string
          created_by: string
          due_at: string | null
          event_type: string
          id: string
          instrument_id: string
          lab_id: string
          notes: string | null
          outcome: string
          performed_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          due_at?: string | null
          event_type: string
          id?: string
          instrument_id: string
          lab_id: string
          notes?: string | null
          outcome: string
          performed_at: string
        }
        Update: {
          created_at?: string
          created_by?: string
          due_at?: string | null
          event_type?: string
          id?: string
          instrument_id?: string
          lab_id?: string
          notes?: string | null
          outcome?: string
          performed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instrument_events_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instrument_events_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
        ]
      }
      instruments: {
        Row: {
          created_at: string
          created_by: string
          id: string
          instrument_code: string
          lab_id: string
          manufacturer: string | null
          model: string | null
          name: string
          serial_number: string | null
          status: Database["public"]["Enums"]["controlled_status"]
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          instrument_code: string
          lab_id: string
          manufacturer?: string | null
          model?: string | null
          name: string
          serial_number?: string | null
          status?: Database["public"]["Enums"]["controlled_status"]
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          instrument_code?: string
          lab_id?: string
          manufacturer?: string | null
          model?: string | null
          name?: string
          serial_number?: string | null
          status?: Database["public"]["Enums"]["controlled_status"]
        }
        Relationships: [
          {
            foreignKeyName: "instruments_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_memberships: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lab_id: string
          role: Database["public"]["Enums"]["lab_role"]
          status: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lab_id: string
          role: Database["public"]["Enums"]["lab_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lab_id?: string
          role?: Database["public"]["Enums"]["lab_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_memberships_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
        ]
      }
      laboratories: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      material_lots: {
        Row: {
          catalog_number: string | null
          certificate_uri: string | null
          concentration: number | null
          concentration_unit: string | null
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          lab_id: string
          lot_number: string
          manufacturer: string | null
          material_type: string
          name: string
          opened_at: string | null
          received_at: string | null
          status: Database["public"]["Enums"]["controlled_status"]
          storage_condition: string | null
        }
        Insert: {
          catalog_number?: string | null
          certificate_uri?: string | null
          concentration?: number | null
          concentration_unit?: string | null
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          lab_id: string
          lot_number: string
          manufacturer?: string | null
          material_type: string
          name: string
          opened_at?: string | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["controlled_status"]
          storage_condition?: string | null
        }
        Update: {
          catalog_number?: string | null
          certificate_uri?: string | null
          concentration?: number | null
          concentration_unit?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          lab_id?: string
          lot_number?: string
          manufacturer?: string | null
          material_type?: string
          name?: string
          opened_at?: string | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["controlled_status"]
          storage_condition?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_lots_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
        ]
      }
      method_versions: {
        Row: {
          blank_max_rfu: number
          created_at: string
          created_by: string
          curve_model: Database["public"]["Enums"]["curve_model"]
          effective_at: string | null
          id: string
          lab_id: string
          method_code: string
          name: string
          notes: string | null
          ppc_recovery_max_pct: number
          ppc_recovery_min_pct: number
          r2_min: number
          replicate_cv_max_pct: number
          retired_at: string | null
          sop_version_id: string | null
          standard_max_eu_ml: number
          standard_min_eu_ml: number
          status: Database["public"]["Enums"]["controlled_status"]
          version: string
        }
        Insert: {
          blank_max_rfu: number
          created_at?: string
          created_by: string
          curve_model: Database["public"]["Enums"]["curve_model"]
          effective_at?: string | null
          id?: string
          lab_id: string
          method_code: string
          name: string
          notes?: string | null
          ppc_recovery_max_pct: number
          ppc_recovery_min_pct: number
          r2_min: number
          replicate_cv_max_pct: number
          retired_at?: string | null
          sop_version_id?: string | null
          standard_max_eu_ml: number
          standard_min_eu_ml: number
          status?: Database["public"]["Enums"]["controlled_status"]
          version: string
        }
        Update: {
          blank_max_rfu?: number
          created_at?: string
          created_by?: string
          curve_model?: Database["public"]["Enums"]["curve_model"]
          effective_at?: string | null
          id?: string
          lab_id?: string
          method_code?: string
          name?: string
          notes?: string | null
          ppc_recovery_max_pct?: number
          ppc_recovery_min_pct?: number
          r2_min?: number
          replicate_cv_max_pct?: number
          retired_at?: string | null
          sop_version_id?: string | null
          standard_max_eu_ml?: number
          standard_min_eu_ml?: number
          status?: Database["public"]["Enums"]["controlled_status"]
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "method_versions_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "method_versions_sop_version_id_fkey"
            columns: ["sop_version_id"]
            isOneToOne: false
            referencedRelation: "sop_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      plate_wells: {
        Row: {
          created_at: string
          created_by: string
          dilution_factor: number
          id: string
          lab_id: string
          replicate: number
          role: Database["public"]["Enums"]["well_role"]
          run_id: string
          sample_id: string | null
          source_artifact_id: string | null
          spike_eu_ml: number | null
          standard_eu_ml: number | null
          updated_at: string
          well: string
        }
        Insert: {
          created_at?: string
          created_by: string
          dilution_factor?: number
          id?: string
          lab_id: string
          replicate: number
          role: Database["public"]["Enums"]["well_role"]
          run_id: string
          sample_id?: string | null
          source_artifact_id?: string | null
          spike_eu_ml?: number | null
          standard_eu_ml?: number | null
          updated_at?: string
          well: string
        }
        Update: {
          created_at?: string
          created_by?: string
          dilution_factor?: number
          id?: string
          lab_id?: string
          replicate?: number
          role?: Database["public"]["Enums"]["well_role"]
          run_id?: string
          sample_id?: string | null
          source_artifact_id?: string | null
          spike_eu_ml?: number | null
          standard_eu_ml?: number | null
          updated_at?: string
          well?: string
        }
        Relationships: [
          {
            foreignKeyName: "plate_wells_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plate_wells_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "assay_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plate_wells_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plate_wells_source_artifact_id_fkey"
            columns: ["source_artifact_id"]
            isOneToOne: false
            referencedRelation: "raw_artifacts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      raw_artifacts: {
        Row: {
          byte_size: number
          id: string
          idempotency_key: string | null
          lab_id: string
          mime_type: string
          original_filename: string
          run_id: string
          sha256: string
          storage_bucket: string
          storage_path: string
          storage_version: string | null
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          byte_size: number
          id?: string
          idempotency_key?: string | null
          lab_id: string
          mime_type: string
          original_filename: string
          run_id: string
          sha256: string
          storage_bucket?: string
          storage_path: string
          storage_version?: string | null
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          byte_size?: number
          id?: string
          idempotency_key?: string | null
          lab_id?: string
          mime_type?: string
          original_filename?: string
          run_id?: string
          sha256?: string
          storage_bucket?: string
          storage_path?: string
          storage_version?: string | null
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_artifacts_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_artifacts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "assay_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      review_actions: {
        Row: {
          comment: string | null
          decision: Database["public"]["Enums"]["review_decision"]
          id: string
          idempotency_key: string | null
          lab_id: string
          meaning: string
          report_snapshot: Json | null
          reviewed_at: string
          reviewed_by: string
          run_id: string
        }
        Insert: {
          comment?: string | null
          decision: Database["public"]["Enums"]["review_decision"]
          id?: string
          idempotency_key?: string | null
          lab_id: string
          meaning: string
          report_snapshot?: Json | null
          reviewed_at?: string
          reviewed_by: string
          run_id: string
        }
        Update: {
          comment?: string | null
          decision?: Database["public"]["Enums"]["review_decision"]
          id?: string
          idempotency_key?: string | null
          lab_id?: string
          meaning?: string
          report_snapshot?: Json | null
          reviewed_at?: string
          reviewed_by?: string
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_actions_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_actions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "assay_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      run_samples: {
        Row: {
          created_at: string
          created_by: string
          id: string
          lab_id: string
          planned_dilution: number
          run_id: string
          sample_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          lab_id: string
          planned_dilution: number
          run_id: string
          sample_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          lab_id?: string
          planned_dilution?: number
          run_id?: string
          sample_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_samples_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_samples_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "assay_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_samples_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
        ]
      }
      sample_components: {
        Row: {
          amount: number | null
          amount_unit: string | null
          created_at: string
          created_by: string
          derived_sample_id: string
          id: string
          lab_id: string
          source_sample_id: string
        }
        Insert: {
          amount?: number | null
          amount_unit?: string | null
          created_at?: string
          created_by: string
          derived_sample_id: string
          id?: string
          lab_id: string
          source_sample_id: string
        }
        Update: {
          amount?: number | null
          amount_unit?: string | null
          created_at?: string
          created_by?: string
          derived_sample_id?: string
          id?: string
          lab_id?: string
          source_sample_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sample_components_derived_sample_id_fkey"
            columns: ["derived_sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sample_components_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sample_components_source_sample_id_fkey"
            columns: ["source_sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
        ]
      }
      sample_events: {
        Row: {
          condition: string | null
          created_at: string
          created_by: string
          event_type: string
          id: string
          lab_id: string
          location: string | null
          notes: string | null
          occurred_at: string
          quantity: number | null
          quantity_unit: string | null
          sample_id: string
        }
        Insert: {
          condition?: string | null
          created_at?: string
          created_by: string
          event_type: string
          id?: string
          lab_id: string
          location?: string | null
          notes?: string | null
          occurred_at: string
          quantity?: number | null
          quantity_unit?: string | null
          sample_id: string
        }
        Update: {
          condition?: string | null
          created_at?: string
          created_by?: string
          event_type?: string
          id?: string
          lab_id?: string
          location?: string | null
          notes?: string | null
          occurred_at?: string
          quantity?: number | null
          quantity_unit?: string | null
          sample_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sample_events_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sample_events_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
        ]
      }
      sample_results: {
        Row: {
          calculation_revision_id: string
          corrected_eu_ml: number | null
          created_at: string
          created_by: string
          id: string
          lab_id: string
          measured_eu_ml: number | null
          ppc_recovery_pct: number | null
          qualifier: Database["public"]["Enums"]["result_qualifier"]
          replicate_cv_pct: number | null
          run_id: string
          sample_id: string
          specification_decision: Database["public"]["Enums"]["specification_decision"]
          validity_details: Json
        }
        Insert: {
          calculation_revision_id: string
          corrected_eu_ml?: number | null
          created_at?: string
          created_by: string
          id?: string
          lab_id: string
          measured_eu_ml?: number | null
          ppc_recovery_pct?: number | null
          qualifier: Database["public"]["Enums"]["result_qualifier"]
          replicate_cv_pct?: number | null
          run_id: string
          sample_id: string
          specification_decision: Database["public"]["Enums"]["specification_decision"]
          validity_details?: Json
        }
        Update: {
          calculation_revision_id?: string
          corrected_eu_ml?: number | null
          created_at?: string
          created_by?: string
          id?: string
          lab_id?: string
          measured_eu_ml?: number | null
          ppc_recovery_pct?: number | null
          qualifier?: Database["public"]["Enums"]["result_qualifier"]
          replicate_cv_pct?: number | null
          run_id?: string
          sample_id?: string
          specification_decision?: Database["public"]["Enums"]["specification_decision"]
          validity_details?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sample_results_calculation_revision_id_fkey"
            columns: ["calculation_revision_id"]
            isOneToOne: false
            referencedRelation: "calculation_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sample_results_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sample_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "assay_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sample_results_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
        ]
      }
      samples: {
        Row: {
          collected_at: string | null
          collected_by: string | null
          created_at: string
          created_by: string
          disposition_reason: string | null
          endotoxin_limit_eu_ml: number
          external_id: string
          id: string
          kind: Database["public"]["Enums"]["sample_kind"]
          lab_id: string
          matrix: string
          maximum_valid_dilution: number
          process_stage: string | null
          product_lot: string | null
          product_name: string | null
          quantity: number | null
          quantity_unit: string | null
          receipt_condition: string | null
          received_at: string | null
          received_by: string | null
          status: Database["public"]["Enums"]["sample_status"]
          storage_condition: string | null
          test_order_id: string | null
          updated_at: string
        }
        Insert: {
          collected_at?: string | null
          collected_by?: string | null
          created_at?: string
          created_by: string
          disposition_reason?: string | null
          endotoxin_limit_eu_ml: number
          external_id: string
          id?: string
          kind?: Database["public"]["Enums"]["sample_kind"]
          lab_id: string
          matrix: string
          maximum_valid_dilution: number
          process_stage?: string | null
          product_lot?: string | null
          product_name?: string | null
          quantity?: number | null
          quantity_unit?: string | null
          receipt_condition?: string | null
          received_at?: string | null
          received_by?: string | null
          status?: Database["public"]["Enums"]["sample_status"]
          storage_condition?: string | null
          test_order_id?: string | null
          updated_at?: string
        }
        Update: {
          collected_at?: string | null
          collected_by?: string | null
          created_at?: string
          created_by?: string
          disposition_reason?: string | null
          endotoxin_limit_eu_ml?: number
          external_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["sample_kind"]
          lab_id?: string
          matrix?: string
          maximum_valid_dilution?: number
          process_stage?: string | null
          product_lot?: string | null
          product_name?: string | null
          quantity?: number | null
          quantity_unit?: string | null
          receipt_condition?: string | null
          received_at?: string | null
          received_by?: string | null
          status?: Database["public"]["Enums"]["sample_status"]
          storage_condition?: string | null
          test_order_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "samples_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "samples_test_order_id_fkey"
            columns: ["test_order_id"]
            isOneToOne: false
            referencedRelation: "test_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sop_versions: {
        Row: {
          content_sha256: string | null
          created_at: string
          created_by: string
          document_uri: string | null
          effective_at: string | null
          id: string
          lab_id: string
          retired_at: string | null
          sop_code: string
          status: Database["public"]["Enums"]["controlled_status"]
          title: string
          version: string
        }
        Insert: {
          content_sha256?: string | null
          created_at?: string
          created_by: string
          document_uri?: string | null
          effective_at?: string | null
          id?: string
          lab_id: string
          retired_at?: string | null
          sop_code: string
          status?: Database["public"]["Enums"]["controlled_status"]
          title: string
          version: string
        }
        Update: {
          content_sha256?: string | null
          created_at?: string
          created_by?: string
          document_uri?: string | null
          effective_at?: string | null
          id?: string
          lab_id?: string
          retired_at?: string | null
          sop_code?: string
          status?: Database["public"]["Enums"]["controlled_status"]
          title?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "sop_versions_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
        ]
      }
      test_orders: {
        Row: {
          client_name: string | null
          created_at: string
          created_by: string
          id: string
          lab_id: string
          order_number: string
          project_name: string | null
          purpose: string | null
          requested_at: string
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          created_by: string
          id?: string
          lab_id: string
          order_number: string
          project_name?: string | null
          purpose?: string | null
          requested_at?: string
        }
        Update: {
          client_name?: string | null
          created_at?: string
          created_by?: string
          id?: string
          lab_id?: string
          order_number?: string
          project_name?: string | null
          purpose?: string | null
          requested_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_orders_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_lab_admin: {
        Args: { p_lab_name: string; p_user_id: string }
        Returns: string
      }
      build_run_report: { Args: { p_run_id: string }; Returns: Json }
      calculate_assay_run: {
        Args: { p_idempotency_key?: string; p_run_id: string }
        Returns: string
      }
      create_assay_run: {
        Args: { p_idempotency_key?: string; p_payload: Json }
        Returns: string
      }
      create_instrument: { Args: { p_payload: Json }; Returns: string }
      create_material_lot: { Args: { p_payload: Json }; Returns: string }
      create_method_version: { Args: { p_payload: Json }; Returns: string }
      create_sample: {
        Args: { p_idempotency_key?: string; p_payload: Json }
        Returns: string
      }
      create_sop_version: { Args: { p_payload: Json }; Returns: string }
      has_lab_role: {
        Args: {
          p_lab_id: string
          p_roles: Database["public"]["Enums"]["lab_role"][]
        }
        Returns: boolean
      }
      record_instrument_event: { Args: { p_payload: Json }; Returns: string }
      record_sample_event: {
        Args: { p_payload: Json; p_reason?: string; p_sample_id: string }
        Returns: string
      }
      register_raw_artifact: {
        Args: { p_idempotency_key?: string; p_payload: Json; p_run_id: string }
        Returns: string
      }
      require_lab_role: {
        Args: {
          p_lab_id: string
          p_roles: Database["public"]["Enums"]["lab_role"][]
        }
        Returns: undefined
      }
      review_assay_run: {
        Args: {
          p_comment?: string
          p_decision: Database["public"]["Enums"]["review_decision"]
          p_idempotency_key?: string
          p_meaning: string
          p_run_id: string
        }
        Returns: string
      }
      save_calculation_revision: {
        Args: {
          p_curve_parameters: Json
          p_diagnostics: Json
          p_idempotency_key?: string
          p_input_sha256: string
          p_is_valid: boolean
          p_results: Json
          p_run_id: string
        }
        Returns: string
      }
      set_instrument_status: {
        Args: {
          p_id: string
          p_reason: string
          p_status: Database["public"]["Enums"]["controlled_status"]
        }
        Returns: undefined
      }
      set_material_lot_status: {
        Args: {
          p_id: string
          p_reason: string
          p_status: Database["public"]["Enums"]["controlled_status"]
        }
        Returns: undefined
      }
      set_method_status: {
        Args: {
          p_id: string
          p_reason: string
          p_status: Database["public"]["Enums"]["controlled_status"]
        }
        Returns: undefined
      }
      set_sop_status: {
        Args: {
          p_id: string
          p_reason: string
          p_status: Database["public"]["Enums"]["controlled_status"]
        }
        Returns: undefined
      }
      submit_assay_run: {
        Args: { p_reason?: string; p_run_id: string }
        Returns: undefined
      }
      upsert_endpoint_readings: {
        Args: {
          p_artifact_id?: string
          p_reason?: string
          p_rows: Json
          p_run_id: string
        }
        Returns: number
      }
    }
    Enums: {
      controlled_status: "draft" | "active" | "retired"
      curve_model: "linear" | "log10-linear"
      lab_role: "admin" | "analyst" | "reviewer" | "viewer"
      membership_status: "active" | "inactive"
      result_qualifier: "within_range" | "below_lloq" | "above_uloq" | "invalid"
      review_decision: "approve" | "reject" | "invalidate"
      run_status:
        | "draft"
        | "in_progress"
        | "calculated"
        | "submitted"
        | "approved"
        | "rejected"
        | "invalidated"
      sample_kind: "original" | "aliquot" | "pool"
      sample_status:
        | "registered"
        | "received"
        | "in_storage"
        | "in_testing"
        | "consumed"
        | "disposed"
      specification_decision: "pass" | "fail" | "not_reportable"
      well_role: "blank" | "standard" | "sample" | "ppc"
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
      controlled_status: ["draft", "active", "retired"],
      curve_model: ["linear", "log10-linear"],
      lab_role: ["admin", "analyst", "reviewer", "viewer"],
      membership_status: ["active", "inactive"],
      result_qualifier: ["within_range", "below_lloq", "above_uloq", "invalid"],
      review_decision: ["approve", "reject", "invalidate"],
      run_status: [
        "draft",
        "in_progress",
        "calculated",
        "submitted",
        "approved",
        "rejected",
        "invalidated",
      ],
      sample_kind: ["original", "aliquot", "pool"],
      sample_status: [
        "registered",
        "received",
        "in_storage",
        "in_testing",
        "consumed",
        "disposed",
      ],
      specification_decision: ["pass", "fail", "not_reportable"],
      well_role: ["blank", "standard", "sample", "ppc"],
    },
  },
} as const
