# Programador de Audiencias · Unidad Penal DIAN

Resumen completo del proyecto a la fecha, para retomarlo en VS Code sin perder contexto.

---

## 1. Qué es

Aplicativo web para que el equipo jurídico de la **División Jurídica DIAN (Unidad Penal)**
programe y consulte las audiencias penales de sus procesos (omisión de agente retenedor,
etc.). Reemplaza el Excel compartido `Programador.xlsx` (hoja `Penal_Actividades`) que
usaban antes.

- **Backend**: Supabase (Postgres + Auth), proyecto ya creado y en uso.
- **Frontend**: sitio estático (HTML/CSS/JS sin build), publicado en GitHub Pages.
- **Acceso**: un solo correo/clave compartido por todo el equipo (Supabase Auth), sin
  registro público. Los datos están protegidos por Row Level Security: solo usuarios
  autenticados pueden leer o escribir.

## 2. Dónde está cada cosa

| Componente | Ubicación |
|---|---|
| Proyecto Supabase | `programador-audiencias-penal`, id `dobppxpxolfotvxfgczw`, organización "Division Juridica DIAN Unidad Penal" (`bgaeblegbeohsrmgxsll`), región `us-east-1`, plan gratuito |
| URL del proyecto | `https://dobppxpxolfotvxfgczw.supabase.co` |
| Repositorio GitHub | `divisionjuridicadian-dev/programador-audiencias-penal` (público) |
| Sitio publicado | GitHub Pages, rama `main`, carpeta raíz — URL tipo `https://divisionjuridicadian-dev.github.io/programador-audiencias-penal/` |
| Carpeta local de trabajo | `C:\DIAN` — **ya es un repo git** conectado a `origin` (el repo de GitHub de arriba), rama `main` siguiendo a `origin/main` |
| Login del equipo | correo `divisionjuridicadian@gmail.com` — contraseña definida por el equipo (no se deja en texto plano en este archivo por seguridad; si se pierde, se resetea desde el panel de Supabase → Authentication → Users) |

**Nota sobre `git push`**: las credenciales de Windows para `github.com` deben ser de una
cuenta con permiso de escritura sobre el repo de la organización. Si `git push` da
`403 Permission denied to <usuario>`, hay que borrar la credencial guardada
(`cmdkey /delete:LegacyGeneric:target=git:https://github.com`) y volver a intentar el push
para que pida login de nuevo con la cuenta correcta.

## 3. Estructura de archivos del sitio (repo de GitHub)

```
programador-audiencias-penal/
├── login.html          → inicio de sesión (correo/clave compartidos)
├── index.html           → listado de audiencias, con filtros (fecha, estado, abogado, texto libre)
├── audiencia.html        → crear/editar una audiencia (usa ?id=<uuid> para editar)
├── carga-masiva.html      → carga inicial desde Excel histórico (uso puntual, no recurrente)
├── catalogos.html        → administrar abogados / tipos de audiencia / resultados + buscador de despachos de Antioquia (solo lectura)
└── assets/
    ├── style.css         → estilos compartidos (paleta navy/dorado, misma línea visual que Inventario_Unidad_Penal.html)
    └── supabase-client.js  → conexión a Supabase (URL + anon key), helpers de sesión/UI/catálogos
```

Todas las páginas cargan `@supabase/supabase-js@2` desde `cdn.jsdelivr.net` y usan el
cliente global `db` definido en `supabase-client.js`.

> `README.md` (instrucciones de publicación) existía antes pero se perdió del disco local
> en algún momento — no estaba versionado en git. Si se necesita, se puede recrear; las
> instrucciones de publicación en GitHub Pages ya no son tan relevantes porque ahora se
> sube por `git push` en vez de arrastrar archivos a la web.

## 4. Esquema de base de datos (Postgres, esquema `public`)

### Tabla `audiencias` (principal)
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `radicado_proceso` | text **NOT NULL** | `CHECK` regex `^[0-9]{23}$` — 23 dígitos numéricos, obligatorio, sin excepciones |
| `codigo_despacho` | text | **generado automáticamente** = primeros 12 dígitos del radicado (`generated always as`) |
| `fecha` | date NOT NULL | |
| `hora` | time | opcional |
| `despacho`, `link_audiencia`, `nit_persona_juridica`, `nombre_persona_juridica`, `id_procesado`, `nombre_procesado`, `observaciones`, `correo` | text | opcionales, texto libre |
| `tipo_audiencia_id`, `resultado_audiencia_id`, `abogado_titular_id`, `abogado_reemplaza_id` | uuid FK | referencian los catálogos |
| `cuantia` | numeric | opcional |
| `hora_fin` | time | opcional — hora en que terminó la audiencia (agregada después de crear la tabla; no estaba en el diseño original) |
| `modalidad` | text NOT NULL default `'Virtual'` | `CHECK (modalidad IN ('Virtual','Presencial'))` — Virtual es la norma general, Presencial la excepción que se marca a mano por audiencia |
| `revisar_manualmente` | boolean default false | pensado para marcar filas importadas con datos dudosos |
| `created_at`, `updated_at` | timestamptz | `updated_at` se actualiza solo con un trigger (`set_updated_at`) |
| `created_by`, `updated_by` | uuid → `auth.users` | con login único compartido, siempre queda el mismo usuario — no sirve hoy para saber qué abogado hizo cada cambio |

Restricción adicional: **`UNIQUE (radicado_proceso, fecha, hora)`** — evita duplicar la
misma audiencia (mismo proceso, mismo día, misma hora).

> ⚠️ **Importante — descubrimiento clave**: el `radicado_proceso` que se usa aquí es el
> **radicado SPOA de la Fiscalía**, no el radicado de Rama Judicial. Los primeros 12
> dígitos (`codigo_despacho`) **no** corresponden a ningún código del directorio de
> juzgados de Rama Judicial — son sistemas de numeración distintos. Por eso el campo
> `despacho` es texto libre (lo que escribe el abogado), no se resuelve automáticamente
> por código.

### Catálogos: `abogados`, `tipos_audiencia`, `resultados_audiencia`
Mismo patrón en los tres: `id` uuid PK, `nombre` text unique not null, `activo` boolean
default true (soft-delete, nunca se borra fila), `created_at`. Se administran desde
`catalogos.html`.

### `despachos_directorio` (catálogo de referencia, no ligado a `audiencias` por FK)
Directorio de juzgados de Rama Judicial cargado desde un CSV oficial. Columnas: `codigo`
(PK, 12 dígitos), `nombre`, `jurisdiccion`, `distrito`, `circuito`, `municipio`,
`departamento`, `juez`, `correo`, `direccion`, `telefono`, `horario_atencion`.

**Estado actual de la carga: incompleto a propósito.** Se cargaron ~674 despachos de
**Antioquia** y ~182 de **Atlántico** (de un archivo fuente con 3.528 en total, nacional).
Se decidió no cargar el resto porque no se estaba usando para el cruce automático (ver
nota de arriba) — solo sirve como directorio de consulta manual en `catalogos.html`
(sección "Juzgados de Antioquia"). Si se necesita ampliar a otros departamentos, el CSV
fuente es `Juzgados.csv` (subido por el usuario, formato: `JURISDICCION;DISTRITO;
CIRCUITO;MUNICIPIO;CODIGO DESPACHO;NOMBRE;JUEZ DESPACHO;CORREO DESPACHO;DIRECCION;
TELEFONO;HORARIO DE ATENCION;DEPARTAMENTO`, separado por `;`).

### Vista `audiencias_estado`
`audiencias` + joins a los 4 catálogos (nombres en vez de ids) + columna calculada
`estado`, recalculada en cada consulta (no almacenada):
- Si tiene `resultado_audiencia` → se muestra ese texto tal cual (p. ej. "Se realizo").
- Si no: `Audiencia hoy` / `Por definir` (fecha ya pasada sin resultado) / `Esta semana`
  / `Este mes` / `Próximo mes` / `Más adelante`, comparando `fecha` contra `current_date`.

Creada con `security_invoker = true` (importante: sin esto, la vista se salta el RLS del
usuario que consulta).

> ✅ Tenía un bug de zona horaria (usaba `CURRENT_DATE` en UTC) — **ya corregido, ver sección 7.**

### Seguridad (RLS)
RLS activo en las 5 tablas. Política uniforme: `to authenticated using (true)` para
select/insert/update/delete (y lo mismo para los catálogos) — es decir, **cualquier
usuario logueado con el correo compartido tiene acceso total**, no hay roles diferenciados
todavía. Sin esto, no hay acceso anónimo a nada.

Advertencia pendiente y no crítica en el linter de Supabase: *"Leaked Password Protection
Disabled"* — se activa desde Authentication → Policies si se quiere en el futuro.

## 5. Cómo se llenó la información hasta ahora

1. **Catálogos precargados** desde la hoja "Lista" del `Programador.xlsx` original: 17
   tipos de audiencia, 4 resultados, 14 abogados.
2. **Se decidió NO migrar automáticamente** las 308 filas históricas del Excel maestro
   (`Programador.xlsx`, hoja `Penal_Actividades`) por tener muchas inconsistencias (radicado
   mezclado con la columna CUANTÍA, columnas corridas, etc.). En su lugar se construyó
   `carga-masiva.html`, pensada para una carga única con revisión/corrección en pantalla
   antes de guardar.
3. **Caso Carlos Enrique Echeverry Sepúlveda**: se procesó su archivo personal
   (`CARLOS_ECHEVERRY_Programador.xlsx`). Resultado: **62 audiencias insertadas**
   directamente vía SQL, **133 filas quedaron sin poder subir** por no tener un radicado de
   23 dígitos identificable. Esas 133 se entregaron en `carlos_echeverry_pendientes_por_radicado.xlsx`,
   con columna en amarillo para completar el radicado y así importarlas después.
4. **Nombres de despacho normalizados** para las 62 audiencias de Carlos: 39 quedaron con
   el nombre oficial completo de Rama Judicial; 11 quedaron sin normalizar (cédula en el
   campo, nombres genéricos, o "que corresponda").
5. Se generó una **plantilla Excel para cargas futuras**: `plantilla_carga_audiencias.xlsx`.

## 6. Decisiones de diseño ya tomadas (no reabrir sin razón)

- **Radicado obligatorio y estrictamente 23 dígitos numéricos** — no se permite guardar
  nada sin esto, ni siquiera un estado "provisional".
- **Un solo login compartido**, no cuentas individuales por abogado.
- **`carga-masiva.html` es de uso puntual/ocasional**, no un ETL recurrente.
- Al importar, si el tipo de audiencia / resultado / abogado escrito no existe en el
  catálogo, **se crea automáticamente** (no se rechaza la fila por eso).
- Estilo visual reutilizado a propósito del `Inventario_Unidad_Penal.html` existente del
  mismo equipo (paleta navy/dorado, tipografías Source Serif 4 / Inter / IBM Plex Mono).
- `main.page { max-width: 1600px }` en `style.css`.
- **En el listado (`index.html`), ya NO se navega haciendo clic en la fila.** Cada fila
  tiene un botón de lápiz (✏️) al final para editar, y el texto de cada celda de datos es
  clicable para copiarlo al portapapeles (clase `.copyable`, función `copiarValor()`).
- **El filtro de Estado ya no es una lista fija.** Se recalcula dinámicamente
  (`actualizarOpcionesEstado()`) a partir de lo que dejan los demás filtros (fecha,
  abogado, búsqueda) — solo ofrece los estados que realmente existen en ese subconjunto.
  Si el estado seleccionado deja de existir al cambiar otro filtro, se resetea solo a
  "Todos" en vez de quedar en un valor que ocultaría todo.
- **El listado ya NO muestra el histórico pasado por defecto.** Al cargar la página, el
  filtro "Desde" se rellena solo con la fecha de hoy (`fechaHoyISO()`), así que solo se ve
  de hoy en adelante; lo anterior queda oculto salvo que el usuario borre o cambie ese
  filtro manualmente. "Limpiar filtros" también vuelve a ese mismo punto de partida (hoy
  en adelante), no a mostrar todo el histórico.
- **Consulta en vivo a la Rama Judicial** (idea traída del proyecto hermano "Control de
  Términos" / `C:\RPA\Inventario`): en `index.html`, junto al radicado de cada fila hay un
  botón 🔎 que abre un modal con la ficha completa del proceso (despacho, ponente, sujetos
  procesales, actuaciones) consultada en vivo contra la Consulta de Procesos Nacional
  Unificada de la Rama Judicial. A diferencia de Inventario (que tiene un backend
  Python/FastAPI haciendo de intermediario), DIAN es un sitio estático sin servidor propio,
  así que esa consulta la resuelve una **Supabase Edge Function** llamada `rama-judicial`
  (Deno/TypeScript, desplegada en el mismo proyecto Supabase) — mismo rol que
  `rama_judicial.py` en Inventario, reescrita para ese runtime. El frontend le pega
  directo por `fetch` (`${SUPABASE_URL}/functions/v1/rama-judicial?radicado=...`) usando
  la misma anon key ya pública del proyecto. Probado en vivo con radicados reales de la
  base: aunque el radicado que usa DIAN es el SPOA de la Fiscalía (ver advertencia en la
  sección 4), sí resuelve correctamente contra la Consulta Nacional Unificada.
- **Tres columnas/formatos nuevos en el listado (`index.html`)**:
  - La columna Fecha ahora muestra día de la semana abreviado (`formatFechaLarga()`, ej.
    "vie, 11 sep 2026") en vez de solo "11/09/2026". Lo que se copia al portapapeles sigue
    siendo el formato corto dd/mm/aaaa (más útil para pegar en otros lados) — solo cambió
    lo que se ve.
  - Nueva columna **Observaciones**, truncada con "…" si es larga (clase `.truncate`,
    máx. 220px) y con el texto completo como tooltip al pasar el mouse.
  - Nueva columna **Modalidad**: en principio inferida de si había `link_audiencia`, pero
    esto se reemplazó (ver más abajo) por un campo real y elegible.
- **El modal de la Rama Judicial ahora puede escribir de vuelta a la audiencia** (con
  confirmación antes de guardar en ambos casos):
  - Botón 📥 junto al Despacho de la ficha → sobrescribe el `despacho` de la audiencia con
    el nombre completo que devolvió la Rama Judicial.
  - Clic en la palabra "Demandado" en la tabla de sujetos procesales → toma **todos** los
    sujetos con tipo "Demandado" de esa consulta, los une con `" / "` y los guarda en
    `nombre_procesado` de la audiencia (no hace falta clicar uno por uno si hay varios).
  - Ambas acciones actualizan `todasLasFilas` en memoria y vuelven a pintar la tabla, sin
    necesidad de recargar la página.
- **Hora fin y Duración de la audiencia**: se agregó la columna `hora_fin` a `audiencias`
  (migración `add_hora_fin_a_audiencias_v3`; la vista `audiencias_estado` se tuvo que
  recrear con `DROP VIEW` + `CREATE VIEW` porque Postgres no deja insertar una columna en
  medio de una vista existente con `CREATE OR REPLACE VIEW`, solo al final). En
  `index.html`, "Hora" pasó a llamarse "Hora inicio" y hay dos columnas nuevas:
  - **Hora fin**: un `<input type="time">` directamente en la fila (no hace falta entrar a
    editar la audiencia) — al cambiarlo, guarda al toque en Supabase.
  - **Duración**: calculada en el navegador (`calcularDuracion()`) a partir de hora inicio
    y hora fin; muestra "—" si falta algún dato, y ⚠️ si la hora fin quedó antes que la de
    inicio (típicamente un error de digitación).
  También se agregó "Hora fin" al formulario completo de `audiencia.html`, junto a "Hora
  inicio" (antes solo "Hora"), para que el campo se pueda editar desde los dos lugares.
- **Columna "Procesado / Persona jurídica" con las dos líneas apiladas** (`celdaProcesado()`):
  el nombre del procesado en negrita arriba, y el de la persona jurídica en gris
  (`.muted`, `var(--ink-soft)`) debajo — antes solo se mostraba uno de los dos (el
  procesado si existía, si no la persona jurídica). Ahora se muestran ambos a la vez
  cuando los dos existen en la audiencia.
- **Modalidad pasó de ser inferida a ser un campo real y elegible** (columna `modalidad`
  en `audiencias`, ver sección 4). **Virtual es la norma general; Presencial es la
  excepción** — por eso todas las audiencias existentes (74 al momento del cambio)
  quedaron en `'Virtual'` por defecto al agregar la columna, y el equipo va marcando a
  mano cuáles son Presencial. En `index.html`, la columna Modalidad ahora es un
  `<select>` (Virtual/Presencial) que guarda al cambiarlo (`actualizarModalidad()`); si es
  Virtual y tiene `link_audiencia`, se sigue mostrando el enlace al lado. Además, **la fila
  completa se resalta en ámbar (`tr.fila-presencial`) cuando es Presencial** — las Virtual
  no llevan resaltado especial, precisamente porque son la mayoría/norma esperada.

## 7. Resuelto: filtro de Estado no mostraba "Audiencia hoy" correctamente

**Síntoma que reportó el usuario**: al filtrar por Estado = "Audiencia hoy" en
`index.html`, no aparecían las audiencias de hoy — pero si se filtraba por rango de fechas
(Desde = Hasta = hoy) sí aparecían.

**Causa confirmada** (con acceso directo a Supabase vía MCP): la vista `audiencias_estado`
compara `a.fecha` contra `CURRENT_DATE` de Postgres. La base corría en **UTC**, no en hora
de Colombia (UTC-5). Se confirmó en vivo: con hora Colombia 9:24pm del 11/sep, el servidor
ya tenía `CURRENT_DATE = 2026-09-12` (UTC), un día adelantado — por eso las audiencias de
"hoy" (fecha 2026-09-11) quedaban con `a.fecha < CURRENT_DATE` y cayían en `Por definir` en
vez de `Audiencia hoy`. El filtro de fecha no se veía afectado porque compara el campo
`fecha` crudo, sin pasar por ese cálculo.

**Fix aplicado** (migración `set_database_timezone_bogota`, vía Supabase MCP):
```sql
ALTER DATABASE postgres SET timezone TO 'America/Bogota';
```
Verificado después de aplicarlo: `current_date` ya devuelve la fecha correcta en hora
Colombia, y una consulta directa a `audiencias_estado` para la audiencia de hoy mostró
`estado = "Audiencia hoy"` como debía ser. Revisados los advisories de seguridad de
Supabase tras el cambio — sin problemas nuevos, solo la advertencia ya conocida de
"Leaked Password Protection" (ver sección 4, no crítica).

**Queda pendiente solo verificar visualmente en el sitio publicado** (con login real) que
el filtro de Estado en `index.html` ya funciona bien end-to-end.

## 7.1 Limpieza de datos: campo `voy_por` eliminado y catálogo de tipos de audiencia fusionado

- **Se eliminó por completo el campo `voy_por`** (columna en `audiencias`, campo en
  `audiencia.html` y mapeo en `carga-masiva.html`) por no tener uso real — solo 2
  audiencias tenían dato ahí y era redundante con "Abogado que reemplaza". Los 2 valores
  existentes (nombres de abogado) se perdieron al borrar la columna, ya confirmado con el
  usuario antes de hacerlo. Se tuvo que borrar y recrear `audiencias_estado` porque
  Postgres no deja quitar una columna de una vista con `CREATE OR REPLACE VIEW`.
- **Catálogo `tipos_audiencia` fusionado** (migración `fusionar_tipos_audiencia_y_quitar_voy_por_v2`):
  había entradas duplicadas/mal escritas. Las audiencias que las usaban se reasignaron al
  tipo correcto y las duplicadas se desactivaron (`activo = false`, mismo criterio
  soft-delete del resto de catálogos — no se borraron filas):
  - `IMUTACION` (0 usos) → fusionado en `IMPUTACION`.
  - `F. IMPUTACIÓN` (15 usos) → fusionado en `IMPUTACION` (quedó con 25 usos en total).
  - `F. ACUSACIÓN` (9 usos) → fusionado en `ACUSACIÓN` (con tilde, ya existía con 4 usos —
    quedó con 13 en total). Se decidió fusionar con el existente en vez de crear
    "ACUSACION" sin tilde por separado, para no duplicar conceptos parecidos en el catálogo.

## 7.2 Revisión de diseño e íconos (sesión de pulido de UI)

El usuario pidió revisar y aplicar una lista de mejoras de diseño. Se implementaron las
siguientes (todas en `assets/supabase-client.js`, `assets/style.css`, `index.html`,
`audiencia.html`, `catalogos.html`, `carga-masiva.html`):

- **Íconos SVG en vez de emojis** (✏️🔎💻🧑📥 → SVG inline, objeto `ICONOS` en
  `supabase-client.js`) — mismo criterio que la app hermana Inventario, sin sumar una
  librería externa (Lucide/Heroicons) solo para 5-6 íconos. El botón "quitar" de
  `catalogos.html` pasó de texto a ícono de papelera con más área de clic.
- **Modal de confirmación propio** (`confirmarAccion()` en `supabase-client.js`, reutiliza
  las clases `.modal-overlay`/`.modal-card` ya existentes) reemplazando `confirm()` nativo
  en: eliminar audiencia (`audiencia.html`), quitar del catálogo (`catalogos.html`), y usar
  despacho/demandados de la Rama Judicial (`index.html`). No se trajo SweetAlert.
- **Formulario de `audiencia.html` reagrupado** en 4 secciones con títulos
  (`.form-section`/`.form-section-title`): Datos del proceso, Programación (incluye el
  nuevo campo **Modalidad**, que antes solo se editaba desde `index.html`), Participantes,
  Notas. Antes era una sola cuadrícula plana de ~19 campos.
- **Selector de columnas visibles** en `index.html` (botón "Columnas", persistido en
  `localStorage` bajo `dian_columnas_ocultas`) para no saturar la tabla de 14 columnas —
  se prefirió esto sobre un panel lateral aparte.
- **Edición en línea más sutil**: `.time-input-mini` y `.modalidad-select` ya no se ven
  como inputs hasta hacer hover/foco (antes tenían borde y fondo siempre visibles).
- **Drag & drop en `carga-masiva.html`**: la zona de subida ahora es una dropzone con
  borde punteado; el `<input type="file">` original sigue existiendo (oculto) para el
  flujo de clic.
- **Bug real encontrado y corregido de paso**: en la revisión de `carga-masiva.html`,
  `renderPreview()` reconstruía toda la tabla en cada tecla presionada, así que un campo
  perdía el foco apenas se escribía un solo carácter (había que hacer clic de nuevo por
  cada letra). Se separó en `actualizarFilaEnVivo()` (solo actualiza el estado OK/Corregir
  de la fila que cambió) para no destruir los demás inputs. De paso se agregó el flash
  verde de "guardado temporal" (`recien-editado`) que pedía el usuario.
- **Skeleton loader** en la tabla principal de `index.html` mientras responde Supabase
  (antes solo decía "Cargando…" en texto plano).
- **Estados vacíos con acción**: "Sin resultados" en el listado de audiencias y en el
  buscador de juzgados de `catalogos.html` ahora incluyen un botón ("Limpiar filtros" /
  "Limpiar búsqueda") en vez de dejar al usuario sin salida.

**No implementado, a propósito** (para no sobre-invertir en esta pasada): skeleton loader
en el modal de la Rama Judicial (queda con su texto "Consultando…"); un panel lateral de
detalle como alternativa al selector de columnas.

## 7.3 Exportar a Excel + escudo de la DIAN en el encabezado

- **Botón "Exportar a Excel"** en `index.html` (junto a "Columnas"/"Actualizar"), usando
  SheetJS (ya cargado en `carga-masiva.html`, mismo CDN `cdnjs`). Exporta exactamente las
  audiencias que dejan pasar los filtros activos (fecha/estado/abogado/búsqueda) — no
  depende de qué columnas estén ocultas en pantalla, eso es solo una preferencia visual.
  Archivo `audiencias_<fecha-de-hoy>.xlsx`, columnas en español incluyendo la Duración ya
  calculada.
- **Escudo/logo de la DIAN** en el encabezado de las 5 páginas, al lado de "Programador de
  Audiencias". Se descargó y aloja localmente en `assets/escudo_colombia.png` (en vez de
  enlazar directo a `dian.gov.co`, para no depender de que ese sitio esté disponible — ya
  hay antecedente de bloqueos de red en la oficina, ver sección 7). El logo trae su propio
  texto oscuro ("DIAN"), así que va dentro de una pastilla blanca (`.brand-escudo-wrap`)
  para que se lea bien contra el header navy oscuro — pegarlo directo se veía casi invisible.

