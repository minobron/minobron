// ============================================================
//  MINOBRON — EmailJS: notifica email quando un task è assegnato
//
//  SETUP (da fare UNA VOLTA):
//  1. Vai su https://www.emailjs.com e crea un account gratuito
//  2. Aggiungi un "Email Service" (es. Gmail) → copia il Service ID
//  3. Crea un "Email Template" con queste variabili:
//       {{to_email}}     — email del destinatario
//       {{to_name}}      — nome del destinatario
//       {{from_name}}    — nome di chi ha assegnato il task
//       {{task_title}}   — titolo del task
//       {{project_name}} — nome del progetto
//     Testo di esempio:
//       "Ciao {{to_name}}, {{from_name}} ti ha assegnato il task
//        "{{task_title}}" nel progetto {{project_name}}."
//  4. Copia il Template ID
//  5. Vai su Account → API Keys → copia la Public Key
//  6. Sostituisci i tre valori qui sotto
//  7. Esegui: npm install @emailjs/browser
// ============================================================

import emailjs from '@emailjs/browser'

const SERVICE_ID  = 'service_0tkly8m'    // es. 'service_abc123'
const TEMPLATE_ID = 'template_8hf4ho9'   // es. 'template_xyz789'
const PUBLIC_KEY  = '2NCkNVn55Yiv5TI8g'    // es. 'user_XXXXXXXXXXXXXXXXX'

/**
 * Invia una email di notifica per task assegnato.
 * Fail silenzioso: se EmailJS non è configurato o c'è un errore,
 * il task viene comunque creato senza bloccare l'utente.
 *
 * @param {{ toEmail: string, toName: string, fromName: string, taskTitle: string, projectName: string }} params
 */
export async function sendTaskAssignedEmail({ toEmail, toName, fromName, taskTitle, projectName }) {
  // Se le costanti non sono state configurate, salta silenziosamente
  if (SERVICE_ID === 'YOUR_SERVICE_ID') return

  try {
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        to_email:     toEmail,
        to_name:      toName,
        from_name:    fromName,
        task_title:   taskTitle,
        project_name: projectName,
      },
      PUBLIC_KEY
    )
  } catch (err) {
    // Non bloccare la UI se l'email fallisce
    console.warn('[EmailJS] Errore invio email:', err)
  }
}
