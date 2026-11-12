-- ActuScout: configurable label for each hero carousel slide.
ALTER TABLE carousel_slides ADD COLUMN label TEXT NOT NULL DEFAULT 'À la une · ActuScout';

-- Make the five existing homepage photographs editable from Super Admin.
INSERT OR IGNORE INTO carousel_slides
(id,title,subtitle,label,image_url,link_url,position,status)
VALUES
('home-hero-01','Faire rayonner l’engagement scout.','Des histoires, des actions et des idées qui rapprochent les communautés et inspirent les générations.','À la une · ActuScout','https://d2ol7oe51mr4n9.cloudfront.net/user_3JExKfLUFmvj9HB9CubvHJJ5Xrs/c2534d57-c407-499d-b0f8-a87a513e45df.jpg','',0,'published'),
('home-hero-02','Faire rayonner l’engagement scout.','Des histoires, des actions et des idées qui rapprochent les communautés et inspirent les générations.','À la une · ActuScout','https://d2ol7oe51mr4n9.cloudfront.net/user_3JExKfLUFmvj9HB9CubvHJJ5Xrs/ab0c84f9-d2fc-4ef7-ad97-c818f19513a3.jpg','',1,'published'),
('home-hero-03','Faire rayonner l’engagement scout.','Des histoires, des actions et des idées qui rapprochent les communautés et inspirent les générations.','À la une · ActuScout','https://d2ol7oe51mr4n9.cloudfront.net/user_3JExKfLUFmvj9HB9CubvHJJ5Xrs/c4a87459-2392-4536-bf34-79c9d1662777.jpg','',2,'published'),
('home-hero-04','Faire rayonner l’engagement scout.','Des histoires, des actions et des idées qui rapprochent les communautés et inspirent les générations.','À la une · ActuScout','https://d2ol7oe51mr4n9.cloudfront.net/user_3JExKfLUFmvj9HB9CubvHJJ5Xrs/6834b6e8-6393-44e7-8693-9d1b1fddf979.jpg','',3,'published'),
('home-hero-05','Faire rayonner l’engagement scout.','Des histoires, des actions et des idées qui rapprochent les communautés et inspirent les générations.','À la une · ActuScout','https://d2ol7oe51mr4n9.cloudfront.net/user_3JExKfLUFmvj9HB9CubvHJJ5Xrs/2c48652e-e560-4bea-b17a-6d1ae68ad88f.jpg','',4,'published');
