// Service Worker mínimo — solo existe para que el navegador considere el
// sitio "instalable" como PWA (uno de los requisitos técnicos, junto con
// manifest.json y HTTPS). No cachea nada a propósito: toda la app depende
// de datos en vivo de Supabase, así que agregar caché acá metería el riesgo
// de mostrar información vieja/desactualizada sin que se pidiera. Si más
// adelante se quiere soporte real sin conexión, esto habría que ampliarlo
// con una estrategia de caché pensada para eso (qué cachear, cuándo
// invalidar, etc. — no es este cambio).
self.addEventListener("fetch", function () {});