## 7.4 Barra oficial GOV.CO + paleta de colores oficial

El usuario pidió aplicar la cabecera oficial GOV.CO (pegó el HTML completo del componente,
que incluye Bootstrap 5, el mega-menú de "Biblioteca Digital de Componentes" con enlaces
de ejemplo sin contenido real, y clases `data-bs-toggle`). Se le preguntó el alcance y
eligió la **versión adaptada**: solo la barra superior delgada de gov.co + la paleta de
colores, sin Bootstrap ni el mega-menú (que hubiera chocado con `.card`/`.card-body`/`.row`
ya definidos en `style.css`, y cuyos enlaces de ejemplo no aplican a esta herramienta interna).

- **Investigación de la paleta**: los nombres de color que pegó el usuario
  (`govco-bg-cobalt`, `govco-bg-matterhorn`, etc.) no están documentados públicamente ni
  aparecen en el CSS que carga la página pública de gov.co — son de una vitrina interna del
  sistema de diseño que no se pudo alcanzar (SPA en Angular, contenido no capturable con
  fetch simple). Se verificaron los valores que se pudo, cruzando tres fuentes:
  - `--govco-cobalt: #3366cc` — **confirmado en tres fuentes independientes**: el CSS en
    vivo de gov.co (ahí como "marine", `#36c`), el botón `.btn-govco` que ya usaba
    `Inventario_Unidad_Penal.html` (la app hermana, con el mismo criterio "estilo GOV.CO"),
    y una búsqueda web.
  - `--govco-matterhorn` (`#4b4b4b`), `--govco-silver` (`#bababa`), `--govco-solitude`
    (`#e5eefb`), `--govco-white-smoke` (`#f2f2f2`), `--govco-sunglow` (`#ffab00`),
    `--govco-orange` (`#f3561f`), `--govco-green` (`#069169`) — tomados del CSS real que
    carga `https://cdn.www.gov.co/assets/css/styles.css` (ahí con otros nombres: tundora,
    silver, selago, concrete, gold, orange, green).
  - El resto (Grey, Havelock Blue, Tropical Blue, Golden Brown, Vis Vis, Corn Silk,
    Portage, Red, Yellow) son la aproximación estándar más cercana a cada nombre — **no
    verificados contra una fuente oficial**, ajustar si en algún momento se consigue el
    manual de marca exacto. Todos quedan como variables CSS `--govco-*` en `style.css`
    (más las clases `.govco-bg-*`/`.govcolor-*` por si se necesitan sueltas), no solo
    aplicados a la barra.
  - El logo oficial (`https://cdn.www.gov.co/v4/assets/images/logo.svg`, variante blanca
    para fondo oscuro) se descargó y quedó local en `assets/logo_govco.svg`, mismo criterio
    que el escudo de la DIAN — no depender de que `gov.co` esté disponible.
- **Barra superior GOV.CO** (`.govco-topbar`, negra, con el logo enlazando a
  `https://www.gov.co/`) agregada arriba del header propio en las 5 páginas.
- El color de los enlaces (`a{color:...}`) de toda la app pasó de `--navy-700` a
  `--govco-cobalt` — es el cambio visible más directo de "usar la paleta GOV.CO" sin
  reabrir la decisión ya tomada de mantener la identidad navy/dorado del resto de la app
  (ver sección 6, "Estilo visual reutilizado a propósito").

## 7.5 Página "Acerca de"

Nueva página `acerca-de.html` (enlace en el menú de las 5 páginas), inspirada en el
"Acerca de" del proyecto hermano Control de Términos pero con texto propio y adaptada al
estilo visual de esta app (tarjeta centrada, header con barra GOV.CO + escudo DIAN, en vez
de las variables Tailwind-like del otro proyecto). Contenido: nombre "Control de
Audiencias DIAN", versión 2.1.0 (12 de septiembre de 2026), descripción de la herramienta,
desarrolladores (José Milagros Echeverry Sepúlveda, Carlos Enrique Echeverry Sepúlveda) y
contacto. El logo (`assets/logo_control_audiencias.png`) lo subió el usuario como
`Logo_Control_A.png` en la raíz (1254×1254, 1.6 MB) — se redujo a 300px de alto (~190 KB)
con .NET/PowerShell (no hay ImageMagick instalado) antes de moverlo a `assets/`. También
se limpió del repo un `escudo_colombia.png` duplicado que había quedado suelto en la raíz
(idéntico byte a byte al de `assets/`, no referenciado por ninguna página).

El decorativo `.tab-mark` (rectángulo dorado sin significado, al lado del nombre de la app
en el header y en el login) se reemplazó en las 6 páginas por
`assets/logo_control_audiencias.png` (clase `.brand-logo`, 38×38px) — la regla CSS vieja
de `.tab-mark` y su pseudo-elemento `::after` se eliminaron por quedar sin uso.

## 7.6 Header horizontal → barra lateral (sidebar)

El usuario compartió el `base.html` de la app hermana Control de Términos (layout con
`app-shell` + `sidebar` fija + `main-area`, hecho en Tailwind) y pidió el mismo esquema acá,
porque el logo grande de Control Audiencias (104×104px) no cabía bien en el header
horizontal angosto de 38px de alto. Se reconstruyó el mismo esqueleto con CSS propio
(navy/dorado, sin Tailwind) en las 5 páginas con navegación (`index.html`, `audiencia.html`,
`carga-masiva.html`, `catalogos.html`, `acerca-de.html`; `login.html` no lleva sidebar, sigue
con su tarjeta centrada de siempre):

- `.app-shell` (flex) con `.sidebar` fija a la izquierda (236px, degradado navy + borde
  dorado) y `.main-area` a la derecha con el contenido de cada página sin tocar (el
  `<main class="page">`/`<main class="page narrow">` de cada una quedó igual por dentro).
- El sidebar tiene 3 bloques: `.sidebar-brand` (logo grande + escudo DIAN + título/subtítulo,
  centrados), `.sidebar-nav` (Audiencias / Nueva audiencia / Carga masiva / Catálogos, con
  íconos SVG inline y resaltado dorado en el activo), y `.sidebar-footer` (Acerca de +
  usuario/cerrar sesión, reutilizando los mismos IDs `userChip`/`userEmail`/`btnLogout` de
  siempre — no hizo falta tocar `wireUserChip()` en `supabase-client.js`).
- En pantallas angostas (`max-width:900px`) el sidebar se vuelve un panel deslizable
  (`.sidebar.open`, off-canvas) con botón de hamburguesa fijo y fondo oscuro (`.sidebar-backdrop`),
  mismo patrón que la referencia.
- **Bug encontrado y corregido al probarlo**: `.sidebar` usaba `height:100vh`, pero como la
  barra GOV.CO ocupa 32px arriba del `.app-shell` en el flujo normal del documento, el
  sidebar quedaba 32px más alto que el espacio realmente visible y el `.sidebar-footer`
  ("Acerca de") se corría fuera de pantalla hasta hacer scroll. Se corrigió con
  `height:calc(100vh - 32px)` (y lo mismo en `.app-shell{min-height:...}`).
- El botón "Eliminar" con ícono (`audiencia.html`) sigue igual; no se tocó nada de la lógica
  de las páginas, solo el marcado del header/navegación.

## 7.7 Logo del sidebar: fondo transparente + tamaño +25%

El logo se veía con un cuadro blanco de fondo sobre el navy del sidebar en vez de fundirse
con el color de la página. Causa: al redimensionar `Logo_Control_A.png` (original 1254×1254,
transparente) a los 300×300 usados en `assets/logo_control_audiencias.png`, el resize hecho
con PowerShell/`System.Drawing` (`New-Object Bitmap` sin `Format32bppArgb` explícito ni canvas
limpiado a transparente antes de dibujar) horneó el canal alfa a blanco opaco en vez de
conservar la transparencia original.

El archivo original (`C:\DIAN\Logo_Control_A.png`) ya no estaba disponible en disco para
rehacer el resize desde cero, así que se reparó el PNG de 300×300 ya existente con un
flood-fill: se recorre el lienzo desde los bordes/esquinas marcando como "fondo" los píxeles
casi blancos conectados entre sí, y solo esos se vuelven transparentes (alpha=0), con un
suavizado adicional en el borde de transición para evitar dientes de sierra. Al partir desde
los bordes y no de un umbral de color global, no se tocaron los blancos internos del propio
logo (la cajita "Ctrl+A", la etiqueta "AI"), que siguen opacos. Verificado visualmente contra
fondo rojo, navy (el real del sidebar) y blanco antes de reemplazar el archivo.

De paso se aumentó el tamaño mostrado en el sidebar un 25% (`.sidebar-brand .brand-logo`:
104px → 130px), que fue lo que pidió el usuario junto con el arreglo de transparencia.

## 7.8 Vista de "Tarjetas" en Audiencias (emula el proceso-card de Control de Términos)

El usuario pasó el `procesos.html`/`tabla_procesos.html` de Control de Términos y pidió emular
su ficha `.proceso-card` (borde de color según urgencia, radicado destacado con tag de tipo,
franja de acciones) en la lista de audiencias de esta app.

En vez de reemplazar la tabla densa (que ya tiene filtros, columnas configurables y exportar a
Excel bien afinados), se agregó un selector "Tabla / Tarjetas" en la cabecera de la tarjeta
principal (`index.html`), con la preferencia guardada en `localStorage` (`dian_vista_audiencias`,
igual patrón que `dian_columnas_ocultas`). Ambas vistas comparten el mismo filtrado
(`renderTabla()` sigue siendo el punto de entrada; al final decide si pinta `<tbody>` o llama a
`renderTarjetas()`), así que buscar/filtrar/exportar funcionan igual sin importar la vista activa.
El selector de columnas ("Columnas") se oculta en la vista de tarjetas porque no aplica ahí.

Cada `.audiencia-card` tiene:
- Borde izquierdo de color según el estado, reutilizando los mismos colores que ya tenía el badge
  de Estado en la tabla (`bordeClaseParaEstado()` solo cambia el prefijo `badge-` por `borde-` de
  `badgeClassForEstado()`, ya definido en `supabase-client.js` — así el color siempre significa lo
  mismo en las dos vistas).
- Radicado en negrita/mono destacado (mismo estilo que `radicado-numero` de la referencia) + botón
  de lupa para "Consultar en la Rama Judicial" + tag redondeado del tipo de audiencia (`.audiencia-tag-tipo`,
  equivalente a `.tag-tipo` de la referencia) + badge de Estado.
- Despacho, Procesado/Persona jurídica (reutiliza `celdaProcesado()` tal cual), abogado
  titular/reemplaza y observaciones (si existen).
- A la derecha: fecha, hora inicio/fin (el input de hora fin sigue siendo editable ahí mismo) y
  duración calculada.
- Pie de tarjeta con el selector de Modalidad (reutiliza `celdaModalidad()` tal cual, con su
  ícono y el enlace si es virtual) y el botón de Editar.
- Fondo ámbar tenue si la audiencia es Presencial, igual que `fila-presencial` en la tabla.

A diferencia de la referencia (que tiene un botón dedicado "Copiar radicado"), aquí se mantuvo el
patrón de esta app de "clic en el texto para copiar" que ya se había implementado en la tabla —
la ficha adopta el layout visual de Control de Términos pero no su interacción de copiado, para no
tener dos formas distintas de copiar texto en la misma app.

Verificado con un arnés de prueba en el scratchpad (datos falsos cubriendo los 5 colores de borde,
una audiencia sin despacho/procesado/tipo, y una con hora fin anterior a hora inicio para probar
el aviso ⚠️ de duración inválida) y con una copia completa de `index.html` con un *shim* que
sustituye `createClient()` por un cliente falso (así se probó el selector de vista funcionando de
verdad dentro de la página real, sin depender de una sesión de Supabase en vivo).

## 7.9 Tarjetas: radicado abreviado, despacho/hora/apoderado más visibles, datos del juzgado

Ajustes pedidos sobre la tarjeta de 7.8:

- **Radicado**: más grande (14px → 17px, azul) y con el radicado abreviado entre paréntesis al
  estilo Control de Términos — `(juzgado-año-consecutivo)`, tomado de las posiciones fijas del
  radicado unificado de 23 dígitos (`radicadoAbreviado()`).
- **Despacho**: verde, negrita y más grande (12px → 13.5px), en vez de gris.
- **Fecha**: nombre del día completo en vez de abreviado (`formatFechaCompleta()`: "sábado, 12 de
  septiembre de 2026" — con cuidado de solo poner mayúscula la primera letra a mano en JS, no
  `text-transform:capitalize` en CSS, que hubiera puesto en mayúscula también las preposiciones:
  "De Septiembre De"). Hora de inicio más grande (11.5px → 17px) y en dorado para que resalte.
- **Abogado titular**: la etiqueta pasó de "Titular" a "Apoderado Titular", con el nombre en
  negrita, en violeta (`--violet`, color nuevo en la paleta) y más grande que el resto de la
  tarjeta — "Reemplaza" se mantiene aparte, más pequeño y gris, para no competir visualmente.
- **Datos del juzgado** (`infoJuzgado()`): si la audiencia es Presencial se muestran juez,
  dirección, teléfono y correo; si es Virtual, solo el correo. Todos con clic para copiar, igual
  que el resto de campos de la tarjeta.

  Esto requirió traer 4 columnas nuevas a la vista `audiencias_estado` desde
  `despachos_directorio` (`despacho_juez`, `despacho_correo`, `despacho_direccion`,
  `despacho_telefono`). **El cruce obvio por `codigo_despacho`** (columna generada como los
  primeros 12 dígitos del radicado) **no sirvió: da 0 coincidencias.** Las 74 audiencias actuales
  tienen radicados con entidad "60" en esa posición, que no existe en absoluto en
  `despachos_directorio` (esa tabla solo tiene entidades 12/22/23/31/33/34/40/41/43, cargadas de
  `Juzgados.csv`) — es decir, el `codigo_despacho` de estos registros no corresponde a un código
  real de despacho de Rama Judicial, probablemente porque muchos radicados de esta app se
  digitaron a mano y no todos son números de proceso oficiales válidos (ver la sección 5, sobre
  las 133 filas de Carlos sin radicado identificable).

  La solución fue cruzar por **nombre de despacho normalizado** en vez de por código: se creó la
  función `normalizar_nombre_despacho()` (mayúsculas, sin tildes vía la extensión `unaccent`, sin
  el sufijo "(DEPARTAMENTO)" que agrega la Rama Judicial) y se unió `audiencias.despacho` con
  `despachos_directorio.nombre` por ese valor normalizado. Resultado: **63 de 74 audiencias (85%)
  ahora sí encuentran su juzgado** — las 11 que no, tienen nombres de despacho tipo placeholder
  ("DESPACHO 000 - CORTE SUPREMA DE JUSTICIA...*") o un juzgado que de verdad no está en el
  directorio cargado; para esos casos la tarjeta simplemente no muestra el bloque de datos del
  juzgado (no hay nada que inventar).

  De paso, al recrear la vista se corrigieron dos advisories de seguridad que el linter de
  Supabase señaló (no estaban relacionados con este cambio puntual pero se corrigieron de una vez
  al tocar la vista): `audiencias_estado` no tenía `security_invoker = true` (corría con los
  permisos de quien la creó en vez de quien consulta) y la función nueva no tenía `search_path`
  fijo.

  Migraciones aplicadas: `agregar_datos_despacho_directorio_a_vista_audiencias`,
  `unir_despachos_por_nombre_normalizado_en_vez_de_codigo`,
  `corregir_advisories_vista_audiencias_estado`.

