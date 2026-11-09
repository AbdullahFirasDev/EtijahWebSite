-- Reference data the portal needs on day one (editable from the staff portal).
-- No sample programs, hotels or companies are inserted.

INSERT INTO services (icon, name_ar, name_en, sort, created_at, updated_at) VALUES
  ('plane',     'تذاكر الطيران ذهاباً وإياباً', 'Return flights',          10, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('hotel',     'الإقامة الفندقية',             'Hotel accommodation',     20, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('meals',     'الوجبات',                      'Meals',                   30, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('transfer',  'النقل من وإلى المطار',          'Airport transfers',       40, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('tours',     'الجولات السياحية',              'Sightseeing tours',       50, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('guide',     'مرشد سياحي',                    'Tour guide',              60, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('visa',      'التأشيرة',                      'Visa',                    70, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('insurance', 'التأمين الصحي للسفر',           'Travel health insurance', 80, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT INTO settings (key, value) VALUES
  ('currencies', '["USD","IQD"]'),
  ('default_currency', '"USD"'),
  ('quote_validity_days', '7'),
  ('quote_terms_ar', '"• الأسعار صالحة حتى تاريخ انتهاء العرض المذكور، وتخضع لتوفر المقاعد والغرف عند التأكيد.\n• يُعتمد الحجز بعد تأكيد الموافقة وسداد العربون المتفق عليه.\n• قد تتغير أسعار تذاكر الطيران والضرائب من شركات الطيران حتى إصدار التذاكر.\n• تخضع سياسة الإلغاء والتعديل لشروط الفنادق وشركات الطيران المعتمدة في البرنامج."'),
  ('quote_terms_en', '"• Prices are valid until the expiry date of this offer and are subject to seat and room availability at confirmation.\n• Bookings are confirmed after written acceptance and payment of the agreed deposit.\n• Airfares and airline taxes may change until tickets are issued.\n• Cancellation and amendment policies follow the terms of the hotels and airlines in the program."');
