const file = document.getElementById("file");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const dropZone = document.getElementById("dropZone");
const frameStyle = document.getElementById("frameStyle");
const thickness = document.getElementById("thickness");
const thicknessVal = document.getElementById("thicknessVal");
const zoomRange = document.getElementById("zoom");
const zoomVal = document.getElementById("zoomVal");
const shadowCheck = document.getElementById("shadow");

let img = null;
let imgData = null;

// --- Upload ---
dropZone.addEventListener("click", () => file.click());

dropZone.addEventListener("dragover", e => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  if (e.dataTransfer.files.length) {
    loadImage(e.dataTransfer.files[0]);
  }
});

file.addEventListener("change", () => {
  if (file.files.length) loadImage(file.files[0]);
});

function loadImage(f) {
  const url = URL.createObjectURL(f);
  img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    render();
  };
  img.src = url;
}

// --- Render ---
function render() {
  if (!img) return;

  const W = canvas.width;
  const H = canvas.height;
  const z = zoomRange.value / 100;
  const thick = parseInt(thickness.value);
  const style = frameStyle.value;
  const useShadow = shadowCheck.checked;

  ctx.clearRect(0, 0, W, H);

  // Rasmni markazga joylashtirish
  const scale = Math.min(W / img.width, H / img.height) * z;
  const w = img.width * scale;
  const h = img.height * scale;
  const x = (W - w) / 2;
  const y = (H - h) / 2;

  // Soya
  if (useShadow) {
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 25;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 8;
  } else {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  // Rasmni chizish
  ctx.drawImage(img, x, y, w, h);

  // Soya reset
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Ramka chizish
  if (thick > 0) {
    drawFrame(style, x, y, w, h, thick);
  }
}

function drawFrame(style, x, y, w, h, thick) {
  ctx.lineWidth = thick;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  switch (style) {
    case "telegram":
      ctx.strokeStyle = "#ffffff";
      ctx.strokeRect(x, y, w, h);
      break;

    case "black":
      ctx.strokeStyle = "#000000";
      ctx.strokeRect(x, y, w, h);
      break;

    case "neon":
      ctx.shadowColor = "#0ff";
      ctx.shadowBlur = 20;
      ctx.strokeStyle = "#0ff";
      ctx.strokeRect(x, y, w, h);
      ctx.shadowBlur = 0;
      break;

    case "golden":
      const grad = ctx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, "#ffd700");
      grad.addColorStop(0.5, "#fff8dc");
      grad.addColorStop(1, "#ffd700");
      ctx.strokeStyle = grad;
      ctx.strokeRect(x, y, w, h);
      break;

    case "comic":
      ctx.strokeStyle = "#000";
      ctx.lineWidth = thick + 4;
      ctx.strokeRect(x, y, w, h);
      ctx.strokeStyle = "#ff0";
      ctx.lineWidth = thick;
      ctx.strokeRect(x, y, w, h);
      break;

    case "bubble":
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = thick;
      roundRect(ctx, x, y, w, h, 30);
      ctx.stroke();
      break;

    case "double":
      ctx.strokeStyle = "#fff";
      ctx.strokeRect(x, y, w, h);
      ctx.lineWidth = thick / 2;
      ctx.strokeRect(x + thick, y + thick, w - thick * 2, h - thick * 2);
      break;

    case "shadow":
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = thick + 6;
      ctx.strokeRect(x, y, w, h);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = thick;
      ctx.strokeRect(x, y, w, h);
      break;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// --- Events ---
document.getElementById("create").onclick = () => {
  if (!img) {
    alert("Avval rasm tanlang!");
    return;
  }
  render();
};

document.getElementById("download").onclick = () => {
  if (!img) {
    alert("Avval stiker yarating!");
    return;
  }
  const a = document.createElement("a");
  a.download = "sticker.png";
  a.href = canvas.toDataURL("image/png");
  a.click();
};

thickness.oninput = () => {
  thicknessVal.textContent = thickness.value;
  render();
};

zoomRange.oninput = () => {
  zoomVal.textContent = zoomRange.value;
  render();
};

frameStyle.onchange = render;
shadowCheck.onchange = render;
