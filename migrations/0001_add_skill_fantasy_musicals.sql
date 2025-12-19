-- Add skill_fantasy and skill_musicals columns to talent table
ALTER TABLE talent ADD COLUMN IF NOT EXISTS skill_fantasy INTEGER NOT NULL DEFAULT 50;
ALTER TABLE talent ADD COLUMN IF NOT EXISTS skill_musicals INTEGER NOT NULL DEFAULT 50;

-- Add co_production_deals table
CREATE TABLE IF NOT EXISTS co_production_deals (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  player_game_id VARCHAR NOT NULL,
  partner_name TEXT NOT NULL,
  investment_amount BIGINT NOT NULL,
  international_rights_percent INTEGER NOT NULL DEFAULT 100,
  start_week INTEGER NOT NULL,
  start_year INTEGER NOT NULL,
  film_id VARCHAR REFERENCES films(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_used BOOLEAN NOT NULL DEFAULT false
);
