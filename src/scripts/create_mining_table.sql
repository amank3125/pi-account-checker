-- SQL script to create mining_data table in Supabase

-- Create the mining_data table
CREATE TABLE IF NOT EXISTS mining_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number TEXT NOT NULL REFERENCES accounts(phone_number) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT false,
  valid_until TIMESTAMP WITH TIME ZONE,
  hourly_ratio DECIMAL,
  team_count INTEGER,
  mining_count INTEGER,
  pi_balance DECIMAL,
  completed_sessions_count INTEGER,
  last_mined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  mining_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index for faster queries by phone number
CREATE INDEX IF NOT EXISTS idx_mining_data_phone_number ON mining_data(phone_number);

-- Create a function to update the "updated_at" column
CREATE OR REPLACE FUNCTION update_modified_column() 
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update the "updated_at" column
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON mining_data
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Set up Row Level Security
ALTER TABLE mining_data ENABLE ROW LEVEL SECURITY;

-- Create policy for users to see only their own mining data
CREATE POLICY "Users can view their own mining data" ON mining_data
  FOR SELECT USING (
    phone_number IN (
      SELECT phone_number FROM accounts 
      WHERE user_id = auth.uid()
    )
  );

-- Create policy for users to insert/update their own mining data
CREATE POLICY "Users can insert their own mining data" ON mining_data
  FOR INSERT WITH CHECK (
    phone_number IN (
      SELECT phone_number FROM accounts 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own mining data" ON mining_data
  FOR UPDATE USING (
    phone_number IN (
      SELECT phone_number FROM accounts 
      WHERE user_id = auth.uid()
    )
  );

-- Grant appropriate permissions (if needed)
-- GRANT SELECT, INSERT, UPDATE ON mining_data TO authenticated;
-- GRANT USAGE, SELECT ON SEQUENCE mining_data_id_seq TO authenticated; 