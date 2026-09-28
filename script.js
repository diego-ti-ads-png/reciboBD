const STORAGE_KEY = 'recibosSalvos';
const inputFields = document.querySelectorAll('[data-model]');
const previewFields = document.querySelectorAll('[data-preview]');
const dateField = document.querySelector('[data-model="dataRecibo"]');
const saveBtn = document.getElementById('saveBtn');
const exportBtn = document.getElementById('exportBtn');
const importInput = document.getElementById('importInput');
const searchInput = document.getElementById('searchReceipt');
const dateFromFilter = document.getElementById('dateFromFilter');
const dateToFilter = document.getElementById('dateToFilter');
const savedReceiptsList = document.getElementById('savedReceiptsList');
let currentEditId = null;

function formatDate(dateValue) {
  if (!dateValue) return 'Data não informada';

  const date = new Date(dateValue + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return dateValue;

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatPhone(value) {
  const digits = String(value).replace(/\D/g, '').slice(0, 11);

  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatDocument(value) {
  const digits = String(value).replace(/\D/g, '').slice(0, 14);

  if (digits.length <= 11) {
    const cpf = digits.padStart(11, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    return cpf;
  }

  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

function formatCurrencyValue(value) {
  if (!value) return '';

  let clean = String(value).trim();

  if (clean.toLowerCase().startsWith('r$')) {
    clean = clean.replace(/^r\$\s*/i, '');
  }

  clean = clean.replace(/\s+/g, '');
  clean = clean.replace(/\./g, '').replace(',', '.');
  clean = clean.replace(/[^\d.-]/g, '');

  if (!clean || clean === '.' || clean === '-' || clean === '-.') {
    return '';
  }

  const amount = Number(clean);
  if (!Number.isFinite(amount)) return '';

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
}

function getSavedReceipts() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored);
  } catch (error) {
    return [];
  }
}

function saveReceipts(receipts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
}

function collectFormData() {
  const data = {};

  inputFields.forEach((input) => {
    const key = input.dataset.model;
    data[key] = input.value.trim();
  });

  return data;
}

function applyFormData(data) {
  inputFields.forEach((input) => {
    const key = input.dataset.model;
    if (data[key] !== undefined) {
      input.value = data[key];
    }
  });

  updatePreview();
}

function normalizeInitialValues() {
  inputFields.forEach((input) => {
    const model = input.dataset.model;
    const value = input.value.trim();

    if (!value) return;

    if (model === 'emitenteTelefone' || model === 'pagadorTelefone') {
      input.value = formatPhone(value);
    }

    if (model === 'emitenteDocumento' || model === 'pagadorDocumento') {
      input.value = formatDocument(value);
    }

    if (model === 'valorRecebido') {
      input.value = formatCurrencyValue(value) || value;
    }
  });
}

function updatePreview() {
  inputFields.forEach((input) => {
    const key = input.dataset.model;
    const rawValue = input.value.trim();
    const renderedValue = key === 'valorRecebido'
      ? (rawValue ? `R$ ${formatCurrencyValue(rawValue)}` : '')
      : rawValue;

    const targets = document.querySelectorAll(`[data-preview="${key}"]`);
    targets.forEach((target) => {
      target.textContent = renderedValue || input.placeholder || '[preencher]';
    });
  });

  const dateTarget = document.querySelectorAll('[data-preview="dataRecibo"]');
  dateTarget.forEach((target) => {
    target.textContent = formatDate(dateField?.value || '');
  });
}

function renderSavedReceipts() {
  const term = (searchInput.value || '').toLowerCase();
  const fromDate = dateFromFilter.value;
  const toDate = dateToFilter.value;
  const receipts = getSavedReceipts();

  const filtered = receipts.filter((receipt) => {
    const searchableText = [
      receipt.emitenteNome,
      receipt.codigoRecibo,
      receipt.valorRecebido,
      receipt.pagadorNome,
      receipt.referencia,
      receipt.formaPagamento,
      receipt.dataRecibo,
    ].join(' ').toLowerCase();

    const matchesText = !term || searchableText.includes(term);
    const receiptDate = receipt.dataRecibo || '';
    const matchesFromDate = !fromDate || !receiptDate || receiptDate >= fromDate;
    const matchesToDate = !toDate || !receiptDate || receiptDate <= toDate;

    return matchesText && matchesFromDate && matchesToDate;
  });

  if (!filtered.length) {
    savedReceiptsList.innerHTML = '<div class="saved-item"><strong>Nenhum recibo salvo</strong><small>Use “Salvar recibo” para guardar um registro.</small></div>';
    return;
  }

  savedReceiptsList.innerHTML = filtered
    .map(
      (receipt) => `
        <div class="saved-item-row">
          <button type="button" class="saved-item" data-id="${receipt.id}">
            <strong>${receipt.emitenteNome || 'Recebimento sem nome'}</strong>
            <small>${receipt.codigoRecibo || 'Sem código'} • ${receipt.valorRecebido || 'Sem valor'} • ${receipt.referencia || 'Sem referência'}</small>
          </button>
          <button type="button" class="delete-saved-btn" data-delete-id="${receipt.id}" aria-label="Excluir recibo">X</button>
        </div>
      `
    )
    .join('');

  savedReceiptsList.querySelectorAll('.saved-item').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.id;
      const receipt = filtered.find((item) => String(item.id) === String(id));
      if (receipt) {
        currentEditId = Number(receipt.id);
        saveBtn.textContent = 'Salvar edição';
        applyFormData(receipt);
      }
    });
  });

  savedReceiptsList.querySelectorAll('.delete-saved-btn').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const id = Number(button.dataset.deleteId);
      const receipts = getSavedReceipts().filter((item) => Number(item.id) !== id);
      saveReceipts(receipts);
      renderSavedReceipts();
    });
  });
}

