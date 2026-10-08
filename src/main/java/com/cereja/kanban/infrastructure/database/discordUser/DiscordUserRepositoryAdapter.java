package com.cereja.kanban.infrastructure.database.discordUser;

import com.cereja.kanban.domain.DiscordUser.DiscordUser;
import com.cereja.kanban.domain.DiscordUser.IDiscordUserRepository;
import com.cereja.kanban.domain.Task.Task;
import com.cereja.kanban.infrastructure.database.task.SpringDataTaskRepository;
import com.cereja.kanban.infrastructure.database.task.TaskEntity;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;


@Component
public class DiscordUserRepositoryAdapter implements IDiscordUserRepository {

    private final SpringDataDiscordUserRepository springDataRepository;

    // Construtor: o Spring injeta a interface mágica aqui automaticamente
    public DiscordUserRepositoryAdapter(SpringDataDiscordUserRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    public DiscordUser save(DiscordUser discordUser) {
        DiscordUserEntity entity = new DiscordUserEntity();

        entity.setDiscordId(discordUser.getDiscordId());
        entity.setId(discordUser.getId());
        entity.setRole(discordUser.getRole());
        entity.setAvatar(discordUser.getAvatar());
        entity.setUsername(discordUser.getUsername());

        DiscordUserEntity savedEntity = springDataRepository.save(entity);

        return toDomain(savedEntity);
    }

    public DiscordUser toDomain(DiscordUserEntity entity){
        DiscordUser domainUser = new DiscordUser();

        domainUser.setDiscordId(entity.getDiscordId());
        domainUser.setId(entity.getId());
        domainUser.setRole(entity.getRole());
        domainUser.setAvatar(entity.getAvatar());
        domainUser.setUsername(entity.getUsername());

        return domainUser;
    }

    public List<DiscordUser> findAll(){
        return springDataRepository.findAll().stream().map(this::toDomain).toList();
    }

    @Override
    public Optional<DiscordUser> findById(Long id) {
        Optional<DiscordUserEntity> entityOptional = springDataRepository.findById(id);

        return entityOptional.map(this::toDomain);
    }

    @Override
    public Optional<DiscordUser> findByDiscordId(String discordId) {
        Optional<DiscordUserEntity> entityOptional = springDataRepository.findByDiscordId(discordId);
        return entityOptional.map(this::toDomain);
    }

    @Override
    public void deleteById(Long id) {
        springDataRepository.deleteById(id);
    }
}