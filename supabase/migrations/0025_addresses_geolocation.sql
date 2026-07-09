-- GPS capture is optional; all three stay nullable forever. accuracy is the
-- radius in meters reported by the Geolocation API — the admin UI can use it
-- to signal "pin is approximate" on poor fixes.
alter table public.addresses
  add column lat double precision check (lat between -90 and 90),
  add column lng double precision check (lng between -180 and 180),
  add column geo_accuracy_m real check (geo_accuracy_m >= 0);
