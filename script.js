'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const CANVAS_SIZE = 1080;
const HANDLE_R = 18;

let layers = [];
let selectedLayerId = null;
let idCounter = 0;
const imageCache = {};

let historyStack = [];
let historyIndex = -1;

let dragMode = null;
let dragStart = { x: 0, y: 0 };
let dragSnapshot = null;

/* DOM */
const uploadBtn = document.getElementById('uploadBtn');
const imageLoader = document.getElementById('imageLoader');
const textBtn = document.getElementById('textBtn');
const emojiBtn = document.getElementById('emojiBtn');
const shapeBtn = document.getElementById('shapeBtn');
const emojiPanel = document.getElementById('emojiPanel');
const shapePanel = document.getElementById('shapePanel');

const layerPanel = document.getElementById('layerPanel');
const editTextBtn = document.getElementById('editTextBtn');
const colorPicker = document.getElementById('colorPicker');
const flipXBtn = document.getElementById('flipX');
const flipYBtn = document.getElementById('flipY');
const deleteLayerBtn = document.getElementById('deleteLayer');

const zoomInput = document.getElementById('zoom');
const rotateInput = document.getElementById('rotate');
const opacityInput = document.getElementById('opacity');
const zoomVal = document.getElementById('zoomVal');
const rotateVal = document.getElementById('rotateVal');
const opacityVal = document.getElementById('opacityVal');
const controlsHint = document.getElementById('controlsHint');

const frameStyleSelect = document.getElementById('frameStyle');
const frameSizeInput = document.getElementById('frameSize');
const frameSizeVal = document.getElementById('frameSizeVal');
const shadowCheck = document.getElementById('shadowCheck');

const undoBtn = document.getElementById('undo');
const redoBtn = document.getElementById('redo');
const clearAllBtn = document.getElementById('clearAll');

const downloadPNGBtn = document.getElementById('downloadPNG');
const downloadJPGBtn = document.getElementById('downloadJPG');

const textEditOverlay = document.getElementById('textEditOverlay');

/* UTIL */
function uid() { return 'l' + (idCounter++) + '_' + Date.now(); }
function getSelectedLayer() { return layers.find(l => l.id === selectedLayerId) || null; }

function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function transformPoint(layer, lx, ly) {
  const rad = layer.rotation * Math.PI / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  return { x: layer.x + (lx * cos - ly * sin), y: layer.y + (lx * sin + ly * cos) };
}
function toLocal(layer, px, py) {
  const rad = -layer.rotation * Math.PI / 180;
  const dx = px - layer.x, dy = py - layer.y;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}
function getHandles(layer) {
  const w = layer.width, h = layer.height;
  return {
    corners: [
      transformPoint(layer, -w / 2, -h / 2), transformPoint(layer, w / 2, -h / 2),
      transformPoint(layer, w / 2, h / 2), transformPoint(layer, -w / 2, h / 2)
    ],
    resize: transformPoint(layer, w / 2, h / 2),
    rotate: transformPoint(layer, 0, -h / 2 - 45),
    topMid: transformPoint(layer, 0, -h / 2),
    del: transformPoint(layer, w / 2 + 8, -h / 2 - 8)
  };
}

/* HISTORY */
function serializeLayers() { return layers.map(l => { const c = { ...l }; delete c.img; return c; }); }
function restoreLayers(data) {
  layers = data.map(l => { const c = { ...l }; if (c.type === 'image') c.img = imageCache[c.imgSrc]; return c; });
}
function pushHistory() {
  historyStack = historyStack.slice(0, historyIndex + 1);
  historyStack.push(JSON.stringify(serializeLayers()));
  historyIndex++;
  if (historyStack.length > 60) { historyStack.shift(); historyIndex--; }
  updateUndoRedoButtons();
}
function undo() {
  if (historyIndex <= 0) return;
  historyIndex--;
  restoreLayers(JSON.parse(historyStack[historyIndex]));
  selectedLayerId = null; refreshLayerUI(); render(); updateUndoRedoButtons();
}
function redo() {
  if (historyIndex >= historyStack.length - 1) return;
  historyIndex++;
  restoreLayers(JSON.parse(historyStack[historyIndex]));
  selectedLayerId = null; refreshLayerUI(); render(); updateUndoRedoButtons();
}
function updateUndoRedoButtons() {
  undoBtn.disabled = historyIndex <= 0;
  redoBtn.disabled = historyIndex >= historyStack.length - 1;
}

