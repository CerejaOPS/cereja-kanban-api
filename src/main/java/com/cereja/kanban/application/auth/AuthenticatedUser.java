package com.cereja.kanban.application.auth;

/**
 * Representa o "crachá" do usuário logado na aplicação.
 * Este objeto é montado exclusivamente a partir das claims extraídas do token JWT,
 * evitando a necessidade de ir ao banco de dados para validar o usuário a cada requisição.
 */
public record AuthenticatedUser(
        Long userId,
        String discordId,
        String username,
        String role
) {
}