-- Bootstrap: extensions, schemas and the application role.
-- The application connects as `edventure_app`: a non-owner role WITHOUT BYPASSRLS.
-- Its password and LOGIN attribute are set out-of-band per environment (never in a migration), e.g.
--   ALTER ROLE edventure_app WITH LOGIN PASSWORD '...';

CREATE SCHEMA IF NOT EXISTS extensions;
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS app;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'edventure_app') THEN
    CREATE ROLE edventure_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;
