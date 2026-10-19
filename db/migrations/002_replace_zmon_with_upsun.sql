-- Replace ZMON (#52) with Upsun Cloud Application Platform.
-- Safe to run more than once: the title guard makes reruns a no-op and
-- leaves row 52 untouched if it was already edited or deleted.

UPDATE technologies
   SET title = 'Upsun Cloud Application Platform',
       description = 'Upsun''s cloud application platform for building, running and scaling web applications and their services from Git-driven, reproducible environments.'
 WHERE number = 52 AND title = 'ZMON';
