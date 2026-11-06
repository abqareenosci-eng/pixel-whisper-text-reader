-- ===== 1. Business wallet (simulated money: 500 EGP start, 5 EGP per successful verification) =====
ALTER TABLE public.businesses ADD COLUMN wallet_balance numeric(12,2) NOT NULL DEFAULT 500;

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('top_up','verification_fee')),
  amount numeric(12,2) NOT NULL,
  balance_after numeric(12,2) NOT NULL,
  verification_id uuid REFERENCES public.verifications(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_own_wallet_transactions" ON public.wallet_transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = wallet_transactions.business_id AND b.user_id = auth.uid()) OR public.is_admin());
CREATE INDEX wallet_transactions_business_idx ON public.wallet_transactions (business_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.guard_business_wallet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('app.wallet_workflow', true) = 'on' OR public.is_admin() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.wallet_balance := 500;
    RETURN NEW;
  END IF;
  IF NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance THEN
    RAISE EXCEPTION 'Wallet balance can only change through top-ups or verifications';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER businesses_guard_wallet BEFORE INSERT OR UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.guard_business_wallet();

CREATE OR REPLACE FUNCTION public.wallet_top_up(_amount numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE biz public.businesses; newbal numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'business') THEN RAISE EXCEPTION 'Only business accounts have a wallet'; END IF;
  IF _amount IS NULL OR _amount < 50 OR _amount > 10000 THEN RAISE EXCEPTION 'Top-up amount must be between 50 and 10,000 EGP'; END IF;
  SELECT * INTO biz FROM public.businesses WHERE user_id = auth.uid() LIMIT 1;
  IF biz.id IS NULL THEN RAISE EXCEPTION 'Set up your business profile first'; END IF;
  PERFORM set_config('app.wallet_workflow', 'on', true);
  UPDATE public.businesses SET wallet_balance = wallet_balance + round(_amount, 2) WHERE id = biz.id RETURNING wallet_balance INTO newbal;
  PERFORM set_config('app.wallet_workflow', 'off', true);
  INSERT INTO public.wallet_transactions (business_id, kind, amount, balance_after, note)
    VALUES (biz.id, 'top_up', round(_amount, 2), newbal, 'Test top-up (no real money)');
  RETURN newbal;
END $$;
REVOKE ALL ON FUNCTION public.wallet_top_up(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wallet_top_up(numeric) TO authenticated;

-- verify_traveler_qr now charges 5 EGP from the wallet for each successful verification
CREATE OR REPLACE FUNCTION public.verify_traveler_qr(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE biz public.businesses; idn public.identities; prof public.profiles; vid uuid; newbal numeric;
  fee constant numeric := 5;
  clean text := trim(both from coalesce(_token,''));
BEGIN
  IF NOT public.has_role(auth.uid(), 'business') THEN RAISE EXCEPTION 'Only business accounts can verify travelers'; END IF;
  SELECT * INTO biz FROM public.businesses WHERE user_id = auth.uid() LIMIT 1;
  IF biz.id IS NULL THEN RAISE EXCEPTION 'Set up your business profile first'; END IF;
  IF biz.wallet_balance < fee THEN
    RAISE EXCEPTION 'Your wallet balance is too low (each verification costs 5 EGP). Top up your wallet to keep verifying travelers.';
  END IF;
  clean := COALESCE(substring(clean from '([a-f0-9]{32})'), clean);
  SELECT * INTO idn FROM public.identities WHERE qr_token = clean LIMIT 1;
  IF idn.id IS NULL OR idn.status <> 'active' THEN
    INSERT INTO public.verifications (business_id, qr_token_scanned, result)
      VALUES (biz.id, left(clean, 200), 'not_found');
    RETURN jsonb_build_object('status', 'not_found', 'wallet_balance', biz.wallet_balance);
  END IF;
  SELECT * INTO prof FROM public.profiles WHERE id = idn.user_id;
  INSERT INTO public.verifications (business_id, traveler_user_id, identity_id, qr_token_scanned, result, verified_fields)
    VALUES (biz.id, idn.user_id, idn.id, clean, 'verified',
      '{"full_name":true,"nationality":true,"passport_number":true,"date_of_birth":true}'::jsonb)
    RETURNING id INTO vid;
  PERFORM set_config('app.wallet_workflow', 'on', true);
  UPDATE public.businesses SET wallet_balance = wallet_balance - fee WHERE id = biz.id RETURNING wallet_balance INTO newbal;
  PERFORM set_config('app.wallet_workflow', 'off', true);
  INSERT INTO public.wallet_transactions (business_id, kind, amount, balance_after, verification_id, note)
    VALUES (biz.id, 'verification_fee', -fee, newbal, vid, 'Traveler verification');
  RETURN jsonb_build_object('status','found','verification_id', vid, 'wallet_balance', newbal, 'fee', fee,
    'identity', jsonb_build_object('id', idn.id, 'user_id', idn.user_id, 'full_name', idn.full_name,
      'nationality', idn.nationality, 'passport_number', idn.passport_number, 'passport_type', idn.passport_type,
      'date_of_birth', idn.date_of_birth, 'gender', idn.gender, 'place_of_birth', idn.place_of_birth,
      'issue_date', idn.issue_date, 'expiry_date', idn.expiry_date, 'issuing_country', idn.issuing_country,
      'document_type', idn.document_type, 'status', idn.status, 'verified', idn.verified,
      'qr_token', '', 'created_at', idn.created_at, 'updated_at', idn.updated_at),
    'traveler', jsonb_build_object('id', prof.id, 'full_name', prof.full_name, 'role', prof.role,
      'avatar_url', prof.avatar_url, 'phone', null, 'created_at', prof.created_at));
END $$;
REVOKE EXECUTE ON FUNCTION public.verify_traveler_qr(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_traveler_qr(text) TO authenticated;

-- ===== 2. Bookable offers + simulated in-app checkout =====
CREATE TABLE public.travel_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title text NOT NULL,
  service_type text NOT NULL DEFAULT 'other' CHECK (service_type IN ('flight','hotel','car_rental','tour','cruise','other')),
  origin text,
  destination text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price > 0),
  currency text NOT NULL DEFAULT 'EGP',
  nights integer CHECK (nights IS NULL OR nights BETWEEN 1 AND 60),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.travel_offers TO authenticated;
GRANT ALL ON public.travel_offers TO service_role;
ALTER TABLE public.travel_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_active_offers" ON public.travel_offers FOR SELECT TO authenticated
  USING (active OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = travel_offers.business_id AND b.user_id = auth.uid()) OR public.is_admin());
CREATE POLICY "insert_own_offers" ON public.travel_offers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = travel_offers.business_id AND b.user_id = auth.uid()));
CREATE POLICY "update_own_offers" ON public.travel_offers FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = travel_offers.business_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = travel_offers.business_id AND b.user_id = auth.uid()));
CREATE POLICY "delete_own_offers" ON public.travel_offers FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = travel_offers.business_id AND b.user_id = auth.uid()));

