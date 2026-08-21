-- The product gauge (score) is derived from the chart, and part of that derivation
-- reads the current luck pillars (대운/세운). The same person therefore scores
-- differently once the year turns. That is correct for a luck index, but a reading
-- that has already been sold must keep the number it was sold with.
--
-- Until now only the bare number lived in lr_readings; the band label and the
-- per-factor evidence existed solely inside the sealed blob held by the browser.
-- Clearing local storage or opening the reading on another device lost them, and
-- there was no record of which luck window produced the number.
--
-- score_seal stores the whole issuance-time snapshot: value, band index and label,
-- the factor list with its evidence, the luck window it was read under (asOf), and
-- the scoring engine version. Reads never recompute; they read this column.
--
-- Rows created before this migration keep score/score_label and get a null seal.
-- Callers fall back to those columns, so their numbers are unchanged.
alter table public.lr_readings
  add column score_seal jsonb;

alter table public.lr_readings
  add constraint lr_readings_score_seal_object
    check (score_seal is null or jsonb_typeof(score_seal) = 'object');

comment on column public.lr_readings.score_seal is
  'Issuance-time snapshot of the product gauge: value, band, factors, the luck window it was computed under, and the engine version. Immutable once written; never recomputed on read.';
