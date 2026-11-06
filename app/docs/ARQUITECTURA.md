# Arquitectura tecnica de MEXA GYM

Este documento describe como esta organizado el proyecto y como debe crecer sin perder orden. La intencion es que cualquier desarrollador pueda entender el sistema rapido, ubicar responsabilidades y agregar funcionalidad sin tocar capas que no le corresponden.

La documentacion no cambia el comportamiento del sistema. Solo deja claro como esta armado y que reglas conviene seguir.

## Vision general

MEXA GYM esta separado en dos aplicaciones dentro de `app/`:

```text
app/
  backend/     API, reglas de negocio, Prisma y conexion a Supabase PostgreSQL
  frontend/    Interfaz React, rutas, vistas, stores y utilidades de UI
```

El flujo principal de datos es:

```text
Usuario en pantalla
  -> Vista o componente React
  -> Store de Zustand
  -> Cliente Axios
  -> Ruta Express
  -> Controller
  -> Service o Prisma
  -> Supabase PostgreSQL
```

Para mantener una arquitectura profesional, cada capa debe tener una responsabilidad clara:

- La vista muestra informacion y dispara acciones.
- El store coordina estado de frontend y llamadas HTTP.
- Axios centraliza la comunicacion con el backend y el token.
- La ruta define el endpoint y sus permisos.
- El controller valida entrada sencilla, responde HTTP y coordina el caso de uso.
- El service contiene reglas de negocio reutilizables.
- Prisma es la unica puerta directa a la base de datos.

## Frontend

El frontend usa React, Vite, TypeScript, Tailwind, Zustand, Axios y React Router.

### Estructura

```text
frontend/src/
  assets/        Imagenes y recursos estaticos.
  components/    Componentes reutilizables de UI.
  config/        Configuracion de Axios, apariencia y planes.
  helpers/       Funciones puras para fechas y calculos simples.
  hooks/         Hooks reutilizables por dominio.
  layouts/       Estructuras de pagina compartidas.
  router/        Rutas publicas, privadas y carga diferida.
  store/         Estado global y llamadas a API por modulo.
  types/         Tipos compartidos del frontend.
  utils/         Utilidades de exportacion, recibos, PDF y errores.
  views/         Pantallas principales del sistema.
```

### Rutas y pantallas

El router principal esta en `frontend/src/router/AppRouter.tsx`. Usa carga diferida para que cada pantalla se cargue cuando se necesita.

Rutas actuales:

| Ruta | Pantalla | Roles principales |
| --- | --- | --- |
| `/dashboard` | Dashboard | admin, recepcionista |
| `/pos` | Punto de venta | admin, recepcionista |
| `/reception` | Recepcion | admin, recepcionista |
| `/cash-closing` | Corte de caja | admin, recepcionista |
| `/history` | Historial | admin, recepcionista |
| `/inventory` | Inventario | admin, recepcionista |
| `/training` | Rutinas | admin, entrenador |
| `/config` | Configuracion | admin y superadmin por regla interna |
| `/auth` | Login | publico |

`PrivateRoute` protege rutas autenticadas y valida roles. `PublicRoute` evita que un usuario ya autenticado vuelva al login.

### Stores

Los stores de Zustand viven en `frontend/src/store/`. Cada store representa un dominio funcional y debe encargarse de:

- Guardar estado de ese modulo.
- Ejecutar llamadas HTTP al backend.
- Normalizar respuestas cuando haga falta.
- Exponer acciones simples para las vistas.

Stores actuales:

| Store | Responsabilidad |
| --- | --- |
| `auth.store.ts` | Login, sesion, token y usuario actual. |
| `client.store.ts` | Clientes, altas, renovaciones y asistencias. |
| `inventory.store.ts` | Productos, stock, venta de productos. |
| `dashboard.store.ts` | Estadisticas generales. |
| `history.store.ts` | Historial de transacciones. |
| `cashShift.store.ts` | Apertura, cierre, reporte y exportacion de cortes. |
| `config.store.ts` | Usuarios, planes, logo, apariencia y datos del gimnasio. |
| `notification.store.ts` | Historial, reintentos, revision y prueba de WhatsApp. |
| `workout.store.ts` | Rutinas, entrenadores, clientes y asignaciones. |
| `attendance.store.ts` | Consulta de asistencias. |

Regla practica: una vista no deberia conocer detalles de URL ni endpoints. Eso debe vivir en el store.

### Componentes

Los componentes reutilizables estan en `components/`.

- `components/ui/`: piezas base de interfaz, como `Header`, `Sidebar` y `ConfirmDialog`.
- `components/modals/`: modales especificos de flujo, como inscripcion y renovacion.
- `components/config/`: componentes de configuracion, por ejemplo apariencia.
- Componentes sueltos como `StatCard`, `BrandLogo` y `RecentAttendanceItem` son piezas compartidas por varias pantallas.

