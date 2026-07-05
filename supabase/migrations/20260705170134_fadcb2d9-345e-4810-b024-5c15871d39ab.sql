
CREATE OR REPLACE FUNCTION public.sync_tournament_match_scores()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tournament_matches tm
     SET kills_a = NEW.home_score,
         kills_b = NEW.away_score,
         status = CASE
                    WHEN tm.status = 'completed' THEN tm.status
                    WHEN NEW.status = 'ended' THEN 'completed'
                    ELSE 'live'
                  END,
         played_at = CASE
                       WHEN NEW.status = 'ended' AND tm.played_at IS NULL THEN now()
                       ELSE tm.played_at
                     END,
         updated_at = now()
   WHERE tm.match_id = NEW.id;
  RETURN NEW;
END;
$$;
