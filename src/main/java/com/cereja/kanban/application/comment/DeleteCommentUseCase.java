package com.cereja.kanban.application.comment;

import com.cereja.kanban.application.exception.ResourceNotFoundException;
import com.cereja.kanban.domain.comment.ITaskCommentRepository;
import com.cereja.kanban.domain.comment.TaskComment;
import org.springframework.stereotype.Service;

@Service
public class DeleteCommentUseCase {

    private final ITaskCommentRepository commentRepository;

    public DeleteCommentUseCase(ITaskCommentRepository commentRepository) {
        this.commentRepository = commentRepository;
    }

    public void execute(Long commentId, String requesterDiscordId) {
        TaskComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comentário não encontrado com o ID: " + commentId));

        if (!comment.getAuthorDiscordId().equals(requesterDiscordId)) {
            throw new SecurityException("Você não tem permissão para deletar este comentário.");
        }

        commentRepository.deleteById(commentId);
    }
}