/* LAYER CREATION */
function addImageLayer(img, src) {
  const maxDim = CANVAS_SIZE * 0.7;
  let w = img.width, h = img.height;
  const ratio = Math.min(maxDim / w, maxDim / h, 1);
  w *= ratio; h *= ratio;
  const layer = {
    id: uid(), type: 'image', x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2,
    width: w, height: h, baseWidth: w, baseHeight: h,
    rotation: 0, opacity: 1, flipX: false, flipY: false, img, imgSrc: src
  };
  layers.push(layer); selectLayer(layer.id); pushHistory(); render();
}
function addTextLayer(text = 'Matn', fontSize = 70) {
  const layer = {
    id: uid(), type: 'text', x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2,
    width: 200, height: 90, rotation: 0, opacity: 1, flipX: false, flipY: false,
    text, fontSize, baseFontSize: fontSize, fontFamily: 'Arial, sans-serif', color: '#ffffff'
  };
  updateTextLayerSize(layer);
  layers.push(layer); selectLayer(layer.id); pushHistory(); render();
  return layer;
}
function addShapeLayer(shapeType) {
  const colors = { rect: '#22c55e', circle: '#3b82f6', triangle: '#f59e0b', star: '#ef4444' };
  const layer = {
    id: uid(), type: 'shape', shapeType, x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2,
    width: 260, height: 260, baseWidth: 260, baseHeight: 260,
    rotation: 0, opacity: 1, flipX: false, flipY: false, color: colors[shapeType] || '#22c55e'
  };
  layers.push(layer); selectLayer(layer.id); pushHistory(); render();
}
function updateTextLayerSize(layer) {
  ctx.font = `${layer.fontSize}px ${layer.fontFamily}`;
  const metrics = ctx.measureText(layer.text || ' ');
  layer.width = Math.max(40, metrics.width + 20);
  layer.height = layer.fontSize * 1.3;
}

