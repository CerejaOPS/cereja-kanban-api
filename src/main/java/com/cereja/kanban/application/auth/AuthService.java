package com.cereja.kanban.application.auth;

import com.cereja.kanban.application.exception.AuthenticationFailedException;
import com.cereja.kanban.domain.DiscordUser.DiscordUser;
import com.cereja.kanban.domain.DiscordUser.IDiscordUserRepository;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    // Sugestão: podemos usar uma enum no futuro, mas como a task não pede isso em especifico vou deixar dessa forma por enquanto
    private static final String DEFAULT_ROLE = "dev";

    private final IDiscordProviderPort discordProvider;
    private final IDiscordUserRepository userRepository;
    private final ITokenGeneratorPort tokenGenerator;


    public AuthService(IDiscordProviderPort discordProvider,
                       IDiscordUserRepository userRepository,
                       ITokenGeneratorPort tokenGenerator) {
        this.discordProvider = discordProvider;
        this.userRepository = userRepository;
        this.tokenGenerator = tokenGenerator;
    }

    /**
     * Orquestra o fluxo de login via OAuth2 através das seguintes etapas:
     * 1. Troca a concessão de autorização externa por um access token da plataforma.
     * 2. Recupera as informações do perfil do usuário na API do provedor.
     * 3. Registra um novo usuário no banco ou atualiza um existente (garantindo que o role atual não seja alterado).
     * 4. Emite a credencial de sessão interna da aplicação.
     *
     * @param code concessão temporária de autorização recebida no redirecionamento do provedor
     * @return token JWT assinado para acesso aos endpoints protegidos
     * @throws AuthenticationFailedException quando a validação falha em qualquer etapa de comunicação com o provedor
     */

    public String processarCallbackDiscord(String code) {

        // 1. Pega o Token do Discord
        String accessToken = this.discordProvider.getAccessToken(code);

        // 2. Pega os dados do usuário usando o Token
        DiscordUserInfo userInfo = this.discordProvider.getUserInfo(accessToken);

        // 3. Busca o usuário no banco de dados (retorna um Optional, que pode ter algo ou ser vazio)
        var optionalUser = this.userRepository.findByDiscordId(userInfo.id());

        DiscordUser user;

        if (optionalUser.isPresent()) {
            user = optionalUser.get();
            user.setUsername(userInfo.username());
            user.setAvatar(userInfo.avatar());

        } else {
            user = new DiscordUser();
            user.setDiscordId(userInfo.id());
            user.setUsername(userInfo.username());
            user.setAvatar(userInfo.avatar());
            user.setRole(DEFAULT_ROLE); // Cargo padrão
        }

        // 4. Salva no banco.
        user = this.userRepository.save(user);

        // 5. Gera o JWT com o usuário atualizado
        return this.tokenGenerator.generateToken(user);
    }

    /**
     * Retorna a URL de autorização do Discord para iniciar o fluxo OAuth2.
     * Delega a chamada para o provider, garantindo que a camada de apresentação
     * não acesse a infraestrutura diretamente.
     *
     * @return URL de redirecionamento para a tela de login do Discord.
     */
    public String obterUrlAutorizacaoDiscord() {
        return this.discordProvider.getAuthorizationUrl();
    }
}