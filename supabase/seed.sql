-- Seed data: barangays loaded from public/data via the Node script
-- `scripts/seed-supabase.ts` (which runs after `supabase db reset`).
-- This SQL file seeds DOTS centers and a small set of health-content rows so
-- the public DOTS Locator and Health Education pages have content even
-- before any user-generated data exists.

-- ─────────────────────────────────────────────────────────────────
-- DOTS Centers (Davao City)
-- Coordinates are approximate and intended for the capstone demo only.
-- ─────────────────────────────────────────────────────────────────
insert into public.dots_centers (name, address, lat, lon, phone, hours, services)
values
  ('Davao Doctors Hospital DOTS', '118 E. Quirino Ave, Davao City', 7.0707, 125.6087, '(082) 222-8000', 'Mon–Sat 8am–5pm', array['Sputum testing','TB treatment']),
  ('SPMC TB-DOTS Center', 'Southern Philippines Medical Center, JP Laurel Ave, Davao City', 7.0997, 125.6131, '(082) 227-2731', 'Mon–Fri 8am–5pm', array['Sputum testing','MDR-TB','TB treatment']),
  ('Toril District Hospital DOTS', 'Toril, Davao City', 7.0118, 125.5043, '(082) 291-1126', 'Mon–Fri 8am–5pm', array['Sputum testing','TB treatment']),
  ('Buhangin Health Center DOTS', 'Buhangin, Davao City', 7.1289, 125.6308, '(082) 234-1234', 'Mon–Fri 8am–4pm', array['Sputum testing','TB treatment']),
  ('Talomo Health Center DOTS', 'Talomo, Davao City', 7.0467, 125.5805, '(082) 297-1010', 'Mon–Fri 8am–4pm', array['Sputum testing','TB treatment']),
  ('Agdao Health Center DOTS', 'Agdao, Davao City', 7.0850, 125.6240, '(082) 226-2828', 'Mon–Fri 8am–4pm', array['TB treatment']),
  ('Calinan Hospital DOTS', 'Calinan, Davao City', 7.1841, 125.4612, '(082) 295-0101', 'Mon–Fri 8am–4pm', array['Sputum testing','TB treatment']),
  ('Tugbok Health Center DOTS', 'Mintal, Davao City', 7.0944, 125.4937, '(082) 293-1234', 'Mon–Fri 8am–4pm', array['TB treatment']),
  ('Bunawan Health Center DOTS', 'Bunawan, Davao City', 7.1995, 125.6748, '(082) 235-9000', 'Mon–Fri 8am–4pm', array['TB treatment']),
  ('Marilog District Health Office DOTS', 'Marilog, Davao City', 7.4097, 125.4567, '(082) 295-2222', 'Mon–Fri 8am–4pm', array['TB treatment']),
  ('Davao City Health Office Central DOTS', 'San Pedro St., Davao City', 7.0708, 125.6113, '(082) 222-9000', 'Mon–Fri 8am–5pm', array['Sputum testing','MDR-TB','TB treatment','Health education']),
  ('Paquibato District Hospital DOTS', 'Paquibato, Davao City', 7.2887, 125.7290, '(082) 295-7777', 'Mon–Fri 8am–4pm', array['TB treatment']);
