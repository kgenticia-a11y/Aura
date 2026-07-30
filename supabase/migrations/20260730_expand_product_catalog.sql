-- Expand the product catalog with more brands and categories so users have a
-- wider selection across all price tiers. Uses ON CONFLICT to stay idempotent
-- against existing rows (matched by brand + name).
--
-- Also adds a unique constraint on (brand, name) if it doesn't already exist,
-- to prevent duplicate product entries.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_brand_name_key'
  ) THEN
    ALTER TABLE public.products ADD CONSTRAINT products_brand_name_key UNIQUE (brand, name);
  END IF;
END $$;

INSERT INTO public.products (name, brand, category, price_tier, description, key_ingredients, skin_types, image_url, purchase_url)
VALUES
  -- ── Cleansers ──
  ('Soy pH-Balanced Cleanser', 'Fresh', 'cleanser', 'luxury',
   'Gentle gel cleanser with amino acid-rich soy proteins that removes makeup without stripping moisture.',
   ARRAY['soy proteins', 'rosewater', 'cucumber extract'],
   ARRAY['all'], NULL, NULL),

  ('Milky Jelly Cleanser', 'Glossier', 'cleanser', 'mid-range',
   'Conditioning face wash with a creamy gel texture that melts away dirt and makeup.',
   ARRAY['poloxamer', 'allantoin', 'rosewater'],
   ARRAY['all'], NULL, NULL),

  ('Ultra Gentle Daily Cleanser', 'Neutrogena', 'cleanser', 'drugstore',
   'Fragrance-free foaming cleanser for sensitive skin that preserves natural moisture.',
   ARRAY['glycerin', 'sodium cocoyl glycinate'],
   ARRAY['sensitive', 'dry', 'all'], NULL, NULL),

  ('Toleriane Purifying Foaming Cleanser', 'La Roche-Posay', 'cleanser', 'mid-range',
   'Soap-free purifying cleanser with ceramide-3 and niacinamide for oily to normal skin.',
   ARRAY['niacinamide', 'ceramide-3', 'glycerin'],
   ARRAY['oily', 'combination', 'normal'], NULL, NULL),

  ('Oil-Free Acne Wash', 'Neutrogena', 'cleanser', 'drugstore',
   'Salicylic acid face wash that treats and helps prevent breakouts.',
   ARRAY['salicylic acid'],
   ARRAY['oily', 'combination'], NULL, NULL),

  ('Superfood Cleanser', 'Youth to the People', 'cleanser', 'mid-range',
   'Antioxidant-rich gel cleanser with kale, spinach, and green tea.',
   ARRAY['kale extract', 'spinach extract', 'green tea'],
   ARRAY['all'], NULL, NULL),

  -- ── Toners ──
  ('Witch Hazel Facial Toner', 'Thayers', 'toner', 'drugstore',
   'Alcohol-free witch hazel toner with aloe vera that soothes and conditions skin.',
   ARRAY['witch hazel', 'aloe vera'],
   ARRAY['all'], NULL, NULL),

  ('Glycolic Acid 7% Toning Solution', 'The Ordinary', 'toner', 'drugstore',
   'Exfoliating toner with 7% glycolic acid for improved clarity and radiance.',
   ARRAY['glycolic acid', 'ginseng root extract', 'aloe vera'],
   ARRAY['normal', 'oily', 'combination'], NULL, NULL),

  ('Facial Treatment Essence', 'SK-II', 'toner', 'luxury',
   'Iconic essence with over 90% Pitera to improve skin texture and radiance.',
   ARRAY['pitera', 'galactomyces ferment filtrate'],
   ARRAY['all'], NULL, NULL),

  ('Klairs Supple Preparation Toner', 'Dear Klairs', 'toner', 'mid-range',
   'Hydrating toner with hyaluronic acid and plant extracts that preps skin for serums.',
   ARRAY['hyaluronic acid', 'centella asiatica', 'licorice root'],
   ARRAY['dry', 'sensitive', 'all'], NULL, NULL),

  -- ── Serums ──
  ('Niacinamide 10% + Zinc 1%', 'The Ordinary', 'serum', 'drugstore',
   'High-strength niacinamide serum to reduce the look of blemishes and congestion.',
   ARRAY['niacinamide', 'zinc PCA'],
   ARRAY['oily', 'combination', 'all'], NULL, NULL),

  ('C E Ferulic Serum', 'SkinCeuticals', 'serum', 'luxury',
   'Gold-standard vitamin C serum with 15% L-ascorbic acid, vitamin E, and ferulic acid.',
   ARRAY['vitamin C', 'vitamin E', 'ferulic acid'],
   ARRAY['all'], NULL, NULL),

  ('Hyaluronic Acid 2% + B5', 'The Ordinary', 'serum', 'drugstore',
   'Multi-depth hyaluronic acid formula for intense yet weightless hydration.',
   ARRAY['hyaluronic acid', 'vitamin B5'],
   ARRAY['all'], NULL, NULL),

  ('Retinol 0.5 Refining Night Serum', 'Paula''s Choice', 'serum', 'mid-range',
   'Gentle retinol serum with antioxidants that smooths fine lines and evens skin tone.',
   ARRAY['retinol', 'vitamin C', 'vitamin E', 'licorice root'],
   ARRAY['normal', 'combination', 'all'], NULL, NULL),

  ('Advanced Snail 96 Mucin Power Essence', 'COSRX', 'serum', 'mid-range',
   'Lightweight essence with 96% snail secretion filtrate for deep hydration and repair.',
   ARRAY['snail secretion filtrate', 'sodium hyaluronate'],
   ARRAY['all'], NULL, NULL),

  ('Protini Polypeptide Firming Serum', 'Drunk Elephant', 'serum', 'luxury',
   'Signal peptide and growth factor serum that firms and improves the look of skin.',
   ARRAY['peptides', 'pygmy waterlily', 'soybean folic acid'],
   ARRAY['all'], NULL, NULL),

  ('Azelaic Acid Suspension 10%', 'The Ordinary', 'serum', 'drugstore',
   'Brightening cream-gel with 10% azelaic acid for uneven tone and visible blemishes.',
   ARRAY['azelaic acid'],
   ARRAY['oily', 'combination', 'normal'], NULL, NULL),

  ('Vitamin C Suspension 23% + HA Spheres 2%', 'The Ordinary', 'serum', 'drugstore',
   'Highly concentrated vitamin C in a water-free formula for radiance and antioxidant protection.',
   ARRAY['vitamin C', 'hyaluronic acid'],
   ARRAY['all'], NULL, NULL),

  -- ── Moisturizers ──
  ('Moisturizing Cream', 'CeraVe', 'moisturizer', 'drugstore',
   'Rich yet non-greasy cream with three essential ceramides and MVE technology for 24-hour hydration.',
   ARRAY['ceramides', 'hyaluronic acid', 'MVE technology'],
   ARRAY['dry', 'normal', 'all'], NULL, NULL),

  ('Water Cream', 'Tatcha', 'moisturizer', 'luxury',
   'Oil-free, pore-refining water cream that releases a burst of skin-improving nutrients.',
   ARRAY['Japanese wild rose', 'Japanese leopard lily', 'hyaluronic acid'],
   ARRAY['oily', 'combination', 'normal'], NULL, NULL),

  ('Crème de la Mer', 'La Mer', 'moisturizer', 'luxury',
   'Legendary rich cream powered by cell-renewing Miracle Broth to transform skin.',
   ARRAY['Miracle Broth', 'lime tea extract', 'seaweed'],
   ARRAY['dry', 'normal'], NULL, NULL),

  ('Lala Retro Whipped Cream', 'Drunk Elephant', 'moisturizer', 'luxury',
   'Rescue moisturizer packed with six African oils and ceramides to strengthen the skin barrier.',
   ARRAY['ceramides', 'marula oil', 'baobab oil', 'mongongo oil'],
   ARRAY['dry', 'normal', 'all'], NULL, NULL),

  ('Natural Moisturizing Factors + HA', 'The Ordinary', 'moisturizer', 'drugstore',
   'Non-greasy surface hydration cream with amino acids, fatty acids, and hyaluronic acid.',
   ARRAY['hyaluronic acid', 'amino acids', 'ceramides'],
   ARRAY['all'], NULL, NULL),

  ('PM Facial Moisturizing Lotion', 'CeraVe', 'moisturizer', 'drugstore',
   'Lightweight night moisturizer with niacinamide and ceramides for overnight barrier repair.',
   ARRAY['niacinamide', 'ceramides', 'hyaluronic acid'],
   ARRAY['all'], NULL, NULL),

  ('Peptide Glazing Fluid', 'Rhode', 'moisturizer', 'mid-range',
   'Niacinamide-rich peptide moisturizer that delivers a dewy, glass-skin finish.',
   ARRAY['niacinamide', 'peptides', 'hyaluronic acid'],
   ARRAY['all'], NULL, NULL),

  ('Cicaplast Baume B5+', 'La Roche-Posay', 'moisturizer', 'mid-range',
   'Multi-purpose soothing balm with panthenol and madecassoside for irritated or damaged skin.',
   ARRAY['panthenol', 'madecassoside', 'shea butter'],
   ARRAY['sensitive', 'dry', 'all'], NULL, NULL),

  -- ── Sunscreens ──
  ('UV Expert Aquagel SPF 50', 'Lancôme', 'sunscreen', 'luxury',
   'Lightweight aqua-gel sunscreen with broad-spectrum SPF 50 and antioxidant protection.',
   ARRAY['vitamin E', 'moringa extract'],
   ARRAY['all'], NULL, NULL),

  ('Unseen Sunscreen SPF 40', 'Supergoop!', 'sunscreen', 'mid-range',
   'Invisible, weightless, scentless sunscreen that doubles as a makeup-gripping primer.',
   ARRAY['meadowfoam seed oil', 'frankincense extract', 'red algae'],
   ARRAY['all'], NULL, NULL),

  ('Ultra Sheer Dry-Touch SPF 55', 'Neutrogena', 'sunscreen', 'drugstore',
   'Oil-free, water-resistant sunscreen with a clean, matte finish.',
   ARRAY['avobenzone', 'homosalate', 'octisalate'],
   ARRAY['all'], NULL, NULL),

  ('Anthelios Melt-In Milk SPF 60', 'La Roche-Posay', 'sunscreen', 'mid-range',
   'Fast-absorbing sunscreen milk with Cell-Ox Shield technology for very high UVA/UVB protection.',
   ARRAY['Cell-Ox Shield', 'vitamin E', 'La Roche-Posay thermal spring water'],
   ARRAY['all'], NULL, NULL),

  ('Hydro Boost Water Gel Lotion SPF 30', 'Neutrogena', 'sunscreen', 'drugstore',
   'Water-gel formula with hyaluronic acid that moisturizes while providing sun protection.',
   ARRAY['hyaluronic acid', 'glycerin'],
   ARRAY['dry', 'normal', 'all'], NULL, NULL),

  -- ── Eye Creams ──
  ('Retinol Eye Cream', 'CeraVe', 'eye cream', 'drugstore',
   'Gentle retinol eye cream with ceramides and niacinamide to smooth crow''s feet and brighten dark circles.',
   ARRAY['retinol', 'ceramides', 'niacinamide'],
   ARRAY['all'], NULL, NULL),

  ('Banana Bright Eye Crème', 'Olehenriksen', 'eye cream', 'mid-range',
   'Color-correcting eye cream with vitamin C and collagen to brighten and firm the under-eye area.',
   ARRAY['vitamin C', 'collagen', 'banana powder'],
   ARRAY['all'], NULL, NULL),

  ('C-Tango Multivitamin Eye Cream', 'Drunk Elephant', 'eye cream', 'luxury',
   'Five forms of vitamin C plus eight peptides target signs of aging around the delicate eye area.',
   ARRAY['vitamin C', 'peptides', 'cucumber extract'],
   ARRAY['all'], NULL, NULL),

  -- ── Exfoliants ──
  ('BHA Liquid Exfoliant', 'Paula''s Choice', 'exfoliant', 'mid-range',
   'Cult-favorite leave-on exfoliant with 2% salicylic acid to unclog pores and smooth wrinkles.',
   ARRAY['salicylic acid', 'green tea'],
   ARRAY['oily', 'combination', 'all'], NULL, NULL),

  ('AHA 30% + BHA 2% Peeling Solution', 'The Ordinary', 'exfoliant', 'drugstore',
   'Clinical-strength 10-minute exfoliating treatment for experienced users to improve texture and tone.',
   ARRAY['glycolic acid', 'lactic acid', 'salicylic acid'],
   ARRAY['normal', 'oily', 'combination'], NULL, NULL),

  ('Good Genes All-in-One Lactic Acid Treatment', 'Sunday Riley', 'exfoliant', 'luxury',
   'Lactic acid treatment that exfoliates, clarifies, and smooths the look of fine lines.',
   ARRAY['lactic acid', 'licorice root', 'lemongrass'],
   ARRAY['all'], NULL, NULL),

  -- ── Masks ──
  ('Dewy Skin Cream Overnight Mask', 'Tatcha', 'mask', 'luxury',
   'Rich overnight treatment with Japanese purple rice that delivers plump, dewy skin by morning.',
   ARRAY['Japanese purple rice', 'hyaluronic acid', 'squalane'],
   ARRAY['dry', 'normal', 'all'], NULL, NULL),

  ('Honey Potion Renewing Antioxidant Hydration Mask', 'Farmacy', 'mask', 'mid-range',
   'Warming honey mask with propolis and B vitamins that hydrates and firms skin.',
   ARRAY['honey', 'propolis', 'vitamin B'],
   ARRAY['all'], NULL, NULL),

  ('Aztec Secret Indian Healing Clay', 'Aztec Secret', 'mask', 'drugstore',
   'Deep-pore cleansing mask made with 100% calcium bentonite clay from Death Valley.',
   ARRAY['bentonite clay'],
   ARRAY['oily', 'combination'], NULL, NULL),

  -- ── Lip Care ──
  ('Peptide Lip Treatment', 'Rhode', 'lip care', 'mid-range',
   'Peptide-powered lip treatment that nourishes and visibly smooths fine lines on lips.',
   ARRAY['peptides', 'shea butter', 'babassu oil'],
   ARRAY['all'], NULL, NULL),

  ('Laneige Lip Sleeping Mask', 'Laneige', 'lip care', 'mid-range',
   'Berry-flavored overnight lip mask with vitamin C and antioxidants for smooth, hydrated lips.',
   ARRAY['vitamin C', 'berry extracts', 'hyaluronic acid'],
   ARRAY['all'], NULL, NULL)

ON CONFLICT ON CONSTRAINT products_brand_name_key DO NOTHING;
