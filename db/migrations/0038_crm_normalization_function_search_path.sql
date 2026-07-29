-- Harden CRM normalization helpers used by triggers and security-sensitive matching.
alter function public.crm_normalize_identity_ascii(text)
  set search_path = public;

alter function public.crm_normalize_email(text)
  set search_path = public;

alter function public.crm_normalize_phone(text)
  set search_path = public;

alter function public.crm_apply_contact_normalization()
  set search_path = public;
