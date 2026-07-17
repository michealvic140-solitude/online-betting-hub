ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS hidden_in_admin boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_matches_hidden_in_admin ON public.matches(hidden_in_admin);