/* RENDER */
function drawCheckerboard(c, size) {
  const cell = 24;
  for (let y = 0; y < size; y += cell) for (let x = 0; x < size; x += cell) {
    c.fillStyle = ((x / cell + y / cell) % 2 === 0) ? '#232135' : '#2b2846';
    c.fillRect(x, y, cell, cell);
  }
}
function drawShape(c, layer) {
  c.fillStyle = layer.color;
  const w = layer.width, h = layer.height;
  switch (layer.shapeType) {
    case 'rect': c.fillRect(-w / 2, -h / 2, w, h); break;
    case 'circle': c.beginPath(); c.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); c.fill(); break;
    case 'triangle':
      c.beginPath(); c.moveTo(0, -h / 2); c.lineTo(w / 2, h / 2); c.lineTo(-w / 2, h / 2); c.closePath(); c.fill();
      break;
    case 'star': drawStar(c, 0, 0, 5, w / 2, w / 4); break;
  }
}
function drawStar(c, cx, cy, spikes, outerR, innerR) {
  let rot = Math.PI / 2 * 3;
  const step = Math.PI / spikes;
  c.beginPath(); c.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    let x = cx + Math.cos(rot) * outerR, y = cy + Math.sin(rot) * outerR;
    c.lineTo(x, y); rot += step;
    x = cx + Math.cos(rot) * innerR; y = cy + Math.sin(rot) * innerR;
    c.lineTo(x, y); rot += step;
  }
  c.lineTo(cx, cy - outerR); c.closePath(); c.fill();
}
function drawLayer(c, layer) {
  c.save();
  c.globalAlpha = layer.opacity;
  c.translate(layer.x, layer.y);
  c.rotate(layer.rotation * Math.PI / 180);
  c.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
  if (layer.type === 'image') {
    c.drawImage(layer.img, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
  } else if (layer.type === 'text') {
    c.font = `${layer.fontSize}px ${layer.fontFamily}`;
    c.fillStyle = layer.color; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(layer.text, 0, 0);
  } else if (layer.type === 'shape') { drawShape(c, layer); }
  c.restore();
}
function drawFrame(c, size) {
  const style = frameStyleSelect.value;
  const fSize = parseInt(frameSizeInput.value, 10);
  if (style === 'none' || fSize === 0) return;
  c.save();
  if (shadowCheck.checked) { c.shadowColor = 'rgba(0,0,0,0.4)'; c.shadowBlur = 25; c.shadowOffsetY = 10; }
  let strokeStyle;
  if (style === 'white') strokeStyle = '#ffffff';
  else if (style === 'black') strokeStyle = '#000000';
  else if (style === 'gradient') {
    const g = c.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, '#22c55e'); g.addColorStop(1, '#3b82f6'); strokeStyle = g;
  }
  c.strokeStyle = strokeStyle; c.lineWidth = fSize;
  c.strokeRect(fSize / 2, fSize / 2, size - fSize, size - fSize);
  c.restore();
}
function drawHandle(c, pos, color, label) {
  c.beginPath(); c.arc(pos.x, pos.y, HANDLE_R, 0, Math.PI * 2);
  c.fillStyle = color; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
  if (label) {
    c.fillStyle = '#fff'; c.font = 'bold 20px sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, pos.x, pos.y);
  }
}
function drawSelectionUI(c, layer) {
  const h = getHandles(layer);
  c.save();
  c.strokeStyle = '#22c55e'; c.lineWidth = 2; c.setLineDash([8, 5]);
  c.beginPath(); c.moveTo(h.corners[0].x, h.corners[0].y);
  h.corners.slice(1).forEach(p => c.lineTo(p.x, p.y));
  c.closePath(); c.stroke(); c.setLineDash([]);
  c.beginPath(); c.moveTo(h.topMid.x, h.topMid.y); c.lineTo(h.rotate.x, h.rotate.y); c.stroke();
  drawHandle(c, h.resize, '#22c55e');
  drawHandle(c, h.rotate, '#3b82f6', '↻');
  drawHandle(c, h.del, '#ef4444', '×');
  c.restore();
}
function render(targetCtx = ctx, size = CANVAS_SIZE, showUI = true) {
  targetCtx.clearRect(0, 0, size, size);
  if (showUI) drawCheckerboard(targetCtx, size);
  if (showUI && layers.length === 0) {
    targetCtx.fillStyle = 'rgba(255,255,255,0.35)';
    targetCtx.font = '32px sans-serif'; targetCtx.textAlign = 'center'; targetCtx.textBaseline = 'middle';
    targetCtx.fillText("Pastdagi tugmalar orqali", size / 2, size / 2 - 20);
    targetCtx.fillText("rasm, matn yoki shakl qo'shing", size / 2, size / 2 + 20);
  }
  layers.forEach(l => drawLayer(targetCtx, l));
  drawFrame(targetCtx, size);
  if (showUI) { const sel = getSelectedLayer(); if (sel) drawSelectionUI(targetCtx, sel); }
}

/* SELECTION UI SYNC */
function selectLayer(id) { selectedLayerId = id; refreshLayerUI(); render(); }
function refreshLayerUI() {
  const layer = getSelectedLayer();
  if (!layer) {
    controlsHint.style.display = 'block';
    [zoomInput, rotateInput, opacityInput].forEach(i => i.disabled = true);
    layerPanel.style.display = 'none';
    return;
  }
  controlsHint.style.display = 'none';
  [zoomInput, rotateInput, opacityInput].forEach(i => i.disabled = false);
  const base = layer.type === 'text' ? layer.baseFontSize : layer.baseWidth;
  const current = layer.type === 'text' ? layer.fontSize : layer.width;
  const zoomPct = Math.round((current / base) * 100);
  zoomInput.value = zoomPct; zoomVal.textContent = zoomPct + '%';
  rotateInput.value = Math.round(layer.rotation); rotateVal.textContent = Math.round(layer.rotation) + '°';
  opacityInput.value = Math.round(layer.opacity * 100); opacityVal.textContent = Math.round(layer.opacity * 100) + '%';
  layerPanel.style.display = 'flex';
  editTextBtn.style.display = layer.type === 'text' ? 'inline-block' : 'none';
  const showColor = layer.type === 'text' || layer.type === 'shape';
  colorPicker.style.display = showColor ? 'inline-block' : 'none';
  if (showColor) colorPicker.value = layer.color;
}