## 7.10 Catálogo de Abogados: datos extendidos (cédula, T.P., género, celular, firma)

El usuario pasó como ejemplo el marcado HTML de la tabla de "Abogados" de otro sistema
administrativo genérico (rutas `/admin/tablas/Abogados`, con columnas Id_Abogado, Nombres, TP,
correo, Genero, Ruta_Firma, Celular) y pidió que el catálogo de Abogados de esta app tuviera esa
misma información.

**Base de datos** (migración `agregar_datos_extendidos_a_abogados`): se agregaron a `abogados` las
columnas `cedula`, `tarjeta_profesional`, `genero` (`CHECK` a `'M'`/`'F'`/`NULL`), `celular` y
`ruta_firma`, más un índice único sobre `cedula` que solo aplica a valores no nulos (para no
chocar entre los abogados que todavía no la tengan cargada). La cédula queda como un dato más,
**no reemplaza** el `id` (uuid) que ya usan las llaves foráneas de
`audiencias.abogado_titular_id`/`abogado_reemplaza_id` — cambiar eso habría sido mucho más
invasivo y no aportaba nada.

**`catalogos.html`**: la tarjeta de Abogados dejó de ser una lista simple de nombres (dentro de la
cuadrícula de 3 columnas junto a Tipos de audiencia y Resultados) y pasó a ser una tabla de ancho
completo, arriba de las otras dos (que ahora comparten una cuadrícula de 2 columnas), con las
columnas Cédula, Nombres, T.P., Correo, Género, Celular, Firma (indicador "Sí/—", con la ruta
completa en el `title` al pasar el mouse) y Acciones.

Agregar/editar ahora abre un modal (mismo patrón `.modal-overlay`/`.modal-card` que ya se usaba
para la ficha de la Rama Judicial) con los 7 campos; "Editar" en la fila precarga el formulario.
A diferencia del ejemplo pegado (que hacía un `DELETE` real vía un formulario POST), "Eliminar"
sigue la convención ya establecida en el resto de la app: es una baja lógica
(`activo=false` vía `confirmarAccion()`), no un borrado real — así una audiencia histórica que
referencia a ese abogado no se ve afectada. La cédula, tarjeta profesional, correo, celular y
ruta de la firma son opcionales (solo el nombre es obligatorio), porque no todos los abogados
cargados hasta ahora tienen esos datos.

Verificado con un shim de Supabase (como en 7.8) simulando 3 abogados con distintos niveles de
datos (completo, parcial, solo nombre y correo) para comprobar que los campos vacíos se ven bien
como "—" y que el modal de edición precarga todo correctamente.

## 7.11 Tarjetas: tipo de audiencia más visible, radicado con fuente uniforme, filtro de período

Cuatro ajustes pedidos sobre la tarjeta y los filtros de `index.html`:

- **Tipo de audiencia más visible**: `.audiencia-tag-tipo` pasó de una pastilla tenue
  (fondo `--paper-dim`, texto navy, 10.5px) a una pastilla sólida navy con texto blanco,
  mayúsculas y un poco más grande (11.5px) — mismo peso visual que el badge de Estado, para que
  no pase desapercibida entre el radicado y el estado.
- **Radicado y radicado abreviado con la misma fuente que el resto de la tarjeta**: tenían
  `font-family:var(--mono)` (monoespaciada, como en la tabla); se quitó esa declaración para que
  hereden la tipografía sans del resto de la tarjeta (`body{font-family:var(--sans)}`).
- **Persona jurídica un poco más grande y entre paréntesis**: `celdaProcesado()` ahora recibe un
  segundo parámetro opcional `opts.pjGrande` — en la tarjeta (`renderTarjetas()`) se llama con
  `{pjGrande:true}` y muestra la persona jurídica en 13px (antes 11.5px) entre paréntesis; en la
  tabla se sigue llamando sin ese parámetro y no cambia nada ahí (mismo tamaño, sin paréntesis),
  para no alterar la vista densa que nadie pidió tocar.
- **Filtro rápido de período** (Hoy / Mañana / Esta semana / Próxima semana): grupo de botones
  nuevo en la fila de filtros, junto a "Buscar", reutilizando el mismo componente visual del
  selector Tabla/Tarjetas (`.vista-toggle`, ahora con `flex-wrap` para que quepan 4 botones). Cada
  botón calcula un rango y lo escribe en los campos "Desde"/"Hasta" ya existentes (no es un filtro
  aparte — así sigue funcionando todo lo que ya dependía de esos dos campos, incluido exportar a
  Excel). "Esta semana" y "Próxima semana" van de lunes a domingo (`lunesDeLaSemana()`: resta
  `(getDay()+6)%7` días a la fecha para llegar al lunes de esa semana, sin importar en qué día caiga
  hoy). Si el abogado cambia "Desde"/"Hasta" a mano, el botón de período activo se apaga solo (ya
  no representa exactamente ese rango); "Limpiar filtros" también lo apaga.

Verificado con un shim de Supabase con audiencias en fechas cuidadosamente elegidas (hoy, mañana,
un día más de esta semana, y dos de la próxima semana) para confirmar que cada botón calcula el
rango correcto y filtra exactamente esas filas — incluyendo el caso real de esta sesión (hoy
sábado 12 de septiembre de 2026: "Esta semana" = 7 al 13, "Próxima semana" = 14 al 20).

## 7.12 Más períodos (Mes/Año/Todos), orden por hora, correo del juzgado fuera de la caja

Tres ajustes más sobre lo de 7.11:

- **Más botones de período**: se agregaron "Este mes" (1º al último día del mes actual, calculado
  con `new Date(año, mes+1, 0)` para el último día sin tener que saber si el mes tiene 28/30/31
  días), "Este año" (1 de enero a 31 de diciembre) y "Todos" (limpia Desde/Hasta por completo, sin
  ningún límite de fecha) — a diferencia del resto de la app, que por defecto solo muestra de hoy
  en adelante, "Todos" muestra también las audiencias anteriores.
- **Orden por fecha y hora**: `cargarDatos()` solo ordenaba por `fecha`; dentro del mismo día el
  orden entre varias audiencias quedaba indefinido. Se agregó un segundo `.order("hora", {
  ascending:false, nullsFirst:false })` — la fecha más próxima sigue primero, y dentro del mismo
  día la hora más reciente/tardía va primero (con las audiencias sin hora registrada al final, no
  arriba, gracias a `nullsFirst:false`).
- **Correo del juzgado fuera de la caja gris**: antes vivía dentro de `.audiencia-card-juzgado-info`
  (el bloque con fondo `--paper-dim`), tanto para Virtual (solo correo) como para Presencial (junto
  a juez/dirección/teléfono). Ahora el correo se muestra aparte, pegado justo debajo del nombre del
  despacho y sin fondo (`correoJuzgado()`, nueva función) — aplica igual en Virtual y en Presencial,
  porque el correo del juzgado no depende de la modalidad de la audiencia. La caja gris
  (`infoJuzgado()`) quedó solo para los datos exclusivos de Presencial: juez, dirección y teléfono.

Verificado: (a) con el mismo arnés de tarjetas de 7.8–7.11, agregando una fila con correo tanto en
Virtual como en Presencial para confirmar la nueva ubicación en ambos casos; (b) con un shim de
Supabase que de verdad aplica los `.order()` encadenados que manda el código (no solo registra que
se llamaron) — con dos audiencias el mismo día (hoy, una a las 09:00 y otra a las 15:00) se
comprobó que la de las 15:00 queda primera, y con "Todos" se comprobó que una audiencia de un mes
atrás vuelve a aparecer, en su lugar cronológico correcto al principio de la lista.

## 7.13 Filtro de período: de caja con envoltura a "chips" con scroll horizontal + accesibilidad

Revisión pedida sobre `#periodoToggle` (que en 7.12 pasó de 4 a 7 botones): en móvil, 7 botones
dentro de una caja bordeada (`.vista-toggle`, pensada originalmente para el selector Tabla/Tarjetas
de 2 opciones) se envolvían en varias líneas, y como esa caja usa `overflow:hidden` +
`border-radius` para las esquinas redondeadas del conjunto, la segunda/tercera línea de botones
quedaba con las esquinas mal cortadas. Tampoco tenía nada de accesibilidad: el estado activo era
solo visual (`.active`), sin `aria-pressed` ni `role` que le dijeran a un lector de pantalla que
esto es un grupo de botones de un solo valor a la vez.

Se separaron los dos usos, que en realidad son patrones distintos:

- **`.vista-toggle`** (Tabla/Tarjetas) volvió a ser un control segmentado simple — siempre son 2
  opciones fijas, nunca necesita envolver ni hacer scroll, así que no hacía falta tocarlo.
- **`.chip-group` / `.chip`** (nuevo): para grupos con más opciones (el filtro de período, y
  cualquier otro que se agregue después), una sola fila con `overflow-x:auto` en vez de
  `flex-wrap` — en pantallas angostas se desliza horizontalmente en vez de romperse en varias
  líneas. Cada botón es una píldora independiente (`border-radius:20px`, como los badges y el tag
  de tipo de audiencia que ya usan ese lenguaje visual), no un tramo de una barra continua, así que
  no hay problema de esquinas cortadas al hacer scroll.

Accesibilidad: el contenedor lleva `role="group"` + `aria-labelledby` apuntando al `<label>`
"Período" ya existente (en vez de duplicar el texto en un `aria-label`), y cada botón usa
`aria-pressed="true"/"false"` como **única fuente de verdad** del estado activo — ya no existe una
clase `.active` aparte; el estilo del chip seleccionado sale directamente del selector CSS
`.chip[aria-pressed="true"]`, así que la apariencia y la semántica de accesibilidad no se pueden
desincronizar entre sí. `aplicarPeriodo()`/`limpiarPeriodoActivo()` ahora hacen
`setAttribute("aria-pressed", ...)` en vez de `classList.toggle("active", ...)`.

Verificado en viewport de escritorio (1500px) y de celular (390px, ancho de un iPhone chico): en
escritorio los 7 chips caben casi todos sin necesidad de scroll; en móvil se ven en una sola fila
que se desliza al tocar, sin romperse en varias líneas. Confirmado también que el chip activo
cambia de estilo (píldora sólida navy) al hacer clic, mediante el mismo shim de Supabase de
sesiones anteriores.

**Nota de una revisión pendiente, no resuelta acá:** en el viewport móvil se notó que los botones
"Exportar a Excel"/"Columnas"/"Actualizar" y el selector Tabla/Tarjetas de la cabecera de la
tarjeta se salen de la pantalla en vez de envolver — no es parte de lo que se pidió revisar en esta
sesión (el foco era `#periodoToggle`), pero queda anotado como algo a mirar más adelante si se
prioriza la vista en celular del resto de la página.

## 7.14 Corrección: orden de hora dentro del mismo día (ascendente, no descendente)

En 7.12 el segundo `.order("hora", ...)` de `cargarDatos()` se dejó en `ascending:false` (más
tardía primero), interpretando literalmente "la hora más reciente primero" del pedido original. El
usuario mostró un caso real (dos audiencias el martes 15 de septiembre, a las 8:30 y a las 11:00)
donde eso mostraba la de las 11:00 arriba y la de las 8:30 abajo — al revés de lo que necesitaba:
dentro de un mismo día, la más temprana va primero, igual que el orden por fecha (lo más próximo
primero). Se cambió a `ascending:true` (con `nullsFirst:false` sin tocar, para que las audiencias
sin hora sigan quedando al final). Verificado con el mismo shim de 7.12 (audiencias de un mismo día
a las 09:00 y 15:00): ahora la de las 09:00 sale primero.

## 7.15 Tabla de Novedades por audiencia (bitácora manual al pie de la tarjeta)

El usuario pasó como ejemplo la pestaña "Novedades" de Control de Términos (tabla con Novedad,
Fecha, Notificación, Días Hábiles, Límite calculado y Enviado) y pidió algo equivalente para cada
audiencia — aclarando que acá debía ser más simple: carga **manual**, con fecha de la novedad y una
observación/acción a realizar, mostrada al pie de la tarjeta. Se dejó fuera a propósito todo el
cálculo automático de días hábiles/límite de la referencia: eso viene de un catálogo de términos
procesales civiles que no existe en el dominio de audiencias penales de esta app: aquí es solo una
bitácora libre.

**Base de datos** (migración `crear_tabla_novedades`): tabla nueva `novedades` (`id`,
`audiencia_id` FK a `audiencias` con `ON DELETE CASCADE` — si se borra la audiencia, sus novedades
se van con ella —, `novedad` texto obligatorio, `fecha` obligatoria, `observacion` opcional,
`created_at`, `created_by`). RLS habilitado con las mismas 4 políticas `to authenticated
using(true)` que ya tienen `audiencias` y el resto de tablas del equipo.

**`index.html`**: `cargarDatos()` ahora trae `audiencias_estado` y `novedades` en paralelo
(`Promise.all`) y agrupa las novedades por `audiencia_id` en un `Map` (`novedadesPorAudiencia`),
ordenadas por fecha descendente (la más reciente arriba). En `renderTarjetas()`, cada tarjeta
termina con un bloque "Novedades" (`celdaNovedades()`): una tabla compacta (Novedad / Fecha /
Observación / acción a realizar / Eliminar) si hay alguna, o "Sin novedades registradas." si no,
más un enlace "+ Agregar novedad" que abre un modal (mismo patrón `.modal-overlay` que Abogados y
Rama Judicial) con los 3 campos. A diferencia de Abogados, "Eliminar" acá **sí es un borrado real**
(`db.from("novedades").delete()`, con `confirmarAccion()` de por medio) — una novedad no tiene
nada que dependa de ella, así que no hacía falta la baja lógica que sí se usa en los catálogos.

Es exclusivo de la vista de Tarjetas (no aparece en la tabla densa), como el resto de lo agregado
en 7.8–7.14: la tabla ya tiene su propio conjunto de columnas configurables y agregar una fila de
detalle por audiencia no encajaba ahí.

**Bug encontrado y corregido al probarlo**: la tabla `.novedades-mini-table` se veía con un
encabezado navy sólido idéntico al de la tabla principal, en vez del estilo liviano que se le
había puesto. Causa: la regla `.novedades-mini-table th` no declaraba `background` ni `position`,
así que aunque tenía más especificidad que la regla genérica `thead th` de la tabla principal, la
cascada de CSS se resuelve **propiedad por propiedad** — para las propiedades que sí declaraba
(color, padding, tamaño) ganaba la nueva regla, pero `background:var(--navy-900)` y
`position:sticky` de `thead th` se colaban igual porque nada las estaba pisando. Se corrigió
declarando esas propiedades explícitamente (`background:none; position:static;`), y de paso se
neutralizó también el rayado de filas pares y el hover rojo de la tabla principal
(`tbody tr:nth-child(even)`/`tbody tr:hover`), que también se heredaban sin querer.

Verificado con el mismo shim de sesiones anteriores, extendido para simular de verdad `insert`,
`delete` y `eq` sobre una tabla `novedades` en memoria (no solo una lista fija): se probó el flujo
completo — abrir el modal, cargar una novedad nueva, verla aparecer en la tarjeta correcta; y
eliminar una novedad existente a través del modal de confirmación real, verificando que desaparece
de la tarjeta.

## 7.16 Tarjetas como vista principal por defecto

`vistaActual()` decidía entre Tabla/Tarjetas mirando si `localStorage` tenía guardado
`"tarjetas"` — cualquier otro valor (incluyendo que la clave no existiera nunca, el caso de todo
el mundo antes de esta sesión) caía a "tabla". Se invirtió la lógica: ahora el valor por defecto es
**Tarjetas**, y solo cae a "tabla" si el usuario guardó explícitamente esa preferencia (haciendo
clic en el botón "Tabla" en algún momento). Un usuario que ya había elegido "Tabla" a mano sigue
viendo "Tabla" al entrar — su elección se sigue respetando —, pero alguien nuevo, o que nunca tocó
el selector, ahora arranca en Tarjetas. Verificado con un perfil de Chrome nuevo (sin nada en
localStorage) para confirmar que efectivamente arranca en Tarjetas.

## 7.17 Selector de Resultado en la tarjeta + catálogo de resultados renovado + novedad automática

Tres cambios relacionados:

**Catálogo `resultados_audiencia` renovado.** Los 5 resultados anteriores (Se realizo, No se
realizo, Audiencia gestionada sin éxito, No centro de servicios, CASACION) tenían 34 audiencias
reales asociadas, así que **no se borraron**: se desactivaron (`activo=false`, migración
`reemplazar_catalogo_resultados_audiencia`) — las audiencias históricas siguen mostrando su
resultado tal cual, solo dejan de ofrecerse como opción nueva. Se agregaron los 7 pedidos:
Cesación del Procedimiento por Pago, Preclusión (Solicitada por la Fiscalía), Principio de
Oportunidad, Allanamiento a cargos (Aceptación de Responsabilidad), Archivo de las diligencias,
Reprogramación o Aplazamiento, No se realiza la audiencia (Cancelación). Siguen siendo editables
desde `catalogos.html` (la tarjeta "Resultados" ya era genérica, no necesitó cambios).

Como el "estado" que se ve en toda la app (badge, borde de color, orden del filtro) es literalmente
el nombre del resultado cuando hay uno asignado (ver la vista `audiencias_estado`, sección 4), hubo
que actualizar dos sitios que antes reconocían los nombres viejos por texto exacto:
- `badgeClassForEstado()` (`supabase-client.js`): en vez de una lista fija de 2 nombres, ahora usa
  `RESULTADOS_CONCLUIDOS` — los 5 resultados nuevos que representan un desenlace de fondo (los 5
  primeros de la lista de arriba) se pintan verde, igual que antes "Se realizo"; Reprogramación y
  Cancelación caen al gris neutro, igual que antes "No se realizo". Los nombres viejos se dejaron
  en la lista por compatibilidad con audiencias históricas que aún los tienen.
- `ORDEN_ESTADOS` (`index.html`): la cola de nombres de resultado se reemplazó por los 7 nuevos, en
  el orden en que aparecen arriba. Cualquier estado que no esté en la lista (un resultado viejo
  desactivado, por ejemplo) se sigue agregando igual al final del filtro — eso no cambió.

**Selector de Resultado directamente en la tarjeta** (`celdaResultado()`), al lado del selector de
Modalidad en el pie — mismo estilo "invisible hasta hover" que ya tenían Modalidad y la hora de
fin. Se carga el catálogo activo una vez en `init()` (`cargarCatalogo("resultados_audiencia")`). Si
la audiencia ya tiene un resultado antiguo desactivado, se agrega como opción aparte para no perder
el dato al mostrarlo (aunque no se pueda volver a elegir desde cero).

**Al elegir un resultado se abre el modal de novedad.** `actualizarResultado()` guarda el
`resultado_audiencia_id` y, si quedó un valor (no se limpió), llama a
`abrirModalNovedad(id, nombreDelResultado)` — el modal que ya existía (sección 7.15) ahora acepta
un segundo parámetro opcional para precargar el campo "Novedad" con el nombre del resultado elegido
y dejar el foco en "Acción a realizar / observación", que es lo único que falta completar; la fecha
queda en la de hoy por defecto, como siempre. Al limpiar el resultado (opción "Resultado —") no se
abre nada. Como el "estado" mostrado depende de un cálculo que vive en la vista de Postgres, acá se
optó por volver a consultar `audiencias_estado` completa (`await cargarDatos()`) en vez de parchar
la fila en el cliente, para no duplicar esa lógica en JavaScript y arriesgar que se desincronicen.

