-- Ledger integrity (append-only + balanced at commit), wallet guard, and trigram search indexes.
-- Enforces: ledger lines are append-only, and every entry balances at commit time.

CREATE OR REPLACE FUNCTION ledger_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Ledger tables are append-only';
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_line_immutable ON "LedgerLine";
CREATE TRIGGER ledger_line_immutable BEFORE UPDATE OR DELETE ON "LedgerLine"
  FOR EACH ROW EXECUTE FUNCTION ledger_block_mutation();

DROP TRIGGER IF EXISTS ledger_entry_immutable ON "LedgerEntry";
CREATE TRIGGER ledger_entry_immutable BEFORE UPDATE OR DELETE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION ledger_block_mutation();

CREATE OR REPLACE FUNCTION ledger_check_balanced() RETURNS trigger AS $$
DECLARE d bigint; c bigint;
BEGIN
  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0) INTO d, c FROM "LedgerLine" WHERE "entryId" = NEW."entryId";
  IF d <> c THEN RAISE EXCEPTION 'Unbalanced ledger entry %: % vs %', NEW."entryId", d, c; END IF;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_line_balanced ON "LedgerLine";
CREATE CONSTRAINT TRIGGER ledger_line_balanced AFTER INSERT ON "LedgerLine"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ledger_check_balanced();

ALTER TABLE "Wallet" ADD CONSTRAINT wallet_non_negative CHECK ("balanceKobo" >= 0 AND "heldKobo" >= 0 AND "heldKobo" <= "balanceKobo");

-- Fast admin member search (name, phone, membership number).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS member_search_trgm ON "Member" USING gin ("searchText" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS transaction_ref_trgm ON "Transaction" USING gin ("reference" gin_trgm_ops);
