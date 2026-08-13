/* Level 0 web — local tabular input: CSV parsing and value coercion.
 *
 * Port of level0_rules/dataset.py.  Deliberately dumb: values stay strings
 * until a rule asks for a number or a date, so the engine never silently
 * reinterprets an ERP export.
 *
 * The one architectural difference from the Python version is the source of
 * the bytes.  Python reads a directory with open(); the browser reads a
 * File object the user picked, via FileReader.  Nothing else changes, and in
 * particular nothing here can reach the network.
 */
(function (root) {
  'use strict';
  var L0 = (root.Level0 = root.Level0 || {});

  var NULL_TOKENS = ['', '-', '--', 'n/a', 'na', 'n.a.', 'null', 'none', 'nil', '#n/a', 'nan', '?'];
  var NULL_TOKEN_SET = Object.create(null);
  NULL_TOKENS.forEach(function (token) { NULL_TOKEN_SET[token] = true; });

  var MAX_CSV_BYTES = 64 * 1024 * 1024;

  /** True when a raw cell should be treated as absent. */
  function isMissing(value) {
    if (value === null || value === undefined) return true;
    return NULL_TOKEN_SET[String(value).trim().toLowerCase()] === true;
  }

  // Accepts an optional sign, digits with an optional decimal point, and an
  // optional exponent. Deliberately stricter than Python's float(): "inf",
  // "nan" and digit-underscore forms are rejected rather than coerced.
  var NUMERIC_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

  /** Coerce a cell to a number, or null when it is not one. */
  function asFloat(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return isFinite(value) ? value : null;
    var text = String(value).trim();
    if (isMissing(text)) return null;
    text = text.replace(/'/g, '').replace(/ /g, '');
    // Only strip commas when they are clearly thousands separators, never when
    // they might be a decimal comma (European exports write 1,5 for 1.5).
    if (text.indexOf(',') >= 0 && text.indexOf('.') >= 0) {
      text = text.replace(/,/g, '');
    } else if (text.indexOf(',') >= 0) {
      text = text.replace(/,/g, '.');
    }
    if (!NUMERIC_RE.test(text)) return null;
    var number = Number(text);
    return isFinite(number) ? number : null;
  }

  // Accepted date encodings, most specific first, mirroring DATE_FORMATS in
  // the Python engine: %Y-%m-%d, %Y/%m/%d, %d.%m.%Y, %d/%m/%Y, %m/%d/%Y.
  var DATE_PATTERNS = [
    { re: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, year: 1, month: 2, day: 3 },
    { re: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, year: 1, month: 2, day: 3 },
    { re: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, year: 3, month: 2, day: 1 },
    { re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, year: 3, month: 2, day: 1 },
    { re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, year: 3, month: 1, day: 2 }
  ];

  var EPOCH_ORDINAL = 719163; // date(1970, 1, 1).toordinal() in Python

  function CivilDate(year, month, day) {
    this.year = year;
    this.month = month;
    this.day = day;
  }

  /** Proleptic Gregorian ordinal, matching Python's date.toordinal(). */
  CivilDate.prototype.toOrdinal = function () {
    var utc = Date.UTC(2000, this.month - 1, this.day);
    var stamp = new Date(utc);
    stamp.setUTCFullYear(this.year);
    return Math.round(stamp.getTime() / 86400000) + EPOCH_ORDINAL;
  };

  CivilDate.prototype.isoformat = function () {
    return String(this.year).padStart(4, '0') + '-' +
      String(this.month).padStart(2, '0') + '-' +
      String(this.day).padStart(2, '0');
  };

  function isRealDate(year, month, day) {
    if (month < 1 || month > 12 || day < 1 || day > 31) return false;
    var utc = Date.UTC(2000, month - 1, day);
    var stamp = new Date(utc);
    stamp.setUTCFullYear(year);
    return stamp.getUTCFullYear() === year &&
      stamp.getUTCMonth() === month - 1 &&
      stamp.getUTCDate() === day;
  }

  /** Coerce a cell to a date, or null when it is not one. */
  function asDate(value) {
    if (value === null || value === undefined) return null;
    var text = String(value).trim();
    if (isMissing(text)) return null;
    text = text.split('T')[0].split(' ')[0];
    for (var i = 0; i < DATE_PATTERNS.length; i++) {
      var pattern = DATE_PATTERNS[i];
      var match = pattern.re.exec(text);
      if (!match) continue;
      var year = Number(match[pattern.year]);
      var month = Number(match[pattern.month]);
      var day = Number(match[pattern.day]);
      if (!isRealDate(year, month, day)) continue;
      return new CivilDate(year, month, day);
    }
    return null;
  }

  function daysBetween(start, end) {
    return end.toOrdinal() - start.toOrdinal();
  }

  /** Bucket a date cell into a sortable period label ("2026-03", "2026-Q1"). */
  function periodKey(value, granularity) {
    var parsed = asDate(value);
    if (parsed === null) return null;
    var year = String(parsed.year).padStart(4, '0');
    if (granularity === 'month') return year + '-' + String(parsed.month).padStart(2, '0');
    if (granularity === 'quarter') return year + '-Q' + (Math.floor((parsed.month - 1) / 3) + 1);
    if (granularity === 'year') return year;
    throw new Error('unsupported period granularity: ' + granularity);
  }

  /** Normalize a join key: trim and case-fold; missing means unjoinable. */
  function normalizeKey(value) {
    if (isMissing(value)) return null;
    return String(value).trim().toLowerCase();
  }

  /**
   * ASCII unit separator: joins the parts of a composite join key.
   *
   * A control character rather than `-` or `|` because ERP identifiers contain
   * every printable separator anyone would reach for, and a key collision
   * between ("AB", "C") and ("A", "BC") would silently join the wrong rows.
   */
  var COMPOSITE_KEY_SEPARATOR = '\x1f';

  /**
   * Build a normalized join key from one or more columns of `row`.
   *
   * Returns null when *any* part is missing.  A partially-populated composite
   * key is not a weaker key, it is an unusable one: joining (ITM-1003, "")
   * against a site-qualified table would match either nothing or everything,
   * and both outcomes produce findings nobody can act on.
   */
  function compositeKey(row, fields) {
    var parts = [];
    for (var i = 0; i < fields.length; i++) {
      var part = normalizeKey(hasOwn(row, fields[i]) ? row[fields[i]] : null);
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join(COMPOSITE_KEY_SEPARATOR);
  }

  /* ---------------------------------------------------------------- CSV */

  /**
   * RFC 4180 parser matching Python's csv module for the dialect it uses:
   * comma delimiter, double-quote quoting, doubled quotes to escape.
   */
  function parseCsvRecords(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // Excel BOM
    var records = [];
    var record = [];
    var field = '';
    var inQuotes = false;
    var i = 0;
    while (i < text.length) {
      var ch = text.charAt(i);
      if (inQuotes) {
        if (ch === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ',') { record.push(field); field = ''; i++; continue; }
      if (ch === '\r' || ch === '\n') {
        if (ch === '\r' && text.charAt(i + 1) === '\n') i++;
        record.push(field);
        records.push(record);
        record = [];
        field = '';
        i++;
        continue;
      }
      field += ch; i++;
    }
    if (field !== '' || record.length > 0) {
      record.push(field);
      records.push(record);
    }
    // Python's csv reader yields [] for a blank line and DictReader skips it.
    return records.filter(function (row) { return !(row.length === 1 && row[0] === ''); });
  }

  function Dataset(name, columns, rows, sourceName) {
    this.name = name;
    this.columns = columns.slice();
    this.rows = rows;
    this.sourceName = sourceName || (name + '.csv');
    this._indexes = new Map();
  }

  Object.defineProperty(Dataset.prototype, 'sourceLabel', {
    get: function () { return this.sourceName; }
  });

  Dataset.prototype.hasColumn = function (column) {
    return this.columns.indexOf(column) >= 0;
  };

  /**
   * Group rows by the trimmed, case-folded value of one or more fields.
   *
   * A list of fields builds a *composite* index, which is what item-per-site
   * and item-per-warehouse rules need: in D365 the same item legitimately
   * carries different settings and different stock per site, so joining on the
   * item alone would either merge unrelated rows or force the customer to add a
   * concatenated key column to their export first.
   *
   * Cached because cross-table rules re-join the same key repeatedly.
   */
  Dataset.prototype.indexBy = function (field) {
    var fields = typeof field === 'string' ? [field] : field.slice();
    var cacheKey = fields.join(COMPOSITE_KEY_SEPARATOR);
    var cached = this._indexes.get(cacheKey);
    if (cached) return cached;
    var index = new Map();
    for (var i = 0; i < this.rows.length; i++) {
      var key = compositeKey(this.rows[i], fields);
      if (key === null) continue;
      var bucket = index.get(key);
      if (!bucket) { bucket = []; index.set(key, bucket); }
      bucket.push(this.rows[i]);
    }
    this._indexes.set(cacheKey, index);
    return index;
  };

  /** Build a Dataset from raw CSV text. */
  function loadCsvText(text, name, sourceName) {
    var records = parseCsvRecords(text);
    if (!records.length) throw new Error('CSV has no header row: ' + (sourceName || name));
    var columns = records[0].map(function (c) { return c.trim(); });
    if (!columns.length) throw new Error('CSV has no header row: ' + (sourceName || name));
    var rows = [];
    for (var r = 1; r < records.length; r++) {
      // Object.create(null) so a hostile column name such as "__proto__"
      // cannot reach Object.prototype.
      var row = Object.create(null);
      for (var c = 0; c < columns.length; c++) {
        var raw = records[r][c];
        row[columns[c]] = raw === undefined || raw === null ? '' : String(raw).trim();
      }
      rows.push(row);
    }
    return new Dataset(name, columns, rows, sourceName);
  }

  function DataBundle(datasets) {
    this._datasets = new Map();
    var self = this;
    (datasets || []).forEach(function (dataset) { self._datasets.set(dataset.name, dataset); });
  }

  DataBundle.prototype.get = function (name) {
    return this._datasets.get(name) || null;
  };

  DataBundle.prototype.has = function (name) {
    return this._datasets.has(name);
  };

  Object.defineProperty(DataBundle.prototype, 'names', {
    get: function () {
      return Array.from(this._datasets.keys()).sort(compareText);
    }
  });

  /** [name, dataset] pairs sorted by name, matching DataBundle.items(). */
  DataBundle.prototype.items = function () {
    var self = this;
    return this.names.map(function (name) { return [name, self._datasets.get(name)]; });
  };

  /** Byte-wise string ordering, mirroring Python's default string sort. */
  function compareText(a, b) {
    return a < b ? -1 : (a > b ? 1 : 0);
  }

  /**
   * Own-key membership, the equivalent of Python's `key in dict`.
   *
   * Deliberately not the `in` operator: `in` walks the prototype chain, so a
   * rule referencing a column called "constructor" or "toString" would resolve
   * against Object.prototype and silently produce a bogus value instead of an
   * honest "unresolved field".
   */
  function hasOwn(object, key) {
    return object !== null && object !== undefined &&
      Object.prototype.hasOwnProperty.call(object, key);
  }

  L0.dataset = {
    NULL_TOKENS: NULL_TOKENS,
    MAX_CSV_BYTES: MAX_CSV_BYTES,
    isMissing: isMissing,
    asFloat: asFloat,
    asDate: asDate,
    daysBetween: daysBetween,
    periodKey: periodKey,
    normalizeKey: normalizeKey,
    COMPOSITE_KEY_SEPARATOR: COMPOSITE_KEY_SEPARATOR,
    compositeKey: compositeKey,
    parseCsvRecords: parseCsvRecords,
    loadCsvText: loadCsvText,
    Dataset: Dataset,
    DataBundle: DataBundle,
    compareText: compareText,
    hasOwn: hasOwn
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
