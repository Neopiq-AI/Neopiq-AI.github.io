/* Level 0 web — statistics helpers.
 *
 * Port of level0_rules/statistics_helpers.py.  Everything here is closed-form,
 * deterministic and explainable in one sentence to a planner: the blueprint
 * allows Level 0 exactly two ingredients, rule logic and simple statistics.
 *
 * Two numerical details exist purely to keep parity with the Python engine:
 *
 *   fsum()   Shewchuk exact summation, because statistics.fmean() uses
 *            math.fsum().  Naive left-to-right addition would drift in the
 *            last ULP and could, at a threshold boundary, change a finding.
 *   fixed()  Python's format(x, ".2f") rounds half-to-even on the exact binary
 *            value.  JavaScript's toFixed() rounds half-away-from-zero, so
 *            0.125 renders as "0.13" instead of Python's "0.12".  Evidence
 *            strings are compared verbatim against the Python output, so the
 *            rounding mode has to match.
 */
(function (root) {
  'use strict';
  var L0 = (root.Level0 = root.Level0 || {});

  var MAD_TO_SIGMA = 0.6744897501960817;

  /* ---------------------------------------------------------------- number formatting */

  function toPlainDecimal(text) {
    // Turn "1.234e+21" / "5e-7" into a plain decimal string. Sign is handled
    // by the caller, so the input here is always non-negative.
    var exponentAt = text.indexOf('e');
    if (exponentAt < 0) return text;
    var mantissa = text.slice(0, exponentAt);
    var exponent = parseInt(text.slice(exponentAt + 1), 10);
    var pointAt = mantissa.indexOf('.');
    var digits = pointAt < 0 ? mantissa : mantissa.slice(0, pointAt) + mantissa.slice(pointAt + 1);
    var pointPos = (pointAt < 0 ? mantissa.length : pointAt) + exponent;
    if (pointPos <= 0) return '0.' + '0'.repeat(-pointPos) + digits;
    if (pointPos >= digits.length) return digits + '0'.repeat(pointPos - digits.length);
    return digits.slice(0, pointPos) + '.' + digits.slice(pointPos);
  }

  function incrementDecimal(text) {
    // Add one unit in the last place of a plain digit string (no sign, no point).
    var out = text.split('');
    var i = out.length - 1;
    while (i >= 0) {
      if (out[i] === '9') { out[i] = '0'; i--; continue; }
      out[i] = String(Number(out[i]) + 1);
      return out.join('');
    }
    return '1' + out.join('');
  }

  /** format(value, ".<digits>f") with Python's round-half-to-even semantics. */
  function fixed(value, digits) {
    if (value === null || value === undefined || !isFinite(value)) return String(value);
    // Object.is catches -0, which compares equal to 0 but which Python prints
    // as "-0.00". Without it the sign of a negative zero is silently dropped.
    var negative = value < 0 || Object.is(value, -0);
    var plain = toPlainDecimal(Math.abs(value).toPrecision(17));
    var pointAt = plain.indexOf('.');
    var whole = pointAt < 0 ? plain : plain.slice(0, pointAt);
    var frac = pointAt < 0 ? '' : plain.slice(pointAt + 1);

    var kept, roundUp = false;
    if (frac.length <= digits) {
      kept = frac + '0'.repeat(digits - frac.length);
    } else {
      kept = frac.slice(0, digits);
      var rest = frac.slice(digits);
      var half = '5' + '0'.repeat(rest.length - 1);
      if (rest > half) {
        roundUp = true;
      } else if (rest === half) {
        // Exact tie: round to even.
        var lastDigit = digits === 0
          ? Number(whole.charAt(whole.length - 1))
          : Number(kept.charAt(digits - 1));
        roundUp = lastDigit % 2 === 1;
      }
    }
    if (roundUp) {
      var combined = incrementDecimal(whole + kept);
      // An overflow ("99" -> "100") lengthens the whole part by one digit.
      var wholeLength = combined.length - digits;
      whole = combined.slice(0, wholeLength);
      kept = combined.slice(wholeLength);
    }
    var text = digits > 0 ? whole + '.' + kept : whole;
    // Python prints "-0.00" for a negative value that rounds to zero.
    return negative ? '-' + text : text;
  }

  /** Python's round(value, 2): half-to-even, returning a number. */
  function round2(value) {
    return Number(fixed(value, 2));
  }

  /** Evidence-facing number format: integers bare, everything else 2 decimals. */
  function fmtNumber(value) {
    if (value === null || value === undefined) return 'n/a';
    if (!isFinite(value)) return String(value);
    if (Number.isInteger(value)) {
      // Python's str(int(v)) never uses exponent notation; JavaScript switches
      // to "1e+21" above 1e21, so widen through BigInt to keep the digits.
      return Math.abs(value) >= 1e21 ? BigInt(value).toString() : String(value);
    }
    return fixed(value, 2);
  }

  /* ---------------------------------------------------------------- summation */

  /** Shewchuk exact summation — the algorithm behind Python's math.fsum(). */
  function fsum(values) {
    var partials = [];
    for (var i = 0; i < values.length; i++) {
      var x = values[i];
      var count = 0;
      for (var k = 0; k < partials.length; k++) {
        var y = partials[k];
        if (Math.abs(x) < Math.abs(y)) { var swap = x; x = y; y = swap; }
        var hi = x + y;
        var lo = y - (hi - x);
        if (lo !== 0) partials[count++] = lo;
        x = hi;
      }
      partials.length = count;
      partials.push(x);
    }
    var total = 0;
    for (var m = partials.length - 1; m >= 0; m--) total += partials[m];
    return total;
  }

  /* ---------------------------------------------------------------- estimators */

  function mean(values) {
    return values.length ? fsum(values) / values.length : null;
  }

  function median(values) {
    if (!values.length) return null;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var n = sorted.length;
    var half = Math.floor(n / 2);
    return n % 2 === 1 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2;
  }

  /** Sample standard deviation (n-1); null below two observations. */
  function stdev(values) {
    if (values.length < 2) return null;
    var mu = mean(values);
    var squares = values.map(function (v) { var d = v - mu; return d * d; });
    return Math.sqrt(fsum(squares) / (values.length - 1));
  }

  function mad(values) {
    if (!values.length) return null;
    var med = median(values);
    return median(values.map(function (v) { return Math.abs(v - med); }));
  }

  function coefficientOfVariation(values) {
    var avg = mean(values);
    var sd = stdev(values);
    if (avg === null || sd === null || avg === 0) return null;
    return sd / Math.abs(avg);
  }

  /* ---------------------------------------------------------------- baseline */

  function Baseline(field, group, count, medianValue, madValue, meanValue, stdevValue) {
    this.field = field;
    this.group = group;
    this.count = count;
    this.median = medianValue;
    this.mad = madValue;
    this.mean = meanValue;
    this.stdev = stdevValue;
    this.method = 'median_mad';
  }

  /** Signed deviation from the baseline in robust sigmas, or null with no spread. */
  Baseline.prototype.robustZ = function (value) {
    if (this.count < 2) return null;
    if (this.mad > 0) return MAD_TO_SIGMA * (value - this.median) / this.mad;
    if (this.stdev > 0) return (value - this.mean) / this.stdev;
    return null;
  };

  Baseline.prototype.describe = function () {
    return 'baseline' + (this.group === null || this.group === undefined ? '' : '[' + this.group + ']') +
      ' for ' + this.field + ': n=' + this.count +
      ', median=' + fmtNumber(this.median) +
      ', mad=' + fmtNumber(this.mad) +
      ', mean=' + fmtNumber(this.mean) +
      ', stdev=' + fmtNumber(this.stdev);
  };

  function buildBaseline(values, field, group) {
    if (values.length < 2) return null;
    return new Baseline(
      field,
      group === undefined ? null : group,
      values.length,
      median(values),
      mad(values) || 0.0,
      mean(values),
      stdev(values)
    );
  }

  /* ---------------------------------------------------------------- planning formulas */

  /** Textbook safety stock: z * sigma * sqrt(lead_time / period). */
  function normalServiceBuffer(sigmaPeriod, leadTimeDays, periodDays, serviceZ) {
    if (sigmaPeriod <= 0 || leadTimeDays <= 0 || periodDays <= 0) return 0.0;
    return serviceZ * sigmaPeriod * Math.sqrt(leadTimeDays / periodDays);
  }

  /** Split an ordered period series in half, dropping the middle of an odd run. */
  function splitHalves(ordered) {
    var size = ordered.length;
    if (size < 2) return [[], []];
    var half = Math.floor(size / 2);
    if (size % 2 === 0) return [ordered.slice(0, half), ordered.slice(half)];
    return [ordered.slice(0, half), ordered.slice(half + 1)];
  }

  L0.stats = {
    MAD_TO_SIGMA: MAD_TO_SIGMA,
    fixed: fixed,
    round2: round2,
    fmtNumber: fmtNumber,
    fsum: fsum,
    mean: mean,
    median: median,
    stdev: stdev,
    mad: mad,
    coefficientOfVariation: coefficientOfVariation,
    Baseline: Baseline,
    buildBaseline: buildBaseline,
    normalServiceBuffer: normalServiceBuffer,
    splitHalves: splitHalves
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
