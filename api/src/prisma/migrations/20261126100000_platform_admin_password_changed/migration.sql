-- Changing the platform admin's password signs out its other devices: tokens issued before
-- password_changed_at are refused by PlatformAuthMiddleware.
ALTER TABLE "platform_admins" ADD COLUMN "password_changed_at" TIMESTAMPTZ(3);
