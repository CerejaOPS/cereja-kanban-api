package com.cereja.kanban.infrastructure.security;

import com.cereja.kanban.application.auth.AuthenticatedUser;
import com.cereja.kanban.application.exception.AuthenticationFailedException;
import com.cereja.kanban.domain.DiscordUser.DiscordUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class JwtTokenAdapterTest {

    // Chave de teste com mais de 32 bytes/256 bits
    private static final String SECRET_TESTE = "umaChaveSuperSecretaParaOsTestesUnitariosDoKanban123456789";
    private static final long EXPIRATION_MS = 3600000; // 1 hora

    private JwtTokenAdapter jwtTokenAdapter;

    @BeforeEach
    void setUp() {
        jwtTokenAdapter = new JwtTokenAdapter(SECRET_TESTE, EXPIRATION_MS);
    }

    @Test
    @DisplayName("Deve gerar e validar o token com sucesso extraindo os dados do usuário")
    void deveGerarEValidarTokenComSucesso() {
        // 1. Arrange: cria um usuário de domínio
        DiscordUser user = new DiscordUser(1L, "123456", "pedro_dev", "avatar.png", "dev");

        // 2. Act: gera e valida o token
        String token = jwtTokenAdapter.generateToken(user);
        AuthenticatedUser authUser = jwtTokenAdapter.validateToken(token);

        // 3. Assert: confere se bateu tudo
        assertNotNull(token);
        assertEquals(1L, authUser.userId());
        assertEquals("123456", authUser.discordId());
        assertEquals("pedro_dev", authUser.username());
        assertEquals("dev", authUser.role());
    }

    @Test
    @DisplayName("Deve falhar ao validar token adulterado")
    void deveFalharComTokenAdulterado() {
        DiscordUser user = new DiscordUser(1L, "123456", "pedro_dev", "avatar.png", "dev");
        String token = jwtTokenAdapter.generateToken(user);

        // Adultera o final do token
        String tokenAdulterado = token.substring(0, token.length() - 5) + "abcde";

        assertThrows(AuthenticationFailedException.class, () -> {
            jwtTokenAdapter.validateToken(tokenAdulterado);
        });
    }

    @Test
    @DisplayName("Deve falhar ao validar token expirado")
    void deveFalharComTokenExpirado() {
        // Adapter com expiração retroativa (-1 segundo) para gerar token já expirado
        JwtTokenAdapter adapterExpirado = new JwtTokenAdapter(SECRET_TESTE, -1000L);
        DiscordUser user = new DiscordUser(1L, "123456", "pedro_dev", "avatar.png", "dev");
        String token = adapterExpirado.generateToken(user);

        assertThrows(AuthenticationFailedException.class, () -> {
            jwtTokenAdapter.validateToken(token);
        });
    }

    @Test
    @DisplayName("Deve falhar ao validar token assinado com outra chave secreta")
    void deveFalharComChaveDiferente() {
        String outraChave = "outraChaveTotalmenteDiferenteMasLongaOuficienteParaTeste123456";
        JwtTokenAdapter outroAdapter = new JwtTokenAdapter(outraChave, EXPIRATION_MS);
        DiscordUser user = new DiscordUser(1L, "123456", "pedro_dev", "avatar.png", "dev");

        String tokenGeradoComOutraChave = outroAdapter.generateToken(user);

        assertThrows(AuthenticationFailedException.class, () -> {
            jwtTokenAdapter.validateToken(tokenGeradoComOutraChave);
        });
    }

    @Test
    @DisplayName("Deve falhar ao validar token com formato inválido (string qualquer)")
    void deveFalharComFormatoInvalido() {
        String tokenInvalido = "token-invalido-que-nao-e-jwt";

        assertThrows(AuthenticationFailedException.class, () -> {
            jwtTokenAdapter.validateToken(tokenInvalido);
        });
    }
}