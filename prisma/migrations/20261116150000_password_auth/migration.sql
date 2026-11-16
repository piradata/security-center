-- Replace OIDC/Auth.js adapter storage with local credentials.

ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

DROP TABLE "Account";
DROP TABLE "Session";
DROP TABLE "VerificationToken";
