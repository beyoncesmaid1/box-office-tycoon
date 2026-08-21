CREATE TABLE "award_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"award_show_id" varchar NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"category_type" text NOT NULL,
	"requires_genre" text,
	"is_performance" boolean DEFAULT false NOT NULL,
	"is_international" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "award_ceremonies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_game_id" varchar NOT NULL,
	"award_show_id" varchar NOT NULL,
	"ceremony_year" integer NOT NULL,
	"nominations_announced" boolean DEFAULT false NOT NULL,
	"ceremony_complete" boolean DEFAULT false NOT NULL,
	"winners_announced" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "award_nominations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_game_id" varchar NOT NULL,
	"award_show_id" varchar NOT NULL,
	"category_id" varchar NOT NULL,
	"film_id" varchar NOT NULL,
	"talent_id" varchar,
	"ceremony_year" integer NOT NULL,
	"is_winner" boolean DEFAULT false NOT NULL,
	"announced_week" integer NOT NULL,
	"announced_year" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "award_shows" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"ceremony_week" integer NOT NULL,
	"nominations_week" integer NOT NULL,
	"prestige_level" integer NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "co_production_deals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_game_id" varchar NOT NULL,
	"partner_name" text NOT NULL,
	"investment_amount" bigint NOT NULL,
	"international_rights_percent" integer DEFAULT 100 NOT NULL,
	"start_week" integer NOT NULL,
	"start_year" integer NOT NULL,
	"film_id" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_used" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_state" (
	"id" varchar PRIMARY KEY NOT NULL,
	"local_content_version" integer DEFAULT 0 NOT NULL,
	"content_schema_version" integer DEFAULT 1 NOT NULL,
	"content_hash" text,
	"source" text DEFAULT 'bundled' NOT NULL,
	"last_checked_at" integer,
	"last_applied_at" integer,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "content_update_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_version" integer NOT NULL,
	"to_version" integer NOT NULL,
	"content_hash" text NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"created_at" integer DEFAULT CAST(EXTRACT(EPOCH FROM NOW()) AS INTEGER) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_game_id" varchar NOT NULL,
	"type" text NOT NULL,
	"subject" text NOT NULL,
	"sender" text NOT NULL,
	"sender_title" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"has_action" boolean DEFAULT false NOT NULL,
	"action_label" text,
	"action_data" jsonb,
	"sent_week" integer NOT NULL,
	"sent_year" integer NOT NULL,
	"expires_week" integer,
	"expires_year" integer
);
--> statement-breakpoint
CREATE TABLE "film_milestones" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"film_id" varchar NOT NULL,
	"milestone_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"start_week" integer,
	"start_year" integer,
	"completed_week" integer,
	"completed_year" integer,
	"duration_weeks" integer DEFAULT 2 NOT NULL,
	"weeks_spent" integer DEFAULT 0 NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "film_releases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"film_id" varchar NOT NULL,
	"territory_code" text NOT NULL,
	"release_week" integer NOT NULL,
	"release_year" integer NOT NULL,
	"production_budget" bigint DEFAULT 0 NOT NULL,
	"marketing_budget" bigint DEFAULT 0 NOT NULL,
	"awareness" real DEFAULT 8 NOT NULL,
	"interest" real DEFAULT 10 NOT NULL,
	"expectation" real DEFAULT 52 NOT NULL,
	"buzz" real DEFAULT 0 NOT NULL,
	"paid_reach" real DEFAULT 0 NOT NULL,
	"opening_expectation" real,
	"is_released" boolean DEFAULT false NOT NULL,
	"weekly_box_office" bigint[] DEFAULT ARRAY[]::bigint[] NOT NULL,
	"weekly_capacity_breakdown" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_box_office" bigint DEFAULT 0 NOT NULL,
	"theater_count" integer DEFAULT 0 NOT NULL,
	"weeks_in_release" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "film_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"film_id" varchar NOT NULL,
	"role_name" text NOT NULL,
	"character_age" integer,
	"importance" text DEFAULT 'supporting' NOT NULL,
	"character_type" text DEFAULT 'hero' NOT NULL,
	"gender_preference" text DEFAULT 'any' NOT NULL,
	"actor_id" varchar,
	"is_cast" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "films" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" varchar NOT NULL,
	"title" text NOT NULL,
	"genre" text NOT NULL,
	"synopsis" text DEFAULT '' NOT NULL,
	"phase" text DEFAULT 'development' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"archived_week" integer,
	"archived_year" integer,
	"production_budget" bigint DEFAULT 0 NOT NULL,
	"marketing_budget" bigint DEFAULT 0 NOT NULL,
	"campaign_limit" bigint DEFAULT 0 NOT NULL,
	"campaign_spent" bigint DEFAULT 0 NOT NULL,
	"campaign_strategy" text DEFAULT 'balanced' NOT NULL,
	"auto_manage_marketing" boolean DEFAULT false NOT NULL,
	"talent_budget" bigint DEFAULT 0 NOT NULL,
	"total_budget" bigint DEFAULT 0 NOT NULL,
	"director_id" varchar,
	"writer_id" varchar,
	"cast_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"cinematographer_id" varchar,
	"editor_id" varchar,
	"composer_id" varchar,
	"vfx_studio_id" varchar,
	"script_quality" integer DEFAULT 70 NOT NULL,
	"cinematography_quality" integer DEFAULT 70 NOT NULL,
	"sets_budget" bigint DEFAULT 0 NOT NULL,
	"costumes_budget" bigint DEFAULT 0 NOT NULL,
	"stunts_budget" bigint DEFAULT 0 NOT NULL,
	"makeup_budget" bigint DEFAULT 0 NOT NULL,
	"practical_effects_budget" bigint DEFAULT 0 NOT NULL,
	"sound_crew_budget" bigint DEFAULT 0 NOT NULL,
	"has_hired_talent" boolean DEFAULT false NOT NULL,
	"has_edited_post_production" boolean DEFAULT false NOT NULL,
	"created_at_week" integer DEFAULT 1 NOT NULL,
	"created_at_year" integer DEFAULT 2025 NOT NULL,
	"development_duration_weeks" integer DEFAULT 2 NOT NULL,
	"pre_production_duration_weeks" integer DEFAULT 2 NOT NULL,
	"production_duration_weeks" integer DEFAULT 4 NOT NULL,
	"post_production_duration_weeks" integer DEFAULT 2 NOT NULL,
	"weeks_in_current_phase" integer DEFAULT 0 NOT NULL,
	"release_week" integer,
	"release_year" integer,
	"weekly_box_office" bigint[] DEFAULT ARRAY[]::bigint[] NOT NULL,
	"weekly_box_office_by_country" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_box_office" bigint DEFAULT 0 NOT NULL,
	"total_box_office_by_country" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"territory_percentages" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"audience_score" real DEFAULT 0 NOT NULL,
	"critic_score" integer DEFAULT 0 NOT NULL,
	"critic_score_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"audience_score_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"box_office_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cost_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"theater_count" integer DEFAULT 0 NOT NULL,
	"imax_suitability" integer DEFAULT 0 NOT NULL,
	"dolby_suitability" integer DEFAULT 0 NOT NULL,
	"box_office_model_version" integer DEFAULT 2 NOT NULL,
	"awards" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"franchise_id" varchar,
	"is_sequel" boolean DEFAULT false NOT NULL,
	"prequel_film_id" varchar,
	"poster_url" text
);
--> statement-breakpoint
CREATE TABLE "franchises" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" varchar NOT NULL,
	"name" text NOT NULL,
	"original_film_id" varchar NOT NULL,
	"total_films" integer DEFAULT 1 NOT NULL,
	"total_revenue" bigint DEFAULT 0 NOT NULL,
	"created_week" integer DEFAULT 1 NOT NULL,
	"created_year" integer DEFAULT 2025 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_activity_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_session_id" varchar NOT NULL,
	"user_id" varchar,
	"studio_id" varchar,
	"event_type" text NOT NULL,
	"event_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"message" text NOT NULL,
	"game_week" integer NOT NULL,
	"game_year" integer NOT NULL,
	"created_at" integer DEFAULT CAST(EXTRACT(EPOCH FROM NOW()) AS INTEGER) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_session_players" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"studio_id" varchar,
	"is_ready" boolean DEFAULT false NOT NULL,
	"is_connected" boolean DEFAULT false NOT NULL,
	"is_host" boolean DEFAULT false NOT NULL,
	"joined_at" integer DEFAULT CAST(EXTRACT(EPOCH FROM NOW()) AS INTEGER) NOT NULL,
	"last_seen_at" integer DEFAULT CAST(EXTRACT(EPOCH FROM NOW()) AS INTEGER) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" varchar(6) NOT NULL,
	"host_user_id" varchar NOT NULL,
	"current_week" integer DEFAULT 1 NOT NULL,
	"current_year" integer DEFAULT 2025 NOT NULL,
	"max_players" integer DEFAULT 4 NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"week_advance_mode" text DEFAULT 'ready' NOT NULL,
	"timer_minutes" integer DEFAULT 5 NOT NULL,
	"status" text DEFAULT 'lobby' NOT NULL,
	"created_at" integer DEFAULT CAST(EXTRACT(EPOCH FROM NOW()) AS INTEGER) NOT NULL,
	"started_at" integer,
	"last_activity_at" integer DEFAULT CAST(EXTRACT(EPOCH FROM NOW()) AS INTEGER) NOT NULL,
	CONSTRAINT "game_sessions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "marketing_actions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"film_id" varchar NOT NULL,
	"territory_code" text NOT NULL,
	"action_kind" text NOT NULL,
	"spend" bigint NOT NULL,
	"response" real DEFAULT 1 NOT NULL,
	"reach_gain" real DEFAULT 0 NOT NULL,
	"week" integer NOT NULL,
	"year" integer NOT NULL,
	"state_after" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_script_purchases" (
	"player_game_id" varchar NOT NULL,
	"script_id" varchar NOT NULL,
	"purchased_week" integer NOT NULL,
	"purchased_year" integer NOT NULL,
	CONSTRAINT "marketplace_script_purchases_player_game_id_script_id_pk" PRIMARY KEY("player_game_id","script_id")
);
--> statement-breakpoint
CREATE TABLE "marketplace_scripts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"genre" text NOT NULL,
	"synopsis" text NOT NULL,
	"logline" text NOT NULL,
	"quality" integer DEFAULT 70 NOT NULL,
	"price" bigint DEFAULT 500000 NOT NULL,
	"writer_name" text NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"estimated_budget" bigint DEFAULT 50000000 NOT NULL,
	"target_audience" text DEFAULT 'general' NOT NULL,
	"roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" integer DEFAULT CAST(EXTRACT(EPOCH FROM NOW()) AS INTEGER) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "premium_bookings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"film_id" varchar NOT NULL,
	"format" text NOT NULL,
	"territory_code" text NOT NULL,
	"access_level" text NOT NULL,
	"start_week" integer NOT NULL,
	"start_year" integer NOT NULL,
	"duration_weeks" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"fee" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "save_talent_state" (
	"player_game_id" varchar NOT NULL,
	"talent_id" varchar NOT NULL,
	"star_rating" integer NOT NULL,
	"asking_price" integer NOT NULL,
	"box_office_avg" integer NOT NULL,
	"awards" integer NOT NULL,
	"popularity" integer NOT NULL,
	"performance" integer NOT NULL,
	"experience" integer NOT NULL,
	"fame" integer NOT NULL,
	"skill_action" integer NOT NULL,
	"skill_drama" integer NOT NULL,
	"skill_comedy" integer NOT NULL,
	"skill_thriller" integer NOT NULL,
	"skill_horror" integer NOT NULL,
	"skill_scifi" integer NOT NULL,
	"skill_animation" integer NOT NULL,
	"skill_romance" integer NOT NULL,
	"skill_fantasy" integer NOT NULL,
	"skill_musicals" integer NOT NULL,
	"skill_cinematography" integer NOT NULL,
	"skill_editing" integer NOT NULL,
	"skill_orchestral" integer NOT NULL,
	"skill_electronic" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"initialized_content_version" integer NOT NULL,
	CONSTRAINT "save_talent_state_player_game_id_talent_id_pk" PRIMARY KEY("player_game_id","talent_id")
);
--> statement-breakpoint
CREATE TABLE "slate_financing_deals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_game_id" varchar NOT NULL,
	"investor_name" text NOT NULL,
	"investment_amount" bigint NOT NULL,
	"profit_share_percent" integer DEFAULT 25 NOT NULL,
	"films_remaining" integer DEFAULT 4 NOT NULL,
	"films_completed" integer DEFAULT 0 NOT NULL,
	"total_profit_paid" bigint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"start_week" integer NOT NULL,
	"start_year" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streaming_deals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"film_id" varchar,
	"streaming_service_id" varchar NOT NULL,
	"player_game_id" varchar NOT NULL,
	"license_fee" bigint DEFAULT 0 NOT NULL,
	"weekly_revenue" bigint DEFAULT 0 NOT NULL,
	"total_revenue" bigint DEFAULT 0 NOT NULL,
	"start_week" integer NOT NULL,
	"start_year" integer NOT NULL,
	"end_week" integer,
	"end_year" integer,
	"weeks_active" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deal_type" text DEFAULT 'license' NOT NULL,
	"license_years" integer DEFAULT 2 NOT NULL,
	"weekly_views" bigint[] DEFAULT ARRAY[]::bigint[] NOT NULL,
	"total_views" bigint DEFAULT 0 NOT NULL,
	"annual_payment" bigint DEFAULT 0 NOT NULL,
	"upfront_payment" bigint DEFAULT 0 NOT NULL,
	"is_production_deal" boolean DEFAULT false NOT NULL,
	"production_deadline_week" integer,
	"production_deadline_year" integer
);
--> statement-breakpoint
CREATE TABLE "streaming_services" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"logo" text NOT NULL,
	"color" text NOT NULL,
	"subscriber_count" integer NOT NULL,
	"monthly_revenue_per_sub" real NOT NULL,
	"genre_preferences" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"minimum_quality_score" integer DEFAULT 60 NOT NULL,
	"license_fee_multiplier" real DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studios" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" varchar NOT NULL,
	"user_id" varchar,
	"game_session_id" varchar,
	"name" text DEFAULT 'New Studio' NOT NULL,
	"budget" bigint DEFAULT 150000000 NOT NULL,
	"current_week" integer DEFAULT 1 NOT NULL,
	"current_year" integer DEFAULT 2025 NOT NULL,
	"prestige_level" integer DEFAULT 1 NOT NULL,
	"total_earnings" bigint DEFAULT 0 NOT NULL,
	"total_awards" integer DEFAULT 0 NOT NULL,
	"is_ai" boolean DEFAULT false NOT NULL,
	"strategy" text DEFAULT 'balanced' NOT NULL,
	"home_territory" text DEFAULT 'NA' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"player_game_id" varchar,
	"created_at" integer DEFAULT CAST(EXTRACT(EPOCH FROM NOW()) AS INTEGER) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "talent" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"gender" text DEFAULT 'unknown' NOT NULL,
	"nationality" text DEFAULT 'American' NOT NULL,
	"star_rating" integer DEFAULT 3 NOT NULL,
	"asking_price" integer DEFAULT 5000000 NOT NULL,
	"box_office_avg" integer DEFAULT 100000000 NOT NULL,
	"awards" integer DEFAULT 0 NOT NULL,
	"genres" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"genre_tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"image_url" text,
	"birth_year" integer,
	"popularity" integer DEFAULT 50 NOT NULL,
	"performance" integer DEFAULT 70 NOT NULL,
	"experience" integer DEFAULT 50 NOT NULL,
	"fame" integer DEFAULT 50 NOT NULL,
	"skill_action" integer DEFAULT 50 NOT NULL,
	"skill_drama" integer DEFAULT 50 NOT NULL,
	"skill_comedy" integer DEFAULT 50 NOT NULL,
	"skill_thriller" integer DEFAULT 50 NOT NULL,
	"skill_horror" integer DEFAULT 50 NOT NULL,
	"skill_scifi" integer DEFAULT 50 NOT NULL,
	"skill_animation" integer DEFAULT 50 NOT NULL,
	"skill_romance" integer DEFAULT 50 NOT NULL,
	"skill_fantasy" integer DEFAULT 50 NOT NULL,
	"skill_musicals" integer DEFAULT 50 NOT NULL,
	"skill_cinematography" integer DEFAULT 50 NOT NULL,
	"skill_editing" integer DEFAULT 50 NOT NULL,
	"skill_orchestral" integer DEFAULT 50 NOT NULL,
	"skill_electronic" integer DEFAULT 50 NOT NULL,
	"current_film_id" varchar,
	"busy_until_week" integer,
	"busy_until_year" integer
);
--> statement-breakpoint
CREATE TABLE "tv_deals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tv_show_id" varchar NOT NULL,
	"player_game_id" varchar NOT NULL,
	"deal_type" text DEFAULT 'streaming' NOT NULL,
	"streaming_service_id" varchar,
	"network_name" text,
	"license_fee" bigint DEFAULT 0 NOT NULL,
	"episode_fee" bigint DEFAULT 0 NOT NULL,
	"total_value" bigint DEFAULT 0 NOT NULL,
	"start_week" integer NOT NULL,
	"start_year" integer NOT NULL,
	"end_week" integer,
	"end_year" integer,
	"seasons_committed" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_exclusive" boolean DEFAULT false NOT NULL,
	"weekly_views" bigint[] DEFAULT ARRAY[]::bigint[] NOT NULL,
	"total_views" bigint DEFAULT 0 NOT NULL,
	"weekly_revenue" bigint DEFAULT 0 NOT NULL,
	"total_revenue" bigint DEFAULT 0 NOT NULL,
	"weeks_active" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tv_episodes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tv_season_id" varchar NOT NULL,
	"tv_show_id" varchar NOT NULL,
	"episode_number" integer NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"synopsis" text DEFAULT '' NOT NULL,
	"director_id" varchar,
	"writer_id" varchar,
	"guest_cast_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"episode_budget" bigint DEFAULT 5000000 NOT NULL,
	"episode_quality" integer DEFAULT 70 NOT NULL,
	"air_week" integer,
	"air_year" integer,
	"has_aired" boolean DEFAULT false NOT NULL,
	"viewers" bigint DEFAULT 0 NOT NULL,
	"rating" real DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tv_networks" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"viewer_base" bigint NOT NULL,
	"ad_revenue_per_million" bigint NOT NULL,
	"genre_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"minimum_quality" integer DEFAULT 60 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tv_seasons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tv_show_id" varchar NOT NULL,
	"season_number" integer NOT NULL,
	"phase" text DEFAULT 'concept' NOT NULL,
	"episode_count" integer DEFAULT 10 NOT NULL,
	"episodes_completed" integer DEFAULT 0 NOT NULL,
	"episodes_aired" integer DEFAULT 0 NOT NULL,
	"season_budget" bigint DEFAULT 50000000 NOT NULL,
	"budget_spent" bigint DEFAULT 0 NOT NULL,
	"writers_room_weeks" integer DEFAULT 8 NOT NULL,
	"pre_production_weeks" integer DEFAULT 4 NOT NULL,
	"production_weeks" integer DEFAULT 16 NOT NULL,
	"post_production_weeks" integer DEFAULT 8 NOT NULL,
	"weeks_in_current_phase" integer DEFAULT 0 NOT NULL,
	"cast_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"season_quality" integer DEFAULT 70 NOT NULL,
	"audience_score" real DEFAULT 0 NOT NULL,
	"critic_score" integer DEFAULT 0 NOT NULL,
	"premiere_week" integer,
	"premiere_year" integer,
	"finale_week" integer,
	"finale_year" integer,
	"average_viewers" bigint DEFAULT 0 NOT NULL,
	"peak_viewers" bigint DEFAULT 0 NOT NULL,
	"total_views" bigint DEFAULT 0 NOT NULL,
	"weekly_views" bigint[] DEFAULT ARRAY[]::bigint[] NOT NULL,
	"season_revenue" bigint DEFAULT 0 NOT NULL,
	"is_complete" boolean DEFAULT false NOT NULL,
	"is_airing" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tv_shows" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" varchar NOT NULL,
	"title" text NOT NULL,
	"genre" text NOT NULL,
	"synopsis" text DEFAULT '' NOT NULL,
	"show_type" text DEFAULT 'drama' NOT NULL,
	"phase" text DEFAULT 'concept' NOT NULL,
	"showrunner_id" varchar,
	"creator_id" varchar,
	"episode_budget" bigint DEFAULT 5000000 NOT NULL,
	"total_budget" bigint DEFAULT 0 NOT NULL,
	"network_id" varchar,
	"streaming_service_id" varchar,
	"is_streaming_exclusive" boolean DEFAULT false NOT NULL,
	"release_strategy" text DEFAULT 'weekly' NOT NULL,
	"overall_quality" integer DEFAULT 70 NOT NULL,
	"audience_score" real DEFAULT 0 NOT NULL,
	"critic_score" integer DEFAULT 0 NOT NULL,
	"total_seasons" integer DEFAULT 0 NOT NULL,
	"total_episodes" integer DEFAULT 0 NOT NULL,
	"episodes_per_season" integer DEFAULT 10 NOT NULL,
	"current_season" integer DEFAULT 1 NOT NULL,
	"renewal_status" text DEFAULT 'pending' NOT NULL,
	"weeks_streaming" integer DEFAULT 0 NOT NULL,
	"total_views" bigint DEFAULT 0 NOT NULL,
	"total_revenue" bigint DEFAULT 0 NOT NULL,
	"weekly_views" bigint[] DEFAULT ARRAY[]::bigint[] NOT NULL,
	"created_at_week" integer DEFAULT 1 NOT NULL,
	"created_at_year" integer DEFAULT 2025 NOT NULL,
	"premiere_week" integer,
	"premiere_year" integer,
	"finale_week" integer,
	"finale_year" integer,
	"is_renewed" boolean DEFAULT false NOT NULL,
	"is_cancelled" boolean DEFAULT false NOT NULL,
	"renewal_pending" boolean DEFAULT false NOT NULL,
	"awards" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"emmy_nominations" integer DEFAULT 0 NOT NULL,
	"emmy_wins" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"is_online" boolean DEFAULT false NOT NULL,
	"last_seen_at" integer,
	"created_at" integer DEFAULT CAST(EXTRACT(EPOCH FROM NOW()) AS INTEGER) NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "award_categories" ADD CONSTRAINT "award_categories_award_show_id_award_shows_id_fk" FOREIGN KEY ("award_show_id") REFERENCES "public"."award_shows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_ceremonies" ADD CONSTRAINT "award_ceremonies_award_show_id_award_shows_id_fk" FOREIGN KEY ("award_show_id") REFERENCES "public"."award_shows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_nominations" ADD CONSTRAINT "award_nominations_award_show_id_award_shows_id_fk" FOREIGN KEY ("award_show_id") REFERENCES "public"."award_shows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_nominations" ADD CONSTRAINT "award_nominations_category_id_award_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."award_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_nominations" ADD CONSTRAINT "award_nominations_film_id_films_id_fk" FOREIGN KEY ("film_id") REFERENCES "public"."films"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_nominations" ADD CONSTRAINT "award_nominations_talent_id_talent_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "co_production_deals" ADD CONSTRAINT "co_production_deals_film_id_films_id_fk" FOREIGN KEY ("film_id") REFERENCES "public"."films"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "film_milestones" ADD CONSTRAINT "film_milestones_film_id_films_id_fk" FOREIGN KEY ("film_id") REFERENCES "public"."films"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "film_releases" ADD CONSTRAINT "film_releases_film_id_films_id_fk" FOREIGN KEY ("film_id") REFERENCES "public"."films"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "film_roles" ADD CONSTRAINT "film_roles_film_id_films_id_fk" FOREIGN KEY ("film_id") REFERENCES "public"."films"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "film_roles" ADD CONSTRAINT "film_roles_actor_id_talent_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."talent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "films" ADD CONSTRAINT "films_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "films" ADD CONSTRAINT "films_director_id_talent_id_fk" FOREIGN KEY ("director_id") REFERENCES "public"."talent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "films" ADD CONSTRAINT "films_writer_id_talent_id_fk" FOREIGN KEY ("writer_id") REFERENCES "public"."talent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "films" ADD CONSTRAINT "films_cinematographer_id_talent_id_fk" FOREIGN KEY ("cinematographer_id") REFERENCES "public"."talent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "films" ADD CONSTRAINT "films_editor_id_talent_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."talent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "films" ADD CONSTRAINT "films_composer_id_talent_id_fk" FOREIGN KEY ("composer_id") REFERENCES "public"."talent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "films" ADD CONSTRAINT "films_franchise_id_franchises_id_fk" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "films" ADD CONSTRAINT "films_prequel_film_id_films_id_fk" FOREIGN KEY ("prequel_film_id") REFERENCES "public"."films"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "franchises" ADD CONSTRAINT "franchises_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "franchises" ADD CONSTRAINT "franchises_original_film_id_films_id_fk" FOREIGN KEY ("original_film_id") REFERENCES "public"."films"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_activity_log" ADD CONSTRAINT "game_activity_log_game_session_id_game_sessions_id_fk" FOREIGN KEY ("game_session_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_activity_log" ADD CONSTRAINT "game_activity_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_activity_log" ADD CONSTRAINT "game_activity_log_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_session_players" ADD CONSTRAINT "game_session_players_game_session_id_game_sessions_id_fk" FOREIGN KEY ("game_session_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_session_players" ADD CONSTRAINT "game_session_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_session_players" ADD CONSTRAINT "game_session_players_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_actions" ADD CONSTRAINT "marketing_actions_film_id_films_id_fk" FOREIGN KEY ("film_id") REFERENCES "public"."films"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_script_purchases" ADD CONSTRAINT "marketplace_script_purchases_player_game_id_studios_id_fk" FOREIGN KEY ("player_game_id") REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_script_purchases" ADD CONSTRAINT "marketplace_script_purchases_script_id_marketplace_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."marketplace_scripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "premium_bookings" ADD CONSTRAINT "premium_bookings_film_id_films_id_fk" FOREIGN KEY ("film_id") REFERENCES "public"."films"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "save_talent_state" ADD CONSTRAINT "save_talent_state_player_game_id_studios_id_fk" FOREIGN KEY ("player_game_id") REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "save_talent_state" ADD CONSTRAINT "save_talent_state_talent_id_talent_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streaming_deals" ADD CONSTRAINT "streaming_deals_film_id_films_id_fk" FOREIGN KEY ("film_id") REFERENCES "public"."films"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streaming_deals" ADD CONSTRAINT "streaming_deals_streaming_service_id_streaming_services_id_fk" FOREIGN KEY ("streaming_service_id") REFERENCES "public"."streaming_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_deals" ADD CONSTRAINT "tv_deals_tv_show_id_tv_shows_id_fk" FOREIGN KEY ("tv_show_id") REFERENCES "public"."tv_shows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_deals" ADD CONSTRAINT "tv_deals_streaming_service_id_streaming_services_id_fk" FOREIGN KEY ("streaming_service_id") REFERENCES "public"."streaming_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_episodes" ADD CONSTRAINT "tv_episodes_tv_season_id_tv_seasons_id_fk" FOREIGN KEY ("tv_season_id") REFERENCES "public"."tv_seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_episodes" ADD CONSTRAINT "tv_episodes_tv_show_id_tv_shows_id_fk" FOREIGN KEY ("tv_show_id") REFERENCES "public"."tv_shows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_episodes" ADD CONSTRAINT "tv_episodes_director_id_talent_id_fk" FOREIGN KEY ("director_id") REFERENCES "public"."talent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_episodes" ADD CONSTRAINT "tv_episodes_writer_id_talent_id_fk" FOREIGN KEY ("writer_id") REFERENCES "public"."talent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_seasons" ADD CONSTRAINT "tv_seasons_tv_show_id_tv_shows_id_fk" FOREIGN KEY ("tv_show_id") REFERENCES "public"."tv_shows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_shows" ADD CONSTRAINT "tv_shows_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_shows" ADD CONSTRAINT "tv_shows_showrunner_id_talent_id_fk" FOREIGN KEY ("showrunner_id") REFERENCES "public"."talent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_shows" ADD CONSTRAINT "tv_shows_creator_id_talent_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."talent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_shows" ADD CONSTRAINT "tv_shows_streaming_service_id_streaming_services_id_fk" FOREIGN KEY ("streaming_service_id") REFERENCES "public"."streaming_services"("id") ON DELETE no action ON UPDATE no action;