# Domi Dom · Servidor Online (multijugador real)

Esto es la **Etapa 2**: un servidor de verdad donde varias personas en
teléfonos distintos juegan la misma mesa, con matchmaking, salas por
código, chat, billetera y leaderboard compartidos, y el estrellón que
suena en TODOS los teléfonos a la vez.

El servidor es el **árbitro**: reparte las fichas, valida los turnos y
las jugadas, y lleva el puntaje. Nadie puede hacer trampa desde el
navegador.

---

## Qué necesitas instalar (una sola vez)

**Node.js** (versión 18 o más nueva). Descárgalo de https://nodejs.org
(elige la opción "LTS"). Instálalo como cualquier programa.

Para confirmar que quedó, abre la terminal (en Windows: "Símbolo del
sistema" o "PowerShell"; en Mac: "Terminal") y escribe:

    node -v

Si te muestra un número (ej. v20.x), está listo.

---

## Probarlo en tu computadora

1. Pon esta carpeta `domidom-server` en tu escritorio.
2. Abre la terminal **dentro de esa carpeta**:
   - Windows: abre la carpeta, escribe `cmd` en la barra de dirección
     y dale Enter.
   - Mac: clic derecho en la carpeta → "Nueva terminal en la carpeta".
3. Escribe esto y espera (descarga lo que necesita):

       npm install

4. Después escribe:

       npm start

   Vas a ver: `Domi Dom servidor en http://localhost:3000`
5. Abre el navegador en `http://localhost:3000`. Crea una cuenta.
6. Para probar multijugador tú solo: abre 4 pestañas (o varias ventanas
   de incógnito), crea 4 cuentas distintas, y todas le dan a la **misma
   mesa de matchmaking**. A los ~14 segundos arranca (si faltan, entran
   bots). O usa "Crear sala", comparte el código, y entra desde el
   teléfono escribiendo `http://(IP-de-tu-PC):3000`.

Para apagarlo: en la terminal presiona `Ctrl + C`.

---

## Subirlo a internet GRATIS (para que jueguen desde cualquier lado)

Un servidor necesita estar prendido 24/7 en internet. La forma gratis
más fácil es **Render**:

1. Sube esta carpeta `domidom-server` a un repositorio en GitHub
   (crea cuenta gratis en github.com; si no sabes, pídele a Claude Code
   "súbeme esta carpeta a un repo de GitHub paso a paso").
2. Entra a https://render.com → cuenta gratis → "New +" → "Web Service".
3. Conecta tu repo de GitHub.
4. Configura:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - Plan: **Free**
5. Dale "Create Web Service". En unos minutos te da una URL pública
   tipo `https://domidom.onrender.com`. Esa URL **es tu juego online
   completo** — compártela.

(Alternativa parecida: Railway.app, mismo concepto.)

Nota del plan gratis de Render: si nadie juega por un rato, el servidor
"se duerme" y la primera visita tarda ~30s en despertar. Normal en el
plan gratis. Para que no duerma, más adelante se pasa a un plan pago
barato.

---

## Panel de administrador (regalar monedas de juego)

El juego trae un panel para que TÚ regales monedas de juego a un
jugador (por su usuario). Está protegido con una clave secreta que
solo tú defines, así nadie más puede regalar monedas.

Para activarlo, pon tu clave secreta como variable de entorno en Render:

1. En render.com entra a tu servicio `domidom`.
2. Menú lateral → **"Environment"**.
3. **"Add Environment Variable"**:
   - Key: `ADMIN_KEY`
   - Value: una clave secreta que solo tú sepas (ej: `MiClave2026!`)
4. Guarda. Render reinicia el servicio solo.
5. En el juego, abre el lobby → sección **"🛠️ Administrador"**:
   pon tu clave, el usuario destino y la cantidad → "Regalar".

Sin `ADMIN_KEY` configurada, el panel no funciona (es la seguridad).

### CUENTA DE ADMIN (recomendado — en vez de la clave)

Ahora puedes tener una **cuenta de administrador** en vez del switch
con clave. Solo esa cuenta ve y usa el panel; el servidor verifica la
identidad (más seguro).

1. Decide cuál usuario será el admin (ej: te registras como `jefe`).
2. Render → tu servicio → **"Environment"** → **"Add Environment Variable"**:
   - Key: `ADMIN_USER`
   - Value: el nombre EXACTO de ese usuario (ej: `jefe`)
3. Guarda. Render reinicia solo.
4. Entra al juego con esa cuenta: te aparece el control **Admin**
   arriba. Las demás cuentas NI lo ven. Ya no hace falta clave.

Si NO pones `ADMIN_USER`, sigue el modo viejo de clave (compatibilidad).
Lo recomendado es poner `ADMIN_USER` y olvidarte de la clave.

### VERIFICACIÓN DE CORREO (opcional — necesita servicio de email)

Mandar el código de verificación al correo necesita un servicio de
envío. Hay gratis (Resend): crea cuenta en resend.com, saca una API
key, y en Render agrega:
   - Key: `RESEND_API_KEY`  ·  Value: tu API key de Resend
   - (opcional) Key: `EMAIL_FROM` · Value: `Domi Dom <onboarding@resend.dev>`

Con eso, al registrarse se envía un código de 6 dígitos y la cuenta
no se activa hasta verificarlo. **Sin `RESEND_API_KEY`** el juego
funciona igual, guarda el correo, pero NO puede enviar el código (no
inventamos un envío que no ocurre) — las cuentas entran sin verificar.

Verificación por SMS/teléfono: NO está incluida porque enviar SMS
**cuesta dinero** (Twilio u otro, pago por mensaje). El teléfono se
guarda y se valida el formato, pero la verificación real por SMS
sería un servicio pago aparte.

IMPORTANTE: estas monedas son **de juego, sin valor real**. No cobres
dinero real por monedas ni permitas cambiarlas por dinero — eso
convertiría el juego en otra cosa. Manténlo como fichas de jugar.

---

## Base de datos permanente (Supabase) — para que NADA se borre

Por defecto las cuentas/monedas viven en memoria y se borran si el
servidor reinicia. Con Supabase (gratis) se guardan para siempre y las
claves quedan encriptadas.

### Paso 1 — Crear Supabase
1. Entra a https://supabase.com → "Start your project" → crea cuenta
   gratis (puedes usar GitHub).
2. "New project". Ponle nombre (ej: `domidom`), una contraseña de base
   de datos (anótala, aunque no la usarás aquí) y la región más cercana.
   Espera ~2 min a que se cree.

### Paso 2 — Crear la tabla (un copia y pega)
1. En el panel de Supabase, menú izquierdo → **"SQL Editor"** → "New query".
2. Pega esto tal cual y dale **"Run"**:

   ```sql
   create table if not exists domidom_state (
     id text primary key,
     data jsonb
   );
   ```
3. Debe decir "Success". Listo, la tabla está creada.

### Paso 3 — Copiar las llaves
1. Menú izquierdo → **"Project Settings"** (el engranaje) → **"API"**.
2. Copia dos cosas:
   - **Project URL** (algo como `https://xxxx.supabase.co`)
   - En "Project API keys", la llave **`service_role`** (la secreta,
     dale a "Reveal" / el ojito). NO la `anon`.

### Paso 4 — Ponerlas en Render
1. Render → tu servicio `domidom` → menú izquierdo **"Environment"**.
2. "Add Environment Variable" dos veces:
   - Key: `SUPABASE_URL`  ·  Value: el Project URL del paso 3
   - Key: `SUPABASE_KEY`  ·  Value: la llave `service_role` del paso 3
3. "Save Changes". Render reinicia solo.

Listo. En los logs de Render verás "Supabase conectado — datos
permanentes." y "Estado cargado de la DB". Desde ahora las cuentas,
monedas, solicitudes y reportes **NO se borran nunca**, aunque Render
reinicie o duermas/despiertes el servidor.

Si NO pones esas dos variables, el juego sigue funcionando igual pero
en memoria (temporal) — el código aguanta las dos formas.

Nota: como ahora las claves se guardan encriptadas, las cuentas viejas
(de cuando era en memoria) ya no sirven; cada quien crea su cuenta de
nuevo una sola vez y a partir de ahí queda permanente.

---

## Importante / honesto

- **Cuentas, monedas y leaderboard viven en memoria.** Si el servidor
  se reinicia (o Render lo duerme y lo vuelve a prender), se borran.
  Sirve perfecto para probar y jugar con amigos. Para que sea
  permanente hay que conectar una base de datos.
- **Siguiente paso (Etapa 3): base de datos real.** Cuando quieras que
  las cuentas/monedas no se borren nunca, el plan es conectar Supabase
  (gratis para empezar). Pídeselo a Claude así:

  > "Conecta el servidor de Domi Dom a Supabase: crea tabla de
  > usuarios con wallet/net/games/wins, y guarda/lee las cuentas y el
  > leaderboard desde ahí en vez de la memoria. Paso a paso."

- Monedas y skins son **de juego, sin valor real**: sin depósitos, sin
  retiros, sin compras. Manténlo así.

---

## Cómo está armado (para Claude Code)

- `server.js` — servidor autoritativo. Tiene el motor de dominó
  (repartir, turnos, validar jugadas, tranca, capicúa, puntaje a 200),
  matchmaking por cola, salas por código, bots de relleno/justos para
  desconectados, chat y la transmisión del estrellón (`slam`).
- `public/index.html` — el cliente: login, lobby, matchmaking, salas,
  mesa en tiempo real con la serpiente real, chat y el estrellón que
  oye toda la mesa.
- `package.json` — dependencias (express, socket.io).

Eventos principales (socket): `register`, `login`, `findMatch`,
`createRoom`, `joinRoom`, `addBot`, `startRoom`, `play`, `pass`,
`chat`; el servidor manda `room`, `game`, `chat`, `slam`,
`matchStarted`, `handOver`, `matchOver`, `leaderboard`.
