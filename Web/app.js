
"use strict";

(() => {
  // NEUROBAND - EXPOTEC 2026
  // APLICACIÓN PRINCIPAL

  const $ = id => document.getElementById(id);

  const PROFILE_KEY = "neuroband_profile_v1";
  const PROFILES_KEY = "neuroband_profiles_v2";
  const ACTIVE_KEY = "neuroband_active_profile_v2";
  const EVENTS_KEY = "neuroband_events_v1";
  const USER_EVENTS_KEY = "neuroband_user_events_v2";

  function read(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error("Error de almacenamiento:", error);
      return false;
    }
  }

  function id() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) +
          Math.random().toString(36).slice(2);
  }

  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  // ==========================================
  // PERFILES
  // ==========================================

  let profiles = read(PROFILES_KEY, []);
  if (!Array.isArray(profiles)) profiles = [];

  let activeId = read(ACTIVE_KEY, null);

  // Recuperar perfil antiguo únicamente si
  // todavía no existe almacenamiento múltiple.
  if (localStorage.getItem(PROFILES_KEY) === null) {
    const old = read(PROFILE_KEY, null);

    if (old && old.nombre) {
      const profile = {
        id: id(),
        nombre: String(old.nombre),
        edad: Number(old.edad) || 1
      };

      profiles = [profile];
      activeId = profile.id;

      write(PROFILES_KEY, profiles);
      write(ACTIVE_KEY, activeId);

      const oldEvents = read(EVENTS_KEY, []);

      if (Array.isArray(oldEvents) && oldEvents.length) {
        write(USER_EVENTS_KEY, {
          [profile.id]: oldEvents
        });
      }
    }
  }

  if (!profiles.some(p => p.id === activeId)) {
    activeId = profiles[0]?.id || null;
    write(ACTIVE_KEY, activeId);
  }

  let editingId = null;

  const profileForm = $("perfil-form");
  const savedPanel = $("perfil-guardado");

  const actions = el("div", undefined, "nb-profile-actions");

  const addButton = el(
    "button",
    "+ Agregar nuevo perfil",
    "nb-btn"
  );
  addButton.type = "button";

  const profileList = el("div", undefined, "nb-profile-list");

  actions.append(addButton);
  savedPanel.after(actions, profileList);

  function activeProfile() {
    return profiles.find(p => p.id === activeId) || null;
  }

  function notifyProfileChange() {
    window.dispatchEvent(
      new CustomEvent("neuroband:profile-changed", {
        detail: { profileId: activeId }
      })
    );
  }

  function showForm(profile = null) {
    editingId = profile?.id || null;

    $("perfil-nombre").value = profile?.nombre || "";
    $("perfil-edad").value = profile?.edad || "";

    $("perfil-mensaje").textContent = "";

    const submit = profileForm.querySelector(
      'button[type="submit"]'
    );

    submit.textContent = editingId
      ? "Guardar cambios"
      : "Crear perfil";

    profileForm.hidden = false;
    savedPanel.hidden = true;
  }

  function selectProfile(profileId) {
    if (!profiles.some(p => p.id === profileId)) return;

    activeId = profileId;
    write(ACTIVE_KEY, activeId);

    profileForm.hidden = true;

    renderProfiles();
    renderEvents();
    notifyProfileChange();
  }

  function renderProfiles() {
    const active = activeProfile();

    $("perfil-nombre-vista").textContent =
      active?.nombre || "Usuario sin configurar";

    $("perfil-edad-vista").textContent = active
      ? `${active.edad} años`
      : "Agregá un perfil para comenzar.";

    profileList.replaceChildren();

    for (const profile of profiles) {
      const row = el("div", undefined, "nb-user-row");

      if (profile.id === activeId) {
        row.classList.add("selected");
      }

      const info = el("div", undefined, "nb-user-info");

      info.append(
        el("strong", profile.nombre),
        el(
          "small",
          `${profile.edad} años` +
          (profile.id === activeId ? " · Activo" : "")
        )
      );

      const buttons = el(
        "div",
        undefined,
        "nb-user-buttons"
      );

      const select = el(
        "button",
        profile.id === activeId
          ? "Seleccionado"
          : "Seleccionar",
        "nb-mini-button"
      );

      select.type = "button";
      select.disabled = profile.id === activeId;
      select.onclick = () => selectProfile(profile.id);

      const edit = el(
        "button",
        "Editar",
        "nb-mini-button"
      );

      edit.type = "button";
      edit.onclick = () => showForm(profile);

      const remove = el(
        "button",
        "Eliminar",
        "nb-mini-button danger"
      );

      remove.type = "button";

      remove.onclick = () => {
        if (!confirm(
          `¿Eliminar el perfil de ${profile.nombre}?`
        )) return;

        // No elimina registros cardíacos.
        // Los conserva para evitar pérdidas.
        profiles = profiles.filter(
          p => p.id !== profile.id
        );

        if (activeId === profile.id) {
          activeId = profiles[0]?.id || null;
        }

        write(PROFILES_KEY, profiles);
        write(ACTIVE_KEY, activeId);

        profileForm.hidden = true;
        renderProfiles();
        renderEvents();
        notifyProfileChange();
      };

      buttons.append(select, edit, remove);
      row.append(info, buttons);
      profileList.append(row);
    }

    if (!profiles.length) {
      profileList.append(
        el("p", "No hay perfiles registrados.", "nb-note")
      );
    }

    if (profileForm.hidden) {
      savedPanel.hidden = !active;
    }
  }

  addButton.onclick = () => showForm();

  $("editar-perfil").onclick = () => {
    const profile = activeProfile();
    if (profile) showForm(profile);
  };

  profileForm.addEventListener("submit", event => {
    event.preventDefault();

    const nombre = $("perfil-nombre").value.trim();
    const edad = Number($("perfil-edad").value);

    if (!nombre || !Number.isInteger(edad) ||
        edad < 1 || edad > 120) {
      $("perfil-mensaje").textContent =
        "Ingresá datos válidos.";
      return;
    }

    if (editingId) {
      const profile = profiles.find(
        p => p.id === editingId
      );

      if (profile) {
        profile.nombre = nombre;
        profile.edad = edad;
      }
    } else {
      const profile = {
        id: id(),
        nombre,
        edad
      };

      profiles.push(profile);
      activeId = profile.id;
    }

    write(PROFILES_KEY, profiles);
    write(ACTIVE_KEY, activeId);

    editingId = null;
    profileForm.hidden = true;

    renderProfiles();
    renderEvents();
    notifyProfileChange();
  });

  profileForm.hidden = true;
  renderProfiles();

  if (!profiles.length) showForm();

  // ==========================================
  // HISTORIAL MANUAL DE EPISODIOS
  // ==========================================

  function allEvents() {
    const data = read(USER_EVENTS_KEY, {});
    return data && typeof data === "object" &&
      !Array.isArray(data) ? data : {};
  }

  function userEvents() {
    if (!activeId) return [];
    const data = allEvents()[activeId];
    return Array.isArray(data) ? data : [];
  }

  function saveEvents(events) {
    if (!activeId) return false;

    const data = allEvents();
    data[activeId] = events;

    return write(USER_EVENTS_KEY, data);
  }

  function localDateTime() {
    const date = new Date();
    const pad = n => String(n).padStart(2, "0");

    return (
      `${date.getFullYear()}-` +
      `${pad(date.getMonth() + 1)}-` +
      `${pad(date.getDate())}T` +
      `${pad(date.getHours())}:` +
      `${pad(date.getMinutes())}`
    );
  }

  function formatDate(value) {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleString("es-CR");
  }

  $("episodio-fecha").value = localDateTime();

  function renderEvents() {
    const list = $("episodio-lista");
    list.replaceChildren();

    const events = userEvents();

    $("total-eventos").textContent = events.length;

    $("eventos-subtitulo").textContent = activeId
      ? `${events.length} eventos del perfil activo`
      : "Seleccioná un perfil";

    if (!activeId || !events.length) {
      list.append(
        el(
          "p",
          activeId
            ? "Sin episodios registrados."
            : "Seleccioná un perfil.",
          "nb-note"
        )
      );
      return;
    }

    const ordered = [...events].sort(
      (a, b) => new Date(b.fecha) - new Date(a.fecha)
    );

    for (const record of ordered) {
      const card = el("div", undefined, "nb-record");
      const head = el(
        "div",
        undefined,
        "nb-record-head"
      );

      const title = el("strong", record.tipo);
      const remove = el("button", "Eliminar");

      remove.type = "button";

      remove.onclick = () => {
        if (!confirm("¿Eliminar este episodio?")) return;

        if (saveEvents(
          userEvents().filter(e => e.id !== record.id)
        )) {
          renderEvents();
        }
      };

      head.append(title, remove);

      card.append(
        head,
        el("p", formatDate(record.fecha), "nb-note")
      );

      if (record.notas) {
        card.append(el("p", record.notas));
      }

      list.append(card);
    }
  }

  $("episodio-form").addEventListener("submit", event => {
    event.preventDefault();

    if (!activeId) {
      $("episodio-mensaje").textContent =
        "Seleccioná un perfil primero.";
      return;
    }

    const fecha = $("episodio-fecha").value;
    const tipo = $("episodio-tipo").value;
    const notas = $("episodio-notas").value.trim();

    if (!fecha || !tipo) return;

    const events = [
      ...userEvents(),
      {
        id: id(),
        fecha,
        tipo,
        notas
      }
    ];

    if (!saveEvents(events)) {
      $("episodio-mensaje").textContent =
        "No se pudo guardar.";
      return;
    }

    $("episodio-form").reset();
    $("episodio-fecha").value = localDateTime();

    $("episodio-mensaje").textContent =
      "Episodio registrado.";

    renderEvents();
  });

  renderEvents();

  // ==========================================
  // UBICACIÓN
  // ==========================================

  $("ubicacion-obtener").onclick = () => {
    if (!navigator.geolocation) {
      $("ubicacion-estado").textContent =
        "Ubicación no compatible.";
      return;
    }

    $("ubicacion-estado").textContent =
      "Solicitando ubicación…";

    navigator.geolocation.getCurrentPosition(
      position => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        $("ubicacion-estado").textContent =
          "Ubicación obtenida";

        $("ubicacion-detalle").textContent =
          `Precisión aproximada: ` +
          `${Math.round(position.coords.accuracy)} m`;

        $("ubicacion-resultado").hidden = false;

        $("ubicacion-mapa").src =
          "https://www.openstreetmap.org/export/embed.html" +
          `?bbox=${lon - 0.009}%2C${lat - 0.006}` +
          `%2C${lon + 0.009}%2C${lat + 0.006}` +
          `&layer=mapnik&marker=${lat}%2C${lon}`;

        $("ubicacion-google").href =
          `https://www.google.com/maps?q=${lat},${lon}`;

        $("ubicacion-hospitales").href =
          "https://www.google.com/maps/search/" +
          "?api=1&query=" +
          encodeURIComponent(
            `hospitales cerca de ${lat},${lon}`
          );
      },
      () => {
        $("ubicacion-estado").textContent =
          "No se pudo obtener la ubicación.";
      },
      {
        enableHighAccuracy: true,
        timeout: 15000
      }
    );
  };

  $("ubicacion-limpiar").onclick = () => {
    $("ubicacion-resultado").hidden = true;
    $("ubicacion-mapa").removeAttribute("src");

    $("ubicacion-estado").textContent =
      "Ubicación oculta";

    $("ubicacion-detalle").textContent =
      "Podés solicitarla nuevamente.";
  };

  // ==========================================
  // NAVEGACIÓN
  // ==========================================

  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".nav-link").forEach(
        item => item.classList.remove("active")
      );

      link.classList.add("active");
    });
  });

  // ==========================================
  // CONEXIÓN ESP32 Y MAX30102
  // ==========================================

  const connectButton = $("conectar-esp32");

  let port = null;
  let reader = null;
  let connected = false;
  let connecting = false;

  let samples = [];
  let filtered = null;
  let center = null;
  let amplitude = null;

  let lastBPM = 0;
  let lastPPG = 0;

  let animationId = null;
  let watchdogId = null;

  const GRAPH_WIDTH = 600;
  const GRAPH_HEIGHT = 180;
  const GRAPH_WINDOW = 6000;

  function dot(elementId, active) {
    const node = $(elementId);
    if (!node) return;

    node.classList.toggle("muted", !active);
    node.classList.toggle(
      "neuroband-dot-active",
      active
    );
  }

  function connectionState(active) {
    connected = active;

    $("estado-dispositivo").textContent =
      active ? "Conectado" : "Desconectado";

    $("estado-conexion").textContent =
      active
        ? "ESP32 conectado por USB"
        : "Dispositivo desconectado";

    $("dispositivo-detalle").textContent =
      active
        ? "Comunicación USB establecida"
        : "Esperando conexión con ESP32";

    connectButton.textContent =
      active
        ? "NeuroBand conectado"
        : "Conectar NeuroBand";

    connectButton.disabled = active || connecting;

    dot("dispositivo-indicador", active);

    if (!active) {
      $("bpm-valor").textContent = "--";
      $("bpm-estado").textContent =
        "Sensor no conectado";

      dot("bpm-indicador", false);

      $("pulso-etiqueta").textContent =
        "SIN DATOS";

      $("ppg-adquisicion").textContent =
        "Esperando sensor";

      $("ppg-calidad").textContent =
        "Sin señal";

      $("ppg-punto").classList.remove("active");

      $("linea-bpm").setAttribute("d", "");
    }

    window.dispatchEvent(
      new CustomEvent("neuroband:connection", {
        detail: { connected: active }
      })
    );
  }

  function measurement(type, value) {
    window.dispatchEvent(
      new CustomEvent("neuroband:measurement", {
        detail: {
          type,
          value,
          timestamp: Date.now(),
          profileId: activeId
        }
      })
    );
  }

  function receive(line) {

    // ==========================================
    // NEUROBAND - SENSOR DE MOVIMIENTO MPU6050
    // ==========================================

    const movMatch = line.match(
      /^MOV:\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i
    );

    if (movMatch) {
      const x = Number(movMatch[1]);
      const y = Number(movMatch[2]);
      const z = Number(movMatch[3]);

      // ALERTA EXPERIMENTAL DE MOVIMIENTO
      // Detecta cambios repetidos de aceleracion.
      // No identifica ni diagnostica crisis epilepticas.

      if (!window.neurobandMovimiento) {
        window.neurobandMovimiento = {
          anterior: null,
          cambios: [],
          alertaActiva: false,
          ultimaAlerta: 0
        };
      }

      const estado = window.neurobandMovimiento;
      const ahora = Date.now();

      if (estado.anterior) {
        const dx = x - estado.anterior.x;
        const dy = y - estado.anterior.y;
        const dz = z - estado.anterior.z;

        const cambio = Math.sqrt(
          dx * dx + dy * dy + dz * dz
        );

        // Registrar cambios bruscos
        if (cambio > 0.7) {
          estado.cambios.push(ahora);
        }
      }

      estado.anterior = { x, y, z };

      // Conservar solo los ultimos 5 segundos
      estado.cambios = estado.cambios.filter(
        tiempo => ahora - tiempo < 5000
      );

      // Alerta si hay 6 cambios bruscos en 5 segundos
      const movimientoIntenso =
        estado.cambios.length >= 6;

      const panelAlertaId = "neuroband-alerta-movimiento";
      let panelAlerta = document.getElementById(panelAlertaId);

      if (!panelAlerta) {
        panelAlerta = document.createElement("div");
        panelAlerta.id = panelAlertaId;
        panelAlerta.setAttribute("role", "status");
        panelAlerta.setAttribute("aria-live", "polite");

        const boton = document.getElementById("conectar-esp32");
        boton.after(panelAlerta);
      }

      if (movimientoIntenso) {
        panelAlerta.style.cssText = `
          background: #fff0f0;
          border: 2px solid #ef4444;
          color: #991b1b;
          border-radius: 12px;
          padding: 16px;
          margin: 12px 0;
          font-weight: bold;
        `;

        panelAlerta.textContent =
          "ALERTA EXPERIMENTAL: " +
          "Movimiento intenso y repetitivo detectado.";

        if (!estado.alertaActiva &&
            ahora - estado.ultimaAlerta > 10000) {
          estado.ultimaAlerta = ahora;

          window.dispatchEvent(
            new CustomEvent("neuroband:motion-alert", {
              detail: {
                timestamp: ahora,
                profileId: null,
                tipo: "Movimiento intenso repetitivo",
                experimental: true
              }
            })
          );
        }

        estado.alertaActiva = true;
      } else {
        panelAlerta.style.cssText = `
          background: #ecfdf5;
          border: 1px solid #86efac;
          color: #166534;
          border-radius: 12px;
          padding: 16px;
          margin: 12px 0;
          font-weight: bold;
        `;

        panelAlerta.textContent =
          "Movimiento: sin patrones intensos repetitivos.";

        estado.alertaActiva = false;
      }


      let panel = document.getElementById("panel-movimiento");

      if (!panel) {
        panel = document.createElement("section");
        panel.id = "panel-movimiento";

        panel.style.cssText = `
          background: #142033;
          border: 1px solid #35445c;
          border-radius: 14px;
          padding: 20px;
          margin: 20px 0;
          color: white;
        `;

        panel.innerHTML = `
          <h3>Sensor de movimiento MPU6050</h3>
          <p id="movimiento-estado">
            Recibiendo datos...
          </p>
          <p id="movimiento-valores"
             style="font-size:18px;font-weight:bold;">
          </p>
          <small>
            Aceleración en los tres ejes.
            Datos experimentales, no diagnósticos.
          </small>
        `;

        document.getElementById("conectar-esp32")
          .after(panel);
      }

      document.getElementById("movimiento-estado")
        .textContent = "Sensor activo - Datos en tiempo real";

      document.getElementById("movimiento-valores")
        .textContent =
          `X: ${x.toFixed(3)} g | ` +
          `Y: ${y.toFixed(3)} g | ` +
          `Z: ${z.toFixed(3)} g`;

      window.dispatchEvent(
        new CustomEvent("neuroband:measurement", {
          detail: {
            type: "MOV",
            value: { x, y, z },
            timestamp: Date.now()
          }
        })
      );

      return;
    }

    const bpmMatch = line.match(/^BPM:\s*(\d+)/i);

    if (bpmMatch) {
      const bpm = Number(bpmMatch[1]);

      lastBPM = Date.now();

      $("bpm-valor").textContent =
        bpm > 0 ? bpm : "--";

      $("bpm-estado").textContent =
        bpm > 0
          ? "Medición recibida"
          : "Esperando lectura válida";

      dot("bpm-indicador", bpm > 0);

      measurement("BPM", bpm);
      return;
    }

    const ppgMatch = line.match(
      /^PPG:\s*(-?\d+)/i
    );

    if (!ppgMatch) return;

    const raw = Number(ppgMatch[1]);
    const now = performance.now();

    lastPPG = Date.now();

    if (raw <= 0) {
      filtered = null;

      samples.push({
        t: now,
        v: null
      });

      $("ppg-calidad").textContent =
        "Sin contacto";

      $("ppg-punto").classList.remove("active");

      $("pulso-etiqueta").textContent =
        "SIN SEÑAL";
    } else {
      filtered = filtered === null
        ? raw
        : filtered * 0.65 + raw * 0.35;

      samples.push({
        t: now,
        v: filtered
      });

      $("ppg-calidad").textContent =
        "Señal recibida";

      $("ppg-punto").classList.add("active");

      $("pulso-etiqueta").textContent =
        "PPG EN VIVO";

      $("ppg-adquisicion").textContent =
        "Datos en tiempo real";

      $("pulso-nota").textContent =
        "Señal PPG real del MAX30102. " +
        "No es un electrocardiograma.";
    }

    if (samples.length > 400) {
      samples.splice(0, samples.length - 400);
    }

    measurement("PPG", raw);
  }

  // ==========================================
  // GRÁFICA PPG
  // ==========================================

  function draw() {
    if (!connected) {
      animationId = null;
      return;
    }

    const now = performance.now();

    samples = samples.filter(
      sample => now - sample.t <= GRAPH_WINDOW
    );

    const values = samples
      .map(sample => sample.v)
      .filter(v => Number.isFinite(v) && v > 0);

    if (values.length > 1) {
      const sorted = [...values].sort(
        (a, b) => a - b
      );

      const low = sorted[
        Math.floor((sorted.length - 1) * .05)
      ];

      const high = sorted[
        Math.floor((sorted.length - 1) * .95)
      ];

      const newCenter = (low + high) / 2;
      const newAmplitude = Math.max(
        (high - low) * 1.8,
        100
      );

      if (center === null) {
        center = newCenter;
        amplitude = newAmplitude;
      } else {
        center += (newCenter - center) * .035;
        amplitude +=
          (newAmplitude - amplitude) * .035;
      }

      let path = "";
      let open = false;

      for (const sample of samples) {
        if (!Number.isFinite(sample.v) ||
            sample.v <= 0) {
          open = false;
          continue;
        }

        const x = GRAPH_WIDTH *
          (1 - (now - sample.t) / GRAPH_WINDOW);

        const y = Math.max(
          25,
          Math.min(
            GRAPH_HEIGHT - 25,
            GRAPH_HEIGHT - 25 -
            (
              (
                sample.v -
                (center - amplitude / 2)
              ) / amplitude
            ) * (GRAPH_HEIGHT - 50)
          )
        );

        if (x < 0 || x > GRAPH_WIDTH) continue;

        path +=
          `${open ? "L" : "M"}` +
          `${x.toFixed(2)},${y.toFixed(2)} `;

        open = true;
      }

      $("linea-bpm").setAttribute("d", path);
    } else {
      $("linea-bpm").setAttribute("d", "");
    }

    animationId = requestAnimationFrame(draw);
  }

  // ==========================================
  // VIGILANCIA DE DATOS
  // ==========================================

  function checkData() {
    const now = Date.now();

    if (lastBPM && now - lastBPM > 4000) {
      $("bpm-valor").textContent = "--";
      $("bpm-estado").textContent =
        "Sin datos recientes";

      dot("bpm-indicador", false);
      lastBPM = 0;
    }

    if (lastPPG && now - lastPPG > 2000) {
      $("ppg-calidad").textContent =
        "Sin datos recientes";

      $("ppg-punto").classList.remove("active");

      $("pulso-etiqueta").textContent =
        "SIN DATOS";

      lastPPG = 0;
    }
  }

  // ==========================================
  // WEB SERIAL
  // ==========================================

  async function connect() {
    if (connected || connecting) return;

    if (!("serial" in navigator)) {
      alert(
        "Utilizá Google Chrome con Live Server."
      );
      return;
    }

    connecting = true;
    connectButton.disabled = true;

    try {
      port = await navigator.serial.requestPort();

      await port.open({
        baudRate: 115200
      });

      connecting = false;

      samples = [];
      filtered = null;
      center = null;
      amplitude = null;

      lastBPM = 0;
      lastPPG = 0;

      connectionState(true);

      watchdogId = setInterval(checkData, 1000);
      animationId = requestAnimationFrame(draw);

      reader = port.readable.getReader();

      const decoder = new TextDecoder();
      let buffer = "";

      while (connected) {
        const result = await reader.read();

        if (result.done) break;

        buffer += decoder.decode(
          result.value,
          { stream: true }
        );

        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          receive(line.trim());
        }
      }
    } catch (error) {
      if (error.name !== "NotFoundError") {
        console.error("Error ESP32:", error);
      }
    } finally {
      connecting = false;
      connected = false;

      if (watchdogId !== null) {
        clearInterval(watchdogId);
        watchdogId = null;
      }

      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }

      if (reader) {
        try {
          reader.releaseLock();
        } catch {}
        reader = null;
      }

      if (port) {
        try {
          await port.close();
        } catch {}
        port = null;
      }

      connectionState(false);
    }
  }

  connectButton.addEventListener("click", connect);

  connectionState(false);

  console.log(
    "[NeuroBand] Aplicación principal cargada."
  );

})();
