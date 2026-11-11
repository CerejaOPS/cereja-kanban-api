package com.cereja.kanban.application.comment;

import com.cereja.kanban.domain.comment.ITaskCommentRepository;
import com.cereja.kanban.domain.comment.TaskComment;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class AddCommentUseCase {

    private final ITaskCommentRepository commentRepository;

    public AddCommentUseCase(ITaskCommentRepository commentRepository) {
        this.commentRepository = commentRepository;
    }

    public TaskComment execute(Long taskId, String authorDiscordId, String authorName, String authorAvatar, String content) {
        if (content == null || content.trim().isEmpty()) {
            throw new IllegalArgumentException("O conteúdo do comentário não pode ser vazio.");
        }

        if (content.length() > 2000) {
            throw new IllegalArgumentException("O comentário excede o limite de 2000 caracteres.");
        }

        TaskComment novoComentario = new TaskComment(
                null,
                taskId,
                authorDiscordId,
                authorName,
                authorAvatar,
                content.trim(),
                LocalDateTime.now()
        );

        return commentRepository.save(novoComentario);
    }
}