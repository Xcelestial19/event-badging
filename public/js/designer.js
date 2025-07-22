function updateFieldPosition(fieldId, x, y) {
  const el = document.getElementById(fieldId);
  if (el) {
    el.style.left = "50%";
    el.style.top = y + 'px';
    el.style.transform = "translateX(-50%)";
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

function updateFieldScale(fieldId, scale) {
  const el = document.getElementById(fieldId);
  if (el) {
    const img = el.querySelector('img');
    if (img) {
      img.style.width = scale + 'px';
      img.style.height = (fieldId === 'pd-barcode' ? Math.round(scale/3) : scale) + 'px';
    }
    el.style.width = scale + 'px';
    el.style.height = (fieldId === 'pd-barcode' ? Math.round(scale/3) : scale) + 'px';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // Manual X/Y/Font/Align/Scale controls
  document.querySelectorAll('.pd-x, .pd-y, .pd-font, .pd-align, .pd-scale').forEach(input => {
    input.addEventListener('input', function() {
      const field = this.dataset.field;
      const x = document.querySelector(`.pd-x[data-field="${field}"]`).value || 0; // Not used, always centered
      const y = document.querySelector(`.pd-y[data-field="${field}"]`).value || 0;
      updateFieldPosition(field, x, y);
      const fontInput = document.querySelector(`.pd-font[data-field="${field}"]`);
      if (fontInput) updateFieldFont(field, fontInput.value || 14);
      const alignInput = document.querySelector(`.pd-align[data-field="${field}"]`);
      if (alignInput) updateFieldAlign(field, alignInput.value);
      const scaleInput = document.querySelector(`.pd-scale[data-field="${field}"]`);
      if (scaleInput) updateFieldScale(field, scaleInput.value || 60);
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
    document.getElementById('card-preview').style.width = w + 'px';
    document.getElementById('card-preview').style.height = h + 'px';
  });

  // Custom size inputs
  document.getElementById('custom-width').addEventListener('input', function() {
    document.getElementById('card-preview').style.width = this.value + 'px';
  });
  document.getElementById('custom-height').addEventListener('input', function() {
    document.getElementById('card-preview').style.height = this.value + 'px';
  });

  // Save layout
  document.getElementById('pd-save').addEventListener('click', function() {
    const layout = { fields: {}, size: {} };
    document.querySelectorAll('.pd-field').forEach(el => {
      const fontInput = document.querySelector(`.pd-font[data-field="${el.id}"]`);
      const alignInput = document.querySelector(`.pd-align[data-field="${el.id}"]`);
      const scaleInput = document.querySelector(`.pd-scale[data-field="${el.id}"]`);
      const yInput = document.querySelector(`.pd-y[data-field="${el.id}"]`);
      layout.fields[el.id] = {
        top: yInput ? (yInput.value + 'px') : el.style.top || '0px',
        visible: el.style.display !== 'none',
        fontSize: fontInput ? (fontInput.value + 'px') : el.style.fontSize || '',
        align: alignInput ? alignInput.value : el.style.textAlign || 'center',
        scale: scaleInput ? (scaleInput.value + 'px') : el.style.width || ''
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
  function applyLayout(layout) {
    if (!layout) return;
    Object.entries(layout.fields || {}).forEach(([id, conf]) => {
      const el = document.getElementById(id);
      if (el) {
        el.style.left = "50%";
        el.style.transform = "translateX(-50%)";
        el.style.top = conf.top || '0px';
        el.style.display = conf.visible ? '' : 'none';
        if (conf.fontSize) el.style.fontSize = conf.fontSize;
        if (conf.align) el.style.textAlign = conf.align;
        if (conf.scale) updateFieldScale(id, parseInt(conf.scale));
      }
    });
    if (layout.size) {
      document.getElementById('card-preview').style.width = layout.size.width + 'px';
      document.getElementById('card-preview').style.height = layout.size.height + 'px';
    }
  }
  if (window.savedLayout) applyLayout(window.savedLayout);
});