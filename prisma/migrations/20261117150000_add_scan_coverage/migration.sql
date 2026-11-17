-- Display-only code coverage metrics per scan.
ALTER TABLE "Scan" ADD COLUMN "coverageLine" DOUBLE PRECISION;
ALTER TABLE "Scan" ADD COLUMN "coverageBranch" DOUBLE PRECISION;
ALTER TABLE "Scan" ADD COLUMN "coverageFunction" DOUBLE PRECISION;
ALTER TABLE "Scan" ADD COLUMN "coverageSource" TEXT;
ALTER TABLE "Scan" ADD COLUMN "coverageAt" TIMESTAMP(3);
