package com.cereja.kanban.application.comment;

import com.cereja.kanban.domain.comment.ITaskCommentRepository;
import com.cereja.kanban.domain.comment.TaskComment;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class GetCommentsByTaskIdUseCase {

    private final ITaskCommentRepository commentRepository;

    public GetCommentsByTaskIdUseCase(ITaskCommentRepository commentRepository) {
        this.commentRepository = commentRepository;
    }

    public List<TaskComment> execute(Long taskId) {
        return commentRepository.findByTaskId(taskId);
    }
}