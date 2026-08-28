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
      audit_events: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          resource_id: string | null
          resource_type: string
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_audiences: {
        Row: {
          brand_id: string
          created_at: string
          created_by: string | null
          demographics: string | null
          description: string | null
          id: string
          motivations: string | null
          notes: string | null
          pain_points: string | null
          psychographics: string | null
          review_status: string
          segment_name: string
          source_reference: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          created_by?: string | null
          demographics?: string | null
          description?: string | null
          id?: string
          motivations?: string | null
          notes?: string | null
          pain_points?: string | null
          psychographics?: string | null
          review_status?: string
          segment_name: string
          source_reference?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          created_by?: string | null
          demographics?: string | null
          description?: string | null
          id?: string
          motivations?: string | null
          notes?: string | null
          pain_points?: string | null
          psychographics?: string | null
          review_status?: string
          segment_name?: string
          source_reference?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_audiences_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_audiences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_claims: {
        Row: {
          brand_id: string
          claim_text: string
          claim_type: string
          condition: string | null
          created_at: string
          created_by: string | null
          effective_date: string | null
          expires_at: string | null
          id: string
          notes: string | null
          rationale: string | null
          review_status: string
          source_reference: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          brand_id: string
          claim_text: string
          claim_type: string
          condition?: string | null
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          rationale?: string | null
          review_status?: string
          source_reference?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          brand_id?: string
          claim_text?: string
          claim_type?: string
          condition?: string | null
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          rationale?: string | null
          review_status?: string
          source_reference?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_claims_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_claims_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_codex_versions: {
        Row: {
          brand_id: string
          change_summary: string | null
          created_at: string
          created_by: string | null
          id: string
          snapshot: Json
          version_number: number
          workspace_id: string
        }
        Insert: {
          brand_id: string
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          snapshot?: Json
          version_number: number
          workspace_id: string
        }
        Update: {
          brand_id?: string
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          snapshot?: Json
          version_number?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_codex_versions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_codex_versions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_competitors: {
        Row: {
          brand_id: string
          competitor_name: string
          created_at: string
          created_by: string | null
          description: string | null
          differentiation: string | null
          id: string
          notes: string | null
          source_reference: string | null
          updated_at: string
          watch_level: string
          workspace_id: string
        }
        Insert: {
          brand_id: string
          competitor_name: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          differentiation?: string | null
          id?: string
          notes?: string | null
          source_reference?: string | null
          updated_at?: string
          watch_level?: string
          workspace_id: string
        }
        Update: {
          brand_id?: string
          competitor_name?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          differentiation?: string | null
          id?: string
          notes?: string | null
          source_reference?: string | null
          updated_at?: string
          watch_level?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_competitors_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_competitors_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_compliance_boundaries: {
        Row: {
          applies_to: string | null
          boundary_type: string
          brand_id: string
          created_at: string
          created_by: string | null
          description: string
          effective_date: string | null
          enforcement_level: string
          expires_at: string | null
          id: string
          notes: string | null
          review_status: string
          source_reference: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          applies_to?: string | null
          boundary_type: string
          brand_id: string
          created_at?: string
          created_by?: string | null
          description: string
          effective_date?: string | null
          enforcement_level?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          review_status?: string
          source_reference?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          applies_to?: string | null
          boundary_type?: string
          brand_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          effective_date?: string | null
          enforcement_level?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          review_status?: string
          source_reference?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_compliance_boundaries_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_compliance_boundaries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_proof_points: {
        Row: {
          brand_id: string
          citation_date: string | null
          citation_url: string | null
          claim_id: string
          created_at: string
          created_by: string | null
          evidence_class: string
          freshness_date: string | null
          id: string
          notes: string | null
          proof_text: string
          review_status: string
          source_coverage: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          brand_id: string
          citation_date?: string | null
          citation_url?: string | null
          claim_id: string
          created_at?: string
          created_by?: string | null
          evidence_class: string
          freshness_date?: string | null
          id?: string
          notes?: string | null
          proof_text: string
          review_status?: string
          source_coverage?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          brand_id?: string
          citation_date?: string | null
          citation_url?: string | null
          claim_id?: string
          created_at?: string
          created_by?: string | null
          evidence_class?: string
          freshness_date?: string | null
          id?: string
          notes?: string | null
          proof_text?: string
          review_status?: string
          source_coverage?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_proof_points_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_proof_points_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "brand_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_proof_points_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_tone_guidelines: {
        Row: {
          approved_direction: string | null
          brand_id: string
          created_at: string
          created_by: string | null
          dimension: string
          examples: string | null
          id: string
          notes: string | null
          prohibited_direction: string | null
          review_status: string
          source_reference: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          approved_direction?: string | null
          brand_id: string
          created_at?: string
          created_by?: string | null
          dimension: string
          examples?: string | null
          id?: string
          notes?: string | null
          prohibited_direction?: string | null
          review_status?: string
          source_reference?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          approved_direction?: string | null
          brand_id?: string
          created_at?: string
          created_by?: string | null
          dimension?: string
          examples?: string | null
          id?: string
          notes?: string | null
          prohibited_direction?: string | null
          review_status?: string
          source_reference?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_tone_guidelines_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_tone_guidelines_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          archived_at: string | null
          core_promise: string | null
          created_at: string
          created_by: string | null
          effective_date: string | null
          id: string
          name: string
          notes: string | null
          positioning_statement: string | null
          product_category: string | null
          review_status: string
          source_reference: string | null
          tagline: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          core_promise?: string | null
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          id?: string
          name: string
          notes?: string | null
          positioning_statement?: string | null
          product_category?: string | null
          review_status?: string
          source_reference?: string | null
          tagline?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          core_promise?: string | null
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          positioning_statement?: string | null
          product_category?: string | null
          review_status?: string
          source_reference?: string | null
          tagline?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_accounts: {
        Row: {
          access_token_ciphertext: string | null
          consent_granted_at: string | null
          consent_granted_by: string | null
          created_at: string
          created_by: string | null
          display_name: string | null
          external_account_id: string | null
          granted_scopes: string[]
          id: string
          last_error: Json | null
          last_sync_at: string | null
          provider: string
          refresh_token_ciphertext: string | null
          requested_scopes: string[]
          revoked_at: string | null
          revoked_by: string | null
          status: string
          token_expires_at: string | null
          token_key_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          access_token_ciphertext?: string | null
          consent_granted_at?: string | null
          consent_granted_by?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          external_account_id?: string | null
          granted_scopes?: string[]
          id?: string
          last_error?: Json | null
          last_sync_at?: string | null
          provider: string
          refresh_token_ciphertext?: string | null
          requested_scopes?: string[]
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          token_expires_at?: string | null
          token_key_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          access_token_ciphertext?: string | null
          consent_granted_at?: string | null
          consent_granted_by?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          external_account_id?: string | null
          granted_scopes?: string[]
          id?: string
          last_error?: Json | null
          last_sync_at?: string | null
          provider?: string
          refresh_token_ciphertext?: string | null
          requested_scopes?: string[]
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          token_expires_at?: string | null
          token_key_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connector_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_attributions: {
        Row: {
          brand_claim_id: string | null
          created_at: string
          created_by: string | null
          cta_identifier: string | null
          destination_url: string | null
          experiment_id: string | null
          id: string
          observation_id: string
          provenance: Json
          twin_id: string | null
          twin_version_id: string | null
          variant_twin_id: string | null
          workspace_id: string
        }
        Insert: {
          brand_claim_id?: string | null
          created_at?: string
          created_by?: string | null
          cta_identifier?: string | null
          destination_url?: string | null
          experiment_id?: string | null
          id?: string
          observation_id: string
          provenance?: Json
          twin_id?: string | null
          twin_version_id?: string | null
          variant_twin_id?: string | null
          workspace_id: string
        }
        Update: {
          brand_claim_id?: string | null
          created_at?: string
          created_by?: string | null
          cta_identifier?: string | null
          destination_url?: string | null
          experiment_id?: string | null
          id?: string
          observation_id?: string
          provenance?: Json
          twin_id?: string | null
          twin_version_id?: string | null
          variant_twin_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_attributions_brand_claim_id_workspace_id_fkey"
            columns: ["brand_claim_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "brand_claims"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "conversation_attributions_experiment_id_workspace_id_fkey"
            columns: ["experiment_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "experiments"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "conversation_attributions_observation_id_workspace_id_fkey"
            columns: ["observation_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "conversation_observations"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "conversation_attributions_twin_id_workspace_id_fkey"
            columns: ["twin_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "creative_twins"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "conversation_attributions_twin_version_id_workspace_id_fkey"
            columns: ["twin_version_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "creative_twin_versions"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "conversation_attributions_variant_twin_id_workspace_id_fkey"
            columns: ["variant_twin_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "creative_twins"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "conversation_attributions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_interpretations: {
        Row: {
          created_at: string
          created_by: string | null
          evidence_class: string
          id: string
          interpretation_type: string
          model_ref: string | null
          observation_id: string
          prompt_version: string | null
          review_state: string
          reviewed_at: string | null
          reviewed_by: string | null
          supporting_evidence_ids: Json
          uncertainty_note: string
          value: Json
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          evidence_class?: string
          id?: string
          interpretation_type: string
          model_ref?: string | null
          observation_id: string
          prompt_version?: string | null
          review_state?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          supporting_evidence_ids?: Json
          uncertainty_note: string
          value: Json
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          evidence_class?: string
          id?: string
          interpretation_type?: string
          model_ref?: string | null
          observation_id?: string
          prompt_version?: string | null
          review_state?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          supporting_evidence_ids?: Json
          uncertainty_note?: string
          value?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_interpretations_observation_id_workspace_id_fkey"
            columns: ["observation_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "conversation_observations"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "conversation_interpretations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_observations: {
        Row: {
          author_ref: string
          character_count: number
          created_at: string
          created_by: string | null
          evidence_class: string
          external_event_id: string | null
          external_post_id: string | null
          id: string
          idempotency_key: string
          import_batch_id: string | null
          ingested_at: string
          observed_at: string
          provenance: Json
          provider: string
          provider_account_ref: string | null
          raw_text: string
          retention_until: string | null
          review_state: string
          source_id: string
          text_sha256: string
          workspace_id: string
        }
        Insert: {
          author_ref: string
          character_count: number
          created_at?: string
          created_by?: string | null
          evidence_class?: string
          external_event_id?: string | null
          external_post_id?: string | null
          id?: string
          idempotency_key: string
          import_batch_id?: string | null
          ingested_at?: string
          observed_at: string
          provenance?: Json
          provider?: string
          provider_account_ref?: string | null
          raw_text: string
          retention_until?: string | null
          review_state?: string
          source_id: string
          text_sha256: string
          workspace_id: string
        }
        Update: {
          author_ref?: string
          character_count?: number
          created_at?: string
          created_by?: string | null
          evidence_class?: string
          external_event_id?: string | null
          external_post_id?: string | null
          id?: string
          idempotency_key?: string
          import_batch_id?: string | null
          ingested_at?: string
          observed_at?: string
          provenance?: Json
          provider?: string
          provider_account_ref?: string | null
          raw_text?: string
          retention_until?: string | null
          review_state?: string
          source_id?: string
          text_sha256?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_observations_import_batch_id_workspace_id_fkey"
            columns: ["import_batch_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "conversation_observations_source_id_workspace_id_fkey"
            columns: ["source_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "source_registry"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "conversation_observations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_review_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_kind: string
          id: string
          interpretation_id: string | null
          metadata: Json
          new_state: string
          observation_id: string | null
          previous_state: string | null
          rationale: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_kind: string
          id?: string
          interpretation_id?: string | null
          metadata?: Json
          new_state: string
          observation_id?: string | null
          previous_state?: string | null
          rationale?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_kind?: string
          id?: string
          interpretation_id?: string | null
          metadata?: Json
          new_state?: string
          observation_id?: string | null
          previous_state?: string | null
          rationale?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_review_events_interpretation_id_workspace_id_fkey"
            columns: ["interpretation_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "conversation_interpretations"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "conversation_review_events_observation_id_workspace_id_fkey"
            columns: ["observation_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "conversation_observations"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "conversation_review_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_assets: {
        Row: {
          asset_kind: string
          blocked_reason: string | null
          byte_size: number | null
          content_sha256: string | null
          created_at: string
          created_by: string | null
          declared_objective: string | null
          declared_platform: string | null
          id: string
          ingestion_status: string
          manual_text: string | null
          mime_type: string | null
          original_filename: string | null
          source_id: string
          storage_bucket: string | null
          storage_path: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          asset_kind: string
          blocked_reason?: string | null
          byte_size?: number | null
          content_sha256?: string | null
          created_at?: string
          created_by?: string | null
          declared_objective?: string | null
          declared_platform?: string | null
          id?: string
          ingestion_status?: string
          manual_text?: string | null
          mime_type?: string | null
          original_filename?: string | null
          source_id: string
          storage_bucket?: string | null
          storage_path?: string | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          asset_kind?: string
          blocked_reason?: string | null
          byte_size?: number | null
          content_sha256?: string | null
          created_at?: string
          created_by?: string | null
          declared_objective?: string | null
          declared_platform?: string | null
          id?: string
          ingestion_status?: string
          manual_text?: string | null
          mime_type?: string | null
          original_filename?: string | null
          source_id?: string
          storage_bucket?: string | null
          storage_path?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_assets_source_id_workspace_id_fkey"
            columns: ["source_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "source_registry"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "creative_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_claims: {
        Row: {
          brand_alignment_status: string
          brand_claim_id: string | null
          claim_classification: string
          claim_text: string
          created_at: string
          extraction_method: string
          id: string
          is_user_corrected: boolean
          proof_reference: string | null
          scene_indices: number[] | null
          source_char_offset_end: number | null
          source_char_offset_start: number | null
          source_excerpt: string | null
          twin_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          brand_alignment_status?: string
          brand_claim_id?: string | null
          claim_classification: string
          claim_text: string
          created_at?: string
          extraction_method?: string
          id?: string
          is_user_corrected?: boolean
          proof_reference?: string | null
          scene_indices?: number[] | null
          source_char_offset_end?: number | null
          source_char_offset_start?: number | null
          source_excerpt?: string | null
          twin_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          brand_alignment_status?: string
          brand_claim_id?: string | null
          claim_classification?: string
          claim_text?: string
          created_at?: string
          extraction_method?: string
          id?: string
          is_user_corrected?: boolean
          proof_reference?: string | null
          scene_indices?: number[] | null
          source_char_offset_end?: number | null
          source_char_offset_start?: number | null
          source_excerpt?: string | null
          twin_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_claims_brand_claim_id_workspace_id_fkey"
            columns: ["brand_claim_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "brand_claims"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "creative_claims_twin_id_workspace_id_fkey"
            columns: ["twin_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "creative_twins"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      creative_scenes: {
        Row: {
          created_at: string
          end_seconds: number | null
          id: string
          is_user_corrected: boolean
          on_screen_text: string | null
          provided_visual_notes: string | null
          reading_burden_wpm: number | null
          scene_index: number
          shot_purpose: string
          spoken_transcript: string | null
          start_seconds: number | null
          twin_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          end_seconds?: number | null
          id?: string
          is_user_corrected?: boolean
          on_screen_text?: string | null
          provided_visual_notes?: string | null
          reading_burden_wpm?: number | null
          scene_index: number
          shot_purpose: string
          spoken_transcript?: string | null
          start_seconds?: number | null
          twin_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          end_seconds?: number | null
          id?: string
          is_user_corrected?: boolean
          on_screen_text?: string | null
          provided_visual_notes?: string | null
          reading_burden_wpm?: number | null
          scene_index?: number
          shot_purpose?: string
          spoken_transcript?: string | null
          start_seconds?: number | null
          twin_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_scenes_twin_id_workspace_id_fkey"
            columns: ["twin_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "creative_twins"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      creative_twin_versions: {
        Row: {
          change_summary: string
          created_at: string
          created_by: string | null
          id: string
          snapshot: Json
          twin_id: string
          version_number: number
          workspace_id: string
        }
        Insert: {
          change_summary: string
          created_at?: string
          created_by?: string | null
          id?: string
          snapshot: Json
          twin_id: string
          version_number: number
          workspace_id: string
        }
        Update: {
          change_summary?: string
          created_at?: string
          created_by?: string | null
          id?: string
          snapshot?: Json
          twin_id?: string
          version_number?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_twin_versions_twin_id_workspace_id_fkey"
            columns: ["twin_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "creative_twins"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      creative_twins: {
        Row: {
          asset_id: string
          asset_kind: string
          created_at: string
          declared_objective: string | null
          declared_platform: string | null
          deterministic_features: Json
          id: string
          known_gaps: Json
          source_evidence_ids: Json
          state: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          asset_id: string
          asset_kind: string
          created_at?: string
          declared_objective?: string | null
          declared_platform?: string | null
          deterministic_features?: Json
          id?: string
          known_gaps?: Json
          source_evidence_ids?: Json
          state?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          asset_id?: string
          asset_kind?: string
          created_at?: string
          declared_objective?: string | null
          declared_platform?: string | null
          deterministic_features?: Json
          id?: string
          known_gaps?: Json
          source_evidence_ids?: Json
          state?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_twins_asset_id_workspace_id_fkey"
            columns: ["asset_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "creative_assets"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "creative_twins_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      derived_artifacts: {
        Row: {
          artifact_kind: string
          asset_id: string
          byte_size: number | null
          content_sha256: string | null
          coverage: string
          created_at: string
          created_by: string | null
          evidence_class: string
          features: Json
          id: string
          job_id: string | null
          mime_type: string | null
          parent_artifact_id: string | null
          producer: string
          producer_version: string
          retention_until: string | null
          storage_bucket: string | null
          storage_path: string | null
          workspace_id: string
        }
        Insert: {
          artifact_kind: string
          asset_id: string
          byte_size?: number | null
          content_sha256?: string | null
          coverage?: string
          created_at?: string
          created_by?: string | null
          evidence_class?: string
          features?: Json
          id?: string
          job_id?: string | null
          mime_type?: string | null
          parent_artifact_id?: string | null
          producer: string
          producer_version: string
          retention_until?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          workspace_id: string
        }
        Update: {
          artifact_kind?: string
          asset_id?: string
          byte_size?: number | null
          content_sha256?: string | null
          coverage?: string
          created_at?: string
          created_by?: string | null
          evidence_class?: string
          features?: Json
          id?: string
          job_id?: string | null
          mime_type?: string | null
          parent_artifact_id?: string | null
          producer?: string
          producer_version?: string
          retention_until?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "derived_artifacts_asset_id_workspace_id_fkey"
            columns: ["asset_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "creative_assets"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "derived_artifacts_job_id_workspace_id_fkey"
            columns: ["job_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "derived_artifacts_parent_artifact_id_workspace_id_fkey"
            columns: ["parent_artifact_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "derived_artifacts"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "derived_artifacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_items: {
        Row: {
          citation_date: string | null
          citation_url: string | null
          claim_text: string
          completeness: string
          created_at: string
          created_by: string | null
          evidence_class: string
          freshness_date: string | null
          id: string
          metric_definition: string | null
          metric_key: string | null
          metric_unit: string | null
          metric_value: number | null
          notes: string | null
          review_status: string
          source_id: string
          time_window: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          citation_date?: string | null
          citation_url?: string | null
          claim_text: string
          completeness?: string
          created_at?: string
          created_by?: string | null
          evidence_class?: string
          freshness_date?: string | null
          id?: string
          metric_definition?: string | null
          metric_key?: string | null
          metric_unit?: string | null
          metric_value?: number | null
          notes?: string | null
          review_status?: string
          source_id: string
          time_window?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          citation_date?: string | null
          citation_url?: string | null
          claim_text?: string
          completeness?: string
          created_at?: string
          created_by?: string | null
          evidence_class?: string
          freshness_date?: string | null
          id?: string
          metric_definition?: string | null
          metric_key?: string | null
          metric_unit?: string | null
          metric_value?: number | null
          notes?: string | null
          review_status?: string
          source_id?: string
          time_window?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_items_source_id_workspace_id_fkey"
            columns: ["source_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "source_registry"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      experiment_outcomes: {
        Row: {
          created_at: string
          created_by: string | null
          date_ambiguous: boolean
          evidence_class: string
          experiment_id: string
          id: string
          import_batch_id: string | null
          import_note: string | null
          metric_key: string
          observed_at: string
          source_citability: string
          source_id: string
          value: number
          variant_twin_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_ambiguous?: boolean
          evidence_class?: string
          experiment_id: string
          id?: string
          import_batch_id?: string | null
          import_note?: string | null
          metric_key: string
          observed_at: string
          source_citability: string
          source_id: string
          value: number
          variant_twin_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_ambiguous?: boolean
          evidence_class?: string
          experiment_id?: string
          id?: string
          import_batch_id?: string | null
          import_note?: string | null
          metric_key?: string
          observed_at?: string
          source_citability?: string
          source_id?: string
          value?: number
          variant_twin_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiment_outcomes_experiment_id_workspace_id_fkey"
            columns: ["experiment_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "experiments"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "experiment_outcomes_source_id_workspace_id_fkey"
            columns: ["source_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "source_registry"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "experiment_outcomes_variant_twin_id_workspace_id_fkey"
            columns: ["variant_twin_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "creative_twins"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "experiment_outcomes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      experiments: {
        Row: {
          concluded_at: string | null
          created_at: string
          created_by: string | null
          hypothesis: string
          id: string
          min_observations_per_variant: number
          outcome_source: string
          primary_metric_key: string
          started_at: string | null
          status: string
          title: string
          updated_at: string
          variant_twin_ids: string[]
          workspace_id: string
        }
        Insert: {
          concluded_at?: string | null
          created_at?: string
          created_by?: string | null
          hypothesis: string
          id?: string
          min_observations_per_variant?: number
          outcome_source?: string
          primary_metric_key: string
          started_at?: string | null
          status?: string
          title: string
          updated_at?: string
          variant_twin_ids?: string[]
          workspace_id: string
        }
        Update: {
          concluded_at?: string | null
          created_at?: string
          created_by?: string | null
          hypothesis?: string
          id?: string
          min_observations_per_variant?: number
          outcome_source?: string
          primary_metric_key?: string
          started_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          variant_twin_ids?: string[]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          accepted_rows: number
          batch_kind: string
          completed_at: string
          created_at: string
          created_by: string | null
          expected_rows: number | null
          file_name: string | null
          file_sha256: string | null
          file_size_bytes: number | null
          id: string
          provenance: Json
          rejected_rows: number
          rejection_reasons: Json
          source_id: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          accepted_rows?: number
          batch_kind: string
          completed_at?: string
          created_at?: string
          created_by?: string | null
          expected_rows?: number | null
          file_name?: string | null
          file_sha256?: string | null
          file_size_bytes?: number | null
          id?: string
          provenance?: Json
          rejected_rows?: number
          rejection_reasons?: Json
          source_id?: string | null
          status?: string
          workspace_id: string
        }
        Update: {
          accepted_rows?: number
          batch_kind?: string
          completed_at?: string
          created_at?: string
          created_by?: string | null
          expected_rows?: number | null
          file_name?: string | null
          file_sha256?: string | null
          file_size_bytes?: number | null
          id?: string
          provenance?: Json
          rejected_rows?: number
          rejection_reasons?: Json
          source_id?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_source_id_workspace_id_fkey"
            columns: ["source_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "source_registry"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "import_batches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_runs: {
        Row: {
          asset_id: string
          completed_at: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          ingestion_method: string
          started_by: string | null
          status: string
          validation_summary: Json
          workspace_id: string
        }
        Insert: {
          asset_id: string
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          ingestion_method: string
          started_by?: string | null
          status: string
          validation_summary?: Json
          workspace_id: string
        }
        Update: {
          asset_id?: string
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          ingestion_method?: string
          started_by?: string | null
          status?: string
          validation_summary?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_runs_asset_id_workspace_id_fkey"
            columns: ["asset_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "creative_assets"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "ingestion_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attempts: number
          correlation_id: string
          created_at: string
          created_by: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          job_type: string
          last_error: Json | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          requires_approval: boolean
          result: Json | null
          run_after: string
          status: string
          step_log: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attempts?: number
          correlation_id?: string
          created_at?: string
          created_by?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key: string
          job_type: string
          last_error?: Json | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          requires_approval?: boolean
          result?: Json | null
          run_after?: string
          status?: string
          step_log?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attempts?: number
          correlation_id?: string
          created_at?: string
          created_by?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          job_type?: string
          last_error?: Json | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          requires_approval?: boolean
          result?: Json | null
          run_after?: string
          status?: string
          step_log?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_definitions: {
        Row: {
          created_at: string
          created_by: string | null
          definition: string
          display_name: string
          id: string
          measurement_method: string | null
          metric_key: string
          source_id: string | null
          unit: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          definition: string
          display_name: string
          id?: string
          measurement_method?: string | null
          metric_key: string
          source_id?: string | null
          unit?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          definition?: string
          display_name?: string
          id?: string
          measurement_method?: string | null
          metric_key?: string
          source_id?: string | null
          unit?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metric_definitions_source_id_workspace_id_fkey"
            columns: ["source_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "source_registry"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "metric_definitions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      model_task_runs: {
        Row: {
          attempts: number
          completion_tokens: number | null
          correlation_id: string
          created_at: string
          created_by: string | null
          evidence_class: string
          id: string
          input_claim_ids: Json
          latency_ms: number | null
          model: string
          output: Json | null
          prompt_tokens: number | null
          prompt_version: string
          repaired: boolean
          schema_version: string
          status: string
          task_type: string
          twin_id: string | null
          validation_errors: Json
          workspace_id: string
        }
        Insert: {
          attempts?: number
          completion_tokens?: number | null
          correlation_id: string
          created_at?: string
          created_by?: string | null
          evidence_class?: string
          id?: string
          input_claim_ids?: Json
          latency_ms?: number | null
          model: string
          output?: Json | null
          prompt_tokens?: number | null
          prompt_version: string
          repaired?: boolean
          schema_version: string
          status: string
          task_type: string
          twin_id?: string | null
          validation_errors?: Json
          workspace_id: string
        }
        Update: {
          attempts?: number
          completion_tokens?: number | null
          correlation_id?: string
          created_at?: string
          created_by?: string | null
          evidence_class?: string
          id?: string
          input_claim_ids?: Json
          latency_ms?: number | null
          model?: string
          output?: Json | null
          prompt_tokens?: number | null
          prompt_version?: string
          repaired?: boolean
          schema_version?: string
          status?: string
          task_type?: string
          twin_id?: string | null
          validation_errors?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_task_runs_twin_id_workspace_id_fkey"
            columns: ["twin_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "creative_twins"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "model_task_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      post_observations: {
        Row: {
          created_at: string
          created_by: string | null
          date_ambiguous: boolean
          evidence_class: string
          external_post_id: string | null
          id: string
          import_batch_id: string | null
          metric_key: string
          published_at: string
          source_citability: string
          source_id: string
          twin_id: string | null
          value: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_ambiguous?: boolean
          evidence_class?: string
          external_post_id?: string | null
          id?: string
          import_batch_id?: string | null
          metric_key: string
          published_at: string
          source_citability: string
          source_id: string
          twin_id?: string | null
          value: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_ambiguous?: boolean
          evidence_class?: string
          external_post_id?: string | null
          id?: string
          import_batch_id?: string | null
          metric_key?: string
          published_at?: string
          source_citability?: string
          source_id?: string
          twin_id?: string | null
          value?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_observations_source_id_workspace_id_fkey"
            columns: ["source_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "source_registry"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "post_observations_twin_id_workspace_id_fkey"
            columns: ["twin_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "creative_twins"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "post_observations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      post_variant_attributions: {
        Row: {
          asset_id: string
          connector_account_id: string | null
          created_at: string
          created_by: string | null
          experiment_id: string | null
          external_account_id: string | null
          external_post_id: string
          id: string
          idempotency_key: string | null
          provenance: Json
          provider: string
          published_at: string | null
          source_id: string | null
          twin_id: string
          twin_version_id: string | null
          variant_twin_id: string | null
          workspace_id: string
        }
        Insert: {
          asset_id: string
          connector_account_id?: string | null
          created_at?: string
          created_by?: string | null
          experiment_id?: string | null
          external_account_id?: string | null
          external_post_id: string
          id?: string
          idempotency_key?: string | null
          provenance?: Json
          provider: string
          published_at?: string | null
          source_id?: string | null
          twin_id: string
          twin_version_id?: string | null
          variant_twin_id?: string | null
          workspace_id: string
        }
        Update: {
          asset_id?: string
          connector_account_id?: string | null
          created_at?: string
          created_by?: string | null
          experiment_id?: string | null
          external_account_id?: string | null
          external_post_id?: string
          id?: string
          idempotency_key?: string | null
          provenance?: Json
          provider?: string
          published_at?: string | null
          source_id?: string | null
          twin_id?: string
          twin_version_id?: string | null
          variant_twin_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_variant_attributions_asset_id_workspace_id_fkey"
            columns: ["asset_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "creative_assets"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "post_variant_attributions_connector_account_id_workspace_i_fkey"
            columns: ["connector_account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "connector_accounts"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "post_variant_attributions_connector_account_id_workspace_i_fkey"
            columns: ["connector_account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "connector_accounts_public"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "post_variant_attributions_experiment_id_workspace_id_fkey"
            columns: ["experiment_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "experiments"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "post_variant_attributions_source_id_workspace_id_fkey"
            columns: ["source_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "source_registry"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "post_variant_attributions_twin_id_workspace_id_fkey"
            columns: ["twin_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "creative_twins"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "post_variant_attributions_twin_version_id_workspace_id_fkey"
            columns: ["twin_version_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "creative_twin_versions"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "post_variant_attributions_variant_twin_id_workspace_id_fkey"
            columns: ["variant_twin_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "creative_twins"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "post_variant_attributions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      retrieval_embeddings: {
        Row: {
          chunk_index: number
          content_sha256: string
          created_at: string
          embedding: string
          embedding_model: string
          embedding_model_version: string
          id: string
          job_id: string | null
          source_id: string
          source_table: string
          workspace_id: string
        }
        Insert: {
          chunk_index?: number
          content_sha256: string
          created_at?: string
          embedding: string
          embedding_model: string
          embedding_model_version: string
          id?: string
          job_id?: string | null
          source_id: string
          source_table: string
          workspace_id: string
        }
        Update: {
          chunk_index?: number
          content_sha256?: string
          created_at?: string
          embedding?: string
          embedding_model?: string
          embedding_model_version?: string
          id?: string
          job_id?: string | null
          source_id?: string
          source_table?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retrieval_embeddings_job_id_workspace_id_fkey"
            columns: ["job_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "retrieval_embeddings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      source_registry: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          freshness_window_days: number
          health_status: string
          id: string
          last_verified_at: string | null
          name: string
          notes: string | null
          review_status: string
          source_coverage: string
          source_type: string
          updated_at: string
          url: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          freshness_window_days?: number
          health_status?: string
          id?: string
          last_verified_at?: string | null
          name: string
          notes?: string | null
          review_status?: string
          source_coverage?: string
          source_type?: string
          updated_at?: string
          url?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          freshness_window_days?: number
          health_status?: string
          id?: string
          last_verified_at?: string | null
          name?: string
          notes?: string | null
          review_status?: string
          source_coverage?: string
          source_type?: string
          updated_at?: string
          url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_registry_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_quotas: {
        Row: {
          daily_limit: number
          kind: string
          updated_at: string
          used_today: number
          window_date: string
          workspace_id: string
        }
        Insert: {
          daily_limit: number
          kind: string
          updated_at?: string
          used_today?: number
          window_date?: string
          workspace_id: string
        }
        Update: {
          daily_limit?: number
          kind?: string
          updated_at?: string
          used_today?: number
          window_date?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_quotas_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      connector_accounts_public: {
        Row: {
          consent_granted_at: string | null
          consent_granted_by: string | null
          created_at: string | null
          created_by: string | null
          display_name: string | null
          external_account_id: string | null
          granted_scopes: string[] | null
          id: string | null
          last_error: Json | null
          last_sync_at: string | null
          provider: string | null
          requested_scopes: string[] | null
          revoked_at: string | null
          revoked_by: string | null
          status: string | null
          token_expires_at: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          consent_granted_at?: string | null
          consent_granted_by?: string | null
          created_at?: string | null
          created_by?: string | null
          display_name?: string | null
          external_account_id?: string | null
          granted_scopes?: string[] | null
          id?: string | null
          last_error?: Json | null
          last_sync_at?: string | null
          provider?: string | null
          requested_scopes?: string[] | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          consent_granted_at?: string | null
          consent_granted_by?: string | null
          created_at?: string | null
          created_by?: string | null
          display_name?: string | null
          external_account_id?: string | null
          granted_scopes?: string[] | null
          id?: string | null
          last_error?: Json | null
          last_sync_at?: string | null
          provider?: string | null
          requested_scopes?: string[] | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connector_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_job: {
        Args: { p_job_id: string; p_workspace_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          attempts: number
          correlation_id: string
          created_at: string
          created_by: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          job_type: string
          last_error: Json | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          requires_approval: boolean
          result: Json | null
          run_after: string
          status: string
          step_log: Json
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      audit_summary: {
        Args: { p_days: number; p_workspace_id: string }
        Returns: {
          action: string
          actor: string
          day: string
          events: number
        }[]
      }
      cancel_job: {
        Args: { p_job_id: string; p_workspace_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          attempts: number
          correlation_id: string
          created_at: string
          created_by: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          job_type: string
          last_error: Json | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          requires_approval: boolean
          result: Json | null
          run_after: string
          status: string
          step_log: Json
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_next_job: {
        Args: { p_job_types: string[]; p_worker_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          attempts: number
          correlation_id: string
          created_at: string
          created_by: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          job_type: string
          last_error: Json | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          requires_approval: boolean
          result: Json | null
          run_after: string
          status: string
          step_log: Json
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_job: {
        Args: { p_job_id: string; p_result: Json; p_worker_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          attempts: number
          correlation_id: string
          created_at: string
          created_by: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          job_type: string
          last_error: Json | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          requires_approval: boolean
          result: Json | null
          run_after: string
          status: string
          step_log: Json
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consume_quota: {
        Args: { p_kind: string; p_workspace_id: string }
        Returns: {
          allowed: boolean
          daily_limit: number
          used: number
        }[]
      }
      default_quota: { Args: { p_kind: string }; Returns: number }
      delete_post_observation_batch: {
        Args: { p_batch_id: string; p_workspace_id: string }
        Returns: Json
      }
      fail_job: {
        Args: {
          p_error: Json
          p_job_id: string
          p_retriable: boolean
          p_retry_delay_seconds: number
          p_worker_id: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          attempts: number
          correlation_id: string
          created_at: string
          created_by: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          job_type: string
          last_error: Json | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          requires_approval: boolean
          result: Json | null
          run_after: string
          status: string
          step_log: Json
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_workspace_admin_or_owner: { Args: { ws_id: string }; Returns: boolean }
      is_workspace_member: { Args: { ws_id: string }; Returns: boolean }
      match_retrieval_candidates: {
        Args: {
          p_limit: number
          p_query: string
          p_source_tables: string[]
          p_workspace_id: string
        }
        Returns: {
          chunk_index: number
          embedding_model: string
          similarity: number
          source_id: string
          source_table: string
        }[]
      }
      posting_history_coverage: {
        Args: { p_workspace_id: string }
        Returns: {
          first_observed: string
          last_observed: string
          metric_key: string
          observations: number
          unverified_rows: number
        }[]
      }
      purge_expired_artifacts: {
        Args: { p_limit: number }
        Returns: {
          storage_bucket: string
          storage_path: string
          workspace_id: string
        }[]
      }
      release_stale_jobs: {
        Args: { p_older_than_seconds: number }
        Returns: number
      }
      request_connector: {
        Args: { p_provider: string; p_scopes: string[]; p_workspace_id: string }
        Returns: string
      }
      retrieval_coverage: {
        Args: { p_workspace_id: string }
        Returns: {
          indexed_rows: number
          source_table: string
          total_rows: number
        }[]
      }
      review_conversation_interpretation_atomic: {
        Args: {
          p_interpretation_id: string
          p_metadata?: Json
          p_rationale?: string
          p_review_state: string
          p_workspace_id: string
        }
        Returns: Json
      }
      review_conversation_observation_atomic: {
        Args: {
          p_metadata?: Json
          p_observation_id: string
          p_rationale?: string
          p_review_state: string
          p_workspace_id: string
        }
        Returns: Json
      }
      revoke_connector: {
        Args: { p_connector_id: string; p_workspace_id: string }
        Returns: boolean
      }
      save_claim_correction_atomic: {
        Args: {
          p_brand_alignment_status: string
          p_brand_claim_id: string
          p_change_summary: string
          p_claim_classification: string
          p_claim_id: string
          p_claim_text: string
          p_proof_reference: string
          p_workspace_id: string
        }
        Returns: Json
      }
      save_scene_correction_atomic: {
        Args: {
          p_change_summary?: string
          p_end_seconds?: number
          p_on_screen_text?: string
          p_provided_visual_notes?: string
          p_reading_burden_wpm?: number
          p_scene_id: string
          p_shot_purpose: string
          p_spoken_transcript: string
          p_start_seconds?: number
          p_workspace_id: string
        }
        Returns: Json
      }
      storage_workspace_id: { Args: { object_name: string }; Returns: string }
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
