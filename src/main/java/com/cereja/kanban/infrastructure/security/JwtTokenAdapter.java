package com.cereja.kanban.infrastructure.security;

import com.cereja.kanban.application.auth.AuthenticatedUser;
import com.cereja.kanban.application.auth.ITokenGeneratorPort;
import com.cereja.kanban.application.auth.ITokenValidatorPort;
import com.cereja.kanban.application.exception.AuthenticationFailedException;
import com.cereja.kanban.domain.DiscordUser.DiscordUser;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * Adaptador que encapsula os detalhes da biblioteca jjwt.
 * Implementa as portas de geração e validação de tokens JWT.
 */
@Component
public class JwtTokenAdapter implements ITokenGeneratorPort, ITokenValidatorPort {

    private final SecretKey key;
    private final long expirationMs;

    public JwtTokenAdapter(@Value("${jwt.secret}") String secret,
                           @Value("${jwt.expiration}") long expirationMs) {
        // O algoritmo HS256 requer uma chave com pelo menos 32 bytes (256 bits).
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    /**
     * Gera um token JWT assinado para um usuário do Discord, inserindo seus dados nas claims.
     *
     * @param user Entidade de domínio do usuário.
     * @return Token JWT no formato String.
     */
    @Override
    public String generateToken(DiscordUser user) {
        return Jwts.builder()
                .subject(String.valueOf(user.getId()))
                .claim("discordId", user.getDiscordId())
                .claim("username", user.getUsername())
                .claim("role", user.getRole()) // Fallback removido, reflete apenas a regra do domínio/service
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(key)
                .compact();
    }

    /**
     * Faz o parse do token, verifica a assinatura e converte as claims no crachá AuthenticatedUser.
     *
     * @param token Token JWT bruto recebido via cabeçalho de autorização.
     * @return Objeto AuthenticatedUser contendo apenas os dados extraídos do token.
     * @throws AuthenticationFailedException se a assinatura for inválida, token expirado ou malformado.
     */
    @Override
    public AuthenticatedUser validateToken(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            Long userId = Long.valueOf(claims.getSubject());
            String discordId = claims.get("discordId", String.class);
            String username = claims.get("username", String.class);
            String role = claims.get("role", String.class);

            return new AuthenticatedUser(userId, discordId, username, role);

        } catch (JwtException | IllegalArgumentException e) {
            throw new AuthenticationFailedException("Token inválido ou expirado.", e);
        }
    }
}