'use strict';
// ============================================================
// UTILS
// ============================================================
const Utils = {
  uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },
  now() { return new Date().toISOString(); },
  formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  },
  formatDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },
  timeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  },
  initials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  },
  esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },
  pct(num, den) { return den ? Math.round((num / den) * 100) : 0; },
  parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return { headers: [], rows: [] };
    const parseRow = line => {
      const vals = []; let inQ = false, cur = '';
      for (const c of line) {
        if (c === '"') inQ = !inQ;
        else if (c === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
        else cur += c;
      }
      vals.push(cur.trim());
      return vals.map(v => v.replace(/^"|"$/g, ''));
    };
    const headers = parseRow(lines[0]);
    const rows = lines.slice(1).map(line => {
      const vals = parseRow(line);
      const obj = {};
      headers.forEach((h, i) => obj[h.toLowerCase().trim()] = vals[i] || '');
      return obj;
    });
    return { headers, rows };
  },
  downloadCSV(data, filename) {
    if (!data.length) { Toast.error('No data to export.'); return; }
    const keys = Object.keys(data[0]);
    const csv = [keys.join(','), ...data.map(row => keys.map(k => `"${String(row[k]||'').replace(/"/g,'""')}"`).join(','))].join('\n');
    Utils.download(csv, filename, 'text/csv');
  },
  downloadJSON(data, filename) {
    Utils.download(JSON.stringify(data, null, 2), filename, 'application/json');
  },
  download(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },
  badgeClass(status) {
    const m = { draft:'badge-muted', submitted:'badge-primary', under_review:'badge-warning',
      review_complete:'badge-success', accepted:'badge-success', rejected:'badge-danger',
      modified:'badge-warning', re_annotation_required:'badge-danger',
      active:'badge-success', archived:'badge-muted', completed:'badge-success',
      pending:'badge-warning', draft_project:'badge-muted' };
    return m[status] || 'badge-muted';
  },
  statusLabel(status) {
    const m = { draft:'Draft', submitted:'Submitted', under_review:'Under Review',
      review_complete:'Reviewed', accepted:'Accepted', rejected:'Rejected',
      modified:'Modified', re_annotation_required:'Redo Required',
      active:'Active', archived:'Archived', completed:'Completed', pending:'Pending' };
    return m[status] || status;
  },
  taskLabel(t) {
    const m = { text_classification:'Text Classification', sentiment:'Sentiment Analysis',
      intent:'Intent Classification', ner:'Named Entity Tagging',
      ai_evaluation:'AI Evaluation', response_comparison:'Response Comparison (A vs B)' };
    return m[t] || t;
  },
  defaultLabels(taskType) {
    const m = {
      sentiment: ['Positive','Negative','Neutral'],
      intent: ['Complaint','Query','Praise','Feedback'],
      ai_evaluation: ['Correct','Partially Correct','Incorrect','Hallucination'],
      response_comparison: ['Response A Better','Response B Better','Both Same','Both Bad'],
      ner: ['Person','Organization','Location','Date','Product','Other'],
      text_classification: ['Category A','Category B','Category C'],
    };
    return m[taskType] || [];
  },
};
