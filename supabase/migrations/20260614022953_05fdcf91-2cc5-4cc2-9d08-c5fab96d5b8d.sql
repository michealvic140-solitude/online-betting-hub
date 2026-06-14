-- 1. Missing admin bet actions: void + refund
CREATE OR REPLACE FUNCTION public.admin_void_bet(_bet_id uuid, _refund boolean DEFAULT false, _reason text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE b record;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO b FROM public.bets WHERE id=_bet_id FOR UPDATE;
  IF b IS NULL THEN RAISE EXCEPTION 'Bet not found'; END IF;
  IF b.status IN ('void','refunded') THEN RAISE EXCEPTION 'Ticket already % — cannot void again', b.status; END IF;
  IF _refund AND b.status IN ('won','cashed_out') THEN
    RAISE EXCEPTION 'Stake already settled — cannot refund again (status: %)', b.status;
  END IF;
  IF _refund THEN
    UPDATE public.profiles SET token_balance = token_balance + b.stake WHERE id = b.user_id;
  END IF;
  UPDATE public.bets SET status='void', settled_at = COALESCE(settled_at, now()) WHERE id=_bet_id;
  INSERT INTO public.notifications(user_id, title, body, link)
    VALUES (b.user_id, 'Ticket voided', COALESCE(_reason,'Your bet ticket has been voided by an admin.') || CASE WHEN _refund THEN ' Stake refunded.' ELSE '' END, '/ticket/'||_bet_id);
  INSERT INTO public.audit_logs(actor_id, action, target_type, target_id, metadata)
    VALUES (auth.uid(), 'void_bet', 'bet', _bet_id::text, jsonb_build_object('reason', _reason, 'refunded', _refund, 'stake', b.stake));
END $function$;

CREATE OR REPLACE FUNCTION public.admin_refund_bet(_bet_id uuid, _reason text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE b record;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO b FROM public.bets WHERE id=_bet_id FOR UPDATE;
  IF b IS NULL THEN RAISE EXCEPTION 'Bet not found'; END IF;
  IF b.status IN ('refunded','won','cashed_out') THEN
    RAISE EXCEPTION 'Stake already settled or refunded — cannot refund again (status: %)', b.status;
  END IF;
  UPDATE public.profiles SET token_balance = token_balance + b.stake WHERE id = b.user_id;
  UPDATE public.bets SET status='refunded', settled_at = COALESCE(settled_at, now()) WHERE id=_bet_id;
  INSERT INTO public.notifications(user_id, title, body, link)
    VALUES (b.user_id, 'Ticket refunded', COALESCE(_reason,'Your bet stake has been refunded by an admin.') || ' +' || b.stake || ' tokens.', '/ticket/'||_bet_id);
  INSERT INTO public.audit_logs(actor_id, action, target_type, target_id, metadata)
    VALUES (auth.uid(), 'refund_bet', 'bet', _bet_id::text, jsonb_build_object('reason', _reason, 'stake', b.stake));
END $function$;

ALTER TABLE public.leaderboard_overrides ADD COLUMN IF NOT EXISTS total_score integer NOT NULL DEFAULT 0;

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS home_present boolean NOT NULL DEFAULT true;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS away_present boolean NOT NULL DEFAULT true;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS restrict_repeat_contender boolean NOT NULL DEFAULT false;

ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS allow_rebet boolean NOT NULL DEFAULT true;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS leaderboard_header_url text;
UPDATE public.app_settings
  SET leaderboard_header_url = '/__l5e/assets-v1/3e785487-fb67-4d21-9956-89ae56dbfab1/leaderboard-header.png'
  WHERE id = 1 AND (leaderboard_header_url IS NULL OR leaderboard_header_url = '');
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS closed_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_message text NOT NULL DEFAULT 'The website is currently closed. Please check back later.';
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS hot_bets_reset_at timestamptz,
  ADD COLUMN IF NOT EXISTS maintenance_image text,
  ADD COLUMN IF NOT EXISTS closed_image text;

-- Final cash-out function (every match must end and every selection must win)
CREATE OR REPLACE FUNCTION public.user_cashout_bet(_bet_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  b record;
  total_sels int; won_eval_sels int;
  payout bigint;
  new_bal bigint; new_house bigint; paused boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT payouts_paused INTO paused FROM public.house_wallet WHERE id = 1;
  IF paused THEN RAISE EXCEPTION 'Payouts are temporarily paused by the house. Please try again later.'; END IF;
  SELECT * INTO b FROM public.bets WHERE id = _bet_id FOR UPDATE;
  IF b IS NULL THEN RAISE EXCEPTION 'Ticket not found'; END IF;
  IF b.user_id <> auth.uid() THEN RAISE EXCEPTION 'Not your ticket'; END IF;
  IF b.status <> 'open' THEN RAISE EXCEPTION 'Ticket is %, cannot cash out', b.status; END IF;
  WITH s AS (
    SELECT bs.result, bs.selection_label,
           o.future_status,
           m.match_kind, m.status::text AS mstatus, m.home_score, m.away_score,
           ht.name AS home_name, at.name AS away_name,
           mk.name AS market_name
    FROM public.bet_selections bs
    JOIN public.odds o ON o.id = bs.odd_id
    LEFT JOIN public.matches m ON m.id = bs.match_id
    LEFT JOIN public.teams ht ON ht.id = m.home_team_id
    LEFT JOIN public.teams at ON at.id = m.away_team_id
    LEFT JOIN public.markets mk ON mk.id = bs.market_id
    WHERE bs.bet_id = _bet_id
  ), evaluated AS (
    SELECT
      CASE
        WHEN result = 'won' THEN true
        WHEN result = 'lost' THEN false
        WHEN match_kind = 'future' THEN future_status = 'winner'
        WHEN mstatus <> 'ended' THEN false
        WHEN market_name = 'Correct Score' THEN selection_label = (home_score::text || '-' || away_score::text)
        ELSE selection_label = CASE
              WHEN home_score > away_score THEN home_name
              WHEN away_score > home_score THEN away_name
              ELSE 'Draw' END
      END AS winning
    FROM s
  )
  SELECT count(*), count(*) FILTER (WHERE winning IS TRUE)
  INTO total_sels, won_eval_sels
  FROM evaluated;
  IF total_sels = 0 THEN RAISE EXCEPTION 'No selections on this ticket'; END IF;
  IF won_eval_sels < total_sels THEN
    RAISE EXCEPTION 'Cash-out locked: every match must have ended and every selection must have won';
  END IF;
  payout := b.potential_payout;
  IF payout < 1 THEN payout := 1; END IF;
  UPDATE public.profiles SET token_balance = token_balance + payout
    WHERE id = b.user_id RETURNING token_balance INTO new_bal;
  UPDATE public.house_wallet
    SET balance = balance - payout, total_out = total_out + payout, updated_at = now()
    WHERE id = 1 RETURNING balance INTO new_house;
  INSERT INTO public.house_transactions(kind, amount, balance_after, user_id, bet_id, reason)
    VALUES ('cashout', -payout, new_house, b.user_id, b.id, 'Cashout of bet ' || b.tracking_id);
  UPDATE public.bets SET status = 'cashed_out', cashout_amount = payout,
         cashed_out_at = now(), settled_at = COALESCE(settled_at, now())
    WHERE id = _bet_id;
  INSERT INTO public.notifications(user_id, title, body, link)
    VALUES (b.user_id, 'Ticket cashed out', '+' || payout || ' tokens credited.', '/ticket/'||_bet_id);
  RETURN jsonb_build_object('credited', payout, 'balance', new_bal, 'full', true);
END $function$;

-- Final futures rebet logic
CREATE OR REPLACE FUNCTION public.enforce_one_open_bet_per_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid;
  existing_count int;
  m_kind text;
  m_restrict boolean;
BEGIN
  IF NEW.match_id IS NULL THEN RETURN NEW; END IF;
  SELECT user_id INTO uid FROM public.bets WHERE id = NEW.bet_id;
  IF uid IS NULL THEN RETURN NEW; END IF;
  SELECT match_kind, COALESCE(restrict_repeat_contender, false)
    INTO m_kind, m_restrict
    FROM public.matches WHERE id = NEW.match_id;
  IF m_kind = 'future' THEN
    IF m_restrict THEN
      SELECT COUNT(*) INTO existing_count
      FROM public.bet_selections bs
      JOIN public.bets b ON b.id = bs.bet_id
      WHERE bs.match_id = NEW.match_id
        AND bs.odd_id = NEW.odd_id
        AND b.user_id = uid
        AND b.status IN ('open','suspended')
        AND bs.bet_id <> NEW.bet_id;
      IF existing_count > 0 THEN
        RAISE EXCEPTION 'You already backed this contender. Pick a different one.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  SELECT COUNT(*) INTO existing_count
  FROM public.bet_selections bs
  JOIN public.bets b ON b.id = bs.bet_id
  WHERE bs.match_id = NEW.match_id
    AND b.user_id = uid
    AND b.status IN ('open','suspended')
    AND bs.bet_id <> NEW.bet_id;
  IF existing_count > 0 THEN
    RAISE EXCEPTION 'You already have an active ticket on this match. Each match can only be staked once until it settles.';
  END IF;
  RETURN NEW;
END $function$;

DROP FUNCTION IF EXISTS public.admin_list_users_with_kyc();
CREATE OR REPLACE FUNCTION public.admin_list_users_with_kyc()
 RETURNS TABLE(id uuid, full_name text, email text, phone text, discord_username text, discord_full_name text, avatar_url text, gang_name text, gang_type text, token_balance bigint, is_banned boolean, is_muted boolean, is_restricted boolean, vip_tier text, xp bigint, created_at timestamp with time zone, email_confirmed boolean, total_bets bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.id, p.full_name, p.email, p.phone,
    p.discord_username, p.discord_full_name,
    p.avatar_url, p.gang_name, p.gang_type::text, p.token_balance,
    p.is_banned, p.is_muted, p.is_restricted, p.vip_tier, p.xp, p.created_at,
    (u.email_confirmed_at IS NOT NULL) AS email_confirmed,
    COALESCE((SELECT count(*) FROM public.bets b WHERE b.user_id = p.id), 0)::bigint AS total_bets
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
  ORDER BY p.created_at DESC
  LIMIT 1000;
$function$;

-- Tightened access policies
DROP POLICY IF EXISTS "broadcasts read authed" ON public.broadcasts;
DROP POLICY IF EXISTS "friends read authed" ON public.friends;
CREATE POLICY "friends own read" ON public.friends
  FOR SELECT TO authenticated
  USING (follower_id = auth.uid() OR followee_id = auth.uid());

DROP POLICY IF EXISTS "profiles readable by all authed" ON public.profiles;
CREATE POLICY "profiles own or admin read" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.gang_directory()
RETURNS TABLE(name text, type text, members bigint, tokens bigint, sample text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT gang_name,
         max(gang_type),
         count(*),
         coalesce(sum(token_balance), 0)::bigint,
         (array_agg(full_name ORDER BY token_balance DESC NULLS LAST))[1:4]
  FROM public.profiles
  WHERE gang_name IS NOT NULL
  GROUP BY gang_name
$$;
GRANT EXECUTE ON FUNCTION public.gang_directory() TO anon, authenticated;

DROP POLICY IF EXISTS "roles readable by all authed" ON public.user_roles;
CREATE POLICY "user_roles own or admin read" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_display_roles(_user_id uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(role::text), '{}'::text[])
  FROM public.user_roles
  WHERE user_id = _user_id AND role::text IN ('admin', 'moderator');
$$;
GRANT EXECUTE ON FUNCTION public.get_display_roles(uuid) TO anon, authenticated;

-- Admin-only settings table
CREATE TABLE IF NOT EXISTS public.app_settings_private (
  id integer PRIMARY KEY DEFAULT 1,
  admin_ai_model text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  admin_ai_enabled boolean NOT NULL DEFAULT true,
  exposure_warn_pct integer NOT NULL DEFAULT 70,
  house_low_balance bigint NOT NULL DEFAULT 1000000,
  push_endpoint_url text,
  vapid_subject text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_private_singleton CHECK (id = 1)
);

INSERT INTO public.app_settings_private
  (id, admin_ai_model, admin_ai_enabled, exposure_warn_pct, house_low_balance, push_endpoint_url, vapid_subject)
SELECT 1,
  COALESCE((SELECT admin_ai_model FROM public.app_settings WHERE id = 1), 'google/gemini-2.5-flash'),
  COALESCE((SELECT admin_ai_enabled FROM public.app_settings WHERE id = 1), true),
  COALESCE((SELECT exposure_warn_pct FROM public.app_settings WHERE id = 1), 70),
  COALESCE((SELECT house_low_balance FROM public.app_settings WHERE id = 1), 1000000),
  (SELECT push_endpoint_url FROM public.app_settings WHERE id = 1),
  (SELECT vapid_subject FROM public.app_settings WHERE id = 1)
ON CONFLICT (id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON public.app_settings_private TO authenticated;
GRANT ALL ON public.app_settings_private TO service_role;
ALTER TABLE public.app_settings_private ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "private settings admin" ON public.app_settings_private;
CREATE POLICY "private settings admin" ON public.app_settings_private
  FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

ALTER TABLE public.app_settings
  DROP COLUMN IF EXISTS admin_ai_model,
  DROP COLUMN IF EXISTS admin_ai_enabled,
  DROP COLUMN IF EXISTS exposure_warn_pct,
  DROP COLUMN IF EXISTS house_low_balance,
  DROP COLUMN IF EXISTS push_endpoint_url,
  DROP COLUMN IF EXISTS vapid_subject;

DROP VIEW IF EXISTS public.public_profiles;
CREATE OR REPLACE FUNCTION public.public_profiles(_ids uuid[] DEFAULT NULL)
RETURNS TABLE(
  id uuid, full_name text, ingame_name text, gang_name text, gang_type text,
  vip_tier text, xp bigint, streak_days integer, longest_streak integer,
  profile_title text, avatar_url text, country text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, full_name, ingame_name, gang_name, gang_type::text, vip_tier, xp,
         streak_days, longest_streak, profile_title, avatar_url, country
  FROM public.profiles
  WHERE _ids IS NULL OR id = ANY(_ids)
  ORDER BY full_name
$$;
GRANT EXECUTE ON FUNCTION public.public_profiles(uuid[]) TO anon, authenticated;

-- Highlight reactions
ALTER TABLE public.highlights
  ADD COLUMN IF NOT EXISTS likes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dislikes integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.highlight_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id uuid NOT NULL REFERENCES public.highlights(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('like','dislike')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (highlight_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.highlight_reactions TO authenticated;
GRANT SELECT ON public.highlight_reactions TO anon;
GRANT ALL ON public.highlight_reactions TO service_role;
ALTER TABLE public.highlight_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view highlight reactions" ON public.highlight_reactions;
CREATE POLICY "Anyone can view highlight reactions"
  ON public.highlight_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users manage their own highlight reactions" ON public.highlight_reactions;
CREATE POLICY "Users manage their own highlight reactions"
  ON public.highlight_reactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.sync_highlight_reaction_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target uuid := COALESCE(NEW.highlight_id, OLD.highlight_id);
BEGIN
  UPDATE public.highlights h SET
    likes = (SELECT count(*) FROM public.highlight_reactions r WHERE r.highlight_id = target AND r.reaction = 'like'),
    dislikes = (SELECT count(*) FROM public.highlight_reactions r WHERE r.highlight_id = target AND r.reaction = 'dislike')
  WHERE h.id = target;
  RETURN NULL;
END;$$;
DROP TRIGGER IF EXISTS trg_sync_highlight_reactions ON public.highlight_reactions;
CREATE TRIGGER trg_sync_highlight_reactions
  AFTER INSERT OR UPDATE OR DELETE ON public.highlight_reactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_highlight_reaction_counts();

-- Tournament bracket linkage
ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS result_label text;
ALTER TABLE public.tournament_participants
  ADD COLUMN IF NOT EXISTS is_disqualified boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_tmatch_match_id ON public.tournament_matches(match_id);

CREATE OR REPLACE FUNCTION public.sync_tournament_match_scores()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.tournament_matches tm
    SET score_a = NEW.home_score,
        score_b = NEW.away_score,
        status = CASE WHEN tm.status = 'completed' THEN tm.status ELSE 'live' END,
        updated_at = now()
  WHERE tm.match_id = NEW.id;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS trg_sync_tournament_scores ON public.matches;
CREATE TRIGGER trg_sync_tournament_scores
AFTER UPDATE OF home_score, away_score, status ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.sync_tournament_match_scores();

DROP FUNCTION IF EXISTS public.set_tournament_result(uuid, integer, integer, uuid);
CREATE OR REPLACE FUNCTION public.set_tournament_result(
  _match_id uuid, _score_a integer, _score_b integer, _winner_id uuid,
  _outcome text DEFAULT NULL, _dq_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE m record; loser uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO m FROM public.tournament_matches WHERE id = _match_id FOR UPDATE;
  IF m IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF _winner_id IS NOT NULL AND _winner_id <> m.participant_a_id AND _winner_id <> m.participant_b_id THEN
    RAISE EXCEPTION 'Winner must be one of the two participants';
  END IF;
  UPDATE public.tournament_matches
    SET score_a = _score_a, score_b = _score_b, winner_id = _winner_id,
        result_label = _outcome,
        status = CASE WHEN _winner_id IS NOT NULL THEN 'completed' ELSE 'live' END,
        updated_at = now()
    WHERE id = _match_id;
  IF m.participant_a_id IS NOT NULL THEN
    UPDATE public.tournament_participants SET is_disqualified = false WHERE id = m.participant_a_id;
  END IF;
  IF m.participant_b_id IS NOT NULL THEN
    UPDATE public.tournament_participants SET is_disqualified = false WHERE id = m.participant_b_id;
  END IF;
  IF _winner_id IS NOT NULL THEN
    loser := CASE WHEN _winner_id = m.participant_a_id THEN m.participant_b_id ELSE m.participant_a_id END;
    IF loser IS NOT NULL THEN
      UPDATE public.tournament_participants
        SET is_eliminated = true, eliminated_round = m.round,
            is_disqualified = (loser = _dq_id)
        WHERE id = loser;
    END IF;
    UPDATE public.tournament_participants SET current_round = m.round + 1, is_eliminated = false WHERE id = _winner_id;
    IF m.next_match_id IS NOT NULL THEN
      IF m.next_slot = 'a' THEN
        UPDATE public.tournament_matches SET participant_a_id = _winner_id, updated_at = now() WHERE id = m.next_match_id;
      ELSE
        UPDATE public.tournament_matches SET participant_b_id = _winner_id, updated_at = now() WHERE id = m.next_match_id;
      END IF;
    ELSE
      UPDATE public.tournaments SET champion_id = _winner_id, status = 'completed', updated_at = now() WHERE id = m.tournament_id;
    END IF;
  END IF;
  RETURN jsonb_build_object('ok', true);
END $function$;

-- Link Futures contenders (odds) to real matches with live sync
ALTER TABLE public.odds
  ADD COLUMN IF NOT EXISTS future_match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS future_match_side text,
  ADD COLUMN IF NOT EXISTS future_live_score text,
  ADD COLUMN IF NOT EXISTS future_live_outcome text,
  ADD COLUMN IF NOT EXISTS future_live_opponent text;

CREATE OR REPLACE FUNCTION public.sync_future_contender_scores()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE home_name text; away_name text;
BEGIN
  SELECT COALESCE(NULLIF(trim(p.name), ''), NULLIF(trim(t.name), ''))
    INTO home_name
  FROM (SELECT NEW.home_player_id AS player_id, NEW.home_team_id AS team_id) s
  LEFT JOIN public.players p ON p.id = s.player_id
  LEFT JOIN public.teams t ON t.id = s.team_id;
  SELECT COALESCE(NULLIF(trim(p.name), ''), NULLIF(trim(t.name), ''))
    INTO away_name
  FROM (SELECT NEW.away_player_id AS player_id, NEW.away_team_id AS team_id) s
  LEFT JOIN public.players p ON p.id = s.player_id
  LEFT JOIN public.teams t ON t.id = s.team_id;
  UPDATE public.odds o
  SET
    future_live_score = CASE WHEN o.future_match_side = 'away'
      THEN COALESCE(NEW.away_score,0) || '-' || COALESCE(NEW.home_score,0)
      ELSE COALESCE(NEW.home_score,0) || '-' || COALESCE(NEW.away_score,0) END,
    future_live_opponent = CASE WHEN o.future_match_side = 'away' THEN home_name ELSE away_name END,
    future_live_outcome = CASE
      WHEN NEW.status::text NOT IN ('ended','completed','settled') OR NEW.winner_team_id IS NULL THEN 'pending'
      WHEN (o.future_match_side = 'away' AND NEW.winner_team_id = NEW.away_team_id)
        OR (COALESCE(o.future_match_side,'home') <> 'away' AND NEW.winner_team_id = NEW.home_team_id) THEN 'won'
      ELSE 'lost' END,
    updated_at = now()
  WHERE o.future_match_id = NEW.id;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_future_contender_scores ON public.matches;
CREATE TRIGGER trg_sync_future_contender_scores
AFTER UPDATE OF home_score, away_score, status, winner_team_id ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.sync_future_contender_scores();

UPDATE public.odds o
SET future_live_opponent = CASE
    WHEN o.future_match_side = 'away' THEN COALESCE(NULLIF(trim(hp.name), ''), NULLIF(trim(ht.name), ''))
    ELSE COALESCE(NULLIF(trim(ap.name), ''), NULLIF(trim(at.name), ''))
  END,
  updated_at = now()
FROM public.matches m
LEFT JOIN public.players hp ON hp.id = m.home_player_id
LEFT JOIN public.players ap ON ap.id = m.away_player_id
LEFT JOIN public.teams ht ON ht.id = m.home_team_id
LEFT JOIN public.teams at ON at.id = m.away_team_id
WHERE o.future_match_id = m.id
  AND m.match_kind <> 'future';

REVOKE ALL ON FUNCTION public.sync_future_contender_scores() FROM PUBLIC, anon, authenticated;