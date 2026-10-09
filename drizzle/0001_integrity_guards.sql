-- Custom SQL migration file, put your code below! --
-- Application roles are enforced in the server; these triggers also protect
-- immutable records against accidental updates made by future application code.
CREATE FUNCTION sgi_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '23514'; END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION sgi_append_only();
--> statement-breakpoint
CREATE TRIGGER corrections_append_only BEFORE UPDATE OR DELETE ON invoice_corrections FOR EACH ROW EXECUTE FUNCTION sgi_append_only();
--> statement-breakpoint
CREATE FUNCTION sgi_invoice_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('issued', 'void') THEN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Issued invoices cannot be deleted' USING ERRCODE = '23514'; END IF;
    IF OLD.status = 'issued' AND NEW.status = 'void' AND
       (to_jsonb(NEW) - 'status') = (to_jsonb(OLD) - 'status') AND
       EXISTS (SELECT 1 FROM invoice_corrections WHERE invoice_id = OLD.id AND kind = 'void') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Issued invoice details are immutable; use a correction' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER invoice_immutable BEFORE UPDATE OR DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION sgi_invoice_immutable();
--> statement-breakpoint
CREATE FUNCTION sgi_invoice_item_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id text; current_status invoice_status;
BEGIN
  IF TG_OP = 'DELETE' THEN target_id := OLD.invoice_id; ELSE target_id := NEW.invoice_id; END IF;
  SELECT status INTO current_status FROM invoices WHERE id = target_id FOR UPDATE;
  IF current_status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'Only draft invoice items may change' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.invoice_id IS DISTINCT FROM OLD.invoice_id THEN RAISE EXCEPTION 'Invoice item cannot change parent' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER invoice_item_immutable BEFORE INSERT OR UPDATE OR DELETE ON invoice_items FOR EACH ROW EXECUTE FUNCTION sgi_invoice_item_immutable();
--> statement-breakpoint
ALTER TABLE quotations ADD CONSTRAINT quotation_terms_valid CHECK (currency IN ('IDR','USD','SGD') AND tax_bps BETWEEN 0 AND 10000 AND terms_days BETWEEN 0 AND 365 AND status IN ('draft','approved'));
--> statement-breakpoint
ALTER TABLE billable_items ADD CONSTRAINT billable_terms_valid CHECK (currency IN ('IDR','USD','SGD') AND terms_days BETWEEN 0 AND 365 AND eligibility IN ('completion','advance'));
--> statement-breakpoint
ALTER TABLE invoices ADD CONSTRAINT invoice_amount_nonnegative CHECK (subtotal >= 0 AND tax >= 0 AND total >= 0 AND currency IN ('IDR','USD','SGD') AND tax_bps BETWEEN 0 AND 10000 AND terms_days BETWEEN 0 AND 365);
--> statement-breakpoint
ALTER TABLE invoices ADD CONSTRAINT invoice_issued_fields CHECK (status = 'draft' OR (number IS NOT NULL AND issued_at IS NOT NULL AND due_at IS NOT NULL AND customer_snapshot IS NOT NULL));
--> statement-breakpoint
ALTER TABLE invoice_corrections ADD CONSTRAINT correction_kind CHECK (kind IN ('void','credit_note'));
