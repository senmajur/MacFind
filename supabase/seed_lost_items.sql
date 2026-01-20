-- Seed file to populate the database with placeholder "lost" items.
-- Run this in the Supabase SQL Editor.

INSERT INTO public.items (
    title,
    vague_description,
    status,
    category,
    location_hint,
    object_type,
    created_at,
    metadata
) VALUES 
(
    'Lost Laptop Charger',
    'Black Dell charger with fraying cable',
    'lost',
    'electronics',
    'Thode Library 2nd Floor',
    'Charger',
    NOW(),
    '{"tags": ["electronics", "charger", "dell"], "colors": ["black"]}'
),
(
    'Blue Hydroflask',
    'Blue water bottle with stickers',
    'lost',
    'water_bottle',
    'MUSC Student Center',
    'Water Bottle',
    NOW() - INTERVAL '1 day',
    '{"tags": ["water bottle", "blue"], "colors": ["blue"]}'
),
(
    'Car Keys',
    'Honda car keys with a red keychain',
    'lost',
    'keys',
    'Parking Lot M',
    'Keys',
    NOW() - INTERVAL '3 hours',
    '{"tags": ["keys", "honda", "car"], "colors": ["black", "silver"]}'
),
(
    'Calculus Textbook',
    'Stewart Calculus Early Transcendentals',
    'lost',
    'book',
    'PGCL 127',
    'Textbook',
    NOW() - INTERVAL '2 days',
    '{"tags": ["book", "calculus", "textbook"], "colors": ["blue", "white"]}'
);