/* POINTER INTERACTION */
function findLayerAt(pos) {
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i];
    const local = toLocal(l, pos.x, pos.y);
    if (Math.abs(local.x) <= l.width / 2 && Math.abs(local.y) <= l.height / 2) return l;
  }
  return null;
}
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  const pos = getCanvasPos(e);
  const sel = getSelectedLayer();
  if (sel) {
    const h = getHandles(sel);
    if (dist(pos, h.del) < HANDLE_R + 6) { deleteSelectedLayer(); return; }
    if (dist(pos, h.resize) < HANDLE_R + 6) { dragMode = 'resize'; dragSnapshot = { ...sel }; dragStart = pos; return; }
    if (dist(pos, h.rotate) < HANDLE_R + 6) { dragMode = 'rotate'; dragSnapshot = { ...sel }; dragStart = pos; return; }
  }
  const hit = findLayerAt(pos);
  if (hit) {
    if (selectedLayerId !== hit.id) selectLayer(hit.id);
    dragMode = 'move'; dragSnapshot = { x: hit.x, y: hit.y }; dragStart = pos;
  } else { selectLayer(null); }
  render();
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragMode) return;
  const pos = getCanvasPos(e);
  const layer = getSelectedLayer();
  if (!layer) return;
  if (dragMode === 'move') {
    layer.x = dragSnapshot.x + (pos.x - dragStart.x);
    layer.y = dragSnapshot.y + (pos.y - dragStart.y);
  } else if (dragMode === 'resize') {
    const local = toLocal(layer, pos.x, pos.y);
    const newW = Math.max(30, Math.abs(local.x) * 2);
    if (layer.type === 'text') {
      const scale = newW / layer.width;
      layer.fontSize = Math.max(10, layer.fontSize * scale);
      updateTextLayerSize(layer);
    } else {
      layer.width = newW;
      layer.height = Math.max(30, Math.abs(local.y) * 2);
    }
  } else if (dragMode === 'rotate') {
    const dx = pos.x - layer.x, dy = pos.y - layer.y;
    layer.rotation = Math.round(Math.atan2(dy, dx) * 180 / Math.PI + 90);
  }
  refreshLayerUI(); render();
});
canvas.addEventListener('pointerup', () => { if (dragMode) { pushHistory(); dragMode = null; } });
canvas.addEventListener('pointercancel', () => { dragMode = null; });
canvas.addEventListener('dblclick', (e) => {
  const pos = getCanvasPos(e);
  const hit = findLayerAt(pos);
  if (hit && hit.type === 'text') enterTextEditMode(hit);
});

/* DELETE / FLIP */
function deleteSelectedLayer() {
  if (!selectedLayerId) return;
  layers = layers.filter(l => l.id !== selectedLayerId);
  selectedLayerId = null; refreshLayerUI(); pushHistory(); render();
}
deleteLayerBtn.addEventListener('click', deleteSelectedLayer);
flipXBtn.addEventListener('click', () => { const l = getSelectedLayer(); if (!l) return; l.flipX = !l.flipX; pushHistory(); render(); });
flipYBtn.addEventListener('click', () => { const l = getSelectedLayer(); if (!l) return; l.flipY = !l.flipY; pushHistory(); render(); });

/* COLOR / SLIDERS */
colorPicker.addEventListener('input', () => { const l = getSelectedLayer(); if (!l) return; l.color = colorPicker.value; render(); });
colorPicker.addEventListener('change', pushHistory);

zoomInput.addEventListener('input', () => {
  const l = getSelectedLayer(); if (!l) return;
  const pct = parseInt(zoomInput.value, 10);
  zoomVal.textContent = pct + '%';
  if (l.type === 'text') { l.fontSize = l.baseFontSize * (pct / 100); updateTextLayerSize(l); }
  else { l.width = l.baseWidth * (pct / 100); l.height = l.baseHeight * (pct / 100); }
  render();
});
zoomInput.addEventListener('change', pushHistory);

rotateInput.addEventListener('input', () => {
  const l = getSelectedLayer(); if (!l) return;
  l.rotation = parseInt(rotateInput.value, 10);
  rotateVal.textContent = l.rotation + '°'; render();
});
rotateInput.addEventListener('change', pushHistory);

opacityInput.addEventListener('input', () => {
  const l = getSelectedLayer(); if (!l) return;
  l.opacity = parseInt(opacityInput.value, 10) / 100;
  opacityVal.textContent = opacityInput.value + '%'; render();
});
opacityInput.addEventListener('change', pushHistory);

