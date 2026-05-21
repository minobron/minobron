# Minobron — Guida Setup Completa

## Cosa ti serve
- Node.js installato sul tuo Mac → scaricalo da https://nodejs.org (versione LTS)
- Un account GitHub gratuito → https://github.com
- Un account Vercel gratuito → https://vercel.com
- Un account Cloudinary gratuito → https://cloudinary.com (per i file)
- Il tuo account Google (già ce l'hai)

---

## PASSO 1 — Crea il progetto Firebase (10 minuti)

1. Vai su https://console.firebase.google.com
2. Clicca **"Aggiungi progetto"** → nome: `minobron` → continua
3. Disabilita Google Analytics (non serve) → **"Crea progetto"**

### Attiva l'autenticazione Google
4. Nel menu a sinistra: **Build → Authentication**
5. Clicca **"Inizia"**
6. Nella tab **"Sign-in method"** → clicca **Google** → abilita → salva

### Crea il database Firestore
7. Nel menu a sinistra: **Build → Firestore Database**
8. Clicca **"Crea database"**
9. Scegli **"Inizia in modalità test"** → avanti → scegli la regione `eur3 (europe-west)` → abilita

### ~~Attiva lo Storage (per i file)~~
> ⚠️ **Salta questo passo.** Usiamo Cloudinary al posto di Firebase Storage (vedi PASSO 2b).

### Ottieni le credenziali
12. Clicca sull'icona ingranaggio ⚙️ in alto a sinistra → **"Impostazioni progetto"**
13. Nella sezione **"Le tue app"** → clicca l'icona `</>` (Web)
14. Nome app: `minobron-web` → clicca **"Registra app"**
15. Copia i valori che appaiono (li userai nel passo 3)

---

## PASSO 2b — Configura Cloudinary (5 minuti, nessuna carta richiesta)

1. Vai su https://cloudinary.com e clicca **"Sign Up For Free"**
2. Registrati con Google o email — il piano gratuito include **25GB** di spazio
3. Una volta dentro, nella dashboard in alto vedi il tuo **Cloud Name** (es. `dxyz1234`) — copialo
4. Vai su **Settings → Upload** (menu in alto a destra → icona ingranaggio)
5. Scorri fino a **"Upload presets"** → clicca **"Add upload preset"**
6. Imposta:
   - **Preset name**: `minobron_unsigned`
   - **Signing Mode**: `Unsigned` ← importante
   - **Folder**: `minobron`
7. Clicca **"Save"**

### Inserisci i valori nel codice

Apri `src/utils/cloudinary.js` e sostituisci:

```js
const CLOUD_NAME    = 'dxyz1234'          // ← il tuo Cloud Name
const UPLOAD_PRESET = 'minobron_unsigned' // ← il nome che hai scelto
```

---

## PASSO 2 — Crea i workspace su Firestore (5 minuti)

1. Vai su **Firestore Database** nella console Firebase
2. Clicca **"Avvia raccolta"** → ID raccolta: `workspaces` → avanti
3. Crea il documento per **Lievemente**:
   - ID documento: `lievemente` (o lascia auto-generato)
   - Aggiungi campi:
     - `name` (string): `Lievemente`
     - `emoji` (string): `✨`
     - `color` (string): `rose`
     - `memberIds` (array): aggiungi l'UID del tuo account Google
     - `adminIds` (array): aggiungi il tuo UID

4. Clicca **"Aggiungi documento"** per il workspace **SMP**:
   - `name` (string): `SMP`
   - `emoji` (string): `🎯`
   - `color` (string): `indigo`
   - `memberIds` (array): [i tuoi 10 UID del team]
   - `adminIds` (array): [il tuo UID]

### Come trovi il tuo UID Google:
Dopo il passo 3 qui sotto, fai login nell'app e il tuo UID apparirà in **Authentication → Users** nella console Firebase.

---

## PASSO 3 — Configura l'app (2 minuti)

Apri il file `src/firebase/config.js` e sostituisci i valori con quelli copiati al passo 1:

```js
const firebaseConfig = {
  apiKey:            "AIzaSy...",      // ← incolla qui
  authDomain:        "minobron.firebaseapp.com",
  projectId:         "minobron",
  storageBucket:     "minobron.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc..."
}
```

---

## PASSO 4 — Avvia in locale per testare (2 minuti)

Apri il Terminale del Mac, entra nella cartella `minobron` e lancia:

```bash
npm install
npm run dev
```

Apri il browser su http://localhost:5173 — dovresti vedere la schermata di login di Minobron.

---

## PASSO 5 — Pubblica online con Vercel (5 minuti)

### Opzione A — Deploy diretto dalla cartella (più semplice)

1. Vai su https://vercel.com e accedi con Google
2. Clicca **"Add New → Project"**
3. Clicca **"Import Git Repository"** → collega il tuo GitHub
4. Carica la cartella `minobron` su un repository GitHub (basta trascinarla)
5. Importa il progetto → clicca **"Deploy"**
6. In 2 minuti l'app sarà online su `minobron.vercel.app`

### Opzione B — Deploy da terminale

```bash
npm install -g vercel
vercel
```

Segui le istruzioni → in 1 minuto è online.

---

## PASSO 6 — Installare l'app su iPhone

1. Apri Safari su iPhone → vai all'URL del tuo sito Vercel
2. Tocca il pulsante **Condividi** (il quadrato con la freccia su)
3. Scorri e tocca **"Aggiungi a schermata Home"**
4. Conferma → l'icona Minobron appare sulla home!

Ripeti per tutti i membri del team — basta mandare il link.

---

## Invitare i membri del team

Per aggiungere qualcuno al workspace:
1. Vai su Firebase → Authentication → Users per trovare il loro UID dopo che hanno fatto il primo login
2. Aggiungi il loro UID all'array `memberIds` del documento workspace su Firestore

In futuro possiamo aggiungere un pannello admin nell'app per fare questo direttamente senza toccare Firebase.

---

## Costi

| Servizio | Piano | Spazio | Costo |
|----------|-------|--------|-------|
| Firebase | Spark (gratuito) | — | 0€/mese |
| Cloudinary | Free | 25 GB | 0€/mese |
| Vercel | Hobby (gratuito) | — | 0€/mese |
| **Totale** | | | **0€/mese** |

Firebase regge fino a ~50.000 letture/giorno — più che sufficiente per 10-12 utenti. Cloudinary gestisce tutti i file (foto, documenti, screenshot) con 25GB gratuiti e nessuna carta di credito richiesta.

---

## Hai bisogno di aiuto?

Torna a parlare con me (Claude) e descrivi dove sei rimasto bloccato. Posso guidarti passo per passo.