Verificado con el shim de sesiones anteriores, extendido para simular también el `UPDATE` de
`audiencias` (antes era un no-op): se probó elegir "Preclusión…" en la primera tarjeta y confirmar
que el badge/borde cambian a verde y el modal se abre precargado; y limpiar el resultado después,
confirmando que el badge vuelve a "Audiencia hoy" (su bucket de fecha original) sin abrir nada.

## 7.18 Botón "Crear Audiencia" + consulta automática del radicado + "Construir Radicado"

Tres piezas, todas dentro de `audiencia.html` salvo la primera:

**Botón "+ Crear Audiencia"** en `index.html`, al principio de la fila de botones de la cabecera
(junto a Tabla/Tarjetas, Exportar, Columnas), con el mismo estilo dorado que "Guardar audiencia" —
es un enlace directo a `audiencia.html`, un acceso más visible al lado de la lista de audiencias
además del que ya existía en el menú lateral ("Nueva audiencia"), que se dejó intacto.

**Consulta automática a la Rama Judicial al completar el radicado.** Ya existía la Edge Function
`rama-judicial` (desplegada en la sección 7 original) y su uso manual desde `index.html` (botón de
lupa + modal). Ahora, en `audiencia.html`, apenas el campo Radicado llega a 23 dígitos válidos
(`radicadoValido()`), se llama automáticamente a esa misma función y, si el proceso existe, se
completan solos el **Despacho** y el **Nombre del procesado** — este último tomando cualquier
sujeto de tipo "Demandado" **o** "Demandante" que traiga la respuesta (el pedido decía
"demandante(s)"; se incluyó también "demandado" porque es el término que usa la Fiscalía en
procesos penales y es el que ya se usaba en la función `usarDemandadosRama()` de `index.html` — así
se cubre cualquiera de los dos según el tipo de proceso). **Nunca se sobrescribe un campo que el
usuario ya haya llenado a mano** — la consulta solo completa Despacho/Nombre del procesado si
estaban vacíos. Se agregó un cuidado importante: al abrir una audiencia ya existente para editar,
`cargarAudiencia()` dispara un evento "input" sintético sobre el radicado (para que
`wireRadicadoInput` recalcule su contador) — sin una bandera (`cargandoDatosExistentes`), eso
habría disparado también la consulta automática cada vez que se abre una audiencia para editar, sin
que el usuario haya tocado nada.

**"Construir Radicado"**: botón junto al campo Radicado que abre un modal de 2 pasos. Paso 1: un
buscador de juzgados (mismo directorio `despachos_directorio` que usa `catalogos.html`, sin volver
a cargarlo si ya se consultó antes en la misma sesión de la página) — al elegir uno, sus 12 dígitos
de código quedan fijos, sin tener que elegir Departamento/Ciudad/Entidad/Especialidad/Despacho por
separado como en el formulario real de la Rama Judicial. Paso 2: Año (4 dígitos, precargado con el
año actual), Código del proceso (5 dígitos) e Instancia/Recurso (00 = primera instancia; 01–05 =
segunda instancia o recurso), con el radicado de 23 dígitos armándose y mostrándose en vivo
(`[12 del despacho][4 del año][5 del código][2 de instancia]`) a medida que se completan. Al
confirmar, el radicado construido se copia al campo principal y dispara el mismo evento "input" que
un radicado pegado a mano — por lo que la consulta automática a la Rama Judicial se ejecuta enseguida
sobre él, encadenando las dos funciones sin código adicional.

**Limitación conocida, no resuelta acá:** el buscador de juzgados solo encuentra despachos que ya
estén cargados en `despachos_directorio` (hoy: Antioquia y Atlántico, ver sección 4) — si el
juzgado necesario no está ahí, no puede construirse su radicado con esta herramienta todavía. Ya
estaba anotado como pendiente ampliar ese directorio a otros departamentos; con esta función se
vuelve más importante.

Todo el trabajo fue aditivo: no se tocó `wireRadicadoInput()`, `radicadoValido()`, `cargarCatalogo()`
ni ninguna otra pieza compartida existente — el CSS nuevo del modal se agregó en un `<style>` propio
de `audiencia.html`, no en el archivo compartido, siguiendo el mismo patrón que ya usan
`catalogos.html` y `carga-masiva.html` para estilos exclusivos de una sola página.

Verificado con un shim que además interceptó `window.fetch` para simular la respuesta de la Edge
Function (sin depender del backend real): se probó el flujo completo — buscar "control de
garantías", elegir el juzgado, completar año/código, ver el radicado armándose en vivo, confirmar,
y comprobar que el radicado quedó en el campo principal, el hint de 23/23 dígitos apareció, y
Despacho + Nombre del procesado se autocompletaron con los datos de la ficha simulada (un
demandado y un demandante, ambos unidos con " / ").

## 7.19 Doble clic en una actuación de la Rama Judicial → agregarla como novedad

En el modal "Consulta en la Rama Judicial" (`index.html`), la tabla de Actuaciones ahora acepta
doble clic sobre una fila para agregarla directamente como novedad de esa audiencia —
`agregarActuacionComoNovedad(indice)`, con `confirmarAccion()` de por medio para no crear una
novedad por un doble clic accidental al leer la tabla. El mapeo es literal: **Novedad** = nombre de
la actuación, **Fecha** = fecha de la actuación, **Observación/acción a realizar** = anotación. Se
agregó un texto de ayuda ("Doble clic en una fila para agregarla como novedad de esta audiencia.")
y `cursor:pointer` + `title` en cada fila para que la interacción sea descubrible, ya que un doble
clic no es una affordance visible por sí sola.

Reutiliza `fichaRamaData`/`fichaRamaAudienciaId` (ya guardados al abrir el modal) y las mismas
`cargarNovedades()`/`renderTabla()` de la sección 7.15 — no hizo falta ninguna función nueva de
guardado, solo el `insert` directo a `novedades` con esos tres campos.

Verificado con el shim de sesiones anteriores, esta vez además interceptando `window.fetch` para
que la ficha de la Rama Judicial devuelva actuaciones falsas: se probó abrir la ficha de una
audiencia, hacer doble clic en la primera actuación, confirmar en el diálogo, y comprobar que la
novedad aparece en la tarjeta correcta con el nombre, la fecha y la anotación completa.

## 7.20 Eliminar audiencia más visible, coincidencia de "procesado" ampliada, editar novedades

Tres pedidos de la misma sesión:

**Botón "Eliminar" reubicado en `audiencia.html`.** Ya existía (sección de creación del proyecto),
pero vivía arriba, junto al título, como un botón pequeño fácil de pasar por alto. Se movió a
`.form-actions`, al pie del formulario, junto a "Cancelar"/"Guardar audiencia" — con
`margin-right:auto` para que quede separado a la izquierda, como acción destructiva aparte del
grupo Cancelar/Guardar. Sigue apareciendo solo al editar una audiencia existente, igual que antes.

**Coincidencia de "procesado" ampliada — y una corrección de rumbo.** La Rama Judicial no siempre
usa el término exacto "Demandado": a veces es un rótulo compuesto como "Demandado/Indiciado/Causante".
El código anterior (tanto en `usarDemandadosRama()` de `index.html` como en la consulta automática
nueva de `audiencia.html`, sección 7.18) comparaba con `===` contra un texto exacto, así que esos
casos compuestos no coincidían con nada y el campo se quedaba vacío. Se agregó `esTipoProcesado()`
en `supabase-client.js` (compartida entre ambas páginas): busca coincidencia parcial contra una
lista de términos (`demandado`, `indiciado`, `procesado`, `causante`, `acusado`, `imputado`) en vez
de exigir una igualdad exacta con uno solo.

De paso se corrigió un error que se había colado en 7.18: ahí se agregó "demandante" a la lista de
términos que llenan "Nombre del procesado", pero en los procesos de esta app **la propia DIAN
suele figurar como demandante** (se confirmó con un pantallazo real: "Demandante: Dian" /
"Demandado: Fabiola Yepes Correa") — incluirla mezclaba a la entidad con el procesado. Se sacó
"demandante" de la lista de `esTipoProcesado()` a propósito.

**Editar novedades** (antes solo se podían agregar o eliminar). Cada fila de la tabla de Novedades
tiene ahora también un botón de editar (lápiz) junto al de eliminar. `abrirModalNovedad()` acepta
un tercer parámetro opcional con la novedad completa — si viene, el modal se llama "Editar novedad",
precarga los 3 campos, y `guardarNovedad()` hace `UPDATE` en vez de `INSERT`. La función nueva
`editarNovedad(audienciaId, novedadId)` busca la novedad en `novedadesPorAudiencia` (ya cargado en
memoria) y abre el modal con ella. De paso se agregó un segundo criterio de orden
(`created_at` descendente) como desempate entre varias novedades del mismo día — el orden por
fecha descendente ("de mayor a menor") ya estaba implementado desde la sección 7.15, no hizo falta
agregarlo.

Verificado con el shim extendido para soportar `UPDATE` también sobre `novedades` (antes solo
`INSERT`/`DELETE`): coincidencia parcial con un sujeto de tipo compuesto "Demandado/Indiciado/Causante"
(sí se toma) y uno de tipo "Demandante" (correctamente excluido); y edición de una novedad existente,
confirmando que el texto se actualiza en el lugar de la fila (sin duplicarla) y conserva la fecha y
observación no tocadas.

## 7.21 Abogado titular obligatorio + Buscar ignora el filtro de fecha

Dos ajustes más:

**Abogado titular obligatorio** en `audiencia.html`: se agregó el atributo `required` al
`<select>` (mismo mecanismo nativo del navegador que ya usan Radicado y Fecha — el primer
`<option value="">—</option>` que arma `llenarSelect()` hace que el navegador bloquee el envío
del formulario mientras siga seleccionada esa opción vacía). No hizo falta lógica adicional en
`guardar()`.

**Buscar ya no queda escondido por el filtro de fecha.** Se encontró que escribir en "Buscar"
filtraba sobre el subconjunto que ya habían dejado Desde/Hasta/Abogado — así, buscar el radicado de
una audiencia de hace un mes no encontraba nada si el filtro de fecha por defecto (de hoy en
adelante) seguía activo, aunque el texto sí coincidiera. Ahora, mientras el campo Buscar tenga algo
escrito, el período se fuerza a "Todos" (limpia Desde/Hasta) automáticamente, reutilizando
`aplicarPeriodo("todos", …)` de la sección 7.12 — así una búsqueda por texto nunca queda oculta por
un filtro de fecha que nada tiene que ver con lo que se está buscando. Al borrar el texto de Buscar,
el período no vuelve solo a como estaba antes (se deja en "Todos"; hay que elegir otro período o
"Limpiar filtros" a mano) — mantenerlo simple pareció mejor que reconstruir un estado previo.

Verificado: al escribir un fragmento del radicado de una audiencia de agosto (fuera del rango
"de hoy en adelante" por defecto), Desde/Hasta se vaciaron solos y la audiencia apareció en los
resultados ("1 de 8 audiencias").

## 7.22 "Buscar en Consolidado": traer datos del inventario de la Unidad Penal a la audiencia

El usuario tiene, por fuera de esta app, un inventario propio de la Unidad Penal: `Consolidado.xlsx`
(Excel con ~10.800 procesos, hoja `Base`) y `Inventario_Unidad_Penal.html` (un panel de consulta que
carga ese Excel a mano con SheetJS y lo filtra/muestra). El pedido fue traer a `audiencia.html`,
buscando por radicado, los datos que ya existen en ese inventario para no volver a escribirlos a
mano cada vez que llega una audiencia para agendar — y poder "actualizar" con esos datos una
audiencia que ya se había creado antes.

**No se tocó ni se leyó automáticamente `Consolidado.xlsx` desde ningún sitio fijo**: igual que
`carga-masiva.html`, es la persona quien selecciona el archivo con un `<input type="file">` — un
sitio estático en GitHub Pages no tiene forma de leer un archivo del equipo del usuario sin que la
persona lo elija. El archivo se procesa una sola vez por sesión de la página (mientras no se cierre
la pestaña) y el resultado filtrado queda en memoria para buscar sin volver a leerlo.

**Columnas reales de la hoja "Base"** (se abrió el Excel directamente para confirmarlas, en vez de
adivinar o replicar la coincidencia difusa de encabezados de `Inventario_Unidad_Penal.html`):
`NRO. PROCESO`, `DESPACHO`, `DEPARTAMENTO`, `CIUDAD`, `DELITO(S) BASE`, `NOMBRE PROCESADOS`,
`CUANTÍA`, `APODERADO`, `ACTIVIDADES ADELANTADAS`, `OBSERVACIONES`, `NIT`, `CC`, `ESTADO`,
`CONTRIBUYENTE`. Si el Consolidado cambia de encabezados en el futuro, hay que actualizar el mapa
`COLUMNAS_CONSOLIDADO` en `audiencia.html`.

**Filtro, igual al que describió el usuario para `Inventario_Unidad_Penal.html`**: solo entran filas
donde `APODERADO` contiene "CARLOS ENRIQUE ECHEVERRY SEPULVEDA" (sin exigir el sufijo exacto
" - PLANTA", por si cambia) y `DESPACHO` contiene "JUZGADO PENAL" — de los ~10.800 procesos del
archivo completo, esto deja unos pocos cientos relevantes para este equipo.

**Base de datos**: 4 columnas nuevas en `audiencias` — `departamento`, `ciudad`, `delito_base`,
`estado_proceso` (con `CHECK` a `'Activo'`/`'Terminado'`/`NULL`). `estado_proceso` se llamó así a
propósito, distinto de `estado` (la columna calculada de `audiencias_estado` que significa el
estado de *agendamiento* — "Audiencia hoy", "Esta semana", etc. — algo completamente distinto al
estado del *proceso judicial* que trae el Consolidado). Migración
`agregar_campos_consolidado_a_audiencias`, con el `DROP VIEW`+`CREATE VIEW` de siempre para exponer
las columnas nuevas (esta vez con `WITH (security_invoker = true)` puesto directo en el `CREATE`,
para no tener que corregirlo después como pasó en la sección 7.9).

**Mapeo de campos** (buscar en Consolidado → formulario de audiencia.html):
- `NRO. PROCESO` (21 dígitos) → Radicado, agregando `"00"` al final para completar los 23 (misma
  convención de instancia/recurso del "Construir Radicado" de la sección 7.18 — confirmado contra
  el archivo real: 10.773 de 10.777 filas tienen exactamente 21 dígitos).
- `DESPACHO` → Despacho — tal cual viene (ej. "3 3 Juzgado penal de circuito"), sin intentar
  reescribirlo al formato "JUZGADO N PENAL DEL CIRCUITO DE…" que usa el resto de la app; no se pidió
  y hacerlo bien requeriría cruzar con `NRO. JUZGADO`/`CIUDAD`, así que se dejó tal cual para no
  inventar un formato.
- `DEPARTAMENTO` / `CIUDAD` → los dos campos nuevos, quitando el código numérico DANE que trae
  adelante el Consolidado (ej. "5001 MEDELLÍN - ANTIOQUIA" → "MEDELLÍN - ANTIOQUIA").
- `DELITO(S) BASE` → el campo nuevo Delito(s) base.
- `NOMBRE PROCESADOS` → Nombre del procesado.
- `CUANTÍA` → Cuantía (numérico; se limpia por si viniera como texto con formato).
- `APODERADO` → Abogado titular: se quita el sufijo " - PLANTA" y se busca ese nombre (sin
  distinguir mayúsculas) entre las opciones ya cargadas del catálogo de abogados; si no hay
  coincidencia exacta, el campo se deja como estaba — no hay nada más específico que intentar.
- `ACTIVIDADES ADELANTADAS` → una **novedad** (no un campo del formulario): se guarda al hacer clic
  en "Guardar audiencia", con fecha de hoy y observación "Importado automáticamente desde el
  Consolidado". Si la audiencia es nueva, no existe id todavía en el momento de elegir el registro,
  así que el texto queda en memoria y la novedad se crea justo después de que el `insert` a
  `audiencias` devuelve el id recién creado (se le agregó `.select("id").single()` a ese `insert`,
  que antes no pedía nada de vuelta).
- `OBSERVACIONES` → Observaciones.
- `NIT` → NIT persona jurídica.
- `CC` → Identificación del procesado.
- `CONTRIBUYENTE` → Nombre persona jurídica.
- `ESTADO` → Estado del proceso (Activo/Terminado) — solo se traduce si el texto contiene
  "ACTIVO" o "TERMINADO"; cualquier otro valor se deja vacío en vez de arriesgar un error contra
  el `CHECK` de la base de datos.

**"Actualizar con la base de datos" para audiencias ya creadas**: es el mismo botón "Buscar en
Consolidado" — al abrirlo con un radicado ya escrito (editando una audiencia existente), se
precarga la búsqueda con sus primeros 21 dígitos para encontrar el proceso correspondiente de una
vez. Igual que con "Construir Radicado" y la consulta automática a la Rama Judicial, elegir un
registro solo llena los campos del formulario — hace falta hacer clic en "Guardar audiencia" para
confirmar los cambios, con un diálogo de confirmación de por medio antes de aplicar (avisando qué
campos se van a reemplazar).

Verificado con un archivo Excel de prueba (3 filas: una que cumple el filtro, una con otro
apoderado, una con despacho no penal) y un shim que además captura los `insert`/`update` reales
que arma el código: se comprobó que solo aparece la fila que cumple ambos filtros, que los 12
campos se mapean correctamente al payload de guardado (incluida la limpieza del código DANE en
Departamento/Ciudad y el acierto del abogado por nombre completo sin " - PLANTA"), y que la novedad
de "Actividades adelantadas" se crea con el id de la audiencia recién creada.

## 7.23 Corrección: el filtro por Despacho ("Juzgado Penal") descartaba el 76% de los casos reales

El usuario reportó que "Buscar en Consolidado" daba 0 resultados para un radicado que sí existe en
`Inventario_Unidad_Penal.html`. Se abrió el Consolidado real y se contó la columna `DESPACHO` para
**todos** los procesos de Carlos Enrique Echeverry Sepúlveda (862 en total):

- 653 (76%) → `"8 8 Otro"`
- 206 → `"3 3 Juzgado penal de circuito"`
- 3 → `"2 2. Juzgado penal municipal"`

`"8 8 Otro"` es una clasificación genérica del Consolidado, **no una señal de que el proceso no sea
penal** — es justamente el valor que trae la mayoría de sus casos reales (el mismo radicado que
reportó el usuario, de Víctor Manuel Serna Guarín, tiene ese despacho). El filtro
`despacho.includes("JUZGADO PENAL")` de la sección 7.22, tomado literalmente del pedido original,
dejaba fuera a las tres cuartas partes del caso de uso real.

Se quitó ese filtro por completo — "Buscar en Consolidado" ahora solo filtra por **apoderado**
(sigue siendo "CARLOS ENRIQUE ECHEVERRY SEPULVEDA", sin exigir el sufijo exacto " - PLANTA"), que
ya alcanza para acotar el archivo completo (~10.800 filas) a exactamente los procesos que le
corresponden a este abogado (862), sin arriesgarse a los códigos de clasificación de despacho del
Consolidado, que no son consistentes ni confiables como filtro.

Verificado reproduciendo el caso exacto reportado (mismo radicado, mismo Excel con un registro
`DESPACHO = "8 8 Otro"`): ahora aparece "1 de 1 procesos coinciden" con los datos correctos
(Víctor Manuel Serna Guarín, Medellín - Antioquia, $8.969).

## 7.24 "Buscar en Consolidado" ya no trae el Despacho (queda para la Rama Judicial)

