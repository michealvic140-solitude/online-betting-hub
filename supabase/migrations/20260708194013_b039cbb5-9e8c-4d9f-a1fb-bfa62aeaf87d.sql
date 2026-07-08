-- Consolidated defensive migration for repo-sync tables.
-- Uses IF NOT EXISTS / DROP POLICY IF EXISTS so it is idempotent.

-- Shared updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ HOME BANNERS ============
CREATE TABLE IF NOT EXISTS public.home_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  subtitle text NOT NULL DEFAULT '',
  image_url text NOT NULL,
  link_url text NOT NULL DEFAULT '/',
  cta_label text NOT NULL DEFAULT 'Click here',
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.home_banners TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.home_banners TO authenticated;
GRANT ALL ON public.home_banners TO service_role;
ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active banners" ON public.home_banners;
CREATE POLICY "Anyone can view active banners" ON public.home_banners
  FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins manage banners" ON public.home_banners;
CREATE POLICY "Admins manage banners" ON public.home_banners
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS t_home_banners_updated ON public.home_banners;
CREATE TRIGGER t_home_banners_updated BEFORE UPDATE ON public.home_banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SURVEYS ============
CREATE TABLE IF NOT EXISTS public.surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_user_ids uuid[],
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.surveys TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.surveys TO authenticated;
GRANT ALL ON public.surveys TO service_role;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "view targeted active surveys" ON public.surveys;
CREATE POLICY "view targeted active surveys" ON public.surveys FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR (is_active AND (target_user_ids IS NULL OR auth.uid() = ANY(target_user_ids))));
DROP POLICY IF EXISTS "admins manage surveys" ON public.surveys;
CREATE POLICY "admins manage surveys" ON public.surveys FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS update_surveys_updated_at ON public.surveys;
CREATE TRIGGER update_surveys_updated_at BEFORE UPDATE ON public.surveys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (survey_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.survey_responses TO authenticated;
GRANT ALL ON public.survey_responses TO service_role;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users manage own survey responses" ON public.survey_responses;
CREATE POLICY "users manage own survey responses" ON public.survey_responses FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "admins view survey responses" ON public.survey_responses;
CREATE POLICY "admins view survey responses" ON public.survey_responses FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.submit_survey(_survey_id uuid, _answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.survey_responses(survey_id, user_id, answers, status)
  VALUES (_survey_id, uid, COALESCE(_answers, '{}'::jsonb), 'submitted')
  ON CONFLICT (survey_id, user_id) DO UPDATE SET answers = EXCLUDED.answers, status = 'submitted';
  RETURN jsonb_build_object('ok', true);
END $$;
GRANT EXECUTE ON FUNCTION public.submit_survey(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.dismiss_survey(_survey_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.survey_responses(survey_id, user_id, answers, status)
  VALUES (_survey_id, uid, '{}'::jsonb, 'dismissed')
  ON CONFLICT (survey_id, user_id) DO NOTHING;
  RETURN jsonb_build_object('ok', true);
END $$;
GRANT EXECUTE ON FUNCTION public.dismiss_survey(uuid) TO authenticated;

-- ============ LOTTERY ============
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS lottery_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS lottery_min_stake bigint NOT NULL DEFAULT 100000;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS lottery_max_stake bigint NOT NULL DEFAULT 50000000;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS lottery_intro text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS tasks_bg_url text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS tasks_bg_fit text DEFAULT 'cover';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS tasks_bg_position text DEFAULT 'center';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS ticker_enabled boolean DEFAULT false;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS ticker_text text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS ticker_speed integer DEFAULT 30;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS shop_enabled boolean DEFAULT true;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS coinflip_enabled boolean DEFAULT true;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS coinflip_min bigint DEFAULT 100000;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS coinflip_max bigint DEFAULT 50000000;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS coinflip_payout numeric DEFAULT 1.95;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS wheel_enabled boolean DEFAULT true;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS wheel_min bigint DEFAULT 100000;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS wheel_max bigint DEFAULT 50000000;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS scratch_enabled boolean DEFAULT true;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS scratch_price bigint DEFAULT 500000;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS trivia_enabled boolean DEFAULT true;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS polls_enabled boolean DEFAULT true;

ALTER TABLE public.app_settings_private ADD COLUMN IF NOT EXISTS broadcast_endpoint_url text;

CREATE TABLE IF NOT EXISTS public.lottery_draws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Lucky Numbers Draw',
  number_max integer NOT NULL DEFAULT 9,
  multiplier numeric NOT NULL DEFAULT 2,
  win_count integer NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'open',
  winning_number integer,
  winning_numbers integer[],
  draw_at timestamptz,
  drawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lottery_draws TO anon, authenticated;
GRANT ALL ON public.lottery_draws TO service_role;
ALTER TABLE public.lottery_draws ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view lottery draws" ON public.lottery_draws;
CREATE POLICY "Anyone can view lottery draws" ON public.lottery_draws FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage lottery draws" ON public.lottery_draws;
CREATE POLICY "Admins manage lottery draws" ON public.lottery_draws FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS update_lottery_draws_updated_at ON public.lottery_draws;
CREATE TRIGGER update_lottery_draws_updated_at BEFORE UPDATE ON public.lottery_draws
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.lottery_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id uuid NOT NULL REFERENCES public.lottery_draws(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  number integer,
  numbers integer[],
  stake bigint NOT NULL,
  status text NOT NULL DEFAULT 'open',
  payout bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.lottery_tickets TO authenticated;
GRANT ALL ON public.lottery_tickets TO service_role;
ALTER TABLE public.lottery_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own lottery tickets" ON public.lottery_tickets;
CREATE POLICY "Users view own lottery tickets" ON public.lottery_tickets FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins manage lottery tickets" ON public.lottery_tickets;
CREATE POLICY "Admins manage lottery tickets" ON public.lottery_tickets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_lottery_tickets_draw ON public.lottery_tickets(draw_id);
CREATE INDEX IF NOT EXISTS idx_lottery_tickets_user ON public.lottery_tickets(user_id);

CREATE OR REPLACE FUNCTION public.place_lottery_ticket_multi(_draw_id uuid, _numbers integer[], _stake bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_draw public.lottery_draws%ROWTYPE;
  v_enabled boolean; v_min bigint; v_max bigint;
  v_balance bigint; v_new_balance bigint; v_house bigint;
  v_ticket_id uuid; v_n integer; v_count integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT lottery_enabled, lottery_min_stake, lottery_max_stake INTO v_enabled, v_min, v_max FROM public.app_settings WHERE id = 1;
  IF NOT COALESCE(v_enabled, false) THEN RAISE EXCEPTION 'The lottery is currently closed'; END IF;
  SELECT * INTO v_draw FROM public.lottery_draws WHERE id = _draw_id;
  IF v_draw.id IS NULL THEN RAISE EXCEPTION 'Draw not found'; END IF;
  IF v_draw.status <> 'open' THEN RAISE EXCEPTION 'This draw is not accepting tickets'; END IF;
  SELECT array_agg(DISTINCT x) INTO _numbers FROM unnest(_numbers) x;
  v_count := COALESCE(array_length(_numbers, 1), 0);
  IF v_count < 1 OR v_count > 5 THEN RAISE EXCEPTION 'Pick between 1 and 5 numbers'; END IF;
  FOREACH v_n IN ARRAY _numbers LOOP
    IF v_n < 0 OR v_n > v_draw.number_max THEN RAISE EXCEPTION 'Numbers must be between 0 and %', v_draw.number_max; END IF;
  END LOOP;
  IF _stake < v_min THEN RAISE EXCEPTION 'Minimum stake is %', v_min; END IF;
  IF _stake > v_max THEN RAISE EXCEPTION 'Maximum stake is %', v_max; END IF;
  SELECT token_balance INTO v_balance FROM public.profiles WHERE id = v_user FOR UPDATE;
  IF v_balance < _stake THEN RAISE EXCEPTION 'Insufficient token balance'; END IF;
  UPDATE public.profiles SET token_balance = token_balance - _stake WHERE id = v_user RETURNING token_balance INTO v_new_balance;
  INSERT INTO public.token_transactions (user_id, amount, balance_after, kind, description)
  VALUES (v_user, -_stake, v_new_balance, 'lottery_stake', 'Lottery ticket: ' || array_to_string(_numbers, ','));
  UPDATE public.house_wallet SET balance = balance + _stake, total_in = total_in + _stake, updated_at = now()
    WHERE id = 1 RETURNING balance INTO v_house;
  INSERT INTO public.house_transactions (kind, amount, balance_after, user_id, reason)
  VALUES ('lottery_stake', _stake, COALESCE(v_house, 0), v_user, 'Lottery ticket');
  INSERT INTO public.lottery_tickets (draw_id, user_id, number, numbers, stake)
  VALUES (_draw_id, v_user, _numbers[1], _numbers, _stake) RETURNING id INTO v_ticket_id;
  RETURN jsonb_build_object('ok', true, 'ticket_id', v_ticket_id, 'new_balance', v_new_balance);
END; $$;
GRANT EXECUTE ON FUNCTION public.place_lottery_ticket_multi(uuid, integer[], bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.draw_lottery(_draw_id uuid, _winning_number integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_draw public.lottery_draws%ROWTYPE;
  v_winning integer[]; v_count integer; v_ticket record;
  v_picks integer[]; v_matches integer; v_npicks integer;
  v_payout bigint; v_new_balance bigint; v_house bigint;
  v_winners integer := 0; v_total_payout bigint := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO v_draw FROM public.lottery_draws WHERE id = _draw_id FOR UPDATE;
  IF v_draw.id IS NULL THEN RAISE EXCEPTION 'Draw not found'; END IF;
  IF v_draw.status = 'drawn' THEN RAISE EXCEPTION 'This draw is already settled'; END IF;
  v_count := LEAST(GREATEST(COALESCE(v_draw.win_count, 10), 1), v_draw.number_max + 1);
  SELECT array_agg(n) INTO v_winning FROM (
    SELECT n FROM generate_series(0, v_draw.number_max) n ORDER BY random() LIMIT v_count
  ) s;
  FOR v_ticket IN SELECT * FROM public.lottery_tickets WHERE draw_id = _draw_id AND status = 'open' LOOP
    v_picks := COALESCE(v_ticket.numbers, ARRAY[v_ticket.number]);
    v_npicks := COALESCE(array_length(v_picks, 1), 0);
    SELECT count(*) INTO v_matches FROM unnest(v_picks) x WHERE x = ANY(v_winning);
    v_payout := 0;
    IF v_npicks > 0 AND v_matches = v_npicks THEN v_payout := (v_ticket.stake * 2)::bigint;
    ELSIF v_npicks = 5 AND v_matches = 2 THEN v_payout := v_ticket.stake;
    END IF;
    IF v_payout > 0 THEN
      UPDATE public.lottery_tickets SET status = 'won', payout = v_payout WHERE id = v_ticket.id;
      UPDATE public.profiles SET token_balance = token_balance + v_payout WHERE id = v_ticket.user_id RETURNING token_balance INTO v_new_balance;
      INSERT INTO public.token_transactions (user_id, amount, balance_after, kind, description)
      VALUES (v_ticket.user_id, v_payout, v_new_balance, 'lottery_win', 'Lottery win');
      UPDATE public.house_wallet SET balance = balance - v_payout, total_out = total_out + v_payout, updated_at = now()
        WHERE id = 1 RETURNING balance INTO v_house;
      INSERT INTO public.house_transactions (kind, amount, balance_after, user_id, reason)
      VALUES ('lottery_payout', -v_payout, COALESCE(v_house, 0), v_ticket.user_id, 'Lottery payout');
      v_winners := v_winners + 1; v_total_payout := v_total_payout + v_payout;
    ELSE
      UPDATE public.lottery_tickets SET status = 'lost' WHERE id = v_ticket.id;
    END IF;
  END LOOP;
  UPDATE public.lottery_draws
    SET status = 'drawn', winning_numbers = v_winning, winning_number = v_winning[1], drawn_at = now()
    WHERE id = _draw_id;
  RETURN jsonb_build_object('ok', true, 'winning_numbers', v_winning, 'winners', v_winners, 'total_payout', v_total_payout);
END; $$;
GRANT EXECUTE ON FUNCTION public.draw_lottery(uuid, integer) TO authenticated;

-- ============ SCHEDULED PUSHES ============
CREATE TABLE IF NOT EXISTS public.scheduled_pushes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  link text NOT NULL DEFAULT '/',
  role text NOT NULL DEFAULT 'any',
  locale text NOT NULL DEFAULT '',
  last_active_days integer,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_count integer NOT NULL DEFAULT 0,
  total_count integer NOT NULL DEFAULT 0,
  error text,
  created_by uuid NOT NULL,
  sent_at timestamptz,
  repeat_interval text NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scheduled_pushes DROP CONSTRAINT IF EXISTS scheduled_pushes_repeat_chk;
ALTER TABLE public.scheduled_pushes ADD CONSTRAINT scheduled_pushes_repeat_chk
  CHECK (repeat_interval IN ('none','daily','weekly'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_pushes TO authenticated;
GRANT ALL ON public.scheduled_pushes TO service_role;
ALTER TABLE public.scheduled_pushes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage scheduled pushes" ON public.scheduled_pushes;
CREATE POLICY "Admins manage scheduled pushes" ON public.scheduled_pushes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_scheduled_pushes_due ON public.scheduled_pushes (status, scheduled_for);
DROP TRIGGER IF EXISTS update_scheduled_pushes_updated_at ON public.scheduled_pushes;
CREATE TRIGGER update_scheduled_pushes_updated_at BEFORE UPDATE ON public.scheduled_pushes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ FAQ ============
CREATE TABLE IF NOT EXISTS public.faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.faqs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.faqs TO authenticated;
GRANT ALL ON public.faqs TO service_role;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "faqs public read active" ON public.faqs;
CREATE POLICY "faqs public read active" ON public.faqs FOR SELECT USING (is_active OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "faqs admin manage" ON public.faqs;
CREATE POLICY "faqs admin manage" ON public.faqs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS faqs_updated_at ON public.faqs;
CREATE TRIGGER faqs_updated_at BEFORE UPDATE ON public.faqs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ POLLS ============
CREATE TABLE IF NOT EXISTS public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  closes_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.polls TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.polls TO authenticated;
GRANT ALL ON public.polls TO service_role;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "polls public read" ON public.polls;
CREATE POLICY "polls public read" ON public.polls FOR SELECT USING (is_active OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "polls admin manage" ON public.polls;
CREATE POLICY "polls admin manage" ON public.polls FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);
GRANT SELECT, INSERT ON public.poll_votes TO authenticated;
GRANT ALL ON public.poll_votes TO service_role;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "poll votes read" ON public.poll_votes;
CREATE POLICY "poll votes read" ON public.poll_votes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "poll votes own insert" ON public.poll_votes;
CREATE POLICY "poll votes own insert" ON public.poll_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ SHOP ============
CREATE TABLE IF NOT EXISTS public.shop_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text,
  cost bigint NOT NULL DEFAULT 0,
  stock integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shop_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shop_items TO authenticated;
GRANT ALL ON public.shop_items TO service_role;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shop items public read" ON public.shop_items;
CREATE POLICY "shop items public read" ON public.shop_items FOR SELECT USING (is_active OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "shop items admin manage" ON public.shop_items;
CREATE POLICY "shop items admin manage" ON public.shop_items FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS shop_items_updated_at ON public.shop_items;
CREATE TRIGGER shop_items_updated_at BEFORE UPDATE ON public.shop_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.shop_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
  cost bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_redemptions TO authenticated;
GRANT ALL ON public.shop_redemptions TO service_role;
ALTER TABLE public.shop_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shop redemptions own select" ON public.shop_redemptions;
CREATE POLICY "shop redemptions own select" ON public.shop_redemptions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "shop redemptions admin update" ON public.shop_redemptions;
CREATE POLICY "shop redemptions admin update" ON public.shop_redemptions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.redeem_shop_item(_item_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_item public.shop_items%ROWTYPE;
  v_bal bigint; v_new bigint; v_rid uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_item FROM public.shop_items WHERE id = _item_id FOR UPDATE;
  IF v_item.id IS NULL OR NOT v_item.is_active THEN RAISE EXCEPTION 'Item unavailable'; END IF;
  IF v_item.stock IS NOT NULL AND v_item.stock <= 0 THEN RAISE EXCEPTION 'Out of stock'; END IF;
  SELECT token_balance INTO v_bal FROM public.profiles WHERE id = v_user FOR UPDATE;
  IF v_bal < v_item.cost THEN RAISE EXCEPTION 'Insufficient token balance'; END IF;
  UPDATE public.profiles SET token_balance = token_balance - v_item.cost WHERE id = v_user RETURNING token_balance INTO v_new;
  INSERT INTO public.token_transactions (user_id, amount, balance_after, kind, description)
  VALUES (v_user, -v_item.cost, v_new, 'shop_redeem', 'Reward shop: ' || v_item.name);
  IF v_item.stock IS NOT NULL THEN UPDATE public.shop_items SET stock = stock - 1 WHERE id = _item_id; END IF;
  INSERT INTO public.shop_redemptions (user_id, item_id, cost) VALUES (v_user, _item_id, v_item.cost) RETURNING id INTO v_rid;
  RETURN jsonb_build_object('ok', true, 'redemption_id', v_rid, 'new_balance', v_new);
END; $$;
GRANT EXECUTE ON FUNCTION public.redeem_shop_item(uuid) TO authenticated;