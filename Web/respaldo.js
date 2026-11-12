
"use strict";

(() => {
  // NEUROBAND - RESPALDO Y RESTAURACIÓN

  const KEYS = [
    "neuroband_profiles_v2",
    "neuroband_active_profile_v2",
    "neuroband_profile_v1",
    "neuroband_user_events_v2",
    "neuroband_events_v1",
    "neuroband_mediciones_v1"
  ];

  const section = document.createElement("section");
  section.id = "neuroband-respaldo";

  section.style.cssText = `
    margin: 24px 0;
    padding: 24px;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: #ffffff;
    color: #253040;
  `;

  section.innerHTML = `
    <h2 style="margin:0 0 10px;font-size:20px">
      Respaldo de información
    </h2>

    <p style="font-size:13px;color:#687587">
      Guardá una copia de los perfiles, mediciones
      cardíacas y episodios registrados.
    </p>

    <div style="
      display:flex;
      flex-wrap:wrap;
      gap:12px;
      margin-top:18px;
    ">
      <button id="nb-exportar" type="button"
        style="
          padding:12px 18px;
          border:0;
          border-radius:9px;
          background:#e63946;
          color:white;
          font-weight:700;
          cursor:pointer;
        ">
        Descargar respaldo
      </button>

      <button id="nb-importar" type="button"
        style="
          padding:12px 18px;
          border:1px solid #d6d9df;
          border-radius:9px;
          background:#f7f7f7;
          color:#263040;
          font-weight:700;
          cursor:pointer;
        ">
        Restaurar respaldo
      </button>
    </div>

    <input
      id="nb-archivo"
      type="file"
      accept=".json,application/json"
      hidden
    >

    <p id="nb-respaldo-estado"
      style="font-size:12px;margin-top:15px">
    </p>
  `;

  const historial = document.getElementById(
    "historial-cardiaco"
  );

  if (historial) {
    historial.insertAdjacentElement(
      "afterend",
      section
    );
  } else {
    document.body.appendChild(section);
  }

  const estado = document.getElementById(
    "nb-respaldo-estado"
  );

  // EXPORTAR
  document.getElementById(
    "nb-exportar"
  ).addEventListener("click", () => {

    const datos = {};

    for (const key of KEYS) {
      const value = localStorage.getItem(key);

      if (value !== null) {
        datos[key] = JSON.parse(value);
      }
    }

    const respaldo = {
      aplicacion: "NeuroBand",
      version: 1,
      fecha: new Date().toISOString(),
      datos
    };

    const blob = new Blob(
      [JSON.stringify(respaldo, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);

    const enlace = document.createElement("a");
    enlace.href = url;

    const fecha = new Date()
      .toISOString()
      .slice(0, 10);

    enlace.download =
      `NeuroBand_Respaldo_${fecha}.json`;

    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

    estado.textContent =
      "Respaldo descargado correctamente.";
  });

  // SELECCIONAR ARCHIVO
  const archivo = document.getElementById(
    "nb-archivo"
  );

  document.getElementById(
    "nb-importar"
  ).addEventListener("click", () => {
    archivo.click();
  });

  // RESTAURAR
  archivo.addEventListener("change", async () => {
    const seleccionado = archivo.files[0];

    if (!seleccionado) return;

    try {
      const texto = await seleccionado.text();
      const respaldo = JSON.parse(texto);

      if (
        respaldo.aplicacion !== "NeuroBand" ||
        respaldo.version !== 1 ||
        !respaldo.datos ||
        typeof respaldo.datos !== "object" ||
        Array.isArray(respaldo.datos)
      ) {
        throw new Error("Archivo no válido.");
      }

      const entradas = Object.entries(
        respaldo.datos
      );

      if (
        entradas.length === 0 ||
        entradas.some(([key, value]) =>
          !KEYS.includes(key) ||
          value === undefined
        )
      ) {
        throw new Error("Datos no válidos.");
      }

      const confirmar = confirm(
        "¿Restaurar este respaldo?\n\n" +
        "Los datos actuales de NeuroBand " +
        "que estén incluidos en el archivo " +
        "serán reemplazados.\n\n" +
        "Recomendamos descargar primero " +
        "un respaldo de los datos actuales."
      );

      if (!confirmar) return;

      const anteriores = {};

      for (const [key] of entradas) {
        anteriores[key] = localStorage.getItem(key);
      }

      try {
        for (const [key, value] of entradas) {
          localStorage.setItem(
            key,
            JSON.stringify(value)
          );
        }
      } catch (error) {
        for (const [key, value] of Object.entries(
          anteriores
        )) {
          if (value === null) {
            localStorage.removeItem(key);
          } else {
            localStorage.setItem(key, value);
          }
        }

        throw error;
      }

      alert(
        "Respaldo restaurado correctamente.\n" +
        "La página se actualizará."
      );

      location.reload();

    } catch (error) {
      console.error(error);

      estado.textContent =
        "No se pudo restaurar el archivo. " +
        "Verificá que sea un respaldo válido.";
    } finally {
      archivo.value = "";
    }
  });

  console.log(
    "[NeuroBand] Sistema de respaldo activo."
  );

})();
