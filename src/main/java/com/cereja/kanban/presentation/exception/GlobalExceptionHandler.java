package com.cereja.kanban.presentation.exception;

import com.cereja.kanban.application.exception.AuthenticationFailedException;
import com.cereja.kanban.application.exception.ResourceNotFoundException;
import com.cereja.kanban.domain.exception.InvalidPhaseTransitionException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Interceptador global de exceções da camada de apresentação.
 * Padroniza as respostas de erro da API utilizando a especificação ProblemDetail (RFC 7807).
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(AuthenticationFailedException.class)
    public ProblemDetail handleAuthenticationFailedException(AuthenticationFailedException e) {
        log.warn("Falha de autenticação: {}", e.getMessage(), e.getCause());
        return ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, e.getMessage());
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ProblemDetail handleResourceNotFoundException(ResourceNotFoundException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
    }

    @ExceptionHandler(InvalidPhaseTransitionException.class)
    public ProblemDetail handleInvalidPhaseTransitionException(InvalidPhaseTransitionException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, e.getMessage());
    }
}