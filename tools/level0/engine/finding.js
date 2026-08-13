/* Level 0 web — the Finding Object (strategy document section 7.4).
 *
 * Port of level0_rules/finding.py.  This is the product's output contract:
 * the same thirteen fields, in the same order, with nothing added.  An extra
 * convenience key here becomes a compatibility problem in every downstream
 * consumer, so the shape is deliberately not extended.
 *
 * Section 7.2 traceability is carried inside the standard fields: finding_id
 * starts with the rule id, the first evidence line names the rule, level and
 * detector, and source_references lists both the declared logical sources and
 * the files actually read.
 */
(function (root) {
  'use strict';
  var L0 = (root.Level0 = root.Level0 || {});
  var compareText = L0.dataset.compareText;

  var SEVERITIES = ['high', 'medium', 'low', 'info'];
  var SEVERITY_RANK = {};
  SEVERITIES.forEach(function (name, index) { SEVERITY_RANK[name] = index; });

  var LEVELS = ['L1', 'L2', 'L3'];
  var LEVEL_RANK = {};
  LEVELS.forEach(function (name, index) { LEVEL_RANK[name] = index; });

  var STATUS_OPEN = 'open';

  var SLUG_RE = /[^A-Za-z0-9]+/g;

  /**
   * Stable, readable identifier fragment from a business key.  No hashing:
   * an opaque id cannot be discussed in a planning meeting, and the same item
   * must produce the same finding_id on every run and every machine.
   */
  function slugify(value, maxLength) {
    var limit = maxLength === undefined ? 40 : maxLength;
    var slug = String(value).trim().replace(SLUG_RE, '_').replace(/^_+|_+$/g, '').toUpperCase();
    if (!slug) return 'UNKEYED';
    return slug.slice(0, limit);
  }

  function Finding(fields) {
    this.finding_id = fields.finding_id;
    this.module = fields.module;
    this.severity = fields.severity;
    this.confidence = fields.confidence;
    this.affected_objects = fields.affected_objects;
    this.issue = fields.issue;
    this.evidence = fields.evidence;
    this.business_impact = fields.business_impact;
    this.likely_root_cause = fields.likely_root_cause;
    this.recommended_action = fields.recommended_action;
    this.owner = fields.owner;
    this.source_references = fields.source_references;
    this.status = fields.status === undefined ? STATUS_OPEN : fields.status;

    // Sorting metadata: never serialised, needed for deterministic ordering.
    this.sortLevel = fields.sortLevel === undefined ? 'L1' : fields.sortLevel;
    this.sortRuleId = fields.sortRuleId === undefined ? '' : fields.sortRuleId;

    if (SEVERITY_RANK[this.severity] === undefined) {
      throw new Error("invalid severity '" + this.severity + "'");
    }
    if (!(this.confidence >= 0.0 && this.confidence <= 1.0)) {
      throw new Error('confidence out of range: ' + this.confidence);
    }
  }

  /** Serialise exactly the section 7.4 fields, in the documented order. */
  Finding.prototype.toDict = function () {
    return {
      finding_id: this.finding_id,
      module: this.module,
      severity: this.severity,
      confidence: this.confidence,
      affected_objects: this.affected_objects.slice(),
      issue: this.issue,
      evidence: this.evidence.slice(),
      business_impact: this.business_impact,
      likely_root_cause: this.likely_root_cause,
      recommended_action: this.recommended_action,
      owner: this.owner,
      source_references: this.source_references.slice(),
      status: this.status
    };
  };

  /** Deterministic ordering: severity, then level, then rule, then id. */
  function orderKey(finding) {
    var levelRank = LEVEL_RANK[finding.sortLevel];
    return [
      SEVERITY_RANK[finding.severity],
      levelRank === undefined ? LEVELS.length : levelRank,
      finding.sortRuleId,
      finding.finding_id
    ];
  }

  function sortFindings(findings) {
    return findings.slice().sort(function (a, b) {
      var left = orderKey(a);
      var right = orderKey(b);
      for (var i = 0; i < left.length; i++) {
        if (typeof left[i] === 'number') {
          if (left[i] !== right[i]) return left[i] - right[i];
        } else {
          var cmp = compareText(left[i], right[i]);
          if (cmp !== 0) return cmp;
        }
      }
      return 0;
    });
  }

  L0.finding = {
    SEVERITIES: SEVERITIES,
    SEVERITY_RANK: SEVERITY_RANK,
    LEVELS: LEVELS,
    LEVEL_RANK: LEVEL_RANK,
    STATUS_OPEN: STATUS_OPEN,
    slugify: slugify,
    Finding: Finding,
    orderKey: orderKey,
    sortFindings: sortFindings
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
