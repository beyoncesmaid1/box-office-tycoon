-- Add territory_percentages column to films table
ALTER TABLE films ADD COLUMN IF NOT EXISTS territory_percentages jsonb NOT NULL DEFAULT '{}'::jsonb;
