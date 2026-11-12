
"use strict";

(() => {
  // NEUROBAND - EXPOTEC 2026
  // HISTORIAL UNIFICADO DE MONITOREO

  const $ = id => document.getElementById(id);

  const STORAGE = "neuroband_mediciones_v1";
  const ACTIVE = "neuroband_active_profile_v2";
  const PROFILES = "neuroband_profiles_v2";

  const MIN_DURATION = 5000;
  const MIN_READINGS = 3;
  const END_DELAY = 3500;

  let session = null;
  let lastBPMTime = 0;
  let lastContactTime = 0;
  let latestBPM = null;
  let latestBPMTime = 0;
  let latestMotion = null;
  let motionBuffer = [];
  let lastMotionSaved = 0;
  let openedRecordId = null;
  let modalOpen = false;

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error("Error al guardar:", error);
      return false;
    }
  }

  function activeId() {
    return read(ACTIVE, null);
  }

  function activeProfile() {
    const profiles = read(PROFILES, []);
    return Array.isArray(profiles)
      ? profiles.find(p => p.id === activeId()) || null
      : null;
  }

  function allRecords() {
    const data = read(STORAGE, {});
    return data && typeof data === "object" &&
      !Array.isArray(data) ? data : {};
  }

  function recordsFor(profileId) {
    const records = allRecords()[profileId];
    return Array.isArray(records) ? records : [];
  }

  function makeId() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) +
        Math.random().toString(36).slice(2);
  }

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function status(message) {
    const node = $("mediciones-estado");
    if (node) node.textContent = message;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Fecha no disponible";
    }

    return new Intl.DateTimeFormat("es-CR", {
      timeZone: "America/Costa_Rica",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).format(date);
  }

  function durationText(ms) {
    const seconds = Math.max(
      0, Math.round(Number(ms || 0) / 1000)
    );

    return seconds < 60
      ? `${seconds} segundos`
      : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
  }

  // ESTILOS

  const style = document.createElement("style");

  style.textContent = `
    .nb-cardiac-summary {
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      gap:12px;
      min-height:185px;
      padding:20px;
      border-radius:12px;
      background:#fafafa;
      text-align:center;
    }

    .nb-cardiac-count {
      font-size:43px;
      font-weight:800;
      color:#222b36;
      line-height:1;
    }

    .nb-cardiac-label {
      font-size:12px;
      color:#8a94a0;
    }

    .nb-cardiac-open {
      width:100%;
      max-width:270px;
      padding:13px 17px;
      border:none;
      border-radius:10px;
      background:#f3353a;
      color:white;
      font-family:inherit;
      font-size:12px;
      font-weight:800;
      cursor:pointer;
    }

    .nb-cardiac-open:disabled {
      opacity:.5;
      cursor:not-allowed;
    }

    .nb-modal-overlay {
      position:fixed;
      inset:0;
      z-index:9999;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
      background:rgba(14,20,30,.62);
    }

    .nb-modal-overlay[hidden] {
      display:none !important;
    }

    .nb-modal-window {
      display:flex;
      flex-direction:column;
      width:min(760px,100%);
      max-height:min(85vh,850px);
      overflow:hidden;
      border-radius:16px;
      background:white;
      box-shadow:0 25px 70px rgba(0,0,0,.25);
    }

    .nb-modal-header {
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      gap:15px;
      padding:22px 24px;
      border-bottom:1px solid #e9e9e9;
    }

    .nb-modal-header h2 {
      margin:0 0 7px;
      color:#222b36;
      font-size:19px;
    }

    .nb-modal-header p {
      margin:0;
      color:#87919e;
      font-size:12px;
    }

    .nb-modal-close {
      display:grid;
      place-items:center;
      width:35px;
      height:35px;
      flex-shrink:0;
      border:none;
      border-radius:9px;
      background:#f3f3f3;
      color:#414955;
      font-size:21px;
      cursor:pointer;
    }

    .nb-modal-body {
      flex:1;
      min-height:0;
      overflow-y:auto;
      padding:20px 24px 25px;
    }

    .nb-modal-count {
      margin:0 0 15px;
      color:#8a94a0;
      font-size:12px;
    }

    .nb-modal-item {
      margin-bottom:10px;
      overflow:hidden;
      border:1px solid #e7e8eb;
      border-radius:11px;
      background:white;
    }

    .nb-modal-item.open {
      border-color:#f1afb1;
    }

    .nb-modal-row {
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:12px;
      width:100%;
      padding:15px;
      border:none;
      background:transparent;
      font-family:inherit;
      text-align:left;
      cursor:pointer;
    }

    .nb-modal-row:hover {
      background:#fff8f8;
    }

    .nb-modal-row-left {
      display:flex;
      flex-direction:column;
      gap:5px;
      min-width:0;
    }

    .nb-modal-date {
      color:#26313d;
      font-size:12px;
      font-weight:700;
    }

    .nb-modal-duration {
      color:#8a94a0;
      font-size:11px;
    }

    .nb-modal-bpm {
      color:#e53940;
      font-size:13px;
      font-weight:800;
      white-space:nowrap;
    }

    .nb-modal-detail {
      padding:17px;
      border-top:1px solid #f0e9e9;
      background:#fffdfd;
    }

    .nb-modal-detail[hidden] {
      display:none !important;
    }

    .nb-modal-stats {
      display:grid;
      grid-template-columns:repeat(3,1fr);
      gap:10px;
      margin-bottom:15px;
    }

    .nb-modal-stat {
      padding:14px 8px;
      border-radius:9px;
      background:#f5f5f4;
      text-align:center;
    }

    .nb-modal-stat strong {
      display:block;
      font-size:22px;
      color:#202732;
    }

    .nb-modal-stat small {
      display:block;
      margin-top:5px;
      color:#8a94a0;
      font-size:10px;
    }

    .nb-modal-chart {
      display:block;
      width:100%;
      height:130px;
      margin:12px 0;
      border-radius:9px;
      background:#fff8f8;
    }

    .nb-modal-meta {
      margin:8px 0;
      color:#7e8995;
      font-size:12px;
    }

    .nb-modal-delete {
      margin-top:14px;
      padding:10px 14px;
      border:1px solid #edc8c8;
      border-radius:8px;
      background:white;
      color:#c7353d;
      font-family:inherit;
      font-size:11px;
      font-weight:700;
      cursor:pointer;
    }

    .nb-motion-warning {
      padding:12px;
      margin:10px 0;
      border-radius:9px;
      background:#fff0f0;
      border:1px solid #ef4444;
      color:#991b1b;
      font-size:12px;
      font-weight:700;
    }

    @media(max-width:600px) {
      .nb-modal-overlay { padding:10px; }
      .nb-modal-window { max-height:92vh; }
      .nb-modal-header { padding:17px; }
      .nb-modal-body { padding:15px; }
      .nb-modal-stat strong { font-size:18px; }
    }
  `;

  document.head.appendChild(style);

  // VENTANA FLOTANTE

  const overlay = element(
    "div", undefined, "nb-modal-overlay"
  );
  overlay.hidden = true;

  const modal = element(
    "div", undefined, "nb-modal-window"
  );
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute(
    "aria-label", "Historial de monitoreo"
  );

  const modalHeader = element(
    "div", undefined, "nb-modal-header"
  );
  const headerInfo = element("div");
  const modalTitle = element(
    "h2", "Historial de mediciones"
  );
  const modalSubtitle = element("p");

  headerInfo.append(modalTitle, modalSubtitle);

  const closeButton = element(
    "button", "×", "nb-modal-close"
  );
  closeButton.type = "button";
  closeButton.setAttribute(
    "aria-label", "Cerrar historial"
  );

  modalHeader.append(headerInfo, closeButton);

  const modalBody = element(
    "div", undefined, "nb-modal-body"
  );

  modal.append(modalHeader, modalBody);
  overlay.append(modal);
  document.body.append(overlay);

  function closeModal() {
    modalOpen = false;
    overlay.hidden = true;
    document.body.style.overflow = "";
    openedRecordId = null;
  }

  function openModal() {
    if (!activeProfile()) return;
    modalOpen = true;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    renderModal();
    closeButton.focus();
  }

  closeButton.onclick = closeModal;

  overlay.addEventListener("click", event => {
    if (event.target === overlay) closeModal();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && modalOpen) {
      closeModal();
    }
  });

  // GUARDAR REGISTROS

  function saveRecord(profileId, record) {
    if (!profileId) return false;

    const data = allRecords();
    data[profileId] = [
      record,
      ...recordsFor(profileId)
    ];

    const saved = write(STORAGE, data);

    if (saved) {
      renderSummary();
      if (modalOpen) renderModal();
    }

    return saved;
  }

  // INICIAR MEDICION CARDIACA

  function start(time) {
    const profileId = activeId();

    if (!profileId) {
      status("Seleccioná un perfil antes de medir.");
      return;
    }

    session = {
      profileId,
      start: time,
      lastValid: time,
      readings: [],
      movements: [],
      alerts: [],
      contactObserved: false,
      contactLostAt: null
    };

    status("Medición en curso.");
  }

  // RECIBIR BPM

  function receiveBPM(value, time) {
    const bpm = Number(value);

    if (!Number.isFinite(bpm) ||
        bpm < 35 || bpm > 220) {
      latestBPM = null;

      if (session &&
          session.contactLostAt === null) {
        session.contactLostAt = time;
      }
      return;
    }

    latestBPM = bpm;
    latestBPMTime = time;

    if (session &&
        session.profileId !== activeId()) {
      finish(time);
    }

    if (!session) start(time);
    if (!session) return;

    lastBPMTime = time;

    session.readings.push({ time, bpm });
    session.lastValid = time;

    if (!session.contactObserved) {
      session.contactLostAt = null;
    }

    status(
      `Midiendo: ${bpm} BPM. ` +
      "El registro se guardará automáticamente."
    );
  }

  // RECIBIR PPG

  function receivePPG(value, time) {
    const ppg = Number(value);
    if (!Number.isFinite(ppg)) return;

    if (ppg > 0) {
      lastContactTime = time;

      if (session) {
        session.contactObserved = true;
        session.contactLostAt = null;
      }
    } else if (
      session &&
      session.contactObserved &&
      session.contactLostAt === null
    ) {
      session.contactLostAt = time;
    }
  }

  // RECIBIR MOVIMIENTO

  function receiveMotion(value, time) {
    if (!value || typeof value !== "object") {
      return;
    }

    const x = Number(value.x);
    const y = Number(value.y);
    const z = Number(value.z);

    if (![x, y, z].every(Number.isFinite)) {
      return;
    }

    const sample = { time, x, y, z };
    latestMotion = sample;

    // Guardar muestras recientes para asociarlas
    // con alertas aunque no haya pulso válido.
    motionBuffer.push(sample);

    motionBuffer = motionBuffer.filter(
      item => time - item.time <= 10000
    );

    if (session && time - lastMotionSaved >= 200) {
      session.movements.push(sample);
      lastMotionSaved = time;
    }
  }

  // RECIBIR ALERTA EXPERIMENTAL

  function receiveMotionAlert(time) {
    const profileId = activeId();
    if (!profileId) return;

    const alert = {
      tiempo: time,
      tipo: "Movimiento intenso repetitivo",
      experimental: true
    };

    if (session &&
        session.profileId === profileId) {
      session.alerts.push(alert);
      return;
    }

    const recentBPM =
      latestBPM !== null &&
      time - latestBPMTime < 4000
        ? latestBPM : null;

    const recentMovements = motionBuffer.filter(
      item => time - item.time <= 5000
    );

    const record = {
      id: makeId(),
      inicio: new Date(time - 5000).toISOString(),
      fin: new Date(time).toISOString(),
      duracion: 5000,
      promedio: recentBPM,
      minimo: recentBPM,
      maximo: recentBPM,
      muestras: recentBPM === null
        ? []
        : [{ tiempo: time, bpm: recentBPM }],
      movimientos: recentMovements,
      alertas: [alert],
      tipo: "alerta_experimental"
    };

    saveRecord(profileId, record);
    status("Alerta experimental registrada.");
  }

  // FINALIZAR MEDICION

  function finish(time = Date.now()) {
    if (!session) return;

    const finished = session;
    session = null;

    const readings = finished.readings;
    const duration = Math.max(
      0, finished.lastValid - finished.start
    );

    if (duration < MIN_DURATION ||
        readings.length < MIN_READINGS) {
      status(
        "Medición demasiado corta. " +
        "Mantené el dedo durante 15 a 20 segundos."
      );
      return;
    }

    const values = readings.map(r => r.bpm);

    const average = Math.round(
      values.reduce((sum, bpm) => sum + bpm, 0) /
      values.length
    );

    const record = {
      id: makeId(),
      inicio: new Date(finished.start).toISOString(),
      fin: new Date(
        Math.max(time, finished.lastValid)
      ).toISOString(),
      duracion: duration,
      promedio: average,
      minimo: Math.min(...values),
      maximo: Math.max(...values),
      muestras: readings.map(r => ({
        tiempo: r.time,
        bpm: r.bpm
      })),
      movimientos: finished.movements,
      alertas: finished.alerts,
      tipo: "monitoreo"
    };

    if (saveRecord(finished.profileId, record)) {
      status("Medición guardada correctamente.");
    } else {
      status("No fue posible guardar la medición.");
    }
  }

  // RESUMEN DEL HISTORIAL

  function renderSummary() {
    const container = $("mediciones-lista");
    if (!container) return;

    container.replaceChildren();

    const profile = activeProfile();
    const user = $("mediciones-usuario");

    if (user) {
      user.textContent = profile
        ? `Perfil activo: ${profile.nombre}`
        : "Seleccioná un perfil.";
    }

    const count = profile
      ? recordsFor(profile.id).length
      : 0;

    const summary = element(
      "div", undefined, "nb-cardiac-summary"
    );

    const number = element(
      "div", String(count), "nb-cardiac-count"
    );

    const label = element(
      "div",
      count === 1
        ? "Medición de monitoreo registrada"
        : "Mediciones de monitoreo registradas",
      "nb-cardiac-label"
    );

    const button = element(
      "button",
      "Ver historial completo",
      "nb-cardiac-open"
    );

    button.type = "button";
    button.disabled = !profile;
    button.onclick = openModal;

    summary.append(number, label, button);
    container.append(summary);

    if (!profile) {
      status("Seleccioná un perfil para comenzar.");
    }
  }

  // GRÁFICA DE FRECUENCIA CARDIACA

  function miniChart(samples) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");

    svg.setAttribute("viewBox", "0 0 320 100");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.classList.add("nb-modal-chart");

    if (!Array.isArray(samples) ||
        samples.length < 2) {
      return svg;
    }

    const values = samples
      .map(item => Number(item.bpm))
      .filter(Number.isFinite);

    if (values.length < 2) return svg;

    const low = Math.min(...values);
    const high = Math.max(...values);
    const range = Math.max(5, high - low);

    const points = values.map((value, index) => {
      const x = 10 +
        index * 300 / (values.length - 1);

      const y = 85 -
        (value - low) * 65 / range;

      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

    const line = document.createElementNS(
      ns, "polyline"
    );

    line.setAttribute("points", points);
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", "#f3353a");
    line.setAttribute("stroke-width", "2.5");
    line.setAttribute("stroke-linejoin", "round");

    svg.append(line);
    return svg;
  }

  function stat(label, value) {
    const box = element(
      "div", undefined, "nb-modal-stat"
    );

    box.append(
      element("strong", String(value ?? "--")),
      element("small", label)
    );

    return box;
  }

  // VENTANA DE HISTORIAL

  function renderModal() {
    modalBody.replaceChildren();

    const profile = activeProfile();
    if (!profile) {
      closeModal();
      return;
    }

    const records = [...recordsFor(profile.id)]
      .sort((a, b) =>
        new Date(b.inicio) - new Date(a.inicio)
      );

    modalSubtitle.textContent =
      `${profile.nombre} · ${records.length} registros`;

    modalBody.append(
      element(
        "p",
        `${records.length} medición(es) guardada(s)`,
        "nb-modal-count"
      )
    );

    if (!records.length) {
      modalBody.append(
        element(
          "p",
          "Todavía no hay mediciones guardadas.",
          "nb-note"
        )
      );
      return;
    }

    for (const record of records) {
      const item = element(
        "div", undefined, "nb-modal-item"
      );

      const row = element(
        "button", undefined, "nb-modal-row"
      );
      row.type = "button";

      const left = element(
        "div", undefined, "nb-modal-row-left"
      );

      left.append(
        element(
          "span",
          formatDate(record.inicio),
          "nb-modal-date"
        ),
        element(
          "span",
          `Duración: ${durationText(record.duracion)}`,
          "nb-modal-duration"
        )
      );

      const hasBPM = Number.isFinite(record.promedio);

      const right = element(
        "span",
        hasBPM
          ? `${record.promedio} BPM  ▾`
          : "Alerta de movimiento  ▾",
        "nb-modal-bpm"
      );

      row.append(left, right);

      const detail = element(
        "div", undefined, "nb-modal-detail"
      );
      detail.hidden = true;

      const movements = Array.isArray(record.movimientos)
        ? record.movimientos
        : [];

      const alerts = Array.isArray(record.alertas)
        ? record.alertas
        : [];

      if (hasBPM) {
        const stats = element(
          "div", undefined, "nb-modal-stats"
        );

        stats.append(
          stat("PROMEDIO BPM", record.promedio),
          stat("MÍNIMO BPM", record.minimo),
          stat("MÁXIMO BPM", record.maximo)
        );

        detail.append(
          stats,
          miniChart(record.muestras)
        );
      } else {
        detail.append(
          element(
            "p",
            "Sin medición cardíaca válida.",
            "nb-modal-meta"
          )
        );
      }

      if (movements.length) {
        const magnitudes = movements.map(m =>
          Math.sqrt(
            m.x * m.x +
            m.y * m.y +
            m.z * m.z
          )
        );

        const max = Math.max(...magnitudes);

        const last = movements[movements.length - 1];

        detail.append(
          element(
            "p",
            `Movimiento: ${movements.length} muestras`,
            "nb-modal-meta"
          ),
          element(
            "p",
            `Aceleración máxima: ${max.toFixed(2)} g`,
            "nb-modal-meta"
          ),
          element(
            "p",
            `Última lectura: ` +
            `X ${last.x.toFixed(3)} g, ` +
            `Y ${last.y.toFixed(3)} g, ` +
            `Z ${last.z.toFixed(3)} g`,
            "nb-modal-meta"
          )
        );
      } else {
        detail.append(
          element(
            "p",
            "Movimiento: sin datos registrados.",
            "nb-modal-meta"
          )
        );
      }

      if (alerts.length) {
        const warning = element(
          "div",
          `ALERTA EXPERIMENTAL: ` +
          `${alerts.length} alerta(s) de movimiento.`,
          "nb-motion-warning"
        );

        detail.append(warning);

        for (const alert of alerts) {
          detail.append(
            element(
              "p",
              `Alerta: ${formatDate(alert.tiempo)}`,
              "nb-modal-meta"
            )
          );
        }
      } else {
        detail.append(
          element(
            "p",
            "Alertas experimentales: ninguna registrada.",
            "nb-modal-meta"
          )
        );
      }

      detail.append(
        element(
          "p",
          `Inicio: ${formatDate(record.inicio)}`,
          "nb-modal-meta"
        ),
        element(
          "p",
          `Finalización: ${formatDate(record.fin)}`,
          "nb-modal-meta"
        ),
        element(
          "p",
          `Duración: ${durationText(record.duracion)}`,
          "nb-modal-meta"
        )
      );

      const remove = element(
        "button",
        "Eliminar registro",
        "nb-modal-delete"
      );
      remove.type = "button";

      remove.onclick = event => {
        event.stopPropagation();

        if (!confirm(
          "¿Eliminar este registro de monitoreo?"
        )) return;

        const data = allRecords();

        data[profile.id] = recordsFor(profile.id)
          .filter(r => r.id !== record.id);

        if (write(STORAGE, data)) {
          openedRecordId = null;
          renderSummary();
          renderModal();
        } else {
          alert("No se pudo eliminar el registro.");
        }
      };

      detail.append(remove);

      row.onclick = () => {
        const wasOpen =
          openedRecordId === record.id;

        openedRecordId = wasOpen
          ? null : record.id;

        modalBody.querySelectorAll(
          ".nb-modal-item"
        ).forEach(node => {
          node.classList.remove("open");

          const panel = node.querySelector(
            ".nb-modal-detail"
          );

          if (panel) panel.hidden = true;
        });

        if (!wasOpen) {
          item.classList.add("open");
          detail.hidden = false;
        }
      };

      item.append(row, detail);
      modalBody.append(item);

      if (openedRecordId === record.id) {
        item.classList.add("open");
        detail.hidden = false;
      }
    }
  }

  // EVENTOS DEL ESP32

  window.addEventListener(
    "neuroband:measurement",
    event => {
      const data = event.detail || {};
      const time = data.timestamp || Date.now();

      if (data.type === "BPM") {
        receiveBPM(data.value, time);
      }

      if (data.type === "PPG") {
        receivePPG(data.value, time);
      }

      if (data.type === "MOV") {
        receiveMotion(data.value, time);
      }
    }
  );

  // ALERTAS DE MOVIMIENTO

  window.addEventListener(
    "neuroband:motion-alert",
    event => {
      receiveMotionAlert(
        event.detail?.timestamp || Date.now()
      );
    }
  );

  // CAMBIO DE PERFIL

  window.addEventListener(
    "neuroband:profile-changed",
    () => {
      if (session) finish(Date.now());

      lastBPMTime = 0;
      lastContactTime = 0;
      latestBPM = null;
      latestBPMTime = 0;
      latestMotion = null;
      motionBuffer = [];
      lastMotionSaved = 0;
      openedRecordId = null;

      closeModal();
      renderSummary();
    }
  );

  // DESCONEXION DEL ESP32

  window.addEventListener(
    "neuroband:connection",
    event => {
      if (!event.detail?.connected) {
        if (session) finish(Date.now());

        latestBPM = null;
        latestBPMTime = 0;
        latestMotion = null;
        motionBuffer = [];
        lastMotionSaved = 0;
      }
    }
  );

  // GUARDADO AUTOMATICO

  setInterval(() => {
    if (!session) return;

    const now = Date.now();

    const lostContact =
      session.contactLostAt !== null &&
      now - session.contactLostAt >= END_DELAY;

    const noRecentBPM =
      now - lastBPMTime >= END_DELAY;

    const noRecentPPG =
      !session.contactObserved ||
      now - lastContactTime >= END_DELAY;

    if (lostContact ||
        (noRecentBPM && noRecentPPG)) {
      finish(now);
    }
  }, 500);

  // INICIAR

  renderSummary();

  console.log(
    "[NeuroBand] Historial unificado activo."
  );

})();
