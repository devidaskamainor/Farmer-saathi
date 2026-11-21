alter table farmers
  drop constraint if exists farmers_preferred_language_check;

alter table farmers
  add constraint farmers_preferred_language_check
  check (preferred_language in (
    'en', 'as', 'bn', 'brx', 'doi', 'gu', 'hi', 'kn', 'ks', 'kok', 'mai',
    'ml', 'mni', 'mr', 'ne', 'or', 'pa', 'sa', 'sat', 'sd', 'ta', 'te', 'ur'
  ));
