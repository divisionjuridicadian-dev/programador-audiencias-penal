// ===== Configuración de conexión =====
// La anon key es pública por diseño: el acceso real está protegido por
// Row Level Security (RLS) en Supabase, que exige un usuario autenticado.
const SUPABASE_URL = "https://dobppxpxolfotvxfgczw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvYnBweHB4b2xmb3R2eGZnY3p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwOTAyNjksImV4cCI6MjEwNDY2NjI2OX0.2Mqu2qIFrJKCDfH76TJH-h5Kb8kGxJMzLw6t69I3q_A";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== Sesión =====
// Llamar al inicio de cada página protegida (todas menos login.html).
// Si no hay sesión, redirige a login.html y detiene la ejecución de la página.
async function requireSession() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  return session;
}

function wireUserChip(session) {
  const chip = document.getElementById("userChip");
  const emailEl = document.getElementById("userEmail");
  const logoutBtn = document.getElementById("btnLogout");
  if (chip && session) {
    chip.style.display = "flex";
    if (emailEl) emailEl.textContent = session.user.email;
  }
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await db.auth.signOut();
      window.location.href = "login.html";
    });
  }
}

// ===== Colapsar/ocultar el menú lateral (solo escritorio) =====
// El estado se guarda en localStorage y se aplica como atributo data-sidebar
// en <html> — el script inline al principio del <head> de cada página ya lo
// lee y lo fija antes de pintar, para que no haya parpadeo al cargar.
const LS_SIDEBAR_COLAPSADO = "dian_sidebar_colapsado";
function alternarSidebarColapsado() {
  const colapsado = document.documentElement.getAttribute("data-sidebar") === "colapsado";
  if (colapsado) {
    document.documentElement.removeAttribute("data-sidebar");
    try { localStorage.setItem(LS_SIDEBAR_COLAPSADO, "0"); } catch { /* localStorage no disponible */ }
  } else {
    document.documentElement.setAttribute("data-sidebar", "colapsado");
    try { localStorage.setItem(LS_SIDEBAR_COLAPSADO, "1"); } catch { /* localStorage no disponible */ }
  }
}

// ===== Utilidades de UI =====
function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function showToast(message, isError) {
  let toast = document.getElementById("globalToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "globalToast";
    toast.className = "toast";
    toast.innerHTML = '<span id="toastText"></span>';
    document.body.appendChild(toast);
  }
  toast.classList.toggle("error", !!isError);
  document.getElementById("toastText").textContent = message;
  toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove("show"), 3200);
}

function formatFecha(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatCuantia(n) {
  if (n === null || n === undefined || n === "") return "—";
  return "$ " + Number(n).toLocaleString("es-CO", { maximumFractionDigits: 0 });
}

// Resultados que dejan la audiencia con un desenlace de fondo (aunque no
// haya "ganado" nadie en sentido estricto, el proceso avanzó/se resolvió) —
// se pintan igual que el antiguo "Se realizo". El resto de resultados
// (reprogramación, cancelación) y cualquier estado sin match cae a
// badge-nodef, igual que antes.
const RESULTADOS_CONCLUIDOS = [
  "cesación del procedimiento por pago",
  "preclusión (solicitada por la fiscalía)",
  "principio de oportunidad",
  "allanamiento a cargos (aceptación de responsabilidad)",
  "archivo de las diligencias",
  // nombres antiguos del catálogo, desactivados pero aún presentes en
  // audiencias históricas — se mantienen para no perder el color.
  "se realizo", "se realizó", "casacion", "casación",
];

// La Rama Judicial no usa un único término fijo para el sujeto que va al
// campo "Nombre del procesado": según el tipo de proceso puede venir como
// "Demandado", o como un rótulo compuesto tipo "Demandado/Indiciado/Causante".
// Por eso se busca coincidencia parcial contra varios términos en vez de
// exigir una igualdad exacta con uno solo. "Demandante" queda afuera a
// propósito: en procesos de la DIAN, la propia DIAN suele figurar como
// demandante, así que incluirla mezclaría a la entidad con el procesado.
const PALABRAS_TIPO_PROCESADO = ["demandado", "indiciado", "procesado", "causante", "acusado", "imputado"];

function esTipoProcesado(tipo) {
  const t = (tipo || "").toLowerCase();
  return PALABRAS_TIPO_PROCESADO.some(p => t.includes(p));
}

// "Fiscalía" en la tabla de Sujetos procesales de la Rama Judicial — se usa
// para el clic que lleva el nombre al campo "Nombre del Fiscal".
function esTipoFiscalia(tipo) {
  return (tipo || "").toLowerCase().includes("fiscal");
}

function badgeClassForEstado(estado) {
  const e = (estado || "").toLowerCase();
  if (e === "audiencia hoy") return "badge-hoy";
  if (e === "esta semana") return "badge-semana";
  if (e === "este mes") return "badge-mes";
  if (e === "próximo mes" || e === "más adelante" || e === "por definir") return "badge-adelante";
  if (RESULTADOS_CONCLUIDOS.includes(e)) return "badge-realizada";
  return "badge-nodef";
}

// Solo dígitos, máximo 23 caracteres — para el campo de radicado.
function wireRadicadoInput(input, hintEl) {
  const update = () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 23);
    const n = input.value.length;
    if (hintEl) {
      if (n === 0) {
        hintEl.textContent = "23 dígitos, solo números.";
        hintEl.className = "hint";
      } else if (n < 23) {
        hintEl.textContent = `${n}/23 dígitos — faltan ${23 - n}.`;
        hintEl.className = "hint error";
      } else {
        hintEl.textContent = "23/23 dígitos — despacho: " + input.value.slice(0, 12);
        hintEl.className = "hint ok";
      }
    }
  };
  input.addEventListener("input", update);
  update();
}

