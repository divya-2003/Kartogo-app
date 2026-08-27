INSERT INTO public.partner_markets (name, address, phone, lat, lng, notes, is_active)
SELECT v.name, v.address, v.phone, v.lat, v.lng, v.notes, true
FROM (VALUES
  ('Kartogo Dark Store — Magunta Layout', 'Magunta Layout, Ongole, Andhra Pradesh 523002', '9110310034', 15.5057::double precision, 80.0499::double precision, 'Primary dark store / pickup hub'),
  ('Kartogo Partner Mart — Kurnool Road', 'Kurnool Road, Ongole, Andhra Pradesh 523002', '9110310034', 15.4989::double precision, 80.0402::double precision, 'Partner supermarket'),
  ('Kartogo Partner Mart — Trunk Road', 'Trunk Road, Ongole, Andhra Pradesh 523001', '9110310034', 15.5045::double precision, 80.0490::double precision, 'Partner supermarket')
) AS v(name, address, phone, lat, lng, notes)
WHERE NOT EXISTS (SELECT 1 FROM public.partner_markets pm WHERE pm.name = v.name);