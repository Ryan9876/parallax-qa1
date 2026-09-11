(() => {
  'use strict';

  const KEY = 'decision-ledger.records.v1';
  const statuses = ['Proposed', 'Accepted', 'Superseded'];
  const textFields = ['title', 'decisionDate', 'owner', 'context', 'finalDecision', 'options', 'updatedAt'];

  function valid(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
    if (typeof record.id !== 'string' || !record.id.trim()) return false;
    if (typeof record.title !== 'string' || !record.title.trim()) return false;
    if (!statuses.includes(record.status)) return false;
    if (!Array.isArray(record.tags) || record.tags.some(tag => typeof tag !== 'string')) return false;
    if (textFields.some(field => typeof record[field] !== 'string')) return false;
    return true;
  }

  function validImport(value) {
    const incoming = Array.isArray(value) ? value : value && value.records;
    return Array.isArray(incoming) && incoming.every(valid) ? incoming : null;
  }

  // Kept available for the local browser test page without exposing application data.
  window.DecisionLedgerTestHooks = { valid, validImport };

  const $ = id => document.getElementById(id);
  const list = $('decisionList');
  if (!list) return;

  const empty = $('emptyState');
  const dialog = $('editorDialog');
  const form = $('decisionForm');
  let records = load();
  let editingId = null;

  const uid = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);

  function load() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || '[]');
      const imported = validImport(value);
      return imported || [];
    } catch {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(records));
      return true;
    } catch {
      toast('Could not save this decision in the browser');
      return false;
    }
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  }

  function dateText(value) {
    if (!value) return 'No decision date';
    const date = new Date(value + 'T00:00:00');
    return Number.isNaN(date.valueOf()) ? 'No decision date' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function render() {
    const query = $('search').value.trim().toLowerCase();
    const status = $('statusFilter').value;
    const selectedTag = $('tagFilter').value;
    const order = $('sortOrder').value;
    const tags = [...new Set(records.flatMap(record => record.tags))].sort((a, b) => a.localeCompare(b));
    $('tagFilter').innerHTML = '<option value="all">All tags</option>' + tags.map(tag => `<option value="${esc(tag)}">${esc(tag)}</option>`).join('');
    $('tagFilter').value = tags.includes(selectedTag) ? selectedTag : 'all';
    const tag = $('tagFilter').value;

    const shown = records.filter(record => {
      const haystack = [record.title, record.owner, record.context, record.finalDecision, record.options, record.tags.join(' ')].join(' ').toLowerCase();
      return (!query || haystack.includes(query)) && (status === 'all' || record.status === status) && (tag === 'all' || record.tags.includes(tag));
    }).sort((a, b) => {
      if (order === 'title') return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
      if (order === 'date') return (b.decisionDate || '').localeCompare(a.decisionDate || '') || a.title.localeCompare(b.title);
      return (b.updatedAt || '').localeCompare(a.updatedAt || '') || a.title.localeCompare(b.title);
    });

    $('resultCount').textContent = `${shown.length} decision${shown.length === 1 ? '' : 's'}`;
    $('resultHint').textContent = records.length ? (shown.length === records.length ? 'Every record in your ledger' : 'Matching your current view') : 'Your ledger is ready when you are.';
    list.innerHTML = shown.map(card).join('');
    list.hidden = !shown.length;
    empty.hidden = !!shown.length;
    $('emptyTitle').textContent = records.length ? 'Nothing matches' : 'No decisions yet';
    $('emptyText').textContent = records.length ? 'Try a different search or filter, or clear your current view.' : 'Start a record to preserve the thinking behind your next important choice.';
    $('emptyAction').textContent = records.length ? 'Clear filters' : 'Create your first decision';
  }

  function card(record) {
    const copy = record.finalDecision || record.context || 'No additional detail yet.';
    return `<article class="card"><div class="card-top"><h3>${esc(record.title)}</h3><span class="status status-${record.status.toLowerCase()}" aria-label="Status: ${esc(record.status)}">${esc(record.status)}</span></div><p class="card-copy">${esc(copy)}</p><div class="tags">${record.tags.map(tag => `<span class="tag">${esc(tag)}</span>`).join('')}</div><div class="card-meta">${esc(dateText(record.decisionDate))}${record.owner ? ` · ${esc(record.owner)}` : ''}</div><div class="card-actions"><button class="text-button" data-edit="${esc(record.id)}" type="button">Edit</button><button class="text-button danger" data-delete="${esc(record.id)}" type="button">Delete</button></div></article>`;
  }

  function openEditor(record) {
    editingId = record?.id || null;
    $('dialogTitle').textContent = record ? 'Edit decision' : 'New decision';
    $('formError').hidden = true;
    [...form.elements].forEach(element => {
      if (!element.name) return;
      element.value = record ? (element.name === 'tags' ? record.tags.join(', ') : record[element.name] || '') : (element.name === 'status' ? 'Proposed' : element.name === 'decisionDate' ? new Date().toISOString().slice(0, 10) : '');
    });
    dialog.showModal();
    $('title').focus();
  }

  function close() {
    dialog.close();
    editingId = null;
  }

  $('newDecision').onclick = () => openEditor();
  $('emptyAction').onclick = () => {
    if (records.length) {
      $('search').value = '';
      $('statusFilter').value = 'all';
      $('tagFilter').value = 'all';
      render();
    } else openEditor();
  };
  $('closeDialog').onclick = close;
  $('cancelDialog').onclick = close;

  form.onsubmit = event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (!data.title.trim()) {
      $('formError').textContent = 'A title is required so this decision can be found later.';
      $('formError').hidden = false;
      $('title').focus();
      return;
    }
    const wasEditing = Boolean(editingId);
    const now = new Date().toISOString();
    const record = {
      id: editingId || uid(),
      title: data.title.trim(),
      status: statuses.includes(data.status) ? data.status : 'Proposed',
      decisionDate: data.decisionDate,
      owner: data.owner.trim(),
      context: data.context.trim(),
      finalDecision: data.finalDecision.trim(),
      options: data.options.trim(),
      tags: data.tags.split(',').map(tag => tag.trim()).filter(Boolean).filter((tag, index, all) => all.indexOf(tag) === index),
      updatedAt: now
    };
    records = wasEditing ? records.map(item => item.id === editingId ? record : item) : [...records, record];
    if (!save()) return;
    close();
    render();
    toast(wasEditing ? 'Decision updated' : 'Decision saved');
  };

  list.onclick = event => {
    const edit = event.target.closest('[data-edit]');
    const del = event.target.closest('[data-delete]');
    if (edit) openEditor(records.find(record => record.id === edit.dataset.edit));
    if (del) {
      const record = records.find(item => item.id === del.dataset.delete);
      if (record && confirm(`Delete “${record.title}”? This cannot be undone.`)) {
        records = records.filter(item => item.id !== record.id);
        if (save()) {
          render();
          toast('Decision deleted');
        }
      }
    }
  };

  ['search', 'statusFilter', 'tagFilter', 'sortOrder'].forEach(id => $(id).addEventListener('input', render));

  $('exportData').onclick = () => {
    const blob = new Blob([JSON.stringify({ format: 'decision-ledger', version: 1, records }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'decision-ledger.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
    toast('Ledger exported');
  };

  $('importData').onclick = () => $('fileInput').click();
  $('fileInput').onchange = event => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const incoming = validImport(JSON.parse(reader.result));
        if (!incoming) throw new Error('Invalid Decision Ledger data');
        if (!confirm(`Replace your ${records.length} existing decision${records.length === 1 ? '' : 's'} with ${incoming.length} imported record${incoming.length === 1 ? '' : 's'}?`)) return;
        records = incoming.map(record => ({ ...record, tags: [...record.tags] }));
        if (save()) {
          render();
          toast('Ledger imported');
        }
      } catch {
        toast('Import failed: choose a valid Decision Ledger JSON file');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  let toastTimer;
  function toast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3500);
  }

  render();
})();
