-- Seed canonical catalog data, reconciling the three previously-hardcoded
-- datasets (Home carousel, Listing grid, Product Detail demo) into one.

insert into public.categories (id, label, sort_order) values
  ('skincare', 'Skincare', 1),
  ('vitamins', 'Vitamins', 2),
  ('supplements', 'Supplements', 3),
  ('hair', 'Hair Care', 4),
  ('personal', 'Personal Care', 5),
  ('devices', 'Wellness Devices', 6);

insert into public.products (
  slug, name, brand, sub, category_id, price, was_price, stock,
  badge_label, badge_tone, rating, review_count, is_popular,
  description, dosage, ingredients, warnings, storage
) values
  (
    'cerave-moisturising-lotion', 'CeraVe Moisturising Lotion', 'CeraVe', '473ml · Dry skin',
    'skincare', 240, 280, 'in', 'New', 'new', 4.6, 128, true,
    'A lightweight, fast-absorbing lotion formulated with three essential ceramides and hyaluronic acid to help restore the skin''s natural barrier while delivering all-day hydration. Suitable for daily use on face and body.',
    'Apply a generous amount to clean, dry skin once or twice daily, or as directed by your pharmacist or dermatologist. For external use only — avoid contact with eyes.',
    'Aqua, glycerin, caprylic/capric triglyceride, ceramide NP, ceramide AP, ceramide EOP, hyaluronic acid, cholesterol, phytosphingosine. Fragrance-free formula.',
    'For external use only. Discontinue use and consult your pharmacist if irritation or redness occurs. Keep out of reach of children. Do not use on broken or infected skin without medical advice.',
    'Store below 25°C in a cool, dry place, away from direct sunlight. Keep the cap tightly closed after use.'
  ),
  (
    'niacinamide-10-serum', 'Niacinamide 10% Serum', 'The Ordinary', '30ml · Pore refining',
    'skincare', 350, null, 'in', 'Bestseller', 'bestseller', null, 0, true,
    null, null, null, null, null
  ),
  (
    'ultra-sheer-sunscreen-spf50', 'Ultra Sheer Sunscreen SPF50', 'Neutrogena', '88ml · Broad spectrum',
    'skincare', 295, null, 'in', null, null, null, 0, false,
    null, null, null, null, null
  ),
  (
    'adapalene-gel-0-1', 'Adapalene Gel 0.1%', 'Differin', '45g · Retinoid treatment',
    'skincare', 180, null, 'low', null, null, null, 0, false,
    null, null, null, null, null
  ),
  (
    'vitamin-c-1000mg', 'Vitamin C 1000mg', 'Vitabiotics', '60 effervescent tablets',
    'vitamins', 120, null, 'in', 'Bestseller', 'bestseller', null, 0, true,
    null, null, null, null, null
  ),
  (
    'centrum-multivitamin', 'Centrum Multivitamin', 'Centrum', '100 tablets · Daily',
    'vitamins', 315, null, 'in', null, null, null, 0, false,
    null, null, null, null, null
  ),
  (
    'vitamin-d3-2000iu', 'Vitamin D3 2000IU', 'Vitabiotics', '90 softgels · Bone health',
    'vitamins', 95, null, 'in', null, null, null, 0, false,
    null, null, null, null, null
  ),
  (
    'omega-3-fish-oil-1000mg', 'Omega-3 Fish Oil 1000mg', 'NatureMade', '90 softgels · Supplement',
    'supplements', 210, null, 'in', null, null, null, 0, true,
    null, null, null, null, null
  ),
  (
    'collagen-beauty-powder', 'Collagen Beauty Powder', 'VitaGlow', '300g · Skin & hair',
    'supplements', 480, null, 'out', 'Bestseller', 'bestseller', null, 0, true,
    null, null, null, null, null
  ),
  (
    'biotin-hair-nail-5000mcg', 'Biotin Hair & Nail 5000mcg', 'NatureMade', '60 capsules',
    'supplements', 150, null, 'in', null, null, null, 0, false,
    null, null, null, null, null
  ),
  (
    'repair-shampoo', 'Repair Shampoo', 'Nivea', '400ml · Damaged hair',
    'hair', 110, null, 'in', null, null, null, 0, false,
    null, null, null, null, null
  ),
  (
    'minoxidil-5-solution', 'Minoxidil 5% Solution', 'Regaine', '60ml · Hair regrowth treatment',
    'hair', 520, null, 'in', null, null, null, 0, false,
    null, null, null, null, null
  ),
  (
    'body-lotion', 'Body Lotion', 'Nivea', '400ml · 48h moisture',
    'personal', 95, null, 'in', null, null, null, 0, false,
    null, null, null, null, null
  ),
  (
    'advanced-care-deodorant', 'Advanced Care Deodorant', 'Dove', '150ml · Anti-perspirant',
    'personal', 60, null, 'in', null, null, null, 0, false,
    null, null, null, null, null
  ),
  (
    'blood-pressure-monitor', 'Blood Pressure Monitor', 'Omron', 'Automatic · Upper arm',
    'devices', 890, null, 'low', null, null, null, 0, true,
    null, null, null, null, null
  ),
  (
    'digital-thermometer', 'Digital Thermometer', 'Omron', 'Fast read · Flexible tip',
    'devices', 65, null, 'in', null, null, null, 0, false,
    null, null, null, null, null
  );

insert into public.reviews (product_id, author_name, rating, body, created_at)
select id, r.author_name, r.rating, r.body, r.created_at::timestamptz
from public.products, (values
  ('Mona K.', 5, 'Absorbs quickly and my skin feels so much calmer since I started using this every day.', '2026-05-01'),
  ('Ahmed S.', 4, 'Great for sensitive skin, fragrance-free like it says. Wish the bottle was a bit bigger.', '2026-04-01'),
  ('Laila R.', 5, 'My dermatologist recommended this and it has genuinely helped with my dryness this winter.', '2026-03-01')
) as r(author_name, rating, body, created_at)
where products.slug = 'cerave-moisturising-lotion';
