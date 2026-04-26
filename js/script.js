const CHARSETS = {
  standard: "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ",
  blocks: "█▓▒░ ",
  minimal: "@#+-. ",
  digits: "9876543210 ",
  braille: "⣿⣷⣯⣟⡿⢿⣻⣽⣾⣹⣺⣼⡾⢾⣷⡽⢽⡻⢻⣳⡳⢳⡱⢱ ",
  morse: "▪▫─ ",
  matrix: "ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｪｩｨ０１２３４５６７８９ ",
  custom: null,
};

const COLORS = {
  green: (v) => `hsl(145,100%,${Math.round((v / 255) * 65)}%)`,
  white: (v) => `rgb(${v},${v},${v})`,
  amber: (v) => `hsl(35,100%,${Math.round((v / 255) * 65)}%)`,
  cyan: (v) => `hsl(185,100%,${Math.round((v / 255) * 65)}%)`,
  red: (v) => `hsl(0,100%,${Math.round((v / 255) * 60)}%)`,
  rainbow: (v, x, y, w) =>
    `hsl(${Math.round((x / w) * 360)},80%,${Math.round(40 + (v / 255) * 30)}%)`,
  luma: (v) => `rgb(${v},${v},${v})`,
  color: null,
};

let state = {
  running: false,
  source: "none",
  colorMode: "green",
  renderMode: "ascii",
  charset: "standard",
  customChars: "@#+-. ",
  font: 8,
  cols: 120,
  fps: 24,
  contrast: 100,
  bright: 100,
  grain: 0,
  invert: false,
  frameTimer: null,
  animFrame: null,
  videoEl: null,
  imgData: null,
};

const $ = (id) => document.getElementById(id);
const video = $("video"),
  canvas = $("canvas"),
  out = $("ascii-out");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

function getOutputGridSize(sourceWidth, sourceHeight) {
  const styles = window.getComputedStyle(out);
  const padX =
    (parseFloat(styles.paddingLeft) || 0) +
    (parseFloat(styles.paddingRight) || 0);
  const padY =
    (parseFloat(styles.paddingTop) || 0) +
    (parseFloat(styles.paddingBottom) || 0);

  const contentWidth = Math.max(1, out.clientWidth - padX);
  const contentHeight = Math.max(1, out.clientHeight - padY);

  const letterSpacing = parseFloat(styles.letterSpacing);
  const lineHeight = parseFloat(styles.lineHeight);
  const charWidth =
    state.font * 0.6 + (Number.isFinite(letterSpacing) ? letterSpacing : 0);
  const charHeight = Number.isFinite(lineHeight)
    ? lineHeight
    : state.font * 1.2;

  const maxCols = Math.max(
    1,
    Math.floor(contentWidth / Math.max(charWidth, 1)),
  );
  const maxRows = Math.max(
    1,
    Math.floor(contentHeight / Math.max(charHeight, 1)),
  );

  // Force a fixed 16:9 output ratio while fitting in available output area.
  const sourceRatio = 16 / 9;

  const rowsFromMaxCols = Math.max(
    1,
    Math.floor((maxCols * charWidth) / (charHeight * sourceRatio)),
  );

  let cols = maxCols;
  let rows = rowsFromMaxCols;

  if (rowsFromMaxCols > maxRows) {
    rows = maxRows;
    cols = Math.max(
      1,
      Math.floor((rows * charHeight * sourceRatio) / charWidth),
    );
  }

  state.cols = cols;
  return { cols, rows };
}

function getChars() {
  if (state.charset === "custom") return state.customChars || "@# . ";
  return CHARSETS[state.charset];
}

function setStatus(text, color = "green") {
  $("status-dot").className =
    "dot " +
    (color === "green" ? "green" : color === "yellow" ? "yellow" : "red");
  $("status-text").textContent = text;
}

function getColorFn() {
  if (state.colorMode === "color") return null;
  return COLORS[state.colorMode] || COLORS.green;
}

