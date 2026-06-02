-- ============================================
-- 001: Enable Required PostgreSQL Extensions
-- ============================================

-- Trigram-based fuzzy matching for duplicate detection & Arabic text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Levenshtein distance for secondary similarity checks
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Unaccent for normalized text search
CREATE EXTENSION IF NOT EXISTS unaccent;
