-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'RECEPTIONIST');

-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "role" "AdminRole" NOT NULL DEFAULT 'ADMIN';
