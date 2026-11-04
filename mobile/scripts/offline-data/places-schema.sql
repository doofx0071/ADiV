CREATE VIRTUAL TABLE places_fts USING fts5(
  name,
  aliases,
  category,
  admin,
  lat UNINDEXED,
  lon UNINDEXED,
  tokenize = 'unicode61 remove_diacritics 2'
);