function applyGrain(data) {
  const g = state.grain;
  if (!g) return;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() * 2 - 1) * g;
    data[i] = Math.min(255, Math.max(0, data[i] + n));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
  }
}

function renderFrame() {
  out.style.fontSize = state.font + "px";
  if (!state.running) return;
  const src = state.videoEl || state.imgData;
  if (!src) return;

  let srcW, srcH;
  if (state.videoEl) {
    srcW = state.videoEl.videoWidth || 320;
    srcH = state.videoEl.videoHeight || 240;
  } else {
    srcW = state.imgData.width;
    srcH = state.imgData.height;
  }

  const { cols, rows } = getOutputGridSize(srcW, srcH);

  canvas.width = cols;
  canvas.height = rows;
  ctx.filter = `contrast(${state.contrast}%) brightness(${state.bright}%)${state.invert ? " invert(1)" : ""}`;
  if (state.videoEl) {
    ctx.save();
    ctx.translate(cols, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(state.videoEl, 0, 0, cols, rows);
    ctx.restore();
  } else {
    ctx.drawImage(state.imgData, 0, 0, cols, rows);
  }
  ctx.filter = "none";

  const imageData = ctx.getImageData(0, 0, cols, rows);
  const data = imageData.data;
  applyGrain(data);

  const chars = getChars();
  const colorFn = getColorFn();
  const isColor = state.colorMode === "color";
  const rmode = state.renderMode;

  let html = "";
  let charCount = 0;

  if (rmode === "block") {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const r = data[i],
          g = data[i + 1],
          b = data[i + 2];
        const luma = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        const blocks = ["░", "▒", "▓", "█", "█"];
        const ch = blocks[Math.floor(luma / 52)];
        if (isColor) {
          html += `<span style="color:rgb(${r},${g},${b})">${ch}</span>`;
        } else {
          html += `<span style="color:${colorFn(luma, x, y, cols)}">${ch}</span>`;
        }
        charCount++;
      }
      html += "\n";
    }
  } else if (rmode === "half") {
    for (let y = 0; y < rows - 1; y += 2) {
      for (let x = 0; x < cols; x++) {
        const i1 = (y * cols + x) * 4,
          i2 = ((y + 1) * cols + x) * 4;
        const r1 = data[i1],
          g1 = data[i1 + 1],
          b1 = data[i1 + 2];
        const r2 = data[i2],
          g2 = data[i2 + 1],
          b2 = data[i2 + 2];
        const l1 = 0.299 * r1 + 0.587 * g1 + 0.114 * b1;
        const l2 = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;
        if (isColor) {
          html += `<span style="color:rgb(${r1},${g1},${b1});background:rgb(${r2},${g2},${b2})">▀</span>`;
        } else {
          html += `<span style="color:${colorFn(Math.round(l1), x, y, cols)};background:${colorFn(Math.round(l2), x, y, cols)}">▀</span>`;
        }
        charCount++;
      }
      html += "\n";
    }
  } else if (rmode === "edge") {
    const gray = new Float32Array(cols * rows);
    for (let i = 0; i < cols * rows; i++) {
      const j = i * 4;
      gray[i] =
        (data[j] * 0.299 + data[j + 1] * 0.587 + data[j + 2] * 0.114) / 255;
    }
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        let ex = 0,
          ey = 0;
        if (x > 0 && x < cols - 1) {
          ex = gray[i + 1] - gray[i - 1];
        }
        if (y > 0 && y < rows - 1) {
          ey = gray[i + cols] - gray[i - cols];
        }
        const mag = Math.sqrt(ex * ex + ey * ey);
        const thresh = 0.12;
        let ch = " ";
        if (mag > thresh) {
          const ang = (Math.atan2(ey, ex) * 180) / Math.PI;
          if ((ang > -22.5 && ang <= 22.5) || ang > 157.5 || ang <= -157.5)
            ch = "─";
          else if (
            (ang > 22.5 && ang <= 67.5) ||
            (ang > -157.5 && ang <= -112.5)
          )
            ch = "╲";
          else if (
            (ang > 67.5 && ang <= 112.5) ||
            (ang > -112.5 && ang <= -67.5)
          )
            ch = "│";
          else ch = "╱";
        }
        const luma = Math.round(gray[i] * 255);
        if (ch !== " ") {
          if (isColor) {
            const j2 = i * 4;
            html += `<span style="color:rgb(${data[j2]},${data[j2 + 1]},${data[j2 + 2]})">${ch}</span>`;
          } else {
            html += `<span style="color:${colorFn(luma, x, y, cols)}">${ch}</span>`;
          }
        } else html += " ";
        charCount++;
      }
      html += "\n";
    }
  } else {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const r = data[i],
          g = data[i + 1],
          b = data[i + 2];
        const luma = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        const idx = Math.floor((luma / 255) * (chars.length - 1));
        const ch = chars[chars.length - 1 - idx] || " ";
        if (isColor) {
          html += `<span style="color:rgb(${r},${g},${b})">${ch}</span>`;
        } else {
          html += `<span style="color:${colorFn(luma, x, y, cols)}">${ch}</span>`;
        }
        charCount++;
      }
      html += "\n";
    }
  }

  out.innerHTML = html;
  $("stat-res").textContent = `RES: ${cols}×${rows}`;
  $("stat-chars").textContent = `CHARS: ${charCount.toLocaleString()}`;
  $("stat-mode").textContent =
    `MODE: ${state.renderMode.toUpperCase()} / ${state.colorMode.toUpperCase()}`;
}

