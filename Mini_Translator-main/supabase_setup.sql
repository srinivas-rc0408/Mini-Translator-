-- RUN THIS SQL IN YOUR SUPABASE SQL EDITOR TO SETUP TABLES AND SECURITY
-- This script is idempotent and can be run multiple times.

-- 1. Create translations table
CREATE TABLE IF NOT EXISTS translations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  mode TEXT NOT NULL,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  input_text TEXT,
  output TEXT NOT NULL,
  image_url TEXT,
  segments JSONB,
  is_saved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;

-- 3. Create Security Policies
-- First, cleanup existing policies to avoid "already exists" errors
DROP POLICY IF EXISTS "Users can view their own translations" ON translations;
DROP POLICY IF EXISTS "Users can insert their own translations" ON translations;
DROP POLICY IF EXISTS "Users can update their own translations" ON translations;
DROP POLICY IF EXISTS "Users can delete their own translations" ON translations;

-- Policy: Users can only see their own translations
CREATE POLICY "Users can view their own translations" ON translations
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own translations
CREATE POLICY "Users can insert their own translations" ON translations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own translations (for toggling 'is_saved')
CREATE POLICY "Users can update their own translations" ON translations
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own translations
CREATE POLICY "Users can delete their own translations" ON translations
  FOR DELETE USING (auth.uid() = user_id);
