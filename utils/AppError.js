/**
 * Classe customizada para tratar erros operacionais previstos na aplicação.
 * Ao invés de lançar um throw new Error genérico que gera um 500,
 * usamos o AppError para definir a mensagem e o HTTP Status Code correto (ex: 400, 404).
 */
export class AppError extends Error {
  /**
   * @param {string} message - A mensagem de erro amigável (ex: "Tarefa não encontrada")
   * @param {number} statusCode - O código HTTP correspondente (ex: 404)
   */
  constructor(message, statusCode) {
    super(message);
    
    this.statusCode = statusCode;
    // Identifica que este é um erro que prevemos na regra de negócio (não um bug não tratado)
    this.isOperational = true;

    // Preserva a stack trace do erro original (onde ocorreu no código)
    Error.captureStackTrace(this, this.constructor);
  }
}
