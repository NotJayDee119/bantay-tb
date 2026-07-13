-- TB DOTS Centers in Davao City
-- Insert these records into the dots_centers table in Supabase

INSERT INTO dots_centers (name, address, barangay_psgc, lat, lon, phone, hours, services)
VALUES
  (
    'Southern Philippines Medical Center (SPMC)',
    'J.P. Laurel Ave, Baguio District',
    112402007,
    7.0736,
    125.6128,
    '(082) 227-2731',
    'Mon–Fri 8:00–17:00',
    ARRAY['DOTS', 'sputum AFB', 'chest x-ray', 'IPT', 'contact tracing', 'MDR-TB treatment']
  ),
  (
    'Davao City Health Office',
    'City Hall Complex, San Pedro Street',
    112402136,
    7.0697,
    125.5998,
    '(082) 227-1054',
    'Mon–Fri 8:00–17:00',
    ARRAY['DOTS', 'sputum AFB', 'IPT', 'contact tracing']
  ),
  (
    'Buhangin Health Center',
    'Buhangin District',
    112402021,
    7.1069,
    125.6137,
    NULL,
    'Mon–Fri 8:00–17:00',
    ARRAY['DOTS', 'sputum AFB', 'IPT', 'contact tracing']
  ),
  (
    'Matina Health Center',
    'Matina Crossing',
    112402075,
    7.0596,
    125.5784,
    NULL,
    'Mon–Fri 8:00–17:00',
    ARRAY['DOTS', 'sputum AFB', 'IPT', 'contact tracing']
  ),
  (
    'Agdao Health Center',
    'Agdao District',
    112402002,
    7.0845,
    125.6239,
    NULL,
    'Mon–Fri 8:00–17:00',
    ARRAY['DOTS', 'sputum AFB', 'IPT', 'contact tracing']
  ),
  (
    'Toril Health Center',
    'Toril District',
    112402126,
    7.0175,
    125.4998,
    NULL,
    'Mon–Fri 8:00–17:00',
    ARRAY['DOTS', 'sputum AFB', 'IPT', 'contact tracing']
  ),
  (
    'Paquibato Health Center',
    'Paquibato District',
    112402091,
    7.3670,
    125.4663,
    NULL,
    'Mon–Fri 8:00–17:00',
    ARRAY['DOTS', 'sputum AFB', 'IPT', 'contact tracing']
  ),
  (
    'Calinan Health Center',
    'Calinan District',
    112402026,
    7.1909,
    125.4557,
    NULL,
    'Mon–Fri 8:00–17:00',
    ARRAY['DOTS', 'sputum AFB', 'IPT', 'contact tracing']
  ),
  (
    'Bunawan Health Center',
    'Bunawan District',
    112402022,
    7.2366,
    125.6439,
    NULL,
    'Mon–Fri 8:00–17:00',
    ARRAY['DOTS', 'sputum AFB', 'IPT', 'contact tracing']
  ),
  (
    'Tugbok Health Center',
    'Tugbok District',
    112402127,
    7.1088,
    125.4826,
    NULL,
    'Mon–Fri 8:00–17:00',
    ARRAY['DOTS', 'sputum AFB', 'IPT', 'contact tracing']
  ),
  (
    'Talomo Health Center',
    'Talomo District',
    112402116,
    7.0556,
    125.5506,
    NULL,
    'Mon–Fri 8:00–17:00',
    ARRAY['DOTS', 'sputum AFB', 'IPT', 'contact tracing']
  ),
  (
    'Sasa Health Center',
    'Sasa District',
    112402101,
    7.1297,
    125.6509,
    NULL,
    'Mon–Fri 8:00–17:00',
    ARRAY['DOTS', 'sputum AFB', 'IPT', 'contact tracing']
  );
