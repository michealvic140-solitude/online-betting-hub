-- push_delivery_log
CREATE TABLE IF NOT EXISTS public.push_delivery_log (
  notification_id uuid PRIMARY KEY REFERENCES public.notifications(id) ON DELETE CASCADE,
  sent_count integer NOT NULL DEFAULT 0,
  removed_count integer NOT NULL DEFAULT 0,
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.push_delivery_log TO authenticated;
GRANT ALL ON public.push_delivery_log TO service_role;
ALTER TABLE public.push_delivery_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push delivery admins read" ON public.push_delivery_log;
CREATE POLICY "push delivery admins read" ON public.push_delivery_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS push_delivery_log_updated_at ON public.push_delivery_log;
CREATE TRIGGER push_delivery_log_updated_at BEFORE UPDATE ON public.push_delivery_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- user_tasks richer fields
ALTER TABLE public.user_tasks ADD COLUMN IF NOT EXISTS target_progress numeric NOT NULL DEFAULT 1;
ALTER TABLE public.user_tasks ADD COLUMN IF NOT EXISTS progress numeric NOT NULL DEFAULT 0;
ALTER TABLE public.user_tasks ADD COLUMN IF NOT EXISTS ends_at timestamptz;
ALTER TABLE public.user_tasks ADD COLUMN IF NOT EXISTS banner_url text;
ALTER TABLE public.user_tasks ADD COLUMN IF NOT EXISTS reward_kind text NOT NULL DEFAULT 'tokens';
ALTER TABLE public.user_tasks ADD COLUMN IF NOT EXISTS period text;

-- push_subscriptions extra fields
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS disabled_at timestamptz;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS failure_count integer NOT NULL DEFAULT 0;

-- Admin-only: correct bets whose selections all won but are still marked lost
CREATE OR REPLACE FUNCTION public.resettle_won_bets()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b record;
  v_count integer := 0;
  new_house bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  FOR b IN
    SELECT bt.* FROM public.bets bt
    WHERE bt.status = 'lost'
      AND EXISTS (SELECT 1 FROM public.bet_selections s WHERE s.bet_id = bt.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.bet_selections s
        WHERE s.bet_id = bt.id AND (s.result IS NULL OR s.result <> 'won')
      )
  LOOP
    UPDATE public.profiles
      SET token_balance = token_balance + b.potential_payout
      WHERE id = b.user_id;

    UPDATE public.house_wallet
      SET balance = balance - b.potential_payout,
          total_out = total_out + b.potential_payout,
          updated_at = now()
      WHERE id = 1
      RETURNING balance INTO new_house;

    INSERT INTO public.house_transactions(kind, amount, balance_after, user_id, bet_id, reason)
      VALUES ('payout', -b.potential_payout, new_house, b.user_id, b.id,
              'Corrected payout — all selections won for ' || b.tracking_id);

    UPDATE public.bets
      SET status = 'won', settled_at = COALESCE(settled_at, now())
      WHERE id = b.id;

    INSERT INTO public.notifications(user_id, title, body, link)
      VALUES (b.user_id, 'Bet won! 🎉',
              'Your ticket ' || b.tracking_id || ' was corrected to WON. +' || b.potential_payout || ' tokens credited.',
              '/ticket/' || b.id);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.resettle_won_bets() TO authenticated;