function startLoop() {
  if (state.frameTimer) clearInterval(state.frameTimer);
  state.frameTimer = setInterval(() => {
    if (state.running) renderFrame();
  }, 1000 / state.fps);
}

const sourceLabel = $("source-label");
const btnCam = $("btn-cam");
const btnStartCam = $("btn-start-cam") || btnCam;
const btnStopCam = $("btn-stop-cam");
const dropZone = $("drop-zone");
const fileInput = $("file-input");

const startCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    state.videoEl = video;
    state.source = "camera";
    state.running = true;
    startLoop();
    setStatus("LIVE — CAMERA", "green");
    if (sourceLabel) sourceLabel.textContent = "CAMERA";
  } catch (e) {
    setStatus("CAM ACCESS DENIED", "red");
    alert("Camera access denied or not available.");
  }
};

if (btnStartCam) {
  btnStartCam.onclick = startCamera;
}

if (btnCam && btnCam !== btnStartCam) {
  btnCam.onclick = startCamera;
}

if (btnStopCam) {
  btnStopCam.onclick = () => {
    if (video.srcObject) {
      video.srcObject.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
    state.running = false;
    state.videoEl = null;
    if (state.frameTimer) {
      clearInterval(state.frameTimer);
      state.frameTimer = null;
    }
    setStatus("STOPPED", "red");
    if (sourceLabel) sourceLabel.textContent = "NO SOURCE";
  };
}

if (dropZone && fileInput) {
  dropZone.onclick = () => fileInput.click();
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (file.type.startsWith("video/")) {
      const vid = document.createElement("video");
      vid.src = url;
      vid.loop = true;
      vid.muted = true;
      vid.autoplay = true;
      vid.oncanplay = () => {
        vid.play();
        state.videoEl = vid;
        state.imgData = null;
        state.source = "video";
        state.running = true;
        startLoop();
        setStatus("PLAYING VIDEO", "green");
        if (sourceLabel) sourceLabel.textContent = "VIDEO";
      };
    } else {
      const img = new Image();
      img.onload = () => {
        state.imgData = img;
        state.videoEl = null;
        state.source = "image";
        state.running = true;
        renderFrame();
        setStatus("IMAGE LOADED", "yellow");
        if (sourceLabel) sourceLabel.textContent = "IMAGE";
      };
      img.src = url;
    }
  };

  ["dragover", "dragenter"].forEach((ev) =>
    document.addEventListener(ev, (e) => {
      e.preventDefault();
    }),
  );
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      fileInput.files = e.dataTransfer.files;
      fileInput.dispatchEvent(new Event("change"));
    }
  });
}

