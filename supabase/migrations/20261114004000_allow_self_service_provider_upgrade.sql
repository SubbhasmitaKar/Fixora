CREATE OR REPLACE FUNCTION public.become_provider()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF public.has_role(_user_id, 'admin') THEN
    RAISE EXCEPTION 'Administrators cannot change their role';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = _user_id AND role = 'user';

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'provider')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.become_provider() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.become_provider() TO authenticated;
