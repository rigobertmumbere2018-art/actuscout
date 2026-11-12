-- ActuScout: configurable label for each hero carousel slide.
ALTER TABLE carousel_slides ADD COLUMN label TEXT NOT NULL DEFAULT 'À la une · ActuScout';
