/* Level 0 web — user interface.
 *
 * The engine (engine/*.js) knows nothing about the DOM; this file knows nothing
 * about planning logic.  It reads files the user picked with FileReader, hands
 * the text to the engine, and renders the Finding Objects that come back.
 *
 * Two rules this file must never break:
 *
 *   1. No network.  There is no fetch, no XMLHttpRequest, no WebSocket, no
 *      sendBeacon, no analytics and no external asset anywhere in this app.
 *      The rule library and sample data are embedded at build time precisely so
 *      that loading them cannot become a request.
 *   2. No HTML injection.  Every value that originates in a customer's CSV is
 *      placed with textContent, never innerHTML, so a cell containing markup is
 *      shown as text rather than becoming part of the page.
 */
(function () {
  'use strict';

  var L0 = window.Level0;
  var ds = L0.dataset;

  var state = {
    tables: [],       // [{name, datasetName, text, size, dataset, error}]
    result: null,
    payload: null,
    sourceLabel: '',
    visible: {}       // severity -> boolean
  };
  L0.finding.SEVERITIES.forEach(function (severity) { state.visible[severity] = true; });

  /* ---------------------------------------------------------------- helpers */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function byId(id) { return document.getElementById(id); }

  function setStatus(message, isError) {
    var status = byId('status');
    status.textContent = message || '';
    status.classList.toggle('is-error', !!isError);
  }

  function plural(count, singular, pluralWord) {
    return count + ' ' + (count === 1 ? singular : (pluralWord || singular + 's'));
  }

  /* ---------------------------------------------------------------- loading */

  function datasetNameFor(fileName) {
    return fileName.replace(/\.[^.]*$/, '');
  }

  /** Turn raw CSV text into a Dataset, recording the failure instead of throwing. */
  function addTable(fileName, text, size) {
    var entry = {
      name: fileName,
      datasetName: datasetNameFor(fileName),
      text: text,
      size: size === undefined ? text.length : size,
      dataset: null,
      error: null
    };
    try {
      entry.dataset = ds.loadCsvText(text, entry.datasetName, fileName);
    } catch (error) {
      entry.error = error.message;
    }
    // A second file with the same table name replaces the first: re-picking
    // items.csv after fixing it should not leave the stale copy loaded.
    state.tables = state.tables.filter(function (existing) {
      return existing.datasetName !== entry.datasetName;
    });
    state.tables.push(entry);
    state.tables.sort(function (a, b) { return ds.compareText(a.datasetName, b.datasetName); });
  }

  function readFiles(fileList) {
    var files = Array.prototype.slice.call(fileList).filter(function (file) {
      return /\.csv$/i.test(file.name);
    });
    if (!files.length) {
      setStatus('No CSV files in that selection. This tool reads .csv extracts.', true);
      return;
    }
    var remaining = files.length;
    var rejected = [];

    files.forEach(function (file) {
      if (file.size > ds.MAX_CSV_BYTES) {
        rejected.push(file.name + ' is larger than the ' +
          Math.round(ds.MAX_CSV_BYTES / (1024 * 1024)) + ' MB local limit');
        if (--remaining === 0) finish();
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () {
        rejected.push(file.name + ' could not be read');
        if (--remaining === 0) finish();
      };
      reader.onload = function () {
        addTable(file.name, String(reader.result), file.size);
        if (--remaining === 0) finish();
      };
      // Local read only. The bytes go from disk to this tab and no further.
      reader.readAsText(file, 'utf-8');
    });

    function finish() {
      state.sourceLabel = 'files chosen in the browser';
      renderFileList();
      setStatus(
        rejected.length
          ? 'Loaded ' + plural(state.tables.length, 'table') + '. ' + rejected.join('; ') + '.'
          : 'Loaded ' + plural(state.tables.length, 'table') + '. Ready to run.',
        rejected.length > 0
      );
    }
  }

  function loadSample() {
    state.tables = [];
    L0.bundledSampleData.forEach(function (entry) {
      addTable(entry.name, entry.text);
    });
    state.sourceLabel = 'bundled sample data (synthetic)';
    renderFileList();
    setStatus('Loaded the synthetic sample extract: ' + plural(state.tables.length, 'table') + '.');
    run();
  }

  function renderFileList() {
    var wrap = byId('file-list-wrap');
    var list = byId('file-list');
    clear(list);
    if (!state.tables.length) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    state.tables.forEach(function (entry) {
      var item = el('li');
      var left = el('span');
      left.appendChild(el('span', 'file-name', entry.datasetName));
      item.appendChild(left);
      if (entry.error) {
        item.appendChild(el('span', 'file-meta file-error', entry.error));
      } else {
        item.appendChild(el('span', 'file-meta',
          plural(entry.dataset.rows.length, 'row') + ' · ' +
          plural(entry.dataset.columns.length, 'column') + ' · ' + entry.name));
      }
      list.appendChild(item);
    });
  }

  function clearAll() {
    state.tables = [];
    state.result = null;
    state.payload = null;
    byId('file-input').value = '';
    renderFileList();
    byId('results').hidden = true;
    setStatus('Cleared. Nothing is retained — this page keeps no storage of any kind.');
  }

  /* ---------------------------------------------------------------- running */

  function run() {
    var usable = state.tables.filter(function (entry) { return entry.dataset; });
    if (!usable.length) {
      setStatus('No readable tables loaded yet.', true);
      return;
    }
    var data = new ds.DataBundle(usable.map(function (entry) { return entry.dataset; }));
    var library = L0.rules.loadRules(L0.bundledRules);
    var result = L0.engine.runEngine(data, library);

    state.result = result;
    state.payload = L0.engine.renderJson(result, state.sourceLabel, 'bundled rule library');

    renderResults();
    byId('results').hidden = false;
    setStatus('Done. ' + plural(result.findings.length, 'finding') + ' from ' +
      plural(result.evaluatedRules.length, 'rule') + '. Nothing was uploaded.');
    byId('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------------------------------------------------------------- rendering */

  function renderResults() {
    renderSummary();
    renderFilters();
    renderRunDetail();
    renderFindings();
  }

  function renderSummary() {
    var counts = state.result.countsBySeverity();
    var summary = byId('summary');
    clear(summary);

    var total = el('div', 'stat');
    total.appendChild(el('span', 'stat__value', state.result.findings.length));
    total.appendChild(el('span', 'stat__label', 'findings'));
    summary.appendChild(total);

    L0.finding.SEVERITIES.forEach(function (severity) {
      var stat = el('div', 'stat stat--' + severity);
      stat.appendChild(el('span', 'stat__value', counts[severity]));
      stat.appendChild(el('span', 'stat__label', severity));
      summary.appendChild(stat);
    });

    var rules = el('div', 'stat');
    rules.appendChild(el('span', 'stat__value', state.result.evaluatedRules.length));
    rules.appendChild(el('span', 'stat__label', 'rules run'));
    summary.appendChild(rules);
  }

  function renderFilters() {
    var counts = state.result.countsBySeverity();
    var row = byId('severity-filters');
    clear(row);
    L0.finding.SEVERITIES.forEach(function (severity) {
      var button = el('button', 'button', severity + ' (' + counts[severity] + ')');
      button.type = 'button';
      button.setAttribute('aria-pressed', String(state.visible[severity]));
      button.addEventListener('click', function () {
        state.visible[severity] = !state.visible[severity];
        button.setAttribute('aria-pressed', String(state.visible[severity]));
        renderFindings();
      });
      row.appendChild(button);
    });
  }

  function renderRunDetail() {
    var detail = byId('run-detail');
    clear(detail);

    var datasets = state.result.datasets.map(function (entry) {
      return entry[0] + ' (' + entry[1] + ')';
    }).join(', ');
    detail.appendChild(el('p', null,
      'Tables read: ' + datasets + '. ' +
      state.result.evaluatedRules.length + ' rules evaluated, ' +
      state.result.skippedRules.length + ' skipped, ' +
      state.result.ruleIssues.length + ' rejected.'));

    if (state.result.skippedRules.length) {
      detail.appendChild(el('p', null,
        'Rules that could not be checked against this extract — usually a missing table or column:'));
      var skipped = el('ul');
      state.result.skippedRules.forEach(function (item) {
        skipped.appendChild(el('li', null, item.rule_id + ' — ' + item.reason));
      });
      detail.appendChild(skipped);
    }
    if (state.result.ruleIssues.length) {
      detail.appendChild(el('p', null, 'Rule definitions rejected as invalid:'));
      var issues = el('ul');
      state.result.ruleIssues.forEach(function (text) { issues.appendChild(el('li', null, text)); });
      detail.appendChild(issues);
    }
  }

  function renderFindings() {
    var list = byId('findings');
    var empty = byId('no-findings');
    clear(list);

    var findings = state.result.findings.filter(function (finding) {
      return state.visible[finding.severity];
    });

    if (!findings.length) {
      empty.hidden = false;
      empty.textContent = state.result.findings.length
        ? 'No findings match the current severity filter.'
        : 'No findings. Either this data is clean, or the rule library does not cover it.';
      return;
    }
    empty.hidden = true;
    findings.forEach(function (finding) { list.appendChild(renderFinding(finding)); });
  }

  function renderFinding(finding) {
    var item = el('li', 'finding finding--' + finding.severity);

    var head = el('div', 'finding__head');
    head.appendChild(el('span', 'chip chip--' + finding.severity, finding.severity));
    head.appendChild(el('span', 'finding__id', finding.finding_id));

    var confidence = el('div', 'confidence');
    confidence.title = 'Confidence — see the evidence for the arithmetic';
    var track = el('span', 'confidence__track');
    var fill = el('span', 'confidence__fill');
    fill.style.width = Math.round(finding.confidence * 100) + '%';
    track.appendChild(fill);
    confidence.appendChild(el('span', 'confidence__label', 'confidence'));
    confidence.appendChild(track);
    confidence.appendChild(el('span', 'confidence__value', L0.stats.fixed(finding.confidence, 2)));
    head.appendChild(confidence);
    item.appendChild(head);

    item.appendChild(el('h3', 'finding__issue', finding.issue));

    var meta = el('div', 'finding__meta');
    meta.appendChild(metaPair('Affected', finding.affected_objects.join(', ')));
    meta.appendChild(metaPair('Owner', finding.owner));
    meta.appendChild(metaPair('Status', finding.status));
    item.appendChild(meta);

    // Section 5.6: never output an unexplained recommendation. The evidence
    // block is not collapsible for that reason — it is the point of the finding.
    var evidence = el('div', 'evidence');
    evidence.appendChild(el('p', 'subhead', 'Evidence'));
    var lines = el('ul');
    finding.evidence.forEach(function (line) { lines.appendChild(el('li', null, line)); });
    evidence.appendChild(lines);
    item.appendChild(evidence);

    var dl = el('dl');
    [
      ['Business impact', finding.business_impact],
      ['Likely root cause', finding.likely_root_cause],
      ['Recommended action', finding.recommended_action]
    ].forEach(function (pair) {
      dl.appendChild(el('dt', null, pair[0]));
      dl.appendChild(el('dd', null, pair[1]));
    });
    item.appendChild(dl);

    item.appendChild(el('p', 'finding__sources', 'Sources: ' + finding.source_references.join(', ')));
    return item;
  }

  function metaPair(label, value) {
    var wrap = el('span');
    wrap.appendChild(el('strong', null, label + ': '));
    wrap.appendChild(document.createTextNode(value));
    return wrap;
  }

  /* ---------------------------------------------------------------- download */

  function downloadJson() {
    if (!state.payload) return;
    var text = JSON.stringify(state.payload, null, 2);
    // A Blob and an object URL are purely in-memory; nothing is transmitted.
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = el('a');
    link.href = url;
    link.download = 'level0-findings.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStatus('Findings saved to your downloads folder. The file was built in this tab.');
  }

  /* ---------------------------------------------------------------- static content */

  function renderStaticContent() {
    byId('tool-version').textContent = 'level0-web ' + L0.engine.TOOL_VERSION;
    byId('confidence-model').textContent = L0.confidence.explainModel().join('\n');

    var notImplemented = byId('not-implemented');
    L0.detection.NOT_IMPLEMENTED_DETECTORS.forEach(function (entry) {
      var item = el('li');
      item.appendChild(el('code', null, entry[0] + '()'));
      item.appendChild(document.createTextNode(' — ' + entry[1]));
      notImplemented.appendChild(item);
    });

    var library = L0.rules.loadRules(L0.bundledRules);
    var host = byId('rule-list');
    var scroll = el('div', 'table-scroll');
    var table = el('table', 'rule-table');
    var thead = el('thead');
    var headRow = el('tr');
    ['Rule', 'Level', 'Severity', 'Detector', 'Checks'].forEach(function (heading) {
      headRow.appendChild(el('th', null, heading));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = el('tbody');
    library.rules.forEach(function (rule) {
      var row = el('tr');
      var idCell = el('td');
      idCell.appendChild(el('code', null, rule.rule_id));
      row.appendChild(idCell);
      row.appendChild(el('td', null, rule.level + ' ' + L0.rules.LEVEL_NAMES[rule.level]));
      row.appendChild(el('td', null, rule.severity));
      var detectorCell = el('td');
      detectorCell.appendChild(el('code', null, rule.detector));
      row.appendChild(detectorCell);
      row.appendChild(el('td', null, rule.title));
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    scroll.appendChild(table);

    host.appendChild(el('p', null, library.rules.length +
      ' rules loaded from ' + plural(library.files.length, 'file') +
      '. Rules are data: they are parsed and dispatched through a fixed operator registry, never executed.'));
    host.appendChild(scroll);
  }

  /* ---------------------------------------------------------------- wiring */

  function wire() {
    byId('file-input').addEventListener('change', function (event) {
      readFiles(event.target.files);
    });
    byId('sample-button').addEventListener('click', loadSample);
    byId('run-button').addEventListener('click', run);
    byId('clear-button').addEventListener('click', clearAll);
    byId('download-button').addEventListener('click', downloadJson);

    var dropzone = byId('dropzone');
    ['dragenter', 'dragover'].forEach(function (name) {
      dropzone.addEventListener(name, function (event) {
        event.preventDefault();
        dropzone.classList.add('is-dragging');
      });
    });
    ['dragleave', 'dragend'].forEach(function (name) {
      dropzone.addEventListener(name, function () { dropzone.classList.remove('is-dragging'); });
    });
    dropzone.addEventListener('drop', function (event) {
      event.preventDefault();
      dropzone.classList.remove('is-dragging');
      if (event.dataTransfer && event.dataTransfer.files) readFiles(event.dataTransfer.files);
    });
    // Dropping a file anywhere else must not navigate the tab away to it.
    window.addEventListener('dragover', function (event) { event.preventDefault(); });
    window.addEventListener('drop', function (event) { event.preventDefault(); });
  }

  renderStaticContent();
  wire();
  setStatus('Ready. Choose CSV files, or try the sample data.');
})();