A raíz de 7.23: el usuario no quiere que se traiga el Despacho del Consolidado en absoluto, ni
siquiera para los casos donde no dice "8 8 Otro" — prefiere que ese campo se siga llenando solo con
la consulta automática a la Rama Judicial (sección 7.18), que si el radicado existe trae el nombre
real y completo del despacho. Se quitó la línea que copiaba `r.despacho` al campo del formulario en
`elegirRegistroConsolidado()`, y se sacó "Despacho" de la lista de campos que menciona el diálogo de
confirmación. El radicado sí se sigue copiando y sigue disparando el evento "input" que activa esa
consulta automática — como el campo Despacho queda vacío (nunca se llegó a escribir), la consulta a
la Rama Judicial lo completa normalmente sin que nada se lo impida.

Verificado: al elegir un registro del Consolidado con `DESPACHO = "8 8 Otro"`, el campo Despacho del
formulario terminó con el nombre real que devolvió la Rama Judicial simulada, nunca con el valor del
Consolidado.

## 7.25 "Buscar en Consolidado" ya no filtra por apoderado

El filtro por `APODERADO = "CARLOS ENRIQUE ECHEVERRY SEPULVEDA"` (secciones 7.22/7.23) escondía un
caso real: un proceso recién reasignado a Carlos (o que está por reasignársele) puede seguir
figurando en el Consolidado a nombre del abogado anterior, porque el archivo no se actualiza al
instante — exactamente la situación en la que más hace falta poder buscarlo por radicado. Se
comprobó además que no hay ningún caso en el archivo real donde `APODERADO ANTIGUO` sí mencione a
Carlos mientras `APODERADO` no lo haga, así que no había ninguna combinación de columnas que
resolviera esto sin quitar el filtro.

Se quitó el filtro por apoderado por completo — "Buscar en Consolidado" ahora indexa los ~10.800
procesos del archivo tal cual, sin restricción por a nombre de quién estén. Sigue siendo una
búsqueda manual con confirmación antes de traer los datos (no una importación automática), así que
no hay riesgo de traer accidentalmente el proceso de otra persona: el usuario busca por el radicado
puntual que le notificaron y elige ese, sin importar el resto de la lista. El emparejamiento de
"Abogado titular" (quitando " - PLANTA" del `APODERADO` del registro elegido) se mantiene igual —
si el proceso todavía figura a nombre de otro abogado en el Consolidado, ese es el que se
autocompleta en el select, y el usuario lo cambia a mano si ya se reasignó a Carlos.

Verificado con un registro de prueba a nombre de un abogado distinto ("MARIA FERNANDA GOMEZ"): ahora
aparece en la búsqueda sin problema.

## 7.26 "Generar Poder": documento .docx armado en el navegador desde cada audiencia

Botón nuevo en cada tarjeta de `index.html` (icono de documento, junto al de editar) que genera y
descarga un Word (.docx) de Poder especial, tomando como formato de referencia un Poder real de la
DIAN (`PODER.pdf`, aportado por el usuario) y llenando los datos variables con lo que ya hay
guardado de la audiencia y del abogado.

**Generación real de .docx en el cliente, sin backend**: se usa la librería `docx` (versión 9.7.1,
build IIFE desde jsDelivr:
`https://cdn.jsdelivr.net/npm/docx@9.7.1/dist/index.iife.min.js`, expone el global `docx` con
`Document`, `Paragraph`, `TextRun`, `Table`, `TableRow`, `TableCell`, `WidthType`, `Packer`). Se arma
un `docx.Document` con párrafos y una tabla, se convierte a `Blob` con `Packer.toBlob(doc)` (async) y
se dispara la descarga con un `<a>` temporal (`href = URL.createObjectURL(blob)`, `download = "Poder_<radicado>.docx"`, `.click()`). Todo pasa en el navegador del usuario — no hay Edge Function ni
almacenamiento de estos documentos en Supabase.

**Nuevo catálogo `directoras_asignadas`** (Catálogos → tarjeta "Directoras Asignadas", mismo patrón
CRUD que Abogados): quién otorga el poder (poderdante) — la vista firma un Poder distinto según quién
esté como Directora Asignada en el momento. Columnas: `id`, `identificacion`, `nombres_completos`,
`cargo`, `resolucion`, `fecha_resolucion`, `activo` (baja lógica, igual que el resto de catálogos).
Migración `crear_tabla_directoras_asignadas`, con las 2 políticas RLS de siempre
(`equipo_select_directoras_asignadas` / `equipo_write_directoras_asignadas`, `to authenticated using
(true)`).

**De dónde sale cada dato del documento**:
- Encabezado (fecha, "Señor (a)", despacho, ciudad - departamento) → fecha de hoy + `despacho`,
  `ciudad`, `departamento` de la audiencia.
- Tabla ASUNTO/DENUNCIANTE/DENUNCIADO/ENTE JURÍDICO/PRESUNTO DELITO/SPOA → fijo "PODER" y "U.A.E.
  DIAN...", `nombre_procesado` + `id_procesado` de la audiencia, `nombre_persona_juridica` +
  `nit_persona_juridica` (fila **omitida por completo** si no hay persona jurídica — no todas las
  audiencias tienen una), `delito_base`, `radicado_proceso`.
- Párrafo del poderdante → los 5 campos de la directora elegida en el modal (`nombres_completos`,
  `identificacion`, `cargo`, `resolucion`, `fecha_resolucion` con formato "1 de abril de 2026").
- Abogado apoderado → **"Abogado que reemplaza" tiene prioridad sobre "Abogado titular"** si la
  audiencia tiene uno seleccionado (mismo criterio que se usaría para saber quién va a la audiencia
  en la práctica); se busca por nombre (la vista `audiencias_estado` ya trae el nombre resuelto, no
  el id, así que el emparejamiento contra el catálogo completo de abogados es por `nombre`, no por
  FK) y de ahí salen `cedula`, `tarjeta_profesional`, `genero`, `correo`.
- **Condicionales de género** (según `abogados.genero`, `"F"` activa las formas femeninas, cualquier
  otro valor cae en masculino por defecto): "al abogado/a la abogada", "identificado/identificada",
  "facultado/facultada", "al apoderado/a la apoderada", "Abogado/Abogada G.I.T. Unidad Penal".
- Si la audiencia no tiene ni abogado titular ni reemplazo asignado, el botón avisa con un toast y no
  genera nada (no tiene sentido un Poder sin apoderado).

**Decisión de diseño — firma del poderdante**: el texto real de `PODER.pdf` usa dos frases distintas
para el mismo cargo de la misma persona: en el párrafo dice "actuando como **Directora Asignada** de
la Dirección Seccional..." y en la firma dice "**Directora Seccional de Impuestos de Medellín (A)**".
Como el catálogo pedido por el usuario solo tiene un campo `Cargo` (no dos), se optó por reutilizar
ese mismo texto tal cual en ambos lugares — el párrafo intercala `{cargo}` en la misma frase que el
PDF original, y la firma imprime `{cargo}` solo en su propia línea. Si en la práctica se necesitan
las dos redacciones distintas, haría falta agregar un segundo campo al catálogo (p. ej. `cargo_firma`)
— no se hizo porque no se pidió y el campo único ya cubre el caso general.

**No se replicó el membrete** (logo DIAN, dirección, teléfono, "Información Pública Clasificada" del
encabezado del PDF) — el pedido del usuario fue por el contenido/las variables del Poder, no por
imitar el diseño exacto de la plantilla oficial; se puede agregar después si hace falta insertar una
imagen de encabezado.

Verificado con un shim que simula `abogados` (un caso masculino, uno femenino) y
`directoras_asignadas`, más un arnés que llama `abrirModalPoder()` → `generarPoder()` directamente y
descomprime el `.docx` resultante con JSZip para leer el texto plano: se confirmó que ambos géneros
producen las 5 formas condicionales correctas, que "Abogado que reemplaza" gana sobre "Abogado
titular" cuando está elegido, que la fila ENTE JURÍDICO aparece solo cuando hay persona jurídica, y
que una audiencia sin abogado asignado no genera documento (sin lanzar ninguna excepción). También se
probó el CRUD completo de "Directoras Asignadas" en `catalogos.html` (agregar, editar, quitar) con el
mismo patrón de Abogados.

**Ajuste de formato (a pedido del usuario, tras la primera versión)**: el documento completo pasó a
Arial 12 y justificado — se fija tanto como estilo por defecto del `Document` (`styles.default.document.run/paragraph`)
como explícito en cada `TextRun`/`Paragraph` (helpers `correr()`/`parrafo()` dentro de
`construirYDescargarPoder`), para no depender de que Word respete los defaults dentro de las celdas
de la tabla. También se quitó el Departamento de la línea "Ciudad - Departamento" del encabezado —
ahora esa línea muestra solo la Ciudad de la audiencia. Verificado abriendo el `.docx` generado con
JSZip e inspeccionando `word/styles.xml` y `word/document.xml`: `w:ascii="Arial"` y `w:sz w:val="24"`
presentes tanto en los defaults como en los runs, y `w:jc w:val="both"` presente en los 28 párrafos
del documento de prueba.

## 7.27 "Enviar Recordatorio": correo automático al abogado con opción de agregar a su agenda

Nuevo botón (icono de sobre) en cada tarjeta de `index.html`, junto a "Generar Poder" y "Editar".
A diferencia del Poder (que se arma en el navegador), este correo lo **envía de verdad el sistema**
— sin pasar por el cliente de correo de quien hace clic — a través de una nueva Edge Function,
`enviar-recordatorio`, y el proveedor de correo transaccional **Resend**.

**Decisión tomada con el usuario** (se le presentaron las opciones antes de construir):
- Envío automático real (esta opción) en vez de un simple `mailto:` — el sistema manda el correo
  solo, no requiere que alguien abra su cliente de correo y le dé "Enviar" cada vez.
- Dominio de envío: **por ahora, el dominio de pruebas de Resend** (`onboarding@resend.dev`) — sin
  verificar un dominio propio todavía. Esto es una decisión temporal y tiene una limitación
  importante: **mientras no se verifique un dominio propio, Resend solo entrega correos a la
  dirección con la que se creó la cuenta de Resend** (así funcionan todos los proveedores en modo
  de pruebas — Resend, SendGrid, SES — para evitar spam). O sea: hoy el botón puede enviar
  recordatorios de prueba solo a esa dirección, no todavía a cualquier abogado real. Cuando se
  verifique un dominio propio (subdominio de `dian.gov.co` u otro), basta con cambiar la constante
  `REMITENTE` en la Edge Function — el resto del código no cambia.

**Qué contiene el correo**:
- Los datos de la audiencia en una tabla (fecha completa en español, radicado, tipo, despacho,
  modalidad, enlace si es virtual).
- Un botón/enlace **"Agregar a Google Calendar"** (URL de "quick add" de Google, con los datos ya
  cargados — un clic y queda en el calendario).
- Un **archivo `.ics` adjunto** (formato iCalendar universal) para quien use Outlook, Apple Calendar
  u otra agenda que no sea Google — así "agregar a la agenda" funciona sin importar qué use el
  abogado, sin necesidad de que la app sepa cuál usa cada quien.

**De dónde sale el destinatario**: mismo criterio que "Generar Poder" — el abogado que reemplaza
tiene prioridad sobre el titular si hay uno elegido para esa audiencia. El modal del botón
precarga ese correo automáticamente, pero el campo es **editable** antes de enviar (útil tanto para
corregir un correo que falte en el catálogo, como para las pruebas de hoy contra el dominio sandbox
de Resend).

**Edge Function `enviar-recordatorio`** (Deno, `verify_jwt: true` igual que `rama-judicial`):
recibe `{ audienciaId, correoDestino? }`, consulta la audiencia y el abogado con el cliente de
service role (evita depender de RLS desde una función de servidor), arma el `.ics` y el enlace de
Google Calendar a mano (sin librerías — es texto plano con un formato específico), y llama a la API
de Resend (`POST https://api.resend.com/emails`) con el `.ics` como adjunto en base64. La fecha/hora
de la audiencia se interpreta en América/Bogotá (UTC-5 fijo, sin horario de verano — misma
convención de la migración `set_database_timezone_bogota`) para calcular el horario UTC real del
evento. Requiere el secreto `RESEND_API_KEY` configurado en el proyecto de Supabase (Project
Settings → Edge Functions → Secrets) — **pendiente de que el usuario cree la cuenta en Resend y
cargue esa clave**, no hay una API para hacerlo desde acá.

Verificado en dos niveles: (a) la función ya desplegada, probada en vivo con `curl` contra un id de
audiencia inexistente (responde `{ok:false}` sin caerse) y contra una audiencia real de la base de
datos (llega hasta el paso de Resend y falla ahí con un mensaje claro — "API key is invalid" —
exactamente lo esperado porque el secreto todavía no está configurado; confirma que toda la lógica
de antes, joins y armado de fechas, corre sin errores); (b) el botón y el modal en `index.html`, con
un shim que simula la respuesta de la función: precarga de correo correcta, cierre del modal al
enviar con éxito, validación de campo vacío sin llegar a llamar al servidor, y manejo de un rechazo
de Resend mostrando el error sin cerrar el modal (para poder corregir el correo y reintentar).

**Confirmado en producción**: el usuario cargó `RESEND_API_KEY` (Edge Functions → Secrets — la
sección vive dentro de "Edge Functions" en el panel de Supabase, no en "Project Settings", que fue
donde primero se buscó sin encontrarla) y recibió el primer correo real.

**Ajustes al contenido del correo (a pedido del usuario, tras ver el primer envío real)**:
- **Tratamiento según género**: el saludo ahora es "Hola Dr./Dra. {nombre}", usando el mismo criterio
  de `abogados.genero` que "Generar Poder" (F → "Dra.", cualquier otro valor → "Dr." por defecto). Si
  el destinatario vino de un `correoDestino` manual sin abogado emparejado, no hay de dónde sacar el
  género — el saludo queda sin tratamiento en ese caso ("Hola,").
- **Procesado y persona jurídica** en la tabla del correo (antes solo estaban en la descripción del
  `.ics`, no visibles en el cuerpo del correo): se agregan como filas "Procesado" y "Persona
  jurídica", cada una solo si el dato existe en la audiencia.
- **Aviso de enlace faltante en audiencias virtuales**: si `modalidad` es "Virtual" y todavía no hay
  `link_audiencia` cargado, se agrega una nota destacada (fondo amarillo) debajo de la tabla
  recordando que hace falta agregar el enlace antes de la fecha — en vez de omitir la fila "Enlace"
  en silencio, que es lo que pasaba antes.

Verificado con la misma Edge Function ya desplegada (versión 3): un `curl` contra una audiencia real
de la base de datos llegó hasta el llamado a Resend sin errores (el único rechazo que dio fue el
esperado, de Resend, por usar `test@example.com` como destinatario de prueba — no del código nuevo),
confirmando que el join con género, las filas condicionales y el aviso de enlace faltante corren bien.

## 7.28 Fondo detrás del logo del menú + botón para colapsar/ocultar el menú

Dos pedidos sobre el sidebar (las 5 páginas que lo tienen: `index.html`, `audiencia.html`,
`carga-masiva.html`, `catalogos.html`, `acerca-de.html`):

**Fondo detrás del logo**: `.sidebar-brand` (el bloque con el logo, el escudo de la DIAN y el
título) pasó de tener solo un borde inferior a ser un panel propio — esquinas redondeadas, con
margen respecto al borde del sidebar, y un lavado claro diagonal (`linear-gradient` blanco muy
transparente) de fondo. Antes el logo quedaba flotando directo sobre el navy liso del sidebar; ahora
tiene un panel que lo resalta sin competir con sus colores (el logo ya es bastante colorido — azul,
verde, blanco — así que se eligió un lavado neutro en vez de un color sólido que chocara con él).

**Botón para colapsar/ocultar el menú** (solo escritorio, ≥901px — en mobile ya existe el menú
hamburguesa de siempre, que es un mecanismo distinto: overlay temporal, no se recuerda entre
cargas): un botón circular con una flecha (`‹`), pegado al borde derecho del sidebar, que al hacer
clic oculta el sidebar por completo (el `.main-area` ocupa todo el ancho, gracias a que ya es un
`flex:1` dentro de `.app-shell`) y gira la flecha 180° (`›`) para indicar que un clic más lo vuelve a
mostrar.

**Se recuerda entre páginas y recargas**: el estado se guarda en `localStorage`
(`dian_sidebar_colapsado`) y se aplica como atributo `data-sidebar="colapsado"` en `<html>`. Para que
no haya parpadeo (sidebar visible un instante y luego desaparece), el atributo se fija con un script
**inline al principio del `<head>`** de cada una de las 5 páginas — antes de que el CSS pinte nada —
en vez de esperar a que cargue todo el HTML y corra `assets/supabase-client.js`. La función
`alternarSidebarColapsado()` (la que sí vive en `supabase-client.js`, compartida) solo se necesita
para el clic del botón, no para la carga inicial.

Verificado con Chrome headless: (a) clic en el botón oculta el sidebar y el contenido pasa a ocupar
todo el ancho (confirmado visualmente); (b) recargando la página con `dian_sidebar_colapsado` ya en
`"1"` desde antes, el sidebar arranca en 0px de ancho sin parpadeo — se comprobó tanto por captura
como midiendo `getBoundingClientRect()` apenas termina de cargar. (Nota de proceso: la primera
medición automatizada, leyendo `getComputedStyle().width` en el mismo tick justo después del clic,
dio un falso "FAIL" — es un ítem flex y Chrome no recalcula su `width` resuelto hasta el siguiente
ciclo de layout; la captura de pantalla en el mismo instante ya mostraba el colapso correcto. No es
un problema del sitio, solo de cómo se medía en la prueba.)

## 7.29 "División Jurídica" en el bloque de marca + restyle del texto (sidebar + login)

Se agregó una línea nueva entre el nombre de la app y "Unidad Penal · DIAN", en las 6 páginas que
tienen ese bloque de marca (las 5 del sidebar + `login.html`, para que se vea igual desde el primer
momento en que se entra a la app):

```html
<h1>Programador de Audiencias</h1>
<div class="brand-division">División Jurídica</div>
<div class="subtitle">Unidad Penal · DIAN</div>
```

**Restyle pedido explícitamente ("más moderno e intuitivo, que resalte a la vista")**: `.brand-division`
es una píldora dorada (`linear-gradient` de `--gold-soft` a `--gold`, texto navy oscuro encima para
buen contraste, con una sombra suave) — es la pieza que más llama la atención del bloque, a propósito,
porque "División Jurídica" es la información nueva que se quería resaltar. Alrededor de ella se ajustó
la jerarquía del resto: `.subtitle` ("Unidad Penal · DIAN") bajó de color dorado a un blanco apagado
(`rgba(249,248,244,.6)`) para quedar claramente en segundo plano detrás de la píldora, y el `h1` ganó
un poco más de `letter-spacing` para las tres líneas se sientan como un solo bloque compuesto en vez
de tres textos sueltos.

**Bug encontrado y corregido durante la prueba**: en `login.html`, `.login-head` no es un contenedor
flex (a diferencia de `.sidebar-brand`), así que un `<div>` de bloque normal se estira a todo el ancho
del card — la píldora salía como una barra completa en vez de una píldora compacta. Se agregó
`display:inline-block` a `.brand-division` para que siempre se ajuste a su contenido sin importar el
tipo de contenedor que la rodee.

Verificado con capturas de Chrome headless en ambos contextos (sidebar a ancho de escritorio, y la
tarjeta de `login.html`): la píldora se ve compacta y centrada en los dos, con buen contraste tanto
contra el navy oscuro del sidebar como el de la cabecera del login.

## 7.30 Campos "Fiscalía que conoce" y "Nombre del Fiscal"

Dos campos nuevos en `audiencias` (`fiscalia` y `nombre_fiscal`, ambos `text`), con tres formas de
llenarlos:

1. **A mano**, en `audiencia.html` — dos campos nuevos en "Datos del proceso", justo debajo de
   Despacho: "Fiscalía que conoce" (`#fiscalia`) y "Nombre del Fiscal" (`#nombreFiscal`).
