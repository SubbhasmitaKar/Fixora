
-- ROLES
CREATE TYPE public.app_role AS ENUM ('user', 'provider', 'admin');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "roles_select_own" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- SERVICES
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL DEFAULT 'Fixora Partner',
  provider_bio TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  location TEXT NOT NULL DEFAULT '',
  rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  bookings_count INTEGER NOT NULL DEFAULT 0,
  featured BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_public_read" ON public.services FOR SELECT USING (true);
CREATE POLICY "services_provider_insert" ON public.services FOR INSERT TO authenticated
  WITH CHECK (provider_id = auth.uid() AND public.has_role(auth.uid(), 'provider'));
CREATE POLICY "services_provider_update" ON public.services FOR UPDATE TO authenticated
  USING (provider_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (provider_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "services_provider_delete" ON public.services FOR DELETE TO authenticated
  USING (provider_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- BOOKINGS
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  booking_date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','completed','cancelled')),
  notes TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission NUMERIC(10,2) NOT NULL DEFAULT 0,
  provider_earnings NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bookings_no_double_booking
  ON public.bookings (service_id, booking_date, time_slot)
  WHERE status IN ('pending','accepted','completed');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings_select" ON public.bookings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR provider_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "bookings_insert_own" ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "bookings_update" ON public.bookings FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR provider_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR provider_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "bookings_admin_delete" ON public.bookings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- REVIEWS
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT 'Customer',
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, service_id)
);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_public_read" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert_own" ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "reviews_update_own" ON public.reviews FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "reviews_delete_own" ON public.reviews FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- TRIGGERS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, name, email, location)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'location', '')
  )
  ON CONFLICT (id) DO NOTHING;

  BEGIN
    _role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'user')::public.app_role;
  EXCEPTION WHEN others THEN
    _role := 'user';
  END;
  IF _role = 'admin' THEN _role := 'user'; END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.refresh_service_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sid UUID := COALESCE(NEW.service_id, OLD.service_id);
BEGIN
  UPDATE public.services s
  SET rating = COALESCE((SELECT ROUND(AVG(r.rating)::numeric, 2) FROM public.reviews r WHERE r.service_id = _sid), 0),
      review_count = (SELECT COUNT(*) FROM public.reviews r WHERE r.service_id = _sid)
  WHERE s.id = _sid;
  RETURN NULL;
END;
$$;

CREATE TRIGGER reviews_refresh_rating
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.refresh_service_rating();

CREATE OR REPLACE FUNCTION public.handle_booking_write()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _price NUMERIC(10,2);
  _provider UUID;
BEGIN
  SELECT price, provider_id INTO _price, _provider FROM public.services WHERE id = NEW.service_id;
  IF TG_OP = 'INSERT' THEN
    NEW.price := COALESCE(_price, 0);
    NEW.provider_id := _provider;
    NEW.commission := ROUND(COALESCE(_price, 0) * 0.10, 2);
    NEW.provider_earnings := COALESCE(_price, 0) - ROUND(COALESCE(_price, 0) * 0.10, 2);
    UPDATE public.services SET bookings_count = bookings_count + 1 WHERE id = NEW.service_id;
  ELSE
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_before_write
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.handle_booking_write();

-- SEED DEMO SERVICES
INSERT INTO public.services (title, category, description, price, location, provider_name, provider_bio, rating, review_count, bookings_count, featured) VALUES
('Emergency Electrical Repair','Electrician','Same-day fault finding, wiring repair and safety checks for homes and small offices.',799,'Bengaluru','Ravi Kumar','Licensed electrician with 12 years of residential and commercial experience.',4.8,124,310,true),
('Full Home Wiring & Inspection','Electrician','Complete wiring audit, load balancing and certification for apartments and villas.',2499,'Hyderabad','Anil Verma','ISO-certified electrical contractor serving Hyderabad since 2011.',4.6,58,140,false),
('Leak & Tap Repair','Plumber','Fix dripping taps, leaking pipes and blocked drains with a 30-day workmanship warranty.',549,'Mumbai','Suresh Patil','Trusted neighbourhood plumber, 2000+ jobs completed.',4.7,201,520,true),
('Bathroom Fitting Installation','Plumber','Installation of showers, geysers, basins and concealed plumbing lines.',1899,'Pune','Deepak Shinde','Specialist in modern bathroom fittings and waterproofing.',4.5,73,190,false),
('Mathematics Tutoring (Grades 9-12)','Tutor','Concept-first coaching for board exams and JEE foundation, online or at home.',699,'Delhi','Neha Sharma','M.Sc Mathematics, 8 years of board and competitive exam coaching.',4.9,312,860,true),
('Spoken English & Interview Prep','Tutor','Fluency drills, accent neutralisation and mock interviews for job seekers.',899,'Bengaluru','Arjun Menon','CELTA-certified trainer, ex-corporate communications coach.',4.7,145,400,false),
('Bridal Makeup & Styling','Beautician','HD bridal makeup, draping and hairstyling with premium products at your venue.',4999,'Jaipur','Priya Rathore','Celebrity makeup artist with 300+ bridal assignments.',4.9,89,150,true),
('Salon at Home — Hair & Skin','Beautician','Haircut, facial, waxing and threading delivered at your doorstep.',1299,'Chennai','Lakshmi Iyer','Certified cosmetologist running a mobile salon team.',4.4,167,430,false),
('Deep Home Cleaning','Cleaner','Kitchen, bathroom and floor deep clean with eco-friendly chemicals.',2199,'Mumbai','SparkleCrew','Insured 4-person cleaning crew with hospital-grade equipment.',4.6,254,700,true),
('Sofa & Carpet Shampooing','Cleaner','Foam-based upholstery cleaning that removes stains, dust mites and odour.',1099,'Delhi','FreshNest Services','Upholstery care specialists using imported machines.',4.3,96,220,false),
('AC Service & Gas Refill','AC Technician','Split and window AC servicing, gas top-up and cooling performance check.',899,'Hyderabad','CoolFix Team','Factory-trained HVAC technicians, all brands supported.',4.7,188,610,true),
('AC Installation & Uninstallation','AC Technician','Safe mounting, copper piping and stabiliser setup with warranty-safe handling.',1499,'Pune','Mahesh Rao','HVAC installer with 9 years of field experience.',4.5,64,175,false),
('Custom Furniture Carpentry','Carpenter','Wardrobes, shelves and modular units built to your measurements.',3499,'Bengaluru','WoodWorks Studio','Bespoke carpentry workshop specialising in modular interiors.',4.8,47,110,false),
('Furniture Repair & Polishing','Carpenter','Hinge, drawer and joint repairs plus melamine polishing for old furniture.',999,'Chennai','Karthik Raj','Third-generation carpenter with a focus on restoration.',4.4,112,290,false);