function radicadoValido(v) {
  return /^[0-9]{23}$/.test(v || "");
}

// ===== Catálogos =====
async function cargarCatalogo(tabla) {
  const { data, error } = await db.from(tabla).select("id, nombre").eq("activo", true).order("nombre");
  if (error) { console.error(error); return []; }
  return data;
}

function llenarSelect(select, items, valorActual) {
  select.innerHTML = '<option value="">—</option>' +
    items.map(it => `<option value="${it.id}">${escapeHtml(it.nombre)}</option>`).join("");
  if (valorActual) select.value = valorActual;
}

// ===== Firma del abogado (catalogos.html) — la usan tanto "Generar Poder"
// (index.html) como "Informe de audiencia" (informe-audiencia.html), de ahí
// que viva acá en vez de duplicada en cada página. =====
// Descarga la firma del abogado desde Supabase Storage (bucket "firmas") y
// devuelve sus bytes + dimensiones ya escaladas — ancho fijo, alto según la
// proporción real de la imagen, con un tope para que una firma casi
// cuadrada no quede desproporcionadamente alta. Si el abogado no tiene firma
// registrada, o algo falla al descargarla, devuelve null: el documento se
// genera igual, solo con el nombre (y línea de firma en blanco).
async function descargarFirmaEscalada(rutaFirma) {
  if (!rutaFirma) return null;
  try {
    const { data: blob, error } = await db.storage.from("firmas").download(rutaFirma);
    if (error || !blob) { console.error(error); return null; }
    const buffer = await blob.arrayBuffer();
    const dimensiones = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ ancho: img.naturalWidth, alto: img.naturalHeight });
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
    const ANCHO_OBJETIVO = 170, ALTO_MAXIMO = 60;
    let ancho = ANCHO_OBJETIVO, alto = ANCHO_OBJETIVO * (dimensiones.alto / dimensiones.ancho);
    if (alto > ALTO_MAXIMO) { alto = ALTO_MAXIMO; ancho = ALTO_MAXIMO * (dimensiones.ancho / dimensiones.alto); }
    const extension = (rutaFirma.split(".").pop() || "jpg").toLowerCase();
    const tipo = ["png", "gif", "bmp"].includes(extension) ? extension : "jpg";
    return { buffer, tipo, ancho: Math.round(ancho), alto: Math.round(alto) };
  } catch (e) {
    console.error("No se pudo cargar la firma del abogado:", e);
    return null;
  }
}

// Arma el ImageRun (docx.js) a partir de la firma ya descargada/escalada,
// lista para insertar arriba del nombre del abogado. Requiere que la página
// haya cargado docx.js (Poder e Informe lo hacen; catalogos.html, por
// ejemplo, no la llama, así que no importa que no lo tenga).
async function cargarImagenFirma(rutaFirma) {
  const firma = await descargarFirmaEscalada(rutaFirma);
  if (!firma) return null;
  return new docx.ImageRun({ data: firma.buffer, transformation: { width: firma.ancho, height: firma.alto }, type: firma.tipo });
}

