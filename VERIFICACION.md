# Verificación de la primera versión

Se verificó la API en el entorno local real de Cloudflare Workers y D1.

- Catálogo: 63 productos, 8 categorías, orden y nombres preservados.
- Áreas: Rose, Velha, Nova, Backstage, VIP y Depósito.
- Login correcto e incorrecto, validación de origen y cierre de sesión.
- Un encargado recibe exclusivamente su área y sus cierres.
- Intentar consultar o escribir en otra barra devuelve acceso denegado.
- Guardado de cero y cantidades fraccionadas, edición y recuperación.
- No se puede enviar un cierre incompleto ni modificar uno enviado.
- Solo el administrador puede reabrir y consultar el reporte general.
- La noche se puede cerrar únicamente cuando las seis áreas enviaron su conteo.
- El historial conserva el cierre de la barra y su catálogo original.
- El Worker se empaqueta correctamente para Cloudflare.

Pruebas: 5 verificaciones de catálogo y seguridad, y 1 prueba de integración que recorre el cierre de las seis áreas.

Publicación pendiente: requiere acceso autorizado a la cuenta Cloudflare del propietario. No se ha creado un sitio público ni cargado datos reales.

La adaptación móvil fue implementada con diseño adaptable, controles grandes y campos para teclado numérico. La inspección visual en un teléfono real queda pendiente de la publicación. La herramienta opcional de agente del navegador no fue validada en un navegador compatible; el conteo normal no depende de ella.