2. **Clic en "Fiscalía" en la consulta de la Rama Judicial** (el modal de `index.html`, tabla
   "Sujetos procesales"): igual que el clic existente en "Demandado" (que llena Nombre del
   procesado), ahora el tipo "Fiscalía" también aparece resaltado y clickeable — lleva ese nombre a
   `nombre_fiscal` de la audiencia (`usarFiscalRama()`, nueva función en `index.html`, mismo patrón
   que `usarDemandadosRama()`: confirmación → `update` directo a la base → refresco de la tarjeta).
   `esTipoFiscalia()` (nueva, en `supabase-client.js`) hace el match por `tipo.toLowerCase().includes("fiscal")`.
3. **"Buscar en Consolidado"** (`audiencia.html`): la Fiscalía que conoce del proceso no tiene
   columna propia en el Consolidado — viene mezclada dentro de `OBSERVACIONES`, como uno de sus
   segmentos separados por `;` (ej. `"ACTIVO; FISCALIA 175 SECCIONAL"` o `"ACTIVO; FISCALIA GENERAL
   DE LA NACION; 01/09/2026 AUDIENCIA..."` — confirmado abriendo el Consolidado real y revisando
   decenas de casos). `extraerFiscaliaDeObservaciones()` separa por `;` y toma el primer segmento que
   empieza con la palabra "FISCALIA", tal cual (con esa palabra incluida). Si ningún segmento
   califica, queda vacío.

**En la tarjeta de `index.html`**: "Fiscalía que conoce" se muestra justo debajo de Juzgado (en
azul, `--blue`, para diferenciarla del despacho en verde y del apoderado titular en violeta), y
"Nombre del Fiscal" justo debajo de esa, en gris pequeño — mismo patrón visual de "dato destacado +
dato secundario pegado abajo" que ya se usaba para Despacho/Correo del juzgado. Solo se muestran si
tienen valor.

**Migración de base de datos**: el acceso a Supabase por MCP se desconectó a mitad de esta sesión
(el conector de la cuenta seguía "Conectado" en claude.ai, pero esta sesión de Claude Code había
perdido la conexión activa — se resolvió reiniciando VSCode/la extensión, sin necesitar tocar nada
en `/mcp`, que es para servidores MCP locales, no para conectores de cuenta). Una vez recuperado el
acceso, se aplicó la migración `agregar_fiscalia_y_nombre_fiscal_a_audiencias`: `ALTER TABLE
audiencias ADD COLUMN fiscalia text, ADD COLUMN nombre_fiscal text;` + `DROP VIEW` / `CREATE VIEW
audiencias_estado WITH (security_invoker = true)` agregando `a.fiscalia` y `a.nombre_fiscal` justo
después de `a.despacho` en el `SELECT`. Verificado con `get_advisors` (solo queda el aviso
preexistente de "Leaked Password Protection") y con una consulta directa a `audiencias_estado` que
confirma que las dos columnas nuevas ya están expuestas (en `null` para las audiencias existentes,
como corresponde).

Verificado también con datos simulados (shim de Supabase + una fila real del Consolidado.xlsx
recreada con los mismos patrones de `OBSERVACIONES`): el parser acierta con "FISCALIA 175 SECCIONAL"
(al final), "FISCALIA GENERAL DE LA NACION" (en medio, con más segmentos después) y "FISCALIA 03
SECCIONAL" (en medio de una observación larga), y correctamente NO toma segmentos donde "FISCALIA"
no está al inicio (ej. "SIN FISCALIA ASIGNADA TODAVIA"); `procesarConsolidado()` y
`elegirRegistroConsolidado()` de punta a punta; la tarjeta de `index.html` mostrando ambos campos en
el lugar correcto; y el clic en "Fiscalía" de la tabla de sujetos actualizando `nombre_fiscal` en la
base (simulada) y refrescando la tarjeta sin recargar la página.

## 7.31 "Generar Poder" ahora usa la plantilla oficial (logo y pie de página reales)

El usuario aportó `Plantilla_Poder.docx` — el formato real de Poder de la DIAN, en Word, con el
logo de la entidad en el encabezado y el pie de página oficial ("Información Pública Clasificada",
dirección, teléfono, web) ya diseñados — y pidió que "Generar Poder" los aprovechara en vez de
seguir generando un documento en blanco.

**Cómo está armada la plantilla** (se abrió como ZIP para inspeccionarla, ya que un .docx es un ZIP
con XML adentro): el `<w:body>` de `word/document.xml` está prácticamente vacío (un único párrafo en
blanco) — todo el diseño vive en `word/header1.xml` (el logo, `word/media/image1.png`, posicionado
con un desplazamiento absoluto) y en tres pies de página distintos: `footer3.xml` (primera página —
corto, solo "Información Pública Clasificada") y `footer2.xml` (páginas siguientes — el bloque
completo de dirección/teléfono/web), con `footer1.xml` para páginas pares si se activara esa opción.
El `<w:sectPr>` al final del body es el que conecta todo eso (`headerReference`/`footerReference`) y
define los márgenes.

**La solución no reconstruye ese diseño a mano** (habría sido frágil y con riesgo de verse distinto
al original) — en vez de eso, **inyecta el cuerpo generado dentro de la plantilla**:
1. El texto del Poder se sigue armando exactamente igual que antes, con `docx.js`
   (`construirYDescargarPoder`, sin cambios) — todo con formato directo (Arial 12, justificado,
   fijado en cada párrafo/run), sin depender de estilos con nombre. Esto importaba mucho: se
   comprobó inspeccionando el XML que genera `docx.js` que nunca usa `<w:pStyle>` ni `<w:tblStyle>`,
   así que el cuerpo generado es válido sin importar de qué documento venga ni qué `styles.xml` lo
   reciba.
2. Ese documento se convierte a `.docx` con `Packer.toBlob()`, se abre como ZIP con **JSZip**
   (nueva dependencia, cargada desde cdnjs igual que en `carga-masiva.html`) y se extrae el `<w:body>`
   completo (los párrafos y la tabla) con una expresión regular, cortando justo antes del
   `<w:sectPr>` de ese documento (que se descarta).
3. Se descarga `assets/Plantilla_Poder.docx` (copiada tal cual al repo) con `fetch()`, se abre
   también con JSZip, y se reemplaza el `<w:body>` casi vacío de la plantilla por el cuerpo extraído
   en el paso anterior — **conservando intacto el `<w:sectPr>` de la plantilla**, que es el que trae
   las referencias al logo y a los pies de página.
4. El ZIP resultante (`generateAsync`) es el `.docx` final que se descarga — con el logo, los 3 pies
   de página y los márgenes originales de la plantilla, y el texto de la audiencia insertado donde
   antes había un párrafo en blanco.

**Con respaldo si la plantilla falla**: si `fetch("assets/Plantilla_Poder.docx")` no responde (sin
conexión, archivo movido, etc.) o el ZIP no tiene la estructura esperada, se atrapa el error y se
cae al documento en blanco de siempre (`Packer.toBlob(doc)` directo) — para que el botón nunca deje
de funcionar del todo, aunque sea sin el membrete.

Verificado con el mismo shim de `abogados`/`directoras_asignadas` de la sección 7.26, abriendo el
`.docx` final con JSZip: contiene `word/media/image1.png` (el logo), `word/header1.xml`,
`word/footer1.xml`/`footer2.xml`/`footer3.xml`, y esos pies de página siguen con el texto original
("Información Pública Clasificada", "Dirección Seccional de Impuestos de Medellín…"); el
`<w:sectPr>` final sigue con las referencias `headerReference`/`footerReference` de la plantilla; y
el texto del cuerpo (extraído y revisado línea por línea) es idéntico al que ya se verificaba antes
de este cambio — encabezado, tabla ASUNTO/DENUNCIANTE/DENUNCIADO/PRESUNTO DELITO/SPOA, párrafo del
poderdante, facultades, cierre y firma. El archivo final pesa ~174 KB (vs. ~10 KB del documento en
blanco), consistente con traer el logo y el XML de header/footer de la plantilla.

## 7.32 Ajuste de tamaños de fuente en el Poder (11 general, 10 en el cuadro)

A pedido del usuario: el texto general del Poder bajó de 12 a **11** (`TAMANO = 22` en half-points),
y el cuadro ASUNTO/DENUNCIANTE/DENUNCIADO/ENTE JURÍDICO/PRESUNTO DELITO/SPOA quedó en **10**
(`TAMANO_TABLA = 20`, nueva constante) — ambos en `construirYDescargarPoder()`. Igual que con el
tamaño anterior, se fija tanto en `styles.default.document.run` como explícito en cada
`TextRun`/celda, para que no dependa de los defaults del documento.

Verificado abriendo el `.docx` final (ya con la plantilla, sección 7.31) con JSZip: se contaron los
`<w:sz>`/`<w:szCs>` de todo `word/document.xml` — 32 apariciones en tamaño 11 (el cuerpo) y 20 en
tamaño 10 (el cuadro), cero rastros del tamaño 12 anterior. (Una comprobación aparte, sobre
`styles.xml`, dio un falso "FAIL" porque con la plantilla ese archivo ahora viene de
`Plantilla_Poder.docx`, no del documento generado — pero como cada párrafo y celda ya trae su
tamaño fijado en línea, el resultado visual no depende de ese archivo en absoluto.)

## 7.33 Firma del abogado: cargar imagen, guardarla en la app, e insertarla en el Poder

El campo `abogados.ruta_firma` ya existía (sección 7.10, catálogo de Abogados), pero era un simple
campo de texto donde había que escribir a mano una ruta o enlace — no funcional para el caso real de
uso. Se reemplazó por un flujo completo de carga de archivo.

**Almacenamiento — Supabase Storage, no la tabla**: se creó un bucket privado `firmas` (migración
`crear_bucket_firmas`), con 4 políticas RLS sobre `storage.objects` (select/insert/update/delete,
`to authenticated`, mismo criterio de acceso total del equipo que el resto de la app). `ruta_firma`
sigue siendo texto, pero ahora guarda la **ruta del objeto dentro del bucket** (`"<abogados.id>.<extensión>"`,
ej. `"3f9a1b2c-....jpg"`), no una ruta del disco de quien la carga — así la imagen queda copiada
dentro de la aplicación y disponible para cualquiera del equipo, sin depender de dónde estaba el
archivo originalmente.

**En `catalogos.html`** (editar un abogado — la sección de firma solo aparece editando uno ya
guardado, no al crear uno nuevo, porque la ruta necesita el `id` del abogado, que recién existe
después del primer guardado):
- Muestra "Sin firma registrada." o una vista previa de la firma actual (descargada del bucket con
  `storage.from("firmas").download()` y mostrada con `URL.createObjectURL`).
- Botón "Cargar firma" → `<input type="file" accept="image/*">` oculto. Valida que sea una imagen y
  que pese ≤5 MB. Si el abogado ya tenía una firma con otra extensión, borra el archivo viejo del
  bucket antes de subir el nuevo (para no dejarlo huérfano — con la misma extensión, `upsert:true`
  ya la reemplaza sin este paso).
- Botón "Quitar firma" (solo visible si hay una cargada) → confirmación → borra del bucket y limpia
  `ruta_firma`.
- Todo esto se guarda **al toque**, no con el botón "Guardar" del formulario (que ya no toca
  `ruta_firma` en absoluto) — mismo criterio que otros campos de efecto inmediato en la app (ej.
  hora de fin de audiencia en `index.html`).

**En "Generar Poder" (`index.html`)**: si el abogado (titular o el que reemplaza, según elección de
la audiencia) tiene `ruta_firma`, se descarga la imagen, se mide su tamaño real (con `Image()`/`onload`
— **no** `createImageBitmap()`, que en las pruebas con Chrome headless se quedaba colgado sin
resolver nunca; con imagen real en un navegador normal ambas funcionan, pero `Image()` es la opción
más compatible y la que se pudo probar de punta a punta) y se escala a un ancho fijo (170px) con un
alto proporcional, topado en 60px para que una firma casi cuadrada no quede desproporcionada. Se
inserta como `ImageRun` en un párrafo propio, **entre "ACEPTO:" y el nombre del abogado** en el
bloque de firma. Si no hay `ruta_firma`, o falla la descarga por cualquier motivo, la función
devuelve `null` y el Poder se genera igual, solo con el nombre — como pasaba antes de esta función.

**El detalle más delicado — no chocar con los IDs de relación de la plantilla**: `insertarEnPlantillaPoder()`
(sección 7.31) ya insertaba el cuerpo generado por `docx.js` dentro de `Plantilla_Poder.docx`; con
una imagen de por medio, ahora también hay que traer su relación (`word/_rels/document.xml.rels`),
el archivo de `word/media/` y declarar su extensión en `[Content_Types].xml`. El cuerpo generado por
`docx.js` numera sus relaciones desde `rId1`, pero la plantilla ya trae sus propias relaciones hasta
`rId14` (logo, 3 pies de página, estilos, tema, etc.) — insertar la imagen con su id original
(típicamente `rId7`) habría creado un `Id` duplicado en la plantilla y roto el documento. La función
ahora calcula el primer id libre de la plantilla (`rId15` en la práctica) y reemplaza la referencia
(`r:embed="rId7"` → `r:embed="rId15"`) dentro del fragmento de cuerpo antes de insertarlo.

Verificado con la firma real de Carlos Echeverry (`C:\DIAN\Firmas\1039453875.jpg`, aportada por el
usuario como ejemplo) en ambos flujos: (a) `catalogos.html` — cargar, ver la vista previa, reemplazar
por una con otra extensión (confirmando que se borra la vieja del bucket), y quitar la firma,
comprobando el estado en memoria y en el bucket simulado en cada paso; (b) "Generar Poder" — un
abogado con firma y otro sin firma, abriendo el `.docx` final con JSZip: 15 ids de relación, todos
únicos (sin choques); la imagen del logo de la plantilla y la de la firma conviven en `word/media/`;
el `<w:drawing>` de la firma aparece exactamente entre "ACEPTO:" y el nombre; y el caso sin firma no
agrega ninguna imagen ni relación de más, quedando byte a byte igual que antes de este cambio.

## 7.34 Bug real: Word marcaba como dañado el Poder con firma (docPr id duplicado)

El usuario reportó que Word, al abrir un Poder generado con firma, mostraba "no se puede abrir...
existe un problema con el contenido" (HRESULT 0x80004005, ubicación reportada: `word/footer3.xml`),
aunque al aceptar "recuperar el contenido" el documento se veía bien, firma incluida.

**Investigación** (sin tener Word a mano, se validó con herramientas equivalentes): se probó primero
la hipótesis de que la plantilla tuviera texto corrupto en sus pies de página — resultó ser una falsa
alarma, un artefacto de cómo mi propia terminal mostraba tildes ("ó"/"ú" aparecían como "�" al
imprimirlas, pero los bytes UTF-8 subyacentes eran correctos; confirmado decodificando
`word/footer3.xml` con Python sin ningún error). Un *round-trip* de JSZip (cargar la plantilla y
volver a generarla sin tocar nada) reprodujo cada archivo byte a byte idéntico, descartando también
un problema del propio JSZip.

**Causa real**: `<wp:docPr id="N">` — el identificador de cada dibujo/imagen insertada — tiene que
ser único en **todo el paquete del documento**, no solo dentro de `word/document.xml`. La plantilla
ya usa esos ids en sus propios dibujos: `header1.xml` (el logo) tiene `id="1"`, `footer3.xml` tiene
`id="2"`, `footer1.xml` tiene `id="3"`, `footer2.xml` tiene `id="4"`. `docx.js`, al armar el
documento con la firma desde cero, no tiene forma de saberlo y siempre empieza a numerar sus propios
`docPr` en `id="1"` — el mismo que ya usa el logo del encabezado. Ese choque es justamente lo que
hace que Word marque el documento como dañado (por eso el problema apareció recién con la firma,
sección 7.33 — un Poder sin imagen no tiene ningún `docPr` en el cuerpo y no puede chocar con nada).

**Corrección**: `insertarEnPlantillaPoder()` ahora también escanea los `docPr id` que ya usan
`header1.xml` y `footer1/2/3.xml` de la plantilla, y reasigna el `docPr id` de la firma al primer
valor libre (`5` en la práctica, ya que la plantilla llega hasta `4`) antes de insertar el cuerpo —
mismo patrón que ya se usaba para el id de relación de la imagen (`rId`).

Verificado con tres niveles de validación (sin tener Word disponible en el entorno): (a) revisión
manual de `docPr id` en las 5 partes relevantes del `.docx` final — 5 valores, todos únicos; (b) las
comprobaciones ya existentes (ids de relación, `[Content_Types].xml`, XML bien formado en las 32
partes del paquete) siguen pasando; (c) **`python-docx` — una librería que implementa el mismo
modelo OOXML que usa Word internamente, más estricta que un parser XML genérico — abrió el archivo
final sin lanzar ninguna excepción**, confirmando estructura, secciones, encabezado, pie de página
por defecto y de primera página, y el párrafo de la imagen exactamente donde debía estar (justo
después de "ACEPTO:").

## 7.35 "Generar Poder" en PDF, además de Word

El modal "Generar Poder" tiene ahora un selector de formato (Word / PDF, "Word" por defecto —
se resetea a esa opción cada vez que se abre el modal, para no quedar "pegado" en PDF de una vez
anterior). Se decidió con el usuario entre dos caminos posibles (armar el PDF aparte con una
librería, o convertir el .docx ya armado con un servicio externo) — se eligió **armarlo aparte**,
para no depender de ningún servicio de conversión de terceros.

**Librería**: `jsPDF` 4.2.1 + el plugin `jspdf-autotable` 5.0.8 (ambos vía cdnjs, mismo patrón que
`docx.js`/`JSZip`). El PDF **no reutiliza `Plantilla_Poder.docx`** — no hay forma liviana de convertir
un .docx a PDF dentro del navegador — así que `construirYDescargarPoderPDF()` arma el mismo
contenido (encabezado, cuadro, párrafos, firma, pie de página) de cero, en paralelo a
`construirYDescargarPoder()` (Word). Esto significa que **si el texto del Poder cambia en el futuro,
hay que actualizar las dos funciones** — es el costo aceptado de esta opción frente a la alternativa
de conversión externa.

**Fuente**: las 14 fuentes base de jsPDF (`helvetica`, etc.) no manejan bien los acentos/ñ — un
texto con "Señor" salía como "SeÃ±or" (mojibake: bytes UTF-8 reinterpretados como WinAnsi de a un
byte). La solución estándar es incrustar una fuente TrueType real. Se usa **Roboto** (Google Fonts,
licencia Apache 2.0, métricas parecidas a Arial/Helvetica) — `assets/Roboto-Regular.ttf` y
`assets/Roboto-Bold.ttf`, cargadas con `fetch()` e incrustadas vía `doc.addFileToVFS()` +
`doc.addFont()`. El logo también se reutiliza (`assets/logo_poder.png`, la misma imagen extraída de
`Plantilla_Poder.docx` para el Word).

**Detalle de depuración**: durante las pruebas, el mismo mojibake apareció incluso con Roboto ya
incrustada — resultó ser que el archivo de prueba usado para aislar el problema no tenía
`<meta charset="utf-8">` (el `index.html` real sí lo tiene desde siempre), así que el navegador
interpretaba mal los acentos ya en el HTML/JS fuente, antes de que jsPDF viera el texto. Una vez
corregido eso en la prueba, Roboto incrustada resolvió los acentos correctamente en el PDF real.

**Diseño**: texto justificado (con `align:"justify"` de jsPDF — se comprobó que una línea corta,
como "Señor (a) Juez", no se estira igual que en Word), tabla con `autoTable` (mismas 6 filas que en
Word, con la fila ENTE JURÍDICO condicional), firma insertada igual que en Word (arriba del nombre,
con las mismas dimensiones escaladas — `descargarFirmaEscalada()` quedó compartida entre ambos
formatos). Salto de página simple si el contenido no entra; pie de página en cada hoja, replicando a
mano el mismo texto que trae la plantilla de Word: corto ("Información Pública Clasificada") en la
primera página, completo (dirección/teléfono/web) en las siguientes.