// jsPDF trae su propio decodificador de PNG (no usa el del navegador), y es
// conocido por fallar con algunos PNG perfectamente válidos según cómo haya
// comprimido el archivo el programa que lo generó (distinto de los .png
// fijos de la propia app, como el logo, que ya se sabe que sí funcionan).
// Como una firma la puede haber generado cualquier app o escáner, antes de
// pasarla a doc.addImage() en un PDF (Poder o Informe) se redibuja en un
// <canvas> y se reexporta como JPEG (vía toDataURL, síncrono — se evita
// toBlob a propósito por su callback asíncrono, nada garantiza cuándo
// dispara) — el JPEG sí lo decodifica bien siempre, aplanando cualquier
// transparencia sobre fondo blanco (no debería tener ninguna una firma
// real, pero por si acaso). No se usa para el .docx: ahí es Word quien
// decodifica la imagen, no docx.js, así que no aplica el bug. Devuelve un
// data URL (no un ArrayBuffer): doc.addImage() de jsPDF acepta ambos, y así
// no hace falta un paso extra para convertir de vuelta.
async function imagenComoJpegDataUrl(buffer, tipoOriginal) {
  const mime = tipoOriginal === "jpg" ? "jpeg" : tipoOriginal;
  const blob = new Blob([buffer], { type: `image/${mime}` });
  const url = URL.createObjectURL(blob);
  try {
    // <img>+onload (no createImageBitmap): es el mismo decodificador que ya
    // usa descargarFirmaEscalada() para medir la imagen, así que si esos
    // bytes ya se pudieron medir ahí, se pueden volver a decodificar acá.
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    // onload solo garantiza que se conocen las dimensiones; decode() sí
    // garantiza que los píxeles ya están listos para dibujar — sin esto,
    // drawImage() puede terminar copiando un canvas en blanco. Pero decode()
    // puede quedarse colgado para siempre con algunas imágenes en ciertos
    // navegadores/entornos, así que se le pone un tope de tiempo corto: si
    // no resuelve rápido, se sigue igual (para entonces onload ya disparó,
    // así que lo normal es que los píxeles ya estén listos de todas formas).
    if (img.decode) {
      await Promise.race([img.decode(), new Promise(resolve => setTimeout(resolve, 400))]).catch(() => {});
    }
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.92);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Convierte un ArrayBuffer a base64 — lo usan tanto una fuente TTF
// incrustada en un PDF (jsPDF) como una imagen (logo, firma) en base64.
function bufferABase64(buffer) {
  let binario = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x2000) binario += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x2000));
  return btoa(binario);
}

// ===== Íconos SVG (reemplazan emojis en botones de acción) =====
// Trazos tipo Feather/Lucide dibujados a mano para no depender de una
// librería externa por un puñado de íconos — mismo criterio ya usado en
// Inventario_Unidad_Penal.html (línea visual hermana de esta app).
const ICONOS = {
  editar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  buscar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  descargar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  monitor: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  usuario: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  papelera: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  tabla: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="12" y1="3" x2="12" y2="21"/></svg>',
  tarjetas: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  documento: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  correo: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
  chevron: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
  duplicar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  informe: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 14l2 2 4-4"/></svg>',
};

// ===== Modal de confirmación (reemplaza confirm() nativo) =====
// Reusa las clases .modal-overlay/.modal-card ya definidas en style.css.
// Uso: if (!(await confirmarAccion("¿Seguro?", {titulo:"Eliminar"}))) return;
function confirmarAccion(mensaje, opts) {
  opts = opts || {};
  const titulo = opts.titulo || "Confirmar";
  const textoConfirmar = opts.textoConfirmar || "Confirmar";
  const peligro = opts.peligro !== false;

  return new Promise((resolve) => {
    let modal = document.getElementById("confirmModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "confirmModal";
      modal.className = "modal-overlay";
      modal.innerHTML = `
        <div class="modal-card" style="max-width:420px;">
          <div class="modal-head">
            <h3 id="confirmModalTitulo"></h3>
            <button type="button" class="modal-close" id="confirmModalCerrar">✕</button>
          </div>
          <div class="modal-content">
            <p id="confirmModalMensaje" style="font-size:13.5px; white-space:pre-line; margin:0 0 18px; color:var(--ink);"></p>
            <div class="form-actions" style="margin-top:0; padding-top:0; border-top:none;">
              <button type="button" class="btn btn-ghost" id="confirmModalCancelar">Cancelar</button>
              <button type="button" class="btn" id="confirmModalConfirmar"></button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener("click", (e) => { if (e.target === modal) modal._onCancelar(); });
    }

    document.getElementById("confirmModalTitulo").textContent = titulo;
    document.getElementById("confirmModalMensaje").textContent = mensaje;
    const btnConfirmar = document.getElementById("confirmModalConfirmar");
    btnConfirmar.textContent = textoConfirmar;
    btnConfirmar.className = "btn " + (peligro ? "btn-danger" : "btn-gold");

    const btnCancelar = document.getElementById("confirmModalCancelar");
    const btnCerrar = document.getElementById("confirmModalCerrar");

    function limpiar() {
      modal.classList.remove("show");
      btnCancelar.removeEventListener("click", onCancelar);
      btnCerrar.removeEventListener("click", onCancelar);
      btnConfirmar.removeEventListener("click", onConfirmar);
    }
    function onCancelar() { limpiar(); resolve(false); }
    function onConfirmar() { limpiar(); resolve(true); }
    modal._onCancelar = onCancelar;

    btnCancelar.addEventListener("click", onCancelar);
    btnCerrar.addEventListener("click", onCancelar);
    btnConfirmar.addEventListener("click", onConfirmar);
    modal.classList.add("show");
  });
}
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const modal = document.getElementById("confirmModal");
  if (modal && modal.classList.contains("show")) modal._onCancelar();
});
