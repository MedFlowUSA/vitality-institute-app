update public.services
set
  price_marketing_cents = case
    when lower(name) in ('glp-1 weight optimization consultation', 'glp1 weight optimization consultation') then 14900
    when lower(name) in ('testosterone optimization consultation') then 19900
    when lower(name) in ('women''s hormone balance consultation', 'womens hormone balance consultation') then 19900
    when lower(name) in ('peptide therapy consultation') then 14900
    when lower(name) in ('glp-1 essential', 'glp1 essential') then 39900
    when lower(name) in ('glp-1 plus', 'glp1 plus') then 49900
    when lower(name) in ('glp-1 advanced', 'glp1 advanced') then 64900
    when lower(name) in ('trt basic') then 24900
    when lower(name) in ('trt performance') then 32900
    when lower(name) in ('hrt balance plan') then 27900
    when lower(name) in ('pellet therapy') then 50000
    when lower(name) in ('vitality core') then 59900
    when lower(name) in ('vitality performance (men)', 'vitality performance') then 64900
    when lower(name) in ('vitality balance (women)', 'vitality balance') then 59900
    when lower(name) in ('vitality elite') then 89900
    when lower(name) in ('bpc-157') then 27900
    when lower(name) in ('cjc-1295 / ipamorelin', 'cjc-1295/ipamorelin', 'cjc 1295 / ipamorelin') then 37900
    when lower(name) in ('nad+ infusion', 'nad infusion') then 39500
    when lower(name) in ('metabolic support stack') then 44900
    when lower(name) in ('botox pricing') then 1400
    when lower(name) in ('body composition scan') then 2900
    when lower(name) in ('expanded lab panel') then 19900
    when lower(name) in ('priority scheduling upgrade') then 2900
    else price_marketing_cents
  end,
  price_regular_cents = case
    when lower(name) in ('glp-1 weight optimization consultation', 'glp1 weight optimization consultation') then 19900
    when lower(name) in ('testosterone optimization consultation') then 24900
    when lower(name) in ('women''s hormone balance consultation', 'womens hormone balance consultation') then 24900
    when lower(name) in ('peptide therapy consultation') then 19900
    when lower(name) in ('glp-1 essential', 'glp1 essential') then 44900
    when lower(name) in ('glp-1 plus', 'glp1 plus') then 54900
    when lower(name) in ('glp-1 advanced', 'glp1 advanced') then 69900
    when lower(name) in ('trt basic') then 27900
    when lower(name) in ('trt performance') then 35900
    when lower(name) in ('hrt balance plan') then 30900
    when lower(name) in ('pellet therapy') then 70000
    when lower(name) in ('vitality core') then 64900
    when lower(name) in ('vitality performance (men)', 'vitality performance') then 69900
    when lower(name) in ('vitality balance (women)', 'vitality balance') then 64900
    when lower(name) in ('vitality elite') then 119900
    when lower(name) in ('bpc-157') then 29900
    when lower(name) in ('cjc-1295 / ipamorelin', 'cjc-1295/ipamorelin', 'cjc 1295 / ipamorelin') then 39900
    when lower(name) in ('nad+ infusion', 'nad infusion') then 49500
    when lower(name) in ('metabolic support stack') then 49900
    when lower(name) in ('botox pricing') then 1400
    when lower(name) in ('body composition scan') then 3900
    when lower(name) in ('expanded lab panel') then 21900
    when lower(name) in ('priority scheduling upgrade') then 3900
    else price_regular_cents
  end
where lower(name) in (
  'glp-1 weight optimization consultation',
  'glp1 weight optimization consultation',
  'testosterone optimization consultation',
  'women''s hormone balance consultation',
  'womens hormone balance consultation',
  'peptide therapy consultation',
  'glp-1 essential',
  'glp1 essential',
  'glp-1 plus',
  'glp1 plus',
  'glp-1 advanced',
  'glp1 advanced',
  'trt basic',
  'trt performance',
  'hrt balance plan',
  'pellet therapy',
  'vitality core',
  'vitality performance (men)',
  'vitality performance',
  'vitality balance (women)',
  'vitality balance',
  'vitality elite',
  'bpc-157',
  'cjc-1295 / ipamorelin',
  'cjc-1295/ipamorelin',
  'cjc 1295 / ipamorelin',
  'nad+ infusion',
  'nad infusion',
  'metabolic support stack',
  'botox pricing',
  'body composition scan',
  'expanded lab panel',
  'priority scheduling upgrade'
);
