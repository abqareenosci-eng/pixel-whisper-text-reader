-- Payment proof submission and admin review.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_proof_path text,
  ADD COLUMN IF NOT EXISTS payment_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_reviewed_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS payment_rejection_reason text;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status IN ('unpaid','pending_review','paid','rejected','refunded'));

CREATE OR REPLACE FUNCTION public.submit_booking_payment(
  _booking_id uuid,
  _method text,
  _reference text,
  _proof_path text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bk public.bookings;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF _method NOT IN ('instapay','vodafone_cash') THEN RAISE EXCEPTION 'Unsupported payment method'; END IF;
  IF length(trim(coalesce(_reference,''))) < 4 THEN RAISE EXCEPTION 'Enter a valid transaction reference'; END IF;
  IF _proof_path IS NULL OR _proof_path NOT LIKE auth.uid()::text || '/' || _booking_id::text || '/%' THEN
    RAISE EXCEPTION 'Invalid payment proof path';
  END IF;
  SELECT * INTO bk FROM public.bookings WHERE id = _booking_id FOR UPDATE;
  IF bk.id IS NULL OR bk.traveler_user_id <> auth.uid() THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF bk.payment_status = 'paid' THEN RAISE EXCEPTION 'This booking is already marked as paid'; END IF;
  IF bk.status = 'cancelled' THEN RAISE EXCEPTION 'Cancelled bookings cannot receive payments'; END IF;
  PERFORM set_config('app.payment_workflow', 'on', true);
  UPDATE public.bookings SET payment_method = _method, payment_reference = trim(_reference),
    payment_proof_path = _proof_path, payment_status = 'pending_review',
    payment_submitted_at = now(), payment_reviewed_at = NULL, payment_reviewed_by = NULL,
    payment_rejection_reason = NULL, paid_at = NULL
  WHERE id = _booking_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.submit_booking_payment(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_booking_payment(uuid,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_booking_payment(_booking_id uuid, _decision text, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
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
REVOKE EXECUTE ON FUNCTION public.review_booking_payment(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_booking_payment(uuid,text,text) TO authenticated;

-- Private bucket policies: travelers upload only to their own user/booking folder; admins can review proofs.
DROP POLICY IF EXISTS "traveler_upload_own_payment_proof" ON storage.objects;
CREATE POLICY "traveler_upload_own_payment_proof" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "traveler_read_own_payment_proof" ON storage.objects;
CREATE POLICY "traveler_read_own_payment_proof" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment-proofs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
DROP POLICY IF EXISTS "traveler_delete_own_payment_proof" ON storage.objects;
CREATE POLICY "traveler_delete_own_payment_proof" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'payment-proofs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
DROP POLICY IF EXISTS "admin_delete_payment_proof" ON storage.objects;
CREATE POLICY "admin_delete_payment_proof" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'payment-proofs' AND public.is_admin());

-- Block businesses/travelers from changing payment state directly through table updates.
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
      OR NEW.payment_method IS DISTINCT FROM OLD.payment_method)
     AND NOT public.is_admin()
     AND current_setting('app.payment_workflow', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Payment changes must use the payment submission or admin review workflow';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bookings_guard_payment_fields ON public.bookings;
CREATE TRIGGER bookings_guard_payment_fields
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.guard_booking_payment_fields();