ALTER TABLE public.profiles
  ADD COLUMN profession text NOT NULL DEFAULT '',
  ADD COLUMN working_days smallint[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5]::smallint[],
  ADD COLUMN working_hours_start time NOT NULL DEFAULT '09:00',
  ADD COLUMN working_hours_end time NOT NULL DEFAULT '18:00',
  ADD COLUMN slot_duration_minutes smallint NOT NULL DEFAULT 60;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_working_days_valid
    CHECK (
      cardinality(working_days) > 0
      AND working_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[]
    ),
  ADD CONSTRAINT profiles_working_hours_valid
    CHECK (working_hours_end > working_hours_start),
  ADD CONSTRAINT profiles_slot_duration_valid
    CHECK (slot_duration_minutes IN (30, 45, 60, 90, 120));

ALTER TABLE public.bookings
  ADD COLUMN customer_name text NOT NULL DEFAULT '',
  ADD COLUMN customer_email text NOT NULL DEFAULT '',
  ADD COLUMN customer_phone text NOT NULL DEFAULT '',
  ADD COLUMN service_address text NOT NULL DEFAULT '';
