package com.cereja.kanban.presentation.Auth;

import com.cereja.kanban.application.auth.AuthService;
import com.cereja.kanban.application.exception.AuthenticationFailedException;
import com.cereja.kanban.presentation.Auth.DTO.AuthResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /**
     * Inicia o fluxo de autenticação OAuth2 redirecionando o usuário para a tela de autorização do Discord.
     * Retorna um status 302 (Found) contendo a URL no header Location.
     *
     * @return Redirecionamento HTTP 302 para a URL de autorização.
     */
    @GetMapping("/discord")
    public ResponseEntity<Void> loginDiscord() {
        String url = authService.obterUrlAutorizacaoDiscord();

        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(url))
                .build();
    }

    /**
     * Endpoint de callback (redirect_uri) acionado pelo Discord após a decisão do usuário na tela de autorização.
     * Recebe o código de autorização e o troca por um token JWT interno da aplicação.
     *
     * @param code  Código gerado pelo Discord caso o usuário aprove a autorização.
     * @param error Erro retornado pelo Discord (ex: "access_denied" caso o usuário clique em Cancelar).
     * @return DTO contendo o Token JWT gerado pela aplicação em caso de sucesso.
     * @throws AuthenticationFailedException se o usuário negar o acesso ou se o código estiver ausente.
     */
    @GetMapping("/discord/callback")
    public ResponseEntity<AuthResponse> callbackDiscord(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String error) {

        // Se o usuário clicar em "Cancelar", o Discord envia ?error=access_denied
        if (error != null || code == null || code.isBlank()) {
            throw new AuthenticationFailedException("Acesso negado pelo usuário ou código de autorização ausente.");
        }

        String token = authService.processarCallbackDiscord(code);

        return ResponseEntity.ok(new AuthResponse(token));
    }
}