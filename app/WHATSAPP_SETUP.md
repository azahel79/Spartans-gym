# WhatsApp automático

El sistema mantiene una cola de notificaciones y cubre estos eventos:

- `WELCOME`: al registrar un cliente.
- `EXPIRY_REMINDER`: cuando faltan 5 y 3 días, configurable.
- `EXPIRED`: al llegar o superar la fecha de vencimiento.
- `RENEWAL`: al renovar la membresía.

Los mensajes solo se preparan para clientes que aceptaron recibir WhatsApp.

## Modo demo con whatsapp-web.js

Este modo es para demostraciones comerciales mientras el cliente decide si absorberá los costos de WhatsApp Business, hosting y operación.

Usa una sesión local de WhatsApp Web. No requiere plantillas aprobadas ni método de pago de Meta, pero depende de que el backend esté encendido y de que el teléfono vinculado mantenga sesión activa.

En `backend/.env`:

```env
WHATSAPP_ENABLED="true"
WHATSAPP_PROVIDER="webjs"
WHATSAPP_WEBJS_CLIENT_ID="mexa-gym-demo"
WHATSAPP_WEBJS_HEADLESS="true"
WHATSAPP_DEFAULT_COUNTRY_CODE="52"
WHATSAPP_REMINDER_DAYS="5,3"
```

Opcionalmente puedes fijar el navegador si Puppeteer no encuentra Chrome o Edge:

```env
WHATSAPP_WEBJS_BROWSER_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
```

### Uso en la app

1. Reinicia el backend.
2. Entra a `Configuración > Notificaciones`.
3. Escanea el QR desde WhatsApp: `Dispositivos vinculados > Vincular dispositivo`.
4. Espera a que el estado diga `Conectado`.
5. Usa `Enviar prueba` o registra un cliente con consentimiento de WhatsApp.

Los mensajes de demo se envían como texto libre, por ejemplo bienvenida, renovación, recordatorio y vencimiento.

## Producción con WhatsApp Business Cloud API

Este modo se conserva para cuando el proyecto ya contemple el costo oficial de Meta y se use un número de producción.

En `backend/.env` cambia el proveedor:

```env
WHATSAPP_ENABLED="true"
WHATSAPP_PROVIDER="business"
WHATSAPP_ACCESS_TOKEN="TOKEN_PERMANENTE"
WHATSAPP_PHONE_NUMBER_ID="PHONE_NUMBER_ID"
WHATSAPP_BUSINESS_ACCOUNT_ID="WABA_ID"
WHATSAPP_GRAPH_VERSION="v25.0"
WHATSAPP_LANGUAGE_CODE="es_MX"
WHATSAPP_DEFAULT_COUNTRY_CODE="52"
WHATSAPP_REMINDER_DAYS="5,3"
WHATSAPP_TEMPLATE_WELCOME="gym_welcome_v2"
WHATSAPP_TEMPLATE_EXPIRY_REMINDER="gym_expiry_reminder_v2"
WHATSAPP_TEMPLATE_EXPIRED="gym_expired_v2"
WHATSAPP_TEMPLATE_RENEWAL="gym_renewal_v2"
```

### Plantillas esperadas

Los parámetros deben aparecer en este orden.

#### gym_welcome_v2

```text
Hola {{1}}, tu membresía {{2}} quedó activa. Vence el {{3}}.
```

#### gym_expiry_reminder_v2

```text
Hola {{1}}, tu membresía vence en {{2}} días. Fecha de vencimiento: {{3}}.
```

#### gym_expired_v2

```text
Hola {{1}}, tu membresía {{2}} venció el {{3}}. Si necesitas apoyo para renovar, podemos ayudarte.
```

#### gym_renewal_v2

```text
Hola {{1}}, tu renovación del plan {{2}} quedó registrada. Tu nueva fecha de vencimiento es {{3}}.
```

## Funcionamiento interno

- El backend revisa vencimientos al arrancar y cada hora.
- `notifications.dedupe_key` evita mensajes duplicados.
- Los fallos se guardan y se reintentan hasta cinco veces.
- Los mensajes no bloquean el registro o renovación.
- El administrador puede consultar `GET /api/notifications`.
- Puede ejecutar una revisión manual con `POST /api/notifications/scan`.
- Puede reintentar una notificación con `POST /api/notifications/:id/retry`.
- Puede consultar la sesión demo con `GET /api/notifications/whatsapp-session`.
- Puede reiniciar el QR con `POST /api/notifications/whatsapp-session/restart`.

Los teléfonos mexicanos de diez dígitos se convierten automáticamente al prefijo `52`. Para otros países, guarda el teléfono con código internacional.
