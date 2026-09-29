CREATE TYPE "MediaStorage" AS ENUM ('LOCAL', 'CLOUDINARY');
ALTER TABLE "Asset" ADD COLUMN "storageProvider" "MediaStorage" NOT NULL DEFAULT 'LOCAL';
