-- Partial unique index: only one active booking per (professional, start_time) slot.
-- CANCELLED, COMPLETED, NO_SHOW bookings are excluded — they don't block future bookings.
-- Note: column names use camelCase because this database was created via prisma db push
-- without explicit @map attributes, so Prisma preserved the camelCase field names.
CREATE UNIQUE INDEX "bookings_active_slot_unique"
  ON "bookings" ("professionalId", "startTime")
  WHERE status IN ('PRE_RESERVED', 'CONFIRMED');
