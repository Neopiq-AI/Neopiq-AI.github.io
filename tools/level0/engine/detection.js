/* Level 0 web — the detection engine (strategy document section 5.5).
 *
 * Port of level0_rules/detection.py.  Section 5.5 names ten generic detection
 * functions.  This implements the seven that are honestly computable from local
 * flat files with no model and no cloud:
 *
 *     detect_missing_fields()            L1  completeness
 *     detect_owner_gap()                 L1  completeness / ownership
 *     detect_cross_table_conflict()      L2  consistency across two tables
 *     detect_outlier_parameter()         L3  parameter far from its population
 *     detect_historical_behavior_gap()   L3  configured world vs observed world
 *     detect_kpi_degradation_pattern()   L3  outcome trend over time
 *     detect_process_drift()             L3  behaviour now vs behaviour earlier
 *
 * The remaining three (detect_definition_conflict, detect_report_semantic_gap,
 * detect_design_assumption_risk) all need the Knowledge Layer of section 5.3 —
 * a business glossary, KPI definitions, semantic models, consultant design
 * documents.  Those are documents, not tables.  Stubbing them here would fake
 * coverage, so they are deliberately absent and listed as such in the UI, the
 * README and PARITY.md.
 *
 * Every detector is a pure function of (rule, data) -> findings: no global
 * state, no wall-clock, no ordering surprises.
 */
