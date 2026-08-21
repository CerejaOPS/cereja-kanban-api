package com.cereja.kanban.domain.DiscordUser;

import java.util.List;
import java.util.Optional;

public interface IDiscordUserRepository {
    DiscordUser save(DiscordUser discordUser);
    List<DiscordUser> findAll();
    Optional<DiscordUser> findById(Long id);
    void deleteById(Long id);
}
