package com.cereja.kanban.application.auth;

import com.cereja.kanban.domain.DiscordUser.DiscordUser;
import com.cereja.kanban.domain.DiscordUser.IDiscordUserRepository;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

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

    public String processarCallbackDiscord(String code) {

        // 1. Pega o Token do Discord
        String accessToken = this.discordProvider.getAccessToken(code);

        // 2. Pega os dados do usuário usando o Token
        DiscordUserInfo userInfo = this.discordProvider.getUserInfo(accessToken);

        // 3 e 4. Checa se existe. Se não existir, cria e salva. Se existir, retorna ele.
        DiscordUser user = this.userRepository.findByDiscordId(userInfo.id())
                .orElseGet(() -> {
                    DiscordUser newUser = new DiscordUser();
                    newUser.setDiscordId(userInfo.id());
                    newUser.setUsername(userInfo.username());
                    newUser.setAvatar(userInfo.avatar());
                    newUser.setRole("dev"); // Cargo padrão
                    return this.userRepository.save(newUser);
                });

        // 5. Gera o JWT
        return this.tokenGenerator.generateToken(user);
    }
}