import { calculate } from './calculator.js';

const STORAGE_KEY = 'small_seller_profit_ledger_h5:v1:records';
const SCHEMA_VERSION = 1;

function emptyEnvelope() {
  return { schemaVersion: SCHEMA_VERSION, records: {} };
}

function createLedgerStorage(storageApi = window.localStorage) {
  function readEnvelope() {
    try {
      const raw = storageApi.getItem(STORAGE_KEY);
      if (!raw) return emptyEnvelope();
      const stored = JSON.parse(raw);
      if (
        !stored ||
        stored.schemaVersion !== SCHEMA_VERSION ||
        !stored.records ||
        typeof stored.records !== 'object'
      ) return emptyEnvelope();
      return stored;
    } catch (_) {
      return emptyEnvelope();
    }
  }

  function writeEnvelope(envelope) {
    storageApi.setItem(STORAGE_KEY, JSON.stringify(envelope));
  }

  function saveMonthlyRecord(rawInput) {
    const result = calculate(rawInput);
    if (!result.valid) {
      const error = new Error(result.errors.join('；'));
      error.validationErrors = result.errors;
      throw error;
    }
    const envelope = readEnvelope();
    const record = {
      month: result.normalized.month,
      input: result.normalized,
      updatedAt: new Date().toISOString()
    };
    envelope.records[record.month] = record;
    writeEnvelope(envelope);
    return { record, result };
  }

  function getMonthlyRecord(month) {
    return readEnvelope().records[month] || null;
  }

  function listMonthlyRecords() {
    const envelope = readEnvelope();
    return Object.keys(envelope.records)
      .sort((a, b) => b.localeCompare(a))
      .map((month) => envelope.records[month]);
  }

  function deleteMonthlyRecord(month) {
    const envelope = readEnvelope();
    if (!envelope.records[month]) return false;
    delete envelope.records[month];
    writeEnvelope(envelope);
    return true;
  }

  return {
    readEnvelope,
    saveMonthlyRecord,
    getMonthlyRecord,
    listMonthlyRecords,
    deleteMonthlyRecord
  };
}

export { STORAGE_KEY, SCHEMA_VERSION, createLedgerStorage };
