package com.cereja.kanban.application.auth;

import com.cereja.kanban.domain.DiscordUser.DiscordUser;

public interface ITokenGeneratorPort {
    String generateToken(DiscordUser user);
}
