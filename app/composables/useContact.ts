export interface ContactRequest {
  name: string
  email: string
  phone?: string
  subject: string
  message: string
}

/**
 * Envío del formulario de contacto público (POST /v1/public/contact).
 * Endpoint sin autenticación.
 */
export const useContact = () => {
  const send = (body: ContactRequest) =>
    useApi('/v1/public/contact', { method: 'POST', body, skipAuth: true, silent: true })

  return { send }
}
