-- ===========================================================================
-- Remove the HL7 FHIR interoperability pipeline
-- ===========================================================================
--
-- Reverses 20261019000000_fhir_interoperability.sql. The fhir-export Edge
-- Function, the Interoperability and Audit Log pages, and the shared FHIR
-- serializer were removed from the app in the same change.
--
-- The append-only triggers on interop_audit_log refuse UPDATE, DELETE and
-- TRUNCATE, but not DROP TABLE, so the table can be dropped directly. A final
-- export of both tables (ciphertext columns excluded) was taken before this
-- ran.
--
-- pgcrypto stays: other objects in the database use it.
-- ===========================================================================

drop function if exists public.interop_payload(uuid);
drop function if exists public.verify_interop_audit();
drop function if exists public.interop_set_credential(uuid, text);
drop function if exists public.interop_endpoint_dispatch(uuid);
drop function if exists public.interop_log_event(
  text, text, uuid, text, text, uuid, text, uuid, text, text, text,
  int, int, text, text, int, text, int, text
);

drop table if exists public.interop_audit_log;
drop table if exists public.interop_endpoints;

drop function if exists public.interop_audit_seal();
drop function if exists public.interop_audit_append_only();
drop function if exists public.interop_record_hash(
  text, bigint, text, uuid, text, uuid, text, text, int, text, timestamptz
);
drop function if exists public.interop_encrypt(text);
drop function if exists public.interop_decrypt(bytea);

-- Holds only the interop payload key and its accessor.
drop schema if exists bantay_private cascade;

notify pgrst, 'reload schema';
