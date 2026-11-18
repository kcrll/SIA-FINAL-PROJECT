-- Split users.full_name into first_name + last_name.
-- Splits on the first space: "Juan Dela Cruz" -> first_name = "Juan", last_name = "Dela Cruz".
-- Single-word names (e.g. "Administrator") get an empty last_name.
-- Run against the `ani` database (phpMyAdmin or: mysql -u root ani < this-file).

ALTER TABLE users
  ADD COLUMN first_name VARCHAR(100) NOT NULL AFTER id,
  ADD COLUMN last_name  VARCHAR(100) NOT NULL DEFAULT '' AFTER first_name;

UPDATE users
SET first_name = TRIM(SUBSTRING_INDEX(full_name, ' ', 1)),
    last_name  = TRIM(CASE
        WHEN LOCATE(' ', full_name) > 0
        THEN SUBSTRING(full_name, LOCATE(' ', full_name) + 1)
        ELSE ''
    END);

ALTER TABLE users DROP COLUMN full_name;