-- Offers with the business display name (travelers cannot read the businesses table directly)
CREATE OR REPLACE FUNCTION public.list_travel_offers()
RETURNS TABLE (id uuid, business_id uuid, business_name text, business_type text, city text, country text,
  title text, service_type text, origin text, destination text, description text, price numeric, currency text, nights integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.business_id, b.business_name, b.business_type, b.city, b.country,
    o.title, o.service_type, o.origin, o.destination, o.description, o.price, o.currency, o.nights
  FROM public.travel_offers o JOIN public.businesses b ON b.id = o.business_id
  WHERE o.active AND auth.uid() IS NOT NULL
  ORDER BY o.created_at;
$$;
REVOKE ALL ON FUNCTION public.list_travel_offers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_travel_offers() TO authenticated;

ALTER TABLE public.bookings
  ADD COLUMN offer_id uuid REFERENCES public.travel_offers(id) ON DELETE SET NULL,
  ADD COLUMN checkout_method text CHECK (checkout_method IS NULL OR checkout_method IN ('card','vodafone_cash')),
  ADD COLUMN checkout_reference text,
  ADD COLUMN checkout_payer_hint text,
  ADD COLUMN checkout_paid_at timestamptz;
COMMENT ON COLUMN public.bookings.checkout_method IS 'Simulated in-app checkout method. No money is charged; real payments use payment_* columns.';

CREATE OR REPLACE FUNCTION public.guard_booking_checkout_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('app.checkout_workflow', true) = 'on' OR public.is_admin() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.checkout_method := NULL; NEW.checkout_reference := NULL; NEW.checkout_payer_hint := NULL; NEW.checkout_paid_at := NULL;
    RETURN NEW;
  END IF;
  IF NEW.checkout_method IS DISTINCT FROM OLD.checkout_method
     OR NEW.checkout_reference IS DISTINCT FROM OLD.checkout_reference
     OR NEW.checkout_payer_hint IS DISTINCT FROM OLD.checkout_payer_hint
     OR NEW.checkout_paid_at IS DISTINCT FROM OLD.checkout_paid_at THEN
    RAISE EXCEPTION 'Checkout details can only be set by the checkout';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bookings_guard_checkout BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.guard_booking_checkout_fields();

CREATE OR REPLACE FUNCTION public.checkout_book_offer(_offer_id uuid, _start_date date, _method text, _payer_hint text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.travel_offers; idn_id uuid; bk public.bookings;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(auth.uid(), 'traveler') THEN RAISE EXCEPTION 'Only traveler accounts can book trips'; END IF;
  IF _method IS NULL OR _method NOT IN ('card','vodafone_cash') THEN RAISE EXCEPTION 'Choose Credit Card or Vodafone Cash'; END IF;
  IF _start_date IS NULL OR _start_date < current_date OR _start_date > current_date + 730 THEN
    RAISE EXCEPTION 'Choose a travel date from today onward';
  END IF;
  SELECT * INTO o FROM public.travel_offers WHERE id = _offer_id AND active;
  IF o.id IS NULL THEN RAISE EXCEPTION 'This offer is no longer available'; END IF;
  SELECT id INTO idn_id FROM public.identities WHERE user_id = auth.uid() ORDER BY created_at DESC LIMIT 1;
  PERFORM set_config('app.checkout_workflow', 'on', true);
  INSERT INTO public.bookings (business_id, traveler_user_id, identity_id, service_type, origin, destination,
      start_date, end_date, status, notes, amount, currency, offer_id,
      checkout_method, checkout_reference, checkout_payer_hint, checkout_paid_at)
    VALUES (o.business_id, auth.uid(), idn_id, o.service_type, o.origin, o.destination,
      _start_date, CASE WHEN o.nights IS NOT NULL THEN _start_date + o.nights END, 'confirmed', o.title, o.price, o.currency, o.id,
      _method, 'TEST-' || upper(encode(extensions.gen_random_bytes(4), 'hex')), left(coalesce(_payer_hint, ''), 24), now())
    RETURNING * INTO bk;
  PERFORM set_config('app.checkout_workflow', 'off', true);
  RETURN jsonb_build_object('booking_id', bk.id, 'booking_reference', bk.booking_reference,
    'status', bk.status, 'checkout_reference', bk.checkout_reference, 'start_date', bk.start_date, 'end_date', bk.end_date);
END $$;
REVOKE ALL ON FUNCTION public.checkout_book_offer(uuid, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkout_book_offer(uuid, date, text, text) TO authenticated;

-- ===== 3. Hotel PMS integration (simulated; only the last characters of the key are kept) =====
CREATE TABLE public.business_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('hotel_pms')),
  key_hint text NOT NULL DEFAULT '' CHECK (char_length(key_hint) <= 8),
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected','disconnected')),
  connected_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_integrations TO authenticated;
GRANT ALL ON public.business_integrations TO service_role;
ALTER TABLE public.business_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_own_integrations" ON public.business_integrations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_integrations.business_id AND b.user_id = auth.uid()) OR public.is_admin());
CREATE POLICY "insert_own_integrations" ON public.business_integrations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_integrations.business_id AND b.user_id = auth.uid()));
CREATE POLICY "update_own_integrations" ON public.business_integrations FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_integrations.business_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_integrations.business_id AND b.user_id = auth.uid()));
CREATE POLICY "delete_own_integrations" ON public.business_integrations FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_integrations.business_id AND b.user_id = auth.uid()));

