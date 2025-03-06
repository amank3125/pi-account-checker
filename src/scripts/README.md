# Mining Table Setup

This directory contains the SQL script needed to create the mining data table in your Supabase database.

## How to use the script

1. Log in to your Supabase dashboard: https://app.supabase.com/
2. Select your project
3. Go to the SQL Editor section
4. Create a "New Query"
5. Copy and paste the contents of `create_mining_table.sql` into the editor
6. Click "Run" to execute the script

## What the script does

The script:

1. Creates a new `mining_data` table to store mining status for each Pi account
2. Sets up the appropriate foreign key constraints to link with the accounts table
3. Creates an index for better query performance
4. Sets up a trigger to automatically update the `updated_at` timestamp
5. Enables Row Level Security (RLS) to protect your data
6. Creates policies to ensure users can only access their own mining data

## Troubleshooting

If you encounter issues:

- Make sure your Supabase instance is running
- Verify that the `accounts` table already exists
- Check for syntax errors or incompatible PostgreSQL versions
- Ensure your user has sufficient privileges to create tables and policies

If you continue to have problems, please check the browser console for more detailed error messages.
