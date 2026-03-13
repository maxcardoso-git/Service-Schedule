-- CreateTable
CREATE TABLE "conversation_links" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "conversationId" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversation_links_bookingId_key" ON "conversation_links"("bookingId");

-- CreateIndex
CREATE INDEX "conversation_links_conversationId_idx" ON "conversation_links"("conversationId");

-- AddForeignKey
ALTER TABLE "conversation_links" ADD CONSTRAINT "conversation_links_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
