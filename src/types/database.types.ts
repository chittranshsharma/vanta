export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string;
          created_at: string;
          id: string;
          metadata: Json;
          resource_id: string | null;
          resource_type: string;
          user_id: string | null;
          workspace_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          resource_id?: string | null;
          resource_type: string;
          user_id?: string | null;
          workspace_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          resource_id?: string | null;
          resource_type?: string;
          user_id?: string | null;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_events_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          }
        ];
      };
      brand_audiences: {
        Row: {
          brand_id: string;
          created_at: string;
          created_by: string | null;
          demographics: string | null;
          description: string | null;
          id: string;
          motivations: string | null;
          notes: string | null;
          pain_points: string | null;
          psychographics: string | null;
          review_status: string;
          segment_name: string;
          source_reference: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          brand_id: string;
          created_at?: string;
          created_by?: string | null;
          demographics?: string | null;
          description?: string | null;
          id?: string;
          motivations?: string | null;
          notes?: string | null;
          pain_points?: string | null;
          psychographics?: string | null;
          review_status?: string;
          segment_name: string;
          source_reference?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          created_by?: string | null;
          demographics?: string | null;
          description?: string | null;
          id?: string;
          motivations?: string | null;
          notes?: string | null;
          pain_points?: string | null;
          psychographics?: string | null;
          review_status?: string;
          segment_name?: string;
          source_reference?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_audiences_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_audiences_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          }
        ];
      };
      brand_claims: {
        Row: {
          brand_id: string;
          claim_text: string;
          claim_type: string;
          condition: string | null;
          created_at: string;
          created_by: string | null;
          effective_date: string | null;
          expires_at: string | null;
          id: string;
          notes: string | null;
          rationale: string | null;
          review_status: string;
          source_reference: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          brand_id: string;
          claim_text: string;
          claim_type: string;
          condition?: string | null;
          created_at?: string;
          created_by?: string | null;
          effective_date?: string | null;
          expires_at?: string | null;
          id?: string;
          notes?: string | null;
          rationale?: string | null;
          review_status?: string;
          source_reference?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          brand_id?: string;
          claim_text?: string;
          claim_type?: string;
          condition?: string | null;
          created_at?: string;
          created_by?: string | null;
          effective_date?: string | null;
          expires_at?: string | null;
          id?: string;
          notes?: string | null;
          rationale?: string | null;
          review_status?: string;
          source_reference?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_claims_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_claims_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          }
        ];
      };
      brand_codex_versions: {
        Row: {
          brand_id: string;
          change_summary: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          snapshot: Json;
          version_number: number;
          workspace_id: string;
        };
        Insert: {
          brand_id: string;
          change_summary?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          snapshot?: Json;
          version_number: number;
          workspace_id: string;
        };
        Update: {
          brand_id?: string;
          change_summary?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          snapshot?: Json;
          version_number?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_codex_versions_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_codex_versions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          }
        ];
      };
      brand_competitors: {
        Row: {
          brand_id: string;
          competitor_name: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          differentiation: string | null;
          id: string;
          notes: string | null;
          source_reference: string | null;
          updated_at: string;
          watch_level: string;
          workspace_id: string;
        };
        Insert: {
          brand_id: string;
          competitor_name: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          differentiation?: string | null;
          id?: string;
          notes?: string | null;
          source_reference?: string | null;
          updated_at?: string;
          watch_level?: string;
          workspace_id: string;
        };
        Update: {
          brand_id?: string;
          competitor_name?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          differentiation?: string | null;
          id?: string;
          notes?: string | null;
          source_reference?: string | null;
          updated_at?: string;
          watch_level?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_competitors_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_competitors_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          }
        ];
      };
      brand_compliance_boundaries: {
        Row: {
          applies_to: string | null;
          boundary_type: string;
          brand_id: string;
          created_at: string;
          created_by: string | null;
          description: string;
          effective_date: string | null;
          enforcement_level: string;
          expires_at: string | null;
          id: string;
          notes: string | null;
          review_status: string;
          source_reference: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          applies_to?: string | null;
          boundary_type: string;
          brand_id: string;
          created_at?: string;
          created_by?: string | null;
          description: string;
          effective_date?: string | null;
          enforcement_level?: string;
          expires_at?: string | null;
          id?: string;
          notes?: string | null;
          review_status?: string;
          source_reference?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          applies_to?: string | null;
          boundary_type?: string;
          brand_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          effective_date?: string | null;
          enforcement_level?: string;
          expires_at?: string | null;
          id?: string;
          notes?: string | null;
          review_status?: string;
          source_reference?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_compliance_boundaries_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_compliance_boundaries_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          }
        ];
      };
      brand_proof_points: {
        Row: {
          brand_id: string;
          citation_date: string | null;
          citation_url: string | null;
          claim_id: string;
          created_at: string;
          created_by: string | null;
          evidence_class: string;
          freshness_date: string | null;
          id: string;
          notes: string | null;
          proof_text: string;
          review_status: string;
          source_coverage: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          brand_id: string;
          citation_date?: string | null;
          citation_url?: string | null;
          claim_id: string;
          created_at?: string;
          created_by?: string | null;
          evidence_class: string;
          freshness_date?: string | null;
          id?: string;
          notes?: string | null;
          proof_text: string;
          review_status?: string;
          source_coverage?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          brand_id?: string;
          citation_date?: string | null;
          citation_url?: string | null;
          claim_id?: string;
          created_at?: string;
          created_by?: string | null;
          evidence_class?: string;
          freshness_date?: string | null;
          id?: string;
          notes?: string | null;
          proof_text?: string;
          review_status?: string;
          source_coverage?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_proof_points_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_proof_points_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: false;
            referencedRelation: "brand_claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_proof_points_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          }
        ];
      };
      brand_tone_guidelines: {
        Row: {
          approved_direction: string | null;
          brand_id: string;
          created_at: string;
          created_by: string | null;
          dimension: string;
          examples: string | null;
          id: string;
          notes: string | null;
          prohibited_direction: string | null;
          review_status: string;
          source_reference: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          approved_direction?: string | null;
          brand_id: string;
          created_at?: string;
          created_by?: string | null;
          dimension: string;
          examples?: string | null;
          id?: string;
          notes?: string | null;
          prohibited_direction?: string | null;
          review_status?: string;
          source_reference?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          approved_direction?: string | null;
          brand_id?: string;
          created_at?: string;
          created_by?: string | null;
          dimension?: string;
          examples?: string | null;
          id?: string;
          notes?: string | null;
          prohibited_direction?: string | null;
          review_status?: string;
          source_reference?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_tone_guidelines_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_tone_guidelines_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          }
        ];
      };
      brands: {
        Row: {
          archived_at: string | null;
          core_promise: string | null;
          created_at: string;
          created_by: string | null;
          effective_date: string | null;
          id: string;
          name: string;
          notes: string | null;
          positioning_statement: string | null;
          product_category: string | null;
          review_status: string;
          source_reference: string | null;
          tagline: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          archived_at?: string | null;
          core_promise?: string | null;
          created_at?: string;
          created_by?: string | null;
          effective_date?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          positioning_statement?: string | null;
          product_category?: string | null;
          review_status?: string;
          source_reference?: string | null;
          tagline?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          core_promise?: string | null;
          created_at?: string;
          created_by?: string | null;
          effective_date?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          positioning_statement?: string | null;
          product_category?: string | null;
          review_status?: string;
          source_reference?: string | null;
          tagline?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brands_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: true;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          }
        ];
      };
      creative_assets: {
        Row: {
          asset_kind: string;
          blocked_reason: string | null;
          byte_size: number | null;
          content_sha256: string | null;
          created_at: string;
          created_by: string | null;
          declared_objective: string | null;
          declared_platform: string | null;
          id: string;
          ingestion_status: string;
          manual_text: string | null;
          mime_type: string | null;
          original_filename: string | null;
          source_id: string;
          storage_bucket: string | null;
          storage_path: string | null;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          asset_kind: string;
          blocked_reason?: string | null;
          byte_size?: number | null;
          content_sha256?: string | null;
          created_at?: string;
          created_by?: string | null;
          declared_objective?: string | null;
          declared_platform?: string | null;
          id?: string;
          ingestion_status?: string;
          manual_text?: string | null;
          mime_type?: string | null;
          original_filename?: string | null;
          source_id: string;
          storage_bucket?: string | null;
          storage_path?: string | null;
          title: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          asset_kind?: string;
          blocked_reason?: string | null;
          byte_size?: number | null;
          content_sha256?: string | null;
          created_at?: string;
          created_by?: string | null;
          declared_objective?: string | null;
          declared_platform?: string | null;
          id?: string;
          ingestion_status?: string;
          manual_text?: string | null;
          mime_type?: string | null;
          original_filename?: string | null;
          source_id?: string;
          storage_bucket?: string | null;
          storage_path?: string | null;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "creative_assets_source_id_workspace_id_fkey";
            columns: ["source_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "source_registry";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "creative_assets_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          }
        ];
      };
      creative_twins: {
        Row: {
          asset_id: string;
          asset_kind: string;
          created_at: string;
          declared_objective: string | null;
          declared_platform: string | null;
          deterministic_features: Json;
          id: string;
          known_gaps: Json;
          source_evidence_ids: Json;
          state: string;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          asset_id: string;
          asset_kind: string;
          created_at?: string;
          declared_objective?: string | null;
          declared_platform?: string | null;
          deterministic_features?: Json;
          id?: string;
          known_gaps?: Json;
          source_evidence_ids?: Json;
          state?: string;
          title: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          asset_id?: string;
          asset_kind?: string;
          created_at?: string;
          declared_objective?: string | null;
          declared_platform?: string | null;
          deterministic_features?: Json;
          id?: string;
          known_gaps?: Json;
          source_evidence_ids?: Json;
          state?: string;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "creative_twins_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: true;
            referencedRelation: "creative_assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "creative_twins_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          }
        ];
      };
      evidence_items: {
        Row: {
          citation_date: string | null;
          citation_url: string | null;
          claim_text: string;
          completeness: string;
          created_at: string;
          created_by: string | null;
          evidence_class: string;
          freshness_date: string | null;
          id: string;
          metric_definition: string | null;
          metric_key: string | null;
          metric_unit: string | null;
          metric_value: number | null;
          notes: string | null;
          review_status: string;
          source_id: string;
          time_window: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          citation_date?: string | null;
          citation_url?: string | null;
          claim_text: string;
          completeness?: string;
          created_at?: string;
          created_by?: string | null;
          evidence_class?: string;
          freshness_date?: string | null;
          id?: string;
          metric_definition?: string | null;
          metric_key?: string | null;
          metric_unit?: string | null;
          metric_value?: number | null;
          notes?: string | null;
          review_status?: string;
          source_id: string;
          time_window?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          citation_date?: string | null;
          citation_url?: string | null;
          claim_text?: string;
          completeness?: string;
          created_at?: string;
          created_by?: string | null;
          evidence_class?: string;
          freshness_date?: string | null;
          id?: string;
          metric_definition?: string | null;
          metric_key?: string | null;
          metric_unit?: string | null;
          metric_value?: number | null;
          notes?: string | null;
          review_status?: string;
          source_id?: string;
          time_window?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evidence_items_source_id_workspace_id_fkey";
            columns: ["source_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "source_registry";
            referencedColumns: ["id", "workspace_id"];
          }
        ];
      };
      ingestion_runs: {
        Row: {
          asset_id: string;
          completed_at: string | null;
          created_at: string;
          error_code: string | null;
          error_message: string | null;
          id: string;
          ingestion_method: string;
          started_by: string | null;
          status: string;
          validation_summary: Json;
          workspace_id: string;
        };
        Insert: {
          asset_id: string;
          completed_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          id?: string;
          ingestion_method: string;
          started_by?: string | null;
          status: string;
          validation_summary?: Json;
          workspace_id: string;
        };
        Update: {
          asset_id?: string;
          completed_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          id?: string;
          ingestion_method?: string;
          started_by?: string | null;
          status?: string;
          validation_summary?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingestion_runs_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "creative_assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ingestion_runs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          }
        ];
      };
      metric_definitions: {
        Row: {
          created_at: string;
          created_by: string | null;
          definition: string;
          display_name: string;
          id: string;
          measurement_method: string | null;
          metric_key: string;
          source_id: string | null;
          unit: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          definition: string;
          display_name: string;
          id?: string;
          measurement_method?: string | null;
          metric_key: string;
          source_id?: string | null;
          unit?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          definition?: string;
          display_name?: string;
          id?: string;
          measurement_method?: string | null;
          metric_key?: string;
          source_id?: string | null;
          unit?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "metric_definitions_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "source_registry";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metric_definitions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          }
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: []
      };
      source_registry: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          freshness_window_days: number;
          health_status: string;
          id: string;
          last_verified_at: string | null;
          name: string;
          notes: string | null;
          review_status: string;
          source_coverage: string;
          source_type: string;
          updated_at: string;
          url: string | null;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          freshness_window_days?: number;
          health_status?: string;
          id?: string;
          last_verified_at?: string | null;
          name: string;
          notes?: string | null;
          review_status?: string;
          source_coverage?: string;
          source_type?: string;
          updated_at?: string;
          url?: string | null;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          freshness_window_days?: number;
          health_status?: string;
          id?: string;
          last_verified_at?: string | null;
          name?: string;
          notes?: string | null;
          review_status?: string;
          source_coverage?: string;
          source_type?: string;
          updated_at?: string;
          url?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "source_registry_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          }
        ];
      };
      workspace_members: {
        Row: {
          created_at: string;
          id: string;
          role: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          }
        ];
      };
      workspaces: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: []
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_workspace_admin_or_owner: { Args: { ws_id: string }; Returns: boolean };
      is_workspace_member: { Args: { ws_id: string }; Returns: boolean };
      storage_workspace_id: { Args: { object_name: string }; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
