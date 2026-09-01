package com.cereja.kanban.domain.exception;

public class InvalidPhaseTransitionException extends RuntimeException {
    public InvalidPhaseTransitionException(String message) {
        super(message);
    }
}
