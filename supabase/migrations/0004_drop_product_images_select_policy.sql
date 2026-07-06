-- Security linter flagged the broad SELECT policy added in 0003: public
-- buckets already serve objects via the public URL endpoint regardless of
-- storage.objects RLS, so this policy was redundant and additionally let
-- clients list/enumerate every file in the bucket through the API.
drop policy "Public read product-images" on storage.objects;
