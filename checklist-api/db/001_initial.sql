CREATE SCHEMA IF NOT EXISTS checklist;
SET search_path TO checklist, public;
CREATE TABLE agency (id text PRIMARY KEY, name text NOT NULL, website_url text NOT NULL);
CREATE TABLE category (id text PRIMARY KEY, name text NOT NULL);
CREATE TABLE service (slug text PRIMARY KEY, agency_id text REFERENCES agency(id), category_id text REFERENCES category(id), published_revision_id uuid, retired_at timestamptz);
CREATE TABLE service_revision (
  id uuid PRIMARY KEY, service_slug text NOT NULL REFERENCES service(slug), rev_no integer NOT NULL,
  status text NOT NULL CHECK(status IN ('DRAFT','PUBLISHED')), content_hash text NOT NULL,
  title text NOT NULL, summary text NOT NULL, processing_time text NOT NULL, handling_unit text NOT NULL,
  payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(service_slug,rev_no), UNIQUE(service_slug,content_hash)
);
ALTER TABLE service ADD CONSTRAINT published_revision_fk FOREIGN KEY(published_revision_id) REFERENCES service_revision(id);
CREATE TABLE mode (revision_id uuid REFERENCES service_revision(id), code text NOT NULL, label text NOT NULL, allowed boolean NOT NULL, allowed_when jsonb, disallowed_reason text, PRIMARY KEY(revision_id,code));
CREATE TABLE party (revision_id uuid REFERENCES service_revision(id), code text NOT NULL, label text NOT NULL, sort integer NOT NULL, PRIMARY KEY(revision_id,code));
CREATE TABLE document (code text PRIMARY KEY, name text NOT NULL);
CREATE TABLE question (revision_id uuid REFERENCES service_revision(id), code text NOT NULL, definition jsonb NOT NULL, PRIMARY KEY(revision_id,code));
CREATE TABLE requirement_group (revision_id uuid REFERENCES service_revision(id), id text NOT NULL, rule text CHECK(rule IN ('ALL_OF','ONE_OF','AT_LEAST_N')), label text NOT NULL, min_count integer, PRIMARY KEY(revision_id,id));
CREATE TABLE requirement_item (
  revision_id uuid REFERENCES service_revision(id), item_key text NOT NULL, document_code text REFERENCES document(code),
  party_code text NOT NULL, kind text CHECK(kind IN ('DOCUMENT','ACTION','PERSON','FEE')),
  modes text[] NOT NULL, form text NOT NULL, quantity integer CHECK(quantity>0), condition jsonb,
  group_id text, definition jsonb NOT NULL, PRIMARY KEY(revision_id,item_key),
  FOREIGN KEY(revision_id,party_code) REFERENCES party(revision_id,code),
  FOREIGN KEY(revision_id,group_id) REFERENCES requirement_group(revision_id,id)
);
CREATE TABLE source_ref (revision_id uuid REFERENCES service_revision(id), id text NOT NULL, url text NOT NULL, title text NOT NULL, clause text NOT NULL, verified_at date NOT NULL, updated_at date NOT NULL, sha256 text NOT NULL, PRIMARY KEY(revision_id,id));
CREATE TABLE item_source (revision_id uuid NOT NULL, item_key text NOT NULL, source_id text NOT NULL, PRIMARY KEY(revision_id,item_key,source_id), FOREIGN KEY(revision_id,item_key) REFERENCES requirement_item(revision_id,item_key), FOREIGN KEY(revision_id,source_id) REFERENCES source_ref(revision_id,id));
CREATE TABLE keyword (service_slug text REFERENCES service(slug), term text NOT NULL, PRIMARY KEY(service_slug,term));
CREATE TABLE snapshot (version bigint PRIMARY KEY, sha256 text NOT NULL, service_count integer NOT NULL, created_at timestamptz DEFAULT now());
CREATE FUNCTION reject_published_changes() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE rid uuid;
BEGIN
  IF TG_TABLE_NAME = 'service_revision' THEN
    IF OLD.status = 'PUBLISHED' THEN RAISE EXCEPTION 'published revisions are immutable'; END IF;
  ELSE
    IF TG_OP = 'INSERT' THEN rid := NEW.revision_id; ELSE rid := OLD.revision_id; END IF;
    IF EXISTS(SELECT 1 FROM checklist.service_revision WHERE id=rid AND status='PUBLISHED') THEN RAISE EXCEPTION 'published content is immutable'; END IF;
    IF TG_OP = 'UPDATE' AND NEW.revision_id <> OLD.revision_id AND EXISTS(SELECT 1 FROM checklist.service_revision WHERE id=NEW.revision_id AND status='PUBLISHED') THEN RAISE EXCEPTION 'published content is immutable'; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER immutable_revision BEFORE UPDATE OR DELETE ON service_revision FOR EACH ROW EXECUTE FUNCTION reject_published_changes();
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['mode','party','question','requirement_group','requirement_item','source_ref','item_source'] LOOP
    EXECUTE format('CREATE TRIGGER immutable_content BEFORE INSERT OR UPDATE OR DELETE ON checklist.%I FOR EACH ROW EXECUTE FUNCTION checklist.reject_published_changes()',t);
  END LOOP;
END $$;
