/* Level 0 web — the confidence model.
 *
 * Port of level0_rules/confidence.py.  This is the ONLY place a confidence
 * value is produced, and the arithmetic that produced it is attached to every
 * finding as its last evidence line.  A confidence number nobody can explain is
 * worse than no number at all: it invites the customer to argue with the tool
 * instead of with the data.
 *
 *     confidence = clamp(base(level) + support + effect - incompleteness, 0.05, 0.99)
 *
 * base           L1 0.95 (directly observed), L2 0.85 (deterministic join with
 *                possible business exceptions), L3 0.60 (inference from a
 *                finite sample).
 * support        +0.00..+0.20 = 0.20 * min(1, n / full_support_samples).
 *                Sample-based findings only.
 * effect         +0.00..+0.10 = 0.10 * min(1, margin), where margin is the
 *                relative gap between two *observed* values.  Beating a
 *                constant written in the rule contributes nothing: that says
 *                something about the threshold, not about the finding.
 * incompleteness -0.15 when a value the rule needed could not be read.
 *
 * Nothing else may adjust confidence.  There are no per-rule magic numbers; a
 * rule that deserves different confidence needs a different level or different
 * thresholds.
 */
(function (root) {
  'use strict';
  var L0 = (root.Level0 = root.Level0 || {});
  var fixed = L0.stats.fixed;
  var round2 = L0.stats.round2;

  var BASE_BY_LEVEL = { L1: 0.95, L2: 0.85, L3: 0.60 };
  var MAX_SUPPORT_BONUS = 0.20;
  var MAX_EFFECT_BONUS = 0.10;
  var INCOMPLETE_PENALTY = 0.15;
  var MIN_CONFIDENCE = 0.05;
  var MAX_CONFIDENCE = 0.99;
  var DEFAULT_FULL_SUPPORT_SAMPLES = 12;

  function ConfidenceScore(value, rationale) {
    this.value = value;
    this.rationale = rationale;
  }

  ConfidenceScore.prototype.asEvidence = function () {
    return 'confidence ' + fixed(this.value, 2) + ' = ' + this.rationale;
  };

  /**
   * Apply the documented model.
   * @param {object} options level, sampleCount, fullSupportSamples, effectMargin, incomplete
   */
  function computeConfidence(options) {
    var level = options.level;
    var base = BASE_BY_LEVEL[level];
    if (base === undefined) throw new Error("unknown rule level '" + level + "'");

    var parts = ['base ' + fixed(base, 2) + ' (' + level + ')'];
    var total = base;

    var sampleCount = options.sampleCount;
    if (sampleCount !== null && sampleCount !== undefined) {
      var target = Math.max(1, Math.trunc(
        options.fullSupportSamples === undefined ? DEFAULT_FULL_SUPPORT_SAMPLES : options.fullSupportSamples
      ));
      var support = MAX_SUPPORT_BONUS * Math.min(1.0, sampleCount / target);
      total += support;
      parts.push('+' + fixed(support, 2) + ' sample support (n=' + sampleCount + '/' + target + ')');
    }

    var margin = options.effectMargin;
    if (margin !== null && margin !== undefined && margin > 0) {
      var effect = MAX_EFFECT_BONUS * Math.min(1.0, margin);
      total += effect;
      parts.push('+' + fixed(effect, 2) + ' effect size (margin ' + fixed(margin, 2) + ')');
    }

    if (options.incomplete) {
      total -= INCOMPLETE_PENALTY;
      parts.push('-' + fixed(INCOMPLETE_PENALTY, 2) + ' incomplete input data');
    }

    var clamped = Math.max(MIN_CONFIDENCE, Math.min(MAX_CONFIDENCE, total));
    if (clamped !== total) {
      parts.push('clamped to [' + fixed(MIN_CONFIDENCE, 2) + ', ' + fixed(MAX_CONFIDENCE, 2) + ']');
    }
    // Two decimals: the model does not justify more precision than that.
    return new ConfidenceScore(round2(clamped), parts.join(', '));
  }

  function explainModel() {
    return [
      'confidence = clamp(base(level) + support + effect - incompleteness, 0.05, 0.99)',
      'base: L1=0.95 (directly observed), L2=0.85 (deterministic join, business exceptions possible), ' +
        'L3=0.60 (statistical inference from a finite sample)',
      'support: +0..' + fixed(MAX_SUPPORT_BONUS, 2) + ', = ' + fixed(MAX_SUPPORT_BONUS, 2) +
        ' * min(1, n / full_support_samples); sample-based findings only',
      'effect: +0..' + fixed(MAX_EFFECT_BONUS, 2) + ', = ' + fixed(MAX_EFFECT_BONUS, 2) +
        ' * min(1, relative gap between two observed values); comparisons against a constant in the rule ' +
        'contribute nothing',
      'incompleteness: -' + fixed(INCOMPLETE_PENALTY, 2) + ' when a needed value could not be read',
      'no other input may change confidence; every finding carries its own arithmetic as evidence'
    ];
  }

  L0.confidence = {
    BASE_BY_LEVEL: BASE_BY_LEVEL,
    MAX_SUPPORT_BONUS: MAX_SUPPORT_BONUS,
    MAX_EFFECT_BONUS: MAX_EFFECT_BONUS,
    INCOMPLETE_PENALTY: INCOMPLETE_PENALTY,
    MIN_CONFIDENCE: MIN_CONFIDENCE,
    MAX_CONFIDENCE: MAX_CONFIDENCE,
    DEFAULT_FULL_SUPPORT_SAMPLES: DEFAULT_FULL_SUPPORT_SAMPLES,
    ConfidenceScore: ConfidenceScore,
    computeConfidence: computeConfidence,
    explainModel: explainModel
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