Regla practica: si una pieza se usa en mas de una vista, debe vivir en `components/`. Si solo pertenece a una pantalla y no complica el archivo, puede quedarse dentro de la vista.

### Hooks

Los hooks viven en `hooks/` y encapsulan comportamiento reutilizable.

- `useDarkMode`: modo oscuro y preferencia visual.
- `hooks/auth/useAuth`: acceso comodo al estado de autenticacion.
- `hooks/reception/useReceptionLogic`: flujo de recepcion, formularios y acciones de clientes.
- `hooks/history/useFilteredData`: filtrado reutilizable.

Regla practica: si una vista empieza a tener demasiada logica de estado o efectos, se debe extraer a un hook del dominio.

### Utils y helpers

- `helpers/dateHelpers.ts`: fechas, vencimientos y formatos locales.
- `helpers/getDaysLeft.ts`: estado de membresia.
- `utils/apiError.ts`: lectura consistente de errores de API.
- `utils/excelReport.ts`: reportes Excel con formato.
- `utils/receipts.ts`: recibos imprimibles.
- `utils/workoutPdf.ts`: PDF de rutinas.

Regla practica: `helpers` debe contener funciones puras pequeñas. `utils` puede contener utilidades mas completas que generen archivos, documentos o integraciones de UI.

## Backend

El backend usa Node.js, Express, TypeScript, Prisma y PostgreSQL en Supabase.

### Estructura

```text
backend/src/
  config/        Variables, Prisma, Cloudinary y Multer.
  controllers/   Casos HTTP: reciben req, llaman servicios/Prisma y responden.
  middlewares/   Autenticacion, roles, rate limit y manejo de errores.
  routes/        Endpoints Express y permisos por modulo.
  services/      Reglas de negocio reutilizables e integraciones externas.
  utils/         Validaciones, roles y utilidades tecnicas.
  index.ts       Arranque de Express, CORS, seguridad, rutas y shutdown.

backend/prisma/
  schema.prisma  Modelos, enums y relaciones.
  migrations/    Historial de cambios de base de datos.
  seed.ts        Datos iniciales.
```

### Punto de entrada

`backend/src/index.ts` se encarga de:

- Crear la aplicacion Express.
- Configurar CORS desde `ALLOWED_ORIGINS`.
- Agregar cabeceras de seguridad.
- Configurar JSON y URL encoded con limite de tamano.
- Publicar `/api/health`.
- Montar rutas por modulo.
- Probar conexion a Supabase antes de iniciar.
- Arrancar el scheduler de WhatsApp.
- Cerrar Prisma correctamente al recibir `SIGINT` o `SIGTERM`.

### Rutas

Las rutas estan separadas por modulo en `backend/src/routes/`.

| Base API | Archivo | Responsabilidad |
| --- | --- | --- |
| `/api/auth` | `auth.routes.ts` | Login, usuario actual y logout. |
| `/api/clients` | `client.routes.ts` | Clientes, asistencia y renovaciones. |
| `/api/products` | `product.routes.ts` | Productos, imagen y stock. |
| `/api/transactions` | `transaction.routes.ts` | Ventas, membresias e historial. |
| `/api/dashboard` | `dashboard.routes.ts` | Estadisticas del panel. |
| `/api/config` | `config.routes.ts` | Configuracion del gimnasio. |
| `/api/upload` | `upload.routes.ts` | Logo e imagenes de apariencia. |
| `/api/users` | `user.routes.ts` | Usuarios y roles. |
| `/api/plans` | `plan.routes.ts` | Planes de membresia. |
| `/api/attendances` | `attendance.routes.ts` | Consulta de asistencias. |
| `/api/notifications` | `notification.routes.ts` | WhatsApp, historial, reintentos y pruebas. |
| `/api/cash-shifts` | `cash-shift.routes.ts` | Apertura, cierre y reportes de caja. |
| `/api/workouts` | `workout.routes.ts` | Rutinas y asignaciones. |

Regla practica: la ruta decide acceso y URL; no debe contener reglas de negocio grandes.

### Controllers

Los controllers traducen HTTP a acciones del sistema. Deben:

- Validar parametros basicos.
- Leer `req.user` cuando aplique.
- Llamar Prisma o servicios de negocio.
- Responder con `{ success, data }` o `{ success, error }`.
- Evitar duplicar reglas complejas entre endpoints.

Controllers actuales:

- `auth.controller.ts`: autenticacion y sesion.
- `client.controller.ts`: clientes, altas, asistencia, renovacion y cola de WhatsApp.
- `product.controller.ts`: inventario e imagenes.
- `transaction.controller.ts`: transacciones e historial.
- `dashboard.controller.ts`: metricas generales.
- `config.controller.ts`: configuracion del gimnasio.
- `upload.controller.ts`: subida de archivos.
- `user.controller.ts`: administracion de usuarios.
- `plan.controller.ts`: planes.
- `attendance.controller.ts`: asistencia.
- `notification.controller.ts`: WhatsApp y notificaciones.
- `cash-shift.controller.ts`: caja.
- `workout.controller.ts`: rutinas.

### Services

Los services contienen reglas reutilizables o integraciones externas. Son el lugar correcto para logica que no debe depender directamente de Express.

| Service | Responsabilidad |
| --- | --- |
| `password.service.ts` | Hash y verificacion de contrasenas. |
| `token.service.ts` | JWT. |
| `cloudinary.service.ts` | Subida, borrado y extraccion de imagenes. |
| `audit-log.service.ts` | Registro de acciones importantes. |
| `cash-shift.service.ts` | Reportes, validaciones y exportacion de caja. |
| `whatsapp.service.ts` | Normalizacion de telefonos, cola y envio por Cloud API. |
| `membership-notification.service.ts` | Revision periodica de vencimientos. |

Regla practica: si una funcion necesita usarse desde mas de un controller, o si representa una regla del negocio, debe vivir en `services/`.

### Middlewares

| Middleware | Responsabilidad |
| --- | --- |
| `auth.middleware.ts` | Leer y validar JWT. Adjunta el usuario a `req.user`. |
| `role.middleware.ts` | Proteger endpoints por rol. Trata `superadmin` como rol administrativo. |
| `rate-limit.middleware.ts` | Limitar intentos en rutas sensibles. |
| `error.middleware.ts` | Respuesta consistente para errores no controlados. |

Regla practica: un middleware no debe saber detalles de un modulo de negocio. Debe resolver preocupaciones transversales.

### Utils

| Util | Responsabilidad |
| --- | --- |
| `validation.ts` | Sanitizacion y parseo de strings, numeros, ids, enums, emails, telefonos y passwords. |
| `roles.ts` | Reglas pequenas para roles administrativos. |
| `logger.ts` | Utilidad de logging. |

Regla practica: utils deben ser funciones puras o muy pequenas. Si empiezan a consultar base de datos o llamar APIs externas, probablemente ya son services.

## Base de datos

La base de datos esta modelada en Prisma y corre sobre Supabase PostgreSQL.

Modelos principales:

| Modelo | Proposito |
| --- | --- |
| `User` | Usuarios internos y roles. |
| `Client` | Clientes del gimnasio y membresias. |
| `Product` | Inventario. |
| `Transaction` | Ventas de membresia y productos. |
| `Attendance` | Asistencias diarias. |
| `CashShift` | Turnos/cortes de caja. |
| `Notification` | Cola e historial de WhatsApp. |
| `GymConfig` | Datos generales, logo y apariencia. |
| `Plan` | Planes de membresia. |
| `WorkoutRoutine` | Rutinas creadas por entrenadores. |
| `WorkoutAssignment` | Rutinas asignadas a clientes. |
| `AuditLog` | Registro de acciones administrativas. |

Enums relevantes:

- `Role`: `superadmin`, `admin`, `recepcionista`, `entrenador`.
- `PaymentMethod`: `Efectivo`, `Tarjeta`, `Transferencia`.
- `ClientStatus`: `ACTIVO`, `VENCIDO`, `PENDIENTE`.
- `NotificationKind`: `WELCOME`, `EXPIRY_REMINDER`, `EXPIRED`, `RENEWAL`.
- `NotificationStatus`: `PENDING`, `SENT`, `FAILED`, `SKIPPED`.
- `CashShiftStatus`: `OPEN`, `CLOSED`.
- `WorkoutAssignmentStatus`: `ACTIVE`, `COMPLETED`, `PAUSED`.

Regla practica: todo cambio de estructura en base de datos debe pasar por migracion Prisma. No conviene editar tablas manualmente salvo tareas puntuales controladas.

## Flujos importantes

### Alta de cliente

```text
Reception o modal de inscripcion
  -> useReceptionLogic / client.store
  -> POST /api/clients
  -> client.controller.createClient
  -> Prisma crea Client y Transaction
  -> enqueueWhatsAppNotification(WELCOME), si aplica
```

### Renovacion

```text
ModalRenew / client.store
  -> POST /api/clients/:id/renew
  -> client.controller.renewMembership
  -> Prisma actualiza vencimiento y crea transaccion
  -> enqueueWhatsAppNotification(RENEWAL), si aplica
```

### Recordatorios WhatsApp

```text
Scheduler al iniciar backend y cada hora
  -> scanMembershipNotifications
  -> Busca clientes con whatsappOptIn
  -> Crea notificaciones con dedupeKey
  -> processPendingWhatsAppNotifications
  -> WhatsApp Cloud API
```