-- ===== 4. Send traveler info to partners + confirmations (simulated partners) =====
CREATE TABLE public.partner_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  traveler_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  identity_id uuid REFERENCES public.identities(id) ON DELETE SET NULL,
  partner text NOT NULL CHECK (partner IN ('skyline_hotel','nile_cruise','egyptair')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  UNIQUE (business_id, traveler_user_id, partner)
);
GRANT SELECT ON public.partner_shares TO authenticated;
GRANT ALL ON public.partner_shares TO service_role;
ALTER TABLE public.partner_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_own_partner_shares" ON public.partner_shares FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = partner_shares.business_id AND b.user_id = auth.uid()) OR public.is_admin());

CREATE OR REPLACE FUNCTION public.send_traveler_to_partners(_traveler_user_id uuid, _partners text[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE biz public.businesses; idn_id uuid; p text; n integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'business') THEN RAISE EXCEPTION 'Only business accounts can send traveler information'; END IF;
  SELECT * INTO biz FROM public.businesses WHERE user_id = auth.uid() LIMIT 1;
  IF biz.id IS NULL THEN RAISE EXCEPTION 'Set up your business profile first'; END IF;
  IF _partners IS NULL OR coalesce(array_length(_partners, 1), 0) = 0 THEN RAISE EXCEPTION 'Choose at least one partner'; END IF;
  IF NOT (EXISTS (SELECT 1 FROM public.verifications v WHERE v.business_id = biz.id AND v.traveler_user_id = _traveler_user_id AND v.result = 'verified')
       OR EXISTS (SELECT 1 FROM public.bookings bk WHERE bk.business_id = biz.id AND bk.traveler_user_id = _traveler_user_id)) THEN
    RAISE EXCEPTION 'You can only send travelers you have verified or booked';
  END IF;
  SELECT id INTO idn_id FROM public.identities WHERE user_id = _traveler_user_id ORDER BY created_at DESC LIMIT 1;
  FOREACH p IN ARRAY _partners LOOP
    IF p NOT IN ('skyline_hotel','nile_cruise','egyptair') THEN RAISE EXCEPTION 'Unknown partner: %', p; END IF;
    INSERT INTO public.partner_shares (business_id, traveler_user_id, identity_id, partner)
      VALUES (biz.id, _traveler_user_id, idn_id, p)
      ON CONFLICT (business_id, traveler_user_id, partner)
      DO UPDATE SET status = 'pending', sent_at = now(), confirmed_at = NULL, identity_id = EXCLUDED.identity_id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.send_traveler_to_partners(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_traveler_to_partners(uuid, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_partner_share(_share_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.partner_shares s SET status = 'confirmed', confirmed_at = now()
    WHERE s.id = _share_id
      AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = s.business_id AND b.user_id = auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'Confirmation not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.confirm_partner_share(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_partner_share(uuid) TO authenticated;

-- ===== 5. Document type: passport, national ID or identification card =====
ALTER TABLE public.identities ADD CONSTRAINT identities_document_type_check
  CHECK (document_type IN ('passport','national_id','id_card','other')) NOT VALID;