inputFields.forEach((input) => {
  const model = input.dataset.model;

  if (model === 'valorRecebido') {
    input.addEventListener('input', () => {
      const rawText = input.value.replace(/[^\d,.-]/g, '');
      const sanitized = rawText.replace(/(\..*)\./g, '$1');
      input.value = sanitized;
      updatePreview();
    });
    return;
  }

  if (model === 'emitenteTelefone' || model === 'pagadorTelefone') {
    input.addEventListener('input', () => {
      input.value = formatPhone(input.value);
      updatePreview();
    });
    return;
  }

  if (model === 'emitenteDocumento' || model === 'pagadorDocumento') {
    input.addEventListener('input', () => {
      input.value = formatDocument(input.value);
      updatePreview();
    });
    return;
  }

  input.addEventListener('input', updatePreview);
  input.addEventListener('change', updatePreview);
});

document.getElementById('printBtn').addEventListener('click', () => {
  window.print();
});

document.getElementById('clearBtn').addEventListener('click', () => {
  inputFields.forEach((input) => {
    input.value = '';
  });

  currentEditId = null;
  saveBtn.textContent = 'Salvar recibo';
  updatePreview();
});

saveBtn.addEventListener('click', () => {
  const formData = collectFormData();
  const receipts = getSavedReceipts();

  if (currentEditId !== null) {
    const index = receipts.findIndex((item) => Number(item.id) === Number(currentEditId));
    if (index >= 0) {
      receipts[index] = { ...receipts[index], ...formData, id: currentEditId };
      saveReceipts(receipts);
      renderSavedReceipts();
      alert('Recibo atualizado com sucesso!');
      currentEditId = null;
      saveBtn.textContent = 'Salvar recibo';
      return;
    }
  }

  receipts.unshift({ id: Date.now(), ...formData });
  saveReceipts(receipts);
  renderSavedReceipts();
  alert('Recibo salvo com sucesso!');
});

searchInput.addEventListener('input', renderSavedReceipts);
dateFromFilter.addEventListener('input', renderSavedReceipts);
dateToFilter.addEventListener('input', renderSavedReceipts);

exportBtn.addEventListener('click', () => {
  const receipts = getSavedReceipts();
  const blob = new Blob([JSON.stringify(receipts, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'recibos-salvos.json';
  a.click();
  URL.revokeObjectURL(url);
});

importInput.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(String(reader.result));
      if (!Array.isArray(imported)) {
        throw new Error('Arquivo inválido');
      }

      saveReceipts(imported);
      renderSavedReceipts();
      alert('Recibos importados com sucesso!');
    } catch (error) {
      alert('Arquivo JSON inválido.');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
});

normalizeInitialValues();
updatePreview();
renderSavedReceipts();
