CREATE TABLE public.provider_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','booked','unavailable')),
  booking_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, slot_date, start_time)
);

GRANT SELECT ON public.provider_slots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_slots TO authenticated;
GRANT ALL ON public.provider_slots TO service_role;

ALTER TABLE public.provider_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY slots_public_read ON public.provider_slots FOR SELECT USING (true);
CREATE POLICY slots_provider_insert ON public.provider_slots FOR INSERT TO authenticated
  WITH CHECK (provider_id = auth.uid() AND public.has_role(auth.uid(), 'provider'));
CREATE POLICY slots_provider_update ON public.provider_slots FOR UPDATE TO authenticated
  USING (provider_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (provider_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY slots_provider_delete ON public.provider_slots FOR DELETE TO authenticated
  USING ((provider_id = auth.uid() AND status <> 'booked') OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER provider_slots_updated_at BEFORE UPDATE ON public.provider_slots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_provider_slots_lookup ON public.provider_slots (provider_id, slot_date, status);

ALTER TABLE public.bookings
  ADD COLUMN slot_id uuid REFERENCES public.provider_slots(id) ON DELETE SET NULL,
  ADD COLUMN user_lat double precision,
  ADD COLUMN user_lng double precision,
  ADD COLUMN provider_lat double precision,
  ADD COLUMN provider_lng double precision,
  ADD COLUMN eta_minutes integer,
  ADD COLUMN tracking_active boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX idx_bookings_slot_unique ON public.bookings (slot_id) WHERE slot_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_booking_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _price NUMERIC(10,2);
  _provider UUID;
  _slot public.provider_slots%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT price, provider_id INTO _price, _provider FROM public.services WHERE id = NEW.service_id;
    NEW.price := COALESCE(_price, 0);
    NEW.provider_id := _provider;
    NEW.commission := ROUND(COALESCE(_price, 0) * 0.10, 2);
    NEW.provider_earnings := COALESCE(_price, 0) - ROUND(COALESCE(_price, 0) * 0.10, 2);

    IF NEW.slot_id IS NOT NULL THEN
      SELECT * INTO _slot FROM public.provider_slots WHERE id = NEW.slot_id FOR UPDATE;
      IF _slot.id IS NULL THEN RAISE EXCEPTION 'Slot no longer exists'; END IF;
      IF _slot.status <> 'available' THEN RAISE EXCEPTION 'Slot already booked'; END IF;
      NEW.booking_date := _slot.slot_date;
      NEW.time_slot := to_char(_slot.start_time, 'HH24:MI') || ' - ' || to_char(_slot.end_time, 'HH24:MI');
      UPDATE public.provider_slots SET status = 'booked', booking_id = NEW.id WHERE id = NEW.slot_id;
    END IF;

    UPDATE public.services SET bookings_count = bookings_count + 1 WHERE id = NEW.service_id;
  ELSE
    NEW.updated_at := now();

    IF NEW.slot_id IS DISTINCT FROM OLD.slot_id THEN
      IF OLD.slot_id IS NOT NULL THEN
        UPDATE public.provider_slots SET status = 'available', booking_id = NULL
        WHERE id = OLD.slot_id AND booking_id = OLD.id;
      END IF;
      IF NEW.slot_id IS NOT NULL THEN
        SELECT * INTO _slot FROM public.provider_slots WHERE id = NEW.slot_id FOR UPDATE;
        IF _slot.id IS NULL THEN RAISE EXCEPTION 'Slot no longer exists'; END IF;
        IF _slot.status <> 'available' THEN RAISE EXCEPTION 'Slot already booked'; END IF;
        NEW.booking_date := _slot.slot_date;
        NEW.time_slot := to_char(_slot.start_time, 'HH24:MI') || ' - ' || to_char(_slot.end_time, 'HH24:MI');
        UPDATE public.provider_slots SET status = 'booked', booking_id = NEW.id WHERE id = NEW.slot_id;
      END IF;
    END IF;

    IF NEW.status IN ('cancelled','rejected','completed') AND OLD.status <> NEW.status AND NEW.slot_id IS NOT NULL THEN
      IF NEW.status IN ('cancelled','rejected') THEN
        UPDATE public.provider_slots SET status = 'available', booking_id = NULL
        WHERE id = NEW.slot_id AND booking_id = NEW.id;
        NEW.slot_id := NULL;
      END IF;
      NEW.tracking_active := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.provider_slots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
ALTER TABLE public.provider_slots REPLICA IDENTITY FULL;