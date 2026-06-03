-- 009: Add Coffee Details
ALTER TABLE public.records
ADD COLUMN country_of_origin VARCHAR(100),
ADD COLUMN brew_type VARCHAR(50);
