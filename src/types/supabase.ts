export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string;
          user_id: string;
          phone_number: string;
          username: string | null;
          display_name: string | null;
          device_tag: string | null;
          password: string | null;
          access_token: string | null;
          token_type: string | null;
          expires_in: number | null;
          token_created_at: number | null;
          added_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          phone_number: string;
          username?: string | null;
          display_name?: string | null;
          device_tag?: string | null;
          password?: string | null;
          access_token?: string | null;
          token_type?: string | null;
          expires_in?: number | null;
          token_created_at?: number | null;
          added_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          phone_number?: string;
          username?: string | null;
          display_name?: string | null;
          device_tag?: string | null;
          password?: string | null;
          access_token?: string | null;
          token_type?: string | null;
          expires_in?: number | null;
          token_created_at?: number | null;
          added_at?: string;
        };
      };
      account_cache: {
        Row: {
          id: string;
          account_id: string;
          cache_type: string;
          data: Json;
          timestamp: number;
          last_refresh_attempt: number | null;
          is_stale: boolean | null;
        };
        Insert: {
          id?: string;
          account_id: string;
          cache_type: string;
          data: Json;
          timestamp: number;
          last_refresh_attempt?: number | null;
          is_stale?: boolean | null;
        };
        Update: {
          id?: string;
          account_id?: string;
          cache_type?: string;
          data?: Json;
          timestamp?: number;
          last_refresh_attempt?: number | null;
          is_stale?: boolean | null;
        };
      };
      mining_data: {
        Row: {
          id: string;
          phone_number: string;
          is_active: boolean;
          valid_until: string | null;
          hourly_ratio: number | null;
          team_count: number | null;
          mining_count: number | null;
          pi_balance: number | null;
          completed_sessions_count: number | null;
          last_mined_at: string;
          mining_response: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          phone_number: string;
          is_active?: boolean;
          valid_until?: string | null;
          hourly_ratio?: number | null;
          team_count?: number | null;
          mining_count?: number | null;
          pi_balance?: number | null;
          completed_sessions_count?: number | null;
          last_mined_at?: string;
          mining_response?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          phone_number?: string;
          is_active?: boolean;
          valid_until?: string | null;
          hourly_ratio?: number | null;
          team_count?: number | null;
          mining_count?: number | null;
          pi_balance?: number | null;
          completed_sessions_count?: number | null;
          last_mined_at?: string;
          mining_response?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
