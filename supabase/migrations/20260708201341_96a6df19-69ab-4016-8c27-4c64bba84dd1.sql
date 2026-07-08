
-- Public read for promotion images
CREATE POLICY "Public read promotion-images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'promotion-images');

CREATE POLICY "Authenticated write promotion-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'promotion-images');

CREATE POLICY "Authenticated update promotion-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'promotion-images');

CREATE POLICY "Authenticated delete promotion-images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'promotion-images');

-- Public read for location photos
CREATE POLICY "Public read location-photos"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'location-photos');

CREATE POLICY "Authenticated write location-photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'location-photos');

CREATE POLICY "Authenticated update location-photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'location-photos');

CREATE POLICY "Authenticated delete location-photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'location-photos');