Notas importantes:

- `dedupeKey` evita mandar duplicados para el mismo cliente, evento y fecha.
- Los errores quedan en `Notification.error`.
- El envio no debe bloquear el registro o renovacion del cliente.
- La prueba `hello_world` solo confirma conexion con Meta; los mensajes reales dependen de plantillas aprobadas y numero de produccion.

### Corte de caja

```text
CashClosing
  -> cashShift.store
  -> /api/cash-shifts
  -> cash-shift.controller
  -> cash-shift.service
  -> Transactions y Attendances asociadas al turno
  -> Reporte y exportacion Excel-compatible
```

### Rutinas

```text
Training
  -> workout.store
  -> /api/workouts
  -> workout.controller
  -> WorkoutRoutine / WorkoutAssignment
  -> PDF profesional desde frontend cuando aplica
```

## Reglas para seguir desarrollando

### Agregar un modulo nuevo

1. Crear modelo Prisma si necesita persistencia.
2. Crear migracion Prisma.
3. Crear controller en `backend/src/controllers`.
4. Crear service si hay reglas reutilizables o integraciones.
5. Crear route en `backend/src/routes` con permisos claros.
6. Montar route en `backend/src/index.ts`.
7. Crear store en `frontend/src/store`.
8. Crear vista en `frontend/src/views`.
9. Agregar ruta protegida en `AppRouter.tsx`.
10. Extraer componentes o hooks si la vista empieza a crecer.

### Agregar un endpoint a un modulo existente

1. Definir ruta y permisos.
2. Validar entrada en controller usando `utils/validation.ts` cuando aplique.
3. Reusar services existentes si hay reglas de negocio.
4. Responder siempre con estructura consistente.
5. Agregar accion al store correspondiente.
6. Mostrar errores con `getApiError` en frontend.

### Agregar UI

- Mantener vistas enfocadas en composicion.
- Extraer modales, tablas y tarjetas reutilizables.
- Evitar llamadas `api.get/post` directamente dentro de componentes cuando ya existe store.
- Usar textos en espanol y revisar codificacion UTF-8.
- Mantener accesos por rol coherentes con backend.

## Observaciones profesionales del estado actual

El proyecto ya tiene una base sana:

- Separacion real entre frontend y backend.
- Backend dividido por routes, controllers, services, middlewares y utils.
- Prisma como capa formal de datos.
- Stores por dominio en frontend.
- Rutas protegidas por autenticacion y roles.
- Integracion de WhatsApp desacoplada mediante cola de notificaciones.
- Corte de caja y auditoria con modelos propios.

Puntos que conviene mejorar con calma, sin hacerlo de golpe:

- Algunas vistas como `Config.tsx`, `Training.tsx` e `Inventory.tsx` concentran mucha UI y logica. A futuro conviene dividirlas en componentes internos por seccion.
- Hay textos y comentarios con problemas de codificacion en algunos archivos. Conviene normalizar todo a UTF-8 antes de entregar una version final.
- Algunos controllers contienen reglas directas con Prisma. Si crecen mas, conviene mover reglas de negocio a services del modulo.
- Los nombres historicos como `createCashShiftCsv` ya generan Excel-compatible. No urge cambiarlo porque podria tocar varias llamadas, pero conviene renombrarlo en una refactorizacion controlada.
- La documentacion de WhatsApp debe actualizarse cuando el numero pase de prueba a produccion.

## Criterio de calidad

Antes de entregar una version a cliente, conviene correr:

```bash
cd app/backend
npm run prisma:validate
npm run test
npm run build

cd ../frontend
npm run build
```

Si tambien se quiere revisar estilo:

```bash
cd app/frontend
npm run lint
```

## Seguridad y operacion

- No compartir `.env` con tokens reales.
- Rotar credenciales si se pegaron en chats, capturas o documentos.
- Mantener `JWT_SECRET` largo y privado.
- En produccion, usar token permanente de Meta para WhatsApp.
- Configurar `ALLOWED_ORIGINS` solo con dominios reales del frontend.
- El backend es el unico que debe conocer credenciales de Supabase, Cloudinary y WhatsApp.

## Resumen humano

La aplicacion ya esta construida con una separacion seria: React para la experiencia, Express para la API, Prisma para la base de datos y services para reglas mas delicadas como WhatsApp y caja. Lo mas importante para mantenerla profesional no es mover todo de lugar, sino respetar las capas cada vez que se agregue una funcion nueva.

Si una pantalla crece, se divide. Si una regla se repite, se vuelve service. Si una llamada HTTP aparece en una vista, se mueve al store. Si un cambio toca datos, pasa por Prisma. Con esas reglas, el proyecto puede seguir creciendo sin volverse dificil de mantener.