$("btn-screenshot").onclick = () => {
  const text = out.innerText;
  const c = document.createElement("canvas");
  const fontSize = state.font;
  const cols = state.cols;
  const lines = text.split("\n");
  const lineH = Math.ceil(fontSize * 1.2);
  c.width = Math.ceil(fontSize * 0.6 * cols) + 20;
  c.height = lines.length * lineH + 20;
  const cx = c.getContext("2d");
  cx.fillStyle = "#0a0a0f";
  cx.fillRect(0, 0, c.width, c.height);
  cx.font = `${fontSize}px 'Share Tech Mono', monospace`;
  cx.fillStyle = "#00ff88";
  lines.forEach((line, i) => cx.fillText(line, 10, 10 + (i + 1) * lineH));
  c.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ascii-screenshot.png";
    a.click();
  });
};

$("btn-save").onclick = () => {
  const text = out.innerText;
  const blob = new Blob([text], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ascii-art.txt";
  a.click();
};

$("btn-savepng").onclick = () => {
  const text = out.innerText;
  const fontSize = state.font;
  const cols = state.cols;
  const lines = text.split("\n");
  const lineH = Math.ceil(fontSize * 1.2);
  const c = document.createElement("canvas");
  c.width = Math.ceil(fontSize * 0.6 * cols) + 20;
  c.height = lines.length * lineH + 20;
  const cx = c.getContext("2d");
  cx.fillStyle = "#000";
  cx.fillRect(0, 0, c.width, c.height);
  cx.font = `${fontSize}px 'Share Tech Mono', monospace`;
  cx.fillStyle =
    {
      green: "#00ff88",
      white: "#e0e0e0",
      amber: "#ffaa00",
      cyan: "#00ccff",
      red: "#ff4444",
      rainbow: "#fff",
      luma: "#fff",
      color: "#00ff88",
    }[state.colorMode] || "#00ff88";
  lines.forEach((line, i) => cx.fillText(line, 10, 10 + (i + 1) * lineH));
  c.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ascii-art.png";
    a.click();
  });
};

function bindSlider(id, key, outId, suffix = "", rerender = false) {
  const el = $(id);
  el.oninput = () => {
    state[key] = +el.value;
    $(outId).textContent = el.value + (suffix ? suffix : "");

    if (key === "fps") startLoop();

    if (rerender && state.running) {
      renderFrame();
    }
  };
}

bindSlider("s-font", "font", "v-font", "", true);
bindSlider("s-fps", "fps", "v-fps", "");
bindSlider("s-contrast", "contrast", "v-contrast", "");
bindSlider("s-bright", "bright", "v-bright", "");
bindSlider("s-grain", "grain", "v-grain", "");

$("cb-invert").onchange = () => {
  state.invert = $("cb-invert").checked;
};

$("sel-charset").onchange = function () {
  state.charset = this.value;
  $("custom-charset").style.display =
    this.value === "custom" ? "block" : "none";
};
$("custom-charset").oninput = function () {
  state.customChars = this.value;
};

document.querySelectorAll("[data-mode]").forEach((btn) => {
  btn.onclick = function () {
    document
      .querySelectorAll("[data-mode]")
      .forEach((b) => b.classList.remove("active"));
    this.classList.add("active");
    state.colorMode = this.dataset.mode;
  };
});
document.querySelectorAll("[data-rmode]").forEach((btn) => {
  btn.onclick = function () {
    document
      .querySelectorAll("[data-rmode]")
      .forEach((b) => b.classList.remove("active"));
    this.classList.add("active");
    state.renderMode = this.dataset.rmode;
  };
});

window.addEventListener("resize", () => {
  if (state.running) renderFrame();
});
