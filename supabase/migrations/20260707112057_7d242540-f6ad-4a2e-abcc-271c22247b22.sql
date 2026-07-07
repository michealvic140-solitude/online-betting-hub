
-- Homepage-managed sections: popular quick links, gifts tiles, news items, lottery draws
CREATE TABLE public.home_popular_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.home_popular_links TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_popular_links TO authenticated;
GRANT ALL ON public.home_popular_links TO service_role;
ALTER TABLE public.home_popular_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read popular" ON public.home_popular_links FOR SELECT USING (true);
CREATE POLICY "admin manage popular" ON public.home_popular_links FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.home_gifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT,
  link_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.home_gifts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_gifts TO authenticated;
GRANT ALL ON public.home_gifts TO service_role;
ALTER TABLE public.home_gifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read gifts" ON public.home_gifts FOR SELECT USING (true);
CREATE POLICY "admin manage gifts" ON public.home_gifts FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.home_news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  image_url TEXT,
  link_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.home_news TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_news TO authenticated;
GRANT ALL ON public.home_news TO service_role;
ALTER TABLE public.home_news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read news" ON public.home_news FOR SELECT USING (true);
CREATE POLICY "admin manage news" ON public.home_news FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.home_lottery_draws (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  prize_label TEXT NOT NULL,
  numbers TEXT,
  draws_at TIMESTAMPTZ,
  results TEXT,
  buy_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.home_lottery_draws TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_lottery_draws TO authenticated;
GRANT ALL ON public.home_lottery_draws TO service_role;
ALTER TABLE public.home_lottery_draws ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read lottery" ON public.home_lottery_draws FOR SELECT USING (true);
CREATE POLICY "admin manage lottery" ON public.home_lottery_draws FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
