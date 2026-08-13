/* Level 0 web — engine orchestration: rules + local data -> findings.
 *
 * Port of level0_rules/engine.py and the JSON half of report.py.
 *
 * Everything here is intentionally boring.  The engine's job is to be a
 * transparent, deterministic pipeline, because the value of a Level 0
 * diagnostic is entirely in the customer's ability to believe and reproduce it:
 *
 *     load rules -> load CSVs -> evaluate each rule -> sort -> report
 *
 * A rule that cannot be evaluated (missing table, missing column) is recorded as
 * a *skip with a reason*, never as a silent no-op and never as a crash, so the
 * run always ends with a complete account of what was and was not checked.
 */
(function (root) {
  'use strict';
  var L0 = (root.Level0 = root.Level0 || {});
  var detection = L0.detection;
  var findingModule = L0.finding;

  var TOOL_VERSION = '0.1.0';
  var FINDING_SCHEMA_VERSION = '1.0';

  function EngineResult(fields) {
    this.findings = fields.findings;
    this.evaluatedRules = fields.evaluatedRules;
    this.skippedRules = fields.skippedRules;
    this.datasets = fields.datasets;
    this.ruleIssues = fields.ruleIssues;
  }

  EngineResult.prototype.countsBySeverity = function () {
    var counts = {};
    findingModule.SEVERITIES.forEach(function (severity) { counts[severity] = 0; });
    this.findings.forEach(function (finding) { counts[finding.severity] += 1; });
    return counts;
  };

  EngineResult.prototype.worstSeverity = function () {
    var findings = this.findings;
    for (var i = 0; i < findingModule.SEVERITIES.length; i++) {
      var severity = findingModule.SEVERITIES[i];
      if (findings.some(function (f) { return f.severity === severity; })) return severity;
    }
    return null;
  };

  /**
   * Evaluate every selected rule against the loaded data.  Rules run in
   * rule_id order and findings are sorted at the end, so output ordering never
   * depends on iteration order of anything.
   */
  function runEngine(data, library, module, levels) {
    var findings = [];
    var evaluated = [];
    var skipped = [];

    library.filtered(module, levels).forEach(function (rule) {
      var detector = detection.DETECTORS[rule.detector];
      if (!detector) {
        skipped.push({ rule_id: rule.rule_id, reason: "unknown detector '" + rule.detector + "'" });
        return;
      }
      var produced;
      try {
        produced = detector(rule, data);
      } catch (error) {
        if (error.isDetectorSkip) {
          skipped.push({ rule_id: rule.rule_id, reason: error.message });
          return;
        }
        throw error;
      }
      evaluated.push(rule.rule_id);
      findings = findings.concat(produced);
    });

    return new EngineResult({
      findings: findingModule.sortFindings(findings),
      evaluatedRules: evaluated,
      skippedRules: skipped,
      datasets: data.items().map(function (entry) { return [entry[0], entry[1].rows.length]; }),
      ruleIssues: library.issues.map(function (issue) { return issue.describe(); })
    });
  }

  /**
   * Build the JSON payload: envelope metadata plus section 7.4 findings.
   *
   * The generation timestamp lives only in the envelope, never inside a
   * finding, so two runs over the same data produce byte-identical findings.
   */
  function renderJson(result, dataLabel, rulesLabel, generatedAt) {
    return {
      schema: 'level0.findings',
      schema_version: FINDING_SCHEMA_VERSION,
      tool: 'level0-web',
      tool_version: TOOL_VERSION,
      generated_at: generatedAt === undefined
        ? new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00')
        : generatedAt,
      execution: {
        mode: 'local-only',
        network_calls: 0,
        data_directory: dataLabel,
        rules_directory: rulesLabel,
        datasets: result.datasets.map(function (entry) { return { name: entry[0], rows: entry[1] }; }),
        rules_evaluated: result.evaluatedRules.slice(),
        rules_skipped: result.skippedRules.map(function (item) {
          return { rule_id: item.rule_id, reason: item.reason };
        }),
        rule_load_issues: result.ruleIssues.slice()
      },
      summary: result.countsBySeverity(),
      findings: result.findings.map(function (finding) { return finding.toDict(); })
    };
  }

  L0.engine = {
    TOOL_VERSION: TOOL_VERSION,
    FINDING_SCHEMA_VERSION: FINDING_SCHEMA_VERSION,
    EngineResult: EngineResult,
    runEngine: runEngine,
    renderJson: renderJson
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