(function (root) {
  'use strict';
  var L0 = (root.Level0 = root.Level0 || {});
  var ds = L0.dataset;
  var ops = L0.operators;
  var stats = L0.stats;
  var findingModule = L0.finding;
  var computeConfidence = L0.confidence.computeConfidence;

  var RowView = ops.RowView;
  var EvalContext = ops.EvalContext;
  var ConditionResult = ops.ConditionResult;
  var evaluate = ops.evaluate;
  var fmtNumber = stats.fmtNumber;
  var fixed = stats.fixed;

  /**
   * Raised when a rule cannot be evaluated against the data at hand.  This is
   * not an error: an export that lacks `coverage_group` simply cannot be checked
   * for coverage-group consistency.  The engine reports the skip and its reason,
   * which is itself useful output ("your extract is missing the columns needed
   * for 3 of our rules").
   */
  function DetectorSkip(message) {
    var error = new Error(message);
    error.name = 'DetectorSkip';
    error.isDetectorSkip = true;
    return error;
  }

  function ruleError(message) {
    return L0.rules.RuleError(message);
  }

  function listText(values) {
    return '[' + values.map(function (v) { return "'" + v + "'"; }).join(', ') + ']';
  }

  /* ---------------------------------------------------------------- shared helpers */

  function entityOf(rule, data) {
    var dataset = data.get(rule.entity);
    if (dataset === null) {
      throw DetectorSkip("dataset '" + rule.entity + "' not present in the data directory");
    }
    return dataset;
  }

  /**
   * Skip a rule when the export lacks a column the rule fundamentally needs.
   * Reporting "column absent" once, as a skip, is far more useful than emitting
   * one identical finding per row of the table.
   */
  function requireColumns(dataset, columns, why) {
    var absent = columns.filter(function (column) { return column && !dataset.hasColumn(column); });
    if (absent.length) {
      throw DetectorSkip("dataset '" + dataset.name + "' has no column(s) " + listText(absent) + ' (' + why + ')');
    }
  }

  /** Field names in a condition that refer to the primary row (no namespace). */
  function localConditionColumns(condition) {
    if (!condition) return [];
    return ops.conditionFields(condition).filter(function (field) { return field.indexOf('.') < 0; });
  }

  function passesFilter(rule, view, ctx) {
    if (!rule.filter) return true;
    return evaluate(rule.filter, view, ctx).matched;
  }

  /** Normalize an already-validated `"col"` / `["col_a","col_b"]` value. */
  function fieldsOf(value) {
    if (typeof value === 'string') return [value];
    return value.map(function (item) { return String(item); });
  }

  /** The business key of one row, one entry per declared key column. */
  function keyValues(rule, row) {
    return rule.key_fields.map(function (field) {
      var value = ds.hasOwn(row, field) ? row[field] : '';
      return ds.isMissing(value) ? 'UNKEYED' : value;
    });
  }

  /** `item_id=ITM-1003` or `item_id+site_id=ITM-1003+SITE-02` for evidence. */
  function joinLabel(fields, row) {
    return fields.join('+') + '=' + fields.map(function (field) {
      return String(ds.hasOwn(row, field) ? row[field] : '');
    }).join('+');
  }

  function resolveDisplay(view, field) {
    var resolved = view.resolve(field);
    if (!resolved[1] || resolved[0] === null || resolved[0] === undefined) return null;
    if (typeof resolved[0] === 'number') return fmtNumber(resolved[0]);
    var text = String(resolved[0]).trim();
    return ds.isMissing(text) ? null : text;
  }

  /**
   * Assemble the section 7.4 Finding Object for a matched candidate.
   *
   * Confidence is computed here, once, from the single documented model, and its
   * arithmetic is appended as the last evidence line so that no recommendation
   * ever leaves this engine unexplained (section 5.6).
   */
  function buildFinding(rule, candidate) {
    var score = computeConfidence({
      level: rule.level,
      sampleCount: candidate.sampleCount === undefined ? null : candidate.sampleCount,
      fullSupportSamples: rule.confidence_full_support_samples,
      effectMargin: candidate.result.margin,
      incomplete: candidate.result.incomplete
    });

    var affected = [];
    rule.affected_objects.forEach(function (spec) {
      var value = resolveDisplay(candidate.view, spec.field);
      if (value === null) return;
      var text = spec.label + ' ' + value;
      if (affected.indexOf(text) < 0) affected.push(text);
    });
    if (!affected.length) affected.push(rule.entity + ':' + candidate.keyValues[0]);

    var owner = 'unassigned';
    if (rule.owner_field) {
      var resolvedOwner = resolveDisplay(candidate.view, rule.owner_field);
      owner = resolvedOwner === null ? 'unassigned' : resolvedOwner;
    }

    var evidence = [rule.provenance()];
    (candidate.extraEvidence || []).concat(candidate.result.evidence).forEach(function (item) {
      if (evidence.indexOf(item) < 0) evidence.push(item);
    });
    evidence.push(score.asEvidence());

    var references = rule.source_references.slice();
    (candidate.sources || []).forEach(function (source) {
      if (references.indexOf(source) < 0) references.push(source);
    });

    return new findingModule.Finding({
      finding_id: rule.findingId(candidate.keyValues),
      module: rule.module,
      severity: rule.severity,
      confidence: score.value,
      affected_objects: affected,
      issue: rule.issue,
      evidence: evidence,
      business_impact: rule.business_impact,
      likely_root_cause: rule.likely_root_cause,
      recommended_action: rule.recommended_action,
      owner: owner,
      source_references: references,
      sortLevel: rule.level,
      sortRuleId: rule.rule_id
    });
  }

  /* ---------------------------------------------------------------- detect_missing_fields */

  /**
   * Level 1 completeness: row-level checks on a single entity.  Deliberately
   * generic (any condition, not only `missing`) because "the field is empty" and
   * "the field holds a value that is not in the allowed set" are the same class
   * of problem to a data steward, and both are answerable from one table with no
   * inference.
   */
  function detectMissingFields(rule, data) {
    var dataset = entityOf(rule, data);
    if (!rule.condition) throw DetectorSkip('rule has no condition');
    requireColumns(dataset, localConditionColumns(rule.condition), 'referenced by the rule condition');
    requireColumns(dataset, rule.key_fields, 'rule key field(s)');

    var findings = [];
    dataset.rows.forEach(function (row) {
      var view = new RowView(row);
      if (!passesFilter(rule, view)) return;
      var result = evaluate(rule.condition, view);
      if (!result.matched) return;
      findings.push(buildFinding(rule, {
        keyValues: keyValues(rule, row),
        view: view,
        result: result,
        sources: [dataset.sourceLabel]
      }));
    });
    return findings;
  }

  /* ---------------------------------------------------------------- detect_owner_gap */

  /**
   * Level 1: an object with no accountable owner, or an owner who does not
   * exist.  Section 8.4 calls this out as the reusable pattern behind "item
   * without planner" and "Power Platform flow without owner".  An orphaned
   * object is not only a data-quality defect: it means no recommendation this
   * tool produces has anyone to send it to.
   */
  function detectOwnerGap(rule, data) {
    var dataset = entityOf(rule, data);
    var ownerField = String(rule.spec.owner_field);
    requireColumns(dataset, [ownerField].concat(rule.key_fields), 'owner gap detection');

    var referenceSpec = rule.spec.reference;
    var reference = null;
    var referenceIndex = new Map();
    if (referenceSpec) {
      reference = data.get(String(referenceSpec.dataset));
      if (reference === null) {
        throw DetectorSkip("reference dataset '" + referenceSpec.dataset + "' not present");
      }
      var referenceKey = String(referenceSpec.key_field);
      requireColumns(reference, [referenceKey], 'owner reference lookup');
      referenceIndex = reference.indexBy(referenceKey);
    }

    var sources = [dataset.sourceLabel];
    if (reference) sources.push(reference.sourceLabel);

    var findings = [];
    dataset.rows.forEach(function (row) {
      var view = new RowView(row);
      if (!passesFilter(rule, view)) return;
      var rawOwner = ds.hasOwn(row, ownerField) ? row[ownerField] : '';
      var result;
      if (ds.isMissing(rawOwner)) {
        result = new ConditionResult(true, [ownerField + ' = <missing>']);
      } else if (reference !== null && !referenceIndex.has(ds.normalizeKey(rawOwner))) {
        result = new ConditionResult(true, [
          ownerField + ' = ' + String(rawOwner).trim(),
          'no matching record in ' + reference.name + ' (orphan owner reference)'
        ]);
      } else {
        return;
      }
      findings.push(buildFinding(rule, {
        keyValues: keyValues(rule, row),
        view: view,
        result: result,
        sources: sources
      }));
    });
    return findings;
  }

  /* ---------------------------------------------------------------- detect_cross_table_conflict */

  /**
   * Level 2 consistency: join a second table and test the combination.  Covers
   * both shapes — existence ("a purchased item that has a production route",
   * via computed.match_count) and value conflict ("vendor lead time disagrees
   * with item lead time", via alias.field comparisons).  The first matching
   * related row in file order is exposed under the alias, so the evidence quotes
   * a concrete record rather than an aggregate.
   */
  function detectCrossTableConflict(rule, data) {
    var dataset = entityOf(rule, data);
    var relatedSpec = rule.spec.related;
    var relatedName = String(relatedSpec.dataset);
    var related = data.get(relatedName);
    if (related === null) {
      throw DetectorSkip("related dataset '" + relatedName + "' not present in the data directory");
    }

    var relatedKey = fieldsOf(relatedSpec.key_field);
    var localFields = relatedSpec.local_field === undefined
      ? rule.key_fields
      : fieldsOf(relatedSpec.local_field);
    var alias = String(relatedSpec.alias === undefined ? 'related' : relatedSpec.alias);
    var valueField = relatedSpec.value_field;
    var relatedFilter = relatedSpec.filter;

    requireColumns(dataset, rule.key_fields.concat(localFields), 'cross-table join');
    requireColumns(related, relatedKey, 'cross-table join');
    if (valueField) requireColumns(related, [String(valueField)], 'cross-table aggregation');
    requireColumns(dataset, localConditionColumns(rule.condition), 'referenced by the rule condition');

    var index = related.indexBy(relatedKey);
    var sources = [dataset.sourceLabel, related.sourceLabel];

    var findings = [];
    dataset.rows.forEach(function (row) {
      var key = ds.compositeKey(row, localFields);
      var matches = key === null ? [] : (index.get(key) || []);
      if (relatedFilter) {
        matches = matches.filter(function (match) {
          return evaluate(relatedFilter, new RowView(match)).matched;
        });
      }

      var computed = new Map();
      computed.set('match_count', matches.length);
      if (valueField) {
        var values = matches
          .map(function (match) { return ds.asFloat(match[String(valueField)]); })
          .filter(function (v) { return v !== null; });
        computed.set('match_sum', stats.fsum(values));
      }
      var namespaces = new Map();
      namespaces.set(alias, matches.length ? matches[0] : null);
      var view = new RowView(row, namespaces, computed);

      if (!passesFilter(rule, view)) return;
      var result = evaluate(rule.condition, view);
      if (!result.matched) return;

      var extra = ['related records in ' + related.name + ' matching ' +
        joinLabel(localFields, row) + ': ' + matches.length];
      if (valueField) {
        extra.push('sum(' + valueField + ') over matched ' + related.name + ' rows = ' +
          fmtNumber(computed.get('match_sum')));
      }
      findings.push(buildFinding(rule, {
        keyValues: keyValues(rule, row),
        view: view,
        result: result,
        extraEvidence: extra,
        sources: sources
      }));
    });
    return findings;
  }

  /* ---------------------------------------------------------------- detect_outlier_parameter */

  /**
   * Level 3: a configured parameter far outside its own population.  The
   * comparison population is the customer's own data (optionally grouped),
   * never an external benchmark — Level 0 has no way to obtain one, and a
   * peer-group comparison inside the same ERP is the argument a planner will
   * accept anyway ("why is this one item 6 sigma off your other purchased
   * parts?").
   */
  function detectOutlierParameter(rule, data) {
    var dataset = entityOf(rule, data);
    var field = String(rule.spec.field);
    var groupBy = rule.spec.group_by;
    var minGroupSize = rule.spec.min_group_size === undefined ? 5 : Math.trunc(rule.spec.min_group_size);

    requireColumns(dataset, [field].concat(rule.key_fields), 'outlier detection');
    if (groupBy) requireColumns(dataset, [String(groupBy)], 'outlier grouping');

    // Population is built from the rows the filter admits, so an "active
    // purchased items" rule is not skewed by obsolete or manufactured items.
    var groups = new Map();
    dataset.rows.forEach(function (row) {
      if (!passesFilter(rule, new RowView(row))) return;
      var group = groupBy ? String(row[String(groupBy)] === undefined ? '' : row[String(groupBy)]).trim() : '__all__';
      var bucket = groups.get(group);
      if (!bucket) { bucket = []; groups.set(group, bucket); }
      bucket.push(row);
    });

    var findings = [];
    Array.from(groups.keys()).sort(ds.compareText).forEach(function (group) {
      var rows = groups.get(group);
      var values = rows
        .map(function (row) { return ds.asFloat(row[field]); })
        .filter(function (value) { return value !== null; });
      if (values.length < minGroupSize) {
        // Too few peers for "unusual" to mean anything.  Silently skipping is
        // correct here: it is a property of the group, not of the rule.
        return;
      }
      var baseline = stats.buildBaseline(values, field, group === '__all__' ? null : group);
      if (baseline === null) return;
      var ctx = new EvalContext(baseline);
      rows.forEach(function (row) {
        var computed = new Map();
        computed.set('group_size', values.length);
        var view = new RowView(row, new Map(), computed);
        var result = evaluate(rule.condition, view, ctx);
        if (!result.matched) return;
        findings.push(buildFinding(rule, {
          keyValues: keyValues(rule, row),
          view: view,
          result: result,
          sampleCount: values.length,
          extraEvidence: ['peer population: ' + values.length + ' rows' +
            (groupBy ? ' in ' + groupBy + '=' + group : ' (whole table)')],
          sources: [dataset.sourceLabel]
        }));
      });
    });
    return findings;
  }

  /* ---------------------------------------------------------------- detect_historical_behavior_gap */

  var METRICS = {
    count: function (values) { return values.length; },
    sum: function (values) { return values.length ? stats.fsum(values) : null; },
    mean: stats.mean,
    median: stats.median,
    min: function (values) { return values.length ? Math.min.apply(null, values) : null; },
    max: function (values) { return values.length ? Math.max.apply(null, values) : null; },
    stdev: stats.stdev,
    cv: stats.coefficientOfVariation
  };

  var PERIOD_METRICS = ['mean_by_period', 'stdev_by_period', 'cv_by_period', 'sum_by_period'];

  var METRIC_NAMES = Object.keys(METRICS).concat(PERIOD_METRICS).sort(ds.compareText);

  var DERIVED_FORMULAS = ['normal_service_buffer'];

  /**
   * Build the function that turns one observation row into a number.
   *
   * `days_between` exists because the single most valuable Level 0 metric —
   * actual replenishment lead time — is a duration between two dates, and real
   * D365 receipt exports carry the dates, not the duration.  Requiring the
   * customer to add a derived column in Excel first would defeat the "zero
   * friction" premise of the tier.
   */
  function makeValueReader(spec) {
    var daysBetween = spec.days_between;
    var valueField = spec.value_field;
    return function (row) {
      if (daysBetween) {
        var start = ds.asDate(row[String(daysBetween[0])]);
        var end = ds.asDate(row[String(daysBetween[1])]);
        if (start === null || end === null) return null;
        return ds.daysBetween(start, end);
      }
      return ds.asFloat(row[String(valueField)]);
    };
  }

  /** What one observation row contributes, in words, for evidence text. */
  function measuredLabel(spec) {
    if (spec.days_between) {
      return 'days between ' + spec.days_between[0] + ' and ' + spec.days_between[1];
    }
    return String(spec.value_field === undefined ? 'rows' : spec.value_field);
  }

  /**
   * Aggregate an observation table per business key.
   * Returns [dataset, Map(key -> {value, sampleCount, periodCount})].
   */
  function observe(rule, data, spec) {
    var datasetName = String(spec.dataset);
    var observations = data.get(datasetName);
    if (observations === null) {
      throw DetectorSkip("observation dataset '" + datasetName + "' not present in the data directory");
    }

    var keyFields = fieldsOf(spec.key_field);
    var metric = String(spec.metric);
    var valueField = spec.value_field;
    var daysBetween = spec.days_between;
    var periodField = spec.period_field;
    var granularity = String(spec.period === undefined ? 'month' : spec.period);
    var rowFilter = spec.filter;

    var needed = keyFields.slice();
    if (valueField) needed.push(String(valueField));
    if (daysBetween) daysBetween.forEach(function (name) { needed.push(String(name)); });
    if (PERIOD_METRICS.indexOf(metric) >= 0) needed.push(String(periodField));
    requireColumns(observations, needed, "observation metric '" + metric + "'");

    var observedValue = makeValueReader(spec);

    var buckets = new Map();
    observations.rows.forEach(function (row) {
      var key = ds.compositeKey(row, keyFields);
      if (key === null) return;
      if (rowFilter && !evaluate(rowFilter, new RowView(row)).matched) return;
      var bucket = buckets.get(key);
      if (!bucket) { bucket = []; buckets.set(key, bucket); }
      bucket.push(row);
    });

    var results = new Map();
    buckets.forEach(function (rows, key) {
      if (metric === 'count') {
        results.set(key, { value: rows.length, sampleCount: rows.length, periodCount: 0 });
        return;
      }
      var values = rows.map(observedValue).filter(function (value) { return value !== null; });
      if (PERIOD_METRICS.indexOf(metric) >= 0) {
        var perPeriod = new Map();
        rows.forEach(function (row) {
          var period = ds.periodKey(row[String(periodField)], granularity);
          var number = observedValue(row);
          if (period === null || number === null) return;
          perPeriod.set(period, (perPeriod.get(period) || 0) + number);
        });
        var series = Array.from(perPeriod.keys()).sort(ds.compareText).map(function (period) {
          return perPeriod.get(period);
        });
        var baseMetric = metric.replace('_by_period', '');
        results.set(key, {
          value: METRICS[baseMetric](series),
          sampleCount: values.length,
          periodCount: series.length
        });
        return;
      }
      results.set(key, { value: METRICS[metric](values), sampleCount: values.length, periodCount: 0 });
    });
    return [observations, results];
  }

  /** Evaluate named formulas (never expressions) into the computed namespace. */
  function applyDerived(derivedSpecs, view, computed) {
    var notes = [];
    derivedSpecs.forEach(function (spec) {
      var name = String(spec.name);
      var formula = String(spec.formula);
      var params = spec.params || {};
      if (formula !== 'normal_service_buffer') {
        throw ruleError("unknown derived formula '" + formula + "'");
      }
      var sigmaSource = String(params.sigma_source === undefined ? 'observed' : params.sigma_source);
      var sigma = computed.has(sigmaSource) ? computed.get(sigmaSource) : null;
      var leadTimeField = String(params.lead_time_field);
      var leadTimeValue = ds.asFloat(view.resolve(leadTimeField)[0]);
      var periodDays = Number(params.period_days === undefined ? 30 : params.period_days);
      var serviceZ = Number(params.service_z === undefined ? 1.64 : params.service_z);
      if (sigma === null || sigma === undefined || leadTimeValue === null) {
        computed.set(name, null);
        notes.push(name + ' could not be computed (missing sigma or ' + leadTimeField + ')');
        return;
      }
      var value = stats.normalServiceBuffer(sigma, leadTimeValue, periodDays, serviceZ);
      computed.set(name, value);
      notes.push(name + ' = z(' + fmtNumber(serviceZ) + ') * sigma(' + fmtNumber(sigma) + ') * sqrt(' +
        fmtNumber(leadTimeValue) + '/' + fmtNumber(periodDays) + ') = ' + fmtNumber(value));
    });
    return notes;
  }

  /**
   * Level 3: the configured world versus the observed world.
   *
   * This is the detector behind the strategy document's headline example —
   * configured lead time 30 days, actual receipt behaviour ~70 days, safety
   * stock zero — and it is the whole reason the product claims to answer *why*
   * a system behaves wrongly rather than only whether a field is blank.
   *
   * `spec.extra_observations` aggregates *further* tables under the same key and
   * publishes each as `computed.<expose_as>`.  That exists because some of the
   * questions section 6.1 asks — "are forecast and demand behaviour aligned?" —
   * compare two observed worlds with no configured field in between.  Only the
   * primary observation feeds the confidence sample-support term.  An extra
   * observation with too few rows for a key resolves to nothing: a comparison
   * against it is *undetermined* rather than false, so it can never manufacture
   * a finding, and the evidence names the value that could not be observed
   * instead of leaving the reader to assume everything was checked.
   */
  function detectHistoricalBehaviorGap(rule, data) {
    var dataset = entityOf(rule, data);
    var spec = rule.spec.observation;
    var minSamples = spec.min_samples === undefined ? 3 : Math.trunc(spec.min_samples);
    var exposeAs = String(rule.spec.expose_as === undefined ? 'observed' : rule.spec.expose_as);
    var derivedSpecs = rule.spec.derived || [];
    var extraSpecs = rule.spec.extra_observations || [];
    var localFields = spec.local_field === undefined ? rule.key_fields : fieldsOf(spec.local_field);

    requireColumns(dataset, rule.key_fields.concat(localFields), 'behaviour gap join');
    requireColumns(dataset, localConditionColumns(rule.condition), 'referenced by the rule condition');

    var observed = observe(rule, data, spec);
    var observations = observed[0];
    var aggregated = observed[1];
    var sources = [dataset.sourceLabel, observations.sourceLabel];

    // Aggregate every extra observation once, before the row loop.
    var extras = [];
    extraSpecs.forEach(function (extraSpec) {
      var name = String(extraSpec.expose_as);
      var local = extraSpec.local_field === undefined ? rule.key_fields : fieldsOf(extraSpec.local_field);
      requireColumns(dataset, local, "extra observation '" + name + "' join");
      var extraObserved = observe(rule, data, extraSpec);
      extras.push({
        name: name,
        spec: extraSpec,
        localFields: local,
        dataset: extraObserved[0],
        aggregated: extraObserved[1]
      });
      if (sources.indexOf(extraObserved[0].sourceLabel) < 0) sources.push(extraObserved[0].sourceLabel);
    });

    var findings = [];
    dataset.rows.forEach(function (row) {
      var key = ds.compositeKey(row, localFields);
      if (key === null) return;
      var entry = aggregated.get(key);
      if (entry === undefined) return;
      if (entry.value === null || entry.sampleCount < minSamples) {
        // Not enough observed behaviour to claim a gap.  Staying silent is the
        // honest option; a low-confidence guess would be noise.
        return;
      }

      var computed = new Map();
      computed.set(exposeAs, entry.value);
      computed.set('sample_count', entry.sampleCount);
      computed.set('period_count', entry.periodCount);

      var extraNotes = [];
      extras.forEach(function (extraItem) {
        var extraKey = ds.compositeKey(row, extraItem.localFields);
        var entryForKey = extraKey === null ? undefined : extraItem.aggregated.get(extraKey);
        var minimum = extraItem.spec.min_samples === undefined ? 1 : Math.trunc(extraItem.spec.min_samples);
        if (entryForKey === undefined || entryForKey.value === null || entryForKey.sampleCount < minimum) {
          computed.set(extraItem.name, null);
          computed.set(extraItem.name + '_sample_count', 0);
          extraNotes.push(extraItem.name + ' could not be observed: fewer than ' + minimum +
            ' usable ' + extraItem.dataset.name + ' rows for this key');
          return;
        }
        computed.set(extraItem.name, entryForKey.value);
        computed.set(extraItem.name + '_sample_count', entryForKey.sampleCount);
        extraNotes.push('observed ' + extraItem.spec.metric + '(' + measuredLabel(extraItem.spec) +
          ') over ' + entryForKey.sampleCount + ' ' + extraItem.dataset.name + ' rows = ' +
          fmtNumber(entryForKey.value) + ' (exposed as computed.' + extraItem.name + ')');
      });

      var view = new RowView(row, new Map(), computed);
      var notes = applyDerived(derivedSpecs, view, computed);
      view = new RowView(row, new Map(), computed);

      if (!passesFilter(rule, view)) return;
      var result = evaluate(rule.condition, view);
      if (!result.matched) return;

      var extra = ['observed ' + spec.metric + '(' + measuredLabel(spec) + ') over ' +
        entry.sampleCount + ' ' + observations.name + ' rows = ' + fmtNumber(entry.value)];
      if (entry.periodCount) extra.push('observation periods = ' + entry.periodCount);
      extra = extra.concat(extraNotes).concat(notes);

      findings.push(buildFinding(rule, {
        keyValues: keyValues(rule, row),
        view: view,
        result: result,
        sampleCount: entry.sampleCount,
        extraEvidence: extra,
        sources: sources
      }));
    });
    return findings;
  }

  /* ---------------------------------------------------------------- detect_kpi_degradation_pattern */

  /**
   * Level 3: an outcome KPI that is measurably worse in the recent half.
   *
   * Level 0 cannot do time-series modelling, and pretending otherwise would be
   * dishonest.  What it can do is split the available periods into an earlier
   * and a later half and compare the success share of each — a comparison anyone
   * can reproduce in Excel, which is exactly the standard of auditability that
   * section 5.6 asks for.  The middle period of an odd-length series is dropped
   * so the split carries no tie-breaking bias.
   */
  function detectKpiDegradationPattern(rule, data) {
    var dataset = entityOf(rule, data);
    var spec = rule.spec.observation;
    var observations = data.get(String(spec.dataset));
    if (observations === null) {
      throw DetectorSkip("observation dataset '" + spec.dataset + "' not present in the data directory");
    }

    var keyFields = fieldsOf(spec.key_field);
    var periodField = String(spec.period_field);
    var granularity = String(spec.period === undefined ? 'month' : spec.period);
    var successCondition = spec.success_condition;
    var minPeriods = spec.min_periods === undefined ? 4 : Math.trunc(spec.min_periods);
    var minSamples = spec.min_samples === undefined ? 6 : Math.trunc(spec.min_samples);
    var localFields = spec.local_field === undefined ? rule.key_fields : fieldsOf(spec.local_field);
    var rowFilter = spec.filter;

    requireColumns(dataset, rule.key_fields.concat(localFields), 'kpi trend join');
    requireColumns(observations, keyFields.concat([periodField]), 'kpi trend aggregation');

    // key -> period -> [successes, total]
    var tally = new Map();
    observations.rows.forEach(function (row) {
      var key = ds.compositeKey(row, keyFields);
      var period = ds.periodKey(row[periodField], granularity);
      if (key === null || period === null) return;
      if (rowFilter && !evaluate(rowFilter, new RowView(row)).matched) return;
      var success = evaluate(successCondition, new RowView(row));
      var periods = tally.get(key);
      if (!periods) { periods = new Map(); tally.set(key, periods); }
      var bucket = periods.get(period);
      if (!bucket) { bucket = [0, 0]; periods.set(period, bucket); }
      bucket[1] += 1;
      if (success.matched) bucket[0] += 1;
    });

    var sources = [dataset.sourceLabel, observations.sourceLabel];
    var findings = [];
    dataset.rows.forEach(function (row) {
      var key = ds.compositeKey(row, localFields);
      if (key === null || !tally.has(key)) return;
      var periods = tally.get(key);
      var totalRows = 0;
      periods.forEach(function (counts) { totalRows += counts[1]; });
      if (periods.size < minPeriods || totalRows < minSamples) return;

      var ordered = Array.from(periods.keys()).sort(ds.compareText).map(function (period) {
        return [period, periods.get(period)[0] / periods.get(period)[1]];
      });
      var halves = stats.splitHalves(ordered);
      var earlyPeriods = halves[0];
      var latePeriods = halves[1];
      if (!earlyPeriods.length || !latePeriods.length) return;

      function share(selection) {
        var successes = 0;
        var total = 0;
        selection.forEach(function (item) {
          successes += periods.get(item[0])[0];
          total += periods.get(item[0])[1];
        });
        return successes / total;
      }
      var earlyShare = share(earlyPeriods);
      var lateShare = share(latePeriods);
      var drop = earlyShare - lateShare;

      var computed = new Map();
      computed.set('kpi_early', earlyShare);
      computed.set('kpi_late', lateShare);
      computed.set('kpi_drop', drop);
      computed.set('period_count', periods.size);
      computed.set('sample_count', totalRows);
      var view = new RowView(row, new Map(), computed);
      if (!passesFilter(rule, view)) return;
      var result = evaluate(rule.condition, view);
      if (!result.matched) return;

      var extra = [
        'periods analysed: ' + periods.size + ' (' + ordered[0][0] + ' .. ' +
          ordered[ordered.length - 1][0] + '), ' + totalRows + ' transactions',
        'success share earlier half (' + earlyPeriods.map(function (p) { return p[0]; }).join(', ') +
          ') = ' + fixed(earlyShare, 2),
        'success share later half (' + latePeriods.map(function (p) { return p[0]; }).join(', ') +
          ') = ' + fixed(lateShare, 2),
        'degradation = ' + fixed(drop, 2)
      ];

      findings.push(buildFinding(rule, {
        keyValues: keyValues(rule, row),
        view: view,
        result: result,
        sampleCount: totalRows,
        extraEvidence: extra,
        sources: sources
      }));
    });
    return findings;
  }

  /* ---------------------------------------------------------------- detect_process_drift */

  /**
   * Level 3: how the process *runs* has changed, measured against its own past.
   *
   * Scope, stated precisely, because the name promises more than Level 0 can
   * deliver: this compares a numeric behavioural metric between the earlier and
   * the later half of the observed horizon.  It answers "is this behaving
   * differently than it used to?" from transactional history alone — no SOP, no
   * process model, no event log, no Knowledge Layer.
   *
   * It is therefore *drift*, not *conformance*.  Checking execution against a
   * documented target process (the other half of what section 5.5 implies) needs
   * the process definitions of section 5.3 and stays a Level 1 capability; that
   * half is recorded in BLOCKERS.md rather than faked here.
   *
   * What it adds over the two neighbouring detectors is a distinct question:
   * `detect_historical_behavior_gap` compares observed behaviour with the
   * *configured* value over the whole horizon, so a parameter that was right when
   * it was set and is wrong now hides inside the average;
   * `detect_kpi_degradation_pattern` compares a *binary success share* between
   * halves, which cannot express "supplier lead time crept up by two weeks";
   * this one compares a *numeric metric* between halves, which is exactly the
   * shape of a supplier or ordering behaviour that shifted mid-horizon.
   *
   * Periods define where the split falls (so it is a split in time, not in row
   * count); the metric is then computed over all rows pooled within each half.
   * The middle period of an odd-length series is dropped, as in the KPI trend
   * detector, so the comparison carries no tie-breaking bias.
   */
  function detectProcessDrift(rule, data) {
    var dataset = entityOf(rule, data);
    var spec = rule.spec.observation;
    var observations = data.get(String(spec.dataset));
    if (observations === null) {
      throw DetectorSkip("observation dataset '" + spec.dataset + "' not present in the data directory");
    }

    var keyFields = fieldsOf(spec.key_field);
    var periodField = String(spec.period_field);
    var granularity = String(spec.period === undefined ? 'month' : spec.period);
    var metric = String(spec.metric);
    var minPeriods = spec.min_periods === undefined ? 4 : Math.trunc(spec.min_periods);
    var minSamples = spec.min_samples === undefined ? 6 : Math.trunc(spec.min_samples);
    var localFields = spec.local_field === undefined ? rule.key_fields : fieldsOf(spec.local_field);
    var rowFilter = spec.filter;

    var needed = keyFields.concat([periodField]);
    if (spec.value_field) needed.push(String(spec.value_field));
    if (spec.days_between) spec.days_between.forEach(function (name) { needed.push(String(name)); });
    requireColumns(dataset, rule.key_fields.concat(localFields), 'process drift join');
    requireColumns(observations, needed, "process drift metric '" + metric + "'");

    var observedValue = makeValueReader(spec);

    // key -> period -> [values]
    var tally = new Map();
    observations.rows.forEach(function (row) {
      var key = ds.compositeKey(row, keyFields);
      var period = ds.periodKey(row[periodField], granularity);
      var value = observedValue(row);
      if (key === null || period === null || value === null) return;
      if (rowFilter && !evaluate(rowFilter, new RowView(row)).matched) return;
      var periods = tally.get(key);
      if (!periods) { periods = new Map(); tally.set(key, periods); }
      var bucket = periods.get(period);
      if (!bucket) { bucket = []; periods.set(period, bucket); }
      bucket.push(value);
    });

    var sources = [dataset.sourceLabel, observations.sourceLabel];
    var measured = measuredLabel(spec);
    var findings = [];

    dataset.rows.forEach(function (row) {
      var key = ds.compositeKey(row, localFields);
      if (key === null || !tally.has(key)) return;
      var periods = tally.get(key);
      var totalRows = 0;
      periods.forEach(function (values) { totalRows += values.length; });
      if (periods.size < minPeriods || totalRows < minSamples) return;

      var ordered = Array.from(periods.keys()).sort(ds.compareText).map(function (period) {
        return [period, 0.0];
      });
      var halves = stats.splitHalves(ordered);
      var earlyPeriods = halves[0];
      var latePeriods = halves[1];
      var earlyValues = [];
      var lateValues = [];
      earlyPeriods.forEach(function (item) { earlyValues = earlyValues.concat(periods.get(item[0])); });
      latePeriods.forEach(function (item) { lateValues = lateValues.concat(periods.get(item[0])); });
      if (!earlyValues.length || !lateValues.length) return;
      var early = METRICS[metric](earlyValues);
      var late = METRICS[metric](lateValues);
      if (early === null || late === null) return;

      var computed = new Map();
      computed.set('early', early);
      computed.set('late', late);
      computed.set('drift', late - early);
      computed.set('period_count', periods.size);
      computed.set('sample_count', totalRows);
      var view = new RowView(row, new Map(), computed);
      if (!passesFilter(rule, view)) return;
      var result = evaluate(rule.condition, view);
      if (!result.matched) return;

      var extra = [
        'periods analysed: ' + periods.size + ' (' + ordered[0][0] + ' .. ' +
          ordered[ordered.length - 1][0] + '), ' + totalRows + ' ' + observations.name + ' rows',
        'earlier half (' + earlyPeriods.map(function (p) { return p[0]; }).join(', ') + '): ' +
          metric + '(' + measured + ') over ' + earlyValues.length + ' rows = ' + fmtNumber(early),
        'later half (' + latePeriods.map(function (p) { return p[0]; }).join(', ') + '): ' +
          metric + '(' + measured + ') over ' + lateValues.length + ' rows = ' + fmtNumber(late),
        'drift (later - earlier) = ' + fmtNumber(late - early)
      ];

      findings.push(buildFinding(rule, {
        keyValues: keyValues(rule, row),
        view: view,
        result: result,
        sampleCount: totalRows,
        extraEvidence: extra,
        sources: sources
      }));
    });
    return findings;
  }

  /* ---------------------------------------------------------------- registry + spec validation */

  var DETECTORS = {
    detect_missing_fields: detectMissingFields,
    detect_owner_gap: detectOwnerGap,
    detect_cross_table_conflict: detectCrossTableConflict,
    detect_outlier_parameter: detectOutlierParameter,
    detect_historical_behavior_gap: detectHistoricalBehaviorGap,
    detect_kpi_degradation_pattern: detectKpiDegradationPattern,
    detect_process_drift: detectProcessDrift
  };

  /**
   * Section 5.5 functions intentionally not implemented at Level 0, and why.
   *
   * `detect_process_drift` used to be on this list and was moved off it: the
   * half of it that needs a documented target process is still Level 1, but
   * drift measured against an entity's own transactional history needs no
   * Knowledge Layer and is now implemented.
   */
  var NOT_IMPLEMENTED_DETECTORS = [
    ['detect_definition_conflict',
      'needs a business glossary / KPI definitions to know which two fields are meant to ' +
      'express the same thing (Knowledge Layer, section 5.3 - Level 1+)'],
    ['detect_report_semantic_gap',
      'needs semantic model metadata (Power BI / Fabric datasets), which a CSV extract does ' +
      'not contain and no local connector can reach (section 5.1/5.3 - Level 1+)'],
    ['detect_design_assumption_risk',
      'needs assumptions extracted from consultant design documents; a Level 0 assumption ' +
      'written by hand is already expressible as a rule threshold, so a separate detector ' +
      'would add nothing until documents can be read (section 5.3 - Level 1+)']
  ];

  function expectKeys(spec, required, allowed, where) {
    var missing = required.filter(function (key) { return !(key in spec); });
    if (missing.length) throw ruleError(where + ': spec is missing ' + listText(missing));
    var unknown = Object.keys(spec).filter(function (key) { return allowed.indexOf(key) < 0; });
    if (unknown.length) {
      throw ruleError(where + ': unknown spec keys ' +
        listText(unknown.slice().sort(ds.compareText)));
    }
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * Check that both sides of a join name the same number of columns.
   *
   * A composite join whose sides disagree in arity is always a rule bug, and one
   * that would otherwise surface as "no rows matched" — the most misleading
   * possible failure, because a rule that silently matches nothing looks exactly
   * like a rule that found nothing wrong.
   */
  function validateJoin(spec, where, entityKeyFields) {
    var remote = L0.rules.parseFieldList(spec.key_field, where, 'key_field');
    var local = 'local_field' in spec
      ? L0.rules.parseFieldList(spec.local_field, where, 'local_field')
      : entityKeyFields.slice();
    if (remote.length !== local.length) {
      throw ruleError(where + ': join arity mismatch - key_field names ' + remote.length +
        ' column(s) but local_field/key_field names ' + local.length);
    }
  }

  var OBSERVATION_KEYS = [
    'dataset', 'key_field', 'local_field', 'metric', 'value_field', 'days_between',
    'period_field', 'period', 'filter', 'min_samples'
  ];

  /**
   * Validate one observation block of `detect_historical_behavior_gap`.
   *
   * Shared between the primary observation and every `extra_observations` entry,
   * so an extra observation can never be validated more loosely than the one the
   * rule was originally written around.
   */
  function validateObservation(observation, where, keyFields, allowExposeAs) {
    if (!isPlainObject(observation)) throw ruleError(where + ': must be an object');
    var allowed = allowExposeAs ? OBSERVATION_KEYS.concat(['expose_as']) : OBSERVATION_KEYS;
    expectKeys(observation, ['dataset', 'key_field', 'metric'], allowed, where);
    validateJoin(observation, where, keyFields);
    var metric = observation.metric;
    if (METRIC_NAMES.indexOf(metric) < 0) {
      throw ruleError(where + ": unknown metric '" + metric + "' (known: " + METRIC_NAMES.join(', ') + ')');
    }
    var daysBetween = observation.days_between;
    if (daysBetween !== undefined && daysBetween !== null) {
      if (!Array.isArray(daysBetween) || daysBetween.length !== 2 ||
          daysBetween.some(function (name) { return typeof name !== 'string'; })) {
        throw ruleError(where + ": 'days_between' must be [from_date_field, to_date_field]");
      }
      if (observation.value_field) {
        throw ruleError(where + ": use either 'value_field' or 'days_between', not both");
      }
    }
    if (metric !== 'count' && !observation.value_field && !daysBetween) {
      throw ruleError(where + ": metric '" + metric + "' requires 'value_field' or 'days_between'");
    }
    if (PERIOD_METRICS.indexOf(metric) >= 0 && !observation.period_field) {
      throw ruleError(where + ": metric '" + metric + "' requires 'period_field'");
    }
    var period = observation.period === undefined ? 'month' : observation.period;
    if (['month', 'quarter', 'year'].indexOf(period) < 0) {
      throw ruleError(where + ": 'period' must be month, quarter or year");
    }
    if (observation.filter !== undefined && observation.filter !== null) {
      ops.validateCondition(observation.filter, where + '.filter');
    }
  }

  /**
   * Validate a rule's `spec` for its detector, at load time.  Rule files are
   * untrusted input, so every structural assumption a detector makes is checked
   * here once instead of being discovered mid-run over customer data.
   */
  function validateDetectorSpec(detector, spec, condition, where, keyFieldsArg) {
    var keyFields = keyFieldsArg || [];
    var needsCondition = detector !== 'detect_owner_gap';
    if (needsCondition && (condition === null || condition === undefined)) {
      throw ruleError(where + ": detector '" + detector + "' requires a 'condition'");
    }

    if (detector === 'detect_missing_fields') {
      expectKeys(spec, [], [], where);
      return;
    }

    if (detector === 'detect_owner_gap') {
      expectKeys(spec, ['owner_field'], ['owner_field', 'reference'], where);
      if (typeof spec.owner_field !== 'string') {
        throw ruleError(where + ': spec.owner_field must be a string');
      }
      var reference = spec.reference;
      if (reference !== undefined && reference !== null) {
        if (!isPlainObject(reference)) throw ruleError(where + ': spec.reference must be an object');
        expectKeys(reference, ['dataset', 'key_field'], ['dataset', 'key_field'], where + '.reference');
        // Single column by nature: an owner field holds one identifier, so a
        // composite reference key could never match it.
        if (typeof reference.key_field !== 'string') {
          throw ruleError(where + ".reference: 'key_field' must be a single column name");
        }
      }
      return;
    }

    if (detector === 'detect_cross_table_conflict') {
      expectKeys(spec, ['related'], ['related'], where);
      var related = spec.related;
      if (!isPlainObject(related)) throw ruleError(where + ': spec.related must be an object');
      expectKeys(
        related,
        ['dataset', 'key_field'],
        ['dataset', 'key_field', 'local_field', 'alias', 'value_field', 'filter'],
        where + '.related'
      );
      validateJoin(related, where + '.related', keyFields);
      if (related.filter !== undefined && related.filter !== null) {
        ops.validateCondition(related.filter, where + '.related.filter');
      }
      return;
    }

    if (detector === 'detect_outlier_parameter') {
      expectKeys(spec, ['field'], ['field', 'group_by', 'min_group_size'], where);
      if (typeof spec.field !== 'string') throw ruleError(where + ': spec.field must be a string');
      var size = spec.min_group_size === undefined ? 5 : spec.min_group_size;
      if (!Number.isInteger(size) || size < 2) {
        throw ruleError(where + ': spec.min_group_size must be an integer >= 2');
      }
      return;
    }

    if (detector === 'detect_historical_behavior_gap') {
      expectKeys(spec, ['observation'], ['observation', 'expose_as', 'derived', 'extra_observations'], where);
      validateObservation(spec.observation, where + '.observation', keyFields, false);
      var extras = spec.extra_observations || [];
      if (!Array.isArray(extras)) throw ruleError(where + ": 'extra_observations' must be a list");
      var reserved = [String(spec.expose_as === undefined ? 'observed' : spec.expose_as),
        'sample_count', 'period_count'];
      extras.forEach(function (extra, index) {
        var location = where + '.extra_observations[' + index + ']';
        if (!isPlainObject(extra)) throw ruleError(location + ': must be an object');
        if (typeof extra.expose_as !== 'string' || !extra.expose_as.trim()) {
          throw ruleError(location + ": 'expose_as' must be a non-empty string");
        }
        var name = extra.expose_as.trim();
        if (reserved.indexOf(name) >= 0) {
          throw ruleError(location + ": 'expose_as' '" + name + "' collides with an existing computed value");
        }
        reserved.push(name);
        validateObservation(extra, location, keyFields, true);
      });
      (spec.derived || []).forEach(function (derived, index) {
        var at = where + '.derived[' + index + ']';
        if (!isPlainObject(derived)) throw ruleError(at + ': must be an object');
        expectKeys(derived, ['name', 'formula'], ['name', 'formula', 'params'], at);
        if (DERIVED_FORMULAS.indexOf(derived.formula) < 0) {
          throw ruleError(at + ": unknown formula '" + derived.formula + "' (known: " +
            DERIVED_FORMULAS.join(', ') + ')');
        }
        if (derived.formula === 'normal_service_buffer') {
          var params = derived.params || {};
          if (!('lead_time_field' in params)) {
            throw ruleError(at + ': normal_service_buffer needs params.lead_time_field');
          }
        }
      });
      return;
    }

    if (detector === 'detect_kpi_degradation_pattern') {
      expectKeys(spec, ['observation'], ['observation'], where);
      var kpiObservation = spec.observation;
      if (!isPlainObject(kpiObservation)) throw ruleError(where + ': spec.observation must be an object');
      expectKeys(
        kpiObservation,
        ['dataset', 'key_field', 'period_field', 'success_condition'],
        ['dataset', 'key_field', 'local_field', 'period_field', 'period', 'success_condition',
          'filter', 'min_periods', 'min_samples'],
        where + '.observation'
      );
      validateJoin(kpiObservation, where + '.observation', keyFields);
      ops.validateCondition(kpiObservation.success_condition, where + '.observation.success_condition');
      if (kpiObservation.filter !== undefined && kpiObservation.filter !== null) {
        ops.validateCondition(kpiObservation.filter, where + '.observation.filter');
      }
      var kpiPeriod = kpiObservation.period === undefined ? 'month' : kpiObservation.period;
      if (['month', 'quarter', 'year'].indexOf(kpiPeriod) < 0) {
        throw ruleError(where + ".observation: 'period' must be month, quarter or year");
      }
      return;
    }

    if (detector === 'detect_process_drift') {
      expectKeys(spec, ['observation'], ['observation'], where);
      var driftObservation = spec.observation;
      if (!isPlainObject(driftObservation)) throw ruleError(where + ': spec.observation must be an object');
      expectKeys(
        driftObservation,
        ['dataset', 'key_field', 'period_field', 'metric'],
        ['dataset', 'key_field', 'local_field', 'metric', 'value_field', 'days_between',
          'period_field', 'period', 'filter', 'min_periods', 'min_samples'],
        where + '.observation'
      );
      validateJoin(driftObservation, where + '.observation', keyFields);
      var driftMetric = driftObservation.metric;
      // Per-period metrics are excluded: this detector already aggregates by
      // period itself, so "mean_by_period within a half" would be a second,
      // undocumented layer of averaging.
      if (!Object.prototype.hasOwnProperty.call(METRICS, driftMetric)) {
        throw ruleError(where + ".observation: metric '" + driftMetric +
          "' is not usable for drift (known: " + Object.keys(METRICS).sort(ds.compareText).join(', ') + ')');
      }
      var driftDays = driftObservation.days_between;
      if (driftDays !== undefined && driftDays !== null) {
        if (!Array.isArray(driftDays) || driftDays.length !== 2 ||
            driftDays.some(function (name) { return typeof name !== 'string'; })) {
          throw ruleError(where + ".observation: 'days_between' must be [from_date_field, to_date_field]");
        }
        if (driftObservation.value_field) {
          throw ruleError(where + ".observation: use either 'value_field' or 'days_between', not both");
        }
      }
      if (!driftObservation.value_field && !driftDays) {
        throw ruleError(where + ".observation: drift needs 'value_field' or 'days_between' to measure");
      }
      var driftPeriod = driftObservation.period === undefined ? 'month' : driftObservation.period;
      if (['month', 'quarter', 'year'].indexOf(driftPeriod) < 0) {
        throw ruleError(where + ".observation: 'period' must be month, quarter or year");
      }
      if (driftObservation.filter !== undefined && driftObservation.filter !== null) {
        ops.validateCondition(driftObservation.filter, where + '.observation.filter');
      }
      return;
    }

    throw ruleError(where + ": no spec validator for detector '" + detector + "'");
  }

  L0.detection = {
    DetectorSkip: DetectorSkip,
    DETECTORS: DETECTORS,
    NOT_IMPLEMENTED_DETECTORS: NOT_IMPLEMENTED_DETECTORS,
    METRIC_NAMES: METRIC_NAMES,
    PERIOD_METRICS: PERIOD_METRICS,
    buildFinding: buildFinding,
    validateDetectorSpec: validateDetectorSpec,
    detectMissingFields: detectMissingFields,
    detectOwnerGap: detectOwnerGap,
    detectCrossTableConflict: detectCrossTableConflict,
    detectOutlierParameter: detectOutlierParameter,
    detectHistoricalBehaviorGap: detectHistoricalBehaviorGap,
    detectKpiDegradationPattern: detectKpiDegradationPattern,
    detectProcessDrift: detectProcessDrift
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
