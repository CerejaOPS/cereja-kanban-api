package com.cereja.kanban.infrastructure.security;

import com.cereja.kanban.application.auth.AuthenticatedUser;
import com.cereja.kanban.application.auth.ITokenValidatorPort;
import com.cereja.kanban.application.exception.AuthenticationFailedException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Filtro HTTP que intercepta as requisições para validar o token JWT.
 * Garante que apenas usuários autenticados acessem os recursos protegidos,
 * injetando o objeto AuthenticatedUser no contexto da requisição (request attributes).
 */
@Component
public class JwtFilter extends OncePerRequestFilter {

    private final ITokenValidatorPort tokenValidator;
    // Instanciamos diretamente em vez de pedir para o Spring injetar
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Construtor recebe apenas o tokenValidator agora
    public JwtFilter(ITokenValidatorPort tokenValidator) {
        this.tokenValidator = tokenValidator;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/api/auth/")
                || path.equals("/api/health")
                || HttpMethod.OPTIONS.matches(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            escreverErroNaoAutorizado(response, "Acesso negado: Token de autenticação ausente ou malformado.");
            return;
        }

        String token = authHeader.substring(7);
        AuthenticatedUser user;

        try {
            user = tokenValidator.validateToken(token);
        } catch (AuthenticationFailedException e) {
            escreverErroNaoAutorizado(response, e.getMessage());
            return;
        }

        request.setAttribute("authenticatedUser", user);
        filterChain.doFilter(request, response);
    }

    private void escreverErroNaoAutorizado(HttpServletResponse response, String mensagem) throws IOException {
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");

        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, mensagem);
        response.getWriter().write(objectMapper.writeValueAsString(problemDetail));
    }
}