Verificado con Chrome headless + `pymupdf` (renderizando el PDF final a imagen para revisión visual
real, no solo texto extraído): el logo, la fecha, el cuadro, los párrafos justificados, la firma y
los dos estilos de pie de página se ven correctamente; con la firma real de Carlos el documento
queda en 2 páginas (nombre/T.P./cargo en la página 1, "División Jurídica"/dirección/correo en la
página 2) — igual de válido que un Poder de Word de más de una página, y la plantilla ya está
pensada para eso (por algo trae pie de página distinto para la primera página). También se probó
que cambiar de formato dentro del mismo modal, y que Word sigue funcionando exactamente igual que
antes (mismos bytes que sin esta función).

## 7.36 Instalable como PWA ("Agregar a pantalla de inicio")

El usuario trajo 4 archivos generados por otra IA (Gemini) con dos propuestas distintas: (1) un
rediseño completo de la tarjeta de audiencia (HTML/CSS con clases y estructura nuevas — `.sujeto-box`,
`.fiscalia-compact`, `<details>` para novedades colapsables, iconos con emoji), y (2) los archivos
para que el sitio se pueda instalar como aplicación (PWA). Se pidió revisar y aplicar lo pertinente.

**Rediseño de la tarjeta — NO se aplicó.** Es un mockup estático, no integrado con la app real: sus
`onclick` llaman funciones con argumentos inventados (`copiarValor('id','radicado')` en vez de
`copiarValor(r.id,'radicado')`, `abrirModalRamaJudicial()` sin argumentos, etc.), no conoce las
funciones ya existentes (`celdaModalidad`, `celdaResultado`, `celdaDuracion`, `infoJuzgado`,
`correoJuzgado`, el manejo de "Reemplaza", el resultado por color de borde según `estado`...) y
reemplazarlo habría significado reescribir y volver a probar toda la lógica de la tarjeta que ya
está andando en producción, para un beneficio visual que no se pidió explícitamente. Si en el futuro
se quiere adoptar alguna idea puntual de ahí (el `<details>` para colapsar la tabla de Novedades
cuando hay muchas, por ejemplo) se puede evaluar aparte, integrándola a mano en el código real.

**PWA — sí se aplicó**, adaptando los 4 archivos sugeridos al proyecto real (nombres, colores, rutas
de los 6 HTML existentes en vez de uno solo) y agregando algunas piezas que el ejemplo no traía:

- **`manifest.json`** (nuevo, raíz del proyecto): nombre, colores (`background_color`/`theme_color`
  tomados de las variables reales de la app — `--paper` y `--navy-900`), `start_url`/`scope`
  relativos (`./index.html` / `./`) para que funcionen igual sin importar la subruta de GitHub
  Pages, y dos íconos reales.
- **Íconos PWA** (`assets/icon-192.png`, `assets/icon-512.png`): generados a partir del logo ya
  existente de la app (`assets/logo_control_audiencias.png`, 300×300) escalado con Pillow — no hacía
  falta pedir un logo nuevo.
- **`sw.js`** (nuevo, raíz): Service Worker mínimo, igual al sugerido — un `fetch` listener vacío,
  que es lo único que exige el navegador para considerar el sitio instalable. A propósito NO cachea
  nada: toda la app depende de datos en vivo de Supabase, y cachear de más arriesgaría mostrar
  información desactualizada sin haberlo pedido. Si más adelante se quiere soporte real sin
  conexión, hay que diseñarlo aparte (qué cachear, cuándo invalidar).
- **En el `<head>` de las 6 páginas** (no solo `index.html`, ya que el sitio es multi-página):
  `<link rel="manifest">`, el registro del Service Worker, **y además** `<meta name="theme-color">`
  y las etiquetas `apple-mobile-web-app-*` + `apple-touch-icon` que el ejemplo no incluía — sin
  esas, "Agregar a pantalla de inicio" desde Safari/iOS no se ve tan bien (Safari no lee
  `manifest.json` de la misma forma que Chrome/Android).

Verificado con Chrome headless: el `<link rel="manifest">` está presente y `manifest.json` carga con
código 200 y JSON válido; ambos íconos cargan con 200; `navigator.serviceWorker.getRegistration()`
confirma que el Service Worker quedó registrado y activo; y el resto de la página (datos, tarjetas,
sidebar) sigue funcionando exactamente igual que antes — la PWA es un agregado, no toca nada de la
lógica existente.

## 7.37 Revisión en celular: cabecera que se salía de pantalla, elipsis rota y acordeón de Novedades

El usuario mandó una foto real de la app abierta en un Android y pidió ver qué mejorar, más un
pedido puntual: que `audiencia-card-novedades` (la mini-tabla de novedades dentro de cada tarjeta)
quede oculta hasta hacer clic en una flecha, estilo acordeón, tanto en PC como en celular.

**Metodología de prueba en móvil (nueva, queda para el futuro).** Chrome headless en este entorno
tiene un ancho mínimo de ventana de facto de ~500px CSS — pedirle `--window-size=380,900` no da un
viewport de 380px real, lo redondea a 500. La forma de probar un ancho angosto genuino es meter la
página dentro de un `<iframe style="width:380px">`: un iframe define su propio viewport
independiente del mínimo de la ventana externa, así que `iframe.contentWindow.innerWidth` sí queda
en 380 de verdad. Con eso se armó un arnés de diagnóstico que camina el DOM dentro del iframe,
mide `getBoundingClientRect()` de cada elemento y reporta cuáles se salen del viewport — hay que
tener cuidado con los falsos positivos: un elemento con `overflow-x:auto`/`hidden` en sí mismo (o en
un padre) puede reportar un ancho "natural" mayor al viewport sin que eso implique que la página
realmente se desborda; lo que hay que medir es el contenedor que de verdad recorta/scrollea, no el
hijo sin recortar.

**Bug 1 — cabecera con 5 botones forzaba scroll horizontal de toda la página.** La fila
`+ Crear Audiencia` / Tabla-Tarjetas / Exportar a Excel / Columnas / Actualizar usa la clase `.row`
(`display:flex; gap:10px`, sin `flex-wrap`) con un `style` en línea. En vez de tocar `.row` en
general (se reutiliza en más partes de la app, y otros usos sí caben en una sola fila), se agregó
`flex-wrap:wrap` solo en el `style` en línea de esa fila puntual (`index.html`, cabecera de
`.card-head`). Con eso los botones envuelven en dos/tres líneas en vez de desbordar.

**Bug 2 — el despacho/fiscalía/observaciones se cortaban a media palabra, sin "…".** Con el bug 1
ya resuelto seguía pasando (confirmado con el arnés de iframe): "Juzgado 006 Penal Municipal Con F"
se cortaba en seco, aunque `.audiencia-card-despacho` sí tiene
`white-space:nowrap; overflow:hidden; text-overflow:ellipsis`. La causa real: todo despacho,
fiscalía y observaciones pasa por `copyText()`, que envuelve el texto en
`<span class="copyable">` (para el clic-para-copiar), y `.copyable` es `display:inline-block`. Un
`inline-block` es una caja atómica — cuando se desborda el contenedor con elipsis, la mayoría de
los navegadores la recortan en seco en el borde de la caja en vez de aplicarle el "…", porque el
algoritmo de `text-overflow` solo fragmenta texto normal, no cajas atómicas completas. Esto no pasa
con el mismo `copyText(..., {truncate:true})` que usan la tabla y algunos otros campos, porque ahí
el propio `.truncate` (con su `max-width` fijo) queda en el mismo elemento que hace el recorte —
distinto del caso roto, donde el que trunca es el contenedor *padre* y el hijo copyable es la caja
atómica que lo boicotea.

Arreglo (`assets/style.css`): dentro de los contenedores que sí dependen del padre para truncar
(`.audiencia-card-despacho`, `.audiencia-card-fiscalia`, `.audiencia-card-nombre-fiscal`, y
cualquier `div.truncate` que envuelve un `.copyable` en vez de llevarlo en el mismo elemento), el
`.copyable` hijo pasa a `display:inline` (no atómico) con margin/padding en 0 en vez del
`margin:-3px -5px; padding:3px 5px` pensado para verse como una "píldora" al pasar el mouse. Con el
texto como inline normal, el elipsis del padre sí se aplica letra por letra. No se tocó el
`.copyable` por defecto (sigue `inline-block` en la tabla y demás usos, donde no hay ningún
problema) — el cambio queda acotado a los 4 selectores nuevos.

**Pedido explícito — acordeón para Novedades.** `celdaNovedades()` (`index.html`) pasó de un
`<div class="audiencia-card-novedades">` siempre visible a un `<details class="audiencia-card-novedades">`
con el encabezado como `<summary>`: oculto por defecto, se abre con clic en cualquier parte del
encabezado (o con teclado, gratis por ser HTML nativo — no se usó Bootstrap, que este proyecto no
tiene). El ícono de flecha (nuevo `ICONOS.chevron` en `supabase-client.js`) gira 90° vía CSS cuando
`[open]`. El label ahora también muestra la cantidad ("Novedades (2)") para que se note que hay algo
adentro sin necesidad de abrirlo.

El botón "+ Agregar novedad" vive dentro del `<summary>` (para quedar en la misma fila que el
título), así que su `onclick` empieza con `event.preventDefault(); event.stopPropagation();` antes
de llamar a `abrirModalNovedad(...)` — si no, el clic también dispara el toggle nativo del
`<details>` (documentado así por el propio comportamiento de `<summary>`).

`renderTabla()` reconstruye el `innerHTML` completo de las tarjetas cada vez que se agrega, edita o
elimina una novedad (`await cargarNovedades(); renderTabla();`), lo que borraría el estado `open` de
cualquier `<details>` en cada refresco. Para que el acordeón no se vuelva a cerrar solo, se agregó
`novedadesAbiertas` (un `Set` con los ids de audiencia cuyo acordeón está abierto), que se
actualiza con el evento nativo `ontoggle` del `<details>` y se consulta al renderizar
(`${abierta ? "open" : ""}`). Además, `guardarNovedad()` agrega el id al set justo antes de cerrar
el modal, para que una novedad recién agregada/editada aparezca abierta de una vez en vez de
sentirse "perdida" detrás del acordeón cerrado.

Por las dudas de que la mini-tabla, ya abierta en una tarjeta angosta, fuera a reproducir el mismo
tipo de desborde de página que el bug 2 (la tabla tiene columnas con texto libre, como la
observación de la novedad), se envolvió en un `<div style="overflow-x:auto; max-width:100%;">`
propio — así, si algún dato puntual necesita más ancho del que da la tarjeta, scrollea sola sin
arrastrar el resto de la página.

Verificado con el arnés de iframe (380px): sin abrir el acordeón, `documentElement.scrollWidth`
quedó en 380 (antes: 410, 30px de desborde). Con el acordeón abierto, 365. Se armó además un test
específico (clic simulado) que confirma, en orden: el `<details>` empieza cerrado; un clic en
"+ Agregar novedad" NO lo abre (y sí abre el modal); un clic en el encabezado sí lo abre; la tabla
queda visible y su contenedor no se sale de la tarjeta; y tras forzar un `renderTabla()` completo
(simulando guardar/editar/eliminar una novedad) sigue abierto.

## 7.38 Filtro de Período como lista desplegable + Filtro de Estado reemplazado por Resultado

Dos cambios en la fila de filtros de `index.html`:

**Período: de chips a `<select>`.** El grupo de 7 botones (`#periodoToggle`, `.chip`/`.chip-group`,
agregado en 7.13 con scroll horizontal para que no se rompiera en varias líneas en móvil — ver
7.37) se reemplazó por un `<select id="fPeriodo">` con las mismas 7 opciones más un placeholder
("Selecciona…") para el estado inicial sin período activo. Al elegir una opción se dispara
`aplicarPeriodo(clave)` igual que antes (llena Desde/Hasta según `RANGOS_PERIODO`), solo que ya no
existe el manejo de `aria-pressed` por botón — el propio `<select>` es la única fuente de verdad del
período activo. `limpiarPeriodoActivo()` ahora simplemente vacía el `<select>` en vez de desmarcar
botones, y se llama igual que antes desde "Limpiar filtros" y al tocar Desde/Hasta a mano. Con esto
desaparecen `#periodoToggle`, `.chip`, `.chip-group` (CSS y HTML) — quedan sin ningún otro uso en el
proyecto, así que se borraron en vez de dejarlos como código muerto.

**Estado → Resultado.** El filtro `<select id="fEstado">` (poblado dinámicamente solo con los
`estado` presentes en las filas ya filtradas, vía `actualizarOpcionesEstado()`) se reemplazó por
`<select id="fResultado">`, poblado una sola vez al iniciar con el catálogo `resultados_audiencia`
(el mismo `resultadosCatalogo` que ya se usaba para el selector de Resultado dentro de cada
tarjeta — ver 7.20) en vez de una lista fija de nombres. El filtro compara directamente contra
`resultado_audiencia_id` (la llave foránea real) en lugar del texto de `estado`, que es un campo
calculado que mezcla el estado por fecha ("Audiencia hoy", "Esta semana"...) con el nombre del
resultado una vez que la audiencia ya se resolvió — filtrar por el id evita ese cruce de dos
conceptos distintos en un solo campo. `ORDEN_ESTADOS` y `actualizarOpcionesEstado()` se eliminaron
por quedar sin uso; el campo `estado` en sí (y sus insignias/bordes de color en la tabla y las
tarjetas) no se tocó, sigue exactamente igual.

`llenarSelectFiltro()` (compartida con el filtro de Abogado titular) se generalizó para aceptar,
además de strings simples (valor = texto, como los nombres de abogado), objetos `{value, texto}`
para los casos donde el valor guardado no es el mismo texto mostrado — como acá, donde el valor es
el id del resultado y el texto su nombre.

Verificado con un arnés de iframe con dos audiencias de prueba (una futura sin resultado, otra
pasada con `resultado_audiencia_id` asignado): el `<select>` de Período trae las 7 opciones
esperadas y "Todos" limpia Desde/Hasta mostrando ambas audiencias; el `<select>` de Resultado trae
las opciones del catálogo (incluida una agregada de prueba) y, al elegir una, deja ver solo la
audiencia con ese resultado guardado; "Limpiar filtros" vacía ambos selects; y ya no quedan en el
DOM ni `#periodoToggle` ni `#fEstado`.

**Ajuste posterior (mismo día): faltaba filtrar las audiencias sin resultado, y filtrar por
Resultado no servía de nada si Período no estaba en "Todos".** Dos huecos que el usuario encontró
probando:

1. El `<select>` de Resultado solo traía las opciones del catálogo — no había forma de pedir
   "audiencias sin resultado guardado" (`resultado_audiencia_id` nulo, la mayoría mientras el
   proceso sigue activo). Se agregó una opción fija `(Sin resultado)` con un valor especial
   (`SIN_RESULTADO = "__sin_resultado__"`, no puede ser `""` porque ese valor ya significa "Todos",
   y no choca con ningún id real del catálogo por ser estos UUID). El filtro en `renderTabla()`
   ahora distingue tres casos: `""` (todos), `SIN_RESULTADO` (`resultado_audiencia_id` falsy) y
   cualquier otro valor (debe coincidir exactamente con ese id).
