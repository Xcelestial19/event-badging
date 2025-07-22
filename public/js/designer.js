// public/js/designer.js

function updateFieldPosition(fieldId, x, y) {
  const el = document.getElementById(fieldId);
  if (el) {
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }
}

function updateFieldFont(fieldId, fontSize) {
  const el = document.getElementById(fieldId);
  if (el) {
    el.style.fontSize = fontSize + 'px';
  }
}

function updateFieldAlign(fieldId, align) {
  const el = document.getElementById(fieldId);
  if (el) {
    el.style.textAlign = align;
  }
}

function updateBadgeSize(width, height) {
  const preview = document.getElementById('card-preview');
  preview.style.width = width + 'px';
  preview.style.height = height + 'px';
}

function applyLayout(layout) {
  if (!layout) return;
  Object.entries(layout.fields || {}).forEach(([id, conf]) => {
    const el = document.getElementById(id);
    if (el) {
      el.style.left = conf.left;
      el.style.top = conf.top;
      el.style.display = conf.visible ? '' : 'none';
      if (conf.fontSize) el.style.fontSize = conf.fontSize;
      if (conf.align) el.style.textAlign = conf.align;
      // Update checkboxes and inputs
      const cb = document.querySelector(`.pd-toggle[data-field="${id}"]`);
      if (cb) cb.checked = conf.visible;
      const xInput = document.querySelector(`.pd-x[data-field="${id}"]`);
      const yInput = document.querySelector(`.pd-y[data-field="${id}"]`);
      if (xInput) xInput.value = parseInt(conf.left);
      if (yInput) yInput.value = parseInt(conf.top);
      const fontInput = document.querySelector(`.pd-font[data-field="${id}"]`);
      if (fontInput && conf.fontSize) fontInput.value = parseInt(conf.fontSize);
      const alignInput = document.querySelector(`.pd-align[data-field="${id}"]`);
      if (alignInput && conf.align) alignInput.value = conf.align;
    }
  });
  if (layout.size) {
    updateBadgeSize(layout.size.width, layout.size.height);
    // Set selector
    const sizeStr = layout.size.width + 'x' + layout.size.height;
    const badgeSize = document.getElementById('badge-size');
    if (badgeSize.querySelector(`option[value="${sizeStr}"]`)) {
      badgeSize.value = sizeStr;
      document.getElementById('custom-size-inputs').classList.add('hidden');
    } else {
      badgeSize.value = 'custom';
      document.getElementById('custom-size-inputs').classList.remove('hidden');
      document.getElementById('custom-width').value = layout.size.width;
      document.getElementById('custom-height').value = layout.size.height;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // Manual X/Y/Font/Align controls
  document.querySelectorAll('.pd-x, .pd-y, .pd-font, .pd-align').forEach(input => {
    input.addEventListener('input', function() {
      const field = this.dataset.field;
      const x = document.querySelector(`.pd-x[data-field="${field}"]`).value || 0;
      const y = document.querySelector(`.pd-y[data-field="${field}"]`).value || 0;
      updateFieldPosition(field, x, y);
      const fontInput = document.querySelector(`.pd-font[data-field="${field}"]`);
      if (fontInput) {
        updateFieldFont(field, fontInput.value || 14);
      }
      const alignInput = document.querySelector(`.pd-align[data-field="${field}"]`);
      if (alignInput) {
        updateFieldAlign(field, alignInput.value);
      }
    });
  });

  // Show/hide toggles
  document.querySelectorAll('.pd-toggle').forEach(cb => {
    cb.addEventListener('change', function() {
      const field = document.getElementById(this.dataset.field);
      field.style.display = this.checked ? '' : 'none';
    });
  });

  // Badge size selector
  const badgeSize = document.getElementById('badge-size');
  badgeSize.addEventListener('change', function() {
    let w = 350, h = 220;
    if (this.value === '400x600') { w = 400; h = 600; }
    else if (this.value === '300x400') { w = 300; h = 400; }
    else if (this.value === 'custom') {
      document.getElementById('custom-size-inputs').classList.remove('hidden');
      w = document.getElementById('custom-width').value || 350;
      h = document.getElementById('custom-height').value || 220;
    } else {
      document.getElementById('custom-size-inputs').classList.add('hidden');
    }
    updateBadgeSize(w, h);
  });

  // Custom size inputs
  document.getElementById('custom-width').addEventListener('input', function() {
    updateBadgeSize(this.value, document.getElementById('custom-height').value);
  });
  document.getElementById('custom-height').addEventListener('input', function() {
    updateBadgeSize(document.getElementById('custom-width').value, this.value);
  });

  // Save layout
  document.getElementById('pd-save').addEventListener('click', function() {
    const layout = { fields: {}, size: {} };
    document.querySelectorAll('.pd-field').forEach(el => {
      const fontInput = document.querySelector(`.pd-font[data-field="${el.id}"]`);
      const alignInput = document.querySelector(`.pd-align[data-field="${el.id}"]`);
      layout.fields[el.id] = {
        left: el.style.left || '0px',
        top: el.style.top || '0px',
        visible: el.style.display !== 'none',
        fontSize: fontInput ? (fontInput.value + 'px') : el.style.fontSize || '',
        align: alignInput ? alignInput.value : el.style.textAlign || 'left'
      };
    });
    // Badge size
    const preview = document.getElementById('card-preview');
    layout.size.width = parseInt(preview.style.width);
    layout.size.height = parseInt(preview.style.height);

    fetch('/save-layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(layout)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) alert('Layout saved!');
      else alert('Error saving layout');
    })
    .catch(err => alert('Error saving layout'));
  });

  // Apply saved layout if available
  if (window.savedLayout) applyLayout(window.savedLayout);
});