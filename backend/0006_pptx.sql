-- Cramfox — migracja 0006: prezentacje PowerPoint (.pptx) jako materiał.
-- Backend rozpakowuje PPTX na tekst slajdów (z notatkami prowadzącego) i obrazy, zanim cokolwiek trafi do AI.
-- Dopisuje typ PPTX do listy dozwolonych typów bucketu 'materials'. Limit rozmiaru pliku bez zmian (0005: 50 MB).
-- Gdy allowed_mime_types jest NULL (bucket przyjmuje każdy typ), nic nie zmieniamy. Idempotentna.
update storage.buckets
set allowed_mime_types = array_append(allowed_mime_types, 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
where id = 'materials'
  and allowed_mime_types is not null
  and not ('application/vnd.openxmlformats-officedocument.presentationml.presentation' = any (allowed_mime_types));
