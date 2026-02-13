-- Existing "admin" becomes "superadmin"
ALTER TYPE "Perfil" RENAME VALUE 'admin' TO 'superadmin';

-- New limited admin role
ALTER TYPE "Perfil" ADD VALUE 'admin';
