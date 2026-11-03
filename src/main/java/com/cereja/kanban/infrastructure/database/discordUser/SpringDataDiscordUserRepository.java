package com.cereja.kanban.infrastructure.database.discordUser;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SpringDataDiscordUserRepository extends JpaRepository<DiscordUserEntity, Long> {
    Optional<DiscordUserEntity> findByDiscordId(String discordId);
}