2. Elegir un Resultado no mostraba nada si Período seguía en su estado por defecto ("de hoy en
   adelante"), porque casi cualquier audiencia con resultado guardado ya pasó. Igual que ya hacía
   Buscar (ver 7.14), el `<select>` de Resultado ahora fuerza Período a "Todos"
   (`aplicarPeriodo("todos")`) apenas se elige cualquier opción distinta de "Todos" — incluida
   `(Sin resultado)` —, y al volver a "Todos" en Resultado el período elegido se deja como está (no
   se resetea solo).

## 7.39 "Duplicar audiencia": reprogramación/aplazamiento con trazabilidad completa

Pedido: un botón "Duplicar audiencia" al lado de "Editar audiencia" que cree una audiencia nueva
copiando todos los datos y novedades de la original, salvo fecha y hora (que quedan vacías y son
obligatorias para guardar la nueva); la original debe quedar intacta, y la nueva debe quedar
vinculada a ella como aplazamiento/reprogramación, conservando ambas en el histórico.

**Cambio de esquema (Supabase, vía MCP — no hay carpeta de migraciones en este repo, así que queda
documentado acá, como ya es la convención del proyecto para cambios de base de datos):**
- `ALTER TABLE audiencias ADD COLUMN audiencia_anterior_id uuid REFERENCES audiencias(id) ON DELETE
  SET NULL` + índice. Es el vínculo de trazabilidad: la audiencia nueva apunta a la original de la
  que se duplicó. `ON DELETE SET NULL` para que borrar la original (si alguna vez se hace) no rompa
  la nueva, solo le quite el vínculo hacia atrás.
- La vista `audiencias_estado` (la que consume `index.html`) se recreó agregando
  `a.audiencia_anterior_id` al final del `SELECT` (un `CREATE OR REPLACE VIEW` no permite reordenar
  ni renombrar columnas ya existentes, solo agregar al final). No se agregó ningún JOIN nuevo para
  traer los datos de la audiencia vinculada: como `index.html` ya carga TODAS las audiencias en
  memoria (`todasLasFilas`), alcanza con cruzar por id del lado del cliente — evita además el riesgo
  de que un `LEFT JOIN` uno-a-muchos duplique filas si alguna audiencia llegara a duplicarse más de
  una vez.
- De paso, el linter de seguridad de Supabase marcó `audiencias_estado` como "Security Definer View"
  (corre con los permisos de quien la creó, no de quien consulta) — probablemente heredado de cómo
  quedó definida originalmente. Se corrigió con `ALTER VIEW ... SET (security_invoker = on)`. No
  cambia qué puede ver nadie hoy (las políticas de todas las tablas involucradas ya son
  `USING (true)` para cualquier autenticado, el mismo modelo "equipo con login compartido" de todo
  el proyecto), pero es lo correcto de todas formas.

**Botón "Duplicar audiencia"** (`index.html`): ícono nuevo (`ICONOS.duplicar`, dos rectángulos
superpuestos, estilo Feather) al lado de "Editar audiencia" en la tabla y en la tarjeta — navega a
`audiencia.html?duplicar=<id>` (parámetro nuevo, distinto de `?id=<id>` que es "editar").

**`audiencia.html`** reconoce `?duplicar=<id>` (solo si no viene también `?id=`, que tiene
prioridad) y trata ese caso como una audiencia **nueva** (no una edición):
- `cargarAudiencia()` trae los datos de la ORIGINAL y los precarga todos en el formulario, salvo
  Fecha, Hora inicio, Hora fin y Resultado, que quedan vacíos a propósito — no solo por lo que pidió
  el usuario (fecha/hora vacías), sino porque Resultado y Hora fin son datos de una sesión puntual
  que ya pasó: copiarlos haría que la tarjeta de la audiencia nueva muestre, por ejemplo, el badge
  "Se realizó" antes de que la audiencia siquiera ocurra.
- El campo Hora inicio pasa a `required = true` solo en este modo (los demás campos obligatorios ya
  lo eran de antes) — la validación nativa del navegador bloquea el envío del formulario si falta,
  sin necesitar código propio; se probó explícitamente que intentar guardar con Hora vacía no crea
  nada (`checkValidity() === false`) y que completarla sí permite guardar.
- El título y el subtítulo del formulario cambian a "Duplicar audiencia" y a un aviso con el
  radicado y la fecha de la audiencia original, explicando que al guardar quedará vinculada como
  reprogramación/aplazamiento y que se copiarán también sus novedades.
- Al guardar (`guardar()` → `finalizarDuplicado()`, solo se ejecuta cuando se está duplicando y el
  insert de la audiencia nueva ya tuvo éxito):
  1. La audiencia nueva se crea con `audiencia_anterior_id` = id de la original (va directo en el
     payload del insert).
  2. Se copian las novedades de la original a la nueva (mismo texto/fecha/observación, filas nuevas
     e independientes — las de la original no se tocan ni se mueven).
  3. Se marca el Resultado de la audiencia ORIGINAL como "Reprogramación o Aplazamiento" (el id se
     resuelve por nombre contra el catálogo en `init()`, no se hardcodea el UUID) — pero solo si la
     original todavía no tenía ningún resultado guardado, para no pisar un dato que ya se hubiera
     puesto a mano por otra razón. Así, la propia audiencia original queda mostrando en su tarjeta
     que fue aplazada/reprogramada, sin necesitar una columna nueva de "tipo de vínculo": el
     catálogo de Resultado ya tenía ese valor.
  Ningún fallo de estos tres pasos deshace la audiencia nueva ya guardada (que es lo importante):
  solo se registra en consola, igual que ya hacía el patrón existente de
  `consolidadoActividadesPendiente`.

**Aviso de trazabilidad en la tarjeta** (`index.html`, `celdaVinculoAudiencia()`, nueva): como
`todasLasFilas` ya tiene todas las audiencias en memoria, no hace falta ningún dato adicional de la
vista para mostrar el vínculo en ambos sentidos — se busca ahí mismo, del lado del cliente:
- Si la audiencia tiene `audiencia_anterior_id`: pastilla ámbar "↩ Reprogramada/aplazada de la
  audiencia del `<fecha>` (ver)".
- Si otra audiencia cargada tiene `audiencia_anterior_id` apuntando a esta: pastilla ámbar
  "↪ Reprogramada/aplazada a la audiencia del `<fecha>` (ver)".
Ambas llevan un enlace "(ver)" a `audiencia.html?id=<la otra>` para saltar directo a editarla. Solo
se agregó en la vista de tarjetas (la vista de tabla es densa por columnas fijas; agregar esto ahí
habría sido un cambio de alcance mayor no pedido explícitamente).

Probado de punta a punta con un arnés propio (un shim de Supabase con estado real en memoria —
`audiencias`/`novedades` mutables, no solo datos fijos — para poder verificar inserts/updates, ver
metodología ya usada en el resto del proyecto): se confirmó que el formulario de duplicar precarga
todo menos fecha/hora/hora fin/resultado; que guardar con Hora vacía no crea nada
(`checkValidity()` en falso); que al completar y guardar se crea una fila nueva con
`audiencia_anterior_id` apuntando a la original, sin resultado y con hora fin vacía; que la
audiencia original conserva exactamente su fecha, hora y novedades propias sin ningún cambio salvo
su Resultado (pasa a "Reprogramación o Aplazamiento"); y que las 2 novedades de la original se
copian intactas a la nueva sin desaparecer de la original.

## 7.40 "Informe de Audiencia" (FT-PEC-2589): formulario + generación en Word o PDF

Pedido: implementar el Informe de Diligencia Judicial (formato oficial FT-PEC-2589, hasta ahora
diligenciado a mano en `C:\DIAN\Informe_Audiencia.xlsm`), aprovechando que la mayoría de sus datos
ya están en cada audiencia, y ofrecer generarlo en Word o PDF a elección del usuario. El PDF debe
llevar "Información Pública Clasificada" al pie, abajo a la derecha.

**Página nueva, no modal**: `informe-audiencia.html?audiencia=<id>` — a diferencia de "Generar
Poder" (un modal, porque no necesita más que elegir la Directora y el formato), el Informe tiene
~25 campos propios además de los que ya trae la audiencia, así que se justifica una página completa
con el mismo esqueleto que `audiencia.html` (sidebar, secciones con `.form-section`/`.field-grid`).
Se llega desde un ícono nuevo (`ICONOS.informe`, un clipboard con check) al lado de "Duplicar
audiencia" y "Editar audiencia", en la tabla y en la tarjeta.

**Qué se lee de la audiencia (solo lectura, no editable acá)** — evita duplicar datos que ya
existen y podrían desincronizarse: radicado, nombre/identificación del procesado, delitos,
fiscalía, despacho, ciudad, fase (= `tipo_audiencia` de la audiencia, no la lista fija "Fase" del
Excel — el pedido fue explícito en usar el dato de la audiencia), abogado a cargo (titular) y
abogado que atiende la diligencia (`abogado_reemplaza`, o el titular si no hay reemplazo — mismo
criterio que ya usa "Generar Poder"), fecha y hora programada.

**Qué es nuevo y se guarda en una tabla propia** (`informes_diligencia`, migración aplicada por
MCP, documentada acá por la misma razón que las anteriores — no hay carpeta de migraciones en este
repo): tipo de diligencia que se informa / próxima (dos selects con la lista fija de 56 opciones de
la celda B18 del Excel — hoja `APOYO!D3:D58` — hardcodeada como arreglo JS, no como catálogo de
Supabase, porque es una lista fija del formato oficial, no algo que el equipo deba poder editar
desde Catálogos), otro tipo de diligencia, se realizó (SI/NO), fecha/hora/tipo de la próxima
diligencia, todo lo de 2.1/2.2/2.3, 3.1/3.2/3.3, la sección 4 completa, anexos, y la fecha de
elaboración. `audiencia_id` es UNIQUE (un informe por audiencia — cada fila de `audiencias` ya
representa una sesión puntual, y "Duplicar audiencia" crea una fila nueva por cada reprogramación,
así que la relación real es 1 a 1). Se guarda con un botón "Guardar informe" aparte (upsert por
`audiencia_id`) y también automáticamente, en silencio, justo antes de generar el documento — así
el archivo descargado siempre coincide con lo último guardado.

**2.1 vs 2.2 se muestran u ocultan según "¿Se realizó la diligencia?"** (JS simple, sin tocar el
DOM ni perder lo ya escrito en la sección oculta — mismo patrón que ya se usó para el acordeón de
Novedades en 7.37): por defecto, antes de elegir, ninguna de las dos se muestra, igual que el Excel
no fuerza a mirar una sección que no aplica.

**Generación del documento — una sola fuente de datos para los dos formatos**: `construirFilasInforme()`
arma un arreglo de filas (título de sección | subsección | etiqueta+valor) leyendo la audiencia y el
informe ya guardados, y tanto `construirYDescargarInformeWord()` como `construirYDescargarInformePDF()`
recorren ese mismo arreglo para pintar la tabla — evita que Word y PDF puedan mostrar contenido
distinto por un descuido al mantenerlos por separado (el Poder si duplica el contenido entre Word y
PDF, pero ahí es prosa escrita a mano; acá es una tabla de campo/valor, mucho más mecánica de
compartir).

- **Word**: documento nuevo armado con `docx.js` desde cero (no hay una plantilla de Word oficial
  para este formato, a diferencia del Poder que sí la tiene) — encabezado con el logo de la DIAN
  (`assets/logo_dian.png`, extraído del propio `Informe_Audiencia.xlsm` — es la misma imagen que ya
  trae el membrete del Excel) + título + "FT-PEC-2589" en una mini-tabla sin bordes, luego la tabla
  principal (secciones en navy con texto blanco, subsecciones en dorado suave — mismos tonos de la
  marca que ya usa el resto de la app, en vez del gris liso del Excel original), pie de página con
  "Información Pública Clasificada" en cursiva.
- **PDF**: `jsPDF` + `jspdf-autotable` (ya usados para el Poder en PDF) — mismo logo arriba,
  título/código, tabla armada con filas `{content, colSpan:2, styles:{fillColor:...}}` para los
  encabezados de sección/subsección y filas normales de 2 columnas para el resto, con Roboto
  incrustado (igual que el Poder en PDF, por el mismo problema de acentos/ñ de las fuentes base de
  jsPDF). El pie "Información Pública Clasificada" se agrega abajo a la derecha en cada página con
  un `for` sobre `doc.internal.getNumberOfPages()`.

**Firma del abogado**: si el abogado que atiende la diligencia tiene firma registrada (ver 7.33), se
inserta igual que en el Poder; si no, queda la línea "Firma: _______________________". Como esto ya
lo necesitaba tanto "Generar Poder" como este Informe, `descargarFirmaEscalada()` y
`cargarImagenFirma()` se movieron de `index.html` a `assets/supabase-client.js` (compartidas, en vez
de duplicadas) — mismo criterio con `bufferABase64()`.

**Bug real encontrado y corregido de paso (afecta también al Poder en PDF, no solo al Informe):**
jsPDF trae su propio decodificador de PNG (no usa el del navegador) y es conocido por fallar con
PNG perfectamente válidos según cómo los haya comprimido el programa que los generó — se reprodujo
con un `RangeError: Invalid typed array length` al insertar una firma en PNG generada por Pillow
(los `.png` fijos de la propia app, como los logos, no lo disparan, pero una firma la puede subir
cualquier persona desde cualquier programa o escáner, así que el riesgo es real). Se corrigió
agregando `imagenComoJpegDataUrl()`: antes de pasarle la firma a `doc.addImage()`, se redibuja en un
`<canvas>` (aplanando cualquier transparencia sobre fondo blanco) y se reexporta como JPEG — que
jsPDF sí decodifica de forma confiable siempre. Al hacerlo apareció un segundo problema, esta vez
del propio navegador en este entorno de pruebas: `canvas.toBlob()` (asíncrono) nunca llamaba a su
callback con `image/jpeg` en Chrome headless con `--disable-gpu`, y `HTMLImageElement.decode()`
podía quedarse esperando para siempre con una imagen real más grande — se resolvió usando
`canvas.toDataURL()` (síncrono, sin callback que pueda no dispararse nunca) y poniéndole a
`decode()` un tope de 400ms tras el cual se sigue igual (para ese punto ya disparó `onload`, así que
los píxeles suelen estar listos de todas formas). No se pudo confirmar al 100% si el cuelgue de
`canvas.toBlob()` ocurre también en un Chrome de escritorio normal (sin `--disable-gpu`) o es
exclusivo de este entorno de pruebas headless — de cualquier forma, `toDataURL()` es la opción más
robusta y no tiene ese riesgo. Verificado insertando la firma real de ejemplo
(`C:\DIAN\Firmas\1039453875.jpg`, la misma usada para probar 7.33) en el Informe en PDF: se ve
correctamente, nítida, en su lugar.

Probado de punta a punta con un arnés con estado real en memoria (mismo patrón que 7.39): el
formulario precarga los datos de la audiencia; el toggle 2.1/2.2 oculta y muestra correctamente;
"Guardar informe" persiste todos los campos (incluyendo el guardado silencioso previo a generar);
el .docx se abre sin excepción con `python-docx` (2 tablas, 48 filas, colores de sección/subsección
correctos, logo y firma embebidos cuando corresponde); el PDF se renderizó a imagen con `pymupdf`
para confirmar visualmente el layout, los acentos (Roboto), los colores, el pie de página en ambas
páginas, y — tras el fix del bug de jsPDF — la firma real insertada correctamente.

**Ajuste posterior (mismo día): encabezado en cuadros con bordes, "Información del abogado" sin
bordes y aviso de traslado.** El usuario compartió una foto del membrete real del FT-PEC-2589
(logo + título + código, y debajo Proceso + Versión, todo en celdas con bordes visibles) pidiendo
que el encabezado quedara igual, en vez de la mini-tabla sin bordes que había antes:

- **Encabezado** (Word y PDF): ahora es una tabla de verdad con bordes — dos filas: logo | "INFORME
  DE DILIGENCIA JUDICIAL" centrado | "FT-PEC-2589" (fondo navy, texto blanco), y debajo "Proceso:
  Planeación, Estrategia y Control" (ocupando las primeras dos columnas) | "Versión 2". En el PDF se
  arma con `doc.autoTable()` en vez de `doc.text()`/`doc.addImage()` sueltos — el logo se dibuja
  centrado dentro de su celda con el hook `didDrawCell`. La tabla de "1. DATOS DEL PROCESO" empieza
  justo debajo, como tabla aparte — el propio borde entre las dos tablas ya hace de línea
  separadora, tal como se pidió.
- **"Información del abogado que rinde informe"**: se sacó del arreglo compartido de filas
  (`construirFilasInforme()`) a una función aparte, `datosAbogadoInforme()`, porque ahora se
  renderiza distinto en cada formato: en Word sigue siendo una tabla (para mantener alineadas
  etiqueta/valor) pero con `borders` en `NONE` en las 4 celdas; en PDF son `doc.text()` sueltos
  (etiqueta en negrita, valor al lado). Antes de ese bloque, una línea fina gris — `border:{top:...}`
  en el párrafo del título en Word, `doc.line()` en PDF — la separa de la sección 5 (Anexos), ya que
  al perder los bordes de tabla dejó de haber un canto visual entre ambas.
- **Aviso de traslado**: debajo de la firma (o de la línea "Firma: ___" si no hay una registrada),
  centrado y en gris (`color:"808080"` en Word, `setTextColor(128,128,128)` en PDF — se restaura a
  negro después, para no dejar el color gris pegado a nada que se dibuje a continuación), el texto
  exacto que trae el formato oficial: "NO OLVIDE QUE DE ESTE INFORME DEBERÁ CORRER TRASLADO AL JEFE
  INMEDIATO Y COPIA DEL MISMO DEBERÁ REPOSAR EN LA CARPETA (UNIDAD DOCUMENTAL) DEL PROCESO PENAL A
  CARGO DE LA DIRECCIÓN SECCIONAL O COORDINACIÓN PENAL".

Reprobado con el mismo arnés: el .docx pasó de 2 a 3 tablas (encabezado de 2 filas, cuerpo de 43 —
antes 48, menos la fila de sección y las 4 de abogado que se sacaron de ahí — e info del abogado de
4 filas sin bordes, confirmado revisando `tcBorders` con `val="none"` directamente en el XML); el
PDF se volvió a renderizar con `pymupdf` y se ve igual que la foto de referencia — encabezado en
cuadros, línea separadora antes de la info del abogado, firma real, y el aviso de traslado gris y
centrado debajo.

## 7.41 Íconos de acción de la tarjeta: al doble de tamaño y más específicos

**Tamaño.** Pedido explícito: duplicar el tamaño de los íconos de `.audiencia-card-actions` (correo,
Poder, Informe, Duplicar, Editar — la fila de acciones dentro de cada tarjeta). Se agregó una regla
CSS acotada a ese contenedor (`.audiencia-card-actions .btn-icon-edit` a 56×56px, el ícono SVG a
28×28px) en vez de tocar `.btn-icon-edit` en general, que se sigue usando sin cambios en la tabla, en
"buscar en la Rama Judicial" y en editar/eliminar novedad.

**Especificidad semántica.** El mismo día, el usuario pegó un análisis (de otra IA) sobre la
ambigüedad de estos mismos íconos en móvil, donde no hay hover para desambiguar con el `title`. De
las 5 acciones, 3 tenían alternativas concretas y de bajo riesgo; las otras 2 (correo, editar) ya
eran estándares suficientemente claros y se dejaron igual:

- **Generar Poder** (`ICONOS.documento`): el documento con líneas de texto lisas se parece a
  "archivo genérico" — se cambió la segunda línea por una firma (una curva ondulada), para que se
  lea como documento de representación legal, no como texto cualquiera.
- **Informe de audiencia** (`ICONOS.informe`): el portapapeles-con-check es, en cualquier UI, el
  ícono estándar de "tarea completada" — ambiguo para un informe judicial. Se cambió por un mazo de
  juez (gavel): un rectángulo redondeado rotado 45° como cabeza del mazo, una línea como mango, y
  una línea horizontal como mesa/base — sin superponerlo a un documento (como sugería el análisis)
  porque a 14-28px se veía sobrecargado; el mazo solo ya es suficientemente específico.
- **Duplicar audiencia** (`ICONOS.duplicar`): los dos cuadrados superpuestos son el estándar técnico
  de "copiar archivo", sin contexto de que lo que se duplica es una audiencia con fecha. Se cambió
  por el mismo ícono de calendario que ya usa "Audiencias" en el menú lateral, con un "+" en vez de
  las líneas de los ganchos — reutiliza una forma que el usuario ya reconoce en la propia app.

No se aplicaron las dos sugerencias "arquitectónicas" del análisis (botones con etiqueta de texto en
vez de solo ícono en móvil, o agrupar todo detrás de un menú de tres puntos) — son cambios de layout
mucho más grandes que un ajuste de íconos, y quedan para evaluar aparte si hace falta.

Verificado con captura de pantalla, ya con el tamaño doble de arriba: los tres íconos nuevos se leen
con claridad a 28px — el mazo en particular es reconocible como tal y no como una forma abstracta.

## 8. Pendientes / próximos pasos sugeridos

- [ ] Confirmar visualmente en el sitio (con login real) que el filtro de Estado ya
      funciona bien tras el fix de zona horaria del punto 7.
- [ ] Completar y subir las 133 filas de Carlos que quedaron pendientes por radicado
      (`carlos_echeverry_pendientes_por_radicado.xlsx`).
- [ ] Decidir si se recopila y carga el histórico de los demás abogados del equipo.
- [ ] Resolver con sistemas el bloqueo de proxy de la oficina (la red interna de la DIAN
      bloquea `supabase.co`; funciona bien fuera de esa red). Alternativa de respaldo si
      `jsdelivr.net` da problemas: mover `supabase-js` a `cdnjs.cloudflare.com` (ya se usa
      ahí para SheetJS en `carga-masiva.html`).
- [ ] Los 11 despachos de Carlos que no se pudieron normalizar — quedan como están hasta
      que alguien los revise a mano.
- [ ] Opcional: ampliar `despachos_directorio` a otros departamentos (fuente: `Juzgados.csv`).
- [ ] Opcional: activar "Leaked Password Protection" en Supabase Auth.
- [x] ~~Crear la cuenta en Resend y cargar `RESEND_API_KEY`~~ — hecho, "Enviar Recordatorio" ya
      manda correos reales (sección 7.27). La página de secretos vive dentro de "Edge Functions" en
      el panel de Supabase (`/project/_/functions/secrets`), no en "Project Settings".
- [ ] Verificar un dominio propio en Resend (subdominio de `dian.gov.co` u otro) para que
      "Enviar Recordatorio" pueda mandar a cualquier abogado, no solo al correo de la cuenta de
      Resend — y actualizar la constante `REMITENTE` en la Edge Function `enviar-recordatorio`.
- [x] ~~Aplicar la migración de "Fiscalía"/"Nombre del Fiscal" (sección 7.30)~~ — hecho, columnas
      `fiscalia`/`nombre_fiscal` agregadas a `audiencias` y expuestas en `audiencias_estado`
      (migración `agregar_fiscalia_y_nombre_fiscal_a_audiencias`).
- [ ] Opcional: si el equipo crece, pasar de login compartido a cuentas individuales
      (la estructura con `created_by`/`updated_by` ya está lista para eso).
- [ ] Opcional: recrear `README.md` con instrucciones de publicación si hace falta.
- [ ] Responsividad en móvil de la cabecera de "Audiencias programadas": los botones
      Tabla/Tarjetas, Exportar a Excel, Columnas y Actualizar se salen de la pantalla en vez
      de envolver (visto de pasada revisando `#periodoToggle` en el punto 7.13, no resuelto).

## 9. Archivos entregados hasta ahora (fuera del repo de GitHub)

- `plantilla_carga_audiencias.xlsx` — plantilla para futuras cargas masivas.
- `carlos_echeverry_pendientes_por_radicado.xlsx` — las 133 filas de Carlos por completar.

---
*Generado a partir del historial de la conversación de construcción del proyecto —
Programador de Audiencias, Unidad Penal DIAN. Última actualización: sesión donde se
agregó el botón de editar + copiar por clic en `index.html`, y se detectó (sin confirmar
ni arreglar aún) el bug de zona horaria en el filtro de Estado.*
