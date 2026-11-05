-- Business payout details shown to travelers
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS instapay_address text,
  ADD COLUMN IF NOT EXISTS vodafone_cash_number text,
  ADD COLUMN IF NOT EXISTS payment_instructions text;

-- Fawry voucher tracking on bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS fawry_merchant_ref text,
  ADD COLUMN IF NOT EXISTS fawry_reference_number text,
  ADD COLUMN IF NOT EXISTS fawry_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS fawry_fees numeric(12,2),
  ADD COLUMN IF NOT EXISTS fawry_status text;
CREATE UNIQUE INDEX IF NOT EXISTS bookings_fawry_merchant_ref_key ON public.bookings (fawry_merchant_ref) WHERE fawry_merchant_ref IS NOT NULL;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_method_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('instapay','vodafone_cash','fawry'));

-- Helper (bypasses RLS to avoid policy recursion): does the caller have a booking or verification with this business?
CREATE OR REPLACE FUNCTION public.traveler_linked_to_business(_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.bookings WHERE business_id = _business_id AND traveler_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.verifications WHERE business_id = _business_id AND traveler_user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.traveler_linked_to_business(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.traveler_linked_to_business(uuid) TO authenticated;

DROP POLICY IF EXISTS traveler_read_linked_businesses ON public.businesses;
CREATE POLICY traveler_read_linked_businesses ON public.businesses
  FOR SELECT TO authenticated USING (public.traveler_linked_to_business(id));

-- Helper: is the caller the business that owns this booking?
CREATE OR REPLACE FUNCTION public.owns_booking_business(_booking_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings bk JOIN public.businesses b ON b.id = bk.business_id
    WHERE bk.id = _booking_id AND b.user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.owns_booking_business(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_booking_business(uuid) TO authenticated;

-- Businesses can open payment proofs for their own bookings (path: traveler/booking/file)
DROP POLICY IF EXISTS business_read_booking_payment_proof ON storage.objects;
CREATE POLICY business_read_booking_payment_proof ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
    AND public.owns_booking_business(((storage.foldername(name))[2])::uuid)
  );

-- Guard: payment + Fawry fields only change through the payment workflow functions
CREATE OR REPLACE FUNCTION public.guard_booking_payment_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_admin() THEN
      NEW.payment_status := 'unpaid';
      NEW.paid_at := NULL;
      NEW.payment_reference := NULL;
      NEW.payment_proof_path := NULL;
      NEW.payment_submitted_at := NULL;
      NEW.payment_reviewed_at := NULL;
      NEW.payment_reviewed_by := NULL;
      NEW.payment_rejection_reason := NULL;
      NEW.fawry_merchant_ref := NULL;
      NEW.fawry_reference_number := NULL;
      NEW.fawry_expires_at := NULL;
      NEW.fawry_fees := NULL;
      NEW.fawry_status := NULL;
    END IF;
    RETURN NEW;
  END IF;
  IF (NEW.payment_status IS DISTINCT FROM OLD.payment_status
      OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
      OR NEW.payment_reference IS DISTINCT FROM OLD.payment_reference
      OR NEW.payment_proof_path IS DISTINCT FROM OLD.payment_proof_path
      OR NEW.payment_submitted_at IS DISTINCT FROM OLD.payment_submitted_at
      OR NEW.payment_reviewed_at IS DISTINCT FROM OLD.payment_reviewed_at
      OR NEW.payment_reviewed_by IS DISTINCT FROM OLD.payment_reviewed_by
      OR NEW.payment_rejection_reason IS DISTINCT FROM OLD.payment_rejection_reason
      OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
      OR NEW.fawry_merchant_ref IS DISTINCT FROM OLD.fawry_merchant_ref
      OR NEW.fawry_reference_number IS DISTINCT FROM OLD.fawry_reference_number
      OR NEW.fawry_expires_at IS DISTINCT FROM OLD.fawry_expires_at
      OR NEW.fawry_fees IS DISTINCT FROM OLD.fawry_fees
      OR NEW.fawry_status IS DISTINCT FROM OLD.fawry_status
      OR (NEW.amount IS DISTINCT FROM OLD.amount AND OLD.payment_status IN ('pending_review','paid')))
     AND NOT public.is_admin()
     AND current_setting('app.payment_workflow', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Payment changes must use the payment submission or review workflow';
  END IF;
  RETURN NEW;
END $$;

-- Receipt review: the booking's business or an admin
CREATE OR REPLACE FUNCTION public.review_booking_payment(_booking_id uuid, _decision text, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_admin() OR public.owns_booking_business(_booking_id)) THEN
    RAISE EXCEPTION 'Only the booking business or an admin can review this payment';
  END IF;
  IF _decision NOT IN ('paid','rejected') THEN RAISE EXCEPTION 'Invalid payment decision'; END IF;
  PERFORM set_config('app.payment_workflow', 'on', true);
  UPDATE public.bookings SET payment_status = _decision,
    paid_at = CASE WHEN _decision = 'paid' THEN now() ELSE NULL END,
    payment_reviewed_at = now(), payment_reviewed_by = auth.uid(),
    payment_rejection_reason = CASE WHEN _decision = 'rejected' THEN NULLIF(trim(coalesce(_reason,'')),'') ELSE NULL END,
    status = CASE WHEN _decision = 'paid' AND status = 'pending' THEN 'confirmed' ELSE status END
  WHERE id = _booking_id AND payment_status = 'pending_review';
  IF NOT FOUND THEN RAISE EXCEPTION 'No payment awaiting review for this booking'; END IF;
END $$;

-- Fawry: store a new payment code (server only)
CREATE OR REPLACE FUNCTION public.fawry_attach_voucher(_booking_id uuid, _merchant_ref text, _reference text, _expires_at timestamptz, _fees numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('app.payment_workflow', 'on', true);
  UPDATE public.bookings SET fawry_merchant_ref = _merchant_ref, fawry_reference_number = _reference,
    fawry_expires_at = _expires_at, fawry_fees = _fees, fawry_status = 'UNPAID'
  WHERE id = _booking_id AND payment_status <> 'paid';
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found or already paid'; END IF;
END $$;

-- Fawry: apply a status confirmed by Fawry's API (server only)
CREATE OR REPLACE FUNCTION public.fawry_apply_status(_booking_id uuid, _status text, _fawry_reference text, _fees numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('app.payment_workflow', 'on', true);
  IF _status = 'PAID' THEN
    UPDATE public.bookings SET fawry_status = 'PAID', fawry_fees = COALESCE(_fees, fawry_fees),
      payment_status = 'paid', paid_at = COALESCE(paid_at, now()), payment_method = 'fawry',
      payment_reference = COALESCE(_fawry_reference, fawry_reference_number),
      payment_reviewed_at = now(), payment_reviewed_by = NULL, payment_rejection_reason = NULL,
      status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END
    WHERE id = _booking_id AND payment_status <> 'paid';
  ELSE
    UPDATE public.bookings SET fawry_status = _status WHERE id = _booking_id AND payment_status <> 'paid';
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.fawry_attach_voucher(uuid, text, text, timestamptz, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fawry_apply_status(uuid, text, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fawry_attach_voucher(uuid, text, text, timestamptz, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.fawry_apply_status(uuid, text, text, numeric) TO service_role;
