// ============================================================
//  MINOBRON — Cloudinary Upload Utility
//  Sostituisci CLOUD_NAME e UPLOAD_PRESET con i tuoi valori.
//  Vedi SETUP.md sezione Cloudinary per le istruzioni.
// ============================================================

const CLOUD_NAME    = 'dlbuqmqlh'   // es. "minobron"
const UPLOAD_PRESET = 'minobron_unsigned'   // es. "minobron_unsigned"

/**
 * Carica un file su Cloudinary e restituisce { url, name, type, size }
 * Funziona con immagini, PDF, documenti — qualsiasi file.
 */
export async function uploadToCloudinary(file) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)
  formData.append('folder', 'minobron')

  // Immagini e video: auto (ottimizzazione Cloudinary)
  // Tutti gli altri (PDF, Word, Excel, ecc.): raw — preserva il file originale senza conversioni
  const isMedia = file.type?.startsWith('image/') || file.type?.startsWith('video/') || file.type?.startsWith('audio/')
  const resourceType = isMedia ? 'auto' : 'raw'

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
    { method: 'POST', body: formData }
  )

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || 'Upload fallito')
  }

  const data = await res.json()
  return {
    url:  data.secure_url,
    name: file.name,
    type: file.type,
    size: file.size,
  }
}
