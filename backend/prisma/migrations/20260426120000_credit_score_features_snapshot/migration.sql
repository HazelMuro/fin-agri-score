-- Persist model-facing inputs per score so re-score can detect unchanged inference inputs (e.g. dietary diversity maps to columns outside the deployed pipeline).

ALTER TABLE "CreditScore" ADD COLUMN "featuresSnapshot" JSONB;
