
CREATE TABLE public.mp_categories (
  slug text PRIMARY KEY,
  name text NOT NULL,
  group_key text NOT NULL,
  icon text NOT NULL DEFAULT '🛍️',
  image_url text,
  behavior text NOT NULL DEFAULT 'PRODUCT',
  legacy_categories text[] NOT NULL DEFAULT '{}',
  sort int NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  is_popular boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mp_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  partner_type text NOT NULL,
  description text,
  category_slugs text[] NOT NULL DEFAULT '{}',
  rating numeric(2,1) NOT NULL DEFAULT 4.5,
  review_count int NOT NULL DEFAULT 0,
  distance_km numeric(4,1),
  opens_at time,
  closes_at time,
  address text,
  service_area text,
  service_modes text[] NOT NULL DEFAULT '{}',
  photos text[] NOT NULL DEFAULT '{}',
  icon text NOT NULL DEFAULT '🏪',
  supplier_phone text,
  partner_market_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mp_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.mp_partners(id) ON DELETE CASCADE,
  category_slug text NOT NULL REFERENCES public.mp_categories(slug),
  listing_type text NOT NULL,
  transaction_type text NOT NULL,
  name text NOT NULL,
  description text,
  images text[] NOT NULL DEFAULT '{}',
  icon text NOT NULL DEFAULT '✨',
  price numeric(10,2),
  mrp numeric(10,2),
  starting_price numeric(10,2),
  duration_min int,
  includes text[] NOT NULL DEFAULT '{}',
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  packages jsonb NOT NULL DEFAULT '[]'::jsonb,
  service_modes text[] NOT NULL DEFAULT '{}',
  home_service_fee numeric(10,2) NOT NULL DEFAULT 0,
  rating numeric(2,1) NOT NULL DEFAULT 4.5,
  review_count int NOT NULL DEFAULT 0,
  service_area text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mp_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.mp_partners(id) ON DELETE CASCADE,
  name text NOT NULL,
  title text,
  photo_url text,
  rating numeric(2,1) NOT NULL DEFAULT 4.6,
  is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.mp_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code text UNIQUE NOT NULL,
  customer_phone text NOT NULL,
  customer_name text,
  partner_id uuid NOT NULL REFERENCES public.mp_partners(id),
  listing_id uuid REFERENCES public.mp_listings(id),
  transaction_type text NOT NULL,
  service_mode text,
  staff_id uuid REFERENCES public.mp_staff(id),
  booking_date date,
  start_time time,
  end_time time,
  address jsonb,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  fee numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'BOOKING_REQUESTED',
  quote_amount numeric(10,2),
  quote_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX mp_bookings_no_double ON public.mp_bookings (staff_id, booking_date, start_time)
  WHERE staff_id IS NOT NULL AND status NOT IN ('CANCELLED');
CREATE INDEX mp_bookings_customer ON public.mp_bookings (customer_phone, created_at DESC);
CREATE INDEX mp_bookings_partner ON public.mp_bookings (partner_id, booking_date);
CREATE TABLE public.mp_booking_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.mp_bookings(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mp_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_phone, entity_type, entity_id)
);
CREATE TABLE public.mp_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES public.mp_partners(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.mp_listings(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mp_home_sections (
  key text PRIMARY KEY,
  title text NOT NULL,
  is_visible boolean NOT NULL DEFAULT true,
  sort int NOT NULL DEFAULT 100
);

GRANT SELECT ON public.mp_categories, public.mp_partners, public.mp_listings, public.mp_staff, public.mp_reviews, public.mp_home_sections TO anon, authenticated;
GRANT ALL ON public.mp_categories, public.mp_partners, public.mp_listings, public.mp_staff, public.mp_reviews, public.mp_home_sections, public.mp_bookings, public.mp_booking_status_history, public.mp_favorites TO service_role;

ALTER TABLE public.mp_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mp_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mp_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mp_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mp_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mp_home_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mp_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mp_booking_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mp_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads active categories" ON public.mp_categories FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "Public reads active partners" ON public.mp_partners FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "Public reads active listings" ON public.mp_listings FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "Public reads active staff" ON public.mp_staff FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "Public reads reviews" ON public.mp_reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public reads home sections" ON public.mp_home_sections FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.mp_home_sections (key, title, sort) VALUES
('popular_categories','What are you looking for?',10),('popular_near_you','Popular Near You',20),('offers_near_you','Offers Near You',30),
('recommended','Recommended for You',40),('recently_viewed','Recently Viewed',50),('buy_again','Buy Again',60),
('trending_services','Trending Services',70),('new_stores','New Stores',80),('new_services','New Services',90);

INSERT INTO public.mp_categories (slug,name,group_key,icon,behavior,legacy_categories,sort,is_popular) VALUES
('grocery','Grocery','shop','🛒','PRODUCT','{snacks,instant-food,pickles,spice-powders,local-snacks,tiffin-batter,beverages}',1,true),
('fmcg','FMCG','shop','🧃','PRODUCT','{snacks,instant-food,beverages,grooming}',2,false),
('household','Household','shop','🧺','PRODUCT','{pooja,stationery}',3,false),
('electronics','Electronics','shop','🔌','PRODUCT','{}',4,true),
('furniture','Furniture','shop','🛋️','FURNITURE','{}',5,true),
('beauty-products','Beauty Products','shop','💄','PRODUCT','{grooming}',6,false),
('salon','Salon','beauty','💇','SALON','{}',10,true),
('beauty-parlour','Beauty Parlour','beauty','💅','SALON','{}',11,false),
('spa','Spa','beauty','🧖','SALON','{}',12,false),
('home-salon','Home Salon','beauty','🏠','HOME_SERVICE','{}',13,true),
('makeup','Makeup','beauty','💋','SALON','{}',14,false),
('cleaning','Cleaning','home_services','🧹','HOME_SERVICE','{}',20,true),
('plumbing','Plumbing','home_services','🔧','HOME_SERVICE','{}',21,false),
('electrical','Electrical','home_services','💡','HOME_SERVICE','{}',22,false),
('ac-service','AC Service','home_services','❄️','HOME_SERVICE','{}',23,true),
('appliance-repair','Appliance Repair','home_services','🛠️','HOME_SERVICE','{}',24,false),
('event-venues','Event Venues','events','🏛️','EVENT','{}',30,false),
('decorations','Decorations','events','🎈','EVENT','{}',31,true),
('photography','Photography','events','📸','QUOTE','{}',32,false),
('catering','Catering','events','🍽️','EVENT','{}',33,false),
('makeup-artists','Makeup Artists','events','👰','EVENT','{}',34,false),
('djs','DJs','events','🎧','QUOTE','{}',35,false),
('event-equipment','Event Equipment','events','🎤','EVENT','{}',36,false);

INSERT INTO public.mp_partners (slug,name,partner_type,description,category_slugs,rating,review_count,distance_km,opens_at,closes_at,address,service_area,service_modes,icon) VALUES
('style-studio','Style Studio Unisex Salon','SERVICE_PROVIDER','Modern unisex salon for cuts, grooming and styling.','{salon,makeup}',4.6,212,1.2,'09:00','21:00','Trunk Road, Ongole','Ongole','{AT_SALON,HOME_SERVICE}','💇'),
('glow-parlour','Glow Beauty Parlour','SERVICE_PROVIDER','Facials, threading, waxing and bridal care.','{beauty-parlour,makeup,home-salon}',4.7,158,2.0,'10:00','20:00','Gandhi Nagar, Ongole','Ongole','{AT_SALON,HOME_SERVICE}','💅'),
('serene-spa','Serene Spa & Wellness','SERVICE_PROVIDER','Relaxing massages and body therapies.','{spa}',4.5,94,3.1,'10:00','21:00','Kurnool Road, Ongole','Ongole','{AT_SALON}','🧖'),
('fixit-home','FixIt Home Services','HOME_SERVICE_PROVIDER','Verified professionals for AC, plumbing, electrical and cleaning.','{ac-service,plumbing,electrical,cleaning,appliance-repair}',4.6,340,NULL,'08:00','20:00','Ongole','All of Ongole','{HOME_SERVICE}','🛠️'),
('sparkle-clean','Sparkle Cleaning Co.','HOME_SERVICE_PROVIDER','Deep cleaning for homes, kitchens and bathrooms.','{cleaning}',4.4,120,NULL,'08:00','19:00','Ongole','Ongole & Throvagunta','{HOME_SERVICE}','🧹'),
('comfort-furniture','Comfort Furniture House','FURNITURE_SELLER','Sofas, beds and dining sets with installation.','{furniture}',4.5,87,2.6,'10:00','21:00','Mangamuru Road, Ongole','Ongole','{}','🛋️'),
('ongole-electronics','Ongole Electronics Hub','RETAILER','Appliances, gadgets and accessories.','{electronics}',4.3,64,1.8,'10:00','21:30','RTC Bus Stand Road, Ongole','Ongole','{}','🔌'),
('dream-events','Dream Events & Decor','EVENT_PROVIDER','Birthday, engagement and wedding decoration and catering.','{decorations,catering,event-venues,event-equipment}',4.7,76,NULL,'09:00','20:00','Lawyerpet, Ongole','Prakasam district','{}','🎈'),
('frame-photography','Frame Stories Photography','EVENT_PROVIDER','Wedding, pre-wedding and event photography.','{photography}',4.8,51,NULL,'09:00','20:00','Ongole','Andhra Pradesh','{}','📸'),
('beat-djs','Beat Box DJs','EVENT_PROVIDER','DJs, sound and lighting for every celebration.','{djs,event-equipment}',4.4,33,NULL,'10:00','23:00','Ongole','Prakasam district','{}','🎧'),
('glam-artist','Glam by Priya','PROFESSIONAL','Bridal and party makeup artist.','{makeup-artists,makeup}',4.9,44,NULL,'08:00','20:00','Ongole','Ongole','{HOME_SERVICE}','👰');

INSERT INTO public.mp_staff (partner_id,name,title,rating)
SELECT p.id, s.name, s.title, s.rating FROM public.mp_partners p
JOIN (VALUES ('style-studio','Ravi','Senior Stylist',4.8),('style-studio','Kiran','Stylist',4.5),('style-studio','Anitha','Beautician',4.7),
 ('glow-parlour','Lakshmi','Senior Beautician',4.8),('glow-parlour','Swathi','Beautician',4.6),('serene-spa','Meena','Therapist',4.6),
 ('fixit-home','Suresh','AC Technician',4.7),('fixit-home','Ramesh','Plumber',4.5),('fixit-home','Naveen','Electrician',4.6),
 ('sparkle-clean','Team Sparkle','Cleaning crew',4.4),('glam-artist','Priya','Makeup Artist',4.9)) AS s(slug,name,title,rating) ON s.slug = p.slug;

INSERT INTO public.mp_listings (partner_id,category_slug,listing_type,transaction_type,name,description,icon,price,mrp,starting_price,duration_min,includes,attributes,packages,service_modes,home_service_fee,rating,review_count,service_area)
SELECT p.id, l.cat, l.lt, l.tt, l.name, l.descr, l.icon, l.price::numeric, l.mrp::numeric, l.sp::numeric, l.dur::int, l.inc::text[], l.attrs::jsonb, l.pk::jsonb, l.modes::text[], l.fee::numeric, l.rating::numeric, l.rc::int, l.area
FROM public.mp_partners p JOIN (VALUES
 ('style-studio','salon','SERVICE','SERVICE_BOOKING','Men''s Haircut','Precision cut with wash and styling.','💇‍♂️',250,NULL,NULL,30,'{Consultation,"Hair wash","Cut & style"}','{}','[]','{AT_SALON,HOME_SERVICE}',99,4.6,180,'Ongole'),
 ('style-studio','salon','SERVICE','SERVICE_BOOKING','Beard Trim','Shape-up and trim with hot towel.','🧔',150,NULL,NULL,20,'{"Beard shaping","Hot towel"}','{}','[]','{AT_SALON,HOME_SERVICE}',99,4.5,96,'Ongole'),
 ('style-studio','salon','SERVICE','SERVICE_BOOKING','Women''s Haircut & Blow-dry','Cut, wash and blow-dry.','💇‍♀️',450,NULL,NULL,45,'{Consultation,Wash,Cut,Blow-dry}','{}','[]','{AT_SALON}',0,4.7,72,'Ongole'),
 ('glow-parlour','beauty-parlour','SERVICE','SERVICE_BOOKING','Classic Facial','Cleansing, scrub, massage and mask.','🧴',600,NULL,NULL,60,'{Cleanse,Scrub,Massage,Mask}','{}','[]','{AT_SALON,HOME_SERVICE}',149,4.7,88,'Ongole'),
 ('glow-parlour','home-salon','SERVICE','HOME_SERVICE_BOOKING','Waxing at Home (Full Arms & Legs)','Hygienic waxing at your doorstep.','🏠',799,NULL,NULL,60,'{"Disposable kit","Post-wax care"}','{}','[]','{HOME_SERVICE}',0,4.6,64,'Ongole'),
 ('serene-spa','spa','SERVICE','SERVICE_BOOKING','Swedish Massage','Full body relaxing massage.','💆',1499,NULL,NULL,60,'{"Aroma oils","Steam towel"}','{}','[]','{AT_SALON}',0,4.5,41,'Ongole'),
 ('fixit-home','ac-service','SERVICE','HOME_SERVICE_BOOKING','AC Service (Split/Window)','Jet-pump cleaning, gas check and filter wash.','❄️',499,NULL,NULL,60,'{"Filter cleaning","Coil jet wash","Gas pressure check"}','{}','[]','{HOME_SERVICE}',0,4.6,210,'All of Ongole'),
 ('fixit-home','plumbing','SERVICE','HOME_SERVICE_BOOKING','Tap & Leak Repair','Fix leaking taps, pipes and fittings.','🔧',199,NULL,NULL,45,'{Inspection,Repair,"30-day warranty"}','{}','[]','{HOME_SERVICE}',0,4.4,98,'All of Ongole'),
 ('fixit-home','electrical','SERVICE','HOME_SERVICE_BOOKING','Fan / Light Installation','Install or replace fans and lights.','💡',149,NULL,NULL,30,'{Installation,"Safety check"}','{}','[]','{HOME_SERVICE}',0,4.5,77,'All of Ongole'),
 ('fixit-home','appliance-repair','SERVICE','HOME_SERVICE_BOOKING','Washing Machine Repair','Diagnosis and repair of all brands.','🧺',349,NULL,NULL,60,'{Diagnosis,"Repair (parts extra)"}','{}','[]','{HOME_SERVICE}',0,4.3,45,'All of Ongole'),
 ('sparkle-clean','cleaning','SERVICE','HOME_SERVICE_BOOKING','Full Home Deep Cleaning','Complete deep clean of a 2BHK.','🧹',2499,NULL,NULL,240,'{"All rooms",Kitchen,Bathrooms,"Eco-friendly supplies"}','{}','[]','{HOME_SERVICE}',0,4.4,60,'Ongole'),
 ('comfort-furniture','furniture','PRODUCT','PRODUCT_ORDER','Aurora 3-Seater Fabric Sofa','Plush 3-seater with solid wood frame.','🛋️',18999,24999,NULL,NULL,'{}','{"material":"Solid wood frame, fabric","dimensions":"198 x 86 x 84 cm","variants":["Grey","Teal","Beige"],"installation":true,"delivery":"Scheduled delivery in 2–5 days"}','[]','{}',0,4.5,32,'Ongole'),
 ('comfort-furniture','furniture','PRODUCT','PRODUCT_ORDER','Queen Size Storage Bed','Engineered wood bed with hydraulic storage.','🛏️',21499,27999,NULL,NULL,'{}','{"material":"Engineered wood","dimensions":"203 x 158 x 90 cm","variants":["Walnut","Wenge"],"installation":true,"delivery":"Scheduled delivery in 3–6 days"}','[]','{}',0,4.4,21,'Ongole'),
 ('comfort-furniture','furniture','PRODUCT','PRODUCT_ORDER','4-Seater Dining Set','Sheesham dining table with 4 chairs.','🪑',15999,19999,NULL,NULL,'{}','{"material":"Sheesham wood","dimensions":"120 x 75 x 76 cm","variants":["Honey","Teak"],"installation":true,"delivery":"Scheduled delivery in 2–4 days"}','[]','{}',0,4.6,18,'Ongole'),
 ('ongole-electronics','electronics','PRODUCT','PRODUCT_ORDER','1.5 Ton 3-Star Split AC','Energy-efficient inverter split AC.','❄️',32990,41990,NULL,NULL,'{}','{"variants":["White"],"installation":true,"delivery":"Same day / next day delivery"}','[]','{}',0,4.3,27,'Ongole'),
 ('ongole-electronics','electronics','PRODUCT','PRODUCT_ORDER','Mixer Grinder 750W','3 jars, stainless steel blades.','🥤',2899,3999,NULL,NULL,'{}','{"variants":["Red","Black"],"installation":false,"delivery":"Same day delivery"}','[]','{}',0,4.4,52,'Ongole'),
 ('dream-events','decorations','PACKAGE','EVENT_BOOKING','Birthday Decoration','Balloon and theme decoration at your venue.','🎈',NULL,NULL,4999,NULL,'{"Theme backdrop","Balloon arch","Name board","Setup & removal"}','{}','[{"name":"Basic","price":4999,"items":["Balloon backdrop","Name board"]},{"name":"Premium","price":9999,"items":["Theme backdrop","Balloon arch","LED lights","Cake table"]},{"name":"Custom","price":null,"items":["Tell us your theme — we quote"]}]','{}',0,4.7,54,'Prakasam district'),
 ('dream-events','catering','PACKAGE','EVENT_BOOKING','Veg Catering (per plate)','South Indian veg menu with service staff.','🍽️',NULL,NULL,250,NULL,'{"12-item menu","Service staff",Cutlery}','{}','[{"name":"Basic","price":250,"items":["8 items"]},{"name":"Premium","price":450,"items":["14 items","Live counter"]},{"name":"Custom","price":null,"items":["Custom menu"]}]','{}',0,4.6,29,'Prakasam district'),
 ('dream-events','event-venues','PACKAGE','EVENT_BOOKING','Banquet Hall (up to 200 guests)','AC hall with parking and stage.','🏛️',NULL,NULL,25000,NULL,'{"AC hall",Stage,Parking}','{}','[{"name":"Half day","price":25000,"items":["6 hours"]},{"name":"Full day","price":40000,"items":["12 hours"]}]','{}',0,4.5,15,'Ongole'),
 ('dream-events','event-equipment','PACKAGE','EVENT_BOOKING','Sound & Light Rental','Speakers, mics and stage lighting.','🎤',NULL,NULL,3999,NULL,'{Speakers,"2 mics","Stage lights"}','{}','[{"name":"Basic","price":3999,"items":["2 speakers","1 mic"]},{"name":"Premium","price":7999,"items":["4 speakers","3 mics","Lights"]}]','{}',0,4.4,12,'Ongole'),
 ('frame-photography','photography','REQUEST_QUOTE','QUOTE_REQUEST','Wedding Photography','Candid and traditional coverage with album.','📸',NULL,NULL,NULL,NULL,'{"Candid coverage","Traditional coverage","Edited album"}','{}','[]','{}',0,4.8,40,'Andhra Pradesh'),
 ('beat-djs','djs','REQUEST_QUOTE','QUOTE_REQUEST','DJ for Sangeet / Party','Pro DJ with sound setup.','🎧',NULL,NULL,NULL,NULL,'{"DJ console","Sound system"}','{}','[]','{}',0,4.4,22,'Prakasam district'),
 ('glam-artist','makeup-artists','PACKAGE','EVENT_BOOKING','Bridal Makeup','HD bridal makeup with hairstyling.','👰',NULL,NULL,7999,NULL,'{"HD makeup",Hairstyling,Draping}','{}','[{"name":"Basic","price":7999,"items":["HD makeup"]},{"name":"Premium","price":14999,"items":["Airbrush makeup","Hairstyling","Draping"]},{"name":"Custom","price":null,"items":["Multiple looks"]}]','{}',0,4.9,31,'Ongole')
) AS l(slug,cat,lt,tt,name,descr,icon,price,mrp,sp,dur,inc,attrs,pk,modes,fee,rating,rc,area) ON l.slug = p.slug;

INSERT INTO public.mp_reviews (partner_id, customer_name, rating, comment)
SELECT id, 'Sai K.', 5, 'Great service, on time and professional.' FROM public.mp_partners
UNION ALL SELECT id, 'Divya M.', 4, 'Good experience, will book again.' FROM public.mp_partners;
