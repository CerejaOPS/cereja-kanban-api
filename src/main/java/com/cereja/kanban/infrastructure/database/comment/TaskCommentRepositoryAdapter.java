package com.cereja.kanban.infrastructure.database.comment;

import com.cereja.kanban.domain.comment.ITaskCommentRepository;
import com.cereja.kanban.domain.comment.TaskComment;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public class TaskCommentRepositoryAdapter implements ITaskCommentRepository {

    private final SpringDataTaskCommentRepository jpaRepository;

    public TaskCommentRepositoryAdapter(SpringDataTaskCommentRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public TaskComment save(TaskComment domain) {
        TaskCommentEntity entity = toEntity(domain);
        TaskCommentEntity saved = jpaRepository.save(entity);
        return toDomain(saved);
    }

    @Override
    public List<TaskComment> findByTaskId(Long taskId) {
        return jpaRepository.findByTaskIdOrderByCreatedAtAsc(taskId)
                .stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    public Optional<TaskComment> findById(Long id) {
        return jpaRepository.findById(id).map(this::toDomain);
    }

    @Override
    public void deleteById(Long id) {
        jpaRepository.deleteById(id);
    }

    private TaskCommentEntity toEntity(TaskComment domain) {
        return new TaskCommentEntity(
                domain.getId(),
                domain.getTaskId(),
                domain.getAuthorDiscordId(),
                domain.getAuthorName(),
                domain.getAuthorAvatar(),
                domain.getContent(),
                domain.getCreatedAt()
        );
    }

    private TaskComment toDomain(TaskCommentEntity entity) {
        return new TaskComment(
                entity.getId(),
                entity.getTaskId(),
                entity.getAuthorDiscordId(),
                entity.getAuthorName(),
                entity.getAuthorAvatar(),
                entity.getContent(),
                entity.getCreatedAt()
        );
    }
}