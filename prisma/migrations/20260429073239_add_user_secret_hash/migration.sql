ALTER TABLE "User"
ADD COLUMN "secretHash" VARCHAR(255);

UPDATE "User"
SET "secretHash" = CASE
    WHEN length(trim(COALESCE("authSecretHash", ''))) > 0 THEN "authSecretHash"
    ELSE md5(random()::text || clock_timestamp()::text)
END;

ALTER TABLE "User"
ALTER COLUMN "secretHash" SET NOT NULL;

ALTER TABLE "User"
DROP COLUMN "authSecretHash";