/* FRAME */
frameStyleSelect.addEventListener('change', () => { render(); pushHistory(); });
frameSizeInput.addEventListener('input', () => { frameSizeVal.textContent = frameSizeInput.value + 'px'; render(); });
frameSizeInput.addEventListener('change', pushHistory);
shadowCheck.addEventListener('change', () => { render(); pushHistory(); });

/* IMAGE UPLOAD */
uploadBtn.addEventListener('click', () => imageLoader.click());
imageLoader.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { alert('Iltimos rasm faylini tanlang'); return; }
  const reader = new FileReader();
  reader.onload = (ev) => {
    const src = ev.target.result;
    const img = new Image();
    img.onload = () => { imageCache[src] = img; addImageLayer(img, src); };
    img.src = src;
  };
  reader.readAsDataURL(file);
  imageLoader.value = '';
});
canvas.addEventListener('dragover', (e) => e.preventDefault());
canvas.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const src = ev.target.result;
    const img = new Image();
    img.onload = () => { imageCache[src] = img; addImageLayer(img, src); };
    img.src = src;
  };
  reader.readAsDataURL(file);
});

/* TEXT */
textBtn.addEventListener('click', () => { const layer = addTextLayer(); enterTextEditMode(layer); });
editTextBtn.addEventListener('click', () => { const l = getSelectedLayer(); if (l && l.type === 'text') enterTextEditMode(l); });
function enterTextEditMode(layer) {
  const rect = canvas.getBoundingClientRect();
  const scale = rect.width / CANVAS_SIZE;
  textEditOverlay.style.display = 'block';
  textEditOverlay.style.left = (rect.left + (layer.x - layer.width / 2) * scale) + 'px';
  textEditOverlay.style.top = (rect.top + (layer.y - layer.height / 2) * scale) + 'px';
  textEditOverlay.style.width = (layer.width * scale) + 'px';
  textEditOverlay.style.height = (layer.height * scale) + 'px';
  textEditOverlay.style.fontSize = (layer.fontSize * scale) + 'px';
  textEditOverlay.style.color = layer.color;
  textEditOverlay.value = layer.text;
  textEditOverlay.focus(); textEditOverlay.select();
  function commit() {
    layer.text = textEditOverlay.value.trim() || 'Matn';
    updateTextLayerSize(layer);
    textEditOverlay.style.display = 'none';
    textEditOverlay.removeEventListener('blur', commit);
    textEditOverlay.removeEventListener('keydown', onKey);
    pushHistory(); render();
  }
  function onKey(ev) { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); commit(); } }
  textEditOverlay.addEventListener('blur', commit);
  textEditOverlay.addEventListener('keydown', onKey);
}

/* EMOJI */
const EMOJIS = ['😀','😂','🥰','😍','😎','🤔','😭','😡','🥳','😴','🤩','😇','🙄','😱','🤯','🥶','👍','👎','🙏','👏','💪','🔥','✨','💯','❤️','💔','💛','💚','💙','💜','🖤','🤍','⭐','🌟','🎉','🎊','🌈','☀️','🌙','⚡','🐶','🐱','🦄','🐼','🌸','🍀','🍕','🎵'];
function buildEmojiPanel() {
  emojiPanel.innerHTML = '';
  EMOJIS.forEach(em => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'emojiItem'; b.textContent = em;
    b.addEventListener('click', () => { addTextLayer(em, 160); emojiPanel.style.display = 'none'; });
    emojiPanel.appendChild(b);
  });
}
buildEmojiPanel();
emojiBtn.addEventListener('click', () => {
  shapePanel.style.display = 'none';
  emojiPanel.style.display = emojiPanel.style.display === 'grid' ? 'none' : 'grid';
});

/* SHAPES */
shapeBtn.addEventListener('click', () => {
  emojiPanel.style.display = 'none';
  shapePanel.style.display = shapePanel.style.display === 'flex' ? 'none' : 'flex';
});
shapePanel.querySelectorAll('[data-shape]').forEach(btn => {
  btn.addEventListener('click', () => { addShapeLayer(btn.dataset.shape); shapePanel.style.display = 'none'; });
});

/* UNDO / REDO / CLEAR */
undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);
clearAllBtn.addEventListener('click', () => {
  if (layers.length === 0) return;
  if (!confirm("Barcha elementlarni o'chirishga ishonchingiz komilmi?")) return
