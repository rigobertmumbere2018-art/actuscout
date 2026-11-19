-- Normalize existing article categories without changing article content, dates or cover images.
UPDATE articles SET category='Actualité scoute' WHERE id IN (
 'da778807-7a4c-4366-9818-d3be9337df72',
 'fb486fe9-2172-4deb-b8cf-38b172c00cfb'
);
UPDATE articles SET category='Scoutisme international' WHERE id='9195ca48-e9cd-4354-81b4-53356ab4dffc';
UPDATE articles SET category='Portrait de la semaine' WHERE id IN (
 'c5d931dd-237a-4235-b30e-6c5297ffe19f',
 '9a6a4790-562b-40cc-aca1-9ddc4abc7b35'
);
UPDATE articles SET category='Vie scoute et communauté' WHERE id='7e90454a-21f2-42c7-8fd9-ae8da05143bd';
UPDATE articles SET category='Hommage scout' WHERE id='602caf3f-e124-44bc-884d-7d139e9b9d7c';
UPDATE articles SET category='Vie dans la nature' WHERE id='7436f75d-0a08-404e-abab-c7985c77a92c';
UPDATE articles SET category='Page noire' WHERE id='a3a71c53-c308-4a55-bc43-41cec53416e0';
UPDATE articles SET category='Scoutisme et communauté' WHERE id='427f840a-c7ca-46ad-8511-ffc9c9fe4d9e';
UPDATE articles SET category='Engagement communautaire' WHERE id='76b11ff3-4a26-470c-8fdc-7e254beb75bf';
