/**
 * For errors that are ok to send down to the client.
 * (Since blindly sending error information down to the client would be a
 * security issue.)
 */
export default class ClientReportableError extends Error {
  constructor(message: string) {
    super(message);
  }
}
