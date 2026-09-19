CREATE TABLE IF NOT EXISTS rx_jobs (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  version integer NOT NULL DEFAULT 0,
  lock_token text,
  lock_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rx_settings (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS rx_weeks (
  id text PRIMARY KEY,
  week_start date NOT NULL,
  topics jsonb NOT NULL,
  status text NOT NULL,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rx_media (
  id text PRIMARY KEY,
  week_id text,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rx_research (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS topic_research (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_usage (
  id text PRIMARY KEY,
  job_id text,
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rx_limits (
  id text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL
);
