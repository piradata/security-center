ALTER TABLE "Job"
ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Export"
ADD COLUMN "filename" TEXT,
ADD COLUMN "contentType" TEXT,
ADD COLUMN "byteSize" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "issueCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "Export"
SET "filename" = regexp_replace("filePath", '^.*/', ''),
    "contentType" = CASE
      WHEN "format" = 'csv' THEN 'text/csv; charset=utf-8'
      ELSE 'application/json; charset=utf-8'
    END;

ALTER TABLE "Export"
ALTER COLUMN "filename" SET NOT NULL,
ALTER COLUMN "contentType" SET NOT NULL,
ALTER COLUMN "byteSize" DROP DEFAULT,
ALTER COLUMN "issueCount" DROP DEFAULT;
