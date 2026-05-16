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

IMPORTANTE: estas monedas son **de juego, sin valor real**. No cobres
dinero real por monedas ni permitas cambiarlas por dinero — eso
convertiría el juego en otra cosa. Manténlo como fichas de jugar.

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
