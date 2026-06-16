-- 016: Add Roastery Name to records
ALTER TABLE public.records
ADD COLUMN roastery_name TEXT DEFAULT 'اخرى';
