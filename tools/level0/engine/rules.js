/* Level 0 web — JSON rule definitions: model, loading and validation.
 *
 * Port of level0_rules/rules.py.
 *
 * The R&D specification pins Level 0 to "JSON-based rule definitions, modular
 * rule modules, extensible rule library".  The consequence is that rule files
 * are the product's extension point, and therefore its attack surface.  So:
 *
 *   1. A rule file is *data*.  It is parsed with JSON.parse, validated against
 *      the closed schema below and dispatched through fixed registries.  There
 *      is no eval, no new Function, no import-by-name: no path at all from rule
 *      text to executable code.
 *   2. Validation errors are collected per rule rather than thrown, so one
 *      broken rule degrades the run to "one rule rejected, and here is why"
 *      instead of "no diagnostic today".
 *
 * The Python version additionally refuses to read a rule file outside its rules
 * directory.  In the browser there is no filesystem to traverse — rule content
 * arrives as an in-memory object — so that specific guard has no analogue here.
 */
(function (root) {
  'use strict';
  var L0 = (root.Level0 = root.Level0 || {});
  var ops = L0.operators;
  var findingModule = L0.finding;
  var compareText = L0.dataset.compareText;
  var DEFAULT_FULL_SUPPORT_SAMPLES = L0.confidence.DEFAULT_FULL_SUPPORT_SAMPLES;

  var MAX_RULE_FILE_BYTES = 4 * 1024 * 1024;

  var RULE_ID_ALLOWED = /^[A-Z0-9_]+$/;

  var FILE_KEYS = ['schema_version', 'module', 'description', 'rules'];

  var RULE_KEYS = [
    'rule_id', 'title', 'level', 'severity', 'module', 'detector', 'entity', 'key_field',
    'filter', 'condition', 'spec', 'issue', 'business_impact', 'likely_root_cause',
    'recommended_action', 'owner_field', 'source_references', 'affected_objects', 'tags',
    'enabled', 'confidence_full_support_samples'
  ];

  var REQUIRED_RULE_KEYS = [
    'rule_id', 'title', 'level', 'severity', 'detector', 'entity', 'key_field',
    'issue', 'business_impact', 'likely_root_cause', 'recommended_action'
  ];

  var LEVEL_NAMES = { L1: 'completeness', L2: 'consistency', L3: 'rationality' };

  function RuleError(message) {
    var error = new Error(message);
    error.name = 'RuleError';
    error.isRuleError = true;
    return error;
  }

  function Rule(fields) {
    Object.assign(this, fields);
  }

  /**
   * Stable finding id: <RULE_ID>-<KEY>, readable and reproducible.
   *
   * A composite key simply contributes more parts, so an item-per-site rule
   * yields `..._ITM_1003_SITE_02` — still readable in a planning meeting, which
   * is the whole reason ids are not hashes.
   */
  Rule.prototype.findingId = function (keyValues) {
    if (!keyValues || !keyValues.length) return this.rule_id + '-GLOBAL';
    return this.rule_id + '-' + keyValues.map(function (value) {
      return findingModule.slugify(String(value));
    }).join('_');
  };

  /** How the rule's business key is written in evidence text. */
  Rule.prototype.keyLabel = function () {
    return this.key_fields.join('+');
  };

  /** The evidence line that makes a finding traceable back to its rule. */
  Rule.prototype.provenance = function () {
    return 'rule ' + this.rule_id + ' (' + this.level + ' ' + LEVEL_NAMES[this.level] +
      ', detector ' + this.detector + ', source ' + (this.source_file || 'inline') + ')';
  };

  function RuleIssue(source, ruleId, message) {
    this.source = source;
    this.rule_id = ruleId;
    this.message = message;
  }

  RuleIssue.prototype.describe = function () {
    return this.source + ' [' + (this.rule_id || '<file>') + ']: ' + this.message;
  };

  function RuleLibrary(rules, issues, files) {
    this.rules = rules;
    this.issues = issues || [];
    this.files = files || [];
  }

  RuleLibrary.prototype.enabledRules = function () {
    return this.rules.filter(function (rule) { return rule.enabled; });
  };

  RuleLibrary.prototype.byId = function (ruleId) {
    for (var i = 0; i < this.rules.length; i++) {
      if (this.rules[i].rule_id === ruleId) return this.rules[i];
    }
    return null;
  };

  RuleLibrary.prototype.filtered = function (module, levels) {
    var selected = this.enabledRules();
    if (module) {
      selected = selected.filter(function (rule) { return rule.module === module; });
    }
    if (levels && levels.length) {
      var wanted = levels.map(function (level) { return String(level).toUpperCase(); });
      selected = selected.filter(function (rule) { return wanted.indexOf(rule.level) >= 0; });
    }
    return selected;
  };

  /* ---------------------------------------------------------------- loading */

  function listText(values) {
    return '[' + values.slice().sort(compareText).map(function (v) { return "'" + v + "'"; }).join(', ') + ']';
  }

  function readRuleFile(entry) {
    var payload = entry.payload;
    if (payload === undefined) {
      if (typeof entry.text !== 'string') throw RuleError('rule file has no content');
      if (entry.text.length > MAX_RULE_FILE_BYTES) {
        throw RuleError('rule file too large (' + entry.text.length + ' bytes)');
      }
      try {
        payload = JSON.parse(entry.text);
      } catch (error) {
        throw RuleError('invalid JSON: ' + error.message);
      }
    }
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      throw RuleError('rule file must contain a JSON object');
    }
    var unknown = Object.keys(payload).filter(function (key) { return FILE_KEYS.indexOf(key) < 0; });
    if (unknown.length) throw RuleError('unknown top-level keys: ' + listText(unknown));
    if (!Array.isArray(payload.rules)) throw RuleError("rule file must contain a 'rules' array");
    return payload;
  }

  /**
   * Read a `"col"` or `["col_a", "col_b"]` key declaration.
   *
   * Accepting both shapes keeps every existing single-key rule file valid while
   * letting a rule declare the composite key its entity actually has.  A list is
   * ordered and duplicate-free because the order is what the reader sees in the
   * finding_id, and a repeated column would silently weaken the join.
   */
  function parseFieldList(value, where, key) {
    if (typeof value === 'string') {
      if (!value.trim()) throw RuleError(where + ": '" + key + "' must be a non-empty string");
      return [value.trim()];
    }
    if (Array.isArray(value)) {
      if (!value.length) throw RuleError(where + ": '" + key + "' list must not be empty");
      var fields = [];
      value.forEach(function (item) {
        if (typeof item !== 'string' || !item.trim()) {
          throw RuleError(where + ": '" + key + "' list entries must be non-empty strings");
        }
        var name = item.trim();
        if (fields.indexOf(name) >= 0) {
          throw RuleError(where + ": '" + key + "' repeats column '" + name + "'");
        }
        fields.push(name);
      });
      return fields;
    }
    throw RuleError(where + ": '" + key + "' must be a string or a list of strings");
  }

  function requireStr(raw, key, where) {
    var value = raw[key];
    if (typeof value !== 'string' || !value.trim()) {
      throw RuleError(where + ": '" + key + "' must be a non-empty string");
    }
    return value.trim();
  }

  function parseRule(raw, defaultModule, source, index) {
    var where = 'rules[' + index + ']';
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw RuleError(where + ': rule must be an object');
    }
    var unknown = Object.keys(raw).filter(function (key) { return RULE_KEYS.indexOf(key) < 0; });
    if (unknown.length) throw RuleError(where + ': unknown keys ' + listText(unknown));
    REQUIRED_RULE_KEYS.forEach(function (key) {
      if (!(key in raw)) throw RuleError(where + ": missing required key '" + key + "'");
    });

    var ruleId = requireStr(raw, 'rule_id', where);
    if (!RULE_ID_ALLOWED.test(ruleId)) {
      throw RuleError(where + ": rule_id must use A-Z, 0-9 and underscore only (got '" + ruleId + "')");
    }

    var level = requireStr(raw, 'level', where).toUpperCase();
    if (findingModule.LEVELS.indexOf(level) < 0) {
      throw RuleError(where + ': level must be one of ' + JSON.stringify(findingModule.LEVELS));
    }

    var severity = requireStr(raw, 'severity', where).toLowerCase();
    if (findingModule.SEVERITIES.indexOf(severity) < 0) {
      throw RuleError(where + ': severity must be one of ' + JSON.stringify(findingModule.SEVERITIES));
    }

    var module = raw.module || defaultModule;
    if (typeof module !== 'string' || !module.trim()) {
      throw RuleError(where + ": 'module' must be set on the rule or on the file");
    }

    var detector = requireStr(raw, 'detector', where);
    // Resolved lazily: detection.js is loaded after this file, exactly as
    // rules.py imports detection inside the function to avoid a circular import.
    var detection = L0.detection;
    if (!detection.DETECTORS[detector]) {
      throw RuleError(where + ": unknown detector '" + detector + "' (known: " +
        Object.keys(detection.DETECTORS).sort(compareText).join(', ') + ')');
    }

    var spec = raw.spec === undefined ? {} : raw.spec;
    if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
      throw RuleError(where + ": 'spec' must be an object");
    }

    var condition = raw.condition === undefined ? null : raw.condition;
    if (condition !== null) ops.validateCondition(condition, where + '.condition');
    var filterCondition = raw.filter === undefined ? null : raw.filter;
    if (filterCondition !== null) ops.validateCondition(filterCondition, where + '.filter');

    var keyFields = parseFieldList(raw.key_field, where, 'key_field');
    detection.validateDetectorSpec(detector, spec, condition, where, keyFields);

    var affected = [];
    (raw.affected_objects || []).forEach(function (item, position) {
      var at = where + '.affected_objects[' + position + ']';
      if (item === null || typeof item !== 'object' || Array.isArray(item) ||
          Object.keys(item).some(function (k) { return k !== 'label' && k !== 'field'; })) {
        throw RuleError(at + ': expected {label, field}');
      }
      affected.push({ label: requireStr(item, 'label', at), field: requireStr(item, 'field', at) });
    });

    var references = raw.source_references || [];
    if (!Array.isArray(references) || references.some(function (i) { return typeof i !== 'string'; })) {
      throw RuleError(where + ": 'source_references' must be a list of strings");
    }

    var tags = raw.tags || [];
    if (!Array.isArray(tags) || tags.some(function (i) { return typeof i !== 'string'; })) {
      throw RuleError(where + ": 'tags' must be a list of strings");
    }

    var enabled = raw.enabled === undefined ? true : raw.enabled;
    if (typeof enabled !== 'boolean') throw RuleError(where + ": 'enabled' must be a boolean");

    var fullSupport = raw.confidence_full_support_samples === undefined
      ? DEFAULT_FULL_SUPPORT_SAMPLES
      : raw.confidence_full_support_samples;
    if (!Number.isInteger(fullSupport) || fullSupport < 1) {
      throw RuleError(where + ": 'confidence_full_support_samples' must be a positive integer");
    }

    var ownerField = raw.owner_field === undefined ? null : raw.owner_field;
    if (ownerField !== null && (typeof ownerField !== 'string' || !ownerField.trim())) {
      throw RuleError(where + ": 'owner_field' must be a non-empty string or null");
    }

    return new Rule({
      rule_id: ruleId,
      title: requireStr(raw, 'title', where),
      level: level,
      severity: severity,
      module: module.trim(),
      detector: detector,
      entity: requireStr(raw, 'entity', where),
      key_fields: keyFields,
      issue: requireStr(raw, 'issue', where),
      business_impact: requireStr(raw, 'business_impact', where),
      likely_root_cause: requireStr(raw, 'likely_root_cause', where),
      recommended_action: requireStr(raw, 'recommended_action', where),
      spec: spec,
      filter: filterCondition,
      condition: condition,
      owner_field: typeof ownerField === 'string' ? ownerField.trim() : null,
      source_references: references.slice(),
      affected_objects: affected,
      tags: tags.slice(),
      enabled: enabled,
      confidence_full_support_samples: fullSupport,
      source_file: source
    });
  }

  /**
   * Load a rule library from in-memory entries.
   * @param {Array} entries [{name, payload}] or [{name, text}]
   */
  function loadRules(entries) {
    var rules = [];
    var issues = [];
    var files = [];
    var seenIds = new Map();

    (entries || []).slice().sort(function (a, b) { return compareText(a.name, b.name); })
      .forEach(function (entry) {
        var display = entry.name;
        var payload;
        try {
          payload = readRuleFile(entry);
        } catch (error) {
          issues.push(new RuleIssue(display, null, error.message));
          return;
        }
        files.push(display);
        var fileModule = payload.module;
        payload.rules.forEach(function (raw, index) {
          var ruleId = raw && typeof raw === 'object' ? raw.rule_id : null;
          var rule;
          try {
            rule = parseRule(raw, fileModule, display, index);
          } catch (error) {
            if (!error.isRuleError && !error.isConditionError) throw error;
            issues.push(new RuleIssue(display, ruleId, error.message));
            return;
          }
          var previous = seenIds.get(rule.rule_id);
          if (previous !== undefined) {
            // Duplicate ids would make findings ambiguous and untrackable.
            issues.push(new RuleIssue(display, rule.rule_id,
              'duplicate rule_id, already defined in ' + previous));
            return;
          }
          seenIds.set(rule.rule_id, display);
          rules.push(rule);
        });
      });

    rules.sort(function (a, b) { return compareText(a.rule_id, b.rule_id); });
    return new RuleLibrary(rules, issues, files.slice().sort(compareText));
  }

  L0.rules = {
    MAX_RULE_FILE_BYTES: MAX_RULE_FILE_BYTES,
    FILE_KEYS: FILE_KEYS,
    RULE_KEYS: RULE_KEYS,
    REQUIRED_RULE_KEYS: REQUIRED_RULE_KEYS,
    LEVEL_NAMES: LEVEL_NAMES,
    RuleError: RuleError,
    Rule: Rule,
    RuleIssue: RuleIssue,
    RuleLibrary: RuleLibrary,
    parseFieldList: parseFieldList,
    loadRules: loadRules
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
