-- Phase: Marketplace Listing Approval Gate (Part 1 of 2)
ALTER TYPE "ProductStatus" ADD VALUE IF NOT EXISTS 'pending_review';
ALTER TYPE "ProductStatus" ADD VALUE IF NOT EXISTS 'rejected';