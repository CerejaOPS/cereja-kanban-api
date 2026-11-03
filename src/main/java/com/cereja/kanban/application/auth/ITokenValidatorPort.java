package com.cereja.kanban.application.auth;

public interface ITokenValidatorPort {
    AuthenticatedUser validateToken(String token);
}
