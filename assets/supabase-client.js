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

function badgeClassForEstado(estado) {
  const e = (estado || "").toLowerCase();
  if (e === "audiencia hoy") return "badge-hoy";
  if (e === "esta semana") return "badge-semana";
  if (e === "este mes") return "badge-mes";
  if (e === "próximo mes" || e === "más adelante" || e === "por definir") return "badge-adelante";
  if (["se realizo", "se realizó"].includes(e)) return "badge-realizada";
  if (["no se realizo", "no se realizó", "audiencia gestionada sin éxito", "no centro de servicios"].includes(e)) return "badge-nodef";
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
